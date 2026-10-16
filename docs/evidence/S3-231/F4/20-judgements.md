# S3-231 F4 · 7 条「疑似查询型 POST」逐条裁定

> 派单卡 §F4｜判据：逐条给「端点 + 该 service 是否写库 + 结论」三列；可登记 ⇒ 写进 `READ_ONLY_POSTS`；不可登记 ⇒ 留在 `gaps` 按真写端点处理。
> 登记落点：`backend/scripts/guard-rbac-wiring.mjs` 的 `READ_ONLY_POSTS`（3 条）+ 人读台账 `docs/tasks/R101-RBAC接线缺口清单.md` §18.3 的「查询型」判定行。

## 一、逐条裁定（7 条）

| # | 端点 | handler → service | 该 service 是否写库 | 结论 |
|--:|:--|:--|:--|:--|
| 1 | `POST /api/admin/marketing/calculate` | `admin-marketing-calculation.routes.ts:14` → `marketing-calculation.service.ts:calculatePromotion` | **否**（仅 `queryOneWithTenant`/`queryWithTenant` 的 SELECT） | **可登记**（查询型 POST） |
| 2 | `POST /api/admin/alerts/check` | `alert.routes.ts:13` → `alert.service.ts:runAllAlertChecks` | **是**（5 个 `check*Alerts` 各含 `INSERT INTO t_alert_record`） | **不可登记**（有写）⇒ 留 `gaps` |
| 3 | `POST /api/admin/trace/configs/check` | `trace.routes.ts:26` → `trace-config.service.ts:checkSkuTrace` | **否**（SKU → 分类 → 全局三级 `SELECT t_trace_config`） | **可登记**（查询型 POST） |
| 4 | `POST /api/platform/billing/statement/export` | `platform-billing.routes.ts:31` → `platform-billing.service.ts:listDailyReconciliationsForExport` | **否**（`SELECT ... FROM t_platform_reconciliation` 后 `sendCsv`） | **可登记**（查询型 POST） |
| 5 | `POST /api/platform/reports/export/` | `platform-export-task.routes.ts` → `platform-export-task.service.ts:createExportTask` | **是**（创建任务，落 PENDING） | **不可登记**（有写）⇒ 留 `gaps` |
| 6 | `POST /api/admin/reports/export` | `report.routes.ts:58` → `report-export.service.ts:exportReport` | **否**（`queryWithTenant` 取数 + 内存 `generateCsv`/`generateExcel`；`>10000` 分支只返回提示文案） | **可登记**（查询型 POST） |
| 7 | `POST /api/admin/commission/calculate` | `commission.routes.ts:22` → `commission.service.ts:calculateCommissions` | **是**（`INSERT INTO t_sales_commission_record`，幂等先查后插） | **不可登记**（有写；且 `rbac-g0-wiring.test.ts:865` 的 NOT_IN_G0 已锁 READONLY 仍 200） |

**对账**：**7 = 4（可登记）+ 3（不可登记）**，一条不多、一条不少。

## 二、1 处需要额外说明的口径（易误判）

`POST /api/platform/reports/export/` 的**字面末段是 `export`**（易被读成"导出=只读"），但它在
`platform-export-task.routes.ts` 里是**任务中心**的"**创建任务**"端点（服务层 `createExportTask` 落库 PENDING）
⇒ 判为**写**、不登记。其**只读孪生**是列表 `GET /api/platform/reports/export`（GET，不在门禁扫描面内）。

## 三、登记三道闸门（S3-227 C，已实测）

可登记的 3 条同时满足：① `READ_ONLY_POSTS` 里有 `batch`/`reason`/`ruling`；
② 人读台账 §18.3 有「同一行同时含该路径 + 『查询型』」的判定行（已逐条核对 L2846/L3170/L3171）；
③ 缺任一 ⇒ 端点回落 `gaps`、`--strict` 判红。

**反测记录**（原始输出见本目录）：

- `26-neg-ledger-strict.txt`：把台账里 `trace/configs/check` 两行的「查询型」字样去掉 ⇒
  `❌ 登记被拒：… 人读台账里找不到「同一行同时含该路径 + 『查询型』」的判定 ⇒ 拒收` +
  `❌ 未登记：trace.routes.ts:26` + `--strict` **EXIT=1**；复原 ⇒ EXIT=0（台账 SHA256 一致）。
