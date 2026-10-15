# R101 · 平台 RBAC 接线台账（平台写端点逐条登记）

> 派单：**S3-193**（收口总清单第 50 项）→ **S3-219** 更新（第 67 项：平台侧 3 域目录扩 + 28 条写端点接线）｜生成器：`backend/scripts/s3-193-platform-rbac-ledger.mjs`（可复跑）
> 复核命令：`node backend/scripts/s3-193-platform-rbac-ledger.mjs --check`（计数守恒 + 逐条映射断言）

**总数核对**：扫描 29 个 `platform*.routes.ts` ⇒ 写端点声明 **105** 条（期望 105）；
按方法：POST 67 / PUT 29 / DELETE 9；
其中**已接线 32 条**（S3-193 试点域 4 条 ＋ S3-219 商品库/开放平台/评价 3 域 28 条）、待接线 63 条、需先扩目录 0 条、豁免 10 条。

**口径**：写端点 = 源码 `.post/.put/.patch/.delete` **声明数**（与 S3-185 取证、CI 外的 G4 门禁 `guard:rbac-wiring` 基线 `rbac-wiring-baseline.json` 同为 105，三方同口径）。
行号 = 该声明在文件中的行；`完整路径` 由「router 变量 ↔ routeConfig.prefix」精确配对得出（多 router 文件不再拼前缀，见 §四）。
**S3-219 更新（2026-10-16，第 67 项）**：`library`/`open`/`review` 3 域由「需先扩目录」→「已接线」（共 28 条），总声明数与 §一/§二 计数守恒不变；接线形态 = 端点声明上的 `requirePlatformPermission("…")` **字面量**（与 S3-193 试点域同形，G4 门禁 `guard-rbac-wiring.mjs --json` 的 `authForm` 记为 `inline`）。

## 一、按域汇总

| 归属域 | 端点数 | 拟定权限点 | 接入状态 |
|:--|--:|:--|:--|
| auth 平台认证（豁免） | 6 | —（豁免） | 豁免 |
| billing 套餐与计费 | 9 | billing:manage | 待接线 |
| billing 套餐与计费（对账） | 3 | billing:manage | 待接线 |
| billing 套餐与计费（欠费） | 1 | billing:manage | 待接线 |
| billing 套餐与计费（订阅申请审核） | 1 | billing:manage | 待接线 |
| library 商品库 | 15 | library:manage | ✅ 已接线（S3-219） |
| marketing 运营营销（代理商档案/层级） | 5 | marketing:manage | 待接线 |
| marketing 运营营销（促销码） | 2 | marketing:manage | 待接线 |
| miniapp 平台小程序（公开端点） | 1 | —（豁免） | 豁免 |
| monitor 运维监控 / 日志 | 1 | monitor:manage | 待接线 |
| monitor 运维监控 / 日志（前端自身错误上报） | 1 | —（豁免） | 豁免 |
| monitor 运维监控 / 日志（阈值） | 1 | monitor:manage | 待接线 |
| open 开放平台 | 10 | open:manage | ✅ 已接线（S3-219） |
| review 平台评价/审核 | 3 | review:manage | ✅ 已接线（S3-219） |
| sysconfig 全局系统配置 | 5 | sysconfig:manage | 待接线 |
| sysconfig 全局系统配置（App 版本发布） | 7 | sysconfig:manage | 待接线 |
| sysconfig 全局系统配置（导出任务） | 2 | sysconfig:manage | 待接线 |
| sysconfig 全局系统配置（平台管理员账号） | 4 | sysconfig:manage | 待接线 |
| sysconfig 全局系统配置（平台角色与权限点） | 4 | sysconfig:manage | 待接线 |
| sysconfig 全局系统配置（模板） | 5 | sysconfig:manage | 待接线 |
| sysconfig 全局系统配置（短信/邮件配置） | 4 | sysconfig:manage | ✅ 已接线（S3-193 试点） |
| tenant 租户管理 | 6 | tenant:manage | 待接线 |
| tenant 租户管理（入驻申请审核） | 2 | tenant:manage | 待接线 |
| ticket 工单系统 | 5 | ticket:reply / ticket:note / ticket:transfer / ticket:resolve / ticket:close | 待接线 |
| 自助（站内通知） | 2 | —（豁免） | 豁免 |

## 二、逐条清单（105 条，一条不漏）

| # | 方法 | 完整路径 | 文件:行 | 归属域 | 拟定权限点 | 是否已有现成码 | 接入状态 |
|--:|:--|:--|:--|:--|:--|:--|:--|
| 1 | POST | `/api/platform/agents/levels` | `platform-agent.routes.ts:37` | marketing 运营营销（代理商档案/层级） | `marketing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 2 | PUT | `/api/platform/agents/levels/:id` | `platform-agent.routes.ts:38` | marketing 运营营销（代理商档案/层级） | `marketing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 3 | POST | `/api/platform/agents/` | `platform-agent.routes.ts:42` | marketing 运营营销（代理商档案/层级） | `marketing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 4 | PUT | `/api/platform/agents/:id` | `platform-agent.routes.ts:44` | marketing 运营营销（代理商档案/层级） | `marketing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 5 | POST | `/api/platform/agents/:id/status` | `platform-agent.routes.ts:45` | marketing 运营营销（代理商档案/层级） | `marketing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 6 | POST | `/api/padmin/app-versions/draft` | `platform-app-version.routes.ts:13` | sysconfig 全局系统配置（App 版本发布） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 7 | POST | `/api/padmin/app-versions` | `platform-app-version.routes.ts:14` | sysconfig 全局系统配置（App 版本发布） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 8 | POST | `/api/padmin/app-versions/:id/pause` | `platform-app-version.routes.ts:16` | sysconfig 全局系统配置（App 版本发布） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 9 | POST | `/api/padmin/app-versions/:id/resume` | `platform-app-version.routes.ts:17` | sysconfig 全局系统配置（App 版本发布） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 10 | POST | `/api/padmin/app-versions/:id/archive` | `platform-app-version.routes.ts:18` | sysconfig 全局系统配置（App 版本发布） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 11 | POST | `/api/padmin/app-versions/:id/rollback` | `platform-app-version.routes.ts:20` | sysconfig 全局系统配置（App 版本发布） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 12 | DELETE | `/api/padmin/app-versions/:id` | `platform-app-version.routes.ts:21` | sysconfig 全局系统配置（App 版本发布） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 13 | PUT | `/api/platform/applications/:id/approve` | `platform-applications.routes.ts:23` | tenant 租户管理（入驻申请审核） | `tenant:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 14 | PUT | `/api/platform/applications/:id/reject` | `platform-applications.routes.ts:26` | tenant 租户管理（入驻申请审核） | `tenant:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 15 | POST | `/api/platform/auth/login` | `platform-auth.routes.ts:37` | auth 平台认证（豁免） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 16 | POST | `/api/platform/auth/admin/create` | `platform-auth.routes.ts:46` | auth 平台认证（豁免） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 17 | POST | `/api/platform/auth/mfa/setup` | `platform-auth.routes.ts:76` | auth 平台认证（豁免） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 18 | POST | `/api/platform/auth/mfa/confirm` | `platform-auth.routes.ts:77` | auth 平台认证（豁免） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 19 | POST | `/api/platform/auth/mfa/disable` | `platform-auth.routes.ts:78` | auth 平台认证（豁免） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 20 | POST | `/api/platform/auth/mfa/verify` | `platform-auth.routes.ts:80` | auth 平台认证（豁免） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 21 | POST | `/api/platform/billing/arrears/urge` | `platform-billing-arrears.routes.ts:19` | billing 套餐与计费（欠费） | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 22 | POST | `/api/platform/billing/generate` | `platform-billing.routes.ts:30` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 23 | POST | `/api/platform/billing/statement/export` | `platform-billing.routes.ts:31` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 24 | POST | `/api/platform/billing/invoice` | `platform-billing.routes.ts:32` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 25 | PUT | `/api/platform/config/` | `platform-config.routes.ts:43` | sysconfig 全局系统配置 | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 26 | PUT | `/api/platform/config/sys-config` | `platform-config.routes.ts:49` | sysconfig 全局系统配置 | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 27 | POST | `/api/platform/config/logo` | `platform-config.routes.ts:53` | sysconfig 全局系统配置 | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 28 | PUT | `/api/platform/config/feature-switches/:code` | `platform-config.routes.ts:58` | sysconfig 全局系统配置 | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 29 | PUT | `/api/platform/config/data-dict/:dictType` | `platform-config.routes.ts:64` | sysconfig 全局系统配置 | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 30 | POST | `/api/platform/error-report` | `platform-error-log.routes.ts:13` | monitor 运维监控 / 日志（前端自身错误上报） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 31 | POST | `/api/platform/reports/export/` | `platform-export-task.routes.ts:28` | sysconfig 全局系统配置（导出任务） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 32 | POST | `/api/platform/reports/export/:id/retry` | `platform-export-task.routes.ts:37` | sysconfig 全局系统配置（导出任务） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 33 | POST | `/api/platform/library/spus/import` | `platform-library.routes.ts:47` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 34 | POST | `/api/platform/library/spus` | `platform-library.routes.ts:57` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 35 | PUT | `/api/platform/library/spus/:id` | `platform-library.routes.ts:60` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 36 | PUT | `/api/platform/library/spus/:id/status` | `platform-library.routes.ts:63` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 37 | DELETE | `/api/platform/library/spus/:id` | `platform-library.routes.ts:73` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 38 | POST | `/api/platform/library/spus/:spuId/skus` | `platform-library.routes.ts:80` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 39 | PUT | `/api/platform/library/skus/:id` | `platform-library.routes.ts:87` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 40 | DELETE | `/api/platform/library/skus/:id` | `platform-library.routes.ts:90` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 41 | POST | `/api/platform/library/brands` | `platform-library.routes.ts:101` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 42 | PUT | `/api/platform/library/brands/:id` | `platform-library.routes.ts:104` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 43 | DELETE | `/api/platform/library/brands/:id` | `platform-library.routes.ts:107` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 44 | POST | `/api/platform/library/brands/:id/auth-letter` | `platform-library.routes.ts:111` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 45 | POST | `/api/platform/library/api-keys` | `platform-library.routes.ts:123` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 46 | PUT | `/api/platform/library/api-keys/:id` | `platform-library.routes.ts:126` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 47 | DELETE | `/api/platform/library/api-keys/:id` | `platform-library.routes.ts:129` | library 商品库 | `library:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 48 | POST | `/api/platform-miniapp/subscriptions` | `platform-miniapp.routes.ts:23` | miniapp 平台小程序（公开端点） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 49 | PUT | `/api/platform/monitor/thresholds` | `platform-monitor-ops.routes.ts:38` | monitor 运维监控 / 日志（阈值） | `monitor:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 50 | POST | `/api/platform/monitor/notify-expiring` | `platform-monitor.routes.ts:34` | monitor 运维监控 / 日志 | `monitor:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 51 | PUT | `/api/platform/msg-config` | `platform-msg-config.routes.ts:26` | sysconfig 全局系统配置（短信/邮件配置） | `sysconfig:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-193 试点） |
| 52 | POST | `/api/platform/sms-templates` | `platform-msg-config.routes.ts:32` | sysconfig 全局系统配置（短信/邮件配置） | `sysconfig:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-193 试点） |
| 53 | PUT | `/api/platform/sms-templates/:id` | `platform-msg-config.routes.ts:37` | sysconfig 全局系统配置（短信/邮件配置） | `sysconfig:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-193 试点） |
| 54 | DELETE | `/api/platform/sms-templates/:id` | `platform-msg-config.routes.ts:42` | sysconfig 全局系统配置（短信/邮件配置） | `sysconfig:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-193 试点） |
| 55 | POST | `/api/platform/notifications/read-all` | `platform-notification.routes.ts:25` | 自助（站内通知） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 56 | POST | `/api/platform/notifications/:id/read` | `platform-notification.routes.ts:29` | 自助（站内通知） | —（豁免） | —（豁免） | 豁免（理由见下表） |
| 57 | POST | `/api/platform/open/api-keys` | `platform-open.routes.ts:31` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 58 | POST | `/api/platform/open/api-keys/:id/enable` | `platform-open.routes.ts:37` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 59 | POST | `/api/platform/open/api-keys/:id/rotate` | `platform-open.routes.ts:43` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 60 | POST | `/api/platform/open/api-keys/:id/rotate-complete` | `platform-open.routes.ts:49` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 61 | PUT | `/api/platform/open/api-keys/:id` | `platform-open.routes.ts:57` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 62 | DELETE | `/api/platform/open/api-keys/:id` | `platform-open.routes.ts:63` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 63 | POST | `/api/platform/open/webhooks` | `platform-open.routes.ts:77` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 64 | POST | `/api/platform/open/webhooks/:id/test` | `platform-open.routes.ts:83` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 65 | POST | `/api/platform/open/webhooks/:id/redeliver` | `platform-open.routes.ts:89` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 66 | POST | `/api/platform/open/webhooks/:id/resume` | `platform-open.routes.ts:95` | open 开放平台 | `open:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 67 | POST | `/api/platform/plans/` | `platform-plans.routes.ts:17` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 68 | PUT | `/api/platform/plans/:planId` | `platform-plans.routes.ts:26` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 69 | DELETE | `/api/platform/plans/:planId` | `platform-plans.routes.ts:29` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 70 | PUT | `/api/platform/plans/:planId/features` | `platform-plans.routes.ts:32` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 71 | PUT | `/api/platform/plans/:planId/policy` | `platform-plans.routes.ts:38` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 72 | POST | `/api/platform/plans/:planId/copy` | `platform-plans.routes.ts:41` | billing 套餐与计费 | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 73 | POST | `/api/platform/promo-codes/` | `platform-promo-code.routes.ts:29` | marketing 运营营销（促销码） | `marketing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 74 | POST | `/api/platform/promo-codes/:id/disable` | `platform-promo-code.routes.ts:30` | marketing 运营营销（促销码） | `marketing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 75 | PUT | `/api/platform/reconciliation/:id/settle` | `platform-reconciliation.routes.ts:14` | billing 套餐与计费（对账） | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 76 | POST | `/api/platform/reconciliation/` | `platform-reconciliation.routes.ts:17` | billing 套餐与计费（对账） | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 77 | PUT | `/api/platform/reconciliation/:id` | `platform-reconciliation.routes.ts:18` | billing 套餐与计费（对账） | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 78 | POST | `/api/platform/reviews/:id/reply` | `platform-review.routes.ts:16` | review 平台评价/审核 | `review:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 79 | PUT | `/api/platform/reviews/:id/approval` | `platform-review.routes.ts:21` | review 平台评价/审核 | `review:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 80 | POST | `/api/platform/reviews/batch-approval` | `platform-review.routes.ts:26` | review 平台评价/审核 | `review:manage`（S3-219 扩入平台侧目录） | ✅ 有（S3-219 扩入平台侧目录） | ✅ 已接线（S3-219） |
| 81 | POST | `/api/platform/roles/` | `platform-role.routes.ts:28` | sysconfig 全局系统配置（平台角色与权限点） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 82 | PUT | `/api/platform/roles/:id/permissions` | `platform-role.routes.ts:30` | sysconfig 全局系统配置（平台角色与权限点） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 83 | PUT | `/api/platform/roles/:id` | `platform-role.routes.ts:31` | sysconfig 全局系统配置（平台角色与权限点） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 84 | DELETE | `/api/platform/roles/:id` | `platform-role.routes.ts:32` | sysconfig 全局系统配置（平台角色与权限点） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 85 | PUT | `/api/platform/subscription-applies/:id/audit` | `platform-subscription-applies.routes.ts:15` | billing 套餐与计费（订阅申请审核） | `billing:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 86 | POST | `/api/platform/templates/init` | `platform-templates.routes.ts:21` | sysconfig 全局系统配置（模板） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 87 | PUT | `/api/platform/templates/init/:id` | `platform-templates.routes.ts:25` | sysconfig 全局系统配置（模板） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 88 | POST | `/api/platform/templates/print/upload` | `platform-templates.routes.ts:31` | sysconfig 全局系统配置（模板） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 89 | POST | `/api/platform/templates/print/:id/public` | `platform-templates.routes.ts:33` | sysconfig 全局系统配置（模板） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 90 | POST | `/api/platform/templates/import-export` | `platform-templates.routes.ts:39` | sysconfig 全局系统配置（模板） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 91 | POST | `/api/platform/tenants/` | `platform-tenant.routes.ts:39` | tenant 租户管理 | `tenant:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 92 | PUT | `/api/platform/tenants/:id` | `platform-tenant.routes.ts:42` | tenant 租户管理 | `tenant:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 93 | POST | `/api/platform/tenants/:id/toggle` | `platform-tenant.routes.ts:45` | tenant 租户管理 | `tenant:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 94 | POST | `/api/platform/tenants/:id/proxy-login` | `platform-tenant.routes.ts:48` | tenant 租户管理 | `tenant:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 95 | POST | `/api/platform/tenants/:id/quota-expand` | `platform-tenant.routes.ts:49` | tenant 租户管理 | `tenant:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 96 | POST | `/api/platform/tenants/:tenantId/users/:userId/reset-password` | `platform-tenant.routes.ts:55` | tenant 租户管理 | `tenant:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 97 | POST | `/api/platform/support/tickets/:id/reply` | `platform-ticket.routes.ts:40` | ticket 工单系统 | `ticket:reply`（目录既有） | ✅ 有（目录既有） | 待接线（已立项） |
| 98 | POST | `/api/platform/support/tickets/:id/note` | `platform-ticket.routes.ts:42` | ticket 工单系统 | `ticket:note`（目录既有） | ✅ 有（目录既有） | 待接线（已立项） |
| 99 | POST | `/api/platform/support/tickets/:id/transfer` | `platform-ticket.routes.ts:44` | ticket 工单系统 | `ticket:transfer`（目录既有） | ✅ 有（目录既有） | 待接线（已立项） |
| 100 | POST | `/api/platform/support/tickets/:id/resolve` | `platform-ticket.routes.ts:46` | ticket 工单系统 | `ticket:resolve`（目录既有） | ✅ 有（目录既有） | 待接线（已立项） |
| 101 | POST | `/api/platform/support/tickets/:id/close` | `platform-ticket.routes.ts:48` | ticket 工单系统 | `ticket:close`（目录既有） | ✅ 有（目录既有） | 待接线（已立项） |
| 102 | POST | `/api/platform/admins/invite` | `platform.routes.ts:28` | sysconfig 全局系统配置（平台管理员账号） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 103 | POST | `/api/platform/admins/:id/reset-password` | `platform.routes.ts:29` | sysconfig 全局系统配置（平台管理员账号） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 104 | PUT | `/api/platform/admins/:id/status` | `platform.routes.ts:30` | sysconfig 全局系统配置（平台管理员账号） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |
| 105 | POST | `/api/platform/admins` | `platform.routes.ts:32` | sysconfig 全局系统配置（平台管理员账号） | `sysconfig:manage`（本单新增） | ❌ 无（本单新增） | 待接线（已立项） |

## 三、豁免清单与理由（逐条，不是整栏省略）

| 方法 | 完整路径 | 文件:行 | 豁免理由 |
|:--|:--|:--|:--|
| POST | `/api/platform/auth/login` | `platform-auth.routes.ts:37` | 登录/图形验证码/MFA 自助，以及 POST /admin/create 建号（引导路径：加权限会形成 bootstrap 死锁），按豁免登记 |
| POST | `/api/platform/auth/admin/create` | `platform-auth.routes.ts:46` | 登录/图形验证码/MFA 自助，以及 POST /admin/create 建号（引导路径：加权限会形成 bootstrap 死锁），按豁免登记 |
| POST | `/api/platform/auth/mfa/setup` | `platform-auth.routes.ts:76` | 登录/图形验证码/MFA 自助，以及 POST /admin/create 建号（引导路径：加权限会形成 bootstrap 死锁），按豁免登记 |
| POST | `/api/platform/auth/mfa/confirm` | `platform-auth.routes.ts:77` | 登录/图形验证码/MFA 自助，以及 POST /admin/create 建号（引导路径：加权限会形成 bootstrap 死锁），按豁免登记 |
| POST | `/api/platform/auth/mfa/disable` | `platform-auth.routes.ts:78` | 登录/图形验证码/MFA 自助，以及 POST /admin/create 建号（引导路径：加权限会形成 bootstrap 死锁），按豁免登记 |
| POST | `/api/platform/auth/mfa/verify` | `platform-auth.routes.ts:80` | 登录/图形验证码/MFA 自助，以及 POST /admin/create 建号（引导路径：加权限会形成 bootstrap 死锁），按豁免登记 |
| POST | `/api/platform/error-report` | `platform-error-log.routes.ts:13` | 自助通道：总台前端上报自身运行时错误，非业务写操作；纳入权限域会阻断可观测性 |
| POST | `/api/platform-miniapp/subscriptions` | `platform-miniapp.routes.ts:23` | 该文件 routeConfig.auth = none（公开端点，小程序订阅上报），本就不在平台鉴权域；如需收敛属另一议题 |
| POST | `/api/platform/notifications/read-all` | `platform-notification.routes.ts:25` | 操作对象是管理员自己的站内通知（已读/全部已读），无越权面，按自助处理 |
| POST | `/api/platform/notifications/:id/read` | `platform-notification.routes.ts:29` | 操作对象是管理员自己的站内通知（已读/全部已读），无越权面，按自助处理 |

## 四、与 S3-185 原始输出（`docs/evidence/S3-185/02b-*.txt`）的口径差异（逐条可核对）

| 文件 | S3-185 打印的完整路径 | 本台账的完整路径 | 原因 |
|:--|:--|:--|:--|
| `platform-app-version.routes.ts` | `/api/app + /api/padmin/app-versions/*`（7 条） | `/api/padmin/app-versions/*`（7 条） | 该文件两个 router：`appVersionPublicRouter`（`/api/app`，`auth:none`，只有 1 个 GET）+ `appVersionAdminRouter`（`/api/padmin`，`requirePlatformAuth`）；7 个写端点**全在管理端 router** 上 |
| `platform-role.routes.ts` | `/api/platform/admins + /api/platform/permissions + /api/platform/roles/*`（4 条） | `/api/platform/roles/*`（4 条） | 该文件三个 router；4 个写端点全在 `platformRolesRouter`（`/api/platform/roles`）上 |

> 差异仅影响 `完整路径` 的**可读性**，不影响总数（两者都是 105）；判据以本台账为准（精确到 router↔prefix 配对）。

## 五、权限点与目录的关系（本单设计，待凌舟批准的 3 项）

1. **读码**：`<域>:view` 共 7 条，已在平台侧 `PERMISSION_CATALOG`（迁移 179 建表 + 代码常量供数）内，可直接用于读端点；
2. **写码**：`<域>:manage` 共 9 条（S3-193 新增，一域一码，**不按 105 个端点 1:1 建码**，避免矩阵碎片化）；
3. **目录外域（S3-219 已处置 3 个）**：`library` / `open` / `review` 已按 S3-213 裁定 ② **扩入平台侧目录**（`backend/src/services/platform/platform-role.service.ts` 的 `PERMISSION_CATALOG` 新增 3 条 BUTTON 码 ⇒ 8 域 → 11 域、18 条 → 21 条），对应写码因此**可被角色矩阵授予**；`miniapp` 仍不在目录内（其唯一写端点是公开端点，按豁免登记，本单未接线）。
4. **两处必须同时改（S3-219 教训）**：`middleware/platform-rbac.ts` 的 `PLATFORM_PERMISSIONS` 决定「码能不能被端点引用」，`platform-role.service.ts` 的 `PERMISSION_CATALOG` 决定「码能不能被授予」（`updateRolePermissions()` 对目录外 `module_code` 直接 400）。只改前者 ⇒ 端点永久 403（除超管），属静默失效。

**卡内示例命名 `platform:tenant:manage` 未采纳的理由**：目录既有命名规范是 `<moduleCode>:<action>`（`tenant:view` / `ticket:reply`），
再加一层 `platform:` 会让同一个域出现两种写法（目录里 `tenant:view`、端点里 `platform:tenant:manage`），与项目「同一概念只留一个出处」的原则相悖。

