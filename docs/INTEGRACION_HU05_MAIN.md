# Integración HU-05, base y main

## Estado inicial confirmado el 28 de octubre de 2026

- `main`: `461b87c`, merge del rediseño PR #17, con checkout HU-01 y constancia HU-04.
- `base`: `8682678`, con calendario HU-02 y selección de huéspedes/habitaciones HU-06.
- PR #9 abierto hacia `base`, head `56d44ea`; duplicaba V3 (capacidad/historial) y V4 (huéspedes/notificaciones).
- PostgreSQL de desarrollo: `hotel-bd`, PostgreSQL 17, usuario `root`. Historial: baseline V1, V2 booking, V3 historial HU-03 (497165249), V4 notificaciones (177359749).
- Faltaban capacidad, huéspedes, tipo congelado y checkout. Hibernate fallaba primero en `reservations.adults`. Flyway estaba desactivado; activarlo con el linaje de main sería incompatible.
- No había reglas de protección ni rulesets configurados. Actions del head previo del PR #9 requería acción; actor Copilot, sin jobs ejecutados. Se vuelve a comprobar CI después de publicar las correcciones.

## Dos linajes explícitos

La ruta predeterminada `classpath:db/migration` corresponde a instalaciones nuevas: V1 legacy, V2 booking, V3 capacidad, V4 huéspedes, V5 tipo de habitación, V6 historial HU-03, V7 notificaciones y V8 checkout al integrar main. V7 estaba reservada expresamente en V8; no existía en Git ni en el historial local inspeccionado.

La ruta `classpath:db/legacy-hu05` corresponde exclusivamente a bases con V3 historial y V4 notificaciones ya aplicadas. Conserva los SQL originales V1–V4 y sus checksums. V5 añade capacidad y campos de reserva; no rellena adultos, niños ni tipo histórico. Al integrar checkout se añade V8 con el mismo contenido que el linaje canónico. Los futuros cambios deben mantenerse compatibles con ambos linajes.

No se combinan ambas rutas. No se ejecuta `repair`, baseline adicional, out-of-order ni se edita `flyway_schema_history`. Un linaje desconocido debe detener la migración. `HOTEL_MIGRATIONS_ENABLED` sigue siendo opt-in; `HOTEL_MIGRATIONS_LOCATIONS` permite elegir el linaje después del diagnóstico.

## Validación de conservación

El harness usa un proyecto aislado, PostgreSQL 17 en tmpfs y credenciales sintéticas. Prueba instalaciones vacías, adopción legacy V1 y un tercer escenario que aplica el HU-03 V3/HU-05 V4 originales, crea reserva y notificación, calcula huellas de filas y del historial, aplica la compatibilidad, repite y valida. Las huellas originales deben coincidir y los campos de huésped/tipo deben seguir en NULL.

`run.ps1 -ProjectName hotel-reservation-system-test-<sufijo>` permite ejecutar pruebas sin retirar los recursos aislados anteriores. La espera de bootstrap usa la corrección ya propuesta en PR #19: 120 segundos reales, salud obligatoria y detección de proceso terminado.

Los resultados efectivos de pruebas, merges y validación de desarrollo se registran al concluir la intervención. No se presentan los resultados históricos del PR como pruebas del código integrado.
