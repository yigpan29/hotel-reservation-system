package app.mnhotel.hotel_reservation_system_backend.repository;
import org.springframework.data.jpa.repository.*;
import app.mnhotel.hotel_reservation_system_backend.entity.Hotel;
import java.util.*;
public interface HotelRepository extends JpaRepository<Hotel,Long> {
    @Query("select h from Hotel h where (:includeInactive=true or h.active=true) and (lower(h.name) like lower(concat('%',:q,'%')) or lower(h.location) like lower(concat('%',:q,'%'))) order by h.id")
    List<Hotel> search(String q,boolean includeInactive);
}
