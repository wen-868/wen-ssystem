/**
 * encoding-check.mjs —— 逐个文件复核「非法编码（非 UTF-8 / GBK 混编）」是否成立
 *
 * 判据：
 *   ① 严格 UTF-8 解码（TextDecoder fatal:true）—— 报错即文件含非法 UTF-8 字节序列（GBK 混编的典型症状）
 *   ② 解码后 U+FFFD 替换字符计数 —— 有替换字符说明读取侧已被迫容错替换
 *   ③ 非 ASCII 字符数（确认文件确实是中文内容而非空文件）
 * 用法：node encoding-check.mjs <文件或目录>...
 */

import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("用法：node encoding-check.mjs <文件或目录>...");
  process.exit(2);
}

async function collect(p, out) {
  const entries = await readdir(p, { withFileTypes: true });
  for (const e of entries) {
    const full = join(p, e.name);
    if (e.isDirectory()) await collect(full, out);
    else if (e.isFile()) out.push(full);
  }
}

const files = [];
for (const input of inputs) {
  try {
    const entries = await readdir(input, { withFileTypes: true });
    for (const e of entries) {
      const full = join(input, e.name);
      if (e.isDirectory()) await collect(full, files);
      else files.push(full);
    }
  } catch {
    files.push(input);
  }
}

const decoder = new TextDecoder("utf-8", { fatal: true });
const oneshot = new TextDecoder("utf-8", { fatal: false });

let bad = 0;
console.log("文件 | 严格UTF-8 | 替换字符数 | 非ASCII字符数 | 字节数");
for (const f of files) {
  if (![".ts", ".js", ".tsx", ".vue", ".sql", ".md"].includes(extname(f))) continue;
  const buf = await readFile(f);
  let strict = "OK";
  let text = "";
  try {
    text = decoder.decode(buf);
  } catch (err) {
    strict = "FAIL(" + String(err.message).slice(0, 60) + ")";
    text = oneshot.decode(buf);
    bad++;
  }
  const replacement = (text.match(/\uFFFD/g) || []).length;
  let nonAscii = 0;
  for (const ch of text) if (ch.codePointAt(0) > 127) nonAscii++;
  console.log(`${f} | ${strict} | ${replacement} | ${nonAscii} | ${buf.length}`);
}
console.log("");
console.log(`扫描文件数：${files.length}`);
console.log(`严格 UTF-8 解码失败（真含非法字节）：${bad} 个`);
process.exit(bad === 0 ? 0 : 1);
