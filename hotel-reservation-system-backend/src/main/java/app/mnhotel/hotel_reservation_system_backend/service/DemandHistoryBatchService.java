package app.mnhotel.hotel_reservation_system_backend.service;

import java.time.*;
import java.time.temporal.*;
import java.util.*;
import java.security.SecureRandom;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.env.Environment;
import org.springframework.transaction.annotation.Transactional;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.service.imp.AuthServiceImp;

/** Operator-only transactional maintenance; never exposed through HTTP or normal startup. */
@Service
public class DemandHistoryBatchService {
    public record Options(String code,LocalDate referenceDate,long seed,int weeks) {}
    public record Result(String code,String status,LocalDate referenceDate,LocalDate historyStart,LocalDate historyEnd,
        long reservations,long confirmed,long cancelled,long roomNights,long hotels,long modifiedRows,boolean reused) {}
    private record Room(long id,long hotelId,int price) {}
    private record Interval(LocalDateTime start,LocalDateTime end) {}
    private final JdbcTemplate jdbc;private final AuthServiceImp auth;private final Clock clock;private final Environment env;
    public DemandHistoryBatchService(JdbcTemplate jdbc,AuthServiceImp auth,Clock clock,Environment env){this.jdbc=jdbc;this.auth=auth;this.clock=clock;this.env=env;}
    private void guard(String expected,String confirmation,String required){
        String database=jdbc.queryForObject("select current_database()",String.class);
        if(!required.equals(confirmation)||env.matchesProfiles("prod","production")||!Set.of("hotel-bd","hotel_test","hotel_demo").contains(database)||!database.equals(expected))throw new IllegalStateException("Confirmación o base de demostración no autorizada");
        if(!required.equals("INSPECT_HISTORY_BATCH")&&database.equals("hotel-bd")&&!env.getProperty("HOTEL_HISTORY_BACKUP_SHA256","").matches("[a-fA-F0-9]{64}"))throw new IllegalStateException("Se requiere respaldo privado verificado antes de intervenir hotel-bd");
    }
    private void lock(){jdbc.execute("select pg_advisory_xact_lock(824620252)");}
    private Map<String,Object> batch(String code){var rows=jdbc.queryForList("select * from reservation_demo_batches where code=? for update",code);if(rows.size()!=1)throw new IllegalStateException("Lote inexistente");return rows.get(0);}
    @Transactional(rollbackFor=Exception.class)
    public Result create(Options options,String expected,String confirmation){
        guard(expected,confirmation,"CREATE_HISTORY_BATCH");
        if(options.code()==null||!options.code().matches("[a-z0-9-]{8,100}")||options.weeks()<8||options.weeks()>16||options.referenceDate()==null||options.referenceDate().isAfter(LocalDate.now(clock.withZone(ZoneId.of("America/Panama"))))||options.referenceDate().getYear()<2000)throw new IllegalArgumentException("Parámetros de lote inválidos");
        lock();
        var existing=jdbc.queryForList("select * from reservation_demo_batches where code=? for update",options.code());
        if(!existing.isEmpty()){
            var row=existing.get(0);
            if(!row.get("status").equals("ACTIVE")||!row.get("reference_date").toString().equals(options.referenceDate().toString())||((Number)row.get("seed")).longValue()!=options.seed()||((Number)row.get("weeks")).intValue()!=options.weeks())throw new IllegalStateException("El código ya pertenece a otro escenario o a un lote revertido; no se sobrescribe");
            return result(options.code(),true);
        }
        LocalDate monday=options.referenceDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate start=monday.minusWeeks(options.weeks()),end=monday.minusDays(1);
        var selected=jdbc.query("""
            WITH ranked AS (select rm.id,rm.hotel_id,rm.price_per_night,row_number() over(partition by rm.hotel_id order by rm.id) n
                from rooms rm join hotels h on h.id=rm.hotel_id where rm.active and h.active and rm.price_per_night>=0)
            select id,hotel_id,price_per_night from ranked where n<=6 order by hotel_id,id limit 72
            """,(r,n)->new Room(r.getLong(1),r.getLong(2),r.getInt(3)));
        if(selected.isEmpty())throw new IllegalStateException("No hay habitaciones activas con precio válido");
        Map<Long,List<Interval>> occupied=new HashMap<>();List<Room> rooms=new ArrayList<>();
        for(var room:selected){
            jdbc.queryForObject("select id from rooms where id=? for update",Long.class,room.id());
            var raw=jdbc.queryForList("select start_date,end_date from reservations where room_id=? and status='CONFIRMED'",room.id());
            List<Interval> ranges=new ArrayList<>();boolean invalid=false;
            for(var row:raw){var a=(java.sql.Timestamp)row.get("start_date");var b=(java.sql.Timestamp)row.get("end_date");if(a==null||b==null||!b.after(a)){invalid=true;break;}ranges.add(new Interval(a.toLocalDateTime(),b.toLocalDateTime()));}
            if(!invalid){rooms.add(room);occupied.put(room.id(),ranges);}
        }
        if(rooms.isEmpty())throw new IllegalStateException("Las habitaciones tienen estancias inválidas; no se inventa disponibilidad");
        UUID id=UUID.randomUUID();String username="hu03-data-"+id.toString().replace("-","").substring(0,12);
        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
        var user=auth.create(new Requests.Register(username,username+"@example.invalid",Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)),"USER");
        // A new synthetic identity with coherent fictional account/booking chronology.
        user.setCreatedAt(start.minusDays(60).atStartOfDay());
        jdbc.update("update users set created_at=? where id=?",user.getCreatedAt(),user.getId());
        String userHash=jdbc.queryForObject("select md5(to_jsonb(u)::text) from users u where id=?",String.class,user.getId());
        jdbc.update("insert into reservation_demo_batches(id,code,algorithm,reference_date,seed,weeks,history_start,history_end,technical_user_id,technical_username,technical_user_hash,status) values (?,?,?,?,?,?,?,?,?,?,?,'ACTIVE')",id,options.code(),"WEEKEND_HISTORY_V1",options.referenceDate(),options.seed(),options.weeks(),start,end,user.getId(),username,userHash);
        Random random=new Random(options.seed() ^ options.referenceDate().toEpochDay());int count=0;
        for(int week=0;week<options.weeks();week++)for(var room:rooms){
            LocalDate base=start.plusWeeks(week);double probability=week%4==2?0.98:week%4==0?0.85:0.93;
            if(random.nextDouble()<probability){
                int choice=random.nextInt(100);int length=choice<5?1:choice<30?2:choice<55?3:choice<80?4:choice<95?5:7;
                int offset=length==7?1:length==5?(random.nextBoolean()?2:3):length>=3?3:length==2?4:(random.nextBoolean()?4:5);
                LocalDate arrival=base.plusDays(offset),departure=arrival.plusDays(length);if(departure.isAfter(monday))departure=monday;
                if(free(occupied.get(room.id()),arrival,departure)){
                    insert(id,"w"+week+"-r"+room.id()+"-main",user.getId(),room,arrival,departure,"CONFIRMED",random);
                    occupied.get(room.id()).add(new Interval(arrival.atStartOfDay(),departure.atStartOfDay()));count++;
                }
            }
            if(random.nextDouble()<0.07){LocalDate arrival=base.plusDays(random.nextInt(2)),departure=arrival.plusDays(1+random.nextInt(2));if(free(occupied.get(room.id()),arrival,departure)){insert(id,"w"+week+"-r"+room.id()+"-weekday",user.getId(),room,arrival,departure,"CONFIRMED",random);occupied.get(room.id()).add(new Interval(arrival.atStartOfDay(),departure.atStartOfDay()));count++;}}
            if(random.nextDouble()<0.08){LocalDate arrival=base.plusDays(random.nextInt(5)),departure=arrival.plusDays(1+random.nextInt(5));if(departure.isAfter(monday))departure=monday;insert(id,"w"+week+"-r"+room.id()+"-cancel",user.getId(),room,arrival,departure,"CANCELLED",random);count++;}
            if(count>1200)throw new IllegalStateException("Volumen de demostración excesivo; transacción revertida");
        }
        if(jdbc.queryForObject("select count(*) from reservation_demo_items i join reservations r on r.id=i.reservation_id where i.batch_id=? and r.status='CONFIRMED'",Long.class,id)==0)throw new IllegalStateException("No hay espacio histórico libre para actividad confirmada; lote revertido");
        jdbc.update("update reservation_demo_batches set reservation_count=? where id=?",count,id);
        return result(options.code(),false);
    }
    private boolean free(List<Interval> intervals,LocalDate start,LocalDate end){return end.isAfter(start)&&intervals.stream().noneMatch(i->i.start().isBefore(end.atStartOfDay())&&i.end().isAfter(start.atStartOfDay()));}
    private void insert(UUID batch,String key,Long user,Room room,LocalDate start,LocalDate end,String status,Random random){
        int lead=3+random.nextInt(38);LocalDateTime created=start.minusDays(lead).atTime(8+random.nextInt(10),random.nextInt(60));
        LocalDateTime cancelled=status.equals("CANCELLED")?created.plusDays(1+random.nextInt(lead-1)):null;
        Long id=jdbc.queryForObject("insert into reservations(user_id,room_id,start_date,end_date,status,created_at,cancelled_at,nightly_price,total_price) values (?,?,?,?,?,?,?,?,?) returning id",Long.class,user,room.id(),start.atStartOfDay(),end.atStartOfDay(),status,created,cancelled,room.price(),Math.multiplyExact(ChronoUnit.DAYS.between(start,end),room.price()));
        jdbc.update("insert into reservation_demo_items(batch_id,item_key,reservation_id,original_row_hash) select ?,?,id,md5(to_jsonb(r)::text) from reservations r where id=?",batch,key,id);
    }
    @Transactional(readOnly=true)
    public Result inspect(String code,String expected,String confirmation){guard(expected,confirmation,"INSPECT_HISTORY_BATCH");return result(code,true);}
    private Result result(String code,boolean reused){
        var row=jdbc.queryForMap("""
            select b.code,b.status,b.reference_date,b.history_start,b.history_end,b.reservation_count,
                count(r.id) filter(where r.status='CONFIRMED') confirmed,count(r.id) filter(where r.status='CANCELLED') cancelled,
                coalesce(sum(r.end_date::date-r.start_date::date) filter(where r.status='CONFIRMED'),0) nights,
                count(distinct rm.hotel_id) hotels,count(r.id) filter(where md5(to_jsonb(r)::text)<>i.original_row_hash) modified
            from reservation_demo_batches b left join reservation_demo_items i on i.batch_id=b.id left join reservations r on r.id=i.reservation_id left join rooms rm on rm.id=r.room_id
            where b.code=? group by b.id
            """,code);
        return new Result(code,row.get("status").toString(),LocalDate.parse(row.get("reference_date").toString()),LocalDate.parse(row.get("history_start").toString()),LocalDate.parse(row.get("history_end").toString()),((Number)row.get("reservation_count")).longValue(),((Number)row.get("confirmed")).longValue(),((Number)row.get("cancelled")).longValue(),((Number)row.get("nights")).longValue(),((Number)row.get("hotels")).longValue(),((Number)row.get("modified")).longValue(),reused);
    }
    @Transactional(rollbackFor=Exception.class)
    public Result revert(String code,String expected,String confirmation){
        guard(expected,confirmation,"REVERT_HISTORY_BATCH:"+code);lock();var batch=batch(code);
        if(batch.get("status").equals("REVERTED"))return result(code,true);
        UUID id=(UUID)batch.get("id");long user=((Number)batch.get("technical_user_id")).longValue();
        jdbc.queryForList("select r.id from reservations r join reservation_demo_items i on i.reservation_id=r.id where i.batch_id=? order by r.id for update of r",id);
        var summary=result(code,false);
        long current=jdbc.queryForObject("select count(*) from reservation_demo_items where batch_id=?",Long.class,id);
        if(current!=summary.reservations()||summary.modifiedRows()!=0)throw new IllegalStateException("El lote fue modificado; reversión rechazada");
        String hash=jdbc.queryForObject("select md5(to_jsonb(u)::text) from users u where id=? for update",String.class,user);
        if(!hash.equals(batch.get("technical_user_hash")))throw new IllegalStateException("La cuenta técnica fue modificada; reversión rechazada");
        Long dependencies=jdbc.queryForObject("select (select count(*) from payments p join reservation_demo_items i on i.reservation_id=p.reservation_id where i.batch_id=?) + (select count(*) from reviews where user_id=?) + (select count(*) from reservations r where r.user_id=? and not exists(select 1 from reservation_demo_items i where i.reservation_id=r.id and i.batch_id=?))",Long.class,id,user,user,id);
        if(dependencies>0)throw new IllegalStateException("Existen dependencias externas; reversión rechazada");
        Long checkoutDependencies=jdbc.queryForObject("select (select count(*) from checkouts c where c.user_id=? or c.reservation_id in (select reservation_id from reservation_demo_items where batch_id=?)) + (select count(*) from payment_profiles where user_id=?) + (select count(*) from saved_payment_methods where user_id=?) + (select count(*) from checkout_items ci join reservation_demo_items i on i.reservation_id=ci.reservation_id where i.batch_id=?)",Long.class,user,id,user,user,id);
        if(checkoutDependencies>0)throw new IllegalStateException("Existen dependencias de pago; reversión rechazada");
        var unknown=jdbc.queryForList("select conname from pg_constraint where contype='f' and ((confrelid='reservations'::regclass and conrelid not in ('payments'::regclass,'reservation_demo_items'::regclass,'checkouts'::regclass,'checkout_items'::regclass)) or (confrelid='users'::regclass and conrelid not in ('reservations'::regclass,'reviews'::regclass,'reservation_demo_batches'::regclass,'checkouts'::regclass,'payment_profiles'::regclass,'saved_payment_methods'::regclass)))");
        if(!unknown.isEmpty())throw new IllegalStateException("Hay relaciones externas no contempladas; revisión requerida");
        var ids=jdbc.queryForList("delete from reservation_demo_items where batch_id=? returning reservation_id",Long.class,id);
        for(Long reservation:ids)jdbc.update("delete from reservations where id=?",reservation);
        jdbc.update("update reservation_demo_batches set status='REVERTED',technical_user_id=null,reverted_at=current_timestamp where id=?",id);
        jdbc.update("delete from users where id=?",user);
        return result(code,false);
    }
}
