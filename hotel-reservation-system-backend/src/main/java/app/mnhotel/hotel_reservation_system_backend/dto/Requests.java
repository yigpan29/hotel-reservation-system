package app.mnhotel.hotel_reservation_system_backend.dto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
public final class Requests {
    private Requests() {}
    public record Register(@NotBlank @Pattern(regexp="[a-zA-Z0-9._-]{3,40}") String username,
        @NotBlank @Email @Size(max=255) String email, @NotBlank @Size(min=8,max=72) String password) {}
    public record Login(@NotBlank @Size(max=255) String username, @NotBlank @Size(max=72) String password) {}
    public record HotelInput(@NotBlank @Size(max=255) String name, @NotBlank @Size(max=255) String location,
        @NotBlank @Size(max=255) String description, @DecimalMin("0") @DecimalMax("5") Double rating,
        @NotNull Boolean active) {}
    public record RoomInput(@NotNull @Positive Long hotelId, @NotBlank @Size(max=50) String roomNumber,
        @NotBlank @Size(max=100) String type, @NotNull @Min(0) Integer pricePerNight, @NotNull Boolean active) {}
    public record ReservationInput(@NotNull @Positive Long roomId, @NotNull LocalDate startDate, @NotNull LocalDate endDate) {}
    /** Una habitacion pedida por el cliente: sus huespedes ya configurados y el tipo que eligio. */
    public record GroupRoomInput(@NotBlank @Size(max=100) String type, @NotNull @Min(1) @Max(20) Integer adults,
        @NotNull @Min(0) @Max(20) Integer children) {}
    /** Reserva de HU6: una habitacion por grupo de huespedes, sin datos personales de los huespedes. */
    public record GroupReservationInput(@NotNull @Positive Long hotelId,
        @NotEmpty @Size(max=20) java.util.List<@NotNull @Valid GroupRoomInput> rooms,
        @NotNull LocalDate startDate, @NotNull LocalDate endDate) {}
}
