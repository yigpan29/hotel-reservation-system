package app.mnhotel.hotel_reservation_system_backend.checkout;

import java.util.UUID;
import java.util.Set;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.http.HttpStatus;
import org.slf4j.LoggerFactory;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;

@Service
public class CheckoutService {
    public record View(UUID id,String stage,String paymentStatus,long amountCents,String currency,
                       Instant expiresAt,Long reservationId,String clientSecret,boolean savedMethod,boolean saveMethod) {}
    private final CheckoutStore store;
    private final PaymentGateway gateway;
    private final CheckoutConfig config;
    private final SavedMethods saved;
    public CheckoutService(CheckoutStore store,PaymentGateway gateway,CheckoutConfig config,SavedMethods saved) {
        this.store=store;this.gateway=gateway;this.config=config;this.saved=saved;
    }
    private void verify(CheckoutStore.Checkout c,PaymentGateway.Intent p) {
        if(p.live()||p.amount()!=c.amount()||(p.status().equals("succeeded")&&p.received()!=c.amount())||!"usd".equals(p.currency())||!c.id().toString().equals(p.checkoutId())
            ||(c.intentId()!=null&&!c.intentId().equals(p.id()))
            ||(c.customerId()!=null&&!c.customerId().equals(p.customerId()))
            ||(c.providerMethodId()!=null&&!c.providerMethodId().equals(p.methodId())))
            throw new ApiException(HttpStatus.CONFLICT,"El pago no corresponde a este checkout de pruebas");
    }
    private View view(CheckoutStore.Checkout c,String secret) {
        return new View(c.id(),c.stage(),c.paymentStatus(),c.amount(),"usd",c.expiresAt(),c.reservationId(),
            c.stage().equals("PENDING")&&c.expiresAt().isAfter(Instant.now())?secret:null,c.savedMethodId()!=null,c.saveMethod());
    }
    public View begin(String name,String key,Requests.ReservationInput input) {
        return begin(name,key,new CheckoutInput(input.roomId(),input.startDate(),input.endDate(),null,false));
    }
    public View begin(String name,String key,CheckoutInput input) {
        config.requireSandbox();
        var c=store.begin(name,key,input);
        return view(process(c.id()),null);
    }
    public View detail(UUID id,String name) {
        config.requireSandbox();
        store.owned(id,name);
        var c=process(id);
        String secret=null;
        if(c.stage().equals("PENDING")&&c.intentId()!=null) {
            var p=gateway.retrieve(c.intentId());verify(c,p);secret=p.clientSecret();
        }
        return view(c,secret);
    }
    public View cancel(UUID id,String name) {
        config.requireSandbox();store.owned(id,name);store.requestCancel(id);
        return view(process(id),null);
    }
    public void webhook(String body,String signature) {
        String intent=gateway.verifyWebhook(body,signature);
        if(intent!=null) {var c=store.byIntent(intent);if(c!=null) process(c.id());}
    }
    public java.util.List<View> mine(String name) {
        return store.mine(name).stream().map(c->view(c,null)).toList();
    }
    public CheckoutStore.Checkout process(UUID id) {
        var c=store.get(id);
        if(!Set.of("PENDING","FINALIZING","CANCEL_REQUESTED","REFUND_PENDING").contains(c.stage())) return c;
        // Stripe may prune idempotency keys after 24h. Never recreate an unknown old intent.
        // Manual capture means an orphan authorization cannot turn into a charge on its own.
        if(c.intentId()==null&&c.expiresAt().isBefore(Instant.now().minusSeconds(23*3600)))
            return store.terminal(id,"EXPIRED","unknown_creation_expired");
        if(c.saveMethod()&&c.customerId()==null) {
            var profile=store.profile(c.userId());
            c=store.bindCustomer(id,profile.customerId()==null?gateway.createCustomer(profile.id()):profile.customerId());
        }
        if(c.intentId()==null&&c.providerMethodId()!=null) {
            try {SavedMethods.validate(gateway.card(c.providerMethodId()),c.customerId());}
            catch(ApiException e){if(e.getStatus().value()==409)store.terminal(id,"FAILED","method_unavailable");throw e;}
        }
        // An uncertain creation is recovered with the original idempotency key, never a new intent.
        var p=c.intentId()==null?gateway.create(c):gateway.retrieve(c.intentId());
        verify(c,p);
        if(c.intentId()==null) c=store.attach(id,p);
        if(c.stage().equals("PENDING")&&!c.expiresAt().isAfter(Instant.now())) c=store.requestCancel(id);
        if(c.stage().equals("PENDING")&&p.failed()&&p.status().equals("requires_payment_method")) c=store.rejectPayment(id);
        if(p.status().equals("requires_capture")&&c.stage().equals("PENDING")) c=store.authorize(id);
        // Reload after the durable transition: cancellation cannot race a capture once FINALIZING.
        c=store.get(id);
        if(c.stage().equals("FINALIZING")&&p.status().equals("requires_capture")) {
            p=gateway.capture(p.id(),id+":capture");verify(c,p);
        }
        if(c.stage().equals("FINALIZING")&&p.status().equals("requires_payment_method")&&p.failed()) c=store.rejectPayment(id);
        if(p.status().equals("succeeded")) c=finish(c,p);
        else if(p.status().equals("canceled")) {
            c=store.terminal(id,cancelledStage(c,p),p.status());
        } else if(c.stage().equals("CANCEL_REQUESTED")) {
            p=gateway.cancel(p.id(),id+":cancel");verify(c,p);
            if(p.status().equals("succeeded")) c=finish(c,p);
            else if(p.status().equals("canceled")) c=store.terminal(id,cancelledStage(c,p),p.status());
        } else store.touch(id,p.status());
        c=store.get(id);
        if(c.stage().equals("REFUND_PENDING")) {
            var refund=c.refundId()==null?gateway.refund(p.id(),id+":refund"):gateway.retrieveRefund(c.refundId());
            c=store.refundResult(id,refund);
        }
        return c;
    }
    private String cancelledStage(CheckoutStore.Checkout c,PaymentGateway.Intent p) {
        if(!c.expiresAt().isAfter(Instant.now())) return "EXPIRED";
        return p.failed()||c.paymentStatus().equals("failed")?"FAILED":"CANCELLED";
    }
    private CheckoutStore.Checkout finish(CheckoutStore.Checkout c,PaymentGateway.Intent p) {
        PaymentGateway.Card card=null;
        if(c.saveMethod()&&c.stage().equals("FINALIZING")) {
            if(p.methodId()==null)throw ApiException.conflict("El proveedor no identificó el método autorizado");
            card=gateway.card(p.methodId());SavedMethods.validate(card,c.customerId());
        }
        return store.finish(c.id(),p,card);
    }
    @Scheduled(fixedDelayString="${HOTEL_CHECKOUT_RECOVERY_MS:15000}",initialDelayString="${HOTEL_CHECKOUT_RECOVERY_MS:15000}")
    public void recover() {
        if(!config.enabled()) return;
        for(var c:store.recoverable()) {
            try {config.requireSandbox();process(c.id());}
            catch(Exception e) {
                // Only local opaque identifiers. Never log provider exception messages or payloads.
                LoggerFactory.getLogger(CheckoutService.class).warn("Checkout {} pendiente de reconciliación",c.id());
                store.touch(c.id(),c.paymentStatus());
            }
        }
        saved.recover();
    }
}
