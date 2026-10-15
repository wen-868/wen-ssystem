#!/usr/bin/env node
/**
 * S3-212 收敛计划生成（只读）
 *
 * 用法：node plan-convergence.mjs <corpus-scan.json> <runtime-columns.tsv> <outPlanJson> [outMd]
 *
 * runtime-columns.tsv：由 mysql 客户端导出，列顺序为
 *   TABLE_NAME \t COLUMN_NAME \t COLUMN_TYPE （`--batch --raw`，无表头）
 *
 * 目标值决策（卡面 §二.2）：
 *   1) 生产真值不可达（本工作区无生产库/无副本库，见证据 README §一）⇒ 采用"运行期真值"：
 *      用同一套语料在全新 MySQL 8 空库跑完后 information_schema.COLUMNS 的原文
 *      （= 该语料真实产出的结构 = 与生产同源的口径）；
 *   2) 运行期取不到该列（表/列不存在）⇒ 回退"最窄即最兼容"：取该组变体中**最窄**的一个
 *      （字符串按长度最小、整数按取值范围最小，ENUM 视为最窄），并在报告里逐条标注。
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , scanPath, runtimeTsv, outPlan, outMd] = process.argv;
if (!scanPath || !runtimeTsv || !outPlan) {
  console.error("用法: node plan-convergence.mjs <corpus-scan.json> <runtime-columns.tsv> <outPlanJson> [outMd]");
  process.exit(2);
}

const scan = JSON.parse(readFileSync(scanPath, "utf8"));
const runtime = new Map();
for (const line of readFileSync(runtimeTsv, "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const [t, c, type] = line.split("\t");
  if (!t || !c || !type) continue;
  runtime.set(`${t.toLowerCase()}.${c.toLowerCase()}`, type.trim());
}

const canon = (type) => {
  const m = /^([A-Za-z]+)(.*)$/.exec(type.trim());
  if (!m) return type.trim().toUpperCase();
  let rest = m[2];
  if (/^\s*\(\s*\)/.test(rest)) rest = "";
  rest = rest.replace(/\s*unsigned\s*$/i, " UNSIGNED");
  if (!/unsigned/i.test(rest) && /integer|int|bigint|smallint|tinyint|mediumint/i.test(m[1]) === false) rest = rest.replace(/\s*unsigned\s*/i, "");
  return (m[1] + rest).replace(/\s+/g, " ").trim().toUpperCase();
};

// 字符串列宽 / 整数位宽，用于"最窄"回退
const widthOf = (sig) => {
  const s = sig.toUpperCase();
  const strM = /^(VARCHAR|CHAR|VARBINARY|BINARY)\((\d+)\)$/.exec(s);
  if (strM) return Number(strM[2]);
  const decM = /^(DECIMAL|NUMERIC)\((\d+),(\d+)\)$/.exec(s);
  if (decM) return Number(decM[2]) * 100 + Number(decM[3]);
  const intRank = { TINYINT: 1, SMALLINT: 2, MEDIUMINT: 3, INT: 4, INTEGER: 4, BIGINT: 5 };
  const intM = /^([A-Z]+)(?:\(\d+\))?( UNSIGNED)?$/.exec(s);
  if (intM && intRank[intM[1]]) return intRank[intM[1]] * 100 + (intM[2] ? 1 : 0);
  if (/^ENUM/.test(s)) return 1;
  return 9999;
};

const rows = [];
for (const g of scan.divergences) {
  const key = `${g.table.toLowerCase()}.${g.column.toLowerCase()}`;
  const rt = runtime.get(key) ?? null;
  const variants = g.variants.map((v) => ({
    sig: v.sig,
    count: v.where.length,
    effective: v.where.some((w) => w.effective),
    places: v.where.map((w) => `${w.file}:${w.line}${w.effective ? "(有效)" : ""}`),
  }));
  let target;
  let basis;
  if (rt) {
    target = canon(rt);
    const hit = variants.find((v) => v.sig.toUpperCase().replace(/\s+/g, " ") === target);
    basis = hit ? `运行期真值 = 变体「${hit.sig}」` : `运行期真值（不等于任何语料变体，需核对）`;
  } else {
    const sorted = [...variants].sort((a, b) => widthOf(a.sig) - widthOf(b.sig) || a.sig.localeCompare(b.sig));
    target = sorted[0].sig.toUpperCase();
    basis = `运行期取不到 ⇒ 最窄回退（候选宽度 ${sorted.map((v) => `${v.sig}=${widthOf(v.sig)}`).join(", ")}）`;
  }
  const changed = variants.filter((v) => v.sig.toUpperCase() !== target);
  rows.push({
    table: g.table,
    column: g.column,
    runtimeType: rt,
    variants,
    target,
    basis,
    occurrencesToChange: changed.flatMap((v) => v.places),
    effectiveVariant: variants.find((v) => v.effective)?.sig ?? null,
    targetEqualsEffective: (variants.find((v) => v.effective)?.sig.toUpperCase() ?? null) === target,
  });
}

const plan = { generatedFrom: { scanPath, runtimeTsv }, groups: rows, targets: {} };
for (const r of rows) plan.targets[`${r.table}.${r.column}`] = r.target;
writeFileSync(outPlan, JSON.stringify(plan, null, 1), "utf8");

if (outMd) {
  const lines = [];
  lines.push(`# S3-212 收敛计划（组数 ${rows.length}）`);
  lines.push("");
  lines.push("| # | 表.列 | 运行期真值 | 变体 | 目标 | 依据 | 需改处数 | 目标=有效定义 |");
  lines.push("|---:|---|---|---|---|---|---:|:--:|");
  rows.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.table}.${r.column} | ${r.runtimeType ?? "（无）"} | ${r.variants
        .map((v) => `\`${v.sig}\`×${v.count}${v.effective ? "(有效)" : ""}`)
        .join(" / ")} | \`${r.target}\` | ${r.basis} | ${r.occurrencesToChange.length} | ${r.targetEqualsEffective ? "是" : "否"} |`
    );
  });
  lines.push("");
  lines.push("## 逐组明细（需改处）");
  lines.push("");
  rows.forEach((r, i) => {
    lines.push(`${i + 1}. **${r.table}.${r.column}** → \`${r.target}\`（${r.basis}）`);
    for (const v of r.variants) lines.push(`   - 变体 \`${v.sig}\`：${v.places.join(" ; ")}`);
    lines.push(`   - 需改：${r.occurrencesToChange.join(" ; ") || "（无需改动）"}`);
  });
  writeFileSync(outMd, lines.join("\n"), "utf8");
}

const withRuntime = rows.filter((r) => r.runtimeType).length;
console.log(`groups=${rows.length} 运行期有真值=${withRuntime} 回退=${rows.length - withRuntime} 需改处总数=${rows.reduce((a, r) => a + r.occurrencesToChange.length, 0)}`);
console.log(`[写出] ${outPlan}${outMd ? " / " + outMd : ""}`);
