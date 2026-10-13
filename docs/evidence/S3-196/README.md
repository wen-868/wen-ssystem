# S3-196 · 证据包索引（消费者端身份/CSRF 适配层 · 收口总清单第 52＋58 项）

> 工作树：`D:\Users\ZXQL\wt-agents\S3-196`｜分支 `fix/s3-196-consumer-identity-csrf`｜基线 `origin/main` = `5fdd6da3`
> 「改造前」对照装置：`D:\Users\ZXQL\wt-agents\S3-196-base`（`--detach 5fdd6da3`，未改动产物）
> 全部读数都在**本机私有 MariaDB（127.0.0.1:3406）** 的两个**本单自建 scratch 库**上跑出：
> `s3196_e2e`（本单产物）与 `s3196_e2e_base`（基线产物）。生产库零写操作。

## 一、怎么复跑（按顺序）

```powershell
# 0) 依赖：两个工作树的 node_modules 均为指向主仓的 junction（不重装）
# 1) 建库（仅本单 scratch 库）
mysql -h 127.0.0.1 -P 3406 -u root -e "CREATE DATABASE IF NOT EXISTS s3196_e2e; CREATE DATABASE IF NOT EXISTS s3196_e2e_base;"
# 2) 起两个实例（各自启动期跑迁移 + 种子）
pwsh -File docs/evidence/S3-196/start-server.ps1 -Worktree D:\Users\ZXQL\wt-agents\S3-196      -DbName s3196_e2e      -Port 18096 -LogPrefix server-fixed
pwsh -File docs/evidence/S3-196/start-server.ps1 -Worktree D:\Users\ZXQL\wt-agents\S3-196-base -DbName s3196_e2e_base -Port 18097 -LogPrefix server-base
# 3) 夹具（会员/券模板/通知），两个库各跑一遍
Get-Content docs/evidence/S3-196/fixtures.sql -Raw | mysql -h 127.0.0.1 -P 3406 -u root -D s3196_e2e
Get-Content docs/evidence/S3-196/fixtures.sql -Raw | mysql -h 127.0.0.1 -P 3406 -u root -D s3196_e2e_base
# 4) 端到端矩阵（49 个写端点 × 4 腿 + 4 个读端点；含「商家 JWT 对照腿」）
node docs/evidence/S3-196/run-matrix.mjs
# 5) 真实客户端产物装置（用 miniapp/app.js 自己的 request() 生成头，再打真实后端）
node docs/evidence/S3-196/client-harness.mjs
# 6) 收工
pwsh -File docs/evidence/S3-196/stop-server.ps1 -PidFile docs/evidence/S3-196/server-fixed.pid.txt
pwsh -File docs/evidence/S3-196/stop-server.ps1 -PidFile docs/evidence/S3-196/server-base.pid.txt   # 该 pid 文件在 base 工作树
```

⚠️ 坑（本次实测）：`pwsh -File start-server.ps1 | Select-Object` **会挂住**——后台子进程持有管道写端，
`Select-Object -Last` 要等管道关闭。请直接重定向到文件后再读（本包脚本已写成"自己落日志"）。

## 二、文件清单

| 文件 | 内容 |
|:--|:--|
| `start-server.ps1` / `stop-server.ps1` | 起停「真产物 + 真库」实例（端口/库名/日志前缀参数化；只对 scratch 库） |
| `fixtures.sql` | 消费者会员（openid=`openid-s196`）+ 券模板 + 通知夹具（含复核 SELECT） |
| `run-matrix.mjs` | 49 写端点 × 4 腿 + 4 读端点矩阵；产出 `matrix-raw.json` / `matrix-report.md` / `matrix-stdout.txt` |
| `matrix-report.md` / `matrix-raw.json` | 矩阵报告（含逐端点状态码与判定）与原始 JSON |
| `client-harness.mjs` / `client-harness.json` | 真实客户端产物装置：桩化 wx/App 加载 `miniapp/app.js`，取它自己组装的 header 再打真实后端 |
| `reverse2-guard-red.txt` / `reverse2-guard-restored.txt` | 反测②：摘掉通知端点 `csrfMiddleware` ⇒ G3 EXIT=1（点名两行）；复原 ⇒ EXIT=0 |
| `server-fixed.*.log` / `server-base.*.log` | 两个实例的启动与运行日志（含迁移/种子结果） |
| `gates-*.txt` | 门禁原始输出：`tsc` / `G3 guard-route-auth` / `G2 guard-tenant-status` / `G3.6 guard-route-prefix` / `backend build` / `miniapp-release` / Taro `type-check` / `vitest run`（全量） |
| `db-fixture-evidence.txt` / `db-cart-evidence.txt` | 库里归属读数：券 `user_id=4`、通知已读、购物车 `customer_id=4 + tenant_id=default` |
| `probe-out-of-scope.mjs` / `-output.txt` | 范围外发现取证①：老端路径双段重复 ⇒ 404（对照后端真实路径 200） |
| `probe-notification-idor.mjs` / `-output.txt` / `-db.txt` | 范围外发现取证②：会员 5 可把会员 4 的通知标记已读（200 + `is_read` 0→1） |
| `hashes.md` | src/dist 指纹（防"读数属于哪份代码"不可核对，见踩坑 [159]） |

## 三、口径要点（读报告前先看）

1. **判定**：`fixed+有CSRF` 必须 ≠401/403（越过身份与 CSRF 两道门）；`fixed+无CSRF`（写方法）必须 403。
2. **消费者身份 = 绑定的会员（`t_member.id`）**：依据 `community-marketing.service.ts:704`
   「小程序用户 id 即 t_member.id」与订单表 `t_miniapp_order.member_id`→`t_member` 关联。
3. **租户来源**：令牌 `tenantId` → 请求头 `X-Tenant-Id` → 按 openid **唯一**命中会员取其租户；
   三者都不可解析（未绑定/跨租户歧义）⇒ 401，**不落库、不默认租户、不取第一条**。
   第三步为本单实现期补入并已在回执 §六 报备（老端客户端**零租户来源**，只有前两步时卡面判据不可达）。
4. **CSRF 主体**：登录下发的是 `HMAC(微信用户 id)`，而业务身份是会员 id ⇒ 适配层同时声明
   `[会员 id, 微信用户 id]` 两个等价主体（同一登录态），故老端**一个令牌即可同时用于** 微信端点与消费者端点。
