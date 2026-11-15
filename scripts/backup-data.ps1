# 备份 backend/data（SQLite 使用 backup API，Chroma/知识库目录另存）
# 用法：powershell -ExecutionPolicy Bypass -File scripts\backup-data.ps1 [-Destination <目录>] [-IncludeSecrets]
param(
  [string]$Destination,
  [switch]$IncludeSecrets
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $py)) { $py = 'python' }

$script = Join-Path $root 'scripts\backup_data.py'
$arguments = @($script)
if ($Destination) { $arguments += @('--destination', $Destination) }
if ($IncludeSecrets) { $arguments += '--include-secrets' }

& $py @arguments
if ($LASTEXITCODE -ne 0) { throw '备份失败' }
