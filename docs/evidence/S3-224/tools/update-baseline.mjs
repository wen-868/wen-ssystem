#!/usr/bin/env node
/**
 * S3-224 · 把本批**已接线**的 32 条端点从 `backend/scripts/rbac-wiring-baseline.json` 的 `gaps` 中逐条移除。
 *
 * 为什么手工指定（而不是"重新生成台账"）：guard 脚本头明写 —— 台账不得用于「让新增缺口变绿」，
 * 也不提供自动写入开关。本脚本只做**逐键移除**，移除名单写死在下方 WIRED 常量里，
 * 跑完必须用 `node backend/scripts/guard-rbac-wiring.mjs --strict` 验「未登记 0 / 陈旧登记 0」。
 *
 * 用法：node docs/evidence/S3-224/tools/update-baseline.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "backend/scripts/rbac-wiring-baseline.json";
const EXPECT_REMOVED = 32;

const WIRED = {
  "admin-marketing-flash-sale.routes.ts": [
    "PUT /api/admin/marketing/flash-sales/:id",
    "DELETE /api/admin/marketing/flash-sales/:id",
  ],
  "admin-order.routes.ts": [
    "POST /api/admin/orders/batch-status",
    "POST /api/admin/orders/:orderNo/cancel",
    "PUT /api/admin/orders/:orderNo/remark",
  ],
  "admin-quote-push.routes.ts": [
    "POST /api/admin/quote-push/:id/push",
    "POST /api/admin/quote-push/:id/cancel",
  ],
  "aftersale.routes.ts": ["POST /api/admin/aftersales/:id/confirm-receipt"],
  "commerce-fix.routes.ts": [
    "DELETE /api/admin/consumer-addresses/:id",
    "PUT /api/admin/bills/:id",
    "DELETE /api/admin/bills/:id",
    "POST /api/admin/bills/:id/void",
  ],
  "order-timeout.routes.ts": [
    "POST /api/admin/order-timeout/configs",
    "PUT /api/admin/order-timeout/configs/:id",
    "DELETE /api/admin/order-timeout/configs/:id",
  ],
  "sale-return.routes.ts": [
    "POST /api/admin/sale-returns/:returnNo/approve",
    "POST /api/admin/sale-returns/:returnNo/reject",
  ],
  "store-order.routes.ts": [
    "POST /api/store/orders/:orderNo/accept",
    "POST /api/store/orders/:orderNo/complete-delivery",
    "POST /api/store/orders/:orderNo/reject",
    "POST /api/store/orders/:orderNo/cancel",
    "POST /api/store/hold-orders/:holdNo/restore",
    "DELETE /api/store/hold-orders/:holdNo",
  ],
  "store-sale-bill.routes.ts": ["POST /api/store/sale-bills/:billNo/pay-by-code"],
  "store-shift.routes.ts": [
    "POST /api/store/shift/settle",
    "POST /api/store/shifts/",
    "POST /api/store/shifts/:shiftNo/check",
    "POST /api/store/shifts/:shiftNo/close",
  ],
  "instant-retail-store.routes.ts": [
    "POST /api/store/instant-retail/orders/:platformOrderId/confirm",
    "POST /api/store/instant-retail/orders/:platformOrderId/cancel",
    "POST /api/store/instant-retail/orders/:platformOrderId/start-delivery",
    "POST /api/store/instant-retail/orders/:platformOrderId/complete-delivery",
  ],
};

const json = JSON.parse(readFileSync(PATH, "utf8"));
const before = { files: Object.keys(json.gaps).length, endpoints: 0 };
for (const list of Object.values(json.gaps)) before.endpoints += list.length;

let removed = 0;
for (const [file, paths] of Object.entries(WIRED)) {
  const list = json.gaps[file];
  if (!list) throw new Error(`台账里没有该文件：${file}`);
  for (const p of paths) {
    const i = list.indexOf(p);
    if (i === -1) throw new Error(`台账里没有该端点：${file} | ${p}`);
    list.splice(i, 1);
    removed++;
  }
  if (list.length === 0) delete json.gaps[file];
}

const after = { files: Object.keys(json.gaps).length, endpoints: 0 };
for (const list of Object.values(json.gaps)) after.endpoints += list.length;

if (removed !== EXPECT_REMOVED) throw new Error(`预期移除 ${EXPECT_REMOVED} 条，实际 ${removed} 条`);
if (before.endpoints - after.endpoints !== EXPECT_REMOVED) throw new Error("计数不守恒");

json._counts = { ...json._counts, files: after.files, endpoints: after.endpoints };
json._lastUpdate = "2026-10-16 S3-224 销售域接线：32 条已接线，从 gaps 移除（合并态 512 → 480）";
json._s3224_note =
  "S3-224（收口总清单第 43 项续 · B2 批 6 销售域）已给 32 条端点上 `requirePermission`" +
  "（全部既有码：sale:create|edit|void|return、finance:daily-settle，逐条见 docs/tasks/R101-RBAC接线缺口清单.md §十四）" +
  "⇒ 这 32 条不再是无授权缺口，按流程从 gaps 逐条移除。" +
  "⚠️ 本单开工时（origin/main = 96b7cee7 派生）本域读数为缺口 87 条 / 机读台账 531 条；" +
  "开工期间 S3-223（财务域 19 条，PR #349）合入 origin/main（531 → 512 / 134 文件）⇒ 本单已 `git merge origin/main`，" +
  "**合并态真值 = 512 → 480**（files 134 → 129），机读台账 `_counts` 按合并态落盘。" +
  "移除的是**同一批端点**的登记，不是新缺口洗绿。其余 55 条**保留登记**，五类原因：" +
  "① B 类 40 条 —— 存在 app-mobile 写调用点且该页使用者集合不可枚举（首页快捷入口/tabBar/推送深链/孤岛页）；" +
  "② L 类 2 条 —— 命中 G0 `NOT_IN_G0` / G1 C 类 / G2 R 类既有锁定（sale-returns 创建、sale-bills payment）；" +
  "③ Q 类 1 条 —— `POST /admin/quote-push/preview` 属查询型 POST（不改数据）；" +
  "④ P 类 3 条 —— 即时零售平台回调（auth:\"none\"，真公开）；" +
  "⑤ C 类 6 条 —— cart.routes.ts 的消费者端写端点（声明式消费者认证，门禁判据扫不到，见 §十四.7）；" +
  "⑥ W-M 类 3 条 —— 岗位管理属组织/人事语义，销售域无对应既有码 ⇒ 待授权模型定案。" +
  "逐条清单见 §十四.3/§十四.5/§十四.6/§十四.7。";

writeFileSync(PATH, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log(`移除 ${removed} 条：files ${before.files} → ${after.files}，endpoints ${before.endpoints} → ${after.endpoints}`);
