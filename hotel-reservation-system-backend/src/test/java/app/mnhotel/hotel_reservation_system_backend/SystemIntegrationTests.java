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
    Requests.GroupRoomInput group(String type,int adults,int children){return new Requests.GroupRoomInput(type,adults,children);}
    Requests.GroupReservationInput guests(List<Requests.GroupRoomInput> groups){return new Requests.GroupReservationInput(hotelId,groups,start,end);}
    ResultActions createGroup(MockHttpSession session,Requests.GroupReservationInput request) throws Exception {return mvc.perform(post("/api/reservations/group").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)));}
    ResultActions allocation(LocalDate from,LocalDate to,int adults,int children) throws Exception {return mvc.perform(get("/api/rooms/allocation").param("hotelId",hotelId.toString()).param("startDate",from.toString()).param("endDate",to.toString()).param("adults",String.valueOf(adults)).param("children",String.valueOf(children)));}
    ResultActions allocation(int adults,int children) throws Exception {return allocation(start,end,adults,children);}
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
        var result=create(session,input()).andExpect(status().isCreated()).andExpect(jsonPath("$.roomType").value("Doble")).andExpect(jsonPath("$.nightlyPrice").value(80)).andExpect(jsonPath("$.totalPrice").value(160)).andExpect(jsonPath("$.status").value("CONFIRMED")).andReturn();
        Long id=json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        rooms.save(roomId,new Requests.RoomInput(hotelId,"101","Suite",300,true));
        mvc.perform(get("/api/reservations/"+id).session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.totalPrice").value(160)).andExpect(jsonPath("$.roomType").value("Doble"));
        assertThat(jdbc.queryForObject("select room_type from reservations where id=?",String.class,id)).isEqualTo("Doble");
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
    @Test void calendarOccupancyIsPublicDerivedFromConfirmedStaysAndBounded() throws Exception {
        reservations.create("owner",input());
        Long cancelled=reservations.create("other",new Requests.ReservationInput(roomId,end.plusDays(1),end.plusDays(3))).id();
        reservations.cancel(cancelled,"other",false);
        mvc.perform(get("/api/rooms/"+roomId+"/occupancy")).andExpect(status().isOk())
            .andExpect(jsonPath("$.roomId").value(roomId)).andExpect(jsonPath("$.occupied.length()").value(1))
            .andExpect(jsonPath("$.occupied[0].startDate").value(start.toString()))
            .andExpect(jsonPath("$.occupied[0].endDate").value(end.toString()))
            .andExpect(jsonPath("$.occupied[0].username").doesNotExist());
        mvc.perform(get("/api/rooms/"+roomId+"/occupancy?from="+end+"&to="+end.plusDays(30))).andExpect(status().isOk())
            .andExpect(jsonPath("$.occupied.length()").value(0));
        for(String window:List.of("?from="+start+"&to="+start,"?from="+start+"&to="+start.plusDays(401)))
            mvc.perform(get("/api/rooms/"+roomId+"/occupancy"+window)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/rooms/"+(roomId+999)+"/occupancy")).andExpect(status().isNotFound());
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
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success",Integer.class)).isEqualTo(6);
    }
    @Test void pastReservationsCannotBeCancelledAndRemainStored() throws Exception {
        jdbc.update("insert into reservations(room_id,user_id,start_date,end_date,status,created_at,nightly_price,total_price) values(?,?,?,?, 'CONFIRMED',now(),80,80)",roomId,auth.require("owner").getId(),RoomServiceImp.today().minusDays(2).atStartOfDay(),RoomServiceImp.today().minusDays(1).atStartOfDay());
        Long id=jdbc.queryForObject("select id from reservations",Long.class);
        mvc.perform(post("/api/reservations/"+id+"/cancel").session(login("owner","Owner-test-123")).with(csrf())).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select status from reservations where id=?",String.class,id)).isEqualTo("CONFIRMED");
    }

    @Test void roomCapacityFollowsItsTypeAndTravelsToTheClient() throws Exception {
        Long suite=rooms.save(null,new Requests.RoomInput(hotelId,"201","Suite",200,true)).id();
        assertThat(rooms.save(null,new Requests.RoomInput(hotelId,"202","Individual",40,true)).capacity()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select capacity from rooms where id=?",Integer.class,suite)).isEqualTo(4);
        mvc.perform(get("/api/hotels/"+hotelId+"/rooms")).andExpect(status().isOk()).andExpect(jsonPath("$[0].capacity").value(2));
    }
    @Test void insufficientRoomsBlockTheStayWithAnExplicitMessage() throws Exception {
        allocation(4,0).andExpect(status().isOk()).andExpect(jsonPath("$.feasible").value(false))
            .andExpect(jsonPath("$.guests").value(4)).andExpect(jsonPath("$.maxRoomCapacity").value(2))
            .andExpect(jsonPath("$.minimumRooms").value(2)).andExpect(jsonPath("$.availableRooms").value(1))
            .andExpect(jsonPath("$.types.length()").value(1)).andExpect(jsonPath("$.types[0].available").value(1))
            .andExpect(jsonPath("$.message").value("No hay habitaciones suficientes para alojar a 4 huéspedes. Se requieren al menos 2 habitaciones, pero solo hay 1 disponible para las fechas seleccionadas."));
    }
    @Test void availableRoomTypesCarryCapacityPriceAndFreeUnits() throws Exception {
        rooms.save(null,new Requests.RoomInput(hotelId,"102","Doble",80,true));
        rooms.save(null,new Requests.RoomInput(hotelId,"201","Suite",200,true));
        allocation(4,2).andExpect(jsonPath("$.feasible").value(true)).andExpect(jsonPath("$.minimumRooms").value(2))
            .andExpect(jsonPath("$.types.length()").value(2)).andExpect(jsonPath("$.availableCapacity").value(8))
            .andExpect(jsonPath("$.types[0].type").value("Doble")).andExpect(jsonPath("$.types[0].capacity").value(2))
            .andExpect(jsonPath("$.types[0].available").value(2)).andExpect(jsonPath("$.types[0].pricePerNight").value(80))
            .andExpect(jsonPath("$.types[0].totalPrice").value(160))
            .andExpect(jsonPath("$.types[1].type").value("Suite")).andExpect(jsonPath("$.types[1].capacity").value(4))
            .andExpect(jsonPath("$.types[1].available").value(1));
        // Una unidad ocupada deja de contarse en su tipo; el tipo desaparece cuando no queda ninguna.
        reservations.create("owner",input());
        allocation(4,2).andExpect(jsonPath("$.availableRooms").value(2)).andExpect(jsonPath("$.types[0].available").value(1));
        reservations.create("owner",new Requests.ReservationInput(jdbc.queryForObject("select id from rooms where room_number='102'",Long.class),start,end));
        allocation(4,2).andExpect(jsonPath("$.types.length()").value(1)).andExpect(jsonPath("$.types[0].type").value("Suite"));
    }
    @Test void everyRoomNeedsOneAdultAndGuestCountsAreValidated() throws Exception {
        rooms.save(null,new Requests.RoomInput(hotelId,"102","Doble",80,true));
        allocation(1,3).andExpect(jsonPath("$.feasible").value(false))
            .andExpect(jsonPath("$.message").value("Cada habitación necesita al menos un adulto: 1 adulto no puede ocupar las 2 habitaciones necesarias para 4 huéspedes."));
        allocation(2,2).andExpect(jsonPath("$.feasible").value(true)).andExpect(jsonPath("$.types[0].available").value(2));
        for(String query:List.of("adults=0&children=0","adults=2&children=-1","adults=21&children=0"))
            mvc.perform(get("/api/rooms/allocation?hotelId="+hotelId+"&startDate="+start+"&endDate="+end+"&"+query)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/rooms/allocation?hotelId="+hotelId+"&startDate="+end+"&endDate="+start+"&adults=2&children=0")).andExpect(status().isBadRequest());
    }
    @Test void allocationNeedsTheRoomFreeDuringTheWholeStay() throws Exception {
        reservations.create("owner",new Requests.ReservationInput(roomId,start.plusDays(1),end));
        allocation(2,0).andExpect(jsonPath("$.availableRooms").value(0)).andExpect(jsonPath("$.feasible").value(false))
            .andExpect(jsonPath("$.message").value("No hay habitaciones disponibles para las fechas seleccionadas."));
        allocation(end,end.plusDays(1),2,0).andExpect(jsonPath("$.availableRooms").value(1)).andExpect(jsonPath("$.feasible").value(true));
    }
    @Test void eachGroupBooksOneUnitOfItsTypeWithItsOwnGuests() throws Exception {
        Long suite=rooms.save(null,new Requests.RoomInput(hotelId,"201","Suite",200,true)).id();
        var session=login("owner","Owner-test-123");
        createGroup(session,guests(List.of(group("Doble",2,0),group("Suite",2,2)))).andExpect(status().isCreated()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].roomId").value(roomId)).andExpect(jsonPath("$[0].adults").value(2)).andExpect(jsonPath("$[0].children").value(0))
            .andExpect(jsonPath("$[0].totalPrice").value(160)).andExpect(jsonPath("$[1].roomId").value(suite))
            .andExpect(jsonPath("$[1].adults").value(2)).andExpect(jsonPath("$[1].children").value(2)).andExpect(jsonPath("$[1].totalPrice").value(400));
        assertThat(jdbc.queryForObject("select sum(adults+children) from reservations",Integer.class)).isEqualTo(6);
        allocation(2,0).andExpect(jsonPath("$.availableRooms").value(0)).andExpect(jsonPath("$.types.length()").value(0));
        createGroup(session,guests(List.of(group("Doble",2,0)))).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isEqualTo(2);
    }
    @Test void twoGroupsOfTheSameTypeNeedTwoFreeUnits() throws Exception {
        var session=login("owner","Owner-test-123");
        // Un solo "Doble" libre: dos grupos del mismo tipo no caben.
        createGroup(session,guests(List.of(group("Doble",2,0),group("Doble",1,0)))).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
        rooms.save(null,new Requests.RoomInput(hotelId,"102","Doble",90,true));
        createGroup(session,guests(List.of(group("Doble",2,0),group("Doble",1,0)))).andExpect(status().isCreated())
            .andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0].roomNumber").value("101"))
            .andExpect(jsonPath("$[1].roomNumber").value("102")).andExpect(jsonPath("$[1].nightlyPrice").value(90));
    }
    @Test void groupReservationRejectsInvalidGuestsTypesAndOccupiedUnits() throws Exception {
        var session=login("owner","Owner-test-123");
        for(var request:List.of(guests(List.of(group("Doble",0,2))),guests(List.of(group("Doble",2,-1))),guests(List.of()),
                guests(List.of(group("Doble",3,0))),guests(List.of(group("Inexistente",2,0))),guests(List.of(group("",2,0)))))
            createGroup(session,request).andExpect(status().isBadRequest());
        createGroup(new MockHttpSession(),guests(List.of(group("Doble",2,0)))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/reservations/group").session(session).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(guests(List.of(group("Doble",2,0)))))).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
        // La única unidad del tipo ya está reservada: el tipo deja de poder elegirse.
        reservations.create("other",input());
        createGroup(session,guests(List.of(group("Doble",2,0)))).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isEqualTo(1);
    }
    @Test void groupReservationRequestLimitsAreValidatedBeforeWriting() throws Exception {
        var session=login("owner","Owner-test-123");
        var tooManyRooms=new ArrayList<Requests.GroupRoomInput>();
        for(int index=0;index<21;index++)tooManyRooms.add(group("Doble",1,0));
        var invalid=List.of(
            new Requests.GroupReservationInput(0L,List.of(group("Doble",1,0)),start,end),
            new Requests.GroupReservationInput(hotelId,null,start,end),
            new Requests.GroupReservationInput(hotelId,List.of(),start,end),
            new Requests.GroupReservationInput(hotelId,tooManyRooms,start,end),
            new Requests.GroupReservationInput(hotelId,List.of(new Requests.GroupRoomInput("Doble",null,0)),start,end),
            new Requests.GroupReservationInput(hotelId,List.of(group("Doble",21,0)),start,end),
            new Requests.GroupReservationInput(hotelId,List.of(new Requests.GroupRoomInput("Doble",1,null)),start,end),
            new Requests.GroupReservationInput(hotelId,List.of(group("Doble",1,21)),start,end),
            new Requests.GroupReservationInput(hotelId,Arrays.asList((Requests.GroupRoomInput)null),start,end),
            new Requests.GroupReservationInput(hotelId,List.of(group("Doble",1,0)),null,end),
            new Requests.GroupReservationInput(hotelId,List.of(group("Doble",1,0)),start,null));
        for(var request:invalid)createGroup(session,request).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
    }
    @Test void groupReservationRejectsInvalidStayWindowsWithoutWriting() throws Exception {
        var session=login("owner","Owner-test-123");var today=RoomServiceImp.today();
        for(var request:List.of(
                new Requests.GroupReservationInput(hotelId,List.of(group("Doble",1,0)),today.minusDays(1),today),
                new Requests.GroupReservationInput(hotelId,List.of(group("Doble",1,0)),start,start),
                new Requests.GroupReservationInput(hotelId,List.of(group("Doble",1,0)),end,start),
                new Requests.GroupReservationInput(hotelId,List.of(group("Doble",1,0)),start,start.plusDays(366))))
            createGroup(session,request).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
    }
    @Test void groupReservationIsAtomicWhenALaterGroupIsInvalid() throws Exception {
        var session=login("owner","Owner-test-123");
        createGroup(session,guests(List.of(group("Doble",2,0),group("Inexistente",1,0))))
            .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
    }
    @Test void twoConcurrentGroupRequestsProduceExactlyOneBooking() throws Exception {
        var request=guests(List.of(group("Doble",2,0)));
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch ready=new CountDownLatch(2),go=new CountDownLatch(1);
        Callable<Integer> task=()->{ready.countDown();if(!go.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Barrier timed out");try{reservations.createGroup("owner",request);return 201;}catch(ApiException e){return e.getStatus().value();}};
        try {var first=pool.submit(task);var second=pool.submit(task);assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();go.countDown();
            assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);}
        finally {pool.shutdownNow();}
        assertThat(jdbc.queryForObject("select count(*) from reservations where status='CONFIRMED'",Integer.class)).isEqualTo(1);
    }
}
