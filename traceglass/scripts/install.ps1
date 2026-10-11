# @polsia:user-owned — local wrapper; never a remote-shell installer.
# Run the locally downloaded native Windows installer. Do not pipe remote text
# into PowerShell and do not execute a downloaded script.
[CmdletBinding()]
param(
  [switch]$Yes,
  [switch]$NoPath,
  [switch]$NoLaunch,
  [string]$InstallDir
)

$installer = Join-Path $PSScriptRoot "..\traceglass-installer.exe"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "Native installer not found: $installer. Download the signed release installer first."
}

$arguments = @()
if ($Yes) { $arguments += "--yes" }
if ($NoPath) { $arguments += "--no-path" }
if ($NoLaunch) { $arguments += "--no-launch" }
if ($InstallDir) { $arguments += @("--install-dir", $InstallDir) }

Start-Process -FilePath $installer -ArgumentList $arguments -Wait -NoNewWindow
