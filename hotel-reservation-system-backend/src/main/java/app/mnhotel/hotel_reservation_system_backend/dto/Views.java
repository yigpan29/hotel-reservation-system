package app.mnhotel.hotel_reservation_system_backend.dto;
import java.time.LocalDate;
import java.time.LocalDateTime;
import app.mnhotel.hotel_reservation_system_backend.entity.*;
public final class Views {
    private Views() {}
    public record UserView(Long id,String username,String email,String role) {}
    public record PageView<T>(java.util.List<T> content,int number,int totalPages,long totalElements) {}
    public static <T> PageView<T> page(org.springframework.data.domain.Page<T> page) {return new PageView<>(page.getContent(),page.getNumber(),page.getTotalPages(),page.getTotalElements());}
    public record HotelView(Long id,String name,String location,String description,Double rating,Boolean active) {}
    public record RoomView(Long id,Long hotelId,String hotelName,String roomNumber,String type,Integer pricePerNight,
        Integer capacity,Boolean active,Boolean available,Long totalPrice) {}
    /** Un tipo de habitacion con su capacidad, su tarifa y las unidades libres durante toda la estadia. */
    public record RoomTypeView(String type,Integer capacity,Integer available,Integer pricePerNight,Long totalPrice) {}
    /** Referencia de habitaciones necesarias y tipos disponibles para unos huespedes y unas fechas. */
    public record AllocationView(Long hotelId,LocalDate startDate,LocalDate endDate,Long nights,Integer adults,
        Integer children,Integer guests,Integer maxRoomCapacity,Integer minimumRooms,Integer availableRooms,
        Integer availableCapacity,Boolean feasible,String message,java.util.List<RoomTypeView> types) {}
    public record OccupiedRange(LocalDate startDate,LocalDate endDate) {}
    public record RoomAvailabilityView(Long roomId,Long hotelId,String hotelName,String roomNumber,String type,
        Integer pricePerNight,Boolean active,LocalDate from,LocalDate to,java.util.List<OccupiedRange> occupied) {}
    public record ReservationView(Long id,Long hotelId,String hotelName,Long roomId,String roomNumber,String roomType,
        Long userId,String username,LocalDateTime startDate,LocalDateTime endDate,String status,Integer adults,
        Integer children,Integer nightlyPrice,Long totalPrice,LocalDateTime createdAt,LocalDateTime cancelledAt) {}
    public static UserView user(User u) {return new UserView(u.getId(),u.getUsername(),u.getEmail(),u.getRole());}
    public static HotelView hotel(Hotel h) {return new HotelView(h.getId(),h.getName(),h.getLocation(),h.getDescription(),h.getRating(),h.getActive());}
    public static RoomView room(Room r,Boolean available,Long total) {return new RoomView(r.getId(),r.getHotel().getId(),r.getHotel().getName(),r.getRoomNumber(),r.getType(),r.getPricePerNight(),r.getCapacity(),r.getActive(),available,total);}
    public static ReservationView reservation(Reservation r) {return new ReservationView(r.getId(),r.getRoom().getHotel().getId(),r.getRoom().getHotel().getName(),r.getRoom().getId(),r.getRoom().getRoomNumber(),r.getRoomType(),r.getUser().getId(),r.getUser().getUsername(),r.getStartDate(),r.getEndDate(),r.getStatus(),r.getAdults(),r.getChildren(),r.getNightlyPrice(),r.getTotalPrice(),r.getCreatedAt(),r.getCancelledAt());}
}
