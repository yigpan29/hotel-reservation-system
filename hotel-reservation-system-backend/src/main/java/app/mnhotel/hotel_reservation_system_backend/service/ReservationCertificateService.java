package app.mnhotel.hotel_reservation_system_backend.service;

import app.mnhotel.hotel_reservation_system_backend.service.imp.ReservationServiceImp;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName;
import org.springframework.stereotype.Service;
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
        var rows = new ArrayList<String>();
        rows.add("CONSTANCIA DE RESERVA");
        rows.add("Reserva #" + r.id());
        rows.add("Estado: " + ("CANCELLED".equals(r.status()) ? "CANCELADA" : "CONFIRMED".equals(r.status()) ? "CONFIRMADA" : r.status()));
        rows.add("Hotel: " + r.hotelName());
        rows.add("Habitación: " + r.roomNumber() + " (ID " + r.roomId() + ")");
        rows.add("Titular: " + r.username());
        rows.add("Entrada: " + date(r.startDate()));
        rows.add("Salida: " + date(r.endDate()));
        rows.add("Tarifa pactada por noche: " + money(r.nightlyPrice()));
        rows.add("Total de la reserva: " + money(r.totalPrice()));
        rows.add("Creada: " + date(r.createdAt()));
        if (r.cancelledAt() != null) rows.add("Cancelada: " + date(r.cancelledAt()));
        rows.add("Este documento refleja el estado actual de la reserva.");
        rows.add("No es una factura fiscal ni un comprobante de pago.");
        try (var document = new PDDocument(); var output = new ByteArrayOutputStream()) {
            document.getDocumentInformation().setTitle("Constancia de reserva #" + r.id());
            var font = new PDType1Font(FontName.HELVETICA);
            var lines = new ArrayList<String>();
            for (var row : rows) lines.addAll(wrap(printable(row, font), font));
            for (int offset = 0; offset < lines.size(); offset += 36) {
                var page = new PDPage(PDRectangle.A4); document.addPage(page);
                try (var stream = new PDPageContentStream(document, page)) {
                    stream.beginText(); stream.setFont(font, 12); stream.setLeading(20);
                    stream.newLineAtOffset(48, 780);
                    for (int i = offset; i < Math.min(offset + 36, lines.size()); i++) {
                        stream.showText(lines.get(i)); stream.newLine();
                    }
                    stream.endText();
                }
            }
            document.save(output); return output.toByteArray();
        } catch (IOException e) { throw new UncheckedIOException("No se pudo generar la constancia", e); }
    }
    private static String date(java.time.LocalDateTime value) {
        return value == null ? "No registrada" : value.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
    }
    private static String money(Number value) { return value == null ? "No registrado" : "USD " + value.longValue() + ".00"; }
    // Standard PDF fonts cover Spanish. Unsupported glyphs become '?' rather than failing a download.
    private static String printable(String text, PDFont font) throws IOException {
        var result = new StringBuilder();
        for (int cp : text.codePoints().toArray()) {
            var character = Character.isISOControl(cp) ? " " : new String(Character.toChars(cp));
            try { font.getStringWidth(character); result.append(character); }
            catch (IllegalArgumentException e) { result.append('?'); }
        }
        return result.toString();
    }
    private static List<String> wrap(String text, PDFont font) throws IOException {
        var lines = new ArrayList<String>(); var line = new StringBuilder();
        for (char character : text.toCharArray()) {
            if (font.getStringWidth(line.toString() + character) * 12 / 1000 > 495) {
                lines.add(line.toString()); line.setLength(0);
            }
            line.append(character);
        }
        lines.add(line.toString()); return lines;
    }
}
