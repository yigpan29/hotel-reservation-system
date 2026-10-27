package app.mnhotel.hotel_reservation_system_backend.checkout;

import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.exception.StripeException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;

@Component
public class StripeGateway implements PaymentGateway {
    private final CheckoutConfig config;
    private final ObjectMapper json;
    public StripeGateway(CheckoutConfig config, ObjectMapper json) { this.config = config; this.json = json; }
    private RequestOptions options(String key) {
        config.requireSandbox();
        var b = RequestOptions.builder().setApiKey(config.secretKey()).setConnectTimeout(5000)
            .setReadTimeout(10000).setMaxNetworkRetries(0);
        if (key != null) b.setIdempotencyKey(key);
        return b.build();
    }
    private Intent view(PaymentIntent p) {
        return new Intent(p.getId(), p.getStatus(), p.getAmount(), p.getCurrency(), Boolean.TRUE.equals(p.getLivemode()),
            p.getMetadata().get("checkout_id"), p.getClientSecret(), p.getLastPaymentError() != null);
    }
    // Do not propagate provider exceptions, response bodies, client secrets or card details to logs/clients.
    private ApiException unavailable() { return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
        "No se pudo verificar el pago. Puedes consultar o reintentar el mismo checkout."); }
    public Intent create(CheckoutStore.Checkout c) {
        try { return view(PaymentIntent.create(Map.of("amount", c.amount(), "currency", "usd",
            "payment_method_types", List.of("card"), "capture_method", "manual",
            "metadata", Map.of("checkout_id", c.id().toString())), options(c.id() + ":create"))); }
        catch (StripeException e) { throw unavailable(); }
    }
    public Intent retrieve(String id) {
        try { return view(PaymentIntent.retrieve(id, options(null))); }
        catch (StripeException e) { throw unavailable(); }
    }
    public Intent capture(String id, String key) {
        try { return view(PaymentIntent.retrieve(id, options(null)).capture(Map.of(), options(key))); }
        catch (StripeException e) { throw unavailable(); }
    }
    public Intent cancel(String id, String key) {
        try { return view(PaymentIntent.retrieve(id, options(null)).cancel(Map.of(), options(key))); }
        catch (StripeException e) { throw unavailable(); }
    }
    public RefundResult refund(String id, String key) {
        try { var r = Refund.create(Map.of("payment_intent", id), options(key)); return new RefundResult(r.getId(),r.getStatus()); }
        catch (StripeException e) { throw unavailable(); }
    }
    public RefundResult retrieveRefund(String id) {
        try { var r = Refund.retrieve(id, options(null)); return new RefundResult(r.getId(),r.getStatus()); }
        catch (StripeException e) { throw unavailable(); }
    }
    public String verifyWebhook(String body, String signature) {
        config.requireSandbox();
        try {
            if(body.length()>65536) throw new IllegalArgumentException();
            Webhook.constructEvent(body, signature, config.webhookSecret());
            var event = json.readTree(body);
            if (event.path("livemode").asBoolean(true)) throw new IllegalArgumentException();
            String type = event.path("type").asText();
            if (!type.startsWith("payment_intent.")) return null;
            String id = event.path("data").path("object").path("id").asText();
            if (!id.matches("pi_[a-zA-Z0-9]+")) throw new IllegalArgumentException();
            return id;
        } catch (Exception e) { throw ApiException.bad("Notificación de pago inválida"); }
    }
}
