-- EXCLUSIVELY synthetic history in the isolated project. Never execute in hotel-bd.
BEGIN;
DO $$
DECLARE
  today date := (current_timestamp AT TIME ZONE 'America/Panama')::date;
  first_day date;
  h bigint;
  u bigint;
  room_ids bigint[] := ARRAY[]::bigint[];
  room_key bigint;
  day_index integer;
  occupied integer;
  weekday integer;
BEGIN
  IF current_database()<>'hotel_test' OR current_user<>'hotel_test' THEN RAISE EXCEPTION 'Isolated database required'; END IF;
  IF EXISTS(SELECT 1 FROM hotels WHERE name='HU03 · Historial sintético') THEN RAISE EXCEPTION 'Synthetic scenario already exists; use fresh isolated resources'; END IF;
  SELECT id INTO STRICT u FROM users WHERE username='demo-user' AND role='USER';
  first_day := today-((extract(isodow FROM today)::integer)-1)-56;
  INSERT INTO hotels(name,location,description,active,rating) VALUES('HU03 · Historial sintético','Entorno aislado','Demostración HU03: todas las reservas son sintéticas; no representa un hotel operativo.',true,null) RETURNING id INTO h;
  FOR i IN 1..4 LOOP
    INSERT INTO rooms(hotel_id,room_number,type,price_per_night,active,availability) VALUES(h,'HU03-'||i,'Sintética',100,true,true) RETURNING id INTO room_key;
    room_ids:=array_append(room_ids,room_key);
  END LOOP;
  -- Coverage marker outside the eight training weeks; does not add committed nights.
  INSERT INTO reservations(user_id,room_id,start_date,end_date,status,created_at,cancelled_at,nightly_price,total_price)
    VALUES(u,room_ids[1],first_day-7,first_day-6,'CANCELLED',first_day-9,first_day-8,100,100);
  FOR day_index IN 0..55 LOOP
    weekday:=day_index%7;
    occupied:=CASE weekday WHEN 0 THEN CASE WHEN (day_index/7)%2=0 THEN 1 ELSE 2 END WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 2 WHEN 4 THEN 4 WHEN 5 THEN 3 ELSE 1 END;
    FOR r IN 1..occupied LOOP
      INSERT INTO reservations(user_id,room_id,start_date,end_date,status,created_at,nightly_price,total_price)
        VALUES(u,room_ids[r],first_day+day_index,first_day+day_index+1,'CONFIRMED',first_day+day_index-2,100,100);
    END LOOP;
    IF weekday=0 THEN
      INSERT INTO reservations(user_id,room_id,start_date,end_date,status,created_at,cancelled_at,nightly_price,total_price)
        VALUES(u,room_ids[4],first_day+day_index,first_day+day_index+1,'CANCELLED',first_day+day_index-2,first_day+day_index-1,100,100);
    END IF;
  END LOOP;
END $$;
COMMIT;
SELECT 'HU03_SYNTHETIC_HISTORY_READY: 132 confirmed room-nights, 8 cancelled in window, Monday 12/8=1.50' AS result;
