# AI Development Log — Hotel Reservation System

Fecha: 2026-10-25, America/Panama. Rama: `chore/configuracion-inicial`.
Partida: `d0e2aa1`, workspace limpio. Issue real relacionada:
[#3 — Configuración inicial, estabilización funcional e integración continua](https://github.com/yigpan29/hotel-reservation-system/issues/3).

## Alcance autorizado y arquitectura final

Se completó la aplicación académica sobre React/Vite/Tailwind, Spring MVC,
servicios/repositorios JPA, Security y PostgreSQL; sin microservicios, nuevas
librerías visuales, pagos ni arquitectura empresarial. Se reutilizaron las seis
entidades, repositorios y clases de servicio existentes, extendiendo las piezas
que eran stubs. Se sustituyó el controller de hoteles por un contrato REST único.

- Entrada/salida por records DTO, sin serializar entidades JPA ni contraseñas.
- Errores JSON, validación Jakarta, conflictos y permisos con códigos HTTP.
- Sesión HttpOnly, SameSite=Lax, Secure en prod; BCrypt y CSRF de sesión.
- USER en registro público; ADMIN solo por aprovisionamiento privado explícito.
- Catálogo público real, búsqueda, inventario y edición/desactivación administrativa.
- Reservas propias, consulta administrativa, filtros y cancelación conservando filas.
- Confirmación transaccional con bloqueo pesimista de habitación y revalidación.
- React usa fetch, proxy del mismo origen, estados de carga/errores y guardias de ruta.
- Navegación, tarjetas, colores naranja y adaptación móvil conservados; las pantallas
  funcionales no usan los antiguos arreglos de inventario estático.
- Demostración explícita en base de pruebas vacía y perfiles restringidos.
- JUnit, PostgreSQL real, Playwright y GitHub Actions con artifacts.

## Persistencia y decisiones de negocio

Flyway **10.20.1** y `flyway-database-postgresql` se integran en el POM principal,
sin actualizar Spring Boot 3.3.2. Hibernate usa `validate`; baseline automático y
Flyway clean están deshabilitados. En desarrollo las migraciones exigen además
`HOTEL_MIGRATIONS_ENABLED=true`; su default false protege la base existente.
No se ejecutó baseline ni migración contra ella.

V1 copia fielmente el esquema original probado: hotels, rooms, users,
reservations, payments y reviews, con sus identidades/relaciones. V2 añade
active a hoteles y habitaciones, role a usuarios, precios pactados y cancelación
a reservas; renombra `availbility` a `availability` sin perder su valor. La activación
legacy de habitaciones deriva de su flag anterior, sin habilitar habitaciones
que antes estaban retiradas. Se añaden unicidad de habitación por hotel e índices
de usuarios normalizados, habitación, fechas y propietario.

Las fechas legacy siguen como timestamp(6), sin truncarlas a date. Las estancias
nuevas reciben fechas ISO de calendario y se guardan a medianoche. Entrada
inclusiva, salida exclusiva; reloj de negocio America/Panama. Se permiten hasta
365 noches. Se conserva la unidad monetaria legacy: USD enteros por noche,
total bigint, nunca valores enviados por el cliente. No se inventan precios
para reservas antiguas.

Estados nuevos: CONFIRMED y CANCELLED. Solo CONFIRMED bloquea fechas. Cancelación
permitida hasta el día de entrada inclusive, idempotente y con timestamp retenido.
No se borran reservas, hoteles ni habitaciones desde la API; se retiraron cascadas
REMOVE/ALL de las relaciones con histórico. Payment y Review permanecen por
compatibilidad sin endpoints de pago/reseñas.

Los CHECK `NOT VALID` conservan filas antiguas potencialmente incompatibles y
protegen escrituras nuevas. Eso no sanea ni autoriza usar un histórico desconocido:
la adopción real exige preflight de duplicados, estados, intervalos y credenciales,
respaldo y restauración verificados. Índices únicos abortan ante duplicados;
no se reescriben datos para superar la migración. El backend antiguo no puede
coexistir con el renombrado sin coordinación, por lo que no se aplicó a desarrollo.

## Seguridad y configuración

Login verifica BCrypt mediante AuthenticationManager, renueva ID de sesión,
guarda explícitamente SecurityContext y descarta el token CSRF anterior. React
solicita un token enmascarado antes de cada escritura. Logout invalida sesión y
cookie; no hay JWT ni identidad guardada en localStorage. No se acepta ADMIN
desde JSON de registro. Los endpoints administrativos y la propiedad de las
reservas se validan en servidor, además de las guardias de frontend.

Las credenciales de datasource del properties principal se externalizaron sin
defaults privados. También se alineó la copia preexistente en `bin/` (que ya usaba
variables) con la configuración segura; no se borran
commits ni se afirma sanear el historial Git. Las credenciales heredadas de
versiones antiguas deben rotarse si estuvieron expuestas. No se imprimieron sus
valores ni se modificó el `.env` privado o la contraseña del volumen existente.

`provision-admin` requiere configuración privada y `CREATE_ADMIN`; no promueve
ni sobrescribe cuentas. `demo` exige `CREATE_SYNTHETIC_DATA`, base `hotel_test`
o `hotel_demo` y ausencia de usuarios/hoteles. No hay contraseñas predeterminadas
en código de producción. Las credenciales públicas sintéticas están limitadas
a Compose de pruebas y Playwright. El procedimiento está en `INICIO-LOCAL.md`.

## Pruebas ejecutadas y correcciones

Ejecución completa final: **`.local/isolated/20261025-151312/`, exit 0**.
La pasada completa anterior `20261025-150239` también terminó con exit 0.
Se reconstruyeron las imágenes antes de usar `-SkipBuild`; no se simula una prueba
con código local distinto del contenido de las imágenes.

| Conjunto | Evidencia real |
|---|---|
| Compilación limpia/empaquetado backend | `mvn -o -B -ntp clean verify`, exit 0 |
| JUnit de dominio/API | 18 pruebas de integración, sin fallos/errores/omitidas |
| Contexto original | 1 prueba correcta |
| Autoconfiguración Flyway/Boot principal | 1 prueba correcta; total **20 pruebas Java** |
| DB instalación nueva y adopción | V1 desde cero y baseline explícito 1; V2 en ambas rutas, validate y repetición correctos |
| Arranque automático desde base vacía | JAR real sobre `hotel_demo` vacía: Spring Boot aplica V1/V2, Hibernate valida, readiness 200 y catálogo vacío; `CLEAN_APPLICATION_STARTUP_WITH_AUTOMATIC_FLYWAY_OK` |
| Preservación legacy | Igualdad de DDL V1, DDL final V2 equivalente, valores/fechas/IDs/secuencias conservados |
| Controles negativos | Migrate sin baseline rechazado con mensaje específico; URLs de desarrollo rechazadas con 64 antes de Maven |
| Frontend | TypeScript, ESLint y build de producción: **0/0/0** |
| Playwright Chromium 1.60.0 | **3 pruebas correctas**, cliente completo, administración y móvil; 5.3 s en la pasada final |
| Workflow | actionlint 1.7.7 ejecutado en contenedor, exit 0 |
| Acceso desde host | GET `http://127.0.0.1:55173/` y `/api/health`: **200** |

JUnit cubre registro válido/duplicado/inválido y BCrypt, rol público inmutable,
login correcto/incorrecto, logout e invalidación, CSRF, USER/ADMIN, catálogo,
CRUD administrativo, precios/duplicados/FK, reserva y precio histórico,
fechas inválidas, consulta propia, prohibición de acceso/cancelación ajenos,
cancelación e historial, plazo de cancelación, solapamiento, estancias consecutivas
y **dos hilos/transacciones concurrentes con resultado exacto 201 + 409**.

Playwright usa únicamente datos sintéticos y contextos independientes. Completa
registro, logout/login, búsqueda con y sin resultados, selección de habitación,
confirmación, consulta/cancelación persistente y denegación USER a administración.
El administrador crea y edita hotel/habitación y comprueba inventario público.
La prueba móvil verifica navegación y ausencia de desbordamiento horizontal.
Se inspeccionaron las capturas de detalle y catálogo móvil.

Fallos intermedios conservados: TypeScript inicialmente requirió evitar `process`
sin tipos Node en Vite (se usa `loadEnv`); CSS con un layer Tailwind en hoja separada
falló en build (se corrigió la hoja, sin desactivar reglas). La primera pasada
Playwright señaló navegación antes de terminar logout y selectores ambiguos de
status/labels; se corrigieron esperas por estado y selectores semánticos, sin
sleeps ni retries para ocultar fallos. Los logs/trazas anteriores se conservan en
`20261025-142737`, `20261025-144200`, `locator-rerun` y `combobox-rerun`.
La pasada final desde cero verifica todo después de las correcciones.

Se sustituyó PageImpl por un DTO paginado explícito para mantener estable el JSON.
Persisten avisos no bloqueantes Browserslist antiguo y class sharing de la JVM
durante Mockito. No se actualizan dependencias ajenas para silenciarlos.

## Recursos aislados y observación de desarrollo

Proyecto `hotel-reservation-system-test`; PostgreSQL y backend solo en red interna,
datos PostgreSQL en tmpfs, sin volúmenes persistentes de desarrollo ni puertos
publicados de base/backend. Runners sobre copias de fuentes y dependencias propias;
salida únicamente en `.local/isolated-artifacts/`. El frontend de pruebas tiene
una segunda red web exclusiva y publica **127.0.0.1:55173**; la API va por su proxy.
Esto corrigió una limitación observada al publicar puertos directamente desde una
red Docker interna en este Docker Desktop. No se abrió salida de PostgreSQL/runners.

Cada retirada del entorno temporal verificó nombres/etiquetas/montajes y redes.
No hubo `prune`, `down -v`, borrado del volumen existente ni comandos de inicio,
parada o recreación sobre el proyecto de desarrollo desde esta tarea.

**Incidencia externa observada:** el 2026-10-25 a las 19:44:20 UTC aparecieron
nuevos IDs de frontend/backend de desarrollo. No se atribuye esa recreación a un
actor sin evidencia; no corresponde a una orden de recreación ejecutada por el
agente. Backend mostró reinicios y error `missing column [active]` porque conserva
`HOTEL_MIGRATIONS_ENABLED=false` y el esquema legacy. No se habilitaron migraciones
para corregirlo. La lectura posterior con `BEGIN READ ONLY` confirmó **34 columnas,
sin flyway_schema_history y cero filas en las seis tablas**, como en el diagnóstico
inicial. PostgreSQL conserva ID, volumen, arranque y cero reinicios.

Por ello no se declara que los tres contenedores de desarrollo conservaron sus
identidades durante toda la tarea. Sí se comprobó que la base persistente no fue
migrada ni poblada. La aplicación funcional validada es la demo aislada; poner la
instalación existente en esta versión requiere coordinación y autorización de
adopción, no eliminar datos ni activar Hibernate update.

## CI, documentación y entrega Git

`.github/workflows/ci.yml`: PR hacia `base` y `workflow_dispatch`, job frontend
Node 22 y job integral en Ubuntu con el mismo harness Docker. No depende de
Docker Desktop, `.env` local ni secretos de despliegue. Cualquier fallo obligatorio
propaga error; artifacts se suben con `always()`, incluidas trazas y logs.
La validación remota de Actions se informa por separado de la ejecución local.

Se actualizaron README, INICIO-LOCAL, README de pruebas, contratos y diagnóstico.
La auditoría inicial conserva hash `75297166f4a8d198247969fe1f3441d34c371905`.
`base` permanece en `2f82bdb`; no hay merge automático. Commits por persistencia,
auth, catálogo, reservas, demo, frontend, pruebas, CI y documentación, con referencia
a la issue real #3. El conector GitHub no pudo ver el repositorio; se verificó
acceso de lectura y permiso push mediante la autenticación Git existente, sin
imprimir ni guardar tokens. Publicación y PR se verifican al cerrar la entrega.

## Exclusiones y límites

No se implementaron checkout/información reutilizable o medios de pago (HU-01),
calendario interactivo avanzado (HU-02), ni forecasting, tendencias, gráficos o
recomendaciones de demanda/precio (HU-03). No hay transacciones bancarias ni tarjetas.
Solo se guarda el historial básico necesario para las reservas.

El objetivo es un proyecto académico funcional. No se declara revisión exhaustiva
de seguridad de producción, despliegue HTTPS, rate limiting, recuperación por
correo, pruebas de múltiples navegadores, ni migración de datos reales de
desarrollo. Las pruebas de navegador se ejecutan con Chromium; los datos demo son
efímeros. Las credenciales públicas de prueba no deben reutilizarse en producción.

## Continuación y adopción autorizada — 25/10/2026

Se retomó `2840255` en `chore/configuracion-inicial`, conservando los commits y el
PR [#4](https://github.com/yigpan29/hotel-reservation-system/pull/4), hacia `base`.
No se repitió ni modificó la auditoría histórica.

### Errores reproducidos

GET de desarrollo a `/api/auth/csrf` y `/api/hotels`: HTTP 500 desde Vite,
con `ECONNREFUSED` hacia `backend:3000`. Spring Boot no aceptaba tráfico por
`Schema-validation: missing column [active] in table [hotels]`. Una consulta READ
ONLY confirmó 34 columnas legacy, sin historial Flyway, hoteles y usuarios vacíos.
El proxy ya apuntaba correctamente a `http://backend:3000`. La causa común era el
esquema pendiente de adopción; no un rechazo CSRF ni serialización de entidades.
El cliente ahora incluye el estado HTTP si no puede obtener CSRF y no envía login
en ese caso. CSRF sigue habilitado, con sesión HttpOnly, SameSite=Lax y token en
header; no requiere CORS porque React usa `/api` mediante el proxy del mismo origen.
Usar un único origen al navegar: localhost y 127.0.0.1 tienen cookies independientes.

Tailwind conserva la corrección previa: `App.css` usa `@apply` sin el wrapper
`@layer components` procesado sin su directiva. CSS HTTP 200 y build satisfactorio.

### Intervención aprobada expresamente en esta conversación

El desarrollador autorizó respaldo, comparación V1, baseline V1, migración V2 y
recreación exclusiva del backend. Operaciones realmente ejecutadas:

1. Respaldo custom completo de `hotel-bd` en
   `.local/private-development-adoption/hotel-bd-before.dump`, ignorado por Git.
   SHA256: `3FF73D20494C1F1CE010841078E4E1E1818F6F8356C71B5A9193317BD264B955`.
2. Restauración en `hotel_development_review` del PostgreSQL temporal y comparación
   normalizada contra `hotel_v1_review`, creada desde V1: igualdad exacta del DDL.
3. Baseline explícito 1, V2 y validate sobre la copia restaurada; valores originales
   conservados. Después se ejecutó la operación autorizada sobre desarrollo con
   Flyway 10.20.1. No se ejecutó V1 sobre tablas existentes.
4. Valores originales de las seis tablas y secuencias antes/después: iguales.
   No se crearon usuarios, hoteles ni reservas sintéticas en desarrollo.
5. Se recreó solo `backend`; Hibernate validate y arranque correctos. PostgreSQL
   conserva ID `7f1f054223d8`, volumen `hotel-reservation-system_postgres-data` y cero
   reinicios. Frontend no recreado; puertos 3000/5173/5432 conservados.

Desarrollo tiene V1 BASELINE y V2 SQL, ambas success. GET mediante localhost:5173
y 127.0.0.1:5173: health 200 UP, csrf 200, hoteles 200 `[]`, CSS 200. El catálogo
vacío corresponde a los datos existentes; no se simula inventario. Los flujos de
registro/login/reservas con escrituras se comprobaron únicamente en PostgreSQL
aislado. Esta actualización sustituye el bloqueo operativo anterior a la autorización.
Respaldo, valores y copias de desarrollo son privados; no se suben como artifacts.

### Validaciones y CI

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1` pasó:
evidencia `.local/isolated/20261025-175332/`. Maven clean verify: 19 pruebas; prueba
adicional de compatibilidad Flyway: 1. Cero fallos, errores u omitidas. TypeScript,
ESLint y build: salida 0. Esquema limpio, baseline, V2, repetición, conservación de
valores/identidades y rechazo de desarrollo comprobados. Códigos negativos
esperados: 1 sin baseline y 64 para URLs prohibidas, verificados también por mensaje.

Cuatro E2E pasaron con el harness completo. Después se reconstruyó el runner y
pasaron **cinco E2E** (`.local/continuation-visual-current.log`, reportes en
`.local/isolated-artifacts/e2e/continuation-visual-current/`): flujo de cliente,
administración, móvil, seguridad de sesión y fallo CSRF controlado. Chromium
comprobó registro inválido/duplicado, rechazo sin token, login incorrecto, identidad,
cookies, sesión tras recarga y logout 204 seguido de 401. El fallo CSRF 503 impide
enviar login. Se comprueba ausencia de errores de ejecución y se guardan capturas
de inicio, registro, login, reservas, administración, detalle y móvil.

CI remoto [40230529042](https://github.com/yigpan29/hotel-reservation-system/actions/runs/40230529042)
pasó frontend, migraciones, 20 pruebas Java y los tres E2E de aquel commit; falló
después al capturar logs: `application.log: Permission denied`. Docker creó el
directorio padre como root en Ubuntu. Ahora `run.ps1` crea los directorios con el
usuario invocante antes de los montajes. Se conservan la propagación de errores y
los artifacts; no se declara verde aquella ejecución. El resultado remoto vigente
se consulta en los checks del PR #4.

No se implementaron HU-01/HU-02/HU-03 ni pagos, ni se hizo merge o se modificó `base`.

### Cierre de comprobaciones remotas y de desarrollo

La ejecución remota [40243412641](https://github.com/yigpan29/hotel-reservation-system/actions/runs/40243412641)
del commit `f0430c1` terminó **success**: frontend e integración, incluida la
captura de logs corregida. Esto verifica el arreglo de permisos en Ubuntu real.

Una prueba adicional Chromium sobre las pantallas reales de desarrollo pasó
(`.local/development-browser-readonly.log`, 1 prueba). Comprobó inicio vacío,
registro, login, búsqueda y redirecciones de rutas protegidas; health/CSRF/catálogo,
cookie de sesión y ausencia de HTTP 5xx/errores de ejecución. Interceptó y bloqueó
cualquier método distinto de GET/HEAD, verificando cero intentos de escritura.
Capturas privadas en `.local/private-development-adoption/browser/`.
Se revisaron visualmente capturas de catálogo, registro, administración y móvil;
se conservan navegación, tarjetas y colores naranjas.

## Catálogo de Panamá y administración de desarrollo — 25/10/2026

Autorización específica del desarrollador para datos de `hotel-bd`: promover
exactamente `yonielvegas`, aprovisionar `demo-admin` y cargar hoteles/habitaciones.
Se verificaron destino y Flyway: V1 BASELINE y V2 SQL, ambas success. No se repitió
baseline, no se ejecutaron migraciones ni se alteró el esquema.

Había un usuario, cero hoteles/habitaciones/reservas. Se hizo un respaldo custom
privado antes de escribir. `yonielvegas` era una única coincidencia (USER) y pasó
a ADMIN en una transacción que comparó todos los demás campos antes/después:
idénticos. BCrypt confirmado sin mostrar hash ni correo. No se utilizó su cuenta
personal en pruebas automatizadas. Debe cerrar sesión y volver a entrar para
renovar las autoridades almacenadas en su sesión.

Se incorporaron `PanamaCatalog`, su runner exclusivo de perfil `catalog-panama`,
JSON con fuentes oficiales y los scripts explícitos de carga/entrada privada/
aprovisionamiento. El comando sale al finalizar con `HOTEL_SETUP_EXIT`, sin
afectar el arranque normal. La carga exige confirmación, base exacta permitida,
transacción y advisory lock. Nunca actualiza hoteles/habitaciones existentes;
reconoce nombres o números DEMO y rechaza coincidencias ambiguas. No incorpora
nuevas columnas, tablas, dependencias ni migraciones. La carga no administra usuarios.
El seeder conserva inventario retirado/editado y no repone habitaciones existentes.
Las condiciones de identificación y ejecución están en [DEMOSTRACION_PANAMA.md](DEMOSTRACION_PANAMA.md).

Datos ejecutados en desarrollo mediante `scripts/Load-PanamaCatalog.ps1
-ConfirmEducationalData`: **12 hoteles y 72 habitaciones**, seis por hotel, activas,
precios simulados 65–285 USD/B/. por noche. Nombres, localización y características
generales se contrastaron con sitios oficiales; fuentes en el JSON y la guía.
Sin calificaciones inventadas (`rating=null`), fotografías copiadas ni afiliación.
Las descripciones visibles identifican inventario y precios como demostración.
No se crearon reservas ni se modificaron cuentas durante la carga.

Segunda ejecución real: **0 hoteles, 0 habitaciones, 12 preservados**. Snapshots
privados de datos de usuarios/hoteles/habitaciones/reservas y secuencias antes y
después coincidieron. Evidencias `.local/catalog-development-first.log`,
`.local/catalog-development-repeat.log`; respaldos en `.local/private-demonstration/`.
Ningún respaldo, secreto ni dato personal se versiona o publica como artifact.

Validación aislada completa `.local/isolated/20261025-185509/`: exit 0.
Maven clean verify: 22 pruebas (incluidas tres de catálogo); compatibilidad Flyway:
1 adicional. **23 Java**, cero fallos/errores/omitidas; TypeScript, ESLint y build
correctos; migraciones e aislamiento correctos; **5 Playwright correctos**.
Las pruebas nuevas comprueban autorización/destino, 12/72, repetición conservando
nombre/descripción/estado/número/tipo/precio editados, reserva y precio histórico,
y rechazo de identidades ambiguas. Las modificaciones de prueba usaron solo hotel_test.

Una prueba Chromium adicional sobre desarrollo pasó (1/1), bloqueando todos los
métodos salvo GET/HEAD: 12 tarjetas reales de PostgreSQL, búsquedas de Boquete,
detalles de los 12 hoteles, seis habitaciones y precios por hotel, páginas de
registro/login, CSRF 200 y rechazo anónimo administrativo 401. Sin errores 5xx
ni de ejecución. Evidencia `.local/panama-development-browser.log`; capturas
privadas revisadas visualmente en `.local/private-demonstration/browser/`.
CRUD administrativo, permisos USER/ADMIN y reservas se volvieron a probar en
aislamiento; no se insertaron datos adicionales de esas pruebas en desarrollo.

**Dependencia pendiente:** `demo-admin` no existía. El operador eligió continuar
el resto e introducir su clave después. Se preparó entrada oculta local y
aprovisionamiento con el perfil BCrypt existente; no se inventó una contraseña
ni se creó una cuenta con credenciales conocidas. Hasta recibir la entrada
privada no se declara creada/autenticada esa cuenta de desarrollo. Los usuarios
efímeros del harness no se presentan como sustitutos.

El catálogo y `yonielvegas` están listos; el cierre de ambas cuentas administrativas
queda condicionado a esa entrada privada. HU-01/HU-02/HU-03 y pagos siguen excluidos.

## HU-03 — Previsión de demanda (26/10/2026)

Trabajo autorizado por el alcance actualizado del Issue #1, en
`feat/hu-03-pronostico-demanda`, desde `e899442` (merge PR #4). `base` no se modifica.
Las exclusiones de HU-03 de los registros anteriores corresponden a estabilización
y catálogo: esta entrada registra su implementación independiente, expresamente
solicitada ahora. HU-01/HU-02 y pagos siguen fuera de alcance.

| Actividad | Herramienta IA | Solicitud y resultado real | Decisión humana |
|---|---|---|---|
| Auditoría | Codex, Git, lecturas y PostgreSQL READ ONLY | Rama/origen confirmados; reglas, panel y límites revisados antes de backend | Alcance del Issue #1 autorizado; revisión del informe pendiente |
| Diseño | Codex | Promedio semanal de ocho semanas completas, Clock Panama, horizonte mañana/hoy+30, umbral mínimo y capacidad orientativa documentados | Método propuesto por el issue; revisión de detalles pendiente |
| Backend | Codex, Java/Spring | Dos GET ADMIN, SQL agregado, DTOs sin identidades, transacciones readOnly/REPEATABLE_READ | Revisión del código pendiente |
| Frontend | Codex, React/Recharts | Pestaña existente, indicadores, filtros, curvas interactivas, tablas y mensajes; sin rediseño | Revisión visual humana pendiente |
| Datos de prueba | Codex, PostgreSQL aislado | Escenario etiquetado sintético: 132 noches, ocho cancelaciones en ventana, lunes 12/8=1.50 | Autorizado solo en aislamiento |
| Testing | Codex, Maven/JUnit/Playwright | 37 Java, 8 E2E y validaciones frontend satisfactorias; detalles abajo | QA/revisión humana pendiente |
| Debug | Codex y logs reales | Corregidos accesor ID del fixture, colisión de bean Clock y selector de combo de Playwright | No se deshabilitaron protecciones ni reglas |

### Auditoría y decisiones

Informe completo: [auditoría HU-03](auditorias/HU03_PREVISION_DEMANDA.md).
La primera consulta no pudo ejecutarse porque Docker estaba apagado. Tras iniciar
el daemon se completó READ ONLY: V1 BASELINE/V2 SQL success, 13 hoteles, 72
habitaciones activas y una reserva CONFIRMED con entrada 26/10, salida 27/10 y
creación 25/10. No se consultaron identidades. No existe historial suficiente de
ocho semanas: la UI debe informar insuficiencia, no fabricar predicciones.

Se reutilizaron sesiones, CSRF, `/api/admin/**`, panel, entidades e índices de V2.
No se modificaron reglas de reservas ni seguridad, no se añadieron tablas o
migraciones. Las consultas usan estancias (no creación), salida exclusiva,
CONFIRMED y habitaciones distintas por día. Cancelaciones actuales se excluyen;
datos inválidos, estados desconocidos y duplicaciones legacy se informan.

El historial de capacidad y la ocupación efectiva no existen: los porcentajes
son referencias expresamente orientativas con capacidad activa actual. Capacidad
cero o demanda superior a referencia no produce una ocupación falsa ni recortes
del conteo. No se generan recomendaciones o cambios automáticos de tarifas.

Modelo: ocho lunes-domingos completos antes de la semana actual, 56 observaciones;
sumar por día semanal y dividir entre ocho incluyendo ceros. HALF_UP a dos
decimales, sin convertir medias en reservas. Requiere una estancia conocida que
alcance el inicio y alguna noche confirmada en ventana; es un umbral mínimo, no
garantía de cobertura ni de confianza estadística. Las limitaciones se devuelven
en API y se muestran en UI. Guía: [HU03_PREVISION_DEMANDA](HU03_PREVISION_DEMANDA.md).

Recharts 3.10.1 y react-is 18.3.1 se comprobaron contra npm y documentación oficial,
sin cambiar React/Boot ni instalar herramientas globales. Carga diferida: build
principal 194.91 kB; chunk del módulo 389.71 kB (114.24 kB gzip), descargado al abrir
la pestaña. No se incorpora otro framework ni una fórmula alternativa en React.

### Pruebas realmente ejecutadas

Ejecución final limpia:
`powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1`.
Directorio `.local/isolated/20261026-182410/`, proceso exit 0.

| Comprobación | Resultado |
|---|---|
| Maven clean verify | 36 pruebas, 0 fallos/errores/omitidas |
| Compatibilidad Flyway adicional | 1 prueba correcta; total Java 37 |
| Unitarias HU-03 | 5 métodos: ventanas, medias, ceros, 30 días, determinismo, capacidad y validación |
| Integración HU-03 | 9 métodos sobre PostgreSQL: noches, checkout, estados, filtros, parámetros, permisos, datos legacy y snapshots de las seis tablas |
| TypeScript / ESLint / build | Todos exit 0, sin relajar configuración |
| Esquema limpio, adopción y preservación | Correctos, V1/V2 sin cambios |
| Protecciones negativas de aislamiento | Sin baseline rechazado (1); URLs de desarrollo rechazadas (64), mensajes verificados |
| Chromium | 8 pruebas correctas: 3 HU-03 y 5 de regresión completa |

La matemática por estancias se verifica donde se ejecuta realmente, en las consultas
PostgreSQL; las funciones puras verifican medias/fechas/decimales. La regresión
incluye registro/login/logout, CSRF, roles, catálogo, inventario, reservas, cancelación
y dos solicitudes concurrentes (201/409). No se presenta compilar como prueba funcional.

El escenario exclusivo del harness exige hotel_test y usuario hotel_test, y el
backend declara SYNTHETIC_DEMO. No se inserta historial en hotel-bd. El hotel
`HU03 · Historial sintético` tiene cuatro habitaciones; 132 noches/56 =2.36,
referencia 132/(56×4)=58.93%, lunes 12/8=1.50. Las cancelaciones no elevan demanda.
Los E2E comprueban tooltip, 30 filas, filtros, períodos vacíos, insuficiencia,
sesión expirada, fallo HTTP, USER, ausencia de errores de ejecución y móvil sin
desbordamiento. Se revisaron visualmente gráficos naranja/azul y sus capturas.

Capturas: `.local/isolated-artifacts/e2e/20261026-182410/test-results/`:
`hu03-historical-chart.png`, `hu03-forecast-chart.png`, `hu03-forecast-desktop.png`,
`hu03-empty-period.png`, `hu03-insufficient.png`, `hu03-mobile.png`.
JUnit y HTML/trazas permanecen bajo `.local/isolated-artifacts/`, incluidos por CI
como artifacts; no se publican datos personales ni respaldos de desarrollo.

Se completó además la cobertura explícita de fallos de red: mensaje en español
para fetch fallido, y prueba de fechas invertidas desde el formulario. La versión
final del frontend se reconstruyó y pasó TypeScript, lint, build y nuevamente
8/8 E2E: `.local/hu03-network-frontend-checks.log`, `.local/hu03-network-final.log`,
reportes `.local/isolated-artifacts/e2e/hu03-network-final/`. El backend no cambió
respecto a la ejecución limpia integral de 37 pruebas Java mencionada arriba.

### Fallos conservados y corregidos

- `.local/isolated/20261026-174803/`: compilación del fixture usaba id() sobre User;
  se corrigió a getId(), sin cambiar el modelo ni la autenticación.
- `.local/isolated/20261026-175143/`: arranque limpio falló por nombre demandClock
  compartido por configuración/bean. Se renombró el bean a forecastClock; no se
  habilitó sobrescritura de beans.
- `.local/isolated/20261026-180747/`: 37 Java pasaron, pero un E2E no encontraba el
  label exacto del select. Se usó el rol combobox con nombre accesible. Se conservaron
  screenshot/trace del fallo; luego pasaron 8/8 en `hu03-locators-current` y desde
  cero en la ejecución final. Sin aumentar retries, tiempos ni ocultar errores.

### Activación de desarrollo y límites de la comprobación

Tras las validaciones se recreó solo backend con HOTEL_MIGRATIONS_ENABLED=false
para compilar/cargar HU-03. La primera sonda expiró durante Maven sobre el montaje
Windows; los logs posteriores confirmaron arranque correcto y readiness 200. No
se trató como una validación satisfactoria hasta comprobar las respuestas reales.
No se repitió la recreación: no hacía falta modificar código ni datos.

Evidencias `.local/hu03-development-activation.log` (sonda vencida) y
`.local/hu03-development-http.log` (verificación posterior): health directo/proxy,
catálogo y módulo React 200; ambos GET administrativos 401 sin sesión. Persisten
13 hoteles, 72 habitaciones, una reserva y V1/V2. PostgreSQL/frontend no se
recrearon; sus reinicios siguen en cero. La recuperación inicial de Docker inició
los servicios por sus políticas existentes. No se cargaron reservas sintéticas,
no se migró ni se alteró inventario de desarrollo. No se afirma una comparación
completa de fingerprints de la primera activación: esa sonda venció antes de
compararlos. Los snapshots que demuestran ausencia de escrituras en consultas
HU-03 sí se ejecutaron satisfactoriamente en integración PostgreSQL aislada.

No se usó una cuenta personal para automatización autenticada en desarrollo.
La vista ADMIN completa se verificó en la instancia aislada. Tras recrear backend
hay que volver a iniciar sesión en desarrollo, porque sus sesiones eran en memoria.
`demo-admin` de desarrollo continúa pendiente por decisión anterior del operador;
el usuario homónimo del harness es efímero y no lo sustituye.

La CI existente ejecuta el mismo harness en PR hacia base; no necesita cambios
para incluir las nuevas pruebas. El resultado remoto vigente se enlaza desde el
PR del Issue #1. No se declara revisión/aprobación humana ni merge; esos pasos
de la Definition of Done siguen pendientes del equipo.
