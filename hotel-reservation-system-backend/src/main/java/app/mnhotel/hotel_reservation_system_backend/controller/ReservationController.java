package app.mnhotel.hotel_reservation_system_backend.controller;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.data.domain.Page;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.service.imp.ReservationServiceImp;
import app.mnhotel.hotel_reservation_system_backend.checkout.CheckoutStore;
import app.mnhotel.hotel_reservation_system_backend.checkout.CheckoutConfig;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
@RestController @RequestMapping("/api/reservations")
public class ReservationController {
    private final ReservationServiceImp reservations;
    private final CheckoutStore checkout;
    private final CheckoutConfig config;
    public ReservationController(ReservationServiceImp reservations,CheckoutStore checkout,CheckoutConfig config){this.reservations=reservations;this.checkout=checkout;this.config=config;}
    private boolean admin(Authentication a){return a.getAuthorities().stream().anyMatch(r->r.getAuthority().equals("ROLE_ADMIN"));}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public Views.ReservationView create(Authentication a,@Valid @RequestBody Requests.ReservationInput input){if(config.enabled())throw ApiException.conflict("Completa el checkout para confirmar una nueva reserva");return reservations.create(a.getName(),input);}
    @PostMapping("/group") @ResponseStatus(HttpStatus.CREATED) public java.util.List<Views.ReservationView> createGroup(Authentication a,@Valid @RequestBody Requests.GroupReservationInput input){if(config.enabled())throw ApiException.conflict("Completa el checkout para confirmar las habitaciones");return reservations.createGroup(a.getName(),input);}

    @GetMapping("/me") public Views.PageView<Views.ReservationView> mine(Authentication a,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return Views.page(reservations.list(a.getName(),false,null,null,null,null,page,size));}
    @GetMapping("/{id}") public Views.ReservationView detail(Authentication a,@PathVariable Long id){return reservations.detail(id,a.getName(),admin(a));}
    @PostMapping("/{id}/cancel") public Views.ReservationView cancel(Authentication a,@PathVariable Long id){return checkout.cancelReservation(id,a.getName(),admin(a));}
}
