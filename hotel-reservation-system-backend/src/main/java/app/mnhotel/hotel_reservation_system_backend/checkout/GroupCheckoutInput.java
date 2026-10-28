package app.mnhotel.hotel_reservation_system_backend.checkout;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests.GroupRoomInput;

public record GroupCheckoutInput(@NotNull @Positive Long hotelId,
    @NotEmpty @Size(max=20) List<@NotNull @Valid GroupRoomInput> rooms,
    @NotNull LocalDate startDate,@NotNull LocalDate endDate,UUID paymentMethodId,boolean saveMethod) {}
