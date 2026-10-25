#!/bin/sh
set -eu
[ "$SPRING_PROFILES_ACTIVE" = isolated ]
[ "$SPRING_CONFIG_LOCATION" = classpath:/application-isolated.properties ]
[ "$SPRING_DATASOURCE_URL" = jdbc:postgresql://postgres-test:5432/hotel_test ] || {
  echo ISOLATED_DATASOURCE_REJECTED >&2
  exit 64
}
[ "$SPRING_DATASOURCE_USERNAME" = hotel_test ]
[ "$SPRING_JPA_HIBERNATE_DDL_AUTO" = validate ]
java -version
mvn -version
mvn -o -B -ntp clean verify
cp /checks/IsolatedFlywayCompatibilityTests.java src/test/java/app/mnhotel/hotel_reservation_system_backend/
mvn -o -B -ntp -Pisolated-flyway dependency:tree -Dincludes=org.flywaydb:*
exec mvn -o -B -ntp -Pisolated-flyway -Dtest=IsolatedFlywayCompatibilityTests test
