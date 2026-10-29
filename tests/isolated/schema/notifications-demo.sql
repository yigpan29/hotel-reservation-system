-- Controlled HU05 scenario, isolated database only. No operational or personal data.
BEGIN;
DO $$
DECLARE u bigint; h bigint; rm bigint; booking bigint;
 tomorrow date := (current_timestamp AT TIME ZONE 'America/Panama')::date+1;
BEGIN
 IF current_database()<>'hotel_test' OR current_user<>'hotel_test' THEN RAISE EXCEPTION 'Isolated database required'; END IF;
 SELECT id INTO STRICT u FROM users WHERE username='demo-user' AND role='USER';
 INSERT INTO hotels(name,location,description,active) VALUES('HU05 · Recordatorio sintético','Entorno aislado','Fixture exclusivamente académico HU05',true) RETURNING id INTO h;
 INSERT INTO rooms(hotel_id,room_number,type,price_per_night,active,availability) VALUES(h,'HU05-1','Sintética',95,true,true) RETURNING id INTO rm;
 INSERT INTO reservations(user_id,room_id,start_date,end_date,status,created_at,nightly_price,total_price)
 VALUES(u,rm,tomorrow,tomorrow+2,'CONFIRMED',current_timestamp AT TIME ZONE 'America/Panama',95,190) RETURNING id INTO booking;
 -- Opt-in marker represents a newly confirmed reservation. Scheduler creates the reminder.
 INSERT INTO reservation_notifications(user_id,reservation_id,type,hotel_name,start_date,end_date,message,created_at)
 VALUES(u,booking,'CONFIRMED','HU05 · Recordatorio sintético',tomorrow,tomorrow+2,'Confirmación sintética de prueba HU05; no es una operación comercial real.',current_timestamp);
END $$;
COMMIT;
