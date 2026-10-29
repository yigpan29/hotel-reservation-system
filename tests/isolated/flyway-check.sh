#!/bin/sh
set -eu
[ "$FLYWAY_URL" = jdbc:postgresql://postgres-test:5432/hotel_test ] || {
  echo ISOLATED_DATASOURCE_REJECTED >&2
  exit 64
}
[ "$FLYWAY_USER" = hotel_test ]
case "${1:-}" in hotel_test|hotel_legacy|hotel_adopt|hotel_hu05) db=$1;; *) exit 64;; esac
case "${2:-}" in migrate|validate|baseline|info|migrate-v1|legacy-init|legacy-migrate|legacy-validate) action=$2;; *) exit 64;; esac
[ "$#" = 2 ]
export FLYWAY_URL="jdbc:postgresql://postgres-test:5432/$db"
if [ "$action" = legacy-init ]; then
  [ "$db" = hotel_hu05 ]
  exec mvn -o -B -ntp -Dflyway.locations=filesystem:/checks/legacy-hu05 -Dflyway.target=4 flyway:migrate
fi
if [ "$action" = legacy-migrate ] || [ "$action" = legacy-validate ]; then
  [ "$db" = hotel_hu05 ]
  exec mvn -o -B -ntp -Dflyway.locations=filesystem:/checks/legacy-hu05 "flyway:${action#legacy-}"
fi
if [ "$action" = migrate-v1 ]; then
  exec mvn -o -B -ntp -Dflyway.target=1 flyway:migrate
fi
exec mvn -o -B -ntp -Dflyway.baselineVersion=1 "flyway:$action"
