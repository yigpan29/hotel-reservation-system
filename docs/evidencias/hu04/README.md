# Evidencia HU-04

`constancia-confirmada.pdf` y su render `constancia-confirmada.png` proceden de
`ReservationCertificateTests.ownConfirmedPdfUsesStoredPricesAndDoesNotMutate`,
ejecutada el 28/10/2026 en PostgreSQL tmpfs `hotel_test`.

Hotel Panamá, usuario `pdf-owner` y reserva #1 son datos sintéticos de esa prueba,
no registros de desarrollo. La prueba verifica USD 85 por noche y USD 170 total,
aunque la tarifa actual de la habitación se cambia a USD 999 antes de descargar.
También comprueba que la descarga no modifica la fila de reserva ni crea pagos.
El PNG se inspeccionó visualmente para verificar legibilidad y ausencia de recortes.

Las muestras actuales corresponden al formato formal tabular solicitado por Eric
después de probar ambas demos. Se incorporan `constancia-cancelada.pdf` y su PNG.
La versión confirmada, la cancelada y otra con nombre de hotel largo y precios
ausentes se revisaron visualmente tras ejecutar las cinco pruebas de constancias
en el proyecto separado `hotel-reservation-system-hu04-format-test`. No se usó
la base de la demo del usuario para ejecutar esas pruebas ni se crearon nuevas
pruebas que solo repitan los detalles del diseño.
