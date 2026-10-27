package app.mnhotel.hotel_reservation_system_backend.checkout;

import java.util.UUID;
import java.util.Map;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;

@RestController @RequestMapping("/api/checkouts")
public class CheckoutController {
    private final CheckoutService service;
    private final CheckoutConfig config;
    public CheckoutController(CheckoutService service,CheckoutConfig config){this.service=service;this.config=config;}
    @GetMapping("/config") public Map<String,Object> config() {
        if(config.enabled())config.requireSandbox();
        return Map.of("enabled",config.enabled(),"publishableKey",config.enabled()?config.publicKey():"","mode","test");
    }
    @PostMapping public CheckoutService.View begin(Authentication a,@RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody Requests.ReservationInput input) {return service.begin(a.getName(),key,input);}
    @GetMapping("/me") public java.util.List<CheckoutService.View> mine(Authentication a) {return service.mine(a.getName());}
    // POST because reconcile can capture/confirm a payment. All browser mutations retain CSRF.
    @PostMapping("/{id}/sync") public CheckoutService.View sync(Authentication a,@PathVariable UUID id) {return service.detail(id,a.getName());}
    @PostMapping("/{id}/cancel") public CheckoutService.View cancel(Authentication a,@PathVariable UUID id) {return service.cancel(id,a.getName());}
    @PostMapping("/stripe-webhook") public void webhook(@RequestBody String body,
        @RequestHeader(value="Stripe-Signature",defaultValue="") String signature) {service.webhook(body,signature);}
}
