/**
 * S3-151 静态判定（本沙箱可跑，替代 vitest——本环境 esbuild spawn ⇒ EPERM，vitest 起不来）
 *
 * 用法：cd backend && node scripts/s3-151-static-check.mjs
 *
 * 断言与 vitest 单测同口径（test 侧见 src/__tests__/shared/migration-194-barcode-tenant.test.ts）：
 *   ① 迁移 194 形状：首条=前置查重 SELECT / information_schema.STATISTICS 幂等守卫 / 一条 ALTER 内
 *      DROP 旧键 + ADD 复合新键 + ALGORITHM=INPLACE, LOCK=NONE / 零 DML / 无 DROP TABLE / 回滚语句在注释里
 *   ② 注释块在可执行语句之后、注释内无 ASCII 分号（踩坑 [63] 口径）
 *   ③ addTablePrefix 对 194 是空操作（文件自带 t_ 前缀，information_schema 不被误加前缀）
 *   ④ 两处新库口径已同步（migration.ts / init_database.sql 都是 uk_product_sku_tenant_barcode，
 *      且不再有 (barcode) 单列唯一键定义行）
 *   ⑤ 迁移编号快照：migration-c6-4-1.test.ts 的 EXPECTED_MAX_MIGRATION = docs/migrations 的最大编号
 * 切块/加前缀复用生产代码（dist/shared/migration.js），不另写复刻逻辑。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

process.env.JWT_SECRET ||= "s3-151-static-check";
process.env.USE_MOCK_DB ||= "true";

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(HERE, "..");
const REPO_DIR = resolve(BACKEND_DIR, "..");
const { addTablePrefix, splitSqlStatements, isDataWriteStatement, isDropTableStatement } = await import(
  pathToFileURL(join(BACKEND_DIR, "dist/shared/migration.js")).href
);

let passed = 0;
let failed = 0;
const rows = [];
function check(label, ok, detail) {
  if (ok) passed += 1;
  else failed += 1;
  rows.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `   ← ${detail}` : ""}`);
}

// ── ① 迁移 194 形状
const MIG = "194_条码唯一键改租户内唯一.sql";
const migPath = resolve(REPO_DIR, "docs/migrations", MIG);
check("迁移文件存在", existsSync(migPath), migPath);
const raw = readFileSync(migPath, "utf-8").replace(/\r\n/g, "\n");
const cleaned = raw.split("\n").filter((l) => !l.trim().toUpperCase().startsWith("USE ")).join("\n");
const statements = splitSqlStatements(cleaned);
const prefixed = statements.map((s) => addTablePrefix(s));
const joined = prefixed.join("\n");

const firstExecutable = raw.split("\n").find((l) => l.trim().length > 0 && !l.trim().startsWith("--")) ?? "";
check("首条可执行语句是前置查重 SELECT", firstExecutable.trim().toUpperCase().startsWith("SELECT"), firstExecutable.trim().slice(0, 60));
const dup = prefixed.find((s) => s.includes("HAVING COUNT(*) > 1"));
check(
  "前置查重口径 = (tenant_id, barcode) 重数",
  !!dup && dup.includes("FROM t_product_sku") && dup.includes("GROUP BY t.tenant_id, t.barcode") && dup.includes("barcode IS NOT NULL"),
  dup ? dup.replace(/\s+/g, " ").slice(0, 120) : "未找到"
);
const guards = prefixed.filter((s) => s.includes("FROM information_schema.STATISTICS"));
check("幂等守卫读 information_schema.STATISTICS（新键 + 旧键 + 跑后核对 = 3 条）", guards.length === 3, `条数=${guards.length}`);
check("守卫按 INDEX_NAME 判定新键", joined.includes("INDEX_NAME = 'uk_product_sku_tenant_barcode'"), "");
check("守卫按 INDEX_NAME 判定旧键", joined.includes("INDEX_NAME = 'uk_product_sku_barcode'"), "");
check(
  "DDL：一条 ALTER 内 DROP 旧键 + ADD (tenant_id, barcode) 复合唯一键",
  joined.includes(
    "ALTER TABLE t_product_sku DROP INDEX uk_product_sku_barcode, ADD UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode), ALGORITHM=INPLACE, LOCK=NONE"
  ),
  ""
);
check(
  "DDL 显式 ALGORITHM=INPLACE, LOCK=NONE（无旧键分支同样声明）",
  joined.includes(
    "ALTER TABLE t_product_sku ADD UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode), ALGORITHM=INPLACE, LOCK=NONE"
  ),
  ""
);
check("幂等兜底分支输出「整句跳过」提示（键已改时不报错）", joined.includes("整句跳过"), "");
check(
  "PREPARE / EXECUTE / DEALLOCATE 各 1 次",
  prefixed.filter((s) => /^PREPARE s3151_stmt FROM @s3151_ddl/.test(s)).length === 1 &&
    prefixed.filter((s) => /^EXECUTE s3151_stmt/.test(s)).length === 1 &&
    prefixed.filter((s) => /^DEALLOCATE PREPARE s3151_stmt/.test(s)).length === 1,
  ""
);
const dml = statements.filter((s) => isDataWriteStatement(s));
check("零 DML（无 INSERT/UPDATE/DELETE/REPLACE/CALL）", dml.length === 0, `DML 条数=${dml.length}`);
const dropTable = statements.filter((s) => isDropTableStatement(s));
check("无 DROP TABLE 语句", dropTable.length === 0, `DROP TABLE 条数=${dropTable.length}`);
check("无反引号标识符", !joined.includes("`"), "");

// ── ② 注释口径
const commentLines = raw.split("\n").filter((l) => l.trim().startsWith("--"));
const firstComment = raw.split("\n").findIndex((l) => l.trim().startsWith("--"));
const lastExecutable = raw.split("\n").reduce(
  (last, l, i) => (l.trim().length > 0 && !l.trim().startsWith("--") ? i : last),
  0
);
check("注释块整体位于可执行语句之后（踩坑 [63] 防线）", firstComment > lastExecutable, `firstComment=${firstComment} lastExecutable=${lastExecutable}`);
const commentText = commentLines.join("\n");
check("注释文字内无 ASCII 分号", !commentText.includes(";"), "");
check(
  "回滚语句写在注释里（含回滚前全库查重口径）",
  commentText.includes("四、回滚语句") &&
    commentText.includes("DROP INDEX uk_product_sku_tenant_barcode") &&
    commentText.includes("ADD UNIQUE KEY uk_product_sku_barcode (barcode)") &&
    commentText.includes("GROUP BY barcode HAVING COUNT(*) > 1"),
  ""
);

// ── ③ addTablePrefix 是空操作
check("addTablePrefix 不误伤 information_schema", joined.includes("information_schema.STATISTICS") && !joined.includes("t_information_schema"), "");
check("addTablePrefix 不对 t_product_sku 二次加前缀", !joined.includes("t_t_product_sku"), "");

// ── ④ 两处新库口径同步 + 旧键定义行已消失
const migrationTs = readFileSync(join(BACKEND_DIR, "src/shared/migration.ts"), "utf-8");
const initSql = readFileSync(join(REPO_DIR, "docs/init_database.sql"), "utf-8");
check(
  "migration.ts 新库内联 DDL = uk_product_sku_tenant_barcode (tenant_id, barcode)",
  migrationTs.includes("UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode)"),
  ""
);
check(
  "init_database.sql 新库建表 = uk_product_sku_tenant_barcode (tenant_id, barcode)",
  initSql.includes("UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode)"),
  ""
);
const oldDefRe = /UNIQUE\s+KEY\s+uk_product_sku_barcode\b/i;
check("migration.ts 已无旧键定义行", !oldDefRe.test(migrationTs), "");
check("init_database.sql 已无旧键定义行", !oldDefRe.test(initSql), "");
check(
  "两处注释标明 S3-151 与 194 同口径",
  /S3-151[^\n]*194 同口径/.test(migrationTs) && /S3-151[^\n]*194 同口径/.test(initSql),
  ""
);
check("001_phase1_schema.sql 仍是历史快照（保留旧键定义）", /UNIQUE\s+KEY\s+uk_product_sku_barcode\b/i.test(readFileSync(resolve(REPO_DIR, "docs/migrations/001_phase1_schema.sql"), "utf-8")), "");

// ── ⑤ 迁移编号快照
const files = readdirSync(resolve(REPO_DIR, "docs/migrations")).filter((n) => n.endsWith(".sql"));
const numbered = files.map((n) => (/^(\d{3})_/.exec(n) ?? [])[1]).filter(Boolean).map(Number);
const max = Math.max(...numbered);
const snapshot = Number(
  /EXPECTED_MAX_MIGRATION\s*=\s*(\d+)/.exec(readFileSync(join(BACKEND_DIR, "src/__tests__/shared/migration-c6-4-1.test.ts"), "utf-8"))?.[1] ?? -1
);
check("migration-c6-4-1 快照 = 迁移库最大编号 = 194", snapshot === 194 && max === 194, `snapshot=${snapshot} max=${max}`);
check("最高编号唯一（194 只有一个文件）", numbered.filter((n) => n === 194).length === 1, "");

console.log(rows.join("\n"));
console.log(`\n小结[static]：${passed} passed / ${failed} failed`);
console.log(`EXIT=${failed === 0 ? 0 : 1}`);
process.exitCode = failed === 0 ? 0 : 1;
