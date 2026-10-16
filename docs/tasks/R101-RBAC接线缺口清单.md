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

---

## 十二、S3-222 · **客户域（12 文件 / 45 写端点）**接线明细与守恒（2026-10-16）

> 产出：阿坚（后端 · 本地子代理通道 `/root/s3225_ajian`）｜2026-10-16｜汇报对象：凌舟（总负责人）
> 依据：派单卡 `docs/tasks/inbox/ACTIVE-S3-222.md`
> 产物：工作树 `D:\Users\ZXQL\wt-agents\S3-222`，分支 `feat/s3-222-customer-domain-wiring`，基线 `origin/main` = `e124173b`
> 机读镜像：`backend/scripts/rbac-wiring-baseline.json`（本单后 `gaps` **546 条 / 138 文件**；`consumerEnd` 39 条不变）
> 逐条证据（命令 + 原始输出 + 行号 + 哈希）：`docs/evidence/S3-222/**`（判定与调用面见 `01-plan-and-callers.md`）；回执：`docs/tasks/inbox/ACTIVE-回执-S3-222.md`

### 12.1 接线口径（照派单卡 §二执行）

| 序 | 卡面口径 | 本单落地 |
|:--|:--|:--|
| ① | 先做**生产角色核对**（服务器只读通道导出 `t_sys_role.permissions`） | **本执行方无生产库访问权**（该通道由凌舟持有）⇒ 以卡面下发的批 2 生产实值 + 仓库种子为依据，逐角色标注来源，并在回执 §六 请凌舟复跑同一条 SQL（见 `01-plan-and-callers.md` §一/§四） |
| ② | 优先挂「该端点**真实使用者已持有**的模块码」（零回归） | 45 条逐条查前端调用点 + 页面 `meta.roles`（桌面）/ 菜单码（移动端）后选码；42 条落地码全部是**既有码**（079 矩阵） |
| ③ | 公开端点**照台账口径处理：免鉴权 ⇒ 不接线但逐条登记**并说明公开是业务意图 | 2 条（`member-register.routes.ts` 的 `POST /sms-code`、`POST /register`）**确认 `routeConfig.auth = "none"`** ⇒ 不接，登记为 P 类 |
| ④ | 「自服务/本人数据」不得硬套管理面码（S3-203 `trace:*` 教训） | 本域**无**自服务端点（台账 §二 客户域自服务计数 = 0），未触发 |
| ⑤ | 找不到"使用者已持有"的码、又不宜挂客户域码 ⇒ 本批不接线 + 登记 | 1 条（`POST /api/store/customer-statements/:statementNo/confirm`）⇒ W 类（待授权模型定案），见 12.3 |

### 12.2 本批已接 **42 条**（端点 / 落地码 / 页面真实使用者）

行号 = 本批改动**前**的注册行（`git diff` 可复核；改动后行号因 import 与注释上移）。

| # | 端点（`file:行`） | 落地码 | 页面 / 入口真实使用者（依据） |
|--:|:--|:--|:--|
| 1 | `admin-customer.routes.ts:12` POST `/members` | `customer:create` | `CustomersView.vue:276`［SUPER_ADMIN, STORE_MANAGER］（客户管理 `router:160`）；移动端 `customersApi.create` 有定义**无页面调用方** |
| 2 | `admin-customer.routes.ts:16` PUT `/members/:id` | `customer:edit` | `CustomerDetail.vue:485`［SUPER_ADMIN, STORE_MANAGER］（`router:161`） |
| 3 | `admin-customer.routes.ts:17` PUT `/members/:id/disable` | `customer:edit` | `CustomerDetail.vue:457`、`CustomersView.vue:332` |
| 4 | `admin-customer.routes.ts:18` PUT `/members/:id/assign-staff` | `customer:edit` | 无页面调用方（前端 `assignMember` 打 `/members/:id/assign`，路径漂移见 12.7） |
| 5 | `admin-customer.routes.ts:25` POST `/members/register` | `customer:create` | `MemberSystem.vue:127`［SUPER_ADMIN］（会员体系 `router:152`）；**台账原判「公开端点」有误**（本文件 `auth: requireAuthWithTenant`）⇒ 按管理面接线（N 类订正） |
| 6 | `admin-customer.routes.ts:27` PUT `/members/:id/member-level` | `customer:edit` | `LevelConfig.vue:302`［SUPER_ADMIN］＋ `CustomerDetail.vue:509` |
| 7 | `customer-care.routes.ts:8` POST `/rules` | `customer:create` | `CustomerCareRules.vue:194`［SUPER_ADMIN］（客户关怀 `router:155`） |
| 8 | `customer-care.routes.ts:9` PUT `/rules/:id` | `customer:edit` | `CustomerCareRules.vue:191` |
| 9 | `customer-care.routes.ts:10` DELETE `/rules/:id` | `customer:edit` | `CustomerCareRules.vue:204` |
| 10 | `customer-care.routes.ts:12` POST `/rules/:id/execute` | `customer:create` | `CustomerCareRules.vue:210` |
| 11 | `customer-merge.routes.ts:10` POST `/merge` | `customer:create` | 无页面调用方（仅服务层单测） |
| 12 | `customer-payment.routes.ts:10` POST `/` | `customer:payment` | 无页面调用方（前端 `createCustomerPayment` 打 `/admin/customer-payments`，死路径） |
| 13 | `customer-payment.routes.ts:11` POST `/:receiptNo/void` | `customer:payment` | 同上 |
| 14 | `customer-price.routes.ts:9` POST `/` | `customer:create` | `CustomerPrices.vue:291`［SUPER_ADMIN, STORE_MANAGER］（客户价格 `router:111`） |
| 15 | `customer-price.routes.ts:10` PUT `/:id` | `customer:edit` | `CustomerPrices.vue`（编辑） |
| 16 | `customer-price.routes.ts:11` DELETE `/:id` | `customer:edit` | `CustomerPrices.vue:308` |
| 17 | `customer-segment.routes.ts:8` POST `/` | `customer:create` | `CustomerSegments.vue:200`［SUPER_ADMIN］（客户分群 `router:158`） |
| 18 | `customer-segment.routes.ts:9` PUT `/:id` | `customer:edit` | `CustomerSegments.vue`（编辑） |
| 19 | `customer-segment.routes.ts:10` DELETE `/:id` | `customer:edit` | `CustomerSegments.vue:210` |
| 20 | `customer-segment.routes.ts:11` POST `/:id/refresh` | `customer:create` | `CustomerSegments.vue:216` |
| 21 | `customer-statement.routes.ts:10` POST `/` | `customer:statement` | 无页面调用方（前端打 `/store/customer-statements/generate`，死路径） |
| 22 | `customer-statement.routes.ts:12` POST `/:statementNo/paid` | `customer:statement` | 无页面调用方（与对账同族） |
| 23 | `customer-tag.routes.ts:8` POST `/` | `customer:create` | `CustomerTags.vue:201`［SUPER_ADMIN］（客户标签 `router:153`） |
| 24 | `customer-tag.routes.ts:9` PUT `/:id` | `customer:edit` | `CustomerTags.vue:198` |
| 25 | `customer-tag.routes.ts:10` DELETE `/:id` | `customer:edit` | `CustomerTags.vue:211` |
| 26 | `customer-tag.routes.ts:11` POST `/:id/tags` | `customer:create` | 无页面调用方（前端打 `/members/tags/add`，漂移） |
| 27 | `customer-tag.routes.ts:12` DELETE `/:id/tags/:tagId` | `customer:edit` | 无页面调用方（`/members/tags/remove`，漂移） |
| 28 | `customer-type.routes.ts:11` POST `/` | `customer:create` | `CustomerTypes.vue:211`［SUPER_ADMIN］（客户类型 `router:162`） |
| 29 | `customer-type.routes.ts:12` PUT `/:id` | `customer:edit` | `CustomerTypes.vue`（编辑） |
| 30 | `customer-type.routes.ts:13` DELETE `/:id` | `customer:edit` | `CustomerTypes.vue:249` |
| 31 | `customer-visit.routes.ts:15` POST `/` | `customer:visit` | `CustomerVisits.vue:431`［SUPER_ADMIN, STORE_MANAGER］（拜访记录 `router:156`） |
| 32 | `customer-visit.routes.ts:18` PUT `/:visitNo` | `customer:visit` | `CustomerVisits.vue:428` |
| 33 | `customer-visit.routes.ts:21` POST `/:visitNo/checkin` | `customer:visit` | 无页面调用方（`api/misc.ts` 有导出、无引用） |
| 34 | `customer-visit.routes.ts:24` POST `/:visitNo/checkout` | `customer:visit` | 同上 |
| 35 | `customer-visit.routes.ts:27` POST `/:visitNo/cancel` | `customer:visit` | 同上 |
| 36 | `tag.routes.ts:11` POST `/tags/groups` | `customer:create` | `TagGroups.vue:316`［SUPER_ADMIN, STORE_MANAGER］（标签分组 `router:171`） |
| 37 | `tag.routes.ts:12` PUT `/tags/groups/:id` | `customer:edit` | `TagGroups.vue:311` |
| 38 | `tag.routes.ts:13` DELETE `/tags/groups/:id` | `customer:edit` | `TagGroups.vue`（删除分组） |
| 39 | `tag.routes.ts:18` POST `/tags` | `customer:create` | 无页面调用方（前端用的是 `/admin/product-tags`，属商品域另一文件） |
| 40 | `tag.routes.ts:19` PUT `/tags/:id` | `customer:edit` | 同上 |
| 41 | `tag.routes.ts:20` DELETE `/tags/:id` | `customer:edit` | 同上 |
| 42 | `tag.routes.ts:25` PUT `/products/:spuId/tags` | `customer:edit` | `ProductTagRelation.vue:133` / `Products.vue:1358`［SUPER_ADMIN, STORE_MANAGER］（标签关联 `:172` / 商品管理 `:165`） |

**逐码分布**：`customer:create` 12 ｜ `customer:edit` 22 ｜ `customer:visit` 5 ｜ `customer:statement` 2 ｜ `customer:payment` 2 = **42**。
5 个码**全部是 079 既有码**（`customer:create` 079:210、`customer:edit` 079:211、`customer:statement` 079:147、`customer:visit` 079:148、`customer:payment` 079:149），**不新立权限点、不改角色种子、不动 `docs/migrations/**`**。

### 12.3 本批**未接** **3 条**（仍登记在机读台账里）

| 类 | 端点 | 原因 |
|:--|:--|:--|
| P | `member-register.routes.ts:8` POST `/api/store/members/sms-code`、`:9` POST `/api/store/members/register` | **真公开端点**：该文件 `routeConfig.auth = "none"`（免鉴权），调用方是移动端注册链路（`app-mobile/src/api/modules/member.ts:23/:27`、`auth.ts:115`）⇒ 业务意图就是未登录可用，挂商家权限码既无意义也会把注册流程打成 401/403 |
| W | `customer-statement.routes.ts:11` POST `/api/store/customer-statements/:statementNo/confirm` | **待授权模型定案**：该端点是移动端「对账单」页的"确认"按钮（`app-mobile/.../statements.vue:97`），页面可见角色（生产 `t_sys_role_menu` 的菜单码 `finance:statement`）= {`FINANCE_STAFF`, `OPERATION_ADMIN`, `READONLY`, `STORE_ADMIN`}；其中 **`READONLY`（`["*:view"]`）与 `STORE_ADMIN`（099 旧词表 `customer:read`）不持任何客户域写码** ⇒ 接线即把"看得到该按钮的角色"打成 403（批 1 `trace:*` 同款形态）。三选一（补授权 / 收紧该页菜单 / 另立消费者或门店专用细码）属产品授权口径，不在本单 |

> 口径提示：与**既有测试**互相印证 —— 本批新增用例的「范围控制」节把上述 3 行钉成"READONLY 亦能到达业务层"，
> 证明本批**既没多接、也没把待定项偷接**（`22-neg-B-vitest-red.txt` 反测时该节保持绿）。

### 12.4 守恒与门禁（原始输出见 `docs/evidence/S3-222/`）

| 指标 | 本批前（`origin/main` `e124173b`） | 本批后 | 说明 |
|:--|--:|--:|:--|
| 扫描写端点总数 | 763 | 763 | 未增删端点（`10-guard-before.txt` / `11-guard-after.txt`） |
| 已接线（权限码） | 136 | **178** | +42 = 本批接线数 |
| 无授权形态（缺口） | **588** | **546** | −42；分布文件数 148 → 138（**10 个文件清零**） |
| 消费者端保护形态 | 39 | 39 | 不变（本批不涉） |
| 机读台账 `gaps` | 588 条 / 148 文件 | **546 条 / 138 文件** | 逐条移除 42、保留 3（工具：`docs/evidence/S3-222/tools/s3222-baseline-sync.mjs`，带前后计数与断言） |
| `--strict` 退出码 | EXIT=0 | **EXIT=0** | 未登记 0 条、陈旧登记 0 条（`12-guard-strict-after.txt`） |
| 本域对账 | 台账 45 = 实测缺口 45 | **45 = 42（已接）+ 2（P 公开）+ 1（W 待裁定）** | 一条不多、一条不少 |

### 12.5 反测（门禁铁律：故意制造失败，证明它会红）

| 反测 | 注入 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| A 报告模式分辨力 | 摘掉 `customer-visit.routes.ts` 的 `requirePermission("customer:visit")` | 已接线 **178 → 177**、缺口 **546 → 547**、缺口文件 **138 → 139**，该端点回落「无授权形态」 | `20-neg-A-report.txt` |
| B `--strict` 两侧 | 同上 | **EXIT=1** 且点出 `customer-visit.routes.ts:20 POST /api/admin/customer-visits/`（未登记 1 条）；复原 ⇒ **EXIT=0**（546 条登记、0 未登记） | `21-neg-A-strict.txt` / `23-neg-A-restored-strict.txt` |
| C 用例分辨力（vitest 侧） | 同上 | `rbac-b2-s3-222-customer-wiring.test.ts`：**3 failed / 186 passed**（形状断言、READONLY⇒403、非持有人逐账号枚举）；复原 ⇒ 全绿 | `22-neg-B-vitest-red.txt` |
| 逐字节还原 | 同一文件注入前后 | SHA256 一致（`25CFF62A…A00ECCA`），`git diff` 无残留 | `raw/30-hash-before-neg.txt`、回执 §五 |

### 12.6 与台账 §三.2「建议权限码」的差异（**4 处**，逐条给理由）

§三.2 的「建议权限码」是**机器规则化产出**（规则见 §六：POST⇒create、PUT/DELETE⇒edit，域内取 `customer:*`），
**未经生产持有核对**。本批逐条核对调用面与持有面后，4 处不照机器建议落地：

| 端点组 | §三.2 建议码 | 本批落地码 | 理由 |
|:--|:--|:--|:--|
| `POST /api/admin/members/register`（1） | 判定"公开端点（免鉴权）" | 判定"管理面"⇒ `customer:create` | **规则误伤**：§六 规则 2 按路径关键词 `register` 判公开，但该端点在同一文件的 `routeConfig.auth = requireAuthWithTenant` 之下（`admin-customer.routes.ts:31-35`）⇒ 实际需要登录；真实使用者是桌面「会员体系」页（`MemberSystem.vue`，仅 SUPER_ADMIN）。同批 1 的 15 号先例（台账判定有误 ⇒ 订正判定） |
| `POST /api/store/customer-statements/`、`/:statementNo/paid`（2） | `customer:create` | **`customer:statement`** | 079:147 既有「客户对账」码语义精确（比"新增"更贴合对账生命周期）；持有人 ⊇ {超管、运营、店长、财务}（财务持精确码 `customer:statement`），两条端点**无调用方** ⇒ 零回归。用 `customer:create` 会把**财务**排除在对账动作之外 |
| `POST /api/store/customer-payments/`、`/:receiptNo/void`（2） | `customer:create` | **`customer:payment`** | 079:149 既有「客户收款」码语义精确；持有人 = {超管、运营、店长（`customer:*`）}。两条端点**无调用方** ⇒ 零回归。（注：财务的 `finance:*` **不覆盖**客户域码，见 12.7-2） |
| `POST /api/store/customer-statements/:statementNo/confirm`（1） | 判定"管理面/是" | **不接（W）** | 见 12.3：移动端页面可见角色 ⊉ 候选码持有人 ⇒ 硬接即 403 回归 |

> 其余 38 条**照 §三.2 建议码落地**（`customer:create` / `customer:edit` / `customer:visit`），未做语义再细分。

### 12.7 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. **会员注册按钮路径漂移**：`admin-web/src/api/customer.ts:255` 打 `POST /admin/customers/members/register`，而后端只有 `/api/admin/members/register`（无 `/api/admin/customers` 前缀）⇒ 该按钮当前应为 404。本批按**后端现状**接线，未改前端。
2. **客户收款职责面**：`POST /api/store/customer-payments/**` 现挂 `customer:payment`，持有人不含 `FINANCE_STAFF`（财务持 `finance:*` 但 `matchPermission` 不跨域）。若产品认定"客户收款由财务办"，需为财务补该码或另立码（属授权模型决策）。
3. **标签域语义与域归属**：`tag.routes.ts` 的 `/api/admin/tags/**` 是**商品标签组/标签**，被台账归入客户域；其页面 `products/tag-groups`(`:171`)/`products/tag-relation`(`:172`) 的 `meta.roles` 含 STORE_MANAGER，而生产店长**不持** `goods:create|edit`（只持 `goods:price`）⇒ 挂 `goods:*` 会 403 店长，故本批用 `customer:*`（唯一满足"页面角色 ⊆ 持有人"的既有码）。语义与域不匹配，建议另立单细化（例如新立 `goods:tag` 类码并配套补授权）。
4. **客户标签增删路径漂移**：`api/customer.ts:289/:293` 打 `POST /admin/members/tags/add`、`/remove`，后端实为 `POST /members/tags/:id/tags`、`DELETE /members/tags/:id/tags/:tagId` ⇒ 前端"给客户打标签"当前应为 404。本批未改前端、未改契约。
5. **14 条"无页面调用方"的已接端点**（本批按域内既有码接线，属 API 策略面，不阻断任何页面；若产品不打算提供其中某项能力，建议单独裁剪，不在本单范围）：
   `PUT /members/:id/assign-staff`、`POST /customer-merge/merge`、`POST|POST /:receiptNo/void /store/customer-payments/`、
   `POST /store/customer-statements/`、`POST /store/customer-statements/:statementNo/paid`、`POST|DELETE /members/tags/:id/tags*`、
   `POST /customer-visits/:visitNo/{checkin,checkout,cancel}`、`POST|PUT|DELETE /admin/tags(/:id)`（3 条）。
   另注：`api/misc.ts:20`（取消拜访）、`api/sale.ts:44`（`/store/customer-statements/generate`）、`api/sale.ts:49`（`/admin/customer-payments`）三处导出**后端无对应路由或前缀不符** ⇒ 属死路径（与前端调用点漂移同族，见本条前 4 项）。
6. **移动端「对账单」确认按钮**（12.3 的 W 类）：`app-mobile/src/pages-sub/finance/statements/statements.vue` 还调用了 `disputeStatement`（页面内本地逻辑）与 `statementApi.create/update`（模块有导出、页面未用）；若凌舟决定"对该页收口"，需同时核对菜单码 `finance:statement` 的授予面。

---

## 十四、S3-224 · **销售域（17 文件 / 87 条仍缺口）**接线明细与守恒（2026-10-16）

> 执行方：阿坚（后端 / 权限）｜本地子代理 `/root/s3228_ajian`｜派单卡：`docs/tasks/inbox/ACTIVE-S3-224.md`
> 判定留档（含"不可枚举"三类入口的定义与卡外观察）：`docs/evidence/S3-224/01-plan-and-judgements.md`
> 原始输出：`docs/evidence/S3-224/**`（生产持有复算 `05-prod-holders.txt`、门禁前后 `11/12/20~24-*.txt`、回归 `30~33-*.txt`）
> 机读台账：`backend/scripts/rbac-wiring-baseline.json`（**合并态** `gaps` **480 条 / 129 文件**；`consumerEnd` 39 条不变）
> ⚠️ **基线说明（合并态真值）**：本单开工时 `origin/main` = `96b7cee7` 派生（本域读数：缺口 87 条 / 机读台账 531 条）；
> 开工期间 **S3-223（财务域 19 条，PR #349）合入** main（531 → 512 / 134 文件）⇒ 本单已 `git merge origin/main`，
> 表内"本批前/本批后"一律按**合并态**（512 → 480）落盘，与 §十三 的数字可直接相加。

### 14.1 起点订正：台账 §三.5 的「88 管理面」→ 机读真值 **87 条仍缺口**

§三.5 是 S3-180 期快照，与开工当日实测有 5 处偏移（4 条小程序售后已按 S3-205 归 `consumerEnd`；
`admin-order` / `store-sale-bill` / `sale-return` / `admin-marketing-flash-sale` 四个文件另新增或已接线共 4 条）
⇒ 对账起点必须用机读真值：`node backend/scripts/guard-rbac-wiring.mjs --json` ⇒ 本域 17 文件 **写端点 100 / 仍缺口 87**。

### 14.2 接线口径（照派单卡 §二，**逐端点**判定，不整体套用 `sale:*`）

| 序 | 卡面口径 | 本单落地 |
|:--|:--|:--|
| ① | 先查两道闸（G0 名单 + `NOT_IN_G0` + G1/G2 待裁名单） | **命中 2 行锁定**（见 14.6），一律不接并逐条报备 |
| ② | 优先挂「该端点**真实使用者已持有**的模块码」 | 32 条落地码全部来自**生产 12 角色复算**（`05-prod-holders.txt`）；逐条列使用者文件:行（14.3） |
| ③ | `sale:*` 族不许为省事整体套用；`sale:cancel`/`sale:void` 属高风险，不得顺手扩给收银员 | 收银员（`STORE_OPERATOR`）只在**页面角色含收银员**的行上通过（`sale:create` / `sale:return` / `finance:daily-settle`）；订单/销售单取消类一律 `sale:void`（不含收银员） |
| ④ | 查询型 POST 不按写端点接 | 1 条（`/admin/quote-push/preview`）⇒ Q 类，不接 + 登记 |
| ⑤ | 公开端点按台账口径免鉴权 + 逐条登记理由 | 3 条（即时零售平台回调）⇒ P 类 |
| ⑥ | 找不到「使用者已持有」的码 ⇒ 不接 + 登记 | 40 条 B 类（使用者集合不可枚举）＋ 3 条 W 类（岗位管理无对应既有码） |
| ⑦ | 消费者端形态不适用商家权限码 | 6 条（`cart.routes.ts`）⇒ C 类，不接 + 登记（含一条门禁判据缺口，见 14.10-1） |

### 14.3 本批已接 **32 条**（端点 / 落地码 / 真实使用者依据）

| # | 端点（`file`） | 落地码 | 真实使用者（页面 / 调用点） |
|--:|:--|:--|:--|
| 1 | `admin-marketing-flash-sale.routes.ts` PUT `/marketing/flash-sales/:id` | `sale:edit` | `marketing/FlashSale.vue:387`［SUPER_ADMIN］（`router:228`） |
| 2 | 同上 DELETE `/marketing/flash-sales/:id` | `sale:edit` | `FlashSale.vue:418`＋`MarketingView.vue:542`［SUPER_ADMIN］（`:220`） |
| 3 | `admin-order.routes.ts` POST `/orders/batch-status` | `sale:edit` | 全仓无页面调用点 |
| 4 | 同上 POST `/orders/:orderNo/cancel` | `sale:void` | 无页面调用点（app-mobile `orders.ts:117` 仅封装） |
| 5 | 同上 PUT `/orders/:orderNo/remark` | `sale:edit` | 全仓无页面调用点 |
| 6 | `admin-quote-push.routes.ts` POST `/quote-push/:id/push` | `sale:create` | 全仓无页面调用点 |
| 7 | 同上 POST `/quote-push/:id/cancel` | `sale:void` | 全仓无页面调用点 |
| 8 | `aftersale.routes.ts` POST `/aftersales/:id/confirm-receipt` | `sale:return` | `marketing/AftersaleView.vue:307`［SUPER_ADMIN］（`:230`） |
| 9 | `commerce-fix.routes.ts` DELETE `/consumer-addresses/:id` | `sale:edit` | 无页面调用点（`customer.ts:380/384` 只有 GET） |
| 10 | 同上 PUT `/bills/:id` | `sale:edit` | `finance/BillManagement.vue:304`［SUPER_ADMIN］（`:205`） |
| 11 | 同上 DELETE `/bills/:id` | `sale:edit` | 无页面调用点（`finance.ts` 无 deleteBill） |
| 12 | 同上 POST `/bills/:id/void` | `sale:void` | `BillManagement.vue:281`［SUPER_ADMIN］ |
| 13 | `order-timeout.routes.ts` POST `/order-timeout/configs` | `sale:edit` | `order/OrderTimeoutView.vue:327`［SUPER_ADMIN, STORE_MANAGER］（`:118`） |
| 14 | 同上 PUT `/order-timeout/configs/:id` | `sale:edit` | `OrderTimeoutView.vue:292/324` |
| 15 | 同上 DELETE `/order-timeout/configs/:id` | `sale:edit` | `OrderTimeoutView.vue:309` |
| 16 | `sale-return.routes.ts` POST `/sale-returns/:returnNo/approve` | `sale:return` | 无页面调用点（app-mobile `store.ts:829` 仅封装） |
| 17 | 同上 POST `/sale-returns/:returnNo/reject` | `sale:return` | 同上（`store.ts:834`） |
| 18 | `store-order.routes.ts` POST `/store/orders/:orderNo/accept` | `sale:create` | `pos/OrderFulfillView.vue:150`［SUPER_ADMIN, STORE_MANAGER, **STORE_OPERATOR**］（`:262`） |
| 19 | 同上 POST `/store/orders/:orderNo/complete-delivery` | `sale:create` | `OrderFulfillView.vue:176` |
| 20 | 同上 POST `/store/orders/:orderNo/reject` | `sale:create` | `OrderFulfillView.vue:163` |
| 21 | 同上 POST `/store/orders/:orderNo/cancel` | `sale:void` | 全仓无页面调用点（取消/作废属高风险动作，不扩给收银员） |
| 22 | 同上 POST `/store/hold-orders/:holdNo/restore` | `sale:create` | `pos/HoldOrderView.vue:83`＋`pos/CashierView.vue:1689`［含 **STORE_OPERATOR**］（`:265`/`:259`） |
| 23 | 同上 DELETE `/store/hold-orders/:holdNo` | `sale:create` | `HoldOrderView.vue:96`＋`CashierView.vue:1709` |
| 24 | `store-sale-bill.routes.ts` POST `/store/sale-bills/:billNo/pay-by-code` | `sale:create` | `pos/CashierView.vue:1628`［含 **STORE_OPERATOR**］（`:259`） |
| 25 | `store-shift.routes.ts` POST `/store/shift/settle` | `finance:daily-settle` | 全仓无页面调用点（班结；与 `pos/daily-settle` 同族同码） |
| 26 | 同上 POST `/store/shifts/` | `finance:daily-settle` | `pos/ShiftView.vue:258`［SUPER_ADMIN, STORE_MANAGER, **STORE_OPERATOR**］（`:268`） |
| 27 | 同上 POST `/store/shifts/:shiftNo/check` | `finance:daily-settle` | `pos/ShiftDetailView.vue:345`（`:269`） |
| 28 | 同上 POST `/store/shifts/:shiftNo/close` | `finance:daily-settle` | `pos/ShiftView.vue:296` |
| 29 | `instant-retail-store.routes.ts` POST `/store/instant-retail/orders/:platformOrderId/confirm` | `sale:create` | 全仓无页面调用点（`rg '/store/instant-retail'` 四前端零命中） |
| 30 | 同上 POST `…/cancel` | `sale:void` | 同上 |
| 31 | 同上 POST `…/start-delivery` | `sale:create` | 同上 |
| 32 | 同上 POST `…/complete-delivery` | `sale:create` | 同上 |

**逐码分布**：`sale:create` 9 ｜ `sale:edit` 8 ｜ `sale:void` 5 ｜ `sale:return` 3 ｜ `finance:daily-settle` 4 = **32**。
**5 个码全部是仓库既有码**（`sale:*` 见 `docs/migrations/079_权限矩阵.sql:205-207` 与 `docs/migrations/203_销售单取消权限点.sql`；
`finance:daily-settle` / `sale:return` 为既有码）⇒ **不新立权限点、不改角色种子、不动 `docs/migrations/**`**。

### 14.4 生产持有事实（本批判据起点，**先测再判**）

原始输出：`docs/evidence/S3-224/05-prod-holders.txt`（由生产只读底稿复算，租户 `default` 12 角色）。
关键结论：**只有 `sale:create` / `sale:return` / `finance:daily-settle` 覆盖 `STORE_OPERATOR`（收银员）**；
`sale:edit` / `sale:void` / `sale:cancel` / `report:finance` / `finance:payment` **均不含收银员** ⇒
凡页面角色含收银员的端点，落地码只能取前者（这是本批 5 个码分布的**唯一依据**）。
另：`t_sys_menu` 里**没有任何 `aftersale:*` 行**（`aftersale:*` 只是 CUSTOMER_SERVICE 的权限串通配）
⇒ 售后域无既有细码，`confirm-receipt` 取退货语义码 `sale:return`。

### 14.5 本批**未接** **40 条 · B 类**（存在 app-mobile 写调用点，且该页使用者集合**不可枚举**）

判据（与 S3-198 §9.1、S3-220 §12.3、S3-223 §13.1③ 同口径，本单把"入口"这一层显式写清）：
app-mobile 页面若**①经首页快捷入口 / tabBar / 推送深链无条件可达**，或**②全仓无任何导航入口（孤岛页）**，
则其使用者集合不可用静态证据枚举 ⇒ 不接线、逐条登记。

| # | 端点 | app-mobile 写调用点（证据） | 不可枚举的原因 |
|--:|:--|:--|:--|
| 1 | `admin-order.routes.ts` PUT `/admin/orders/:orderNo/status` | `pages/orders/order-detail.vue:258`（`ordersApi.startDelivery`） | 该页经 `pages/orders/orders.vue`（首页快捷入口 `home.vue:75` **无条件可达**）与推送深链 `native/push.ts:105` 进入 |
| 2 | `admin-quote-push.routes.ts` POST `/admin/quote-push/` | `pages-sub/product/price-push/price-push.vue:163` | 孤岛页（`pages.json` 注册，全仓无导航入口） |
| 3–6 | `aftersale.routes.ts` POST `/admin/aftersales/:id/{approve,reject,inspect,complete}` | `pages-sub/order/order-aftersale/aftersale.vue:144/178`（`aftersaleApi.approve/reject`） | 孤岛页 |
| 7–9 | `order-exception.routes.ts` POST `/admin/order-exceptions`、PUT `/:id(\\d+)/status`、PUT `/:id(\\d+)` | `pages-sub/order/order-exception/exception.vue`（`api/modules/exceptions.ts:123/134/140`） | 孤岛页 |
| 10 | `store-order.routes.ts` POST `/store/hold-orders/` | `pages/sales/create-sale.vue:2013`（`storeApi.createHoldOrder`） | 开单页经首页快捷入口 `home.vue:69` **无条件可达**（同批 4 的 M 类同款形态） |
| 11 | `store-order.routes.ts` POST `/store/orders/:orderNo/start-delivery` | `pages/orders/order-detail.vue:258` | 同第 1 条 |
| 12 | `store-sale-bill.routes.ts` POST `/store/sale-bills/:billNo/collection-link` | `pages-sub/product/collection-link/collection-link.vue:119` | 孤岛页 |
| 13 | `store-sale-bill.routes.ts` POST `/store/sale-bills/:billNo/offline-payment` | `pages-sub/order/sales/sale-detail.vue:172`（`salesApi.offlinePayment`） | 该页经 `pages/orders/orders.vue:678` 进入 ⇒ 首页快捷入口**无条件可达** |
| 14–25 | `instant-retail-admin-ops.routes.ts` 全部 **12 条**（`orders/:orderNo/status`、`routing-rules` POST/PUT/DELETE、`exceptions/:id/handle`、`shelf` POST/PUT/DELETE、`deliveries/:deliveryId/{assign,status}`、`reviews/:id/reply`、`reviews/sync`） | `pages-sub/finance/instant-retail/orders.vue:224/244/274`、`config.vue:158/170/180/190/205`、`products.vue:201/215/237` | 三个**孤岛页**（`pages.json` 注册但全仓无 `navigateTo` / `function-menu` / `tabBar` / `push` 引用） |
| 26–40 | `instant-retail-admin-platform.routes.ts` 全部 **15 条**（`configs` POST、`configs/:platform/{test,sync-orders,sync-products}`、`configs/:platform` DELETE、`shop-config`、`categories` POST/PUT/DELETE、`products` POST/PUT/DELETE、`banners` POST/PUT/DELETE） | 同上三个孤岛页 | 同上 |

> **保守口径声明**：孤岛页（第 2、3–9、12、14–40 条）"看得到按钮的角色"**可能为空**（无导航入口 ⇒ 无人能经 UI 到达）；
> 本单**不**据此接线，理由：静态扫描只能证明"仓库内无引用"，**不能**证明"线上无人直连该 URL"（H5 构建下页面 URL 可直达）
> ⇒ 按"**无法证明不误伤则不动**"处理，零回归优先。若凌舟认定孤岛页使用者集合为空，这 36 条可**一键接线**
>（码位与本单同口径：管理面按 `sale:create|edit|void` 取用；门店端按 `sale:create|void`），本单已备好反测位。

### 14.6 本批**未接** **2 条 · L 类**（命中既有锁定，本单无授权改断言）

| # | 端点 | 锁定锚点 | 不改的理由 |
|--:|:--|:--|:--|
| 1 | `sale-return.routes.ts` POST `/api/admin/sale-returns/` | `rbac-g0-wiring.test.ts:729`（`NOT_IN_G0`，断言 READONLY 仍 200）＋`rbac-g1-wiring.test.ts:285`（C 类）＋`rbac-g2-wiring.test.ts:350-362`（**R 类**） | 本 Router **双挂载**（`/api/admin/sale-returns` 与 `/api/store/sale-returns`）⇒ 接线会让 admin-web `pos/SaleReturnView.vue:216`（`createStoreSaleReturn`，页面角色含 **STORE_OPERATOR**）与 app-mobile 退货链路一并 403 |
| 2 | `store-sale-bill.routes.ts` POST `/api/store/sale-bills/:billNo/payment` | `rbac-g0-wiring.test.ts:730`（`NOT_IN_G0`，注释标「归 G2」） | 与上同：改断言未获本单授权 |

### 14.7 本批**未接** **13 条**（Q 1 / P 3 / C 6 / W 3）

| 类 | 端点 | 不接的理由 |
|:--|:--|:--|
| **Q** 查询型 POST | `admin-quote-push.routes.ts` POST `/api/admin/quote-push/preview` | 报价**预览**，不改数据 ⇒ 按派单卡 §二.3「查询型 POST 不按写端点接」（同批 3 §12.6 P 类同款判定） |
| **P** 公开端点 | `instant-retail-webhook.routes.ts` POST `/api/instant-retail/webhook/{jd,meituan,eleme}` | 三平台服务器直调：该文件 `routeConfig.auth = "none"`（免鉴权），无登录态；挂权限码既无意义、也会把正常回调打成 401/403（同批 5 §13.5 同款） |
| **C** 消费者端 | `cart.routes.ts` POST `/add`、PUT/DELETE `/items/:skuId`、POST `/clear`、POST `/checkout/preview`、POST `/checkout/create`（6 条） | 该文件 `routeConfig.auth = "requireConsumerAuthWithTenant"`（S3-196 消费者身份）⇒ 消费者 roles 恒空，**不适用商家权限码**（硬套即把小程序购物车打成 403，S3-203 `trace:*` 教训）。**登记理由见 14.10-1（门禁判据缺口）** |
| **W-M** 待授权模型定案 | `position.routes.ts` POST `/`、PUT `/:id`、DELETE `/:id`（3 条） | 岗位管理属**组织/人事**语义，本仓 `t_sys_menu` 无「岗位」细码；页面 `system/PositionManage.vue`（`router:235` 角色 = SUPER_ADMIN）。硬挂 `sale:edit` 属跨域错配 ⇒ 按台账 §〇.3「不硬塞」原则登记待裁定。⚠️ `position.routes.ts` 在台账里被按**目录**归入销售域，但**不在** S3-225（员工/账号域 7 文件 / 31 端点，凌舟 2026-10-16 已派）的范围内 ⇒ 请凌舟裁定：并入 S3-225，或另立 `system:position:*` 细码 |

### 14.8 守恒与门禁（原始输出见 `docs/evidence/S3-224/`）

| 指标 | 本批前（**合并态**） | 本批后 | 说明 |
|:--|--:|--:|:--|
| 扫描写端点总数 | 763 | 763 | 未增删端点 |
| 已接线（权限码） | 212 | **244** | +32 = 本批接线数（`11-guard-after-wiring.txt`） |
| 无授权形态（缺口） | **512** | **480** | −32；分布文件数 134 → **129**（**5 个文件清零**：`store-shift`、`instant-retail-store`、`order-timeout`、`commerce-fix`、`admin-marketing-flash-sale`） |
| 消费者端保护形态 | 39 | 39 | 不变（本批不涉） |
| 机读台账 `gaps` | 512 条 / 134 文件 | **480 条 / 129 文件** | 工具 `tools/update-baseline.mjs` 逐键移除 32 条（含前后计数与断言） |
| `--strict` 退出码 | EXIT=0 | **EXIT=0** | 未登记 0 条、陈旧登记 0 条（`12-guard-strict-after.txt`） |
| 本域对账 | 机读缺口 87 | **87 = 32（已接）+ 40（B）+ 2（L）+ 1（Q）+ 3（P）+ 6（C）+ 3（W-M）** | 一条不多、一条不少 |
| 跨批计数快照 | `rbac-g0-wiring.test.ts` 183 | **215** | 只同步"总数 + 逐文件计数"，G0 名单行一字未动 |
| 既有测试适配 | — | 2 处**契约变化**（非放宽） | ① `rbac-g0-wiring.test.ts` 计数 +`S3_224_WIRED_FILES`（与 S3-223 块合并）；② `s3-209-sale-cancel-wiring.test.ts` 的**对照行**由 `POST /orders/:orderNo/cancel`（本批已接线）改为 `PUT /orders/:orderNo/status`（本批仍 B 类） |

### 14.9 反测（门禁铁律：故意制造失败，证明它会红）

| 反测 | 注入 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| A 报告模式分辨力 | 摘掉 `store-shift.routes.ts` 的 `requirePermission("finance:daily-settle")`（班结行） | **合并态**：已接线 **244 → 243**、缺口 **480 → 481**、缺口文件 **129 → 130** | `25-neg-report-merged.txt`（合并前同条注入：`20-neg-report.txt`，225→224 / 499→500 / 131→132） |
| B `--strict` 两侧 | 同上 | **EXIT=1** 且点出 `❌ 未登记：store-shift.routes.ts:18 POST /api/store/shift/settle`；复原 ⇒ **EXIT=0** | `26-neg-strict-merged.txt` / `29-neg-restored-strict-merged.txt`（合并前：`21-` / `24-`） |
| C 用例分辨力（vitest 侧） | 同上 | `rbac-b2-s3-224-sales-wiring.test.ts`：**3 failed / 160 passed**（形状断言、READONLY⇒403、非持有人逐账号枚举）；复原 ⇒ **163 passed** | `27-neg-vitest-red-merged.txt`（合并前：`22-neg-vitest-red.txt`） |
| 逐字节还原 | 同一文件注入前后 | SHA256 一致（`8B2CD642…2311A9F`），`git diff` 无残留 | `raw/25-hash-before-neg-merged.txt` / `raw/28-hash-after-neg-merged.txt`（合并前：`raw/20-` / `raw/23-`） |

> 反测在**合并前**与**合并后**各跑一遍（同一注入点、同一条端点），两侧读数都在 `docs/evidence/S3-224/`；
> 合并后的 "A 报告模式" 数字（244→243 / 480→481 / 129→130）是可直接与 §十四.8 表格相加的**最终读数**。

### 14.10 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. **`cart.routes.ts` 的 6 条写端点实际是消费者端形态，但静态门禁看不见（判据缺口）**：
   该文件用**声明式** `routeConfig.auth = "requireConsumerAuthWithTenant"`（`cart.routes.ts:24-28`），
   而 `guard-rbac-wiring.mjs` 的「消费者端保护形态」判据要求 `requireConsumerAuthWithTenant` 与
   `csrfMiddleware` **在同一挂载调用里成对出现**（`isConsumerProtectedCall`）⇒ 声明式写法扫不到，
   6 条被记成「无授权形态」并留在 `gaps`。对照：`miniapp.routes.ts`（29 条）/`aftersale.routes.ts`（4 条）/
   `notification.routes.ts`（2 条）/`marketing-miniapp.routes.ts`（4 条）是**内联**写法，已正确登记进 `consumerEnd`。
   ⇒ 建议另立单：给 `cart.routes.ts` 的写端点补内联成对中间件（或在门禁里识别声明式消费者认证），
   并把 6 条登记进 `consumerEnd`。**本单不接这 6 条**（零回归优先）。
2. **app-mobile 孤岛页共 8 个**（`pages.json` 已注册、全仓无导航入口）：
   `pages-sub/order/order-exception/exception.vue`、`pages-sub/product/price-push/price-push.vue`、
   `pages-sub/order/order-aftersale/aftersale.vue`、`pages-sub/order/sales/sale-bills.vue`、
   `pages-sub/product/collection-link/collection-link.vue`、
   `pages-sub/finance/instant-retail/{orders,config,products}.vue`。它们是本批 36 条 B 类的直接原因。
3. **`pages/home/home.vue:69/75/81/87` 的「快捷入口」硬编码且无权限门**（快速开单→`/pages/sales/create-sale`、
   单据管理→`/pages/orders/orders`、扫码入库、会员管理）⇒ 这 4 个页面**无条件可达**，
   是"用户集合不可枚举"的另一大来源（与批 4 的 M 类同源）。
4. **`pages/orders/order-detail.vue`** 同时经菜单码页与**推送深链**（`native/push.ts:105`，无门）进入 ⇒
   其写调用点不可枚举（本批 2 条 B 类由此而来）。
5. **`position.routes.ts` 的域归属**：台账按目录把它归入「销售域」，但其语义属**组织/人事**，且不在 S3-225 范围（见 14.7 W-M）。
6. **`sale-return.routes.ts` 单 Router 双挂载**（`/api/admin/sale-returns` 与 `/api/store/sale-returns`）：
   本批只接了 `/:returnNo/approve|reject`（全仓无页面调用点），但**任何**在该文件新增的接线都会同时作用于两个前缀；
   若将来要接 `POST /`（创建退货单），必须同时核对两个前缀的使用者（G2 R 类已就此锁定）。

---

## 十三、S3-223 · **财务域（9 文件 / 28 写端点）**接线明细与守恒（2026-10-16）

> 派单卡：`docs/tasks/inbox/ACTIVE-S3-223.md`｜判定依据留档：`docs/evidence/S3-223/01-plan-and-judgements.md`｜原始输出：`docs/evidence/S3-223/**`
> 基线：开工时 `origin/main` = `90119ef4`（当时读数 缺口 **573 → 554**、文件 **146 → 144**）；
> ⚠️ 开工期间 S3-222 以 PR #347 合并（`f2beb109`，573 → 531），本单已 `git merge origin/main`，
> **合并态真值 = 缺口 531 → 512（文件 136 → 134）**，机读台账 `_counts` 按合并态重算（512 / 134）。

### 13.1 接线口径（照派单卡 §二 执行，**不统一成 `finance:*`**）

1. **先查两道闸再动手**（批 3 教训）：`rbac-g0-wiring.test.ts`（含 `NOT_IN_G0` 范围控制行）＋ `rbac-g1/g2-wiring.test.ts` 的「待裁名单」⇒ 本域 **9 行命中锁定**，一律不接并逐条报备；
2. **选码只按「该端点真实使用者已持有的最细现成码」**：不新立码、不改角色种子、不动迁移；
3. **页面角色集不可枚举的行（B 类）不硬接**：app-mobile 页面若经「我的」页/首页快捷入口无条件可达、或注册码无 `t_sys_menu` 行，接线必把看得到按钮的角色打成 403（同批 1 `trace:*` 形态）；
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

- `node backend/scripts/guard-rbac-wiring.mjs`（**合并 S3-222 后**）⇒ 扫描 189 文件 / 763 写端点；
  **已接线 170 → 212**、消费者端保护形态 39、**无授权形态 531 → 512**（文件 136 → **134**）；
  本批单独在基线 90119ef4 上的读数为 已接线 151 → 170、缺口 573 → 554（146 → 144）；
- `--strict` ⇒ **EXIT=0**（台账核对：已登记 512 ／ 未登记 0 ／ 已登记但当前无缺口 0）；
- 机读台账 `backend/scripts/rbac-wiring-baseline.json`：`_counts` 按合并态重算（512 / 134），
  新增 `_s3223_merge_note` 说明两个口径；仅移除本域 19 条，未动他人条目；
- 全量 `npx vitest run` ⇒ 0 failed（读数见回执 §四）；`npx tsc --noEmit` ⇒ EXIT=0；根 `npm run build` ⇒ EXIT=0。

### 13.7 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. `admin-web/src/api/finance.ts:17` 打 `PATCH /admin/bank-accounts/:id/status`、`:21/:25` 打 `/:id/transactions`——后端无此路径（调用即 404）。
2. `PaymentConfigView.vue:466/595/598/623/633` 打 `/admin/payment/bank-accounts**`（**后端无此前缀**，实体是 `/api/payment-config/bank-accounts`）⇒ 支付配置页"银行账户"区块当前不可用；前端 `PUT .../:id/default` 与后端 `POST` 方法亦不一致。
3. 前端死代码：`api/customer.ts:126`（`/credits/:customerId/term`）、`:145-161`（催收四方法）、`app-mobile .../expenses.ts:94`（`PUT /expenses/:expenseNo`）均导出零引用。
4. 文档编号撞号（仅登记）：`## 十二` 在本文件出现两次（S3-220 与 S3-222 各一次，均在本次合并前落盘）；本单顺延为 `## 十三`，未改动他人章节编号。

## 十五、S3-225 · **员工 / 账号域（7 文件 / 31 写端点）**接线明细与守恒（2026-10-16）

> 派单卡：`docs/tasks/inbox/ACTIVE-S3-225.md`｜判定依据留档：`docs/evidence/S3-225/01-plan-and-judgements.md`
> 原始输出：`docs/evidence/S3-225/**`｜基线：开工时 `origin/main` = `2b4a0e16`（S3-225 派单提交）
> ⚠️ **合并态口径（重要）**：开工期间 S3-224（销售域 32 条，PR #350）与记账提交 `ea29ee1f` 合入 `origin/main`（512 → **480 / 129**，
> g0 快照 183 → 215）⇒ 本单已 `git merge origin/main`，**合并态真值 = 缺口 480 → 469（文件 129 → 129）**、g0 快照总数 **215 → 226**
> （`S3_224_WIRED_FILES` 与 `S3_225_WIRED_FILES` 两块并存，未删任一批）。本节 §15.4/§15.5 同时给出**本批分支相对值**与**合并态真值**两个读数。
> ⚠️ **章节号说明**：`## 十四` 已由在办的 S3-224（销售域·批 6，提交 `428103f1`）占用（其 §十四 落盘早于本节）；
> 本节顺延为 `## 十五`，**未改动他人章节编号**（同 S3-223 §13.7 的处理方式）。

### 15.1 接线口径（照派单卡 §二 执行，**不统一成 `system:*` 通配**）

1. **先查两道闸再动手**：`rbac-g0-wiring.test.ts`（含 `NOT_IN_G0` 范围控制名单）＋ `guard-rbac-wiring --json` 的 `authForm`
   ⇒ 本域 **31 行全部不在** `NOT_IN_G0`／G1／G2 三个既有锁定名单里（逐行 grep 证据 `docs/evidence/S3-225/03-locks-check.txt`）；
2. **选码只按「该端点真实使用者已持有的最细现成码」**：本批只用 079 既有四条码
   `system:user:create`（079:270）／`system:user:edit`（079:271）／`system:role:create`（079:272）／`system:role:edit`（079:273），
   **不新立码、不改角色种子、不动迁移**；持有角色 = `SUPER_ADMIN` / `OPERATION_ADMIN`（`--holders` 复算 +
   生产只读底稿 `docs/evidence/_shared/prod-roles-20261016.txt` 的 12 角色 × 权限码一致：生产无任何角色显式持 `system:*`）；
3. **自服务端点不套管理面码**（S3-203 `trace:*` 教训）：7 条本人数据/本人会话类逐条登记；
4. **查询型 POST 不按写端点接**：1 条；
5. **页面角色集不可枚举的行（B 类）不硬接**：app-mobile「我的」页对员工管理页/角色管理页是**无条件硬编码入口**
   （`profile.vue:50/54`，无 `v-if`、无 `isPageVisible`）⇒ 挂管理面码会把店长等角色由可用打成 403；
6. **需新立码的不接**：部门域 4 条（079 无部门域码）。

### 15.2 本批已接 **11 条**（端点 / 落地码 / 真实使用者）

| # | 端点 | 落地码 | 真实使用者（页面/调用点） |
|--:|:--|:--|:--|
| 1 | `PUT /api/admin/staff/:id/status` | `system:user:edit` | `EmployeesView.vue:340`［`router/index.ts:232 employees`，SUPER_ADMIN］＋`OrganizationView.vue:385`［`:233 organization`，SUPER_ADMIN］；无 app-mobile 调用点 |
| 2 | `POST /api/admin/sys-users/` | `system:user:create` | 全仓 0 调用点（零回归） |
| 3 | `POST /api/admin/sys-users/:id/reset-password` | `system:user:edit` | `EmployeesView.vue:363`＋`OrganizationView.vue:405`（`api/system.ts:67`）［均 SUPER_ADMIN］ |
| 4 | `DELETE /api/admin/sys-users/:id` | `system:user:edit` | 全仓 0 调用点（零回归） |
| 5 | `PUT /api/admin/system/roles/:id/data-permissions` | `system:role:edit` | `SystemRoles.vue:596/608`［`:237 system/roles`，SUPER_ADMIN］ |
| 6 | `PUT /api/admin/system/roles/users/:userId/roles` | `system:role:edit` | `SystemRoles.vue:650`（移动端 `roles.ts:86 setUserRoles` 为零引用导出） |
| 7 | `POST /api/admin/data-permissions/` | `system:role:create` | 全仓 0 调用点（零回归） |
| 8 | `PUT /api/admin/data-permissions/:id` | `system:role:edit` | 全仓 0 调用点（零回归） |
| 9 | `DELETE /api/admin/data-permissions/:id` | `system:role:edit` | 全仓 0 调用点（零回归） |
| 10 | `POST /api/admin/data-permissions/roles/:roleId` | `system:role:create` | 全仓 0 调用点（零回归） |
| 11 | `DELETE /api/admin/data-permissions/roles/:roleId/:dataPermissionId` | `system:role:edit` | 全仓 0 调用点（零回归） |

**文件分布**：admin-staff 1 ／ sys-user 3 ／ rbac 2 ／ data-permission 5 = **11**
（`admin-auth.routes.ts`、`department.routes.ts`、`user-session.routes.ts` 三文件本批 0 改动）。

### 15.3 本批**未接** **20 条**（逐条；分五类）

**① B 类 7 条**（移动端写调用点所在页的角色集不可枚举 ⇒ 待移动端补权限门后收编）

| # | 端点 | 移动端写调用点 | 入口依据 |
|--:|:--|:--|:--|
| 1 | `POST /api/admin/staff` | `employees.vue:132`（`employees.ts:42 addEmployee`） | `profile.vue:50` 无条件入口（员工管理） |
| 2 | `PUT /api/admin/staff/:id` | `employees.vue:159`（`employees.ts:47`） | 同上 |
| 3 | `PUT /api/admin/staff/:id/disable` | `employees.vue:179`（`employees.ts:54`） | 同上 |
| 4 | `POST /api/admin/staff/:id/restore` | `employees.vue:187`（`employees.ts:56`） | 同上 |
| 5 | `POST /api/admin/system/roles/` | `role-edit.vue:227`（`roles.ts:63 create`） | `profile.vue:54` 无条件入口（角色管理） |
| 6 | `PUT /api/admin/system/roles/:id` | `role-edit.vue:225`（`roles.ts:68 update`） | 同上 |
| 7 | `DELETE /api/admin/system/roles/:id` | `roles.vue:116`（`roles.ts:73 remove`） | 同上 |

**② 自服务 7 条**（本人数据/本人会话 ⇒ 不套管理面码，逐条登记）

| # | 端点 | 依据 |
|--:|:--|:--|
| 1 | `PUT /api/admin/auth/settings` | 台账 §三.1 判自服务；全仓 0 调用点 |
| 2 | `POST /api/admin/auth/change-password` | 本人改密（`auth.ts:110`、`profile.ts:30`） |
| 3 | `POST /api/admin/auth/mfa/setup` | 本人 MFA 绑定（`auth.ts:130`） |
| 4 | `POST /api/admin/auth/mfa/confirm` | 本人 MFA 确认（`auth.ts:135`） |
| 5 | `POST /api/admin/auth/mfa/disable` | 本人 MFA 关闭（`auth.ts:140`） |
| 6 | `DELETE /api/user-session/:id` | 本人会话注销；全仓 0 调用点（前端会话页打 `/admin/sessions/:id`，非本路由） |
| 7 | `DELETE /api/user-session/user/:userId` | 台账判自服务；全仓 0 调用点（⚠️ 语义偏管理面，见 15.6 待裁定） |

**③ 自服务实际用途 1 条**（台账判「管理面」与真实用途不符 ⇒ 不接并报备）

| # | 端点 | 依据 |
|--:|:--|:--|
| 1 | `PUT /api/admin/sys-users/:id` | 全仓唯一调用点 = app-mobile「我的 → 编辑资料」`edit.vue:180`（`profile.ts:26 updateProfile`，传**本人** id）⇒ 挂 `system:user:edit` 会把所有非 `*` 角色的「保存资料」打成 403 |

**④ 查询型 POST 1 条**：`POST /api/admin/data-permissions/users/:userId/check`（只读判定，按派单卡 §二.4 不接）

**⑤ 需新立权限点 4 条**：`POST /api/department/`、`PUT /api/department/:id`、`DELETE /api/department/:id`、
`PUT /api/department/:id/move`（079 无部门域码；立码属产品决策，登记待办；页面 `router/index.ts:234 department-manage`[SUPER_ADMIN]）

**守恒**：11（已接）+ 7 + 7 + 1 + 1 + 4（未接）= **31** ✓

### 15.4 守恒与门禁（原始输出见 `docs/evidence/S3-225/`）

- `node backend/scripts/guard-rbac-wiring.mjs` ⇒ 扫描 189 文件 / 763 写端点；
  **已接线 212 → 223**、消费者端保护形态 39、**无授权形态 512 → 501**（文件 **134 → 134**，四个接线文件都未清零）；
- `--strict` ⇒ **EXIT=0**（台账核对：已登记 501 ／ 未登记 0 ／ 已登记但当前无缺口 0）；
- 机读台账 `backend/scripts/rbac-wiring-baseline.json`：`_counts` = **501 / 134**，新增 `_s3225_note`；仅移除本域 11 条，未动他人条目；
- 全量 `npx vitest run` ⇒ 0 failed；`npx tsc --noEmit` ⇒ EXIT=0；backend `eslint` ⇒ EXIT=0；根 `npm run build` ⇒ EXIT=0（读数见回执 §二）。

**合并 origin/main 后（终态，原始输出 `30-guard-after-merged.txt` / `31-guard-strict-merged.txt` / `40-vitest-full-merged.txt` 等）**：

- `node backend/scripts/guard-rbac-wiring.mjs` ⇒ **已接线 223 → 255**（含 S3-224 的 32 条）、**无授权形态 480 → 469**（文件 **129 → 129**）；
- `--strict` ⇒ **EXIT=0**（已登记 469 ／ 未登记 0 ／ 已登记但当前无缺口 0）；
- 机读台账 `_counts` = **469 / 129**，新增 `_s3225_merge_note`（写明两单交叉改动的重算口径）；
- 合并态回归：全量 `npx vitest run` 0 failed、`npx tsc --noEmit` EXIT=0、backend `eslint` EXIT=0、根 `npm run build` EXIT=0（读数见回执 §五）。

### 15.5 反测（门禁铁律：故意制造失败，证明它会红）

| 反测 | 手法 | 期望 | 实测 |
|:--|:--|:--|:--|
| A | 摘掉 `rbac.routes.ts:25` 的 `requirePermission("system:role:edit")` | `--strict` EXIT=1 且点出该端点；本批用例红 | **EXIT=1**（`❌ 未登记：rbac.routes.ts:25 PUT /api/admin/system/roles/:id/data-permissions`）；用例 **3 failed / 126 passed** |
| B | 摘掉 `admin-staff.routes.ts:23` 的 `requirePermission("system:user:edit")` | 同上 | **EXIT=1**（`❌ 未登记：admin-staff.routes.ts:23 PUT /api/admin/staff/:id/status`）；用例 **3 failed** |
| C | 判据反测：把该行改挂 `sale:create`（非目标码） | 零回归/非持有人判据必须红 | 用例 **3 failed**（含「8 个非持有角色全 403」）⇒ 判据非恒真 |
| 复原 | 逐字节还原 + SHA256 比对（7 文件） | 0 处不一致 | **0 处不一致**；`--strict` 回 EXIT=0 |
| A′（**合并态**复测） | 合并 `origin/main` 后重做反测 B 的手法 | 同上 | **EXIT=1**（`❌ 未登记：admin-staff.routes.ts:23`）；用例 **3 failed / 126 passed**；复原后哈希一致、`--strict` 回 EXIT=0（`32/33/34-*`） |

### 15.6 与台账 §三.1「建议权限码」的差异（**1 处**）

1. `POST /api/admin/sys-users/:id/reset-password`：机器建议 `system:user:create`，本批挂 **`system:user:edit`**。
   理由：重置口令是「改已存在用户」而非「新增用户」（079:270「新增用户」/079:271「编辑用户」）；
   两码持有角色集合完全相同（SUPER_ADMIN / OPERATION_ADMIN）⇒ **零回归论证不受影响**。列回执「待凌舟裁定项」。
   （另有 1 项**口径待裁定**：`DELETE /api/user-session/user/:userId` 台账判「自服务」，但语义是「撤销**他人**全部会话」，
   本批按台账口径不接；是否改判管理面挂 `system:user:edit` 由凌舟定。）

### 15.7 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. **`PUT /api/admin/sys-users/:id` 是「管理面接口承担自服务用途」的形态**：唯一调用点传的是本人 id（`profile.ts:26`），
   建议后续单立「本人资料」专用端点（或按 `req.user.id === :id` 自校验）后再补权限码——否则该端点永远无法挂管理面码。
2. **app-mobile 后台页入口无角色门**：`profile.vue` 的「门店管理」区块把「企业信息 / 员工管理 / 角色管理」写成**硬编码 list-item**，
   不经 `isPageVisible` ⇒ 任何登录用户都能进这三个页；这是本域 B 类 7 条的**共同根因**（同批 5/批 4 的门店管理与对账页形态）。
3. **`roles.ts` / `employees.ts` 存在零引用导出**：`setUserRoles`（`roles.ts:86`）等移动端封装无页面调用，
   与 `admin-web/src/api/system.ts:194/198`（`/admin/system/roles/:id/users`）一样属死代码——**前后端路径漂移**（后端无该子路径）。
4. `admin-web/src/api/system.ts:40-61` 的 4 个函数（`/admin/system/employees**`）**后端无此前缀**（实体是 `/api/admin/staff`），
   调用即 404；`common.ts:59`、`app-mobile sales-reports.vue:265` 打的是真实存在的 `GET /admin/staff`（只读，不影响本批）。
5. 用户会话的可达路径分裂：前端（admin-web 会话页、app-mobile 退出）打的是 `/api/admin/sessions**` 与 `/admin/auth/logout`，
   而 `user-session.routes.ts`（`/api/user-session**`）全仓 0 调用点 ⇒ 该文件可能是历史遗留，建议凌舟判定是否清理或纳入后续接线。

---

## 十六、S3-226 · **营销域（18 文件 / 89 写端点）**接线明细与守恒（2026-10-16）

> 派单卡：`docs/tasks/inbox/ACTIVE-S3-226.md`｜判定留档：`docs/evidence/S3-226/01-plan-and-judgements.md`
> 原始输出：`docs/evidence/S3-226/**`（调用面 `02-callers.txt`、门禁前后 `11/12`、反测 `25~29`、回归 `30~33`）
> 基线：开工时 `origin/main` = `ea29ee1f`（`git fetch` 因网络被重置失败，本地 `origin/main` 即该提交 ⇒ 见回执 §六.1）
> 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 `gaps` **415 条 / 118 文件**；`consumerEnd` 39 条不变）

### 15.1 起点与分桶（照派单卡 §一/§二，**先分桶再决定接不接**）

机读真值：本域 18 文件 / 写端点 **89 / 仍缺口 89**（与 §三.4 逐条一致，零偏移）。
派单卡 §一 的「语义不单一」警告**成立**：本域混装管理面、门店核销（`store-coupon`）与消费者行为（`community-marketing` 的 join/help/buy/pay）。

| 桶 | 条数 | 判据 | 处置 |
|:--|--:|:--|:--|
| ① 仅 admin-web 页面调用（`meta.roles` ⊆ {SUPER_ADMIN, OPERATION_ADMIN}） | 33 | `admin-web/src/router/index.ts` 角色 + `.vue` 调用点 | **接** |
| ② 全仓无有效调用点（含前端路径/方法错配 ⇒ 今天即 404） | 32 | `02-callers.txt` + `rg` 复核 | **接** |
| ③ app-mobile 写调用点且页面无门可达 / 孤岛页 / 菜单码不在生产菜单库 | 9 | `native/push.ts:107`、`home.vue:69-92`、`pages.json`、可见性对照表 | **不接（B）** |
| ④ app-mobile 写调用点且页面可见角色可枚举但 ⊄ 码持有人 | 14 | 生产菜单可见性 + 12 角色权限复算 | **不接（W）** |
| ⑤ 查询型 POST（service 只读不写） | 1 | `marketing-calculation.service.ts` 仅 SELECT | **不接（Q）** |
| **合计** | **89** | | **接 65 / 不接 24** |

### 15.2 本批已接 **65 条**（端点 / 落地码 / 真实使用者）

逐行清单（含 `pageRoles` 与 `page:文件:行` 依据）在
`backend/src/__tests__/routes/rbac-b2-s3-226-marketing-wiring.test.ts` 的 `ROWS`（65 行，机器复算）。

| # | 文件 | 已接条数 | 落地码 | 真实使用者依据（抽样，全量见测试 ROWS） |
|--:|:--|--:|:--|:--|
| 1 | `admin-marketing-coupon.routes.ts` | 3 | `marketing:create` | `CouponManage.vue:317/347/363`＋`MarketingView.vue:511/540`［SUPER_ADMIN］（router:227/:220） |
| 2 | `admin-marketing-full-reduction.routes.ts` | 2 | `marketing:create` | `FullReduction.vue:344/347`＋`MarketingView.vue:475`［SUPER_ADMIN］（router:229） |
| 3 | `admin-marketing-group-buy.routes.ts` | 6 | `marketing:create` | `MarketingView.vue:514/543`（activate/delete）；create/update/teams 全仓无调用点 |
| 4 | `admin-marketing-points.routes.ts` | 1 | `marketing:points` | `/points/rule` 全仓无调用点 |
| 5 | `admin-marketing-stack-rule.routes.ts` | 3 | `marketing:create` | 前端打 `/admin/marketing/promotions/stack-rules*`（后端无此前缀）⇒ 无有效调用点 |
| 6 | `marketing-asset.routes.ts` | 3 | `marketing:create` | 前端打 `/admin/marketing-assets*`（后端前缀 `/api/marketing-asset`）⇒ 无有效调用点 |
| 7 | `marketing-gift-rule.routes.ts` | 8 | `marketing:create` | `MarketingGiftRule.vue:277/289/433/436`（router:223）；另 5 条无调用点 |
| 8 | `marketing-limited-discount.routes.ts` | 7 | `marketing:create` | `MarketingLimitedDiscount.vue:327/329/351/482/485/488`（router:222） |
| 9 | `marketing-material.routes.ts` | 8 | `marketing:create` | `MarketingMaterial.vue:456/472/488/507/615/632`（router:226） |
| 10 | `marketing-points-mall.routes.ts` | 7 | `marketing:points` | `MarketingPointsMall.vue:342/352/451/454`（router:224）；兑换 3 条无调用点 |
| 11 | `points-mall.routes.ts` | 6 | `marketing:points` | 前端打 `/admin/points-mall/*`（后端前缀 `/api/points-mall`，方法亦错配）⇒ 无有效调用点 |
| 12 | `points.routes.ts` | 2 | `marketing:create` | `customer/PointsRules.vue:212/215`（router:149） |
| 13 | `retail-announcement.routes.ts` | 3 | `marketing:create` | 本前缀无有效调用点（admin-web 打的是 `/admin/retail-announcements`） |
| 14 | `retail-announcements-admin.routes.ts` | 3 | `marketing:create` | `instant-retail/RetailAnnouncement.vue:200/203/224/234`（router:189） |
| 15 | `seckill.routes.ts` | 3 | `marketing:create` | 前端打 `/admin/marketing/seckill*`（后端前缀 `/api/seckill`）⇒ 无有效调用点 |

**逐码分布**：`marketing:create` **55** ｜ `marketing:points` **10** = **65**。
两个码**都是仓库既有码**（`docs/migrations/079_权限矩阵.sql:215` BUTTON / `:165` MENU）⇒ **不新立权限点、不改角色种子、不动迁移**。

### 15.3 生产持有事实（本批判据起点，**先测再判**）

按生产只读底稿 `docs/evidence/_shared/prod-roles-20261016.txt`（租户 `default` 12 角色）与生产同一份 `matchPermission` 复算：
**`marketing:create` 与 `marketing:points` 的持有人都只有 `SUPER_ADMIN` / `OPERATION_ADMIN`（靠角色串 `"*"`）**，
12 角色中**没有任何角色显式持有 `marketing:*`**。
⇒ 判据只剩一种成立方式：**页面角色只含超管/运营**（或全仓无调用点）。凡页面可见角色含 `READONLY` / `STORE_ADMIN` /
店长 / 销售 / 客服的行，一律不接（批 1 `trace:*`、批 4 §12.4、S3-222 §12.6 同款形态）。

### 15.4 本批**未接** **1 条 · Q 类**（查询型 POST）

| 端点 | 理由 |
|:--|:--|
| `admin-marketing-calculation.routes.ts` POST `/api/admin/marketing/calculate` | `services/admin/marketing-calculation.service.ts` 的 `calculatePromotion` **只读不写**（仅 `queryOneWithTenant`/`queryWithTenant` 的 SELECT；`rg -in 'insert into\|delete from\|update \w+ set'` 零命中）⇒ 派单卡 §二.3「查询型 POST 不按写端点接」（同批 6 `POST /admin/quote-push/preview`） |

### 15.5 本批**未接** **9 条 · B 类**（app-mobile 写调用点落在**无权限门**的页 ⇒ 使用者集合不可枚举）

| # | 端点 | app-mobile 写调用点（证据） | 不可枚举的原因 |
|--:|:--|:--|:--|
| 1 | `admin-marketing-coupon.routes.ts` POST `/coupons/templates` | `create-coupon.vue:279` | 优惠券页有**无条件推送深链**（`native/push.ts:107` `marketing → …/coupons`） |
| 2 | 同上 POST `/coupons/templates/:id/pause` | `coupons.vue:147` | 同上 |
| 3–5 | `admin-marketing-full-reduction.routes.ts` POST `/:id/{activate,pause}`、DELETE `/:id` | `activities.vue:128/146/164` | 页面菜单码 `marketing:activities` 生产**不在菜单库**，仅靠前缀回退可见（可见性对照表 :143） |
| 6 | `admin-marketing-points.routes.ts` POST `/points/redeem` | `points-exchange.vue:88` | **孤岛页**（`pages.json:461` 注册、全仓无导航入口） |
| 7 | `points.routes.ts` POST `/:id/points/adjust` | `member-detail.vue:540` | 经首页快捷入口「会员管理」`home.vue:87`（**无条件**）→ 会员列表 → 详情 |
| 8–9 | `store-coupon.routes.ts` POST `/verify`、`/manual-verify` | `coupon-verify.vue:160/163` | 经优惠券页 `coupons.vue:132` 进入，而该页有**无条件推送深链** |
| — | **合计 9 条** = `admin-marketing-coupon` 2 ＋ `admin-marketing-full-reduction` 3 ＋ `admin-marketing-points` 1 ＋ `points.routes` 1（`points/adjust`） ＋ `store-coupon` 2 | 上表逐条 | — |

> **保守口径声明**：孤岛页 / 无门页「看得到按钮的角色」**可能为空**（H5 构建下页面 URL 仍可直达，静态扫描只能证明"仓库内无引用"）
> ⇒ 按「**无法证明不误伤则不动**」处理，零回归优先。若凌舟认定某页使用者集合为空，这些行可一键接线（码位方案见 §15.9-6）。

### 15.6 本批**未接** **14 条 · W 类**（待授权模型定案：页面可见角色 ⊄ 码持有人）

| # | 端点 | 页面（调用点） | 可见角色（生产菜单映射） | 为什么不接 |
|--:|:--|:--|:--|:--|
| 1 | `community-marketing.routes.ts` POST `/api/marketing/group-buy/:id/join` | `group-buy-detail.vue:221` | 菜单码 `marketing:group-buy` | 可见角色含 `READONLY`（`["*:view"]`）与 `STORE_ADMIN`（099 旧词表）——**均不持** `marketing:*` ⇒ 接线即 403 |
| 2 | 同上 POST `/api/marketing/bargain/:id/help` | `bargain-detail.vue:311/326` | 菜单码 `marketing:bargain` | 同上 |
| 3 | 同上 POST `/api/marketing/seckill/:orderNo/pay` | `seckill-detail.vue:281` | 菜单码 `marketing:seckill` | 同上 |
| 4 | `points.routes.ts` POST `/levels/config` | `level-config.vue:164` | 页面注册码 `customer:level`（`function-menu.ts:69`） | 可见角色含 **STORE_MANAGER / SALES_STAFF / CUSTOMER_SERVICE**（可见性对照表 :113-122），三类工作角色都不持 `marketing:*` ⇒ 接线即 403 |
| 5 | 同上 PUT `/levels/config/:id` | `level-config.vue:161` | 同上 | 同上 |
| 6 | 同上 PUT `/levels/config/:id/status` | `member-levels.vue:117` | 同上 | 同上 |

> 上表为**代表行**；W 类全量 **14 条** = `community-marketing.routes.ts` **全部 10 条**
> （group-buy join/start/end、bargain start/help/end、seckill buy/pay/cancel/end）＋`points.routes.ts` 会员等级 **4 条**
> （create / update / status / delete）。全量 24 条不接项的逐条登记见 `docs/evidence/S3-226/01-plan-and-judgements.md` §四。
> ⚠️ 口径分界：**经无门入口可达或菜单码零映射 ⇒ B（§15.5）；可见角色可枚举但 ⊄ 持有人 ⇒ W（本节）**。
> 三选一（补授权 / 收紧菜单授予面 / 另立细码）属**产品授权口径**，不在本单。

### 15.7 守恒与门禁（原始输出见 `docs/evidence/S3-226/`）

| 指标 | 本批前 | 本批后 | 说明 |
|:--|--:|--:|:--|
| 扫描写端点总数 | 763 | 763 | 未增删端点 |
| 已接线（权限码） | 244 | **309** | +65 = 本批接线数（`11-guard-after-wiring.txt`） |
| 无授权形态（缺口） | **480** | **415** | −65；分布文件数 129 → **118**（**11 个文件清零**） |
| 消费者端保护形态 | 39 | 39 | 不变（本批不涉） |
| 机读台账 `gaps` | 480 条 / 129 文件 | **415 条 / 118 文件** | `tools/update-baseline.mjs` 逐键移除 65 条（含前后计数与守恒断言） |
| `--strict` 退出码 | EXIT=0 | **EXIT=0** | 未登记 0 条、陈旧登记 0 条（`12-guard-strict-after.txt`） |
| 本域对账 | 机读缺口 89 | **89 = 65（已接）+ 9（B）+ 14（W）+ 1（Q）** | 一条不多、一条不少 |
| 跨批计数快照 | `rbac-g0-wiring.test.ts` 215 | **280** | 只同步"总数 + 逐文件计数"，G0 名单行一字未动 |

### 15.8 反测（门禁铁律：故意制造失败，证明它会红）

| 反测 | 注入 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| A 报告模式分辨力 | 摘掉 `points-mall.routes.ts:22` 的 `requirePermission("marketing:points")`（**行在文件中段，非首行**） | 已接线 **309 → 308**、缺口 **415 → 416**、缺口文件 **118 → 119** | `25-neg-report.txt` |
| B `--strict` 两侧 | 同上（**台账已先更新**，故该行属"未登记"） | **EXIT=1** 且点出 `❌ 未登记：points-mall.routes.ts:22 PUT /api/points-mall/orders/:id/deliver`；复原 ⇒ **EXIT=0** | `26-neg-strict.txt` / `29-neg-restored-strict.txt` |
| C 用例分辨力（vitest 侧） | 同上 | `rbac-b2-s3-226-marketing-wiring.test.ts`：**3 failed / 302 passed**（形状断言、READONLY⇒403、非持有人逐账号枚举）；复原 ⇒ **305 passed** | `27-neg-vitest-red.txt` |
| 逐字节还原 | 同一文件注入前后 | SHA256 一致（`F851C15F…9882F`），`git diff` 无残留 | `raw/25-hash-before-neg.txt` / `raw/28-hash-restored.txt` |
| 回归四道 | `npx vitest run` / `npx tsc --noEmit` / `npx eslint src --ext .ts` / 根 `npm run build` | **676 文件 / 9261 用例全绿** · tsc EXIT=0 · eslint 0 error · build EXIT=0 | `30/31/32/33-*.txt` |

> ⚠️ 反测 A/B 的**顺序很关键**：台账尚未移除本批 65 条时，摘掉接线只产生"**已登记**缺口"（`--strict` 仍 EXIT=0，仅计数提示），
> 属**假绿**；只有先跑 `update-baseline.mjs` 再注入，`--strict` 才会红。本单据此把 B 反测放在台账更新之后重做（两次读数都在证据目录）。
>
> 📄 证据目录口径说明：`raw/03-guard-json-mid.json` 是**中间读数**（当时按 66 条接线采的，含
> `POST /api/admin/marketing/calculate`——该行随后按 Q 类判定**撤回接线**）⇒ 最终读数以
> `raw/10-guard-json-after.json`（309 / 415 / 118）为准，`01/11/12` 文本读数亦为最终值。

### 15.9 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. **前端路径/方法错配 6 组**（本域 32 条"无有效调用点"的主因）：`stack-rules`（前端 `/admin/marketing/promotions/stack-rules*`）、
   `seckill`（`/admin/marketing/seckill*`）、`marketing-asset`（`/admin/marketing-assets*`）、
   `points-mall`（`/admin/points-mall/*`，且 `deliver` 前端 POST / 后端 PUT）、`calculate`（`/admin/marketing/promotions/calculate`）
   ⇒ 这些按钮**今天即 404**（同批 2 §13.7-1、批 5 §11.7-1 形态）。
2. **`points.routes.ts` 缺 `DELETE /api/admin/members/rules/:id`**：前端 `PointsRules.vue:230 deletePointsRule` 调用即 404。
3. **同域两套码**：`admin-marketing-flash-sale.routes.ts`（G1/批 6 接的 `sale:create`/`sale:edit`）与本批 `marketing:*` 并存；
   两者对超管/运营等价，`marketing:*` 更严（不含店长/收银员/销售）⇒ 是否统一**待裁定**。
4. **公告两套路由**：`retail-announcement.routes.ts`（`/api/retail-announcement/admin/...`，3 条无有效调用点）与
   `retail-announcements-admin.routes.ts`（`/api/admin/retail-announcements`，前端实际使用）服务同一业务。
5. **`community-marketing.routes.ts` 语义混装**（派单卡 §一 先验警告成立）：拼团/砍价/秒杀的 join/help/buy/pay/cancel 是**消费者行为**，
   却挂在**商家认证** `requireAuthWithTenant` 下（非 `requireConsumerAuthWithTenant` ⇒ 静态门禁看不见消费者端形态）。收编前须先定"主体是谁"。
6. **`t_sys_role_menu` 的角色×菜单矩阵缺证据**：底稿只给菜单**分布计数**（CATALOG 11 / MENU 78 / BUTTON 1）。
   本单 W/B 判定依据的是仓库内既有生产导出（`R101-总进度与推进计划.md:1610`、`R101-S3-136-F1-阿澈-可见性对照表.md`，均为**菜单 64 行时期**）；
   而菜单已 64 → **89** 行 ⇒ `marketing:*` 前缀"当时零持有"的结论**可能已变化**。
   请以生产只读复核 `SELECT r.role_code, m.menu_code FROM t_sys_role_menu rm JOIN t_sys_role r ON r.id=rm.role_id JOIN t_sys_menu m ON m.id=rm.menu_id ORDER BY 2,1;`；
   若这些菜单仍未授予任何工作角色，则本批 23 条 B/W 类可**批量接线**（码位方案见测试 `UNWIRED.note`）。

## 附·S3-227 · **门禁与判据改进批**（判据/用例变更，**零业务代码改动**）（2026-10-16）

> 依据：`docs/tasks/inbox/ACTIVE-S3-227.md`（派单卡）；执行：阿坚｜分支 `chore/s3-227-gate-semantics-and-counts`。
> ⚠️ 章节号用 **「附」** 不用正文章节号：正文 §十六 留给 **S3-226（营销域接线）** 顺延使用，避免两单抢号。

### 附.1 A —— 跨批接线数**删除裸数字断言**

`backend/src/__tests__/routes/rbac-g0-wiring.test.ts` 原有一条 `expect(total).toBe(226)`（裸数字），
它是跨批共享的**单点数字**：批 3⇒149、批 5⇒183、批 6⇒215、批 7⇒226 …… 每批都要改同一行，
两批并行时合并只能"取一侧" ⇒ 另一批的接线数被**静默抹掉且仍显示绿**（S3-225 亲历：被迫改 215→226）。

**处置**：删除该裸数字断言，保留**和式**（声明侧唯一总数来源），新增两条**台账一致性**断言：
① `requirePermission(` 实测出现次数 == 机读台账 `_counts.wiredPermOccurrences`（第二真值源）；
② `_counts` 自洽：缺口 + 消费者端 + 查询型 POST 登记 + 已接线 == 扫描总数。
「漏声明」仍由逐文件 map 断言 + `guard-rbac-wiring --strict` 共同兜住。

> 口径提示（两个"已接线数"不是同一个数）：门禁口径 `wiredEndpoints` = 255（authForm ∈ inline/use-mount 的**写端点**），
> 用例口径 `wiredPermOccurrences` = 226（`requirePermission(` 出现次数）；差 29 = 平台 `requirePlatformPermission` 端点 +32
> − 非写端点（GET 路由）上的出现次数 −3 + 被 `router.use` 一次覆盖多端点的差额 0。逐文件对照见
> `docs/evidence/S3-227/10-metric-diff.txt`。

### 附.2 B —— 消费者端**声明式**认证识别（`cart.routes.ts` 6 条 ⇒ `consumerEnd`）

**问题**：门禁只认**命令式**挂载形态（`requireConsumerAuthWithTenant` + `csrfMiddleware` 同行/同挂载），
扫不到 `routeConfig.auth` 的**声明式**消费者端认证 ⇒ `cart.routes.ts` 6 条写端点一直被记成「无授权形态」
（S3-224 卡 §三.3 另立本单的根因）。

**处置**：门禁现场解析 `backend/src/shared/auto-routes.ts` 的 `getAuthMiddlewares()`，得出「会被**成对**挂上
消费者认证 + `csrfMiddleware`」的 auth 取值；只按**声明的 router 变量**归类（`router` 与 `auth` 必须同对象），
**不按文件名白名单** —— 同文件里其它 router（如 `notification.routes.ts` 的 admin router）不受影响；
解析不到 ⇒ 集合为空 ⇒ 声明式一律**保守落回 `gaps`**。

**判定（6 条，与 S3-224 §14.6 / §14.10-1 的判定一致，本次只是把门禁补上）**：

| 端点 | 文件 | 形态 | 依据 |
|:--|:--|:--|:--|
| `POST /api/miniapp/cart/add` | `cart.routes.ts:14` | consumerEnd | `routeConfig.auth="requireConsumerAuthWithTenant"`；消费者 roles 恒空 ⇒ 不适用商家权限码（硬套即把小程序购物车打成 403，S3-203 `trace:*` 教训） |
| `PUT /api/miniapp/cart/items/:skuId` | `cart.routes.ts:15` | consumerEnd | 同上 |
| `DELETE /api/miniapp/cart/items/:skuId` | `cart.routes.ts:16` | consumerEnd | 同上 |
| `POST /api/miniapp/cart/clear` | `cart.routes.ts:17` | consumerEnd | 同上 |
| `POST /api/miniapp/cart/checkout/preview` | `cart.routes.ts:21` | consumerEnd | 同上（同时是查询型 POST，按 S3-224 判定归 consumerEnd，**不重复**登记进 C 表） |
| `POST /api/miniapp/cart/checkout/create` | `cart.routes.ts:22` | consumerEnd | 同上 |

### 附.3 C —— 查询型 POST **显式登记**（`READ_ONLY_POSTS`，3 条 ⇒ 不计缺口）

**问题**：`preview` / `best-price` / `check` 这类**不改数据**的 POST 被 method 判据当成写端点，
计入 `gaps` 与「需接线」，污染台账（批 3 / 批 6 / 批 7 各自手工对账过）。

**处置**：门禁新增具名登记表 `READ_ONLY_POSTS`（路径 + 理由 + 归属单 + 裁定依据）；命中者不计入 `gaps`，
但报告里**逐条打印**归属单 / 理由 / 裁定依据。**三道闸门防"登记即洗绿"**：
① 缺 `reason`/`ruling`/`batch` ⇒ 拒收；② 路径必须在**人读台账**（本文件）里找到「同一行含该路径 + 『查询型』」的判定 ⇒ 否则拒收；
③ 拒不生效 ⇒ 端点回落 `gaps`（新缺口随即 `--strict` 判红）；被拒/未生效/未命中均逐条提示。

| 端点 | 归属单 | 理由 | 裁定依据（本清单） |
|:--|:--|:--|:--|
| `POST /api/admin/prices/best-price` | S3-220 | 价格试算：入参取价条件、返回试算结果，不落库；全仓无页面调用点（`api/sale.ts:111 calcBestPrice` 未被使用） | §十二.6 P 类 #1 |
| `POST /api/admin/quote-push/preview` | S3-224 | 报价推送**预览**：只算推送内容与命中名单，不改数据 | §十四.6 Q 类 |
| `POST /api/admin/data-permissions/users/:userId/check` | S3-225 | 数据权限**判定**（只读）：返回命中判定，不写库 | §十五 ④ |

**明确不登记（维持 `gaps`）**：`POST /api/admin/prices/batch/preview` —— 本清单 §十二.6 P 类 #2 判定它属
「已知锁定（`requirePriceManagementAccess()` 角色白名单）」，**不是**"查询型"语义 ⇒ 不纳入本表。

**与 A 表不重叠**：`POST /api/miniapp/cart/checkout/preview` 虽是 preview，但按 S3-224 判定归 `consumerEnd`（附.2），
消费者端形态优先于只读分类（门禁对"已被更明确形态覆盖"的登记项逐条提示，不静默生效）。

### 附.4 守恒与门禁（原始输出见 `docs/evidence/S3-227/`）

| 读数 | 改前 | A 后 | B 后 | C 后（最终） |
|:--|--:|--:|--:|--:|
| 缺口 `gaps` / 文件 | 469 / 129 | 469 / 129 | 463 / 128 | **460 / 127** |
| 消费者端保护形态 / 文件 | 39 / 4 | 39 / 4 | 45 / 5 | 45 / 5 |
| 查询型 POST（已登记） | 0 | 0 | 0 | **3 / 3** |
| 已接线（门禁口径） | 255 | 255 | 255 | 255 |
| 扫描写端点总数 | 763 | 763 | 763 | 763 |
| `requirePermission(` 出现次数（用例口径） | 226 | 226 | 226 | 226 |

守恒：460 + 45 + 3 + 255 = **763** ✓（`_counts` 自洽断言在 `rbac-g0-wiring.test.ts`）。
门禁：`guard-rbac-wiring --strict` **EXIT=0**（未登记 0 / 陈旧 0）、其余 6 条既有门禁 EXIT=0、
`npx vitest run` **676 文件 / 9085 用例 / 0 failed**、`tsc --noEmit` **0**、`lint` **0 error**。
两侧反测齐（A 两条：改错常量 / 只改台账；B 四条：摘认证 / 换非消费者认证 / 搬到别文件 / 摘 csrf 成对；
C 两条：登记真写端点被拒 / 缺 ruling 被拒），全部逐字节复原。

### 附.5 卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. **其余"疑似查询型"POST 未登记**（本单只登记**已裁定**的 3 条，未裁定的不擅自扩表）：
   `POST /api/admin/marketing/calculate`（`admin-marketing-calculation.routes.ts`）、
   `POST /api/admin/alerts/check`、`POST /api/admin/trace/configs/check`、
   `POST /api/platform/billing/statement/export`、`POST /api/platform/reports/export/`、
   `POST /api/admin/reports/export`、`POST /api/admin/commission/calculate`（S3-223 §13.4 判"G0 范围控制锁定"）。
   ⇒ 若确认属只读/导出语义，可另立单逐条登记（本表已就位，登记成本 = 一条 reason/ruling + 台账一行）。
2. **跨批声明的"共享行"仍有 3 处**（和式一行 + 逐文件 map 的 spread 一行 + 期望 map 的循环一行）：
   本单只删了裸数字；若要做到"每批只动自己的常量块"，需把 15 个批次块改成自注册式（改动面较大，
   且当前 3 批并行在改同一文件）⇒ 建议另立单，本单不擅自动。
3. `guard-rbac-wiring` 仍是**报告器（未接 CI）**；分类变更（B/C）不改"是否阻断"的口径，
   接 CI 的前置条件（缺口清零或逐条登记完毕）未变。
4. `_counts` 与实时扫描的一致性**只提示不判红**（本轮新增读数），是否升级为 `--strict` 判红未获授权 ⇒ 待裁。

---

## 十七、S3-229 · **门店/租户域（8 文件 / 31 写端点缺口）＋ 营销域 W 类（2 文件 / 14 条）**接线明细与守恒（2026-10-16）

> 派单卡：`docs/tasks/inbox/ACTIVE-S3-229.md`｜执行：阿坚（后端 / 权限）｜分支 `feat/s3-229-store-and-marketing-wiring`｜基线 `63ee9775`
> 判定留档：`docs/evidence/S3-229/01-plan-and-judgements.md`｜原始输出：`docs/evidence/S3-229/**`（门禁起点 = `raw/02-guard-json-before.json` ＋ `01-guard-before-tail.txt` / `03-guard-strict-before.txt`；终点 = `raw/10-guard-json-after.json` / `12-guard-strict-after.txt`；调用面 `02-callers.txt`、封装未用 `03-unused-wrappers.txt`、反测 `25~29`、回归 `30~34`）
> 机读台账：`backend/scripts/rbac-wiring-baseline.json`（本批后 `gaps` **378 条 / 113 文件**；`consumerEnd` 45 条不变）

### 17.1 起点（机器真值，与 §二 台账口径逐字吻合）

| 域 | 文件 | 写端点 | 已接线 | 缺口 |
|:--|--:|--:|--:|--:|
| G1 门店/租户域 | 8 | 33 | 2（储值卡 consume/refund） | **31** = 17 管理面 + 2 公开 + 12 平台域 |
| G2 营销域·W 类 | 2 | 17 | 3 | **14** |

### 17.2 本批已接 **17 条**（端点 / 落地码 / 真实使用者）

| # | 文件:行 | 端点 | 落地码 | 使用者依据 |
|--:|:--|:--|:--|:--|
| 1 | `demo.routes.ts:9` | POST `/api/admin/demo/seed` | `store:create` | `LoginView.vue:257` 演示登录（账号 `admin` = SUPER_ADMIN） |
| 2 | `demo.routes.ts:10` | POST `/api/admin/demo/reset` | `store:create` | 六端全仓无有效调用点 |
| 3 | `store-control.routes.ts:22` | PUT `/configs/:storeId` | `store:edit` | 封装 `api/inventory.ts:130` 零 `.vue` 引用 |
| 4–7 | `store-control.routes.ts:23-26` | POST `/:storeId/{open,close,suspend,resume}` | `store:create` ×4 | 同上（`:134/138/142/146`） |
| 8–17 | `community-marketing.routes.ts:26-48` | 拼团 join/start/end、砍价 start/help/end、秒杀 buy/pay/cancel/end | `marketing:create` ×10 | 菜单 `marketing:group-buy|bargain|seckill` 只授予 `OPERATION_ADMIN`(0 账号)/`READONLY`(观察员)/`STORE_ADMIN`(0 账号) ⇒ 无在用写角色 |

**逐码分布**：`store:create` 7 ｜ `store:edit` 2 ｜ `marketing:create` 10 = **17**。
三个码**都是仓库既有码**（`079_权限矩阵.sql` 目录 + `middleware/rbac-auth.ts`）⇒ **不新立权限点、不改角色种子、不动迁移**。

### 17.3 本批**未接** —— G1 24 条（逐条理由）

| 类 | 条数 | 端点 | 理由 |
|:--|--:|:--|:--|
| **B**（使用者集合不可枚举） | 8 | `admin-store` POST/PUT `/stores`；`store-value-card` POST `/`、`/recharge`、`/freeze`、`/unfreeze`；`store.routes` POST `/api/store/members/manage`、PUT `/api/store/members/:id` | 写调用点全在 app-mobile「会员管理」链路（`member-detail.vue:534/536/621/627`）与「门店建档」（`store-edit.vue:218/220`），二者入口**无条件**（`home.vue:87` 快捷入口；`profile.vue` 我的页硬编码「门店管理」）⇒ 页面对任意登录角色可达而当前无权限门（D4：先补门再收编） |
| **平台侧** | 2 | `tenant-register` POST `/api/tenant/applications/:id/{approve,reject}` | 该文件对 `/applications` 段统一挂 `requirePlatformAuth`（:25），调用方 = 平台控制台 `saas-admin/src/api/tenant-application.ts:50/54`；台账建议码 `store:create` **无效**（平台 JWT 不带商家 roles）⇒ 归平台侧单（建议 `requirePlatformPermission("tenant:manage")`） |
| **公开端点** | 2 | `tenant-register` POST `/register`、`/register/sms-code` | `routeConfig.auth = "none"` 免鉴权（既判，挂商家码无意义） |
| **平台域** | 12 | `subscription.routes.ts` 8 条 + `tenant.routes.ts` 4 条（`/api/platform/*-management/*`） | 卡片明示「平台侧归 S3-219 体系，不在本单」；走 `requirePlatformAuth` + 平台权限点机制 |

对账：**31 = 7（已接）+ 8（B）+ 2（平台侧）+ 2（公开）+ 12（平台域）** —— 一条不多、一条不少。

### 17.4 本批**未接** —— G2 4 条 · W 类（逐条；**D2 前提不成立**）

| 端点 | 页面 / 注册码 | 在用可见角色 | 为什么不接 |
|:--|:--|:--|:--|
| `points.routes.ts:24` POST `/levels/config` | `level-config.vue:164` / `customer:level` | **`STORE_MANAGER`（1 账号）** | 店长可见该页但**不持** `marketing:create` ⇒ 接线即 403（违反不变量 I1） |
| `points.routes.ts:25` PUT `/levels/config/:id` | `level-config.vue:161` | 同上 | 同上 |
| `points.routes.ts:26` PUT `/levels/config/:id/status` | `member-levels.vue:117` | 同上 | 同上 |
| `points.routes.ts:27` DELETE `/levels/config/:id` | `member-levels.ts:66` | 同上 | 同上 |

⚠️ **与派单卡 §一 G2 的差异（待凌舟裁定）**：卡面「W 类 14 条按 D2 接线」的前提是「可见角色 = OPERATION_ADMIN/READONLY/STORE_ADMIN」；
这 4 条页面码为 **`customer:level`**，可见角色含**在用**的 `STORE_MANAGER`（依据见 §4.2）⇒ 本单按 W 类**登记不接**。
三选一（改挂 `customer:level` / 给店长补 `marketing:create` / 前端补门）属授权口径，不在本单。
对账：**14 = 10（已接）+ 4（W 不接）**。

### 17.5 守恒与门禁（原始输出见 `docs/evidence/S3-229/`）

| 指标 | 本批前 | 本批后 | 说明 |
|:--|--:|--:|:--|
| 扫描写端点总数 | 763 | 763 | 未增删端点 |
| 已接线（权限码） | 320 | **337** | +17 = 本批接线数（`10-guard-json-after.json`） |
| 无授权形态（缺口） | **395**（116 文件） | **378**（113 文件） | −17；3 个文件清零（demo / store-control / community-marketing） |
| 消费者端保护形态 | 45 | 45 | 不变 |
| 查询型 POST 登记 | 3 | 3 | 不变 |
| 机读台账 `gaps` | 395 条 / 116 文件 | **378 条 / 113 文件** | `tools/update-baseline.mjs` 逐键移除 17 条（含前后计数与守恒断言）；`wiredPermOccurrences` 291 → 308 |
| `--strict` 退出码 | EXIT=0 | **EXIT=0** | 未登记 0 条、陈旧登记 0 条（`12-guard-strict-after.txt`） |
| 跨批计数快照 | `rbac-g0-wiring.test.ts` 291 | **308** | 只新增 `S3_229_WIRED_FILES` 常量块并把 `S3_229_WIRED_TOTAL` 纳入和式；G0 名单行一字未动 |

### 17.6 反测（门禁铁律；顺序照 `docs/tasks/派单规范.md` §九.1）

| 反测 | 注入 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| A 报告模式分辨力 | 摘掉 `community-marketing.routes.ts:46` 的 `requirePermission("marketing:create")`（**行在文件中段**） | 已接线 **337 → 336**、缺口 **378 → 379**（113 → 114 文件） | `25-neg-report.txt` |
| B `--strict` 两侧 | 同上（**台账已先更新**，故该行属"未登记"） | **EXIT=1** 且点名 `❌ 未登记：community-marketing.routes.ts:46 POST /api/marketing/seckill/:orderNo/pay`；复原 ⇒ **EXIT=0** | `26-neg-strict.txt` / `29-neg-restored-strict.txt` |
| C 用例分辨力（vitest） | 同上 | `rbac-b2-s3-229-store-and-marketing-wiring.test.ts`：**5 failed / 117 passed**；复原 ⇒ **122 passed** | `27-neg-vitest-red.txt` |
| 逐字节还原 | 同一文件注入前后 | SHA256 一致（`D8AE118A…4F72B`） | `raw/24-hash-before-neg.txt` / `raw/28-hash-restored.txt` |
| 回归四道 | `npx vitest run` / `npx tsc --noEmit` / `npx eslint src --ext .ts` / 根 `npm run build` | 全绿（vitest 0 failed · tsc EXIT=0 · eslint 0 error · build EXIT=0） | `30/31/32/33-*.txt` |

### 17.7 与 §三.7「建议权限码」的差异（**1 处，逐条理由**）

| 端点 | §三.7 建议码 | 本批落地 | 理由 |
|:--|:--|:--|:--|
| `tenant-register` POST `/api/tenant/applications/:id/{approve,reject}` | `store:create` | **不接（平台侧）** | 该端点由 `requirePlatformAuth` 认证、调用方是平台控制台；平台 JWT 不带商家 `roles`，挂商家码会把唯一平台管理员打成 403（`middleware/rbac-auth.ts` 的 `checkUserPermission` 走 `t_sys_role`）⇒ 码位只能取平台侧机制 |

### 17.8 卡外观察（**只登记不动手**）

1. **我的页「门店管理」为硬编码无条件入口**（`app-mobile/src/pages/profile/profile.vue`：企业信息 / 员工管理 / 角色管理三项无码过滤，同 S3-125 记录的 `profile.vue:42`）⇒ 门店建档、员工、角色三页对**任意登录角色**可达，是 §17.3 B 类 8 条的根因；属 D4 前端权限门单（S3-230）覆盖范围。
2. **S3-226 用例随状态变更同步**：`rbac-b2-s3-226-marketing-wiring.test.ts` 原把 community-marketing 10 条件为「未接（W）」；本批按 D2 接线后必须同步（`UNWIRED_CLASS_TOTAL` W 14 → 4，并从"本批 0 接线文件"名单移除该文件）⇒ 已同步并加「状态变更登记」用例；其 65 条已接行与 G0 名单断言**未动**。
3. **S3-119 限流门禁判据可被注释误触发**：`backend/src/__tests__/shared/route-test-rate-limit.test.ts` 的 `MOUNTS_AUTH` 正则跑在**未剥注释**的源码上 —— 测试文件里写一句含 `router.use(… requirePlatformAuth …)` 的**注释**即被判为"自建 app + 挂真实鉴权"（本单新增文件实测命中一次，已改写注释措辞规避）。建议后续改为剥注释匹配（本单只登记）。
4. **`/api/tenant/applications/*` 与 `/api/platform/applications/*` 同业务双前缀**（`platform-applications.routes.ts` PUT approve/reject 与本域 POST 版）⇒ 平台侧单建议一并收编。
5. **`customer:level` 菜单授予未经生产复扫**：共用底稿只覆盖营销前缀菜单；本单 §17.4 的判定依据是仓库内生产导出（S3-143 落地后「表 B」，8 角色 × 44 页逐格一致）⇒ 建议按 R-PROD-READ 补扫 `SELECT r.role_code, m.menu_code FROM t_sys_role_menu rm JOIN t_sys_role r ON r.id=rm.role_id JOIN t_sys_menu m ON m.id=rm.menu_id WHERE m.menu_code='customer:level';`（S3-226 §15.9-6 已提同一请求）。
