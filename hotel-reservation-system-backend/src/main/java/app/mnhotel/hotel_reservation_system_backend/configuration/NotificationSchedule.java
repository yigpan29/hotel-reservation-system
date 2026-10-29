package app.mnhotel.hotel_reservation_system_backend.configuration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import app.mnhotel.hotel_reservation_system_backend.service.ReminderService;

@Configuration @EnableScheduling
@Profile("!demand-history & !provision-admin & !catalog-panama")
@ConditionalOnProperty(name="hotel.notifications.reminders.enabled",havingValue="true",matchIfMissing=true)
public class NotificationSchedule {
    private final ReminderService reminders;private static final Logger LOG=LoggerFactory.getLogger(NotificationSchedule.class);
    public NotificationSchedule(ReminderService reminders){this.reminders=reminders;}
    @Scheduled(cron="${hotel.notifications.reminders.cron:0 0 9 * * *}",zone="America/Panama")
    @EventListener(ApplicationReadyEvent.class)
    public void execute(){try{int created=reminders.generate();if(created>0)LOG.info("Recordatorios de entrada creados: {}",created);}catch(Exception error){LOG.error("No se pudieron generar recordatorios ({})",error.getClass().getSimpleName());}}
}
