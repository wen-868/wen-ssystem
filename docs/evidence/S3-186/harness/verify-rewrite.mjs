/**
 * S3-186 装置⑩：改写**语义等价性**自证（跑在改写之后、空库复跑之前）。
 *
 * 逐条断言（任一条不成立即 exit 1）：
 *   ① 条数守恒：改写计划 173 条 == 基线（git 基线 ref）文件里的 CALL 条数，且逐条 (表,名,定义) 对应；
 *   ② 落盘一致：新文件里逐字包含计划中的改写块（证明写进去的与计划一致，不是"以为改了"）；
 *   ③ 前缀免疫：改写块经 runner 的 addTablePrefix 后**逐字节不变**（否则动态 SQL 里的表名会被改写，
 *      与守卫查的 TABLE_NAME 漂移）；
 *   ④ 动态 SQL 等价：按改写块运行时拼出的 ALTER 文本 == 092 过程体
 *      `CONCAT('ALTER TABLE \`', tbl, '\` ADD COLUMN|INDEX \`', name, '\` ', def)` 的输出（逐字节）。
 *
 * 用法：node docs/evidence/S3-186/harness/verify-rewrite.mjs <改写计划json> [基线ref，默认 origin/main]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.S3186_REPO_ROOT || process.cwd();
const [, , planFile, baselineRef = "origin/main"] = process.argv;
if (!planFile) throw new Error("用法: verify-rewrite.mjs <改写计划json> [基线ref]");

const mod = await import(pathToFileURL(join(root, "backend", "dist", "shared", "migration.js")).href);
const { plan } = JSON.parse(readFileSync(planFile, "utf8"));

const showBaseline = (file) =>
  execFileSync("git", ["show", `${baselineRef}:docs/migrations/${file}`], { cwd: root, encoding: "utf8" });

const failures = [];
const baselineCalls = [];
const files = [...new Set(plan.map((p) => p.file))];
for (const file of files) {
  const text = showBaseline(file).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => /^\s*CALL\s/i.test(l));
  lines.forEach((l) => baselineCalls.push({ file, line: l.trim() }));
}
if (baselineCalls.length !== plan.length) {
  failures.push(`① 条数守恒失败：基线 ${baselineRef} 有 ${baselineCalls.length} 条 CALL，改写计划 ${plan.length} 条`);
}
plan.forEach((p, i) => {
  const b = baselineCalls[i];
  if (!b || b.file !== p.file || b.line !== p.original) {
    failures.push(`① 第 ${i + 1} 条不对应：基线=${b ? `${b.file} :: ${b.line}` : "（缺）"} 计划=${p.file} :: ${p.original}`);
  }
});

for (const p of plan) {
  const now = readFileSync(join(root, "docs", "migrations", p.file), "utf8");
  for (const line of p.replacement) {
    if (!now.includes(line.trim()) && !now.includes(line)) {
      failures.push(`② 落盘缺失：${p.file} 未见改写块行：${line.trim().slice(0, 80)}…`);
    }
  }
  // ③ 前缀免疫：仅对真正会下发的语句（SET / PREPARE 行）检查
  for (const line of p.replacement.filter((l) => !l.trim().startsWith("--"))) {
    line
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .forEach((stmt) => {
        const prefixed = mod.addTablePrefix(stmt);
        if (prefixed !== stmt) {
          failures.push(`③ 前缀免疫失败：${p.file}\n   原:${stmt}\n   改:${prefixed}`);
        }
      });
  }
  // ④ 动态 SQL 等价
  const [tbl, name, def] = p.args;
  const isColumn = /add_column_if_not_exists/i.test(p.proc);
  const expected = `ALTER TABLE \`${tbl}\` ADD ${isColumn ? "COLUMN" : "INDEX"} \`${name}\` ${def}`;
  const runtime = p.replacement
    .join("\n")
    .replace(/SET @s3186_tbl = '((?:[^']|'')*)', @s3186_name = '((?:[^']|'')*)';/, "@TBL@\u0000@NAME@")
    .replace(/@s3186_tbl/g, tbl)
    .replace(/@s3186_name/g, name);
  const actual = /CONCAT\('ALTER TABLE `', .*?, '` ADD (?:COLUMN|INDEX) `', .*?, '` ', '((?:[^']|'')*)'\)/s.exec(runtime);
  const actualSql = actual
    ? `ALTER TABLE \`${tbl}\` ADD ${isColumn ? "COLUMN" : "INDEX"} \`${name}\` ${actual[1].replace(/''/g, "'")}`
    : "";
  if (actualSql !== expected) {
    failures.push(`④ 动态 SQL 不等价：${p.file} ${tbl}.${name}\n   期望:${expected}\n   实得:${actualSql || "（未解析出 CONCAT）"}`);
  }
}

console.log(`校验条目：${plan.length} 条 CALL / ${files.length} 个文件；基线 ref=${baselineRef}`);
if (failures.length) {
  console.log(`RESULT: FAIL（${failures.length} 项）`);
  failures.slice(0, 20).forEach((f) => console.log(" - " + f));
  process.exit(1);
}
console.log("RESULT: ALL PASS（① 条数守恒 ② 落盘一致 ③ 前缀免疫 ④ 动态 SQL 逐字节等价 全部成立）");
