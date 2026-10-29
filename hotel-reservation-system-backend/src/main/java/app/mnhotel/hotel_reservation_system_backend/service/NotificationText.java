package app.mnhotel.hotel_reservation_system_backend.service;
import java.time.*;

public final class NotificationText {
    private NotificationText() {}
    public static String message(String type,String hotel,Long id,LocalDate start,LocalDate end){
        if(hotel==null||hotel.isBlank()||id==null||start==null||(!"CANCELLED".equals(type)&&(end==null||!end.isAfter(start))))throw new IllegalArgumentException("Datos de notificación inválidos");
        String reference="Tu reserva #"+id+" en "+hotel;
        return switch(type){
            case "CONFIRMED" -> reference+" fue confirmada. Entrada: "+start+". Salida: "+end+".";
            case "CANCELLED" -> reference+" para el "+start+" fue cancelada correctamente.";
            case "CHECK_IN_REMINDER" -> "¡Tu viaje está cerca! Mañana comienza tu estadía en "+hotel+". Revisa tu reserva #"+id+" ("+start+" a "+end+").";
            default -> throw new IllegalArgumentException("Tipo de notificación inválido");
        };
    }
    public static LocalDate tomorrow(Clock clock){return LocalDate.now(clock.withZone(ZoneId.of("America/Panama"))).plusDays(1);}
}
