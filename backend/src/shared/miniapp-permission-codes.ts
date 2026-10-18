/**
 * S3-236（立码第二批）：小程序 / 移动端域（S3-236 · 5 码）的**唯一出处**
 *
 * 一、本文件是什么（形态照抄先例）
 *   本仓口径：**目录走代码常量、迁移只做数据登记**（先例 `system-permission-codes.ts`（S3-232 D6）、
 *   `goods-permission-codes.ts` / `sale-permission-codes.ts` / `library-permission-codes.ts`）。
 *   本批为四域各建一个 per-域常量文件，再由 `batch2-permission-codes.ts` 汇总（断言只认汇总文件）。
 *
 * 二、码表来源（**照抄，禁止自拟**）
 *   `docs/tasks/R101-待立码清单-五域.md` §二 —— 消费者端 33 条不立商家码（S3-205 §10.3 改判）；`miniapp:wechat:decrypt-phone` 按卡 §三 裁定**本批不立码**（另立小单定门禁判据）。模块码取 079 既有码族 miniapp（079 角色种子的 CUSTOMER_SERVICE 已用 miniapp:*）；⚠️ 079 里**没有** `miniapp` CATALOG 行 ⇒ 父行按「必须存在、不得插孤儿行」的口径挂 `system` CATALOG（见迁移 207 §四）
 *
 * 三、本批**不接任何业务路由**（`backend/src/routes/**` 零改动）：只立码本身，
 *   即「目录 + 迁移 207 + 断言 + 前端入口登记」；接线留给后续批次。
 *
 * 四、持有者口径：本批**默认不给任何角色发码**（同 S3-232 裁定）；如需发给某在用角色，
 *   只登记并在回传卡请凌舟裁，**不得自行发码**。
 */
import { defineBatch2Entry, type Batch2PermissionEntry } from "./batch2-entry";

/** 小程序 / 移动端域（S3-236 · 5 码） —— 码表来源：`docs/tasks/R101-待立码清单-五域.md` §二 */
export const MINIAPP_PERMISSION_CATALOG: ReadonlyArray<Batch2PermissionEntry> = [
  defineBatch2Entry({
    code: "miniapp:config:edit",
    module: "miniapp",
    name: "编辑小程序配置",
    action: "edit",
    routeFile: "miniapp-config.routes.ts",
    endpoints: ["PUT /api/miniapp-config/configs/:platform"],
    callPatterns: ["PUT /api/miniapp-config/configs/:platform"],
    requestPatterns: ["PUT /miniapp-config/configs/:platform"],
    menuParent: "system",
    frontendEntry: "admin-web/src/api/instant-retail.ts:237（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "miniapp:package:upload-key",
    module: "miniapp",
    name: "上传小程序密钥",
    action: "upload-key",
    routeFile: "miniapp-config.routes.ts",
    endpoints: ["POST /api/miniapp-config/upload-key"],
    callPatterns: ["POST /api/miniapp-config/upload-key"],
    requestPatterns: ["POST /miniapp-config/upload-key"],
    menuParent: "system",
    frontendEntry: "admin-web/src/api/instant-retail.ts:253（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "miniapp:package:build",
    module: "miniapp",
    name: "构建小程序包",
    action: "build",
    routeFile: "miniapp-config.routes.ts",
    endpoints: ["POST /api/miniapp-config/packages"],
    callPatterns: ["POST /api/miniapp-config/packages"],
    requestPatterns: ["POST /miniapp-config/packages"],
    menuParent: "system",
    frontendEntry: "admin-web/src/api/instant-retail.ts:240（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "miniapp:package:publish",
    module: "miniapp",
    name: "发布小程序",
    action: "publish",
    routeFile: "miniapp-config.routes.ts",
    endpoints: ["POST /api/miniapp-config/publish"],
    callPatterns: ["POST /api/miniapp-config/publish"],
    requestPatterns: ["POST /miniapp-config/publish"],
    menuParent: "system",
    frontendEntry: "admin-web/src/api/instant-retail.ts:244（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "miniapp:order-sync:retry",
    module: "miniapp",
    name: "小程序订单同步重试",
    action: "retry",
    routeFile: "miniapp-order-sync.routes.ts",
    endpoints: ["POST /api/miniapp-order-sync/:orderNo/retry"],
    callPatterns: ["POST /api/miniapp-order-sync/:orderNo/retry"],
    requestPatterns: ["POST /miniapp-order-sync/:orderNo/retry"],
    menuParent: "system",
    frontendEntry: "admin-web/src/api/instant-retail.ts:37（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
];

/** 小程序 / 移动端域（S3-236 · 5 码）的码名（顺序同目录） */
export const MINIAPP_PERMISSION_CODES: ReadonlyArray<string> = MINIAPP_PERMISSION_CATALOG.map((e) => e.code);

/** 小程序 / 移动端域（S3-236 · 5 码）的条数 */
export const MINIAPP_PERMISSION_COUNT = MINIAPP_PERMISSION_CATALOG.length;
