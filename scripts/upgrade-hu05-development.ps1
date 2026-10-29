param([switch]$Apply)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Read-Database([string]$Sql) {
    $result = $Sql | docker compose exec -T postgres sh -c 'psql -X -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    if ($LASTEXITCODE -ne 0) { throw 'Database inspection failed' }
    return @($result)
}
function Wait-Backend {
    $deadline = (Get-Date).AddSeconds(180)
    do {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/health' -TimeoutSec 3
            if ($response.StatusCode -eq 200 -and ($response.Content | ConvertFrom-Json).status -eq 'UP') { return }
        } catch { }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw 'Backend did not become healthy; inspect docker compose logs backend'
}

$target = @(Read-Database "SELECT current_database() || '|' || current_user || '|' || current_setting('server_version_num');")
if ($target.Count -ne 1 -or $target[0] -notmatch '^hotel-bd\|root\|17[0-9]+$') { throw "Unexpected target: $target" }
$history = Read-Database "SELECT version || '|' || script || '|' || coalesce(checksum::text,'baseline') FROM flyway_schema_history WHERE version IN ('2','3','4') AND success ORDER BY installed_rank;"
$expected = @('2|V2__booking_foundations.sql|1056223929','3|V3__tracked_demonstration_history.sql|497165249','4|V4__reservation_notifications.sql|177359749')
if (($history -join "`n") -ne ($expected -join "`n")) { throw 'Unsupported migration lineage; no changes made' }
$extra = Read-Database "SELECT version FROM flyway_schema_history WHERE version NOT IN ('1','2','3','4','5','8') OR NOT success;"
if ($extra.Count) { throw 'Unexpected migration history; no changes made' }
Write-Host "Confirmed development target: $target"
Write-Host 'Plan: validate immutable V1-V4, add compatibility V5 and checkout V8, validate Hibernate, compare original data. No backup or history repair.'
if (-not $Apply) { return }

$tables = @('users','hotels','rooms','reservations','payments','reviews','reservation_demo_batches','reservation_demo_items','reservation_notifications','flyway_schema_history')
$queries = foreach ($table in $tables) {
    $expression = switch ($table) {
        'rooms' { "to_jsonb(x)-'capacity'" }
        'reservations' { "to_jsonb(x)-'adults'-'children'-'room_type'" }
        default { 'to_jsonb(x)' }
    }
    $filter = if ($table -eq 'flyway_schema_history') { "WHERE version IN ('1','2','3','4')" } else { '' }
    "SELECT '$table',count(*),md5(coalesce(string_agg(($expression)::text,chr(10) ORDER BY ($expression)::text),'')) FROM $table x $filter;"
}
$fingerprintSql = $queries -join "`n"
$before = Read-Database $fingerprintSql
$sequences = "SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' AND sequencename IN ('users_id_seq','hotels_id_seq','rooms_id_seq','reservations_id_seq','payments_id_seq','reviews_id_seq','reservation_notifications_id_seq') ORDER BY sequencename;"
$beforeSequences = Read-Database $sequences
New-Item -ItemType Directory -Force .local | Out-Null
$before | Set-Content -LiteralPath .local/integration-original-fingerprints.txt

docker compose run --rm --no-deps backend mvn -B -ntp -DskipTests package
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed; database has not been migrated' }
docker compose -f compose.yaml -f compose.legacy-hu05.yaml up -d --no-deps --force-recreate backend
if ($LASTEXITCODE -ne 0) { throw 'Migration startup failed' }
Wait-Backend
$after = Read-Database $fingerprintSql
$afterSequences = Read-Database $sequences
if (($before -join "`n") -ne ($after -join "`n") -or ($beforeSequences -join "`n") -ne ($afterSequences -join "`n")) {
    throw 'Original data/sequence comparison failed; inspect before continuing'
}
Write-Host 'ORIGINAL_DATA_HISTORY_AND_SEQUENCES_PRESERVED'
docker compose up -d --no-deps --force-recreate backend
if ($LASTEXITCODE -ne 0) { throw 'Regular backend startup failed' }
Wait-Backend
Write-Host 'REGULAR_COMPOSE_BACKEND_HEALTH_200_UP'
