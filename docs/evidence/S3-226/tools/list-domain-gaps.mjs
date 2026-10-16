#!/usr/bin/env node
/**
 * S3-226 · 打印机读台账 `rbac-wiring-baseline.json` 里本域（18 文件）当前登记的全部缺口键，
 * 并给出计数 —— 用于「逐键移除」工具（`update-baseline.mjs`）的清单核对与守恒断言。
 *
 * 用法：node docs/evidence/S3-226/tools/list-domain-gaps.mjs
 */
import { readFileSync } from "node:fs";

const DOMAIN_FILES = [
  "admin-marketing-calculation.routes.ts",
  "admin-marketing-coupon.routes.ts",
  "admin-marketing-full-reduction.routes.ts",
  "admin-marketing-group-buy.routes.ts",
  "admin-marketing-points.routes.ts",
  "admin-marketing-stack-rule.routes.ts",
  "community-marketing.routes.ts",
  "marketing-asset.routes.ts",
  "marketing-gift-rule.routes.ts",
  "marketing-limited-discount.routes.ts",
  "marketing-material.routes.ts",
  "marketing-points-mall.routes.ts",
  "points-mall.routes.ts",
  "points.routes.ts",
  "retail-announcement.routes.ts",
  "retail-announcements-admin.routes.ts",
  "seckill.routes.ts",
  "store-coupon.routes.ts",
];

const json = JSON.parse(readFileSync("backend/scripts/rbac-wiring-baseline.json", "utf8"));
let total = 0;
for (const f of DOMAIN_FILES) {
  const list = json.gaps[f];
  if (!list) {
    console.log(`== ${f}  (台账无该文件)`);
    continue;
  }
  console.log(`== ${f}  (${list.length})`);
  for (const p of list) {
    total++;
    console.log(`   "${p}",`);
  }
}
console.log(`域内登记总数 = ${total}`);
console.log(`_counts = ${JSON.stringify(json._counts)}`);
