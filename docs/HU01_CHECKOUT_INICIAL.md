# HU-01: checkout y reserva recurrente Stripe sandbox

Responsable: Eric. Issue #5. Integración conjunta con HU-04 (#6) sobre main.
Alcance aprobado: primer checkout, consentimiento, método guardado, nueva compra
confirmada por el usuario, un pago para todas las habitaciones y cancelación
por habitación con reembolso de su importe. No incluye cobros off-session.
Se conservan el calendario, tipos y huéspedes de HU-02/HU-06 y demanda HU-03.

## Flujo inicial y recurrente

`HOTEL_CHECKOUT_ENABLED=false` conserva la reserva legacy sin pago. Cuando está
activo, tanto POST `/reservations` como `/reservations/group` devuelven 409;
no hay fallback gratuito si Stripe o su configuración fallan.

1. El usuario mantiene su sesión y selecciona fechas, tipos y huéspedes con el
   flujo de main. El resumen muestra una estimación. Antes de autorizar, checkout
   muestra habitaciones asignadas, sus importes congelados y total definitivo.
2. POST `/checkouts/group` exige CSRF e Idempotency-Key. El servidor asigna unidades
   compatibles y bloquea sus IDs en orden ascendente. Una transacción retiene
   todas por diez minutos o ninguna. Conserva tipo, huéspedes e importe por línea.
3. Se crea un único PaymentIntent USD con captura manual por la suma de las líneas.
   Las llamadas al proveedor ocurren fuera de los bloqueos de base de datos.
   Stripe.js Payment Element envía PAN/CVV directamente a Stripe.
4. Guardar el método exige una casilla inicialmente desmarcada. Se persisten fecha
   y versión `hu01-on-session-v1`; Stripe recibe Customer y setup_future_usage
   on_session. Localmente solo se conservan referencias, marca, últimos cuatro
   dígitos y vencimiento. Sin consentimiento no se crea método guardado.
5. El banco puede exigir 3DS. `requires_action` y `requires_capture` no acreditan
   una reserva pagada. Webhook firmado, sync del propietario o worker consultan
   el intento real y verifican modo test, referencia, Customer, moneda e importe.
6. Se revalida todo el inventario antes de capturar. Solo `succeeded` y el importe
   recibido correcto confirman todas las reservas en una transacción local.
   Cada reserva conserva sus datos de huéspedes, tipo y precios pactados.
7. En una compra posterior el usuario elige su método autorizado enmascarado y
   confirma nuevamente. El servidor valida propiedad, vigencia y Customer;
   Stripe.js permite confirmar sin reintroducir PAN/CVV, sujeto a posible 3DS.
   Mis reservas permite revocar la autorización; nuevas compras quedan impedidas
   inmediatamente aunque la desvinculación con Stripe deba reintentarse.

## Fallos, concurrencia y cancelaciones

Los estados intermedios viven en checkouts: PENDING, FINALIZING,
CANCEL_REQUESTED, CANCELLED, FAILED, EXPIRED, REFUND_PENDING, REFUNDED y
REFUND_FAILED; SUCCEEDED indica captura y confirmación verificadas.
No se añaden estados de pago a reservations.status ni se reinterpretan reservas
históricas CONFIRMED como pagadas. La constancia HU-04 no acredita un pago.

Rechazo definitivo o expiración sin autorización libera todas las retenciones.
FINALIZING protege inventario mientras la captura sea incierta; un timeout no
acredita éxito ni libera inventario a ciegas. Si alguna habitación deja de ser
válida después del cobro, se solicita devolución completa sin confirmar un grupo
parcial. Webhooks repetidos/desordenados consultan el estado actual del proveedor.
Claves duraderas por operación evitan duplicar creación, captura o devolución.

Cancelar una reserva del grupo conserva los permisos y plazo existentes, libera
esa habitación y registra PENDING en su línea dentro de la misma transacción.
La devolución corresponde exclusivamente a su importe congelado. Las otras
reservas siguen confirmadas. RefundState por línea: NONE/PENDING/SUCCEEDED/FAILED.
Mientras queden reservas, stage puede seguir SUCCEEDED con paymentStatus
partial_refund_pending, partially_refunded o refund_requires_attention.
Solo todas las líneas devueltas permiten REFUNDED. Repetir o cancelar en paralelo
no duplica el reembolso. La suma no puede superar el pago capturado.
Una devolución fallida exige atención humana; no se inventa su éxito.
El endpoint single `/checkouts` conserva compatibilidad y devolución completa.

El worker procesa hasta 20 operaciones cada 15 segundos. Recupera respuestas
inciertas usando la misma clave y busca devoluciones por metadata de operación,
incluso pasada la retención de claves del proveedor. Si una creación desconocida
no tiene referencia después de 23h10m, no crea otro intento: puede haber expirado
la retención de idempotencia. Una autorización manual huérfana no se captura sola.
No deshabilitar el flag mientras haya capturas o devoluciones pendientes.

## Seguridad y migraciones

Solo POST `/api/checkouts/stripe-webhook` está exceptuado de sesión/CSRF y exige
firma sobre cuerpo original, con la tolerancia de 300 segundos del SDK.
El resto de escrituras conserva sesión/CSRF; ni ADMIN obtiene client_secret ajeno.
Los listados propios no incluyen secretos. No se registran credenciales,
client_secret, payloads de proveedor, PAN ni CVV. No hay cobros reales habilitados.

Main contiene V1 legacy, V2 integridad, V3 capacidad, V4 huéspedes, V5 tipo y
V6 historial, tras el PR #16 fusionado por revisión humana. Esta rama añade
`V8__checkout_orders.sql`: checkouts, checkout_items, payment_profiles y
saved_payment_methods. No modifica los SQL V1–V6 ni la entidad Payment heredada;
los importes nuevos se expresan en centavos USD, entre 50 y 99999999.

**V7 queda reservada para HU-05.** PR #9 aún contiene V4 y debe coordinarse con
Yoel antes de integrarlo. No se modificó su rama. No desplegar V8 a una base
compartida antes de V7 ni activar outOfOrder para saltar esa coordinación.
Esta entrega prueba V1–V6/V8 en PostgreSQL tmpfs; no prueba una V7 inexistente.
Las bases históricas con V3 de historial requieren adopción revisada aparte;
no se ejecutó repair ni se alteró PostgreSQL de desarrollo.
HU-05 deberá notificar confirmaciones solo después de la captura y confirmación
conjuntas; las cancelaciones y avisos siguen siendo por reserva. No se afirma
verificada esa integración pendiente.

## Pruebas y demostración

Ejecutar `powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1`.
Usa exclusivamente hotel_test temporal en Docker, instalación nueva, adopción
legacy y comparación del esquema completo con datos/secuencias preservados.
Suite conjunta del 28/10/2026: 110 JUnit + 1 compatibilidad, 117 Vitest,
TypeScript, lint, build y 15 Playwright correctos. Doce pruebas JUnit nuevas de
grupo cubren pago conjunto, guardado, ausencia de método, idempotencia, rollback,
rechazo, inventario cambiante, concurrencia, reembolso parcial, acceso y CSRF.
Los dobles de PaymentGateway y los contratos interceptados de navegador se
identifican expresamente; no constituyen pagos reales de Stripe.

Para la demostración opt-in usar `compose.test.yaml` + `compose.stripe-test.yaml`
solo después de la suite y con el catálogo ya creado; nunca compose.yaml ni
PostgreSQL de desarrollo. Configurar privadamente pk_test_, sk_test_ y whsec_
en STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.
El archivo .env.stripe-test está ignorado; no compartir sus valores ni volcados
compose config. El secreto whsec_ debe ser el del listener que apunta al backend.
El overlay usa perfil isolated para no repetir el cargador de datos al reiniciar.

Listener: `stripe listen --events payment_intent.amount_capturable_updated,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled --forward-to http://127.0.0.1:55173/api/checkouts/stripe-webhook`.
Su salida puede contener el secreto de firma: conservarla privadamente.
Reiniciar solo backend-app con --no-deps y volver a iniciar sesión.

Smoke opcional de grupo: `python tests/isolated/stripe-group-sandbox-smoke.py
--base-url http://127.0.0.1:55177 --env-file RUTA_PRIVADA --confirm-stripe-sandbox`.
Exige demo aislada con ese puerto. Para demostrar que el webhook captura, iniciar
el backend con HOTEL_CHECKOUT_RECOVERY_MS=3600000 durante esta comprobación;
el primer éxito se observa por GET sin sync tras autorizar. Restaurar 15000
al finalizar. El script reembolsa todas sus compras y genera reporte sin secretos.
La confirmación se hace con tokens oficiales por API: no demuestra completar
Stripe.js en navegador ni resolver un desafío 3DS interactivo.

Evidencia histórica single: [siete escenarios sandbox](evidencias/hu01/stripe-sandbox-results.json).
Evidencia conjunta: [nueve escenarios sandbox](evidencias/hu01/stripe-group-sandbox-results.json),
con webhook real y tres pagos completamente reembolsados, limpieza sin errores.
Se confirmó por API con tokens de prueba; Stripe.js/3DS interactivo siguen pendientes.
La prueba conjunta y su evidencia se documentan en AI Development Log.
Para revisión humana: dos habitaciones, casilla desmarcada, pago test, ambas
constancias; repetir con consentimiento, comprar con el método guardado,
cancelar una habitación y verificar su devolución sin cancelar la restante.

## Referencias oficiales

- https://docs.stripe.com/payments/payment-intents
- https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/refunds
- https://docs.stripe.com/testing
- SDK Java 34.0.0: https://github.com/stripe/stripe-java/releases/tag/v34.0.0
- Stripe.js 10.2.0 fijado en package-lock; carga diferida desde Stripe.
