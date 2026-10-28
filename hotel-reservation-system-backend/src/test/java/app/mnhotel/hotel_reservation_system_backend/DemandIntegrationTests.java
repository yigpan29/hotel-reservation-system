package app.mnhotel.hotel_reservation_system_backend;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.service.*;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@SpringBootTest(properties="HOTEL_DEMAND_DATA_KIND=SYNTHETIC_DEMO") @AutoConfigureMockMvc @Import(DemandIntegrationTests.FixedTime.class)
class DemandIntegrationTests {
    @TestConfiguration static class FixedTime {@Bean @Primary Clock fixedDemandClock(){return Clock.fixed(Instant.parse("2026-10-26T17:00:00Z"),ZoneId.of("America/Panama"));}}
    @Autowired JdbcTemplate jdbc;@Autowired MockMvc mvc;@Autowired DemandService service;@Autowired AuthServiceImp auth;@Autowired HotelServiceImp hotels;@Autowired RoomServiceImp rooms;
    final LocalDate today=LocalDate.of(2026,10,26),start=LocalDate.of(2026,8,31),end=LocalDate.of(2026,10,25);
    Long hotelId,otherHotel,userId;List<Long> roomIds=new ArrayList<>();
    void clear(){assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("hotel_test");jdbc.execute("truncate payments,reviews,reservations,rooms,hotels,users restart identity cascade");}
    @BeforeEach void setup(){clear();roomIds.clear();userId=auth.create(new Requests.Register("demand-admin","demand-admin@example.invalid","Demand-admin-123"),"ADMIN").getId();auth.register(new Requests.Register("demand-user","demand-user@example.invalid","Demand-user-123"));hotelId=hotels.save(null,new Requests.HotelInput("Synthetic demand","Demo","Synthetic data",null,true)).id();otherHotel=hotels.save(null,new Requests.HotelInput("Empty hotel","Demo","No rooms",null,true)).id();for(int i=1;i<=4;i++)roomIds.add(rooms.save(null,new Requests.RoomInput(hotelId,"R"+i,"Doble",100,true)).id());}
    @AfterEach void cleanup(){clear();}
    void stay(Long room,LocalDate from,LocalDate to,String status){jdbc.update("insert into reservations(user_id,room_id,start_date,end_date,status,created_at,nightly_price,total_price) values (?,?,?,?,?,?,100,100)",userId,room,from.atStartOfDay(),to.atStartOfDay(),status,from.minusDays(2).atStartOfDay());}
    void history(){stay(roomIds.get(0),start.minusDays(7),start.minusDays(6),"CANCELLED");for(int i=0;i<56;i++){int weekday=i%7,week=i/7;int count=weekday==0?(week%2==0?1:2):new int[]{0,2,3,2,4,3,1}[weekday];for(int r=0;r<count;r++)stay(roomIds.get(r),start.plusDays(i),start.plusDays(i+1),"CONFIRMED");if(weekday==0)stay(roomIds.get(3),start.plusDays(i),start.plusDays(i+1),"CANCELLED");}}
    MockHttpSession login(String name,String password)throws Exception{return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"username\":\""+name+"\",\"password\":\""+password+"\"}")).andExpect(status().isOk()).andReturn().getRequest().getSession(false);}
    @Test void multiNightCheckoutCancellationRoomGroupingAndClipping(){
        stay(roomIds.get(0),start,start.plusDays(2),"CONFIRMED");stay(roomIds.get(1),start.plusDays(1),start.plusDays(3),"CONFIRMED");stay(roomIds.get(2),start,start.plusDays(3),"CANCELLED");
        var result=service.history(hotelId,start,start.plusDays(3));assertThat(result.summary().totalReservations()).isEqualTo(3);assertThat(result.summary().confirmedReservations()).isEqualTo(2);assertThat(result.summary().cancelledReservations()).isEqualTo(1);assertThat(result.summary().roomNights()).isEqualTo(4);
        assertThat(result.days()).extracting(d->d.roomNights()).containsExactly(1L,2L,1L,0L);assertThat(result.summary().dailyAverage()).isEqualByComparingTo("1.00");
        assertThat(service.history(otherHotel,start,end).summary().roomNights()).isZero();assertThat(service.history(null,start,end).summary().roomNights()).isEqualTo(4);
        assertThat(service.history(hotelId,start.plusDays(1),start.plusDays(1)).summary().roomNights()).isEqualTo(2);
    }
    @Test void eightCompleteWeeksProduceKnownMeansAndThirtyPredictions(){
        history();stay(roomIds.get(0),today.plusDays(1),today.plusDays(3),"CONFIRMED");
        var result=service.history(hotelId,start,end);assertThat(result.summary().roomNights()).isEqualTo(132);assertThat(result.summary().totalReservations()).isEqualTo(140);assertThat(result.summary().cancelledReservations()).isEqualTo(8);assertThat(result.summary().capacityReferencePercent()).isEqualByComparingTo("58.93");
        var forecast=service.forecast(hotelId);assertThat(forecast.context().dataKind()).isEqualTo("SYNTHETIC_DEMO");assertThat(forecast.status()).isEqualTo("AVAILABLE");assertThat(forecast.trainingStart()).isEqualTo(start);assertThat(forecast.trainingEnd()).isEqualTo(end);assertThat(forecast.days()).hasSize(30);assertThat(forecast.weekdayAverages().get(0).average()).isEqualByComparingTo("1.50");
        assertThat(forecast.days().get(0).estimatedRoomNights()).isEqualByComparingTo("2.00");assertThat(forecast.days().get(0).confirmedRoomNights()).isEqualTo(1);
        assertThat(forecast.days().stream().filter(d->d.date().getDayOfWeek()==DayOfWeek.FRIDAY)).allSatisfy(d->assertThat(d.level()).isEqualTo("HIGH"));
        assertThat(forecast.days().stream().filter(d->d.date().getDayOfWeek()==DayOfWeek.SUNDAY)).allSatisfy(d->assertThat(d.level()).isEqualTo("LOW"));
    }
    @Test void emptyInsufficientAndCancelledOnlyHistoriesNeverInventPredictions(){
        assertThat(service.forecast(hotelId).days()).isEmpty();assertThat(service.forecast(hotelId).status()).isEqualTo("INSUFFICIENT_HISTORY");
        stay(roomIds.get(0),start.minusDays(1),end,"CANCELLED");assertThat(service.forecast(hotelId).days()).isEmpty();
        stay(roomIds.get(0),end.minusDays(2),end,"CONFIRMED");assertThat(service.forecast(hotelId).status()).isEqualTo("AVAILABLE");
        assertThat(service.forecast(otherHotel).days()).isEmpty();
    }
    @Test void recentHistoryIsInsufficientEvenWithActivity(){stay(roomIds.get(0),end.minusDays(7),end,"CONFIRMED");assertThat(service.forecast(hotelId).status()).isEqualTo("INSUFFICIENT_HISTORY");}
    @Test void inactiveRoomsAndHotelsKeepHistoricalNightsButDoNotInventCapacity(){
        history();jdbc.update("update rooms set active=false where hotel_id=?",hotelId);
        var result=service.history(hotelId,start,end);assertThat(result.summary().roomNights()).isEqualTo(132);assertThat(result.context().currentActiveRooms()).isZero();assertThat(result.summary().capacityReferencePercent()).isNull();
        assertThat(service.forecast(hotelId).days()).hasSize(30).allSatisfy(d->{assertThat(d.capacityReferencePercent()).isNull();assertThat(d.level()).isEqualTo("UNAVAILABLE");});
        jdbc.update("update rooms set active=true where hotel_id=?",hotelId);jdbc.update("update hotels set active=false where id=?",hotelId);assertThat(service.history(hotelId,start,end).context().currentActiveRooms()).isZero();
    }
    @Test void legacySameDayNullDatesAndUnknownStateAreReportedAndDuplicatesDeduplicated(){
        stay(roomIds.get(0),start,start.plusDays(1),"CONFIRMED");stay(roomIds.get(0),start,start.plusDays(1),"CONFIRMED");stay(roomIds.get(1),start,start.plusDays(1),null);
        jdbc.update("insert into reservations(room_id,start_date,end_date,status) values (?,?,?,'CONFIRMED')",roomIds.get(2),start.atTime(1,0),start.atTime(22,0));
        jdbc.update("insert into reservations(room_id,status) values (?,'CONFIRMED')",roomIds.get(3));
        var result=service.history(hotelId,start,start);assertThat(result.summary().roomNights()).isEqualTo(1);assertThat(result.summary().deduplicatedRoomNights()).isEqualTo(1);assertThat(result.summary().unknownStateReservations()).isEqualTo(1);assertThat(result.context().invalidStayRecords()).isEqualTo(2);
    }
    @Test void endpointsEnforceAdminAndExposeNoPersonalData()throws Exception{
        var admin=login("demand-admin","Demand-admin-123");var user=login("demand-user","Demand-user-123");
        for(String path:List.of("/api/admin/demand/history","/api/admin/demand/forecast")){
            mvc.perform(get(path)).andExpect(status().isUnauthorized());mvc.perform(get(path).session(user)).andExpect(status().isForbidden());
            String body=mvc.perform(get(path).session(admin).param("hotelId",hotelId.toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertThat(body).doesNotContain("demand-admin@example.invalid","demand-user","password","userId","username");
        }
    }
    @Test void invalidDatesRangeHotelAndFormatsReturnDomainErrors()throws Exception{
        var admin=login("demand-admin","Demand-admin-123");
        for(String[] dates:List.of(new String[]{"2026-10-20","2026-10-01"},new String[]{"2026-10-25","2026-10-26"},new String[]{"2024-01-01","2026-10-25"},new String[]{"bad","2026-10-25"},new String[]{"1800-01-01","1800-01-02"}))mvc.perform(get("/api/admin/demand/history").session(admin).param("startDate",dates[0]).param("endDate",dates[1])).andExpect(status().isBadRequest());
        for(String path:List.of("/api/admin/demand/history","/api/admin/demand/forecast")){mvc.perform(get(path).session(admin).param("hotelId","-1")).andExpect(status().isBadRequest());mvc.perform(get(path).session(admin).param("hotelId","999999")).andExpect(status().isNotFound());}
    }
    @Test void analysisLeavesAllBusinessTablesUnchanged(){history();String before=snapshot();service.history(null,start,end);service.forecast(hotelId);assertThat(snapshot()).isEqualTo(before);}
    String snapshot(){StringBuilder value=new StringBuilder();for(String table:List.of("users","hotels","rooms","reservations","payments","reviews"))value.append(jdbc.queryForObject("select coalesce(md5(jsonb_agg(to_jsonb(t) order by id)::text),'empty') from "+table+" t",String.class));return value.toString();}
}
