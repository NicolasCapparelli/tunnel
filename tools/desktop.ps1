param([ValidateSet('dev','build','check','test')][string]$Action = 'dev')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$portableCargo = Join-Path $workspace '.tools\cargo'
if (Test-Path $portableCargo) {
  $env:CARGO_HOME = $portableCargo
  $env:RUSTUP_HOME = Join-Path $workspace '.tools\rustup'
  $env:PATH = "$portableCargo\bin;$env:PATH"
}
$env:CARGO_TARGET_DIR = Join-Path $workspace 'target'
Set-Location (Join-Path $workspace 'apps\desktop')
if ($Action -in @('check','test')) {
  cargo $Action --manifest-path src-tauri/Cargo.toml
} else {
  if ($Action -eq 'build') {
    npm.cmd run tauri -- build --no-bundle
  } else {
    npm.cmd run tauri -- dev
  }
}
exit $LASTEXITCODE
