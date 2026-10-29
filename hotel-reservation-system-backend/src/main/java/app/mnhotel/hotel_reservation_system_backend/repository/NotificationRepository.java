package app.mnhotel.hotel_reservation_system_backend.repository;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import app.mnhotel.hotel_reservation_system_backend.entity.ReservationNotification;

public interface NotificationRepository extends JpaRepository<ReservationNotification,Long> {
    Page<ReservationNotification> findByUserId(Long userId,Pageable page);
    Optional<ReservationNotification> findByIdAndUserId(Long id,Long userId);
    long countByUserIdAndReadAtIsNull(Long userId);
    @Modifying @Query("update ReservationNotification n set n.readAt=case when n.createdAt>:now then n.createdAt else :now end where n.id=:id and n.user.id=:userId and n.readAt is null")
    int readOne(Long id,Long userId,Instant now);
    @Modifying @Query("update ReservationNotification n set n.readAt=case when n.createdAt>:now then n.createdAt else :now end where n.user.id=:userId and n.readAt is null")
    int readAll(Long userId,Instant now);
}
