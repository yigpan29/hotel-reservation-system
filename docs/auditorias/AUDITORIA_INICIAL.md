# Auditoría inicial — Hotel Reservation System

**Fecha:** 25 de octubre de 2026, zona America/Panama.  
**Contexto:** Proyecto #1 de Tópicos Especiales II, profesor Regis Rivera.  
**Rama analizada:** `base`.  
**Commit HEAD:** `2f82bdb96836991b1051ebaa918859c9f5a3dc6c` (`Merge pull request #22 from natanael-lima/developer`).  
**Alcance:** diagnóstico estático y consultas HTTP de lectura sobre servicios existentes. No se implementaron soluciones. La única escritura autorizada es este documento y sus directorios.

La carpeta inicial del entorno contiene otra carpeta `hotel-reservation-system/`. **La raíz Git efectiva es esa carpeta interior**, donde están `README.md`, `compose.yaml` y los dos subproyectos. Todas las rutas de este informe son relativas a esa raíz Git.

Para abreviar referencias sin perder precisión:

- **F** = `hotel-reservation-system-frontend/`.
- **FS** = `hotel-reservation-system-frontend/src/`.
- **B** = `hotel-reservation-system-backend/`.
- **BJ** = `hotel-reservation-system-backend/src/main/java/app/mnhotel/hotel_reservation_system_backend/`.
- `archivo:10–20` significa líneas 10 a 20 del archivo inspeccionado. Los alias anteriores forman parte de la ruta.

**Tipos de evidencia:** ESTÁTICA = código/configuración; EJECUTADA = resultado de una consulta realizada; INFERENCIA = consecuencia razonada que no se comprobó directamente. La respuesta de un servidor local no demuestra por sí sola que su proceso ejecuta exactamente este HEAD.

## 1. Resumen ejecutivo

Hotel Reservation System, identificado visualmente como **HOTEL MN**, pretende permitir a clientes encontrar alojamiento y reservar habitaciones, y a administradores gestionar hoteles, habitaciones y usuarios. El contenido visual se orienta parcialmente a destinos argentinos, pero no existe una restricción de negocio que limite el sistema a ese país.

El estado real es el de un **prototipo visual con un backend inicial de hoteles**, no un sistema de reservas completo. Hay cinco rutas React, componentes de búsqueda y fechas, tablas administrativas y seis entidades JPA. Solo hoteles dispone de controlador REST y servicio con operaciones CRUD. Usuarios, reservas, habitaciones y pagos tienen principalmente estructuras vacías. No se encontró implementación de JWT, Spring Security activo, registro, inicio de sesión, reservas ni pasarelas de pago.

**Comprobado en ejecución:** el servidor local del frontend entrega HTML con HTTP 200; la API de hoteles responde 204 al listar y 404 para ID 0; un ID no numérico produce 400. El origen CORS `http://localhost:5173` se acepta y `http://127.0.0.1:5173` produce 403. El 204 concuerda con una colección de hoteles vacía; no acredita que todas las tablas estén vacías.

**Limitación principal del entorno:** Docker CLI identifica el contexto `desktop-linux`, pero el motor rechaza el acceso al conducto de Docker Desktop. No fue posible inventariar contenedores, consultar logs, verificar volúmenes ni consultar PostgreSQL. La respuesta HTTP de hoteles es evidencia indirecta de acceso al repositorio de persistencia según el código; no reemplaza una inspección del esquema real.

**Preparación para las historias:** baja. Las tres historias requieren completar bases funcionales compartidas. HU-03 puede reutilizar el modelo conceptual de reserva y la ubicación visual del dashboard, pero no cuenta con histórico verificado, agregaciones, inventario temporal ni estadísticas reales. No se puede sostener que hoy sea posible producir una previsión válida de 30 días con ocho semanas de datos.

## 2. Funcionamiento del sistema

### 2.1 Experiencia del cliente que representa el frontend

1. En `/`, la página inicial compone cabecera, buscador, carrusel de hoteles, publicidad, destinos y pie de página (`FS/pages/Home.tsx:10–31`). Los hoteles y disponibilidades visuales proceden de arreglos locales, no de PostgreSQL.
2. El buscador permite escribir un destino y contiene autocompletado por prefijo sobre una lista fija de provincias. Los contadores locales imponen mínimos de un adulto, cero niños y una habitación (`FS/components/Search.tsx:5–35, 119–169`). No verifican capacidad real ni inventario.
3. Se muestran fechas de entrada y salida mediante controles HTML `date`. No se comparan entre sí ni contra reservas existentes (`Search.tsx:71–94`). El enlace Search apunta a `#`; no ejecuta búsqueda ni llama al backend (`Search.tsx:180`, `ButtonBorder.tsx:6–10`).
4. Rooms lleva a `/products`. La página repite ocho veces la misma tarjeta fija y presenta un formulario lateral de filtros (`FS/pages/Rooms.tsx:12–30`). Cambiar esos controles no filtra un conjunto de resultados.
5. Las tarjetas llevan a `/productDetail`, sin parámetro identificador. Todas muestran el mismo detalle: precio, características y dos controles de fecha fijos (`CardRoom.tsx:18–30`, `RoomDetailComponent.tsx:19–104`). No se conserva la identidad de la selección.
6. Reserve utiliza un componente que produce un enlace `href="#"`. No crea reserva, calcula un importe ni abre checkout (`RoomDetailComponent.tsx:103–104`, `Button.tsx:6–10`).
7. Login y Register son enlaces visuales sin pantallas ni endpoints asociados (`Header.tsx:39–43`). No hay sesión que cerrar, perfil editable ni listado de reservas del cliente.
8. `/about` muestra información estática. Algunos destinos del carrusel llevan a Booking, un sitio externo (`SliderPlaces.tsx:44–55`); eso no constituye una integración de reservas del sistema.

Estos pasos describen el código, **no una prueba de navegación realizada en navegador**. Solo se verificó la entrega HTTP de la página inicial.

### 2.2 Experiencia administrativa

1. Existe `/admin` sin guardia de autenticación (`FS/App.tsx:15–19`).
2. `AdminPanel` usa estado local para alternar dashboard, hoteles, habitaciones y usuarios, y para desplegar el menú móvil (`FS/pages/AdminPanel.tsx:10–35`). No son rutas anidadas persistentes.
3. Hoteles usa dos registros locales; habitaciones y usuarios también usan arreglos de ejemplo. Los roles Admin, User y Moderator que aparecen son etiquetas de esos ejemplos; **no son permisos implementados**.
4. Los botones de agregar, editar y eliminar carecen de manejadores (`FS/components/ButtonGroup.tsx:7–53`). No hay formularios administrativos que persistan datos.
5. El dashboard muestra métricas fijas de una plantilla de comercio electrónico; no consulta reservas ni representa demanda (`Dashboard.tsx:7–37`).

### 2.3 Flujo de reserva previsto y diferencia con lo existente

El flujo de negocio esperado sería identificar cliente, seleccionar habitación y fechas, verificar disponibilidad, confirmar importe, registrar reserva y eventualmente pago, y permitir consulta/cancelación. Actualmente solo existen piezas visuales y entidades para ese flujo. **No hay una transacción de reserva ejecutable desde la interfaz ni desde un endpoint REST encontrado.**

## 3. Arquitectura técnica

### 3.1 Tecnologías verificadas

| Área | Evidencia | Versión o condición verificada |
|---|---|---|
| React / React DOM | `F/package.json:12–15`, `F/package-lock.json` | 18.3.1 en lockfile |
| React Router DOM | mismos archivos | 6.26.0 en lockfile |
| Vite | `F/package.json:31`, lockfile | 5.4.0 en lockfile; plugin React declarado ^4.3.1 |
| TypeScript | `F/package.json:29`, lockfile | declarado ^5.5.3; resuelto 5.5.4 |
| Tailwind / PostCSS | `F/tailwind.config.js`, `F/postcss.config.js`, lockfile | Tailwind 3.4.10; Autoprefixer/PostCSS declarados |
| ESLint | `F/eslint.config.js`, lockfile | 9.9.0 resuelto; reglas TypeScript, Hooks y React Refresh |
| Spring Boot | `B/pom.xml:5–8` | 3.3.2 |
| Java | `B/pom.xml:29–30` | objetivo Java 17; imagen Compose Temurin 17 |
| Persistencia | `B/pom.xml:33–55` | Spring Data JPA, driver PostgreSQL, Lombok; versiones administradas por el POM padre |
| Web | `B/pom.xml:37–40` | Spring Web MVC |
| Desarrollo backend | `B/pom.xml:42–46` | DevTools |
| Pruebas backend | `B/pom.xml:58–61` | Spring Boot Starter Test; prueba usa JUnit Jupiter |
| Maven | `B/.mvn/wrapper/maven-wrapper.properties:17–19` | distribución 3.9.7; Compose usa etiqueta Maven 3.9 |
| Node | `compose.yaml:41`; proceso usado para leer JSON | imagen configurada Node 22; CLI del host observada v24.16.0, no prueba de versión del contenedor |
| PostgreSQL | `compose.yaml:5` | imagen configurada `postgres:17`; versión del servidor sin verificar |
| Spring Security / JWT | `B/pom.xml:63–72`, `BJ/configuration/SecurityConfig.java:3–5` | Security está comentado; configuración vacía; no se encontró biblioteca ni validación JWT |
| Stripe / Mercado Pago | búsqueda en fuentes y dependencias | mencionados en README, sin integración encontrada |

Las versiones del lockfile son resoluciones declaradas, no una comprobación de paquetes instalados. No hay bibliotecas de gráficos, calendario, cliente HTTP, gestión global de estado ni SDK de pagos en las dependencias directas del frontend.

### 3.2 Organización

```text
raíz Git/
  README.md
  INICIO-LOCAL.md                  # preexistente, sin seguimiento
  compose.yaml                     # preexistente, sin seguimiento
  hotel-reservation-system-frontend/
    public/                        # SVG de marca y plantilla
    src/
      main.tsx, App.tsx             # arranque y rutas
      pages/                       # Home, Rooms, RoomDetails, About, AdminPanel
      components/                  # presentación, filtros, tablas y navegación
      assets/, index.css, App.css
    package.json, package-lock.json
    vite.config.ts, tsconfig*.json, eslint.config.js
  hotel-reservation-system-backend/
    src/main/java/app/mnhotel/hotel_reservation_system_backend/
      configuration/, controller/, dto/, entity/
      exception/, repository/, response/, service/, service/imp/
    src/main/resources/application.properties
    src/test/java/.../HotelReservationSystemApplicationTests.java
    .mvn/, mvnw, mvnw.cmd, pom.xml
    bin/                           # copias y .class versionados preexistentes
  docs/auditorias/AUDITORIA_INICIAL.md
```

No se encontraron `AGENTS.md`, Dockerfiles, scripts SQL, migraciones Flyway/Liquibase, seeders ni workflows de GitHub Actions en el inventario inspeccionado. `bin/pom.xml` y `bin/src/main/resources/application.properties` difieren de sus equivalentes principales según comparación de hashes; no se usan como fuente canónica en esta auditoría.

### 3.3 Frontend

- `main.tsx:1–9` monta React con StrictMode. `App.tsx:13–21` define `/`, `/admin`, `/products`, `/about` y `/productDetail`. No hay ruta comodín; `ErrorPage.tsx` existe, pero no está conectado al router.
- `Header`, `Footer`, `HeaderBanner`, `Hero`, `Publicity` y `AboutUs` son presentación/navegación. Hay enlaces `#` y recursos gráficos externos.
- `Search` gestiona destino, sugerencias y contadores con `useState`; `SliderHotels` y `SliderPlaces` gestionan índices; `ProfileCircule` solo abre un menú local. No se encontró contexto de sesión, Redux, almacenamiento de token, `localStorage` o `sessionStorage`.
- `CardRoom`, `CardHotelSlider`, `RoomDetailComponent` y `RoomDetailPlus` representan alojamiento sin vincular IDs de la base de datos. El detalle mezcla contenido fijo independiente de la tarjeta.
- `AdminPanel`, `Sidebar` y `HeaderAdmin` organizan las pestañas; `HotelSection`, `RoomSection`, `UserSection` y `Dashboard` muestran datos locales.
- Los formularios de búsqueda/filtros carecen de envío funcional y de manejo de errores remoto. No hay feedback de carga de API, reintentos ni validación de fechas de negocio.
- La búsqueda global no encontró `fetch`, Axios o XMLHttpRequest. `F/vite.config.ts:5–7` solo activa React; no contiene proxy a la API ni configuración de URL base.

### 3.4 Backend

El paquete raíz arranca mediante `HotelReservationSystemApplication.java:6–10`.

| Capa | Componentes y responsabilidad efectiva |
|---|---|
| Controllers | `HotelController` expone cinco operaciones. `UserController` es una clase vacía sin anotación REST. No hay controllers de reservas, habitaciones, pagos, reseñas o auth. |
| Services | `HotelService` declara CRUD; `HotelServiceImp` convierte DTO/entidad y usa el repositorio. `AuthService.createUser` existe, pero su implementación devuelve null. Los demás servicios/interfaces están vacíos. |
| Repositories | Hotel, User, Room, Reservation y Payment extienden `JpaRepository<Entidad, Long>`; sin consultas personalizadas. No se encontró `ReviewRepository`. |
| Entities | Hotel, User, Room, Reservation, Payment y Review. |
| DTOs | Una clase por esas seis entidades; Lombok genera constructores/accesores. Solo HotelDTO tiene conversión implementada en servicio. |
| Responses | `ApiResponse` contiene mensaje; `AuthResponse` contiene un campo token, sin emisión ni verificación asociadas. |
| Seguridad | Clase vacía; dependencia Security comentada; sin filtros, roles ni comprobaciones de propietario. |
| Excepciones | `ResourceNotFoundException` existe, pero no se usa en el CRUD revisado. No hay `ControllerAdvice` global. El controller mezcla capturas genéricas, cuerpos vacíos y mensajes con `e.getMessage()`. |

### 3.5 Recorrido de una petición y comunicación entre capas

**Recorrido existente de lectura:** una petición externa `GET /api/hotel/get-all` llega a `HotelController.findAllHotel` (`BJ/controller/HotelController.java:73–84`), llama a `HotelServiceImp.getAllHotel` (`BJ/service/imp/HotelServiceImp.java:78–82`), que ejecuta `HotelRepository.findAll()` mediante Spring Data JPA. Hibernate consulta la conexión configurada. Cada entidad se convierte a HotelDTO (`HotelServiceImp.java:20–37`); si no hay elementos, el controller devuelve 204 y, si los hay, 200 con lista JSON. No hay paginación.

**El frontend actual no inicia ese recorrido.** Sus arreglos locales constituyen un flujo separado. La futura llamada HTTP del navegador tendría que usar la API publicada en el host; el nombre de servicio `postgres` se utiliza solo para la conexión backend–base de datos dentro de Compose. No existe evidencia de una cadena frontend–API–reserva–pago funcionando.

## 4. Modelo de datos

### 4.1 Esquema definido en JPA

Todas las entidades usan `Long id` con `GenerationType.IDENTITY`. Los nombres de tabla siguientes son explícitos; no se verificaron sus objetos físicos en PostgreSQL.

| Tabla definida | Campos principales | Relaciones / restricciones declaradas | Evidencia |
|---|---|---|---|
| `hotels` | id, name, location, description, rating (Double) | Uno a muchos rooms y reviews; ambas asociaciones Cascade.ALL | `BJ/entity/Hotel.java:24–47` |
| `rooms` | id, room_number, type, price_per_night (Integer), **availbility** (Boolean) | Muchos a uno hotel por hotel_id | `BJ/entity/Room.java:23–44` |
| `users` | id, username, password, email, created_at | username/email únicos y no nulos; uno a muchos reservations y reviews con Cascade.ALL | `BJ/entity/User.java:19–42` |
| `reservations` | id, start_date, end_date, status (String), created_at | Muchos a uno user por user_id y room por room_id; uno a muchos payments con Cascade.ALL | `BJ/entity/Reservation.java:29–58` |
| `payments` | id, amount (Integer), payment_date, status (String) | Muchos a uno reservation por reservation_id | `BJ/entity/Payment.java:26–44` |
| `reviews` | id, rating (Integer), comment, created_at | Muchos a uno user por user_id y hotel por hotel_id | `BJ/entity/Review.java:24–47` |

Las relaciones de muchos a uno se declaran EAGER en estas entidades; varias colecciones son LAZY. Las anotaciones JSON intentan controlar relaciones bidireccionales, pero las rutas de entidades distintas de HotelDTO no se han probado. No se infiere un fallo de serialización sin un recorrido que las exponga.

```text
Hotel 1 ── N Room 1 ── N Reservation N ── 1 User
Hotel 1 ── N Review N ── 1 User
Reservation 1 ── N Payment
```

### 4.2 Disponibilidad, precios e histórico

- `Room.availbility` está escrito así tanto en Java como en la columna; `RoomDTO.availability` usa otra grafía (`BJ/dto/RoomDTO.java:16–17`). No existe mapper de habitación que resuelva la diferencia.
- Un booleano global no expresa disponibilidad por día. No hay consulta de solapamientos, bloqueo de inventario, restricción temporal ni servicio transaccional de reservas.
- `price_per_night` representa el precio actual de la habitación. No hay moneda, historial de tarifas, vigencias, precio pactado en reserva, desglose por noche, impuestos o descuentos. No se especifica si los enteros monetarios representan unidades o centavos.
- Reserva tiene campos de creación, entrada/salida y estado, pero no generación automática de `createdAt`, `@PrePersist` o auditoría JPA encontrada. Que el campo exista no garantiza que esté poblado.
- `status` es una cadena libre: no se definen estados permitidos, transiciones, cancelación fechada, motivo, no-show, check-in efectivo o check-out efectivo. No hay bitácora de cambios.
- No hay capacidad de huéspedes en Room; la capacidad de las tablas visuales es de ejemplo. Puede contarse el inventario actual de habitaciones por hotel si hay registros válidos, pero no reconstruir su capacidad operativa histórica o futura ni sus cierres por mantenimiento.
- Fuera de username/email, no se declaran validaciones de obligatoriedad ni rangos de negocio. Las relaciones no indican `optional=false` ni `nullable=false`; no debe presumirse integridad de negocio adicional a la que defina el motor.
- No hay unicidad declarada para número de habitación dentro de hotel, ni `@Version` para control optimista de concurrencia. Eso no prueba una sobreventa ya ocurrida: el flujo de reserva aún no existe.

### 4.3 Esquema real y datos de prueba

`B/src/main/resources/application.properties:13` usa `spring.jpa.hibernate.ddl-auto=update`. Por ello, iniciar el contexto puede modificar el esquema; **no se inició durante la auditoría**. No se encontraron migraciones SQL ni cargas de datos iniciales. Las listas de ejemplo del frontend no son seeders.

No se consultó PostgreSQL directamente: Docker rechazó acceso y no se encontró `psql` en PATH. Por tanto, quedan sin verificar tablas efectivas, columnas, claves foráneas, índices, restricciones, volúmenes, cantidades de reservas, antigüedad de datos y valores de estado. El HTTP 204 de hoteles no justifica afirmar que reservas o usuarios estén vacíos. `INICIO-LOCAL.md:20–22` dice que la base inicia vacía; es documentación local, no una consulta de datos.

## 5. Inventario de funcionalidades

**Criterio:** FUNCIONA exige ejecución observada y queda limitado al caso indicado. PARCIAL significa limitación confirmada en implementación. NO IMPLEMENTADA se aplica al comportamiento de negocio ausente, aunque exista una entidad o botón. FALLA no se usa para respuestas HTTP esperadas como un 404 de ID inexistente.

| Módulo | Funcionalidad | Estado | Evidencia | Observaciones |
|---|---|---|---|---|
| Entorno web | Entrega del HTML inicial | FUNCIONA | GET puerto 5173, `/`: 200, HTML con cliente Vite y título HOTEL MN | No acredita montaje React, navegación ni aspecto visual. |
| Navegación | Cinco páginas React y pestañas de admin | IMPLEMENTADA SIN VERIFICAR | `FS/App.tsx:15–19`; `pages/AdminPanel.tsx:10–35` | No se ejecutó navegador. No hay ruta 404 conectada. |
| Catálogo | Carrusel visual de hoteles/destinos | PARCIAL | `SliderHotels.tsx:4–73`; `SliderPlaces.tsx:3–45` | Datos locales; límites del índice impiden alcanzar todos los elementos en pantallas pequeñas. |
| Catálogo | Habitaciones y detalle | PARCIAL | `pages/Rooms.tsx:23–30`; `CardRoom.tsx:18–30`; `RoomDetailComponent.tsx:19–104` | Ocho copias, detalle sin ID; no consume rooms/hotels. |
| Búsqueda | Destino, sugerencias y contadores | PARCIAL | `Search.tsx:14–35, 119–180` | Hay estado y mínimos locales; Search es un enlace sin consulta. |
| Búsqueda | Filtros de ubicación/precio/características | PARCIAL | `SideBarFilter.tsx:18–338`; `Button.tsx:8` | Controles sin filtrado real ni integración de API. |
| Disponibilidad | Consulta temporal / calendario de días ocupados | NO IMPLEMENTADA | `Room.java:40–44`; servicios Room/Reservation vacíos | Solo fechas HTML y booleano global; sin endpoint ni validación de solapamiento. |
| Usuarios | Registro persistente | NO IMPLEMENTADA | `AuthServiceImp.java:12–14`; `UserController.java:3–5`; `Header.tsx:41–43` | createUser devuelve null; no ruta de registro. Requeriría User y validaciones/contraseña. |
| Sesión | Login, logout, JWT y recuperación/cambio de contraseña | NO IMPLEMENTADA | `SecurityConfig.java:3–5`; `ProfileCircule.tsx:39–69`; `B/pom.xml:63–72` | Menú y AuthResponse no constituyen autenticación. |
| Permisos | Roles y autorización administrativa / por propietario | NO IMPLEMENTADA | `User.java:20–42`; `App.tsx:16`; SecurityConfig vacío | Roles solo en ejemplos de UserSection. |
| Hoteles API | Listar colección vacía | FUNCIONA | GET `/api/hotel/get-all`: 204; `HotelController.java:73–84` | Sin autenticación enviada. Caso con datos sin verificar; necesita hotels. |
| Hoteles API | Consulta de ID inexistente y formato inválido | FUNCIONA | GET `/get-hotel/0`: 404; `/get-hotel/abc`: 400 | No se verificó recuperación de un hotel existente. |
| Hoteles API | Crear, editar, eliminar | IMPLEMENTADA SIN VERIFICAR | `HotelController.java:32–68`; `HotelServiceImp.java:58–119` | No se enviaron escrituras. Validación insuficiente; necesita hotels y considerar relaciones. |
| Administración | Gestión de hoteles desde pantalla | PARCIAL | `HotelSection.tsx:3–22, 40–49`; `ButtonGroup.tsx:7–53` | Tabla de ejemplo y botones sin acciones; API no conectada. |
| Administración | Gestión de habitaciones y usuarios | PARCIAL | `RoomSection.tsx:19–38`; `UserSection.tsx:18–35` | UI de ejemplo. CRUD de negocio y endpoints no implementados. |
| Reservas | Crear/consultar/modificar/cancelar y mis reservas | NO IMPLEMENTADA | `ReservationService.java:3–5`; `ReservationServiceImp.java:7–9`; `RoomDetailComponent.tsx:104` | Hay entity/DTO/repository, pero no casos de uso, endpoints o formularios funcionales. |
| Pagos | Checkout, procesamiento, métodos guardados | NO IMPLEMENTADA | `PaymentService.java:3–5`; `PaymentServiceImp.java:7–9`; POM/package.json | Payment solo modela importe/fecha/estado y reserva; sin proveedor ni webhooks. |
| Reseñas | Publicar/consultar reseñas reales y calcular valoración | NO IMPLEMENTADA | `Review.java:24–47`; `HotelServiceImp.java:31–36` | Modelo/DTO, sin repositorio/controller/servicio de reseñas; rating hotel se asigna directamente. |
| Estadísticas | Dashboard administrativo | PARCIAL | `Dashboard.tsx:7–37` | Métricas fijas ajenas al negocio, sin API ni gráficos. |
| Previsión | Histórico agregado y pronóstico de demanda | NO IMPLEMENTADA | ReservationRepository sin métodos propios; Dashboard fijo | No hay pipeline, endpoint, modelo predictivo ni biblioteca de gráficos. |
| Perfil | Datos guardados del cliente para reservar | NO IMPLEMENTADA | `User.java:25–35`; UserService vacío | Username/email no equivalen a perfil de facturación ni medio de pago reutilizable. |
| CORS | Acceso desde origen alternativo 127.0.0.1 | FALLA | GET con Origin `http://127.0.0.1:5173`: 403 | Limitación local de configuración; localhost sí está permitido. |

Validaciones transversales: el backend de hoteles solo comprueba cuerpo nulo antes de crear; no usa `@Valid`, `@NotBlank` ni validadores de dominio. Para actualizar busca el ID y reemplaza los cuatro atributos; para eliminar busca antes de borrar. La conversión de hotel no incluye habitaciones ni reseñas. No se comprobaron formularios ni validaciones de reservas/pago porque no existen como flujo implementado.

## 6. Estado de Docker

### 6.1 Configuración observada, no estado de contenedores

`compose.yaml` es un archivo **local preexistente sin seguimiento Git**. No hay Dockerfiles: usa imágenes públicas y ejecuta herramientas de desarrollo.

| Servicio definido | Imagen y comando | Puerto publicado en loopback | Persistencia / dependencia |
|---|---|---|---|
| postgres | `postgres:17` | host 5432 → 5432 | volumen `postgres-data` en `/var/lib/postgresql/data`; healthcheck pg_isready |
| backend | `maven:3.9-eclipse-temurin-17`, `mvn spring-boot:run` | host 3000 → 3000 | código B montado en `/app`; caché Maven; espera postgres saludable |
| frontend | `node:22-bookworm-slim`, npm ci y Vite en host 0.0.0.0, puerto estricto 5173 | host 5173 → 5173 | código F montado en `/app`; volumen de dependencias y caché npm |

Evidencia: `compose.yaml:3–56`. Los tres servicios tienen `restart: unless-stopped`. Solo PostgreSQL tiene healthcheck (`15–19`, intervalo/timeout 5 s y 20 reintentos); no hay healthchecks de aplicación para frontend/backend. No se declara dependencia frontend→backend, ni red personalizada: la conexión por nombre de servicio corresponde a la red predeterminada de Compose.

Variables necesarias definidas: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` y `LOGGING_LEVEL_ORG_SPRINGFRAMEWORK`. Se omiten sus valores sensibles y cadenas de conexión. La URL configurada del backend apunta al servicio `postgres` en el puerto interno 5432. Spring escucha en 3000 según properties. No se encontró una variable de URL API del frontend.

El montaje del código significa que arrancar estos servicios puede generar `target/` o cachés dentro de las carpetas montadas; `npm ci` instala dependencias y Hibernate update puede alterar la base. **No se ejecutó Compose up ni ningún comando de inicio, reinicio, build o instalación.**

### 6.2 Comprobaciones ejecutadas

- `docker context show`: `desktop-linux`.
- `docker ps -a`, `docker compose ... ps --all` y `docker compose ... logs --tail 30 --no-color backend frontend postgres`: rechazados con `permission denied while trying to connect to the docker API ... dockerDesktopLinuxEngine`.
- HTTP local: frontend 200; API de hoteles 204, 404 y 400 en los casos descritos; CORS 204/403 según origen.

**No comprobado:** nombres/IDs de contenedores existentes, imágenes efectivas/digests, estado running/healthy, reinicios previos, errores de arranque, logs recientes, montaje real de volúmenes, DNS/conectividad interna y versión/esquema de PostgreSQL. La restricción de Docker es del acceso de esta auditoría; no demuestra un defecto del repositorio ni que Docker esté detenido. Tampoco puede atribuirse con certeza a contenedores la respuesta de los puertos locales.

No hay dependencia Actuator en el POM ni endpoint de salud implementado encontrado. No se inventó ni se consideró operativo `/actuator/health`.

## 7. Endpoints disponibles

La tabla enumera **todos los mappings REST encontrados en el código fuente principal**. La ruta base es `/api/hotel`; CORS está definido en `HotelController.java:23`. Ninguna operación comprueba token, rol o propietario en el código auditado.

| Método | Ruta | Propósito / respuestas previstas por código | Autenticación y autorización | Evidencia de ejecución |
|---|---|---|---|---|
| GET | `/api/hotel/get-all` | Listar HotelDTO; 204 vacío, 200 con lista, 500 ante excepción | Sin controles implementados; consulta enviada sin credenciales | **204 verificado**; variante con hoteles no verificada. Controller 73–84; servicio 78–82. |
| GET | `/api/hotel/get-hotel/{id}` | Buscar HotelDTO; 200 existente, 404 ausente, 500 error | Sin controles implementados | **404 para 0 y 400 para abc verificados**; 200 no probado. Controller 89–105; servicio 86–89. |
| POST | `/api/hotel/registration-hotel` | Persistir DTO; 200 mensaje; comprobación de cuerpo nulo; 500 error | Sin controles implementados según revisión estática; no se ensayó escritura anónima | No ejecutado. Controller 32–43; servicio 58–73. |
| PUT | `/api/hotel/update-hotel/{id}` | Reemplazar name/location/description/rating; ID de URL prevalece; 200 o 500 | Sin controles implementados según revisión estática | No ejecutado. Controller 60–69; servicio 106–119. |
| DELETE | `/api/hotel/delete-hotel/{id}` | Borrar; 200; captura RuntimeException devuelve 204 | Sin controles implementados según revisión estática | No ejecutado. Controller 49–56; servicio 98–103. |

Crear acepta un `id` del DTO y lo pasa a `save` (`HotelServiceImp.java:63,69`); no fuerza un identificador nuevo. Debe revisarse la semántica insert/update para impedir que crear opere accidentalmente sobre una entidad existente. No se realizó esa prueba.

No se encontraron endpoints REST de auth, users, rooms, reservations, payments, reviews, calendario ni estadísticas. Las rutas del router React son páginas del frontend, no endpoints de negocio.

**Errores de contrato observados estáticamente:** update de ID inexistente lanza una excepción genérica y devuelve 500; delete lanza una excepción comprobada para el mismo caso, pero el controller solo captura RuntimeException, por lo que no entrega una respuesta de dominio consistente. No se probó DELETE. Un 204 puede ocultar otros errores de eliminación; el GET de ID ausente sí contempla 404.

## 8. Pruebas y calidad

### 8.1 Pruebas existentes

- Backend: una clase `B/src/test/java/app/mnhotel/hotel_reservation_system_backend/HotelReservationSystemApplicationTests.java:3–11`, con `@SpringBootTest` y un único `contextLoads()` vacío. Es una comprobación de carga de contexto, no una prueba de reglas de reserva o CRUD.
- No se encontraron pruebas unitarias específicas, tests de repositorios/controladores, pruebas de integración de negocio, frontend o extremo a extremo.
- `F/package.json:6–10` solo define dev/build/lint/preview. No define script de test ni framework de pruebas frontend.
- No se encontró configuración de cobertura (JaCoCo, Istanbul, etc.) ni automatización CI/CD en workflows inspeccionables. No se produjo un porcentaje de cobertura.
- Hay reglas TypeScript strict/noUnused y ESLint, pero su existencia no demuestra que se cumplan.

### 8.2 Verificaciones ejecutadas y excluidas

Se ejecutaron inventario de archivos, búsquedas estáticas, lectura de manifiestos/lockfile, comparación Git, comparación de hashes de dos duplicados bin y consultas HTTP GET. **No se ejecutó ninguna suite de pruebas**, lint ni compilación.

`node_modules/typescript/bin/tsc` y `node_modules/eslint/bin/eslint.js` no están disponibles en la carpeta del frontend del host. No se instalaron. El build `tsc -b && vite build` produciría artefactos y no está permitido. Maven test generaría `target/` y podría abrir el contexto configurado con `ddl-auto=update` contra la base local: no se ejecutó.

**Riesgos de compilación identificados por lectura, sin resultado de compilación:**

- `Search.tsx:21,26–30` infiere `never[]` para `useState([])` bajo configuración estricta y luego intenta asignar `string[]`.
- `pages/AdminPanel.tsx:7` importa `../components/SideBar`, mientras el archivo versionado es `Sidebar.tsx`: resolución problemática en un filesystem sensible a mayúsculas. No se demuestra que la instancia Vite existente haya recorrido esa ruta o esté usando exactamente esta copia.
- Hay imports React sin uso en múltiples archivos con `jsx: react-jsx` y `noUnusedLocals: true` (`tsconfig.app.json:15–20`); por ejemplo `pages/About.tsx:1` y `pages/RoomDetails.tsx:1`.

Para confirmar esos diagnósticos sería apropiado ejecutar typecheck sin emisión con dependencias ya disponibles en un entorno aislado. Para validar negocio se necesitarían una base de prueba independiente, configuración que impida tocar datos locales y pruebas de autorización, fechas, solapamientos, concurrencia, importes, cancelaciones y recuperación de errores. Eso es trabajo posterior, no una acción realizada.

## 9. Problemas detectados

La severidad refleja impacto actual o sobre la construcción de las historias. Una ausencia funcional confirmada no equivale a una excepción reproducida en ejecución. No se afirma que exista un incidente de seguridad o pérdida de datos.

| ID | Severidad | Descripción y evidencia / ubicación | Impacto | Reproducción o límite de evidencia | Recomendación técnica, sin aplicar |
|---|---|---|---|---|---|
| H-01 | CRÍTICO | El objetivo central de reservar no tiene caso de uso ni endpoint; servicios Reservation vacíos y Reserve es enlace `#`. `BJ/service/ReservationService.java:3–5`, `service/imp/ReservationServiceImp.java:7–9`, `FS/components/RoomDetailComponent.tsx:104`, `Button.tsx:8`. | Impide realizar reservas con esta implementación. | Confirmado estáticamente; no se intentó escribir. | Definir y completar el flujo transaccional de reserva antes de considerar operativas las historias. |
| H-02 | ALTO | CRUD de hoteles sin autenticación/autorización; Security comentado y clase vacía. `B/pom.xml:63–72`, `BJ/configuration/SecurityConfig.java:3–5`, `controller/HotelController.java:32–61`. | El código no restringe cambios administrativos a administradores. | Evidencia estática suficiente de ausencia de controles; no se atacaron endpoints de escritura. Alcance de red configurado local. | Implementar identidad/roles y protección backend; verificar con pruebas en entorno aislado. |
| H-03 | ALTO | Frontend usa datos fijos y no consume la API. `FS/components/HotelSection.tsx:3–22`, `RoomSection.tsx:19–23`, `pages/Rooms.tsx:23–30`; búsqueda global sin cliente HTTP. | Catálogo y administración no reflejan persistencia; botones de negocio no operan. | Confirmación estática, no ensayo visual. | Acordar contratos, IDs y manejo de errores; integrar progresivamente. |
| H-04 | ALTO | Sin disponibilidad por intervalo, estados controlados ni protección de concurrencia. `BJ/entity/Room.java:43–44`, `Reservation.java:35–55`, ReservationRepository vacío de consultas propias. | HU-02 y creación segura de reservas carecen de base; una futura escritura ingenua podría sobreasignar inventario. | Falta confirmada; no se afirma sobreventa real. | Definir intervalos, estados bloqueantes y garantías transaccionales compartidas. |
| H-05 | ALTO | Registro/login y pago no implementados; AuthService devuelve null; PaymentService vacío. `BJ/service/imp/AuthServiceImp.java:12–14`, `PaymentServiceImp.java:7–9`. | HU-01 no puede apoyarse en cliente autenticado ni checkout real. | Estática; no hay sesiones o pagos probados. | Definir perfil, autenticación y alcance de pago antes de métodos guardados. |
| H-06 | ALTO | No hay canal de histórico fiable: campos nullable, sin auditoría automática, eventos ni tarifa pactada. `BJ/entity/Reservation.java:35–45`, `Room.java:40–44`; estadísticas fijas `FS/components/Dashboard.tsx:7–37`. | Impide sustentar hoy una previsión validada de demanda y reconstruir ciertas métricas pasadas. | Modelo confirmado; población real no consultada. | Auditar datos en lectura, definir métricas y retención histórica antes de entrenar o extrapolar. |
| H-07 | MEDIO | Falta validación de hotel: solo cuerpo nulo; se acepta ID en creación. `BJ/controller/HotelController.java:33–38`, `HotelServiceImp.java:63–69`. | Datos incompletos/rating fuera de rango y semántica de creación ambigua. | Código confirmado; entradas malformadas persistentes no ensayadas. | DTO de creación, restricciones explícitas y validación de negocio. |
| H-08 | MEDIO | Excepciones inconsistentes y mensajes internos. `HotelController.java:54–55,65–68,102–105`; `HotelServiceImp.java:100–101,108–109`. | 500 ante ausencia en update, errores de delete mal clasificados; posible exposición de detalles en errores. | Estático; mensajes sensibles concretos no observados. | Excepciones de dominio y handler global con 400/404/409/500 coherentes. |
| H-09 | MEDIO | CORS solo permite localhost. `BJ/controller/HotelController.java:23`. | Si se integra API desde 127.0.0.1:5173, el navegador recibirá rechazo. | **GET con Origin 127.0.0.1:5173 → 403; localhost → 204.** | Acordar orígenes locales y desplegados por configuración. |
| H-10 | MEDIO | Riesgos de build: `useState([])` y asignación de strings, import SideBar/Sidebar e imports sin uso. `Search.tsx:21–30`, `pages/AdminPanel.tsx:7`, `F/tsconfig.app.json:18–20`. | Puede impedir build estricto o resolución en Linux. | Diagnóstico estático; no se declara build ejecutado ni error de arranque confirmado. | Confirmar typecheck en copia aislada y corregir posteriormente. |
| H-11 | MEDIO | Cascade.ALL en Hotel→Room/Review y User→Reservation/Review; sin política de retención. `BJ/entity/Hotel.java:42–47`, `User.java:37–42`. | El borrado puede propagarse; con referencias de reservas también puede fallar por FK. Histórico no protegido por una política explícita. | Resultado depende del esquema/datos; no se borró nada. | Definir baja lógica/retención y comportamiento de relaciones antes de habilitar borrados. |
| H-12 | MEDIO | Credenciales de desarrollo incrustadas en configuración y guía; logs SQL y debug detallados. `compose.yaml:7–10,26–30`, `B/src/main/resources/application.properties:6–10,19–21`, `INICIO-LOCAL.md:17–18`. | Configuración inadecuada para distribución productiva y riesgo de exposición en diagnósticos. | Presencia estática; valores omitidos aquí. No se afirma que sean credenciales productivas. | Externalizar configuración sensible, revisar registros y separar perfiles. |
| H-13 | MEDIO | Sin suite de negocio/CI; un único contextLoads. `B/src/test/java/app/mnhotel/hotel_reservation_system_backend/HotelReservationSystemApplicationTests.java:6–11`, `F/package.json:6–10`. | Regresiones y nuevas historias sin verificación automatizada suficiente. | Inventario estático, ninguna suite ejecutada. | Añadir pruebas significativas y entorno aislado antes de cambios de negocio. |
| H-14 | MEDIO | Carruseles usan límites de escritorio independientemente de visibleCount. `FS/components/SliderHotels.tsx:57–73`, `SliderPlaces.tsx:17–32`. | En móvil hoteles solo alcanza índices 0–2 (3 de 6); destinos solo índices 0–5 (6 de 10). | Deducido directamente de límites y slices; no probado visualmente. | Calcular límites a partir de cantidad visible y reaccionar a redimensionamiento. |
| H-15 | BAJO | Grafía incompatible availbility/availability. `BJ/entity/Room.java:43–44`, `dto/RoomDTO.java:17`. | Futuro mapping y contratos pueden desalinearse. | Ambos nombres comprobados; no hay mapper de Room aún. | Planificar normalización compatible con esquema real. |
| H-16 | BAJO | bin con .class/configuraciones versionadas y divergentes; guía local/Compose no versionados. Inventario Git y hashes. | Confusión sobre fuentes, configuración reproducible y entrega del entorno. | Confirmado en Git; no se modifica ni elimina. | Definir fuentes canónicas y política de artefactos/configuración. |
| H-17 | BAJO | Ruta comodín ausente y acciones/enlaces de navegación incompletos. `FS/App.tsx:15–21`, `Header.tsx:46–60`, `Footer.tsx:48–56`. | Rutas desconocidas y controles móviles/pie sin comportamiento completo. | Estático; ErrorPage no está conectado. | Completar navegación y accesibilidad después de priorizar negocio. |

### Consideraciones de seguridad que requieren matiz

`User.password` es un String persistible (`BJ/entity/User.java:28–29`), sin encoder encontrado y sin `@JsonIgnore` en ese campo. **No se concluye que existan contraseñas almacenadas en texto plano o expuestas:** no hay alta de usuarios implementada, no se inspeccionaron registros y no existe endpoint que serialice User. Debe incorporarse hashing y exclusión de serialización al implementar identidad.

No se encontró control de pertenencia de reservas, pero tampoco hay endpoint de reservas que permita demostrar acceso a reservas ajenas. No se afirma un IDOR reproducido. CORS limita orígenes de navegador; no sustituye autenticación de administradores. No se realizó análisis de CVE ni se afirma ausencia/presencia de vulnerabilidades en dependencias.

## 10. Estado de las historias de usuario

### HU-01 — Eric: reservar con datos guardados

**Estado:** no implementada; complejidad **alta** en el contexto actual.

- Reutilizable: entidad User y UserDTO para identidad básica, Reservation para relación cliente/habitación y Payment como punto conceptual de enlace con pagos. El detalle de habitación ofrece ubicación visual para iniciar la reserva.
- No existe perfil de facturación/contacto completo, autenticación, checkout, proveedor de pago ni almacenamiento seguro de referencias reutilizables. Username/email no cubren un formulario de pago.
- Información pendiente: qué datos se guardan, edición/consentimiento, identidad del propietario, significado de reservar directamente, si existe cobro real o simulación académica, validaciones de contacto/facturación y gestión de errores/reintentos.
- Dependencias: autenticación/autorización, creación transaccional de reservas, cálculo del importe, contratos de datos y, si aplica, tokenización del proveedor. No debería diseñarse como almacenamiento de número de tarjeta/CVV en este modelo.
- Riesgos: datos de un cliente usados por otro, exposición de información personal, duplicación por reintentos y divergencias entre precio mostrado/cobrado.
- Conflictos: comparte estados, importe y transacción de reserva con HU-02; los estados de confirmación/pago afectan los conteos de HU-03. Requiere acuerdos comunes antes de implementar en paralelo.

### HU-02 — Yini: calendario dinámico

**Estado:** no implementada; complejidad **alta** para la historia completa. El calendario visual aislado sería menor, pero no resuelve disponibilidad segura.

- Reutilizable: fechas HTML en Search y RoomDetailComponent; relaciones Room→Hotel y Reservation→Room, startDate/endDate; RoomRepository y ReservationRepository como puntos de ampliación.
- No existe calendario dinámico, biblioteca específica, endpoint de ocupación ni consulta de solapamientos. `availbility` no representa cada fecha.
- Información pendiente: reservar una habitación concreta o un tipo/cupo, tratamiento de checkout, zona/horario del hotel, restricciones de estancia, estados que bloquean inventario, mantenimiento y capacidad.
- Dependencias: catálogo persistente con IDs, reglas compartidas de intervalos/estado, agregación por rango y nueva validación al confirmar. El calendario por sí solo no evita carreras entre usuarios.
- Riesgos: datos obsoletos, falsos días ocupados/libres, errores de límite de fecha, rendimiento de rangos y sobreasignación concurrente.
- Conflictos: HU-01 debe revalidar disponibilidad al reservar directamente; HU-03 debe usar exactamente los mismos criterios de noches e inventario, pero sin confundir disponibilidad futura con demanda pronosticada.

### HU-03 — Yoel: previsión de demanda

**Estado:** no implementada; complejidad **alta**.

- Reutilizable: Dashboard como lugar de presentación, estructura AdminPanel y asociaciones de Reservation/Room/Hotel; repositorios como candidatos a agregaciones.
- No existe un gráfico real, endpoint estadístico, proceso de previsión ni histórico verificado.
- Información pendiente: definición de demanda, ámbito por hotel/tipo, fecha de corte, estados incluidos, zona horaria, ocho semanas realmente disponibles, inventario operativo y criterio de evaluación de 30 días.
- Dependencias: proteger administración, verificar/calificar datos en PostgreSQL, acordar métricas con HU-02 y reglas de reserva/cancelación con HU-01, definir contrato agregado y tratamiento de muestras insuficientes.
- Riesgos: interpretar ausencia de datos como demanda cero, usar solo reservas confirmadas como demanda total, fuga de información futura al validar, sesgo por capacidad agotada y mostrar precisión inexistente.
- Conflictos: los cambios de estados/cancelaciones y de inventario pueden cambiar el histórico y los denominadores. Si luego se ajustan precios/inventario, habrá que distinguir esos efectos de los cambios de demanda. No se recomienda cambiar arquitectura ni seleccionar algoritmo durante esta auditoría.

## 11. Análisis profundo de HU-03

### 11.1 Respuestas sobre datos actuales

| Pregunta | Hecho verificado y límite |
|---|---|
| ¿Qué histórico se almacena? | El modelo permite filas de reserva con usuario, habitación, entrada/salida, estado y createdAt. No hay eventos ni versiones de reserva. Existencia/cantidad/calidad de filas reales sin verificar. |
| ¿Fecha de creación? | Campo `created_at` presente (`Reservation.java:44–45`); no se encontró inicialización automática ni obligatoriedad. |
| ¿Entrada y salida? | `start_date`/`end_date`, LocalDateTime (`35–39`); sin reglas de orden, zona de hotel o semántica de noche definidas. |
| ¿Estados y cancelaciones? | String status (`41–42`); sin catálogo, transición ni fecha de cancelación. Una cancelación podría representarse con un valor futuro, pero no hay lógica implementada que lo haga. |
| ¿Cómo se representan hoteles/habitaciones? | Hotel tiene muchas Room; Room referencia Hotel; cada Reservation referencia una Room. No hay reservas multihabitación agrupadas ni inventario por tipo. |
| ¿Ocupadas por fecha? | Potencialmente pueden contarse habitaciones distintas con reservas que cubran cada día, si hay fechas/estados válidos. No existe consulta implementada; eso daría ocupación reservada, no estancia real. |
| ¿Capacidad total por hotel? | Puede contarse rooms actual si hay datos íntegros. No hay capacidad temporal, camas/personas en entidad, aperturas/cierres ni mantenimiento por intervalos. |
| ¿Precios históricos? | Solo precio actual de Room e importe de Payment; este último no es una tarifa nocturna histórica ni distingue noches/moneda. Reserva no fija precio contratado. |
| ¿Datos suficientes para estimar futuro? | No demostrado: no se inspeccionó histórico y no hay flujo implementado que lo genere normalmente. El esquema ofrece una base parcial, no suficiencia estadística. |
| ¿Estadísticas o gráficos reutilizables? | Dashboard es plantilla fija. No hay librería gráfica directa ni consultas de estadísticas. |
| ¿Candidatos técnicos? | ReservationRepository para extracción/agregación; ReservationService/Imp para un futuro servicio de dominio; RoomRepository/HotelRepository para inventario/ámbito; AdminPanel/Dashboard para presentación. Son candidatos, no un diseño aprobado. |
| ¿Límites principales? | Campos opcionales/no automáticos, sin auditoría de estados, inventario temporal o precios históricos; ausencia de consultas/API de estadísticas, seguridad y pipeline de reservas. |

### 11.2 Conceptos que deben mantenerse separados

| Concepto | Unidad / fecha de referencia | Qué permitiría calcular el modelo y qué falta |
|---|---|---|
| Reservas realizadas | Número de registros creados por día/semana según createdAt | Requiere createdAt poblado; no equivale a noches ni permite saber estado a un corte pasado sin eventos. |
| Noches reservadas | Suma de noches de las estancias por fecha de servicio | Una reserva de 3 noches aporta 3 habitación-noches. Requiere convenio sobre checkout y estados; no debe contarse como 3 reservas. |
| Ocupación reservada | Habitaciones comprometidas en un día / inventario operativo de ese día | El numerador se puede derivar condicionalmente; el denominador histórico operativo no está modelado. |
| Ocupación real | Habitaciones realmente utilizadas en una fecha | No se deduce de reservar: faltan estancia efectiva, no-show y llegadas/salidas reales. |
| Demanda estimada | Solicitudes o habitación-noches futuras esperadas para una fecha y ámbito | Es una estimación, no un dato observado. Reservas aceptadas no incluyen búsquedas sin compra, solicitudes rechazadas ni demanda perdida por falta de cupo. |

Como **convención candidata para discutir**, si se reserva por noches podría usarse entrada inclusiva y salida exclusiva: una estancia del 10 al 12 ocupa las noches del 10 y 11. El repositorio actual **no fija esa convención**. Para un intervalo de día, la idea de solapamiento sería inicio anterior al fin del día y final posterior al inicio del día; habría que adaptar el cálculo a la semántica y zona acordadas. No se ejecutó SQL ni se cambió ninguna regla.

Si existen dos reservas solapadas sobre la misma habitación, contar filas sobrestima inventario comprometido; contar habitaciones distintas evita ese doble conteo en una métrica de ocupación, pero también debe señalarse la inconsistencia. La auditoría no comprobó que esos registros existan.

### 11.3 Ocho semanas de entrenamiento y próximos 30 días

**Respuesta actual: no puede verificarse la viabilidad con los datos accesibles.** No se conoce si hay al menos 56 días de observaciones válidas, cuántas habitaciones tienen reservas, qué estados se usan ni qué campos están completos. La API de hoteles devolvió colección vacía, pero no se consultaron reservas. Ocho semanas completas tampoco garantizan una previsión fiable: solo aportan ocho repeticiones por día de semana y no permiten validar estacionalidad anual.

El periodo debe definirse respecto de un corte explícito: últimas ocho semanas anteriores al corte para observar datos y siguientes 30 días para el horizonte. Hay que decidir si se aprende de **creación de reservas** o de **fechas de estancia**. Mezclar ambas series produce una conclusión distinta a la solicitada. Las reservas ya existentes para días futuros son compromisos conocidos, no una predicción de nuevas solicitudes.

Para una evaluación honesta a un corte histórico se necesitaría saber qué se conocía entonces. `createdAt` permitiría excluir reservas creadas después, si es fiable; el status actual, sin historial de cancelaciones/modificaciones, no permite reconstruir con precisión el inventario comprometido conocido en ese corte. Tampoco hay fecha de cancelación para medir ritmo de cancelaciones.

En una futura inspección PostgreSQL **de solo lectura**, convendría obtener agregados sin información personal:

1. Cantidad de reservas, mínimos/máximos de created_at y de fechas de estancia, porcentajes nulos y rangos inválidos.
2. Distribución de estados, reservas por hotel/habitación, referencias huérfanas y solapamientos.
3. Conteos diarios de reservas creadas y habitación-noches de estancia, separados y segmentados por hotel.
4. Inventario actual y qué datos externos permitirían reconstruir mantenimiento/cierres históricos.
5. Cobertura real de las 56 fechas, ausencia de días por falta de captura frente a días observados con cero, y fechas futuras ya comprometidas.

La consulta debería hacerse con conexión de lectura y, preferiblemente, transacción de solo lectura, sin arrancar Spring/Hibernate. No se realizó por falta de acceso al motor/cliente de base disponible. No se exige crear datos para esta auditoría.

### 11.4 Alternativas a evaluar después, sin elegir algoritmo

- Si existe histórico suficiente: comparar referencias sencillas basadas en nivel/semana/día con otras alternativas, usando separación temporal y métricas adecuadas. La selección requiere conocer volumen, dispersión y objetivo.
- Si no hay histórico: instrumentar captura futura, usar un conjunto sintético en base aislada para demostrar la interfaz con etiqueta explícita de simulación, o aceptar una pantalla de datos insuficientes. Una demostración sintética no acredita precisión predictiva real.
- Si solo hay algunas reservas futuras: presentar reservas conocidas como agenda de compromisos y separarlas de cualquier estimación. No llamarlas demanda pronosticada.
- Si solo se conoce inventario actual: limitar alcance y declarar que la ocupación histórica calculada con ese denominador es una aproximación, hasta disponer de capacidad temporal.
- HU-03 puede informar decisiones de precios/inventario sin ejecutar ajustes automáticos; la historia pide visualizar previsión. Cualquier automatización de precios sería otro alcance.

No se seleccionó definitivamente un algoritmo, no se incorporó librería y no se modificó la arquitectura.

## 12. Recomendaciones técnicas

Orden propuesto para trabajo posterior, **sin ejecución automática**:

1. Obtener visibilidad de solo lectura sobre Docker y PostgreSQL para completar el diagnóstico: contenedores, logs, esquema y agregados de calidad/cobertura histórica. Aclarar procedencia de los procesos que responden HTTP.
2. Establecer qué funcionalidades de negocio se exige completar como base académica. No planificar las tres historias suponiendo reservas, pagos o usuarios operativos.
3. Definir identidad, roles administrativos y propiedad de recursos; proteger escrituras antes de habilitar interfaces administrativas reales.
4. Acordar contratos comunes de hotel/habitación/cliente/reserva: IDs, estados, fechas/checkout/zona horaria, inventario operativo y precios/moneda. Conservar decisiones compartidas por HU-01/02/03.
5. Preparar entorno de pruebas aislado y verificar compilación/typecheck. Resolver después los problemas de tipos, mayúsculas y validación identificados, con autorización de desarrollo separada.
6. Completar catálogo persistente e integración frontend–API, y después creación/consulta/cancelación de reservas con validación transaccional y concurrencia.
7. Definir datos guardados y alcance de pagos de HU-01; distinguir perfil del cliente de referencias seguras de pago.
8. Implementar la fuente de disponibilidad que sirva a HU-02 y a la confirmación de reserva, con criterios temporales compartidos.
9. Para HU-03, acordar métrica y corte, verificar ocho semanas reales, definir retención/auditoría e inventario temporal; solo entonces evaluar métodos y diseñar gráficos/contratos agregados protegidos.
10. Añadir pruebas de negocio/seguridad y CI, documentar arranque reproducible, tratar configuración sensible y revisar artefactos bin/versionado. Cualquier limpieza de archivos o cambio de Compose queda fuera de esta auditoría.

## 13. Evidencias y verificaciones

### 13.1 Estado Git y alcance de escritura

La primera consulta Git desde la carpeta exterior falló con `fatal: not a git repository`; se localizó la raíz efectiva interior y se repitió allí. No fue un fallo del proyecto.

**Estado inicial observado en la raíz Git:**

```text
Rama: base
HEAD: 2f82bdb96836991b1051ebaa918859c9f5a3dc6c
?? INICIO-LOCAL.md
?? compose.yaml
```

`git diff --stat` no mostró cambios rastreados. Los dos archivos anteriores **ya existían antes de la auditoría**; se leyeron y no se editaron. El único archivo nuevo autorizado y generado por esta auditoría es `docs/auditorias/AUDITORIA_INICIAL.md`. No se realizaron commits, push, cambios de rama ni operaciones Git de configuración.

La verificación final se basa en `git status --porcelain=v1 --untracked-files=all`, `git diff --stat`, rama y HEAD. El estado esperado tras crear este documento es el inicial más:

```text
?? docs/auditorias/AUDITORIA_INICIAL.md
```

La comparación final ejecutada después de crear el archivo se detalla al cierre de este apartado. Git verifica archivos rastreados y no ignorados; no equivale a una medición integral de escrituras internas de servicios o cachés ignoradas.

### 13.2 Comandos de lectura ejecutados

Los comandos se ejecutaron desde la carpeta exterior salvo los que indican raíz Git. Se agrupan por finalidad; no se incluyen contenidos sensibles ni instrucciones de escritura.

| Comando / operación | Resultado significativo |
|---|---|
| `Get-Location`, `Get-ChildItem -Force`, `rg --files` y variantes con `--hidden` y exclusiones | Localización de raíz Git, estructura y archivos de código/configuración. |
| `rg --files ... -g AGENTS.md` | No se encontró AGENTS.md en el ámbito inspeccionado. |
| `git -C hotel-reservation-system status --porcelain=v1 --untracked-files=all` | Estado inicial indicado; repetido durante auditoría sin cambios adicionales antes del documento. |
| `git ... branch --show-current`, `rev-parse HEAD`, `log -1`, `diff --stat`, `ls-files` | Rama base, HEAD indicado, ausencia de modificaciones rastreadas y archivos bin versionados. |
| `Get-Content` con numeración sobre fuentes, POM, package.json, Compose y guías | Evidencia estática de arquitectura, endpoints, entidades, stubs y UI fija. Properties se leyó con redacción de valores sensibles. |
| Búsquedas `rg -n` de mappings, clientes HTTP, estado, sesiones, validación, seguridad, TODO, eventos y pruebas | Solo mappings Hotel; no cliente HTTP ni autenticación/JWT implementada encontrados. |
| Búsqueda de Dockerfile, SQL, migraciones y workflows | Compose local presente; no archivos equivalentes encontrados para los otros elementos. |
| `Get-FileHash` de POM y properties principales frente a copias bin | Ambos pares difieren; no se mostró ni utilizó configuración sensible de bin. |
| `Get-Command psql,node,java` y `Test-Path` de tsc/eslint locales | psql no encontrado en PATH; node/java localizados; tsc/eslint locales ausentes. La ruta de Java no verifica su versión ni la de un contenedor. |
| Lectura JSON de lockfile con Node por stdin, sin archivo temporal | Versiones exactas de React, Router, Vite, TypeScript, Tailwind y ESLint indicadas en sección 3. |
| `docker context show` | desktop-linux. |
| `docker ps -a --format ...` | Acceso al motor denegado. |
| `docker compose -f hotel-reservation-system/compose.yaml ps --all` | Acceso al motor denegado. |
| `docker compose -f hotel-reservation-system/compose.yaml logs --tail 30 --no-color backend frontend postgres` | Acceso al motor denegado; no se obtuvieron logs. |
| `Invoke-WebRequest -Method Get` / GET implícito, timeout 8 s | Respuestas indicadas en tabla siguiente; sin autenticación ni cuerpos de escritura. |

Una lectura inicial del lockfile con ConvertFrom-Json de PowerShell falló por incompatibilidad de claves; un primer `node -e` falló por transferencia de comillas del shell. Se resolvió leyendo JSON mediante Node por stdin, sin instalar paquetes ni crear archivos. Estos errores de herramientas **no se atribuyen al código del proyecto**. Una búsqueda con comillas sobre lockfile tampoco devolvió coincidencias; no se usó esa ausencia como evidencia de dependencias faltantes.

### 13.3 Resultados HTTP realmente observados

| URL / condición | Resultado | Alcance de la conclusión |
|---|---|---|
| `http://127.0.0.1:5173/` | 200, Content-Type text/html, 683 bytes; cliente Vite y título HOTEL MN | Servicio HTTP de desarrollo accesible; no prueba visual de React. |
| `http://127.0.0.1:3000/api/hotel/get-all` sin credenciales | 204, cuerpo vacío | Comportamiento de colección vacía accesible. |
| `http://127.0.0.1:3000/api/hotel/get-hotel/0` | 404 | Caso de ID no encontrado; no se muestra cuerpo con información personal. |
| `http://127.0.0.1:3000/api/hotel/get-hotel/abc` | 400 | Rechazo de identificador no convertible a Long. |
| GET get-all con `Origin: http://localhost:5173` | 204 y Access-Control-Allow-Origin con ese origen | Origen configurado aceptado. |
| GET get-all con `Origin: http://127.0.0.1:5173` | 403 | Origen alternativo rechazado. |

No se enviaron POST/PUT/DELETE, login, tokens ni solicitudes de creación de sesión. Los GET pueden producir logs/cachés normales del servidor existente; no contienen una operación de cambio de datos de negocio según los handlers revisados. No se inició una aplicación o base de datos para realizar estas comprobaciones.

### 13.4 Archivos inspeccionados y limitaciones

Se inspeccionaron el README raíz, INICIO-LOCAL, Compose, manifiestos/lock/configuración del frontend, App/main, las cinco páginas, componentes de navegación, búsqueda, filtros, carruseles, tarjetas, detalle, administración, estilos y sus referencias; todos los archivos Java principales de entidades/DTOs/controllers/repositorios/servicios/configuración/respuestas/excepción; properties, POM, wrapper y única prueba de backend. El inventario Git también identificó binarios/copias bin; **no se descompilaron .class ni se consideraron implementación vigente**. Imágenes/SVG decorativas no aportan pruebas de negocio.

Limitaciones explícitas: sin acceso al motor Docker, sin consultas SQL, sin inspección visual de navegador, sin compilación/lint/tests, sin pruebas de escritura ni verificación de CRUD con datos reales. No se contrastaron los binarios de servicios vivos con HEAD. No se inspeccionó contenido personal de tablas ni se publicaron contraseñas, tokens, cadenas de conexión o valores de credenciales. No hubo consultas externas de vulnerabilidades, repositorio remoto ni despliegue.

**Cierre de integridad:** tras generar el documento se verificó que rama/HEAD permanecen iguales y que el único archivo nuevo respecto al estado inicial es este Markdown; no hay cambios rastreados. Los dos archivos locales iniciales continúan sin seguimiento y no fueron modificados por la auditoría.

## 14. Conclusión

- **¿El proyecto está funcionando actualmente?** Parcialmente a nivel de servicios HTTP. No está completo como sistema de reservas: la funcionalidad central no está implementada en el código auditado.
- **¿Qué funciona de manera comprobada?** Entrega HTTP del frontend; lectura de colección vacía de hoteles; respuestas 404/400 de búsqueda por ID; CORS para localhost. No se amplía esa conclusión a navegación visual, CRUD completo o reservas.
- **¿Qué falla de manera comprobada?** Una petición de lectura con Origin 127.0.0.1:5173 obtiene 403. El acceso de esta auditoría al motor Docker es denegado, lo que es una limitación del entorno de inspección y no un fallo demostrado de los contenedores. No se reprodujeron otras excepciones de negocio mediante escritura.
- **¿Qué existe pero no se ha verificado?** CRUD de escritura de hoteles, recuperación de hotel existente, montaje/navegación React, esquema PostgreSQL efectivo, pruebas de carga de contexto y estado de contenedores/volúmenes. Las entidades no prueban que sus casos de uso existan.
- **¿Qué partes están incompletas?** Integración frontend–backend, catálogo persistente de habitaciones, identidad/roles, reserva/cancelación, pagos, perfiles guardados, reseñas, calendario de disponibilidad y estadísticas. Dashboard y administración son principalmente presentación de ejemplo.
- **¿Qué tan preparado está para las nuevas historias?** Tiene una base tecnológica y un modelo conceptual reutilizable, pero requiere trabajo previo importante. Las tres historias completas tienen complejidad alta por las funcionalidades base ausentes.
- **¿Cuáles son los principales obstáculos para Yoel?** Histórico real no verificado, ausencia de generación/auditoría fiable de fechas y estados, falta de inventario temporal y precios históricos, métricas de demanda aún ambiguas, dashboard fijo y ausencia de agregaciones/API protegida. No se ha demostrado disponer de 56 días válidos para pronosticar 30 días.
- **¿Qué deberíamos hacer primero?** Completar la inspección de solo lectura de Docker/PostgreSQL y acordar el alcance mínimo compartido, las métricas y las reglas de reserva. Después planificar seguridad, catálogo e infraestructura de reservas y pruebas aisladas; diseñar HU-03 a partir de la calidad real del histórico. Ninguna de esas modificaciones se ha aplicado durante esta auditoría.
