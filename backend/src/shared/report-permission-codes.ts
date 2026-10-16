/**
 * S3-236（立码第二批）：报表域（S3-236 · 11 码）的**唯一出处**
 *
 * 一、本文件是什么（形态照抄先例）
 *   本仓口径：**目录走代码常量、迁移只做数据登记**（先例 `system-permission-codes.ts`（S3-232 D6）、
 *   `goods-permission-codes.ts` / `sale-permission-codes.ts` / `library-permission-codes.ts`）。
 *   本批为四域各建一个 per-域常量文件，再由 `batch2-permission-codes.ts` 汇总（断言只认汇总文件）。
 *
 * 二、码表来源（**照抄，禁止自拟**）
 *   `docs/tasks/R101-待立码清单-五域.md` §二 —— 粒度口径 = 语义粒度：4 条报表权限端点共用 `report:permission:edit` 一码（卡 §一 裁定，不按端点拆）
 *
 * 三、本批**不接任何业务路由**（`backend/src/routes/**` 零改动）：只立码本身，
 *   即「目录 + 迁移 207 + 断言 + 前端入口登记」；接线留给后续批次。
 *
 * 四、持有者口径：本批**默认不给任何角色发码**（同 S3-232 裁定）；如需发给某在用角色，
 *   只登记并在回传卡请凌舟裁，**不得自行发码**。
 */
import { defineBatch2Entry, type Batch2PermissionEntry } from "./batch2-entry";

/** 报表域（S3-236 · 11 码） —— 码表来源：`docs/tasks/R101-待立码清单-五域.md` §二 */
export const REPORT_PERMISSION_CATALOG: ReadonlyArray<Batch2PermissionEntry> = [
  defineBatch2Entry({
    code: "report:custom:create",
    module: "report",
    name: "新建自定义报表",
    action: "create",
    routeFile: "custom-report-v2.routes.ts",
    routeFiles: ["custom-report-v2.routes.ts", "custom-report.routes.ts"],
    endpoints: ["POST /api/admin/reports/", "POST /api/custom-report/templates"],
    callPatterns: ["POST /api/admin/reports/", "POST /api/custom-report/templates"],
    requestPatterns: ["POST /admin/reports/", "POST /custom-report/templates"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:240（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:custom:edit",
    module: "report",
    name: "编辑自定义报表",
    action: "edit",
    routeFile: "custom-report-v2.routes.ts",
    routeFiles: ["custom-report-v2.routes.ts", "custom-report.routes.ts"],
    endpoints: ["PUT /api/admin/reports/#id#", "PUT /api/custom-report/templates/:id"],
    callPatterns: ["PUT /api/admin/reports/:id", "PUT /api/custom-report/templates/:id"],
    requestPatterns: ["PUT /admin/reports/:id", "PUT /custom-report/templates/:id"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:241（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:custom:delete",
    module: "report",
    name: "删除自定义报表",
    action: "delete",
    routeFile: "custom-report-v2.routes.ts",
    routeFiles: ["custom-report-v2.routes.ts", "custom-report.routes.ts"],
    endpoints: ["DELETE /api/admin/reports/#id#", "DELETE /api/custom-report/templates/:id"],
    callPatterns: ["DELETE /api/admin/reports/:id", "DELETE /api/custom-report/templates/:id"],
    requestPatterns: ["DELETE /admin/reports/:id", "DELETE /custom-report/templates/:id"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:242（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:custom:generate",
    module: "report",
    name: "生成自定义报表",
    action: "generate",
    routeFile: "custom-report-v2.routes.ts",
    routeFiles: ["custom-report-v2.routes.ts", "custom-report.routes.ts"],
    endpoints: ["POST /api/admin/reports/#id#/generate", "POST /api/custom-report/templates/:id/execute"],
    callPatterns: ["POST /api/admin/reports/:id/generate", "POST /api/custom-report/templates/:id/execute"],
    requestPatterns: ["POST /admin/reports/:id/generate", "POST /custom-report/templates/:id/execute"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:243（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:schedule:create",
    module: "report",
    name: "新建报表定时任务",
    action: "create",
    routeFile: "custom-report.routes.ts",
    endpoints: ["POST /api/custom-report/schedules"],
    callPatterns: ["POST /api/custom-report/schedules"],
    requestPatterns: ["POST /custom-report/schedules"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:245（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:schedule:edit",
    module: "report",
    name: "编辑报表定时任务",
    action: "edit",
    routeFile: "custom-report.routes.ts",
    endpoints: ["PUT /api/custom-report/schedules/:id"],
    callPatterns: ["PUT /api/custom-report/schedules/:id"],
    requestPatterns: ["PUT /custom-report/schedules/:id"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:246（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:schedule:delete",
    module: "report",
    name: "删除报表定时任务",
    action: "delete",
    routeFile: "custom-report.routes.ts",
    endpoints: ["DELETE /api/custom-report/schedules/:id"],
    callPatterns: ["DELETE /api/custom-report/schedules/:id"],
    requestPatterns: ["DELETE /custom-report/schedules/:id"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:247（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:schedule:toggle",
    module: "report",
    name: "启停报表定时任务",
    action: "toggle",
    routeFile: "custom-report.routes.ts",
    endpoints: ["PUT /api/custom-report/schedules/:id/toggle"],
    callPatterns: ["PUT /api/custom-report/schedules/:id/toggle"],
    requestPatterns: ["PUT /custom-report/schedules/:id/toggle"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:248（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:schedule:run",
    module: "report",
    name: "手动执行报表定时任务",
    action: "run",
    routeFile: "custom-report.routes.ts",
    endpoints: ["POST /api/custom-report/schedules/:id/run"],
    callPatterns: ["POST /api/custom-report/schedules/:id/run"],
    requestPatterns: ["POST /custom-report/schedules/:id/run"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:249（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:permission:edit",
    module: "report",
    name: "维护报表权限",
    action: "edit",
    routeFile: "report-permissions.routes.ts",
    endpoints: ["PUT /api/admin/report-permissions/matrix", "PUT /api/admin/report-permissions/data-scope", "POST /api/admin/report-permissions/batch", "PUT /api/admin/report-permissions/user/:userId"],
    callPatterns: ["PUT /api/admin/report-permissions/matrix", "PUT /api/admin/report-permissions/data-scope", "POST /api/admin/report-permissions/batch", "PUT /api/admin/report-permissions/user/:userId"],
    requestPatterns: ["PUT /admin/report-permissions/matrix", "PUT /admin/report-permissions/data-scope", "POST /admin/report-permissions/batch", "PUT /admin/report-permissions/user/:userId"],
    menuParent: "report",
    frontendEntry: "admin-web/src/api/report.ts:231 / app-mobile/src/api/modules/report-permission.ts:179 / app-mobile/src/api/modules/report-permission.ts:196 / app-mobile/src/api/modules/report-permission.ts:220 / app-mobile/src/api/modules/report-permission.ts:290（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "report:export",
    module: "report",
    name: "导出报表",
    action: "export",
    routeFile: "report.routes.ts",
    endpoints: ["POST /api/admin/reports/export"],
    callPatterns: ["POST /api/admin/reports/export"],
    requestPatterns: ["POST /admin/reports/export"],
    menuParent: "report",
    frontendEntry: "app-mobile/src/api/modules/reports.ts:346（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
];

/** 报表域（S3-236 · 11 码）的码名（顺序同目录） */
export const REPORT_PERMISSION_CODES: ReadonlyArray<string> = REPORT_PERMISSION_CATALOG.map((e) => e.code);

/** 报表域（S3-236 · 11 码）的条数 */
export const REPORT_PERMISSION_COUNT = REPORT_PERMISSION_CATALOG.length;
