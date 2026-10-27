package app.mnhotel.hotel_reservation_system_backend.configuration;
import java.time.*;
import org.springframework.context.annotation.*;
@Configuration
public class DemandClock {
    @Bean public Clock forecastClock(){return Clock.system(ZoneId.of("America/Panama"));}
}
