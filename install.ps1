# Team KID - one-line installer / updater for Windows.
#
#   irm https://raw.githubusercontent.com/bankkeo1110/teamKid/main/install.ps1 | iex
#
# Downloads the latest kit from GitHub into %LOCALAPPDATA%\TeamKID and runs Install-TeamKID.ps1.
# Run it again any time to update: finished steps are skipped, new tools are installed.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repoZip = 'https://github.com/bankkeo1110/teamKid/archive/refs/heads/main.zip'
$root = Join-Path $env:LOCALAPPDATA 'TeamKID'
$zip = Join-Path $env:TEMP ('teamkid-' + [guid]::NewGuid().ToString('N') + '.zip')

Write-Host ''
Write-Host '  Team KID - downloading the latest version from GitHub...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $root | Out-Null
Invoke-WebRequest -Uri $repoZip -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $root -Force
Remove-Item $zip -Force -ErrorAction SilentlyContinue
$kit = Join-Path $root 'teamKid-main'
if (-not (Test-Path (Join-Path $kit 'Install-TeamKID.ps1'))) { throw "Download looks incomplete: $kit" }
Write-Host ('  Version ' + (Get-Content (Join-Path $kit 'VERSION') -ErrorAction SilentlyContinue)) -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$(Join-Path $kit 'Install-TeamKID.ps1')`"")
