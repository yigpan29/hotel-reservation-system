package app.mnhotel.hotel_reservation_system_backend.dto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class DemandViews {
    private DemandViews() {}
    public record Context(Long hotelId,String dataKind,long currentActiveRooms,long invalidStayRecords,List<String> limitations) {}
    public record Day(LocalDate date,long roomNights,BigDecimal capacityReferencePercent) {}
    public record Summary(long totalReservations,long confirmedReservations,long cancelledReservations,long unknownStateReservations,
        long roomNights,BigDecimal dailyAverage,BigDecimal capacityReferencePercent,long deduplicatedRoomNights,List<LocalDate> peakDates,List<LocalDate> lowDates) {}
    public record History(Context context,LocalDate startDate,LocalDate endDate,Summary summary,List<Day> days) {}
    public record WeekdayAverage(String weekday,int observations,long roomNights,BigDecimal average) {}
    public record Estimate(LocalDate date,BigDecimal estimatedRoomNights,long confirmedRoomNights,BigDecimal capacityReferencePercent,String level) {}
    public record Forecast(Context context,LocalDate referenceDate,LocalDate trainingStart,LocalDate trainingEnd,
        LocalDate horizonStart,LocalDate horizonEnd,LocalDate earliestKnownStay,String status,String message,String method,
        List<WeekdayAverage> weekdayAverages,List<Estimate> days) {}
}
