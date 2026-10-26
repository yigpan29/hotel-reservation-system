package app.mnhotel.hotel_reservation_system_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication()
public class HotelReservationSystemApplication {

	public static void main(String[] args) {
		var context=SpringApplication.run(HotelReservationSystemApplication.class, args);
        if(context.getEnvironment().matchesProfiles("catalog-panama","provision-admin")
            && context.getEnvironment().getProperty("HOTEL_SETUP_EXIT",Boolean.class,false))context.close();
	}

}
