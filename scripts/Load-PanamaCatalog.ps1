param([switch]$ConfirmEducationalData)
$ErrorActionPreference='Stop'
if(-not $ConfirmEducationalData){throw 'Requiere -ConfirmEducationalData; escribe exclusivamente en hotel-bd de desarrollo.'}
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root
function Check-Native { if($LASTEXITCODE -ne 0){throw 'Operación fallida; carga detenida'} }
$backend=(docker inspect hotel-reservation-system-backend-1 | ConvertFrom-Json)[0]
Check-Native
$pg=(docker inspect hotel-reservation-system-postgres-1 | ConvertFrom-Json)[0]
Check-Native
if($backend.Config.Labels.'com.docker.compose.project' -ne 'hotel-reservation-system' -or $pg.Config.Labels.'com.docker.compose.project' -ne 'hotel-reservation-system'){throw 'Recursos de destino inesperados'}
$config=@{}
foreach($entry in $backend.Config.Env){$pair=$entry.Split('=',2);$config[$pair[0]]=$pair[1]}
if($config.SPRING_DATASOURCE_URL -ne 'jdbc:postgresql://postgres:5432/hotel-bd'){throw 'Datasource de desarrollo inesperado'}
if($config.SPRING_PROFILES_ACTIVE -match '(^|,)(prod|production)(,|$)'){throw 'No se permite una instalación con perfil de producción'}
$sql=@'
BEGIN READ ONLY;
DO $$ BEGIN
 IF current_database()<>'hotel-bd' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF (SELECT count(*) FROM flyway_schema_history WHERE version IN ('1','2') AND success)<>2 THEN RAISE EXCEPTION 'V1/V2 required'; END IF;
 IF EXISTS(SELECT 1 FROM flyway_schema_history WHERE NOT success) THEN RAISE EXCEPTION 'Failed migration'; END IF;
END $$;
SELECT 'hotel-bd' AS target,count(*) AS existing_hotels FROM hotels;
COMMIT;
'@
$sql | docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' hotel-reservation-system-postgres-1 sh -c 'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
Check-Native
$private=Join-Path $root '.local/private-demonstration'
New-Item -ItemType Directory -Force -Path $private | Out-Null
$backup=Join-Path $private ('hotel-bd-catalog-'+(Get-Date -Format yyyyMMdd-HHmmss)+'-'+[guid]::NewGuid().ToString('N')+'.dump')
docker exec hotel-reservation-system-postgres-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --file=/tmp/codex-catalog-backup.dump'
Check-Native
docker cp hotel-reservation-system-postgres-1:/tmp/codex-catalog-backup.dump $backup
Check-Native
Write-Host 'Respaldo privado:' (Split-Path $backup -Leaf)
docker compose -p hotel-reservation-system-test --env-file tests/isolated/empty.env -f compose.test.yaml build backend-check
Check-Native
$saved=@{}
try {
    foreach($name in @('SPRING_DATASOURCE_URL','SPRING_DATASOURCE_USERNAME','SPRING_DATASOURCE_PASSWORD')){
        $saved[$name]=[Environment]::GetEnvironmentVariable($name,'Process')
        [Environment]::SetEnvironmentVariable($name,$config[$name],'Process')
    }
    docker run --rm --name hotel-reservation-system-catalog-command --label purpose=explicit-educational-catalog --network hotel-reservation-system_default -e SPRING_DATASOURCE_URL -e SPRING_DATASOURCE_USERNAME -e SPRING_DATASOURCE_PASSWORD -e SPRING_CONFIG_LOCATION=classpath:/application.properties -e SPRING_PROFILES_ACTIVE=catalog-panama -e SPRING_FLYWAY_ENABLED=false -e SPRING_JPA_HIBERNATE_DDL_AUTO=validate -e SPRING_DEVTOOLS_RESTART_ENABLED=false -e SERVER_PORT=0 -e HOTEL_CATALOG_DATABASE=hotel-bd -e HOTEL_CATALOG_CONFIRM=LOAD_EDUCATIONAL_PANAMA -e HOTEL_SETUP_EXIT=true --entrypoint java hotel-reservation-system-test-backend-check -jar /work/target/hotel-reservation-system-backend-0.0.1-SNAPSHOT.jar
    Check-Native
} finally {
    foreach($name in $saved.Keys){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}
    $config=$null
}
