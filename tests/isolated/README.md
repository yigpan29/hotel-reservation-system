# Pruebas iniciales aisladas

Desde la raíz del repositorio, con Docker Desktop disponible:

```powershell
powershell -NoProfile -File tests/isolated/run.ps1
```

Si Windows bloquea scripts locales, la invocación comprobada usa
`powershell -NoProfile -ExecutionPolicy Bypass -File tests/isolated/run.ps1`.
La excepción se limita a ese proceso; no cambia la política global.

El runner usa siempre `-p hotel-reservation-system-test`, `-f compose.test.yaml`
y un archivo de entorno vacío explícito. No ejecutar estos servicios combinando el
Compose de desarrollo. Requiere un proyecto de pruebas sin contenedores previos;
se detiene si encuentra alguno. `-SkipBuild` reutiliza las imágenes de pruebas ya
construidas; omitirlo después de modificar fuentes o configuración.

Las imágenes base están fijadas por digest para conservar las versiones ensayadas.
Las descargas npm/Maven ocurren durante la construcción de imágenes sin acceso a
la red Compose de desarrollo ni configuración privada del proyecto. Los checks
se ejecutan después en una red interna, Maven offline, sin puertos publicados,
sin binds de fuentes de aplicación y sin volúmenes persistentes. PostgreSQL usa
tmpfs y credenciales públicas exclusivas de esta prueba desechable.
`.dockerignore` limita el contexto; no incorpora `.env`, `.git`, `bin`, `target`
ni las dependencias de desarrollo. La configuración Spring original tampoco se
copia: solo se usa el perfil `isolated`, datasource explícito y Hibernate validate.

Se crean tres bases en la misma instancia PostgreSQL temporal: `hotel_test`
(V1 desde cero y JPA validate), `hotel_legacy` (referencia DDL) y `hotel_adopt`
(referencia con seis filas sintéticas, rechazo sin baseline y baseline explícito
1). Se comparan dumps de esquema excluyendo únicamente el historial Flyway,
comentarios y tokens aleatorios de pg_dump. Se compara también el dump de datos
y las posiciones de secuencias antes/después de adoptar.

`schema/legacy.sql` es una extracción **solo de estructura** de PostgreSQL 17.11,
obtenida con default_transaction_read_only=on. V1 conserva tipos, longitudes,
precisión, identity, nombres de restricciones e índices y el nombre `availbility`.
Solo elimina los comandos psql `restrict/unrestrict` y permite que `public` ya
exista. Es una propuesta en el harness, no una migración instalada en la aplicación.
No hay V2 ni cambios funcionales de dominio. Flyway 10.10.0 y su módulo PostgreSQL
se ensayan por separado; integrar Flyway con Spring Boot sigue pendiente.

Los logs y códigos reales se guardan en `.local/isolated/<fecha>/`, ignorado por Git.
Un fallo del frontend o backend devuelve código 1 aunque los ensayos de esquema
pasen; el rechazo esperado de Flyway queda identificado por separado. No se
descarga ninguna herramienta global, ni se modifica el POM/lockfile original.

Para revisar o retirar los recursos, identificar antes nombres, etiquetas y
montajes. Estos comandos solo apuntan al proyecto de pruebas:

```powershell
docker compose -p hotel-reservation-system-test --env-file tests/isolated/empty.env -f compose.test.yaml ps --all
docker inspect hotel-reservation-system-test-postgres-test-1 --format '{{.Name}} {{json .Config.Labels}} {{json .Mounts}} {{json .HostConfig.Tmpfs}}'
# Solo después de confirmar proyecto/nombres/montajes de pruebas:
docker compose -p hotel-reservation-system-test --env-file tests/isolated/empty.env -f compose.test.yaml down
```

No usar limpieza global, `down -v` ni comandos sobre Compose de desarrollo.
`down` destruye únicamente el tmpfs de pruebas y su red; conserva imágenes y logs.
No detener/reiniciar PostgreSQL temporal si se desea conservar los datos para
revisión: tmpfs es deliberadamente efímero.
