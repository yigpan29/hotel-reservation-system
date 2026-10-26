param([switch]$ConfirmDevelopmentAccount)
$ErrorActionPreference='Stop'
if(-not $ConfirmDevelopmentAccount){throw 'Requiere -ConfirmDevelopmentAccount; no modifica claves existentes.'}
$secretPath=Join-Path (Split-Path $PSScriptRoot -Parent) '.local/private-demonstration/demo-admin.password'
$state=(docker inspect hotel-reservation-system-backend-1 | ConvertFrom-Json)[0]
if($LASTEXITCODE -ne 0){throw 'Cannot inspect backend'}
$config=@{}
foreach($entry in $state.Config.Env){$parts=$entry.Split('=',2);$config[$parts[0]]=$parts[1]}
if($config.SPRING_DATASOURCE_URL -ne 'jdbc:postgresql://postgres:5432/hotel-bd'){throw 'Wrong datasource'}
$sql="SELECT CASE WHEN current_database()='hotel-bd' AND (SELECT count(*) FROM flyway_schema_history WHERE version IN ('1','2') AND success)=2 THEN (SELECT count(*) FROM users WHERE username='demo-admin') ELSE -1 END;"
$count=@($sql | docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' hotel-reservation-system-postgres-1 sh -c 'exec psql -X -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1')
if($LASTEXITCODE -ne 0 -or $count.Count -ne 1){throw 'Account check failed'}
if([int]$count[0] -eq 0){
    if(-not(Test-Path -LiteralPath $secretPath)){throw 'Se requiere la clave privada introducida por el operador'}
    $backup=Join-Path (Split-Path $secretPath -Parent) ('hotel-bd-admin-'+(Get-Date -Format yyyyMMdd-HHmmss)+'.dump')
    docker exec hotel-reservation-system-postgres-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --file=/tmp/codex-admin-before.dump'
    if($LASTEXITCODE -ne 0){throw 'Backup failed'}
    docker cp hotel-reservation-system-postgres-1:/tmp/codex-admin-before.dump $backup
    if($LASTEXITCODE -ne 0){throw 'Backup copy failed'}
    $values=@{SPRING_DATASOURCE_URL=$config.SPRING_DATASOURCE_URL;SPRING_DATASOURCE_USERNAME=$config.SPRING_DATASOURCE_USERNAME;SPRING_DATASOURCE_PASSWORD=$config.SPRING_DATASOURCE_PASSWORD;HOTEL_ADMIN_PASSWORD=[IO.File]::ReadAllText($secretPath)}
    $saved=@{}
    try {
        foreach($key in $values.Keys){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process');[Environment]::SetEnvironmentVariable($key,$values[$key],'Process')}
        docker run --rm --name hotel-reservation-system-explicit-demo-admin --label purpose=authorized-demo-admin-provision --network hotel-reservation-system_default -e SPRING_DATASOURCE_URL -e SPRING_DATASOURCE_USERNAME -e SPRING_DATASOURCE_PASSWORD -e HOTEL_ADMIN_PASSWORD -e SPRING_CONFIG_LOCATION=classpath:/application.properties -e SPRING_PROFILES_ACTIVE=provision-admin -e HOTEL_ADMIN_CONFIRM=CREATE_ADMIN -e HOTEL_ADMIN_USERNAME=demo-admin -e HOTEL_ADMIN_EMAIL=demo-admin@example.invalid -e SPRING_FLYWAY_ENABLED=false -e SPRING_DEVTOOLS_RESTART_ENABLED=false -e SERVER_PORT=0 -e HOTEL_SETUP_EXIT=true --entrypoint java hotel-reservation-system-test-backend-check -jar /work/target/hotel-reservation-system-backend-0.0.1-SNAPSHOT.jar
        if($LASTEXITCODE -ne 0){throw 'Admin provisioning failed'}
    } finally {foreach($key in $saved.Keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')};$values=$null;$config=$null}
} elseif([int]$count[0] -ne 1){throw 'Ambiguous demo-admin identity'}
$sql=@'
BEGIN READ ONLY;
DO $$ BEGIN
 IF current_database()<>'hotel-bd' OR (SELECT count(*) FROM users WHERE username='demo-admin' AND role='ADMIN')<>1 THEN RAISE EXCEPTION 'ADMIN account not verified'; END IF;
END $$;
SELECT id,username,role,left(password,4) IN ('$2a$','$2b$','$2y$') AS bcrypt FROM users WHERE username='demo-admin';
COMMIT;
'@
$sql | docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' hotel-reservation-system-postgres-1 sh -c 'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
if($LASTEXITCODE -ne 0){throw 'Admin verification failed'}
