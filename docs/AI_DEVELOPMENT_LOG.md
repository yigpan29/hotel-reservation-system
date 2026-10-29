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

## HU-01 (#5), entrega 1 — 26–27/10/2026, America/Panama

Responsable humano: Eric. Alcance aprobado en conversación: Stripe sandbox,
checkout inicial y después reutilización. Eric decidió expresamente comenzar
**solo por el primer checkout**. No se declara HU-01 terminada: guardado,
consentimiento de reutilización y compra recurrente quedan para entrega 2.

Antes de editar: árbol limpio en base e899442, fetch origin, revisión de issue #5,
README/API/INICIO-LOCAL, flujo de reservas/Payment/migraciones/pruebas. No se
encontraron AGENTS.md aplicables. El conector GitHub dio 404; GitHub CLI autenticado
permitió leer issue y PR activos. Solo PR abierto #7 HU-03, base=base, 26 archivos.
Se advirtió el solapamiento documental/dependencias/infra de pruebas y la semántica
de CONFIRMED/CANCELLED en sus consultas. Su rama avanzó de c2dd659 a e62ba25 y se
volvió a actualizar la referencia. No se modificaron sus módulos ni su rama.

Tras aprobación: rama `feat/hu-01-reserva-recurrente` desde origin/base e899442.
No se sobrescribieron cambios ajenos ni se editó base. No se hizo push a base,
merge ni force push.
Se consultó documentación oficial Stripe para PaymentIntent, captura manual,
idempotencia, webhooks, reembolsos, pruebas y disponibilidad comercial. La propuesta
se presentó antes de escribir código. La elegibilidad comercial de una entidad
panameña no se da por resuelta al implementar sandbox.

Decisiones implementadas: tabla aditiva V3 checkouts con UUID e importes USD en
centavos; Payment heredado intacto. Retención 10 min, bloqueo compartido de fila
de habitación y consulta de disponibilidad que incluye retenciones; estados
intermedios fuera de reservations para preservar HU-03. Autorización y captura
manual, confirmación únicamente al verificar succeeded. Transacciones cortas sin
llamadas al proveedor, claves por operación, recuperación persistente de captura
incierta y reembolso. Expiración/rechazo libera retención; FINALIZING se conserva
ante incertidumbre para no sobrevender. Cobro tardío sin derecho a inventario se
reembolsa sin reserva. Cancelación pagada persiste reserva CANCELLED y solicitud
de reembolso juntas; fallo/pendencia de devolución se informa por separado.

Feature flag apagado preserva el flujo histórico sin interpretar CONFIRMED como
pagado; encendido bloquea el endpoint antiguo para impedir bypass del checkout.
Solo claves test y respuestas livemode=false. Stripe.js diferido con Payment
Element; sin guardar tarjeta/Customer/SetupIntent, PAN/CVV, cuerpos del proveedor
ni secretos en logs/Git. Sesión y CSRF intactos salvo el POST webhook específico,
que usa firma del SDK sobre cuerpo original. Consultas/acciones solo del dueño.
Documentación detallada y demostración: docs/HU01_CHECKOUT_INICIAL.md.

Dependencias fijadas: stripe-java 34.0.0 y @stripe/stripe-js 10.2.0. El intento de
npm dentro del sandbox no progresó; se canceló y se instaló con permiso de red.
Build frontend inicial bloqueado por permisos de lectura de Vite; repetido con
permiso: TypeScript/build/lint correctos. Compilación backend y pruebas correcta.
Pruebas unitarias reales en contenedor sin red: StripeWebhookTests **3/3**, cero
fallos/errores/omitidas (firma válida, alteración/antigüedad/modo live y claves).

La validación aislada completa está en ejecución; Docker estaba detenido y se
inició sin arrancar ni modificar servicios de desarrollo. La primera construcción
descarga imágenes/dependencias. JUnit de checkout utiliza un DOBLE explícito del
proveedor; E2E de checkout utiliza respuestas visuales interceptadas. Ninguno se
presenta como pago sandbox efectuado. La demostración contra Stripe requiere
claves privadas y listener y permanece pendiente hasta disponer de evidencia real.

Primera ejecución completa `.local/isolated/20261026-194456/`: migraciones,
adopción, preservación, arranque y barreras de aislamiento correctas. Frontend
TypeScript/lint/build correctos. 19/19 pruebas de checkout y 3/3 firmas correctas;
regresión total 44 Java, un fallo: SystemIntegrationTests aún esperaba dos
migraciones. Se reemplazó por comprobación exacta de versiones 1/2/3, sin retirar
validaciones. Se añadió además verificación de amount_received contra el importe
total y una prueba de captura parcial que no puede confirmar la reserva.
Una reconstrucción falló por PKIX de Maven Central; el reintento pasó manteniendo
TLS. El reset aislado verificó etiqueta/red/tmpfs y retiró solo PostgreSQL temporal.

Revisión remota 27/10: origin/base avanzó a 9bd8d2e (PR #7 integrado), con once
commits nuevos y V3__tracked_demonstration_history.sql. El PR activo #9 HU-05 usa
V4__reservation_notifications.sql y añade avisos al confirmar/cancelar reservas.
Nuestra V3 de checkout colisiona con V3 integrada y requiere coordinación con V4
pendiente. Además, la confirmación posterior al cobro debe coordinarse con el
aviso HU-05 dentro de la transacción, nunca al iniciar el checkout.

Se informó el conflicto y se pidió decisión entre priorizar la integración humana
de HU-05 y usar V5 después, o priorizar checkout con V4 y coordinar la renumeración
de HU-05. No se renumeró ninguna migración ni se resolvieron contenidos por
suposición; tampoco se integró ni se publicó la rama. La repetición aislada
`.local/isolated/20261027-182135/` valida únicamente el checkout sobre su punto
de partida e899442; no equivale a validar integración con origin/base 9bd8d2e.

La lectura de DemandHistoryBatchService en la base nueva confirmó otra dependencia:
su guardián de reversión rechaza FKs desconocidas hacia reservations/users.
Checkouts añade ambas. Se pidió autorización específica para reconocerlas y
rechazar lotes/usuarios con checkouts dependientes, con pruebas, sin modificar
fórmula, gráficos ni datos HU-03. No se alteró ese guardián mientras se espera
decisión: la exclusión de HU-03 indicada por Eric impide asumir esa excepción.

### Ampliación expresa a HU-01 completa — 27/10/2026

Eric pidió dejar sin efecto la división en primera/segunda entrega e implementar
el checkout completo para finalizar HU-01. Se recuperó su rama y el stash con
`apply --index`, conservando el stash de respaldo. No había cambios ajenos.
Origin/base continúa en 9bd8d2e y PR #9 continúa abierto. La autorización amplía
el alcance funcional, pero no elimina la instrucción de consultar decisiones
entre historias. Se pidió coordinación V5 dependiente de V4/#9 y adaptación mínima
del guardián, o priorización de V4 checkout con renumeración coordinada de HU-05.
No se aplicó ninguna alternativa mientras falta esa respuesta.

Implementado: consentimiento inicial desmarcado, versión hu01-on-session-v1 y
timestamp; Customer idempotente por perfil privado y setup_future_usage=on_session.
Sin casilla no se crea Customer ni referencia guardada. El método local se activa
en la transacción que confirma la reserva después de cobro completo verificado.
Solo se guardan referencia, marca, últimos cuatro dígitos y vencimiento, no PAN/CVV.
La nueva compra elige UUID local autorizado; se comprueban propietario y estado
local/proveedor y se confirma mediante Stripe.js sin rellenar otra vez la tarjeta,
con 3DS si procede. El usuario puede elegir tarjeta nueva si no tiene método o falla.
Retirada persistida primero, impidiendo nuevas compras aunque falle desvinculación;
el worker reintenta. No cancela operaciones previamente iniciadas.

Se añadieron tablas payment_profiles/saved_payment_methods y columnas de
consentimiento/método en la migración privada de checkout aún no publicada; su
numeración definitiva depende de la coordinación pendiente. No se cambió una
migración integrada ni se aplicaron migraciones a desarrollo. Las nuevas FK también
deben contemplarse en la adaptación mínima del guardián HU-03 si se autoriza.

Compilación del backend y pruebas y TypeScript/build/lint frontend correctos en
la ampliación inicial. La ejecución `.local/isolated/20261027-184756/` verifica
el alcance completo sobre el punto de partida original; no acredita integración
con la base nueva. Se ampliaron pruebas con/sin consentimiento, propietario,
método ausente/retirado/vencido, revocación con Stripe caído y CSRF, fallo y
concurrencia recurrentes. E2E nuevos prueban consentimiento y selección con un
doble visual claramente identificado, sin presentarlo como transacción Stripe.

La repetición anterior `.local/isolated/20261027-182135/` pasó backend/frontend y
falló 2/7 E2E por timeout: primer login y recorrido cliente. Se conservaron trazas;
la traza del primer login muestra carga inicial Vite y formulario finalmente
visible. No se ampliaron tiempos, añadieron retries ni desactivaron verificaciones.
La ejecución actual repite esos recorridos con las fuentes nuevas.

No existen claves Stripe exportadas ni `.env.stripe-test`; tampoco hay conector
Stripe disponible. Se solicitó configuración privada para la prueba integral.
Primer pago/compra recurrente/rechazo/3DS/reembolso contra sandbox permanecen sin
demostración hasta obtener credenciales y evidencia real. No se declara cumplida
la HU ni se publica un PR como verificado mientras falte integración/pruebas finales.

La ejecución completa `.local/isolated/20261027-184756/` pasó migraciones,
preservación y arranque: **55 Maven + 1 compatibilidad**, incluidas 30 pruebas de
checkout inicial/recurrente y tres de firmas. Frontend TypeScript/lint/build pasó.
Playwright pasó 7/9 y detectó un defecto real en los dos casos nuevos: randomUUID
no existe en el origen HTTP interno frontend-app. Se corrigió con 128 bits de
crypto.getRandomValues, sin Math.random, sin cambiar timeouts/retries ni relajar
aserciones. Las pruebas mostraron consentimiento desmarcado y selección guardada,
pero impedían iniciar checkout; se conservan errores/trazas de ambos casos.

Se añadió protección de propietario también al desvincular: si el método ahora
pertenece a otro Customer, no se modifica. Retirada local permanece efectiva y el
desacoplamiento queda pendiente de revisión/reintento. Un método inexistente en
Stripe (400/404 al consultar) se trata como fallo definitivo 409 para liberar la
retención, manteniendo 503 para fallos de disponibilidad. Se añadieron pruebas
del adaptador sin red. La validación posterior está en
`.local/isolated/hu01-complete-final/`; frontend ya pasó con la corrección HTTP.

Resultado posterior real: backend **56 Maven + 1 compatibilidad**, cero fallos,
errores u omitidas, incluidas 30 de checkout y cuatro de adaptador/firmas. Tras
clasificar el 404 del proveedor se repitieron sus **5 pruebas sin red**, todas
correctas; esa corrección no cambió esquema, servicios de dominio ni contratos.
TypeScript/lint/build finales pasaron. Playwright **9/9** (56.2 segundos), sin
retries/timeouts ampliados: cuatro escenarios HU-01 con doble visual y cinco de
regresión real contra la aplicación aislada. Se inspeccionó captura del resultado
recurrente del doble, sin confundir reserva sintética #999 con transacción Stripe.
Fuentes/logs completos en `.local/isolated/hu01-complete-final/`; reportes y capturas
en `.local/isolated-artifacts/e2e/hu01-complete-final/`.

Trabajo guardado en commits 6d49ee8 (backend completo) y 18f0f5d (UI/HTTP/E2E),
ambos refs #5; los tres commits iniciales se conservan. El stash original también
permanece como respaldo. Fetch posterior confirmó base 9bd8d2e y #9 abierto.
No se tocó el guardián HU-03 ni se eligió unilateralmente el orden V4/V5; no hay
push ni PR nuevo mientras esas decisiones requeridas sigan pendientes. No se
alteró PostgreSQL de desarrollo ni se ejecutaron cobros reales. Validación de
integración con la base vigente y transacciones Stripe sandbox siguen pendientes,
a pesar de las comprobaciones locales satisfactorias del checkout completo.

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
principal ~195 kB; chunk del módulo ~390 kB (~114 kB gzip), descargado al abrir
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

### Cierre de QA visual y primera CI remota HU-03

La ejecución remota [40424992003](https://github.com/yigpan29/hotel-reservation-system/actions/runs/40424992003)
del commit `c2dd659` pasó frontend e integración, con 37 Java y 8 E2E. PR abierto:
[#7](https://github.com/yigpan29/hotel-reservation-system/pull/7), referencia Issue #1.
No implica revisión humana, aprobación ni merge.

La revisión final añadió una comprobación visual de un período válido de un día:
se muestra su punto, en lugar de una línea sin segmento visible. No cambió ningún
cálculo ni endpoint. TypeScript/lint/build y 8/8 E2E volvieron a pasar en
`.local/hu03-single-day-frontend.log` y `.local/hu03-single-day-final.log`; captura
`hu03-single-day.png` bajo `.local/isolated-artifacts/e2e/hu03-single-day-final/`.
El último ajuste y esta evidencia se publican para sus checks completos de CI;
el resultado vigente figura en el PR #7.

## 2026-10-27 — Historial sintético autorizado de HU-03

Se continuó en `feat/hu-03-pronostico-demanda`, sobre `e62ba25`, con trabajo
inicial limpio. Revisión enfocada de DemandService/Repository/Math, estados,
esquema, Flyway y reloj Panamá: 13 hoteles, 72 habitaciones y una reserva reciente,
sin actividad en las ocho semanas de entrenamiento. La fórmula no tenía un defecto
y permanece intacta. No se repitió la auditoría histórica.

| Actividad | Herramienta | Solicitud y resultado real | Decisión humana |
|---|---|---|---|
| Diagnóstico | Codex | Confirmar falta de histórico y fechas completas de referencia | El operador solicitó conservar la fórmula |
| Diseño/carga | Codex | Generador transaccional, semilla 73003, seguimiento explícito V3, idempotencia y reversión segura | El prompt autorizó inserciones sintéticas y migración aditiva necesaria tras respaldo/prueba aislada |
| Respaldo | Codex + PostgreSQL | Archivo custom privado, SHA-256, restauración aislada y comparación por fila; V3 preserva las seis tablas originales | Autorizado expresamente; sin publicar respaldo ni datos personales |
| Desarrollo | Codex | Lote hu03-panama-history-v1: 936 reservas, 854 CONFIRMED/82 CANCELLED, 2779 noches, doce hoteles, 2026-08-03 a 2026-10-25 | Carga solicitada y autorizada en hotel-bd; cuenta técnica nueva USER |
| Repetición | Codex | Mismo lote devuelve reused=true, mismas cantidades y ninguna fila original cambiada | Solicitada como criterio de aceptación |
| Procedencia | Codex | Backend deriva SYNTHETIC_DEMO/MIXED/OPERATIONAL por relaciones reales y filtros; panel muestra origen y lote | Requisito explícito del operador |
| Pruebas | Codex + JUnit/PostgreSQL/Playwright | 42 Java + 1 compatibilidad, 8 E2E, TypeScript/lint/build; todas satisfactorias | No equivale a revisión humana del código |
| Navegador real | Codex + Chromium | Login/recarga, gráficos, 30 estimaciones, promedios, 13 filtros, móvil, logout y 401 posterior; sin 500/CSRF/JS | Operador autorizó ADMIN sintético temporal y su retirada, sin usar su cuenta personal |
| Limpieza QA | Codex + PostgreSQL | Tras logout se verificó identidad/huella/dependencias y se eliminó únicamente el ADMIN temporal; propietario USER del lote permanece | Retirada explícitamente autorizada; ninguna cuenta existente cambió |
| Corrección Docker | Codex | Archivo actualizado pero Vite servía el módulo anterior; sondeo Chokidar 1000 ms y recreación solo frontend resolvieron la caché | Dentro de la corrección necesaria para mostrar procedencia real |

La referencia efectiva fue 2026-10-27: entrenamiento 2026-08-31 a 2026-10-25,
horizonte 2026-10-28 a 2026-11-26. Ventana: 628 reservas (577 confirmadas/51
canceladas), 1826 noches. Viernes: 521/8=65.13 noches, 90.46% de capacidad actual;
miércoles: 75/8=9.38. Cero solapamientos confirmados, precios/fechas/cronología
inválidos y filas del lote modificadas. El máximo diario sintético fue 71/72.
Doce hoteles generan previsión; el hotel existente sin habitaciones continúa
informando insuficiencia. Se conservó la reserva operativa, sin mezclarla
silenciosamente con el historial etiquetado.

Se corrigieron dos aserciones iniciales (versión de Flyway 3 y canceladas que
pueden solaparse) y se repitió el harness completo. La prueba privada de navegador
ajustó su selector para excluir SVG de leyendas y confirmó que la falta inicial
del aviso nuevo era caché de Vite. No se desactivaron reglas ni seguridad.

Evidencias, comandos, tablas por día, límites y reversión exclusiva en
[HU03_HISTORIAL_SINTETICO.md](HU03_HISTORIAL_SINTETICO.md). Capturas versionadas
contienen solamente gráficos agregados; respaldos, identidad temporal y credenciales
quedan ignorados bajo .local. La contraseña temporal se retiró del archivo privado
después de eliminar la cuenta. No se ejecutó reversión sobre desarrollo.

Backend se recreó con Flyway automático desactivado tras aplicar únicamente V3;
PostgreSQL no se reinició ni se eliminó su volumen. No se modificaron V1/V2,
usuarios preexistentes, HU-01, HU-02, pagos, precios ni la rama base.
PR #7 permanece destinado a base; la revisión humana, aprobación y merge
corresponden al equipo. No se inventan aprobaciones ni se realiza merge automático.

## HU-04 (#6): constancia de reserva propia — 28/10/2026, America/Panama

Eric solicitó completar HU-04 en una rama independiente y preparar su aporte a la
tabla «El nuestro DOCUMENTAR» del informe académico. Se revisó el documento del
proyecto como contexto; no se modificó el original de Downloads ni se atribuyeron
aprobaciones o resultados del equipo sin evidencia.

Implementación: controlador independiente GET /api/reservations/{id}/certificate,
servicio PDFBox 3.0.8 y descarga desde Mis reservas. Solo propietario, incluyendo
administradores; sin escrituras ni migraciones. Refleja precios guardados y estado
actual, indica cancelación y valores heredados ausentes; no acredita pagos.
Texto largo se reparte entre líneas/páginas; fuente estándar para español con
sustitución explícita de glifos no soportados. Seguridad de sesión/CSRF conservada.

Se añadieron cinco pruebas Java y dos descargas (confirmada/cancelada) dentro del
recorrido Playwright existente. La primera ejecución aislada detectó un error de
preparación del agente: reutilizó una imagen flyway-check que contenía V3 de
checkout de otra rama. Flyway rechazó el checksum, sin reparar el historial ni
alterar migraciones. Se reconstruyó la imagen correcta y se repitió desde bases
tmpfs vacías. Esa primera ejecución fallida no cuenta como validación satisfactoria.

Validación final satisfactoria: `.local/isolated/20261028-051533/`. Pasaron 47
pruebas Maven (incluidas cinco de constancias), una adicional de compatibilidad,
TypeScript/lint/build y 8/8 Playwright. Migración nueva/adopción, preservación de
valores/secuencias y guardas de URL también correctas; las negativas esperadas
retornaron 1 sin baseline y 64 para destinos incorrectos. El PDF y su render
sintéticos se conservaron en docs/evidencias/hu04 y se inspeccionaron visualmente.
No se modificó PostgreSQL de desarrollo. HU-04 queda implementada y verificada
sobre base 9bd8d2e, pendiente de revisión humana e integración del PR.

## HU-04: revisión humana y formato formal de constancia — 28/10/2026

Eric informó que probó las dos demos y que cumplen el comportamiento esperado.
Solicitó mejorar la constancia porque el texto lineal no tenía la presentación
formal que esperaba para una reserva de hotel. Esta declaración se registra como
revisión funcional humana, sin atribuirle pruebas específicas de 3DS o webhooks
que no describió.

Se sustituyó la presentación lineal por encabezado HOTEL MN y referencia, franja
de estado, tablas de estancia y registro, total destacado y pie numerado. Se
conservan los datos pactados, la cancelación, el aviso de que no acredita pagos,
el control de propiedad y el contrato HTTP. Celdas medidas, ajuste por palabras,
márgenes y encabezados repetidos evitan recortes de datos extensos.

Las cinco pruebas existentes de constancias pasaron en PostgreSQL tmpfs de un
proyecto separado, hotel-reservation-system-hu04-format-test; no se truncaron las
reservas de la demo que Eric acababa de probar. Las pruebas exportan confirmada,
cancelada y texto largo para inspección visual. Se revisaron los tres PNG y se
actualizaron PDF/PNG sintéticos de docs/evidencias/hu04. No se volvió a afirmar
una ejecución de toda la suite: el cambio se validó con sus cinco pruebas de
contenido, permisos y CSRF, compilación y revisión visual.

Se actualiza únicamente el backend de HU-04 con el perfil isolated para evitar
repetir el cargador demo. PostgreSQL no se reinicia ni se migra; HU-01 y su
listener permanecen activos. La revisión y publicación continúan en PR #14,
siempre en borrador y sin fusionar.
La huella y cantidad de las reservas de la demo antes y después de actualizar
backend resultaron idénticas. Ambas demos respondieron HTTP 200. Se detuvo solo
el PostgreSQL auxiliar de pruebas de formato; las dos demos permanecen activas.

## Integración HU-01/HU-04 hacia main: diagnóstico — 28/10/2026

Eric informó que base se fusionó a main y autorizó continuar la preparación de
una rama de integración conservando las originales. Se comprobó PR #15 y main
7c892ea; HU-05/PR #9 sigue abierto y fuera de main. No hay cambios locales ajenos.
La rama integ/hu-01-hu-04-main parte de origin/main y conserva HU-04 formal.

Se comprobó en PostgreSQL tmpfs separado, mediante Flyway validate y sin migrate,
que main falla: Found more than one migration with version 3 (room_capacity y
tracked_demonstration_history). Main ocupa además V4 para huéspedes y V5 para
tipo; chocan con V4 de notificaciones y V5 de checkout. PR #15 no reporta checks;
el workflow actual solo cubre PR a base. No se toca ni renombra una migración
integrada ni se repara un historial de desarrollo.

Eric aprobó preparar diagnóstico y propuesta para el equipo. También eligió un
único pago por todas las habitaciones con confirmación conjunta, y cancelación
por habitación con reembolso parcial. Son nuevas decisiones funcionales para
adaptar HU-01 al flujo múltiple de HU-06, no funcionalidades que ya estén probadas.

HU-04 se combina con main manteniendo tipo y huéspedes en ReservationList. El
único conflicto de su prueba de navegador se resuelve conservando tanto la
aserción de tipo de habitación como la descarga PDF, sin quitar cobertura.
Backend con HU-04 compila; TypeScript, lint, build y 114 pruebas Vitest pasan
sin red. No se ejecuta ni declara satisfactoria la suite integrada DB/JUnit/E2E:
la colisión Flyway debe resolverse coordinadamente antes. HU-01 no se ha mezclado
para evitar publicar un checkout antiguo que confirme grupos sin cobrar o
pierda la selección de huéspedes. Ningún PR se fusionó ni se cerró.

Plan revisable en docs/auditorias/INTEGRACION_HU01_HU04_MAIN.md. Las demos y sus
bases no se modifican; solo se usa y detiene un PostgreSQL auxiliar de auditoría.

### Numeración aprobada por Eric para continuar la integración

Se incorporaron los commits de fix/main-historial-v6: historial V6 con SQL
idéntico, aserciones de secuencia V1-V6, precondición administrativa actualizada
y CI para PR a main. La rama de integración ya no contiene el V3 duplicado.
Esto no aplica ni repara historiales existentes y no implementa por sí solo el
checkout múltiple aprobado. La corrección se revisa en un PR independiente.

## Corrección aprobada del duplicado V3 en main — 28/10/2026

Eric eligió mantener capacidad V3, huéspedes V4 y tipo V5, moviendo solamente
el historial a V6. Se preparó fix/main-historial-v6 desde main 7c892ea para
revisión humana, sin modificar main/base directamente. El SQL de historial no
se editó: ambas rutas tienen objeto Git 096797d1c532395ead95d7e3d01ca884e864226c.
La prueba de integridad exige las seis versiones exactas y la compatibilidad
Flyway exige current=6. La CI se amplía a PR de main con los mismos permisos y
jobs existentes, dado que el PR #15 no reportó checks por el filtro previo.

Se documenta la diferencia entre instalación nueva/adopción legacy y bases que
ya registraron V3 de historial; estas últimas requieren una adopción aprobada
por separado. No se ejecuta repair ni se alteran historiales o datos reales.
Los números de las ramas HU-05/HU-01 todavía deben coordinarse al integrarlas.
El harness completo terminó correctamente en el proyecto tmpfs independiente
hotel-reservation-system-migration-v6-test: 55 pruebas Maven y una adicional de
compatibilidad, 114 pruebas Vitest, TypeScript/lint/build y 11/11 Playwright.
También pasaron instalación nueva V1-V6, adopción legacy desde V1, preservación
de datos/secuencias, repetición, validate, arranque limpio y guardas de destino.
Las negativas esperadas fueron 1 sin baseline y 64 para URLs incorrectas.
Reportes privados: .local/isolated/20261028-113516/.
Para conservar las demos activas se usó una copia local del mismo harness que
solo cambia raíz, nombre de proyecto, tags de imágenes y puerto 55176; mantiene
las aserciones y controles de aislamiento. La sintaxis del script administrativo
se comprobó sin ejecutarlo. No se afirma que estas pruebas adopten una base que
ya tenga V3 de historial. Evidencia pública sin datos personales:
docs/evidencias/migrations-v6/resultado.json.

## HU-01: actualización a base aprobada por Eric (28/10/2026)

Eric autorizó integrar origin/base 9bd8d2e únicamente dentro de la rama HU-01,
sin fusionar el PR #13 ni escribir en base, y reservar V5 coordinada con HU-05/V4.
Se conservaron las secciones de ambas historias en README, inicio local, contrato
API, AI log y pruebas. El lockfile conserva Stripe y las dependencias de Recharts.
V3 de HU-03 permanece intacta; la migración inédita de checkout se renombró a V5.
Las aserciones Flyway verifican exactamente V1/V2/V3/V5 en esta rama aislada.

Se adapta mínimamente el guardián de reversión HU-03: las tablas de pago se
reconocen, pero sus filas dependientes bloquean borrar el lote; otras relaciones
desconocidas siguen requiriendo revisión. Se añadieron pruebas de ambos casos.
HU-05 sigue fuera de base: no se aplica V5 a entornos compartidos antes de V4,
no se activa outOfOrder y la notificación posterior a captura queda pendiente.
Validaciones de esta actualización: harness completo satisfactorio el 28/10/2026,
con 79 pruebas Maven y una adicional de compatibilidad; TypeScript/lint/build
correctos y 12/12 Playwright. Incluye instalación limpia, adopción legacy,
preservación de datos/secuencias y guardas de URL (rechazos esperados 1 y 64).
Se ejecutó el mismo harness en el proyecto independiente
hotel-reservation-system-hu01-test, con imágenes propias y puerto 55174, para
no mezclar su esquema con la demo HU-04. Solo cambiaron las rutas de ejecución,
el nombre de proyecto, los tags de imágenes y el puerto; se conservaron las
aserciones y controles de aislamiento. Reportes privados:
.local/isolated/20261028-051728/. Los cuatro casos UI de checkout siguen usando
dobles; no se presentan como una prueba de Stripe.js contra el proveedor.

### Corrección detectada por Stripe real y verificación sandbox

Las claves privadas autentican. La primera prueba de checkout real devolvió 503:
el SDK recibió HTTP 400 porque `payment_method_types` ya no se admite. Los dobles
no habían detectado este error. Tras consultar el contrato oficial de creación de
PaymentIntent, se cambió a `allowed_payment_method_types`, manteniendo solo card
y captura manual. Se añadió una regresión del límite SDK; las seis pruebas del
adaptador final pasaron sin red. La suite completa de 79+1 y 12 Playwright pasó
antes de esa corrección puntual; no se afirma una nueva ejecución conjunta de 80.

También se corrigió el overlay sandbox: al recrear backend debe usar perfil
isolated, sin volver a ejecutar el cargador demo de una sola ejecución. Se
verificó el arranque saludable conservando el catálogo existente.

Con el adaptador final, siete escenarios contra api.stripe.com sandbox pasaron:
primer checkout sin guardado e idempotencia; guardado con consentimiento explícito;
segunda compra con método guardado real; rechazo sin reserva pagada y liberación
de inventario; requires_action 3DS sin confirmación prematura; cancelación con
reembolsos verificados; revocación del método. Se confirmaron y capturaron tres
pagos sandbox y se verificaron sus tres reembolsos. No se movió dinero real.
Evidencia sin secretos en docs/evidencias/hu01/stripe-sandbox-results.json.

La confirmación de esos pagos se hizo por API con PaymentMethods oficiales de
prueba, no mediante Stripe.js en navegador. Completar el desafío 3DS y recibir
un webhook real desde Stripe siguen pendientes de revisión manual. No se
presentan firmas locales ni dobles como entrega real de webhooks. Se conserva
el script opt-in tests/isolated/stripe-sandbox-smoke.py para reproducir el núcleo
de esos casos con confirmación explícita, claves test y URL local restringida.

No se modificó PostgreSQL de desarrollo ni se fusionó ningún PR. V4 de HU-05
aún no está en base: V5 no se aplica en entornos compartidos antes de V4.


## 2026-10-28 — Integración aprobada HU-01/HU-04 sobre main con checkout conjunto

Responsable: Eric. Refs #5 y #6. Main comprobado: fc74de3, merge humano del
PR #16. Rama de trabajo: integ/hu-01-hu-04-main; originales y demos conservados.
Eric autorizó conservar íntegros ambos bloques de documentación y resolver
los conflictos preservando calendario/huéspedes, pagos y consentimiento, PDF,
ambas dependencias y seguridad con excepción solo para webhook firmado.
El rechazo inicial de revisión automática impidió una concatenación/merge
encadenados sin revisar alternativas; no se ejecutaron esos comandos. Después
se mostraron las opciones y se obtuvo aprobación expresa antes de resolver.

Decisiones funcionales humanas: un pago por todas las habitaciones y confirmación
conjunta; cancelación por habitación con devolución de su importe congelado.
Se añadieron checkout_items, snapshots de tipo/tarifa/huéspedes, bloqueos en orden
por IDs, rollback sin retenciones parciales y finalización atómica. Calendario y
asignación consideran todas las retenciones. Se bloquean ambos endpoints legacy
de creación mientras checkout está activo. Se conserva sesión/CSRF y métodos
consentidos; la constancia formal HU-04 sigue disponible por reserva.

V1–V6 de main sin cambiar; checkout pasa a V8__checkout_orders.sql. V7 reservada
para HU-05, cuyo PR #9 aún contiene V4. No se modificó su rama ni se prueba una
migración inexistente. No desplegar V8 en una base compartida antes de coordinar
V7 y notificaciones posteriores a captura. No se alteró PostgreSQL de desarrollo,
no se ejecutó repair ni cobros reales.

Fallos y correcciones reales: referencia de tipo anotada Java corregida mediante
import de GroupRoomInput; mojibake de una lectura Git con encoding Windows
corregido preservando texto UTF-8; una prueba anterior reconfiguraba un Answer
Mockito con when y ejecutaba el matcher vacío: se usó doReturn, manteniendo la
verificación estricta de importe/moneda/PaymentIntent del reembolso. La primera
suite tuvo 109 aciertos y un error de fixture; se corrigió y repitió completa.

Resultado final aislado, reporte privado 20261028-133228:
110 JUnit (incluidas 12 nuevas de grupo) + 1 compatibilidad, 117 Vitest,
TypeScript/lint/build y 15 Playwright correctos. Instalación nueva, adopción,
repetición, validación, esquema completo, datos/secuencias y guardas negativas
se verificaron en hotel_test tmpfs. Checkout JUnit usa DOBLE de proveedor;
los cuatro E2E checkout interceptan contrato y no equivalen a operaciones Stripe.

Proveedor real solo sandbox: nueve escenarios API correctos a las 18:45 UTC,
con dos habitaciones por pedido, consentimiento explícito, reutilización,
rechazo sin reservas, 3DS requires_action sin confirmación prematura, devolución
parcial exacta/idempotente y revocación. Tres pagos sintéticos capturados y
completamente reembolsados por habitación; cero errores de limpieza. La primera
captura fue impulsada por webhook real, observada por GET sin sync posterior a
la autorización y con worker demorado 3600000 ms. El primer intento del smoke
llegó durante el arranque y devolvió 500 sin crear compras; tras health pasó.
Se añadió espera de health al script para reproducirlo. Evidencia pública sin
secretos: docs/evidencias/hu01/stripe-group-sandbox-results.json.
Quedan pendientes completar Stripe.js y el desafío 3DS interactivo; no se afirma
que esta prueba API los complete. No se registraron PAN/CVV ni credenciales.

PR #17 de diseño sigue abierto: solapa App, RoomDetails, MyReservations,
ReservationList, ReservationSummaryModal y estilos. Main no había avanzado al
consultarlo; se volverá a consultar antes de publicar. Preparar PR único en
borrador a main, refs #5/#6; no cerrar #13/#14 sin coordinación. Eric mantiene
aprobación y fusión humanas, sin auto-merge, ready, force push ni push a main/base.


### Revisión final y repetición tras ajustes acotados

La inspección final restringió el matcher CSRF expresamente a POST del webhook;
PUT/DELETE sin token quedan rechazados y se agregaron aserciones al caso de
permisos existente. En otra base hotel_test tmpfs, backend completo pasó de nuevo:
110 JUnit + una compatibilidad, sin fallos ni errores. El texto del checkout
aclara devolución completa del importe de la habitación, conservando las demás;
frontend volvió a pasar 117 Vitest, TypeScript, lint y build. Los cuatro E2E de
checkout con contrato interceptado también pasaron de nuevo (20,5 s).
La suite conjunta previa de 15 navegador se conserva como tal, sin sumar las
repeticiones como casos distintos. No hubo otros cambios de lógica de pagos.

Se verificó por comparación que los contenidos informativos de ambos AI logs
están preservados. Diff completo y staged sin errores de whitespace, sin
marcadores ni secretos reales aparentes. Main sigue en fc74de3 y PR #9/#17
siguen abiertos antes de publicar. La rama original HU-04 quedó limpia.
Commit de merge autorizado: f49a5f6 (padres b7810ef y 4f82336), refs #5/#6.
Las pruebas y evidencia se separan de la aprobación humana y de la fusión.

El reconciliador de la nueva demo se restauró a 15000 ms y backend/frontend
se actualizaron con imágenes finales, conservando datos sintéticos. Demos
anteriores y listener original intactos. Se retiró solamente el proyecto
hotel-reservation-system-eric-security-test usado para la repetición, no las
demos. La demo combinada permanece en http://127.0.0.1:55177 con su propio
listener sandbox; claves y logs privados bajo .local, fuera de Git.


## 2026-10-28 — Cierre autorizado de PR sustituidos (refs #5, #6)

Eric confirmó mantener una sola entrega de HU-01/HU-04 mediante PR #18 hacia
main y cerrar los antiguos #13/#14. Antes se comprobó que ambos seguían abiertos,
en borrador hacia base y con conflictos; base sigue existiendo y puede recibir
PR. Se expusieron las alternativas de usar el combinado hacia base o actualizar
los originales, sin ejecutar retarget ni merge. Eric cambió esa indicación por
el cierre de ambos como sustituidos y pidió documentarlo en el informe.

Resultado comprobado: #13 CLOSED y #14 CLOSED, ambos con mergedAt null.
#18 OPEN, draft=true, base=main y sin auto-merge. No se ejecutó ningún comando
de merge, no se borraron ramas ni se modificaron bases de datos o código de
aplicación. El historial y las revisiones de los PR cerrados siguen disponibles.
La decisión de entrega sin esperar HU-05 no cambia el pendiente de coordinar
V7/V8 y notificaciones antes de un despliegue compartido.

Se añadió una fila a docs/INFORME_ERIC.md, con decisión humana en primera persona.
Esta actualización es documental: diff/whitespace y estados remotos comprobados;
no se repiten pagos ni pruebas de aplicación por este cambio. Las validaciones
previas corresponden a la implementación verificada, no a nuevas ejecuciones.

## 2026-10-27 — HU-05: notificaciones y recordatorios de reservas

Herramienta: Codex CLI. Issue real verificada en GitHub: **#8**; rama
`feat/hu-05-notificaciones-reservas`, origen/base remoto `9bd8d2e` (PR #7).
Git estaba limpio. La auditoría enfocada se hizo en modo de solo lectura y se
documentó antes de implementar en `docs/auditorias/HU05_NOTIFICACIONES.md`.
Desarrollo: PostgreSQL17.11, V1–V3, 937 reservas/936 sintéticas, sin notificaciones.

| Actividad | Solicitud y resultado verificado | Decisión humana |
|---|---|---|
| Auditoría/diseño | Reutilizar reserva, sesión, CSRF, DTOs, reloj y navegación; V4 aditiva sin backfill | Alcance solicitado en HU-05 |
| Backend | Avisos atómicos en transacción de confirmación/cancelación; destinatario canónico, snapshots y FK; idempotencia UNIQUE(reserva,tipo) | No cambia reglas de reservas, pagos o disponibilidad |
| Recordatorios | Mañana calendario Panamá, cron configurable 09:00, recuperación del día al arrancar; bloqueo y unicidad | Diseño explícito: reservas anteriores sin aviso HU-05 no se incorporan, aunque su entrada sea futura |
| Privacidad | API propia sin userId; ADMIN no tiene excepción; lectura/contador/paginación con sesión y CSRF | Requisitos de la historia |
| Frontend | Centro /notifications, contador, lectura, enlaces a reserva, carga/vacío/errores y móvil | Conserva naranja y navegación existente |
| Compatibilidad HU-03 | V4 añade FK; guardián de reversión reconoce la nueva relación y rechaza lotes/usuarios con avisos dependientes | Operador respondió: «Autorizar ajuste mínimo de compatibilidad»; no autoriza cambiar fórmula ni datos |
| Pruebas | 55 Maven + 1 compatibilidad, 10 Playwright, TypeScript/lint/build; dos escenarios HU-05 repetidos sin limpiar: 2/2 | Resultados ejecutados; no equivalen a revisión humana |
| Desarrollo | Respaldo privado verificado y restaurado en base aislada; V4 probada en copia con ocho tablas idénticas | Operador respondió: «Autorizar V4 y actualización del backend» |
| Aplicación autorizada | Solo V4 y recreación de backend con Flyway automático apagado; health UP, anon401, CSRF200, avisos0; 937 reservas/936 etiquetas intactas | Sin crear usuarios/reservas de prueba ni usar cuentas personales; PostgreSQL/frontend no reiniciados |

Se conservaron huellas privadas por fila de usuarios, hoteles, habitaciones,
reservas, pagos, reseñas y ambas tablas de seguimiento HU-03. Después de V4 y
arranque del backend seguían idénticas; PostgreSQL mantuvo identidad y volumen.
Respaldos, credenciales y huellas permanecen ignorados bajo `.local/private-hu05`.
Ninguna migración V1/V2/V3 se modificó ni se repitió baseline.

Correcciones reales de las propuestas/pruebas iniciales de IA:

- Los dos primeros errores de JUnit eran el guardián de relaciones de reversión
  HU-03 ante la FK nueva. Se hizo el ajuste mínimo autorizado y se añadió una
  comprobación de rechazo cuando hay notificaciones dependientes.
- La revisión encontró que exigir salida válida para todo aviso endurecía una
  cancelación legacy que antes admitía salida nula. Se permitió esa instantánea
  únicamente para CANCELLED y se probó en PostgreSQL; confirmación/recordatorio
  siguen exigiendo fechas válidas. React también trata fechas legacy nulas sin fallar.
- Repetir E2E sobre la misma base reveló que las habitaciones compartidas estaban
  reservadas por una ejecución anterior. La prueba ahora prepara inventario único
  por ejecución con un contexto ADMIN sintético separado. La repetición pasó.
- La inspección de capturas detectó que el estilo común panel sobrescribía el fondo
  de no leídas. Se corrigió la especificidad CSS y se repitieron frontend y Chromium.

Cron real cada cinco segundos solo en backend-app aislado; JUnit usa Clock
controlado y scheduler apagado. El fixture crea opt-in CONFIRMED para una reserva
controlada; el programador, no el SQL, genera el recordatorio. Canceladas y reservas
anteriores/sintéticas HU-03 no producen recordatorios; no hay cientos de avisos
al instalar. Una notificación previa a una cancelación concurrente se conserva
como historial; si cancelación gana el bloqueo no se genera recordatorio nuevo.

Evidencias y comandos: `docs/HU05_NOTIFICACIONES.md`, capturas en
`docs/evidencias/hu05`, reportes locales y artifacts del workflow de PR hacia base.
No se introdujeron dependencias nuevas ni se deshabilitaron TypeScript, ESLint,
Spring Security, CSRF o checks de error. No se implementaron HU-01/02/04, pagos,
precios automáticos, segundo panel ni autenticación alternativa. HU-03 mantiene
su fórmula/gráficos y datos; solo cambia el guardián expresamente autorizado.

Las notificaciones son internas; no hay email/SMS/WhatsApp. El contador consulta
cada 30 segundos y tras acciones/foco. No se recuperan recordatorios de días
vencidos si el sistema estuvo apagado todo ese día. Revisión humana, aprobación
e integración a base permanecen pendientes del equipo; no se hace merge automático.

### HU-05: revisión final de concurrencia temporal

Codex detectó por inspección una carrera posible al leer todas: un aviso nuevo
podía tener created_at posterior a la hora capturada antes del UPDATE. Se usa
CASE para read_at=max(reloj,created_at), conservando el primer read_at existente.
La regresión nueva controla el reloj desplazado; 55 Maven y 1 compatibilidad
pasaron. La repetición parcial previa falló solo por fixtures E2E en la base
que catálogo esperaba vacía; se verificó ese requisito y se repitió, sin relajar
ni cambiar las pruebas de catálogo. Logs de ambos intentos conservados bajo .local.
No se cambia V4 ya aplicada: la corrección es del repositorio y sus pruebas.
