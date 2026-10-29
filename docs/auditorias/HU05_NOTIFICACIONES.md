# Auditoría enfocada HU-05 — 27/10/2026

Diagnóstico exclusivamente de lectura completado antes de modificar código.
Rama `feat/hu-05-notificaciones-reservas`, limpia, HEAD y base local
`9bd8d2e9b590734a80869684fa0debc6af285f26` (merge PR #7). No se encontraron
instrucciones AGENTS.md en el repositorio ni sus directorios ascendientes.

## Componentes y datos comprobados

- ReservationServiceImp tiene transacciones, bloqueo de habitación al confirmar
  y bloqueo de reserva al cancelar. Cancelación repetida devuelve el estado
  existente sin volver a cambiarlo. Solo CONFIRMED y CANCELLED son estados vigentes.
- Reserva: user_id, room_id, start_date/end_date y marcas locales sin zona,
  nightly_price/total_price pactados. Las fechas de estancia se interpretan como
  días de Panamá. User es propietario; no hay acceso administrativo a avisos ajenos.
- SecurityConfig usa sesión HttpOnly, CSRF y autenticación en `/api/**`.
  API existente con DTOs, errores coherentes y paginación PageView reutilizable.
- React: Header, Guard, AuthProvider y cliente api con credenciales/CSRF. Navegación
  naranja existente; MyReservations permite enlazar a una reserva propia consultando
  el endpoint ya protegido, sin duplicar el flujo de reservas.
- PostgreSQL real de desarrollo: hotel-bd, 17.11; V1, V2, V3 satisfactorias;
  13 hoteles, 72 habitaciones, 937 reservas (855 CONFIRMED, 82 CANCELLED),
  936 etiquetadas por HU-03. No existe tabla de notificaciones.
- Docker: desarrollo backend3000/frontend5173/PostgreSQL5432 activos; PostgreSQL
  aislado sin puerto publicado y frontend aislado55173. Ningún recurso modificado
  durante auditoría. Última migración V3: V4 libre.
- Harness Maven/JUnit/PostgreSQL, Flyway, frontend y ocho Playwright existentes;
  CI de PR hacia base ejecuta el mismo harness y conserva artifacts.

## Diseño previo a implementación

V4 aditiva: tabla reservation_notifications, destinatario y reserva con FK,
tipo CONFIRMED/CANCELLED/CHECK_IN_REMINDER, mensaje y snapshot de hotel/fechas,
created_at/read_at con zona. Leído se deriva de read_at. UNIQUE(reservation_id,type)
respalda idempotencia y concurrencia; índice de destinatario/orden y no leídas.
Sin modificar V1–V3 ni crear notificaciones durante migraciones.

NotificationService participa en la misma transacción de confirmación/cancelación:
si falla cualquier escritura, se revierte toda la operación. INSERT SELECT obtiene
siempre el propietario real, excluye reservas etiquetadas sintéticas y usa ON CONFLICT
DO NOTHING. No se captura silenciosamente un fallo de persistencia.

ReminderService usa Clock existente con America/Panama: mañana calendario. Bloquea
la reserva, vuelve a comprobar estado/fecha, y genera a lo sumo un recordatorio.
Solo son elegibles reservas con aviso HU-05 de confirmación ya persistido; las
reservas anteriores, incluidas futuras y sintéticas, NO reciben recordatorios.
No hay backfill ni cambios de estados. Programador configurable, por defecto
09:00 Panamá, y recuperación del día al iniciar; no recupera fechas vencidas.

Endpoints propios autenticados: GET /api/notifications?page=&size=,
GET /api/notifications/unread-count, POST /api/notifications/{id}/read y
POST /api/notifications/read-all. No se acepta userId del cliente; ADMIN tampoco
elude propiedad. Escrituras requieren CSRF. Página /notifications, contador,
lectura individual/todas, paginación y enlace al detalle propio de reserva.

## Riesgos y pruebas previstas

Rollback, cancelación simultánea con recordatorio, dos ejecutores, reloj de Panamá
en límites UTC, canceladas/legacy inválidas/sintéticas, historial sin backfill,
lectura idempotente y privada, ADMIN ajeno, CSRF, sesión expirada y persistencia.
Probar V4 limpia/adoptada y regresión de HU-03/reservas. Cron apagado en pruebas
deterministas; servicio invocado con Clock fijo. Chromium escritorio/móvil,
vacío/errores/paginación, capturas sin datos personales.

No aplicar V4 ni ejecutar el nuevo backend contra desarrollo sin respaldo y
autorización específica. Validaciones funcionales en PostgreSQL aislado. Revisión
humana y merge quedan al equipo. No se modifican HU-01/02/03/04 ni pagos.
