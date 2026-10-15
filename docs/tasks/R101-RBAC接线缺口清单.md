# R101 · RBAC 接线缺口清单（S3-180 批B2-1 交付物②）

> 产出：阿坚（后端 · 本地子代理通道）｜2026-10-13｜汇报对象：凌舟（总负责人）
> 依据：派单卡 `docs/tasks/inbox/ACTIVE.md`（S3-180）§二.②；`docs/tasks/R101-账号权限域-统一收口计划.md` §二 G4
> 机读镜像（`--strict` 台账）：`backend/scripts/rbac-wiring-baseline.json`
> **本文件只做盘点与判定，不做任何接线**（接线是后续批次的事）；清单里的「建议权限码」是**机器建议**，不是既成事实。

---

## 〇、口径（先读，否则会误读下面的数字）

1. **「缺口」= 缺授权，不是缺认证。** 本清单里的端点**都已经过登录态**（`routeConfig.auth = requireAuthWithTenant`，
   auto-routes 统一挂载），缺的是**权限码**（`requirePermission(...)`）⇒ 现状是「任何登录用户都能调」。
2. **扫描口径（可复算）**：`node backend/scripts/guard-rbac-wiring.mjs`。判「有权限检查」= 端点同一调用内联
   `requirePermission(...)`，或路径被同文件 `router.use(<scope>, requirePermission(x))` 覆盖；`routeConfig` 声明式
   **不携带权限码** ⇒ 只挂认证的写端点一律记「无权限检查」。
3. **判定列**（管理面 / 自服务 / 公开端点 / 平台域）与**建议码列**都是**规则化判定**，规则表见本文件末
   §六；凡规则给不出既有码的，一律写 **「无现成码 ⇒ 需先立权限点（另立单）」**，**不硬塞**（派单卡红线 1）。
4. **建议码取值来源（不新造码）**：① `docs/migrations/079_权限矩阵.sql` 的 64 个码；
   ② 已被现有路由 / 角色权限串 / 前端在用的码（如 `inventory:adjust`、`finance:daily-settle`）；
   ③ 两处都挑不出来 ⇒ 另立单。选中某个码之前**必须**先用 `--holders` 核对持有角色（见 §四）。
5. **本清单登记 ≠ 合规**：登记只表示「已盘点、待接线」。

---

## 一、事实与对账（与派单卡 §一 的 144 差在哪）

| 指标 | 机器实测（本单） | 派单卡 §一（凌舟实测） | 差异原因 |
|:--|--:|--:|:--|
| 路由文件总数 | **189** | 189 | 一致 |
| 含写方法的文件数 | **166** | 165 | 本单按「文件内确有写方法调用」逐个算（含多 routeConfig 文件）；卡面按粗正则，差 1 |
| 用到 `requirePermission` 的文件数 | **20** | 21 | 本单按路由文件内出现 `requirePermission(` 计；差 1 |
| **有缺口的文件数** | **162**（试点前 **163**） | 144 | **卡面 144 = 165 − 21 是「文件级相减」**：文件只要出现过一次 `requirePermission` 就被整文件算作已接。实测有 **17 个文件是「部分接线」**（如 `price.routes.ts` 接了 14 处仍有 4 处裸写）⇒ 试点前 163 = 146（完全没接过）+ 17（部分接过）；试点接线后 `admin-report.routes.ts` 退出缺口集 ⇒ 162 |
| 写端点总数 | **762** | — | 端点级口径（含跨行调用；解析不到的路径会显式报 ⚠️，不静默猜） |
| 已接线写端点数 | **53** | — | **51**（本单前）+ **2**（本单报表域试点，见 §四） |
| **无权限检查的写端点数** | **709**（试点前 **711**） | — | 覆盖 162 个文件 / 17 个域 |

> **一句话**：卡面「144 个文件」是**文件级**相减得到的下界；真实的缺口面是**试点前 163 个文件 / 711 个写端点**
> （本单试点接线后 **162 / 709**），差的 19 个文件正是「接过一半」的那批——它们最危险（看着像已接，实际仍有裸写端点）。

---

## 二、域汇总数字

**共 17 域 / 162 文件 / 709 写端点**，其中 **529 需权限（管理面）**、**22 属自服务/本人数据**、**20 属公开端点（免鉴权）**、**138 属平台域（另立单）**、**98 无现成码需先立权限点**。

| 域 | 文件数 | 写端点数 | 需权限（管理面） | 自服务 | 公开端点 | 平台域 | 需新权限点 |
|:--|--:|--:|--:|--:|--:|--:|--:|
| 平台域（总后台） | 31 | 122 | 0 | 0 | 0 | 122 | 0 |
| 销售域 | 17 | 91 | 88 | 0 | 3 | 0 | 0 |
| 营销域 | 18 | 89 | 89 | 0 | 0 | 0 | 0 |
| 库存 / 追溯域 | 12 | 57 | 57 | 0 | 0 | 0 | 0 |
| 小程序 / 移动端域 | 6 | 49 | 32 | 12 | 5 | 0 | 32 |
| 客户域 | 12 | 45 | 42 | 0 | 3 | 0 | 0 |
| 商品域 | 10 | 45 | 45 | 0 | 0 | 0 | 0 |
| 系统设置 / 基础域 | 13 | 39 | 35 | 0 | 4 | 0 | 22 |
| 采购域 | 9 | 31 | 31 | 0 | 0 | 0 | 0 |
| 门店 / 租户域 | 8 | 31 | 17 | 0 | 2 | 12 | 0 |
| 员工 / 账号域 | 7 | 31 | 24 | 7 | 0 | 0 | 4 |
| 财务域 | 9 | 28 | 27 | 0 | 1 | 0 | 0 |
| 报表域 | 4 | 18 | 18 | 0 | 0 | 0 | 18 |
| 硬件 / 打印域 | 3 | 16 | 14 | 0 | 2 | 0 | 14 |
| 工作台 / 待办消息域 | 1 | 11 | 8 | 3 | 0 | 0 | 8 |
| AI 域 | 1 | 4 | 0 | 0 | 0 | 4 | 0 |
| 工单 / 客服域 | 1 | 2 | 2 | 0 | 0 | 0 | 0 |
| **合计** | **162** | **709** | **529** | **22** | **20** | **138** | **98** |

---

## 三、逐端点清单（按域 → 文件）

### 三.6 平台域（总后台）（31 文件 / 122 端点）

**admin-platform-announcement.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/announcements/templates` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/announcements/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/announcements/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/announcements/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/announcements/:id/publish` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**admin-platform-settlement.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/settlements/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/settlements/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**billing-config.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/billing/arrears-policy` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/billing/addon-price` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-agent.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/agents/levels` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/agents/levels/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/agents/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/agents/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/agents/:id/status` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-app-version.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/padmin/app-versions/draft` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/padmin/app-versions` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/padmin/app-versions/:id/pause` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/padmin/app-versions/:id/resume` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/padmin/app-versions/:id/archive` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/padmin/app-versions/:id/rollback` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/padmin/app-versions/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-applications.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/applications/:id/approve` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/applications/:id/reject` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-auth.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/auth/login` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/auth/admin/create` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/auth/mfa/setup` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/auth/mfa/confirm` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/auth/mfa/disable` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/auth/mfa/verify` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-billing-arrears.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/billing/arrears/urge` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-billing.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/billing/generate` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/billing/statement/export` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/billing/invoice` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-config.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/config/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/config/sys-config` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/config/logo` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/config/feature-switches/:code` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/config/data-dict/:dictType` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-error-log.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/error-report` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-export-task.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/reports/export/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/reports/export/:id/retry` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-library.routes.ts**（15 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/library/spus/import` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/library/spus` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/library/spus/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/library/spus/:id/status` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/library/spus/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/library/spus/:spuId/skus` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/library/skus/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/library/skus/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/library/brands` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/library/brands/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/library/brands/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/library/brands/:id/auth-letter` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/library/api-keys` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/library/api-keys/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/library/api-keys/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-miniapp.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform-miniapp/subscriptions` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-monitor-ops.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/monitor/thresholds` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-monitor.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/monitor/notify-expiring` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-msg-config.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/msg-config` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/sms-templates` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/sms-templates/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/sms-templates/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-notification.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/notifications/read-all` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/notifications/:id/read` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-open.routes.ts**（10 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/open/api-keys` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/open/api-keys/:id/enable` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/open/api-keys/:id/rotate` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/open/api-keys/:id/rotate-complete` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/open/api-keys/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/open/api-keys/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/open/webhooks` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/open/webhooks/:id/test` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/open/webhooks/:id/redeliver` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/open/webhooks/:id/resume` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-plans.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/plans/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/plans/:planId` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/plans/:planId` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/plans/:planId/features` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/plans/:planId/policy` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/plans/:planId/copy` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-promo-code.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/promo-codes/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/promo-codes/:id/disable` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-reconciliation.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/reconciliation/:id/settle` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/reconciliation/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/reconciliation/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-review.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/reviews/:id/reply` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/reviews/:id/approval` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/reviews/batch-approval` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-role.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/roles/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/roles/:id/permissions` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/roles/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `DELETE /api/platform/roles/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-subscription-applies.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/subscription-applies/:id/audit` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-templates.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/templates/init` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/templates/init/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/templates/print/upload` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/templates/print/:id/public` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/templates/import-export` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-tenant.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/tenants/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/tenants/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/tenants/:id/toggle` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/tenants/:id/proxy-login` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/tenants/:id/quota-expand` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/tenants/:tenantId/users/:userId/reset-password` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform-ticket.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/support/tickets/:id/reply` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/support/tickets/:id/note` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/support/tickets/:id/transfer` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/support/tickets/:id/resolve` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/support/tickets/:id/close` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**platform.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/admins/invite` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/admins/:id/reset-password` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/admins/:id/status` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/admins` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**saas-subscription.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/saas/subscriptions/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/saas/subscriptions/:id/renew` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/saas/subscriptions/:id/upgrade` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/saas/subscriptions/:id/cancel` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**saas-tenant.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/saas/tenants/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/saas/tenants/:id` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/saas/tenants/:id/audit` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/saas/tenants/:id/toggle-status` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

### 三.5 销售域（17 文件 / 91 端点）

**admin-marketing-flash-sale.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/marketing/flash-sales/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/marketing/flash-sales/:id` | 管理面 | 是 | sale:edit |

**admin-order.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/orders/batch-status` | 管理面 | 是 | sale:create |
| `POST /api/admin/orders/:orderNo/cancel` | 管理面 | 是 | sale:void |
| `PUT /api/admin/orders/:orderNo/remark` | 管理面 | 是 | sale:edit |
| `PUT /api/admin/orders/:orderNo/status` | 管理面 | 是 | sale:edit |

**admin-quote-push.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/quote-push/preview` | 管理面 | 是 | sale:create |
| `POST /api/admin/quote-push/` | 管理面 | 是 | sale:create |
| `POST /api/admin/quote-push/:id/push` | 管理面 | 是 | sale:create |
| `POST /api/admin/quote-push/:id/cancel` | 管理面 | 是 | sale:void |

**aftersale.routes.ts**（9 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/miniapp/aftersales` | 管理面 | 是 | sale:create |
| `POST /api/miniapp/aftersales/:aftersaleNo/cancel` | 管理面 | 是 | sale:void |
| `POST /api/miniapp/aftersales/:aftersaleNo/return-logistics` | 管理面 | 是 | sale:return |
| `POST /api/miniapp/aftersales/:aftersaleNo/rate` | 管理面 | 是 | sale:create |
| `POST /api/admin/aftersales/:id/approve` | 管理面 | 是 | sale:create |
| `POST /api/admin/aftersales/:id/reject` | 管理面 | 是 | sale:create |
| `POST /api/admin/aftersales/:id/confirm-receipt` | 管理面 | 是 | report:finance |
| `POST /api/admin/aftersales/:id/inspect` | 管理面 | 是 | sale:create |
| `POST /api/admin/aftersales/:id/complete` | 管理面 | 是 | sale:create |

**cart.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/miniapp/cart/add` | 管理面 | 是 | sale:create |
| `PUT /api/miniapp/cart/items/:skuId` | 管理面 | 是 | sale:edit |
| `DELETE /api/miniapp/cart/items/:skuId` | 管理面 | 是 | sale:edit |
| `POST /api/miniapp/cart/clear` | 管理面 | 是 | sale:create |
| `POST /api/miniapp/cart/checkout/preview` | 管理面 | 是 | sale:create |
| `POST /api/miniapp/cart/checkout/create` | 管理面 | 是 | sale:create |

**commerce-fix.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `DELETE /api/admin/consumer-addresses/:id` | 管理面 | 是 | sale:edit |
| `PUT /api/admin/bills/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/bills/:id` | 管理面 | 是 | sale:edit |
| `POST /api/admin/bills/:id/void` | 管理面 | 是 | sale:void |

**instant-retail-admin-ops.routes.ts**（12 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/instant-retail/orders/:orderNo/status` | 管理面 | 是 | sale:create |
| `POST /api/admin/instant-retail/routing-rules` | 管理面 | 是 | sale:create |
| `PUT /api/admin/instant-retail/routing-rules/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/instant-retail/routing-rules/:id` | 管理面 | 是 | sale:edit |
| `POST /api/admin/instant-retail/exceptions/:id/handle` | 管理面 | 是 | sale:create |
| `POST /api/admin/instant-retail/shelf` | 管理面 | 是 | sale:create |
| `PUT /api/admin/instant-retail/shelf/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/instant-retail/shelf/:id` | 管理面 | 是 | sale:edit |
| `POST /api/admin/instant-retail/deliveries/:deliveryId/assign` | 管理面 | 是 | sale:create |
| `PUT /api/admin/instant-retail/deliveries/:deliveryId/status` | 管理面 | 是 | sale:edit |
| `POST /api/admin/instant-retail/reviews/:id/reply` | 管理面 | 是 | sale:create |
| `POST /api/admin/instant-retail/reviews/sync` | 管理面 | 是 | sale:create |

**instant-retail-admin-platform.routes.ts**（15 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/instant-retail/configs` | 管理面 | 是 | sale:create |
| `POST /api/admin/instant-retail/configs/:platform/test` | 管理面 | 是 | sale:create |
| `POST /api/admin/instant-retail/configs/:platform/sync-orders` | 管理面 | 是 | sale:create |
| `POST /api/admin/instant-retail/configs/:platform/sync-products` | 管理面 | 是 | sale:create |
| `DELETE /api/admin/instant-retail/configs/:platform` | 管理面 | 是 | sale:edit |
| `POST /api/admin/instant-retail/shop-config` | 管理面 | 是 | sale:create |
| `POST /api/admin/instant-retail/categories` | 管理面 | 是 | sale:create |
| `PUT /api/admin/instant-retail/categories/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/instant-retail/categories/:id` | 管理面 | 是 | sale:edit |
| `POST /api/admin/instant-retail/products` | 管理面 | 是 | sale:create |
| `PUT /api/admin/instant-retail/products/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/instant-retail/products/:id` | 管理面 | 是 | sale:edit |
| `POST /api/admin/instant-retail/banners` | 管理面 | 是 | sale:create |
| `PUT /api/admin/instant-retail/banners/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/instant-retail/banners/:id` | 管理面 | 是 | sale:edit |

**instant-retail-store.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/instant-retail/orders/:platformOrderId/confirm` | 管理面 | 是 | sale:create |
| `POST /api/store/instant-retail/orders/:platformOrderId/cancel` | 管理面 | 是 | sale:void |
| `POST /api/store/instant-retail/orders/:platformOrderId/start-delivery` | 管理面 | 是 | sale:create |
| `POST /api/store/instant-retail/orders/:platformOrderId/complete-delivery` | 管理面 | 是 | sale:create |

**instant-retail-webhook.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/instant-retail/webhook/jd` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/instant-retail/webhook/meituan` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/instant-retail/webhook/eleme` | 公开端点 | 否 | 不适用（免鉴权） |

**order-exception.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/order-exceptions` | 管理面 | 是 | sale:create |
| `PUT /api/admin/order-exceptions/:id(\d+)/status` | 管理面 | 是 | sale:edit |
| `PUT /api/admin/order-exceptions/:id(\d+)` | 管理面 | 是 | sale:edit |

**order-timeout.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/order-timeout/configs` | 管理面 | 是 | sale:create |
| `PUT /api/admin/order-timeout/configs/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/order-timeout/configs/:id` | 管理面 | 是 | sale:edit |

**position.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/positions/` | 管理面 | 是 | sale:create |
| `PUT /api/admin/positions/:id` | 管理面 | 是 | sale:edit |
| `DELETE /api/admin/positions/:id` | 管理面 | 是 | sale:edit |

**sale-return.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/sale-returns/` | 管理面 | 是 | sale:return |
| `POST /api/admin/sale-returns/:returnNo/approve` | 管理面 | 是 | sale:return |
| `POST /api/admin/sale-returns/:returnNo/reject` | 管理面 | 是 | sale:return |

**store-order.routes.ts**（8 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/orders/:orderNo/accept` | 管理面 | 是 | sale:create |
| `POST /api/store/orders/:orderNo/start-delivery` | 管理面 | 是 | sale:create |
| `POST /api/store/orders/:orderNo/complete-delivery` | 管理面 | 是 | sale:create |
| `POST /api/store/orders/:orderNo/reject` | 管理面 | 是 | sale:create |
| `POST /api/store/orders/:orderNo/cancel` | 管理面 | 是 | sale:void |
| `POST /api/store/hold-orders` | 管理面 | 是 | sale:create |
| `POST /api/store/hold-orders/:holdNo/restore` | 管理面 | 是 | sale:create |
| `DELETE /api/store/hold-orders/:holdNo` | 管理面 | 是 | sale:edit |

**store-sale-bill.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/sale-bills/:billNo/collection-link` | 管理面 | 是 | report:finance |
| `POST /api/store/sale-bills/:billNo/offline-payment` | 管理面 | 是 | sale:create |
| `POST /api/store/sale-bills/:billNo/payment` | 管理面 | 是 | sale:create |
| `POST /api/store/sale-bills/:billNo/pay-by-code` | 管理面 | 是 | sale:create |

**store-shift.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/shift/settle` | 管理面 | 是 | sale:create |
| `POST /api/store/shifts` | 管理面 | 是 | sale:create |
| `POST /api/store/shifts/:shiftNo/check` | 管理面 | 是 | sale:create |
| `POST /api/store/shifts/:shiftNo/close` | 管理面 | 是 | sale:create |

### 三.4 营销域（18 文件 / 89 端点）

**admin-marketing-calculation.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/calculate` | 管理面 | 是 | marketing:create |

**admin-marketing-coupon.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/coupons/templates` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/coupons/templates/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/coupons/templates/:id` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/coupons/templates/:id/activate` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/coupons/templates/:id/pause` | 管理面 | 是 | marketing:create |

**admin-marketing-full-reduction.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/full-reductions` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/full-reductions/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/full-reductions/:id` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/full-reductions/:id/activate` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/full-reductions/:id/pause` | 管理面 | 是 | marketing:create |

**admin-marketing-group-buy.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/group-buys` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/group-buys/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/group-buys/:id` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/group-buys/:id/activate` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/group-buys/teams` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/group-buys/teams/:teamId/join` | 管理面 | 是 | marketing:create |

**admin-marketing-points.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/marketing/points/rule` | 管理面 | 是 | marketing:points |
| `POST /api/admin/marketing/points/redeem` | 管理面 | 是 | marketing:points |

**admin-marketing-stack-rule.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/stack-rules` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/stack-rules/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/stack-rules/:id` | 管理面 | 是 | marketing:create |

**community-marketing.routes.ts**（10 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/marketing/group-buy/:id/join` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/group-buy/:id/start` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/group-buy/:id/end` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/bargain/:id/start` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/bargain/:id/help` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/bargain/:id/end` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/seckill/:id/buy` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/seckill/:orderNo/pay` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/seckill/:orderNo/cancel` | 管理面 | 是 | marketing:create |
| `POST /api/marketing/seckill/:id/end` | 管理面 | 是 | marketing:create |

**marketing-asset.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/marketing-asset/` | 管理面 | 是 | marketing:create |
| `PUT /api/marketing-asset/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/marketing-asset/:id` | 管理面 | 是 | marketing:create |

**marketing-gift-rule.routes.ts**（8 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/gift-rules/` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/gift-rules/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/gift-rules/:id` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/gift-rules/:id/activate` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/gift-rules/:id/pause` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/gift-rules/:id/levels` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/gift-rules/:id/levels/:levelId` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/gift-rules/:id/levels/:levelId` | 管理面 | 是 | marketing:create |

**marketing-limited-discount.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/limited-discounts/` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/limited-discounts/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/limited-discounts/:id` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/limited-discounts/:id/activate` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/limited-discounts/:id/pause` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/limited-discounts/:id/products` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/limited-discounts/:id/products/:productId` | 管理面 | 是 | marketing:create |

**marketing-material.routes.ts**（8 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/materials/` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/materials/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/materials/:id` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/materials/:id/publish` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/materials/:id/archive` | 管理面 | 是 | marketing:create |
| `POST /api/admin/marketing/materials/categories` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/marketing/materials/categories/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/marketing/materials/categories/:id` | 管理面 | 是 | marketing:create |

**marketing-points-mall.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/marketing/points-mall/products` | 管理面 | 是 | marketing:points |
| `PUT /api/admin/marketing/points-mall/products/:id` | 管理面 | 是 | marketing:points |
| `DELETE /api/admin/marketing/points-mall/products/:id` | 管理面 | 是 | marketing:points |
| `POST /api/admin/marketing/points-mall/products/:id/toggle` | 管理面 | 是 | marketing:points |
| `POST /api/admin/marketing/points-mall/exchange` | 管理面 | 是 | marketing:points |
| `POST /api/admin/marketing/points-mall/exchange-records/:id/cancel` | 管理面 | 是 | marketing:points |
| `POST /api/admin/marketing/points-mall/exchange-records/:id/confirm` | 管理面 | 是 | marketing:points |

**points-mall.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/points-mall/items` | 管理面 | 是 | marketing:points |
| `PUT /api/points-mall/items/:id` | 管理面 | 是 | marketing:points |
| `DELETE /api/points-mall/items/:id` | 管理面 | 是 | marketing:points |
| `PUT /api/points-mall/items/:id/status` | 管理面 | 是 | marketing:points |
| `PUT /api/points-mall/orders/:id/deliver` | 管理面 | 是 | marketing:points |
| `PUT /api/points-mall/orders/:id/cancel` | 管理面 | 是 | marketing:points |

**points.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/members/rules` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/members/rules/:id` | 管理面 | 是 | marketing:create |
| `POST /api/admin/members/:id/points/adjust` | 管理面 | 是 | marketing:points |
| `POST /api/admin/members/levels/config` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/members/levels/config/:id` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/members/levels/config/:id/status` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/members/levels/config/:id` | 管理面 | 是 | marketing:create |

**retail-announcement.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/retail-announcement/admin/retail-announcements` | 管理面 | 是 | marketing:create |
| `PUT /api/retail-announcement/admin/retail-announcements/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/retail-announcement/admin/retail-announcements/:id` | 管理面 | 是 | marketing:create |

**retail-announcements-admin.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/retail-announcements/` | 管理面 | 是 | marketing:create |
| `PUT /api/admin/retail-announcements/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/admin/retail-announcements/:id` | 管理面 | 是 | marketing:create |

**seckill.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/seckill/` | 管理面 | 是 | marketing:create |
| `PUT /api/seckill/:id` | 管理面 | 是 | marketing:create |
| `DELETE /api/seckill/:id` | 管理面 | 是 | marketing:create |

**store-coupon.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/coupons/verify` | 管理面 | 是 | marketing:create |
| `POST /api/store/coupons/manual-verify` | 管理面 | 是 | marketing:create |

### 三.12 库存 / 追溯域（12 文件 / 57 端点）

**data-transfer.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/data-transfer/import/customers` | 管理面 | 是 | store:transfer |
| `POST /api/admin/data-transfer/import/products` | 管理面 | 是 | store:transfer |

**inventory-batch.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/inventory-batch/batches` | 管理面 | 是 | inventory:create |
| `PUT /api/admin/inventory-batch/batches/:id` | 管理面 | 是 | inventory:adjust |
| `POST /api/admin/inventory-batch/batches/:id/split` | 管理面 | 是 | inventory:create |
| `POST /api/admin/inventory-batch/expiry-configs` | 管理面 | 是 | inventory:create |
| `PUT /api/admin/inventory-batch/expiry-configs/:id` | 管理面 | 是 | inventory:adjust |
| `DELETE /api/admin/inventory-batch/expiry-configs/:id` | 管理面 | 是 | inventory:adjust |
| `PUT /api/admin/inventory-batch/expiry-alerts/:id/handle` | 管理面 | 是 | inventory:adjust |

**inventory-loss-gain.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/inventory/report-loss-gain` | 管理面 | 是 | inventory:create |

**inventory-share.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/inventory-share/settings` | 管理面 | 是 | inventory:adjust |
| `POST /api/admin/inventory-share/products` | 管理面 | 是 | inventory:create |
| `POST /api/admin/inventory-share/products/batch-add` | 管理面 | 是 | inventory:create |
| `POST /api/admin/inventory-share/products/batch-remove` | 管理面 | 是 | inventory:create |
| `PUT /api/admin/inventory-share/products/:id` | 管理面 | 是 | inventory:adjust |
| `DELETE /api/admin/inventory-share/products/:id` | 管理面 | 是 | inventory:adjust |

**stock-check.routes.ts**（9 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/stock-checks/` | 管理面 | 是 | store:stock-check |
| `PUT /api/admin/stock-checks/:id` | 管理面 | 是 | store:stock-check |
| `POST /api/admin/stock-checks/:id/start` | 管理面 | 是 | store:stock-check |
| `POST /api/admin/stock-checks/:id/complete` | 管理面 | 是 | store:stock-check |
| `POST /api/admin/stock-checks/:id/cancel` | 管理面 | 是 | store:stock-check |
| `POST /api/admin/stock-checks/:id/handle-diff` | 管理面 | 是 | store:stock-check |
| `POST /api/admin/stock-checks/:id/items` | 管理面 | 是 | store:stock-check |
| `PUT /api/store/stock-checks/:id/items/:itemId` | 管理面 | 是 | store:stock-check |
| `POST /api/store/stock-checks/:id/submit` | 管理面 | 是 | store:stock-check |

**stock-warning.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/stock-warnings/config` | 管理面 | 是 | inventory:create |

**store-inventory.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/store/inventory/alerts/:skuId/threshold` | 管理面 | 是 | inventory:adjust |

**store-trace.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/trace/verify` | 管理面 | 是 | trace:code |

**trace.routes.ts**（11 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/trace/configs` | 管理面 | 是 | trace:code |
| `PUT /api/admin/trace/configs/:id` | 管理面 | 是 | trace:code |
| `DELETE /api/admin/trace/configs/:id` | 管理面 | 是 | trace:code |
| `POST /api/admin/trace/configs/check` | 管理面 | 是 | trace:code |
| `POST /api/admin/trace/codes/generate` | 管理面 | 是 | trace:code |
| `POST /api/admin/trace/codes/:traceCode/status` | 管理面 | 是 | trace:code |
| `POST /api/admin/trace/verify` | 管理面 | 是 | trace:code |
| `POST /api/admin/trace/recalls` | 管理面 | 是 | trace:code |
| `POST /api/admin/trace/recalls/:recallNo/execute` | 管理面 | 是 | trace:code |
| `PUT /api/admin/trace/recalls/:recallNo/complete` | 管理面 | 是 | trace:code |
| `POST /api/miniapp/trace/c/verify` | 公开端点（**消费者端免鉴权**，`routeConfigs` 里 `auth:"none"`） | 否 | 不适用（免鉴权） |

> **订正（2026-10-14，S3-198 批次 + 凌舟裁定 §二.②）**：本行原判「管理面 / 是 / trace:code」**有误**——
> `/api/miniapp/trace` 挂载为 `auth:"none"`（小程序消费者扫码校验，无登录态），挂 `requirePermission` 会因
> 无 `req.user` 反成 **401**，把消费者扫码全部打断。已按规则表第 2 条「公开端点」订正；其安全性由
> G3 `guard:route-auth` 的 `auth:"none"` 台账管（本文件 §六 规则表口径）。

**transfer-order.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/transfer-orders/:id` | 管理面 | 是 | store:transfer |
| `DELETE /api/admin/transfer-orders/:id` | 管理面 | 是 | store:transfer |
| `POST /api/admin/transfer-orders/:id/approve` | 管理面 | 是 | inventory:approve |
| `POST /api/admin/transfer-orders/:id/reject` | 管理面 | 是 | inventory:approve |
| `POST /api/admin/transfer-orders/:id/confirm-out` | 管理面 | 是 | store:transfer |
| `POST /api/admin/transfer-orders/:id/confirm-in` | 管理面 | 是 | store:transfer |
| `POST /api/admin/transfer-orders/` | 管理面 | 是 | store:transfer |

**transfer.routes.ts**（8 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/transfers/` | 管理面 | 是 | store:transfer |
| `PUT /api/admin/transfers/:id` | 管理面 | 是 | store:transfer |
| `POST /api/admin/transfers/:id/submit` | 管理面 | 是 | store:transfer |
| `POST /api/admin/transfers/:id/approve` | 管理面 | 是 | inventory:approve |
| `POST /api/admin/transfers/:id/reject` | 管理面 | 是 | inventory:approve |
| `POST /api/admin/transfers/:id/cancel` | 管理面 | 是 | store:transfer |
| `POST /api/admin/transfers/:id/ship` | 管理面 | 是 | store:transfer |
| `POST /api/store/transfers/:id/receive` | 管理面 | 是 | store:transfer |

**warehouse.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/warehouses/` | 管理面 | 是 | inventory:create |
| `PUT /api/admin/warehouses/:id` | 管理面 | 是 | inventory:adjust |
| `DELETE /api/admin/warehouses/:id` | 管理面 | 是 | inventory:adjust |

### 三.15 小程序 / 移动端域（6 文件 / 49 端点）

> ⚠️ **2026-10-15（S3-205 / 总清单第 68 项）起本域口径有变**：`POST/PUT/DELETE /api/miniapp/**` 这类
> **消费者端**写端点，凡同一挂载调用里挂了 `requireConsumerAuthWithTenant` + `csrfMiddleware` 的，
> **一律改为「消费者端保护形态」——不适用商家权限码、不计入缺口**（凌舟裁定，逐条清单与守恒见
> 本文件 §十）。故下表 `miniapp.routes.ts` 中判「管理面 / 是」的行**已由 §十 更正**，本表保留原始盘点
> 供对照（**不要**据本表把消费者端端点接上商家权限码：消费者 `roles` 恒空，接了必 403）。

**marketing-miniapp.routes.ts**（4 处，**已更正**）

| METHOD 路径（**按端点路径匹配，不按行号**） | 文件:行 | 判定 | 该不该要权限 | 依据 |
|:--|:--|:--|:--|:--|
| `POST /api/miniapp/marketing/coupons/:templateId/claim` | `marketing-miniapp.routes.ts:61` | **消费者端**（原判「管理面」有误） | **否** | 受 `requireConsumerAuthWithTenant` + `csrfMiddleware` + `bindSelfIdentity` 保护；商家权限码不适用 |
| `POST /api/miniapp/marketing/flash-sale/:id/buy` | `marketing-miniapp.routes.ts:78` | **消费者端**（原判「管理面」有误） | **否** | 同上 |
| `POST /api/miniapp/marketing/group-buy/:teamId/join` | `marketing-miniapp.routes.ts:86` | **消费者端**（原判「管理面」有误） | **否** | 同上 |
| `POST /api/miniapp/marketing/calculate` | `marketing-miniapp.routes.ts:90` | **消费者端**（原判「管理面」有误） | **否** | 同上（试算不落库，但 S3-178 起同族写端点一律补认证 + CSRF） |

> **路径更正说明（行号已漂移，改按路径匹配）**：本表原三条路径
> `/coupons/claim`、`/flash-sales/grab`、`/group-buys/teams/join` 是**更名前**的形态——
> S3-187（`67beff76`）按契约把它改成带参形态 `/coupons/:templateId/claim`、`/flash-sale/:id/buy`、
> `/group-buy/:teamId/join`；卡面写的 `:55/72/80` 也已漂移，**真实注册行为 61/78/86/90**
> （`rg -n 'requireConsumerAuthWithTenant' backend/src/routes/marketing-miniapp.routes.ts` 可复算）。

**miniapp-config.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/miniapp-config/configs/:platform` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp-config/packages` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp-config/upload-key` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp-config/publish` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**miniapp-order-sync.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/miniapp-order-sync/:orderNo/retry` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**miniapp.routes.ts**（31 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/miniapp/login` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/miniapp/cart` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/cart/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/miniapp/cart/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/miniapp/cart` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/orders` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/orders/:id/pay` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/orders/:id/cancel` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/orders/:id/confirm-receive` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/orders/:id/delete` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/pay/notify` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/miniapp/stored-card/recharge` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/user/profile` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/miniapp/user/addresses` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `PUT /api/miniapp/user/addresses/:id` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `DELETE /api/miniapp/user/addresses/:id` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/miniapp/user/addresses/:id/default` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/miniapp/coupons/:id/use` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/member/coupons/:id/receive` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/user/profile-update` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/miniapp/user/change-password` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/miniapp/wholesale/cart` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/wholesale/cart/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/miniapp/wholesale/cart/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/wholesale/orders` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/wholesale/cart/delete` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/wholesale/cart/:itemId/select` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/wholesale/cart/select-all` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/wholesale/orders/:orderId/cancel` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/wholesale/orders/:orderId/confirm-receive` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/wholesale/orders/buy-now` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**retail-consumer-address.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/retail-consumer-address/miniapp/addresses` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `PUT /api/retail-consumer-address/miniapp/addresses/:id` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `DELETE /api/retail-consumer-address/miniapp/addresses/:id` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `PUT /api/retail-consumer-address/miniapp/addresses/:id/default` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |

**wechat.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/miniapp/wechat/auth/login` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/miniapp/wechat/auth/decrypt-phone` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/wechat/auth/profile` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/miniapp/wechat/auth/bind` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/miniapp/wechat/auth/unbind` | 公开端点 | 否 | 不适用（免鉴权） |

### 三.2 客户域（12 文件 / 45 端点）

**admin-customer.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/members` | 管理面 | 是 | customer:create |
| `PUT /api/admin/members/:id` | 管理面 | 是 | customer:edit |
| `PUT /api/admin/members/:id/disable` | 管理面 | 是 | customer:edit |
| `PUT /api/admin/members/:id/assign-staff` | 管理面 | 是 | customer:edit |
| `POST /api/admin/members/register` | 公开端点 | 否 | 不适用（免鉴权） |
| `PUT /api/admin/members/:id/member-level` | 管理面 | 是 | customer:edit |

**customer-care.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/members/care/rules` | 管理面 | 是 | customer:create |
| `PUT /api/admin/members/care/rules/:id` | 管理面 | 是 | customer:edit |
| `DELETE /api/admin/members/care/rules/:id` | 管理面 | 是 | customer:edit |
| `POST /api/admin/members/care/rules/:id/execute` | 管理面 | 是 | customer:create |

**customer-merge.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/customer-merge/merge` | 管理面 | 是 | customer:create |

**customer-payment.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/customer-payments/` | 管理面 | 是 | customer:create |
| `POST /api/store/customer-payments/:receiptNo/void` | 管理面 | 是 | customer:create |

**customer-price.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/customer-prices/` | 管理面 | 是 | customer:create |
| `PUT /api/admin/customer-prices/:id` | 管理面 | 是 | customer:edit |
| `DELETE /api/admin/customer-prices/:id` | 管理面 | 是 | customer:edit |

**customer-segment.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/members/segments/` | 管理面 | 是 | customer:create |
| `PUT /api/admin/members/segments/:id` | 管理面 | 是 | customer:edit |
| `DELETE /api/admin/members/segments/:id` | 管理面 | 是 | customer:edit |
| `POST /api/admin/members/segments/:id/refresh` | 管理面 | 是 | customer:create |

**customer-statement.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/customer-statements/` | 管理面 | 是 | customer:create |
| `POST /api/store/customer-statements/:statementNo/confirm` | 管理面 | 是 | customer:create |
| `POST /api/store/customer-statements/:statementNo/paid` | 管理面 | 是 | customer:create |

**customer-tag.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/members/tags/` | 管理面 | 是 | customer:create |
| `PUT /api/admin/members/tags/:id` | 管理面 | 是 | customer:edit |
| `DELETE /api/admin/members/tags/:id` | 管理面 | 是 | customer:edit |
| `POST /api/admin/members/tags/:id/tags` | 管理面 | 是 | customer:create |
| `DELETE /api/admin/members/tags/:id/tags/:tagId` | 管理面 | 是 | customer:edit |

**customer-type.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/customer-types/` | 管理面 | 是 | customer:create |
| `PUT /api/admin/customer-types/:id` | 管理面 | 是 | customer:edit |
| `DELETE /api/admin/customer-types/:id` | 管理面 | 是 | customer:edit |

**customer-visit.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/customer-visits/` | 管理面 | 是 | customer:visit |
| `PUT /api/admin/customer-visits/:visitNo` | 管理面 | 是 | customer:visit |
| `POST /api/admin/customer-visits/:visitNo/checkin` | 管理面 | 是 | customer:visit |
| `POST /api/admin/customer-visits/:visitNo/checkout` | 管理面 | 是 | customer:visit |
| `POST /api/admin/customer-visits/:visitNo/cancel` | 管理面 | 是 | customer:visit |

**member-register.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/members/sms-code` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/store/members/register` | 公开端点 | 否 | 不适用（免鉴权） |

**tag.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/tags/groups` | 管理面 | 是 | customer:create |
| `PUT /api/admin/tags/groups/:id` | 管理面 | 是 | customer:edit |
| `DELETE /api/admin/tags/groups/:id` | 管理面 | 是 | customer:edit |
| `POST /api/admin/tags` | 管理面 | 是 | customer:create |
| `PUT /api/admin/tags/:id` | 管理面 | 是 | customer:edit |
| `DELETE /api/admin/tags/:id` | 管理面 | 是 | customer:edit |
| `PUT /api/admin/products/:spuId/tags` | 管理面 | 是 | customer:edit |

### 三.3 商品域（10 文件 / 45 端点）

**admin-library.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/library/lookup` | 管理面 | 是 | goods:create |

**admin-product.routes.ts**（13 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/products/upload-image` | 管理面 | 是 | goods:create |
| `PUT /api/admin/products/:id/status` | 管理面 | 是 | goods:edit |
| `PUT /api/admin/products/:id` | 管理面 | 是 | goods:edit |
| `PUT /api/admin/products/:id/disable` | 管理面 | 是 | goods:edit |
| `PUT /api/admin/products/:skuId/price` | 管理面 | 是 | goods:price |
| `PUT /api/admin/products/skus/:skuId/barcode` | 管理面 | 是 | goods:edit |
| `PUT /api/admin/products/skus/:skuId` | 管理面 | 是 | goods:edit |
| `POST /api/admin/products/skus/:skuId/units` | 管理面 | 是 | goods:create |
| `PUT /api/admin/products/skus/:skuId/units/:unitId` | 管理面 | 是 | goods:edit |
| `DELETE /api/admin/products/skus/:skuId/units/:unitId` | 管理面 | 是 | goods:delete |
| `POST /api/admin/products/import` | 管理面 | 是 | goods:create |
| `PUT /api/admin/products/:spuId/marketing-tags` | 管理面 | 是 | goods:edit |
| `PUT /api/admin/products/:id/warning-threshold` | 管理面 | 是 | goods:edit |

**brand.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/brands/` | 管理面 | 是 | goods:create |
| `PUT /api/admin/brands/:id` | 管理面 | 是 | goods:edit |
| `DELETE /api/admin/brands/:id` | 管理面 | 是 | goods:delete |

**category.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/products/categories/` | 管理面 | 是 | goods:create |
| `PUT /api/admin/products/categories/:id` | 管理面 | 是 | goods:edit |
| `DELETE /api/admin/products/categories/:id` | 管理面 | 是 | goods:delete |
| `PUT /api/admin/products/categories/:id/sort` | 管理面 | 是 | goods:edit |

**price.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/prices/best-price` | 管理面 | 是 | goods:price |
| `POST /api/admin/prices/batch/preview` | 管理面 | 是 | goods:price |

**product-bundle.routes.ts**（8 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/product-bundles` | 管理面 | 是 | goods:create |
| `PUT /api/admin/product-bundles/:id` | 管理面 | 是 | goods:edit |
| `DELETE /api/admin/product-bundles/:id` | 管理面 | 是 | goods:delete |
| `POST /api/admin/product-bundles/:id/publish` | 管理面 | 是 | goods:create |
| `POST /api/admin/product-bundles/:id/unpublish` | 管理面 | 是 | goods:create |
| `POST /api/admin/combo-products` | 管理面 | 是 | goods:create |
| `PUT /api/admin/combo-products/:id` | 管理面 | 是 | goods:edit |
| `DELETE /api/admin/combo-products/:id` | 管理面 | 是 | goods:delete |

**product-marketing-tag.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/product-tags/` | 管理面 | 是 | goods:create |
| `PUT /api/admin/product-tags/:id` | 管理面 | 是 | goods:edit |
| `DELETE /api/admin/product-tags/:id` | 管理面 | 是 | goods:delete |

**product-review.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/product-reviews/` | 管理面 | 是 | goods:create |
| `POST /api/admin/product-reviews/:id/approve` | 管理面 | 是 | goods:create |
| `POST /api/admin/product-reviews/:id/reject` | 管理面 | 是 | goods:create |
| `POST /api/admin/product-reviews/batch-approve` | 管理面 | 是 | goods:create |
| `POST /api/admin/product-reviews/batch-reject` | 管理面 | 是 | goods:create |

**unit-group.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/unit-groups/` | 管理面 | 是 | goods:create |
| `PUT /api/admin/unit-groups/:id` | 管理面 | 是 | goods:edit |
| `DELETE /api/admin/unit-groups/:id` | 管理面 | 是 | goods:delete |

**unit.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/units/` | 管理面 | 是 | goods:create |
| `PUT /api/admin/units/:id` | 管理面 | 是 | goods:edit |
| `DELETE /api/admin/units/:id` | 管理面 | 是 | goods:delete |

### 三.9 系统设置 / 基础域（13 文件 / 39 端点）

**alert.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/alerts/:id/handle` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/alerts/rules/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/alerts/check` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**approval.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/approval/rules` | 管理面 | 是 | system:approval |
| `PUT /api/admin/approval/rules/:id` | 管理面 | 是 | system:approval |
| `DELETE /api/admin/approval/rules/:id` | 管理面 | 是 | system:approval |
| `POST /api/admin/approval/instances/submit` | 管理面 | 是 | system:approval |
| `POST /api/admin/approval/tasks/:id/approve` | 管理面 | 是 | system:approval |
| `POST /api/admin/approval/tasks/:id/reject` | 管理面 | 是 | system:approval |
| `POST /api/admin/approval/notifications/:id/read` | 管理面 | 是 | system:approval |

**archive.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/archive/execute` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**avatar.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/auth/avatar` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**error-log.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/error-report` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**monitor.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/monitor/notify-expiring` | 公开端点 | 否 | 不适用（免鉴权） |

**notification.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/notifications/:id/read` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/notifications/read-all` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/notifications/send` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/admin/notifications/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/notifications/batch-delete` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/miniapp/notifications/:id/read` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/notifications/read-all` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**push.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/push/register` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/admin/push/unregister` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/admin/push/test` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**share.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/share/collections/:token/pay` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/share/collections/:token/wx-notify` | 公开端点 | 否 | 不适用（免鉴权） |

**sms-template.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/sms-templates/` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/sms-templates/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/admin/sms-templates/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**sync.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/sync/price` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/sync/product` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/sync/offline-orders` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**sys-config.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `DELETE /api/admin/sys-config/backups/:name` | 管理面 | 是 | system:config |
| `PUT /api/admin/sys-config/tenant-info` | 管理面 | 是 | system:config |
| `PUT /api/admin/sys-config/batch` | 管理面 | 是 | system:config |
| `POST /api/admin/sys-config/` | 管理面 | 是 | system:config |
| `POST /api/admin/sys-config/test-mail` | 管理面 | 是 | system:config |
| `POST /api/admin/sys-config/manual-backup` | 管理面 | 是 | system:config |

**system.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/system/migrate` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

### 三.16 采购域（9 文件 / 31 端点）

**purchase-contract.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/purchase-contracts/` | 管理面 | 是 | purchase:create | ✅ 已接 `purchase:create`（生产仅 SUPER_ADMIN 持有） |
| `PUT /api/admin/purchase-contracts/:contractNo` | 管理面 | 是 | purchase:create | ✅ 同上 |
| `DELETE /api/admin/purchase-contracts/:contractNo` | 管理面 | 是 | purchase:create | ✅ 同上 |
| `POST /api/admin/purchase-contracts/:contractNo/upload` | 管理面 | 是 | purchase:create | ✅ 同上 |

**purchase-in-stock.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/purchase-in-stocks/` | 管理面 | 是 | purchase:create | ⛔ **本批不接**（移动端创建端点，见 §十一.3 M 类） |
| `POST /api/admin/purchase-in-stocks/:stockNo/approve` | 管理面 | 是 | purchase:approve | 🔁 **改挂 `inventory:inbound`**（入库审核的办件人是仓管，不持 purchase:*） |
| `POST /api/admin/purchase-in-stocks/:stockNo/void` | 管理面 | 是 | purchase:create | 🔁 **改挂 `inventory:inbound`**（同一入库生命周期） |

**purchase-payment.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/purchase-payments/` | 管理面 | 是 | purchase:create | ⛔ **本批不接**（移动端创建端点，见 §十一.3 M 类） |
| `POST /api/admin/purchase-payments/:paymentNo/approve` | 管理面 | 是 | purchase:approve | 🔁 **改挂 `finance:payment`**（付款审核的办件人是财务，不持 purchase:*） |
| `POST /api/admin/purchase-payments/:paymentNo/void` | 管理面 | 是 | purchase:create | 🔁 **改挂 `finance:payment`**（同一付款生命周期） |

**purchase-plan.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/purchase-plans/` | 管理面 | 是 | purchase:create | ⏳ **本批不接 ⇒ 待授权模型定案**（页面真实使用者含 STORE_MANAGER，见 §十一.3 W 类） |
| `POST /api/admin/purchase-plans/:planNo/convert` | 管理面 | 是 | purchase:create | ⏳ **本批不接 ⇒ 待授权模型定案**（同上） |

**purchase-return.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/purchase-returns/` | 管理面 | 是 | purchase:create | ⛔ **本批不接**（移动端创建端点，见 §十一.3 M 类） |
| `POST /api/admin/purchase-returns/:returnNo/approve` | 管理面 | 是 | purchase:approve | 🔁 **改挂 `sale:return`**（采购退货页 meta.roles 含 STORE_MANAGER，店长不持 purchase:*） |
| `POST /api/admin/purchase-returns/:returnNo/void` | 管理面 | 是 | purchase:create | 🔁 **改挂 `sale:return`**（同一退货生命周期） |

**purchase.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/purchase-orders/` | 管理面 | 是 | purchase:create | ⛔ **本批不接**（移动端创建端点，见 §十一.3 M 类） |
| `POST /api/admin/purchase-orders/:orderNo/approve` | 管理面 | 是 | purchase:approve | ✅ 已接 `purchase:approve` |
| `POST /api/admin/purchase-orders/:orderNo/cancel` | 管理面 | 是 | purchase:create | ✅ 已接 `purchase:create`（作废类沿用既有码，不新立 purchase:void） |
| `PUT /api/admin/purchase-orders/:orderNo` | 管理面 | 是 | purchase:create | ✅ 已接 `purchase:create` |
| `DELETE /api/admin/purchase-orders/:orderNo` | 管理面 | 是 | purchase:create | ✅ 已接 `purchase:create` |

**supplier-contact.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/supplier-contacts/supplier/:supplierId` | 管理面 | 是 | purchase:create | 🔁 **改挂 `purchase:supplier`**（供应商管理域码，与移动端菜单码同码） |
| `PUT /api/admin/supplier-contacts/:id` | 管理面 | 是 | purchase:create | 🔁 **改挂 `purchase:supplier`** |
| `DELETE /api/admin/supplier-contacts/:id` | 管理面 | 是 | purchase:create | 🔁 **改挂 `purchase:supplier`** |
| `POST /api/admin/supplier-contacts/:id/set-primary` | 管理面 | 是 | purchase:create | 🔁 **改挂 `purchase:supplier`** |

**supplier-statement.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/supplier-statements/generate` | 管理面 | 是 | purchase:create | 🔁 **改挂 `report:finance`**（对账页 meta.roles 含 STORE_MANAGER；店长持 report:* 但不持 supplier:statement） |
| `POST /api/admin/supplier-statements/:statementNo/confirm` | 管理面 | 是 | purchase:create | 🔁 **改挂 `report:finance`**（同上） |
| `POST /api/admin/supplier-statements/:statementNo/dispute` | 管理面 | 是 | purchase:create | 🔁 **改挂 `report:finance`**（同上） |

**supplier.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 | S3-214-B2 落地（2026-10-16） |
|:--|:--|:--|:--|:--|
| `POST /api/admin/suppliers/` | 管理面 | 是 | purchase:create | 🔁 **改挂 `purchase:supplier`**（与移动端供应商管理菜单码同码，零回归） |
| `PUT /api/admin/suppliers/:id` | 管理面 | 是 | purchase:create | 🔁 **改挂 `purchase:supplier`** |
| `POST /api/admin/suppliers/:id/contacts` | 管理面 | 是 | purchase:create | 🔁 **改挂 `purchase:supplier`** |
| `DELETE /api/admin/suppliers/:id/contacts/:contactId` | 管理面 | 是 | purchase:create | 🔁 **改挂 `purchase:supplier`** |

### 三.7 门店 / 租户域（8 文件 / 31 端点）

**admin-store.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/system/stores` | 管理面 | 是 | store:create |
| `PUT /api/admin/system/stores/:id` | 管理面 | 是 | store:edit |

**demo.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/demo/seed` | 管理面 | 是 | store:create |
| `POST /api/admin/demo/reset` | 管理面 | 是 | store:create |

**store-control.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/store-control/configs/:storeId` | 管理面 | 是 | store:edit |
| `POST /api/admin/store-control/:storeId/open` | 管理面 | 是 | store:create |
| `POST /api/admin/store-control/:storeId/close` | 管理面 | 是 | store:create |
| `POST /api/admin/store-control/:storeId/suspend` | 管理面 | 是 | store:create |
| `POST /api/admin/store-control/:storeId/resume` | 管理面 | 是 | store:create |

**store-value-card.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/store-value-cards/` | 管理面 | 是 | store:create |
| `POST /api/admin/store-value-cards/:cardNo/recharge` | 管理面 | 是 | store:create |
| `POST /api/admin/store-value-cards/:cardNo/freeze` | 管理面 | 是 | store:create |
| `POST /api/admin/store-value-cards/:cardNo/unfreeze` | 管理面 | 是 | store:create |

**store.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/members/manage` | 管理面 | 是 | store:create |
| `PUT /api/store/members/:id(\d+)` | 管理面 | 是 | store:edit |

**subscription.routes.ts**（8 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/subscriptions-management/plans` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/subscriptions-management/plans/:planId` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/subscriptions-management/plans/:planId/policy` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/subscriptions-management/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/subscriptions-management/:subscriptionId/change-plan` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/subscriptions-management/:subscriptionId/cancel` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/subscriptions-management/:subscriptionId/pay` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `POST /api/platform/subscriptions-management/:subscriptionId/renew` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

**tenant-register.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/tenant/register` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/tenant/register/sms-code` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/tenant/applications/:id/approve` | 管理面 | 是 | store:create |
| `POST /api/tenant/applications/:id/reject` | 管理面 | 是 | store:create |

**tenant.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/platform/tenants-management/` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/tenants-management/:tenantId` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/tenants-management/:tenantId/status` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/tenants-management/:tenantId/modules` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

### 三.1 员工 / 账号域（7 文件 / 31 端点）

**admin-auth.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/auth/settings` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/admin/auth/change-password` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/admin/auth/mfa/setup` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/admin/auth/mfa/confirm` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/admin/auth/mfa/disable` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |

**admin-staff.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/staff` | 管理面 | 是 | system:user:create |
| `PUT /api/admin/staff/:id` | 管理面 | 是 | system:user:edit |
| `PUT /api/admin/staff/:id/status` | 管理面 | 是 | system:user:edit |
| `PUT /api/admin/staff/:id/disable` | 管理面 | 是 | system:user:edit |
| `POST /api/admin/staff/:id/restore` | 管理面 | 是 | system:user:create |

**data-permission.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/data-permissions/` | 管理面 | 是 | system:role:create |
| `PUT /api/admin/data-permissions/:id` | 管理面 | 是 | system:role:edit |
| `DELETE /api/admin/data-permissions/:id` | 管理面 | 是 | system:role:edit |
| `POST /api/admin/data-permissions/roles/:roleId` | 管理面 | 是 | system:role:create |
| `DELETE /api/admin/data-permissions/roles/:roleId/:dataPermissionId` | 管理面 | 是 | system:role:edit |
| `POST /api/admin/data-permissions/users/:userId/check` | 管理面 | 是 | system:role:create |

**department.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/department/` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/department/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/department/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/department/:id/move` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**rbac.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/system/roles/` | 管理面 | 是 | system:role:create |
| `PUT /api/admin/system/roles/:id` | 管理面 | 是 | system:role:edit |
| `DELETE /api/admin/system/roles/:id` | 管理面 | 是 | system:role:edit |
| `PUT /api/admin/system/roles/:id/data-permissions` | 管理面 | 是 | system:role:edit |
| `PUT /api/admin/system/roles/users/:userId/roles` | 管理面 | 是 | system:role:edit |

**sys-user.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/sys-users/` | 管理面 | 是 | system:user:create |
| `PUT /api/admin/sys-users/:id` | 管理面 | 是 | system:user:edit |
| `POST /api/admin/sys-users/:id/reset-password` | 管理面 | 是 | system:user:create |
| `DELETE /api/admin/sys-users/:id` | 管理面 | 是 | system:user:edit |

**user-session.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `DELETE /api/user-session/:id` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `DELETE /api/user-session/user/:userId` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |

### 三.10 财务域（9 文件 / 28 端点）

**bank-account.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/bank-accounts/` | 管理面 | 是 | finance:create |
| `PUT /api/admin/bank-accounts/:id` | 管理面 | 是 | finance:create |
| `POST /api/admin/bank-accounts/:id/close` | 管理面 | 是 | finance:create |

**commission.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/commission/rules/:id` | 管理面 | 是 | finance:create |
| `DELETE /api/admin/commission/rules/:id` | 管理面 | 是 | finance:create |
| `POST /api/admin/commission/calculate` | 管理面 | 是 | finance:create |

**credit.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/credits/collections` | 管理面 | 是 | finance:create |
| `PUT /api/admin/credits/collections/:id` | 管理面 | 是 | finance:create |
| `POST /api/admin/credits/collections/auto-generate` | 管理面 | 是 | finance:create |
| `POST /api/admin/credits/collections/batch-remind` | 管理面 | 是 | finance:create |
| `PUT /api/admin/credits/:customerId/limit` | 管理面 | 是 | finance:create |
| `PUT /api/admin/credits/:customerId/term` | 管理面 | 是 | finance:create |

**expense.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/expenses/:expenseNo` | 管理面 | 是 | finance:create |
| `POST /api/admin/expenses/:expenseNo/approve` | 管理面 | 是 | finance:create |
| `POST /api/admin/expenses/:expenseNo/void` | 管理面 | 是 | finance:create |

**payment-config.routes.ts**（6 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/payment-config/configs/:provider` | 管理面 | 是 | finance:create |
| `POST /api/payment-config/configs/:provider/test` | 管理面 | 是 | finance:create |
| `POST /api/payment-config/bank-accounts` | 管理面 | 是 | finance:create |
| `PUT /api/payment-config/bank-accounts/:id` | 管理面 | 是 | finance:create |
| `DELETE /api/payment-config/bank-accounts/:id` | 管理面 | 是 | finance:create |
| `POST /api/payment-config/bank-accounts/:id/default` | 管理面 | 是 | finance:create |

**payment-new.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/payments-new/` | 管理面 | 是 | finance:create |
| `POST /api/admin/payments-new/:paymentNo/void` | 管理面 | 是 | finance:create |

**payment.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/pay/wx/callback` | 公开端点 | 否 | 不适用（免鉴权） |

**receipt.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/receipts/` | 管理面 | 是 | finance:receipt:create |
| `POST /api/admin/receipts/:receiptNo/void` | 管理面 | 是 | finance:receipt:create |

**reconciliation.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/reconciliation/customer/:customerId/confirm` | 管理面 | 是 | finance:statement |
| `POST /api/admin/reconciliation/supplier/:supplierId/confirm` | 管理面 | 是 | finance:statement |

### 三.11 报表域（4 文件 / 18 端点）

**custom-report-v2.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/reports/` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/reports/:id(\d+)` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/admin/reports/:id(\d+)` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/reports/:id(\d+)/generate` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**custom-report.routes.ts**（9 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/custom-report/templates` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/custom-report/templates/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/custom-report/templates/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/custom-report/templates/:id/execute` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/custom-report/schedules` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/custom-report/schedules/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/custom-report/schedules/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/custom-report/schedules/:id/toggle` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/custom-report/schedules/:id/run` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**report-permissions.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/admin/report-permissions/matrix` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/report-permissions/data-scope` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/report-permissions/batch` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/report-permissions/user/:userId` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**report.routes.ts**（1 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/reports/export` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

### 三.14 硬件 / 打印域（3 文件 / 16 端点）

**hardware-callback.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/store/hardware/callbacks/cloud-speaker/:tenantId` | 公开端点 | 否 | 不适用（免鉴权） |
| `POST /api/store/hardware/callbacks/box/:tenantId` | 公开端点 | 否 | 不适用（免鉴权） |

**print.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/print/records` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/print/records/:id/reprint` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/print/templates` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/print/templates/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/admin/print/templates/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/print/templates/:id/reset` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/print/templates/:id/set-default` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

**store-hardware.routes.ts**（7 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/store/hardware/configs/:category` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/store/hardware/configs/:category/test` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/store/hardware/cloud-speaker/announce` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/store/hardware/box/pay` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/store/hardware/box-config` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/store/hardware/box-config/test` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/store/hardware/unionpay/test` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

### 三.17 工作台 / 待办消息域（1 文件 / 11 端点）

**workbench.routes.ts**（11 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/todos` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/todos/:id/complete` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/todos/:id/dismiss` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/admin/todos/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/admin/quick-entries` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/quick-entries/sort` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/quick-entries/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `DELETE /api/admin/quick-entries/:id` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `PUT /api/admin/wb-notifications/:id/read` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `POST /api/admin/wb-notifications/read-all` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |
| `DELETE /api/admin/wb-notifications/:id` | 自服务/本人数据 | 否 | 不适用（按登录态本人数据） |

### 三.8 AI 域（1 文件 / 4 端点）

**ai-billing.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `PUT /api/platform/ai-billing/billing-strategy` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/ai-billing/free-grant` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/ai-billing/quota-packs` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |
| `PUT /api/platform/ai-billing/points-rate` | 平台域 | — | 平台权限点另立单（t_platform_permission_catalog） |

### 三.13 工单 / 客服域（1 文件 / 2 端点）

**feedback.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/feedback` | 管理面 | 是 | ticket:transfer |
| `PUT /api/admin/feedback/:id` | 管理面 | 是 | ticket:transfer |

---

## 四、试点域（报表域）落地明细

派单卡 §二.③ 指定**报表域**为试点，范围钉死 3 个文件：`admin-report.routes.ts`、
`custom-report.routes.ts`、`custom-report-v2.routes.ts`（本单**未碰**其它域）。

### 4.1 逐端点：路径 / 判定 / 是否落地 / 依据

| # | METHOD 路径 | 页面（前端 roles 门禁） | 判定 | 是否落地 | 建议/落地权限码 | 依据 / 不落地的理由 |
|--:|:--|:--|:--|:--|:--|:--|
| 1 | `POST /api/admin/collection-links/:linkNo/revoke` | 收款关联 `sales/collection-links`（SUPER_ADMIN + STORE_MANAGER，`router/index.ts:110`） | 管理面 | **已落地** | `report:finance` | 079:185 报表中心既有码；持有者含 STORE_MANAGER（`report:*`）⇒ 页面角色不 403（§4.2） |
| 2 | `POST /api/admin/sale-bills/batch-collection-link` | 同上 | 管理面 | **已落地** | `report:finance` | 同上 |
| 3 | `POST /api/custom-report/templates` | 自定义报表 `reports/custom-report`（**仅 SUPER_ADMIN**，`router/index.ts:218`） | 管理面 | 未落地（登记） | **无现成码** | 报表域既有 5 个细码（`report:sales/product/finance/customer/staff`）语义均为**报表分类页**，不含「报表模板管理」；按红线 1 **不硬塞** ⇒ 需先立权限点 |
| 4-6 | `PUT/DELETE /api/custom-report/templates/:id`、`POST /api/custom-report/templates/:id/execute` | 同上 | 管理面 | 未落地（登记） | **无现成码** | 同上 |
| 7-11 | `POST|PUT|DELETE /api/custom-report/schedules`（含 `:id/toggle`、`:id/run`） | 无页面调用（`api/report.ts` 有此导出，全仓无页面引用） | 管理面（**定时任务可自触发**，风险高于模板 CRUD） | 未落地（登记） | **无现成码** | 同上；且**无人调用** → 建议连同「是否保留该能力」一并裁定 |
| 12-15 | `POST|PUT|DELETE /api/admin/reports`、`POST /api/admin/reports/:id/generate` | 自定义报表 v2（无独立页面；与 `report.routes.ts` 共用 `/api/admin/reports` 前缀） | 管理面 | 未落地（登记） | **无现成码** | 同上 |

> **试点结论（一句话）**：报表域 15 个写端点里，**只有 2 个（收款链接）能在不新造码、不让现有角色 403 的前提下落地**；
> 其余 13 个卡在「报表域的权限点粒度只到报表分类页、没有模板/定时任务这一类」——这不是实现问题，是**权限目录缺码**问题。
> 建议另立一单补 2~3 个细码（建议名：`report:template`（模板 CRUD）、`report:schedule`（定时任务）、`report:custom`（自定义报表），
> 具体命名与授予角色由凌舟裁定），补码后本域剩下 13 处是**纯机械接线**（改法与本单 1/2 行完全一致）。

### 4.2 权限码持有核对（接线前必做，本单已做）

复算命令（可复跑，输出见回传卡）：

```
node backend/scripts/guard-rbac-wiring.mjs --holders report:finance
```

结果（仓库角色种子 × 真实 `matchPermission` 语义）：

| 权限码 | 持有角色（种子口径） | 页面角色（`router/index.ts:110`） | 结论 |
|:--|:--|:--|:--|
| `report:finance` | `SUPER_ADMIN`（`*`）、`OPERATION_ADMIN`（`*`）、**`STORE_MANAGER`**（`report:*`）、`FINANCE_STAFF`（`report:*`） | `SUPER_ADMIN` + `STORE_MANAGER` | ✅ 页面角色 ⊆ 持有者 ⇒ 接线**不会**让现有页面角色 403 |

⚠️ **边界（必须知道）**：本表来自**仓库种子**（079/128/ops-S3-122*），不是生产真值。生产库还有仓库种子里没有的角色
（`STORE_ADMIN` / `SALESMAN` / `CASHIER` 等，见 `docs/tasks/cards/R101-S3-136-F1-生产矩阵基线.md` §二）⇒
**合并前请凌舟在服务器执行**（本单无 DB 访问权限）：

```sql
SELECT role_code, permissions FROM t_sys_role WHERE tenant_id='default' ORDER BY id;
```

并把结果与 §4.2 表比对：**只要出现「会用该页面、但不在持有者集合里」的角色，就要先补授权再接线**。

### 4.3 反测（两侧）

```
# 反测 A（分辨力）：脚本必须能看出缺口
node backend/scripts/guard-rbac-wiring.mjs | Select-String 'custom-report.templates'
# 反测 B（--strict 两侧）：摘掉任一新增的 requirePermission
#   ⇒ node backend/scripts/guard-rbac-wiring.mjs --strict 期望 EXIT=1 且点出该端点
#   复原 ⇒ 期望 EXIT=0
```

原始输出见回传卡 `docs/tasks/cards/R101-S3-180-阿坚-回传.md`。

---

## 五、复算命令（任何人可自行核对本文件的数字）

```powershell
# 0) 起点（不允许旧工作树污染结论）
git log --oneline -1
# 1) 报告模式：缺口总数 + 人读清单（恒 EXIT=0）
node backend/scripts/guard-rbac-wiring.mjs
# 2) 机读模式：端点级明细（本文件 §三 与 baseline 的数据源）
node backend/scripts/guard-rbac-wiring.mjs --json
# 3) 严格模式：未登记缺口 ⇒ EXIT=1
node backend/scripts/guard-rbac-wiring.mjs --strict
# 4) 某个权限码的持有角色（接线前核对用）
node backend/scripts/guard-rbac-wiring.mjs --holders report:finance
# 5) 自证：清单覆盖的文件数 / 端点行数
(Select-String -Path docs/tasks/R101-RBAC接线缺口清单.md -Pattern '^\*\*.+\.routes\.ts\*\*').Count
(Select-String -Path docs/tasks/R101-RBAC接线缺口清单.md -Pattern '^\| `(POST|PUT|PATCH|DELETE) ').Count
```

---

## 六、判定规则表（本清单「判定 / 建议码」两列怎么来的）

**分域**：按文件名关键词（顺序即优先级，先命中先归）：平台 → 小程序/移动端 → AI → 客户 → 采购 → 商品 → 库存/追溯 →
硬件/打印 → 销售 → 报表 → 营销 → 门店/租户 → 财务 → 员工/账号 → 工作台 → 工单/客服 → 系统设置/基础。

**端点判定**（顺序即优先级）：

1. 路径前缀 `/api/platform|/api/padmin|/api/saas|/api/app` ⇒ **平台域**（走 `requirePlatformAuth`，属另一套权限点，本单不接）。
2. 路径含 `callback|notify|webhook|login|register|captcha|sms-code|mfa/verify|bind|unbind` ⇒ **公开端点**（未登录调用，
   加权限码无意义；其安全性另由 G3 `guard:route-auth` 的 `auth:"none"` 台账管）。
3. 路径含 `/my|/me|/mine|/self|/profile|/address(es)|/wb-notifications|change-password|mfa/setup|auth/settings|logout|user-session`
   ⇒ **自服务/本人数据**（身份由登录态约束，建议不加权限码）。
4. 其余 ⇒ **管理面**（需要权限码）。

**建议权限码**：按域 + 路径关键词映射到**既有码**，取值优先级 = ①079 的 64 码 → ②代码里已在用的码 → ③**都没有 ⇒ 另立单**。

| 域 | 建议码取向 |
|:--|:--|
| 商品域 | `goods:create` / `goods:edit` / `goods:delete` / `goods:price`（价格）/ `goods:inventory:adjust`（库存调整） |
| 库存 / 追溯域 | `inventory:create` / `inventory:adjust` / `inventory:approve` / `trace:code` |
| 销售域 | `sale:create` / `sale:edit` / `sale:void` / `sale:return` / `sale:commission` |
| 采购域 | `purchase:create` / `purchase:approve` |
| 客户域 | `customer:create` / `customer:edit` / `customer:credit:adjust` / `customer:visit` |
| 报表域 | `report:sales / report:product / report:finance / report:customer / report:staff`；**模板 / 定时任务 / 自定义报表无现成码** |
| 员工 / 账号域 | `system:user:create|edit` / `system:role:create|edit`（部门 / 数据权限 / MFA / 会话管理**无现成码**） |
| 系统设置 / 基础域 | `system:config` / `system:audit` / `system:approval`；消息 / 短信模板 / 推送 / 同步**无现成码** |
| 营销域 | `marketing:create` / `marketing:points` |
| 门店 / 租户域 | `store:create` / `store:edit` / `store:transfer` / `store:stock-check`；租户 / 订阅 / 演示**多半无现成码** |
| 财务域 | `finance:create` / `finance:receipt:create` / `finance:statement` / `finance:daily-settle` |
| 工单 / 客服域 | `ticket:reply|note|close|resolve|transfer` |
| 工作台 / AI / 硬件 / 基础公共 | 基本**无现成码** ⇒ 需先立权限点 |

**已知局限（请连同结论一起读）**：

1. 「判定 / 建议码」是**规则化产出**，不是逐条人工审定 ⇒ 用于**分批排期**足够，用于**直接接线不足**；
   接线前每一条仍须按 §4.2 的方法核对持有角色，并确认码的语义与该端点匹配。
2. 本清单**不区分粒度优劣**：某些域（如报表域）本就需要更细的码，清单只负责把「需要新码」的条目数出来（共 
   98 条）。
3. 建议码里出现的 `finance:create` / `inventory:adjust` / `finance:daily-settle` 等属**代码已在用、但不在 079 矩阵**里的码 ⇒
   接线批次需要先确认它们在生产 `t_sys_role.permissions` 里的授予情况（本单的 `--holders` 只能给仓库种子口径）。

## 七、建议的后续批次切法（仅供凌舟排期参考）

| 批 | 范围 | 前置 |
|:--|:--|:--|
| C1 | **先补权限点目录**：报表域 3 个细码 + 系统设置域消息/短信/推送 + 员工域部门/数据权限 + 工作台/AI/硬件（合计约 98 条判断里挑高频） | 本清单 §六 |
| C2 | **管理面按域批量接线**（商品 / 库存 / 销售 / 采购 / 客户 / 营销 / 门店 / 财务）：520+ 处，建议**一域一 PR** | C1 或**先用既有码的域先做** |
| C3 | **平台域**（138 处）：改走 `t_platform_permission_catalog` 权限点，属另一条线 | 平台角色/权限点目录可用 |
| C4 | 把 `guard:rbac-wiring` **接进 CI**（`--strict` 阻断） | 缺口清零 **或** 台账逐条登记 + 连续观察期无漂移 |

> 说明：C2 里「先用既有码的域」可**不等 C1** 就能开工（那些域的建议码都是既有码），
> 这也是本单建议的最短路径——**先做能做的，别等缺码的域**。

---

## 八、规则表原文位置

生成器（含完整规则表 DOMAIN_RULES / PUBLIC_RE / SELF_RE / suggestCode）在**仓库外**，避免往仓库塞工具脚本：
`D:\Users\ZXQL\wt-agents\_b2-gen\gen-gap-list.mjs`（本单证据目录，可复跑复现本文件）。

---

## 九、S3-198 批B2-2 · **库存/追溯域**接线明细与守恒（2026-10-14）

> 执行方：阿坚（后端/权限）｜本地子代理 `/root/s3201_ajian`｜派单卡：`docs/tasks/inbox/ACTIVE-S3-198.md`
> 原始证据（命令 + 输出 + 行号 + 哈希）：`docs/tasks/inbox/ACTIVE-回执-S3-198.md`
> 本节是本批的**增量台账**；§一/§二/§三 的表是 **S3-180 期快照**，本批只动本域 12 个文件，未逐格改写历史表。

### 9.1 选域与判定口径（可复算）

选域 = **库存 / 追溯域**（§三.12：12 文件 / 57 写端点；属批 C2「用既有码的域先做」，本域 **0 条需新立权限点**）。
对 57 条逐端点做两条判定（结果见 9.2 / 9.3）：

1. **调用面**：全仓 `rg`（admin-web / app-mobile / miniapp / saas-admin / e2e / tests）查该端点 URL。
   存在 **app-mobile 写调用点** ⇒ 判 **B（不可判定）**：app-mobile 页面无角色门禁，无法证明「接线后不误伤」，本批不接
   （与 S3-122-G1 的 B 类口径一致）。
2. **持有核对**（接线前必做）：有页面调用点时，取 `admin-web/src/router/index.ts` 该页 `meta.roles`，
   要求 **页面角色 ⊆ 权限码持有人**（持有人用 `node backend/scripts/guard-rbac-wiring.mjs --holders <码>` 复算）。

### 9.2 本批已接线 **25 条**（**返工后口径**；首版 34 条中 trace 域 9 条已按凌舟裁定退回，见 §9.6）

| # | 方法 路径 | 文件:行 | 权限码 | 是否新立码 |
|--:|:--|:--|:--|:--|
| 1 | `POST /api/admin/data-transfer/import/customers` | `data-transfer.routes.ts:26` | `store:transfer` | 否（既有码） |
| 2 | `POST /api/admin/data-transfer/import/products` | `data-transfer.routes.ts:29` | `store:transfer` | 否（既有码） |
| 3 | `POST /api/admin/inventory-batch/batches` | `inventory-batch.routes.ts:20` | `inventory:create` | 否（既有码） |
| 4 | `PUT /api/admin/inventory-batch/batches/:id` | `inventory-batch.routes.ts:21` | `inventory:adjust` | 否（既有码） |
| 5 | `POST /api/admin/inventory-batch/batches/:id/split` | `inventory-batch.routes.ts:22` | `inventory:create` | 否（既有码） |
| 6 | `POST /api/admin/inventory-batch/expiry-configs` | `inventory-batch.routes.ts:32` | `inventory:create` | 否（既有码） |
| 7 | `PUT /api/admin/inventory-batch/expiry-configs/:id` | `inventory-batch.routes.ts:33` | `inventory:adjust` | 否（既有码） |
| 8 | `DELETE /api/admin/inventory-batch/expiry-configs/:id` | `inventory-batch.routes.ts:34` | `inventory:adjust` | 否（既有码） |
| 9 | `PUT /api/admin/inventory-batch/expiry-alerts/:id/handle` | `inventory-batch.routes.ts:40` | `inventory:adjust` | 否（既有码） |
| 10 | `PUT /api/admin/inventory-share/settings` | `inventory-share.routes.ts:14` | `inventory:adjust` | 否（既有码） |
| 11 | `POST /api/admin/inventory-share/products` | `inventory-share.routes.ts:16` | `inventory:create` | 否（既有码） |
| 12 | `POST /api/admin/inventory-share/products/batch-add` | `inventory-share.routes.ts:17` | `inventory:create` | 否（既有码） |
| 13 | `POST /api/admin/inventory-share/products/batch-remove` | `inventory-share.routes.ts:18` | `inventory:create` | 否（既有码） |
| 14 | `PUT /api/admin/inventory-share/products/:id` | `inventory-share.routes.ts:19` | `inventory:adjust` | 否（既有码） |
| 15 | `DELETE /api/admin/inventory-share/products/:id` | `inventory-share.routes.ts:20` | `inventory:adjust` | 否（既有码） |
| 16 | `PUT /api/admin/transfer-orders/:id` | `transfer-order.routes.ts:15` | `store:transfer` | 否（既有码） |
| 17 | `DELETE /api/admin/transfer-orders/:id` | `transfer-order.routes.ts:16` | `store:transfer` | 否（既有码） |
| 18 | `POST /api/admin/transfer-orders/:id/approve` | `transfer-order.routes.ts:17` | `inventory:approve` | 否（既有码） |
| 19 | `POST /api/admin/transfer-orders/:id/reject` | `transfer-order.routes.ts:18` | `inventory:approve` | 否（既有码） |
| 20 | `POST /api/admin/transfer-orders/:id/confirm-out` | `transfer-order.routes.ts:19` | `store:transfer` | 否（既有码） |
| 21 | `POST /api/admin/transfer-orders/:id/confirm-in` | `transfer-order.routes.ts:20` | `store:transfer` | 否（既有码） |
| 22 | `POST /api/admin/transfer-orders/` | `transfer-order.routes.ts:22` | `store:transfer` | 否（既有码） |
| 23 | `POST /api/admin/warehouses/` | `warehouse.routes.ts:20` | `inventory:create` | 否（既有码） |
| 24 | `PUT /api/admin/warehouses/:id` | `warehouse.routes.ts:21` | `inventory:adjust` | 否（既有码） |
| 25 | `DELETE /api/admin/warehouses/:id` | `warehouse.routes.ts:22` | `inventory:adjust` | 否（既有码） |

> **退回说明（凌舟裁定 R101-S3-198 §二.①）**：首版第 16–24 行（`trace.routes.ts` 的 9 条 `trace:code` 接线）已**全部退回**——
> 生产 `t_sys_role.permissions` 实测门店角色**不含 `trace:*`**（`t_sys_role_permission` 0 命中），
> 「追溯是否授权门店端」属产品授权口径 ⇒ 先退不接，留台账待另立补授权单。该 9 条现列在 §9.3 的 **P 类**。

> **待细化（凌舟裁定 §二.⑤，保留保留意见）**：第 1–2 行（data-transfer 的 CSV 导入）沿用台账 §三.12 建议码
> `store:transfer`，**语义偏宽**（该码本义为「门店调拨」，不是「数据导入」）。持有核对成立（页面角色 ⊆ 持有人），
> 故本批保留接线；后续若细分，建议新立 `data:import` 类细码（`goods:create` 不可用：商品导入页允许 STORE_MANAGER，
> 而店长不持 `goods:create` ⇒ 会 403）。

**页面角色 ⊆ 持有人**核对（持有人口径 = 仓库角色种子 079/128/ops-S3-122* × 生产 `matchPermission`）：

| 页面（`admin-web/src/router/index.ts`） | 页面角色 | 涉及行 | 结论 |
|:--|:--|:--|:--|
| 库存批次 `:142` / 库存共享设置 `:141` | SUPER_ADMIN | 3–15 | ✅ `inventory:*` 与 `*` 均覆盖 |
| 系统配置 `:241`（仓库管理 / CSV 导入） | SUPER_ADMIN | 1、10–15、23–25 | ✅ |
| 商品导入 `:169` | SUPER_ADMIN、STORE_MANAGER | 2 | ✅ STORE_MANAGER 持 `store:*` ⇒ 命中 `store:transfer` |
| （无页面调用点：批次增改拆 / 调拨单 v2） | — | 5、16–22 | ✅ 无页面角色被 403 |

> ✅ **生产持有核对已完成**（凌舟亲跑，见 `docs/tasks/cards/R101-S3-198-凌舟裁定与验收.md` §一）：
> `STORE_MANAGER` 实值 = `["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*","finance:payment","goods:price","finance:daily-settle"]`
> ⇒ 本批保留的 4 个码（`inventory:create|adjust|approve`、`store:transfer`）**门店店长确实持有**，接线不会回归；
> 而 **`trace:*` 不在其中** ⇒ trace 域 9 条按裁定退回（见 §9.3 P 类 / §9.6）。

### 9.3 本批**未接** **32 条**（逐条原因；仍登记在机读台账里，属于「已盘点、待后续批次/待裁定/待补授权」）

| # | 方法 路径 | 文件:行 | 原因 | 依据 |
|--:|:--|:--|:--|:--|
| 1 | `POST /api/admin/inventory/report-loss-gain` | `inventory-loss-gain.routes.ts:8` | B | app-mobile 报损报溢（`app-mobile/src/api/modules/inventory-loss-gain.ts:175/184`） |
| 2–8 | `POST|PUT /api/admin/stock-checks…`（`/`、`/:id`、`/:id/start`、`/:id/complete`、`/:id/cancel`、`/:id/handle-diff`、`/:id/items`） | `stock-check.routes.ts:8,12,13,14,15,16,17` | B | app-mobile 盘点（`api/modules/stock-check.ts:97–122`） |
| 9–10 | `PUT /api/store/stock-checks/:id/items/:itemId`、`POST /api/store/stock-checks/:id/submit` | `stock-check.routes.ts:24,25` | B | app-mobile 门店盘点（`api/modules/store.ts:645,650`） |
| 11 | `POST /api/admin/stock-warnings/config` | `stock-warning.routes.ts:9` | B | app-mobile 预警配置（`api/modules/stock-warning.ts:72`） |
| 12 | `PUT /api/store/inventory/alerts/:skuId/threshold` | `store-inventory.routes.ts:13` | B | app-mobile 门店预警阈值（`api/modules/store.ts:485`） |
| 13 | `POST /api/store/trace/verify` | `store-trace.routes.ts:8` | **A** | 收银台 `CashierView.vue:1273`（页面角色 `router/index.ts:259` = SUPER_ADMIN/STORE_MANAGER/STORE_OPERATOR）均不持 `trace:code` ⇒ 接线即 403 |
| 14 | `POST /api/admin/trace/verify` | `trace.routes.ts:37` | B | app-mobile 溯源查询（`api/modules/trace.ts:154`） |
| 15 | `POST /api/miniapp/trace/c/verify` | `trace.routes.ts:50` | **N（台账判定有误）** | 该挂载 `auth:"none"`（`trace.routes.ts:55`）＝**消费者端免鉴权**接口；§三.12 判「管理面/是」不成立，挂 `requirePermission` 会因无 `req.user` 反成 401 |
| 16–22 | `POST /api/admin/transfers`（`/`、`/:id/submit`、`/:id/approve`、`/:id/reject`、`/:id/cancel`、`/:id/ship`）、`PUT /api/admin/transfers/:id` | `transfer.routes.ts:12,17,18,19,20,23,24` | B | app-mobile 调拨（`api/modules/transfer.ts:104–129`） |
| 23 | `POST /api/store/transfers/:id/receive` | `transfer.routes.ts:29` | B | app-mobile 门店收货（`api/modules/transfer.ts:134`、`store.ts:680`） |
| 24–32 | `trace.routes.ts` 的 9 条写端点（`POST /configs`、`PUT /configs/:id`、`DELETE /configs/:id`、`POST /configs/check`、`POST /codes/generate`、`POST /codes/:traceCode/status`、`POST /recalls`、`POST /recalls/:recallNo/execute`、`PUT /recalls/:recallNo/complete`） | `trace.routes.ts:23,24,25,26,29,32,40,43,44` | **P（待补授权）** | **凌舟裁定退回**：生产 `t_sys_role.permissions` 实测门店角色不含 `trace:*`（`t_sys_role_permission` 0 命中）⇒ 挂 `trace:code` 会给门店端制造 403；「追溯是否授权门店端」属产品授权口径，须另立单（含角色种子 + 生产存量订正迁移）后再接 |

> 原因计数：**B 21 条 / P 9 条 / A 1 条 / N 1 条 = 32 条**。
> A、N 两类的处置（均为凌舟裁定 R101-S3-198 §二）：13 号**已确认接线即 403**，与 P 类同因（`trace:*` 无生产持有者），
> 归入「待补授权」一并另立单；15 号**采纳**本单判定，§三.12 该行的判定已订正为「公开端点（免鉴权，`auth:"none"`）」。
> B 类 21 条按裁定 §二.③ **本批不动**，归第 43 项后续批次，且每条必须先做凌舟这次用的**同一道生产持有核对**再接线。

### 9.4 守恒数字与门禁（原始输出见回执）

| 指标 | 本批前（origin/main `fc6651a5`） | 本批后 | 说明 |
|:--|--:|--:|:--|
| 写端点总数（扫描口径） | 762 | 762 | `guard-rbac-wiring` |
| 无权限检查的写端点 | 705 | **680** | 减少 **25** = 本批接线数（返工口径） |
| 缺口分布文件数 | 162 | 156 | 5 个文件清零；`trace.routes.ts` 仍留 11 条（9 条 P 类 + 2 条 B/N 类） |
| 机读台账（`rbac-wiring-baseline.json`） | 705 条 / 161 文件 | 680 条 / 156 文件 | 同步移除 25 条；trace 域 9 条已回填 |
| `--strict` 退出码 | EXIT=1（3 条未登记 + 3 条陈旧） | EXIT=0 | 见下「台账同步说明」 |

**守恒（返工后）**：`705（本批前实测缺口，含 3 条未登记）－ 25（本批实际接线） = 680（本批后缺口）`；台账条目同步 705 → 680。
（首版口径为 705 − 34 = 671；凌舟裁定退回 trace 域 9 条后回填，故为 680。）
清单 §一/§二 的 `709` 是 **S3-180 期快照**（此后仓库另有 4 条端点的接线/增删，与本批无关），本批以**本轮实测 705** 为守恒基准。

**台账同步说明（本批附带，非本域）**：`--strict` 在本批**开工前**即为红——S3-187（`67beff76`）把三条小程序营销端点的
路径改成带参形态后，台账里仍是旧路径（3 条「已登记但当前无缺口」），而新路径「未登记」。这 3 组是**同一端点的改名**，
不是新增裸写端点 ⇒ 按同端点改名同步（旧路径 → `coupons/:templateId/claim`、`flash-sale/:id/buy`、`group-buy/:teamId/join`），
`--strict` 由 EXIT=1 转 **EXIT=0**。**登记 ≠ 合规**：这 3 条仍未接线（消费者端，建议另立单裁定）。

### 9.5 反测（门禁铁律：故意制造失败证明它会红）

1. **缺口可见（报告模式）**：本域 6 文件在本批前报 34 处「无权限检查」，返工后为 **25 处已接 / 11 处未接**
   （`trace.routes.ts` 保留 11 条未接：9 条 P 类 + 2 条 B/N 类）——读数随代码真实变化，非恒绿。
2. **`--strict` 两侧**：本批后 EXIT=0；摘掉 `inventory-batch.routes.ts:20` 的 `requirePermission("inventory:create")`
   ⇒ EXIT=1 且点出该端点；复原 ⇒ EXIT=0（原始输出见回执）。
3. **判据有分辨力（vitest 侧）**：`rbac-b2-s3-198-inventory-wiring.test.ts` 覆盖「READONLY ⇒ 403」与「holders ⇒ 200」两侧；
   摘掉任一 `requirePermission` ⇒ 对应 403 用例变红（原始输出见回执）。

### 9.6 凌舟裁定与返工记录（2026-10-14）

裁定文件：`docs/tasks/cards/R101-S3-198-凌舟裁定与验收.md`（有条件通过，需返工一处）。逐条落地：

| 裁定 | 处置 | 证据 |
|:--|:--|:--|
| §二.① 取 (b)：**trace 域 9 条 `trace:code` 接线全部退回**，保留台账条目并标注「待补授权」，**不得**顺手改角色种子 | ✅ 已退回（`trace.routes.ts` 现 0 处 `requirePermission`，文件头留退回依据注释）；台账 9 条回填并标 P 类 | §9.2 退回说明 / §9.3 第 24–32 行 / 回执 §九 |
| §二.② `POST /api/miniapp/trace/c/verify` 属消费者端免鉴权 ⇒ **采纳**，台账该条判定订正 | ✅ §三.12 该行已订正为「公开端点（免鉴权）」并加订正说明 | §三.12 第 794 行附近 |
| §二.③ B 类 21 条**本批不动**，归第 43 项后续批次；每条须先做同一道生产持有核对 | ✅ 未动，台账保留 B 类标注与依据 | §9.3 |
| §二.④ 台账同步 S3-187 改名 3 条键 ⇒ **认可** | ✅ 保留（条数相抵、未洗绿） | §9.4 台账同步说明 |
| §二.⑤ `data-transfer` 用 `store:transfer` 语义偏宽 ⇒ 保留保留意见，记「待细化」 | ✅ 已记：本条标注「**待细化**（语义偏宽，建议后续改 `data:import` 类细码）」 | §9.2 第 1–2 行说明 / 回执 §七.1 |
| §三 返工后判据：`--strict` EXIT=0 + 守恒自洽 + 逐条列码与持有证据 + 全量门禁 + 反测两侧齐 | ✅ 全部满足（返工后复跑：`--strict` EXIT=0、vitest 0 failed、tsc 0、三条 guard EXIT=0、build EXIT=0；反测 A/B 两侧齐） | 回执 §九「返工回执」 |

---

## 十、S3-205（总清单第 68 项）· **消费者端保护形态**收口与台账三分（2026-10-15）

> 产出：阿坚（后端 · 本地子代理通道）｜2026-10-15｜汇报对象：凌舟（总负责人）
> 依据：派单卡 `docs/tasks/inbox/ACTIVE-S3-205.md`（卡内 §三 已含凌舟 2026-10-15 裁定）
> 产物：工作树 `D:\Users\ZXQL\wt-agents\S3-205`，分支 `chore/s3-205-script-hygiene`，基线 `origin/main` = `36a7a02f`
> 机读镜像：`backend/scripts/rbac-wiring-baseline.json`（本单起分 `gaps` / `consumerEnd` 两栏）

### 10.1 判定（凌舟裁定，逐条复核无误）

`marketing-miniapp.routes.ts` 的 3 条写端点（外加同族的 `POST /calculate`）**判「登记豁免」，不补权限码**：

1. **它们不是管理面**：受 `requireConsumerAuthWithTenant` + `csrfMiddleware` + `bindSelfIdentity` 保护，
   身份一律取登录态（客户端自带 `userId` 与登录态不一致 ⇒ 403），被操作对象的**归属与存在性**由服务层
   `tenant_id = ?` + 命中不到即 404 承担（`marketing-coupon.service.ts:459/466` 等）。
2. **套商家权限码会打成 403**：消费者身份经 S3-196 的 `requireConsumerAuthWithTenant` 解析为**绑定的会员身份**，
   `roles` **恒空** ⇒ 任何 `requirePermission(...)` 在消费者身份上都不会命中。同型教训已发生过两次：
   S3-203 的 `trace:*`（生产 `t_sys_role.permissions` 无持有者 ⇒ 接线即 403）、S3-198 §9.3 第 15 号的
   `POST /api/miniapp/trace/c/verify`（台账误判「管理面」，同样因无 `req.user` 会造成 401/403）。
3. **是否要生产实测**：**不需要**——本案判据是「消费者身份 ⇒ `roles` 恒空 ⇒ 商家码必然不命中」，与
   生产库里商家角色持有什么都无关（`--holders` 只对商家角色有意义）。故本单**未做**生产库读取。

### 10.2 门禁判据变更（`backend/scripts/guard-rbac-wiring.mjs`）

新增第三类形态，**写端点由二分改为三分**：

| `authForm` | 含义 | 是否计入缺口 |
|:--|:--|:--|
| `inline` / `use-mount` | 挂了 `requirePermission(...)`（租户）或 `requirePlatformPermission(...)`（平台） | 否（已接线） |
| **`consumer`** | 同一挂载调用里 **`requireConsumerAuthWithTenant` 与 `csrfMiddleware` 成对出现** | 否（**消费者端保护形态**，逐条登记在 `consumerEnd`） |
| `none` | 无任何上述形态 | **是**（真缺口，登记在 `gaps`） |

**两处刻意从严（不做「套上就自动绿」）**：

1. **必须成对**：只挂消费者认证而**没有 CSRF** 的写端点**仍记 `gaps`**（认证≠授权；状态变更无 CSRF 是实缺口）。
2. **必须逐条登记**：消费者端形态未登记在 `consumerEnd` ⇒ `--strict` **必红**（否则新写端点只要抄这两个
   中间件就自动洗绿）。

> 判据不认 `requireWxAuth` 等其它认证中间件；`routeConfig` 声明式仍一律按「只挂认证」处理（认证≠授权）。

### 10.3 全量影响面（**39 条 / 4 文件**，逐条；行号按当前代码）

| 文件 | 条数 | 端点（行号） |
|:--|--:|:--|
| `marketing-miniapp.routes.ts` | 4 | `POST /coupons/:templateId/claim`(61)、`POST /flash-sale/:id/buy`(78)、`POST /group-buy/:teamId/join`(86)、`POST /calculate`(90) |
| `miniapp.routes.ts` | 29 | `POST /cart`(30)、`PUT /cart/:id`(31)、`DELETE /cart/:id`(32)、`DELETE /cart`(33)、`POST /orders`(36)、`POST /orders/:id/pay`(39)、`POST /orders/:id/cancel`(40)、`POST /orders/:id/confirm-receive`(41)、`PUT /orders/:id/delete`(44)、`POST /stored-card/recharge`(54)、`PUT /user/profile`(58)、`POST /user/addresses`(60)、`PUT /user/addresses/:id`(61)、`DELETE /user/addresses/:id`(62)、`POST /user/addresses/:id/default`(63)、`POST /coupons/:id/use`(68)、`POST /member/coupons/:id/receive`(76)、`PUT /user/profile-update`(79)、`POST /user/change-password`(80)、`POST /wholesale/cart`(87)、`PUT /wholesale/cart/:id`(88)、`DELETE /wholesale/cart/:id`(89)、`POST /wholesale/orders`(90)、`POST /wholesale/cart/delete`(94)、`PUT /wholesale/cart/:itemId/select`(95)、`PUT /wholesale/cart/select-all`(96)、`POST /wholesale/orders/:orderId/cancel`(97)、`POST /wholesale/orders/:orderId/confirm-receive`(98)、`POST /wholesale/orders/buy-now`(100)（前缀均为 `/api/miniapp`） |
| `aftersale.routes.ts` | 4 | `POST /api/miniapp/aftersales`(26)、`POST /api/miniapp/aftersales/:aftersaleNo/cancel`(33)、`POST /api/miniapp/aftersales/:aftersaleNo/return-logistics`(35)、`POST /api/miniapp/aftersales/:aftersaleNo/rate`(40) |
| `notification.routes.ts` | 2 | `PUT /api/miniapp/notifications/:id/read`(29)、`POST /api/miniapp/notifications/read-all`(30) |

**逐条更正本清单中已被推翻的行**（保留原表供对照，判定以本节为准）：

| 位置 | 更正内容 |
|:--|:--|
| §三.15 `marketing-miniapp.routes.ts` 表 | **已就地更正**（路径改带参形态、判定改「消费者端」、补 `文件:行`） |
| §三.5 `aftersale.routes.ts` 第 **382–385** 行 | 4 条小程序售后写端点：判定「管理面/是」⇒ **消费者端/否**（原建议码 `sale:create`/`sale:void`/`sale:return` **作废**，接了必 403） |
| §三.9 `notification.routes.ts` 第 **1186–1187** 行 | 2 条小程序通知写端点：判定「管理面/是」⇒ **消费者端/否** |
| §三.15 `miniapp.routes.ts` 表 | 其中 **29 行**归入消费者端形态；原判「管理面/是」的行（购物车/订单/充值/券/批发车等）判定结论改为「否，不适用商家权限码」 |

### 10.4 守恒（可复算：`node backend/scripts/guard-rbac-wiring.mjs`）

| 指标 | 本单前（`36a7a02f`） | 本单后 | 说明 |
|:--|--:|--:|:--|
| 扫描写端点总数 | 762 | 762 | 不变 |
| 已接线（权限码） | 82 | 82 | 不变 |
| **消费者端保护形态** | 0（未识别） | **39** | 新增第三类 |
| **无授权形态（缺口）** | **680** | **641** | −39，即识别出的消费者端形态 |
| 台账 `gaps` | 680 条 / 156 文件 | 641 条 / 155 文件 | 移出 39 条 |
| 台账 `consumerEnd` | — | **39 条 / 4 文件** | 新增逐条登记 |
| `--strict` | EXIT=0 | **EXIT=0** | 见 10.5 |

> **守恒式**：`680 = 641 + 39`（**一条不多、一条不少**）。**这不是「把基线数字改大」**：39 条是
> **从「待接线欠账」改判为「不适用商家权限码」**，同一提交里同步移出 `gaps`、登记进 `consumerEnd`，
> 且 `consumerEnd` 未登记即判红——缺口口径**净减 39**，剩余 641 条欠账一条未洗白。

### 10.5 反测（门禁铁律：故意制造失败，证明它会红）

| 反测 | 注入 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| A 摘消费者认证 | `marketing-miniapp.routes.ts:61` 去掉 `requireConsumerAuthWithTenant`（CSRF 仍在） | **EXIT=1**，报 `未登记：marketing-miniapp.routes.ts:61 POST /api/miniapp/marketing/coupons/:templateId/claim`；复原 ⇒ EXIT=0 | `docs/evidence/S3-205/logs/06-item68-neg-A-no-consumer-auth.log` |
| B 摘 CSRF（验「必须成对」） | 同一条去掉 `csrfMiddleware`（消费者认证仍在） | **EXIT=1**，该端点回落 `gaps` 且未登记；复原 ⇒ EXIT=0 | `…\06-item68-neg-B-no-csrf.log` |
| C 台账漏登记（验「必须逐条登记」） | 从 `consumerEnd` 删掉 claim 一条 | **EXIT=1**，报 `未登记（消费者端形态）：…coupons/:templateId/claim`；复原 ⇒ EXIT=0 | `…\06-item68-neg-C-unregistered-consumer.log` |

> **逐字节还原**：A/B 的源文件 SHA256 与 C 的台账 SHA256 在注入前后**一致**
> （route `BB9F43AA…E590EB`、baseline `60CAD6A2…E11347`），`git diff` 确认路由文件无残留改动。
> **分辨力（非恒绿）**：同一批输出里 `gaps` 仍如实报 641 条（含 §三.15 `wechat.routes.ts` 那 5 条用
> `requireWxAuth` 的写端点），消费者端识别**没有**把其它缺口一起吞掉。

### 10.6 未纳入本判据的同类（**报备，待裁定**）

- `wechat.routes.ts` 的 5 条写端点（`/api/miniapp/wechat/auth/**`）用的是 `requireWxAuth`（S3-187 E 补了
  `req.user` + `csrfMiddleware`），**不是** `requireConsumerAuthWithTenant`。本单按卡面判据**不认**该中间件，
  故这 5 条**仍留在 `gaps`**。若凌舟认为「微信端认证 = 消费者端认证」，应另立单把该中间件并入判据
  （本单不擅自扩大判据，避免「顺手放宽门禁」）。
- `cart.routes.ts` 用 `routeConfig.auth = "requireConsumerAuthWithTenant"` **声明式**挂载：声明式**不携带**
  端点级证据，本门禁一律按「只挂认证」处理 ⇒ 其写端点若仍在 `gaps` 里，属**既定边界**（见脚本头），
  需另立单按端点级改判或改判据。

---

## 十一、S3-214-B2 · **采购域（9 文件 / 31 写端点）**接线明细与守恒（2026-10-16）

> 产出：阿坚（后端 · 本地子代理通道）｜2026-10-16｜汇报对象：凌舟（总负责人）
> 依据：派单卡 `docs/tasks/inbox/ACTIVE-S3-214-B2.md`（内含凌舟**生产只读实测**下发的阶段②接线口径）
> 产物：工作树 `D:\Users\ZXQL\wt-agents\S3-214`，分支 `feat/s3-214-batch2-wiring`，基线 `origin/main` = `7beafd24`
> 机读镜像：`backend/scripts/rbac-wiring-baseline.json`（本单后 `gaps` 616 条 / 151 文件；`consumerEnd` 39 条不变）
> 阶段①清单（当时**零代码改动**）：`docs/evidence/S3-214/01-roles-to-verify.md`（4 组风险组合 + 逐条待核对）

### 11.1 接线口径（照派单卡 §三 执行，**不统一成 `purchase:*`**）

| 序 | 口径（卡面原文要点） | 本单落地 |
|:--|:--|:--|
| ① | 优先挂「该端点**真实使用者已持有**的模块码」（零回归） | 入库/入库审核 ⇒ `inventory:inbound`；付款/付款作废 ⇒ `finance:payment`；采购退货 ⇒ `sale:return`；供应商对账 ⇒ `report:finance`（二选一取它，理由见 11.6） |
| ② | 只有「采购岗专属、且使用者本来就不是店长/仓管/财务」的端点才挂 `purchase:*` | 采购单审核/作废/改/删 + 采购合同 4 条 ⇒ `purchase:approve`/`purchase:create`；供应商主数据 ⇒ `purchase:supplier`。**`purchase:create`/`purchase:approve` 当前仅 SUPER_ADMIN 持有**（生产口径见派单卡 §三；仓库种子另含 OPERATION_ADMIN / PURCHASE_STAFF） |
| ③ | 移动端「销售开单」采购页签 4 个创建端点 ⇒ 本批不接 | 见 11.3 **M 类** |
| ④ | 找不到「使用者已持有」的码、又不宜挂 `purchase:*` ⇒ 不接 + 登记 | 见 11.3 **W 类**（采购计划 2 条） |

### 11.2 本批已接 **25 条**（端点 / 落地码 / 页面真实使用者）

行号 = 当前 `backend/src/routes/` 下的注册行（`git diff` 可复核）。

| # | 端点（`file:行`） | 落地码 | 页面 / 入口真实使用者（依据） |
|--:|:--|:--|:--|
| 1 | `purchase.routes.ts:16` POST `/:orderNo/approve` | `purchase:approve` | 无页面调用方（仅 API 策略面；桌面「审核」按钮打的是不存在的 `/confirm`，见 11.7） |
| 2 | `purchase.routes.ts:17` POST `/:orderNo/cancel` | `purchase:create` | `PurchaseOrders.vue:328`［SUPER_ADMIN］ |
| 3 | `purchase.routes.ts:18` PUT `/:orderNo` | `purchase:create` | 无页面调用方 |
| 4 | `purchase.routes.ts:19` DELETE `/:orderNo` | `purchase:create` | 无页面调用方 |
| 5 | `purchase-in-stock.routes.ts:13` POST `/:stockNo/approve` | `inventory:inbound` | 入库审核 **办件人＝仓管**（`WAREHOUSE_STAFF` 持 `inventory:*`）；桌面页 `PurchaseInStocks.vue`［SUPER_ADMIN］ |
| 6 | `purchase-in-stock.routes.ts:14` POST `/:stockNo/void` | `inventory:inbound` | 无页面调用方（与入库审核同一生命周期） |
| 7 | `purchase-payment.routes.ts:13` POST `/:paymentNo/approve` | `finance:payment` | `PurchasePayments.vue:358`（审核按钮）；**办件人＝财务**（`FINANCE_STAFF` 持 `finance:*`） |
| 8 | `purchase-payment.routes.ts:14` POST `/:paymentNo/void` | `finance:payment` | 无页面调用方（与付款审核同一生命周期） |
| 9 | `purchase-return.routes.ts:13` POST `/:returnNo/approve` | `sale:return` | `PurchaseReturnsView.vue:138`［SUPER_ADMIN, **STORE_MANAGER**］ |
| 10 | `purchase-return.routes.ts:14` POST `/:returnNo/void` | `sale:return` | 无页面调用方（同上页面，同域） |
| 11 | `purchase-contract.routes.ts:11` POST `/` | `purchase:create` | `PurchaseContracts.vue:419`［SUPER_ADMIN］ |
| 12 | `purchase-contract.routes.ts:12` PUT `/:contractNo` | `purchase:create` | `PurchaseContracts.vue:416`［SUPER_ADMIN］ |
| 13 | `purchase-contract.routes.ts:13` DELETE `/:contractNo` | `purchase:create` | `PurchaseContracts.vue:443`［SUPER_ADMIN］ |
| 14 | `purchase-contract.routes.ts:14` POST `/:contractNo/upload` | `purchase:create` | 无页面调用方 |
| 15 | `supplier.routes.ts:12` POST `/` | `purchase:supplier` | `Suppliers.vue:705`［SUPER_ADMIN］；移动 `suppliers/detail.vue:535`（菜单码 `purchase:supplier`） |
| 16 | `supplier.routes.ts:13` PUT `/:id` | `purchase:supplier` | `Suppliers.vue:702`；移动 `suppliers/detail.vue:552,584` |
| 17 | `supplier.routes.ts:14` POST `/:id/contacts` | `purchase:supplier` | 无页面调用方 |
| 18 | `supplier.routes.ts:15` DELETE `/:id/contacts/:contactId` | `purchase:supplier` | 无页面调用方 |
| 19 | `supplier-contact.routes.ts:15` POST `/supplier/:supplierId` | `purchase:supplier` | 移动「供应商管理」（菜单码 `purchase:supplier`）；桌面调用点路径漂移见 11.7 |
| 20 | `supplier-contact.routes.ts:17` PUT `/:id` | `purchase:supplier` | `Suppliers.vue:652`［SUPER_ADMIN］ |
| 21 | `supplier-contact.routes.ts:19` DELETE `/:id` | `purchase:supplier` | `Suppliers.vue:671`［SUPER_ADMIN］ |
| 22 | `supplier-contact.routes.ts:21` POST `/:id/set-primary` | `purchase:supplier` | `Suppliers.vue:684`［SUPER_ADMIN］ |
| 23 | `supplier-statement.routes.ts:10` POST `/generate` | `report:finance` | `SupplierStatements.vue:230`［SUPER_ADMIN, **STORE_MANAGER**］；财务亦在用 |
| 24 | `supplier-statement.routes.ts:13` POST `/:statementNo/confirm` | `report:finance` | `SupplierStatements.vue:259`［SUPER_ADMIN, **STORE_MANAGER**］ |
| 25 | `supplier-statement.routes.ts:14` POST `/:statementNo/dispute` | `report:finance` | `SupplierStatements.vue:276`［SUPER_ADMIN, **STORE_MANAGER**］ |

**逐码分布**：`purchase:create` 7 ｜ `purchase:approve` 1 ｜ `purchase:supplier` 8 ｜ `inventory:inbound` 2 ｜ `finance:payment` 2 ｜ `sale:return` 2 ｜ `report:finance` 3 = **25**。7 个码**全部是仓库既有码**（不新立权限点、不改角色种子、不动迁移）。

### 11.3 本批**未接** **6 条**（仍登记在机读台账里）

| 类 | 端点 | 原因 |
|:--|:--|:--|
| M | `POST /api/admin/purchase-orders/`（`purchase.routes.ts:14`） | **移动端「销售开单」采购页签无权限门**（`app-mobile/src/pages/sales/create-sale.vue:23` 无条件渲染；调用点 `:2159` doc=pur_order）。接线会把持 `sale:bill` 的门店角色由「可用」打成 403 ⇒ 本批不接，登记「待移动端补权限门后收编」 |
| M | `POST /api/admin/purchase-in-stocks/`（`purchase-in-stock.routes.ts:12`） | 同上（调用点 `create-sale.vue:2112` doc=pur_inbound） |
| M | `POST /api/admin/purchase-payments/`（`purchase-payment.routes.ts:12`） | 同上（调用点 `create-sale.vue:2211` doc=pur_payment） |
| M | `POST /api/admin/purchase-returns/`（`purchase-return.routes.ts:12`） | 同上（调用点 `create-sale.vue:2270` `submitPurchaseReturn`） |
| W | `POST /api/admin/purchase-plans/`（`purchase-plan.routes.ts:12`） | **待授权模型定案**：页面真实使用者含 `STORE_MANAGER`（`admin-web/src/router/index.ts:131`），而生产店长**不持**任何 `purchase:*`；仓内又找不到店长已持有的「采购计划」语义码 ⇒ 挂 `purchase:create` 即 403，属产品授权口径（扩角色权限/新立码），不在本单 |
| W | `POST /api/admin/purchase-plans/:planNo/convert`（`purchase-plan.routes.ts:14`） | 同上（页面 `PurchasePlans.vue:336`） |

> 口径提示：M 类 4 条与**既有测试**互相印证 —— `rbac-g0-wiring.test.ts`「范围控制」名单里那条
> `POST /api/admin/purchase-orders`（创建采购单）仍断言「READONLY 到达业务层」，本批未动它（该名单里另一条
> `PUT /api/admin/purchase-orders/:orderNo` 因本批接线已按同端点移出，见该文件内注释）。

---

## 十二、S3-220 · **商品域（10 文件 / 45 写端点）**接线明细与守恒（2026-10-16）

> 产出：阿坚（后端 · 本地子代理 `/root/s3223_ajian`）｜2026-10-16｜汇报对象：凌舟（总负责人）
> 依据：派单卡 `docs/tasks/inbox/ACTIVE-S3-220.md`
> 产物：工作树 `D:\Users\ZXQL\wt-agents\S3-220`，分支 `feat/s3-220-product-domain-wiring`，基线 `origin/main` = `11f4af48`
> 机读镜像：`backend/scripts/rbac-wiring-baseline.json`（本单后 `gaps` **573 条 / 146 文件**；`consumerEnd` 39 条不变）
> 生产角色核对原始输出：`docs/evidence/S3-220/00-prod-roles-raw.txt`（服务器只读通道导出）
> ＋ 持有关系复算 `docs/evidence/S3-220/03-prod-holders.txt`（`tools/prod-holders.mjs`）

### 12.0 生产持有事实（本批判据起点，**先测再判**）

生产 `t_sys_role.permissions`（`tenant_id='default'`，12 个角色，只读导出）按 `matchPermission` 复算：

| 码 | 生产持有角色 | 备注 |
|:--|:--|:--|
| `goods:create` / `goods:edit` / `goods:delete` | **SUPER_ADMIN / OPERATION_ADMIN**（都靠角色串 `"*"`） | **无任何生产角色显式持有**（种子口径同此） |
| `goods:price` | SUPER_ADMIN / OPERATION_ADMIN / **STORE_MANAGER** | 与 `price.routes.ts` 既有 14 条接线同码 |
| `goods:list`（只读参照） | SUPER_ADMIN / OPERATION_ADMIN | — |

⇒ 判据只剩两种成立方式：**① 页面角色只含超管/运营**；**② 用 `goods:price` 且页面角色只含超管/运营/店长**。
凡真实使用者含 `STORE_MANAGER` 的端点，挂 `goods:create|edit|delete` **必然 403 店长**（批 1 `trace:*` 同款坑）。

### 12.1 接线口径（照派单卡 §二执行）

| 序 | 卡面口径 | 本单落地 |
|:--|:--|:--|
| ① | 优先挂「该端点**真实使用者已持有**的模块码」（零回归） | 本域**不存在**这样的码：45 条的页面角色集合里，凡含店长的端点，店长只持 `goods:price`；其余语义码（`store:*`/`inventory:*`/`marketing:*`）与商品主数据语义不符 ⇒ 无一可用 |
| ② | 只有「商品岗专属、且使用者本来就不是门店/仓管/财务」的端点才挂 `goods:*` | 落地 **15 条**，全部满足「**无页面调用点**」或「调用点非有效注册行」⇒ 使用者集合 ⊆ {超管, 运营} |
| ③ | 找不到已持有码又不宜挂域码 ⇒ 不接 + 登记 | **30 条**不接（B 13 / A 15 / P 2），逐条见 12.3–12.6 |
| ④ | 价格类端点逐条对上「谁能改价」 | 见 12.6：两条价格端点均为**既有待裁定/已知锁定**项，本批不动 |

### 12.2 本批已接 **15 条**（端点 / 落地码 / 真实使用者）

行号 = 当前 `backend/src/routes/` 下的注册行（`git diff` 可复核）。

| # | 端点（`file:行`） | 落地码 | 真实使用者（依据） |
|--:|:--|:--|:--|
| 1 | `admin-product.routes.ts:41` PUT `/products/:id/status` | `goods:edit` | 无有效调用点：桌面 `Products.vue:1051` 打的是 `PATCH /admin/products/:id/status`，后端**无 PATCH 路由**（`rg '\.patch\(' backend/src/routes/*.routes.ts` → 0）⇒ 见 12.8-1 |
| 2 | `admin-product.routes.ts:43` PUT `/products/:id/disable` | `goods:edit` | 全仓无页面调用方 |
| 3 | `admin-product.routes.ts:53` PUT `/products/:id/warning-threshold` | `goods:edit` | 全仓无页面调用方 |
| 4 | `product-bundle.routes.ts:18` POST `/product-bundles` | `goods:create` | 全仓无页面调用方（`api/product.ts:162` 仅封装，无页面使用） |
| 5 | `product-bundle.routes.ts:19` PUT `/product-bundles/:id` | `goods:edit` | 同上 |
| 6 | `product-bundle.routes.ts:20` DELETE `/product-bundles/:id` | `goods:delete` | 同上 |
| 7 | `product-bundle.routes.ts:21` POST `/product-bundles/:id/publish` | `goods:edit` | 同上 |
| 8 | `product-bundle.routes.ts:22` POST `/product-bundles/:id/unpublish` | `goods:edit` | 同上 |
| 9 | `product-bundle.routes.ts:27` POST `/combo-products` | `goods:create` | 同上（「套装与组合品」页 `ProductCombo.vue` 只调 `GET /admin/products`、`GET /products/categories`） |
| 10 | `product-bundle.routes.ts:28` PUT `/combo-products/:id` | `goods:edit` | 同上 |
| 11 | `product-bundle.routes.ts:29` DELETE `/combo-products/:id` | `goods:delete` | 同上 |
| 12 | `product-review.routes.ts:14` POST `/product-reviews/` | `goods:create` | 无页面调用方（审核页只调 approve / reject / batch-*） |
| 13 | `unit.routes.ts:14` POST `/units/` | `goods:create` | 无页面调用方（单位管理页 `Units.vue` 的增删改打的是 `/admin/unit-groups`） |
| 14 | `unit.routes.ts:15` PUT `/units/:id` | `goods:edit` | 同上 |
| 15 | `unit.routes.ts:16` DELETE `/units/:id` | `goods:delete` | 同上 |

**逐码分布**：`goods:create` 4 ｜ `goods:edit` 8 ｜ `goods:delete` 3 = **15**。3 个码**全部是仓库既有码**
（`docs/migrations/079_权限矩阵.sql:201-203`），不新立权限点、不改角色种子、不动迁移。

### 12.3 本批**未接** **13 条 · B 类**（移动端写调用点落在**无权限门**的页 ⇒ 使用者集合不可枚举）

| # | 端点 | 移动端调用点（证据） |
|--:|:--|:--|
| 1 | POST `/api/admin/library/lookup` | 扫码 `app-mobile/src/native/scan.ts:746`（商品 tab / 销售开单 / 库存多入口） |
| 2 | POST `/api/admin/products/upload-image` | `pages/products/product-detail.vue:1268`、`pages-sub/product/product/product-edit.vue:424` |
| 3 | PUT `/api/admin/products/:id` | `pages/products/product-detail.vue:1009`（＋桌面 `Products.vue:1001/1134/1144`） |
| 4 | PUT `/api/admin/products/:skuId/price` | `product-detail.vue:1031`、`pages-sub/product/batch-price/batch-price.vue:834`（＋桌面 `Products.vue:1185/1411`） |
| 5 | PUT `/api/admin/products/skus/:skuId` | 桌面 `Products.vue:1174`；移动 `api/modules/products.ts:55` |
| 6 | POST `/api/admin/products/skus/:skuId/units` | 桌面 `Products.vue:1269`；移动 `product-detail.vue:1080` |
| 7 | PUT `/api/admin/products/skus/:skuId/units/:unitId` | 桌面 `Products.vue:1215-1253`；移动 `product-detail.vue:1049/1072` |
| 8 | DELETE `/api/admin/products/skus/:skuId/units/:unitId` | 桌面 `Products.vue:1282`；移动 `product-detail.vue:1054` |
| 9 | PUT `/api/admin/products/:spuId/marketing-tags` | 移动 `product-detail.vue:1092` |
| 10 | POST `/api/admin/products/categories/` | 移动 `pages-sub/product/categories/category-edit.vue:176` |
| 11 | PUT `/api/admin/products/categories/:id` | 移动 `category-edit.vue:174` |
| 12 | DELETE `/api/admin/products/categories/:id` | 移动 `categories.vue:196` |
| 13 | PUT `/api/admin/products/categories/:id/sort` | 移动 `categories.vue:179` |

**为什么判 B**：`app-mobile` 的**商品 tab 是固定 tabBar 项、无任何角色门**（`src/pages.json` tabBar `list` ＋
`components/custom-tab-bar.vue:24`），商品详情/编辑页内亦无权限判定（`rg 'isPageVisible|roles'` 在
`pages/products/product-detail.vue` 0 命中）；而第 10–13 条的「商品分类」页虽有菜单码 `goods:category`
（`config/function-menu.ts:46`），但该菜单在生产按 `t_sys_role_menu` **授给了 7 个角色**
（OPERATION_ADMIN / PURCHASE_STAFF / READONLY / STORE_ADMIN / STORE_MANAGER / STORE_OPERATOR / WAREHOUSE_STAFF），
其中 6 个**不持** `goods:*` ⇒ 用 `goods:create|edit|delete` 接线会把它们在手机端由可用打成 403。
口径与批 1 §9.1 的 **B 类**「存在 app-mobile 写调用点 ⇒ 不可判定 ⇒ 本批不接」逐字一致。

### 12.4 本批**未接** **15 条 · A 类**（有页面调用点，且页面 `meta.roles` 含 `STORE_MANAGER`）

生产店长**不持任何 goods 写码** ⇒ 接线即 403 现有页面使用者（依据 `admin-web/src/router/index.ts` 的 `meta.roles`）：

| # | 端点 | 页面（`router/index.ts` 行） |
|--:|:--|:--|
| 1 | PUT `/api/admin/products/skus/:skuId/barcode` | 商品管理 `:165`［SUPER_ADMIN, **STORE_MANAGER**］（调用点 `Products.vue:1156`） |
| 2 | POST `/api/admin/products/import` | 商品导入 `:169`［SUPER_ADMIN, **STORE_MANAGER**］（**无调用点**；该页真实打的是 `/admin/data-transfer/import/products`，已由 S3-198 接 `store:transfer`）⇒ 口径待裁定，见 12.7-2 |
| 3–5 | POST/PUT/DELETE `/api/admin/brands/:id` | 品牌管理 `:167`［SUPER_ADMIN, **STORE_MANAGER**］（`Brands.vue:121/124/135`） |
| 6–8 | POST/PUT/DELETE `/api/admin/product-tags/:id` | 商品标签 `:170` ＋ 营销标签 `:221`［均含 **STORE_MANAGER**］（`ProductTags.vue:142/145/156`、`MarketingTags.vue:307/312/328`） |
| 9–12 | POST `/product-reviews/:id/approve`、`/:id/reject`、`/batch-approve`、`/batch-reject` | 商品审核 `:173`［SUPER_ADMIN, **STORE_MANAGER**］（`ProductReview.vue:561/564/613`） |
| 13–15 | POST/PUT/DELETE `/api/admin/unit-groups/:id` | 单位管理 `:168`［SUPER_ADMIN, **STORE_MANAGER**］（`Units.vue:209/212/223/235`） |

> 这 15 条**不是"没有码"**，而是「**该页角色 ⊄ 该码持有者**」：属授权模型口径（要不要给店长 `goods:edit` 等），
> 按派单卡 §二.4 归「**待授权模型定案**」，由凌舟另立"授权模型提案"单，本单不扩角色权限、不新立码。

### 12.5 守恒与门禁（原始输出见 `docs/evidence/S3-220/`）

| 指标 | 本批前（`origin/main` `11f4af48`） | 本批后 | 说明 |
|:--|--:|--:|:--|
| 扫描写端点总数 | 763 | 763 | 未增删端点（`10-guard-after-wiring.txt`） |
| 已接线（权限码） | 136 | **151** | +15 = 本批接线数 |
| 无授权形态（缺口） | **588** | **573** | −15；分布文件数 148 → 146（2 个文件清零：`product-bundle`、`unit`） |
| 消费者端保护形态 | 39 | 39 | 不变（本批不涉） |
| 机读台账 `gaps` | 588 条 / 148 文件 | **573 条 / 146 文件** | `tools/update-baseline.mjs` 逐键移除 15 条 |
| `--strict` 退出码 | EXIT=0 | **EXIT=0** | 未登记 0 条、陈旧登记 0 条（`35-neg-restored-strict.txt`） |
| 本域对账 | 台账 45 = 实测缺口 45 | **45 = 15（已接）+ 13（B）+ 15（A）+ 2（P）** | 一条不多、一条不少 |
| 跨批计数快照 | `rbac-g0-wiring.test.ts` 107 | **122** | 只同步"总数 + 逐文件计数"，G0 名单行一字未动 |

### 12.6 本批**未接** **2 条 · P 类**（**既有已锁定/待裁定**项，本单不得自行改口径）

| # | 端点 | 既有锁定（证据） | 本单处置 |
|--:|:--|:--|:--|
| 1 | POST `/api/admin/prices/best-price` | `rbac-g0-wiring.test.ts:700` 列为「**查询型 POST（待裁定）**」并断言 READONLY 仍 200；`rbac-g1-wiring.test.ts:286` 同款锁定 | **不接**（全仓亦无页面调用点：`api/sale.ts:111 calcBestPrice` 无页面使用） |
| 2 | POST `/api/admin/prices/batch/preview` | `rbac-g0-wiring.test.ts:725` 把「READONLY 调本行 ⇒ `PRICE_MANAGEMENT_DENIED`」列为**已知锁定**；本行**已有** `requirePriceManagementAccess()`（角色白名单，非裸奔） | **不接**：接 `goods:price` 后拦在第一层的变成 RBAC（403 文案变），属改动既有锁定行为 |

> ⚠️ 首版曾把这两行一起接上（缺口一度到 571），跑 `rbac-g0-wiring.test.ts` 时**被既有锁定断言拦下**
> （2 failed：`best-price` 的 READONLY 200、`batch/preview` 的 `PRICE_MANAGEMENT_DENIED`），
> 故按"**碰既有锁定 ⇒ 先退回、登记待裁定**"的纪律撤回（撤回后 573）。原始失败输出：`21-vitest-g0-and-s3220.txt`（首版）。

### 12.7 反测（门禁铁律：故意制造失败，证明它会红）

| 反测 | 注入 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| A 报告模式分辨力 | 摘掉 `product-bundle.routes.ts:29` 的 `requirePermission("goods:delete")` | 缺口 **573 → 574**（已接线 151 → 150） | `31-neg-report.txt` |
| B `--strict` 两侧 | 同上 | **EXIT=1** 且点出 `product-bundle.routes.ts:29 DELETE /api/admin/combo-products/:id`（未登记 1 条）；复原 ⇒ **EXIT=0** | `32-neg-strict.txt` / `35-neg-restored-strict.txt` |
| C 用例分辨力（vitest 侧） | 同上 | `rbac-b2-s3-220-product-wiring.test.ts`：**3 failed / 137 passed**（形状断言、READONLY⇒403、非持有人逐账号枚举）；复原 ⇒ **140 passed** | `33-neg-vitest.txt` |
| 逐字节还原 | 同一文件注入前后 | SHA256 一致（`E795DBD9…C4F33`） | `30-neg-before-hash.txt` / `34-neg-after-hash.txt` |

### 12.8 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. **桌面「商品管理」的上下架按钮打的是不存在的路由**：`Products.vue:1051` 与 `api/common.ts:166` 用
   `PATCH /admin/products/:id/status`，而后端只注册了 **PUT**（`admin-product.routes.ts:41`）；
   `rg '\.patch\(' backend/src/routes/*.routes.ts` **0 命中** ⇒ 该按钮今天即 **404**（与批 2 §11.7-1 同族形态）。
2. **商品导入页与 `/admin/products/import` 不是同一条路**：页面真实打 `/admin/data-transfer/import/products`（S3-198 已接 `store:transfer`），
   而 `POST /api/admin/products/import` **全仓无调用方**——两条并存，是否合并成一条属契约治理，另立单。
3. **`goods:create` 在 S3-142 的口径已与生产不符**：`admin-product-s3-142-perm.test.ts:78` 把店长的权限串写成
   `["store:*","goods:create","goods:edit"]`（依据 079 种子），而**生产店长不持这两个码** ⇒ 该测试的"零回归"结论在生产下不成立
   （本单新测试用生产真值，`STORE_MANAGER` 对 `goods:create|edit|delete` 断言 false）。是否补订正由凌舟定。
4. **移动端商品链路整体无权限门**：商品 tab（`pages.json` tabBar）→ 商品列表 → 商品详情/编辑/新建均可写；
   本批 13 条 B 类都卡在这里。要收编它们，须先补移动端权限门（前端改动，另立单）。
5. **`requirePriceManagementAccess()` 的角色白名单只含 SUPER_ADMIN/STORE_MANAGER**：`OPERATION_ADMIN` 持 `*`
   但在 `/prices/batch/*`、`/prices/anomalies` 上仍 403（既有行为，非本批引入）——若运营岗要用批量调价，需同步该白名单。

### 11.4 守恒与门禁（原始输出见 `docs/evidence/S3-214/`）

| 指标 | 本批前（`origin/main` `7beafd24`） | 本批后 | 说明 |
|:--|--:|--:|:--|
| 扫描写端点总数 | 763 | 763 | 未增删端点（`10-guard-before.txt` / `11-guard-after.txt`） |
| 已接线（权限码） | 83 | **108** | +25 = 本批接线数 |
| 无授权形态（缺口） | **641** | **616** | −25；分布文件数 155 → 151（4 个文件清零） |
| 消费者端保护形态 | 39 | 39 | 不变（本批不涉） |
| 机读台账 `gaps` | 641 条 / 155 文件 | **616 条 / 151 文件** | 同步移除 25 条，保留 6 条 |
| `--strict` 退出码 | EXIT=0 | **EXIT=0** | 未登记 0 条、陈旧登记 0 条（`12-guard-strict-after.txt`） |
| 本域对账 | 台账 31 = 实测缺口 31 | **31 = 25（已接）+ 4（M 类）+ 2（W 类）** | 一条不多、一条不少 |

### 11.5 反测（门禁铁律：故意制造失败，证明它会红）

| 反测 | 注入 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| A 报告模式分辨力 | 摘掉 `purchase-in-stock.routes.ts:13` 的 `requirePermission("inventory:inbound")` | 缺口 **616 → 617**，该端点回落「无授权形态」 | `20-neg-A-report.txt` |
| B `--strict` 两侧 | 同上 | **EXIT=1** 且点出 `purchase-in-stock.routes.ts:13 POST /api/admin/purchase-in-stocks/:stockNo/approve`（未登记 1 条）；复原 ⇒ **EXIT=0** | `21-neg-A-strict.txt` / `23-neg-A-restored-strict.txt` |
| C 用例分辨力（vitest 侧） | 同上 | `rbac-b2-s3-214-purchase-wiring.test.ts`：**5 failed / 148 passed**（形状断言、READONLY⇒403、非持有人逐账号枚举、范围枚举）；复原 ⇒ **153 passed** | `22-neg-B-vitest-red.txt` |
| 逐字节还原 | 同一文件注入前后 | SHA256 一致（`0F32A0ED…BEDE922E`），`git diff` 无残留 | `23-neg-A-restored-strict.txt`、回执 §五 |

### 11.6 与阶段①「建议权限码」的差异（**被推翻的 15 行**，逐条给理由）

阶段① §四 的「拟用码」是**未经生产持有核对**的建议值；凌舟生产实测后，本表 15 行的建议码被推翻。
下表保留原值供对照，**落地以 11.2 为准**：

| 端点组 | 阶段① 建议码 | 本批落地码 | 推翻理由 |
|:--|:--|:--|:--|
| 入库审核 / 入库作废（2） | `purchase:approve` / `purchase:create` | `inventory:inbound` | 入库审核的办件人是**仓管**，`WAREHOUSE_STAFF` 持 `inventory:*` 但不持 `purchase:*`（`--holders purchase:approve` 不含仓管）⇒ 挂 purchase:* 会把仓管打成 403。选 `inventory:inbound`（而非其它 inventory 码）＝它是入库语义细码，且持有者 ⊇ {仓管、店长、采购员} |
| 付款审核 / 付款作废（2） | `purchase:approve` / `purchase:create` | `finance:payment` | 付款审核的办件人是**财务**，`FINANCE_STAFF` 持 `finance:*` 但不持 `purchase:*` ⇒ 挂 purchase:* 会把财务打成 403。`finance:payment` 是仓库既有的「付款动作」码（`commission.routes.ts` 结算、`payment-new.routes.ts` 核销、`store-receivable.routes.ts` 收款均用它） |
| 采购退货审核 / 作废（2） | `purchase:approve` / `purchase:create` | `sale:return` | 采购退货页 `meta.roles` 含 **STORE_MANAGER**，而店长不持任何 `purchase:*` ⇒ 挂 purchase:* 直接把店长这一页打成 403（批 1 `trace:*` 同款形态）。口径给的两个候选中选 `sale:return`（退货语义细码；店长经 `sale:*`、门店运营员经精确码命中） |
| 供应商对账 generate/confirm/dispute（3） | `purchase:create` | `report:finance` | 对账页 `meta.roles` 含 **STORE_MANAGER**，而店长**不持** `supplier:statement`（口径给的另一个候选）⇒ 用 `supplier:statement` 会 403 店长（测试已把它钉死：`supplier:statement` 持有者里没有店长）。选口径给的第二候选 `report:*`，取其中财务语义细码 `report:finance`（`079:185`），持有者 = {超管、运营、店长、财务} ⊇ 页面角色 |
| 供应商主数据 / 供应商联系人（8） | `purchase:create` | `purchase:supplier` | 该域在 `079` 有**专属码** `purchase:supplier`（L141「供应商管理」MENU），且与移动端菜单码**同码**（`app-mobile/src/config/function-menu.ts:61`）⇒ 用它可让「移动端看得到供应商管理的人」必然通过（零回归），也避免把"新建采购"按钮码当成"供应商管理"语义 |

### 11.7 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. **桌面「采购订单」审核按钮打的是不存在的路由**（阶段① §八-1 复核仍成立）：`PurchaseOrders.vue:315` → `POST /admin/purchase-orders/:id/confirm`，而后端只有 `/:orderNo/approve`。同族路径/参数漂移另见 `api/purchase.ts:103/:153/:161/:36`、`api/misc.ts:68/73/78`（合同用 `:id`，后端是 `:contractNo`）。
2. **供应商联系人创建路径不一致**：前端 `api/purchase.ts:185` 打 `POST /admin/supplier-contacts`（body 带 `supplierId`），后端只有 `/supplier/:supplierId`（与 `supplier.routes.ts:14` 的 `POST /suppliers/:id/contacts` 两条并存、均无实调用方）。本批按**后端现状**接线，未改契约。
3. **`purchase:order` 等 4 个采购 MENU 码未参与本批**：移动端菜单可见性用 `purchase:order/inbound/supplier` 判定，本批落地码取的是**动作语义**（`purchase:*` 细码 / `inventory:*` / `finance:*` / `sale:*` / `report:*`）。若凌舟要「菜单码 = 端点码」对齐，属授权模型重构，另立单。
4. **店长对付款审核端点的"宽授"**：生产店长持精确码 `finance:payment`，故店长在 API 面亦通过 `POST /purchase-payments/:paymentNo/approve`（测试 §b 已显式记录）。页面 `PurchasePayments.vue` 只给 SUPER_ADMIN，故不构成页面回归；若要收窄成「财务专属」，需新立码（不在本单范围）。

## 十三、S3-223 · **财务域（9 文件 / 28 写端点）**接线明细与守恒（2026-10-16）

> 派单卡：`docs/tasks/inbox/ACTIVE-S3-223.md`｜判定依据留档：`docs/evidence/S3-223/01-plan-and-judgements.md`｜原始输出：`docs/evidence/S3-223/**`
> 基线：`origin/main` = `90119ef4`（开工 `git fetch` 真值）｜缺口 **573 → 554**（文件 146 → 144）

### 13.1 接线口径（照派单卡 §二 执行，**不统一成 `finance:*`**）

1. **先查两道闸再动手**（批 3 教训）：`rbac-g0-wiring.test.ts`（含 `NOT_IN_G0` 范围控制行）＋ `rbac-g1/g2-wiring.test.ts` 的「待裁名单」⇒ 本域 **9 行命中锁定**，一律不接并逐条报备；
2. **选码只按「该端点真实使用者已持有的最细现成码」**：不新立码、不改角色种子、不动迁移；
3. **页面角色集不可枚举的行（B 类）不硬接**：app-mobile 页面若经「我的」页/首页快捷入口无条件可达，或注册码无 `t_sys_menu` 行，则接线必把看得到按钮的角色打成 403（同批 1 `trace:*`、S3-222 §四.4 形态）；
4. **公开端点**（1 条）按台账口径免鉴权并逐条登记理由。

### 13.2 本批已接 **19 条**（端点 / 落地码 / 真实使用者）

| # | 端点 | 落地码 | 真实使用者（页面/调用点） |
|--:|:--|:--|:--|
| 1 | `PUT /api/admin/bank-accounts/:id` | `finance:create` | `BankAccounts.vue:294`［SUPER_ADMIN］（同文件 G1 既有码） |
| 2 | `PUT /api/admin/commission/rules/:id` | `sale:commission` | `CommissionRules.vue:208`［SUPER_ADMIN, STORE_MANAGER］ |
| 3 | `DELETE /api/admin/commission/rules/:id` | `sale:commission` | `CommissionRules.vue:226` |
| 4 | `PUT /api/admin/credits/collections/:id` | `customer:credit` | 零调用方（同文件 S3-126 既有码） |
| 5 | `POST /api/admin/credits/collections/auto-generate` | `customer:credit` | 零调用方 |
| 6 | `POST /api/admin/credits/collections/batch-remind` | `customer:credit` | 零调用方 |
| 7 | `PUT /api/admin/credits/:customerId/limit` | `customer:credit` | `CreditView.vue:279`［SUPER_ADMIN, STORE_MANAGER］ |
| 8 | `PUT /api/admin/credits/:customerId/term` | `customer:credit` | 零调用方 |
| 9 | `PUT /api/admin/expenses/:expenseNo` | `finance:create` | 零有效调用方（`expenses.ts:94` 导出无引用） |
| 10 | `POST /api/admin/expenses/:expenseNo/approve` | `finance:create` | `ExpensesView.vue:362/374`＋app-mobile `expenses.vue:178`、`expense-detail.vue:108` |
| 11 | `POST /api/admin/expenses/:expenseNo/void` | `finance:create` | `ExpensesView.vue:384`＋app-mobile `expenses.vue:203`、`expense-detail.vue:131` |
| 12 | `PUT /api/payment-config/configs/:provider` | `finance:create` | `PaymentConfigView.vue:491/510`［SUPER_ADMIN］ |
| 13 | `POST /api/payment-config/configs/:provider/test` | `finance:create` | `PaymentConfigView.vue:548` |
| 14 | `POST /api/payment-config/bank-accounts` | `finance:create` | 无有效调用方（前端路径漂移，见 13.7） |
| 15 | `PUT /api/payment-config/bank-accounts/:id` | `finance:create` | 同上 |
| 16 | `DELETE /api/payment-config/bank-accounts/:id` | `finance:create` | 同上 |
| 17 | `POST /api/payment-config/bank-accounts/:id/default` | `finance:create` | 同上 |
| 18 | `POST /api/admin/payments-new/:paymentNo/void` | `finance:payment` | `PaymentsNewView.vue:369`［SUPER_ADMIN］（同文件既有码） |
| 19 | `POST /api/admin/receipts/:receiptNo/void` | `finance:receipt:create` | `ReceiptsView.vue:379`［SUPER_ADMIN］＋app-mobile 收款管理 `receipts.vue:121`（`079:213` 既有按钮码） |

**文件分布**：bank-account 1 ／ commission 2 ／ credit 5 ／ expense 3 ／ payment-config 6 ／ payment-new 1 ／ receipt 1 = **19**
（`reconciliation.routes.ts`、`payment.routes.ts` 本批 0 改动）。

### 13.3 本批**未接** **5 条 · B 类**（页面角色集不可枚举 ⇒ 待移动端补权限门后收编）

| # | 端点 | 真实写调用点 | 锁定锚点 |
|--:|:--|:--|:--|
| 1 | `POST /api/admin/bank-accounts/` | app-mobile 门店管理 `stores.vue:241`（`stores.ts:141`） | `rbac-g1-wiring.test.ts:273`、`rbac-g2-wiring.test.ts:232-254` |
| 2 | `POST /api/admin/bank-accounts/:id/close` | app-mobile `stores.vue:263` | `rbac-g1:274`、`rbac-g2:244-254` |
| 3 | `POST /api/admin/receipts/` | app-mobile 开单页 `create-sale.vue:2202`（`receipts.ts:54`） | `rbac-g1:275`、`rbac-g2:256-266` |
| 4 | `POST /api/admin/reconciliation/customer/:customerId/confirm` | app-mobile 对账页 `reconciliation.vue:256` | `rbac-g1:276`、`rbac-g2:268-278` |
| 5 | `POST /api/admin/reconciliation/supplier/:supplierId/confirm` | app-mobile `reconciliation.vue:258` | `rbac-g1:277`、`rbac-g2:280-290` |

### 13.4 本批**未接** **3 条 · G0 范围控制锁定**（`NOT_IN_G0` 断言 READONLY 仍 200）

| # | 端点 | 锁定锚点 | 说明 |
|--:|:--|:--|:--|
| 1 | `POST /api/admin/credits/collections` | `rbac-g0-wiring.test.ts:702` | 接线必改该断言；本批**未获授权**⇒ 登记待裁定（同 S3-125 的 C 类处置，`rbac-g2-wiring.test.ts:600-607` 交叉印证） |
| 2 | `POST /api/admin/commission/calculate` | `rbac-g0-wiring.test.ts:705` | 同上 |
| 3 | `POST /api/admin/payments-new/` | `rbac-g0-wiring.test.ts:704` | 同上；且 app-mobile 开单页有写调用点（`create-sale.vue:2218`）⇒ 亦属 B 类 |

### 13.5 本批**未接** **1 条 · 公开端点**

| # | 端点 | 理由 |
|--:|:--|:--|
| 1 | `POST /api/pay/wx/callback` | 微信支付回调：微信服务器直调，无登录态、无浏览器会话 ⇒ 免鉴权；挂 `csrfMiddleware` 会把正常回调打成 403（`payment.routes.ts:18-20` 既有注释） |

### 13.6 守恒与门禁（原始输出见 `docs/evidence/S3-223/`）

- `node backend/scripts/guard-rbac-wiring.mjs` ⇒ 扫描 189 文件 / 763 写端点；**已接线 151 → 170**、
  消费者端保护形态 39、**无授权形态 573 → 554**（文件 146 → **144**）；
- `--strict` ⇒ **EXIT=0**，台账核对「已登记 554 ／ 未登记 0 ／ 已登记但当前无缺口 0」；
- 机读台账 `backend/scripts/rbac-wiring-baseline.json`：`_counts` 与 `_s3223_note` 已同步，仅移除本域 19 条；
- 全量 `npx vitest run` ⇒ 见回执 §四读数；`npx tsc --noEmit` ⇒ EXIT=0；根 `npm run build` ⇒ EXIT=0。

### 13.7 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. `admin-web/src/api/finance.ts:17` 打 `PATCH /admin/bank-accounts/:id/status`、`:21/:25` 打 `/:id/transactions`——后端无此路径（调用即 404）。
2. `PaymentConfigView.vue:466/595/598/623/633` 打 `/admin/payment/bank-accounts**`（**后端无此前缀**，实体是 `/api/payment-config/bank-accounts`）⇒ 支付配置页"银行账户"区块当前不可用；前端 `PUT .../:id/default` 与后端 `POST` 方法亦不一致。
3. 前端死代码：`api/customer.ts:126`（`/credits/:customerId/term`）、`:145-161`（催收四方法）、`app-mobile .../expenses.ts:94`（`PUT /expenses/:expenseNo`）均导出零引用。

