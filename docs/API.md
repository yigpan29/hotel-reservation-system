# Contrato HTTP de HOTEL MN

Base `/api`, JSON. La SPA usa el proxy del mismo origen de Vite. Las respuestas
nunca exponen entidades JPA ni hashes de contraseñas.

## Sesión y CSRF

| Método y ruta | Acceso | Entrada / resultado |
|---|---|---|
| GET `/auth/csrf` | Público | `{token, headerName}` y sesión anónima |
| POST `/auth/register` | Público + CSRF | `{username,email,password}` → 201 `{id,username,email,role}` |
| POST `/auth/login` | Público + CSRF | `{username,password}` → usuario y cookie de sesión |
| POST `/auth/logout` | Sesión/CSRF | 204, invalida sesión y elimina cookie |
| GET `/auth/me` | Autenticado | Usuario actual, sin contraseña |
| GET `/health` | Público | 200 `{status:"UP"}` después del arranque y los runners; 503 durante inicio |

Antes de **cada** operación de escritura, obtener `/auth/csrf` con
`credentials: include` y enviar el token en el nombre de cabecera devuelto.
El token es el valor enmascarado de Spring Security. Login renueva el ID de
sesión y descarta el token anterior; logout invalida sesión/contexto/token.
La cookie JSESSIONID es HttpOnly y SameSite=Lax; Secure se activa en `prod`
o con `SESSION_COOKIE_SECURE=true` sobre HTTPS. Expiración por inactividad: 30 min.
No se almacena identidad/token en localStorage. No hay JWT ni login por URL.

Registro: username de 3–40 caracteres `[a-zA-Z0-9._-]`, email válido de hasta
255, contraseña de 8–72 caracteres y como máximo 72 bytes UTF-8. Se normalizan
username/email a minúsculas; índices únicos sin distinción de mayúsculas.
El registro asigna siempre USER, aunque se envíe `role: ADMIN`.

## Catálogo público

| Método y ruta | Resultado |
|---|---|
| GET `/hotels?q=texto` | Array de hoteles activos; busca nombre o ubicación |
| GET `/hotels/{id}` | Hotel activo o 404 |
| GET `/hotels/{id}/rooms` | Habitaciones activas del hotel |
| GET `/hotels/{id}/rooms?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | Habitaciones con `available` y `totalPrice` calculados |
| GET `/rooms/availability?hotelId=...&startDate=...&endDate=...` | Solo habitaciones disponibles |

Hotel: `{id,name,location,description,rating,active}`. Habitación:
`{id,hotelId,hotelName,roomNumber,type,pricePerNight,active,available,totalPrice}`.
Sin fechas, `available` y `totalPrice` son null: no simulan disponibilidad global.

## Reservas

| Método y ruta | Acceso / resultado |
|---|---|
| POST `/reservations` | Autenticado, CSRF; `{roomId,startDate,endDate}` → 201 reserva |
| GET `/reservations/me?page=0&size=20` | Solo reservas propias |
| GET `/reservations/{id}` | Propietario o ADMIN |
| POST `/reservations/{id}/cancel` | Propietario o ADMIN, CSRF; actualiza y conserva fila |

Reserva: `{id,hotelId,hotelName,roomId,roomNumber,userId,username,startDate,endDate,
status,nightlyPrice,totalPrice,createdAt,cancelledAt}`. Las fechas persistidas
son timestamps ISO sin zona por compatibilidad. Las nuevas estancias usan medianoche
de las fechas enviadas; entrada inclusiva y salida exclusiva. El reloj de negocio
y los nuevos registros de creación/cancelación usan America/Panama.

La entrada no puede ser pasada; salida posterior y estancia máxima de 365 noches.
El precio usa la unidad legacy: **USD enteros por noche**. `totalPrice` es bigint:
noches × tarifa pactada. Cambiar la tarifa de la habitación no cambia reservas.
Para filas legacy sin precio pactado, los campos nuevos permanecen null.

Estados nuevos: CONFIRMED y CANCELLED. Solo CONFIRMED bloquea inventario. Se puede
cancelar una reserva CONFIRMED hasta el día de entrada inclusive; una cancelación
repetida es idempotente y conserva su primer timestamp. Reservas ya iniciadas en
días anteriores y estados legacy desconocidos devuelven 409 al cancelar.
No hay borrado físico ni edición de fechas. El flujo anterior describe el modo
por defecto sin pago; el checkout sandbox opcional se especifica a continuación.

Confirmar bloquea la fila de habitación (`SELECT FOR UPDATE`) dentro de la
transacción y consulta solapamientos antes de insertar. Dos estancias consecutivas
son válidas. Dos solicitudes concurrentes incompatibles producen 201 y 409;
la prueba usa PostgreSQL real y dos transacciones/hilos distintos.

## Administración (solo ADMIN, escrituras con CSRF)

| Método y ruta | Entrada / resultado |
|---|---|
| GET `/admin/hotels?q=...` | Hoteles activos e inactivos |
| POST `/admin/hotels` | `{name,location,description,rating,active}` → 201 |
| PUT `/admin/hotels/{id}` | Mismos campos; editar o desactivar sin borrar historial |
| GET `/admin/hotels/{id}/rooms` | Inventario activo e inactivo |
| POST `/admin/rooms` | `{hotelId,roomNumber,type,pricePerNight,active}` → 201 |
| PUT `/admin/rooms/{id}` | Mismos campos; no traslada una habitación a otro hotel |
| GET `/admin/reservations` | Filtros opcionales `hotelId`, `roomId`, `userId`, `status`, `page`, `size` |

Nombres/ubicación/descripción obligatorios, máximo 255; rating opcional 0–5.
Número de habitación obligatorio, máximo 50 y único por hotel; tipo obligatorio,
máximo 100; tarifa entera no negativa. No hay endpoints DELETE. Desactivar un
hotel/habitación impide nuevas reservas y conserva relaciones e historial.

Listados paginados: `{content,number,totalPages,totalElements}`, size 1–100.
Errores: `{message,fields?}`. 400 formato/validación/fechas, 401 sin sesión o
credenciales incorrectas, 403 CSRF/rol/propiedad, 404 inexistente/inactivo,
409 duplicado, solapamiento o transición inválida. No se envía SQL ni stacktrace
al cliente. El CRUD antiguo `/api/hotel/*` se sustituyó por el contrato único
de esta tabla; se reutilizan entidades/repositorios y servicios de hotel existentes.

## Checkout y reserva recurrente Stripe sandbox — HU-01 (#5)

Flag `HOTEL_CHECKOUT_ENABLED=false` por defecto. Cuando es true, POST
`/reservations` devuelve 409: no permite confirmar por fuera del checkout.
El flag requiere claves sandbox y la migración de checkout aplicada; nunca usar contra desarrollo
sin una adopción autorizada aparte. La aplicación guarda referencias consentidas
del proveedor y metadatos enmascarados, nunca PAN/CVV.

| Método y ruta | Acceso / resultado |
|---|---|
| GET `/checkouts/config` | Sesión; `{enabled,publishableKey,mode:"test"}`; nunca clave secreta |
| POST `/checkouts` | Sesión + CSRF + `Idempotency-Key` de 16–80 caracteres `[a-zA-Z0-9_-]`; `{roomId,startDate,endDate,paymentMethodId?,saveMethod:false}`; 200 checkout |
| GET `/checkouts/me` | Sesión; últimos 20 checkouts propios, sin clientSecret |
| POST `/checkouts/{uuid}/sync` | Propietario + CSRF; reconcilia estado, puede capturar/confirmar y devuelve checkout |
| POST `/checkouts/{uuid}/cancel` | Propietario + CSRF; cancela checkout pendiente, idempotente |
| POST `/checkouts/stripe-webhook` | Sin cookie/CSRF; firma `Stripe-Signature` obligatoria sobre cuerpo original y modo test |
| GET `/payment-methods` | Solo métodos propios autorizados, hasta 50: `{id,brand,lastFour,expiryMonth,expiryYear,expired}` |
| POST `/payment-methods/{uuid}/revoke` | Propietario + CSRF; retirada local inmediata, desvinculación del proveedor recuperable; 200 |

Checkout: `{id,stage,paymentStatus,amountCents,currency,expiresAt,reservationId,clientSecret,savedMethod,saveMethod}`.
`clientSecret` solo puede aparecer en sync del propietario cuando sigue PENDING;
no se persiste ni aparece en listados. Respuestas protegidas sin caché por Security.
`amountCents` es USD en centavos; reserva conserva `totalPrice` en USD enteros.
Precio/moneda/propiedad/referencias se verifican en servidor, no se aceptan del cliente.
Una clave repetida con el mismo cuerpo recupera la operación; con otro cuerpo, 409.
La comparación incluye método elegido y consentimiento. `paymentMethodId` es un
UUID local propio y activo, nunca un ID Stripe arbitrario. No se admite elegir
método existente y saveMethod=true a la vez. Un UUID ausente devuelve 404; ajeno
403; retirado, vencido o con propietario proveedor distinto, 409. Se revierte
la retención o se termina FAILED según el punto del rechazo, sin confirmar.

Guardar requiere saveMethod=true explícito, casilla inicialmente desmarcada,
versión hu01-on-session-v1 y fecha persistidas. Crea Customer privado idempotente
y PaymentIntent setup_future_usage=on_session. La referencia se activa junto con
la reserva solo tras cobro completo verificado. Sin consentimiento no se crea
Customer ni método local. No se hacen cobros off-session. Reutilizar exige nueva
confirmación del usuario y puede requerir 3DS; no exige volver a introducir PAN.
Retirar autorización impide nuevas compras incluso si Stripe no responde; el
worker reintenta la desvinculación. No cancela operaciones iniciadas previamente.

Stages: PENDING, FINALIZING, SUCCEEDED, CANCEL_REQUESTED, CANCELLED, FAILED,
EXPIRED, REFUND_PENDING, REFUNDED, REFUND_FAILED. `paymentStatus` conserva un
estado no sensible de Stripe o de la operación, no acredita por sí solo una reserva.
PENDING retiene inventario hasta expiresAt (10 minutos); FINALIZING lo protege
durante captura/recuperación incierta. Solo cobro `succeeded` verificado crea
reserva CONFIRMED. Esos estados no se añaden a `reservations.status`.

Una autorización tardía se cancela; un cobro sin derecho al inventario se
reembolsa sin crear reserva. Timeout no equivale a rechazo ni a éxito: la
operación sigue recuperable. Sin configuración válida/ante indisponibilidad
del proveedor: 503, sin fallback a confirmación gratuita. Firma inválida: 400.
FINALIZING no admite cancelación del checkout hasta conocer el resultado (409).

POST `/reservations/{id}/cancel` conserva propiedad/ADMIN y plazo existentes.
Para una reserva pagada, CANCELLED y la solicitud de reembolso total se guardan
juntas; la respuesta de reserva conserva su contrato. El reembolso se consulta
por checkout propio y puede seguir pendiente o fallar. Repetir cancelación no
duplica reembolso. Filas legacy sin checkout no generan devoluciones inventadas.

Worker recuperable cada 15s y webhooks idempotentes por operación/estado. No se
acepta un redirect del navegador como prueba de pago. Detalles, credenciales,
aislamiento y prueba humana: [HU01_CHECKOUT_INICIAL.md](HU01_CHECKOUT_INICIAL.md).
