package app.mnhotel.hotel_reservation_system_backend.repository;

import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Bounded aggregate queries; no JPA entities, user data or writes. */
@Repository
public class DemandRepository {
    public record Daily(LocalDate date,long roomNights,long rawConfirmedNights) {}
    public record Counts(long total,long confirmed,long cancelled,long unknown) {}
    private final NamedParameterJdbcTemplate jdbc;
    public DemandRepository(NamedParameterJdbcTemplate jdbc){this.jdbc=jdbc;}
    private String hotel(Long id){return id==null?"":" AND rm.hotel_id=:hotelId ";}
    private Map<String,Object> params(Long hotelId,LocalDate start,LocalDate end){Map<String,Object> p=new HashMap<>();p.put("hotelId",hotelId);p.put("start",start);p.put("end",end);return p;}
    private static final String VALID=" r.start_date IS NOT NULL AND r.end_date IS NOT NULL AND r.end_date::date>r.start_date::date ";
    public List<Daily> daily(Long hotelId,LocalDate start,LocalDate end){
        String sql="""
            WITH stays AS (
              SELECT r.id,r.room_id,r.start_date::date AS arrival,r.end_date::date AS departure
              FROM reservations r JOIN rooms rm ON rm.id=r.room_id
              WHERE r.status='CONFIRMED' AND
            """+VALID+hotel(hotelId)+"""
              AND r.start_date<CAST(:end AS date)+1 AND r.end_date>CAST(:start AS date)
            )
            SELECT d::date AS day,count(DISTINCT s.room_id) AS nights,count(s.id) AS raw_nights
            FROM generate_series(CAST(:start AS date),CAST(:end AS date),interval '1 day') d
            LEFT JOIN stays s ON s.arrival<=d::date AND s.departure>d::date
            GROUP BY d ORDER BY d
            """;
        return jdbc.query(sql,params(hotelId,start,end),(r,n)->new Daily(r.getDate("day").toLocalDate(),r.getLong("nights"),r.getLong("raw_nights")));
    }
    public Counts counts(Long hotelId,LocalDate start,LocalDate end){
        return jdbc.queryForObject("""
            SELECT count(*) AS total,count(*) FILTER(WHERE r.status='CONFIRMED') AS confirmed,
              count(*) FILTER(WHERE r.status='CANCELLED') AS cancelled,
              count(*) FILTER(WHERE r.status IS NULL OR r.status NOT IN ('CONFIRMED','CANCELLED')) AS unknown
            FROM reservations r JOIN rooms rm ON rm.id=r.room_id WHERE
            """+VALID+hotel(hotelId)+" AND r.start_date::date<=:end AND r.end_date::date>:start",params(hotelId,start,end),
            (r,n)->new Counts(r.getLong("total"),r.getLong("confirmed"),r.getLong("cancelled"),r.getLong("unknown")));
    }
    public long capacity(Long hotelId){return jdbc.queryForObject("SELECT count(*) FROM rooms rm JOIN hotels h ON h.id=rm.hotel_id WHERE rm.active=true AND h.active=true"+hotel(hotelId),params(hotelId,null,null),Long.class);}
    public LocalDate earliest(Long hotelId){return jdbc.queryForObject("SELECT min(r.start_date::date) FROM reservations r JOIN rooms rm ON rm.id=r.room_id WHERE "+VALID+" AND r.status IN ('CONFIRMED','CANCELLED') "+hotel(hotelId),params(hotelId,null,null),(r,n)->r.getDate(1)==null?null:r.getDate(1).toLocalDate());}
    public long invalid(Long hotelId){return jdbc.queryForObject("SELECT count(*) FROM reservations r LEFT JOIN rooms rm ON rm.id=r.room_id WHERE (rm.id IS NULL OR r.start_date IS NULL OR r.end_date IS NULL OR r.end_date::date<=r.start_date::date) "+hotel(hotelId),params(hotelId,null,null),Long.class);}
    public String database(){return jdbc.queryForObject("SELECT current_database()",Map.of(),String.class);}
}
