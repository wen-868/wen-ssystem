#!/usr/bin/env node
/**
 * S3-226 · 把本批**已接线**的 65 条端点从 `backend/scripts/rbac-wiring-baseline.json` 的 `gaps` 中逐条移除。
 *
 * 为什么手工指定（而不是"重新生成台账"）：guard 脚本头明写 —— 台账不得用于「让新增缺口变绿」，
 * 也不提供自动写入开关。本脚本只做**逐键移除**，移除名单写死在下方 WIRED 常量里，
 * 跑完必须用 `node backend/scripts/guard-rbac-wiring.mjs --strict` 验「未登记 0 / 陈旧登记 0」。
 *
 * 用法：node docs/evidence/S3-226/tools/update-baseline.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "backend/scripts/rbac-wiring-baseline.json";
const EXPECT_REMOVED = 65;

const WIRED = {
  "admin-marketing-coupon.routes.ts": [
    "PUT /api/admin/marketing/coupons/templates/:id",
    "DELETE /api/admin/marketing/coupons/templates/:id",
    "POST /api/admin/marketing/coupons/templates/:id/activate",
  ],
  "admin-marketing-full-reduction.routes.ts": [
    "POST /api/admin/marketing/full-reductions",
    "PUT /api/admin/marketing/full-reductions/:id",
  ],
  "admin-marketing-group-buy.routes.ts": [
    "POST /api/admin/marketing/group-buys",
    "PUT /api/admin/marketing/group-buys/:id",
    "DELETE /api/admin/marketing/group-buys/:id",
    "POST /api/admin/marketing/group-buys/:id/activate",
    "POST /api/admin/marketing/group-buys/teams",
    "POST /api/admin/marketing/group-buys/teams/:teamId/join",
  ],
  "admin-marketing-points.routes.ts": ["PUT /api/admin/marketing/points/rule"],
  "admin-marketing-stack-rule.routes.ts": [
    "POST /api/admin/marketing/stack-rules",
    "PUT /api/admin/marketing/stack-rules/:id",
    "DELETE /api/admin/marketing/stack-rules/:id",
  ],
  "marketing-asset.routes.ts": [
    "POST /api/marketing-asset/",
    "PUT /api/marketing-asset/:id",
    "DELETE /api/marketing-asset/:id",
  ],
  "marketing-gift-rule.routes.ts": [
    "POST /api/admin/marketing/gift-rules/",
    "PUT /api/admin/marketing/gift-rules/:id",
    "DELETE /api/admin/marketing/gift-rules/:id",
    "POST /api/admin/marketing/gift-rules/:id/activate",
    "POST /api/admin/marketing/gift-rules/:id/pause",
    "POST /api/admin/marketing/gift-rules/:id/levels",
    "PUT /api/admin/marketing/gift-rules/:id/levels/:levelId",
    "DELETE /api/admin/marketing/gift-rules/:id/levels/:levelId",
  ],
  "marketing-limited-discount.routes.ts": [
    "POST /api/admin/marketing/limited-discounts/",
    "PUT /api/admin/marketing/limited-discounts/:id",
    "DELETE /api/admin/marketing/limited-discounts/:id",
    "POST /api/admin/marketing/limited-discounts/:id/activate",
    "POST /api/admin/marketing/limited-discounts/:id/pause",
    "POST /api/admin/marketing/limited-discounts/:id/products",
    "DELETE /api/admin/marketing/limited-discounts/:id/products/:productId",
  ],
  "marketing-material.routes.ts": [
    "POST /api/admin/marketing/materials/",
    "PUT /api/admin/marketing/materials/:id",
    "DELETE /api/admin/marketing/materials/:id",
    "POST /api/admin/marketing/materials/:id/publish",
    "POST /api/admin/marketing/materials/:id/archive",
    "POST /api/admin/marketing/materials/categories",
    "PUT /api/admin/marketing/materials/categories/:id",
    "DELETE /api/admin/marketing/materials/categories/:id",
  ],
  "marketing-points-mall.routes.ts": [
    "POST /api/admin/marketing/points-mall/products",
    "PUT /api/admin/marketing/points-mall/products/:id",
    "DELETE /api/admin/marketing/points-mall/products/:id",
    "POST /api/admin/marketing/points-mall/products/:id/toggle",
    "POST /api/admin/marketing/points-mall/exchange",
    "POST /api/admin/marketing/points-mall/exchange-records/:id/cancel",
    "POST /api/admin/marketing/points-mall/exchange-records/:id/confirm",
  ],
  "points-mall.routes.ts": [
    "POST /api/points-mall/items",
    "PUT /api/points-mall/items/:id",
    "DELETE /api/points-mall/items/:id",
    "PUT /api/points-mall/items/:id/status",
    "PUT /api/points-mall/orders/:id/deliver",
    "PUT /api/points-mall/orders/:id/cancel",
  ],
  "points.routes.ts": [
    "POST /api/admin/members/rules",
    "PUT /api/admin/members/rules/:id",
  ],
  "retail-announcement.routes.ts": [
    "POST /api/retail-announcement/admin/retail-announcements",
    "PUT /api/retail-announcement/admin/retail-announcements/:id",
    "DELETE /api/retail-announcement/admin/retail-announcements/:id",
  ],
  "retail-announcements-admin.routes.ts": [
    "POST /api/admin/retail-announcements/",
    "PUT /api/admin/retail-announcements/:id",
    "DELETE /api/admin/retail-announcements/:id",
  ],
  "seckill.routes.ts": [
    "POST /api/seckill/",
    "PUT /api/seckill/:id",
    "DELETE /api/seckill/:id",
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
json._lastUpdate = "2026-10-16 S3-226 营销域接线：65 条已接线，从 gaps 移除（480 → 415）";
json._s3226_note =
  "S3-226（收口总清单第 43 项续 · B2 批 8 营销域）已给 65 条端点上 `requirePermission`" +
  "（全部既有码：marketing:create / marketing:points，逐条见 docs/tasks/R101-RBAC接线缺口清单.md §十五）" +
  "⇒ 这 65 条不再是无授权缺口，按流程从 gaps 逐条移除。" +
  "移除的是**同一批端点**的登记，不是新缺口洗绿。本域其余 24 条**保留登记**，三类原因：" +
  "① Q 类 1 条 —— `POST /api/admin/marketing/calculate` 是**查询型 POST**（service 只读不写）；" +
  "② B 类 9 条 —— 存在 app-mobile 写调用点且该页使用者集合不可枚举（推送深链 / 首页快捷入口 / 孤岛页 / 菜单码在生产不在菜单库）；" +
  "③ W 类 14 条 —— 页面可见角色含 READONLY、旧词表 STORE_ADMIN、店长、销售或客服，均不持 `marketing:*` ⇒ 接线即 403（待授权模型定案）。" +
  "逐条清单见 §十五.4/§十五.5/§十五.6。⚠️ 域外 3 条无关项（他人批次）未动。";

writeFileSync(PATH, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log(`移除 ${removed} 条：files ${before.files} → ${after.files}，endpoints ${before.endpoints} → ${after.endpoints}`);
