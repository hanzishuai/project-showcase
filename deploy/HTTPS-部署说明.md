# dou.hdc.edu.cn HTTPS 部署说明

该配置以 Linux 上已有 Nginx 为例。目标是 `https://dou.hdc.edu.cn:8000`；Nginx 监听 8000，FastAPI 改为仅监听 `127.0.0.1:18000`。当前该域名的 8000 端口已在提供 HTTP 服务，切换之前先确认进程归属、备份其配置和数据，安排短暂停机。不要直接覆盖其他服务的监听配置。

1. 在服务器现有 Nginx 配置中确认没有其他 server 占用 `8000`；确认 18000 空闲，若不空闲则同时修改后端和配置中的上游端口。
2. 通过安全渠道将证书包送至服务器，证书链保存为 `/etc/nginx/ssl/hdc.edu.cn.pem`，私钥保存为 `/etc/nginx/ssl/hdc.edu.cn.key`；限制私钥权限，只允许 Nginx 主进程读取。不要把私钥放入代码目录或提交到 Git。证书需要完整链，服务端配置中的路径以实际文件为准。
3. 创建 `/etc/nginx/auth/project-showcase.htpasswd`，按服务器的密码管理流程创建访问账号；该配置要求全站 HTTP Basic 鉴权，覆盖页面、API、SSE 和 WebSocket。请勿把明文口令或 htpasswd 文件提交到仓库。
4. 将 `deploy/dou.hdc.edu.cn.nginx.conf` 放入服务器 Nginx 的 `http {}` 包含目录。先检查 `nginx -t`，通过后再执行 Nginx 重载；保留原配置以便回滚。
5. 根据服务器原有服务管理方式，将项目后端改为监听 `127.0.0.1:18000`。例如手动启动：`APP_HOST=127.0.0.1 backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 18000`。此示例不含守护进程或开机自启配置；不要在不确认原服务的情况下执行。服务器应使用自己的持久化数据库路径、模型密钥和管理口令，不从本机复制运行数据库或密钥。
6. 确认 DNS 指向服务器并放通 TCP 8000。浏览器访问 `https://dou.hdc.edu.cn:8000`，验证证书、登录、页面、`/api/ready`、项目图片、Agent 流式响应以及语音 WebSocket。使用系统信任链正常验证，勿用 `-k` 作为最终验收。
7. 若验证失败，先恢复原监听和配置，检查 `nginx -t`、Nginx 错误日志及后端日志。切换和回滚都不应删除或覆盖现有数据库。

Nginx 的 Basic 鉴权是应用级 `ADMIN_TOKEN` 的前置保护，不能代替系统的用户和角色权限；外部代理或负载均衡若位于 Nginx 前，还需按真实网络拓扑配置客户端 IP 和可信代理。
