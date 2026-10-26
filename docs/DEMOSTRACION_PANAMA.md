# Catálogo educativo de Panamá

La carga es explícita: no forma parte de Flyway ni del arranque normal. No hay
pagos, afiliación ni conexión con los sistemas de los hoteles. El proyecto mantiene
sus migraciones V1/V2, sin cambios de esquema para estos datos.

## Información y procedencia

Nombres, ubicación general y descripciones breves se contrastaron el 25/10/2026
con las fuentes oficiales siguientes. Las descripciones son resúmenes propios;
no se copian fotografías, logos ni textos comerciales extensos. Se conservan los
gráficos decorativos existentes. No se cargan calificaciones (`rating=null`).

| Hotel | Ubicación | Fuente oficial |
|---|---|---|
| Hilton Panama | Avenida Balboa, Ciudad de Panamá, Panamá | [Hilton](https://www.hilton.com/es/hotels/ptyhfhh-hilton-panama/) |
| Waldorf Astoria Panama | Bella Vista, Ciudad de Panamá, Panamá | [Hilton, ubicación](https://www.hilton.com/en/hotels/ptytpwa-waldorf-astoria-panama/hotel-location/) |
| Marriott Panama Hotel | Albrook, Ciudad de Panamá, Panamá | [Marriott](https://www.marriott.com/en-us/hotels/ptymc-marriott-panama-hotel/overview/) |
| The Westin Playa Bonita Panama | Playa Bonita, Veracruz, Panamá Oeste | [Marriott](https://www.marriott.com/en-us/hotels/ptybw-the-westin-playa-bonita-panama/overview/) |
| Playa Blanca Hotel & Resort | Farallón, Río Hato, Coclé | [Sitio oficial, contacto](https://www.playablancaresort.com/es/contacto) |
| Radisson Colón 2000 Hotel & Casino | Colón 2000, Colón | [Choice/Radisson](https://www.choicehotels.com/panama/colon/radisson-hotels/pn010) |
| Hotel Panamonte | Avenida 11 de Abril, Boquete, Chiriquí | [Sitio oficial, contacto](https://panamonte.com/contactenos/) |
| Hotel Valle del Río | Bajo Boquete, Chiriquí | [Sitio oficial](https://www.valledelrioboquete.com/) |
| Hotel Ciudad de David | Centro de David, Chiriquí | [Sitio oficial](https://www.hotelciudaddedavid.com/) |
| Hotel Nacional David | Centro de David, Chiriquí | [Sitio oficial](https://www.hotelnacionaldavid.com/) |
| Hotel Bocas Town | Ciudad de Bocas del Toro, isla Colón, Bocas del Toro | [Sitio oficial](https://www.hotelbocastown.com/) |
| Tropical Suites | Ciudad de Bocas del Toro, isla Colón, Bocas del Toro | [Sitio oficial](https://bocastropical.com/) |

El modelo conserva una ubicación textual: no se inventan coordenadas ni categorías
oficiales. Todos los hoteles se crean activos. Cada descripción incluye un aviso
de demostración educativa, inventario/tarifas simulados y ausencia de afiliación.

**Son ficticios** los números y tipos de habitaciones, precios y disponibilidad.
Cada hotel nuevo recibe seis habitaciones: Individual, Doble, Matrimonial, Deluxe,
Familiar y Suite. Precios enteros en USD/B/., entre 65 y 285 por noche; no son
cotizaciones ni tarifas oficiales. Las habitaciones están activas; la disponibilidad
real dentro del proyecto sigue calculándose por reservas y fechas en el backend.
No se crean reservas durante la carga ni se consulta disponibilidad comercial.

## Cargar o repetir

Requiere los servicios de desarrollo ya arrancados, PostgreSQL con V1/V2 y Docker.
Desde la raíz del repositorio, en PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Load-PanamaCatalog.ps1 -ConfirmEducationalData
```

El script verifica los contenedores, el datasource exacto `hotel-bd` y V1/V2;
crea un respaldo custom privado bajo `.local/private-demonstration/`. Construye
la copia de aplicación del harness y ejecuta un contenedor de mantenimiento sin
montar el volumen de PostgreSQL, sin publicar puertos y sin reiniciar los servicios.
Las credenciales del datasource se heredan en memoria: no se imprimen ni aparecen
como valores en argumentos. El proceso sale al terminar gracias a `HOTEL_SETUP_EXIT`.
Las migraciones están deshabilitadas; Hibernate conserva `validate`.

La lógica está en `PanamaCatalog`, separada del aprovisionamiento administrativo;
los datos reproducibles están en `src/main/resources/demo/panama-hotels.json`.
Para otro entorno de demostración limpio, iniciar una copia de aplicación con:

```text
SPRING_PROFILES_ACTIVE=catalog-panama
HOTEL_CATALOG_CONFIRM=LOAD_EDUCATIONAL_PANAMA
HOTEL_CATALOG_DATABASE=hotel_demo
HOTEL_SETUP_EXIT=true
SERVER_PORT=0
```

Configurar su datasource privado ya migrado; el nombre declarado debe coincidir
exactamente con la conexión. Solo admite `hotel-bd`, `hotel_demo` o `hotel_test` y
rechaza perfiles `prod`/`production`. No combinarlo con perfiles de carga de cuentas.

La transacción serializa las ejecuciones con un advisory lock PostgreSQL. Identifica
hoteles por nombre o por las habitaciones `DEMO-<clave>-...`; ante coincidencias
ambiguas aborta. Un hotel existente coincidente se conserva íntegramente, incluyendo
sus habitaciones: no actualiza, reactiva ni repone inventario retirado manualmente.
Por ello puede reconocer un hotel renombrado conservando sus números DEMO. No
eliminar simultáneamente todas sus referencias de identificación antes de repetir
la carga; si se quiere sustituir completamente su identidad, revisar el catálogo
explícitamente. Una instalación con inventario propio coincidente no se sobrescribe
para forzar seis habitaciones. En una instalación vacía se crean 12 hoteles y 72
habitaciones; la repetición normal crea cero.

## Cuentas administrativas

La carga de catálogo no crea ni modifica usuarios. `yonielvegas` se promovió por
coincidencia exacta en una transacción autorizada; se comprobó que todos los campos
excepto rol permanecieran idénticos. No se usó su cuenta personal en pruebas.
Cerrar sesión y volver a entrar con su contraseña actual para renovar el rol de
la sesión. El menú **Administración** lleva a `/admin` y solo aparece con ADMIN.

`demo-admin` se aprovisiona por separado mediante el perfil `provision-admin`
documentado en [INICIO-LOCAL.md](../INICIO-LOCAL.md). Requiere una contraseña privada
elegida por el operador, BCrypt y correo ficticio `demo-admin@example.invalid`.
No hay contraseña por defecto para desarrollo. Una cuenta existente no se recrea
ni recibe una contraseña nueva automáticamente. Los secretos y respaldos bajo
`.local/` no se versionan ni se publican como artifacts.

Después de cargar el catálogo (que prepara la imagen de mantenimiento), el
operador puede introducir la clave con entrada oculta y aprovisionar la cuenta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Set-DemoAdminPassword.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Provision-DemoAdmin.ps1 -ConfirmDevelopmentAccount
```

La entrada se guarda únicamente en `.local/private-demonstration/demo-admin.password`;
es un archivo privado local, no un archivo de configuración versionado. No introducir
la contraseña en chat ni en argumentos. El aprovisionamiento crea un respaldo
privado y ejecuta el mecanismo BCrypt ya existente, sin migraciones ni reinicios
de servicios. Si la cuenta ya existe, solo verifica su rol; no cambia su contraseña
y falla si su rol no es ADMIN, para evitar una modificación implícita.

## Validación

Las pruebas `PanamaCatalogTests` usan únicamente `hotel_test`: autorización, destino,
12/72, repetición, modificaciones manuales, reserva/precio histórico y rechazo de
identidades ambiguas. El harness completo sigue ejecutando Maven, migraciones,
TypeScript, lint, build y Playwright. Resultados ejecutados y estado operativo:
[AI Development Log](AI_DEVELOPMENT_LOG.md). No se desarrollan HU-01, HU-02 ni HU-03.
