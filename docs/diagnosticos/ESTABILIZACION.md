# Diagnóstico posterior a la auditoría

Fecha: 2026-10-25. Rama de trabajo: `chore/configuracion-inicial`.

Este documento registra evidencia nueva. No modifica ni sustituye `docs/auditorias/AUDITORIA_INICIAL.md`.

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

Referencias técnicas consultadas para las decisiones del plan (no implican implementación): [persistencia de autenticación Spring Security](https://docs.spring.io/spring-security/reference/7.0/servlet/authentication/session-management.html) y [baseline-on-migrate de Flyway](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-baseline-on-migrate-setting). La documentación de Security enlazada es de una versión posterior a la del proyecto; cualquier implementación deberá usar la API compatible con Spring Boot 3.3.2 y probarla.
