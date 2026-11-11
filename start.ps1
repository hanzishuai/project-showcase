# 项目实践聚合平台 · 一键启动（后端 FastAPI + 前端 Vue 构建产物）
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'
$dist = Join-Path $root 'frontend\dist\index.html'

if (-not (Test-Path $py)) {
  Write-Host '[1/3] 创建 Python 虚拟环境并安装后端依赖...' -ForegroundColor Cyan
  Push-Location $root
  uv venv backend\.venv --python 3.12
  uv pip install --python $py -r backend\requirements.txt
  Pop-Location
} else {
  Write-Host '[1/3] Python 虚拟环境已就绪' -ForegroundColor DarkGray
}

if (-not (Test-Path $dist)) {
  Write-Host '[2/3] 安装前端依赖并构建 Vue 应用...' -ForegroundColor Cyan
  Push-Location (Join-Path $root 'frontend')
  cmd /c 'npm install --no-audit --no-fund'
  cmd /c 'npm run build'
  Pop-Location
} else {
  Write-Host '[2/3] 前端构建产物已就绪' -ForegroundColor DarkGray
}

Write-Host '[3/3] 启动服务：http://127.0.0.1:8000 （API 文档 /docs）' -ForegroundColor Green
# 等服务起来再开浏览器，避免首屏连接被拒
Start-Job -ScriptBlock { Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8000' } | Out-Null
Push-Location $root
& $py -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
Pop-Location
