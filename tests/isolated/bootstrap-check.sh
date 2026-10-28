#!/bin/sh
set -eu
[ "$SPRING_DATASOURCE_URL" = jdbc:postgresql://postgres-test:5432/hotel_demo ]
[ "$SPRING_PROFILES_ACTIVE" = isolated ]
java -jar target/hotel-reservation-system-backend-0.0.1-SNAPSHOT.jar &
pid=$!
trap 'kill "$pid" 2>/dev/null || :; wait "$pid" 2>/dev/null || :' EXIT
deadline=$(($(date +%s) + 120))
until curl --connect-timeout 1 --max-time 2 -fsS http://localhost:3000/api/health >/dev/null 2>&1; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo 'Clean startup failed: application process exited' >&2
    exit 1
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo 'Clean startup failed: health endpoint unavailable after 120 seconds' >&2
    exit 1
  fi
  sleep 1
done
body=$(curl --connect-timeout 1 --max-time 5 -fsS http://localhost:3000/api/hotels)
[ "$body" = '[]' ]
echo CLEAN_APPLICATION_STARTUP_WITH_AUTOMATIC_FLYWAY_OK
