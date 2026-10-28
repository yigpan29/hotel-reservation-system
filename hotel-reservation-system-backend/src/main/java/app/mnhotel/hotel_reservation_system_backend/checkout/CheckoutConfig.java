package app.mnhotel.hotel_reservation_system_backend.checkout;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.core.env.Environment;

@Configuration @EnableScheduling
public class CheckoutConfig {
    private final Environment env;
    public CheckoutConfig(Environment env) { this.env = env; }
    public boolean enabled() { return env.getProperty("HOTEL_CHECKOUT_ENABLED", Boolean.class, false); }
    public String publicKey() { return env.getProperty("STRIPE_PUBLISHABLE_KEY", ""); }
    public String secretKey() { return env.getProperty("STRIPE_SECRET_KEY", ""); }
    public String webhookSecret() { return env.getProperty("STRIPE_WEBHOOK_SECRET", ""); }
    public void requireSandbox() {
        if (!enabled() || !publicKey().startsWith("pk_test_") || !secretKey().startsWith("sk_test_")
                || !webhookSecret().startsWith("whsec_")) {
            throw new app.mnhotel.hotel_reservation_system_backend.exception.ApiException(
                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Checkout de pruebas no configurado");
        }
    }
}
