package app.mnhotel.hotel_reservation_system_backend.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import app.mnhotel.hotel_reservation_system_backend.entity.User;
import java.util.Optional;
public interface UserRepository extends JpaRepository<User,Long> {
    Optional<User> findByUsernameIgnoreCase(String username);
    boolean existsByUsernameIgnoreCase(String username);
    boolean existsByEmailIgnoreCase(String email);
}
