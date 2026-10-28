# HU-01: checkout y reserva recurrente de pruebas

Responsable: Eric. Refs #5. Alcance actualizado expresamente: primer checkout,
consentimiento, guardado en Stripe y reserva recurrente. Se sustituyó la división
anterior en entregas por implementación completa; la verificación real con
credenciales sandbox sigue siendo obligatoria antes de declarar demostrada la HU.
Se utilizan Customer y PaymentIntent; no SetupIntent, suscripciones ni cobros off-session.
HU-02/HU-03/HU-04 permanecen fuera del cambio.

## Flujo y contrato de seguridad

Feature flag `HOTEL_CHECKOUT_ENABLED=false` por defecto: preserva la reserva sin
pago existente. Al habilitarla, el endpoint antiguo de creación devuelve 409;
la interfaz inicia el checkout. No existe fallback silencioso ante fallos de Stripe.
Las reservas históricas CONFIRMED no se reinterpretan como pagadas.

1. Sesión + CSRF + Idempotency-Key: validar fechas y tarifa, bloquear habitación,
   excluir reservas y retenciones solapadas e insertar checkout PENDING por 10 minutos.
2. Crear PaymentIntent en USD con captura manual e idempotencia basada en UUID.
   Se usa Stripe.js Payment Element: PAN/CVV van directamente a Stripe. El backend
   no recibe tarjeta, solo referencias y estado. Casilla desmarcada inicialmente:
   autorizar guardar el método para futuras compras confirmadas personalmente.
3. Autorización con 3DS si lo exige el banco. Ni `requires_action` ni `requires_capture`
   significan reserva pagada. Webhook firmado, consulta protegida o recuperación
   recuperan el estado actual desde Stripe, verifican modo test, importe, moneda,
   referencia interna y PaymentIntent.
4. Bajo bloqueo de habitación se valida retención y se pasa a FINALIZING, que
   protege inventario mientras el resultado es incierto. La llamada de captura
   ocurre fuera de transacción. Solo `succeeded` crea una reserva CONFIRMED y el
   vínculo único al checkout en una misma transacción local.
5. Repeticiones y eventos desordenados consultan el estado actual; las claves de
   creación/captura/cancelación/reembolso y las transiciones locales hacen sus
   efectos idempotentes. No se guardan cuerpos del proveedor ni secretos de cliente.

Fallo definitivo: cancelar intento y liberar inventario, sin reserva confirmada.
Pendiente sin autorización: expira a los 10 minutos. Autorización tardía: cancelar;
cobro inesperado/tardío sin derecho a inventario: reembolsar, sin crear reserva.
Timeout: conservar resultado incierto y reconciliar con la misma clave.
Los reembolsos se recuperan también por su referencia de operación en metadata
del proveedor si se perdió la respuesta antes de guardar refund_id, incluso
después de la ventana de retención de claves. Si el inventario fue desactivado o
la estancia quedó en el pasado durante una captura incierta, se reembolsa y no
se crea una nueva reserva retrospectiva.
Si una creación sin referencia sigue desconocida tras 23h10m, no recrearla: Stripe
puede podar claves tras 24h. Una autorización huérfana manual no se captura sola.

El worker procesa hasta 20 operaciones cada 15 segundos, priorizando las menos
consultadas. No liberar FINALIZING solo por timeout: eso permitiría vender dos
veces una habitación con cobro incierto. Una interrupción prolongada del proveedor
requiere inspección humana del checkout y el Dashboard sandbox. No deshabilitar
el flag mientras existan capturas o reembolsos pendientes.

Cancelación de reserva: conserva las reglas de fecha/propiedad/ADMIN. Cancela la
reserva y persiste REFUND_PENDING en la misma transacción. El worker solicita
reembolso completo; REFUNDED requiere confirmación del proveedor. Un fallo queda
REFUND_FAILED para atención humana, sin inventar devolución ni reintentarla con
otra clave. Cancelar de nuevo no duplica el reembolso. El inventario se libera
al cancelar la reserva, independientemente del tiempo bancario de devolución.

Solo `/api/checkouts/stripe-webhook` POST se exceptúa de sesión/CSRF; exige firma
Stripe sobre el cuerpo original y ventana de 300 segundos del SDK. El resto de
las escrituras mantiene sesión/CSRF. Ni ADMIN puede leer un client_secret ajeno.
Listado de checkouts limitado a los últimos 20 propios, sin secretos. No se
registran mensajes de excepción del proveedor, claves, payloads ni datos de tarjeta.

## Migración y colaboración

La migración de checkout `V5__initial_checkout.sql`, numeración aprobada por Eric,
añade `checkouts`, `payment_profiles` y `saved_payment_methods`, con UUID,
referencias únicas, consentimiento versionado y restricciones.
No cambia V1/V2/V3 de base, filas/secuencias legacy ni `payments.amount` (unidad histórica
no inferida). Nuevos importes en centavos bigint, USD; tarifas legacy enteras
se convierten por 100, límites 50–99999999 centavos. Tarifa cero no admite checkout.
Confirmar preserva precio pactado aunque cambie posteriormente la tarifa.
La prueba de adopción debe conservar datos y secuencias y comparar DDL completo.
No hay autorización para aplicar la migración de checkout a desarrollo en este trabajo.

HU-03 PR #7 solo cuenta reservas CONFIRMED/CANCELLED; los estados intermedios
permanecen en checkouts y no alteran ese contrato. Retenciones sí afectan la
disponibilidad operativa, pero no representan noches confirmadas para pronósticos.
Compartidos con #7: README/INICIO-LOCAL, API/AI log, manifests frontend y la
documentación de pruebas. Conservar adiciones de ambas historias al integrar;
Se conserva la funcionalidad de demanda; el único ajuste es su guardián de reversión:
reconoce las tablas de checkout y rechaza borrar lotes con dependencias de pago.
Las relaciones desconocidas siguen impidiendo la reversión.

V4 está reservada por HU-05 (PR #9), todavía no integrada. En una instalación
compartida debe aplicarse V4 antes de V5: no desplegar V5 primero ni activar
`outOfOrder` para sortear el orden. Las pruebas de esta rama sin HU-05 utilizan
instalaciones tmpfs limpias con V1/V2/V3/V5; no demuestran la combinación V4/V5.
La integración posterior con notificaciones debe emitir confirmación únicamente
tras captura verificada; queda pendiente cuando HU-05 llegue a base.

## Ejecutar sin credenciales: regresión aislada

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1`

Usa únicamente PostgreSQL temporal y proveedor doble explícito en JUnit.
Los E2E de checkout son pruebas del contrato visual con respuestas interceptadas,
no transacciones Stripe. La regresión de reservas sigue con el flag deshabilitado.
Nunca apuntar pruebas a localhost:5432 ni hotel-bd. Si hay recursos anteriores,
inspeccionarlos y usar únicamente el reset verificado del proyecto aislado.

## Demostración integral sandbox (requiere operador y credenciales)

1. Completar la suite aislada anterior; conservar su demo en 127.0.0.1:55173.
2. Configurar privadamente `STRIPE_PUBLISHABLE_KEY=pk_test_...`,
   `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...` en el proceso.
   No introducir valores en argumentos, Git, logs, capturas ni chat. También se
   puede usar un archivo privado `.env.stripe-test` ignorado y `--env-file`.
3. Autenticar Stripe CLI con la cuenta de sandbox y ejecutar:
   `stripe listen --events payment_intent.amount_capturable_updated,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled --forward-to http://127.0.0.1:55173/api/checkouts/stripe-webhook`
   Su secreto de firma debe coincidir con el configurado. No adjuntar su salida
   sin redactar: puede contener el secreto del listener.
4. Con las tres variables privadas cargadas, recrear SOLO backend de pruebas:
   `docker compose -p hotel-reservation-system-test --env-file tests/isolated/empty.env -f compose.test.yaml -f compose.stripe-test.yaml up -d --no-deps backend-app`
   No usar `compose.yaml`. El overlay permite salida del backend hacia Stripe;
   PostgreSQL conserva red interna, tmpfs y ningún puerto publicado. El overlay
   no forma parte de CI ni del runner de regresión y no cambia desarrollo.
5. Volver a iniciar sesión tras recrear backend. Seleccionar habitación/fechas,
   confirmar y abrir el checkout. Introducir únicamente tarjetas de pruebas de
   la documentación oficial de Stripe. Demostrar éxito, rechazo y 3DS.
6. Éxito: una reserva CONFIRMED, importe pactado y PaymentIntent `succeeded` en
   Dashboard sandbox. Recargar no duplica cobro ni reserva. Cancelar y consultar
   el checkout desde Mis reservas hasta verificar el reembolso.
7. Probar dos sesiones para la misma habitación/fechas: un solo checkout activo.
   Cancelar/expirar permite al otro continuar. Interrumpir conexión después de
   autorización y volver a consultar el mismo checkout demuestra recuperación.

No se ha demostrado una transacción sandbox hasta registrar evidencia real
redactada. La elegibilidad comercial Stripe para una entidad panameña queda
fuera de esta entrega y debe evaluarse antes de cualquier futura producción.

## Fuentes oficiales y versiones

- https://docs.stripe.com/payments/payment-intents
- https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/refunds
- https://docs.stripe.com/testing
- https://stripe.com/global
- SDK Java estable 34.0.0: https://github.com/stripe/stripe-java/releases/tag/v34.0.0
- Stripe.js 10.2.0 fijado en package-lock; carga diferida desde el proveedor.

## Método guardado y compra recurrente

Sin consentimiento no se crea Customer ni se guarda método local. Con consentimiento
se conserva versión/fecha y se crea Customer idempotente por perfil privado. Stripe
recibe setup_future_usage=on_session; la aplicación solo activa la referencia junto
a la reserva tras verificar succeeded y amount_received igual al total pactado.
Los únicos datos de tarjeta locales son marca, últimos cuatro dígitos y vencimiento.

En la revisión de una nueva reserva se elige el método autorizado enmascarado o
una tarjeta nueva. El backend verifica propiedad local, autorización vigente,
Customer del proveedor, modo test y vencimiento. El PaymentIntent queda asociado
al método elegido; Stripe.js confirma sin introducir de nuevo PAN/CVV y maneja
3DS si el banco lo requiere. Un rechazo libera inventario y permite otro intento.
La misma clave no permite cambiar método ni consentimiento.

Mis reservas permite retirar autorización. La retirada se persiste primero,
impidiendo nuevas compras aunque Stripe esté caído. La desvinculación pendiente
se reintenta. No cancela compras iniciadas antes de retirar el método ni inventa
reembolsos. Otro usuario, incluido ADMIN, no puede listar ni retirar métodos ajenos.

Demostración adicional requerida: primera compra con/sin casilla, método visible
solo para el dueño, segunda compra sin formulario de tarjeta, autenticación 3DS,
rechazo recurrente sin reserva extra, retirada y fallback a tarjeta nueva.
No se afirma demostrada esta secuencia mientras falten credenciales/evidencia sandbox.

## Evidencia adicional del 28/10/2026

Suite integrada: 79 Maven + 1 compatibilidad, frontend y 12/12 Playwright. Tras
corregir el parámetro retirado de Stripe, seis pruebas del adaptador final y
siete escenarios API contra Stripe sandbox pasaron. [Resumen sin secretos](evidencias/hu01/stripe-sandbox-results.json).
El adaptador usa [allowed_payment_method_types](https://docs.stripe.com/api/payment_intents/create),
restringido a card. El overlay usa perfil isolated: requiere el catálogo ya
creado por la suite y evita repetir su cargador demo al reiniciar.

Reproducción opcional, solo después de la suite y con el overlay sandbox activo:
`python tests/isolated/stripe-sandbox-smoke.py --confirm-stripe-sandbox`.
Para el checkout separado utilizado durante integración, añadir
`--base-url http://127.0.0.1:55174 --env-file RUTA_PRIVADA/.env.stripe-test`.
Genera únicamente usuarios y compras sintéticas; verifica tres capturas y sus
reembolsos, sin PAN/CVV ni claves en reportes. No ejecutar contra desarrollo.
El recorrido Stripe.js real, la resolución interactiva de 3DS y la entrega
real de webhooks quedan pendientes; esta prueba usa confirmación API.
