/**
 * S3-233-F1 返工（2026-10-16）：**同类行全仓判据** —— 「已鉴权 + 处理链上有文件系统访问 + 注册点无内联限流」。
 *
 * 判据与语句抽取逻辑**照第 57 项既有装置** `docs/evidence/S3-208/harness/codeql-missing-rate-limiting-predicate.mjs`
 * （同一 AUTH_MIDDLEWARE / INLINE_RATE_LIMIT 正则、同一括号配平抽取），本脚本只做两处扩展：
 *   ① TARGETS 由 3 个文件扩到 `backend/src/routes/*.ts` 全量（回答"全仓还有无同类行"）；
 *   ② 增加"文件系统访问迹象"两列（语句级上传中间件 / 该语句引用的 controller 模块是否含 `node:fs`），
 *      以把第 57 项的宽类（所有已鉴权无内联限流的注册点）收窄到 **CodeQL 本次命中的同族**（FS 访问）。
 *
 * 用法：node docs/evidence/S3-233/tools/s3240-f1-fs-route-scan.mjs [--repo <仓库根>]
 * 退出码：0 = 无命中；1 = 有命中（打印明细）；2 = 判据自身失效（扫到 0 条注册，同 S3-49 假门禁教训）。
 * 只读，不写任何文件。
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const getFlag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const repo = path.resolve(getFlag("--repo", process.cwd()));
const ROUTES_DIR = path.join(repo, "backend", "src", "routes");

/**
 * 把任意字符串安全嵌入正则字面量（CodeQL `js/incomplete-sanitization` 的根治写法）：
 *   **先转义反斜杠**，再转义其余元字符 —— 只转 `$`（旧写法 `name.replace(/\$/g, "\\$")`）会漏掉 `\` 本身，
 *   含反斜杠的标识符会让插入点后的正则片段变形（同 S3-210 台账生成器的同类缺陷）。
 */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 与 CodeQL 判据①对齐：注册链上的鉴权中间件（与 S3-208 装置同一份命名族） */
const AUTH_MIDDLEWARE =
  /\b(requireWxAuth|requireConsumerAuthWithTenant|requireAuth|requireAuthWithTenant|requirePlatformAuth|requirePlatformPermission|requirePermission|requireRoles|requireStoreAuth|csrfMiddleware)\b/;
/** 与 CodeQL 判据②对齐（S3-112 结论）：注册点上**内联**的限流中间件调用形态 */
const INLINE_RATE_LIMIT = /\brateLimit\(/;
/** 语句级"文件系统访问"迹象之一：上传中间件（multer 实例方法调用 = 多部分上传处理） */
const UPLOAD_MIDDLEWARE_CALL = /\b\w+\.(single|array|fields|any|none)\s*\(/;

/**
 * 本文件里"已绑定好的 multer 中间件"标识符集合：`const X = multer({...})` 或
 * `const X = multer({...}).single(...)/.array(...)/.fields(...)`。
 * 为什么必须收这一列：仓内有两种写法 —— ① 语句上现调 `upload.single("image")`；
 * ② 事先绑定成 `logoUpload` / `authLetterUpload` 再整块传进注册语句。只认 ① 会**漏判** ②。
 */
function uploadIdentifiers(code) {
  const idents = new Set();
  for (const m of code.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*multer\s*\(/g)) idents.add(m[1]);
  for (const m of code.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*multer\s*\([\s\S]*?\)\s*\.\s*(single|array|fields|any|none)\s*\(/g)) {
    idents.add(m[1]);
  }
  return idents;
}
/** 控制器模块级"文件系统访问"迹象 */
const FS_IN_MODULE = /from\s+["']node:fs["']|require\(\s*["']node:fs["']\s*\)|\bfs\.(readFile|writeFile|mkdir|unlink|existsSync|createWriteStream|readFileSync|writeFileSync|mkdirSync|unlinkSync|statSync|promises)\b/;

function stripComments(source) {
  return source.replace(
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(["'`])(?:\\.|(?!\2)[^\\\n])*\2/g,
    (match, comment) => (comment === undefined ? match : "")
  );
}

/** 抽取路由注册语句（跨行，括号配平；与 S3-208 装置同形） */
function extractRegistrations(code) {
  const out = [];
  const re = /([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete|all)\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const start = m.index;
    let depth = 0;
    let i = re.lastIndex - 1;
    for (; i < code.length; i += 1) {
      if (code[i] === "(") depth += 1;
      else if (code[i] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const statement = code.slice(start, i + 1);
    const line = code.slice(0, start).split("\n").length;
    const pathMatch = statement.match(/^\s*[A-Za-z_$][\w$]*\s*\.\s*\w+\s*\(\s*"([^"]*)"/) || statement.match(/"([^"]*)"/);
    if (!pathMatch) continue;
    out.push({ line, routerVar: m[1], method: m[2].toUpperCase(), routePath: pathMatch[1], statement });
  }
  return out;
}

/**
 * 前缀级鉴权表：`{ prefix, router: X, auth: "..." }` → `X ⇒ auth 值`。
 * 为什么必须有这一列：仓内有不靠注册语句挂鉴权的路由（由 `routeConfigs` 按前缀级前置，例：avatar /
 * miniapp-config / platform-config / platform-library），只按语句判"有无鉴权"会**漏判**（S3-208 装置
 * 也有同一局限，其 commerce-fix 门店端那一条是人工补判的）。
 */
function prefixAuthTable(code) {
  const table = new Map();
  for (const m of code.matchAll(/router:\s*([A-Za-z_$][\w$]*)\s*,\s*auth:\s*"([^"]*)"/g)) {
    table.set(m[1], m[2]);
  }
  return table;
}

/** 该路由文件里"本地标识符 → 模块文件"的映射（只取相对路径 import） */
function localModuleMap(file, code) {
  const map = new Map();
  for (const m of code.matchAll(/import\s+([\s\S]*?)\s+from\s+["'](\.[^"']+)["']/g)) {
    const spec = m[2];
    const resolved = resolveModule(path.dirname(file), spec);
    if (!resolved) continue;
    const clause = m[1];
    const star = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (star) map.set(star[1], resolved);
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      for (const part of named[1].split(",")) {
        const name = part.split(/\bas\b/).pop()?.trim();
        if (name && /^[A-Za-z_$][\w$]*$/.test(name)) map.set(name, resolved);
      }
    }
  }
  return map;
}

/** 解析相对 import → 真实文件（.ts / .js / index.ts） */
function resolveModule(fromDir, spec) {
  const base = path.resolve(fromDir, spec);
  for (const cand of [`${base}.ts`, `${base}.js`, path.join(base, "index.ts"), base]) {
    try {
      if (readFileSync(cand, "utf8")) return cand;
    } catch {
      /* 不存在则继续 */
    }
  }
  return null;
}

const fsCache = new Map();
function moduleTouchesFs(file) {
  if (!fsCache.has(file)) {
    let text = "";
    try {
      text = stripComments(readFileSync(file, "utf8"));
    } catch {
      text = "";
    }
    fsCache.set(file, FS_IN_MODULE.test(text));
  }
  return fsCache.get(file);
}

const files = readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => path.join(ROUTES_DIR, f))
  .sort();

let totalRegistrations = 0;
const hits = [];
for (const file of files) {
  const code = stripComments(readFileSync(file, "utf8"));
  const modules = localModuleMap(file, code);
  const prefixAuth = prefixAuthTable(code);
  const uploadIdents = uploadIdentifiers(code);
  for (const r of extractRegistrations(code)) {
    totalRegistrations += 1;
    const authFromStatement = AUTH_MIDDLEWARE.test(r.statement);
    const prefixAuthValue = prefixAuth.get(r.routerVar);
    const authFromPrefix = prefixAuthValue !== undefined && prefixAuthValue !== "none";
    if (!authFromStatement && !authFromPrefix) continue;
    if (INLINE_RATE_LIMIT.test(r.statement)) continue;
    // 文件系统访问迹象：语句级上传中间件，或该语句引用的 controller 模块含 fs 调用
    const upload =
      UPLOAD_MIDDLEWARE_CALL.test(r.statement) ||
      [...uploadIdents].some((n) => new RegExp(`\\b${n}\\b`).test(r.statement));
    const referenced = [...modules.keys()].filter((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(r.statement));
    const fsModules = referenced.filter((name) => moduleTouchesFs(modules.get(name)));
    hits.push({
      file: path.relative(repo, file).replace(/\\/g, "/"),
      line: r.line,
      method: r.method,
      routePath: r.routePath,
      auth: authFromStatement ? "语句级" : `前缀级（auth: ${prefixAuthValue}）`,
      upload,
      fsModules,
    });
  }
}

const uploadClass = hits.filter((h) => h.upload);
const fsModuleClass = hits.filter((h) => !h.upload && h.fsModules.length > 0);
console.log(`[判据] 扫描 ${files.length} 个路由文件 · ${totalRegistrations} 条路由注册`);
console.log(`[判据] 「已鉴权（语句级或前缀级）+ 注册点未内联 rateLimit(...)」= ${hits.length} 条（第 57 项宽类）`);
console.log(`[判据]   A 精确同族：注册语句上**就有上传中间件** = ${uploadClass.length} 条（与本次 CodeQL 命中同一形态）`);
console.log(`[判据]   B 近似上界：注册语句引用的 controller **模块级**含 node:fs = ${fsModuleClass.length} 条（模块级判定是上界，可能含误报）`);
console.log("");
console.log("—— A 精确同族明细（注册语句上有上传中间件）——");
for (const h of uploadClass) {
  console.log(`  - ${h.file}:${h.line}  ${h.method} ${h.routePath}  ⇒ 鉴权=${h.auth}`);
}
if (uploadClass.length === 0) console.log("  （无）");
console.log("");
console.log("—— B 近似上界明细（模块级 fs）——");
for (const h of fsModuleClass) {
  console.log(`  - ${h.file}:${h.line}  ${h.method} ${h.routePath}  ⇒ 鉴权=${h.auth}；controller 模块含 fs：${h.fsModules.join(",")}`);
}
if (fsModuleClass.length === 0) console.log("  （无）");
console.log("");
const mine = [...uploadClass, ...fsModuleClass].filter((h) => h.file.endsWith("admin-product.routes.ts"));
console.log(`—— 本单范围内的文件（admin-product.routes.ts）在同族判据下是否已清零：${mine.length === 0 ? "是 ✅" : "否 ❌"} ——`);

if (totalRegistrations === 0) {
  console.error("[判据] 扫描到 0 条路由注册 ⇒ 判据自身失效（同 S3-49 假门禁教训），退出码 2");
  process.exit(2);
}
process.exit(hits.length === 0 ? 0 : 1);
