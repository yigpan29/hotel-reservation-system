package app.mnhotel.hotel_reservation_system_backend;

import app.mnhotel.hotel_reservation_system_backend.checkout.*;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.Stripe;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import com.stripe.model.PaymentMethod;
import com.stripe.net.RequestOptions;

class StripeWebhookTests {
    @Test void createUsesSupportedCardAllowlistAndManualCapture()throws Exception{
        var checkout=mock(app.mnhotel.hotel_reservation_system_backend.checkout.CheckoutStore.Checkout.class);
        var id=java.util.UUID.randomUUID();when(checkout.id()).thenReturn(id);when(checkout.amount()).thenReturn(8000L);
        var intent=new com.stripe.model.PaymentIntent();intent.setId("pi_synthetic");intent.setStatus("requires_payment_method");
        intent.setAmount(8000L);intent.setAmountReceived(0L);intent.setCurrency("usd");intent.setLivemode(false);
        intent.setMetadata(java.util.Map.of("checkout_id",id.toString()));
        try(var intents=mockStatic(com.stripe.model.PaymentIntent.class)){
            intents.when(()->com.stripe.model.PaymentIntent.create(anyMap(),any(RequestOptions.class))).thenAnswer(call->{
                java.util.Map<String,Object> params=call.getArgument(0);
                assertThat(params).containsEntry("allowed_payment_method_types",java.util.List.of("card"))
                    .containsEntry("capture_method","manual").doesNotContainKey("payment_method_types");
                return intent;
            });
            var gateway=new StripeGateway(config("sk_test_synthetic"),new ObjectMapper());
            assertThat(gateway.create(checkout).id()).isEqualTo("pi_synthetic");
        }
    }
    final String secret="whsec_SYNTHETIC_UNIT_TEST_ONLY";
    CheckoutConfig config(String key){return new CheckoutConfig(new MockEnvironment().withProperty("HOTEL_CHECKOUT_ENABLED","true")
        .withProperty("STRIPE_PUBLISHABLE_KEY","pk_test_synthetic").withProperty("STRIPE_SECRET_KEY",key).withProperty("STRIPE_WEBHOOK_SECRET",secret));}
    String body(boolean live){return "{\"id\":\"evt_synthetic\",\"object\":\"event\",\"api_version\":\""+Stripe.API_VERSION+"\",\"livemode\":"+live+
        ",\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"pi_synthetic\",\"object\":\"payment_intent\"}}}";}
    String sign(String body,long timestamp)throws Exception{
        var hmac=Mac.getInstance("HmacSHA256");hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        return "t="+timestamp+",v1="+HexFormat.of().formatHex(hmac.doFinal((timestamp+"."+body).getBytes(StandardCharsets.UTF_8)));
    }
    @Test void validSignatureUsesOriginalBody()throws Exception{
        var gateway=new StripeGateway(config("sk_test_synthetic"),new ObjectMapper());String body=body(false);
        assertThat(gateway.verifyWebhook(body,sign(body,Instant.now().getEpochSecond()))).isEqualTo("pi_synthetic");
    }
    @Test void rejectsInvalidTamperedOldAndLiveEvents()throws Exception{
        var gateway=new StripeGateway(config("sk_test_synthetic"),new ObjectMapper());String body=body(false);
        String valid=sign(body,Instant.now().getEpochSecond());
        assertThatThrownBy(()->gateway.verifyWebhook(body,"invalid")).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->gateway.verifyWebhook(body+" ",valid)).isInstanceOf(ApiException.class);
        String stale=sign(body,Instant.now().minusSeconds(600).getEpochSecond());
        assertThatThrownBy(()->gateway.verifyWebhook(body,stale)).isInstanceOf(ApiException.class);
        String live=body(true),liveSignature=sign(live,Instant.now().getEpochSecond());
        assertThatThrownBy(()->gateway.verifyWebhook(live,liveSignature)).isInstanceOf(ApiException.class);
    }
    @Test void liveAndMissingKeysAreRejectedBeforeAnyProviderCall(){
        assertThatThrownBy(()->config("sk_live_SYNTHETIC_REJECTED").requireSandbox()).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->new CheckoutConfig(new MockEnvironment()).requireSandbox()).isInstanceOf(ApiException.class);
    }
    @Test void revocationNeverDetachesAnotherProvidersCustomer()throws Exception{
        var gateway=new StripeGateway(config("sk_test_synthetic"),new ObjectMapper());
        var method=mock(PaymentMethod.class);when(method.getCustomer()).thenReturn("cus_another_owner");
        try(var methods=mockStatic(PaymentMethod.class)) {
            methods.when(()->PaymentMethod.retrieve(anyString(),any(RequestOptions.class))).thenReturn(method);
            assertThatThrownBy(()->gateway.detach("pm_synthetic","cus_expected_owner")).isInstanceOf(ApiException.class);
            verify(method,never()).detach(anyMap(),any(RequestOptions.class));
        }
    }
    @Test void missingProviderMethodIsDefinitiveAndCanReleaseTheHold()throws Exception{
        var gateway=new StripeGateway(config("sk_test_synthetic"),new ObjectMapper());
        var failure=mock(com.stripe.exception.StripeException.class);when(failure.getStatusCode()).thenReturn(404);
        try(var methods=mockStatic(PaymentMethod.class)) {
            methods.when(()->PaymentMethod.retrieve(anyString(),any(RequestOptions.class))).thenThrow(failure);
            assertThatThrownBy(()->gateway.card("pm_removed")).isInstanceOfSatisfying(ApiException.class,
                e->assertThat(e.getStatus().value()).isEqualTo(409));
        }
    }
}
