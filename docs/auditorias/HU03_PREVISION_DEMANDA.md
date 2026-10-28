# Auditoría enfocada HU-03 — 26/10/2026

## Revisión inicial de solo lectura

Rama `feat/hu-03-pronostico-demanda`, limpia, HEAD y merge-base con `base` iguales
a `e8994422b89e8bcc0617d3d09eb9666037319248` (merge PR #4). No se encontraron
AGENTS.md en el repositorio ni en sus directorios ascendientes. No se repitió la
auditoría de estabilización. Durante esta revisión no se cambió código, configuración,
dependencias ni bases. Este informe registra los hallazgos antes de implementar.

## Componentes reutilizables

- Reservation: timestamps sin zona start_date/end_date, created_at, status,
  cancelled_at y relaciones hacia Room/User. Nuevas estancias a medianoche de
  fechas locales; entrada inclusiva, salida exclusiva. CONFIRMED compromete
  inventario; CANCELLED conserva la fila pero deja de bloquear. No existe COMPLETED.
- Room/Hotel: active actual y relación habitación-hotel; availability legacy no
  determina la disponibilidad por fecha. No hay fechas de alta ni historial de
  capacidad. User contiene rol global; no hay restricciones por hotel.
- ReservationRepository ya consulta solapamientos y filtros paginados. V2 aporta
  índices por habitación/fechas y usuario, pero no garantiza integridad de todos
  los registros legacy: varios CHECK son NOT VALID.
- Spring Security protege `/api/admin/**` con ADMIN, sesiones HttpOnly y CSRF.
  ApiException/handler permiten respuestas 400/404 coherentes. DTOs existentes
  evitan exponer entidades o información personal.
- AdminPanel tiene pestañas Hoteles/Habitaciones/Reservas. Guard, AuthProvider y
  cliente api mantienen sesión; se añadirá una pestaña, sin segundo panel.
  No hay librería de gráficos instalada; React es 18.3.1.
- Harness Docker aislado: PostgreSQL 17.11 tmpfs, Maven/JUnit, migraciones,
  TypeScript/lint/build y Playwright; CI en PR a base. V1/V2 se conservan.

## Datos y limitaciones

Docker Desktop no estaba disponible en la primera revisión: pipe del daemon
inexistente. Por tanto no se afirma haber verificado todavía el esquema ni la
cantidad actual de reservas de desarrollo. La última carga documentada contiene
12 hoteles/72 habitaciones educativas, pero eso no equivale a historial de demanda.
La consulta de desarrollo será únicamente READ ONLY cuando el daemon esté disponible.

Los estados actuales no reconstruyen check-in real ni cancelaciones a una fecha
pasada. Una reserva cancelada hoy se excluye también del gráfico pasado. Los
timestamps legacy se interpretan como fechas de estancia locales; no se convertirá
el día de salida en una noche adicional. Los registros con fechas nulas/invertidas
se omiten y se informan; otros estados no aportan noches. La capacidad histórica
real no puede calcularse con este esquema.

## Diseño seleccionado para implementación

- GET `/api/admin/demand/history?hotelId=&startDate=&endDate=`: período inclusivo
  pasado, máximo 366 días, serie diaria con ceros, reservas por estado, noches,
  promedio, días extremos, datos excluidos y capacidad actual de referencia.
- GET `/api/admin/demand/forecast?hotelId=`: fecha de referencia en America/Panama,
  ocho semanas completas lunes-domingo anteriores a la semana actual; horizonte
  mañana a hoy+30. Cada día de la semana tiene ocho observaciones, incluidas las
  fechas sin actividad. Media = suma de habitaciones-noches / 8; salida decimal
  redondeada HALF_UP a dos posiciones, sin convertir la estimación en reservas.
- Solo CONFIRMED con fechas válidas aporta demanda. Se cuentan habitaciones
  distintas por día para no duplicar capacidad física por anomalías legacy;
  cualquier deduplicación se informa. Las habitaciones actualmente inactivas sí
  conservan su demanda histórica.
- Umbral mínimo explícito y conservador: una estancia conocida válida que alcance
  el inicio de la ventana y al menos una noche CONFIRMED dentro de ella. Sin ello
  se devuelve INSUFFICIENT_HISTORY y ninguna predicción. La antigüedad del primer
  registro es solo un indicio de cobertura, no una garantía de integridad de datos.
- Ocupación efectiva no disponible. Se podrá mostrar porcentaje orientativo
  respecto a habitaciones actualmente activas de hoteles activos, claramente
  identificado. Si capacidad cero o demanda superior a esa referencia, porcentaje
  no disponible; no recortar ni ocultar demanda para forzar 0–100.
- Clasificar alta (>=80%) y baja (<=30%) solo con referencia de capacidad disponible;
  sin ella el nivel no está disponible. No hay recomendaciones automáticas de tarifas.
- Recharts como única librería de gráficos nueva, más react-is alineado con React,
  según documentación oficial. Histórico y estimación diferenciados, tooltip,
  ejes/leyendas/unidades, alternativa tabular accesible y diseño adaptable.
- Historial sintético exclusivamente en el proyecto Docker aislado, identificado
  explícitamente. Nunca generar reservas de HU-03 en hotel-bd.

## Archivos previstos, riesgos y verificaciones

Backend: DTOs de demanda, repositorio SQL agregado, servicio estadístico con Clock,
controlador administrativo y pruebas unitarias/PostgreSQL. Frontend: AdminPanel,
nuevo componente de demanda, tipos y dependencias de gráficos. Pruebas: fixture
aislado reproducible, E2E, documentación de método, evidencias y AI Development Log.
No se prevén migraciones nuevas, ni modificaciones de reservas, autenticación o pagos.

Riesgos: conteos sesgados por cancelaciones actuales o historial importado incompleto;
capacidad actual distinta de la pasada; consultas amplias y doble conteo legacy;
errores de fechas/decimales, carreras al cambiar filtros, sesión expirada y gráficos
sin espacio en móvil. Se verificarán matemáticas conocidas, PostgreSQL real, permisos,
ausencia de escrituras, estados vacíos, filtros, fallos HTTP y regresión completa.
El filtro de período cambia el gráfico histórico; la ventana de entrenamiento del
modelo permanece fija y se explica en interfaz/API para evitar interpretaciones erróneas.

## Comprobación posterior de lectura, antes de implementar backend

Tras recuperar el daemon, READ ONLY confirmó `hotel-bd`, V1 BASELINE/V2 SQL success,
13 hoteles y 72 habitaciones activas. Hay una reserva CONFIRMED, entrada 26/10/2026,
salida 27/10/2026, registrada 25/10/2026; no se consultaron identidades ni precios.
No hay estancias inválidas. No existe cobertura de ocho semanas: desarrollo debe
mostrar histórico pasado vacío y aviso de histórico insuficiente, no una curva
inventada. Docker arrancó los servicios con sus políticas existentes; no se
recrearon, migraron ni cargaron reservas de desarrollo.
Se verificó Recharts 3.10.1 compatible con React 18 y react-is 18.3.1 mediante npm.
