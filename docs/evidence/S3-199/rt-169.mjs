#!/usr/bin/env node
/**
 * S3-199 反测工具（第 64 项的 169 幂等守卫）：
 *   break   = 把 169 的「info_schema 守卫 + PREPARE/EXECUTE」换回**原无守卫的 DROP**（= 故意制造失败）
 *   restore = 从冻结副本逐字节复原并断言 sha256 一致（= 复原后必须转绿）
 *
 * 用法：node rt-169.mjs break|restore <repo> <savedDir>
 * 判据：同一库第二遍跑迁移后，日志里 `169_tenant_admin_uuid.sql 失败` 命中数
 *       break 前 0 条 / break 后 ≥1 条 / restore 后 0 条（两侧齐）。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [cmd, repo, savedDir] = process.argv.slice(2);
const FILE = "docs/migrations/169_tenant_admin_uuid.sql";
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16).toUpperCase();
if (!cmd || !repo || !savedDir) {
  console.error("用法：node rt-169.mjs break|restore <repo> <savedDir>");
  process.exit(2);
}
mkdirSync(savedDir, { recursive: true });
const frozen = join(savedDir, "169_tenant_admin_uuid.sql.frozen");
const target = join(repo, FILE);

// 被替换的守卫块（5 条语句，按文件内实际书写顺序）
const GUARDED_LINES = [
  "SET @s3199_fk169 = (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't_tenant_admin' AND CONSTRAINT_NAME = 't_tenant_admin_ibfk_1');",
  "SET @s3199_ddl169 = IF(@s3199_fk169 > 0, 'ALTER TABLE t_tenant_admin DROP FOREIGN KEY t_tenant_admin_ibfk_1', 'SELECT ''S3-199-169：本库已无该外键，DROP 整句跳过（幂等）'' AS s3199_step');",
  "PREPARE s3199_stmt169 FROM @s3199_ddl169;",
  "EXECUTE s3199_stmt169;",
  "DEALLOCATE PREPARE s3199_stmt169;",
];
const UNGUARDED = "ALTER TABLE t_tenant_admin DROP FOREIGN KEY t_tenant_admin_ibfk_1;";

if (cmd === "break") {
  const orig = readFileSync(target);
  if (!existsSync(frozen)) writeFileSync(frozen, orig);
  const text = orig.toString("utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const block = GUARDED_LINES.join(eol);
  if (!text.includes(block)) throw new Error("未找到守卫块（文件已被改动？）");
  const after = text.replace(block, UNGUARDED);
  writeFileSync(target, after, "utf8");
  console.log(`[break] ${FILE}: 守卫块 → 原无守卫 DROP；原文 sha256 ${sha(orig)}`);
} else if (cmd === "restore") {
  if (!existsSync(frozen)) throw new Error(`缺冻结副本 ${frozen}`);
  const want = readFileSync(frozen);
  writeFileSync(target, want);
  const got = readFileSync(target);
  if (sha(got) !== sha(want)) throw new Error("复原后 sha256 不一致");
  console.log(`[restore] ${FILE} 已逐字节复原，sha256 ${sha(got)}（与冻结副本一致）`);
} else {
  console.error("用法：node rt-169.mjs break|restore <repo> <savedDir>");
  process.exit(2);
}
