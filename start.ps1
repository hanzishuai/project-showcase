# 项目实践聚合平台 · 一键启动（后端 FastAPI + 前端 Vue 构建产物）
# 可选环境变量（也可写在 backend/.env 里）：
#   APP_HOST  监听地址（默认 127.0.0.1；内网访问可设 0.0.0.0）
#   APP_PORT  监听端口（默认 8000）
#   ADMIN_TOKEN  管理口令（监听非本机地址时必填，除非 ALLOW_INSECURE=1）
#   ALLOW_INSECURE=1  已由反向代理做登录鉴权时跳过 ADMIN_TOKEN 检查
#   APP_FORCE_BUILD=1  强制重新构建前端
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'
$dist = Join-Path $root 'frontend\dist\index.html'
$requirements = Join-Path $root 'backend\requirements.txt'
$envFile = Join-Path $root 'backend\.env'
$wheelDir = Join-Path $root 'backend\wheels'

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $text = $line.Trim()
    if (-not $text -or $text.StartsWith('#') -or -not $text.Contains('=')) { continue }
    $index = $text.IndexOf('=')
    $key = $text.Substring(0, $index).Trim()
    $value = $text.Substring($index + 1).Trim().Trim('"').Trim("'")
    if ($key) { $map[$key] = $value }
  }
  return $map
}

$dotEnv = Read-DotEnv $envFile
$appHost = if ($env:APP_HOST) { $env:APP_HOST } elseif ($dotEnv.ContainsKey('APP_HOST')) { $dotEnv['APP_HOST'] } else { '127.0.0.1' }
$appPort = if ($env:APP_PORT) { $env:APP_PORT } elseif ($dotEnv.ContainsKey('APP_PORT')) { $dotEnv['APP_PORT'] } else { '8000' }
$adminToken = if ($env:ADMIN_TOKEN) { $env:ADMIN_TOKEN } elseif ($dotEnv.ContainsKey('ADMIN_TOKEN')) { $dotEnv['ADMIN_TOKEN'] } else { '' }
$allowInsecure = if ($env:ALLOW_INSECURE) { $env:ALLOW_INSECURE } elseif ($dotEnv.ContainsKey('ALLOW_INSECURE')) { $dotEnv['ALLOW_INSECURE'] } else { '' }

# 供应用启动时做「非本机必须鉴权」的 fail-closed 检查
$env:APP_HOST = $appHost
if ($adminToken) { $env:ADMIN_TOKEN = $adminToken }

Write-Host ('[0/3] 监听地址：{0}:{1}' -f $appHost, $appPort) -ForegroundColor DarkGray
if ($adminToken) { Write-Host '      管理口令已启用（ADMIN_TOKEN）' -ForegroundColor DarkGray }

if ($appHost -ne '127.0.0.1' -and $appHost -ne 'localhost' -and -not $adminToken -and $allowInsecure -ne '1') {
  Write-Host '监听非本机地址时必须设置 ADMIN_TOKEN（管理后台/问答日志/知识库/项目写接口需要口令）。' -ForegroundColor Red
  Write-Host '如果已有反向代理做登录鉴权，可设置 ALLOW_INSECURE=1 跳过该检查。' -ForegroundColor Yellow
  throw '缺少 ADMIN_TOKEN'
}

if (-not (Test-Path $envFile)) {
  Write-Host '      未找到 backend\.env：语音/问答将使用默认配置，可复制 backend\.env.example 后填写密钥。' -ForegroundColor Yellow
}

# 1) Python 虚拟环境
if (-not (Test-Path $py)) {
  Write-Host '[1/3] 创建 Python 虚拟环境并安装后端依赖（首次需要几分钟）...' -ForegroundColor Cyan
  Push-Location $root
  try {
    $findLinks = @()
    if (Test-Path $wheelDir) { $findLinks = @('--find-links', $wheelDir) }
    $uv = Get-Command uv -ErrorAction SilentlyContinue
    if ($uv) {
      & uv venv backend\.venv --python 3.12
      if ($LASTEXITCODE -ne 0) { throw 'uv venv 失败' }
      & uv pip install --python $py @findLinks -r $requirements
    } else {
      Write-Host '      未找到 uv，改用 python -m venv（会更慢，但无需额外安装）' -ForegroundColor DarkGray
      $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
      if ($pyLauncher) { & py -3.12 -m venv backend\.venv } else { & python -m venv backend\.venv }
      if ($LASTEXITCODE -ne 0) { throw '创建虚拟环境失败，请确认已安装 Python 3.12' }
      & $py -m pip install --upgrade pip
      & $py -m pip install @findLinks -r $requirements
    }
    if ($LASTEXITCODE -ne 0) { throw '后端依赖安装失败' }
  } finally {
    Pop-Location
  }
} else {
  Write-Host '[1/3] Python 虚拟环境已就绪' -ForegroundColor DarkGray
}

# 2) 前端构建
$needBuild = ($env:APP_FORCE_BUILD -eq '1') -or (-not (Test-Path $dist))
if ($needBuild) {
  Write-Host '[2/3] 安装前端依赖并构建 Vue 应用...' -ForegroundColor Cyan
  Push-Location (Join-Path $root 'frontend')
  try {
    if (Test-Path 'package-lock.json') { cmd /c 'npm ci --no-audit --no-fund' } else { cmd /c 'npm install --no-audit --no-fund' }
    if ($LASTEXITCODE -ne 0) { throw 'npm 安装失败，请确认已安装 Node.js 20+' }
    cmd /c 'npm run build'
    if ($LASTEXITCODE -ne 0) { throw 'npm run build 失败' }
  } finally {
    Pop-Location
  }
} else {
  Write-Host '[2/3] 前端构建产物已就绪（重新构建：设置 APP_FORCE_BUILD=1）' -ForegroundColor DarkGray
}

# 3) 启动服务
$listener = Get-NetTCPConnection -State Listen -LocalPort ([int]$appPort) -ErrorAction SilentlyContinue
if ($listener) {
  Write-Host ('端口 {0} 已被占用，请先关闭占用进程，或设置 APP_PORT 换一个端口。' -f $appPort) -ForegroundColor Red
  throw '端口被占用'
}

$appLog = Join-Path $root 'backend\data\app.log'
$env:APP_LOG_FILE = $appLog
Write-Host ('[3/3] 启动服务：http://{0}:{1} （健康检查 /api/ready，API 文档 /docs）' -f $appHost, $appPort) -ForegroundColor Green
Write-Host ('      应用日志：{0}（访问日志在控制台；用 NSSM 时请同时重定向 stdout/stderr）' -f $appLog) -ForegroundColor DarkGray
if ($appHost -ne '127.0.0.1' -and $appHost -ne 'localhost') {
  Write-Host '      提示：管理接口已按 ADMIN_TOKEN 鉴权；公网仍建议在反向代理层加 HTTPS 与登录。' -ForegroundColor Yellow
}
Start-Job -ScriptBlock { param($url) Start-Sleep -Seconds 2; Start-Process $url } -ArgumentList ('http://127.0.0.1:' + $appPort) | Out-Null

# 不要用 2>&1 | Tee-Object：Windows PowerShell 5.1 会把原生命令 stderr 当成终止错误。
$previousEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
Push-Location $root
try {
  & $py -m uvicorn app.main:app --app-dir backend --host $appHost --port $appPort
  $serverExit = $LASTEXITCODE
} finally {
  Pop-Location
  $ErrorActionPreference = $previousEap
}
exit $serverExit
