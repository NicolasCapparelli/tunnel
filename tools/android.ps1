param([ValidateSet('dev','build')][string]$Action = 'dev')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
# Prefer explicit environment configuration; fall back to Android Studio on Windows.
if (-not $env:JAVA_HOME) {
  $studioJava = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
  if (Test-Path (Join-Path $studioJava 'bin\java.exe')) { $env:JAVA_HOME = $studioJava }
}
if (-not $env:ANDROID_HOME) {
  if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT }
  else {
    $studioSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    if (Test-Path $studioSdk) { $env:ANDROID_HOME = $studioSdk }
  }
}
if ($env:JAVA_HOME) { $env:PATH = "$env:JAVA_HOME\bin;$env:PATH" }
if ($env:ANDROID_HOME) { $env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH" }
Set-Location $workspace
if ($Action -eq 'build') {
  npm.cmd run android -w @tunnel/mobile -- --variant release --no-bundler
} else {
  npm.cmd run android -w @tunnel/mobile
}
exit $LASTEXITCODE
