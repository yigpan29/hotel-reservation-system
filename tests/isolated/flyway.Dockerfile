FROM maven:3.9-eclipse-temurin-17@sha256:1a352420f7aba21f5ad08df31bab55f74c013fb491f1ae8ab1dd7ff9ed698584
WORKDIR /work
COPY tests/isolated/maven-settings.xml /root/.m2/settings.xml
COPY tests/isolated/flyway-pom.xml ./pom.xml
RUN mvn -B -ntp dependency:go-offline
RUN mvn -B -ntp dependency:get -Dartifact=org.flywaydb:flyway-database-postgresql:10.20.1 \
    && mvn -B -ntp dependency:get -Dartifact=org.postgresql:postgresql:42.7.3
COPY hotel-reservation-system-backend/src/main/resources/db/migration /checks/migrations
COPY tests/isolated/flyway-check.sh /checks/flyway-check.sh
