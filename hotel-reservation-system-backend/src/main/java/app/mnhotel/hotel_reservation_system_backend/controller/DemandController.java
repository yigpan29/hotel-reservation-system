package app.mnhotel.hotel_reservation_system_backend.controller;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.*;
import org.springframework.format.annotation.DateTimeFormat;
import app.mnhotel.hotel_reservation_system_backend.dto.DemandViews.*;
import app.mnhotel.hotel_reservation_system_backend.service.DemandService;

@RestController @RequestMapping("/api/admin/demand")
public class DemandController {
    private final DemandService demand;
    public DemandController(DemandService demand){this.demand=demand;}
    @GetMapping("/history") public History history(@RequestParam(required=false) Long hotelId,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate startDate,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate endDate){return demand.history(hotelId,startDate,endDate);}
    @GetMapping("/forecast") public Forecast forecast(@RequestParam(required=false) Long hotelId){return demand.forecast(hotelId);}
}
