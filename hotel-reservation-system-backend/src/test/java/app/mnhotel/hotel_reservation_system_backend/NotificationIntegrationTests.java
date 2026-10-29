package app.mnhotel.hotel_reservation_system_backend;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.http.MediaType;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.service.*;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
import app.mnhotel.hotel_reservation_system_backend.repository.ReservationRepository;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@SpringBootTest(properties="hotel.notifications.reminders.enabled=false") @AutoConfigureMockMvc
class NotificationIntegrationTests {
    static class TestClock extends Clock {
        AtomicReference<Instant> value=new AtomicReference<>();
        public ZoneId getZone(){return ZoneId.of("America/Panama");}public Clock withZone(ZoneId zone){return Clock.fixed(instant(),zone);}public Instant instant(){return value.get();}
    }
    @TestConfiguration static class Config {@Bean @Primary TestClock notificationClock(){return new TestClock();}}
    @Autowired JdbcTemplate jdbc;@Autowired MockMvc mvc;@Autowired AuthServiceImp auth;@Autowired HotelServiceImp hotels;@Autowired RoomServiceImp rooms;
    @Autowired ReservationServiceImp bookings;@Autowired NotificationService notices;@Autowired ReminderService reminders;@Autowired ReservationRepository reservations;@Autowired PlatformTransactionManager manager;@Autowired TestClock clock;
    Long room,user;LocalDate tomorrow;
    void clear(){assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("hotel_test");jdbc.execute("truncate payments,reviews,reservations,rooms,hotels,users restart identity cascade");}
    @BeforeEach void setup(){clear();clock.value.set(RoomServiceImp.today().plusDays(10).atTime(12,0).atZone(clock.getZone()).toInstant());tomorrow=NotificationText.tomorrow(clock);
        user=auth.register(new Requests.Register("notice-owner","owner@example.invalid","Synthetic-owner-123")).id();auth.register(new Requests.Register("notice-other","other@example.invalid","Synthetic-other-123"));auth.create(new Requests.Register("notice-admin","admin@example.invalid","Synthetic-admin-123"),"ADMIN");
        Long hotel=hotels.save(null,new Requests.HotelInput("Hotel de pruebas HU05","Panamá","Sintético",null,true)).id();room=rooms.save(null,new Requests.RoomInput(hotel,"501","Doble",90,true)).id();
    }
    @AfterEach void cleanup(){clear();}
    Views.ReservationView book(){return bookings.create("notice-owner",new Requests.ReservationInput(room,tomorrow,tomorrow.plusDays(2)));}
    long total(){return jdbc.queryForObject("select count(*) from reservation_notifications",Long.class);}
    long first(){return jdbc.queryForObject("select min(id) from reservation_notifications",Long.class);}
    MockHttpSession login(String user,String password)throws Exception{return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"username\":\""+user+"\",\"password\":\""+password+"\"}")).andExpect(status().isOk()).andReturn().getRequest().getSession(false);}
    @Test void confirmationAndCancellationAreAtomicAndIdempotent(){
        var r=book();assertThat(total()).isEqualTo(1);assertThat(notices.count("notice-owner").unreadCount()).isEqualTo(1);
        var n=notices.list("notice-owner",0,20).content().get(0);assertThat(n.reservationId()).isEqualTo(r.id());assertThat(n.message()).contains("Hotel de pruebas HU05",r.id().toString());assertThat(n.read()).isFalse();
        bookings.cancel(r.id(),"notice-owner",false);bookings.cancel(r.id(),"notice-owner",false);assertThat(total()).isEqualTo(2);assertThat(reminders.generate()).isZero();
        assertThat(jdbc.queryForObject("select status from reservations where id=?",String.class,r.id())).isEqualTo("CANCELLED");
    }
    @Test void failedBookingAndOuterRollbackLeaveNoOrphanNotices(){
        var tx=new TransactionTemplate(manager);
        assertThatThrownBy(()->tx.execute(s->{book();throw new IllegalStateException("controlled rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(total()).isZero();assertThat(jdbc.queryForObject("select count(*) from reservations",Long.class)).isZero();
        book();assertThatThrownBy(this::book).isInstanceOf(RuntimeException.class);assertThat(total()).isEqualTo(1);
    }
    @Test void remindersUsePanamaTomorrowAndDatabaseUniquenessAcrossReruns(){
        var r=book();assertThat(reminders.generate()).isEqualTo(1);assertThat(reminders.generate()).isZero();assertThat(total()).isEqualTo(2);
        Integer afterNewInstance=new TransactionTemplate(manager).execute(s->new ReminderService(clock,jdbc,reservations,notices).generate());assertThat(afterNewInstance).isZero();
        clock.value.set(clock.instant().plusSeconds(86400));assertThat(reminders.generate()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from reservation_notifications where reservation_id=? and type='CHECK_IN_REMINDER'",Long.class,r.id())).isEqualTo(1);
    }
    @Test void noBackfillForLegacyFuturePastInvalidOrCancelledReservations(){
        jdbc.update("insert into reservations(user_id,room_id,start_date,end_date,status,created_at) values (?,?,?,?,'CONFIRMED',?)",user,room,tomorrow.atStartOfDay(),tomorrow.plusDays(1).atStartOfDay(),RoomServiceImp.now());
        assertThat(reminders.generate()).isZero();assertThat(total()).isZero();
        jdbc.update("update reservations set start_date=null");assertThat(reminders.generate()).isZero();
        jdbc.update("update reservations set start_date=?,end_date=?",tomorrow.minusDays(3).atStartOfDay(),tomorrow.minusDays(1).atStartOfDay());assertThat(reminders.generate()).isZero();
        jdbc.update("update reservations set status='CANCELLED',start_date=?,end_date=?",tomorrow.atStartOfDay(),tomorrow.plusDays(1).atStartOfDay());assertThat(reminders.generate()).isZero();assertThat(total()).isZero();
    }
    @Test void noticeDoesNotTightenExistingLegacyCancellationRules(){
        Long id=jdbc.queryForObject("insert into reservations(user_id,room_id,start_date,end_date,status,created_at) values (?,?,?,null,'CONFIRMED',?) returning id",Long.class,user,room,tomorrow.atStartOfDay(),RoomServiceImp.now());
        assertThat(bookings.cancel(id,"notice-owner",false).status()).isEqualTo("CANCELLED");assertThat(total()).isEqualTo(1);assertThat(notices.list("notice-owner",0,20).content().get(0).message()).contains("cancelada");
    }
    @Test void syntheticMembershipPreventsRemindersAndFurtherEvents(){
        var r=book();UUID batch=UUID.randomUUID();
        jdbc.update("insert into reservation_demo_batches(id,code,algorithm,reference_date,seed,weeks,history_start,history_end,technical_user_id,technical_username,technical_user_hash,status) select ?,'hu05-synthetic-test','TEST',?,1,8,?,?,id,username,md5(to_jsonb(u)::text),'ACTIVE' from users u where id=?",batch,tomorrow.minusDays(1),tomorrow.minusWeeks(8),tomorrow.minusDays(1),user);
        jdbc.update("insert into reservation_demo_items(batch_id,item_key,reservation_id,original_row_hash) select ?,'test',id,md5(to_jsonb(r)::text) from reservations r where id=?",batch,r.id());
        assertThat(reminders.generate()).isZero();bookings.cancel(r.id(),"notice-owner",false);assertThat(total()).isEqualTo(1);
    }
    @Test void readingIsPrivateIdempotentAndPersistsAcrossSessions()throws Exception{
        book();long id=first();var owner=login("notice-owner","Synthetic-owner-123");var other=login("notice-other","Synthetic-other-123");var admin=login("notice-admin","Synthetic-admin-123");
        mvc.perform(get("/api/notifications")).andExpect(status().isUnauthorized());
        for(var session:List.of(other,admin)){
            mvc.perform(get("/api/notifications").session(session)).andExpect(jsonPath("$.totalElements").value(0));
            mvc.perform(post("/api/notifications/"+id+"/read").session(session).with(csrf())).andExpect(status().isNotFound());
        }
        mvc.perform(post("/api/notifications/"+id+"/read").session(owner)).andExpect(status().isForbidden());
        mvc.perform(post("/api/notifications/"+id+"/read").session(owner).with(csrf())).andExpect(status().isNoContent());
        String read=jdbc.queryForObject("select read_at::text from reservation_notifications where id=?",String.class,id);
        notices.read("notice-owner",id);assertThat(jdbc.queryForObject("select read_at::text from reservation_notifications where id=?",String.class,id)).isEqualTo(read);
        mvc.perform(post("/api/auth/logout").session(owner).with(csrf())).andExpect(status().isNoContent());
        var again=login("notice-owner","Synthetic-owner-123");mvc.perform(get("/api/notifications/unread-count").session(again)).andExpect(jsonPath("$.unreadCount").value(0));
        mvc.perform(get("/api/notifications").session(again)).andExpect(jsonPath("$.content[0].read").value(true)).andExpect(jsonPath("$.content[0].readAt").isNotEmpty()).andExpect(jsonPath("$.content[0].user").doesNotExist());
    }
    @Test void markAllOnlyTouchesOwnerAndPaginationIsValidated()throws Exception{
        var r=book();bookings.cancel(r.id(),"notice-owner",false);
        notices.readAll("notice-other");assertThat(notices.count("notice-owner").unreadCount()).isEqualTo(2);
        var owner=login("notice-owner","Synthetic-owner-123");mvc.perform(get("/api/notifications?page=0&size=1").session(owner)).andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.content.length()").value(1));
        mvc.perform(get("/api/notifications?size=101").session(owner)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/notifications/read-all").session(owner)).andExpect(status().isForbidden());
        mvc.perform(post("/api/notifications/read-all").session(owner).with(csrf())).andExpect(status().isNoContent());assertThat(notices.count("notice-owner").unreadCount()).isZero();
    }
    @Test void readingNeverPrecedesCreationEvenWithClockSkewOrConcurrentArrival(){
        var r=book();clock.value.set(clock.instant().minusSeconds(30));notices.read("notice-owner",first());
        bookings.cancel(r.id(),"notice-owner",false);clock.value.set(clock.instant().minusSeconds(30));notices.readAll("notice-owner");
        assertThat(notices.count("notice-owner").unreadCount()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from reservation_notifications where read_at<created_at",Long.class)).isZero();
    }
    @Test void concurrentRemindersAndCancellationPreserveUniqueness()throws Exception{
        var r=book();var pool=Executors.newFixedThreadPool(3);var start=new CountDownLatch(1);
        try{List<Future<?>> futures=List.of(pool.submit(()->{await(start);reminders.generate();}),pool.submit(()->{await(start);reminders.generate();}),pool.submit(()->{await(start);bookings.cancel(r.id(),"notice-owner",false);}));start.countDown();for(var f:futures)f.get(20,TimeUnit.SECONDS);}finally{pool.shutdownNow();}
        assertThat(jdbc.queryForObject("select count(*) from reservation_notifications where type='CHECK_IN_REMINDER'",Long.class)).isBetween(0L,1L);
        assertThat(jdbc.queryForObject("select count(*) from reservation_notifications where type='CANCELLED'",Long.class)).isEqualTo(1);assertThat(reminders.generate()).isZero();
    }
    static void await(CountDownLatch latch){try{latch.await();}catch(InterruptedException e){Thread.currentThread().interrupt();throw new RuntimeException(e);}}
}
