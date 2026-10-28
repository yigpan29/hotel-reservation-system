-- Tipo de habitación congelado en cada reserva, igual que la tarifa pactada: renombrar o
-- reclasificar la habitación después no reescribe lo que el cliente reservó.
-- V3 y V4 (capacidad de habitación y huéspedes por reserva) solo añaden esquema y ya están aplicadas
-- en bases de desarrollo: Flyway exige conservarlas y no permite reutilizar su número.
ALTER TABLE reservations ADD COLUMN room_type character varying(255);
-- Las reservas existentes no guardaron el tipo. Se rellena con el tipo actual de su habitación,
-- que es la única información disponible; las habitaciones sin tipo dejan el valor en NULL.
-- Las restricciones de V2 son NOT VALID para conservar filas legacy, pero un UPDATE sí las vuelve
-- a evaluar: las filas que no las cumplen (estado desconocido, fechas invertidas, importes
-- negativos) no se tocan y conservan room_type en NULL, como el resto de sus datos legacy.
UPDATE reservations r SET room_type = rm.type
FROM rooms rm
WHERE rm.id = r.room_id
  AND r.status IN ('CONFIRMED', 'CANCELLED')
  AND r.end_date > r.start_date
  AND coalesce(r.nightly_price, 0) >= 0
  AND coalesce(r.total_price, 0) >= 0;
