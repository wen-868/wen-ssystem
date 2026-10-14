// 产物哈希工具（S3-200 证据用）：对给定目录做"逐文件 sha256 + 汇总 sha256"，用于前后对照。
// 用法：node hash-artifacts.mjs <repoRoot> <dir1> [dir2 ...]
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [repoRoot, ...dirs] = process.argv.slice(2);

function walk(base, cur, out) {
  for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
    const p = path.join(cur, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(base, p, out);
    else if (e.isFile()) out.push(path.relative(base, p).split(path.sep).join("/"));
  }
}

for (const d of dirs) {
  const abs = path.join(repoRoot, d);
  if (!fs.existsSync(abs)) {
    console.log(`${d}  MISSING`);
    continue;
  }
  const files = [];
  walk(abs, abs, files);
  files.sort();
  let bytes = 0;
  const lines = [];
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(abs, rel));
    bytes += buf.length;
    lines.push(`${rel}:${createHash("sha256").update(buf).digest("hex")}`);
  }
  const digest = createHash("sha256").update(lines.join("\n")).digest("hex");
  console.log(`${d}  files=${files.length}  bytes=${bytes}  sha256(${files.length} 个文件清单+内容)=${digest}`);
}
