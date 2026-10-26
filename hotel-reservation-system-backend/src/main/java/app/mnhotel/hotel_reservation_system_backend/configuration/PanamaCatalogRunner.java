package app.mnhotel.hotel_reservation_system_backend.configuration;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import app.mnhotel.hotel_reservation_system_backend.service.PanamaCatalog;

@Component @Profile("catalog-panama")
public class PanamaCatalogRunner implements ApplicationRunner {
    private final PanamaCatalog catalog;
    private final Environment env;
    public PanamaCatalogRunner(PanamaCatalog catalog,Environment env){this.catalog=catalog;this.env=env;}
    @Override public void run(ApplicationArguments args) throws Exception {
        var result=catalog.load(env.getProperty("HOTEL_CATALOG_CONFIRM"),env.getProperty("HOTEL_CATALOG_DATABASE"));
        System.out.printf("PANAMA_CATALOG_COMPLETE hotels=%d rooms=%d preserved=%d%n",result.hotelsCreated(),result.roomsCreated(),result.hotelsPreserved());
    }
}
