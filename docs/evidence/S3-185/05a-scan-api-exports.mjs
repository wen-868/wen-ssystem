// S3-185 取证脚本：saas-admin/src/api.ts 导出引用扫描（只读，不改仓库）
// 用法：node scan-api-exports.mjs <repo-root>
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("need repo root");
  process.exit(2);
}
const target = path.join(root, "saas-admin", "src", "api.ts");
const targetAbs = path.resolve(target);

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", "jscpd-report", ".vite"]);
const EXT = new Set([".ts", ".tsx", ".vue", ".js", ".mjs", ".cjs", ".json", ".md"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(p, out);
    } else if (EXT.has(path.extname(ent.name))) {
      out.push(p);
    }
  }
  return out;
}

const src = fs.readFileSync(targetAbs, "utf8");
const lines = src.split(/\r?\n/);

const functions = [];
const interfaces = [];
const values = [];
for (const line of lines) {
  let m;
  if ((m = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(line))) functions.push(m[1]);
  else if ((m = /^export\s+interface\s+([A-Za-z0-9_]+)/.exec(line))) interfaces.push(m[1]);
  else if ((m = /^export\s+(?:const|let|var|type|class|enum)\s+([A-Za-z0-9_]+)/.exec(line))) values.push(m[1]);
}
const all = [...functions, ...values, ...interfaces];

// 收集全仓文件（排除 api.ts 自身）
const files = walk(root).filter((f) => path.resolve(f) !== targetAbs);

// 每文件的文本 + 是否正确从 api.ts 导入（相对/别名解析）
const fileText = new Map();
for (const f of files) fileText.set(f, fs.readFileSync(f, "utf8"));

const apiModuleRe = /(?:\*|\{[^}]*\}|[A-Za-z0-9_$]+)\s*(?:\bas\s+[A-Za-z0-9_$]+)?/;
const importRe = /import\s+([^;]+?)\s+from\s+["']([^"']+)["']/g;

/** 解析 import 说明符是否指向 saas-admin/src/api.ts */
function resolvesToTarget(fromFile, spec) {
  if (spec === "@/api" || spec === "@/api.ts") return path.join(root, "saas-admin", "src", "api.ts");
  if (/^\./.test(spec)) {
    const base = path.resolve(path.dirname(fromFile), spec);
    return base;
  }
  return null;
}

// name -> 外部命中
const hits = new Map(all.map((n) => [n, []]));
const directImports = new Map(all.map((n) => [n, []])); // 明确从 api.ts 导入该名
const namespaceImports = []; // 文件 + 命名空间别名

for (const f of files) {
  const text = fileText.get(f);
  const rel = path.relative(root, f).replace(/\\/g, "/");
  for (const line of text.split(/\r?\n/)) {
    for (const name of all) {
      const re = new RegExp(`(^|[^A-Za-z0-9_$])${name}([^A-Za-z0-9_$]|$)`);
      if (re.test(line)) hits.get(name).push({ file: rel, line: line.trim().slice(0, 160) });
    }
  }
  importRe.lastIndex = 0;
  let m;
  while ((m = importRe.exec(text))) {
    const clause = m[1];
    const spec = m[2];
    const resolved = resolvesToTarget(f, spec);
    if (!resolved) continue;
    const cand = [resolved, resolved + ".ts", resolved + ".js", path.join(resolved, "index.ts")];
    if (!cand.some((c) => path.resolve(c) === targetAbs)) continue;
    const nsMatch = /^\*\s+as\s+([A-Za-z0-9_$]+)/.exec(clause);
    if (nsMatch) {
      namespaceImports.push({ file: rel, ns: nsMatch[1] });
      continue;
    }
    const braced = /\{([^}]*)\}/.exec(clause);
    if (braced) {
      for (const raw of braced[1].split(",")) {
        const nm = raw.trim().split(/\s+as\s+/)[0].trim();
        if (nm && directImports.has(nm)) directImports.get(nm).push(rel);
      }
    } else {
      const def = clause.trim();
      if (directImports.has(def)) directImports.get(def).push(rel);
    }
  }
}

// 命名空间导入的成员使用：ns.foo
const nsUse = new Map(all.map((n) => [n, []]));
for (const { file, ns } of namespaceImports) {
  const f = path.join(root, ...file.split("/"));
  const text = fileText.get(f) || "";
  for (const name of all) {
    const re = new RegExp(`\\b${ns}\\.${name}\\b`);
    if (re.test(text)) nsUse.get(name).push(`${file} (via ${ns})`);
  }
}

function verdict(name) {
  const di = directImports.get(name);
  const h = hits.get(name);
  const ns = nsUse.get(name);
  if (di.length) return { state: "USED-IMPORT", ev: di.slice(0, 6) };
  if (ns.length) return { state: "USED-NS", ev: ns.slice(0, 6) };
  if (h.length) return { state: "WORD-HIT-ONLY", ev: h.slice(0, 12) };
  return { state: "ZERO", ev: [] };
}

function area(rel) {
  if (rel.startsWith("saas-admin/src/")) return "saasSrc";
  if (rel.startsWith("saas-admin/")) return "saasTools";
  return "other";
}

const report = { functions: [], interfaces: [], values: [] };
for (const [bucket, names] of [
  ["functions", functions],
  ["interfaces", interfaces],
  ["values", values],
]) {
  for (const name of names) {
    const v = verdict(name);
    const byArea = { saasSrc: [], saasTools: [], other: [] };
    for (const h of hits.get(name)) byArea[area(h.file)].push(`${h.file}: ${h.line}`);
    report[bucket].push({
      name,
      state: v.state,
      importedFromApiTs: directImports.get(name).slice(0, 8),
      nsUsed: nsUse.get(name).slice(0, 8),
      saasSrc: byArea.saasSrc.slice(0, 10),
      saasTools: byArea.saasTools.slice(0, 10),
      other: byArea.other.slice(0, 6),
      counts: {
        saasSrc: byArea.saasSrc.length,
        saasTools: byArea.saasTools.length,
        other: byArea.other.length,
      },
    });
  }
}

console.log(JSON.stringify({ total: all.length, counts: { functions: functions.length, values: values.length, interfaces: interfaces.length }, namespaceImports, report }, null, 1));
