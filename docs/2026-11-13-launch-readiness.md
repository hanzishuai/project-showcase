# 2026-11-13 上线前检查与加固记录

基线：`feat/agent-ui-control`（HEAD 26c9124 + 本次改动）。
检查方式：两路独立只读审查（后端 / 部署）+ 本机运行时全流程走查 + 测试矩阵复跑。
审查报告原文：`_temp/audit-backend.md`、`_temp/audit-deploy.md`（`_temp/` 已 gitignore，不随仓库交付）。

## 一、阻断项与修复

| 级别 | 问题 | 处理 |
|---|---|---|
| P0 | 全站 29 个路由零鉴权，管理面/问答日志/知识库/费用接口均可匿名访问 | 新增可选 `ADMIN_TOKEN`：保护 `/api/admin/*`、`/api/v1/rag/qa/*`、`/api/v1/rag/knowledge/*`、项目写接口；管理后台首次进入弹口令框；监听非本机且未配置口令时应用层 fail-closed 拒绝启动；`start.ps1` 同时从 `.env` 读取变量并在非本机监听时强制要求 |
| P0 | 问答日志可匿名读取（1533 条 / 1214 会话） | 归入 `ADMIN_TOKEN` 保护范围；README 说明保留期与清理 |
| P0 | 未鉴权可改 `llm_base_url`，`/settings/test` 会把 LLM Key 发往任意地址 | 管理面鉴权；`llm_base_url` 限制 http(s)；密钥读接口只回 `****`；掩码值不再被写回；CSP/缓存/安全头补齐 |
| P0 | 知识库可匿名覆盖/删除/重建 | 归入 `ADMIN_TOKEN` 保护；`commit` 仍做文件名清洗，删除保留路径遍历防护；错误详情不再回显内部异常 |
| P0 | HEAD 的 `requirements.txt` 只有 6 个直接依赖，新机器必挂 | 补齐为 17 个直接依赖 + 115 行 `requirements.lock.txt`（与 .venv 完全一致）；提供 `backend/wheels/chroma_hnswlib-0.7.6-cp312-cp312-win_amd64.whl`，`start.ps1` 自动 `--find-links`，免 MSVC |
| P0 | `start.ps1` UTF-8 无 BOM，中文 Windows PowerShell 5.1 解析失败（start.cmd 无法启动） | `start.ps1` / `dev.ps1` / `scripts/backup-data.ps1` 统一改为 UTF-8 with BOM；已用 Windows PowerShell 5.1 解析 0 错误，并实际用 start.ps1 在 8099 端口启动验证 |
| P0 | 全新机器无 Chroma 索引构建步骤 | 启动预热时检测 `docs/` 有文档但集合为空则自动 `rebuild`；README 首次部署步骤补充说明 |
| P1 | 上传先读后判大小（内存 DoS） | ASR/知识库上传改为边读边计数、超限 413 |
| P1 | 无速率限制，LLM/TTS/ASR 可被刷 | `APP_RATE_LIMIT_PER_MIN`（默认 120/IP/分钟）覆盖 ask/tts/asr/agent/settings-test；WS 仍建议反向代理限流 |
| P1 | 健康检查恒 200 | 新增 `GET /api/ready`（DB SELECT 1，失败 503）；README 改用该接口 |
| P1 | SQLite 并发 / WAL / 备份一致性 | app.db 开启 WAL + busy_timeout + 外键；备份脚本改用 SQLite backup API，默认不打包 `settings.json`（`-IncludeSecrets` 可选） |
| P1 | settings.json 写入非原子；CSP 破坏 /docs；CSP Host 拼接 | 原子替换；`/docs` 等路径不套 CSP；CSP 的 ws 源改为固定 `ws: wss:` |
| P1 | 进程守护 / 日志 | README 增加 NSSM 示例；`start.ps1` 默认把应用日志写入 `backend/data/app.log`，访问日志在控制台由 NSSM 捕获 |
| P1 | .env / settings.json ACL 过宽 | README 给出 icacls 收紧示例；建议轮换曾暴露的密钥 |
| P1 | README 存在过时描述 | 更新目录树、AgentDock 挂载、/api/ready、首次部署、备份恢复、回滚、npm ci、Python/Chroma 轮子说明 |
| P2 | Chroma 遥测刷 ERROR、CORS 空值、`tts_api_key` AttributeError、settings 掩码回写、未知路径 200 等 | 已逐项修复或记录 |

## 二、验证结果（修复后，本机 127.0.0.1:8000）

| 检查 | 结果 |
|---|---|
| 后端 pytest（含鉴权/限流/健康检查 4 条） | 13 / 13 |
| 指令/接口 selftest | 55 / 55（复跑通过；模型偶发不调工具，测试内已有一次重试） |
| 浏览器 UI selftest | 27 / 27 |
| 语音闭环 selftest | 7 / 7（复跑通过；首次运行有一例 ASR/模型波动） |
| TTS 切句 selftest | 8 / 8 |
| 前端全流程审计 | 28 / 29；唯一失败是导航/页面切换产生的 `ERR_ABORTED`（浏览器正常取消，不是资源 4xx/5xx） |
| 首屏资源 | JS gzip 约 717 KB、CSS 约 60 KB；`/assets/*` 一年 immutable 缓存，`index.html` no-cache |
| 安全头 / CSP | 页面与 API 均带 nosniff / SAMEORIGIN / Referrer-Policy / CSP；`/docs` 豁免 CSP |
| 管理鉴权 | `ADMIN_TOKEN` 开启后：无口令/错口令 401，正确口令 200；管理后台口令框可正常进入；问答日志/知识库同保护 |
| 限流 | 临时把阈值设为 2 时，第 3 次 ask 返回 429 |
| fail-closed | `APP_HOST=0.0.0.0` 且无 `ADMIN_TOKEN` 时启动失败并提示 |
| 一键启动 | Windows PowerShell 5.1 下 `start.ps1` 在 8099 端口完整启动，`/api/ready` 200，`app.log` 有日志 |
| 依赖轮子 | `pip install --dry-run --find-links backend/wheels chroma-hnswlib==0.7.6` 命中本地 cp312 轮子 |

## 三、仍未完成 / 需要决策

1. **代码未推送、未打 tag**：GitHub 上的 `origin/main` 仍是旧版本；上线应推送当前提交并打 `v1.0.0`（或部署分支），部署只从 tag/CI 产物进行。
2. **公网 / 内网共享部署**：必须设置 `ADMIN_TOKEN`，并在反向代理层加 HTTPS + 登录鉴权；`ADMIN_TOKEN` 不覆盖 WebSocket（`/api/v1/rag/stream`、`/api/v1/rag/asr/stream`），公网必须由反代全站鉴权。
3. **密钥安全**：`backend/.env` 与 `backend/data/settings.json` 仍是明文，建议 icacls 收紧并轮换曾暴露的 Key；后台修改密钥会写入 settings.json，若只想用 `.env` 请在轮换后清理该文件。
4. **部署平台**：当前一键脚本只覆盖 Windows；Linux 需手动 venv + uvicorn（requirements 需重新验证，chroma-hnswlib 轮子需对应平台）。
5. **模型随机性**：Agent/语音用例偶发一例不调工具或漏回答，已有重试；若上线演示要求零波动，可考虑固定演示脚本/降低并发。
6. **前端构建体积**：仍有 >500KB chunk 警告，gzip 后约 717KB；可后续做 manualChunks / 懒加载。

## 四、上线检查清单

```powershell
# 1. 配置
Copy-Item backend\.env.example backend\.env   # 填 DASHSCOPE_API_KEY / LLM_API_KEY
# 2. 启动（首次会装依赖 + 构建）
.\start.cmd
# 3. 健康检查
Invoke-WebRequest http://127.0.0.1:8000/api/ready
Invoke-WebRequest http://127.0.0.1:8000/api/v1/rag/health
# 4. 页面验收：看板 / 总览 / 抽屉 / 灯箱 / 数据修改 / 管理后台 / 语音
# 5. 共享或内网部署
$env:APP_HOST='0.0.0.0'; $env:ADMIN_TOKEN='<强口令>'; $env:APP_PORT='8080'; .\start.ps1
# 6. 备份
powershell -ExecutionPolicy Bypass -File scripts\backup-data.ps1
```

回滚：从备份恢复 `backend/data/`，`git checkout <上一个 tag>` 后重新 `npm ci && npm run build`，重启服务。
