package app.mnhotel.hotel_reservation_system_backend.checkout;

import java.time.*;
import java.util.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.http.HttpStatus;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.entity.Reservation;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
import app.mnhotel.hotel_reservation_system_backend.repository.*;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;

/** All inventory transitions lock room before checkout; no provider calls inside transactions. */
@Component
public class CheckoutStore {
    public record Checkout(UUID id, long userId, long roomId, String requestKey, LocalDate start,
        LocalDate end, int nightly, long amount, String stage, String paymentStatus, String intentId,
        String refundId, Long reservationId, Instant expiresAt) {}
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final RoomRepository rooms;
    private final ReservationRepository reservations;
    private final AuthServiceImp users;
    private final UserRepository userRows;
    private final ReservationServiceImp booking;
    public CheckoutStore(JdbcTemplate jdbc, PlatformTransactionManager manager, RoomRepository rooms,
        ReservationRepository reservations, AuthServiceImp users, ReservationServiceImp booking, UserRepository userRows) {
        this.jdbc=jdbc; this.tx=new TransactionTemplate(manager); this.rooms=rooms;
        this.reservations=reservations; this.users=users; this.booking=booking; this.userRows=userRows;
    }
    private Checkout map(ResultSet r,int n) throws SQLException {
        return new Checkout(r.getObject("id",UUID.class), r.getLong("user_id"),r.getLong("room_id"),r.getString("request_key"),
            r.getDate("start_date").toLocalDate(),r.getDate("end_date").toLocalDate(),r.getInt("nightly_price"),
            r.getLong("amount_cents"),r.getString("stage"),r.getString("payment_status"),r.getString("intent_id"),
            r.getString("refund_id"),(Long)r.getObject("reservation_id"),r.getTimestamp("expires_at").toInstant());
    }
    public Checkout get(UUID id) {
        return jdbc.query("SELECT * FROM checkouts WHERE id=?",this::map,id).stream().findFirst()
            .orElseThrow(()->ApiException.missing("Checkout"));
    }
    public Checkout owned(UUID id,String name) {
        var c=get(id);
        if(c.userId()!=users.require(name).getId()) throw new ApiException(HttpStatus.FORBIDDEN,"Checkout ajeno");
        return c;
    }
    public Checkout byIntent(String id) {
        return jdbc.query("SELECT * FROM checkouts WHERE intent_id=?",this::map,id).stream().findFirst().orElse(null);
    }
    private <T> T locked(UUID id,Supplier<T> action) {
        return tx.execute(s->{ var c=get(id); rooms.lockById(c.roomId()).orElseThrow(()->ApiException.missing("Habitación"));
            jdbc.queryForObject("SELECT id FROM checkouts WHERE id=? FOR UPDATE",UUID.class,id); return action.get(); });
    }
    public Checkout begin(String name,String key,Requests.ReservationInput input) {
        if(key==null||!key.matches("[a-zA-Z0-9_-]{16,80}")) throw ApiException.bad("Idempotency-Key inválida (16–80 caracteres)");
        return tx.execute(s->{
            long user=users.require(name).getId();
            // Serialize reuse of a key even when the caller changes the room.
            jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",user+":"+key);
            var existing=jdbc.query("SELECT * FROM checkouts WHERE user_id=? AND request_key=?",this::map,user,key);
            if(!existing.isEmpty()) {
                var c=existing.get(0);
                if(c.roomId()!=input.roomId()||!c.start().equals(input.startDate())||!c.end().equals(input.endDate()))
                    throw ApiException.conflict("La clave ya corresponde a otra solicitud");
                return c;
            }
            long nights=RoomServiceImp.nights(input.startDate(),input.endDate());
            var room=rooms.lockById(input.roomId()).orElseThrow(()->ApiException.missing("Habitación"));
            if(!room.getActive()||!room.getHotel().getActive()||room.getPricePerNight()==null||room.getPricePerNight()<=0)
                throw ApiException.conflict("Habitación no habilitada para checkout");
            long amount=Math.multiplyExact(Math.multiplyExact(nights,room.getPricePerNight().longValue()),100L);
            if(amount<50||amount>99999999) throw ApiException.bad("Importe fuera de los límites del checkout USD");
            if(reservations.overlaps(room.getId(),input.startDate().atStartOfDay(),input.endDate().atStartOfDay()))
                throw ApiException.conflict("La habitación ya está reservada o retenida en esas fechas");
            UUID id=UUID.randomUUID();
            jdbc.update("INSERT INTO checkouts(id,user_id,room_id,request_key,start_date,end_date,nightly_price,amount_cents,stage) VALUES (?,?,?,?,?,?,?,?,'PENDING')",
                id,user,room.getId(),key,input.startDate(),input.endDate(),room.getPricePerNight(),amount);
            return get(id);
        });
    }
    public Checkout attach(UUID id,PaymentGateway.Intent p) {
        return locked(id,()->{ jdbc.update("UPDATE checkouts SET intent_id=coalesce(intent_id,?),payment_status=CASE WHEN stage IN ('PENDING','FINALIZING','CANCEL_REQUESTED') THEN ? ELSE payment_status END,checked_at=now() WHERE id=?",
            p.id(),p.status(),id); return get(id); });
    }
    public Checkout authorize(UUID id) {
        return locked(id,()->{
            var c=get(id);
            if(c.stage().equals("PENDING")) {
                var room=rooms.findById(c.roomId()).orElseThrow();
                boolean valid=c.expiresAt().isAfter(Instant.now())&&!c.start().isBefore(RoomServiceImp.today())
                    &&room.getActive()&&room.getHotel().getActive();
                jdbc.update("UPDATE checkouts SET stage=?,checked_at=now() WHERE id=?",valid?"FINALIZING":"CANCEL_REQUESTED",id);
            }
            return get(id);
        });
    }
    public Checkout requestCancel(UUID id) {
        return locked(id,()->{
            var c=get(id);
            if(c.stage().equals("FINALIZING")) throw ApiException.conflict("Pago en verificación; consulta el resultado antes de cancelar");
            if(c.stage().equals("PENDING")) jdbc.update("UPDATE checkouts SET stage='CANCEL_REQUESTED',checked_at=now() WHERE id=?",id);
            return get(id);
        });
    }
    public Checkout finish(UUID id,PaymentGateway.Intent p) {
        return locked(id,()->{
            var c=get(id);
            if(c.stage().equals("FINALIZING")) {
                var room=rooms.findById(c.roomId()).orElseThrow();
                if(!room.getActive()||!room.getHotel().getActive()||c.start().isBefore(RoomServiceImp.today())) {
                    jdbc.update("UPDATE checkouts SET stage='REFUND_PENDING',payment_status='succeeded',checked_at=now() WHERE id=?",id);
                    return get(id);
                }
                var r=new Reservation();
                r.setRoom(room);r.setUser(userRows.findById(c.userId()).orElseThrow());
                r.setStartDate(c.start().atStartOfDay());r.setEndDate(c.end().atStartOfDay());r.setStatus("CONFIRMED");
                r.setCreatedAt(RoomServiceImp.now());r.setNightlyPrice(c.nightly());r.setTotalPrice(c.amount()/100);
                long reservationId=reservations.saveAndFlush(r).getId();
                jdbc.update("UPDATE checkouts SET stage='SUCCEEDED',payment_status='succeeded',reservation_id=?,checked_at=now() WHERE id=?",reservationId,id);
            } else if(c.reservationId()==null&&!Set.of("REFUNDED","REFUND_FAILED").contains(c.stage())) {
                jdbc.update("UPDATE checkouts SET stage='REFUND_PENDING',payment_status='succeeded',checked_at=now() WHERE id=?",id);
            }
            return get(id);
        });
    }
    public Checkout terminal(UUID id,String stage,String paymentStatus) {
        return locked(id,()->{
            var c=get(id);
            if(Set.of("PENDING","FINALIZING","CANCEL_REQUESTED").contains(c.stage()))
                jdbc.update("UPDATE checkouts SET stage=?,payment_status=?,checked_at=now() WHERE id=?",stage,paymentStatus,id);
            return get(id);
        });
    }
    public Checkout rejectPayment(UUID id) {
        return locked(id,()->{
            jdbc.update("UPDATE checkouts SET stage='CANCEL_REQUESTED',payment_status='failed',checked_at=now() WHERE id=? AND stage IN ('PENDING','FINALIZING')",id);
            return get(id);
        });
    }
    public void touch(UUID id,String status) {
        jdbc.update("UPDATE checkouts SET payment_status=CASE WHEN stage IN ('PENDING','FINALIZING','CANCEL_REQUESTED') THEN ? ELSE payment_status END,checked_at=now() WHERE id=?",status,id);
    }
    public Checkout refundResult(UUID id,PaymentGateway.RefundResult r) {
        return locked(id,()->{
            if(get(id).stage().equals("REFUND_PENDING")) {
                String stage=switch(r.status()) {case "succeeded"->"REFUNDED";case "failed","canceled"->"REFUND_FAILED";default->"REFUND_PENDING";};
                jdbc.update("UPDATE checkouts SET stage=?,refund_id=?,payment_status=?,checked_at=now() WHERE id=?",stage,r.id(),"refund_"+r.status(),id);
            }
            return get(id);
        });
    }
    public Views.ReservationView cancelReservation(Long reservationId,String name,boolean admin) {
        // Reservation cancellation and durable refund request commit together.
        return tx.execute(s->{
            var ids=jdbc.queryForList("SELECT id FROM checkouts WHERE reservation_id=?",UUID.class,reservationId);
            if(!ids.isEmpty()) {
                var c=get(ids.get(0));rooms.lockById(c.roomId()).orElseThrow();
                jdbc.queryForObject("SELECT id FROM checkouts WHERE id=? FOR UPDATE",UUID.class,c.id());
            }
            var view=booking.cancel(reservationId,name,admin);
            jdbc.update("UPDATE checkouts SET stage='REFUND_PENDING',checked_at=now() WHERE reservation_id=? AND stage='SUCCEEDED'",reservationId);
            return view;
        });
    }
    public List<Checkout> recoverable() {
        return jdbc.query("SELECT * FROM checkouts WHERE stage IN ('PENDING','FINALIZING','CANCEL_REQUESTED','REFUND_PENDING') ORDER BY checked_at LIMIT 20",this::map);
    }
    public List<Checkout> mine(String name) {
        return jdbc.query("SELECT * FROM checkouts WHERE user_id=? ORDER BY created_at DESC LIMIT 20",this::map,users.require(name).getId());
    }
}
