package app.mnhotel.hotel_reservation_system_backend.service.imp;
import java.time.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import app.mnhotel.hotel_reservation_system_backend.entity.*;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.repository.*;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
@Service @Transactional
public class ReservationServiceImp {
    private final RoomRepository rooms;private final ReservationRepository reservations;private final AuthServiceImp users;
    public ReservationServiceImp(RoomRepository rooms,ReservationRepository reservations,AuthServiceImp users){this.rooms=rooms;this.reservations=reservations;this.users=users;}
    public Views.ReservationView create(String username,Requests.ReservationInput input){
        long nights=RoomServiceImp.nights(input.startDate(),input.endDate());
        Room room=rooms.lockById(input.roomId()).orElseThrow(()->ApiException.missing("Habitación"));
        if(!room.getActive()||!room.getHotel().getActive()||room.getPricePerNight()==null||room.getPricePerNight()<0)throw ApiException.conflict("La habitación no está habilitada para nuevas reservas");
        if(reservations.overlaps(room.getId(),input.startDate().atStartOfDay(),input.endDate().atStartOfDay()))throw ApiException.conflict("La habitación ya está reservada en esas fechas");
        Reservation r=new Reservation();r.setRoomType(room.getType());r.setRoom(room);r.setUser(users.require(username));r.setStartDate(input.startDate().atStartOfDay());r.setEndDate(input.endDate().atStartOfDay());r.setStatus("CONFIRMED");r.setCreatedAt(RoomServiceImp.now());r.setNightlyPrice(room.getPricePerNight());r.setTotalPrice(Math.multiplyExact(nights,room.getPricePerNight().longValue()));
        return Views.reservation(reservations.saveAndFlush(r));
    }
    private void owns(Reservation r,String username,boolean admin){if(!admin&&!r.getUser().getUsername().equalsIgnoreCase(username))throw new ApiException(HttpStatus.FORBIDDEN,"No puedes acceder a una reserva ajena");}
    @Transactional(readOnly=true) public Views.ReservationView detail(Long id,String username,boolean admin){var r=reservations.findById(id).orElseThrow(()->ApiException.missing("Reserva"));owns(r,username,admin);return Views.reservation(r);}
    public Views.ReservationView cancel(Long id,String username,boolean admin){
        var r=reservations.lockById(id).orElseThrow(()->ApiException.missing("Reserva"));owns(r,username,admin);
        if("CANCELLED".equals(r.getStatus()))return Views.reservation(r);
        if(!"CONFIRMED".equals(r.getStatus())||r.getStartDate()==null||r.getStartDate().toLocalDate().isBefore(RoomServiceImp.today()))throw ApiException.conflict("Esta reserva ya no se puede cancelar");
        r.setStatus("CANCELLED");r.setCancelledAt(RoomServiceImp.now());return Views.reservation(r);
    }
    @Transactional(readOnly=true) public Page<Views.ReservationView> list(String username,boolean admin,Long userId,Long hotelId,Long roomId,String status,int page,int size){
        if(page<0||size<1||size>100)throw ApiException.bad("Paginación inválida (size entre 1 y 100)");
        if(status!=null&&!status.equals("CONFIRMED")&&!status.equals("CANCELLED"))throw ApiException.bad("Estado inválido");
        return reservations.filter(admin?userId:users.require(username).getId(),hotelId,roomId,status,PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"id"))).map(Views::reservation);
    }
}
