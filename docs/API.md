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
| GET `/rooms/allocation?hotelId=...&startDate=...&endDate=...&adults=2&children=0` | Habitaciones mínimas, disponibilidad real y opciones válidas para esos huéspedes |
| GET `/rooms/{id}/occupancy?from=YYYY-MM-DD&to=YYYY-MM-DD` | Rangos ocupados de una habitación activa, para el calendario |

Hotel: `{id,name,location,description,rating,active}`. Habitación:
`{id,hotelId,hotelName,roomNumber,type,pricePerNight,capacity,active,available,totalPrice}`.
Sin fechas, `available` y `totalPrice` son null: no simulan disponibilidad global.
`capacity` es la capacidad declarada de la habitación (columna de V3, 1–10).

El calendario de disponibilidad consume `/rooms/{id}/occupancy`:
`{roomId,hotelId,hotelName,roomNumber,type,pricePerNight,active,from,to,occupied}`.
Cada elemento de `occupied` es `{startDate,endDate}` con entrada inclusiva y salida
exclusiva, y proviene solo de reservas CONFIRMED: la noche `endDate` queda libre.
Sin parámetros cubre doce meses desde hoy; `to` debe ser posterior a `from` y el
rango máximo por consulta es de 400 días. No expone usuarios ni identificadores
de reserva, solo las fechas que bloquean inventario.

## Huéspedes y habitaciones necesarias

`/rooms/allocation` responde
`{hotelId,startDate,endDate,nights,adults,children,guests,maxRoomCapacity,minimumRooms,
availableRooms,availableCapacity,feasible,message,rooms}`. `adults` por defecto 2 y
`children` 0; se exige al menos 1 adulto, se rechazan cantidades negativas y el máximo es
20 adultos y 20 niños. No se piden datos personales de los huéspedes: se registran en el
check-in. Las fechas siguen las mismas reglas que una reserva (entrada no pasada, salida
posterior, 365 noches como máximo).

`minimumRooms` es **solo una referencia**: el mínimo teórico según la mayor capacidad entre los
tipos reservables del hotel (`maxRoomCapacity`). `availableRooms` y `availableCapacity`
describen lo que está realmente libre durante **toda** la estadía. `rooms` es el inventario
reservable del hotel, con disponibles primero y después por tarifa; cada habitación lleva su
`capacity`, su `totalPrice` para esas noches y `available`, que es false si está ocupada en
alguna noche de la estadía. El servidor **no elige ni combina habitaciones**: el cliente las
elige una por una y la interfaz suma su capacidad hasta cubrir a todos los huéspedes. Cada habitación necesita al menos un adulto, así que nunca hacen
falta más habitaciones que adultos. Si no es posible alojar a todos, `feasible` es false y
`message` explica el motivo, por ejemplo: «No hay habitaciones suficientes para alojar a 4
huéspedes. Se requieren al menos 2 habitaciones, pero solo hay 1 disponible para las fechas
seleccionadas».

## Reservas

| Método y ruta | Acceso / resultado |
|---|---|
| POST `/reservations` | Autenticado, CSRF; `{roomId,startDate,endDate}` → 201 reserva, sin huéspedes declarados |
| POST `/reservations/group` | Autenticado, CSRF; `{roomIds,startDate,endDate,adults,children}` → 201 lista de reservas |
| GET `/reservations/me?page=0&size=20` | Solo reservas propias |
| GET `/reservations/{id}` | Propietario o ADMIN |
| POST `/reservations/{id}/cancel` | Propietario o ADMIN, CSRF; actualiza y conserva fila |

Reserva: `{id,hotelId,hotelName,roomId,roomNumber,roomType,userId,username,startDate,endDate,
status,adults,children,nightlyPrice,totalPrice,createdAt,cancelledAt}`. `roomType` es el tipo de la
habitación al reservar y, como la tarifa, no cambia si luego se reclasifica la habitación
(null si la habitación no tenía tipo). Las reservas anteriores a V5 se rellenaron con el tipo
actual de su habitación. Las fechas persistidas
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

`/reservations/group` recibe las habitaciones que eligió el cliente y los huéspedes totales:
crea una reserva por habitación y reparte los huéspedes entre ellas, un adulto en cada una y
el resto hasta su capacidad empezando por las más amplias. El cliente no distribuye huéspedes
por habitación. Antes de confirmar vuelve a validar en el backend las fechas, que cada
habitación esté activa, que todas sean del mismo hotel, que no se repitan, que no haya más
habitaciones que adultos y que todas estén libres durante toda la estadía. Devuelve 400 si la
petición es inválida (huéspedes fuera de rango, habitaciones repetidas, de hoteles distintos
o más habitaciones que adultos) y 409 si una habitación ya no está habilitada, acaba de
reservarse o la capacidad elegida no alcanza para todos. `adults`/`children` quedan en null
en las reservas creadas por `POST /reservations` y en las filas anteriores a V4.

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
máximo 100; tarifa entera no negativa. La capacidad la fija el tipo con el mismo
vocabulario y los mismos valores que la migración V3 (Individual 1, Doble y Matrimonial 2,
Deluxe 3, Familiar y Suite 4; cualquier otro tipo, 2), así que guardar una habitación
alinea su capacidad con su tipo y el formulario no la pide por separado. No hay endpoints DELETE. Desactivar un
hotel/habitación impide nuevas reservas y conserva relaciones e historial.

Listados paginados: `{content,number,totalPages,totalElements}`, size 1–100.
Errores: `{message,fields?}`. 400 formato/validación/fechas, 401 sin sesión o
credenciales incorrectas, 403 CSRF/rol/propiedad, 404 inexistente/inactivo,
409 duplicado, solapamiento o transición inválida. No se envía SQL ni stacktrace
al cliente. El CRUD antiguo `/api/hotel/*` se sustituyó por el contrato único
de esta tabla; se reutilizan entidades/repositorios y servicios de hotel existentes.
