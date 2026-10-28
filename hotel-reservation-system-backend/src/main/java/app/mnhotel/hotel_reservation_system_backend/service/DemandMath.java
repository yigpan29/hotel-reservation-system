package app.mnhotel.hotel_reservation_system_backend.service;
import java.math.*;
import java.time.*;
import java.util.*;
import app.mnhotel.hotel_reservation_system_backend.dto.DemandViews.*;
import app.mnhotel.hotel_reservation_system_backend.repository.DemandRepository.Daily;

/** Pure statistical functions: server owns the only forecast formula. */
public final class DemandMath {
    private DemandMath() {}
    public static LocalDate trainingStart(LocalDate today){return today.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(8);}
    public static BigDecimal average(long total,long days){if(total<0||days<=0)throw new IllegalArgumentException("Conteos inválidos");return BigDecimal.valueOf(total).divide(BigDecimal.valueOf(days),2,RoundingMode.HALF_UP);}
    public static BigDecimal percent(BigDecimal nights,long capacity){
        if(capacity<=0||nights.signum()<0||nights.compareTo(BigDecimal.valueOf(capacity))>0)return null;
        return nights.multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(capacity),2,RoundingMode.HALF_UP);
    }
    public static List<WeekdayAverage> weekdays(List<Daily> training){
        if(training.size()!=56)throw new IllegalArgumentException("Se requieren 56 días consecutivos");
        long[] totals=new long[7];int[] counts=new int[7];
        for(int i=0;i<training.size();i++){
            var day=training.get(i);
            if(day.roomNights()<0||(i>0&&!day.date().equals(training.get(i-1).date().plusDays(1))))throw new IllegalArgumentException("Serie histórica inválida");
            int index=day.date().getDayOfWeek().getValue()-1;totals[index]=Math.addExact(totals[index],day.roomNights());counts[index]++;
        }
        List<WeekdayAverage> result=new ArrayList<>();
        for(var weekday:DayOfWeek.values()){int i=weekday.getValue()-1;if(counts[i]!=8)throw new IllegalArgumentException("Cobertura semanal inválida");result.add(new WeekdayAverage(weekday.name(),counts[i],totals[i],average(totals[i],counts[i])));}
        return List.copyOf(result);
    }
    public static List<Estimate> predict(LocalDate today,List<WeekdayAverage> averages,List<Daily> confirmed,long capacity){
        if(averages.size()!=7||capacity<0)throw new IllegalArgumentException("Modelo inválido");
        for(int i=0;i<7;i++)if(!averages.get(i).weekday().equals(DayOfWeek.of(i+1).name())||averages.get(i).average().signum()<0)throw new IllegalArgumentException("Promedios inválidos");
        Map<LocalDate,Long> booked=new HashMap<>();confirmed.forEach(d->booked.put(d.date(),d.roomNights()));
        List<Estimate> result=new ArrayList<>();
        for(int offset=1;offset<=30;offset++){
            LocalDate date=today.plusDays(offset);BigDecimal mean=averages.get(date.getDayOfWeek().getValue()-1).average();
            BigDecimal ratio=percent(mean,capacity);
            String level=capacity<=0?"UNAVAILABLE":mean.compareTo(BigDecimal.valueOf(capacity).multiply(new BigDecimal("0.80")))>=0?"HIGH":mean.compareTo(BigDecimal.valueOf(capacity).multiply(new BigDecimal("0.30")))<=0?"LOW":"MODERATE";
            result.add(new Estimate(date,mean,booked.getOrDefault(date,0L),ratio,level));
        }
        return List.copyOf(result);
    }
}
