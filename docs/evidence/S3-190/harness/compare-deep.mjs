/**
 * S3-186 装置⑬：**深比对**两份快照——除"有没有"之外，还比：
 *   ① 列顺序（ORDINAL_POSITION）：生产上"历史 ALTER 的执行顺序"决定列序，灾备重建要与之一致；
 *   ② 索引组成（同表同名的索引，其列清单/唯一性/类型是否一致）。
 * diff.mjs 只比"存在性与列定义"，本脚本补上它覆盖不到的两项。
 *
 * 用法：node docs/evidence/S3-186/harness/compare-deep.mjs <A快照> <B快照>
 * 退出码：差异 0 ⇒ 0；有差异 ⇒ 1。
 */
import { readFileSync } from "node:fs";

const [, , aFile, bFile] = process.argv;
const A = JSON.parse(readFileSync(aFile, "utf8"));
const B = JSON.parse(readFileSync(bFile, "utf8"));

const colKey = (c) => `${c.TABLE_NAME}.${c.COLUMN_NAME}`;
const idxKey = (i) => `${i.TABLE_NAME}.${i.INDEX_NAME}`;
const colA = new Map(A.columns.map((c) => [colKey(c), c]));
const colB = new Map(B.columns.map((c) => [colKey(c), c]));

const posDiff = [];
for (const [k, a] of colA) {
  const b = colB.get(k);
  if (b && a.ORDINAL_POSITION !== b.ORDINAL_POSITION) {
    posDiff.push(`${k}: A#${a.ORDINAL_POSITION} vs B#${b.ORDINAL_POSITION}`);
  }
}

const group = (snap) => {
  const m = new Map();
  for (const i of snap.indexes) {
    const k = idxKey(i);
    if (!m.has(k)) m.set(k, { nonUnique: i.NON_UNIQUE, type: i.INDEX_TYPE, cols: [] });
    m.get(k).cols.push(`${i.SEQ_IN_INDEX}:${i.COLUMN_NAME}`);
  }
  return m;
};
const idxA = group(A);
const idxB = group(B);
const idxDiff = [];
for (const [k, a] of idxA) {
  const b = idxB.get(k);
  if (!b) continue;
  const sig = (x) => `${x.nonUnique}|${x.type}|${x.cols.join(",")}`;
  if (sig(a) !== sig(b)) idxDiff.push(`${k}: A[${sig(a)}] vs B[${sig(b)}]`);
}

console.log(`A=${aFile}`);
console.log(`B=${bFile}`);
console.log(`列顺序不一致 ${posDiff.length} 条 / 同名索引组成不一致 ${idxDiff.length} 条`);
posDiff.slice(0, 40).forEach((x) => console.log("  POS " + x));
idxDiff.slice(0, 40).forEach((x) => console.log("  IDX " + x));
process.exit(posDiff.length + idxDiff.length === 0 ? 0 : 1);
