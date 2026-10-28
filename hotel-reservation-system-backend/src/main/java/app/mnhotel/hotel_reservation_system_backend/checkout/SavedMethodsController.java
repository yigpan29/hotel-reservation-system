package app.mnhotel.hotel_reservation_system_backend.checkout;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

@RestController @RequestMapping("/api/payment-methods")
public class SavedMethodsController {
    private final SavedMethods methods;
    public SavedMethodsController(SavedMethods methods){this.methods=methods;}
    @GetMapping public List<SavedMethods.View> mine(Authentication a){return methods.mine(a.getName());}
    @PostMapping("/{id}/revoke") public void revoke(Authentication a,@PathVariable UUID id){methods.revoke(a.getName(),id);}
}
