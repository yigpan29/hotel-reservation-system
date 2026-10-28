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
    /**
     * Reserva de HU6: el cliente eligió las habitaciones y el backend valida, antes de confirmar, que entre
     * todas quepan los huéspedes indicados y que sigan libres durante toda la estadía. El reparto por
     * habitación lo decide el servidor: el cliente no distribuye huéspedes a mano.
     */
    public List<Views.ReservationView> createGroup(String username,Requests.GroupReservationInput input){
        long nights=RoomServiceImp.nights(input.startDate(),input.endDate());
        int adults=input.adults(),children=input.children(),guests=adults+children;
        var ids=input.roomIds().stream().distinct().sorted().toList();
        if(ids.size()!=input.roomIds().size())throw ApiException.bad("No se puede repetir una habitación en la misma reserva");
        if(ids.size()>adults)throw ApiException.bad("Cada habitación necesita al menos un adulto: "+adults+(adults==1?" adulto no puede ocupar las ":" adultos no pueden ocupar las ")+ids.size()+" habitaciones elegidas");
        var picked=new ArrayList<Room>();
        // Bloqueo en orden de id para que dos solicitudes simultáneas no se crucen entre habitaciones.
        for(Long id:ids){
            Room room=rooms.lockById(id).orElseThrow(()->ApiException.missing("Habitación"));
            if(!room.getActive()||!room.getHotel().getActive()||room.getPricePerNight()==null||room.getPricePerNight()<0)throw ApiException.conflict("La habitación "+room.getRoomNumber()+" no está habilitada para nuevas reservas");
            if(!picked.isEmpty()&&!room.getHotel().getId().equals(picked.get(0).getHotel().getId()))throw ApiException.bad("Todas las habitaciones deben pertenecer al mismo hotel");
            if(reservations.overlaps(room.getId(),input.startDate().atStartOfDay(),input.endDate().atStartOfDay()))throw ApiException.conflict("La habitación "+room.getRoomNumber()+" ya está reservada en esas fechas");
            picked.add(room);
        }
        int capacity=picked.stream().mapToInt(RoomServiceImp::capacity).sum();
        if(capacity<guests)throw ApiException.conflict("Las habitaciones elegidas admiten "+capacity+(capacity==1?" huésped":" huéspedes")+" y la reserva necesita "+guests);
        int[][] split=distribute(picked,adults,children);
        var user=users.require(username);var created=new ArrayList<Views.ReservationView>();
        for(int i=0;i<picked.size();i++){
            Room room=picked.get(i);Reservation r=new Reservation();
            r.setRoomType(room.getType());r.setRoom(room);r.setUser(user);r.setStartDate(input.startDate().atStartOfDay());r.setEndDate(input.endDate().atStartOfDay());
            r.setStatus("CONFIRMED");r.setCreatedAt(RoomServiceImp.now());r.setAdults(split[0][i]);r.setChildren(split[1][i]);
            r.setNightlyPrice(room.getPricePerNight());r.setTotalPrice(Math.multiplyExact(nights,room.getPricePerNight().longValue()));
            created.add(Views.reservation(reservations.saveAndFlush(r)));
        }
        return List.copyOf(created);
    }
    /** Un adulto por habitación y el resto hasta la capacidad de cada una, empezando por las más amplias. */
    static int[][] distribute(List<Room> picked,int adults,int children){
        int size=picked.size();int[] grown=new int[size],kids=new int[size];Arrays.fill(grown,1);
        var roomiest=java.util.stream.IntStream.range(0,size).boxed()
            .sorted(Comparator.comparingInt(index->-RoomServiceImp.capacity(picked.get(index)))).toList();
        int restAdults=adults-size,restChildren=children;
        for(int index:roomiest){int room=RoomServiceImp.capacity(picked.get(index))-grown[index];int add=Math.min(restAdults,room);grown[index]+=add;restAdults-=add;}
        for(int index:roomiest){int room=RoomServiceImp.capacity(picked.get(index))-grown[index]-kids[index];int add=Math.min(restChildren,room);kids[index]+=add;restChildren-=add;}
        if(restAdults>0||restChildren>0)throw ApiException.conflict("Las habitaciones elegidas no admiten a todos los huéspedes");
        return new int[][]{grown,kids};
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
