package app.mnhotel.hotel_reservation_system_backend;

import app.mnhotel.hotel_reservation_system_backend.service.PanamaCatalog;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @Transactional
class PanamaCatalogTests {
    @Autowired PanamaCatalog catalog;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthServiceImp auth;
    @Autowired ReservationServiceImp reservations;
    private void isolated(){assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("hotel_test");}
    @Test void requiresConfirmationAndExactDatabase() {
        isolated();
        assertThatThrownBy(()->catalog.load(null,"hotel_test")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->catalog.load("LOAD_EDUCATIONAL_PANAMA","hotel-bd")).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("select count(*) from hotels",Long.class)).isZero();
    }
    @Test void createsRepeatableCatalogAndPreservesManualInventoryAndBookings() throws Exception {
        isolated();
        var first=catalog.load("LOAD_EDUCATIONAL_PANAMA","hotel_test");
        assertThat(first).isEqualTo(new PanamaCatalog.Result(12,72,0));
        assertThat(jdbc.queryForObject("select count(*) from hotels where active and rating is null",Long.class)).isEqualTo(12);
        assertThat(jdbc.queryForObject("select count(*) from rooms where active and availability and price_per_night>=0",Long.class)).isEqualTo(72);
        assertThat(jdbc.queryForObject("select count(*) from (select hotel_id,room_number from rooms group by hotel_id,room_number having count(*)>1) d",Long.class)).isZero();
        Long hotelId=jdbc.queryForObject("select id from hotels where name='Hilton Panama'",Long.class);
        Long roomId=jdbc.queryForObject("select id from rooms where room_number='DEMO-HIL-101'",Long.class);
        auth.register(new Requests.Register("catalog-user","catalog-user@example.invalid","Catalog-test-123"));
        var booking=reservations.create("catalog-user",new Requests.ReservationInput(roomId,RoomServiceImp.today().plusDays(20),RoomServiceImp.today().plusDays(22)));
        jdbc.update("update hotels set name='Nombre editado por administrador',description='Descripción manual',active=false where id=?",hotelId);
        jdbc.update("update rooms set room_number='CUSTOM-101',type='Tipo manual',price_per_night=333,active=false where id=?",roomId);
        var repeat=catalog.load("LOAD_EDUCATIONAL_PANAMA","hotel_test");
        assertThat(repeat).isEqualTo(new PanamaCatalog.Result(0,0,12));
        assertThat(jdbc.queryForObject("select count(*) from hotels",Long.class)).isEqualTo(12);
        assertThat(jdbc.queryForObject("select count(*) from rooms",Long.class)).isEqualTo(72);
        assertThat(jdbc.queryForObject("select description from hotels where id=?",String.class,hotelId)).isEqualTo("Descripción manual");
        assertThat(jdbc.queryForObject("select price_per_night from rooms where id=?",Integer.class,roomId)).isEqualTo(333);
        assertThat(jdbc.queryForObject("select room_number from rooms where id=?",String.class,roomId)).isEqualTo("CUSTOM-101");
        assertThat(jdbc.queryForObject("select total_price from reservations where id=?",Long.class,booking.id())).isEqualTo(300);
        assertThat(jdbc.queryForObject("select role from users where username='catalog-user'",String.class)).isEqualTo("USER");
    }
    @Test void rejectsAmbiguousExistingHotelsWithoutGuessing() throws Exception {
        isolated();
        jdbc.update("insert into hotels(name,active) values ('Hilton Panama',true),('Hilton Panama',true)");
        assertThatThrownBy(()->catalog.load("LOAD_EDUCATIONAL_PANAMA","hotel_test")).isInstanceOf(IllegalStateException.class).hasMessageContaining("ambigua");
        assertThat(jdbc.queryForObject("select count(*) from rooms",Long.class)).isZero();
    }
}
