-- Only synthetic data in hotel_adopt, never development.
INSERT INTO hotels (name, location, description, rating) VALUES ('Synthetic isolated hotel', 'Test', 'Fixture', 4);
INSERT INTO users (email, username, password, created_at) VALUES ('fixture@example.invalid', 'synthetic', 'not-a-real-credential', '2026-01-01 12:34:56.123456');
INSERT INTO rooms (hotel_id, room_number, type, price_per_night, availbility) VALUES (1, 'TEST-1', 'Fixture', 100, false);
INSERT INTO reservations (room_id, user_id, start_date, end_date, created_at, status) VALUES (1, 1, '2026-01-02 14:00:00.123456', '2026-01-03 10:00:00', '2026-01-01', 'LEGACY_FIXTURE');
INSERT INTO payments (reservation_id, amount, payment_date, status) VALUES (1, 100, '2026-01-01', 'FIXTURE');
INSERT INTO reviews (hotel_id, user_id, comment, created_at, rating) VALUES (1, 1, 'Synthetic fixture', '2026-01-04', 4);
