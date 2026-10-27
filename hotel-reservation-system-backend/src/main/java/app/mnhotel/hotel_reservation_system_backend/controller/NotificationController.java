package app.mnhotel.hotel_reservation_system_backend.controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.service.NotificationService;

@RestController @RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notifications;
    public NotificationController(NotificationService notifications){this.notifications=notifications;}
    @GetMapping public Views.PageView<NotificationViews.Notice> list(Authentication a,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return notifications.list(a.getName(),page,size);}
    @GetMapping("/unread-count") public NotificationViews.Count count(Authentication a){return notifications.count(a.getName());}
    @PostMapping("/{id}/read") @ResponseStatus(HttpStatus.NO_CONTENT) public void read(Authentication a,@PathVariable Long id){notifications.read(a.getName(),id);}
    @PostMapping("/read-all") @ResponseStatus(HttpStatus.NO_CONTENT) public void all(Authentication a){notifications.readAll(a.getName());}
}
