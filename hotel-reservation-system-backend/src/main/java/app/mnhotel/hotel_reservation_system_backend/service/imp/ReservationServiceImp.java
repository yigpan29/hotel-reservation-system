package app.mnhotel.hotel_reservation_system_backend.service.imp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import app.mnhotel.hotel_reservation_system_backend.entity.*;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.repository.*;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
import app.mnhotel.hotel_reservation_system_backend.service.NotificationService;
@Service @Transactional
public class ReservationServiceImp {
    private final RoomRepository rooms;private final ReservationRepository reservations;private final AuthServiceImp users;private final HotelServiceImp hotels;private final NotificationService notifications;
    public ReservationServiceImp(RoomRepository rooms,ReservationRepository reservations,AuthServiceImp users,HotelServiceImp hotels,NotificationService notifications){this.rooms=rooms;this.reservations=reservations;this.users=users;this.hotels=hotels;this.notifications=notifications;}
    private record Assignment(Requests.GroupRoomInput group,Room room) {}
    public Views.ReservationView create(String username,Requests.ReservationInput input){
        long nights=RoomServiceImp.nights(input.startDate(),input.endDate());
        Room room=rooms.lockById(input.roomId()).orElseThrow(()->ApiException.missing("Habitación"));
        if(!room.getActive()||!room.getHotel().getActive()||room.getPricePerNight()==null||room.getPricePerNight()<0)throw ApiException.conflict("La habitación no está habilitada para nuevas reservas");
        if(reservations.overlaps(room.getId(),input.startDate().atStartOfDay(),input.endDate().atStartOfDay()))throw ApiException.conflict("La habitación ya está reservada en esas fechas");
        Reservation r=new Reservation();r.setRoomType(room.getType());r.setRoom(room);r.setUser(users.require(username));r.setStartDate(input.startDate().atStartOfDay());r.setEndDate(input.endDate().atStartOfDay());r.setStatus("CONFIRMED");r.setCreatedAt(RoomServiceImp.now());r.setNightlyPrice(room.getPricePerNight());r.setTotalPrice(Math.multiplyExact(nights,room.getPricePerNight().longValue()));
        reservations.saveAndFlush(r);notifications.event(r,"CONFIRMED");return Views.reservation(r);
    }
    /**
     * Reserva de HU6: el cliente configuró sus habitaciones (cada una con sus huéspedes) y eligió un tipo
     * para cada una. El backend comprueba, antes de confirmar, que el tipo admita a ese grupo, que queden
     * unidades suficientes de cada tipo y que sigan libres durante toda la estadía; luego asigna las
     * unidades concretas, de la más barata a la más cara, y bloquea cada fila antes de insertar.
     */
    public List<Views.ReservationView> createGroup(String username,Requests.GroupReservationInput input){
        long nights=RoomServiceImp.nights(input.startDate(),input.endDate());
        var start=input.startDate().atStartOfDay();var end=input.endDate().atStartOfDay();
        var hotel=hotels.require(input.hotelId());
        if(!hotel.getActive())throw ApiException.missing("Hotel");
        // Capacidad declarada por tipo y unidades libres, de la más barata a la más cara.
        var capacities=new HashMap<String,Integer>();var free=new LinkedHashMap<String,ArrayDeque<Room>>();
        for(Room room:rooms.findByHotelIdOrderById(input.hotelId()).stream()
                .filter(r->r.getActive()&&r.getPricePerNight()!=null&&r.getPricePerNight()>=0)
                .sorted(Comparator.comparingInt(Room::getPricePerNight).thenComparing(Room::getId)).toList()){
            String type=room.getType()==null?"Sin tipo":room.getType();
            capacities.merge(type,RoomServiceImp.capacity(room),Math::max);
            if(!reservations.overlaps(room.getId(),start,end))free.computeIfAbsent(type,key->new ArrayDeque<>()).add(room);
        }
        var assigned=new ArrayList<Assignment>();
        for(var group:input.rooms()){
            String type=group.type().trim();int guests=group.adults()+group.children();
            Integer capacity=capacities.get(type);
            if(capacity==null)throw ApiException.bad("El tipo "+type+" no existe en este hotel");
            if(guests>capacity)throw ApiException.bad("Una habitación "+type+" admite "+capacity+(capacity==1?" huésped":" huéspedes")+" y se le asignaron "+guests);
            var units=free.get(type);
            if(units==null||units.isEmpty())throw ApiException.conflict("No quedan suficientes habitaciones de tipo "+type+" para las fechas seleccionadas");
            assigned.add(new Assignment(group,units.poll()));
        }
        var user=users.require(username);var created=new ArrayList<Views.ReservationView>();
        // Bloqueo en orden de id para que dos solicitudes simultáneas no se crucen entre habitaciones.
        for(var assignment:assigned.stream().sorted(Comparator.comparing(item->item.room().getId())).toList()){
            Room room=rooms.lockById(assignment.room().getId()).orElseThrow(()->ApiException.missing("Habitación"));
            if(!room.getActive()||!room.getHotel().getActive())throw ApiException.conflict("La habitación "+room.getRoomNumber()+" no está habilitada para nuevas reservas");
            if(reservations.overlaps(room.getId(),start,end))throw ApiException.conflict("La habitación "+room.getRoomNumber()+" ya está reservada en esas fechas");
            Reservation r=new Reservation();
            r.setRoomType(room.getType());r.setRoom(room);r.setUser(user);r.setStartDate(start);r.setEndDate(end);
            r.setStatus("CONFIRMED");r.setCreatedAt(RoomServiceImp.now());
            r.setAdults(assignment.group().adults());r.setChildren(assignment.group().children());
            r.setNightlyPrice(room.getPricePerNight());r.setTotalPrice(Math.multiplyExact(nights,room.getPricePerNight().longValue()));
            reservations.saveAndFlush(r);notifications.event(r,"CONFIRMED");created.add(Views.reservation(r));
        }
        return List.copyOf(created);
    }
    private void owns(Reservation r,String username,boolean admin){if(!admin&&!r.getUser().getUsername().equalsIgnoreCase(username))throw new ApiException(HttpStatus.FORBIDDEN,"No puedes acceder a una reserva ajena");}
    @Transactional(readOnly=true) public Views.ReservationView detail(Long id,String username,boolean admin){var r=reservations.findById(id).orElseThrow(()->ApiException.missing("Reserva"));owns(r,username,admin);return Views.reservation(r);}
    public Views.ReservationView cancel(Long id,String username,boolean admin){
        var r=reservations.lockById(id).orElseThrow(()->ApiException.missing("Reserva"));owns(r,username,admin);
        if("CANCELLED".equals(r.getStatus()))return Views.reservation(r);
        if(!"CONFIRMED".equals(r.getStatus())||r.getStartDate()==null||r.getStartDate().toLocalDate().isBefore(RoomServiceImp.today()))throw ApiException.conflict("Esta reserva ya no se puede cancelar");
        r.setStatus("CANCELLED");r.setCancelledAt(RoomServiceImp.now());notifications.event(r,"CANCELLED");return Views.reservation(r);
    }
    @Transactional(readOnly=true) public Page<Views.ReservationView> list(String username,boolean admin,Long userId,Long hotelId,Long roomId,String status,int page,int size){
        if(page<0||size<1||size>100)throw ApiException.bad("Paginación inválida (size entre 1 y 100)");
        if(status!=null&&!status.equals("CONFIRMED")&&!status.equals("CANCELLED"))throw ApiException.bad("Estado inválido");
        return reservations.filter(admin?userId:users.require(username).getId(),hotelId,roomId,status,PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"id"))).map(Views::reservation);
    }
}
