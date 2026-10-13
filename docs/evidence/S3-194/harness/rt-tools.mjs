#!/usr/bin/env node
/**
 * S3-194 反测工具：把 2 条修复"改回原定义"（break）/ 从冻结副本复原（restore）。
 *
 * 用法：
 *   node rt-tools.mjs break   <repo> <savedDir>
 *   node rt-tools.mjs restore <repo> <savedDir>
 *
 * 反测对象（刻意选两条不同缺陷型的）：
 *   ① docs/migrations/016_phase9_tenant_subscription.sql 的 t_tenant_module_access.tenant_id（UUID 型）
 *   ② docs/migrations/017_phase10_instant_retail.sql     的 t_delivery_record.order_id（自增 ID 型）
 * 两条都是"该表声明它的那一块"，改回后建表必须失败（errno 3780）。
 *
 * 安全：break 前先把原文逐字节存到 <savedDir>，restore 直接写回并断言 sha256 一致。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [cmd, repo, savedDir] = process.argv.slice(2);
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16).toUpperCase();
mkdirSync(savedDir, { recursive: true });

const targets = [
  { file: "docs/migrations/016_phase9_tenant_subscription.sql", table: "t_tenant_module_access", col: "tenant_id", from: "VARCHAR(36)", to: "INT" },
  { file: "docs/migrations/017_phase10_instant_retail.sql", table: "t_delivery_record", col: "order_id", from: "BIGINT", to: "INT" },
];

if (cmd === "break") {
  for (const t of targets) {
    const p = join(repo, t.file);
    const orig = readFileSync(p);
    writeFileSync(join(savedDir, t.file.split("/").pop() + ".frozen"), orig);
    const text = orig.toString("utf8");
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((l) => l.includes(`CREATE TABLE IF NOT EXISTS ${t.table} (`));
    if (start < 0) throw new Error(`未找到建表块 ${t.table}`);
    let hit = -1;
    for (let i = start; i < Math.min(start + 40, lines.length); i++) {
      const re = new RegExp("^\\s+`?" + t.col + "`?\\s+" + t.from.replace(/[()]/g, "\\$&") + "(?=\\s)");
      if (re.test(lines[i])) { hit = i; break; }
    }
    if (hit < 0) throw new Error(`未找到列 ${t.table}.${t.col} ${t.from}`);
    const before = lines[hit];
    lines[hit] = before.replace(t.from, t.to);
    writeFileSync(p, lines.join(eol), "utf8");
    console.log(`[break] ${t.file}:${hit + 1}  ${before.trim()}  ⇒  ${lines[hit].trim()}   (原文 sha256 ${sha(orig)})`);
  }
} else if (cmd === "restore") {
  for (const t of targets) {
    const p = join(repo, t.file);
    const frozen = join(savedDir, t.file.split("/").pop() + ".frozen");
    if (!existsSync(frozen)) throw new Error(`缺冻结副本 ${frozen}`);
    const want = readFileSync(frozen);
    writeFileSync(p, want);
    const got = readFileSync(p);
    if (sha(got) !== sha(want)) throw new Error(`复原后 sha256 不一致：${t.file}`);
    console.log(`[restore] ${t.file} 已复原，sha256 ${sha(got)}（与冻结副本一致）`);
  }
} else {
  console.error("用法：node rt-tools.mjs break|restore <repo> <savedDir>");
  process.exit(2);
}
