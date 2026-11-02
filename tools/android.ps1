param([ValidateSet('dev','build','apk')][string]$Action = 'dev')
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
Set-Location (Join-Path $workspace 'apps/mobile')
# Expo run:android reuses an existing native project. Refresh launcher resources first.
& node (Join-Path $workspace 'node_modules/expo/bin/cli') prebuild --platform android --no-install --no-clean
if ($LASTEXITCODE -ne 0) { throw 'Android prebuild failed.' }
Set-Location $workspace
if ($Action -eq 'apk') {
  Push-Location (Join-Path $workspace 'apps/mobile/android')
  try {
    & .\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a' --console=plain --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed.' }
  } finally { Pop-Location }
  Write-Host 'Standalone ARM64 APK: apps/mobile/android/app/build/outputs/apk/release/app-release.apk'
} elseif ($Action -eq 'build') {
  npm.cmd run android -w @tunnel/mobile -- --variant release --no-bundler
} else {
  npm.cmd run android -w @tunnel/mobile
}
exit $LASTEXITCODE
