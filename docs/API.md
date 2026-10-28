# Contrato HTTP de HOTEL MN

Base `/api`, JSON. La SPA usa el proxy del mismo origen de Vite. Las respuestas
nunca exponen entidades JPA ni hashes de contraseñas.

## Demanda administrativa (HU-03)

Solo ADMIN, sesión existente; operaciones GET sin escrituras:

| Método y ruta | Resultado |
|---|---|
| GET `/admin/demand/history?hotelId=&startDate=&endDate=` | Estadísticas por estancias, serie diaria y capacidad actual de referencia; fechas inclusivas pasadas, máximo 366 días |
| GET `/admin/demand/forecast?hotelId=` | Ventana de ocho semanas completas, medias por día semanal y 30 fechas estimadas desde mañana, o INSUFFICIENT_HISTORY sin predicciones |

Hotel opcional (todos por defecto); sus restricciones son las del ADMIN global
actual. Datos agregados sin identidades. Estimación y reservas futuras confirmadas
son series distintas; porcentajes de capacidad orientativos, no ocupación real.
401 anónimo/sesión expirada, 403 USER, 400 parámetros inválidos, 404 hotel inexistente.
Contrato completo, fórmula y tratamiento de ceros/estados:
[HU03_PREVISION_DEMANDA.md](HU03_PREVISION_DEMANDA.md).

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
No hay borrado físico, pagos, checkout ni edición de fechas en esta versión.

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

## Procedencia de demanda HU-03 (solo ADMIN)

GET /api/admin/demand/history y /api/admin/demand/forecast conservan sus filtros.
El contexto incorpora syntheticReservations, operationalReservations y syntheticBatches.
dataKind distingue OPERATIONAL, SYNTHETIC_DEMO y MIXED según el origen real de las
reservas del hotel/período consultado. Forecast considera entrenamiento y horizonte
sin duplicar reservas. No se expone identidad del propietario ni datos personales.
No existe endpoint HTTP para cargar o revertir lotes. Véase
[Historial sintético HU-03](HU03_HISTORIAL_SINTETICO.md).
# HU-04: descarga de constancia

`GET /api/reservations/{id}/certificate`: sesión autenticada, solo propietario incluso si el usuario es administrador. Respuesta 200 PDF adjunto `constancia-reserva-ID.pdf`, sin caché (`no-store, private`). 401 sin sesión, 403 reserva ajena, 404 inexistente. GET sin escritura ni requisito CSRF; las operaciones mutantes conservan su protección. Incluye estado actual, cancelación, hotel/habitación, fechas y precios guardados; valores heredados ausentes se indican sin inventarlos. No certifica pagos ni es factura. Véase [HU-04](HU04_CONSTANCIA.md).
