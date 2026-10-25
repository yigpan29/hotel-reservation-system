param([switch]$SkipBuild, [switch]$SkipE2E)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location -LiteralPath $root
$compose = @('compose', '-p', 'hotel-reservation-system-test', '--env-file', 'tests/isolated/empty.env', '-f', 'compose.test.yaml')
$report = Join-Path $root ('.local/isolated/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $report | Out-Null
# Create bind-mount parents as the invoking user before Docker can create them as root.
# CI must be able to write application.log beside the container-generated reports.
foreach ($directory in @('.local/isolated-artifacts/backend', '.local/isolated-artifacts/e2e')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $root $directory) | Out-Null
}
function Invoke-Check {
    param([string]$Name, [string[]]$DockerArgs, [switch]$AllowFailure)
    $ErrorActionPreference = 'Continue'
    & docker @compose @DockerArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath (Join-Path $report "$Name.log") | Out-Host
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    Add-Content -LiteralPath (Join-Path $report 'results.txt') -Value "$Name=$code"
    if ($code -ne 0 -and -not $AllowFailure) { throw "$Name failed ($code). See $report" }
    return $code
}
$configJson = & docker @compose config --format json
if ($LASTEXITCODE -ne 0) { throw 'Invalid Compose' }
$config = $configJson | ConvertFrom-Json
if ($config.name -ne 'hotel-reservation-system-test' -or -not $config.networks.isolated.internal) { throw 'Unexpected project/network' }
foreach ($entry in $config.services.PSObject.Properties) {
    $service = $entry.Value
    if ($service.env_file) { throw 'env_file forbidden' }
    foreach ($port in $service.ports) {
        $allowedPort = if ($entry.Name -eq 'frontend-app') { '55173' } else { '' }
        if ($port.host_ip -ne '127.0.0.1' -or [string]$port.published -ne $allowedPort) { throw 'Unexpected published port' }
    }
    $expectedNetworks = if ($entry.Name -eq 'frontend-app') { 'isolated,web' } else { 'isolated' }
    if ((@($service.networks.PSObject.Properties.Name | Sort-Object) -join ',') -ne $expectedNetworks) { throw 'Unexpected network' }
    foreach ($mount in $service.volumes) {
        $reportMount = $mount.target -eq '/reports' -and $mount.source.Replace('\','/').Contains('/.local/isolated-artifacts/')
        if ($mount.type -ne 'bind' -or (-not $reportMount -and (-not $mount.read_only -or $mount.target -ne '/checks'))) { throw 'Unexpected mount' }
    }
}
$existing = & docker ps -aq --filter 'label=com.docker.compose.project=hotel-reservation-system-test'
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect Docker' }
if ($existing) { throw 'Existing test resources: inspect them and remove only this project before starting a fresh run. See README.' }
if (-not $SkipBuild) {
    $buildServices = @('build','backend-check','frontend-check','flyway-check')
    if (-not $SkipE2E) { $buildServices += 'e2e' }
    $null = Invoke-Check 'images' $buildServices
}
$null = Invoke-Check 'postgres-start' @('up', '-d', '--wait', 'postgres-test')
$runtimeJson = & docker inspect hotel-reservation-system-test-postgres-test-1
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect test PostgreSQL' }
$runtime = ($runtimeJson | ConvertFrom-Json)[0]
if ($runtime.HostConfig.PortBindings.PSObject.Properties.Count -gt 0) { throw 'Unexpected published PostgreSQL port' }
if (-not $runtime.HostConfig.Tmpfs.'/var/lib/postgresql/data') {
    if (@($runtime.HostConfig.Tmpfs.PSObject.Properties.Name) -notcontains '/var/lib/postgresql/data') { throw 'Missing tmpfs' }
}
if ((@($runtime.NetworkSettings.Networks.PSObject.Properties.Name) -join ',') -ne 'hotel-reservation-system-test_isolated') { throw 'Unexpected runtime network' }
foreach ($mount in $runtime.Mounts) {
    if ($mount.Type -ne 'bind' -or $mount.RW -or $mount.Destination -ne '/checks') { throw 'Unexpected PostgreSQL mount' }
}
$null = Invoke-Check 'legacy-restore' @('exec', '-T', 'postgres-test', 'sh', '/checks/schema/prepare.sh')
$null = Invoke-Check 'flyway-new' @('run', '--rm', '--no-deps', 'flyway-check', 'hotel_test', 'migrate-v1')
$null = Invoke-Check 'flyway-new-repeat' @('run', '--rm', '--no-deps', 'flyway-check', 'hotel_test', 'migrate-v1')
$rejected = Invoke-Check 'legacy-without-baseline' @('run', '--rm', '--no-deps', 'flyway-check', 'hotel_adopt', 'migrate') -AllowFailure
if ($rejected -eq 0 -or -not (Select-String -LiteralPath (Join-Path $report 'legacy-without-baseline.log') -Pattern 'non-empty schema.*no schema history' -Quiet)) { throw 'Expected Flyway baseline protection was not demonstrated' }
$null = Invoke-Check 'flyway-baseline' @('run', '--rm', '--no-deps', 'flyway-check', 'hotel_adopt', 'baseline')
$null = Invoke-Check 'flyway-adopt' @('run', '--rm', '--no-deps', 'flyway-check', 'hotel_adopt', 'migrate-v1')
$null = Invoke-Check 'schema-data-comparison-v1' @('exec', '-T', 'postgres-test', 'sh', '/checks/schema/compare.sh')
foreach ($db in @('hotel_test', 'hotel_adopt')) {
    $null = Invoke-Check "migrate-v2-$db" @('run', '--rm', '--no-deps', 'flyway-check', $db, 'migrate')
}
$null = Invoke-Check 'flyway-full-repeat' @('run', '--rm', '--no-deps', 'flyway-check', 'hotel_test', 'migrate')
foreach ($db in @('hotel_test', 'hotel_adopt')) {
    $null = Invoke-Check "validate-$db" @('run', '--rm', '--no-deps', 'flyway-check', $db, 'validate')
}
$null = Invoke-Check 'schema-data-comparison-v2' @('exec', '-T', 'postgres-test', 'sh', '/checks/schema/compare-v2.sh')
$null = Invoke-Check 'clean-application-bootstrap' @('run', '--rm', '--no-deps', 'bootstrap-check')
$blocked = Invoke-Check 'backend-wrong-db' @('run', '--rm', '--no-deps', '-e', 'SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/hotel-bd', 'backend-check') -AllowFailure
if ($blocked -ne 64 -or -not (Select-String -LiteralPath (Join-Path $report 'backend-wrong-db.log') -Pattern 'ISOLATED_DATASOURCE_REJECTED' -Quiet)) { throw 'Backend URL guard did not reject as expected' }
$blocked = Invoke-Check 'flyway-wrong-db' @('run', '--rm', '--no-deps', '-e', 'FLYWAY_URL=jdbc:postgresql://postgres:5432/hotel-bd', 'flyway-check', 'hotel_test', 'info') -AllowFailure
if ($blocked -ne 64 -or -not (Select-String -LiteralPath (Join-Path $report 'flyway-wrong-db.log') -Pattern 'ISOLATED_DATASOURCE_REJECTED' -Quiet)) { throw 'Flyway URL guard did not reject as expected' }
$backend = Invoke-Check 'backend-verify' @('run', '--rm', '--no-deps', 'backend-check') -AllowFailure
$frontend = Invoke-Check 'frontend-checks' @('run', '--rm', '--no-deps', 'frontend-check') -AllowFailure
if (Select-String -Path (Join-Path $report '*.log') -Pattern 'Flyway upgrade recommended|support has not been tested' -Quiet) { throw 'Unsupported Flyway/database combination' }
Write-Host "Reports: $report. PostgreSQL remains available only inside the isolated network."
if ($backend -ne 0 -or $frontend -ne 0) { exit 1 }
if (-not $SkipE2E) {
    $null = Invoke-Check 'application-start' @('up', '-d', '--wait', 'backend-app', 'frontend-app')
    $null = Invoke-Check 'playwright' @('run', '--rm', '--no-deps', '-e', ('PLAYWRIGHT_REPORT_DIR=/reports/' + (Split-Path $report -Leaf)), 'e2e')
}
Write-Host 'All requested checks passed. Demo: http://127.0.0.1:55173 (test resources only).'
