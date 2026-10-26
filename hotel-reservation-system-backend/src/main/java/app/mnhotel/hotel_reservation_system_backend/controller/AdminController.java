package app.mnhotel.hotel_reservation_system_backend.controller;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
@RestController @RequestMapping("/api/admin")
public class AdminController {
    private final HotelServiceImp hotels;private final RoomServiceImp rooms;private final ReservationServiceImp reservations;
    public AdminController(HotelServiceImp hotels,RoomServiceImp rooms,ReservationServiceImp reservations){this.hotels=hotels;this.rooms=rooms;this.reservations=reservations;}
    @GetMapping("/hotels") public List<Views.HotelView> hotels(@RequestParam(defaultValue="") String q){return hotels.list(q,true);}
    @PostMapping("/hotels") @ResponseStatus(HttpStatus.CREATED) public Views.HotelView createHotel(@Valid @RequestBody Requests.HotelInput input){return hotels.save(null,input);}
    @PutMapping("/hotels/{id}") public Views.HotelView updateHotel(@PathVariable Long id,@Valid @RequestBody Requests.HotelInput input){return hotels.save(id,input);}
    @GetMapping("/hotels/{id}/rooms") public List<Views.RoomView> rooms(@PathVariable Long id){return rooms.list(id,null,null,true);}
    @PostMapping("/rooms") @ResponseStatus(HttpStatus.CREATED) public Views.RoomView createRoom(@Valid @RequestBody Requests.RoomInput input){return rooms.save(null,input);}
    @PutMapping("/rooms/{id}") public Views.RoomView updateRoom(@PathVariable Long id,@Valid @RequestBody Requests.RoomInput input){return rooms.save(id,input);}
    @GetMapping("/reservations") public Views.PageView<Views.ReservationView> reservations(@RequestParam(required=false) Long hotelId,@RequestParam(required=false) Long roomId,@RequestParam(required=false) Long userId,@RequestParam(required=false) String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return Views.page(reservations.list(null,true,userId,hotelId,roomId,status,page,size));}
}
