/**
 * S3-186 装置⑧：把"缺索引"分成①功能重复（同表同列、只是索引名不同）与②真缺失（无等价索引），
 * 并把"缺列"按表归类，便于判断影响面。
 *
 * 用法：node docs/evidence/S3-186/harness/analyze-gap.mjs <被测快照json> <基线快照json>
 */
import { readFileSync } from "node:fs";

const [, , aFile, bFile] = process.argv;
const A = JSON.parse(readFileSync(aFile, "utf8")); // 被测（空库现状）
const B = JSON.parse(readFileSync(bFile, "utf8")); // 基线（语料意图）

const idxKey = (i) => `${i.TABLE_NAME}.${i.INDEX_NAME}`;
const colDef = (c) => `${c.COLUMN_TYPE}|${c.IS_NULLABLE}|${c.COLUMN_DEFAULT === null ? "NULL" : String(c.COLUMN_DEFAULT)}|${c.EXTRA}|${c.COLUMN_COMMENT}`;
const colKey = (c) => `${c.TABLE_NAME}.${c.COLUMN_NAME}`;

const mapIdx = (snap) => {
  const m = new Map();
  for (const i of snap.indexes) {
    const k = idxKey(i);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  }
  for (const [k, rows] of m) m.set(k, rows.sort((x, y) => x.SEQ_IN_INDEX - y.SEQ_IN_INDEX).map((r) => `${r.COLUMN_NAME}`).join(","));
  return m;
};
const idxA = mapIdx(A);
const idxB = mapIdx(B);
const colA = new Map(A.columns.map((c) => [colKey(c), c]));
const colB = new Map(B.columns.map((c) => [colKey(c), c]));

// 缺失 = 基线有 & 被测无
const missingIdx = [...idxB.keys()].filter((k) => !idxA.has(k));
const duplicateIdx = [];
const realMissingIdx = [];
for (const k of missingIdx) {
  const cols = idxB.get(k);
  const table = k.split(".")[0];
  const same = [...idxA.entries()].filter(([k2, cols2]) => k2.split(".")[0] === table && cols2 === cols);
  (same.length ? duplicateIdx : realMissingIdx).push(`${k}(${cols})${same.length ? " ≈ 等价索引 " + same.map(([k2]) => k2.split(".")[1]).join("/") : ""}`);
}

const missingCols = [...colB.keys()].filter((k) => !colA.has(k));
const byTable = {};
for (const k of missingCols) {
  const [t, c] = k.split(".");
  (byTable[t] = byTable[t] || []).push(`${c} [${colDef(colB.get(k))}]`);
}

console.log(`被测=${aFile}  基线=${bFile}`);
console.log(`\n## 缺列 ${missingCols.length} 条，涉及 ${Object.keys(byTable).length} 张表`);
for (const [t, cols] of Object.entries(byTable).sort()) {
  console.log(`- ${t}（${cols.length}）：` + cols.join("；"));
}
console.log(`\n## 缺索引 ${missingIdx.length} 条：功能重复 ${duplicateIdx.length} 条 / 真缺失 ${realMissingIdx.length} 条`);
if (duplicateIdx.length) {
  console.log("-- 功能重复（同表同列，仅索引名不同 ⇒ 空库并非缺该索引能力）");
  duplicateIdx.forEach((x) => console.log("   " + x));
}
if (realMissingIdx.length) {
  console.log("-- 真缺失（空库无等价索引）");
  realMissingIdx.forEach((x) => console.log("   " + x));
}
