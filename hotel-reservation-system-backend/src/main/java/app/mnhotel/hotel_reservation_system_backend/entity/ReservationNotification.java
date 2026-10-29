package app.mnhotel.hotel_reservation_system_backend.entity;
import java.time.*;
import jakarta.persistence.*;
import lombok.Getter;

@Entity @Table(name="reservation_notifications") @Getter
public class ReservationNotification {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="user_id",nullable=false) private User user;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="reservation_id",nullable=false) private Reservation reservation;
    @Column(nullable=false,length=32) private String type;
    @Column(name="hotel_name",nullable=false) private String hotelName;
    @Column(name="start_date",nullable=false) private LocalDate startDate;
    @Column(name="end_date") private LocalDate endDate;
    @Column(nullable=false,length=1000) private String message;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="read_at") private Instant readAt;
}
