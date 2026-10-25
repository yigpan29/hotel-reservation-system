package app.mnhotel.hotel_reservation_system_backend;

import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.*;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@SpringBootTest @AutoConfigureMockMvc
class SystemIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthServiceImp auth;
    @Autowired HotelServiceImp hotels;
    @Autowired RoomServiceImp rooms;
    @Autowired ReservationServiceImp reservations;
    @Autowired PasswordEncoder encoder;
    Long hotelId,roomId;
    final LocalDate start=RoomServiceImp.today().plusDays(5),end=start.plusDays(2);

    void clear() {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("hotel_test");
        jdbc.execute("truncate payments,reviews,reservations,rooms,hotels,users restart identity cascade");
    }
    @BeforeEach void setup() {
        clear();
        auth.create(new Requests.Register("admin","admin@example.invalid","Admin-test-123"),"ADMIN");
        auth.register(new Requests.Register("owner","owner@example.invalid","Owner-test-123"));
        auth.register(new Requests.Register("other","other@example.invalid","Other-test-123"));
        hotelId=hotels.save(null,new Requests.HotelInput("Test Hotel","Panamá","Synthetic test hotel",4.0,true)).id();
        roomId=rooms.save(null,new Requests.RoomInput(hotelId,"101","Doble",80,true)).id();
    }
    @AfterEach void cleanup(){clear();}
    MockHttpSession login(String user,String password) throws Exception {
        var result=mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("username",user,"password",password))))
            .andExpect(status().isOk()).andReturn();
        return (MockHttpSession)result.getRequest().getSession(false);
    }
    Requests.ReservationInput input(){return new Requests.ReservationInput(roomId,start,end);}
    ResultActions create(MockHttpSession session,Requests.ReservationInput request) throws Exception {return mvc.perform(post("/api/reservations").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)));}

    @Test void registrationPersistsBcryptAndCannotEscalateRole() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"newuser\",\"email\":\"new@example.invalid\",\"password\":\"Strong-test-123\",\"role\":\"ADMIN\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("USER")).andExpect(jsonPath("$.password").doesNotExist());
        var user=auth.require("NEWUSER");assertThat(encoder.matches("Strong-test-123",user.getPassword())).isTrue();assertThat(user.getCreatedAt()).isNotNull();
    }
    @Test void duplicateUsernameOrEmailIsConflict() throws Exception {
        for(String body:List.of("{\"username\":\"OWNER\",\"email\":\"different@example.invalid\",\"password\":\"Strong-test-123\"}","{\"username\":\"different\",\"email\":\"OWNER@example.invalid\",\"password\":\"Strong-test-123\"}"))
            mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
    }
    @Test void invalidRegistrationIsBadRequest() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"!\",\"email\":\"bad\",\"password\":\"short\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields").exists());
    }
    @Test void loginSessionMeAndLogoutInvalidation() throws Exception {
        MockHttpSession session=login("owner","Owner-test-123");
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.username").value("owner")).andExpect(jsonPath("$.password").doesNotExist());
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void wrongCredentialsAndCsrfAreRejected() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"owner\",\"password\":\"wrong\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
        MockHttpSession session=login("owner","Owner-test-123");
        mvc.perform(post("/api/reservations").session(session).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input()))).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andExpect(jsonPath("$.token").isString());
    }
    @Test void adminEndpointsEnforceRoles() throws Exception {
        mvc.perform(get("/api/admin/hotels")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/hotels").session(login("owner","Owner-test-123"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/hotels").session(login("admin","Admin-test-123"))).andExpect(status().isOk());
        create(new MockHttpSession(),input()).andExpect(status().isUnauthorized());
    }
    @Test void administrativeHotelCreateUpdateAndSearch() throws Exception {
        var session=login("admin","Admin-test-123");
        var result=mvc.perform(post("/api/admin/hotels").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new Requests.HotelInput("Mountain","Boquete","Synthetic",4.5,true))))
            .andExpect(status().isCreated()).andReturn();
        Long id=json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(get("/api/hotels?q=Boquete")).andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Mountain"));
        mvc.perform(put("/api/admin/hotels/"+id).session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new Requests.HotelInput("Mountain edited","Boquete","Synthetic",4.5,false)))).andExpect(status().isOk());
        mvc.perform(get("/api/hotels/"+id)).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from hotels where id=?",Integer.class,id)).isEqualTo(1);
    }
    @Test void administrativeRoomValidationAndUpdate() throws Exception {
        var session=login("admin","Admin-test-123");
        for(var request:List.of(new Requests.RoomInput(hotelId,"102","Suite",-1,true),new Requests.RoomInput(hotelId,"","Suite",90,true)))
            mvc.perform(post("/api/admin/rooms").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/rooms").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new Requests.RoomInput(hotelId,"101","Suite",100,true)))).andExpect(status().isConflict());
        mvc.perform(put("/api/admin/rooms/"+roomId).session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new Requests.RoomInput(hotelId,"101","Suite",110,false)))).andExpect(status().isOk());
        assertThatThrownBy(()->reservations.create("owner",input())).isInstanceOf(ApiException.class);
    }
    @Test void roomNumbersAreUniquePerHotelNotGlobally() {
        Long otherHotel=hotels.save(null,new Requests.HotelInput("Second","Colón","Test",3.0,true)).id();
        assertThat(rooms.save(null,new Requests.RoomInput(otherHotel,"101","Doble",50,true)).id()).isNotNull();
        assertThatThrownBy(()->rooms.save(null,new Requests.RoomInput(hotelId,"101","Doble",50,true))).isInstanceOf(ApiException.class);
    }
    @Test void reservationStoresAgreedPriceAndHistory() throws Exception {
        var session=login("owner","Owner-test-123");
        var result=create(session,input()).andExpect(status().isCreated()).andExpect(jsonPath("$.nightlyPrice").value(80)).andExpect(jsonPath("$.totalPrice").value(160)).andExpect(jsonPath("$.status").value("CONFIRMED")).andReturn();
        Long id=json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        rooms.save(roomId,new Requests.RoomInput(hotelId,"101","Doble",300,true));
        mvc.perform(get("/api/reservations/"+id).session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.totalPrice").value(160));
        mvc.perform(get("/api/reservations/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(post("/api/reservations/"+id+"/cancel").session(session).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED")).andExpect(jsonPath("$.cancelledAt").isNotEmpty());
        mvc.perform(post("/api/reservations/"+id+"/cancel").session(session).with(csrf())).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isEqualTo(1);
        assertThat(reservations.create("owner",input()).status()).isEqualTo("CONFIRMED");
    }
    @Test void ownerAuthorizationAppliesToReadAndCancel() throws Exception {
        Long id=reservations.create("owner",input()).id();var other=login("other","Other-test-123");
        mvc.perform(get("/api/reservations/"+id).session(other)).andExpect(status().isForbidden());
        mvc.perform(post("/api/reservations/"+id+"/cancel").session(other).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(get("/api/reservations/me").session(other)).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(post("/api/reservations/"+id+"/cancel").session(login("admin","Admin-test-123")).with(csrf())).andExpect(status().isOk());
    }
    @Test void invalidDatesAreRejected() throws Exception {
        var session=login("owner","Owner-test-123");
        for(var request:List.of(new Requests.ReservationInput(roomId,start,start),new Requests.ReservationInput(roomId,end,start),new Requests.ReservationInput(roomId,RoomServiceImp.today().minusDays(1),end)))create(session,request).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
    }
    @Test void overlapsFailConsecutiveDatesSucceedAndAvailabilityIsDerived() throws Exception {
        reservations.create("owner",input());
        for(var request:List.of(input(),new Requests.ReservationInput(roomId,start.minusDays(1),end.plusDays(1)),new Requests.ReservationInput(roomId,start.plusDays(1),end.plusDays(2))))
            assertThatThrownBy(()->reservations.create("other",request)).isInstanceOf(ApiException.class);
        assertThat(reservations.create("other",new Requests.ReservationInput(roomId,end,end.plusDays(1))).status()).isEqualTo("CONFIRMED");
        mvc.perform(get("/api/rooms/availability").param("hotelId",hotelId.toString()).param("startDate",start.toString()).param("endDate",end.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void twoConcurrentRequestsProduceExactlyOneReservation() throws Exception {
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch ready=new CountDownLatch(2),go=new CountDownLatch(1);
        Callable<Integer> task=()->{ready.countDown();if(!go.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Barrier timed out");try{reservations.create("owner",input());return 201;}catch(ApiException e){return e.getStatus().value();}};
        try {var first=pool.submit(task);var second=pool.submit(task);assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();go.countDown();assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);}
        finally {pool.shutdownNow();}
        assertThat(jdbc.queryForObject("select count(*) from reservations where status='CONFIRMED'",Integer.class)).isEqualTo(1);
    }
    @Test void disabledHotelAndMissingRoomCannotBeBooked() {
        hotels.save(hotelId,new Requests.HotelInput("Test Hotel","Panamá","Test",4.0,false));
        assertThatThrownBy(()->reservations.create("owner",input())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->reservations.create("owner",new Requests.ReservationInput(9999L,start,end))).isInstanceOf(ApiException.class);
    }
    @Test void adminCanFilterReservationsAndPaginationIsValidated() throws Exception {
        reservations.create("owner",input());var session=login("admin","Admin-test-123");
        mvc.perform(get("/api/admin/reservations").session(session).param("hotelId",hotelId.toString()).param("roomId",roomId.toString()).param("userId",auth.require("owner").getId().toString()).param("status","CONFIRMED")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/admin/reservations?status=INVALID").session(session)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/reservations?size=1000").session(session)).andExpect(status().isBadRequest());
    }
    @Test void postgresConstraintsAndForeignKeysProtectIntegrity() {
        assertThatThrownBy(()->jdbc.update("insert into rooms(hotel_id,room_number,price_per_night) values(?, 'BAD', -1)",hotelId)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(()->jdbc.update("insert into rooms(hotel_id,room_number) values(99999,'BAD')")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success",Integer.class)).isEqualTo(2);
    }
    @Test void pastReservationsCannotBeCancelledAndRemainStored() throws Exception {
        jdbc.update("insert into reservations(room_id,user_id,start_date,end_date,status,created_at,nightly_price,total_price) values(?,?,?,?, 'CONFIRMED',now(),80,80)",roomId,auth.require("owner").getId(),RoomServiceImp.today().minusDays(2).atStartOfDay(),RoomServiceImp.today().minusDays(1).atStartOfDay());
        Long id=jdbc.queryForObject("select id from reservations",Long.class);
        mvc.perform(post("/api/reservations/"+id+"/cancel").session(login("owner","Owner-test-123")).with(csrf())).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select status from reservations where id=?",String.class,id)).isEqualTo("CONFIRMED");
    }
}
