param(
 [Parameter(Mandatory=$true)][ValidateSet('Create','Inspect','Revert')][string]$Action,
 [ValidatePattern('^[a-z0-9-]{8,100}$')][string]$BatchCode='hu03-panama-history-v1',
 [string]$ReferenceDate,
 [long]$Seed=73003,
 [ValidateRange(8,16)][int]$Weeks=12,
 [switch]$ConfirmDataWrites,
 [string]$ConfirmRevertBatch
)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if($Action -ne 'Inspect' -and -not $ConfirmDataWrites){throw 'Se requiere -ConfirmDataWrites para insertar o revertir datos'}
if($Action -eq 'Revert' -and $ConfirmRevertBatch -cne $BatchCode){throw 'Reversión requiere -ConfirmRevertBatch con el código exacto del lote'}
if($ReferenceDate){$parsed=[datetime]::ParseExact($ReferenceDate,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture);if($parsed.ToString('yyyy-MM-dd') -ne $ReferenceDate){throw 'Fecha inválida'}}
function Check-Native {if($LASTEXITCODE -ne 0){throw 'Operación fallida; procedimiento detenido'}}
$state=(docker inspect hotel-reservation-system-backend-1 | ConvertFrom-Json)[0];Check-Native
if($state.Config.Labels.'com.docker.compose.project' -ne 'hotel-reservation-system'){throw 'Proyecto inesperado'}
$config=@{};foreach($entry in $state.Config.Env){$pair=$entry.Split('=',2);$config[$pair[0]]=$pair[1]}
if($config.SPRING_DATASOURCE_URL -ne 'jdbc:postgresql://postgres:5432/hotel-bd' -or $config.SPRING_PROFILES_ACTIVE -match '(^|,)(prod|production)(,|$)'){throw 'Destino no autorizado'}
$sql=@'
BEGIN READ ONLY;
DO $$ BEGIN
 IF current_database()<>'hotel-bd' OR NOT EXISTS(SELECT 1 FROM flyway_schema_history WHERE version='3' AND success) THEN RAISE EXCEPTION 'hotel-bd with tested V3 is required'; END IF;
END $$;
SELECT current_database(),(SELECT count(*) FROM reservations) AS existing_reservations;
COMMIT;
'@
$sql | docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' hotel-reservation-system-postgres-1 sh -c 'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1';Check-Native
if(-not $ReferenceDate){
 $query="select reference_date::text from reservation_demo_batches where code='$BatchCode';"
 $stored=@($query | docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' hotel-reservation-system-postgres-1 sh -c 'exec psql -X -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1');Check-Native
 if($stored.Count -eq 1){$ReferenceDate=$stored[0]}
}
$sha=''
if($Action -ne 'Inspect'){
 $private=Join-Path $PWD '.local/private-hu03-history';New-Item -ItemType Directory -Force -Path $private | Out-Null
 $backup=Join-Path $private ('hotel-bd-before-'+$Action.ToLower()+'-'+(Get-Date -Format yyyyMMdd-HHmmss)+'-'+[guid]::NewGuid().ToString('N')+'.dump')
 docker exec hotel-reservation-system-postgres-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --file=/tmp/codex-hu03-history.dump';Check-Native
 docker exec hotel-reservation-system-postgres-1 pg_restore --list /tmp/codex-hu03-history.dump | Out-Null;Check-Native
 docker cp hotel-reservation-system-postgres-1:/tmp/codex-hu03-history.dump $backup;Check-Native
 $sha=(Get-FileHash -Algorithm SHA256 -LiteralPath $backup).Hash
 Write-Host "Respaldo privado verificado: $(Split-Path $backup -Leaf); SHA256=$sha"
}
docker compose -p hotel-reservation-system-test --env-file tests/isolated/empty.env -f compose.test.yaml build backend-check;Check-Native
$values=@{SPRING_DATASOURCE_URL=$config.SPRING_DATASOURCE_URL;SPRING_DATASOURCE_USERNAME=$config.SPRING_DATASOURCE_USERNAME;SPRING_DATASOURCE_PASSWORD=$config.SPRING_DATASOURCE_PASSWORD;HOTEL_HISTORY_BATCH=$BatchCode;HOTEL_HISTORY_ACTION=$Action.ToLower();HOTEL_HISTORY_SEED=[string]$Seed;HOTEL_HISTORY_WEEKS=[string]$Weeks;HOTEL_HISTORY_BACKUP_SHA256=$sha}
$values.HOTEL_HISTORY_CONFIRM=switch($Action){'Create'{'CREATE_HISTORY_BATCH'}'Inspect'{'INSPECT_HISTORY_BATCH'}'Revert'{"REVERT_HISTORY_BATCH:$BatchCode"}}
if($ReferenceDate){$values.HOTEL_HISTORY_REFERENCE_DATE=$ReferenceDate}
$saved=@{}
try {
 $dockerArgs=@('run','--rm','--name','hotel-reservation-system-hu03-history-command','--label','purpose=explicit-tracked-demonstration-history','--network','hotel-reservation-system_default')
 foreach($key in $values.Keys){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process');[Environment]::SetEnvironmentVariable($key,$values[$key],'Process');$dockerArgs+=@('-e',$key)}
 $dockerArgs+=@('-e','SPRING_CONFIG_LOCATION=classpath:/application.properties','-e','SPRING_PROFILES_ACTIVE=demand-history','-e','HOTEL_HISTORY_DATABASE=hotel-bd','-e','SPRING_FLYWAY_ENABLED=false','-e','SPRING_JPA_HIBERNATE_DDL_AUTO=validate','-e','SPRING_DEVTOOLS_RESTART_ENABLED=false','-e','SERVER_PORT=0','-e','HOTEL_SETUP_EXIT=true','--entrypoint','java','hotel-reservation-system-test-backend-check','-jar','/work/target/hotel-reservation-system-backend-0.0.1-SNAPSHOT.jar')
 docker @dockerArgs;Check-Native
}finally{foreach($key in $saved.Keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')};$values=$null;$config=$null}
