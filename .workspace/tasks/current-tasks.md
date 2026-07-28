# 当前任务文件

> 仓库：https://github.com/wen-868/wen-ssystem  
> 唯一分支：main  
> 最后更新：2026-07-28  
> 凌舟维护

---

## 一、活跃轮次

### R63 — 全系统梳理与系统性修复 [进行中 — 凌舟 2026-07-28]

> **日期**：2026-07-28
> **来源**：用户要求"做一个全部的系统化的梳理，把所有问题列出来，进行规范化系统性修复"
> **说明**：对数据库表名、迁移脚本、后端代码、环境变量、Nginx配置、SSL证书、API路由六大维度全量扫描，发现40个问题，分P0/P1/P2三级系统性修复

#### 全系统梳理问题汇总（40个）

| 级别 | 数量 | 说明 |
|:----:|:----:|------|
| P0 | 12 | 阻断核心功能（缺失表、密码哈希、环境变量散落、部署脚本缺失等） |
| P1 | 16 | 功能隐患（双重认证、重复路由、配置不一致等） |
| P2 | 12 | 代码质量（命名规范、冗余代码、文档缺失等） |

---

#### R63-01 — [P0] 补建3张缺失表（t_quick_entries/t_tenant_config/t_upload_file）

- **优先级**：P0
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已修复
- **文件**：`docs/migrations/115_missing_tables.sql`
- **问题**：`t_quick_entries`、`t_tenant_config`、`t_upload_file` 三张表在后端代码中被引用，但 init_database.sql 和所有迁移脚本中均无 CREATE TABLE 语句。新环境部署后快捷入口、存储配额检测、文件上传功能会运行时报错
- **修复**：创建迁移脚本 `115_missing_tables.sql`，补建3张表，字段结构根据代码中的 SQL 查询反推
- **验收标准**：服务器执行后 `SHOW TABLES LIKE 't_quick_entries'` 返回1行

#### R63-02 — [P0] 环境变量统一纳入 env.ts（10个散落变量）

- **优先级**：P0
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已修复
- **文件**：`backend/src/config/env.ts`、`backend/.env.example`、`backend/src/server.ts`、`backend/src/shared/logger.ts`、`backend/src/shared/feishu-report.ts`、`backend/src/middleware/error-handler.ts`、`backend/src/services/admin/push.service.ts`
- **问题**：10个环境变量散落在代码中直接 `process.env.XXX` 读取，未纳入 env.ts 集中管理：
  1. `LOG_LEVEL`（logger.ts）
  2. `CORS_ORIGINS`（server.ts）
  3. `FEISHU_WEBHOOK_URL`（feishu-report.ts）
  4. `FEISHU_ALERT_WEBHOOK_URL`（error-handler.ts、server.ts）
  5. `JPUSH_APP_KEY`/`JPUSH_MASTER_SECRET`（push.service.ts）
  6. `FCM_PROJECT_ID`/`FCM_ACCESS_TOKEN`（push.service.ts）
  7. `HMS_APP_ID`/`HMS_APP_SECRET`（push.service.ts）
- **修复**：
  1. env.ts 新增10个环境变量定义，带注释和默认值
  2. .env.example 补充推送服务变量区块
  3. 所有文件中的 `process.env.XXX` 替换为 `env.XXX`
  4. server.ts CORS 配置改用 `env.CORS_ORIGINS`
  5. logger.ts 日志级别改用 `env.LOG_LEVEL`
  6. error-handler.ts、feishu-report.ts、server.ts 飞书 webhook 改用 `env.FEISHU_ALERT_WEBHOOK_URL`
  7. push.service.ts 6个推送变量改用 `env.JPUSH_APP_KEY` 等
- **验收标准**：`grep -rn 'process\.env\.' backend/src/ --include='*.ts' | grep -v 'env.ts' | grep -v '__tests__' | grep -v 'NODE_ENV'` 不应出现已纳入 env.ts 的10个变量

#### R63-03 — [P0] auto-deploy.sh 安全修复 + 前端部署补全

- **优先级**：P0
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已修复
- **文件**：`deploy/auto-deploy.sh`
- **问题**：
  1. JWT_SECRET 硬编码为固定字符串 `zhixiang_liquor_jwt_secret_2026_secure`，所有环境共享同一密钥
  2. CSRF_SECRET 未检测占位符
  3. 缺少 saas-admin 前端部署步骤
  4. 缺少 app-mobile 商户端 H5 部署步骤
  5. 缺少 admin-web 前端部署步骤
- **修复**：
  1. JWT_SECRET 改为 `openssl rand -base64 32` 动态生成
  2. 新增 CSRF_SECRET 占位符检测和动态生成
  3. 新增 admin-web → `/var/www/admin-web` 部署
  4. 新增 saas-admin → `/var/www/saas-admin` 部署
  5. 新增 app-mobile → `/var/www/app-mobile` 部署
- **验收标准**：服务器执行 auto-deploy.sh 后，5个域名全部返回200且内容正确

#### R63-04 — [P1] 需服务器执行的迁移脚本清单

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：⬜ 待执行（需用户在服务器操作）
- **问题**：以下迁移脚本在代码中已创建，但服务器数据库尚未执行
- **待执行清单**：

| 序号 | 文件 | 说明 | 状态 |
|:----:|------|------|:----:|
| 1 | `075_reset_admin_password_bcrypt.sql` | 重置admin密码为bcrypt格式 | ✅ 已通过MySQL直接执行 |
| 2 | `081_platform_admin_seed_and_fix.sql` | 平台管理员建表+种子数据 | ⬜ 待执行 |
| 3 | `115_missing_tables.sql` | 补建3张缺失表 | ⬜ 待执行 |
| 4 | 全量迁移脚本（001-114） | 新环境部署时需按顺序执行 | ⬜ 视情况 |

- **验收标准**：服务器执行后，`SHOW TABLES` 包含 `t_platform_admin`、`t_quick_entries`、`t_tenant_config`、`t_upload_file`

#### R63-05 — [P1] 路由双重认证修复（102个文件）

- **优先级**：P1
- **负责人**：阿坚
- **预计**：2天
- **状态**：⬜ 待开始
- **文件**：`backend/src/routes/` 目录下102个 .routes.ts 文件
- **问题**：102个路由文件同时满足：routeConfig.auth 不是 `none`（auto-routes 自动添加认证）+ 路由内部又显式调用 `requireAuthWithTenant`。导致认证中间件执行两次（重复验证 token、重复查询用户），性能浪费
- **修复方向**：删除路由内部的 `requireAuthWithTenant` 调用，统一由 auto-routes 处理
- **验收标准**：`grep -rn 'requireAuthWithTenant' backend/src/routes/ --include='*.routes.ts' | wc -l` 返回 0

#### R63-06 — [P1] 6组跨文件重复API端点修复

- **优先级**：P1
- **负责人**：阿坚
- **预计**：1天
- **状态**：⬜ 待开始
- **问题**：6组端点在多个路由文件中重复注册，Express 只执行第一个匹配的处理器，后续重复注册不生效
  1. `GET /api/admin/reports/inventory-turnover`（admin-inventory + report）
  2. `GET /api/admin/reports/inventory-age`（admin-inventory + report）
  3. `GET /api/admin/reports/sales-ranking`（admin-report + report）
  4. `GET /api/admin/reports/sales-trend`（admin-report + report）
  5. `GET /api/admin/reports/purchase-summary`（admin-report + report）
  6. `GET /api/admin/reports/supplier-ranking`（admin-report + report）
- **修复方向**：合并到单个路由文件中，删除重复定义
- **验收标准**：`grep -rn 'inventory-turnover\|inventory-age\|sales-ranking\|sales-trend\|purchase-summary\|supplier-ranking' backend/src/routes/` 每个端点只出现1次

#### R63-07 — [P1] 8个路由文件缺少 routeConfig 导出

- **优先级**：P1
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：⬜ 待开始
- **文件**：`aftersale.routes.ts`、`community-marketing.routes.ts`、`notification.routes.ts`、`sale-return.routes.ts`、`stock-check.routes.ts`、`store-control.routes.ts`、`trace.routes.ts`、`transfer.routes.ts`
- **问题**：这8个文件缺少 routeConfig 导出，依赖文件名推断前缀，auto-routes 会打印警告
- **修复方向**：为每个文件添加 `export const routeConfig = { prefix: "...", auth: "..." }`
- **验收标准**：auto-routes 启动时无警告

#### R63-08 — [P2] 清理3个空Router文件

- **优先级**：P2
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：⬜ 待开始
- **文件**：`admin-credit.routes.ts`、`admin-system.routes.ts`、`sync.routes.ts`
- **问题**：这3个文件导出了空 Router，无任何端点，冗余代码
- **修复方向**：删除文件或在文件中添加注释说明保留原因
- **验收标准**：`grep -rn 'router\.' admin-credit.routes.ts admin-system.routes.ts sync.routes.ts` 返回0或文件已删除

#### R63 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R63-01 补建3张缺失表 | 凌舟 | P0 | 0.5天 | ✅ 已修复 |
| R63-02 环境变量统一纳入env.ts | 凌舟 | P0 | 0.5天 | ✅ 已修复 |
| R63-03 auto-deploy.sh安全修复+前端部署补全 | 凌舟 | P0 | 0.5天 | ✅ 已修复 |
| R63-04 服务器迁移脚本执行 | 凌舟 | P1 | 0.5天 | ⬜ 待执行 |
| R63-05 路由双重认证修复（102文件） | 阿坚 | P1 | 2天 | ⬜ 待开始 |
| R63-06 6组重复API端点修复 | 阿坚 | P1 | 1天 | ⬜ 待开始 |
| R63-07 8个路由文件补routeConfig | 阿坚 | P1 | 0.5天 | ⬜ 待开始 |
| R63-08 清理3个空Router文件 | 阿坚 | P2 | 0.5天 | ⬜ 待开始 |
| **合计** | — | — | **6天** | — |

#### R63 服务器待执行操作

1. **执行迁移脚本**：在服务器 MySQL 中依次执行 `081_platform_admin_seed_and_fix.sql` 和 `115_missing_tables.sql`
2. **重新部署后端**：`git pull` 后重启 Node.js 服务（auto-deploy.sh 已修复，可直接执行）
3. **验证**：5个域名分别测试登录功能

---

### R62 — 全站点实际功能验收 [进行中 — 凌舟 2026-07-28]

> **日期**：2026-07-28
> **来源**：凌舟逐站点登录实际操作验收
> **说明**：5 个域名全部 HTTPS 可达，但实际登录功能存在 P0 级阻断问题

#### 验收结果汇总

| 域名 | 页面加载 | 功能验收 | 问题 |
|------|:--------:|:--------:|------|
| `api.onepan.cn` | ✅ 200 | ✅ /health 正常 | 无 |
| `admin.onepan.cn` | ✅ 200 | ❌ 登录失败 | P0: 密码哈希格式不匹配（已修复，待服务器执行） |
| `saas.onepan.cn` | ✅ 200 | ❌ 登录失败 | P0: 字段名错误+表无数据+status类型不匹配（已修复，待服务器执行） |
| `m.onepan.cn` | ✅ 200 | ⚠️ 未测登录 | 同一密码问题，预计也无法登录 |
| `www.onepan.cn` | ✅ 200 | ⚠️ 旧版页面 | P1: 服务器官网备案号已用 sed 修复（待验证） |

#### R62-01 — [P0] 密码哈希格式不匹配导致全部端无法登录

- **优先级**：P0
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已修复（服务器已执行 UPDATE）
- **文件**：`docs/migrations/075_reset_admin_password_bcrypt.sql`
- **问题**：种子数据 `002_phase1_seed.sql` 中密码使用 SHA256 哈希存储（`240be518...`），但后端 `verifyPassword` 使用 bcrypt.compare 验证。SHA256 哈希不是 bcrypt 格式，导致所有用户永远无法登录
- **修复**：创建迁移脚本 `075_reset_admin_password_bcrypt.sql`，将 admin/store_manager/store_operator 三个用户的 password_hash 更新为 bcrypt 格式（`v2$$2b$12$...`）。服务器已通过 MySQL 直接执行 UPDATE 语句完成修复
- **验收标准**：在服务器执行迁移脚本后，admin/admin123 可成功登录 admin.onepan.cn 和 saas.onepan.cn

#### R62-02 — [P1] 服务器官网文件未更新

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已修复（服务器 sed 替换完成）
- **问题**：服务器 `/var/www/www-onepan/index.html` 是旧版本，备案号显示"京ICP备XXXXXXXX号"（占位符），但源码中已正确改为"粤ICP备2026103101号"
- **修复**：因 website-dist.tar.gz 上传失败（服务器无法访问 GitHub），改用服务器端 sed 命令直接替换备案号：`sed -i 's/京ICP备XXXXXXXX号/粤ICP备2026103101号/g' /var/www/www-onepan/index.html`
- **验收标准**：访问 `https://www.onepan.cn/` 页面底部显示"粤ICP备2026103101号"

#### R62-03 — [P0] 平台管理员登录 P0 bug（字段名错误+表无数据+status类型不匹配）

- **优先级**：P0
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已修复（代码+迁移脚本已推送）
- **文件**：`backend/src/services/platform/platform-auth.service.ts`、`backend/src/services/platform/admin-account.service.ts`、`docs/migrations/081_platform_admin_seed_and_fix.sql`
- **问题**：平台管理员登录存在 3 个 bug：
  1. `platform-auth.service.ts` SQL 查询字段名 `password` 与表结构 `password_hash` 不匹配，导致查询结果为 undefined，密码验证永远失败
  2. `t_platform_admin` 表为空，无初始管理员数据
  3. `admin-account.service.ts` 中 INSERT 引用不存在的 `created_by` 字段，UPDATE status 用字符串 `'ACTIVE'` 但表是 TINYINT(1/0)
- **修复**：
  1. SQL 查询字段 `password` → `password_hash`，接口字段同步修改
  2. 新增迁移脚本 `081_platform_admin_seed_and_fix.sql`：补充 `last_login_at`、`created_by` 缺失字段，插入默认平台超级管理员 admin/admin123
  3. INSERT 移除 `created_by`，status 改为数字 `1`；UPDATE status 从字符串改为数字映射 `1/0`
- **验收标准**：saas.onepan.cn 可用 admin/admin123 成功登录

#### R62 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R62-01 密码哈希格式修复 | 凌舟 | P0 | 0.5天 | ✅ 服务器已执行 |
| R62-02 官网文件更新 | 凌舟 | P1 | 0.5天 | ✅ sed 替换完成 |
| R62-03 平台管理员登录P0 bug | 凌舟 | P0 | 0.5天 | ✅ 代码已修复+脚本已推送 |
| **合计** | — | — | **1.5天** | — |

#### R62 待执行操作（需用户在服务器执行）

1. **执行 081 迁移脚本**：在服务器 MySQL 中执行 `docs/migrations/081_platform_admin_seed_and_fix.sql`（因服务器无法下载 GitHub 文件，需手动复制 SQL 到服务器执行）
2. **重新部署后端**：代码已推送，需在服务器 `git pull` 后重启 Node.js 服务
3. **验证登录**：admin.onepan.cn、saas.onepan.cn、m.onepan.cn 分别测试 admin/admin123 登录

---

### R61 — 全域名 HTTPS 部署 + saas.onepan.cn 新增 [✅ 已完成 — 凌舟 2026-07-28]

> **日期**：2026-07-28
> **来源**：用户要求全部域名对齐端口、备案号对接、HTTPS 正常访问
> **说明**：新增 saas.onepan.cn 超级后台域名，修正 SSL 证书文件名，部署全部前端构建产物到服务器

#### R61-01 — Nginx 配置更新 + SSL 证书路径修正 [P0]

- **优先级**：P0
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-28）
- **文件**：`deploy/nginx-production.conf`
- **问题**：SSL 证书文件名多写了 `_nginx`（如 `api.onepan.cn_nginx_bundle.pem`），导致 Nginx 找不到证书文件；saas.onepan.cn 无 server 块
- **修复**：修正所有证书路径为 `{域名}_bundle.pem` + `{域名}.key`；新增 saas.onepan.cn server 块指向 `/var/www/saas-admin`
- **验收**：`nginx -t` 通过，`nginx -s reload` 成功

#### R61-02 — saas-admin 前端构建与部署 [P0]

- **优先级**：P0
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-28）
- **文件**：`saas-admin/dist/` → 服务器 `/var/www/saas-admin/`
- **问题**：saas-admin 前端从未部署到服务器，saas.onepan.cn 返回 403
- **修复**：在工作区执行 `npm run build` 构建产物，打包为 `saas-admin-dist.tar.gz`（798KB），用户下载后上传到服务器 `/tmp/`，解压到 `/var/www/saas-admin/`
- **验收**：`curl -s -o /dev/null -w "%{http_code}" https://saas.onepan.cn/` 返回 200

#### R61-03 — app-mobile（商户端 H5）构建与部署 [P0]

- **优先级**：P0
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-28）
- **文件**：`app-mobile/dist/build/h5/` → 服务器 `/var/www/app-mobile/`
- **问题**：app-mobile 前端从未部署到服务器，m.onepan.cn 返回 500（目录不存在导致 try_files 重写循环）
- **修复**：在工作区执行 `npm run build:h5` 构建产物，打包为 `app-mobile-dist.tar.gz`（321KB），用户下载后上传到服务器 `/tmp/`，解压到 `/var/www/app-mobile/`
- **验收**：`curl -s -o /dev/null -w "%{http_code}" https://m.onepan.cn/` 返回 200

#### R61 验收结果

| 域名 | 用途 | HTTP 状态 | 结果 |
|------|------|:---------:|:----:|
| `api.onepan.cn` | 后端 API | 200 | ✅ |
| `admin.onepan.cn` | 管理后台 | 200 | ✅ |
| `m.onepan.cn` | 商户端 H5 | 200 | ✅ |
| `www.onepan.cn` | 官网 | 200 | ✅ |
| `saas.onepan.cn` | SaaS 超级后台 | 200 | ✅ |

#### R61 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R61-01 Nginx 配置 + SSL 路径修正 | 凌舟 | P0 | 0.5天 | ✅ 已完成 |
| R61-02 saas-admin 构建部署 | 凌舟 | P0 | 0.5天 | ✅ 已完成 |
| R61-03 app-mobile 构建部署 | 凌舟 | P0 | 0.5天 | ✅ 已完成 |
| **合计** | — | — | **1.5天** | — |

---

### R60 — 废弃域名 store.onepan.cn 全量清理 [✅ 已完成 — 凌舟 2026-07-28]

> **日期**：2026-07-28
> **来源**：用户确认 store.onepan.cn 已删除，需全量清理残留引用
> **说明**：store.onepan.cn 域名已从服务器删除，Nginx配置及项目代码中仍有残留，需一次性清理避免误导和部署错误

#### R60-01 — 全量清理 store.onepan.cn 引用 [P1]

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-28）
- **清理文件清单**：
  1. `backend/src/config/env.ts` — 删除 `STORE_DOMAIN` 配置项
  2. `backend/.env.example` — 删除 `STORE_DOMAIN` 和 CORS_ORIGINS 中的 store 域名
  3. `backend/src/__tests__/config/env.test.ts` — 删除 `STORE_DOMAIN` 断言
  4. `deploy/nginx-production.conf` — 已从 HTTP 重定向和 server_name 中移除
  5. `deploy/deploy-production.sh` — 删除门店终端 server 块、DNS检查、SSL申请、访问地址
  6. `deploy/05-setup-https.sh` — 删除 `STORE_DOMAIN` 变量及相关 certbot/nginx 配置
  7. `scripts/acceptance-production.mjs` — 删除门店端验收逻辑
  8. `onepan-source.html` — 删除门店终端下载卡片
  9. `www/index.html` — 删除门店终端下载卡片
  10. `tests/docs/test-plan.md` — 删除门店端测试环境地址
  11. `docs/DEPLOY.md` — 删除子域名和构建产物说明
- **验收标准**：`grep -rn 'store\.onepan\.cn\|STORE_DOMAIN' . --exclude-dir=node_modules --exclude-dir=.git` 返回 0 条
- **验证结果**：全局 grep 0 残留，env.STORE_DOMAIN 无代码引用

#### R60 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R60-01 store.onepan.cn 全量清理 | 凌舟 | P1 | 0.5天 | ✅ 已完成 |
| **合计** | — | — | **0.5天** | — |

---

### R59 — app-mobile console.log/warn 清理 [待开始 — 当前轮次]

> **日期**：2026-07-28
> **来源**：凌舟全局验收（R56/R57/R58全部完成后，全局检测发现）
> **说明**：admin-web 已清零，app-mobile 仍有38处残留

#### R59-01 — app-mobile 38处 console.log/warn 清理 [P3]

- **优先级**：P3
- **负责人**：阿澈
- **预计**：0.5天
- **状态**：⬜ 待开始
- **文件**：`app-mobile/src/` 目录下 .vue/.ts 文件（38处）
- **问题**：商户端移动端仍有38处 console.log/warn 残留，admin-web 已清零
- **修复方向**：删除开发遗留 console.log/warn，保留 catch 块中的 console.error
- **验收标准**：`grep -rn 'console\.\(log\|warn\)' app-mobile/src/ --include='*.vue' --include='*.ts' | wc -l` 返回 0

#### R59 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R59-01 app-mobile 38处console清理 | 阿澈 | P3 | 0.5天 | ⬜ 待开始 |
| **合计** | — | — | **0.5天** | — |

---

### R56 — 全局验收待修正问题 [✅ 全部完成 — 凌舟验收 2026-07-28]

> **日期**：2026-07-27
> **来源**：凌舟全局验收 + 代码质量扫描
> **验收记录**：2026-07-27 首轮验收 1/5通过 → 2026-07-28 修复后验收 5/5全部通过

| 任务 | 负责人 | 优先级 | 状态 |
|------|--------|:------:|:----:|
| R56-01 弹窗宽度7处残留 | 墨 | P2 | ✅ 已完成 |
| R56-02 admin目录33处any残留 | 阿坚 | P2 | ✅ 已完成 |
| R56-03 .env.example缺失变量说明 | 阿坚 | P1 | ✅ 已完成 |
| R56-04 TENCENT_APPID硬编码 | 阿坚 | P2 | ✅ 已完成 |
| R56-05 console.log遗留清理 | 墨 | P3 | ✅ 已完成 |

### R57 — 弹窗宽度收尾 + echarts优化 + console清理 [✅ 全部完成 — 凌舟验收 2026-07-28]

> **日期**：2026-07-28
> **来源**：R56验收后的补充修复
> **说明**：R56-01修复后又发现5处弹窗宽度遗漏，echarts全量导入导致chunk>500KB，admin-web额外console遗留

| 任务 | 负责人 | 优先级 | 状态 |
|------|--------|:------:|:----:|
| R57-01 弹窗宽度5处统一 | 墨 | P2 | ✅ 已完成 |
| R57-02 echarts按需导入（chunk≤500KB） | 墨 | P2 | ✅ 已完成 |
| R57-03 console.log清理10处 | 墨 | P3 | ✅ 已完成 |

### R58 — 后端services any清零（R55-04收尾） [✅ 全部完成 — 凌舟验收 2026-07-28]

> **日期**：2026-07-28
> **来源**：R55-04延续，后端services全量any清零
> **说明**：R58-01事务连接any（17文件110处）、R58-02即时零售适配器any（9文件50处）、R58-03 miniapp/store业务逻辑any（8文件32处）、R58-04全量回归测试
> **测试报告**：`docs/reports/test-report-2026-07-28-r58.md`

| 任务 | 负责人 | 优先级 | 状态 |
|------|--------|:------:|:----:|
| R58-01 事务连接any清零 | 阿坚 | P2 | ✅ 已完成 |
| R58-02 即时零售适配器any清零 | 阿坚 | P2 | ✅ 已完成 |
| R58-03 miniapp/store业务逻辑any清零 | 阿坚 | P2 | ✅ 已完成 |
| R58-04 全量回归测试 | 苏然 | P1 | ✅ 已完成 |

---

### R55 — 后端安全与质量遗留问题 [✅ 全部完成 — 凌舟验收 2026-07-27]

> **日期**：2026-07-22
> **来源**：全面测试报告v7 + 凌舟逐项代码级核查
> **核查结论**：v7报告16项验证全部属实（8项已修复确认 + 8项仍存在确认）
> **说明**：R54已修复P0级问题（CSRF双重注册、密码校验不一致等），本轮处理剩余P1-P3级遗留问题

#### R55-01 — retail-announcement 跨租户数据泄露 [P0] ✅ 已完成

- **优先级**：P0
- **负责人**：阿坚
- **预计**：1天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/routes/retail-announcement.routes.ts`、`backend/src/services/instant-retail/retail-announcement.service.ts`、`docs/migrations/052_add_retail_announcement.sql`
- **完成证据**：路由auth从requireAuth改为requireAuthWithTenant；新增csrfMiddleware防护写操作；service层SQL增加tenant_id过滤；DDL补充tenant_id字段。tsc无新增错误，vitest全量通过。
- **问题**：retail-announcement路由使用requireAuth（不含tenantMiddleware），表无tenant_id列，所有SQL仅按store_id过滤且storeId来自用户输入。updateAnnouncement和deleteAnnouncement仅凭id操作，连store_id都不校验。任何认证用户可跨租户访问/修改/删除其他租户公告
- **修复方向**：
  1. DDL迁移：t_retail_announcement表新增tenant_id列
  2. 路由auth从"requireAuth"改为"requireAuthWithTenant"
  3. service层所有SQL增加tenant_id过滤条件（从req.user.tenantId获取）
  4. updateAnnouncement和deleteAnnouncement增加store_id + tenant_id双重校验
  5. storeId从req.user关联查询获取，不直接信任用户输入
- **验收标准**：跨租户用户无法访问其他租户的公告数据

#### R55-02 — 双重飞书告警 [P1]

- **优先级**：P1
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **完成证据**：移除 `errorResponseInterceptor` 中的 `reportToLingZhou` 调用与 feishu-report import，简化为透传中间件（保留作响应降级扩展点）；飞书告警统一由 `errorHandler` 负责（5xx 唯一告警源）。同步改写 `error-response-interceptor.test.ts`（移除飞书告警断言，保留透传 + 不触发副作用验证）。`npx tsc --noEmit` 0 错误，`npx vitest run` 416 文件 4857 用例全部通过。
- **文件**：`backend/src/middleware/error-handler.ts`、`backend/src/shared/error-response-interceptor.ts`、`backend/src/__tests__/shared/error-response-interceptor.test.ts`
- **问题**：errorHandler（第63/96行）和errorResponseInterceptor（第33行）各自对5xx错误调用reportToLingZhou发送飞书告警，同一条错误告警发送两次。insertErrorLog双重写入已修复，但告警仍重复
- **修复方向**：移除errorResponseInterceptor中的reportToLingZhou调用，仅保留errorHandler发送告警；errorResponseInterceptor仅负责响应重定向/降级
- **验收标准**：5xx错误只触发一次飞书告警

#### R55-03 — rate-limit 使用 MemoryStore [P1]

- **优先级**：P1
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **完成证据**：新增 `rate-limit-redis@6.0.0` 依赖（monorepo hoist 到根 node_modules）；`config/env.ts` 新增 `REDIS_URL`（可选）；`server.ts` 新增 `createRateLimiter` 工厂函数——测试环境或未配置 REDIS_URL 时用默认 MemoryStore，生产环境+REDIS_URL 时用 RedisStore（ioredis + sendCommand），初始化抛错降级 MemoryStore，Redis 运行时连接错误经 error 事件记录日志。三个限流器（globalLimiter/adminLoginLimiter/storeLoginLimiter）均改用工厂创建。`npx tsc --noEmit` 0 错误，`npx vitest run` 全量通过。
- **文件**：`backend/src/server.ts`、`backend/src/config/env.ts`、`backend/package.json`
- **问题**：globalLimiter（第80行）、adminLoginLimiter（第84行）、storeLoginLimiter（第85行）三个rateLimit实例均使用默认MemoryStore，多进程部署或重启后计数清零，防暴力破解能力降级
- **修复方向**：生产环境替换为rate-limit-redis（需安装依赖并配置Redis连接），开发环境可保留MemoryStore
- **验收标准**：生产环境限流器使用Redis存储

#### R55-04 — queryOne\<any\> 类型安全缺失 [P2]

- **优先级**：P2
- **负责人**：阿坚
- **预计**：3天
- **状态**：✅ 已完成
- **文件**：`backend/src/services/` 目录下45+个文件（153+处）
- **问题**：整个后端services目录153处使用queryOne\<any\>或queryAll\<any\>，数据库层完全失去类型安全，字段名和类型无编译期检查
- **修复方向**：为高频模块（auth、customer、product、order）定义TypeScript接口，逐步替换any泛型。可分批进行，优先处理核心业务模块
- **验收标准**：核心模块（auth/customer/product/order/sale）无any泛型
- **完成进度**（第一批，2026-07-23）：
  - `auth.service.ts`：6处 → 定义 SysUserRow/RolePermissionRow/RoleCodeRow/UserHomepageRow/UserPasswordRow 接口
  - `customer.service.ts`：23处 → 定义 MemberListRow/MemberDetailRow/CountTotalRow 等 15 个接口
  - `product.service.ts`：14处 → 定义 ProductListRow/ProductSpuRow/ProductSkuRow 等接口，conn.query 使用 ResultSetHeader/RawDataPacket
  - `order.service.ts`：13处 → 定义 OrderListRow/OrderDetailRow/SaleBillListRow 等接口
  - `purchase-order.service.ts`：9处 → 定义 PurchaseOrderRow/PurchaseOrderItemRow 等接口
  - 合计：5个模块，65处 any 替换为明确接口
  - 验证：tsc 无新增错误，vitest 4857 用例全部通过
- **完成进度**（第二批，2026-07-23）：
  - **库存模块（2个）**：
    - `purchase-in-stock.service.ts`：10处 → PurchaseInStockRow/PurchaseInStockItemRow等8个接口
    - `purchase-return.service.ts`：10处 → PurchaseReturnRow/PurchaseReturnItemRow等7个接口
  - **销售/财务模块（2个）**：
    - `customer-payment.service.ts`：6处 → CustomerPaymentRawRow/PaymentStatusRow等6个接口
    - `payment.service.ts`：4处 → PaymentOrderRawRow/PaymentOrderBriefRow接口
  - **营销模块（5个）**：
    - `seckill.service.ts`：6处 → SeckillProductRow/CountCntRow接口
    - `group-buy.service.ts`：8处 → GroupBuyActivityRow/GroupBuyRecordRow等5个接口
    - `points-mall.service.ts`：6处 → PointsMallItemRow/PointsMallOrderRow等4个接口
    - `marketing-asset.service.ts`：4处 → MarketingAssetRow接口
    - `product-marketing-tag.service.ts`：补充TagIdRow/TagTenantRow接口
  - **系统/设置模块（6个）**：
    - `sys-config.service.ts`：5处 → SysConfigRow/ConfigIdRow接口
    - `notification.service.ts`：7处 → NotificationRow/NotificationMiniRow等4个接口
    - `dashboard.service.ts`：35处 → OverviewSalesStatsRow/SalesTrendRow等30个统计接口
    - `user-session.service.ts`：8处 → UserSessionRow/CountCntRow等5个接口
    - `tenant.service.ts`：11处 → TenantRow/TenantBriefRow等7个接口
    - `rbac.service.ts`：15处 → RoleRow/UserRoleRow等7个接口
  - 合计：15个模块，约130处 any 替换为明确接口
  - 验证：tsc 无新增错误（仅3个已有 controller 层错误与本次无关）
- **完成进度**（第三批，2026-07-23）：
  - **平台/租户模块（4个）**：
    - `platform.service.ts`：4处 → CountRow/TenantBriefRow接口
    - `platform-tenant.service.ts`：3处 → CountTotalRow/IdRow/TenantRecord接口
    - `tenant-register.service.ts`：8处 → IdRow/InsertResult/CountTotalRow/TenantApplicationFullRow等接口
    - `wechat.service.ts`：2处 → WxUserInfoRow/WxUserProfileRow/UserBindingRow接口
  - **小程序/分享模块（2个）**：
    - `miniapp.service.ts`：13处 → MiniappProductRow/SkuPriceRow/InventoryBalanceRow等13个接口
    - `share.service.ts`：5处 → CollectionLinkRow/SaleBillItemRow/CollectionLinkPageRow等接口
  - **订阅/使用统计模块（3个）**：
    - `subscription-plan.service.ts`：7处 → SubscriptionPlanRow/PlanBriefRow/PlanFeaturesRow/IdRow接口
    - `subscription.service.ts`：9处 → SubscriptionRow/CountTotalRow/SubscriptionOperationLogRow等7个接口
    - `tenant-usage.service.ts`：4处 → UsageStatsRow/TrendRow/CountTotalRow/RankingRow接口
  - **数据权限/门店管控模块（3个）**：
    - `data-permission.service.ts`：10处 → DataPermissionRow/IdRow/RoleDataPermissionRow/UserDataPermissionRow接口
    - `store-control.service.ts`：5处 → StoreControlConfigRow/StoreControlConfigWithStoreRow/CountTotalRow/StoreBriefRow接口
    - `store-control-scheduler.service.ts`：补充 max_daily_orders/max_order_amount 等缺失字段
  - **报价推送/追溯模块（2个）**：
    - `quote-push.service.ts`：4处 → SysConfigRow/QuoteShareRow接口
    - `trace-records.service.ts`：3处 → TraceCodeRow/TraceCodeTenantRow/TraceEventLogRow接口
  - **修复前批遗留问题（4个）**：
    - `operation-log.service.ts`：补充 OperationLogRow 接口定义
    - `instant-retail.service.ts`：补充 OrderNoRow 接口，修复 conn.query 泛型
    - `platform-integration.service.ts`：补充 OrderNoRow 接口，修复 conn.query 泛型
    - `data-permission-auth.ts`：修复 permission_type -> permissionType 属性名不匹配
  - **测试修复（4个文件）**：
    - `data-permission.service.test.ts`：permission_type -> permissionType
    - `data-permission-auth.test.ts`：permission_type -> permissionType
    - `inventory-loss-order.service.test.ts`：修复 conn.query mock 返回格式（rows, fields 元组）
    - `inventory-profit-order.service.test.ts`：修复 conn.query mock 返回格式
  - 合计：25+个文件（含测试和中间件），三批累计45+个文件，153+处 any 替换为明确接口
  - 验证：tsc 无新增错误（3个已有 controller 层错误与本次无关），vitest 416个文件4857用例全部通过
- **完成进度**（第四批，2026-07-24）：
  - **小程序模块 miniapp（3个文件，33个接口）**：
    - `member.service.ts`：14个接口 → CountTotalRow/MemberProfileRow/MemberLevelRow/MemberLevelListRow/CouponStatsRow/PointsRecordRow/PointsSummaryRow/MemberPointsRow/GrowthRecordRow/GrowthSummaryRow/MemberGrowthRow/UserCouponRow/MemberUpdatedRow/MemberPasswordRow
    - `wholesale.service.ts`：16个接口 → CountTotalRow/IdRow/InsertResultRow/WholesaleProductListRow/WholesaleSpuDetailRow/WholesaleSkuRow/ProductStepPriceRow/WholesaleCategoryRow/WholesaleCartRow/WholesaleSkuCheckRow/WholesaleCartExistingRow/WholesaleCartUpdateRow/WholesaleOrderListRow/WholesaleOrderItemRow/WholesaleOrderDetailRow/WholesaleOrderDetailItemRow
    - `cart.service.ts`：3个接口 → CartListRow/CartSkuRow/CartExistingRow
  - **即时零售模块 instant-retail（10个文件，33个接口）**：
    - `common.service.ts`：1个接口 → PlatformConfigRow
    - `fulfillment.service.ts`：1个接口 → PlatformOrderBriefRow
    - `inventory-deduction.service.ts`：1个接口 → RetailProductStockRow
    - `order-receiving.service.ts`：3个接口 → PlatformOrderRow/PlatformOrderBriefRow/CountTotalRow
    - `platform-integration.service.ts`：5个接口 → OrderNoRow/PlatformConfigListRow/PlatformConfigRow/PlatformConfigExistingRow（+补充 conn.query 泛型）
    - `product-sync.service.ts`：3个接口 → CountCntRow/ProductMapRow/SkuAllowOnlineRow
    - `reconciliation.service.ts`：3个接口 → ReconciliationSummaryRow/CountCntRow/PlatformOrderRow
    - `retail-analytics.service.ts`：4个接口 → AnalyticsSummaryRow/SalesTrendRow/PlatformComparisonRow/TopProductRow
    - `retail-shop.service.ts`：9个接口 → RetailShopConfigRow/RetailShopConfigIdRow/RetailCategoryRow/CountCntRow/RetailProductRow/RetailOrderRow/RetailOrderStatusRow/RetailOrderItemRow/RetailBannerRow
    - `review.service.ts`：3个接口 → RetailReviewRow/CountCntRow/ReviewAvgRatingRow
  - **门店端模块 store（4个文件，23个接口）**：
    - `inventory.service.ts`：5个接口 → InventoryRow/InventoryBalanceRow(extends RowDataPacket)/InventoryLogRow/CountRow/InventoryAlertRow
    - `other.service.ts`：6个接口 → HoldOrderRow/HoldOrderDetailRow/CollectionLinkRow/PaymentOrderRow/RefundOrderRow/CountTotalRow
    - `product.service.ts`：5个接口 → ProductCategoryRow/ProductSpuRow/ProductSkuRow/ProductListItemRow/MemberRow
    - `receivable.service.ts`：7个接口 → ReceivableRow/ReceivableAccountRow(extends RowDataPacket)/CountRow/CntRow/TotalRow/DailySaleRow
  - **数据同步模块 sync（3个文件，11个接口）**：
    - `delta-sync.service.ts`：4个接口 → ProductDeltaRow/InventoryDeltaRow/MemberDeltaRow/SaleBillDraftRow
    - `price-sync.service.ts`：5个接口 → PriceChangeLogRow/SkuPriceRow/SkuPriceWithStoreRow(extends SkuPriceRow)/SyncCacheStatusRow/SyncCacheLastTimeRow
    - `product-sync.service.ts`：2个接口 → ProductSpuSyncRow/ProductSkuSyncRow
  - **顶层业务模块（4个文件，11个接口）**：
    - `purchase.service.ts`：2个接口 → PurchaseOrderItemInStockRow/PurchaseOrderDetailRow
    - `sale-return.service.ts`：3个接口 → SaleBillRow/SaleBillItemRow/SaleBillWithItemsRow(extends SaleBillRow)
    - `supplier.service.ts`：5个接口 → SupplierRow/SupplierContactRow/PurchaseOrderRow/PurchasePaymentRow/SupplierProductRow
    - `transfer-execution.service.ts`：1个接口 → TransferOrderWithStoreRow
  - 合计：24个文件，111个接口定义，约200处 any 替换为明确接口
  - 四批累计：69+个文件，264+处 any 替换为明确接口（占原始153+处 WithTenant 的 100%，另新增 111 处顶层 conn.query 类型）
  - **剩余 any**：services 目录仍有 774 处（admin 子目录 92 个文件），属后续轮次处理范围
  - 验证：`npx tsc --noEmit` 0 错误，`npx vitest run` 416 文件 4857 用例全部通过

#### R55-05 — apiCost:1 硬编码 [P2]

- **优先级**：P2
- **负责人**：阿坚
- **预计**：0.25天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/shared/response.ts`、`docs/API.md`、`app-mobile/src/api/request.ts`、`backend/src/__tests__/shared/response.test.ts`
- **问题**：ok()和fail()函数都硬编码返回apiCost:1，不论实际接口开销如何，所有响应返回固定值
- **修复方向**：移除apiCost字段（如无消费方依赖），或改为可选参数由调用方传入实际耗时
- **验收标准**：apiCost字段移除或动态计算
- **完成证据**：从 `response.ts` 的 ok()/fail() 中移除 `apiCost: 1` 字段；同步移除 `response.test.ts` 中的相关断言（2处）；从 `app-mobile/src/api/request.ts` 的 `RequestResponse` 接口中移除 `apiCost`；从 `docs/API.md` 的成功响应和失败响应示例中移除 `apiCost`。验证：`npx tsc --noEmit` 0 新增错误，`npx vitest run` 4857 用例全部通过

#### R55-06 — asyncHandler 类型安全 [P3]

- **优先级**：P3
- **负责人**：阿坚
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/middleware/async-handler.ts`
- **问题**：asyncHandler函数签名使用(req: any, res: any, next: any)和返回类型any，Express类型安全保障丢失
- **修复方向**：使用Express官方类型Request/Response/NextFunction替换any，返回类型改为RequestHandler
- **验收标准**：asyncHandler无any类型
- **完成证据**：引入 Express 官方类型 `Request`/`Response`/`NextFunction`/`RequestHandler`；handler 参数类型从 `any` 改为 `(req: Request, res: Response, next: NextFunction) => unknown`；返回类型明确为 `RequestHandler`。验证：`npx tsc --noEmit` 0 新增错误，`npx vitest run` 4857 用例全部通过

#### R55-07 — JWT_SECRET 密钥复用 [P3]

- **优先级**：P3
- **负责人**：阿坚
- **预计**：0.25天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/middleware/csrf.ts`、`backend/src/config/env.ts`
- **问题**：CSRF的HMAC和JWT签名共用env.JWT_SECRET，密钥轮换时所有CSRF token立即失效
- **修复方向**：新增env.CSRF_SECRET独立密钥，csrf.ts使用CSRF_SECRET而非JWT_SECRET
- **验收标准**：CSRF和JWT使用不同密钥
- **完成证据**：`config/env.ts` 新增 `CSRF_SECRET` 环境变量，未设置时回退到 `JWT_SECRET` 确保向后兼容；`middleware/csrf.ts` 的 `generateCsrfToken` 优先使用 `CSRF_SECRET`，未配置时回退到 `JWT_SECRET`，两者均缺失时抛出明确错误。验证：`npx tsc --noEmit` 0 新增错误，`npx vitest run` 4857 用例全部通过

#### R55-08 — hashPassword 动态 import 不一致 [P3]

- **优先级**：P3
- **负责人**：阿坚
- **预计**：0.25天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/services/admin/auth.service.ts`
- **问题**：第161行使用await import("../../shared/password.js")动态导入hashPassword，但同文件顶部已static import verifyPassword和validatePassword，导入方式不一致且路径后缀不统一
- **修复方向**：将hashPassword加入顶部static import，删除动态import
- **验收标准**：auth.service.ts中password模块全部使用static import
- **完成证据**：将 `hashPassword` 加入顶部 static import（与 `verifyPassword`、`validatePassword` 同一声明）；删除动态 `import("../../shared/password.js")` 调用；改密码逻辑直接使用 `await hashPassword(newPassword)`。验证：`npx tsc --noEmit` 0 新增错误，`npx vitest run` 4857 用例全部通过

#### R55 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R55-01 retail-announcement跨租户泄露 | 阿坚 | P0 | 1天 | ✅ 已完成 |
| R55-02 双重飞书告警 | 阿坚 | P1 | 0.5天 | ✅ 已完成 |
| R55-03 rate-limit MemoryStore | 阿坚 | P1 | 0.5天 | ✅ 已完成 |
| R55-04 queryOne\<any\>类型安全 | 阿坚 | P2 | 3天 | 🟡 基本完成（admin目录6文件33处any残留） |
| R55-05 apiCost硬编码 | 阿坚 | P2 | 0.25天 | ✅ 已完成 |
| R55-06 asyncHandler类型安全 | 阿坚 | P3 | 0.5天 | ✅ 已完成 |
| R55-07 JWT_SECRET复用 | 阿坚 | P3 | 0.25天 | ✅ 已完成 |
| R55-08 hashPassword动态import | 阿坚 | P3 | 0.25天 | ✅ 已完成 |
| **合计** | — | — | **6.25天** | **7/8完成，1个基本完成** |

#### R55 执行顺序

```
【第一批 P0 — 立即执行】
  阿坚：R55-01（retail-announcement租户隔离，1天）

【第二批 P1 — 高优先级】
  阿坚：R55-02（双重告警，0.5天）→ R55-03（rate-limit Redis，0.5天）

【第三批 P2-P3 — 迭代优化】
  阿坚：R55-05（apiCost，0.25天）→ R55-07（JWT_SECRET，0.25天）→ R55-08（hashPassword，0.25天）→ R55-06（asyncHandler，0.5天）→ R55-04（queryOne类型安全，3天，可分批）
```

---

### R53 — 生产环境全面整改 [✅ 全部完成 — 凌舟验收 2026-07-27]

> **日期**：2026-07-20
> **验收记录（凌舟 2026-07-22）**：R53-19/20/21已由IDE端完成。统一标准更新为v1.4，项目规则路径已修正为.workspace/，侧边栏12个一级模块命名与产品功能清单v6.1完全一致。
> **验收记录（凌舟 2026-07-23）**：R55-04核查通过——queryOne\<any\>/queryAll\<any\>从153处降至14处（降幅91%），5个核心模块（auth/customer/product/order/sale）any=0，验收标准达标。R55全部8个任务验收完成。
> **待处理**：R53-18 UI审查第一轮完成（label-width+弹窗宽度统一），仍有5项需林夕设计决策。另注意services目录仍有774处admin子目录any（第四批后数据，原894处），建议后续轮次处理。

#### R53-18 — UI审查与优化 [P2]

- **优先级**：P2
- **负责人**：林夕 + 墨
- **预计**：5天
- **状态**：✅ 已完成（凌舟验收 2026-07-27：三轮完成，仍有7处残留已入R56-01）
- **问题**：各模块页面UI需林夕审查后统一优化
- **第一轮完成（2026-07-23）**：表单label-width统一（12文件→100px）、偏小弹窗宽度统一（9个→480px）；发现弹窗宽度/表格操作列/分页组件/按钮文案等5项需林夕设计决策
- **第二轮完成（2026-07-23）**：
  - 弹窗宽度三档规范统一（480/720/900px）— 54个文件68处
  - 表格操作列宽度三档统一（160/220/280px）— 48个文件89处
  - 分页组件类名统一（`.pagination`）— 7个文件
  - 按钮文案规范统一（保存/确定）— 6个文件
  - 验证：vue-tsc 0错误，npm run build成功
- **验收标准**：林夕审查通过
- **验收记录（凌舟 2026-07-23）**：第二轮54文件68处弹窗宽度已统一为三档（480/720/900px），但核查发现仍有**48处不规范弹窗宽度**未处理（500/550/600/650/700/750/800/850px），涉及约35个文件（customer/product/marketing/purchase/pos等模块）。需第三轮补充修改。
- **第三轮完成（2026-07-23）**：48处不规范弹窗宽度全部修复为三档规范（480/720/900px），涉及33个文件。grep确认无非标准宽度残留。vue-tsc 0错误，npm run build成功。踩坑[4]：同文件多处Edit需串行避免覆盖。

#### R53-19 — 项目统一标准v1.4更新 [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`.workspace/standards/项目统一标准.md`
- **问题**：标准文档停留在v1.3（2026-07-05），需补充手写SQL t_前缀、views目录规范、部署验证、菜单覆盖率、safeExec限制，更新差距数据和优先级矩阵
- **修复**：完成10处更新——版本号升至v1.4、补充手写SQL t_前缀铁律、红线新增第13条、新增6.4 views目录分类规范、新增7.4生产环境部署验证、新增11.7菜单覆盖率验收、补充safeExec参数化限制、更新附录C优先级矩阵（移除已完成项）、更新A.2返回体/A.4数据库差距数据
- **验收标准**：凌舟核查通过

#### R53-20 — 项目规则更新 [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.5天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`.workspace/standards/项目规则.md`
- **问题**：文档仍残留Windows绝对路径（流程文件索引、记忆文件位置）和违规的成员任务文件段落
- **修复**：将2处Windows绝对路径改为.workspace/相对路径；删除违规的成员任务文件段落改为禁止创建独立任务文件规则；流程文件索引补充产品清单/统一标准/项目规则3项
- **验收标准**：凌舟核查通过

#### R53-21 — 产品功能清单命名同步确认 [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：凌舟
- **预计**：0.25天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`.workspace/product/产品功能清单-v6.1.md`、`admin-web/src/layouts/MainLayout.vue`
- **问题**：需确认产品规划3处一级模块命名（工作总台/财务往来/营销中心）与侧边栏一致
- **修复**：经核查，MainLayout.vue侧边栏12个一级模块与产品功能清单v6.1的12个一级目录完全一致，无需修改代码
- **验收标准**：侧边栏命名与产品规划完全一致 ✅

#### R53 待完成任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R53-18 UI审查与优化 | 林夕+墨 | P2 | 5天 | ✅ 已完成（三轮+7处残留入R56-01） |
| R53-19 统一标准v1.4更新 | 凌舟 | P1 | 0.5天 | ✅ 已完成（凌舟验收 2026-07-22） |
| R53-20 项目规则更新 | 凌舟 | P1 | 0.5天 | ✅ 已完成（凌舟验收 2026-07-22） |
| R53-21 产品清单命名同步 | 凌舟 | P1 | 0.25天 | ✅ 已完成（凌舟验收 2026-07-22） |

---

### R51 — App 原生层封装方案 [✅ 全部完成 — 凌舟验收 2026-07-22]

> **日期**：2026-07-19 撰写方案 / 2026-07-20 任务分派
> **撰写人**：凌舟
> **负责人**：阿澈（前端主导）+ 阿坚（后端）+ 苏然（测试）+ 凌舟（审查）
> **完整方案**：`.workspace/tasks/R51-App原生层封装方案.md`（1172行，5大模块）

#### R51-01 — 条码扫码原生插件封装 [P0] ✅ 已完成

- **优先级**：P0
- **负责人**：阿澈
- **预计**：2天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`app-mobile/src/native/scan.ts`（重构949行）、`app-mobile/src/manifest.json`（已配置 ZXing-Scanner + CAMERA 权限）
- **问题**：app-mobile 当前无原生扫码能力，门店收银、盘点、追溯场景需依赖系统扫码功能
- **修复方向**：
  1. 封装 `uni.requireNativePlugin('ZXing-Scanner')` 为 Promise 接口
  2. 实现 `ScanResult` 类型识别（barcode/qrcode/trace_code）
  3. 实现 `handleScanResult()` 路由分发：追溯码 → /admin/trace/query/:code，商品条码 → 优先本地 SQLite，未命中走网络
  4. 支持连续扫码（盘点场景），间隔可配置
  5. 错误处理：相机权限拒绝、设备不支持、扫码超时
- **验收标准**：vue-tsc 0 错误，扫码插件类型定义完整，三种场景路由分发逻辑正确
- **完成内容**：
  - 接口对齐 R51 方案：`scan(options?): Promise<ScanResult>` + `startContinuousScan(callback, options?): void` + `stopContinuousScan(): void` + `handleScanResult(result): Promise<void>`
  - ScanOptions 新增 `timeout?: number`（默认 30000ms）
  - 新增 `ScanError` 类 + `ScanErrorType` 枚举（device_not_supported/camera_permission_denied/timeout/scan_failed/no_content）
  - `checkCameraPermission()` 用 `uni.getSetting` 检查 `scope.camera` 拒绝状态
  - `scan()` 用 `Promise.race` + `setTimeout` 实现扫码超时
  - 路由分发：追溯码 → `/pages-sub/admin/trace/trace-query?code=xxx` + 后端 `GET /admin/trace/query/:code`；商品条码 → `LocalProductDb.findByBarcode` 优先，未命中走 `productsApi.list({ keyword })`
  - 保留 `scanCode` / `stopScan` 作为 `@deprecated` 别名向后兼容
  - HMS Scan Kit 适配（HarmonyOS）保留
- **验证结果**：`npx vue-tsc --noEmit` 0 错误（app-mobile 全量通过）

#### R51-02 — 蓝牙热敏打印插件封装 [P0]

- **优先级**：P0
- **负责人**：阿澈
- **预计**：3天
- **状态**：✅ 已完成（2026-07-23）
- **前置**：R51-03 后端打印记录 API ✅
- **文件**：`app-mobile/src/native/print.ts`、`app-mobile/src/manifest.json`
- **问题**：app-mobile 无蓝牙打印能力，门店收银后无法打印小票
- **修复方向**：
  1. 实现 `PrintManager` 接口：search/connect/disconnect/isConnected/printSaleBill/printSaleBillDot/printRaw
  2. 实现 58mm 热敏打印模板（销售单）
  3. 打印成功后调用后端 /api/admin/print/records 保存打印记录
- **验收标准**：蓝牙打印机搜索/连接/打印正常，打印记录保存到后端

#### R51-03 — 后端打印记录 API [P0]

- **优先级**：P0
- **负责人**：阿坚
- **预计**：1天
- **状态**：✅ 已完成（2026-07-23）
- **完成证据**：routes/service/migration/测试前序轮次已部分完成（存在但 controller 缺失导致编译失败），本次补齐缺失的 `print.controller.ts`（4 端点：POST /records 保存、GET /records 分页查询、GET /records/:id 详情、POST /records/:id/reprint 重打），修复 `print.service.ts` 的 insertId 提取 bug（兼容 mock 数组与真实 DB 对象两种形态，踩坑 [76]）。routeConfig.auth=requireAuthWithTenant，租户隔离用 queryWithTenant/queryOneWithTenant，operatorId 由服务端从 req.user.id 注入（不信任客户端）。主键采用 BIGINT 自增（比 VARCHAR(36) 更适合审计记录高频写入，service/test 均基于 number 类型实现）。`npx tsc --noEmit` 0 错误，`npx vitest run` print.service.test.ts + print.routes.test.ts 全部通过（含 CRUD + 租户隔离 + 边界）。
- **文件**：`backend/src/routes/print.routes.ts`、`backend/src/services/admin/print.service.ts`、`backend/src/controllers/admin/print.controller.ts`、`docs/migrations/20260720_print_record.sql`
- **问题**：后端无任何打印记录能力，App 端打印小票无法留痕审计
- **修复方向**：
  1. 新建 `t_print_record` 表（含 tenant_id/store_id/bill_type/bill_no/printer_mac/print_content/copies/operator_id/status/error_msg）
  2. 路由 `POST /api/admin/print/records` 保存打印记录
  3. 路由 `GET /api/admin/print/records` 查询打印记录
  4. 路由 `POST /api/admin/print/records/:id/reprint` 重打
- **验收标准**：tsc 0 错误，vitest 测试通过（含 CRUD + 租户隔离），路由注册成功

#### R51-04 — 离线能力（SQLite + 增量同步） [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：阿澈（前端）+ 阿坚（后端扩展）
- **预计**：5天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`app-mobile/src/native/sqlite.ts`（1033行）、`app-mobile/src/api/local-db.ts`、`backend/src/services/sync/delta-sync.service.ts`（507行）
- **问题**：app-mobile 无离线能力，网络中断时无法开单
- **修复方向**：
  1. 前端 SQLite 建表（local_product_sku/local_member/local_sale_draft/local_inventory_snapshot/sync_watermark）
  2. 前端同步流程：App启动增量同步 → 无网络写local_sale_draft → 恢复网络自动提交
  3. 后端新增 4 个同步端点：products/inventory/members 增量 + offline-orders 批量提交
- **验收标准**：vue-tsc 0 错误，离线开单→网络恢复→自动同步→服务端落库 全流程跑通

#### R51-05 — 安全加固（Token加密 + 证书锁定 + 防调试） [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：阿澈
- **预计**：2天
- **状态**：✅ 已完成（2026-07-20）
- **文件**：`app-mobile/src/utils/crypto.ts`（825行）、`app-mobile/src/utils/pin-ssl.ts`（261行）、`app-mobile/src/utils/security.ts`（430行）、`app-mobile/src/api/storage.ts`（324行）、`app-mobile/src/manifest.json`

#### R51-06 — 分包优化（pages.json 分包改造） [P1] ✅ 已完成

- **优先级**：P1
- **负责人**：阿澈
- **预计**：1天
- **状态**：✅ 已完成（2026-07-20）
- **文件**：`app-mobile/src/pages.json`（重构，主包14页 + 5个子包共80页）、`app-mobile/src/pages-sub/`（新建目录）

#### R51-07 — 推送通知集成 [P2] ✅ 已完成

- **优先级**：P2
- **负责人**：阿坚（后端）+ 阿澈（前端）
- **预计**：3天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`backend/src/services/admin/push.service.ts`（466行）、`app-mobile/src/native/push.ts`（636行）

#### R51-08 — 虚拟滚动改造 [P2] ✅ 已完成

- **优先级**：P2
- **负责人**：阿澈
- **预计**：1天
- **状态**：✅ 已完成（2026-07-23）
- **文件**：`app-mobile/src/components/virtual-list.vue`（201行）

#### R51-09 — HarmonyOS 适配 [P3] ✅ 已完成

- **优先级**：P3
- **负责人**：阿澈
- **预计**：5天
- **状态**：✅ 已完成（2026-07-23）
- **前置**：R51-01 ~ R51-04 完成后执行

#### R51 任务总览

| 任务 | 负责人 | 优先级 | 工作量 | 状态 |
|------|--------|:------:|:------:|:----:|
| R51-01 条码扫码原生插件 | 阿澈 | P0 | 2天 | ✅ 已完成 |
| R51-02 蓝牙热敏打印插件 | 阿澈 | P0 | 3天 | ✅ 已完成 |
| R51-03 后端打印记录API | 阿坚 | P0 | 1天 | ✅ 已完成 |
| R51-04 离线SQLite+同步扩展 | 阿澈+阿坚 | P1 | 5天 | ✅ 已完成 |
| R51-05 安全加固（Token加密+证书锁定） | 阿澈 | P1 | 2天 | ✅ 已完成 |
| R51-06 分包优化 | 阿澈 | P1 | 1天 | ✅ 已完成 |
| R51-07 推送通知集成 | 阿坚+阿澈 | P2 | 3天 | ✅ 已完成 |
| R51-08 虚拟滚动改造 | 阿澈 | P2 | 1天 | ✅ 已完成 |
| R51-09 HarmonyOS适配 | 阿澈 | P3 | 5天 | ✅ 已完成 |
| **合计** | — | — | **23天** | **全部完成** |

> 详细方案：`.workspace/tasks/R51-App原生层封装方案.md`

---

## 二、历史轮次归档（已完成）

| 轮次 | 日期 | 任务数 | 状态 | 说明 |
|------|------|:------:|:----:|------|
| R18 | 2026-07-08 | 2 | ✅ | 营销模块services测试 + 全量验收 |
| R20 | 2026-07-09 | 1 | ✅ | 全量验收测试 |
| R33 | 2026-07-15 | 1 | ✅ | 全量回归测试 |
| R34 | — | 1 | ✅ | — |
| R35 | — | 1 | ✅ | — |
| R36 | — | 1 | ✅ | — |
| R37 | — | 1 | ✅ | — |
| R38 | — | 1 | ✅ | P1级租户过滤漏洞修复 |
| R39 | — | 1 | ✅ | 租户隔离专项测试与代码优化 |
| R40 | — | 1 | ✅ | 系统全局统一性审查与问题修复 |
| R41 | — | 1 | ✅ | 系统性全局审查与问题修复 |
| R42 | — | 1 | ✅ | P0紧急修复：无法登录 & 无法注册 |
| R43 | — | 1 | ✅ | 系统性全局核查：产品规划 vs 现有系统对比 |
| R44 | — | 1 | ✅ | BOSS平台管理 + 即时零售 + P1页面补齐 |
| R45 | — | 1 | ✅ | SaaS定位修正 + 7大功能核验 |
| R46 | 2026-07-19 | 2 | ✅ | 工作台与收银台合并（PC端统一+移动端统一） |
| R47 | 2026-07-19 | 5 | ✅ | 数据库表命名统一 |
| R48 | 2026-07-20 | 6 | ✅ | SaaS总平台独立化修复 |
| R49 | 2026-07-20 | 6 | ✅ | 产品规格修正 + 部署验证 + 遗留清理 |
| R50 | 2026-07-21 | 1 | ✅ | 全系统完成度审计工作流 |
| R54 | 2026-07-22 | 19 | ✅ 18/19 | 产品功能细节优化（R54-13内部备注缺失） |
| R55 | 2026-07-22 | 8 | ✅ 7/8 | 后端安全与质量遗留问题（R55-04基本完成，6文件33处any残留入R56-02） |
| R56 | 2026-07-27 | 5 | ✅ | 全局验收待修正问题（弹窗宽度+any+env文档+硬编码+console清理） |
| R57 | 2026-07-28 | 3 | ✅ | 弹窗宽度收尾 + echarts按需导入 + console清理 |
| R58 | 2026-07-28 | 4 | ✅ | 后端services any全量清零（R55-04收尾） |