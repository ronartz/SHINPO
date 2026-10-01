<#
.SYNOPSIS
    SHINPO Windows Production Packaging, Installer Generation & Code Signing Script.

.DESCRIPTION
    Builds the complete SHINPO Windows Desktop distribution artifact:
    1. Compiles React production bundle.
    2. Builds Tauri native Windows executable and NSIS installer (SHINPO-Setup.exe).
    3. Handles code signing (Self-signed test cert for friends / Production PFX for public distribution).
    4. Validates the Authenticode digital signature.
    5. Outputs single ready-to-run installer into ./release/.

.PARAMETER CertThumbprint
    SHA1 thumbprint of an installed Windows Code Signing Certificate.

.PARAMETER PfxPath
    Path to a .pfx code signing certificate file.

.PARAMETER PfxPassword
    Password for the .pfx certificate.

.PARAMETER TimestampServer
    RFC 3161 Authenticode timestamp server URL.

.PARAMETER SkipSigning
    Skip the code signing step (useful for rapid local dev testing).

.EXAMPLE
    .\scripts\package-windows.ps1
    Builds and signs using auto-generated self-signed certificate for friends testing.

.EXAMPLE
    .\scripts\package-windows.ps1 -PfxPath "C:\certs\my-code-sign.pfx" -PfxPassword "Secret"
    Builds and signs with a production code signing certificate.
#>

param (
    [string]$CertThumbprint,
    [string]$PfxPath,
    [string]$PfxPassword,
    [string]$TimestampServer = "http://timestamp.digicert.com",
    [switch]$SkipSigning
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  進歩 (SHINPO) Windows Desktop Installer Builder" -ForegroundColor Cyan
Write-Host "  Target: Single Standalone Installer (SHINPO-Setup.exe)" -ForegroundColor Cyan
Write-Host "  Architecture: Tauri v2 + React Cockpit + Native Rust Shield" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Build React Frontend
Write-Host "`n[1/4] Building React Cockpit production bundle..." -ForegroundColor Green
Push-Location "$PSScriptRoot/../frontend"
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
} finally {
    Pop-Location
}

# 2. Build Tauri Windows Installer
Write-Host "`n[2/4] Building Tauri Windows Native Binary and NSIS Installer..." -ForegroundColor Green
Push-Location "$PSScriptRoot/../frontend"
try {
    npx tauri build
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }
} finally {
    Pop-Location
}

# 3. Locate and Stage Artifacts
Write-Host "`n[3/4] Staging release artifacts..." -ForegroundColor Green
$BundleNsisDir = "$PSScriptRoot/../frontend/src-tauri/target/release/bundle/nsis"
$ReleaseDir = "$PSScriptRoot/../release"

if (!(Test-Path $ReleaseDir)) {
    New-Item -ItemType Directory -Path $ReleaseDir | Out-Null
}

$Installer = Get-ChildItem -Path $BundleNsisDir -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $Installer) {
    # Check alternate bundle locations
    $Installer = Get-ChildItem -Path "$PSScriptRoot/../frontend/src-tauri/target/release/bundle" -Recurse -Filter "*.exe" | Select-Object -First 1
}

if (-not $Installer) {
    Write-Error "Could not locate built NSIS installer executable in $BundleNsisDir"
    exit 1
}

$DestinationExe = "$ReleaseDir/SHINPO-Setup.exe"
Copy-Item -Path $Installer.FullName -Destination $DestinationExe -Force
Write-Host "  Staged installer: $DestinationExe" -ForegroundColor Cyan

# 4. Code Signing & Authenticode Verification
if (-not $SkipSigning) {
    Write-Host "`n[4/4] Applying Windows Authenticode Digital Signature..." -ForegroundColor Green

    # Locate signtool.exe from Windows SDK if available
    $SignTool = & {
        $kits = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue
        if ($kits) { return $kits[-1].FullName }
        return "signtool.exe"
    }

    if ($PfxPath -and (Test-Path $PfxPath)) {
        Write-Host "  Signing with PFX certificate: $PfxPath" -ForegroundColor Cyan
        & $SignTool sign /f $PfxPath /p $PfxPassword /tr $TimestampServer /td sha256 /fd sha256 "$DestinationExe"
    } elseif ($CertThumbprint) {
        Write-Host "  Signing with Certificate Thumbprint: $CertThumbprint" -ForegroundColor Cyan
        & $SignTool sign /sha1 $CertThumbprint /tr $TimestampServer /td sha256 /fd sha256 "$DestinationExe"
    } else {
        Write-Host "  No production certificate specified. Generating / using development Code Signing certificate..." -ForegroundColor Yellow
        $Cert = Get-ChildItem "Cert:\CurrentUser\My" -CodeSigningCert | Where-Object { $_.Subject -like "*SHINPO*" } | Select-Object -First 1
        if (-not $Cert) {
            $Cert = New-SelfSignedCertificate `
                -Type CodeSigning `
                -Subject "CN=SHINPO Focus Systems (Development)" `
                -CertStoreLocation "Cert:\CurrentUser\My" `
                -KeyExportPolicy Exportable `
                -NotAfter (Get-Date).AddYears(5)
            Write-Host "  Created self-signed certificate: $($Cert.Thumbprint)" -ForegroundColor Green

            # Export public cert for friends to trust
            $PublicCertPath = "$ReleaseDir/shinpo-dev-cert.cer"
            Export-Certificate -Cert $Cert -FilePath $PublicCertPath | Out-Null
            Write-Host "  Exported public certificate for distribution: $PublicCertPath" -ForegroundColor Cyan
        }

        & $SignTool sign /sha1 $Cert.Thumbprint /fd sha256 "$DestinationExe"
    }

    # Verify signature
    Write-Host "`n  Verifying Authenticode signature..." -ForegroundColor Green
    & $SignTool verify /pa "$DestinationExe"
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "  BUILD COMPLETE: $DestinationExe" -ForegroundColor Green
Write-Host "  Shareable with Windows users with ZERO dependencies required." -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
