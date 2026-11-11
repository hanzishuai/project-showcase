# 开发模式：后端 8000 + 前端 5173（Vite 热更新，代理 /api 与 /media）
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root'; & '$py' -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000"
Push-Location (Join-Path $root 'frontend')
cmd /c 'npm run dev'
Pop-Location
