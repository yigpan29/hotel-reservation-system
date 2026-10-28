-- Capacidad declarada por habitación: la búsqueda por huéspedes la necesita.
-- Columna nueva con valor por defecto; no se altera ninguna columna ni fila legacy existente.
ALTER TABLE rooms ADD COLUMN capacity integer NOT NULL DEFAULT 2;
ALTER TABLE rooms ADD CONSTRAINT rooms_capacity_check CHECK (capacity BETWEEN 1 AND 10);
-- El inventario cargado es explícitamente simulado y sus tipos son un vocabulario fijo:
-- se alinea la capacidad con ese tipo. Cualquier otro tipo conserva el valor por defecto.
UPDATE rooms SET capacity = CASE type
    WHEN 'Individual' THEN 1
    WHEN 'Deluxe' THEN 3
    WHEN 'Familiar' THEN 4
    WHEN 'Suite' THEN 4
    ELSE 2 END;
