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
