package app.mnhotel.hotel_reservation_system_backend.controller;

import app.mnhotel.hotel_reservation_system_backend.service.ReservationCertificateService;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reservations")
public class ReservationCertificateController {
    private final ReservationCertificateService certificates;
    public ReservationCertificateController(ReservationCertificateService certificates) { this.certificates = certificates; }

    @GetMapping(value = "/{id}/certificate", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> download(Authentication user, @PathVariable Long id) {
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("constancia-reserva-" + id + ".pdf").build().toString())
            .header(HttpHeaders.CACHE_CONTROL, "no-store, private")
            .header("X-Content-Type-Options", "nosniff")
            .body(certificates.create(id, user.getName()));
    }
}
