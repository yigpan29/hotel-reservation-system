package app.mnhotel.hotel_reservation_system_backend;

import app.mnhotel.hotel_reservation_system_backend.checkout.*;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

/** Real isolated PostgreSQL; deterministic provider double, never evidence of a real Stripe payment. */
@SpringBootTest(properties={"HOTEL_CHECKOUT_ENABLED=true","STRIPE_PUBLISHABLE_KEY=pk_test_synthetic",
    "STRIPE_SECRET_KEY=sk_test_synthetic","STRIPE_WEBHOOK_SECRET=whsec_synthetic","HOTEL_CHECKOUT_RECOVERY_MS=3600000"})
@AutoConfigureMockMvc
class GroupCheckoutIntegrationTests {
    @Autowired CheckoutStore store; @Autowired CheckoutService service; @Autowired SavedMethods saved;
    @Autowired AuthServiceImp users; @Autowired HotelServiceImp hotels; @Autowired RoomServiceImp rooms;
    @Autowired JdbcTemplate jdbc; @Autowired MockMvc mvc; @Autowired ObjectMapper json;
    @MockBean PaymentGateway gateway;
    final Map<String,PaymentGateway.Intent> intents=new ConcurrentHashMap<>();
    final Map<String,PaymentGateway.RefundResult> refunds=new ConcurrentHashMap<>();
    final Map<String,PaymentGateway.Card> cards=new ConcurrentHashMap<>();
    final AtomicInteger captures=new AtomicInteger(),refundCalls=new AtomicInteger();
    Long hotel,first,second;
    final LocalDate start=RoomServiceImp.today().plusDays(30);
    void clear(){assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("hotel_test");jdbc.execute("truncate payments,reviews,reservations,rooms,hotels,users restart identity cascade");}
    @BeforeEach void setup(){
        clear();intents.clear();refunds.clear();cards.clear();captures.set(0);refundCalls.set(0);
        users.register(new Requests.Register("group-buyer","group@example.invalid","Synthetic-group-123"));
        users.register(new Requests.Register("group-other","other@example.invalid","Synthetic-group-123"));
        hotel=hotels.save(null,new Requests.HotelInput("Group hotel","Panamá","Synthetic",null,true)).id();
        first=rooms.save(null,new Requests.RoomInput(hotel,"101","Doble",80,true)).id();
        second=rooms.save(null,new Requests.RoomInput(hotel,"102","Suite",120,true)).id();
        when(gateway.create(any())).thenAnswer(a->{var c=a.getArgument(0,CheckoutStore.Checkout.class);String id="pi_"+c.id().toString().replace("-","");return intents.computeIfAbsent(id,k->new PaymentGateway.Intent(k,"requires_payment_method",c.amount(),"usd",false,c.id().toString(),"synthetic_secret",false,0,c.customerId(),c.providerMethodId()));});
        when(gateway.retrieve(anyString())).thenAnswer(a->intents.get(a.getArgument(0,String.class)));
        when(gateway.capture(anyString(),anyString())).thenAnswer(a->{synchronized(intents){var p=intents.get(a.getArgument(0,String.class));if(!p.status().equals("succeeded")){captures.incrementAndGet();return state(p.id(),"succeeded",false);}return p;}});
        when(gateway.cancel(anyString(),anyString())).thenAnswer(a->state(a.getArgument(0),"canceled",intents.get(a.getArgument(0,String.class)).failed()));
        when(gateway.refund(anyString(),anyString(),anyLong())).thenAnswer(a->refund(a.getArgument(0),a.getArgument(1),a.getArgument(2,Long.class)));
        when(gateway.refund(anyString(),anyString())).thenAnswer(a->refund(a.getArgument(0),a.getArgument(1),intents.get(a.getArgument(0,String.class)).amount()));
        when(gateway.retrieveRefund(anyString())).thenAnswer(a->refunds.values().stream().filter(r->r.id().equals(a.getArgument(0))).findFirst().orElseThrow());
        when(gateway.createCustomer(any())).thenAnswer(a->"cus_"+a.getArgument(0,UUID.class).toString().replace("-",""));
        when(gateway.card(anyString())).thenAnswer(a->cards.get(a.getArgument(0,String.class)));
    }
    @AfterEach void cleanup(){clear();}
    PaymentGateway.RefundResult refund(String intent,String key,long amount){return refunds.computeIfAbsent(key,k->{refundCalls.incrementAndGet();return new PaymentGateway.RefundResult("re_"+UUID.randomUUID().toString().replace("-",""),"succeeded",amount,intent,"usd");});}
    PaymentGateway.Intent state(String id,String status,boolean failed){var p=intents.get(id);var updated=new PaymentGateway.Intent(id,status,p.amount(),p.currency(),p.live(),p.checkoutId(),p.clientSecret(),failed,status.equals("succeeded")?p.amount():0,p.customerId(),p.methodId());intents.put(id,updated);return updated;}
    GroupCheckoutInput input(int offset,UUID method,boolean save){return new GroupCheckoutInput(hotel,List.of(new Requests.GroupRoomInput("Doble",2,0),new Requests.GroupRoomInput("Suite",2,1)),start.plusDays(offset),start.plusDays(offset+2),method,save);}
    CheckoutStore.Checkout begin(){return store.get(service.beginGroup("group-buyer",UUID.randomUUID().toString(),input(0,null,false)).id());}
    CheckoutService.View pay(CheckoutStore.Checkout c){state(c.intentId(),"requires_capture",false);return service.detail(c.id(),"group-buyer");}
    MockHttpSession login(String name)throws Exception{return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("username",name,"password","Synthetic-group-123")))).andExpect(status().isOk()).andReturn().getRequest().getSession(false);}

    @Test void oneIntentCapturesAndConfirmsAllWithFrozenPricesTypesAndGuests(){
        var c=begin();assertThat(c.amount()).isEqualTo(40000);assertThat(intents).hasSize(1);
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
        jdbc.update("update rooms set price_per_night=999 where hotel_id=?",hotel);
        var paid=pay(c);assertThat(paid.stage()).isEqualTo("SUCCEEDED");assertThat(paid.items()).hasSize(2).allSatisfy(i->assertThat(i.reservationId()).isNotNull());
        assertThat(jdbc.queryForList("select total_price from reservations order by room_id",Long.class)).containsExactly(160L,240L);
        assertThat(jdbc.queryForList("select room_type from reservations order by room_id",String.class)).containsExactly("Doble","Suite");
        assertThat(jdbc.queryForList("select adults from reservations",Integer.class)).containsOnly(2);
        assertThat(jdbc.queryForObject("select sum(children) from reservations",Integer.class)).isEqualTo(1);
        service.detail(c.id(),"group-buyer");assertThat(captures).hasValue(1);
    }
    @Test void retryReusesOrderButChangedGuestsAndSingleEndpointCannotReuseItsKey(){
        String key=UUID.randomUUID().toString();var a=service.beginGroup("group-buyer",key,input(0,null,false));
        assertThat(service.beginGroup("group-buyer",key,input(0,null,false)).id()).isEqualTo(a.id());
        assertThatThrownBy(()->service.beginGroup("group-buyer",key,input(1,null,false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.begin("group-buyer",key,new Requests.ReservationInput(first,start,start.plusDays(2)))).isInstanceOf(ApiException.class);
        assertThat(intents).hasSize(1);
    }
    @Test void missingOneUnitLeavesNoPartialHoldAndNoProviderIntent(){
        jdbc.update("update rooms set active=false where id=?",second);
        assertThatThrownBy(this::begin).isInstanceOf(ApiException.class);
        assertThat(jdbc.queryForObject("select count(*) from checkouts",Integer.class)).isZero();assertThat(intents).isEmpty();
        assertThat(rooms.list(hotel,start,start.plusDays(2),false).stream().filter(r->r.id().equals(first)).findFirst().orElseThrow().available()).isTrue();
    }
    @Test void allHoldsAppearInAllocationAndCalendarAndDeclineReleasesThem(){
        var c=begin();assertThat(rooms.allocation(hotel,start,start.plusDays(2),2,0).availableRooms()).isZero();
        assertThat(rooms.occupancy(second,start,start.plusDays(3),false).occupied()).hasSize(1);
        state(c.intentId(),"requires_payment_method",true);assertThat(service.detail(c.id(),"group-buyer").stage()).isEqualTo("FAILED");
        assertThat(rooms.allocation(hotel,start,start.plusDays(2),2,0).availableRooms()).isEqualTo(2);
        assertThat(rooms.occupancy(second,start,start.plusDays(3),false).occupied()).isEmpty();
    }
    @Test void invalidRoomBeforeCaptureCancelsAllWithoutCharging(){
        var c=begin();jdbc.update("update rooms set capacity=2 where id=?",second);
        state(c.intentId(),"requires_capture",false);assertThat(service.detail(c.id(),"group-buyer").stage()).isEqualTo("CANCELLED");
        assertThat(captures).hasValue(0);assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
    }
    @Test void invalidRoomAfterCaptureRefundsWholePaymentWithoutPartialBookings(){
        var c=begin();state(c.intentId(),"requires_capture",false);
        doAnswer(a->{var p=state(c.intentId(),"succeeded",false);jdbc.update("update rooms set active=false where id=?",second);return p;}).when(gateway).capture(anyString(),anyString());
        assertThat(service.detail(c.id(),"group-buyer").stage()).isEqualTo("REFUNDED");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
        assertThat(refunds.values()).singleElement().satisfies(r->assertThat(r.amount()).isEqualTo(40000));
    }
    @Test void onlyCancelledRoomIsRefundedAndRepeatedCancellationIsIdempotent(){
        var c=begin();var paid=pay(c);long id=paid.items().get(0).reservationId();
        store.cancelReservation(id,"group-buyer",false);var partial=service.detail(c.id(),"group-buyer");
        assertThat(partial.stage()).isEqualTo("SUCCEEDED");assertThat(partial.paymentStatus()).isEqualTo("partially_refunded");
        assertThat(refunds.values()).singleElement().satisfies(r->assertThat(r.amount()).isEqualTo(16000));
        assertThat(jdbc.queryForObject("select status from reservations where id=?",String.class,paid.items().get(1).reservationId())).isEqualTo("CONFIRMED");
        store.cancelReservation(id,"group-buyer",false);service.detail(c.id(),"group-buyer");assertThat(refundCalls).hasValue(1);
        assertThat(store.get(c.id()).paymentStatus()).isEqualTo("partially_refunded");
        store.cancelReservation(paid.items().get(1).reservationId(),"group-buyer",false);
        assertThat(service.detail(c.id(),"group-buyer").stage()).isEqualTo("REFUNDED");assertThat(refunds.values().stream().mapToLong(PaymentGateway.RefundResult::amount).sum()).isEqualTo(40000);
    }
    @Test void refundTimeoutRecoversSameOperationAndWrongAmountIsNotAccepted(){
        var c=begin();var paid=pay(c);store.cancelReservation(paid.items().get(0).reservationId(),"group-buyer",false);
        doAnswer(a->{refund(a.getArgument(0),a.getArgument(1),a.getArgument(2,Long.class));throw new app.mnhotel.hotel_reservation_system_backend.exception.ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Synthetic timeout");}).when(gateway).refund(anyString(),anyString(),anyLong());
        assertThatThrownBy(()->service.detail(c.id(),"group-buyer")).isInstanceOf(ApiException.class);
        assertThat(store.items(c.id()).get(0).refundState()).isEqualTo("PENDING");
        doAnswer(a->refund(a.getArgument(0),a.getArgument(1),a.getArgument(2,Long.class))).when(gateway).refund(anyString(),anyString(),anyLong());
        service.detail(c.id(),"group-buyer");assertThat(refundCalls).hasValue(1);
        store.cancelReservation(paid.items().get(1).reservationId(),"group-buyer",false);
        doReturn(new PaymentGateway.RefundResult("re_wrong","succeeded",1,c.intentId(),"usd")).when(gateway).refund(anyString(),anyString(),anyLong());
        assertThatThrownBy(()->service.detail(c.id(),"group-buyer")).isInstanceOf(ApiException.class);
        assertThat(store.items(c.id()).get(1).refundState()).isEqualTo("PENDING");
    }
    @Test void concurrentOrdersCannotBothHoldTheSameRooms()throws Exception{
        var pool=Executors.newFixedThreadPool(2);var startGate=new CountDownLatch(1);
        try {var futures=new ArrayList<Future<Boolean>>();for(int i=0;i<2;i++)futures.add(pool.submit(()->{startGate.await();try{service.beginGroup("group-buyer",UUID.randomUUID().toString(),input(0,null,false));return true;}catch(app.mnhotel.hotel_reservation_system_backend.exception.ApiException e){return false;}}));startGate.countDown();int successes=0;for(var future:futures)if(future.get(15,TimeUnit.SECONDS))successes++;assertThat(successes).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from checkout_items",Integer.class)).isEqualTo(2);
        } finally {pool.shutdownNow();}
    }
    @Test void concurrentRepeatedCancellationCreatesOneRefund()throws Exception{
        var c=begin();var paid=pay(c);long id=paid.items().get(0).reservationId();var pool=Executors.newFixedThreadPool(2);
        try {var a=pool.submit(()->{store.cancelReservation(id,"group-buyer",false);return service.detail(c.id(),"group-buyer");});var b=pool.submit(()->{store.cancelReservation(id,"group-buyer",false);return service.detail(c.id(),"group-buyer");});a.get(15,TimeUnit.SECONDS);b.get(15,TimeUnit.SECONDS);assertThat(refunds).hasSize(1);assertThat(refunds.values().iterator().next().amount()).isEqualTo(16000);}finally{pool.shutdownNow();}
    }
    @Test void savedMethodWorksForTheWholeOrderWithoutImplicitConsent(){
        var ordinary=begin();assertThat(saved.mine("group-buyer")).isEmpty();service.cancel(ordinary.id(),"group-buyer");
        var c=store.get(service.beginGroup("group-buyer",UUID.randomUUID().toString(),input(0,null,true)).id());var p=intents.get(c.intentId());
        cards.put("pm_saved",new PaymentGateway.Card("pm_saved",p.customerId(),false,"visa","4242",12,2035));
        intents.put(p.id(),new PaymentGateway.Intent(p.id(),"requires_capture",p.amount(),"usd",false,p.checkoutId(),p.clientSecret(),false,0,p.customerId(),"pm_saved"));
        assertThat(service.detail(c.id(),"group-buyer").stage()).isEqualTo("SUCCEEDED");UUID method=saved.mine("group-buyer").get(0).id();
        var next=store.get(service.beginGroup("group-buyer",UUID.randomUUID().toString(),input(3,method,false)).id());
        assertThat(pay(next).items()).hasSize(2);assertThat(captures).hasValue(2);
    }
    @Test void ownershipCsrfAndFreeGroupBypassAreRejected()throws Exception{
        var session=login("group-buyer");
        mvc.perform(put("/api/checkouts/stripe-webhook").session(session)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/checkouts/stripe-webhook").session(session)).andExpect(status().isForbidden());
        String body=json.writeValueAsString(input(0,null,false));
        mvc.perform(post("/api/checkouts/group").session(session).header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/checkouts/group").with(csrf()).header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/reservations/group").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        var c=begin();var other=login("group-other");
        mvc.perform(post("/api/checkouts/"+c.id()+"/sync").session(other).with(csrf())).andExpect(status().isForbidden());
        var paid=pay(c);mvc.perform(post("/api/reservations/"+paid.items().get(1).reservationId()+"/cancel").session(other).with(csrf())).andExpect(status().isForbidden());
    }
}
