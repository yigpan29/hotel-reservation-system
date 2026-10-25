package app.mnhotel.hotel_reservation_system_backend.configuration;
import java.util.Map;
import javax.sql.DataSource;
import jakarta.validation.Validator;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.core.env.Environment;
import org.springframework.transaction.annotation.Transactional;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.repository.*;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
@Component @Profile({"demo","provision-admin"})
public class DemoData implements ApplicationRunner {
    private final Environment env;private final AuthServiceImp auth;private final HotelServiceImp hotels;private final RoomServiceImp rooms;private final UserRepository users;private final HotelRepository inventory;private final DataSource data;private final Validator validator;
    public DemoData(Environment env,AuthServiceImp auth,HotelServiceImp hotels,RoomServiceImp rooms,UserRepository users,HotelRepository inventory,DataSource data,Validator validator){this.env=env;this.auth=auth;this.hotels=hotels;this.rooms=rooms;this.users=users;this.inventory=inventory;this.data=data;this.validator=validator;}
    private String required(String key){String value=env.getProperty(key);if(value==null||value.isBlank())throw new IllegalStateException("Falta configuración privada: "+key);return value;}
    private Requests.Register account(String prefix){var request=new Requests.Register(required(prefix+"_USERNAME"),required(prefix+"_EMAIL"),required(prefix+"_PASSWORD"));if(!validator.validate(request).isEmpty())throw new IllegalStateException("Configuración de cuenta inválida: "+prefix);return request;}
    @Override @Transactional public void run(ApplicationArguments args) throws Exception {
        if(env.matchesProfiles("provision-admin")){
            if(!"CREATE_ADMIN".equals(required("HOTEL_ADMIN_CONFIRM")))throw new IllegalStateException("Falta confirmación explícita de administrador");
            auth.create(account("HOTEL_ADMIN"),"ADMIN");return;
        }
        if(!"CREATE_SYNTHETIC_DATA".equals(required("HOTEL_DEMO_CONFIRM")))throw new IllegalStateException("Falta confirmación explícita de demostración");
        try(var connection=data.getConnection()){if(!java.util.Set.of("hotel_test","hotel_demo").contains(connection.getCatalog()))throw new IllegalStateException("Demo permitida únicamente en hotel_demo o hotel_test");}
        if(users.count()>0||inventory.count()>0)throw new IllegalStateException("La carga demo exige una base sin usuarios ni hoteles; no sobrescribe datos");
        auth.create(account("HOTEL_DEMO_ADMIN"),"ADMIN");auth.create(account("HOTEL_DEMO_USER"),"USER");
        for(int i=1;i<=3;i++){var hotel=hotels.save(null,new Requests.HotelInput("Hotel Demo "+i,i==1?"Panamá":"Chiriquí","Alojamiento sintético para demostración universitaria",4.0,true));
            rooms.save(null,new Requests.RoomInput(hotel.id(),"101","Doble",80*i,true));rooms.save(null,new Requests.RoomInput(hotel.id(),"102","Suite",120*i,true));}
    }
}
