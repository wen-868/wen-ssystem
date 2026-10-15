#!/usr/bin/env node
/**
 * S3-220 · 把本批**已接线**的 17 条端点从 `backend/scripts/rbac-wiring-baseline.json` 的 `gaps` 中逐条移除。
 *
 * 为什么必须手工指定（而不是"重新生成台账"）：guard 脚本头明写 —— 台账不得用于「让新增缺口变绿」，
 * 也不提供自动写入开关。本脚本只做**逐键移除**，且移除名单写死在下方 WIRED 常量里，
 * 跑完必须用 `node backend/scripts/guard-rbac-wiring.mjs --strict` 验「未登记 0 / 陈旧登记 0」。
 *
 * 用法：node docs/evidence/S3-220/tools/update-baseline.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "backend/scripts/rbac-wiring-baseline.json";

const WIRED = {
  "admin-product.routes.ts": [
    "PUT /api/admin/products/:id/status",
    "PUT /api/admin/products/:id/disable",
    "PUT /api/admin/products/:id/warning-threshold",
  ],
  "product-bundle.routes.ts": [
    "POST /api/admin/product-bundles",
    "PUT /api/admin/product-bundles/:id",
    "DELETE /api/admin/product-bundles/:id",
    "POST /api/admin/product-bundles/:id/publish",
    "POST /api/admin/product-bundles/:id/unpublish",
    "POST /api/admin/combo-products",
    "PUT /api/admin/combo-products/:id",
    "DELETE /api/admin/combo-products/:id",
  ],
  "product-review.routes.ts": ["POST /api/admin/product-reviews/"],
  "unit.routes.ts": ["POST /api/admin/units/", "PUT /api/admin/units/:id", "DELETE /api/admin/units/:id"],
};

const raw = readFileSync(PATH, "utf8");
const json = JSON.parse(raw);
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

if (removed !== 15) throw new Error(`预期移除 15 条，实际 ${removed} 条`);
if (before.endpoints - after.endpoints !== 15) throw new Error("计数不守恒");

json._counts = { ...json._counts, files: after.files, endpoints: after.endpoints };
json._lastUpdate = "2026-10-16 S3-220 商品域接线：15 条已接线，从 gaps 移除（588 → 573）";
json._s3220_note =
  "S3-220（收口总清单第 43 项续 · B2 批 3 商品域 45 写端点）已给 15 条端点上 `requirePermission`" +
  "（既有码 goods:create|edit|delete，逐条见 docs/tasks/R101-RBAC接线缺口清单.md §十二）⇒ 这 15 条不再是无授权缺口，" +
  "按流程从 gaps 逐条移除（files 148→146、endpoints 588→573）。移除的是**同一批端点**的登记，不是新缺口洗绿。" +
  "其余 30 条**保留登记**，三类原因：① B 类 13 条 —— 移动页面调用点存在但角色集合无法与任何一个既有码对齐" +
  "（`app-mobile` 商品 tab 无权限门 + `admin-web` 商品类页面 meta.roles 含 STORE_MANAGER，而生产店长不持任何 goods:* 写码）；" +
  "② A 类 15 条 —— 有页面调用点且页面角色含 STORE_MANAGER；③ P 类 2 条 —— 价格端点 `POST /prices/best-price`" +
  "与 `POST /prices/batch/preview` 属既有「查询型 POST（待裁定）」/「已知锁定」项，本批不动。" +
  "逐条清单见 §十二.3/§十二.4/§十二.6。";

writeFileSync(PATH, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log(`移除 ${removed} 条：files ${before.files} → ${after.files}，endpoints ${before.endpoints} → ${after.endpoints}`);
