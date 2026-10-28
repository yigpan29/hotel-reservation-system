package app.mnhotel.hotel_reservation_system_backend.configuration;
import java.time.*;
import org.springframework.boot.*;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;
import app.mnhotel.hotel_reservation_system_backend.service.DemandHistoryBatchService;

@Component @Profile("demand-history")
public class DemandHistoryRunner implements ApplicationRunner {
    private final DemandHistoryBatchService batches;private final Environment env;private final Clock clock;private final ObjectMapper json;
    public DemandHistoryRunner(DemandHistoryBatchService batches,Environment env,Clock clock,ObjectMapper json){this.batches=batches;this.env=env;this.clock=clock;this.json=json;}
    public void run(ApplicationArguments args)throws Exception{
        String code=env.getRequiredProperty("HOTEL_HISTORY_BATCH"),database=env.getRequiredProperty("HOTEL_HISTORY_DATABASE"),confirmation=env.getRequiredProperty("HOTEL_HISTORY_CONFIRM");
        String action=env.getRequiredProperty("HOTEL_HISTORY_ACTION");
        var result=switch(action){
            case "create" -> batches.create(new DemandHistoryBatchService.Options(code,LocalDate.parse(env.getProperty("HOTEL_HISTORY_REFERENCE_DATE",LocalDate.now(clock.withZone(ZoneId.of("America/Panama"))).toString())),env.getProperty("HOTEL_HISTORY_SEED",Long.class,73003L),env.getProperty("HOTEL_HISTORY_WEEKS",Integer.class,12)),database,confirmation);
            case "inspect" -> batches.inspect(code,database,confirmation);
            case "revert" -> batches.revert(code,database,confirmation);
            default -> throw new IllegalArgumentException("Acción no permitida");
        };
        System.out.println("HU03_HISTORY_RESULT="+json.writeValueAsString(result));
    }
}
