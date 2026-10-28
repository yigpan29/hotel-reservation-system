package app.mnhotel.hotel_reservation_system_backend.checkout;

import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.model.Customer;
import com.stripe.model.PaymentMethod;
import java.util.HashMap;
import java.util.UUID;
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
            p.getMetadata().get("checkout_id"), p.getClientSecret(), p.getLastPaymentError() != null,p.getAmountReceived(),p.getCustomer(),p.getPaymentMethod());
    }
    // Do not propagate provider exceptions, response bodies, client secrets or card details to logs/clients.
    private ApiException unavailable() { return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
        "No se pudo verificar el pago. Puedes consultar o reintentar el mismo checkout."); }
    public Intent create(CheckoutStore.Checkout c) {
        try {
            Map<String,Object> params=new HashMap<>(Map.of("amount", c.amount(), "currency", "usd",
                "payment_method_types", List.of("card"), "capture_method", "manual",
                "metadata", Map.of("checkout_id", c.id().toString())));
            if(c.customerId()!=null)params.put("customer",c.customerId());
            if(c.providerMethodId()!=null)params.put("payment_method",c.providerMethodId());
            if(c.saveMethod())params.put("setup_future_usage","on_session");
            return view(PaymentIntent.create(params, options(c.id() + ":create")));
        }
        catch (StripeException e) { throw unavailable(); }
    }
    public String createCustomer(UUID profileId) {
        try {return Customer.create(Map.of("metadata",Map.of("hotel_profile_id",profileId.toString())),options(profileId+":customer")).getId();}
        catch(StripeException e){throw unavailable();}
    }
    public Card card(String id) {
        try {
            var p=PaymentMethod.retrieve(id,options(null));
            if(!"card".equals(p.getType())||p.getCard()==null)throw new ApiException(HttpStatus.CONFLICT,"Método no disponible; utiliza una tarjeta nueva");
            var card=p.getCard();
            return new Card(p.getId(),p.getCustomer(),Boolean.TRUE.equals(p.getLivemode()),card.getBrand(),card.getLast4(),card.getExpMonth().intValue(),card.getExpYear().intValue());
        }catch(StripeException e){
            if(e.getStatusCode()!=null&&(e.getStatusCode()==404||e.getStatusCode()==400))
                throw new ApiException(HttpStatus.CONFLICT,"Método no disponible; utiliza una tarjeta nueva");
            throw unavailable();
        }
    }
    public void detach(String id,String expectedCustomer) {
        try {
            var method=PaymentMethod.retrieve(id,options(null));
            if(method.getCustomer()==null)return;
            if(Boolean.TRUE.equals(method.getLivemode())||!expectedCustomer.equals(method.getCustomer()))
                throw new ApiException(HttpStatus.CONFLICT,"El método ya no corresponde al perfil autorizado");
            method.detach(Map.of(),options("detach:"+id));
        }
        catch(StripeException e){throw unavailable();}
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
        try {
            // Recover an unknown refund response even after Stripe's idempotency retention window.
            for(var existing:Refund.list(Map.of("payment_intent",id,"limit",100),options(null)).getData()) {
                if(key.equals(existing.getMetadata().get("checkout_operation"))) return new RefundResult(existing.getId(),existing.getStatus());
            }
            var r = Refund.create(Map.of("payment_intent", id,"metadata",Map.of("checkout_operation",key)), options(key));
            return new RefundResult(r.getId(),r.getStatus());
        }
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
