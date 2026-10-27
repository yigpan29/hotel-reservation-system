package app.mnhotel.hotel_reservation_system_backend.service;
import java.time.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import app.mnhotel.hotel_reservation_system_backend.repository.ReservationRepository;

@Service
public class ReminderService {
    private final Clock clock;private final JdbcTemplate jdbc;private final ReservationRepository reservations;private final NotificationService notifications;
    public ReminderService(Clock clock,JdbcTemplate jdbc,ReservationRepository reservations,NotificationService notifications){this.clock=clock;this.jdbc=jdbc;this.reservations=reservations;this.notifications=notifications;}
    @Transactional public int generate(){
        LocalDate tomorrow=NotificationText.tomorrow(clock);int count=0;
        var ids=jdbc.queryForList("""
            select r.id from reservations r where r.status='CONFIRMED' and r.start_date>=? and r.start_date<? and r.end_date>r.start_date
            and exists(select 1 from reservation_notifications n where n.reservation_id=r.id and n.type='CONFIRMED')
            and not exists(select 1 from reservation_notifications n where n.reservation_id=r.id and n.type='CHECK_IN_REMINDER')
            and not exists(select 1 from reservation_demo_items i where i.reservation_id=r.id) order by r.id
            """,Long.class,tomorrow.atStartOfDay(),tomorrow.plusDays(1).atStartOfDay());
        for(Long id:ids){var reservation=reservations.lockById(id);if(reservation.isEmpty())continue;var r=reservation.get();
            if("CONFIRMED".equals(r.getStatus())&&r.getStartDate()!=null&&r.getEndDate()!=null&&r.getEndDate().isAfter(r.getStartDate())&&r.getStartDate().toLocalDate().equals(tomorrow))count+=notifications.event(r,"CHECK_IN_REMINDER");
        }
        return count;
    }
}
