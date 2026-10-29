INSERT INTO users(username,email,password,role) VALUES ('lineage-user','lineage@example.invalid','not-a-login','USER');
INSERT INTO hotels(name,active) VALUES ('Lineage hotel',true);
INSERT INTO rooms(hotel_id,room_number,type,price_per_night,active,availability) SELECT id,'L1','Suite',100,true,true FROM hotels;
INSERT INTO reservations(room_id,user_id,start_date,end_date,status,nightly_price,total_price) SELECT r.id,u.id,'2030-01-01','2030-01-03','CONFIRMED',100,200 FROM rooms r CROSS JOIN users u;
INSERT INTO reservation_notifications(user_id,reservation_id,type,hotel_name,start_date,end_date,message,created_at) SELECT user_id,id,'CONFIRMED','Lineage hotel','2030-01-01','2030-01-03','Preserve me',now() FROM reservations;
CREATE TABLE compatibility_fingerprints(table_name text PRIMARY KEY,digest text NOT NULL);
DO $$ DECLARE t text; d text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','hotels','rooms','reservations','payments','reviews','reservation_demo_batches','reservation_demo_items','reservation_notifications','flyway_schema_history'] LOOP
    EXECUTE format('SELECT md5(coalesce(string_agg(to_jsonb(x)::text,chr(10) ORDER BY to_jsonb(x)::text),'''')) FROM %I x',t) INTO d;
    INSERT INTO compatibility_fingerprints VALUES(t,d);
  END LOOP;
END $$;
