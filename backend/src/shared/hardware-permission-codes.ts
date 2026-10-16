/**
 * S3-236（立码第二批）：硬件 / 打印域（S3-236 · 14 码）的**唯一出处**
 *
 * 一、本文件是什么（形态照抄先例）
 *   本仓口径：**目录走代码常量、迁移只做数据登记**（先例 `system-permission-codes.ts`（S3-232 D6）、
 *   `goods-permission-codes.ts` / `sale-permission-codes.ts` / `library-permission-codes.ts`）。
 *   本批为四域各建一个 per-域常量文件，再由 `batch2-permission-codes.ts` 汇总（断言只认汇总文件）。
 *
 * 二、码表来源（**照抄，禁止自拟**）
 *   `docs/tasks/R101-待立码清单-五域.md` §二 —— 模块码取 079 既有码族：打印留痕/模板落 `system`（与 app-mobile 菜单码 `system:print` 同域），硬件配置落 `store`（硬件挂在门店域）；另 2 条服务商回调是公开端点 ⇒ 不立码
 *
 * 三、本批**不接任何业务路由**（`backend/src/routes/**` 零改动）：只立码本身，
 *   即「目录 + 迁移 207 + 断言 + 前端入口登记」；接线留给后续批次。
 *
 * 四、持有者口径：本批**默认不给任何角色发码**（同 S3-232 裁定）；如需发给某在用角色，
 *   只登记并在回传卡请凌舟裁，**不得自行发码**。
 */
import { defineBatch2Entry, type Batch2PermissionEntry } from "./batch2-entry";

/** 硬件 / 打印域（S3-236 · 14 码） —— 码表来源：`docs/tasks/R101-待立码清单-五域.md` §二 */
export const HARDWARE_PERMISSION_CATALOG: ReadonlyArray<Batch2PermissionEntry> = [
  defineBatch2Entry({
    code: "system:print-record:create",
    module: "system",
    name: "保存打印记录",
    action: "create",
    routeFile: "print.routes.ts",
    endpoints: ["POST /api/admin/print/records"],
    callPatterns: ["POST /api/admin/print/records"],
    requestPatterns: ["POST /admin/print/records"],
    menuParent: "system",
    frontendEntry: "admin-web/src/modules/print/api.ts:85 / app-mobile/src/api/modules/print.ts:102（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "system:print-record:reprint",
    module: "system",
    name: "重打小票",
    action: "reprint",
    routeFile: "print.routes.ts",
    endpoints: ["POST /api/admin/print/records/:id/reprint"],
    callPatterns: ["POST /api/admin/print/records/:id/reprint"],
    requestPatterns: ["POST /admin/print/records/:id/reprint"],
    menuParent: "system",
    frontendEntry: "app-mobile/src/api/modules/print.ts:155（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "system:print-template:create",
    module: "system",
    name: "新建打印模板",
    action: "create",
    routeFile: "print.routes.ts",
    endpoints: ["POST /api/admin/print/templates"],
    callPatterns: ["POST /api/admin/print/templates"],
    requestPatterns: ["POST /admin/print/templates"],
    menuParent: "system",
    frontendEntry: "admin-web/src/modules/print/api.ts:47（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "system:print-template:edit",
    module: "system",
    name: "编辑打印模板",
    action: "edit",
    routeFile: "print.routes.ts",
    endpoints: ["PUT /api/admin/print/templates/:id"],
    callPatterns: ["PUT /api/admin/print/templates/:id"],
    requestPatterns: ["PUT /admin/print/templates/:id"],
    menuParent: "system",
    frontendEntry: "admin-web/src/modules/print/api.ts:61（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "system:print-template:delete",
    module: "system",
    name: "删除打印模板",
    action: "delete",
    routeFile: "print.routes.ts",
    endpoints: ["DELETE /api/admin/print/templates/:id"],
    callPatterns: ["DELETE /api/admin/print/templates/:id"],
    requestPatterns: ["DELETE /admin/print/templates/:id"],
    menuParent: "system",
    frontendEntry: "admin-web/src/modules/print/api.ts:67（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "system:print-template:reset",
    module: "system",
    name: "重置打印模板",
    action: "reset",
    routeFile: "print.routes.ts",
    endpoints: ["POST /api/admin/print/templates/:id/reset"],
    callPatterns: ["POST /api/admin/print/templates/:id/reset"],
    requestPatterns: ["POST /admin/print/templates/:id/reset"],
    menuParent: "system",
    frontendEntry: "admin-web/src/modules/print/api.ts:73（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "system:print-template:set-default",
    module: "system",
    name: "设为默认打印模板",
    action: "set-default",
    routeFile: "print.routes.ts",
    endpoints: ["POST /api/admin/print/templates/:id/set-default"],
    callPatterns: ["POST /api/admin/print/templates/:id/set-default"],
    requestPatterns: ["POST /admin/print/templates/:id/set-default"],
    menuParent: "system",
    frontendEntry: "admin-web/src/modules/print/api.ts:79（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "store:hardware:config-edit",
    module: "store",
    name: "编辑硬件配置",
    action: "config-edit",
    routeFile: "store-hardware.routes.ts",
    endpoints: ["PUT /api/store/hardware/configs/:category"],
    callPatterns: ["PUT /api/store/hardware/configs/:category"],
    requestPatterns: ["PUT /store/hardware/configs/:category"],
    menuParent: "store",
    frontendEntry: "admin-web/src/api/hardware.ts:15（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "store:hardware:config-test",
    module: "store",
    name: "测试硬件配置",
    action: "config-test",
    routeFile: "store-hardware.routes.ts",
    endpoints: ["POST /api/store/hardware/configs/:category/test"],
    callPatterns: ["POST /api/store/hardware/configs/:category/test"],
    requestPatterns: ["POST /store/hardware/configs/:category/test"],
    menuParent: "store",
    frontendEntry: "admin-web/src/api/hardware.ts:21（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "store:hardware:announce",
    module: "store",
    name: "云喇叭播报",
    action: "announce",
    routeFile: "store-hardware.routes.ts",
    endpoints: ["POST /api/store/hardware/cloud-speaker/announce"],
    callPatterns: ["POST /api/store/hardware/cloud-speaker/announce"],
    requestPatterns: ["POST /store/hardware/cloud-speaker/announce"],
    menuParent: "store",
    frontendEntry: "admin-web/src/api/hardware.ts:43（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "store:hardware:box-pay",
    module: "store",
    name: "收银盒支付",
    action: "box-pay",
    routeFile: "store-hardware.routes.ts",
    endpoints: ["POST /api/store/hardware/box/pay"],
    callPatterns: ["POST /api/store/hardware/box/pay"],
    requestPatterns: ["POST /store/hardware/box/pay"],
    menuParent: "store",
    frontendEntry: "admin-web/src/api/hardware.ts:49（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "store:hardware:box-config-edit",
    module: "store",
    name: "编辑收银盒配置",
    action: "box-config-edit",
    routeFile: "store-hardware.routes.ts",
    endpoints: ["PUT /api/store/hardware/box-config"],
    callPatterns: ["PUT /api/store/hardware/box-config"],
    requestPatterns: ["PUT /store/hardware/box-config"],
    menuParent: "store",
    frontendEntry: "admin-web/src/api/hardware.ts:32（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "store:hardware:box-config-test",
    module: "store",
    name: "测试收银盒配置",
    action: "box-config-test",
    routeFile: "store-hardware.routes.ts",
    endpoints: ["POST /api/store/hardware/box-config/test"],
    callPatterns: ["POST /api/store/hardware/box-config/test"],
    requestPatterns: ["POST /store/hardware/box-config/test"],
    menuParent: "store",
    frontendEntry: "admin-web/src/api/hardware.ts:37（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
  defineBatch2Entry({
    code: "store:hardware:unionpay-test",
    module: "store",
    name: "测试云闪付",
    action: "unionpay-test",
    routeFile: "store-hardware.routes.ts",
    endpoints: ["POST /api/store/hardware/unionpay/test"],
    callPatterns: ["POST /api/store/hardware/unionpay/test"],
    requestPatterns: ["POST /store/hardware/unionpay/test"],
    menuParent: "store",
    frontendEntry: "admin-web/src/api/hardware.ts:55（实测：docs/evidence/S3-236/raw/10-frontend-entry-scan.txt）",
  }),
];

/** 硬件 / 打印域（S3-236 · 14 码）的码名（顺序同目录） */
export const HARDWARE_PERMISSION_CODES: ReadonlyArray<string> = HARDWARE_PERMISSION_CATALOG.map((e) => e.code);

/** 硬件 / 打印域（S3-236 · 14 码）的条数 */
export const HARDWARE_PERMISSION_COUNT = HARDWARE_PERMISSION_CATALOG.length;
