package app.mnhotel.hotel_reservation_system_backend.controller;
import java.util.Map;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController
public class HealthController {
    private final ApplicationAvailability availability;
    public HealthController(ApplicationAvailability availability){this.availability=availability;}
    @GetMapping("/api/health") public ResponseEntity<?> health(){
        boolean ready=availability.getReadinessState()==ReadinessState.ACCEPTING_TRAFFIC;
        return ResponseEntity.status(ready?200:503).body(Map.of("status",ready?"UP":"STARTING"));
    }
}
