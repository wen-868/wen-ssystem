/**
 * S3-190 装置①：第 53 项——把 24 条"表名缺 t_ 前缀"的补列/补索引语句补齐前缀。
 *
 * 背景（已取证）：S3-186 把这批 `CALL add_column_if_not_exists('sys_config', …)` 改写成
 * information_schema 守卫 + PREPARE/EXECUTE 时"语义按原样保留"，其中 24 条传的表名**不带 t_ 前缀**
 * （092 的 sys_* 6 张、120a 的 sale_bill_item/sale_bill/collection_link、137/138 的 sys_user/purchase_order/sale_return），
 * 而 092 原文的辅助过程把 tbl_name **原样**拼进 `ALTER TABLE`⇒ 恒 ER_NO_SUCH_TABLE，这 24 条从未生效。
 *
 * 本装置**只改表名**（列定义 / 索引定义 / 守卫条件 / 动态 SQL 语义一字未改），且只动下列 24 个
 * (文件, 表, 列) 组合——不改别的行、不改别的文件。
 *
 * 用法：
 *   node docs/evidence/S3-190/harness/fix-prefix.mjs --prefix   [<仓库根>]   # 24 条补前缀（修复方向）
 *   node docs/evidence/S3-190/harness/fix-prefix.mjs --unprefix [<仓库根>]   # 24 条去掉前缀（反测 F1 退回方向）
 *   node docs/evidence/S3-190/harness/fix-prefix.mjs --list     [<仓库根>]   # 只列出 24 条与当前落盘形态（不写文件）
 *
 * 仓库根解析顺序：argv[3] > 环境变量 S3190_REPO_ROOT > 当前工作目录（**报告中会打印实际使用的仓库根**，
 * 并在写盘后**回读文件**核对落盘结果——避免"改错工作树还不知道"，本装置的初版正是在这一点上翻过车）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const mode = process.argv[2];
if (!["--prefix", "--unprefix", "--list"].includes(mode)) {
  throw new Error("用法: fix-prefix.mjs --prefix|--unprefix|--list [<仓库根>]");
}
const repoArg = process.argv[3] || process.env.S3190_REPO_ROOT || process.cwd();
if (repoArg.startsWith("--")) {
  throw new Error(`仓库根不能是开关（收到 ${repoArg}）：请写 fix-prefix.mjs ${mode} <仓库根>`);
}
const repo = resolve(repoArg);

/** 24 条（文件 + 语句里的表名 + 列/索引名），逐条来自对 4 个文件的机器扫描 */
const TARGETS = [
  { file: "092_租户ID.sql", table: "sys_config", name: "tenant_id" },
  { file: "092_租户ID.sql", table: "sys_user", name: "tenant_id" },
  { file: "092_租户ID.sql", table: "sys_role", name: "tenant_id" },
  { file: "092_租户ID.sql", table: "sys_permission", name: "tenant_id" },
  { file: "092_租户ID.sql", table: "sys_user_role", name: "tenant_id" },
  { file: "092_租户ID.sql", table: "sys_role_permission", name: "tenant_id" },
  { file: "092_租户ID.sql", table: "sys_config", name: "idx_sys_config_tenant" },
  { file: "092_租户ID.sql", table: "sys_user", name: "idx_sys_user_tenant" },
  { file: "092_租户ID.sql", table: "sys_role", name: "idx_sys_role_tenant" },
  { file: "092_租户ID.sql", table: "sys_permission", name: "idx_sys_permission_tenant" },
  { file: "092_租户ID.sql", table: "sys_user_role", name: "idx_sys_user_role_tenant" },
  { file: "092_租户ID.sql", table: "sys_role_permission", name: "idx_sys_role_permission_tenant" },
  { file: "120a_合规凭证字段.sql", table: "sale_bill_item", name: "unit" },
  { file: "120a_合规凭证字段.sql", table: "sale_bill_item", name: "barcode" },
  { file: "120a_合规凭证字段.sql", table: "sale_bill_item", name: "spec" },
  { file: "120a_合规凭证字段.sql", table: "sale_bill", name: "store_name" },
  { file: "120a_合规凭证字段.sql", table: "sale_bill", name: "store_address" },
  { file: "120a_合规凭证字段.sql", table: "sale_bill", name: "store_contact" },
  { file: "120a_合规凭证字段.sql", table: "collection_link", name: "display_config" },
  { file: "120a_合规凭证字段.sql", table: "collection_link", name: "document_title" },
  { file: "137_sys_user_dept_position.sql", table: "sys_user", name: "department_id" },
  { file: "137_sys_user_dept_position.sql", table: "sys_user", name: "position_id" },
  { file: "138_approval_business_link.sql", table: "purchase_order", name: "approval_instance_no" },
  { file: "138_approval_business_link.sql", table: "sale_return", name: "approval_instance_no" },
];

const relPath = (f) => join("docs", "migrations", f);
const grouped = new Map();
for (const t of TARGETS) {
  if (!grouped.has(t.file)) grouped.set(t.file, []);
  grouped.get(t.file).push(t);
}

let changedLines = 0;
let changedBlocks = 0;
const report = [];

for (const [file, targets] of grouped) {
  const p = join(repo, relPath(file));
  const original = readFileSync(p, "utf8");
  const lines = original.split("\n");
  for (const t of targets) {
    const from = mode === "--unprefix" ? `t_${t.table}` : t.table;
    const to = mode === "--unprefix" ? t.table : `t_${t.table}`;
    // ① 执行行：SET @s3186_tbl = '<表名>', @s3186_name = '<列/索引名>';
    const execFrom = `SET @s3186_tbl = '${from}', @s3186_name = '${t.name}';`;
    const execTo = `SET @s3186_tbl = '${to}', @s3186_name = '${t.name}';`;
    // ② 同块的"已存在则跳过"标签：SELECT '跳过 <表名>.<列/索引名>' AS result
    const labelFrom = `'跳过 ${from}.${t.name}'`;
    const labelTo = `'跳过 ${to}.${t.name}'`;
    let hits = 0;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const cr = raw.endsWith("\r") ? "\r" : ""; // 兼容 CRLF：比较时剥离行尾 \r，写回时保留
      const text = cr ? raw.slice(0, -1) : raw;
      if (text === execFrom) {
        lines[i] = execTo + cr;
        hits += 1;
        changedLines += 1;
      } else if (text.includes(labelFrom)) {
        lines[i] = text.split(labelFrom).join(labelTo) + cr;
        hits += 1;
        changedLines += 1;
      }
    }
    if (hits === 0) {
      report.push(`未命中（已是目标形态或文本不符）: ${file} ${from}.${t.name}`);
    } else {
      changedBlocks += 1;
    }
  }
  const updated = lines.join("\n");
  if (mode !== "--list" && updated !== original) writeFileSync(p, updated, "utf8");
  const setLines = lines.filter((l) => l.startsWith("SET @s3186_tbl = '"));
  const withPrefix = setLines.filter((l) => /^SET @s3186_tbl = 't_/.test(l)).length;
  report.push(
    `${file}: 本单目标 ${targets.length} 条；写盘后全文 SET @s3186_tbl 行 = ${setLines.length}（带 t_ 前缀 ${withPrefix} / 缺前缀 ${setLines.length - withPrefix}）`
  );
}

console.log(`MODE=${mode} TARGETS=${TARGETS.length} REPO=${repo}`);
console.log(report.join("\n"));
console.log(`改动块数=${changedBlocks} 改动行数=${changedLines}`);
if (mode === "--list") {
  console.log("（--list：未写盘）");
} else {
  // 写盘后回读核对：24 条目标是否真的都到了预期形态
  let bad = 0;
  for (const t of TARGETS) {
    const wantTable = mode === "--unprefix" ? t.table : `t_${t.table}`;
    const text = readFileSync(join(repo, relPath(t.file)), "utf8");
    if (!text.includes(`SET @s3186_tbl = '${wantTable}', @s3186_name = '${t.name}';`)) {
      bad += 1;
    }
  }
  console.log(`落盘回读核对：未达预期形态 ${bad} / ${TARGETS.length} 条`);
  if (bad > 0) process.exit(2);
}
