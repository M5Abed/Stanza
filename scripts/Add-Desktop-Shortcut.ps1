# Run once: right-click → "Run with PowerShell" to put "VibeStream" on your Desktop.
$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) { $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot 'Open-VibeStream.cmd'
if (-not (Test-Path -LiteralPath $launcher)) {
  Write-Error "Open-VibeStream.cmd not found at: $launcher"
}
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'VibeStream.lnk'
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($lnkPath)
$sc.TargetPath = $launcher
$sc.WorkingDirectory = $projectRoot
$sc.WindowStyle = 1
$sc.Description = 'VibeStream — dev mode'
$sc.Save()
Write-Host "Created: $lnkPath"
