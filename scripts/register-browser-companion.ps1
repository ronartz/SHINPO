<#
.SYNOPSIS
    SHINPO — Native Browser Companion Registration Script (Windows PowerShell)
    Registers com.shinpo.browser_companion Native Messaging Host in the Windows Registry
    for Chrome, Chromium, Brave, Edge, and Firefox.
#>

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "[SHINPO BROWSER HOST] Registering Windows Native Messaging Host..." -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Locate executable
$HostExe = $null
$Candidates = @(
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
$AppDataDir = [System.IO.Path]::Combine($env:APPDATA, "shinpo")
if (-not (Test-Path $AppDataDir)) {
    New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null
}

$ManifestPath = [System.IO.Path]::Combine($AppDataDir, "com.shinpo.browser_companion.json")

# Write Chromium Native Messaging Host Manifest
$Manifest = @{
    name = "com.shinpo.browser_companion"
    description = "SHINPO Focus Protection Browser Companion Native Host"
    path = $HostExe
    type = "stdio"
    allowed_origins = @(
        "chrome-extension://*",
        "chrome-extension://*/*"
    )
}

$Manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $ManifestPath -Encoding UTF8
Write-Host "[SHINPO BROWSER HOST] Manifest written to: $ManifestPath" -ForegroundColor Green

# Register in Windows Registry under CurrentUser
$RegistryKeys = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.shinpo.browser_companion",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.shinpo.browser_companion",
    "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.shinpo.browser_companion"
)

foreach ($Key in $RegistryKeys) {
    if (-not (Test-Path $Key)) {
        New-Item -Path $Key -Force | Out-Null
    }
    Set-ItemProperty -Path $Key -Name "(Default)" -Value $ManifestPath
    Write-Host "  [OK] Registered Registry key: $Key" -ForegroundColor Green
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "[SHINPO BROWSER HOST] Browser companion successfully registered on Windows." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan

