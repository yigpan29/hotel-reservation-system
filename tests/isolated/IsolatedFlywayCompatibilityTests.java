package app.mnhotel.hotel_reservation_system_backend;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootVersion;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
    "spring.flyway.enabled=true",
    "spring.flyway.locations=classpath:db/migration",
    "spring.flyway.baseline-on-migrate=false",
    "spring.flyway.clean-disabled=true"
})
class IsolatedFlywayCompatibilityTests {
    @Autowired
    private Flyway flyway;

    @Test
    void bootAutoConfiguresSelectedFlywayAgainstOnlyTheIsolatedDatabase() throws Exception {
        assertThat(SpringBootVersion.getVersion()).isEqualTo("3.3.2");
        assertThat(Flyway.class.getProtectionDomain().getCodeSource().getLocation().toString())
            .contains("flyway-core-10.20.1.jar");
        assertThat(flyway.getConfiguration().isBaselineOnMigrate()).isFalse();
        assertThat(flyway.getConfiguration().isCleanDisabled()).isTrue();
        assertThat(flyway.info().current().getVersion().toString()).isEqualTo("8");
        assertThat(flyway.info().pending()).isEmpty();
        flyway.validate();
        try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
            assertThat(connection.getMetaData().getURL())
                .isEqualTo("jdbc:postgresql://postgres-test:5432/hotel_test");
            assertThat(connection.getCatalog()).isEqualTo("hotel_test");
            assertThat(connection.getMetaData().getDatabaseMajorVersion()).isEqualTo(17);
        }
    }
}
