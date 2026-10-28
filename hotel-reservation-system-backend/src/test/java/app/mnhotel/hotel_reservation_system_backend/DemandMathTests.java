package app.mnhotel.hotel_reservation_system_backend;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import app.mnhotel.hotel_reservation_system_backend.service.DemandMath;
import app.mnhotel.hotel_reservation_system_backend.repository.DemandRepository.Daily;
import static org.assertj.core.api.Assertions.*;

class DemandMathTests {
    final LocalDate today=LocalDate.of(2026,10,26);
    @Test void completeWeeksExcludeCurrentWeekAndHandleYearBoundary(){
        assertThat(DemandMath.trainingStart(today)).isEqualTo(LocalDate.of(2026,8,31));
        assertThat(DemandMath.trainingStart(today.plusDays(6))).isEqualTo(LocalDate.of(2026,8,31));
        assertThat(DemandMath.trainingStart(LocalDate.of(2026,1,1))).isEqualTo(LocalDate.of(2025,11,3));
    }
    List<Daily> sample(){List<Daily> days=new ArrayList<>();for(int i=0;i<56;i++){long count=i%7==0?(i/7%2==0?1:2):0;days.add(new Daily(DemandMath.trainingStart(today).plusDays(i),count,count));}return days;}
    @Test void weekdayAverageIncludesZerosAndUsesEightObservations(){
        var means=DemandMath.weekdays(sample());assertThat(means).hasSize(7);
        assertThat(means.get(0).roomNights()).isEqualTo(12);assertThat(means.get(0).observations()).isEqualTo(8);
        assertThat(means.get(0).average()).isEqualByComparingTo("1.50");assertThat(means.get(1).average()).isEqualByComparingTo("0.00");
    }
    @Test void forecastIsDeterministicThirtyDaysAndKeepsConfirmedSeparate(){
        var means=DemandMath.weekdays(sample());var confirmed=List.of(new Daily(today.plusDays(1),2,2));
        var points=DemandMath.predict(today,means,confirmed,4);
        assertThat(points).hasSize(30);assertThat(points.get(0).date()).isEqualTo(today.plusDays(1));assertThat(points.get(29).date()).isEqualTo(today.plusDays(30));
        assertThat(points.get(0).estimatedRoomNights()).isEqualByComparingTo("0");assertThat(points.get(0).confirmedRoomNights()).isEqualTo(2);
        assertThat(points.stream().filter(p->p.date().getDayOfWeek()==DayOfWeek.MONDAY)).allSatisfy(p->{assertThat(p.estimatedRoomNights()).isEqualByComparingTo("1.5");assertThat(p.capacityReferencePercent()).isEqualByComparingTo("37.5");});
        assertThat(points).isEqualTo(DemandMath.predict(today,means,confirmed,4));
    }
    @Test void missingOrChangedCapacityDoesNotInventOrClampOccupancy(){
        assertThat(DemandMath.percent(new BigDecimal("5"),4)).isNull();assertThat(DemandMath.percent(BigDecimal.ZERO,0)).isNull();
        assertThat(DemandMath.predict(today,DemandMath.weekdays(sample()),List.of(),0)).allSatisfy(p->{assertThat(p.capacityReferencePercent()).isNull();assertThat(p.level()).isEqualTo("UNAVAILABLE");});
        assertThat(DemandMath.average(1,8)).isEqualByComparingTo("0.13");
    }
    @Test void incompleteNegativeOrUnorderedDataIsRejected(){
        assertThatThrownBy(()->DemandMath.weekdays(List.of())).isInstanceOf(IllegalArgumentException.class);
        var days=sample();days.set(2,new Daily(days.get(2).date(),-1,-1));assertThatThrownBy(()->DemandMath.weekdays(days)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->DemandMath.average(-1,8)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->DemandMath.average(0,0)).isInstanceOf(IllegalArgumentException.class);
        var gap=sample();gap.set(4,new Daily(gap.get(4).date().plusDays(1),0,0));assertThatThrownBy(()->DemandMath.weekdays(gap)).isInstanceOf(IllegalArgumentException.class);
    }
}
