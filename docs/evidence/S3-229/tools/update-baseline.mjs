#!/usr/bin/env node
/**
 * S3-229 · 把本批**已接线**的 17 条端点从 `backend/scripts/rbac-wiring-baseline.json` 的 `gaps` 中逐条移除。
 *
 * 为什么手工指定（而不是"重新生成台账"）：guard 脚本头明写 —— 台账不得用于「让新增缺口变绿」，
 * 也不提供自动写入开关。本脚本只做**逐键移除**，移除名单写死在下方 WIRED 常量里，
 * 跑完必须用 `node backend/scripts/guard-rbac-wiring.mjs --strict` 验「未登记 0 / 陈旧登记 0」。
 *
 * ⚠️ 反测顺序（派单规范 §九.1）：**先跑本脚本，再注入违规**，否则摘掉接线只会产出"已登记的缺口" ⇒ `--strict` 仍绿（假绿）。
 *
 * 用法：node docs/evidence/S3-229/tools/update-baseline.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "backend/scripts/rbac-wiring-baseline.json";
const EXPECT_REMOVED = 17;

const WIRED = {
  "demo.routes.ts": ["POST /api/admin/demo/seed", "POST /api/admin/demo/reset"],
  "store-control.routes.ts": [
    "PUT /api/admin/store-control/configs/:storeId",
    "POST /api/admin/store-control/:storeId/open",
    "POST /api/admin/store-control/:storeId/close",
    "POST /api/admin/store-control/:storeId/suspend",
    "POST /api/admin/store-control/:storeId/resume",
  ],
  "community-marketing.routes.ts": [
    "POST /api/marketing/group-buy/:id/join",
    "POST /api/marketing/group-buy/:id/start",
    "POST /api/marketing/group-buy/:id/end",
    "POST /api/marketing/bargain/:id/start",
    "POST /api/marketing/bargain/:id/help",
    "POST /api/marketing/bargain/:id/end",
    "POST /api/marketing/seckill/:id/buy",
    "POST /api/marketing/seckill/:orderNo/pay",
    "POST /api/marketing/seckill/:orderNo/cancel",
    "POST /api/marketing/seckill/:id/end",
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

json._counts = {
  ...json._counts,
  files: after.files,
  endpoints: after.endpoints,
  wiredEndpoints: json._counts.wiredEndpoints + EXPECT_REMOVED,
  wiredPermOccurrences: json._counts.wiredPermOccurrences + EXPECT_REMOVED,
};
json._lastUpdate = "2026-10-16 S3-229 门店/租户域+营销 W 类接线：17 条已接线，从 gaps 移除（395 → 378）";
json._s3229_note =
  "S3-229（收口总清单第 43 项续 · B2 批 9）已给 17 条端点上 `requirePermission`" +
  "（全部既有码：store:create ×7 / store:edit ×2 / marketing:create ×10，逐条见 docs/tasks/R101-RBAC接线缺口清单.md §十七）" +
  "⇒ 这 17 条不再是无授权缺口，按流程从 gaps 逐条移除；移除的是**同一批端点**的登记，不是新缺口洗绿。" +
  "本单范围内**保留登记**的行（逐条理由见 §十七）：" +
  "① G1 门店/租户域 31 条缺口 = 已接 7（demo 2 + store-control 5）+ B 类 8（储值卡 4 + 门店会员 2 + 门店建档 2，" +
  "都落在 app-mobile「我的」页无条件入口可达的页面上）+ 平台侧 2（`/api/tenant/applications/*` 走 requirePlatformAuth，" +
  "商家码无效 ⇒ 归平台侧单）+ 公开端点 2 + 平台域 12（另立单）；" +
  "② G2 营销域 W 类 14 条 = 已接 10（community-marketing，菜单仅授予 0 账号角色与只读观察员）+ 不接 4" +
  "（points 会员等级：页面码 customer:level 对**在用**角色 STORE_MANAGER 可见而不持 marketing:create ⇒ 违反 I1，待裁定）。" +
  "⚠️ 域外无关项（他人批次）一条未动。";

writeFileSync(PATH, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log(
  `移除 ${removed} 条：files ${before.files} → ${after.files}，endpoints ${before.endpoints} → ${after.endpoints}`
);
