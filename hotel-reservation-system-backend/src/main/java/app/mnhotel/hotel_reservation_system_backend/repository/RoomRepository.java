package app.mnhotel.hotel_reservation_system_backend.repository;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import app.mnhotel.hotel_reservation_system_backend.entity.Room;
import java.util.*;
public interface RoomRepository extends JpaRepository<Room,Long> {
    List<Room> findByHotelIdOrderById(Long hotelId);
    boolean existsByHotelIdAndRoomNumberAndIdNot(Long hotelId,String number,Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select r from Room r where r.id=:id")
    Optional<Room> lockById(Long id);
}
