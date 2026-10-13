/**
 * S3-197 装置⑥（机械改写）：把 092 第3步里**纯重复**的索引名统一到既有规范命名
 * （migration.ts 第2步对 TENANT_TABLES 统一建的 `idx_<表名>_tenant`）。
 *
 * 只改三类位置（不动"原 CALL add_index_if_not_exists(...)"那行历史注释——那是原文留档）：
 *   ① `SET @s3186_tbl = 't_x', @s3186_name = 'idx_x_tenant';` 里的 @s3186_name
 *   ② 同块 `'SELECT ''跳过 t_x.idx_x_tenant'' AS result'` 里的标签
 * 判据：改名后该语句变成 **no-op**（information_schema.STATISTICS 里规范名已存在 ⇒ 守卫跳过），
 * 因此结构变化 = 只少了重复项。
 *
 * 用法：node docs/evidence/S3-197/harness/fix-092-index-names.mjs <仓库根> <rename-set.json> [--apply]
 *   rename-set.json = {"dup":[{"tbl":"t_x","name":"idx_x_tenant"}, …]}（由 pre 库的 STATISTICS 实测生成）
 * 不带 --apply 只做 dry-run 并打印将改动的行数与 sha 前后值。
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [, , repoArg, setArg, applyFlag] = process.argv;
if (!repoArg || !setArg) throw new Error("用法: fix-092-index-names.mjs <仓库根> <rename-set.json> [--apply]");
const repo = resolve(repoArg);
const file = join(repo, "docs", "migrations", "092_租户ID.sql");
const set = JSON.parse(readFileSync(resolve(setArg), "utf8"));
const targets = set.dup || [];
const before = readFileSync(file, "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

let text = before;
let renamed = 0;
for (const { tbl, name } of targets) {
  const canonical = `idx_${tbl}_tenant`;
  // ① SET 行
  const setRe = new RegExp(`(SET @s3186_tbl = '${tbl}', @s3186_name = ')${name}(';)`, "g");
  const cnt1 = (text.match(setRe) || []).length;
  text = text.replace(setRe, `$1${canonical}$2`);
  // ② 跳过标签
  const labelRe = new RegExp(`('SELECT ''跳过 ${tbl}\\.)${name}('' AS result')`, "g");
  const cnt2 = (text.match(labelRe) || []).length;
  text = text.replace(labelRe, `$1${canonical}$2`);
  if (cnt1 !== 1 || cnt2 !== 1) {
    throw new Error(`改名点定位异常：${tbl} / ${name} ⇒ SET 命中 ${cnt1}、标签命中 ${cnt2}（各应恰好 1）`);
  }
  renamed += 1;
}

// 回读断言：改名后，这 62 个规范名必须在文件里出现，且旧名不再作为 @s3186_name 出现
for (const { tbl, name } of targets) {
  const canonical = `idx_${tbl}_tenant`;
  if (!text.includes(`@s3186_name = '${canonical}';`)) throw new Error(`回读失败：缺 ${canonical}`);
  if (text.includes(`@s3186_name = '${name}';`)) throw new Error(`回读失败：旧名仍在 ${name}`);
}
// 未被列入 rename-set 的 7 条（规范名不存在 ⇒ 不是重复项）必须原样保留
for (const { tbl, name } of set.only || []) {
  if (!text.includes(`@s3186_name = '${name}';`)) throw new Error(`回读失败：非重复项被误改 ${tbl}.${name}`);
}

console.log(`仓库 = ${repo}`);
console.log(`092 路径 = ${file}`);
console.log(`rename-set 条数 = ${targets.length}（实测"规范名与语料名同时存在"的纯重复项）`);
console.log(`未列入（规范名不存在、非重复项，原样保留） = ${(set.only || []).length}`);
console.log(`已改名块数 = ${renamed}`);
console.log(`sha256(16) 前 = ${sha(before)}  后 = ${sha(text)}`);
if (applyFlag === "--apply") {
  writeFileSync(file, text, "utf8");
  console.log("已写盘（--apply）");
} else {
  console.log("dry-run（未写盘；要落盘请加 --apply）");
}
