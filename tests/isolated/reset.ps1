$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$compose = @('compose','-p','hotel-reservation-system-test','--env-file','tests/isolated/empty.env','-f','compose.test.yaml')
$ids = @(docker ps -aq --filter 'label=com.docker.compose.project=hotel-reservation-system-test')
if ($LASTEXITCODE -ne 0) { throw 'Cannot list test resources' }
foreach ($id in $ids) {
    $item = (docker inspect $id | ConvertFrom-Json)[0]
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect test resource' }
    $service = $item.Config.Labels.'com.docker.compose.service'
    if ($item.Config.Labels.'com.docker.compose.project' -ne 'hotel-reservation-system-test' -or $service -notin @('postgres-test','backend-app','frontend-app')) { throw 'Unexpected resource; refusing cleanup' }
    $allowedNetworks = @('hotel-reservation-system-test_isolated')
    if ($service -eq 'frontend-app') { $allowedNetworks += 'hotel-reservation-system-test_web' }
    if (@($item.NetworkSettings.Networks.PSObject.Properties.Name | Where-Object { $_ -notin $allowedNetworks }).Count -ne 0) { throw 'Unexpected network' }
    foreach ($mount in $item.Mounts) {
        if ($mount.Type -ne 'bind' -or $mount.Destination -ne '/checks' -or $mount.RW) { throw 'Unexpected mount; refusing cleanup' }
    }
    if ($service -eq 'postgres-test' -and @($item.HostConfig.Tmpfs.PSObject.Properties.Name) -notcontains '/var/lib/postgresql/data') { throw 'PostgreSQL must use tmpfs' }
    Write-Host "Verified test resource: $($item.Name); service=$service; mounts=$($item.Mounts | ConvertTo-Json -Compress); tmpfs=$($item.HostConfig.Tmpfs | ConvertTo-Json -Compress)"
}
docker @compose down
if ($LASTEXITCODE -ne 0) { throw 'Test cleanup failed' }
