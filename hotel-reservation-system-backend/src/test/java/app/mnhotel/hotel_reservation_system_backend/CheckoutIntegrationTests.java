package app.mnhotel.hotel_reservation_system_backend;

import app.mnhotel.hotel_reservation_system_backend.checkout.*;
import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

/** Deterministic provider DOUBLE. These tests do not claim a Stripe sandbox transaction occurred. */
@SpringBootTest(properties={"HOTEL_CHECKOUT_ENABLED=true","STRIPE_PUBLISHABLE_KEY=pk_test_synthetic",
    "STRIPE_SECRET_KEY=sk_test_synthetic","STRIPE_WEBHOOK_SECRET=whsec_synthetic","HOTEL_CHECKOUT_RECOVERY_MS=3600000"})
@AutoConfigureMockMvc
class CheckoutIntegrationTests {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
    @Autowired AuthServiceImp auth; @Autowired HotelServiceImp hotels; @Autowired RoomServiceImp rooms;
    @Autowired CheckoutService service; @Autowired CheckoutStore store; @Autowired ReservationServiceImp bookings;
    @Autowired SavedMethods savedMethods;
    @MockBean PaymentGateway gateway;
    final Map<String,PaymentGateway.Intent> intents=new ConcurrentHashMap<>();
    final AtomicInteger captures=new AtomicInteger();
    final Map<String,PaymentGateway.Card> cards=new ConcurrentHashMap<>();
    Long room;
    final LocalDate start=RoomServiceImp.today().plusDays(5);
    void clear(){assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("hotel_test");
        jdbc.execute("truncate payments,reviews,reservations,rooms,hotels,users restart identity cascade");}
    @BeforeEach void setup(){
        clear();intents.clear();cards.clear();captures.set(0);
        auth.register(new Requests.Register("buyer","buyer@example.invalid","Synthetic-pass-123"));
        auth.register(new Requests.Register("other","other@example.invalid","Synthetic-pass-123"));
        var hotel=hotels.save(null,new Requests.HotelInput("Checkout fixture","Panamá","Synthetic",null,true));
        room=rooms.save(null,new Requests.RoomInput(hotel.id(),"101","Doble",80,true)).id();
        when(gateway.create(any())).thenAnswer(a->{var c=a.getArgument(0,CheckoutStore.Checkout.class);
            return intents.computeIfAbsent("pi_"+c.id().toString().replace("-",""),k->new PaymentGateway.Intent(k,"requires_payment_method",c.amount(),"usd",false,c.id().toString(),"synthetic_client_secret",false,0,c.customerId(),c.providerMethodId()));});
        when(gateway.retrieve(anyString())).thenAnswer(a->intents.get(a.getArgument(0,String.class)));
        when(gateway.capture(anyString(),anyString())).thenAnswer(a->{synchronized(intents){
            var existing=intents.get(a.getArgument(0,String.class));if(existing.status().equals("succeeded"))return existing;
            captures.incrementAndGet();return state(a.getArgument(0),"succeeded",false);}});
        when(gateway.cancel(anyString(),anyString())).thenAnswer(a->state(a.getArgument(0),"canceled",intents.get(a.getArgument(0,String.class)).failed()));
        when(gateway.refund(anyString(),anyString())).thenAnswer(a->new PaymentGateway.RefundResult("re_synthetic","succeeded",intents.get(a.getArgument(0,String.class)).amount(),a.getArgument(0),"usd"));
        when(gateway.createCustomer(any())).thenAnswer(a->"cus_"+a.getArgument(0,UUID.class).toString().replace("-",""));
        when(gateway.card(anyString())).thenAnswer(a->cards.get(a.getArgument(0,String.class)));
    }
    @AfterEach void cleanup(){clear();}
    PaymentGateway.Intent state(String id,String status,boolean failed){var p=intents.get(id);var next=new PaymentGateway.Intent(id,status,p.amount(),p.currency(),p.live(),p.checkoutId(),p.clientSecret(),failed,status.equals("succeeded")?p.amount():0,p.customerId(),p.methodId());intents.put(id,next);return next;}
    Requests.ReservationInput input(){return new Requests.ReservationInput(room,start,start.plusDays(2));}
    CheckoutStore.Checkout begin(){return store.get(service.begin("buyer",UUID.randomUUID().toString(),input()).id());}
    MockHttpSession login(String name)throws Exception{return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("username",name,"password","Synthetic-pass-123")))).andExpect(status().isOk()).andReturn().getRequest().getSession(false);}
    @Test void initialCheckoutCapturesThenCreatesExactlyOneReservation(){
        var c=begin();assertThat(c.stage()).isEqualTo("PENDING");assertThat(c.amount()).isEqualTo(16000);
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
        state(c.intentId(),"requires_capture",false);
        var result=service.detail(c.id(),"buyer");assertThat(result.stage()).isEqualTo("SUCCEEDED");assertThat(result.clientSecret()).isNull();
        service.detail(c.id(),"buyer");assertThat(captures).hasValue(1);
        assertThat(jdbc.queryForObject("select total_price from reservations",Long.class)).isEqualTo(160L);
        assertThat(jdbc.queryForObject("select count(*) from payments",Integer.class)).isZero();
    }
    @Test void sameKeyRetriesReuseIntentAndDifferentInputConflicts(){
        String key=UUID.randomUUID().toString();var a=service.begin("buyer",key,input());var b=service.begin("buyer",key,input());
        assertThat(a.id()).isEqualTo(b.id());assertThat(intents).hasSize(1);
        assertThatThrownBy(()->service.begin("buyer",key,new Requests.ReservationInput(room,start,start.plusDays(3)))).isInstanceOf(ApiException.class);
    }
    @Test void declinedPaymentReleasesInventoryAndNeverConfirms(){
        var c=begin();state(c.intentId(),"requires_payment_method",true);
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();assertThat(captures).hasValue(0);
        assertThat(rooms.list(hotelId(),start,start.plusDays(2),false).get(0).available()).isTrue();
    }
    long hotelId(){return jdbc.queryForObject("select hotel_id from rooms where id=?",Long.class,room);}
    @Test void expiryCancelsLateAuthorizationAndAllowsAnotherCheckout(){
        var c=begin();jdbc.update("update checkouts set expires_at=now()-interval '1 second' where id=?",c.id());
        var newer=begin();state(c.intentId(),"requires_capture",false);
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("EXPIRED");assertThat(captures).hasValue(0);
        assertThat(store.get(newer.id()).stage()).isEqualTo("PENDING");
    }
    @Test void pendingCancellationIsIdempotent(){var c=begin();assertThat(service.cancel(c.id(),"buyer").stage()).isEqualTo("CANCELLED");
        service.cancel(c.id(),"buyer");assertThat(captures).hasValue(0);}
    @Test void captureTimeoutRecoversWithoutSecondCapture(){
        var c=begin();state(c.intentId(),"requires_capture",false);
        doAnswer(a->{state(c.intentId(),"succeeded",false);throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Synthetic timeout");}).when(gateway).capture(anyString(),anyString());
        assertThatThrownBy(()->service.detail(c.id(),"buyer")).isInstanceOf(ApiException.class);
        assertThat(store.get(c.id()).stage()).isEqualTo("FINALIZING");
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("SUCCEEDED");
        verify(gateway,times(1)).capture(anyString(),anyString());
    }
    @Test void paidCancellationPersistsRefundAndRecoveryCompletesIt(){
        var c=begin();state(c.intentId(),"requires_capture",false);var paid=service.detail(c.id(),"buyer");
        assertThatThrownBy(()->store.cancelReservation(paid.reservationId(),"other",false)).isInstanceOf(ApiException.class);
        assertThat(store.cancelReservation(paid.reservationId(),"buyer",false).status()).isEqualTo("CANCELLED");
        assertThat(store.get(c.id()).stage()).isEqualTo("REFUND_PENDING");
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("REFUNDED");
        store.cancelReservation(paid.reservationId(),"buyer",false);service.detail(c.id(),"buyer");
        verify(gateway,times(1)).refund(anyString(),anyString());
    }
    @Test void refundPendingAndFailureAreNotReportedAsSuccess(){
        var c=begin();state(c.intentId(),"requires_capture",false);var paid=service.detail(c.id(),"buyer");
        store.cancelReservation(paid.reservationId(),"buyer",false);
        doReturn(new PaymentGateway.RefundResult("re_synthetic","pending",c.amount(),c.intentId(),"usd")).when(gateway).refund(anyString(),anyString());
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("REFUND_PENDING");
        when(gateway.retrieveRefund("re_synthetic")).thenReturn(new PaymentGateway.RefundResult("re_synthetic","failed",c.amount(),c.intentId(),"usd"));
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("REFUND_FAILED");
    }
    @Test void liveOrMismatchedPaymentCannotConfirm(){
        var c=begin();var p=intents.get(c.intentId());intents.put(p.id(),new PaymentGateway.Intent(p.id(),"succeeded",p.amount()+1,"usd",true,p.checkoutId(),null,false,p.amount(),p.customerId(),p.methodId()));
        assertThatThrownBy(()->service.detail(c.id(),"buyer")).isInstanceOf(ApiException.class);
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
    }
    @Test void unknownCreationResultRetriesOriginalKey(){
        var calls=new AtomicInteger();
        doAnswer(a->{var c=a.getArgument(0,CheckoutStore.Checkout.class);
            var p=intents.computeIfAbsent("pi_"+c.id().toString().replace("-",""),k->new PaymentGateway.Intent(k,"requires_payment_method",c.amount(),"usd",false,c.id().toString(),"synthetic_client_secret",false,0,c.customerId(),c.providerMethodId()));
            if(calls.incrementAndGet()==1)throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Synthetic timeout");return p;
        }).when(gateway).create(any());
        String key=UUID.randomUUID().toString();assertThatThrownBy(()->service.begin("buyer",key,input())).isInstanceOf(ApiException.class);
        assertThat(jdbc.queryForObject("select count(*) from checkouts",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
        assertThat(service.begin("buyer",key,input()).stage()).isEqualTo("PENDING");assertThat(intents).hasSize(1);
    }
    @Test void partialCaptureCannotBeReportedAsFullyPaid(){
        var c=begin();store.authorize(c.id());var p=intents.get(c.intentId());
        intents.put(p.id(),new PaymentGateway.Intent(p.id(),"succeeded",p.amount(),"usd",false,p.checkoutId(),null,false,p.amount()/2,p.customerId(),p.methodId()));
        assertThatThrownBy(()->service.detail(c.id(),"buyer")).isInstanceOf(ApiException.class);
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
    }
    @Test void definitiveCaptureFailureReleasesInventory(){
        var c=begin();state(c.intentId(),"requires_capture",false);
        doAnswer(a->state(c.intentId(),"requires_payment_method",true)).when(gateway).capture(anyString(),anyString());
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
        assertThat(begin().stage()).isEqualTo("PENDING");
    }
    @Test void simultaneousFinalizationCreatesOneReservation()throws Exception{
        var c=begin();state(c.intentId(),"requires_capture",false);
        var pool=Executors.newFixedThreadPool(2);var barrier=new CyclicBarrier(2);
        try {Callable<CheckoutService.View> sync=()->{barrier.await();return service.detail(c.id(),"buyer");};
            var a=pool.submit(sync);var b=pool.submit(sync);a.get(20,TimeUnit.SECONDS);b.get(20,TimeUnit.SECONDS);
        }finally{pool.shutdownNow();}
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isEqualTo(1);
        assertThat(store.get(c.id()).paymentStatus()).isEqualTo("succeeded");assertThat(captures).hasValue(1);
    }
    @Test void authenticationOwnershipCsrfAndLegacyBypassAreEnforced()throws Exception{
        var buyer=login("buyer");var other=login("other");var c=begin();
        mvc.perform(post("/api/checkouts").with(csrf()).header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input()))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/checkouts/"+c.id()+"/sync").session(other).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/checkouts/"+c.id()+"/cancel").session(other).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/checkouts/"+c.id()+"/sync").session(buyer)).andExpect(status().isForbidden());
        mvc.perform(post("/api/checkouts/"+c.id()+"/cancel").session(buyer)).andExpect(status().isForbidden());
        mvc.perform(post("/api/checkouts").session(buyer).header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input()))).andExpect(status().isForbidden());
        mvc.perform(post("/api/reservations").session(buyer).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input()))).andExpect(status().isConflict());
        assertThat(store.get(c.id()).stage()).isEqualTo("PENDING");
    }
    @Test void concurrentOverlappingCheckoutsProduceOnlyOneHold()throws Exception{
        var pool=Executors.newFixedThreadPool(2);var barrier=new CyclicBarrier(2);
        try {Callable<Boolean> attempt=()->{barrier.await();try{service.begin("buyer",UUID.randomUUID().toString(),input());return true;}catch(ApiException e){assertThat(e.getStatus().value()).isEqualTo(409);return false;}};
            var a=pool.submit(attempt);var b=pool.submit(attempt);assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }finally{pool.shutdownNow();}
        assertThat(jdbc.queryForObject("select count(*) from checkouts",Integer.class)).isEqualTo(1);
    }
    @Test void legacyBookingCannotStealHeldInventory(){var c=begin();assertThatThrownBy(()->bookings.create("other",input())).isInstanceOf(ApiException.class);
        service.cancel(c.id(),"buyer");assertThat(bookings.create("other",input()).status()).isEqualTo("CONFIRMED");}
    @Test void finalizingRetainsInventoryAfterDeadlineAndKeepsAgreedPrice(){
        var c=begin();state(c.intentId(),"requires_capture",false);store.authorize(c.id());
        jdbc.update("update checkouts set expires_at=now()-interval '1 minute' where id=?",c.id());
        jdbc.update("update rooms set price_per_night=90 where id=?",room);
        assertThatThrownBy(()->begin()).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.cancel(c.id(),"buyer")).isInstanceOf(ApiException.class);
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("SUCCEEDED");
        assertThat(jdbc.queryForObject("select nightly_price from reservations",Integer.class)).isEqualTo(80);
    }
    @Test void unexpectedLateChargeIsRefundedWithoutReservation(){
        var c=begin();jdbc.update("update checkouts set expires_at=now()-interval '1 second' where id=?",c.id());
        state(c.intentId(),"succeeded",false);assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("REFUNDED");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();verify(gateway).refund(eq(c.intentId()),eq(c.id()+":refund"));
    }
    @Test void veryOldUnknownCreationIsNotRecreated(){
        var c=store.begin("buyer",UUID.randomUUID().toString(),input());
        jdbc.update("update checkouts set expires_at=now()-interval '25 hours' where id=?",c.id());
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("EXPIRED");verify(gateway,never()).create(any());
    }
    @Test void repeatedAndOutOfOrderNotificationsUseCurrentProviderState(){
        var c=begin();state(c.intentId(),"requires_capture",false);when(gateway.verifyWebhook(anyString(),anyString())).thenReturn(c.intentId());
        service.webhook("synthetic authorization event","synthetic signature");
        service.webhook("synthetic older event","synthetic signature");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isEqualTo(1);assertThat(captures).hasValue(1);
    }
    UUID saveFirstCard(){
        var view=service.begin("buyer",UUID.randomUUID().toString(),new CheckoutInput(room,start,start.plusDays(2),null,true));
        var c=store.get(view.id());String method="pm_synthetic_saved";
        cards.put(method,new PaymentGateway.Card(method,c.customerId(),false,"visa","4242",12,2099));
        var p=intents.get(c.intentId());
        intents.put(p.id(),new PaymentGateway.Intent(p.id(),"requires_capture",p.amount(),"usd",false,p.checkoutId(),p.clientSecret(),false,0,c.customerId(),method));
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("SUCCEEDED");
        return savedMethods.mine("buyer").get(0).id();
    }
    CheckoutInput recurring(UUID method){return new CheckoutInput(room,start.plusDays(4),start.plusDays(6),method,false);}
    @Test void explicitConsentSavesAuthorizedReferenceAndReusesWithoutCardInput(){
        UUID method=saveFirstCard();
        assertThat(savedMethods.mine("buyer").get(0).lastFour()).isEqualTo("4242");
        assertThat(jdbc.queryForObject("select consent_version from saved_payment_methods",String.class)).isEqualTo("hu01-on-session-v1");
        var next=service.begin("buyer",UUID.randomUUID().toString(),recurring(method));
        assertThat(next.savedMethod()).isTrue();var c=store.get(next.id());
        assertThat(c.providerMethodId()).isEqualTo("pm_synthetic_saved");state(c.intentId(),"requires_capture",false);
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("SUCCEEDED");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isEqualTo(2);
        verify(gateway,times(1)).createCustomer(any());
    }
    @Test void noConsentDoesNotCreateCustomerOrSaveMethod(){
        var c=begin();state(c.intentId(),"requires_capture",false);service.detail(c.id(),"buyer");
        assertThat(savedMethods.mine("buyer")).isEmpty();verify(gateway,never()).createCustomer(any());
        assertThat(jdbc.queryForObject("select count(*) from payment_profiles",Integer.class)).isZero();
    }
    @Test void consentChoiceCannotChangeWithSameIdempotencyKey(){
        String key=UUID.randomUUID().toString();service.begin("buyer",key,input());
        assertThatThrownBy(()->service.begin("buyer",key,new CheckoutInput(room,start,start.plusDays(2),null,true))).isInstanceOf(ApiException.class);
    }
    @Test void absentAndForeignSavedMethodsCannotCreateHold()throws Exception{
        UUID method=saveFirstCard();
        assertThatThrownBy(()->service.begin("other",UUID.randomUUID().toString(),recurring(method))).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.begin("buyer",UUID.randomUUID().toString(),recurring(UUID.randomUUID()))).isInstanceOf(ApiException.class);
        assertThat(savedMethods.mine("other")).isEmpty();
        var other=login("other");
        mvc.perform(post("/api/checkouts").session(other).with(csrf()).header("Idempotency-Key",UUID.randomUUID().toString())
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(recurring(method)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/payment-methods/"+method+"/revoke").session(other).with(csrf())).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("select count(*) from checkouts",Integer.class)).isEqualTo(1);
    }
    @Test void revokedAndExpiredMethodsDoNotReserveInventory(){
        UUID method=saveFirstCard();var card=cards.get("pm_synthetic_saved");
        cards.put(card.id(),new PaymentGateway.Card(card.id(),card.customerId(),false,card.brand(),card.lastFour(),1,2000));
        assertThatThrownBy(()->service.begin("buyer",UUID.randomUUID().toString(),recurring(method))).isInstanceOf(ApiException.class);
        assertThat(jdbc.queryForObject("select count(*) from checkouts where stage='FAILED'",Integer.class)).isEqualTo(1);
        savedMethods.revoke("buyer",method);assertThat(savedMethods.mine("buyer")).isEmpty();
        assertThatThrownBy(()->service.begin("buyer",UUID.randomUUID().toString(),recurring(method))).isInstanceOf(ApiException.class);
    }
    @Test void revocationPersistsEvenWhenProviderIsUnavailableAndRequiresCsrf()throws Exception{
        UUID method=saveFirstCard();var buyer=login("buyer");
        mvc.perform(post("/api/payment-methods/"+method+"/revoke").session(buyer)).andExpect(status().isForbidden());
        assertThat(savedMethods.mine("buyer")).hasSize(1);
        doThrow(new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Synthetic outage")).when(gateway).detach(anyString(),anyString());
        mvc.perform(post("/api/payment-methods/"+method+"/revoke").session(buyer).with(csrf())).andExpect(status().isOk());
        assertThat(savedMethods.mine("buyer")).isEmpty();
        assertThat(jdbc.queryForObject("select detach_pending from saved_payment_methods",Boolean.class)).isTrue();
    }
    @Test void mismatchedProviderOwnerIsRejectedBeforeIntentCreation(){
        UUID method=saveFirstCard();var card=cards.get("pm_synthetic_saved");
        cards.put(card.id(),new PaymentGateway.Card(card.id(),"cus_someone_else",false,card.brand(),card.lastFour(),12,2099));
        int before=intents.size();assertThatThrownBy(()->service.begin("buyer",UUID.randomUUID().toString(),recurring(method))).isInstanceOf(ApiException.class);
        assertThat(intents).hasSize(before);
    }
    @Test void recurringDeclineDoesNotConfirmOrBlockNewAttempt(){
        UUID method=saveFirstCard();var next=service.begin("buyer",UUID.randomUUID().toString(),recurring(method));
        var c=store.get(next.id());state(c.intentId(),"requires_payment_method",true);
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isEqualTo(1);
        assertThat(service.begin("buyer",UUID.randomUUID().toString(),recurring(method)).stage()).isEqualTo("PENDING");
    }
    @Test void twoConcurrentRecurringRequestsCannotHoldSameInventory()throws Exception{
        UUID method=saveFirstCard();var pool=Executors.newFixedThreadPool(2);var barrier=new CyclicBarrier(2);
        try {Callable<Boolean> attempt=()->{barrier.await();try{service.begin("buyer",UUID.randomUUID().toString(),recurring(method));return true;}catch(ApiException e){assertThat(e.getStatus().value()).isEqualTo(409);return false;}};
            var a=pool.submit(attempt);var b=pool.submit(attempt);assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }finally{pool.shutdownNow();}
        assertThat(jdbc.queryForObject("select count(*) from checkouts where stage='PENDING'",Integer.class)).isEqualTo(1);
    }
    @Test void failedInitialPaymentNeverActivatesConsentedMethod(){
        var view=service.begin("buyer",UUID.randomUUID().toString(),new CheckoutInput(room,start,start.plusDays(2),null,true));
        var c=store.get(view.id());state(c.intentId(),"requires_payment_method",true);
        assertThat(service.detail(c.id(),"buyer").stage()).isEqualTo("FAILED");
        assertThat(savedMethods.mine("buyer")).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from reservations",Integer.class)).isZero();
    }
}
