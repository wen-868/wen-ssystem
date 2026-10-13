/**
 * S3-186 装置⑨：把 173 条 `CALL add_column_if_not_exists / add_index_if_not_exists` 逐条改写成
 * **不依赖存储过程的幂等写法**（information_schema 守卫 + PREPARE/EXECUTE，与 081/196 同款）。
 *
 * 为什么必须改写（两条独立成因，任一都让补列静默失效）：
 *   ① MIG-4 写闸门默认 block，把 `CALL` 当数据写语句整条挡下（173 条一条不执行，只留 WARN 日志）；
 *   ② 092 末尾 `DROP PROCEDURE` 之后两个辅助过程再未重建 ⇒ 即使显式 allow，其后的 35 条 CALL 也全部
 *      `ER_SP_DOES_NOT_EXIST` 静默跳过。
 * 改写后的语句首关键字是 SET ⇒ 结构语句，默认闸门下可执行（无需 MIGRATION_WRITE_GATE=allow），
 * 且不依赖任何存储过程。
 *
 * 用法：node docs/evidence/S3-186/harness/rewrite-calls.mjs [--apply]
 *   不带 --apply 时只打印将要改写的条数与样例（dry-run）。
 * 语义等价性：守卫条件 / 动态 SQL 文本 / 静默跳过行为与 092 里两个过程体逐字对应（见 docs/evidence/S3-186/README.md）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.S3186_REPO_ROOT || process.cwd();
const apply = process.argv.includes("--apply");
const migrationDir = join(root, "docs", "migrations");

const TARGET_FILES = [
  "092_租户ID.sql",
  "120a_合规凭证字段.sql",
  "123_member_contact.sql",
  "125_instant_retail_admin_fix.sql",
  "129_sale_bill_item_compliance.sql",
  "132_product_box_barcode.sql",
  "134_sale_bill_role_fields.sql",
  "137_sys_user_dept_position.sql",
  "138_approval_business_link.sql",
];

const CALL_RE =
  /^(\s*)CALL\s+(add_column_if_not_exists|add_index_if_not_exists)\s*\(([\s\S]*)\)\s*;\s*$/i;

/** 解析 SQL 字面量（'…' 或 "…"），处理 \\ 转义与 '' 双写 */
function parseLiteral(raw) {
  const text = raw.trim();
  const quote = text[0];
  if ((quote !== "'" && quote !== '"') || text[text.length - 1] !== quote) {
    throw new Error(`参数不是字符串字面量：${raw}`);
  }
  const body = text.slice(1, -1);
  let out = "";
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "\\") {
      out += body[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (ch === quote && body[i + 1] === quote) {
      out += quote;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/** 顶层逗号切分（忽略字符串字面量内的逗号） */
function splitArgs(text) {
  const args = [];
  let buf = "";
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      buf += ch;
      if (ch === "\\") {
        buf += text[i + 1] ?? "";
        i += 1;
        continue;
      }
      if (ch === quote) {
        if (text[i + 1] === quote) {
          buf += text[i + 1];
          i += 1;
          continue;
        }
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === ",") {
      args.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim().length > 0) args.push(buf);
  return args;
}

const q = (value) => `'${value.replace(/'/g, "''")}'`;

function buildReplacement(indent, proc, args, originalLine) {
  const [tbl, name, def] = args.map(parseLiteral);
  const isColumn = /add_column_if_not_exists/i.test(proc);
  // 运行时动态 SQL 与 092 过程体逐字一致：ALTER TABLE `tbl` ADD COLUMN|INDEX `name` <def>
  // 关键：表名/列名走 @变量 拼接，**不把 `名字` 直接写进字符串字面量** ——
  // 否则 runner 的 addTablePrefix 会把字面量里的裸表名（如 sys_config）改写成 t_sys_config，
  // 与守卫查的 TABLE_NAME 不一致（守卫查 sys_config、ALTER 打 t_sys_config）⇒ 语义漂移。
  const alterHead = `CONCAT('ALTER TABLE \`', @s3186_tbl, '\` ADD ${
    isColumn ? "COLUMN" : "INDEX"
  } \`', @s3186_name, '\` ', `;
  const skipSql = `SELECT '跳过 ${tbl}.${name}' AS result`;
  const source = isColumn ? "information_schema.COLUMNS" : "information_schema.STATISTICS";
  const nameColumn = isColumn ? "COLUMN_NAME" : "INDEX_NAME";
  const guarded =
    `SET @s3186_sql = (SELECT IF(COUNT(*) = 0, ${alterHead}${q(def)}), ${q(skipSql)})` +
    ` FROM ${source} WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND ${nameColumn} = @s3186_name);`;
  return [
    `${indent}-- S3-186：原 ${originalLine.trim()}（改为不依赖存储过程的幂等写法：守卫 ${source} + PREPARE/EXECUTE，语义与 092 过程体逐字对应）`,
    `${indent}SET @s3186_tbl = ${q(tbl)}, @s3186_name = ${q(name)};`,
    `${indent}${guarded}`,
    `${indent}PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;`,
  ];
}

let totalRewritten = 0;
let totalFiles = 0;
const samples = [];
const plan = [];
for (const file of TARGET_FILES) {
  const path = join(migrationDir, file);
  const text = readFileSync(path, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const out = [];
  let rewritten = 0;
  for (const line of lines) {
    const m = CALL_RE.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const args = splitArgs(m[3]);
    if (args.length !== 3) throw new Error(`${file}: CALL 参数不是 3 个：${line}`);
    const replacement = buildReplacement(m[1], m[2], args, line);
    out.push(...replacement);
    rewritten += 1;
    plan.push({
      file,
      original: line.trim(),
      args: args.map(parseLiteral),
      proc: m[2],
      replacement,
    });
    if (samples.length < 3) samples.push({ file, original: line.trim(), replacement });
  }
  if (rewritten > 0) {
    totalFiles += 1;
    totalRewritten += rewritten;
    console.log(`${apply ? "改写" : "将改写"} ${file}：${rewritten} 条`);
    if (apply) writeFileSync(path, out.join(eol), "utf8");
  }
}

console.log(`\n${apply ? "已改写" : "待改写"}：${totalFiles} 个文件 / ${totalRewritten} 条 CALL`);
const planOut = process.argv.find((a) => a.startsWith("--plan="));
if (planOut) {
  const planPath = planOut.slice("--plan=".length);
  writeFileSync(planPath, JSON.stringify({ total: totalRewritten, plan }, null, 1), "utf8");
  console.log(`改写计划已落盘：${planPath}`);
}
console.log("\n样例（前 3 条）：");
for (const s of samples) {
  console.log(`--- ${s.file} ---`);
  console.log(`- ${s.original}`);
  s.replacement.forEach((l) => console.log(`+ ${l}`));
}
