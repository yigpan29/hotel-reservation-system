package app.mnhotel.hotel_reservation_system_backend.service.imp;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.entity.Room;
import app.mnhotel.hotel_reservation_system_backend.repository.*;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
@Service @Transactional
public class RoomServiceImp {
    private final RoomRepository rooms;private final ReservationRepository bookings;private final HotelServiceImp hotels;
    public RoomServiceImp(RoomRepository rooms,ReservationRepository bookings,HotelServiceImp hotels){this.rooms=rooms;this.bookings=bookings;this.hotels=hotels;}
    public static java.time.LocalDate today(){return java.time.LocalDate.now(java.time.ZoneId.of("America/Panama"));}
    public static java.time.LocalDateTime now(){return java.time.LocalDateTime.now(java.time.ZoneId.of("America/Panama"));}
    public static long nights(LocalDate start,LocalDate end){
        if(start==null||end==null||start.isBefore(today())||!end.isAfter(start))throw ApiException.bad("La entrada no puede ser pasada y la salida debe ser posterior");
        long count=ChronoUnit.DAYS.between(start,end);if(count>365)throw ApiException.bad("La estancia máxima es de 365 noches");return count;
    }
    @Transactional(readOnly=true) public List<Views.RoomView> list(Long hotelId,LocalDate start,LocalDate end,boolean admin){
        var hotel=hotels.require(hotelId);if(!admin&&!hotel.getActive())throw ApiException.missing("Hotel");
        Long count=null;if(start!=null||end!=null)count=nights(start,end);
        final Long nights=count;
        return rooms.findByHotelIdOrderById(hotelId).stream().filter(r->admin||r.getActive()).map(r->{
            Boolean available=nights==null?null:r.getActive()&&hotel.getActive()&&!bookings.overlaps(r.getId(),start.atStartOfDay(),end.atStartOfDay());
            Long total=nights==null||r.getPricePerNight()==null?null:Math.multiplyExact(nights,r.getPricePerNight().longValue());return Views.room(r,available,total);
        }).toList();
    }
    @Transactional(readOnly=true) public Views.RoomAvailabilityView occupancy(Long roomId,LocalDate from,LocalDate to,boolean admin){
        Room room=rooms.findById(roomId).orElseThrow(()->ApiException.missing("Habitación"));
        if(!admin&&(!room.getActive()||!room.getHotel().getActive()))throw ApiException.missing("Habitación");
        LocalDate start=from==null?today():from;LocalDate end=to==null?start.plusMonths(12):to;
        if(!end.isAfter(start))throw ApiException.bad("La fecha final del calendario debe ser posterior a la inicial");
        if(ChronoUnit.DAYS.between(start,end)>400)throw ApiException.bad("El calendario admite como máximo 400 días por consulta");
        var occupied=bookings.occupancy(roomId,start.atStartOfDay(),end.atStartOfDay()).stream()
            .map(r->new Views.OccupiedRange(r.getStartDate().toLocalDate(),r.getEndDate().toLocalDate())).toList();
        return new Views.RoomAvailabilityView(room.getId(),room.getHotel().getId(),room.getHotel().getName(),room.getRoomNumber(),
            room.getType(),room.getPricePerNight(),room.getActive(),start,end,occupied);
    }
    public Views.RoomView save(Long id,Requests.RoomInput input){
        var hotel=hotels.require(input.hotelId());Room room=id==null?new Room():rooms.lockById(id).orElseThrow(()->ApiException.missing("Habitación"));
        if(id!=null&&!room.getHotel().getId().equals(input.hotelId()))throw ApiException.bad("No se puede trasladar una habitación a otro hotel");
        String number=input.roomNumber().trim();if(rooms.existsByHotelIdAndRoomNumberAndIdNot(hotel.getId(),number,id==null?-1L:id))throw ApiException.conflict("El número de habitación ya existe en este hotel");
        room.setHotel(hotel);room.setRoomNumber(number);room.setType(input.type().trim());room.setPricePerNight(input.pricePerNight());room.setActive(input.active());room.setAvailability(input.active());
        return Views.room(rooms.saveAndFlush(room),null,null);
    }
}
