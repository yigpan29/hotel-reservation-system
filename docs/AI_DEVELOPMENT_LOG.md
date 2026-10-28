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
