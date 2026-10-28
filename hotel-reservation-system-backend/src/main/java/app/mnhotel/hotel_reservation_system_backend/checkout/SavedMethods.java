package app.mnhotel.hotel_reservation_system_backend.checkout;

import java.util.*;
import java.time.YearMonth;
import java.time.ZoneId;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
import app.mnhotel.hotel_reservation_system_backend.service.imp.AuthServiceImp;

@Service
public class SavedMethods {
    public record View(UUID id,String brand,String lastFour,int expiryMonth,int expiryYear,boolean expired) {}
    private final JdbcTemplate jdbc;
    private final AuthServiceImp users;
    private final PaymentGateway gateway;
    public SavedMethods(JdbcTemplate jdbc,AuthServiceImp users,PaymentGateway gateway){this.jdbc=jdbc;this.users=users;this.gateway=gateway;}
    public List<View> mine(String name) {
        return jdbc.query("SELECT * FROM saved_payment_methods WHERE user_id=? AND revoked_at IS NULL ORDER BY consented_at DESC LIMIT 50",(r,n)->
            new View(r.getObject("id",UUID.class),r.getString("brand"),r.getString("last_four"),r.getInt("expiry_month"),r.getInt("expiry_year"),
                YearMonth.of(r.getInt("expiry_year"),r.getInt("expiry_month")).isBefore(YearMonth.now(ZoneId.of("America/Panama")))),users.require(name).getId());
    }
    public void revoke(String name,UUID id) {
        var rows=jdbc.queryForList("SELECT user_id,provider_method_id,customer_id FROM saved_payment_methods WHERE id=?",id);
        if(rows.isEmpty())throw ApiException.missing("Método guardado");
        if(((Number)rows.get(0).get("user_id")).longValue()!=users.require(name).getId())throw new ApiException(HttpStatus.FORBIDDEN,"Método de pago ajeno");
        // Revoke locally FIRST, even when the provider is temporarily unavailable.
        jdbc.update("UPDATE saved_payment_methods SET revoked_at=coalesce(revoked_at,now()),detach_pending=true WHERE id=?",id);
        detachOne(id,(String)rows.get(0).get("provider_method_id"),(String)rows.get(0).get("customer_id"));
    }
    public void recover() {
        for(var row:jdbc.queryForList("SELECT id,provider_method_id,customer_id FROM saved_payment_methods WHERE detach_pending ORDER BY revoked_at LIMIT 20")) {
            detachOne((UUID)row.get("id"),(String)row.get("provider_method_id"),(String)row.get("customer_id"));
        }
    }
    private void detachOne(UUID id,String providerId,String expectedCustomer) {
        try {gateway.detach(providerId,expectedCustomer);jdbc.update("UPDATE saved_payment_methods SET detach_pending=false WHERE id=?",id);}
        catch(Exception ignored) { /* Remains revoked; retry later. Never log payment/provider payloads. */ }
    }
    public static void validate(PaymentGateway.Card card,String customer) {
        if(card==null||card.live()||!Objects.equals(customer,card.customerId())||
            YearMonth.of(card.year(),card.month()).isBefore(YearMonth.now(ZoneId.of("America/Panama"))))
            throw ApiException.conflict("Método no disponible; utiliza una tarjeta nueva");
    }
}
