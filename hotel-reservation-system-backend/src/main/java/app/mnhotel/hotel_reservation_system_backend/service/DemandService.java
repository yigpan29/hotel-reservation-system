package app.mnhotel.hotel_reservation_system_backend.service;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.math.BigDecimal;
import org.springframework.stereotype.Service;
import org.springframework.core.env.Environment;
import org.springframework.transaction.annotation.*;
import app.mnhotel.hotel_reservation_system_backend.dto.DemandViews.*;
import app.mnhotel.hotel_reservation_system_backend.repository.DemandRepository;
import app.mnhotel.hotel_reservation_system_backend.service.imp.HotelServiceImp;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;

@Service @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class DemandService {
    private final DemandRepository repository;private final HotelServiceImp hotels;private final Clock clock;private final Environment env;
    public DemandService(DemandRepository repository,HotelServiceImp hotels,Clock clock,Environment env){this.repository=repository;this.hotels=hotels;this.clock=clock;this.env=env;}
    private LocalDate today(){return LocalDate.now(clock.withZone(ZoneId.of("America/Panama")));}
    private void hotel(Long id){if(id!=null){if(id<=0)throw ApiException.bad("El hotel debe ser un identificador positivo");hotels.require(id);}}
    private Context context(Long hotelId,LocalDate start,LocalDate end,LocalDate futureStart,LocalDate futureEnd){
        String kind=env.getProperty("HOTEL_DEMAND_DATA_KIND","OPERATIONAL");
        if(!kind.equals("OPERATIONAL")&&!kind.equals("SYNTHETIC_DEMO"))throw new IllegalStateException("Origen estadístico inválido");
        if(kind.equals("SYNTHETIC_DEMO")&&(!env.matchesProfiles("isolated","demo")||!Set.of("hotel_test","hotel_demo").contains(repository.database())))throw new IllegalStateException("Historial sintético permitido solo en demostración aislada");
        var origin=repository.origin(hotelId,start,end,futureStart,futureEnd);
        boolean instanceSynthetic=kind.equals("SYNTHETIC_DEMO");
        long synthetic=instanceSynthetic?origin.synthetic()+origin.operational():origin.synthetic(),operational=instanceSynthetic?0:origin.operational();
        if(!instanceSynthetic)kind=synthetic==0?"OPERATIONAL":operational==0?"SYNTHETIC_DEMO":"MIXED";
        return new Context(hotelId,kind,repository.capacity(hotelId),repository.invalid(hotelId),List.of(
            "Noches comprometidas según estado actual CONFIRMED; no equivale a ocupación efectiva observada.",
            "Cancelaciones actuales excluidas también del pasado; estados desconocidos y fechas inválidas no aportan noches.",
            "Porcentajes orientativos con capacidad activa actual, sin historial de altas/bajas. No son ocupación histórica real.",
            "La antigüedad del primer registro no garantiza un historial completo. Modelo básico sin intervalos de confianza; puede estimar menos noches que las ya confirmadas.",
            "No se modifican reservas, precios ni disponibilidad. La estimación no se suma a las reservas confirmadas."),synthetic,operational,origin.batches());
    }
    public History history(Long hotelId,LocalDate startDate,LocalDate endDate){
        hotel(hotelId);LocalDate today=today(),trainingStart=DemandMath.trainingStart(today);
        LocalDate start=startDate==null?trainingStart:startDate,end=endDate==null?trainingStart.plusDays(55):endDate;
        if(start.getYear()<1900||end.isBefore(start)||!end.isBefore(today)||ChronoUnit.DAYS.between(start,end)>=366)throw ApiException.bad("Selecciona un período pasado válido de 1 a 366 días, hasta ayer");
        var context=context(hotelId,start,end,null,null);var raw=repository.daily(hotelId,start,end);var counts=repository.counts(hotelId,start,end);
        long nights=raw.stream().mapToLong(DemandRepository.Daily::roomNights).sum(),duplicates=raw.stream().mapToLong(d->d.rawConfirmedNights()-d.roomNights()).sum();
        long max=raw.stream().mapToLong(DemandRepository.Daily::roomNights).max().orElse(0),min=raw.stream().mapToLong(DemandRepository.Daily::roomNights).min().orElse(0);
        BigDecimal ratio=max>context.currentActiveRooms()?null:DemandMath.percent(BigDecimal.valueOf(nights),Math.multiplyExact(context.currentActiveRooms(),raw.size()));
        var summary=new Summary(counts.total(),counts.confirmed(),counts.cancelled(),counts.unknown(),nights,DemandMath.average(nights,raw.size()),ratio,duplicates,
            raw.stream().filter(d->d.roomNights()==max).map(DemandRepository.Daily::date).toList(),raw.stream().filter(d->d.roomNights()==min).map(DemandRepository.Daily::date).toList());
        return new History(context,start,end,summary,raw.stream().map(d->new Day(d.date(),d.roomNights(),DemandMath.percent(BigDecimal.valueOf(d.roomNights()),context.currentActiveRooms()))).toList());
    }
    public Forecast forecast(Long hotelId){
        hotel(hotelId);LocalDate today=today(),start=DemandMath.trainingStart(today),end=start.plusDays(55);
        var context=context(hotelId,start,end,today.plusDays(1),today.plusDays(30));var training=repository.daily(hotelId,start,end);LocalDate earliest=repository.earliest(hotelId);
        boolean enough=earliest!=null&&!earliest.isAfter(start)&&training.stream().anyMatch(d->d.roomNights()>0);
        var averages=DemandMath.weekdays(training);
        return new Forecast(context,today,start,end,today.plusDays(1),today.plusDays(30),earliest,enough?"AVAILABLE":"INSUFFICIENT_HISTORY",
            enough?"Estimación orientativa: promedio por día de la semana, no reservas confirmadas.":"No existen datos suficientes para generar una previsión confiable: se requieren ocho semanas completas de referencia y actividad confirmada.",
            "WEEKDAY_MEAN_8_COMPLETE_WEEKS_HALF_UP_2",averages,enough?DemandMath.predict(today,averages,repository.daily(hotelId,today.plusDays(1),today.plusDays(30)),context.currentActiveRooms()):List.of());
    }
}
