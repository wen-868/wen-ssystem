#!/usr/bin/env node
/**
 * 路由-Controller 函数一致性检查
 * 扫描所有路由文件，检查引用的 controller 函数是否实际存在
 * 用法: node scripts/check-routes.js
 */
const fs = require("fs");
const path = require("path");

const CONTROLLERS_DIR = path.join(__dirname, "..", "src", "controllers");
const ROUTES_DIR = path.join(__dirname, "..", "src", "routes");

// 递归查找所有 controller 文件
function findControllers(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...findControllers(full));
    else if (e.name.endsWith(".controller.ts")) files.push(full);
  }
  return files;
}

// 构建 controller 导出函数索引
function buildControllerIndex() {
  const index = new Map();
  for (const file of findControllers(CONTROLLERS_DIR)) {
    const content = fs.readFileSync(file, "utf-8");
    const funcs = [
      ...content.matchAll(/export\s+(const|async\s+function|function)\s+(\w+)/g),
    ].map((m) => m[2]);
    index.set(file, new Set(funcs));
  }
  return index;
}

// 从路由文件中查找 controller 引用到实际文件
function resolveController(importName, routeFile) {
  const routeContent = fs.readFileSync(routeFile, "utf-8");
  // 查找 import * as xxxController from "path"
  const importMatch = routeContent.match(
    new RegExp(`import\\s+\\*\\s+as\\s+${importName}\\s+from\\s+["'](.+?)["']`)
  );
  if (!importMatch) return null;

  const importPath = importMatch[1];
  const resolved = path.resolve(path.dirname(routeFile), importPath);
  // 尝试 .ts 和 .js 扩展名
  for (const ext of [".ts", ".js", "/index.ts", "/index.js"]) {
    const p = resolved.replace(/\.js$/, "") + ext;
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// 主逻辑
const ctrlIndex = buildControllerIndex();
const routeFiles = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".routes.ts"));

let totalRefs = 0;
let unmatched = 0;

for (const rf of routeFiles) {
  const routePath = path.join(ROUTES_DIR, rf);
  const content = fs.readFileSync(routePath, "utf-8");

  for (const match of content.matchAll(/(\w+)Controller\.(\w+)/g)) {
    totalRefs++;
    const ctrlName = match[1] + "Controller";
    const funcName = match[2];

    const ctrlFile = resolveController(ctrlName, routePath);
    if (!ctrlFile) {
      console.log(`MISSING FILE: ${ctrlName} in ${rf} → import not found`);
      unmatched++;
      continue;
    }

    const funcs = ctrlIndex.get(ctrlFile);
    if (!funcs || !funcs.has(funcName)) {
      console.log(`MISSING FUNC: ${ctrlName}.${funcName} in ${rf} → ${ctrlFile}`);
      unmatched++;
    }
  }
}

console.log(`\n总引用: ${totalRefs}, 不匹配: ${unmatched}`);
process.exit(unmatched > 0 ? 1 : 0);