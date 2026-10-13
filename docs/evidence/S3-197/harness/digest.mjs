/**
 * S3-186 装置⑫：把结构快照压成"摘要"（条数 + 结构哈希），便于**不依赖 1.3MB 快照文件**核对与比对。
 * 结构哈希 = sha256(表名+列定义+索引定义 的规范化文本)，**不含** db 名与取快照时间
 * ⇒ 同一结构在不同库/不同时间取快照，摘要相同；结构不同则摘要不同。
 *
 * 用法：node docs/evidence/S3-186/harness/digest.mjs <快照json> [<快照json> ...]
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

for (const file of process.argv.slice(2)) {
  const s = JSON.parse(readFileSync(file, "utf8"));
  const norm = [
    ...s.tables.map((t) => `T ${t.TABLE_NAME} ${t.ENGINE} ${t.TABLE_COLLATION}`),
    ...s.columns.map(
      (c) =>
        `C ${c.TABLE_NAME}.${c.COLUMN_NAME} ${c.COLUMN_TYPE} ${c.IS_NULLABLE} ${
          c.COLUMN_DEFAULT === null ? "NULL" : String(c.COLUMN_DEFAULT)
        } ${c.EXTRA} ${c.COLUMN_COMMENT}`
    ),
    ...s.indexes.map(
      (i) => `I ${i.TABLE_NAME}.${i.INDEX_NAME} ${i.NON_UNIQUE} ${i.SEQ_IN_INDEX} ${i.COLUMN_NAME} ${i.INDEX_TYPE}`
    ),
  ].join("\n");
  const hash = createHash("sha256").update(norm).digest("hex");
  console.log(
    `${basename(file)}\ttables=${s.counts.tables}\tcolumns=${s.counts.columns}\tindexes=${s.counts.indexes}\troutines=${s.counts.routines}\tstructure_sha256=${hash}`
  );
}
