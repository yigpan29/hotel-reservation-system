package app.mnhotel.hotel_reservation_system_backend;
import java.time.*;
import org.junit.jupiter.api.Test;
import app.mnhotel.hotel_reservation_system_backend.service.NotificationText;
import static org.assertj.core.api.Assertions.*;
class NotificationTextTests {
    @Test void messagesIncludeReferenceHotelAndStay(){
        var start=LocalDate.of(2030,1,1);var end=start.plusDays(3);
        assertThat(NotificationText.message("CONFIRMED","Hotel educativo",42L,start,end)).contains("42","Hotel educativo","2030-01-01","2030-01-04","confirmada");
        assertThat(NotificationText.message("CANCELLED","Hotel educativo",42L,start,end)).contains("cancelada","42");
        assertThat(NotificationText.message("CANCELLED","Hotel educativo",42L,start,null)).contains("cancelada","42");
        assertThat(NotificationText.message("CHECK_IN_REMINDER","Hotel educativo",42L,start,end)).contains("Mañana","Hotel educativo","42");
    }
    @Test void panamaCalendarDayRatherThanTwentyFourHours(){
        assertThat(NotificationText.tomorrow(Clock.fixed(Instant.parse("2030-01-01T04:59:59Z"),ZoneOffset.UTC))).isEqualTo(LocalDate.of(2030,1,1));
        assertThat(NotificationText.tomorrow(Clock.fixed(Instant.parse("2030-01-01T05:00:00Z"),ZoneOffset.UTC))).isEqualTo(LocalDate.of(2030,1,2));
        assertThat(NotificationText.tomorrow(Clock.fixed(Instant.parse("2032-03-01T04:30:00Z"),ZoneOffset.UTC))).isEqualTo(LocalDate.of(2032,3,1));
    }
    @Test void invalidTypeAndDatesAreRejected(){
        var start=LocalDate.of(2030,1,1);
        assertThatThrownBy(()->NotificationText.message("UNKNOWN","Hotel",1L,start,start.plusDays(1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->NotificationText.message("CONFIRMED","Hotel",1L,start,start)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->NotificationText.message("CONFIRMED","",1L,start,start.plusDays(1))).isInstanceOf(IllegalArgumentException.class);
    }
}
