/**
 * enum-imports.mjs —— 枚举编译产物中的 ESM 相对导入（静态 + 动态），找出「缺扩展名」的处数
 *
 * 用法：node enum-imports.mjs <dist 目录>
 * 输出：
 *   - 逐条明细：<相对路径>:<行号> | 类型(static/dynamic) | 原字面量
 *   - 汇总：静态缺失 N 处 / 动态缺失 M 处
 * 退出码：缺失为 0 时 0，否则 1（便于门禁化）
 */

import { readdir, readFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("用法：node enum-imports.mjs <dist 目录>");
  process.exit(2);
}

const KNOWN_EXTS = new Set([".js", ".mjs", ".cjs", ".json", ".node"]);

// 静态：from "./x" / from '../x'
const STATIC_RE = /from\s+["'](\.\.?\/[^"']+)["']/g;
// 动态：import("./x") / import('../x')  （单双引号都覆盖，不含模板串）
const DYNAMIC_RE = /import\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g;
// 动态模板串：import(`./x`)  —— 单独统计，不改写
const DYNAMIC_TEMPLATE_RE = /import\(\s*`([^`]*)`\s*\)/g;

const missingStatic = [];
const missingDynamic = [];
const dynamicTemplate = [];
let files = 0;

function hasExt(spec) {
  const dot = spec.lastIndexOf(".");
  return dot > 0 && KNOWN_EXTS.has(spec.slice(dot));
}

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line++;
  return line;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full);
    } else if (e.isFile() && extname(e.name) === ".js") {
      const content = await readFile(full, "utf-8");
      files++;
      const rel = relative(root, full).replace(/\\/g, "/");
      for (const m of content.matchAll(STATIC_RE)) {
        if (!hasExt(m[1])) missingStatic.push(`${rel}:${lineOf(content, m.index)} | static | "${m[1]}"`);
      }
      for (const m of content.matchAll(DYNAMIC_RE)) {
        if (!hasExt(m[1])) missingDynamic.push(`${rel}:${lineOf(content, m.index)} | dynamic | "${m[1]}"`);
      }
      for (const m of content.matchAll(DYNAMIC_TEMPLATE_RE)) {
        dynamicTemplate.push(`${rel}:${lineOf(content, m.index)} | dynamic-template | \`${m[1]}\``);
      }
    }
  }
}

await walk(root);

console.log(`扫描 dist：${root}`);
console.log(`JS 文件数：${files}`);
console.log("");
console.log(`== 缺扩展名的【静态】相对导入：${missingStatic.length} 处 ==`);
for (const l of missingStatic) console.log("  " + l);
console.log("");
console.log(`== 缺扩展名的【动态】相对 import()：${missingDynamic.length} 处 ==`);
for (const l of missingDynamic) console.log("  " + l);
console.log("");
console.log(`== 动态 import() 使用模板串（未纳入自动补全）：${dynamicTemplate.length} 处 ==`);
for (const l of dynamicTemplate) console.log("  " + l);

process.exit(missingStatic.length === 0 && missingDynamic.length === 0 ? 0 : 1);
