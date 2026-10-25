package app.mnhotel.hotel_reservation_system_backend.controller;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.data.domain.Page;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.service.imp.ReservationServiceImp;
@RestController @RequestMapping("/api/reservations")
public class ReservationController {
    private final ReservationServiceImp reservations;
    public ReservationController(ReservationServiceImp reservations){this.reservations=reservations;}
    private boolean admin(Authentication a){return a.getAuthorities().stream().anyMatch(r->r.getAuthority().equals("ROLE_ADMIN"));}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public Views.ReservationView create(Authentication a,@Valid @RequestBody Requests.ReservationInput input){return reservations.create(a.getName(),input);}
    @GetMapping("/me") public Views.PageView<Views.ReservationView> mine(Authentication a,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return Views.page(reservations.list(a.getName(),false,null,null,null,null,page,size));}
    @GetMapping("/{id}") public Views.ReservationView detail(Authentication a,@PathVariable Long id){return reservations.detail(id,a.getName(),admin(a));}
    @PostMapping("/{id}/cancel") public Views.ReservationView cancel(Authentication a,@PathVariable Long id){return reservations.cancel(id,a.getName(),admin(a));}
}
