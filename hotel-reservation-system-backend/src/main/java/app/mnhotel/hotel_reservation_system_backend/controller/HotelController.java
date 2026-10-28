package app.mnhotel.hotel_reservation_system_backend.controller;
import java.time.LocalDate;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import org.springframework.format.annotation.DateTimeFormat;
import app.mnhotel.hotel_reservation_system_backend.dto.Views;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
@RestController
public class HotelController {
    private final HotelServiceImp hotels;private final RoomServiceImp rooms;
    public HotelController(HotelServiceImp hotels,RoomServiceImp rooms){this.hotels=hotels;this.rooms=rooms;}
    @GetMapping("/api/hotels") public List<Views.HotelView> hotels(@RequestParam(defaultValue="") String q){return hotels.list(q,false);}
    @GetMapping("/api/hotels/{id}") public Views.HotelView hotel(@PathVariable Long id){return hotels.detail(id,false);}
    @GetMapping("/api/hotels/{id}/rooms") public List<Views.RoomView> rooms(@PathVariable Long id,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate startDate,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate endDate){return rooms.list(id,startDate,endDate,false);}
    @GetMapping("/api/rooms/{id}/occupancy") public Views.RoomAvailabilityView occupancy(@PathVariable Long id,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to){return rooms.occupancy(id,from,to,false);}
    @GetMapping("/api/rooms/allocation") public Views.AllocationView allocation(@RequestParam Long hotelId,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate startDate,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate endDate,@RequestParam(defaultValue="2") int adults,@RequestParam(defaultValue="0") int children){return rooms.allocation(hotelId,startDate,endDate,adults,children);}
    @GetMapping("/api/rooms/availability") public List<Views.RoomView> availability(@RequestParam Long hotelId,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate startDate,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate endDate){return rooms.list(hotelId,startDate,endDate,false).stream().filter(r->Boolean.TRUE.equals(r.available())).toList();}
}
