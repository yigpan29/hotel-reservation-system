# HU-04: constancia de reserva

Refs #6. Como cliente con reservas registradas, quiero descargar una constancia con los datos y el estado actual de una reserva propia, para conservar una copia de los detalles de mi estancia.

En **Mis reservas**, usar **Descargar constancia #ID**, tanto para reservas confirmadas como canceladas. El PDF incluye hotel, habitación, titular, fechas, estado, precios pactados y fecha de cancelación si existe. Los importes heredados ausentes se muestran como «No registrado»; nunca se calculan con la tarifa actual. Es una constancia informativa, no una factura ni prueba de pago.

La presentación formal incluye encabezado HOTEL MN, referencia de reserva,
franja de estado, tablas de estancia y registro, resumen de importes con total
destacado y pie con numeración. Las celdas se ajustan al texto; los encabezados
y el pie se repiten si se necesita otra página. La cancelación se distingue
con una franja roja y conserva su fecha en la tabla de registro.

`GET /api/reservations/{id}/certificate` requiere sesión y propiedad de la reserva; no concede excepción a administradores. Responde `application/pdf`, adjunto `constancia-reserva-ID.pdf`, `Cache-Control: no-store, private`. Devuelve 401 sin sesión, 403 para otra persona y 404 si no existe. GET solo lee: no requiere token CSRF; las operaciones que escriben siguen protegidas.

Se utiliza Apache PDFBox 3.0.8, según [documentación oficial](https://pdfbox.apache.org/3.0/getting-started.html). No se almacenan PDFs en el servidor ni se modifica el esquema. Las fuentes PDF estándar soportan español; glifos fuera de su repertorio se sustituyen por `?`, sin provocar errores. El texto largo se divide entre líneas y páginas.

## Validación

Pruebas `ReservationCertificateTests`: contenido extraído del PDF, precios guardados pese a cambiar tarifa actual, no modificación de reservas/pagos, cancelación, importes heredados ausentes, texto largo, sesión, acceso ajeno incluyendo administrador, recurso inexistente y CSRF en cancelación. Se genera muestra sintética y render PNG en `.local/isolated-artifacts/backend/hu04/`.

El recorrido Playwright existente descarga la constancia confirmada y cancelada desde la interfaz real. Ejecutar `tests/isolated/run.ps1`; solo utiliza PostgreSQL tmpfs del proyecto `hotel-reservation-system-test`. Los resultados de ejecución se registran en el AI Development Log; este documento no sustituye las evidencias.

HU-04 parte de `base` y no incorpora HU-01/HU-05 ni historias de `main`. El único componente compartido modificado es `ReservationList` con una opción de descarga habilitada en `MyReservations`; el endpoint tiene controlador independiente para reducir solapamiento.

Resultado del 28/10/2026: 47 pruebas Maven, una de compatibilidad y 8/8 Playwright; TypeScript, lint y build correctos. [Muestra sintética y explicación](evidencias/hu04/README.md). Pendiente revisión humana del PR; no se fusionó.
