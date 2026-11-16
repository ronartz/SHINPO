<#
.SYNOPSIS
    SHINPO — Native Browser Companion Registration Script (Windows PowerShell)
    Registers com.shinpo.browser_companion Native Messaging Host in the Windows Registry
    for Chrome, Chromium, Brave, Edge, and Firefox.
#>

$ErrorActionPreference = "Stop"
$Uninstall = $args -contains "--uninstall"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir
$AppDataDir = [System.IO.Path]::Combine($env:APPDATA, "shinpo")
$ManifestPath = [System.IO.Path]::Combine($AppDataDir, "com.shinpo.browser_companion.json")
$FirefoxManifestPath = [System.IO.Path]::Combine($AppDataDir, "com.shinpo.browser_companion.firefox.json")
$HostName = "com.shinpo.browser_companion"

function Test-ShinpoManifest([string]$Path) {
    if (-not (Test-Path $Path -PathType Leaf)) { return $false }
    try { return (Get-Content -Raw -Path $Path | ConvertFrom-Json).name -eq $HostName }
    catch { return $false }
}

$RegistryKeys = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName",
    "HKCU:\Software\Chromium\NativeMessagingHosts\$HostName",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName",
    "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$HostName"
)
$FirefoxRegistryKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\$HostName"

if ($Uninstall) {
    foreach ($Key in $RegistryKeys) {
        if (Test-Path $Key) {
            $RegisteredPath = (Get-ItemProperty -Path $Key -Name "(Default)" -ErrorAction SilentlyContinue).'(Default)'
            if ($RegisteredPath -eq $ManifestPath) { Remove-Item -Path $Key -Force }
        }
    }
    if ((Test-Path $FirefoxRegistryKey) -and (Get-ItemProperty -Path $FirefoxRegistryKey -Name "(Default)" -ErrorAction SilentlyContinue).'(Default)' -eq $FirefoxManifestPath) {
        Remove-Item -Path $FirefoxRegistryKey -Force
    }
    foreach ($Path in @($ManifestPath, $FirefoxManifestPath)) {
        if (Test-ShinpoManifest $Path) { Remove-Item -LiteralPath $Path -Force }
    }
    exit 0
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "[SHINPO BROWSER HOST] Registering Windows Native Messaging Host..." -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Locate executable
$HostExe = $null
$Candidates = @(
    "$ScriptDir\shinpo-browser-host.exe",
    "$ProjectRoot\release\shinpo-browser-host.exe",
    "$ProjectRoot\crates\shinpo-browser-host\target\release\shinpo-browser-host.exe",
    "$ProjectRoot\target\release\shinpo-browser-host.exe",
    "$ProjectRoot\crates\shinpo-browser-host\target\debug\shinpo-browser-host.exe"
)

foreach ($Path in $Candidates) {
    if (Test-Path $Path) {
        $HostExe = (Resolve-Path $Path).Path
        break
    }
}

if (-not $HostExe) {
    Write-Host "[SHINPO BROWSER HOST] Binary not found. Building release binary via cargo..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\crates\shinpo-browser-host"
    try {
        cargo build --release
        $HostExe = (Resolve-Path "$ProjectRoot\crates\shinpo-browser-host\target\release\shinpo-browser-host.exe").Path
    } finally {
        Pop-Location
    }
}

Write-Host "[SHINPO BROWSER HOST] Target binary: $HostExe" -ForegroundColor Green

# Ensure AppData directory exists
if (-not (Test-Path $AppDataDir)) {
    New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null
}

# Write Chromium Native Messaging Host Manifest
$Manifest = @{
    name = $HostName
    description = "SHINPO Focus Protection Browser Companion Native Host"
    path = $HostExe
    type = "stdio"
    allowed_origins = @(
        "chrome-extension://ndknhgihhogcfkliohfjcllglpjdgjpj/"
    )
}

$FirefoxManifest = @{
    name = $HostName
    description = "SHINPO Focus Protection Browser Companion Native Host"
    path = $HostExe
    type = "stdio"
    allowed_extensions = @("browser-companion@shinpo.local")
}

foreach ($Path in @($ManifestPath, $FirefoxManifestPath)) {
    if ((Test-Path $Path) -and -not (Test-ShinpoManifest $Path)) {
        throw "Refusing to overwrite a non-SHINPO native host manifest: $Path"
    }
}

$Utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($ManifestPath, (($Manifest | ConvertTo-Json -Depth 5) + [Environment]::NewLine), $Utf8WithoutBom)
[System.IO.File]::WriteAllText($FirefoxManifestPath, (($FirefoxManifest | ConvertTo-Json -Depth 5) + [Environment]::NewLine), $Utf8WithoutBom)
Write-Host "[SHINPO BROWSER HOST] Manifest written to: $ManifestPath" -ForegroundColor Green

foreach ($Key in $RegistryKeys) {
    if (Test-Path $Key) {
        $RegisteredPath = (Get-ItemProperty -Path $Key -Name "(Default)" -ErrorAction SilentlyContinue).'(Default)'
        if ($RegisteredPath -and $RegisteredPath -ne $ManifestPath) {
            throw "Refusing to replace another native host registration: $Key"
        }
    } else {
        New-Item -Path $Key -Force | Out-Null
    }
    Set-ItemProperty -Path $Key -Name "(Default)" -Value $ManifestPath
    Write-Host "  [OK] Registered Registry key: $Key" -ForegroundColor Green
}

if (Test-Path $FirefoxRegistryKey) {
    $RegisteredPath = (Get-ItemProperty -Path $FirefoxRegistryKey -Name "(Default)" -ErrorAction SilentlyContinue).'(Default)'
    if ($RegisteredPath -and $RegisteredPath -ne $FirefoxManifestPath) {
        throw "Refusing to replace another native host registration: $FirefoxRegistryKey"
    }
} else {
    New-Item -Path $FirefoxRegistryKey -Force | Out-Null
}
Set-ItemProperty -Path $FirefoxRegistryKey -Name "(Default)" -Value $FirefoxManifestPath

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "[SHINPO BROWSER HOST] Browser companion successfully registered on Windows." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan

