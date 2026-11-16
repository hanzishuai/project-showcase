param(
  [ValidateRange(1,65535)][int]$UpstreamPort = 8000,
  [ValidateRange(1,65535)][int]$ListenPort = 8088,
  [switch]$Stop
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$nginxDir = Join-Path $projectRoot '.tools\nginx-1.30.6'
$nginxExe = Join-Path $nginxDir 'nginx.exe'
$configFile = Join-Path $nginxDir 'conf\project-showcase.conf'
$pidFile = Join-Path $nginxDir 'logs\project-showcase.pid'
$prefix = ($nginxDir.Replace('\','/') + '/')
$configArg = $configFile.Replace('\','/')

if ($Stop) {
  if (-not (Test-Path -LiteralPath $pidFile)) { return }
  $taskNginxPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $taskNginxPid" -ErrorAction SilentlyContinue
  if ($process -and $process.ExecutablePath -eq $nginxExe) {
    & $nginxExe -p $prefix -c $configArg -s quit
    if ($LASTEXITCODE -ne 0) { throw 'Failed to stop project Nginx.' }
  }
  return
}

if ($UpstreamPort -eq $ListenPort) { throw 'Nginx and backend ports must be different.' }
if (Test-Path -LiteralPath $pidFile) {
  $existingValue = (Get-Content -LiteralPath $pidFile -Raw).Trim()
  $existingPid = 0
  if ([int]::TryParse($existingValue, [ref]$existingPid)) {
    $existingProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $existingPid" -ErrorAction SilentlyContinue
    if ($existingProcess -and $existingProcess.ExecutablePath -eq $nginxExe) { throw 'Project Nginx is already running. Stop it before starting another instance.' }
  }
}
if (Get-NetTCPConnection -State Listen -LocalPort $ListenPort -ErrorAction SilentlyContinue) {
  throw "Nginx port $ListenPort is already in use. Set NGINX_PORT to another port."
}
if (-not (Test-Path -LiteralPath $nginxExe)) {
  $archive = Join-Path $env:TEMP 'project-showcase-nginx-1.30.6.zip'
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $nginxDir) | Out-Null
  Write-Host 'Downloading official nginx 1.30.6 for Windows...'
  & curl.exe -fL --retry 2 --output $archive 'https://nginx.org/download/nginx-1.30.6.zip'
  if ($LASTEXITCODE -ne 0) { throw 'Nginx download failed.' }
  $sha = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
  if ($sha -ne 'C6EE35EDB0A861063323F709192AE50D1EEFAF2EA7D00678BD2B22D8542DC61E') { throw 'Nginx archive checksum mismatch.' }
  Expand-Archive -LiteralPath $archive -DestinationPath (Split-Path -Parent $nginxDir)
}
$templatePath = Join-Path $projectRoot 'deploy\nginx.conf.template'
$config = (Get-Content -LiteralPath $templatePath -Raw -Encoding UTF8).Replace('__NGINX_PORT__', "$ListenPort").Replace('__APP_PORT__', "$UpstreamPort")
[System.IO.File]::WriteAllText($configFile, $config, [System.Text.UTF8Encoding]::new($false))
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $nginxExe -p $prefix -c $configArg -t
$checkExit = $LASTEXITCODE
$ErrorActionPreference = $previousPreference
if ($checkExit -ne 0) { throw 'Nginx configuration check failed.' }
Start-Process -FilePath $nginxExe -ArgumentList @('-p', ('"' + $prefix + '"'), '-c', ('"' + $configArg + '"')) -WorkingDirectory $nginxDir -WindowStyle Hidden
for ($i = 0; $i -lt 40; $i++) {
  if (Get-NetTCPConnection -State Listen -LocalPort $ListenPort -ErrorAction SilentlyContinue) {
    Write-Host "Project Nginx listening on http://127.0.0.1:$ListenPort"
    return
  }
  Start-Sleep -Milliseconds 100
}
throw "Nginx did not start; inspect $nginxDir\logs\error.log"
