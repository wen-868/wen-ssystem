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
| `POST /api/miniapp/trace/c/verify` | 管理面 | 是 | trace:code |

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

**marketing-miniapp.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/miniapp/marketing/coupons/claim` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/marketing/flash-sales/grab` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/marketing/group-buys/teams/join` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |
| `POST /api/miniapp/marketing/calculate` | 管理面 | 是 | 无现成码 ⇒ 需先立权限点（另立单） |

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

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/purchase-contracts/` | 管理面 | 是 | purchase:create |
| `PUT /api/admin/purchase-contracts/:contractNo` | 管理面 | 是 | purchase:create |
| `DELETE /api/admin/purchase-contracts/:contractNo` | 管理面 | 是 | purchase:create |
| `POST /api/admin/purchase-contracts/:contractNo/upload` | 管理面 | 是 | purchase:create |

**purchase-in-stock.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/purchase-in-stocks/` | 管理面 | 是 | purchase:create |
| `POST /api/admin/purchase-in-stocks/:stockNo/approve` | 管理面 | 是 | purchase:approve |
| `POST /api/admin/purchase-in-stocks/:stockNo/void` | 管理面 | 是 | purchase:create |

**purchase-payment.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/purchase-payments/` | 管理面 | 是 | purchase:create |
| `POST /api/admin/purchase-payments/:paymentNo/approve` | 管理面 | 是 | purchase:approve |
| `POST /api/admin/purchase-payments/:paymentNo/void` | 管理面 | 是 | purchase:create |

**purchase-plan.routes.ts**（2 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/purchase-plans/` | 管理面 | 是 | purchase:create |
| `POST /api/admin/purchase-plans/:planNo/convert` | 管理面 | 是 | purchase:create |

**purchase-return.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/purchase-returns/` | 管理面 | 是 | purchase:create |
| `POST /api/admin/purchase-returns/:returnNo/approve` | 管理面 | 是 | purchase:approve |
| `POST /api/admin/purchase-returns/:returnNo/void` | 管理面 | 是 | purchase:create |

**purchase.routes.ts**（5 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/purchase-orders/` | 管理面 | 是 | purchase:create |
| `POST /api/admin/purchase-orders/:orderNo/approve` | 管理面 | 是 | purchase:approve |
| `POST /api/admin/purchase-orders/:orderNo/cancel` | 管理面 | 是 | purchase:create |
| `PUT /api/admin/purchase-orders/:orderNo` | 管理面 | 是 | purchase:create |
| `DELETE /api/admin/purchase-orders/:orderNo` | 管理面 | 是 | purchase:create |

**supplier-contact.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/supplier-contacts/supplier/:supplierId` | 管理面 | 是 | purchase:create |
| `PUT /api/admin/supplier-contacts/:id` | 管理面 | 是 | purchase:create |
| `DELETE /api/admin/supplier-contacts/:id` | 管理面 | 是 | purchase:create |
| `POST /api/admin/supplier-contacts/:id/set-primary` | 管理面 | 是 | purchase:create |

**supplier-statement.routes.ts**（3 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/supplier-statements/generate` | 管理面 | 是 | purchase:create |
| `POST /api/admin/supplier-statements/:statementNo/confirm` | 管理面 | 是 | purchase:create |
| `POST /api/admin/supplier-statements/:statementNo/dispute` | 管理面 | 是 | purchase:create |

**supplier.routes.ts**（4 处）

| METHOD 路径 | 判定 | 该不该要权限 | 建议权限码 |
|:--|:--|:--|:--|
| `POST /api/admin/suppliers/` | 管理面 | 是 | purchase:create |
| `PUT /api/admin/suppliers/:id` | 管理面 | 是 | purchase:create |
| `POST /api/admin/suppliers/:id/contacts` | 管理面 | 是 | purchase:create |
| `DELETE /api/admin/suppliers/:id/contacts/:contactId` | 管理面 | 是 | purchase:create |

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

