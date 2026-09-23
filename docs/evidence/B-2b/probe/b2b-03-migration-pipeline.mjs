/**
 * 复刻 backend/src/shared/migration.ts 第 8 步（外部迁移）的切块/过滤逻辑，
 * 自证 docs/migrations/172_sale_bill_item_tenant_backfill.sql 的语句**不会被注释块吃掉**。
 *
 * 依据：踩坑日志[63] —— 管线是
 *   readFileSync → 去 USE/DELIMITER 行 → split(';') → trim() →
 *   filter(s => s.length>0 && !s.startsWith('--'))   ← 以注释开头的整块被丢弃
 *   → 跳过 存储过程 / DROP TABLE → addTablePrefix → safeExec
 *
 * 用法：node docs/evidence/B-2b/probe/b2b-03-migration-pipeline.mjs
 * harness：本探针不需要替身 harness（自带 runner 切块复刻）；本包 harness 唯一入口＝
 *   docs/evidence/B-2b/probe/tenant-id-fix/register.mjs（probe/ 根目录同名副本已于 2026-09-23 清理）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const FILE = process.argv[2] ?? "docs/migrations/172_sale_bill_item_tenant_backfill.sql";

const sql = readFileSync(path.join(ROOT, FILE), "utf-8");

const cleaned = sql
  .split("\n")
  .filter((line) => {
    const t = line.trim().toUpperCase();
    return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
  })
  .join("\n");

const chunks = cleaned.split(";").map((s) => s.trim());
const kept = chunks.filter((s) => s.length > 0 && !s.startsWith("--"));
const dropped = chunks.filter((s) => s.length > 0 && s.startsWith("--"));

console.log(`文件: ${FILE}`);
console.log(`切块数 = ${chunks.length}；保留(会执行) = ${kept.length}；丢弃 = ${dropped.length}；空块 = ${chunks.length - kept.length - dropped.length}`);
console.log("");
kept.forEach((s, i) => {
  console.log(`--- KEPT ${i + 1} ---`);
  console.log(s.replace(/\s+/g, " ").trim());
});
console.log("");
dropped.forEach((s, i) => {
  console.log(`--- DROPPED ${i + 1}（以 '--' 开头，管线丢弃；前 60 字）---`);
  console.log(s.replace(/\s+/g, " ").trim().slice(0, 60));
});

const hasAlter = /\bALTER\b/i.test(kept.join(" ; "));
const hasCreate = /\bCREATE\b/i.test(kept.join(" ; "));
const hasDrop = /\bDROP\b/i.test(kept.join(" ; "));
console.log("");
console.log(`保留语句中 ALTER 命中 = ${hasAlter}（要求 false，零 ALTER）`);
console.log(`保留语句中 CREATE 命中 = ${hasCreate}（要求 false，零建表）`);
console.log(`保留语句中 DROP 命中 = ${hasDrop}（要求 false）`);
console.log(`语句在注释之前 = ${cleaned.trimStart().startsWith("UPDATE")}`);
