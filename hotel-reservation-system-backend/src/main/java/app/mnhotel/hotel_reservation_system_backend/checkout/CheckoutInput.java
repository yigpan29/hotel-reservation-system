package app.mnhotel.hotel_reservation_system_backend.checkout;

import java.time.LocalDate;
import java.util.UUID;
import jakarta.validation.constraints.*;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;

public record CheckoutInput(@NotNull @Positive Long roomId,@NotNull LocalDate startDate,
    @NotNull LocalDate endDate,UUID paymentMethodId,boolean saveMethod) {
    public Requests.ReservationInput reservation(){return new Requests.ReservationInput(roomId,startDate,endDate);}
}
