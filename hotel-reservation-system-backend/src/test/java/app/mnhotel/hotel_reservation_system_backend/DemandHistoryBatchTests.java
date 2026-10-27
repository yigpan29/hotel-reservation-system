package app.mnhotel.hotel_reservation_system_backend;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.service.*;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
class DemandHistoryBatchTests {
    @Autowired JdbcTemplate jdbc;@Autowired DemandHistoryBatchService batches;@Autowired HotelServiceImp hotels;@Autowired RoomServiceImp rooms;@Autowired AuthServiceImp auth;@Autowired DemandService demand;
    Long room;Long owner;LocalDate reference;
    void clear(){assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("hotel_test");jdbc.execute("truncate payments,reviews,reservations,rooms,hotels,users restart identity cascade");}
    @BeforeEach void setup(){clear();reference=RoomServiceImp.today();owner=auth.register(new Requests.Register("existing-user","existing-user@example.invalid","Existing-test-123")).id();for(int h=0;h<2;h++){Long hotel=hotels.save(null,new Requests.HotelInput("Batch hotel "+h,"Demo","Synthetic",null,true)).id();for(int r=0;r<6;r++)room=rooms.save(null,new Requests.RoomInput(hotel,"R"+r,"Doble",100+r*10,true)).id();}}
    @AfterEach void cleanup(){clear();}
    DemandHistoryBatchService.Options options(String code){return new DemandHistoryBatchService.Options(code,reference,73003L,12);}
    DemandHistoryBatchService.Result create(String code){return batches.create(options(code),"hotel_test","CREATE_HISTORY_BATCH");}
    String existing(){return jdbc.queryForObject("select md5(to_jsonb(u)::text) from users u where id=?",String.class,owner);}
    @Test void coherentNonOverlappingPricesChronologyIdempotenceAndUserOwnership(){
        String before=existing();var first=create("batch-integrity-test");assertThat(first.reservations()).isBetween(80L,250L);assertThat(first.hotels()).isEqualTo(2);assertThat(first.confirmed()).isPositive();assertThat(first.cancelled()).isPositive();assertThat(first.modifiedRows()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from reservations a join reservations b on a.room_id=b.room_id and a.id<b.id and a.status='CONFIRMED' and b.status='CONFIRMED' and a.start_date<b.end_date and a.end_date>b.start_date",Long.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from reservations r join rooms rm on rm.id=r.room_id where r.end_date<=r.start_date or r.created_at>=r.start_date or r.nightly_price<>rm.price_per_night or r.total_price<>(r.end_date::date-r.start_date::date)*r.nightly_price or (r.cancelled_at is not null and (r.cancelled_at<r.created_at or r.cancelled_at>=r.start_date))",Long.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from reservations r join users u on u.id=r.user_id where u.role<>'USER' or u.username not like 'hu03-data-%'",Long.class)).isZero();
        assertThat(create("batch-integrity-test").reused()).isTrue();assertThat(jdbc.queryForObject("select count(*) from reservations",Long.class)).isEqualTo(first.reservations());assertThat(existing()).isEqualTo(before);
    }
    @Test void deterministicForReferenceAndInventoryPreservesExistingConflicts(){
        LocalDate start=reference.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(12);
        jdbc.update("insert into reservations(user_id,room_id,start_date,end_date,status,created_at) values (?,?,?,?,'CONFIRMED',?)",owner,room,start.atStartOfDay(),start.plusDays(84).atStartOfDay(),start.minusDays(1).atStartOfDay());
        var first=create("batch-repeatable-one");String pattern=pattern();batches.revert("batch-repeatable-one","hotel_test","REVERT_HISTORY_BATCH:batch-repeatable-one");
        assertThat(jdbc.queryForObject("select count(*) from reservations where user_id=?",Long.class,owner)).isEqualTo(1);
        var second=create("batch-repeatable-two");assertThat(second.reservations()).isEqualTo(first.reservations());assertThat(pattern()).isEqualTo(pattern);
        assertThat(jdbc.queryForObject("select count(*) from reservations where room_id=? and user_id<>? and status='CONFIRMED'",Long.class,room,owner)).isZero();
    }
    String pattern(){return jdbc.queryForObject("select md5(string_agg(concat_ws('|',r.room_id,r.start_date,r.end_date,r.status,r.created_at,r.cancelled_at,r.nightly_price,r.total_price),';' order by i.item_key)) from reservation_demo_items i join reservations r on r.id=i.reservation_id",String.class);}
    @Test void safeReversalLeavesOnlyPreexistingDataAndRejectsChangedRows(){
        String before=existing();var created=create("batch-reversal-test");
        assertThatThrownBy(()->batches.revert("batch-reversal-test","hotel_test","yes")).isInstanceOf(IllegalStateException.class);
        Long id=jdbc.queryForObject("select min(reservation_id) from reservation_demo_items",Long.class);
        jdbc.update("insert into payments(reservation_id,amount,status) values (?,0,'SYNTHETIC_TEST')",id);
        assertThatThrownBy(()->batches.revert("batch-reversal-test","hotel_test","REVERT_HISTORY_BATCH:batch-reversal-test")).isInstanceOf(IllegalStateException.class).hasMessageContaining("dependencias");
        jdbc.update("delete from payments where reservation_id=?",id);
        jdbc.update("update reservations set total_price=total_price+1 where id=?",id);
        assertThatThrownBy(()->batches.revert("batch-reversal-test","hotel_test","REVERT_HISTORY_BATCH:batch-reversal-test")).isInstanceOf(IllegalStateException.class).hasMessageContaining("modificado");
        jdbc.update("update reservations set total_price=total_price-1 where id=?",id);
        assertThat(batches.revert("batch-reversal-test","hotel_test","REVERT_HISTORY_BATCH:batch-reversal-test").status()).isEqualTo("REVERTED");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Long.class)).isZero();assertThat(jdbc.queryForObject("select count(*) from users",Long.class)).isEqualTo(1);assertThat(existing()).isEqualTo(before);
        assertThat(batches.inspect("batch-reversal-test","hotel_test","INSPECT_HISTORY_BATCH").reservations()).isEqualTo(created.reservations());
    }
    @Test void originIsDerivedFromQueriedBatchMembershipAndFormulaUnchanged(){
        var batch=create("batch-provenance-test");
        var history=demand.history(null,batch.historyStart(),batch.historyEnd());assertThat(history.context().dataKind()).isEqualTo("SYNTHETIC_DEMO");assertThat(history.context().syntheticReservations()).isEqualTo(batch.reservations());assertThat(history.context().operationalReservations()).isZero();
        Long hotel=jdbc.queryForObject("select hotel_id from rooms where id=?",Long.class,room);
        jdbc.update("insert into reservations(user_id,room_id,start_date,end_date,status,created_at) values (?,?,?,?,'CANCELLED',?)",owner,room,batch.historyStart().atStartOfDay(),batch.historyStart().plusDays(1).atStartOfDay(),batch.historyStart().minusDays(1).atStartOfDay());
        assertThat(demand.history(hotel,batch.historyStart(),batch.historyEnd()).context().dataKind()).isEqualTo("MIXED");
        var forecast=demand.forecast(null);assertThat(forecast.days()).hasSize(30).allSatisfy(d->assertThat(d.estimatedRoomNights().signum()).isNotNegative());
        for(var average:forecast.weekdayAverages())assertThat(average.average()).isEqualByComparingTo(DemandMath.average(average.roomNights(),8));
        assertThat(demand.history(null,LocalDate.of(2000,1,1),LocalDate.of(2000,1,7)).context().syntheticReservations()).isZero();
    }
    @Test void refusesWrongDestinationMissingAuthorizationAndParameterDrift(){
        assertThatThrownBy(()->batches.create(options("batch-safety-test"),"hotel-bd","CREATE_HISTORY_BATCH")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->batches.create(options("batch-safety-test"),"hotel_test",null)).isInstanceOf(IllegalStateException.class);
        create("batch-safety-test");assertThatThrownBy(()->batches.create(new DemandHistoryBatchService.Options("batch-safety-test",reference,1,12),"hotel_test","CREATE_HISTORY_BATCH")).isInstanceOf(IllegalStateException.class);
    }
    @Test void fullyOccupiedHistoryFailsAtomicallyInsteadOfInventingOverlaps(){
        LocalDate start=reference.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(12);
        jdbc.update("insert into reservations(user_id,room_id,start_date,end_date,status,created_at) select ?,id,?,?,'CONFIRMED',? from rooms",owner,start.atStartOfDay(),start.plusDays(84).atStartOfDay(),start.minusDays(1).atStartOfDay());
        assertThatThrownBy(()->create("batch-fully-occupied")).isInstanceOf(IllegalStateException.class).hasMessageContaining("espacio histórico");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Long.class)).isEqualTo(12);assertThat(jdbc.queryForObject("select count(*) from users",Long.class)).isEqualTo(1);assertThat(jdbc.queryForObject("select count(*) from reservation_demo_batches",Long.class)).isZero();
    }
}
