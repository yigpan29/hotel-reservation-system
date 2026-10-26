package app.mnhotel.hotel_reservation_system_backend.service;

import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;

/** Explicit educational inventory, independent of account provisioning and Flyway. */
@Service
public class PanamaCatalog {
    public record Entry(String key,String name,String location,String description,int basePrice,String source) {}
    public record Result(int hotelsCreated,int roomsCreated,int hotelsPreserved) {}
    private static final String NOTICE=" Demostración educativa: habitaciones y tarifas simuladas; sin afiliación al hotel.";
    private static final List<String> TYPES=List.of("Individual","Doble","Matrimonial","Deluxe","Familiar","Suite");
    private static final int[] EXTRA={0,20,25,45,60,95};
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final Validator validator;
    private final Environment env;
    private final HotelServiceImp hotels;
    private final RoomServiceImp rooms;
    public PanamaCatalog(JdbcTemplate jdbc,ObjectMapper json,Validator validator,Environment env,HotelServiceImp hotels,RoomServiceImp rooms){this.jdbc=jdbc;this.json=json;this.validator=validator;this.env=env;this.hotels=hotels;this.rooms=rooms;}

    @Transactional(rollbackFor=Exception.class)
    public Result load(String confirmation,String expectedDatabase) throws Exception {
        if(!"LOAD_EDUCATIONAL_PANAMA".equals(confirmation)||env.matchesProfiles("prod","production"))throw new IllegalStateException("La carga exige autorización explícita fuera de producción");
        String database=jdbc.queryForObject("select current_database()",String.class);
        if(!Set.of("hotel-bd","hotel_demo","hotel_test").contains(database)||!database.equals(expectedDatabase))throw new IllegalStateException("La base de destino no está autorizada");
        Entry[] entries;
        try(var stream=PanamaCatalog.class.getResourceAsStream("/demo/panama-hotels.json")){
            if(stream==null)throw new IllegalStateException("Falta catálogo educativo");
            entries=json.readValue(stream,Entry[].class);
        }
        Set<String> keys=new HashSet<>(),names=new HashSet<>();
        for(var entry:entries){
            if(entry.key()==null||!entry.key().matches("[A-Z]{3}")||!keys.add(entry.key())||!names.add(entry.name())||entry.basePrice()<0||!entry.source().startsWith("https://"))throw new IllegalStateException("Catálogo inválido o duplicado");
            if(!validator.validate(input(entry)).isEmpty())throw new IllegalStateException("Datos de hotel inválidos: "+entry.key());
        }
        // Serialize only this explicit command; never update existing hotels or rooms.
        jdbc.execute("select pg_advisory_xact_lock(824620251)");
        int created=0,roomCount=0,skipped=0;
        for(var entry:entries){
            String prefix="DEMO-"+entry.key()+"-";
            var matches=jdbc.queryForList("select distinct h.id from hotels h left join rooms r on r.hotel_id=h.id where lower(h.name)=lower(?) or r.room_number like ?",Long.class,entry.name(),prefix+"%");
            if(matches.size()>1)throw new IllegalStateException("Identidad de hotel ambigua: "+entry.key()+"; no se modificó inventario");
            // Existing inventory belongs to the operator. Do not recreate renamed/retired rooms.
            if(!matches.isEmpty()){skipped++;continue;}
            Long hotelId=hotels.save(null,input(entry)).id();
            created++;
            for(int i=0;i<TYPES.size();i++){
                var room=new Requests.RoomInput(hotelId,prefix+(101+i),TYPES.get(i),Math.addExact(entry.basePrice(),EXTRA[i]),true);
                if(!validator.validate(room).isEmpty())throw new IllegalStateException("Habitación inválida");
                rooms.save(null,room);roomCount++;
            }
        }
        return new Result(created,roomCount,skipped);
    }
    private Requests.HotelInput input(Entry entry){return new Requests.HotelInput(entry.name(),entry.location(),entry.description()+NOTICE,null,true);}
}
