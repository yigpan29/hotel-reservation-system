# Corrección de numeración: historial HU-03 en V6

> Registro histórico de la renumeración. La integración posterior incorpora V7 HU-05, V8 checkout y conserva las V3/V4 publicadas antiguas mediante un [linaje explícito de compatibilidad](INTEGRACION_HU05_MAIN.md), sin editar su historial.

Eric aprobó el 28/10/2026 mantener capacidad en V3, huéspedes en V4 y tipo de
habitación en V5, moviendo únicamente el historial de demostración a V6.

| Versión | Archivo |
| --- | --- |
| V1 | V1__legacy_schema.sql |
| V2 | V2__booking_foundations.sql |
| V3 | V3__room_capacity.sql |
| V4 | V4__reservation_guests.sql |
| V5 | V5__reservation_room_type.sql |
| V6 | V6__tracked_demonstration_history.sql |

La V6 conserva exactamente los bytes SQL de la antigua
V3__tracked_demonstration_history.sql (objeto Git
096797d1c532395ead95d7e3d01ca884e864226c). No cambia tablas, datos ni restricciones;
solo cambia su nombre y orden. Las pruebas exigen la secuencia exacta V1 a V6 y
Flyway actual en V6. La CI también cubre PR dirigidos a main, manteniendo los
mismos jobs, permisos y aislamiento existentes.

## Instalaciones existentes

Esta corrección elimina el duplicado al resolver los archivos del repositorio.
No actualiza automáticamente los registros de bases que ya aplicaron la V3
antigua de historial.

- Una instalación con capacidad V3, huéspedes V4 y tipo V5, sin tablas de
  historial previamente creadas, puede recibir la nueva V6 en su orden normal.
- Una instalación cuyo V3 registrado es el historial utiliza otro linaje. Debe
  conservarse detenida su actualización hasta revisar su historial y esquema,
  verificar un respaldo y aprobar un procedimiento de adopción específico.
  Este cambio no autoriza ni ejecuta ese procedimiento.
- No ejecutar repair, borrar historial, alterar checksums, activar outOfOrder ni
  volver a crear tablas existentes para ocultar una discrepancia.

Para el inventario del equipo basta una consulta de lectura de
`installed_rank, version, description, script, checksum, type, success` en
`flyway_schema_history`, además de identificar la base y las tablas presentes.
No publicar claves, filas de usuarios ni respaldos en Git.

## Validación

El harness aislado verifica instalación nueva V1-V6, adopción legacy desde V1,
preservación de valores/secuencias, repetición y validación, arranque limpio,
guardas de destino, pruebas Java, frontend y navegador. Esa adopción legacy no
equivale a probar una conversión de una base que ya tenga V3 de historial.
Resultados reales: se registran en AI Development Log al terminar la ejecución.

No se modifica PostgreSQL de desarrollo ni las demos existentes. HU-05 y HU-01
siguen en sus ramas: sus números V4/V5 deberán coordinarse antes de integrarlas;
no se renumeran como parte de esta corrección.
