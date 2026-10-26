package app.mnhotel.hotel_reservation_system_backend.repository;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.*;
import app.mnhotel.hotel_reservation_system_backend.entity.Reservation;
public interface ReservationRepository extends JpaRepository<Reservation,Long> {
    @Query("select count(r)>0 from Reservation r where r.room.id=:roomId and r.status='CONFIRMED' and r.startDate<:end and r.endDate>:start")
    boolean overlaps(Long roomId,LocalDateTime start,LocalDateTime end);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select r from Reservation r where r.id=:id")
    Optional<Reservation> lockById(Long id);
    @Query("select r from Reservation r where (:userId is null or r.user.id=:userId) and (:hotelId is null or r.room.hotel.id=:hotelId) and (:roomId is null or r.room.id=:roomId) and (:status is null or r.status=:status)")
    Page<Reservation> filter(Long userId,Long hotelId,Long roomId,String status,Pageable page);
}
