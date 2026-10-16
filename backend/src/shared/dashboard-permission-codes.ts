/**
 * S3-236（立码第二批）：工作台 / 待办消息域（S3-236 · 8 码）的**唯一出处**
 *
 * 一、本文件是什么（形态照抄先例）
 *   本仓口径：**目录走代码常量、迁移只做数据登记**（先例 `system-permission-codes.ts`（S3-232 D6）、
 *   `goods-permission-codes.ts` / `sale-permission-codes.ts` / `library-permission-codes.ts`）。
 *   本批为四域各建一个 per-域常量文件，再由 `batch2-permission-codes.ts` 汇总（断言只认汇总文件）。
 *
 * 二、码表来源（**照抄，禁止自拟**）
 *   `docs/tasks/R101-待立码清单-五域.md` §二 —— 模块码取 079 既有模块码 `dashboard`（工作台）；`wb-notifications` 3 条自服务不立码（与 `/api/admin/notifications/*` 不是同一组端点，勿混一码）
 *
 * 三、本批**不接任何业务路由**（`backend/src/routes/**` 零改动）：只立码本身，
 *   即「目录 + 迁移 207 + 断言 + 前端入口登记」；接线留给后续批次。
 *
 * 四、持有者口径：本批**默认不给任何角色发码**（同 S3-232 裁定）；如需发给某在用角色，
 *   只登记并在回传卡请凌舟裁，**不得自行发码**。
 */
import { defineBatch2Entry, type Batch2PermissionEntry } from "./batch2-entry";

/** 工作台 / 待办消息域（S3-236 · 8 码） —— 码表来源：`docs/tasks/R101-待立码清单-五域.md` §二 */
export const DASHBOARD_PERMISSION_CATALOG: ReadonlyArray<Batch2PermissionEntry> = [
  defineBatch2Entry({
    code: "dashboard:todo:create",
    module: "dashboard",
    name: "新建待办",
    action: "create",
    routeFile: "workbench.routes.ts",
    endpoints: ["POST /api/admin/todos"],
    callPatterns: ["POST /api/admin/todos"],
    requestPatterns: ["POST /admin/todos"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/dashboard/TodoList.vue:324（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "dashboard:todo:complete",
    module: "dashboard",
    name: "完成待办",
    action: "complete",
    routeFile: "workbench.routes.ts",
    endpoints: ["PUT /api/admin/todos/:id/complete"],
    callPatterns: ["PUT /api/admin/todos/:id/complete"],
    requestPatterns: ["PUT /admin/todos/:id/complete"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/dashboard/TodoList.vue:260（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "dashboard:todo:dismiss",
    module: "dashboard",
    name: "忽略待办",
    action: "dismiss",
    routeFile: "workbench.routes.ts",
    endpoints: ["PUT /api/admin/todos/:id/dismiss"],
    callPatterns: ["PUT /api/admin/todos/:id/dismiss"],
    requestPatterns: ["PUT /admin/todos/:id/dismiss"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/dashboard/TodoList.vue:269（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "dashboard:todo:delete",
    module: "dashboard",
    name: "删除待办",
    action: "delete",
    routeFile: "workbench.routes.ts",
    endpoints: ["DELETE /api/admin/todos/:id"],
    callPatterns: ["DELETE /api/admin/todos/:id"],
    requestPatterns: ["DELETE /admin/todos/:id"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/dashboard/TodoList.vue:278（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "dashboard:quick-entry:create",
    module: "dashboard",
    name: "新建快捷入口",
    action: "create",
    routeFile: "workbench.routes.ts",
    endpoints: ["POST /api/admin/quick-entries"],
    callPatterns: ["POST /api/admin/quick-entries"],
    requestPatterns: ["POST /admin/quick-entries"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/dashboard/QuickEntryConfig.vue:274（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "dashboard:quick-entry:sort",
    module: "dashboard",
    name: "调整快捷入口排序",
    action: "sort",
    routeFile: "workbench.routes.ts",
    endpoints: ["PUT /api/admin/quick-entries/sort"],
    callPatterns: ["PUT /api/admin/quick-entries/sort"],
    requestPatterns: ["PUT /admin/quick-entries/sort"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/dashboard/QuickEntryConfig.vue:308（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "dashboard:quick-entry:edit",
    module: "dashboard",
    name: "编辑快捷入口",
    action: "edit",
    routeFile: "workbench.routes.ts",
    endpoints: ["PUT /api/admin/quick-entries/:id"],
    callPatterns: ["PUT /api/admin/quick-entries/:id"],
    requestPatterns: ["PUT /admin/quick-entries/:id"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/dashboard/QuickEntryConfig.vue:265（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "dashboard:quick-entry:delete",
    module: "dashboard",
    name: "删除快捷入口",
    action: "delete",
    routeFile: "workbench.routes.ts",
    endpoints: ["DELETE /api/admin/quick-entries/:id"],
    callPatterns: ["DELETE /api/admin/quick-entries/:id"],
    requestPatterns: ["DELETE /admin/quick-entries/:id"],
    menuParent: "system",
    frontendEntry: "admin-web/src/views/dashboard/QuickEntryConfig.vue:296（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
];

/** 工作台 / 待办消息域（S3-236 · 8 码）的码名（顺序同目录） */
export const DASHBOARD_PERMISSION_CODES: ReadonlyArray<string> = DASHBOARD_PERMISSION_CATALOG.map((e) => e.code);

/** 工作台 / 待办消息域（S3-236 · 8 码）的条数 */
export const DASHBOARD_PERMISSION_COUNT = DASHBOARD_PERMISSION_CATALOG.length;
