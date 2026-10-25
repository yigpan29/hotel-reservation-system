# Diagnóstico posterior a la auditoría

Fecha: 2026-10-25. Rama de trabajo: `chore/configuracion-inicial`.

Este documento registra evidencia nueva. No modifica ni sustituye `docs/auditorias/AUDITORIA_INICIAL.md`.

**Actualización vigente: entorno aislado y pruebas iniciales del 2026-10-25 al final del documento.** Los bloqueos y aprobaciones pendientes descritos en las secciones anteriores se conservan como trazabilidad histórica. El desarrollador autorizó preparar el entorno aislado y ejecutar las verificaciones iniciales; los cambios funcionales y cualquier intervención sobre desarrollo siguen fuera de alcance.

## Estado inicial y alcance completado

- Raíz Git efectiva: carpeta interior `hotel-reservation-system/`.
- Rama inicial `base`; HEAD `2f82bdb96836991b1051ebaa918859c9f5a3dc6c`; coincide con origin/base. origin/HEAD apunta a origin/base. La referencia remota es la almacenada localmente; no se hizo fetch que confirme cambios recientes del servidor.
- Archivos iniciales sin seguimiento: `compose.yaml`, `INICIO-LOCAL.md`, `docs/auditorias/AUDITORIA_INICIAL.md`. Ningún archivo rastreado modificado inicialmente.
- Se creó `chore/configuracion-inicial` desde base, conservando los tres archivos. No se modifica base.
- Auditoría completa leída; plan preparado en `docs/planes/PLAN_ESTABILIZACION.md` con etapas, aceptación, decisiones y riesgos.
- Se preparó externalización de los valores de Compose, `.env.example` y reglas de exclusión. El `.env` privado conserva los valores de desarrollo preexistentes para no sugerir un cambio implícito de credenciales del volumen. No se publica su contenido.
- La guía de inicio ahora distingue instalación nueva de un entorno ya levantado; no indica reiniciar servicios sin revisión/autorización.
- Sin cambios funcionales en fuentes de frontend/backend, esquema o datos. Sin instalación global ni cambios de permisos. HU-01, HU-02 y HU-03 permanecen pendientes.

## Verificaciones ejecutadas

| Verificación | Resultado real |
|---|---|
| Git status, branch -avv, remote -v | base/origin/base y tres archivos locales identificados; rama de trabajo creada con éxito |
| whoami | Mismo usuario del desarrollador; identidad personal omitida en el documento |
| whoami /groups | Miembro de docker-users; token de integridad media, grupos administrativos usados solo para denegar; esto no demuestra por sí solo la causa exacta del rechazo |
| docker context show | desktop-linux |
| docker context inspect desktop-linux (solo endpoint) | Named pipe dockerDesktopLinuxEngine |
| docker ps -a | `permission denied while trying to connect to the docker API` |
| wsl -d Ubuntu (detección de herramientas) | `Wsl/Service/E_ACCESSDENIED`; no se instaló ni cambió WSL |
| GET http://127.0.0.1:5173/ | HTTP 200 |
| GET http://127.0.0.1:3000/api/hotel/get-all | HTTP 204 |
| java -version | Java 8 (1.8.0_491); no JDK 17 disponible en las ubicaciones verificadas |
| Get-Command | node/npm/git presentes; Maven, gh y psql no encontrados en PATH |
| npm install inicial | `ENOTCACHED`; entorno configura NPM_CONFIG_OFFLINE=true |
| npm con red habilitada solo en esa invocación y caché local | Reintentos `ECONNREFUSED` hacia registry.npmjs.org. Se interrumpió el proceso; no se instalaron paquetes ni se modificaron manifiestos/lockfile |
| Descarga de JDK portable dentro del workspace | Falló: `Se ha terminado la conexión: Error inesperado de recepción`; no se modificó Java global |
| docker compose config --quiet, después de externalizar valores | Exit 0; configuración válida, sin iniciar servicios ni imprimir secretos |
| git diff --check | Exit 0; sin errores de whitespace en cambios rastreados |
| git check-ignore .env y carpetas de dependencias/target | Archivos privados y artefactos excluidos |
| Aserciones PowerShell sobre JSON Compose, sin imprimirlo | Conserva proyecto, tres servicios, cuatro volúmenes, montaje postgres-data, puertos loopback y coherencia de variables backend/PostgreSQL |

La consulta HTTP confirma disponibilidad de los servicios, pero no identifica sus contenedores ni prueba el esquema PostgreSQL. No hay evidencia de que Docker Desktop esté averiado. Pertenecer a docker-users no permite concluir que el proceso restringido de Codex tenga acceso al pipe. No se cambiaron ACL, grupos, contextos ni permisos; no se intentó elevar privilegios.

Un intento de comprobación Compose mediante subprocess de Node no pudo lanzar el proceso (status null); se sustituyó por la invocación directa desde PowerShell y esa comprobación sí finalizó correctamente. No se atribuye ese error de herramientas a la configuración Compose.

## Bloqueos y decisión de avance

No se pudo inspeccionar el esquema ni los datos reales de PostgreSQL. Tampoco se dispone de Java 17/Maven ni de las dependencias de pruebas, y la descarga de herramientas está restringida. No es posible validar en este entorno una migración, el backend o el E2E PostgreSQL aislado.

La preparación de configuración se valida sin iniciar contenedores mediante `docker compose config --quiet` y comprobaciones de Git/ignore. Las etapas funcionales **no están completadas ni validadas**. Se detiene su ejecución antes de modificar el dominio o aplicar migraciones, conforme a la exigencia de verificar primero los datos y probar cada etapa. El pipeline CI y Playwright siguen pendientes; no se entrega un workflow que aparente validar una aplicación aún incompleta.

No hubo comandos de inicio/reinicio de Docker Desktop o servicios, `compose down`, eliminaciones de volúmenes, cambios de datos ni autenticación contra la aplicación. No se ejecutaron suites de pruebas, builds o migraciones. Los errores de instalación no son fallos de la aplicación.

## Diagnóstico manual seguro (PowerShell del desarrollador)

Ejecutar en la raíz Git interior, desde una sesión normal que ya pueda usar Docker. No publicar salidas que incluyan credenciales o datos personales. Estos comandos son de lectura; no requieren reiniciar servicios:

```powershell
whoami
whoami /groups
docker context show
docker context inspect desktop-linux --format '{{.Endpoints.docker.Host}}'
docker version
docker compose ps --all
docker compose logs --tail 80 --no-color backend frontend postgres
docker compose config --quiet
docker compose exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Interpretación: si los mismos comandos funcionan en esa consola y fallan en Codex bajo el mismo usuario, la diferencia de acceso del proceso restringido es una hipótesis fuerte. Si también fallan fuera, revisar el acceso del usuario al motor con soporte del entorno; no aplicar cambios globales o reinicios como parte de este plan automáticamente. No habilitar la API Docker TCP sin autenticación como solución.

### Inspección PostgreSQL sin información personal

Abrir psql dentro del contenedor existente, usando sus variables internas, sin imprimir la contraseña:

```powershell
docker compose exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
```

Dentro de psql, ejecutar:

```sql
BEGIN READ ONLY;
SELECT version();
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' ORDER BY table_name;
SELECT table_name, column_name, data_type, is_nullable
 FROM information_schema.columns WHERE table_schema = 'public'
 ORDER BY table_name, ordinal_position;
SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid)
 FROM pg_constraint WHERE connamespace = 'public'::regnamespace
 ORDER BY conrelid::regclass::text, conname;
SELECT tablename, indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public' ORDER BY tablename, indexname;
COMMIT;
```

Solo después de confirmar que existen esas tablas/columnas, consultar agregados en otra transacción READ ONLY:

```sql
BEGIN READ ONLY;
SELECT 'hotels' AS tabla, count(*) FROM hotels
 UNION ALL SELECT 'rooms', count(*) FROM rooms
 UNION ALL SELECT 'users', count(*) FROM users
 UNION ALL SELECT 'reservations', count(*) FROM reservations;
SELECT count(*) AS reservas, min(created_at), max(created_at),
 count(*) FILTER (WHERE created_at IS NULL) AS sin_creacion,
 count(*) FILTER (WHERE start_date IS NULL OR end_date IS NULL
                       OR end_date <= start_date) AS fechas_invalidas
 FROM reservations;
SELECT status, count(*) FROM reservations GROUP BY status;
COMMIT;
```

No consultar emails, contraseñas, nombres de clientes o tokens. No ejecutar modificaciones para adaptar la base al informe. La estrategia final de migración requiere comparar este esquema con JPA y probar una copia aislada antes de adoptarla. El plan prevé Flyway y Hibernate validate; aún no están implementados.

## Requisitos para retomar

1. Un entorno de ejecución con acceso autorizado a Docker y red de dependencias, o Java 17/Maven y PostgreSQL de pruebas aislado ya provisionados. No hace falta dar privilegios administrativos globales.
2. Resultado de la inspección de esquema/agregados, sin información sensible, y conocimiento del volumen existente.
3. Mantener las pruebas en una instancia/base exclusiva, con otros puertos/proyecto Compose, sin conectar suites a hotel-bd de desarrollo.
4. Continuar etapas 2–6 del plan con commits separados y evidencia de pruebas. Solo después de validar implementación, push y PR hacia base, sin merge.

## Estado de entrega

Preparación parcial; no es una estabilización funcional terminada. No se creó Pull Request de implementación ni se publicó una rama como validada. Los resultados de cierre y commit se comunican junto con este documento. La auditoría histórica se conserva byte por byte.

Objeto Git de la auditoría conservada: `75297166f4a8d198247969fe1f3441d34c371905`. No se alteraron fuentes Java/React, POM ni manifiestos/lockfile frontend. No se aplicaron cambios a los contenedores existentes. Los únicos archivos del repositorio preparados para commit son los tres locales iniciales, `.gitignore`, `.env.example`, el plan y este diagnóstico; `.env` queda privado.

Primer commit: `b6b58e0`, documentación inicial. Al agregar la auditoría histórica, `git diff --cached --check` notificó cuatro líneas con dos espacios finales de Markdown (líneas 3–6, saltos de línea explícitos preexistentes). Se conservaron para no alterar el documento histórico. La comprobación inicial sin cambios rastreados pasó, pero no debe confundirse con esta comprobación posterior del contenido agregado, que sí informó esos avisos. Git también notificó su conversión habitual LF/CRLF; no se cambió su configuración global. Los archivos nuevos de preparación se verifican separadamente de ese contenido histórico.

Referencias técnicas consultadas para las decisiones del plan (no implican implementación): [persistencia de autenticación Spring Security](https://docs.spring.io/spring-security/reference/7.0/servlet/authentication/session-management.html) y [baseline-on-migrate de Flyway](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-baseline-on-migrate-setting). La documentación de Security enlazada es de una versión posterior a la del proyecto; cualquier implementación deberá usar la API compatible con Spring Boot 3.3.2 y probarla.

## Reanudación: diagnóstico dinámico — 2026-10-25, America/Panama

### Alcance y estado Git comprobado

Se leyeron completamente, en el orden requerido, auditoría, plan, diagnóstico anterior, guía local y Compose. No se reinició el proceso de estabilización. Esta sesión modifica exclusivamente este diagnóstico. No se ejecutaron instalaciones, suites, builds, migraciones, escrituras HTTP/SQL, arranques/reinicios, commits, push ni PR. Las consultas pueden generar los logs y estadísticas normales de los servicios.

- Raíz Git efectiva: `hotel-reservation-system/` interior al directorio inicial del workspace. El primer `git rev-parse` desde la carpeta exterior falló; la repetición en la interior tuvo éxito.
- Rama activa: `chore/configuracion-inicial`; HEAD `f89859c`. Predecesor `b6b58e0`. Ambas referencias esperadas siguen presentes.
- `base` y la referencia local `origin/base`: `2f82bdb`; rama de trabajo dos commits por delante. No se realizó fetch ni se comprobó el estado remoto actual.
- Estado inicial `git status --porcelain=v1 --untracked-files=all`: vacío. No había cambios rastreados ni archivos sin seguimiento visibles para Git; no se encontró trabajo ajeno pendiente. Los archivos ignorados no forman parte de esa conclusión.
- Diferencia `base...HEAD`: siete archivos de preparación/documentación (`.env.example`, `.gitignore`, `INICIO-LOCAL.md`, `compose.yaml`, auditoría, plan y diagnóstico), 860 inserciones. Frontend y backend no difieren de `base` según `git diff --quiet base HEAD --` sobre ambos subproyectos.
- `git check-ignore -v` confirma exclusión de `.env`, `.env.local`, `target/` y `node_modules/`. El inventario de archivos `.env` rastreados solo devuelve `.env.example`. No se imprimió ni sobrescribió el archivo privado. Esto no sanea credenciales heredadas en properties/copias `bin/` o historial.
- Auditoría histórica: `git hash-object` devuelve `75297166f4a8d198247969fe1f3441d34c371905`, igual al objeto registrado previamente. No se encontró `AGENTS.md` en el inventario del proyecto.

### Docker y Compose observados

`docker version` confirma cliente/Engine 29.5.2, Docker Desktop 4.75.0, contexto `desktop-linux`. `docker compose config --quiet` finaliza con código 0. Las etiquetas reales de los tres contenedores identifican el proyecto `hotel-reservation-system`.

| Servicio / nombre real | Imagen | Estado | Reinicios / OOM | Puerto host |
|---|---|---|---|---|
| backend / `hotel-reservation-system-backend-1` | `maven:3.9-eclipse-temurin-17` | running; sin healthcheck de aplicación | 0 / false | 127.0.0.1:3000 → 3000 |
| frontend / `hotel-reservation-system-frontend-1` | `node:22-bookworm-slim` | running; sin healthcheck de aplicación | 0 / false | 127.0.0.1:5173 → 5173 |
| postgres / `hotel-reservation-system-postgres-1` | `postgres:17` | running, healthy; failing streak 0 | 0 / false | 127.0.0.1:5432 → 5432 |

Frontend/PostgreSQL iniciaron el 2026-10-24 a las 23:28:44 UTC y backend a las 23:28:53 UTC. Estos contadores no evidencian reinicios inesperados de los contenedores actuales; no reconstruyen contenedores eliminados ni todos los reinicios internos de DevTools.

Los tres pertenecen a `hotel-reservation-system_default`. La comparación interna, sin imprimir valores de entorno, confirma que la URL de datasource del backend apunta a `postgres:5432` y a la misma base configurada en PostgreSQL. No se consultó un volcado de variables en la salida.

Montajes reales:

- PostgreSQL: `hotel-reservation-system_postgres-data` → `/var/lib/postgresql/data`, lectura/escritura; persiste fuera de la vida del contenedor.
- Backend: bind de fuentes en `/app` y `hotel-reservation-system_maven-cache` → `/root/.m2`.
- Frontend: bind de fuentes en `/app`, `hotel-reservation-system_frontend-dependencies` → `/app/node_modules` y `hotel-reservation-system_npm-cache` → `/root/.npm`.

No se eliminaron ni reutilizaron volúmenes para pruebas. Los binds de desarrollo siguen activos: editar fuentes/configuración podría provocar recarga automática; el aislamiento futuro deberá contemplarlo antes de cualquier cambio funcional.

Se capturaron 177 líneas con `docker compose logs --tail 100 --no-color backend frontend postgres`; se imprimieron únicamente coincidencias relevantes filtrando posibles datos sensibles. En esa ventana se observaron:

- Vite 5.4.0 listo en 312 ms; Tomcat en 3000 y Spring iniciado correctamente.
- PostgreSQL listo para aceptar conexiones.
- Advertencia `spring.jpa.open-in-view` habilitado por defecto.
- Advertencia de inicialización sobre autenticación `trust` en conexiones locales del contenedor. No demuestra que conexiones TCP externas usen trust; las reglas actuales de `pg_hba.conf` no se inspeccionaron.
- Advertencia esperada por el GET diagnóstico con ID `abc` (conversión a Long). No apareció coincidencia ERROR/FATAL/BUILD FAILURE en la selección de esa ventana. No es garantía sobre todo el historial.

**Sandbox:** `version`, `ps` y varias invocaciones directas funcionaron. Las consultas compuestas de logs, inspect y psql recibieron `permission denied` al pipe dentro del sandbox. Se repitieron fuera con autorización y finalizaron correctamente. La primera captura fallida de logs produjo una sola línea de error; no se usó como evidencia de logs. Un booleano calculado tras inspect fallido tampoco se usó; la repetición validó el resultado verdadero. El acceso al Engine está resuelto para este diagnóstico; no se atribuye el rechazo de ciertos procesos a una avería de Docker.

### PostgreSQL real: estructura

Se utilizó `psql -X` dentro del contenedor existente, con `ON_ERROR_STOP=1`, sin instalar clientes en Windows. Ambas sesiones SQL se ejecutaron con `BEGIN READ ONLY` y terminaron con `COMMIT`. `current_setting('transaction_read_only')` devolvió `on` en la sesión estructural.

- Base conectada: `hotel-bd`; `current_database() = POSTGRES_DB` devolvió true. Concuerda con la configuración datasource del backend verificada internamente.
- Servidor: PostgreSQL **17.11**, Debian, x86_64.
- Esquema de aplicación: `public`. Solo se encontraron las seis tablas siguientes fuera de esquemas de sistema; no existe `flyway_schema_history`.

| Tabla | Columnas y tipos encontrados |
|---|---|
| hotels | id bigint identity; description, location, name varchar; rating double precision |
| rooms | id bigint identity; availbility boolean; price_per_night integer; room_number, type varchar; hotel_id bigint |
| users | id bigint identity; created_at timestamp without time zone; email, password, username varchar |
| reservations | id bigint identity; created_at, end_date, start_date timestamp without time zone; status varchar; room_id, user_id bigint |
| payments | id bigint identity; amount integer; payment_date timestamp without time zone; status varchar; reservation_id bigint |
| reviews | id bigint identity; comment varchar; created_at timestamp without time zone; rating integer; hotel_id, user_id bigint |

Total: 34 columnas. Solo los seis `id` y `users.username/email` son NOT NULL. No hay defaults en las demás columnas, en particular fechas de creación; los IDs se generan por identity.

Se encontraron **14 restricciones**, todas validadas: seis PK por id, seis FK y dos UNIQUE de users (email y username). Las FK son rooms→hotels, reservations→rooms/users, payments→reservations y reviews→hotels/users. No declaran ON DELETE CASCADE; ello no elimina el riesgo de cascadas ejecutadas por JPA. Se encontraron **ocho índices btree únicos**: seis de PK y dos de unicidad de users. No hay índices adicionales de FK/fechas, CHECK de fechas/precios/estados, exclusión de solapamientos ni unicidad `(hotel_id, room_number)`.

### Conteos y calidad de datos

Se verificó primero existencia de tablas/columnas y después se ejecutaron agregados sobre nombres cualificados con `public`.

| Tabla | Registros |
|---|---:|
| hotels | 0 |
| rooms | 0 |
| users | 0 |
| reservations | 0 |
| payments | 0 |
| reviews | 0 |

- Reservas: cero campos nulos/vacíos de creación, inicio, fin, estado, room y user; cero intervalos `end_date <= start_date`. Distribución de estados sin filas. La consulta agrupó estados conocidos y habría ocultado valores libres desconocidos.
- Solapamientos: cero pares para la misma habitación usando `a.id < b.id`, intervalos válidos y `a.start_date < b.end_date AND b.start_date < a.end_date`, sin excluir estados. Al no haber filas ni política de estados implementada, no se interpreta como validación de disponibilidad/concurrencia.
- Agregados de campos importantes: cero nombres/ubicaciones de hotel ausentes; cero habitaciones sin hotel/número/tipo/disponibilidad/precio; cero usuarios con username/email/password/created_at ausentes; cero pagos sin reserva/importe/fecha/estado; cero reseñas sin referencias/rating/created_at. No se seleccionaron valores personales.
- Cero rangos anómalos en ratings de hotel (0–5) y reseña (1–5), precios/importes negativos; son umbrales diagnósticos, no reglas verificadas del producto. Cero referencias huérfanas en las seis relaciones y cero grupos duplicados de hotel/número de habitación.
- Cobertura histórica: mínimos/máximos de creación y estancia NULL, cero días distintos de creación, cero reservas creadas en los 56 días previos, cero creaciones futuras y cero estancias futuras. **No existe histórico de reservas en esta base; no hay evidencia para previsión y no se generaron datos.**

Todos los conteos de anomalías son cero porque las tablas están vacías. No demuestran calidad de datos poblados ni que el esquema impida anomalías futuras. Son una fotografía de las transacciones consultadas, no una promesa sobre cambios posteriores.

`pg_stat_activity`, sin seleccionar texto SQL, identidades ni direcciones, mostró diez conexiones ajenas a psql, idle, y diez con cliente JDBC. Junto a la coincidencia de datasource, red y GET de hoteles 204, es evidencia consistente de conexión backend–PostgreSQL; no se ejecutó una prueba de escritura.

### Comparación del esquema con JPA y HTTP

Las seis entidades principales se compararon con las 34 columnas reales. No se detectaron tablas/columnas persistentes ausentes, nombres divergentes entre entidades y PostgreSQL ni tipos incompatibles: Long→bigint identity, Integer→integer, Double→double precision, Boolean→boolean y LocalDateTime→timestamp sin zona. Las seis FK corresponden a las asociaciones declaradas; las colecciones inversas no exigen columnas adicionales. Esta comparación de lectura no sustituye una ejecución de Hibernate validate.

Persisten estas carencias de contrato/dominio:

- `Room.availbility` y la columna real usan la misma errata; `RoomDTO.availability` difiere. No existe mapper de Room que la resuelva. Renombrar solo Java/SQL con Hibernate update activo podría dejar columnas divergentes.
- Campos y FK de negocio permiten NULL; status es texto libre sin catálogo; timestamps carecen de generación automática; precios enteros sin unidad/moneda definida; sin precio pactado, cancelación fechada, roles o retención efectiva.
- No hay anomalías de estados o fechas históricas demostrables porque no hay registros. No debe inventarse un backfill histórico.
- `application.properties` principal conserva `spring.jpa.hibernate.ddl-auto=update`, show-sql y logging SQL/debug; Compose no declara override de ddl-auto. No se leyó la configuración efectiva mediante Actuator ni se arrancó otro contexto. El riesgo de actualización automática sigue vigente.
- Cascade.ALL en Hotel→Room/Review, User→Reservation/Review y Reservation→Payment puede afectar historial aunque las FK no tengan cascada SQL.

| GET comprobado sin autenticación | Resultado |
|---|---|
| frontend `/` | 200, HTML, 683 bytes, cliente Vite |
| frontend `/src/App.tsx` | 200, JavaScript transformado, referencias a AdminPanel |
| API `/api/hotel/get-all` | 204, vacío; concuerda con hotels=0 |
| API `/api/hotel/get-hotel/0` | 404 |
| API `/api/hotel/get-hotel/abc` | 400 |
| get-all con Origin localhost:5173 | 204, Allow-Origin localhost:5173 |
| get-all con Origin 127.0.0.1:5173 | 403 |
| API `/api/rooms`, `/api/reservations` | 404 en esas rutas concretas |

La revisión de mappings solo encuentra los endpoints del controlador Hotel; UserController sigue vacío. No se infiere la ausencia global de endpoints únicamente de dos 404. Las respuestas son compatibles con el código actual y los binds observados, pero no se certificó identidad byte a byte entre clases cargadas y HEAD. No hubo navegación visual ni prueba de montaje React: entregar App.tsx no garantiza que todos sus imports se resuelvan.

La búsqueda de fetch/Axios/XMLHttpRequest en fuentes no encontró cliente de API. Se volvieron a verificar los ejemplos locales de HotelSection, RoomSection, UserSection y Dashboard; catálogo, buscador, detalle y acciones de reserva siguen siendo presentación/estado local según las fuentes y auditoría. No se probaron flujos de escritura, login ni creación de sesiones.

### Herramientas disponibles y propuesta concreta de aislamiento

Comprobaciones de lectura en contenedores existentes:

- Backend: OpenJDK Temurin **17.0.20.1**, Maven **3.9.16** (`java -version`, `mvn -version`). No hace falta instalar Java en Windows.
- Frontend: Node **22.23.4**; existen los ejecutables locales de TypeScript, ESLint y Vite. La existencia no prueba que build/lint pasen.
- Inventario de imágenes locales: las tres imágenes de desarrollo y una imagen Playwright 1.60.0 están disponibles. No se verificó compatibilidad con una futura dependencia Playwright; no existe suite E2E incorporada.
- Puertos propuestos 55432, 33000 y 55173: sin listeners TCP del host en la consulta actual. Deberán comprobarse otra vez al provisionar.

**Propuesta pendiente de aprobación; no provisionada:**

1. Proyecto independiente `hotel-reservation-system-test`, red propia interna y sin conexión a `hotel-reservation-system_default`. PostgreSQL 17 exclusivo con base `hotel_test` y credenciales efímeras diferentes, datos en tmpfs; nunca montar `hotel-reservation-system_postgres-data`. No publicar PostgreSQL por defecto; si una herramienta del host lo necesita, solo 127.0.0.1:55432. Backend/frontend usarían 127.0.0.1:33000/55173 cuando sea necesario E2E.
2. Reutilizar las imágenes instaladas en contenedores nuevos de pruebas, sin ejecutar suites en los tres existentes. Copiar fuentes a un directorio de trabajo propio del runner; no escribir target/node_modules/build ni modificar fuentes en los binds activos. La copia debe excluir `.env`, `.git`, `bin`, target y artefactos. Usar caches propias; si se aprovechan dependencias existentes, copiarlas desde montajes de solo lectura, sin alterar los volúmenes activos.
3. Configuración de pruebas explícita: datasource obligatorio `postgres-test:5432/hotel_test`, usuario de prueba, sin fallback a properties de desarrollo, perfil test y aserción previa de host/base permitidos. Sin heredar `.env` de desarrollo. Desactivar DevTools en runners. La red interna y ausencia de credenciales de desarrollo complementan esas barreras.
4. Separar descarga de dependencias del runner con acceso a la base: resolver Maven/npm en contenedores de preparación sin credenciales de desarrollo y luego ejecutar en red interna. Las herramientas están disponibles, pero acceso a repositorios y suficiencia de caches no se probaron. Pueden requerirse descargas de Flyway, Security/validación, JUnit adicionales y Playwright; explicar/verificar antes de efectuarlas.
5. Probar primero reproducción exacta del esquema legacy en PostgreSQL aislado y después migraciones/validate. Antes de Flyway, usar solo en esa base un DDL revisado que reproduzca el esquema, con `ddl-auto=validate`; no usar update para ocultar diferencias. La prueba SpringBootTest actual no debe ejecutarse con su configuración original contra desarrollo.
6. Escenarios: arranque limpio, adopción de esquema legacy, validaciones/errores, permisos USER/ADMIN/propietario, sesión/CSRF/logout, catálogo, creación/cancelación, checkout exclusivo y dos reservas concurrentes para la misma habitación. Datos sintéticos únicamente en pruebas, identificados como tales; comprobar preservación de filas/IDs en migraciones de una copia con fixtures.
7. Frontend: typecheck, lint y build en copia aislada; Playwright contra backend/frontend de pruebas, con trazas/reportes propios. No usar los puertos 3000/5173/5432 ni fixtures de desarrollo.

No se crearon nuevos contenedores, redes, tmpfs, perfiles ni archivos de pruebas. Ninguna suite, lint, typecheck o build fue ejecutada en esta sesión.

### Plan de migraciones para revisión

El esquema tiene cero filas, pero **no está vacío de objetos**. No es válido ejecutar una migración inicial CREATE TABLE sobre él ni asumir que Flyway puede adoptarlo sin revisión.

1. Preparar `V1__legacy_schema.sql` que reproduzca las seis tablas, identity, restricciones y tipos inventariados, inicialmente con `availbility`. Confirmar longitudes varchar, precisiones timestamp, secuencias/identity y demás metadatos finos mediante extracción de esquema revisada antes de fijar V1; esta inspección no es un dump completo. Comparar esquema creado por V1 con la copia legacy.
2. **Instalación nueva:** Flyway ejecutaría V1 y sucesivas en una base sin tablas. **Adopción existente:** después de copia de seguridad y ensayo de restauración aislada, verificar equivalencia con V1 y registrar baseline explícito versión 1 sobre la copia; después aplicar V2+. Nunca ejecutar V1 encima de tablas existentes. Mantener baseline-on-migrate deshabilitado. Baseline escribe metadatos y requerirá autorización antes de tocar desarrollo.
3. Preparar versiones pequeñas y revisables: normalizar `availbility`→`availability` preservando valor, incorporar campos básicos de seguridad/retención/auditoría y precio pactado, y añadir restricciones/índices necesarios según cada etapa. No introducir medios de pago guardados, calendario visual ni previsión. No usar DROP/recreación de tablas como atajo.
4. Renombrar disponibilidad requiere coordinación con el código antiguo. Ensayar en copia; no aplicar mientras el backend actual esté usando el nombre anterior. Si se exige coexistencia, diseñar primero una transición aditiva compatible; no crear automáticamente dos columnas por Hibernate update.
5. Acordar catálogo/transiciones de estados, semántica de fechas y unidad monetaria antes de CHECK/NOT NULL o conversiones timestamp→date. No truncar horas ni inventar fechas/estados/tarifas de datos legacy. Si aparecen filas entre diagnóstico y adopción, repetir agregados y abortar ante datos incompatibles; cualquier corrección requiere decisión explícita.
6. Probar desde base nueva y desde esquema legacy con fixtures, validar checksums/esquema JPA y conservación de datos. Flyway será responsable del DDL y Hibernate usará validate en la configuración futura. La validación de JPA no reemplaza comprobar CHECK, índices y reglas del dominio.
7. Antes de cualquier intervención de desarrollo: aprobación humana, respaldo/restauración verificados, nueva inspección y coordinación del proceso que hoy tiene ddl-auto=update. No se autoriza implícitamente detenerlo/reiniciarlo. Ante incompatibilidad, detener la adopción; no borrar ni reparar automáticamente historial de Flyway.

Fundamento consultado: [Spring Boot 3.3: inicialización de base](https://docs.spring.io/spring-boot/3.3/how-to/data-initialization.html) recomienda un mecanismo de generación; sus módulos Flyway deben elegirse para PostgreSQL y verificarse con el POM 3.3.2 del proyecto. [Flyway baseline](https://documentation.red-gate.com/flyway/reference/commands/baseline) registra la versión y omite migraciones anteriores; [baseline-on-migrate](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-baseline-on-migrate-setting) puede adoptar automáticamente un esquema existente y elimina una protección frente a apuntar a la base equivocada. Estas referencias justifican la propuesta; no acreditan una migración implementada/probada.

### Riesgos, siguiente incremento y autorización

Resueltos: visibilidad del Engine, inventario real de servicios/volúmenes/red, inspección de tablas/datos y disponibilidad de Java 17/Maven/dependencias frontend. No se requiere solucionar esos puntos mediante instalaciones globales.

Pendientes: entorno aislado sin provisionar; descargas/caches de nuevas dependencias sin verificar; migraciones y restauración sin ensayar; seguridad/DTOs/contratos incompletos; integración frontend pendiente; riesgos de compilación estáticos de la auditoría aún sin build; credenciales heredadas en fuentes, CORS limitado, Hibernate update, recarga de binds y ausencia de histórico. La inspección no demuestra funcionalidad de reservas ni preparación estadística.

Tras aprobación, continuar incrementalmente el plan existente:

1. Preparar aislamiento y reproducción del esquema; ejecutar comprobaciones de compilación y documentar fallos reales antes de corregirlos.
2. Etapa 2: migraciones reproducibles en pruebas, DTOs/validaciones y errores; después autenticación/sesión/CSRF y autorización, con pruebas de cada incremento.
3. Etapa 3: catálogo persistente, reservas propias/cancelación, bloqueo de habitación y validación concurrente, preservando historial básico.
4. Etapa 4: integrar API/identidad/catálogo/búsqueda/detalle/reservas/admin, conservando diseño y excluyendo HU-01/02/03.
5. Etapa 5: completar JUnit, integración PostgreSQL, TypeScript/lint/build y Playwright; solo afirmar resultados ejecutados.
6. Etapa 6: workflow CI en PR a base, reportes y documentación; commits organizados, push y PR únicamente después de validar y conforme a autorización de entrega, sin merge automático.

Requieren revisión/aprobación del punto de control: creación del entorno aislado y sus posibles descargas, plan de adopción Flyway y siguientes cambios funcionales. Cualquier baseline/migración o cambio del proceso de desarrollo requerirá además autorización concreta posterior; esta propuesta no permite hacerlo todavía. No hay autorización para acciones destructivas.

**AI Development Log de esta sesión (registrado aquí por el límite de un solo archivo):** se eligió inspección de solo lectura, se preservaron rama/commits/auditoría y se documentó aislamiento con doble ruta de migración. Las propuestas de esta sección son del agente y permanecen pendientes; no se atribuyen al desarrollador como decisiones aprobadas. No se creó otro archivo de log.

### Registro de comandos y cierre

Comandos ejecutados desde la raíz Git efectiva salvo la detección inicial:

- Git: `rev-parse --show-toplevel`, `status --porcelain=v1 --untracked-files=all`, `branch -avv`, `log -5 --oneline`, `diff --stat base...HEAD`, `diff --name-status base...HEAD`, `diff base...HEAD -- .gitignore .env.example compose.yaml`, `diff --quiet base HEAD --` sobre ambos subproyectos, `check-ignore -v`, `ls-files` para `.env` y `hash-object` de auditoría. Inventario `rg --files` y lecturas UTF-8 de documentación/fuentes; properties se filtró a JPA, puerto y logging.
- Docker: `version`, `compose ps --all`, `compose config --quiet`, `compose logs --tail 100 --no-color backend frontend postgres`; `inspect` de los tres nombres capturado internamente y reducido a estado, health, contadores, montajes, red, puertos y aserción datasource; `image ls --format` y `network ls --format` (solo se documentan imágenes relevantes).
- Herramientas: `compose exec -T backend java -version`, `compose exec -T backend mvn -version`, `compose exec -T frontend node --version` y `test -f` de TypeScript/ESLint/Vite.
- SQL por stdin: `compose exec -T postgres sh -lc 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -P pager=off'`, añadiendo `expected_db` en la consulta estructural. Variables expandidas dentro del contenedor, sin imprimir credenciales. Se ejecutaron dos bloques `BEGIN READ ONLY ... COMMIT`: identidad/versión, esquemas/tablas/columnas, `pg_constraint`/`pg_indexes`; después count por las seis tablas, nulos/rangos/cobertura, estados clasificados, self-join de solapamientos, huérfanos, duplicados y conteos agregados de `pg_stat_activity`. No se seleccionaron filas de clientes ni texto de consultas activas.
- HTTP: `Invoke-WebRequest -Method Get -TimeoutSec 10` sobre las nueve condiciones de la tabla; solo se emitieron estado, tipo/tamaño y cabeceras relevantes, sin cuerpos de datos.
- Puertos propuestos: `IPGlobalProperties.GetActiveTcpListeners()` filtrado a 55432/33000/55173; no se abrieron sockets.

Verificación de cierre: `git diff --check` sin errores; `git status`/`diff --name-only` solo muestran este diagnóstico modificado. HEAD sigue en `f89859c`, base en `2f82bdb` y el hash de la auditoría permanece igual. Git avisa de su conversión habitual LF→CRLF al tocar el archivo; no se cambió esa configuración.

Se detiene el trabajo en este punto de control. El diagnóstico dinámico está completado dentro de las limitaciones indicadas; las etapas funcionales y sus pruebas siguen pendientes de revisión.

## Entorno aislado y pruebas iniciales — 2026-10-25

### Autorización y conservación del trabajo

El desarrollador aprobó expresamente preparar el entorno aislado, descargar dependencias locales a los contenedores, compilar/verificar los proyectos, reproducir el esquema y evaluar Flyway. No autorizó cambios funcionales, migraciones/escrituras en desarrollo, alteración de sus contenedores/volúmenes, cambios en `base`, push, merge ni PR. Se respetó ese límite.

Se continuó en `chore/configuracion-inicial`, HEAD `f89859c94c540d1ba86f152c565bdb1e30ee6b0a`, conservando los commits `b6b58e0` y `f89859c` y la modificación previa de este diagnóstico. La referencia `base` y la referencia local `origin/base` siguen en `2f82bdb96836991b1051ebaa918859c9f5a3dc6c`. No se hizo fetch, commit, push, merge ni PR.

La auditoría se conserva con hash Git `75297166f4a8d198247969fe1f3441d34c371905`. No se modificaron fuentes de aplicación, POM, manifiestos/lockfile frontend, properties de desarrollo, `compose.yaml`, `.env` ni documentación histórica de auditoría. Las fuentes originales montadas en desarrollo permanecen intactas.

### Archivos y reproducción

Archivos nuevos:

- `.dockerignore`: contexto de construcción limitado a POM, fuentes Java/tests, frontend y harness; excluye configuración privada, Git, binarios y artefactos de desarrollo.
- `compose.test.yaml`: proyecto exclusivo, cuatro servicios, red interna y PostgreSQL en tmpfs, sin puertos publicados ni volúmenes persistentes.
- `tests/isolated/backend.Dockerfile`, `frontend.Dockerfile`, `flyway.Dockerfile`: imágenes de trabajo con copias de fuentes y dependencias propias; bases fijadas por digest.
- `tests/isolated/application-isolated.properties`, `empty.env`: perfil explícito, sin fallback a properties de desarrollo y sin carga del `.env` privado.
- `tests/isolated/backend-check.sh`, `frontend-check.sh`, `flyway-check.sh`: verificaciones, códigos de salida y comprobaciones previas del datasource.
- `tests/isolated/flyway-pom.xml`, `migrations/V1__legacy_schema.sql`: ensayo independiente de Flyway; no se instalan en el backend activo.
- `tests/isolated/schema/legacy.sql`, `fixtures.sql`, `prepare.sh`, `compare.sh`: DDL extraído sin datos, fixtures sintéticos, restauración y comparación.
- `tests/isolated/run.ps1`, `README.md`, `.gitattributes`: ejecución reproducible, instrucciones de inspección/retirada y scripts Linux con LF.

Único archivo rastreado modificado: este diagnóstico (incluía cambios anteriores a esta sesión). Son 19 archivos nuevos, además de los logs ignorados bajo `.local/isolated/`.

La ejecución desde la raíz usa `powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1`. La excepción de ExecutionPolicy se limita al proceso; no se cambió ninguna política global. El intento sin esa excepción fue bloqueado por Windows antes de ejecutar el script. La opción `-SkipBuild` sirve solo cuando las imágenes actuales ya fueron construidas; no debe usarse para validar cambios posteriores de fuentes/configuración.

Las imágenes se construyen con acceso a los repositorios de dependencias, sin incorporarse a la red Compose de desarrollo. Los checks posteriores se ejecutan en red interna, Maven offline y con copias independientes de las fuentes. Se descargaron 279 paquetes con `npm ci`, sin cambios al lockfile; las dependencias Maven y sus cachés están en las imágenes exclusivas de pruebas. No hubo instalaciones globales ni reutilización de cachés/volúmenes activos.

### Recursos y barreras verificadas

- Proyecto: `hotel-reservation-system-test`; red `hotel-reservation-system-test_isolated`, inspeccionada con `Internal=true`. No se une a `hotel-reservation-system_default`.
- PostgreSQL: `hotel-reservation-system-test-postgres-test-1`, versión real **17.11**; `/var/lib/postgresql/data` en **tmpfs**. Único bind: `tests/isolated` → `/checks`, **solo lectura**. Sin publicaciones de puertos y sin montar `hotel-reservation-system_postgres-data`.
- Bases propias: `hotel_test`, `hotel_legacy`, `hotel_adopt`; usuario y clave públicos exclusivos del harness temporal, distintos de la configuración de desarrollo. No hay datos reales de clientes.
- Runners: contenedores efímeros `hotel-reservation-system-test-backend-check-run-*`, `frontend-check-run-*` y `flyway-check-run-*`, retirados por `--rm`. Sin binds de fuentes de aplicación ni volúmenes de desarrollo.
- Imágenes generadas: `hotel-reservation-system-test-backend-check`, `hotel-reservation-system-test-frontend-check`, `hotel-reservation-system-test-flyway-check`. Se conservan para repetir la ejecución; BuildKit conserva sus capas/caché de construcción. No se crearon volúmenes Docker con nombre para pruebas.
- Herramientas reales: Temurin **17.0.20.1**, Maven **3.9.16**, Node **22.23.4**, npm **10.9.9**. Se conserva Spring Boot 3.3.2 y el lockfile del proyecto.
- Spring: `SPRING_PROFILES_ACTIVE=isolated`, `SPRING_CONFIG_LOCATION=classpath:/application-isolated.properties`, URL fija `jdbc:postgresql://postgres-test:5432/hotel_test`, Hibernate `validate`, SQL init deshabilitado, DevTools restart deshabilitado. El archivo original `application.properties` no forma parte de esa imagen.
- Los scripts abortan antes de ejecutar Maven si reciben una URL de desarrollo. Se ensayó explícitamente `jdbc:postgresql://postgres:5432/hotel-bd` para backend y Flyway: ambos devolvieron **1**, sin arrancar Java/Maven. Flyway solo admite las tres bases temporales y las acciones `info`, `migrate`, `validate`, `baseline`.
- El runner PowerShell fija proyecto, archivo Compose y archivo env; verifica red, ausencia de puertos, tipo de montajes y tmpfs. Se niega a comenzar sobre contenedores de pruebas ya existentes, para evitar sobrescribir un ensayo previo.

Se recreó exclusivamente el proyecto temporal para comprobar ejecuciones desde cero. Antes de cada `down` se identificaron el nombre, etiqueta de proyecto, bind de solo lectura y tmpfs del único PostgreSQL temporal. No se usó `down -v`, prune ni limpieza global. La última instancia se deja activa para revisión, con las tres bases temporales; detenerla/recrearla destruye sus datos efímeros.

### Resultados reales

Log de construcción final: `.local/isolated/images-final.log` (exit 0, tres imágenes construidas). Primera ejecución completa: `.local/isolated/20261025-132001/`. Ejecución final desde cero: `.local/isolated/20261025-132421/`; sus archivos `*.log` y `results.txt` contienen las salidas y códigos. Los logs no se versionan; este diagnóstico conserva los resultados resumidos.

| Verificación | Resultado ejecutado |
|---|---|
| Compose de pruebas, validación y aserciones de aislamiento | Exit 0; configuración válida, red interna, sin puertos ni volúmenes de desarrollo |
| Preparación PostgreSQL y restauración legacy | Exit 0; dos copias del DDL, seis tablas cada una; fixtures solo en `hotel_adopt` |
| Flyway V1 desde cero en `hotel_test` | Exit 0; historial SQL versión 1 |
| Repetición de migrate en `hotel_test` | Exit 0; ninguna migración adicional |
| Migrate en `hotel_adopt` antes de baseline | Exit 1 **esperado**: esquema no vacío sin historial; se comprobó el mensaje específico |
| Baseline explícito 1 y migrate en `hotel_adopt` | Exit 0; historial BASELINE 1; V1 no se volvió a ejecutar |
| Flyway validate en `hotel_test` y `hotel_adopt` | Exit 0 en ambas rutas |
| Comparación DDL/fixtures | Exit 0, `SCHEMA_EQUAL_AND_FIXTURES_PRESERVED`; comparación del dump original, copia legacy, V1 y copia adoptada |
| Rechazo de URL de desarrollo, backend/Flyway | Exit 1 esperado, previo a Maven |
| Backend | `mvn -o -B -ntp clean verify` exit 0: recompilación de 36 fuentes principales y una prueba, empaquetado correcto; contexto con PostgreSQL y Hibernate validate: **1 test, 0 failures, 0 errors, 0 skipped** |
| Frontend TypeScript (`tsc -b`) | Exit **2**, **19 errores**: 17 imports React sin uso, inferencia `never[]` y ruta `SideBar` |
| Frontend lint (`npm run lint`) | Exit **0** |
| Frontend build (`npm run build`) | Exit **2** por los mismos errores TypeScript; Vite no llegó a ejecutar su bundle |

El runner completo devuelve **1** porque frontend falla; no presenta el conjunto como satisfactorio. No se ejecutaron E2E, pruebas funcionales de reservas, autenticación ni concurrencia. La prueba Java existente solo carga el contexto; no demuestra comportamiento de negocio.

### Fidelidad del esquema y evaluación Flyway

Se extrajo `pg_dump --schema-only --schema=public --no-owner --no-privileges` del PostgreSQL de desarrollo mediante una sesión con `PGOPTIONS=-c default_transaction_read_only=on`. No se exportaron datos, contraseñas, propietarios ni grants. Fue la única nueva lectura de estructura necesaria; no se ejecutó DDL/DML en desarrollo.

El dump confirma los detalles antes pendientes: varchar(255), timestamp(6) sin zona y seis identity **GENERATED BY DEFAULT**, inicio/incremento/cache 1. Se preservan `availbility`, nombres de restricciones, tipos, nullability y relaciones. V1 se obtiene eliminando los metacomandos psql `restrict/unrestrict` y usando `CREATE SCHEMA IF NOT EXISTS public`; el resto del DDL de aplicación se conserva.

La comparación ejecuta pg_dump sobre las tres bases temporales, excluye únicamente `flyway_schema_history` y normaliza comentarios, líneas vacías y tokens aleatorios restrict/unrestrict. Se compara además el dump original exportado con la copia restaurada. Resultado: **sin diferencias en el DDL normalizado**. Las seis tablas conservan **34 columnas, 14 restricciones, ocho índices únicos y seis secuencias identity**. No se afirma igualdad de propietarios, grants, datos reales, configuración del servidor ni roles, que deliberadamente no forman parte del ensayo.

`hotel_test` contiene las seis tablas vacías y el historial de V1; `hotel_legacy`, las seis tablas de referencia vacías sin historial; `hotel_adopt`, una fila sintética por tabla y baseline explícito 1. La comparación de `pg_dump --data-only`, incluidas las posiciones de secuencias, confirma que baseline/migrate no alteraron filas, valores, IDs ni secuencias de los fixtures. No se utilizó DROP/recreación para adoptar el esquema.

Se ensayaron **Flyway 10.10.0**, `flyway-database-postgresql` 10.10.0 y JDBC PostgreSQL 42.7.3, con `baselineOnMigrate=false` y `cleanDisabled=true`. **Las operaciones probadas funcionan en PostgreSQL 17.11**, pero Flyway advierte expresamente que su soporte probado llega a PostgreSQL 16. Esto impide afirmar soporte pleno de esa combinación. Se recomienda seleccionar una versión con soporte declarado de PostgreSQL 17 y repetir el harness antes de integrar Flyway con Spring Boot. El POM original permanece intacto; no se ha probado todavía esa integración automática.

La estrategia de V1 fiel para instalaciones nuevas y baseline **explícito, solo después de verificar equivalencia**, para adopción queda demostrada en pruebas. Baseline no compara el esquema por sí mismo; por ello la comparación DDL externa sigue siendo requisito. No hay V2 ni ensayo de renombrar disponibilidad, nuevas restricciones o cambios de dominio; no se declara validada ninguna migración futura.

Referencias contrastadas: [inicialización de base en Spring Boot](https://docs.spring.io/spring-boot/how-to/data-initialization.html), [módulo PostgreSQL de Flyway](https://github.com/flyway/flyway/blob/main/documentation/Reference/Database%20Driver%20Reference/PostgreSQL%20Database.md), [baseline explícito](https://documentation.red-gate.com/flyway/reference/commands/baseline) y [baseline-on-migrate](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-baseline-on-migrate-setting). Las referencias actuales no sustituyen las pruebas de la versión concreta del proyecto.

### Fallos detectados, correcciones y límites

1. **Frontend:** eliminar imports React que no se utilizan como valor, tipar sugerencias como `useState<string[]>([])` y corregir el import de `AdminPanel.tsx:7` a `../components/Sidebar` respetando el nombre real. Son recomendaciones; las fuentes no se corrigieron en esta etapa. No desactivar las comprobaciones TypeScript para ocultar errores. Repetir lint/typecheck/build tras el cambio.
2. **Dependencias offline:** `dependency:go-offline` terminó con éxito pero no incluyó todas las dependencias efectivas del backend ni las dependencias añadidas al plugin Flyway. Los primeros intentos offline fallaron antes de compilar/migrar. Se corrigió el harness completando package con tests omitidos durante preparación, descargando el provider Surefire/launcher y los artefactos Flyway PostgreSQL/JDBC explícitos. Esa preparación no se contabiliza como ejecución de tests; los tests se ejecutaron después contra la base aislada.
3. **Compatibilidad Flyway/PostgreSQL 17:** advertencia real de versión fuera del soporte probado; resolver antes de elegir la configuración de aplicación. V1 reproduce el esquema, pero eso no valida V2+ ni la adopción de desarrollo.
4. **Herramientas:** acceso al pipe Docker rechazado dentro del sandbox y resuelto mediante ejecuciones autorizadas fuera de él. Dos intentos iniciales de pg_dump por shell no produjeron un dump utilizable (comillas/CRLF; uno informó opción con CR); se sustituyeron por argumentos directos y se exigió exit 0 antes de guardar DDL. También se corrigió el entrypoint Flyway inicial, que interpretaba el nombre de base como ejecutable. No se atribuyen esos fallos a la aplicación.
5. **Cobertura y operación:** la prueba Java existente es mínima. No hay backend/frontend E2E publicados ni implementación funcional nueva. No se hizo respaldo/restauración de datos de desarrollo: este ensayo reproduce estructura y fixtures, no sustituye un respaldo completo previo a una futura adopción.

### Cierre y punto de revisión

Hay una infraestructura segura y reproducible para continuar la estabilización **dentro de pruebas**. Aún no hay una línea base de validaciones completamente verde: frontend no compila y la versión Flyway ensayada avisa de soporte PostgreSQL 17 no probado. Primero corresponde revisar esta entrega, corregir esos puntos y verificar la integración Flyway/Boot; no se inicia todavía autenticación, CRUD, reservas ni HU-01/02/03.

El estado de desarrollo se contrastó con el inventario inicial: mismas identidades de los tres contenedores, mismas fechas de arranque (PostgreSQL/frontend `2026-10-24T23:28:44Z`, backend `23:28:53Z`) y cero reinicios. No se ejecutaron órdenes de parada/reinicio/recreación contra ellos ni comandos de limpieza sobre sus volúmenes. La auditoría conserva su hash y Git no muestra cambios en los dos subproyectos ni Compose de desarrollo.

AI Development Log: se preparó un harness separado, se documentaron los fallos reales sin corregir silenciosamente la aplicación, se probaron creación/adopción de V1 y preservación de fixtures y se dejaron los recursos temporales identificados para revisión. Los cambios siguen sin commit, push, merge ni PR; el trabajo se detiene antes de las etapas funcionales.

Verificación final ejecutada: `git diff --check` sin errores; comprobación de espacios finales sobre los 19 archivos nuevos sin incidencias; `.local/isolated/.../results.txt` ignorado por Git. Solo este diagnóstico figura modificado entre los archivos rastreados. Inspección Docker final: los tres contenedores de desarrollo conservan IDs, red, arranque y cero reinicios; únicamente queda PostgreSQL de pruebas healthy en la red interna, sin puertos ni volúmenes con nombre del proyecto de pruebas. Las referencias HEAD/base y el hash de la auditoría coinciden con el inicio de esta sesión.
