#!/usr/bin/env node
/**
 * S3-199 反测工具：把第 66 项的两条外键删除规则由 CASCADE 改成 RESTRICT（break），
 * 再从冻结副本逐字节复原（restore）——用于证明"判据装置确实会红"。
 *
 * 用法：node rt-66.mjs break|restore <repo> <savedDir>
 * 安全：break 前把原文逐字节冻结；restore 写回并断言 sha256 与冻结副本一致。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [cmd, repo, savedDir] = process.argv.slice(2);
const FILE = "docs/migrations/017_phase10_instant_retail.sql";
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16).toUpperCase();

if (!cmd || !repo || !savedDir) {
  console.error("用法：node rt-66.mjs break|restore <repo> <savedDir>");
  process.exit(2);
}
mkdirSync(savedDir, { recursive: true });
const frozen = join(savedDir, "017_phase10_instant_retail.sql.frozen");
const target = join(repo, FILE);

if (cmd === "break") {
  const orig = readFileSync(target);
  if (!existsSync(frozen)) writeFileSync(frozen, orig);
  const text = orig.toString("utf8");
  // 只改**两条零售外键的语句**（不留注释里的字样），避免误伤别的 CASCADE 声明
  const FROM = "REFERENCES retail_order(id) ON DELETE CASCADE";
  const TO = "REFERENCES retail_order(id) ON DELETE RESTRICT";
  const after = text.split(FROM).join(TO);
  const n = text.split(FROM).length - 1;
  writeFileSync(target, after, "utf8");
  console.log(`[break] ${FILE}: 零售外键 ON DELETE CASCADE → RESTRICT，命中 ${n} 处；原文 sha256 ${sha(orig)}`);
  if (n !== 2) throw new Error(`期望 2 处零售外键 CASCADE，实际 ${n} 处`);
} else if (cmd === "restore") {
  if (!existsSync(frozen)) throw new Error(`缺冻结副本 ${frozen}`);
  const want = readFileSync(frozen);
  writeFileSync(target, want);
  const got = readFileSync(target);
  if (sha(got) !== sha(want)) throw new Error("复原后 sha256 不一致");
  console.log(`[restore] ${FILE} 已逐字节复原，sha256 ${sha(got)}（与冻结副本一致）`);
} else {
  console.error("用法：node rt-66.mjs break|restore <repo> <savedDir>");
  process.exit(2);
}
