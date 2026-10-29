-- Preserve legacy values, timestamps and identifiers. Do not invent historical prices.
ALTER TABLE hotels ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN role varchar(255) NOT NULL DEFAULT 'USER';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER','ADMIN'));
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
CREATE UNIQUE INDEX users_username_lower_unique ON users (lower(username));
ALTER TABLE rooms RENAME COLUMN availbility TO availability;
ALTER TABLE rooms ADD COLUMN active boolean NOT NULL DEFAULT true;
UPDATE rooms SET active = coalesce(availability, false);
ALTER TABLE rooms ADD CONSTRAINT rooms_hotel_number_unique UNIQUE (hotel_id,room_number);
ALTER TABLE rooms ADD CONSTRAINT rooms_price_check CHECK (price_per_night >= 0) NOT VALID;
ALTER TABLE reservations ADD COLUMN nightly_price integer;
ALTER TABLE reservations ADD COLUMN total_price bigint;
ALTER TABLE reservations ADD COLUMN cancelled_at timestamp(6) without time zone;
-- NOT VALID preserves legacy rows that need an explicit human review. New writes are checked.
ALTER TABLE reservations ADD CONSTRAINT reservations_dates_check CHECK (end_date > start_date) NOT VALID;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check CHECK (status IN ('CONFIRMED','CANCELLED')) NOT VALID;
ALTER TABLE reservations ADD CONSTRAINT reservations_price_check CHECK (nightly_price >= 0 AND total_price >= 0) NOT VALID;
CREATE INDEX rooms_hotel_idx ON rooms(hotel_id);
CREATE INDEX reservations_room_dates_idx ON reservations(room_id,start_date,end_date) WHERE status='CONFIRMED';
CREATE INDEX reservations_user_idx ON reservations(user_id,created_at);
