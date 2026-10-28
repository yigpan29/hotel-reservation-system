package app.mnhotel.hotel_reservation_system_backend.service;

import app.mnhotel.hotel_reservation_system_backend.service.imp.ReservationServiceImp;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName;
import org.springframework.stereotype.Service;
import java.awt.Color;
import java.io.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ReservationCertificateService {
    private final ReservationServiceImp reservations;
    public ReservationCertificateService(ReservationServiceImp reservations) { this.reservations = reservations; }

    public byte[] create(Long id, String username) {
        // Ownership is mandatory even for administrators. Snapshot uses the saved prices.
        var r = reservations.detail(id, username, false);
        try (var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            document.getDocumentInformation().setTitle("Constancia de reserva #" + r.id());
            try (var layout = new Layout(document, r.id())) {
                String status = "CANCELLED".equals(r.status()) ? "CANCELADA" : "CONFIRMED".equals(r.status()) ? "CONFIRMADA" : r.status();
                layout.status(status, "CANCELLED".equals(r.status()));
                layout.section("DATOS DE LA ESTANCIA");
                layout.row("Hotel:", r.hotelName(), false);
                layout.row("Habitación:", r.roomNumber() + " (ID " + r.roomId() + ")", false);
                layout.row("Titular:", r.username(), false);
                layout.row("Entrada:", date(r.startDate()), false);
                layout.row("Salida:", date(r.endDate()), false);
                layout.section("REGISTRO DE LA RESERVA");
                layout.row("Creada:", date(r.createdAt()), false);
                if (r.cancelledAt() != null) layout.row("Cancelada:", date(r.cancelledAt()), false);
                layout.section("RESUMEN DE IMPORTES");
                layout.row("Tarifa pactada por noche:", money(r.nightlyPrice()), false);
                layout.row("Total de la reserva:", money(r.totalPrice()), true);
                layout.note("Este documento refleja el estado actual de la reserva.");
                layout.note("No es una factura fiscal ni un comprobante de pago.");
            }
            document.save(output);
            return output.toByteArray();
        } catch (IOException e) { throw new UncheckedIOException("No se pudo generar la constancia", e); }
    }
    private static String date(java.time.LocalDateTime value) {
        return value == null ? "No registrada" : value.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
    }
    private static String money(Number value) { return value == null ? "No registrado" : "USD " + value.longValue() + ".00"; }

    /** Fixed margins, measured cells and repeated headers keep long legacy values inside the page. */
    private static final class Layout implements AutoCloseable {
        private static final Color NAVY = new Color(24, 43, 65), INK = new Color(37, 49, 62);
        private static final Color MUTED = new Color(88, 101, 115), LINE = new Color(217, 224, 230);
        private static final Color PALE = new Color(244, 247, 249), GOLD = new Color(179, 145, 83);
        private static final float LEFT = 44, WIDTH = PDRectangle.A4.getWidth() - 88, LABEL = 180;
        private final PDDocument document;
        private final Long id;
        private final PDFont regular = new PDType1Font(FontName.HELVETICA);
        private final PDFont bold = new PDType1Font(FontName.HELVETICA_BOLD);
        private PDPageContentStream stream;
        private float y;
        private String currentSection;

        Layout(PDDocument document, Long id) throws IOException { this.document = document; this.id = id; page(); }
        private void page() throws IOException {
            if (stream != null) stream.close();
            var page = new PDPage(PDRectangle.A4); document.addPage(page);
            stream = new PDPageContentStream(document, page);
            rectangle(0, 736, PDRectangle.A4.getWidth(), 106, NAVY);
            text("HOTEL MN", LEFT, 808, bold, 12, Color.WHITE);
            text("RESERVAS Y ESTANCIAS", LEFT, 790, regular, 8, new Color(214, 224, 233));
            text("CONSTANCIA DE RESERVA", LEFT, 758, bold, 21, Color.WHITE);
            String reference = "Reserva #" + id;
            text(reference, LEFT + WIDTH - width(reference, bold, 11), 807, bold, 11, Color.WHITE);
            rectangle(LEFT, 724, 46, 3, GOLD);
            y = 700;
        }
        void status(String status, boolean cancelled) throws IOException {
            var lines = wrap("Estado: " + status, bold, 11, WIDTH - 28);
            float height = Math.max(35, 18 + lines.size() * 15);
            ensure(height + 8);
            rectangle(LEFT, y - height, WIDTH, height, cancelled ? new Color(252, 239, 237) : new Color(235, 245, 240));
            float baseline = y - 22;
            for (String line : lines) { text(line, LEFT + 14, baseline, bold, 11, cancelled ? new Color(145, 48, 39) : new Color(38, 100, 74)); baseline -= 15; }
            y -= height + 9;
        }
        void section(String title) throws IOException {
            currentSection = null; ensure(80); currentSection = title; sectionHeading(title);
        }
        private void sectionHeading(String title) throws IOException {
            y -= 24;
            text(title, LEFT, y, bold, 9, MUTED);
            y -= 13;
        }
        private void ensure(float height) throws IOException {
            if (y - height < 85) {
                page();
                if (currentSection != null) sectionHeading(currentSection);
            }
        }
        void row(String label, String value, boolean total) throws IOException {
            float size = total ? 12 : 10.5f;
            PDFont valueFont = total ? bold : regular;
            var labels = wrap(label, bold, 9.5f, LABEL - 24);
            var values = wrap(value, valueFont, size, WIDTH - LABEL - 24);
            float height = Math.max(36, 20 + Math.max(labels.size(), values.size()) * 15);
            ensure(height);
            rectangle(LEFT, y - height, LABEL, height, total ? NAVY : PALE);
            rectangle(LEFT + LABEL, y - height, WIDTH - LABEL, height, total ? NAVY : Color.WHITE);
            stream.setStrokingColor(LINE); stream.setLineWidth(0.6f);
            stream.addRect(LEFT, y - height, WIDTH, height); stream.stroke();
            if (!total) { stream.moveTo(LEFT + LABEL, y); stream.lineTo(LEFT + LABEL, y - height); stream.stroke(); }
            float baseline = y - 22;
            for (String line : labels) { text(line, LEFT + 12, baseline, bold, 9.5f, total ? Color.WHITE : MUTED); baseline -= 15; }
            baseline = y - 22;
            for (String line : values) {
                float x = total ? LEFT + WIDTH - 12 - width(line, valueFont, size) : LEFT + LABEL + 12;
                text(line, x, baseline, valueFont, size, total ? Color.WHITE : INK); baseline -= 15;
            }
            y -= height;
        }
        void note(String note) throws IOException {
            var lines = wrap(note, regular, 9, WIDTH);
            ensure(17 + lines.size() * 13); y -= 22;
            for (String line : lines) { text(line, LEFT, y, regular, 9, MUTED); y -= 13; }
        }
        private void rectangle(float x, float y, float w, float h, Color color) throws IOException {
            stream.setNonStrokingColor(color); stream.addRect(x, y, w, h); stream.fill();
        }
        private void text(String value, float x, float y, PDFont font, float size, Color color) throws IOException {
            stream.beginText(); stream.setFont(font, size); stream.setNonStrokingColor(color);
            stream.newLineAtOffset(x, y); stream.showText(printable(value, font)); stream.endText();
        }
        private float width(String value, PDFont font, float size) throws IOException { return font.getStringWidth(printable(value, font)) * size / 1000; }
        private List<String> wrap(String value, PDFont font, float size, float maxWidth) throws IOException {
            String text = printable(value, font);
            var lines = new ArrayList<String>();
            while (!text.isEmpty()) {
                int end = 0;
                while (end < text.length() && width(text.substring(0, end + 1), font, size) <= maxWidth) end++;
                if (end == text.length()) { lines.add(text); break; }
                int space = text.lastIndexOf(' ', end);
                if (space > 0) end = space;
                end = Math.max(1, end);
                lines.add(text.substring(0, end)); text = text.substring(end).stripLeading();
            }
            if (lines.isEmpty()) lines.add("");
            return lines;
        }
        @Override public void close() throws IOException {
            stream.close();
            for (int i = 0; i < document.getNumberOfPages(); i++) {
                try (var footer = new PDPageContentStream(document, document.getPage(i), PDPageContentStream.AppendMode.APPEND, true)) {
                    stream = footer;
                    footer.setStrokingColor(LINE); footer.setLineWidth(0.6f);
                    footer.moveTo(LEFT, 58); footer.lineTo(LEFT + WIDTH, 58); footer.stroke();
                    text("HOTEL MN  |  Constancia de reserva #" + id, LEFT, 40, regular, 8, MUTED);
                    String number = "Página " + (i + 1) + " de " + document.getNumberOfPages();
                    text(number, LEFT + WIDTH - width(number, regular, 8), 40, regular, 8, MUTED);
                }
            }
        }
    }
    // Standard PDF fonts cover Spanish. Unsupported glyphs become '?' rather than failing a download.
    private static String printable(String text, PDFont font) throws IOException {
        var result = new StringBuilder();
        for (int cp : Objects.toString(text, "No registrado").codePoints().toArray()) {
            var character = Character.isISOControl(cp) ? " " : new String(Character.toChars(cp));
            try { font.getStringWidth(character); result.append(character); }
            catch (IllegalArgumentException e) { result.append('?'); }
        }
        return result.toString();
    }
}
