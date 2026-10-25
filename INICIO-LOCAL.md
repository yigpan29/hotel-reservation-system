# Inicio local con Docker Desktop

Ejecutar desde la raíz Git interior, donde se encuentra `compose.yaml`.

## Estado de esta entrega

La configuración conserva servicios/volúmenes de desarrollo y externaliza credenciales. La aplicación sigue siendo el prototipo descrito en la auditoría: frontend con ejemplos, API CRUD de hoteles y funcionalidades base pendientes. No están implementadas HU-01, HU-02 ni HU-03. No hay CI/Playwright funcional incorporado todavía.

- [Plan de estabilización](docs/planes/PLAN_ESTABILIZACION.md).
- [Evidencia nueva y diagnóstico manual](docs/diagnosticos/ESTABILIZACION.md).
- [Auditoría histórica](docs/auditorias/AUDITORIA_INICIAL.md).

## Variables de entorno

Para una instalación nueva, copiar el ejemplo **solo si no existe .env**:

```powershell
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
```

Editar `.env` con una clave local y valores propios antes de iniciar. No compartir ni versionar ese archivo. `.env.example` solo contiene valores ilustrativos. No sobrescribir un `.env` existente.

| Variable | Propósito |
|---|---|
| POSTGRES_DB | Nombre de base local |
| POSTGRES_USER | Usuario de base |
| POSTGRES_PASSWORD | Clave local, nunca versionada |
| POSTGRES_PORT | Puerto host PostgreSQL, predeterminado 5432 |
| BACKEND_PORT | Puerto host API, predeterminado 3000 |
| FRONTEND_PORT | Puerto host Vite, predeterminado 5173 |

**Volumen existente:** usar sus valores vigentes de base, usuario y clave. Cambiar POSTGRES_PASSWORD en `.env` no cambia la contraseña dentro de PostgreSQL inicializado. No eliminar el volumen para resolver discrepancias. En la preparación de esta rama se conservaron los valores locales preexistentes en un `.env` privado, sin imprimirlos.

Si se cambia el puerto host del frontend, el CORS actual sigue permitiendo solo `http://localhost:5173`. Esa limitación queda pendiente de estabilización.

## Entorno ya levantado

Editar Compose no aplica cambios a contenedores existentes. No ejecutar `up`, `restart`, `down` ni reiniciar Docker Desktop para diagnosticar el rechazo de acceso de Codex. Consultar primero:

```powershell
docker context show
docker compose config --quiet
docker compose ps --all
docker compose logs --tail 80 --no-color backend frontend postgres
```

`config --quiet` valida sin imprimir valores interpolados. Evitar publicar `docker compose config` completo, `.env` o variables de contenedores. El diagnóstico posterior contiene consultas de lectura de esquema y recuentos. No asumir que la base está vacía.

## Inicio de una instalación nueva

Solo para una instalación nueva, con Docker Desktop disponible y `.env` revisado:

```powershell
docker compose config --quiet
docker compose up -d
docker compose logs -f backend frontend
```

Este `up` instala dependencias y arranca servicios; **no usarlo para recrear el entorno existente sin revisión/autorización**. Esperar al mensaje de arranque Spring y al puerto Vite. No fue ejecutado durante la preparación de esta rama.

Con puertos predeterminados:

- Aplicación: http://localhost:5173
- API hoteles: http://localhost:3000/api/hotel/get-all
- PostgreSQL: puerto local 5432; credenciales exclusivamente en `.env`.

Las publicaciones están limitadas a 127.0.0.1. La colección de hoteles vacía responde 204; no es un error de conexión.

## Persistencia y migraciones

Se conserva el proyecto `hotel-reservation-system` y el volumen lógico `postgres-data` en `/var/lib/postgresql/data`. Los demás volúmenes son cachés/dependencias y no se versionan.

**Todavía no hay migraciones Flyway.** El backend original mantiene Hibernate `ddl-auto=update`; iniciar/reiniciar el contexto puede modificar el esquema. Se requiere inspección previa y pruebas sobre una copia aislada antes de ejecutar un backend modificado. No ejecutar migraciones, seeders o tests contra la base de desarrollo.

Las fuentes principales del backend y sus copias históricas `bin/` aún contienen valores heredados del repositorio original. Esta etapa no las altera para evitar recarga de fuentes montadas sin entorno aislado. Compose suministra variables externas para futuros arranques. Retirar los valores de las fuentes vigentes y tratar copias históricas es trabajo pendiente; este cambio no sanea el historial Git.

## Pruebas y CI pendientes

`npm run build` y `npm run lint` son scripts originales no validados aquí. No hay suite E2E o workflow de CI terminado. No ejecutar Maven test sobre la configuración original: carga Spring y podría conectar a la base local con actualización de esquema.

Se necesita Java 17/Maven y PostgreSQL aislado, o Docker accesible, además de acceso a los registros npm/Maven. El plan especifica escenarios, exclusiones y aceptación. Los resultados futuros deben registrarse por separado de la auditoría inicial.

No eliminar volúmenes ni ejecutar `docker compose down -v`. No hay seeder en esta entrega. Cualquier carga de prueba futura debe usar un entorno aislado identificado explícitamente.
