$ErrorActionPreference = 'Stop'
$folder = Join-Path (Split-Path $PSScriptRoot -Parent) '.local/private-demonstration'
$target = Join-Path $folder 'demo-admin.password'
if (Test-Path -LiteralPath $target) { throw 'Ya existe el archivo privado. No se sobrescribira.' }
$secret = Read-Host 'Nueva clave privada para demo-admin (no se mostrara)' -AsSecureString
$confirmation = Read-Host 'Repetir clave' -AsSecureString
$first = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
$second = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmation)
try {
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($first)
    if ($value -cne [Runtime.InteropServices.Marshal]::PtrToStringBSTR($second)) { throw 'Las claves no coinciden' }
    if ($value.Length -lt 8 -or [Text.Encoding]::UTF8.GetByteCount($value) -gt 72) { throw 'Se requieren 8 caracteres y como maximo 72 bytes UTF-8' }
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    [IO.File]::WriteAllText($target, $value, [Text.UTF8Encoding]::new($false))
    Write-Host 'Clave guardada solo en .local/private-demonstration (ignorado por Git). No la envie por chat.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($first)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($second)
    $value = $null
    $secret.Dispose(); $confirmation.Dispose()
}
