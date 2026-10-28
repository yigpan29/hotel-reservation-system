# Propuesta de integración HU-01/HU-04 sobre main

Fecha: 28/10/2026, America/Panama. Responsable de HU-01 y HU-04: Eric.
Estado actual: integración implementada y verificada sobre `fc74de3` (PR #16
fusionado por humano). Este documento conserva abajo el diagnóstico histórico
de `7c892ea`; sus bloqueos ya resueltos no describen el main actual.
No hay autorización para reparar bases de desarrollo.

## Resultado actual (28/10/2026)

- Capacidad V3, huéspedes V4, tipo V5 e historial V6 conservados sin modificar SQL.
- Checkout V8 con pedidos/líneas, un pago por grupo, confirmación conjunta,
  snapshots por habitación, métodos autorizados y devoluciones parciales.
- Calendario, huéspedes, demanda y constancias PDF formales conservados.
- Conflictos resueltos con aprobación expresa de Eric: conservar ambas historias,
  dependencias, seguridad combinada y ambos bloques completos del AI log.
- Validación aislada: 110 JUnit + una compatibilidad, 117 Vitest,
  TypeScript/lint/build y 15 Playwright correctos; instalación/adopción y esquema
  completo V1–V6/V8 con datos y secuencias preservados.
- Nueve escenarios API contra Stripe sandbox pasaron, incluido webhook real que
  capturó sin sync tras autorizar y con worker demorado. Tres pagos test totalmente
  reembolsados por habitación; limpieza sin errores. Pendientes Stripe.js/3DS
  interactivo. Los E2E interceptados y JUnit con dobles no son evidencia Stripe.
- PR #9 HU-05 sigue fuera de main: reservar V7 exige coordinación con Yoel;
  no desplegar V8 a una base compartida antes de coordinar V7. No se implementan
  ni se afirman probadas sus notificaciones. Bases con V3 histórico requieren
  adopción revisada aparte; no se ejecutó repair.
- PR #17 de diseño está abierto y modifica archivos compartidos: App.tsx,
  RoomDetails, MyReservations, ReservationList, ReservationSummaryModal y estilos.
  No se incorporó su rama sin fusionar. Volver a comparar antes de fusionar el PR.
- Demos anteriores y sus datos conservados; nueva demo combinada en 127.0.0.1:55177.
  Ningún push a main/base ni merge de PR realizado por el agente.

## Cierre de antecedentes aprobado por Eric

Los PR #13 y #14 se cerraron sin fusionar, conservando sus ramas e historial.
La revisión de HU-01/HU-04 continúa en el PR #18 en borrador hacia main.
No hubo retarget ni merge hacia base; sus conflictos se documentaron y Eric
eligió conservar la entrega combinada. HU-05 permanece fuera de esta entrega;
la coordinación V7/V8 y notificaciones sigue pendiente para despliegue compartido.

## Diagnóstico histórico (conservado)

## Referencias comprobadas

- Main: `7c892ea`, merge PR #15 desde base; contiene HU-02, HU-03 y HU-06.
- Base: `8682678`. HU-05/PR #9 sigue abierto, no está integrado en main.
- HU-01: PR #13, `4f82336`; HU-04: PR #14, `0a3fd73`.
- Rama de trabajo: `integ/hu-01-hu-04-main`, creada desde origin/main.
- Las ramas originales y sus demos se conservan. No se hace push a main/base,
  force push, merge de PR, auto-merge ni modificación de PostgreSQL de desarrollo.

## Bloqueo reproducido: numeración incompatible

| Origen | Archivo | Estado |
| --- | --- | --- |
| Main, HU-06 | V3__room_capacity.sql | Comparte V3 con HU-03 |
| Main, HU-03 | V3__tracked_demonstration_history.sql | Comparte V3 con capacidad |
| Main, HU-06 | V4__reservation_guests.sql | Ocupa V4 |
| Main, HU-06 | V5__reservation_room_type.sql | Ocupa V5 |
| PR #9, HU-05 | V4__reservation_notifications.sql | Colisiona con huéspedes |
| PR #13, HU-01 | V5__initial_checkout.sql | Colisiona con tipo de habitación |

Flyway 10.20.1, en un PostgreSQL tmpfs nuevo y separado, devuelve al validar:

```
Found more than one migration with version 3
V3__room_capacity.sql
V3__tracked_demonstration_history.sql
```

No se ejecutó migrate, repair ni SQL de modificación. La evidencia privada está
bajo `.local/migration-audit-validate.log` en este checkout. El PR #15 no reporta
checks; el workflow actual filtra PR solamente hacia base, no hacia main.

No basta renombrar un archivo: el comentario de V5 de huéspedes declara V3/V4
ya aplicadas en bases de desarrollo, y el AI log HU-03 registra su V3 aplicada
en otra instalación. Se deben inventariar ambos historiales antes de adoptar
una secuencia común. Un merge Git no unifica los historiales de las bases.

## Propuesta para acordar con Yini y Yoel

1. Cada responsable obtiene, solo en lectura, versión, script, checksum, tipo
   y éxito de flyway_schema_history, base conectada y estructura de las tablas
   rooms/reservations/reservation_demo_batches/reservation_demo_items. No
   compartir claves, datos de huéspedes ni respaldos privados en Git.
2. Conservar los archivos y checksums originales como evidencia. Elegir una
   secuencia canónica para instalaciones nuevas, antes de tocar los historiales.
3. Candidato A: mantener capacidad V3, huéspedes V4 y tipo V5; trasladar la
   procedencia de historial a V6, reservar V7 para HU-05 y V8 para HU-01.
   Requiere una adopción explícita y probada para las bases con V3 de HU-03.
4. Alternativa B: mantener V3 de HU-03 y renumerar las migraciones de huéspedes.
   Requiere adopción explícita de las bases que ya aplicaron la secuencia HU-06.
5. Elegir A o B tras comparar los historiales reales; ninguna es un arreglo
   automático ni debe ejecutarse por suposición. Diseñar un procedimiento por
   cada linaje, con respaldo verificado, validación de estructura y conservación
   de reservas, perfiles, precios y secuencias. No usar repair/outOfOrder como
   atajos ni alterar checksums para ocultar una estructura distinta.
6. Probar instalación nueva y adopción de ambos linajes en copias temporales;
   comparar datos/DDL, repetir migraciones y validar rollback o restauración.
7. Publicar primero la corrección coordinada hacia main. Las intervenciones en
   bases reales requieren autorización propia; no forman parte de este trabajo.

Esta propuesta no cambia ni renombra las migraciones integradas. Eric aprobó
preparar el diagnóstico y propuesta para revisión del equipo, no reparar bases.

## Decisiones de checkout aprobadas por Eric

- Conservar el calendario y selección de tipos y huéspedes de Yini.
- Un único pago por todas las habitaciones; confirmación conjunta.
- Cancelación por habitación con reembolso parcial de su importe.
- No incorporar HU-05 sin que su PR se integre y su migración se coordine.

## Adaptación funcional necesaria de HU-01

No basta conservar nuestro RoomDetails antiguo: perdería la selección múltiple.
Tampoco basta conservar el POST /reservations/group de main cuando checkout
está activo: confirmaría reservas sin cobrar, por fuera de HU-01.

La propuesta funcional es un pedido de checkout con elementos por habitación:

- Elegir habitaciones concretas y validar capacidades en backend, bloquearlas
  siempre en orden de ID y retener todas dentro de una transacción; si falla una,
  no retener ninguna. Guardar tipo, huéspedes, tarifa e importe por elemento.
- Crear un solo PaymentIntent por la suma de los elementos, con idempotencia y
  los métodos autorizados existentes. No llamar al proveedor con locks abiertos.
- Tras autorización, revalidar todas antes de captura. Tras captura verificada,
  confirmar todas en una transacción. Ante incompatibilidad posterior al cobro,
  tramitar devolución completa y no insertar un grupo parcialmente confirmado.
- Cada reserva conserva el vínculo con su elemento. Su cancelación registra un
  reembolso parcial duradero e idempotente por el importe pactado, sin cancelar
  las restantes. La suma de reembolsos nunca puede superar el pago capturado.
- Reconciliar outcomes desconocidos y devoluciones sin crear cobros adicionales.
  La elección de pago y consentimiento se integran en el resumen actual de HU-06.
- Bloquear ambos endpoints gratuitos de creación mientras checkout esté activo.
  La navegación de resultado debe listar las reservas del pedido; el historial
  y la constancia siguen disponibles por habitación.
- Cuando HU-05 se integre, emitir notificaciones de confirmación únicamente tras
  captura verificada y confirmación de todas, y de cancelación por reserva.

Pruebas necesarias: grupo con un solo pago y varias reservas; método guardado;
fallo de cualquier habitación sin reservas ni retención parcial; dos grupos
concurrentes; rechazo y 3DS; pérdida de respuesta de captura; importes y tipos
congelados; cancelación de una habitación sin cancelar las otras; reembolso
parcial repetido/concurrente y fallido; propiedad, CSRF y compatibilidad legacy.

## HU-04 y pruebas que se pueden conservar

El controlador PDF es independiente y sus accesores siguen existiendo en main.
ReservationList conserva tipo y huéspedes de HU-06 y añade el botón de descarga
solo en Mis reservas. En la prueba de navegador se conservan tanto la aserción
del tipo de habitación como la descarga del PDF; no se elimina ninguna cobertura.

La integración completa DB/JUnit/navegador no puede declararse verificada mientras
main contenga las dos V3. Las pruebas previas de cada HU no prueban esta combinación.
Comprobaciones realizadas: backend con HU-04 compila; frontend con HU-04 pasa
TypeScript, lint, build y 114/114 pruebas Vitest (nueve archivos, incluidas las
pruebas de calendario y huéspedes de Yini). No se presentan como validación de
pagos ni de migraciones integradas. La prueba de navegador conserva ambas
aserciones pero no se ejecuta contra un backend con Flyway inválido.

## Puerta de publicación

Mantener los PR #13/#14 en borrador. Una vez acordada y verificada la corrección
de migraciones, adaptar el checkout de grupo, ejecutar la suite aislada completa,
volver a consultar main/PR activos y preparar un PR único en borrador hacia main
que enlace #5/#6. No cerrar los originales hasta acordar su sustitución. Ampliar
la CI para PR hacia main y ejecutar también las pruebas Vitest de HU-02/HU-06.

## Actualización aprobada: historial V6

Eric eligió conservar capacidad V3, huéspedes V4 y tipo V5, moviendo solamente
historial a V6. La corrección está en fix/main-historial-v6 y sus commits de
código ya están incorporados en esta rama de integración. El SQL del historial
permanece idéntico. El duplicado descrito arriba sigue siendo el diagnóstico
histórico de main 7c892ea; desaparece en las ramas que incluyen esta corrección.

Las bases existentes con V3 de historial todavía requieren adopción revisada:
el cambio de nombre no transforma sus registros automáticamente. No se ha
modificado ninguna base de desarrollo ni se ha ejecutado repair. En ese momento V4 de HU-05 y V5 de checkout estaban pendientes; el resultado
actual usa V8 para checkout y reserva V7 para HU-05, sin cambiar la rama de Yoel.

La ejecución completa de pruebas de la corrección se registra en su AI log y
PR independiente. No se declara por ello implementado el checkout múltiple ni
verificada la futura combinación con HU-05.
