/**
 * fix-esm-extensions.js
 * 用途：tsc 编译后，给所有 ESM 相对导入路径补全 .js 扩展名
 * 背景：TypeScript moduleResolution=node 不会在输出中自动添加 .js，
 *       但 Node.js ESM 模式（type=module）严格要求导入路径包含 .js 扩展名。
 * 用法：node fix-esm-extensions.js <dist目录>
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const distDir = process.argv[2];
if (!distDir) {
  console.error("用法：node fix-esm-extensions.js <dist目录>");
  process.exit(1);
}

const KNOWN_EXTS = new Set([".js", ".mjs", ".cjs", ".json", ".node"]);

let fixedCount = 0;
let fileCount = 0;

function fixImports(content) {
  // 处理双引号: from "./xxx" 或 from "../xxx"
  content = content.replace(/from\s+"(\.\.?\/[^"]+)"/g, (_m, path) => {
    const dot = path.lastIndexOf(".");
    if (dot > 0 && KNOWN_EXTS.has(path.slice(dot))) return _m;
    fixedCount++;
    return `from "${path}.js"`;
  });
  // 处理单引号: from './xxx' 或 from '../xxx'
  content = content.replace(/from\s+'(\.\.?\/[^']+)'/g, (_m, path) => {
    const dot = path.lastIndexOf(".");
    if (dot > 0 && KNOWN_EXTS.has(path.slice(dot))) return _m;
    fixedCount++;
    return `from '${path}.js'`;
  });
  return content;
}

async function processDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDir(fullPath);
    } else if (entry.isFile() && extname(entry.name) === ".js") {
      const content = await readFile(fullPath, "utf-8");
      const updated = fixImports(content);
      if (updated !== content) {
        await writeFile(fullPath, updated, "utf-8");
      }
      fileCount++;
    }
  }
}

await processDir(distDir);
console.log(`已处理 ${fileCount} 个 JS 文件，修复 ${fixedCount} 处导入路径`);
