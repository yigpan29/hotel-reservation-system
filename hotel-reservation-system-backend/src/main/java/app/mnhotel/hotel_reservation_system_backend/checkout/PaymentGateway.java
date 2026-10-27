package app.mnhotel.hotel_reservation_system_backend.checkout;

/** Only provider references and non-sensitive state cross this boundary. */
public interface PaymentGateway {
    record Intent(String id, String status, long amount, String currency, boolean live,
                  String checkoutId, String clientSecret, boolean failed) {}
    record RefundResult(String id, String status) {}
    Intent create(CheckoutStore.Checkout checkout);
    Intent retrieve(String id);
    Intent capture(String id, String key);
    Intent cancel(String id, String key);
    RefundResult refund(String id, String key);
    RefundResult retrieveRefund(String id);
    String verifyWebhook(String body, String signature);
}
