package app.mnhotel.hotel_reservation_system_backend;

import app.mnhotel.hotel_reservation_system_backend.dto.Requests;
import app.mnhotel.hotel_reservation_system_backend.service.imp.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import java.nio.file.*;
import javax.imageio.ImageIO;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@SpringBootTest @AutoConfigureMockMvc
class ReservationCertificateTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthServiceImp auth;
    @Autowired HotelServiceImp hotels;
    @Autowired RoomServiceImp rooms;
    @Autowired ReservationServiceImp reservations;
    Long id, room;
    void clear() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("hotel_test");
        jdbc.execute("truncate payments,reviews,reservations,rooms,hotels,users restart identity cascade");
    }
    @BeforeEach void setup() {
        clear();
        auth.register(new Requests.Register("pdf-owner", "pdf@example.invalid", "Synthetic-owner-123"));
        auth.register(new Requests.Register("pdf-other", "other@example.invalid", "Synthetic-other-123"));
        auth.create(new Requests.Register("pdf-admin", "admin@example.invalid", "Synthetic-admin-123"), "ADMIN");
        var hotel = hotels.save(null, new Requests.HotelInput("Hotel Panamá", "Panamá", "Synthetic", null, true)).id();
        room = rooms.save(null, new Requests.RoomInput(hotel, "101", "Doble", 85, true)).id();
        var start = RoomServiceImp.today().plusDays(10);
        id = reservations.create("pdf-owner", new Requests.ReservationInput(room, start, start.plusDays(2))).id();
    }
    @AfterEach void cleanup() { clear(); }
    MockHttpSession login(String user, String password) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"" + user + "\",\"password\":\"" + password + "\"}"))
            .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
    byte[] download() throws Exception {
        return mvc.perform(get("/api/reservations/" + id + "/certificate").session(login("pdf-owner", "Synthetic-owner-123")))
            .andExpect(status().isOk()).andExpect(content().contentType("application/pdf"))
            .andExpect(header().string("Cache-Control", "no-store, private"))
            .andExpect(header().string("Content-Disposition", "attachment; filename=\"constancia-reserva-" + id + ".pdf\""))
            .andReturn().getResponse().getContentAsByteArray();
    }
    String text(byte[] bytes) throws Exception { try (var pdf = Loader.loadPDF(bytes)) { return new PDFTextStripper().getText(pdf); } }
    @Test void ownConfirmedPdfUsesStoredPricesAndDoesNotMutate() throws Exception {
        var before = jdbc.queryForObject("select row_to_json(r)::text from reservations r where id=?", String.class, id);
        jdbc.update("update rooms set price_per_night=999 where id=?", room);
        byte[] bytes = download();
        assertThat(text(bytes)).contains("CONSTANCIA DE RESERVA", "CONFIRMADA", "Hotel Panamá", "Habitación: 101", "USD 85.00", "USD 170.00", "No es una factura fiscal ni un comprobante de pago.").doesNotContain("999.00", "CVV");
        assertThat(jdbc.queryForObject("select row_to_json(r)::text from reservations r where id=?", String.class, id)).isEqualTo(before);
        assertThat(jdbc.queryForObject("select count(*) from payments", Long.class)).isZero();
        var directory = Path.of("/reports/hu04"); Files.createDirectories(directory);
        Files.write(directory.resolve("constancia-confirmada.pdf"), bytes);
        try (var pdf = Loader.loadPDF(bytes)) { ImageIO.write(new PDFRenderer(pdf).renderImageWithDPI(0, 110), "png", directory.resolve("constancia-confirmada.png").toFile()); }
    }
    @Test void cancellationIsExplicitWithSavedTimestamp() throws Exception {
        reservations.cancel(id, "pdf-owner", false);
        assertThat(text(download())).contains("CANCELADA", "Cancelada: " + reservations.detail(id,"pdf-owner",false).cancelledAt().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));
    }
    @Test void missingLegacyPricesAreNotInventedAndLongTextWraps() throws Exception {
        jdbc.update("update reservations set nightly_price=null,total_price=null where id=?", id);
        jdbc.update("update hotels set name=?", "Hotel ".repeat(30));
        assertThat(text(download())).contains("No registrado");
    }
    @Test void sessionAndOwnershipRequiredIncludingAdmin() throws Exception {
        mvc.perform(get("/api/reservations/" + id + "/certificate")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/reservations/" + id + "/certificate").session(login("pdf-other", "Synthetic-other-123"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/reservations/" + id + "/certificate").session(login("pdf-admin", "Synthetic-admin-123"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/reservations/999999/certificate").session(login("pdf-owner", "Synthetic-owner-123"))).andExpect(status().isNotFound());
    }
    @Test void downloadDoesNotPermitUnprotectedMutations() throws Exception {
        var session = login("pdf-owner", "Synthetic-owner-123");
        mvc.perform(get("/api/reservations/" + id + "/certificate").session(session)).andExpect(status().isOk());
        mvc.perform(post("/api/reservations/" + id + "/cancel").session(session)).andExpect(status().isForbidden());
    }
}
