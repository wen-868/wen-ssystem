/**
 * S3-186 装置③：比对两份结构快照，输出**差异数**与差异明细（判断"空库是否与基线一致"）。
 *
 * 用法：node docs/evidence/S3-186/harness/diff.mjs <基线json> <被测json> [明细输出路径]
 * 退出码：差异 0 ⇒ 0；有差异 ⇒ 1。
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , baseFile, testFile, detailFile] = process.argv;
if (!baseFile || !testFile) throw new Error("用法: diff.mjs <基线json> <被测json> [明细输出路径]");

const base = JSON.parse(readFileSync(baseFile, "utf8"));
const test = JSON.parse(readFileSync(testFile, "utf8"));

const colKey = (c) => `${c.TABLE_NAME}.${c.COLUMN_NAME}`;
const colDef = (c) =>
  `${c.COLUMN_TYPE}|${c.IS_NULLABLE}|${c.COLUMN_DEFAULT === null ? "NULL" : String(c.COLUMN_DEFAULT)}|${c.EXTRA}|${c.COLUMN_COMMENT}`;
const idxKey = (i) => `${i.TABLE_NAME}.${i.INDEX_NAME}`;

const mapBy = (arr, key) => new Map(arr.map((x) => [key(x), x]));

const baseTables = mapBy(base.tables, (t) => t.TABLE_NAME);
const testTables = mapBy(test.tables, (t) => t.TABLE_NAME);
const baseCols = mapBy(base.columns, colKey);
const testCols = mapBy(test.columns, colKey);
const baseIdx = mapBy(base.indexes, idxKey);
const testIdx = mapBy(test.indexes, idxKey);

const onlyIn = (a, b) => [...a.keys()].filter((k) => !b.has(k)).sort();

const missingTables = onlyIn(baseTables, testTables); // 基线有、被测缺
const extraTables = onlyIn(testTables, baseTables);
const missingCols = onlyIn(baseCols, testCols);
const extraCols = onlyIn(testCols, baseCols);
const missingIdx = onlyIn(baseIdx, testIdx);
const extraIdx = onlyIn(testIdx, baseIdx);

const defDiff = [];
for (const [k, b] of baseCols) {
  const t = testCols.get(k);
  if (t && colDef(b) !== colDef(t)) defDiff.push(`${k}: 基线[${colDef(b)}] 被测[${colDef(t)}]`);
}

const routines = {
  base: base.routines.map((r) => r.ROUTINE_NAME),
  test: test.routines.map((r) => r.ROUTINE_NAME),
};

const total =
  missingTables.length +
  extraTables.length +
  missingCols.length +
  extraCols.length +
  missingIdx.length +
  extraIdx.length +
  defDiff.length;

const lines = [];
lines.push(`基线: ${baseFile} (db=${base.db}) tables=${base.counts.tables} columns=${base.counts.columns} indexes=${base.counts.indexes} routines=${base.counts.routines}`);
lines.push(`被测: ${testFile} (db=${test.db}) tables=${test.counts.tables} columns=${test.counts.columns} indexes=${test.counts.indexes} routines=${test.counts.routines}`);
lines.push("");
lines.push(`差异合计 = ${total}`);
lines.push(` 缺表 ${missingTables.length} / 多表 ${extraTables.length}`);
lines.push(` 缺列 ${missingCols.length} / 多列 ${extraCols.length}`);
lines.push(` 缺索引 ${missingIdx.length} / 多索引 ${extraIdx.length}`);
lines.push(` 列定义不一致 ${defDiff.length}`);
lines.push(` 存储过程残留（基线 ${routines.base.length} / 被测 ${routines.test.length}）`);
const sect = (title, arr) => {
  lines.push("");
  lines.push(`## ${title}（${arr.length}）`);
  lines.push(...arr.slice(0, 200));
  if (arr.length > 200) lines.push(`… 其余 ${arr.length - 200} 条见 json`);
};
sect("缺表（基线有、被测无）", missingTables);
sect("多表（被测多出）", extraTables);
sect("缺列（基线有、被测无）", missingCols);
sect("多列（被测多出）", extraCols);
sect("缺索引", missingIdx);
sect("多索引", extraIdx);
sect("列定义不一致", defDiff);
lines.push("");
lines.push(`存储过程残留 基线=[${routines.base.join(",")}] 被测=[${routines.test.join(",")}]`);

const report = lines.join("\n");
console.log(report);
if (detailFile) writeFileSync(detailFile, report, "utf8");
process.exit(total === 0 ? 0 : 1);
