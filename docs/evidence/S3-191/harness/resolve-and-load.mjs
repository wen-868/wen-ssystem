/**
 * resolve-and-load.mjs —— ① 把 dist 里所有「动态相对 import()」的目标解析成真实文件并断言存在；
 *                         ② 把这些目标模块真实 import 一次，证明能加载（不因缺依赖/扩展名而抛错）。
 *
 * 用法（cwd = 仓库根）：
 *   $env:USE_MOCK_DB='true'; $env:NODE_ENV='development'; node docs/evidence/S3-191/harness/resolve-and-load.mjs backend/dist
 */

import { readdir, readFile } from "node:fs/promises";
import { join, extname, resolve, relative } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = process.argv[2] || "backend/dist";
const DYNAMIC_RE = /import\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g;

const sites = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full);
    else if (e.isFile() && extname(e.name) === ".js") {
      const content = await readFile(full, "utf-8");
      for (const m of content.matchAll(DYNAMIC_RE)) {
        sites.push({ from: full, spec: m[1], target: resolve(dir, m[1]) });
      }
    }
  }
}

await walk(root);

let missing = 0;
const targets = new Set();
console.log(`动态相对 import() 处数：${sites.length}`);
for (const s of sites) {
  const ok = existsSync(s.target);
  if (!ok) missing++;
  targets.add(s.target);
  console.log(`  ${ok ? "OK  " : "MISS"} ${relative(root, s.from).replace(/\\/g, "/")} -> ${s.spec} -> ${relative(root, s.target).replace(/\\/g, "/")}`);
}

console.log("");
console.log(`去重后的目标模块：${targets.size} 个，逐个真实 import：`);
let loadFail = 0;
for (const t of [...targets].sort()) {
  try {
    await import(pathToFileURL(t).href);
    console.log(`  LOAD OK   ${relative(root, t).replace(/\\/g, "/")}`);
  } catch (e) {
    loadFail++;
    console.log(`  LOAD FAIL ${relative(root, t).replace(/\\/g, "/")} :: ${e.message}`);
  }
}

console.log("");
console.log(`目标文件缺失：${missing}；加载失败：${loadFail}`);
process.exit(missing === 0 && loadFail === 0 ? 0 : 1);
