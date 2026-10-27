package app.mnhotel.hotel_reservation_system_backend.service;
import java.time.*;
import java.sql.Timestamp;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.domain.*;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.entity.Reservation;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
import app.mnhotel.hotel_reservation_system_backend.repository.NotificationRepository;
import app.mnhotel.hotel_reservation_system_backend.service.imp.AuthServiceImp;

@Service @Transactional(readOnly=true)
public class NotificationService {
    private final NotificationRepository notices;private final AuthServiceImp users;private final JdbcTemplate jdbc;private final Clock clock;
    public NotificationService(NotificationRepository notices,AuthServiceImp users,JdbcTemplate jdbc,Clock clock){this.notices=notices;this.users=users;this.jdbc=jdbc;this.clock=clock;}
    @Transactional public int event(Reservation r,String type){
        String text=NotificationText.message(type,r.getRoom().getHotel().getName(),r.getId(),r.getStartDate().toLocalDate(),r.getEndDate()==null?null:r.getEndDate().toLocalDate());
        return jdbc.update("""
            insert into reservation_notifications(user_id,reservation_id,type,hotel_name,start_date,end_date,message,created_at)
            select r.user_id,r.id,?,h.name,r.start_date::date,r.end_date::date,?,? from reservations r
            join rooms rm on rm.id=r.room_id join hotels h on h.id=rm.hotel_id
            where r.id=? and not exists(select 1 from reservation_demo_items i where i.reservation_id=r.id)
            on conflict(reservation_id,type) do nothing
            """,type,text,Timestamp.from(clock.instant()),r.getId());
    }
    public Views.PageView<NotificationViews.Notice> list(String username,int page,int size){
        if(page<0||size<1||size>100)throw ApiException.bad("Paginación inválida (size entre 1 y 100)");
        return Views.page(notices.findByUserId(users.require(username).getId(),PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"createdAt","id"))).map(NotificationViews::view));
    }
    public NotificationViews.Count count(String username){return new NotificationViews.Count(notices.countByUserIdAndReadAtIsNull(users.require(username).getId()));}
    @Transactional public void read(String username,Long id){
        long user=users.require(username).getId();
        if(id<=0||notices.findByIdAndUserId(id,user).isEmpty())throw ApiException.missing("Notificación");
        notices.readOne(id,user,clock.instant());
    }
    @Transactional public void readAll(String username){notices.readAll(users.require(username).getId(),clock.instant());}
}
