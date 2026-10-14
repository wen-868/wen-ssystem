/**
 * S3-197 装置⑨（反测用）：把第②项的"命名归一"**反转**——把规范名改回语料原名，
 * 用来制造"同表同列重复索引"应当出现的**红侧**（红侧与绿侧逐字由同一装置给出）。
 *
 * 用法：node docs/evidence/S3-197/harness/reverse-tenant-index-names.mjs <仓库根> <反向对照表.json> [--apply]
 *   ⚠️ 只用于反测；反测完必须用备份把文件复原，并用 sha256 断言复原值为冻结值。
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [, , repoArg, mapArg, applyFlag] = process.argv;
if (!repoArg || !mapArg) throw new Error("用法: reverse-tenant-index-names.mjs <仓库根> <反向对照表.json> [--apply]");
const repo = resolve(repoArg);
const map = JSON.parse(readFileSync(resolve(mapArg), "utf8")); // { "file.sql": [{"canonical":"idx_t_x_tenant","legacy":"idx_x_tenant","table":"t_x"}] }
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

let total = 0;
for (const [file, pairs] of Object.entries(map)) {
  const path = join(repo, "docs", "migrations", file);
  const before = readFileSync(path, "utf8");
  let text = before;
  for (const { canonical, legacy, table } of pairs) {
    // 092 风格：SET 行 + 跳过标签；010/012 风格：ADD INDEX 行
    text = text.split(`@s3186_name = '${canonical}';`).join(`@s3186_name = '${legacy}';`);
    text = text.split(`跳过 ${table}.${canonical}`).join(`跳过 ${table}.${legacy}`);
    text = text.split(`ADD INDEX ${canonical} `).join(`ADD INDEX ${legacy} `);
  }
  const changed = text !== before;
  console.log(`${file}\t${pairs.length} 对\t${changed ? "已反转" : "**未变化（检查对照表）**"}\t${sha(before)} -> ${sha(text)}`);
  total += pairs.length;
  if (applyFlag === "--apply") writeFileSync(path, text, "utf8");
}
console.log(`反向对照表总对数 = ${total}；${applyFlag === "--apply" ? "已写盘" : "dry-run（未写盘）"}`);
