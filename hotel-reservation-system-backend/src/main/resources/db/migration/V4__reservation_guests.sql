-- Huéspedes declarados por reserva. Columnas nullable: las reservas anteriores
-- no registraron esta información y no se inventa un valor para ellas.
ALTER TABLE reservations ADD COLUMN adults integer;
ALTER TABLE reservations ADD COLUMN children integer;
-- Una reserva registra ambos valores o ninguno; las filas legacy quedan en NULL.
ALTER TABLE reservations ADD CONSTRAINT reservations_guests_check CHECK (
    (adults IS NULL AND children IS NULL)
    OR (adults BETWEEN 1 AND 20 AND children BETWEEN 0 AND 20));
