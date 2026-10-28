# HU-03 — Previsión administrativa de demanda

Issue #1 · rama `feat/hu-03-pronostico-demanda` · origen `e899442` de `base`.
La implementación añade una pestaña al panel existente, no una segunda aplicación.
Auditoría previa: [HU03_PREVISION_DEMANDA](auditorias/HU03_PREVISION_DEMANDA.md).

## Fuentes y significado de los datos

Se consultan reservations → rooms → hotels. No se consultan ni devuelven usuarios,
correos, contraseñas, pagos o identidades de huéspedes. Se reutilizan sesiones,
CSRF y autorización ADMIN de Spring Security. No hay restricciones por hotel en
el modelo actual: un ADMIN puede filtrar un hotel o todos. USER recibe 403 y una
sesión anónima/expirada recibe 401. Los dos endpoints son GET de solo consulta.

Una reserva cuenta como operación si su estancia válida intersecta el período.
No se utiliza created_at para agrupar demanda. CONFIRMED aporta noches; CANCELLED
no aporta noches. Otros estados cuentan en el indicador de estados desconocidos
y no comprometen demanda. No se introduce COMPLETED ni se cambian transiciones.

Cada fecha d cuenta una habitación si `start_date::date <= d < end_date::date`.
Entrada 10/11, salida 13/11: noches del 10, 11 y 12. La serie incluye ceros y se
recorta al período seleccionado. Reservas distintas de habitaciones diferentes
se suman. Anomalías legacy de reservas CONFIRMED de una misma habitación/día se
deduplican con COUNT(DISTINCT room_id) y se informan como noches deduplicadas.
Fechas nulas, salida igual/anterior a entrada a nivel de fecha y habitación ausente
se omiten y se informa su cantidad en el ámbito del hotel/todos, no del período.

Los estados son los actuales, no una reconstrucción temporal: cancelar hoy una
estancia pasada la excluye también del histórico. No hay eventos check-in/out
efectivos ni historial de cambios de capacidad. Se muestran noches comprometidas
registradas; no se afirma ocupación efectivamente observada.

## Método estadístico

Referencia = fecha actual de America/Panama, obtenida mediante Clock del servidor.
Se toma el lunes de la semana actual y se retrocede ocho semanas. Entrenamiento:
desde ese lunes inclusive hasta el domingo anterior a la semana actual inclusive,
56 fechas consecutivas. Se excluye la semana parcial actual. El horizonte comprende
mañana hasta hoy+30, inclusivos: exactamente 30 fechas.

Para cada día de la semana w:

`media(w) = suma de habitaciones-noches CONFIRMED de sus ocho fechas / 8`.

Los días sin actividad son observaciones de cero, no se eliminan del denominador.
La estimación de cada día futuro es la media de su día de la semana, BigDecimal
redondeado HALF_UP a dos decimales. No se redondea a habitaciones enteras ni se
generan números negativos. Es una media esperada, no una reserva ni una promesa
de ocupación. No se usan servicios externos ni aprendizaje automático.

La fórmula se ejecuta solo en backend. Recharts representa los datos recibidos;
React no recalcula el modelo. La serie de reservas futuras ya confirmadas se
devuelve separada para comparación, nunca se suma a la media. El modelo puede
estimar menos noches que las ya confirmadas: ignora cambios recientes de tendencia.
El filtro de fechas modifica el histórico; el entrenamiento siempre corresponde
a las ocho semanas completas previas. El filtro de hotel afecta ambas consultas.

Umbral mínimo declarado: debe existir una estancia conocida válida (CONFIRMED o
CANCELLED) con inicio igual/anterior al inicio de entrenamiento y al menos una
noche CONFIRMED en las 56 fechas. Sin ambas condiciones: INSUFFICIENT_HISTORY,
mensaje explicativo y array de predicciones vacío, no treinta ceros fabricados.
Un período histórico sin operaciones sí devuelve una serie histórica de ceros.
La fecha de la primera estancia es solo un indicio de cobertura: no demuestra que
el registro sea completo. La disponibilidad del modelo no equivale a confianza
estadística; no se calculan intervalos ni precisión garantizada.

## Capacidad y niveles

Capacidad actual = habitaciones active de hoteles active. No se usa availability
legacy como indicador de ocupación: las reservas y las fechas determinan compromiso.
La capacidad incluye habitaciones actualmente reservadas; no es el inventario libre
restante. Los hoteles/habitaciones hoy inactivos conservan sus noches históricas.

No se dispone de capacidad histórica real. Los porcentajes se identifican como
**referencia orientativa respecto a capacidad actual**:

- Diario: noches registradas o estimadas / capacidad actual × 100.
- Período: suma de noches / (número de fechas × capacidad actual) × 100.
- Capacidad cero: null, mostrado como No disponible.
- Demanda diaria superior a la referencia: porcentaje diario null; si cualquier
  día histórico supera capacidad, porcentaje agregado null. No recortar la demanda
  ni presentar porcentajes mayores a 100 como ocupación real.

Niveles informativos para estimaciones: HIGH si media >=80% de capacidad actual,
LOW si <=30%, MODERATE en otro caso. Sin capacidad: UNAVAILABLE. Una media que
supera capacidad se conserva y señala HIGH aunque su porcentaje no esté disponible.
No se recomienda una tarifa ni se modifican precios o disponibilidad.

## Contrato HTTP

`GET /api/admin/demand/history?hotelId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

Hotel opcional; fechas por defecto = ventana de ocho semanas completas. Período
inclusivo pasado hasta ayer, desde 1900, entre 1 y 366 fechas. Errores de formato,
rango invertido/excesivo/futuro o hotel no positivo: 400. Hotel inexistente: 404.
Devuelve context, startDate/endDate, summary y days. Summary distingue total,
confirmed/cancelled/unknownStateReservations, roomNights, dailyAverage,
capacityReferencePercent, deduplicatedRoomNights y fechas de máximos/mínimos
(incluidos empates y ceros). Day contiene date, roomNights y porcentaje orientativo.

`GET /api/admin/demand/forecast?hotelId=...`

Devuelve context, referenceDate, trainingStart/trainingEnd, horizonStart/horizonEnd,
earliestKnownStay, status/message, método, siete weekdayAverages y, cuando procede,
treinta days con estimatedRoomNights, confirmedRoomNights, porcentaje y nivel.
Context informa hotelId, currentActiveRooms, invalidStayRecords, dataKind y
limitaciones. OPERATIONAL significa registros del sistema; el catálogo educativo
no convierte automáticamente sus reservas operativas en registros sintéticos.
SYNTHETIC_DEMO solo se admite con perfiles isolated/demo y bases hotel_test/hotel_demo.

Las transacciones son readOnly y REPEATABLE_READ; consultas agregadas con rangos
acotados, sin cargar entidades ni estancias completas en memoria. Se reutilizan
índices de V2; no se necesitan tablas ni migraciones nuevas. No hay endpoints de
escritura, optimización de inventario ni cambios de reservas.

## Interfaz y gráficos

Administración → **Previsión de demanda**. Conserva estilos naranja, tarjetas y
navegación. Recharts 3.10.1 y react-is 18.3.1 se fijaron en lockfile; son compatibles
con React 18 según [documentación oficial](https://github.com/recharts/recharts/blob/main/README.md).
El módulo se carga de forma diferida al abrir su pestaña. Gráfico histórico naranja;
estimación azul discontinua y reservas futuras confirmadas naranja, con leyendas,
fechas, ejes, tooltips, navegación accesible y tablas alternativas desplegables.
Un período histórico de un solo día se representa con un punto visible, sin
necesitar un segmento entre dos fechas.
Se incluyen carga, reintento, filtros, ausencia de actividad, insuficiencia de datos,
errores 400/403/500 y enlace a login por sesión expirada. Las respuestas anteriores
se retiran al cambiar consulta y las peticiones obsoletas se abortan. El resto
de pestañas continúa utilizable ante errores de demanda.

## Demostración reproducible exclusivamente aislada

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1
```

Si existen recursos anteriores, usar primero `tests/isolated/reset.ps1`: verifica
proyecto, nombres, redes y montajes, y retira solo recursos temporales. En Linux/CI
usar pwsh. No ejecutar SQL de fixtures contra hotel-bd. El harness verifica esquema,
Maven, frontend, arranque demo y después carga `schema/demand-demo.sql` mediante un
script que exige hotel_test y usuario hotel_test. No es un seeder del backend normal.
El backend aislado declara HOTEL_DEMAND_DATA_KIND=SYNTHETIC_DEMO y la UI muestra
esa procedencia de forma destacada.

Abrir http://127.0.0.1:55173, autenticar con las cuentas efímeras de compose.test.yaml,
entrar a Administración → Previsión y elegir **HU03 · Historial sintético**.
El escenario crea cuatro habitaciones, 132 reservas/noches CONFIRMED de una noche,
ocho CANCELLED dentro de la ventana y una CANCELLED anterior como marcador de
cobertura. No genera pagos ni reservas en desarrollo.

| Día | Noches históricas | Observaciones | Media |
|---|---:|---:|---:|
| Lunes | 12 | 8 | 1.50 |
| Martes | 16 | 8 | 2.00 |
| Miércoles | 24 | 8 | 3.00 |
| Jueves | 16 | 8 | 2.00 |
| Viernes | 32 | 8 | 4.00 |
| Sábado | 24 | 8 | 3.00 |
| Domingo | 8 | 8 | 1.00 |

Total 132 noches, 140 reservas en la ventana (132 confirmadas + 8 canceladas),
promedio diario 132/56 = 2.36 y referencia orientativa 132/(56×4) = 58.93%.
Viernes estimado 4/4 =100%, HIGH; domingo 1/4=25%, LOW; lunes 1.5/4=37.5%, MODERATE.
Seleccionar Hotel Demo 2 muestra insuficiencia; seleccionar fechas de 2000 muestra
histórico cero conservando el entrenamiento del modelo. Todas son operaciones
sintéticas controladas, no actividad comercial de los hoteles panameños.

## Verificaciones y revisión humana

DemandMathTests verifica ventanas completas, cambio de año, medias con ceros,
decimales, 30 fechas, determinismo y capacidad. DemandIntegrationTests verifica
noches con PostgreSQL real, checkout exclusivo, cancelaciones, filtros, datos
legacy, integridad, fechas, permisos y ausencia de escrituras. Playwright comprueba
gráficos, matemáticas conocidas, filtros, insuficiencia, errores, móvil y USER;
la regresión anterior sigue incluida. Resultados reales y fallos corregidos se
registran en [AI Development Log](AI_DEVELOPMENT_LOG.md), sin inventar aprobaciones.

Evidencias locales: .local/isolated/<fecha>, reportes JUnit en
.local/isolated-artifacts/backend y HTML/capturas/trazas en
.local/isolated-artifacts/e2e. CI adjunta esas evidencias como artifacts. La revisión,
aprobación y merge por el equipo quedan pendientes; no se hace merge automático.

## Historial autorizado de demostración en desarrollo

La carga explícita del 27/10/2026 y su procedencia por lote se documentan en
[Historial sintético HU-03](HU03_HISTORIAL_SINTETICO.md). V6 añade seguimiento
reversible sin cambiar V1/V2 ni la fórmula. El fixture aislado descrito arriba
sigue siendo independiente; ahora existe además el lote autorizado en hotel-bd.
