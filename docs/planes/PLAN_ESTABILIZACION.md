# Plan de estabilización

Fecha: 2026-10-25. Rama: `chore/configuracion-inicial`, creada desde `base` en `2f82bdb96836991b1051ebaa918859c9f5a3dc6c`. `base` coincide con origin/base y origin/HEAD apunta a origin/base. No se modifica la auditoría histórica.

## Diagnóstico de partida

Auditoría inicial leída completamente. Solo hoteles tiene CRUD; las demás capacidades son modelos/stubs. No hay sesión, autorización, reservas transaccionales o integración frontend. Java del host: 8; requiere 17. Docker Desktop responde a otros procesos, pero este entorno recibe acceso denegado al Engine; WSL también rechaza acceso. No se elevarán permisos ni reiniciarán servicios.

Pendientes de incorporar preexistentes: compose.yaml, INICIO-LOCAL.md y docs/auditorias/AUDITORIA_INICIAL.md. No hay modificaciones rastreadas iniciales. La configuración de desarrollo contiene credenciales incrustadas que deben sustituirse antes de versionar. Los archivos .env reales no se versionan. Los binarios ya versionados se preservan, sin agregar otros.

## Etapas y aceptación

| Etapa | Trabajo | Criterio de aceptación |
|---|---|---|
| 1. Preparación | Rama, documentación histórica, variables externas, ignore, diagnóstico PostgreSQL de lectura | Archivos locales conservados; sin secretos nuevos; esquema/datos conocidos o limitación explícita; ningún servicio reiniciado |
| 2. Persistencia y seguridad | Flyway, DTOs validados, errores consistentes, roles y sesión | Migración reproducible en PostgreSQL aislado; contraseñas con BCrypt; escrituras administrativas protegidas; logout invalida sesión; CSRF activo |
| 3. Dominio | Hoteles/habitaciones y reservas propias/cancelación | IDs reales, intervalos entrada inclusiva/salida exclusiva; fechas válidas; dos peticiones concurrentes a la misma habitación no reservan intervalos solapados; historial retenido |
| 4. Frontend | Integrar API y auth, catálogo/búsqueda/detalle/reservas/admin | Sin datos fijos representando negocio en rutas activas; errores visibles; TypeScript, lint y build satisfactorios; diseño naranja/tarjetas y navegación general conservados |
| 5. Pruebas | JUnit unitario/integración PostgreSQL aislado y Playwright | Cobertura de los escenarios pedidos, pruebas deterministas e independientes, sin usar datos de desarrollo; reportes y trazas ante errores |
| 6. CI y entrega | Jobs separados en PR a base/manual, documentación, revisión/commits/push/PR | Fallos obligatorios propagan error; artifacts; historial organizado; PR sin merge solo después de validación |

Se registra el resultado de cada etapa por separado en `docs/diagnosticos/ESTABILIZACION.md`. No se considera que una etapa está validada solo por existir código. Cada commit debe corresponder a una responsabilidad y evitar artefactos/cachés/credenciales.

## Decisiones iniciales

- Conservar React/Vite, Spring MVC, servicios/repositorios JPA y PostgreSQL. No introducir otros frameworks de aplicación.
- Autenticación de navegador mediante sesión HttpOnly, BCrypt, CSRF y proxy de mismo origen en desarrollo. El alcance exige autenticación/logout, no JWT específicamente; una sesión revocable evita añadir gestión manual de revocación JWT. Documentar expiración y reinicio de sesiones.
- Roles USER/ADMIN. El registro público nunca permite seleccionar ADMIN. Aprovisionamiento administrativo explícito mediante variables, sin credenciales fijas ni promover usuarios existentes automáticamente.
- Fechas de estancia de calendario con salida exclusiva. Conservar columnas existentes, y registrar fechas de creación/cancelación/actualización y precio pactado para nuevas reservas, sin inventar fechas de registros históricos.
- Bloqueo pesimista de la fila habitación dentro de una transacción para serializar creación/edición relevante y evitar carreras. No basta una consulta previa de disponibilidad.
- Flyway con validación Hibernate, sin actualización automática de esquema. No aplicar migraciones a la base local hasta inspeccionar estructura/datos y revisar compatibilidad. No activar baseline automático en una base desconocida.
- No borrar físicamente reservas ni cascadas que destruyan histórico. Preferir desactivar inventario y conservar relaciones.
- Pruebas usan base/instancia explícitamente aislada; no se conectan por defecto a la configuración de desarrollo. Sin seeder automático en desarrollo.

## Dependencias y riesgos

1. Acceso Docker restringido: no prueba avería. Documentar comandos manuales; investigar conexión de lectura PostgreSQL por puerto publicado si hay cliente disponible.
2. Java 17/Maven y dependencias no disponibles en el host. Usar herramientas locales al proyecto si pueden descargarse sin permisos especiales; no cambiar Java global ni instalar servicios.
3. Cambios de fuentes montadas podrían ser detectados por Vite/DevTools existentes. No reiniciar ni desplegar automáticamente sobre los servicios de desarrollo; pruebas en otros puertos y con configuración aislada. Desactivar la actualización implícita del esquema para futuros arranques.
4. El esquema puede tener datos legacy nulos/estados desconocidos. No normalizarlos sin evidencia; documentar y probar migración de copia aislada. Una modificación incompatible debe detener la aplicación, no borrar datos.
5. La configuración Compose existente contiene valores de desarrollo. Externalizarlos no cambia la contraseña de un volumen inicializado; documentar este comportamiento y conservar nombres de volúmenes.
6. Cambiar autenticación/contratos exige coordinar cliente y pruebas; definir errores y permisos antes de conectar formularios.
7. No se publicará el PR como validado si falta ejecución por restricciones del entorno. El push depende del acceso Git remoto y no implica merge.

## Exclusiones obligatorias

HU-01: sin perfiles de reserva reutilizables, medios de pago guardados o checkout acelerado. HU-02: sin calendario visual dinámico ni navegación avanzada de ocupación. HU-03: sin pronóstico, algoritmos predictivos, gráficos o recomendaciones de demanda. Sin pagos reales o datos de tarjetas. Conservar información básica de reservas prepara el modelo, sin implementar esas historias.
