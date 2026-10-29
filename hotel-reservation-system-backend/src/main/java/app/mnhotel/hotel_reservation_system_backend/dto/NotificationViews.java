package app.mnhotel.hotel_reservation_system_backend.dto;
import java.time.*;
import app.mnhotel.hotel_reservation_system_backend.entity.ReservationNotification;

public final class NotificationViews {
    private NotificationViews() {}
    public record Notice(Long id,Long reservationId,String type,String hotelName,LocalDate startDate,LocalDate endDate,String message,Instant createdAt,boolean read,Instant readAt) {}
    public record Count(long unreadCount) {}
    public static Notice view(ReservationNotification n){return new Notice(n.getId(),n.getReservation().getId(),n.getType(),n.getHotelName(),n.getStartDate(),n.getEndDate(),n.getMessage(),n.getCreatedAt(),n.getReadAt()!=null,n.getReadAt());}
}
