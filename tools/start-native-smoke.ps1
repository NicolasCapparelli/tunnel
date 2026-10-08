$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$data = Join-Path $workspace '.tools\native-smoke'
New-Item -ItemType Directory -Force $data | Out-Null
$env:TUNNEL_TEST_DATA = $data
Start-Process -FilePath (Get-Command node).Source -ArgumentList (Join-Path $workspace 'node_modules\vite\bin\vite.js'),'--host','127.0.0.1' -WorkingDirectory (Join-Path $workspace 'apps\desktop') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workspace '.tools\vite.log') -RedirectStandardError (Join-Path $workspace '.tools\vite-error.log') -PassThru | Select-Object -ExpandProperty Id | Set-Content (Join-Path $workspace '.tools\vite.pid')
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9223'
Start-Process -FilePath (Join-Path $workspace 'target\debug\tunnel-desktop.exe') -ArgumentList '--tray' -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id | Set-Content (Join-Path $workspace '.tools\native.pid')
