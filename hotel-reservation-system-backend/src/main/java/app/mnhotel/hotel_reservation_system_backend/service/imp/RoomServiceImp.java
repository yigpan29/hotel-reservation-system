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
    public static final int maxAdults=20,maxChildren=20;
    private static final Map<String,Integer> capacities=Map.of("Individual",1,"Doble",2,"Matrimonial",2,"Deluxe",3,"Familiar",4,"Suite",4);
    public static final int defaultCapacity=2;
    /** La capacidad la define el tipo, como en V3; un tipo nuevo usa el valor por defecto de la base. */
    public static int capacityFor(String type){return type==null?defaultCapacity:capacities.getOrDefault(type.trim(),defaultCapacity);}
    public static int capacity(Room room){return room.getCapacity()==null?capacityFor(room.getType()):room.getCapacity();}
    /** Habitaciones minimas para unos huespedes con una capacidad dada: 0 si la capacidad no es utilizable. */
    public static int roomsFor(int guests,int capacity){return capacity<1?0:(guests+capacity-1)/capacity;}
    private static final Comparator<Room> roomiestFirst=Comparator.comparingInt(RoomServiceImp::capacity).reversed()
        .thenComparingInt(Room::getPricePerNight).thenComparing(Room::getId);
    /** Habitaciones necesarias para cubrir a los huespedes empezando por las mas amplias; vacio si no alcanzan. */
    private static List<Room> cover(List<Room> pool,int guests,int limit){
        List<Room> picked=new ArrayList<>();int covered=0;
        for(Room room:pool.stream().sorted(roomiestFirst).toList()){
            if(covered>=guests||picked.size()>=limit)break;
            picked.add(room);covered+=capacity(room);
        }
        return covered>=guests?List.copyOf(picked):List.of();
    }
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
    @Transactional(readOnly=true) public Views.AllocationView allocation(Long hotelId,LocalDate start,LocalDate end,int adults,int children){
        if(adults<1)throw ApiException.bad("Toda reserva necesita al menos un adulto");
        if(children<0)throw ApiException.bad("La cantidad de huéspedes no puede ser negativa");
        if(adults>maxAdults||children>maxChildren)throw ApiException.bad("Como máximo "+maxAdults+" adultos y "+maxChildren+" niños por reserva");
        long nights=nights(start,end);
        var hotel=hotels.require(hotelId);if(!hotel.getActive())throw ApiException.missing("Hotel");
        int guests=adults+children;
        // Tipos existentes y reservables del hotel: de ahí sale la capacidad máxima y el mínimo teórico.
        var bookable=rooms.findByHotelIdOrderById(hotelId).stream()
            .filter(r->r.getActive()&&r.getPricePerNight()!=null&&r.getPricePerNight()>=0).toList();
        int maxRoomCapacity=bookable.stream().mapToInt(RoomServiceImp::capacity).max().orElse(0);
        int minimumRooms=roomsFor(guests,maxRoomCapacity);
        // Disponibilidad real: la habitación debe estar libre durante TODA la estadía.
        var free=bookable.stream().filter(r->!bookings.overlaps(r.getId(),start.atStartOfDay(),end.atStartOfDay())).toList();
        int availableRooms=free.size(),availableCapacity=free.stream().mapToInt(RoomServiceImp::capacity).sum();
        int needed=cover(free,guests,Integer.MAX_VALUE).size();
        // Cada habitación exige un adulto: ningún adulto puede ocupar dos habitaciones a la vez.
        boolean feasible=needed>0&&needed<=adults;
        // El cliente elige una por una: se entrega el inventario con su disponibilidad, sin armar combinaciones.
        // Las unidades libres se agrupan por tipo: el cliente elige un tipo por habitación, no una unidad.
        var byType=new LinkedHashMap<String,List<Room>>();
        for(Room room:free)byType.computeIfAbsent(room.getType()==null?"Sin tipo":room.getType(),key->new ArrayList<>()).add(room);
        var types=byType.entrySet().stream().map(entry->{
            int price=entry.getValue().stream().mapToInt(Room::getPricePerNight).min().orElse(0);
            int roomCapacity=entry.getValue().stream().mapToInt(RoomServiceImp::capacity).max().orElse(0);
            return new Views.RoomTypeView(entry.getKey(),roomCapacity,entry.getValue().size(),price,Math.multiplyExact(nights,(long)price));
        }).sorted(Comparator.comparing(Views.RoomTypeView::pricePerNight).thenComparing(Views.RoomTypeView::type)).toList();
        String message=feasible?""
            :availableRooms==0?"No hay habitaciones disponibles para las fechas seleccionadas."
            :minimumRooms>availableRooms?"No hay habitaciones suficientes para alojar a "+guests+" huéspedes. Se requieren al menos "+minimumRooms+" habitaciones, pero solo hay "+availableRooms+(availableRooms==1?" disponible":" disponibles")+" para las fechas seleccionadas."
            :needed==0?"Las habitaciones disponibles para esas fechas admiten "+availableCapacity+(availableCapacity==1?" huésped":" huéspedes")+" y la reserva necesita "+guests+"."
            :"Cada habitación necesita al menos un adulto: "+adults+(adults==1?" adulto no puede ocupar las ":" adultos no pueden ocupar las ")+needed+" habitaciones necesarias para "+guests+" huéspedes.";
        return new Views.AllocationView(hotelId,start,end,nights,adults,children,guests,maxRoomCapacity,minimumRooms,
            availableRooms,availableCapacity,feasible,message,types);
    }
    public Views.RoomView save(Long id,Requests.RoomInput input){
        var hotel=hotels.require(input.hotelId());Room room=id==null?new Room():rooms.lockById(id).orElseThrow(()->ApiException.missing("Habitación"));
        if(id!=null&&!room.getHotel().getId().equals(input.hotelId()))throw ApiException.bad("No se puede trasladar una habitación a otro hotel");
        String number=input.roomNumber().trim();if(rooms.existsByHotelIdAndRoomNumberAndIdNot(hotel.getId(),number,id==null?-1L:id))throw ApiException.conflict("El número de habitación ya existe en este hotel");
        room.setHotel(hotel);room.setRoomNumber(number);room.setType(input.type().trim());room.setPricePerNight(input.pricePerNight());room.setActive(input.active());room.setAvailability(input.active());room.setCapacity(capacityFor(input.type()));
        return Views.room(rooms.saveAndFlush(room),null,null);
    }
}
