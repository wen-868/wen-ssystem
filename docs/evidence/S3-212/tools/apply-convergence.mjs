#!/usr/bin/env node
/**
 * S3-212 收敛执行器（按字符偏移逐处替换「类型 token」，其余字节不动）
 *
 * 用法：node apply-convergence.mjs <repo> <corpus-scan.json> <plan.json> <outEditsJson> [-Apply]
 *   默认 dry-run（只打印 + 写 edits 清单）；带 -Apply 才落盘。
 *
 * 安全约束：
 *   1) 每处替换前断言 [typeStart,typeEnd) 的当前切片 === 扫描时记录的原 token（不一致即中止，EXIT=1）；
 *   2) 只替换"类型 token"这一段，不触碰列名/约束/注释/行尾/文件末换行；
 *   3) 每个文件按偏移倒序替换，避免偏移漂移；
 *   4) 目标值必须与该组目标完全一致，否则中止。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const apply = args.includes("-Apply");
const [repo, scanPath, planPath, outEdits] = args.filter((a) => a !== "-Apply");
if (!repo || !scanPath || !planPath || !outEdits) {
  console.error("用法: node apply-convergence.mjs <repo> <corpus-scan.json> <plan.json> <outEditsJson> [-Apply]");
  process.exit(2);
}

const scan = JSON.parse(readFileSync(scanPath, "utf8"));
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const targets = new Map(Object.entries(plan.targets));

// 收集待改处：按 (table, column) 从 scan.divergences 取偏移
const edits = [];
for (const g of scan.divergences) {
  const target = targets.get(`${g.table}.${g.column}`);
  if (!target) continue;
  for (const v of g.variants) {
    if (v.sig.toUpperCase().replace(/\s+/g, " ") === target) continue;
    for (const w of v.where) {
      edits.push({
        file: w.file,
        line: w.line,
        table: g.table,
        column: g.column,
        from: w.typeToken,
        to: target,
        typeStart: w.typeStart,
        typeEnd: w.typeEnd,
      });
    }
  }
}

const byFile = new Map();
for (const e of edits) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

let bad = 0;
const applied = [];
for (const [file, list] of byFile) {
  const abs = join(repo, file.replace(/\//g, "\\"));
  const text = readFileSync(abs, "utf8");
  list.sort((a, b) => b.typeStart - a.typeStart);
  let out = text;
  for (const e of list) {
    const slice = out.slice(e.typeStart, e.typeEnd);
    if (slice !== e.from) {
      // 已被同文件更靠后的替换影响（偏移倒序后不应发生）或扫描口径不符
      console.error(`[中止] ${file}:${e.line} ${e.table}.${e.column} 期望原文 "${e.from}"，实得 "${slice}"`);
      bad++;
      continue;
    }
    out = out.slice(0, e.typeStart) + e.to + out.slice(e.typeEnd);
    applied.push(e);
  }
  if (bad === 0 && apply) {
    writeFileSync(abs, out, "utf8");
  }
}

writeFileSync(
  outEdits,
  JSON.stringify({ apply, badCount: bad, editCount: applied.length, edits: applied }, null, 1),
  "utf8"
);
console.log(`${apply ? "已写入" : "dry-run"}：待改 ${edits.length} 处，实际替换 ${applied.length} 处，校验失败 ${bad} 处`);
if (!apply) {
  for (const e of applied.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line))) {
    console.log(`  ${e.file}:${e.line}  ${e.table}.${e.column}  ${e.from} -> ${e.to}`);
  }
}
console.log(`[写出] ${outEdits}`);
if (bad > 0) process.exit(1);
