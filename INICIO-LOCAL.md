# HOTEL MN — inicio, demostración y pruebas

Aplicación React 18/TypeScript/Vite/Tailwind y Spring Boot 3.3.2/Java 17,
PostgreSQL 17 y Flyway 10.20.1. Permite registro, sesión, búsqueda, disponibilidad,
reserva/cancelación y gestión administrativa. No procesa pagos ni implementa
HU-01, HU-02 o HU-03.

## Demostración aislada (opción recomendada para la presentación)

Requisito: Docker Engine/Compose y red para descargar imágenes/dependencias.
No requiere instalar Java, Maven, Node ni navegadores globales.
Desde la raíz Git interior:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1
```

El comando construye copias de fuentes, inicia PostgreSQL temporal, verifica
V1/V2 y baseline, ejecuta JUnit, TypeScript/lint/build, inicia una demostración
vacía con datos sintéticos y ejecuta Playwright. Ante un fallo devuelve código
distinto de cero. Deja la aplicación de demostración disponible para revisión:

- Frontend: http://127.0.0.1:55173
- API (proxy del mismo origen): http://127.0.0.1:55173/api/health
- PostgreSQL: solo dentro de la red interna, sin puerto del host.
- ADMIN **solo de pruebas**: `demo-admin` / `Synthetic-admin-123`.
- USER **solo de pruebas**: `demo-user` / `Synthetic-user-123`.

Estas credenciales están únicamente en `compose.test.yaml` y pruebas; no se usan
como defaults de producción. La carga inicial crea tres hoteles y dos habitaciones
por hotel; las pruebas E2E añaden su inventario sintético identificado.
Registrar una cuenta nueva también permite completar el flujo de cliente.
Los datos son efímeros: no utilizar este entorno para guardar información real.

Si ya existen recursos de pruebas, el runner se detiene para no sobrescribirlos.
Para una repetición limpia, el siguiente comando **identifica y verifica** antes
de retirar exclusivamente contenedores/red del proyecto temporal. Destruye su
tmpfs, no toca archivos/volúmenes de desarrollo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/reset.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1
```

`-SkipBuild` reutiliza imágenes ya reconstruidas; no usarlo después de modificar
fuentes. `-SkipE2E` limita la ejecución a DB/JUnit/frontend, sin arrancar la demo.
En Linux con PowerShell: `pwsh -File tests/isolated/run.ps1`.

Reportes y logs: `.local/isolated/<fecha>/`. Reportes JUnit:
`.local/isolated-artifacts/backend/surefire-reports/`. Reporte HTML, capturas y
trazas de errores: `.local/isolated-artifacts/e2e/`. No se versionan artefactos.

## Instalación nueva de desarrollo

Esta sección es solo para una instalación **nueva**, sin el proyecto Compose ya
activo ni un volumen existente con el mismo nombre. No ejecutar estos pasos
para actualizar la base de desarrollo actual sin revisar su adopción.

1. Copiar `.env.example` a `.env` **solo si no existe**.
2. Definir usuario/clave privados de PostgreSQL y una base nueva.
3. Para esa base vacía, establecer `HOTEL_MIGRATIONS_ENABLED=true`.
4. Ejecutar:

```powershell
docker compose config --quiet
docker compose up -d
docker compose logs -f backend frontend
```

Frontend http://localhost:5173, API puerto 3000, PostgreSQL puerto 5432,
publicados únicamente en loopback. El proxy frontend `/api` usa `backend:3000`
dentro de Compose; sesiones y CSRF funcionan en el mismo origen del navegador.
Las versiones Java/Maven/Node son las imágenes existentes del proyecto.
Para ejecutar Vite fuera de Docker, `API_PROXY_TARGET` debe apuntar al backend
local (por defecto `http://127.0.0.1:3000`).

**Base existente:** se conserva `HOTEL_MIGRATIONS_ENABLED=false` por defecto,
Hibernate usa `validate`, y `baseline-on-migrate=false` siempre. La aplicación
nueva fallará si el esquema no corresponde; no lo adapta por Hibernate update.
Cambiar credenciales en `.env` no cambia las de un volumen ya inicializado.
No borrar el volumen para resolver discrepancias. No se ha desplegado esta
versión ni se han ejecutado migraciones en los tres contenedores actuales.

## Administrador de una instalación normal

No existe endpoint público para crear o promover administradores. El registro
siempre crea USER. En una instalación nueva ya migrada y autorizada, suministrar
mediante un gestor de secretos, variables de proceso o un archivo privado `.env.admin`:

```text
SPRING_PROFILES_ACTIVE=provision-admin
HOTEL_ADMIN_CONFIRM=CREATE_ADMIN
HOTEL_ADMIN_USERNAME=nombre_privado
HOTEL_ADMIN_EMAIL=correo_privado
HOTEL_ADMIN_PASSWORD=clave_privada_de_8_a_72_bytes
```

Iniciar el backend con esas variables; por ejemplo, un runner explícito de Compose
hereda los valores privados del proceso (no poner contraseñas en la línea de comandos):

```powershell
docker compose run --rm -e SPRING_PROFILES_ACTIVE=provision-admin -e HOTEL_ADMIN_CONFIRM -e HOTEL_ADMIN_USERNAME -e HOTEL_ADMIN_EMAIL -e HOTEL_ADMIN_PASSWORD backend
```

La cuenta se crea con BCrypt y ADMIN en una transacción. Si usuario/email ya
existen, el proceso falla: no promueve ni sobrescribe usuarios. El servidor queda
iniciado; detener ese runner tras aprovisionar y arrancar normalmente sin el perfil
`provision-admin`. No repetirlo con la misma cuenta. Este procedimiento escribe
en la base configurada: **no usarlo contra la base actual sin autorización específica**.
La demostración aislada ya aprovisiona su propio ADMIN de pruebas y no necesita
este comando.

Para una demo propia, el perfil `demo` exige `HOTEL_DEMO_CONFIRM=CREATE_SYNTHETIC_DATA`,
base `hotel_demo` o `hotel_test` sin usuarios/hoteles y seis variables privadas:
`HOTEL_DEMO_ADMIN_USERNAME`, `_EMAIL`, `_PASSWORD` y `HOTEL_DEMO_USER_USERNAME`,
`_EMAIL`, `_PASSWORD`. No se ejecuta por defecto ni sobre producción. Deshabilitar
el perfil después de la primera carga; no sobrescribe una base con datos.

## Adopción de una base legacy

La implementación no autoriza intervenir sobre desarrollo. Antes de una futura
adopción: respaldo completo, restauración verificada en una copia aislada, comparar
el DDL con V1 y revisar duplicados, estados, fechas, credenciales y valores nulos.
Flyway debe registrar **baseline explícito versión 1** solo tras esa revisión;
nunca ejecutar V1 sobre tablas existentes ni habilitar baseline automático.
Después aplicar V2, con el backend antiguo fuera de servicio de forma coordinada:
el renombrado de disponibilidad no es compatible con su mapeo antiguo en ejecución.
No truncar horas ni inventar precios/estados de reservas antiguas.

V2 conserva las filas legacy y añade CHECK `NOT VALID` en fechas/estado/precios
para no reescribir datos antiguos; nuevas escrituras quedan protegidas. No se
debe declarar saneado un histórico únicamente por ejecutar Flyway. Los índices
únicos abortan la migración si hay duplicados; no se corrigen automáticamente.

## Prueba manual breve

1. Abrir la demo y registrar usuario; cerrar sesión y volver a entrar.
2. Buscar `Hotel Demo 1`, consultar fechas futuras y elegir una habitación.
3. Revisar tarifa/total y confirmar; ver el identificador en Mis reservas.
4. Cancelar y recargar: la fila continúa CANCELLED con fecha de cancelación.
5. USER no puede entrar en Administración.
6. Entrar como ADMIN de pruebas, crear/editar hotel y habitación y verlos en catálogo.
7. Desactivar inventario; no admite nuevas reservas y mantiene las anteriores.

Contratos y reglas: [docs/API.md](docs/API.md).
Resultados ejecutados y decisiones: [AI Development Log](docs/AI_DEVELOPMENT_LOG.md)
y [diagnóstico](docs/diagnosticos/ESTABILIZACION.md).

## CI

`.github/workflows/ci.yml` se ejecuta en PR a `base` y manualmente.
Un job valida frontend con Node 22; otro ejecuta el mismo harness Docker en Ubuntu
para PostgreSQL, migraciones, JUnit y Chromium/Playwright. No usa Docker Desktop,
`.env` del desarrollador ni secretos de despliegue. Los errores propagan su código;
JUnit, logs y trazas se suben como artifacts aunque fallen las pruebas.
No hay despliegue a producción ni merge automático.
