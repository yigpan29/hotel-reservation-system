package app.mnhotel.hotel_reservation_system_backend;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:postgresql://postgres-test:5432/hotel_hu05",
    "spring.flyway.enabled=true",
    "spring.flyway.locations=classpath:db/legacy-hu05",
    "spring.jpa.hibernate.ddl-auto=validate"
})
class LegacyHu05CompatibilityTests {
    @Autowired Flyway flyway;
    @Autowired JdbcTemplate jdbc;

    @Test void originalHistoryAndNotificationsRemainUsableWithHibernateValidation() {
        flyway.validate();
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("hotel_hu05");
        assertThat(jdbc.queryForObject("select count(*) from reservation_notifications where message='Preserve me'", Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("select count(*) from reservations where adults is null and children is null and room_type is null", Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("select script from flyway_schema_history where version='3'", String.class)).isEqualTo("V3__tracked_demonstration_history.sql");
        assertThat(jdbc.queryForObject("select checksum from flyway_schema_history where version='4'", Integer.class)).isEqualTo(177359749);
    }
}
