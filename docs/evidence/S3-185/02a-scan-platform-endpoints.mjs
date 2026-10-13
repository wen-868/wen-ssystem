// S3-185 取证脚本②：29 个 platform*.routes.ts 的写端点清单（只读）
// 用法：node scan-platform-endpoints.mjs <repo-root> [globPrefix]
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const dir = path.join(root, "backend", "src", "routes");
const files = fs
  .readdirSync(dir)
  .filter((f) => /^platform.*routes\.ts$/.test(f))
  .sort();

const out = [];
for (const f of files) {
  const full = path.join(dir, f);
  const text = fs.readFileSync(full, "utf8");
  const lines = text.split(/\r?\n/);
  // 前缀：routeConfig / routeConfigs 里的 prefix（可能多个）
  const prefixes = [...text.matchAll(/prefix:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  const declPrefix = prefixes.length ? [...new Set(prefixes)].join(" + ") : "(无 routeConfig.prefix)";
  const useAuthDecl = [...text.matchAll(/auth:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const perms = [...text.matchAll(/requirePermission\(([^)]*)\)/g)].map((m) => m[1]);

  // 写端点：router.<method>( "path"
  const re = /([A-Za-z0-9_$]+)\.(post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(text))) {
    const lineNo = text.slice(0, m.index).split(/\r?\n/).length;
    const [, routerVar, method, sub] = m;
    const joined = sub.startsWith("/") ? sub : "/" + sub;
    const pfx = prefixes.length === 1 ? prefixes[0].replace(/\/$/, "") : declPrefix;
    out.push({
      file: f,
      line: lineNo,
      method: method.toUpperCase(),
      routerVar,
      sub: joined,
      prefix: pfx,
      fullPath: prefixes.length === 1 ? pfx + (joined === "/" ? "/" : joined) : `${declPrefix}${joined}`,
    });
  }
  out.push({
    file: f,
    __meta: true,
    prefixes: [...new Set(prefixes)],
    auth: [...new Set(useAuthDecl)],
    innerRequirePermission: perms,
    lineCount: lines.length,
  });
}

const metas = out.filter((o) => o.__meta);
const eps = out.filter((o) => !o.__meta);
const byFile = new Map();
for (const e of eps) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

console.log(`# 文件数=${files.length} 写端点总数=${eps.length}`);
console.log("# file\tline\tmethod\tsubPath\tfullPath");
for (const f of files) {
  const list = byFile.get(f) || [];
  const meta = metas.find((m) => m.file === f);
  console.log(`## ${f}  endpoints=${list.length}  prefix=${JSON.stringify(meta.prefixes)}  auth=${JSON.stringify(meta.auth)}  innerRequirePermission=${JSON.stringify(meta.innerRequirePermission)}`);
  for (const e of list) console.log(`${e.file}\t${e.line}\t${e.method}\t${e.sub}\t${e.fullPath}`);
}

const byMethod = eps.reduce((a, e) => ((a[e.method] = (a[e.method] || 0) + 1), a), {});
console.log("# 按方法：", JSON.stringify(byMethod));
