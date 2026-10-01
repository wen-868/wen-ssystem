#!/usr/bin/env node
/**
 * R101-C6-4-1 自检脚本（纯 node，零第三方依赖，**不 spawn 任何子进程**）
 *
 * 断言六件事（派单卡交付物③ + 三、硬口径）：
 *   ① 「后端注册路径 ↔ 卡内逐字路径」一致：租户 4 条 + 平台 4 条，多一条/少一条/拼错一个字符都判红；
 *      P5（/stats/category-dist）必须**未注册**（Q9：无类目载体，本期不实现）；
 *   ② 「前端字面路径 ⊆ 卡内路径」：本单是纯后端单（前端消费在后续步），故前端只允许出现卡内路径，
 *      或出现在显式 DEFERRED 清单里（当前仅 saas-admin 的 TODO 注释引用 category-dist）；
 *   ③ 请求体字段集：控制器 copyBodySchema 的字段集 ↔ 卡内契约 {librarySpuIds, skuSelection}；
 *   ④ result 取值常量 = CREATED/SKIPPED/REJECTED（后端常量，不落库枚举）；
 *   ⑤ 迁移 190/191 硬口径：CREATE TABLE IF NOT EXISTS + 零数据写语句 + 文本列显式 utf8mb4_0900_ai_ci +
 *      无物理外键 + 可执行语句顶格在注释块之前 + 注释文字内无 ASCII 分号（踩坑 [63]）；
 *   ⑥ 权限点取自 shared/library-permission-codes.ts 常量并被路由引用（Q8 ①：代码常量 + 授权另行落）。
 *
 * CRLF 健壮性（派单卡明确要求 + 踩坑 [153]/S3-133-F1）：读取后先归一 \r\n → \n 再做所有正则匹配
 *   （反面教材：同目录 c6-3-1-selfcheck.mjs 的 ④ 断言用 /--.*$/ 逐行剥注释，遇到 CRLF 时 `$` 无法匹配到
 *    行尾 \r 之前，注释未被剥掉 → 在 CRLF 检出下误报 INSERT=1；本脚本一律先归一）。
 *
 * 用法：
 *   node backend/tools/c6-4-1-selfcheck.mjs            # 检查本仓库
 *   node backend/tools/c6-4-1-selfcheck.mjs <repoRoot> # 检查指定根目录（供"改坏⇒红"反测的副本）
 * 退出码：0 = 全绿；1 = 有 FAIL（可作门禁）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "..", ".."));

/* ── 卡内钉死的 8 条路径（唯一真相源 = 派单卡 §二 范围 + 立项草案 §四） ── */
/** 卡内钉死的 8 条「方法与路径」对（本单域内，方法敏感：换方法也必须判红） */
const CARD_TENANT_ROUTES = [
  "GET /api/admin/library/spus",
  "GET /api/admin/library/spus/:id",
  "GET /api/admin/library/copies",
  "POST /api/admin/library/copies",
];
const CARD_PLATFORM_ROUTES = [
  "GET /api/platform/library/call-logs",
  "GET /api/platform/library/stats",
  "GET /api/platform/library/stats/rank",
  "GET /api/platform/library/stats/trend",
];
const CARD_ROUTES = new Set([...CARD_TENANT_ROUTES, ...CARD_PLATFORM_ROUTES]);
const CARD_PATHS = new Set([...CARD_TENANT_ROUTES, ...CARD_PLATFORM_ROUTES].map((r) => r.split(" ")[1]));
/** Q9 明确"本期不实现"、允许只出现在前端 TODO 注释里的路径（注册了反而判红） */
const DEFERRED_PATHS = new Set(["/api/platform/library/stats/category-dist"]);

/** 本单域内的路径形状（用于从前端文案/注释里捡出"字面路径"） */
const DOMAIN_PATH_RE = /\/(?:api\/)?(admin|platform)\/library\/(?:spus(?:\/\$\{[^}]*\}|\/[A-Za-z0-9_:.-]+)?|copies|call-logs|stats(?:\/(?:rank|trend|category-dist))?)/g;

const CARD_COPY_BODY_KEYS = ["librarySpuIds", "skuSelection"];
const CARD_RESULT_VALUES = ["CREATED", "SKIPPED", "REJECTED"];

const results = [];
function check(label, ok, detail = "") {
  results.push({ label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`缺少文件：${rel}（root=${ROOT}）`);
  // CRLF 归一：所有正则都在 LF 文本上跑（踩坑 [153]）
  return fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", ".vite"].includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

function normalizePath(raw) {
  let value = raw.replace(/\$\{[^}]*\}/g, ":id");
  value = value.replace(/:(?:id|code|spuId|param)\b/g, ":id");
  value = value.replace(/^\/api(\/)/, "/api$1");
  return value.replace(/\/$/, "");
}

/** 只在"本单域内"保留路径（避免把 /spus/:id/review-logs 等既有端点算进本单） */
function isDomainPath(normalized) {
  return (
    /^\/api\/admin\/library\/(spus(\/:id)?|copies)$/.test(normalized) ||
    /^\/api\/platform\/library\/(call-logs|stats(\/(rank|trend|category-dist))?)$/.test(normalized)
  );
}

function sorted(set) {
  return [...set].sort();
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/* ───────── ① 后端注册路径 ───────── */
const tenantRoutesSrc = read("backend/src/routes/admin-library.routes.ts");
const platformRoutesSrc = read("backend/src/routes/platform-library.routes.ts");

const tenantPrefix = /prefix:\s*"([^"]+)"/.exec(tenantRoutesSrc)?.[1];
const platformPrefix = /prefix:\s*"([^"]+)"/.exec(platformRoutesSrc)?.[1];

function collectRegistered(source, routerVar) {
  const found = new Set();
  const re = new RegExp(`${routerVar}\\.(get|post|put|delete)\\(\\s*"([^"]+)"`, "g");
  for (const m of source.matchAll(re)) {
    const full = `${routerPrefixOf(routerVar)}${normalizePath(m[2])}`;
    if (isDomainPath(full)) found.add(`${m[1].toUpperCase()} ${full}`);
  }
  return found;
}
function routerPrefixOf(routerVar) {
  return routerVar === "adminLibraryRouter" ? tenantPrefix : platformPrefix;
}

const registeredTenant = collectRegistered(tenantRoutesSrc, "adminLibraryRouter");
const registeredPlatform = collectRegistered(platformRoutesSrc, "platformLibraryRouter");
const registeredAll = new Set([...registeredTenant, ...registeredPlatform]);

check(
  "①-a 租户侧「方法 + 路径」逐字等于卡内 4 条（GET /spus、GET /spus/:id、GET /copies、POST /copies）",
  sameSet(registeredTenant, new Set(CARD_TENANT_ROUTES)),
  `backend=${JSON.stringify(sorted(registeredTenant))}`
);
check(
  "①-b 平台侧「方法 + 路径」逐字等于卡内 4 条（GET call-logs/stats/stats/rank/stats/trend）",
  sameSet(registeredPlatform, new Set(CARD_PLATFORM_ROUTES)),
  `backend=${JSON.stringify(sorted(registeredPlatform))}`
);
check(
  "①-c P5 类目分布未注册（Q9 本期不实现，无类目载体不得造假图）",
  !sorted(registeredAll).some((route) => route.includes("category-dist")) &&
    !platformRoutesSrc.includes("category-dist"),
  `registered=${JSON.stringify(sorted(registeredAll))}`
);
check(
  "①-d 前缀未被新开（租户复用 /api/admin/library、平台复用 /api/platform/library）",
  tenantPrefix === "/api/admin/library" && platformPrefix === "/api/platform/library",
  `tenant=${tenantPrefix} platform=${platformPrefix}`
);

/* ───────── ② 前端字面路径 ───────── */
const pathHits = [];
const frontendLiterals = new Set();
for (const projectRoot of ["admin-web", "saas-admin", "app-mobile"]) {
  for (const abs of walk(path.join(ROOT, projectRoot, "src"))) {
    if (!/\.(ts|vue|js|mjs)$/.test(abs)) continue;
    const src = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const m of src.matchAll(DOMAIN_PATH_RE)) {
      const normalized = normalizePath(m[0].startsWith("/api") ? m[0] : m[0].replace(/^\/(admin|platform)\//, "/api/$1/"));
      if (!isDomainPath(normalized)) continue;
      frontendLiterals.add(normalized);
      pathHits.push(`${path.relative(ROOT, abs)}:${src.slice(0, m.index).split("\n").length}  ${m[0].trim()}  ⇒  ${normalized}`);
    }
  }
}
const unknownFrontend = [...frontendLiterals].filter((p) => !CARD_PATHS.has(p) && !DEFERRED_PATHS.has(p));
check(
  "②-a 前端字面路径 ⊆ 卡内路径 ∪ 显式 DEFERRED（无自拟变体）",
  unknownFrontend.length === 0,
  `frontend=${JSON.stringify(sorted(frontendLiterals))} unknown=${JSON.stringify(unknownFrontend)}`
);
check(
  "②-b 前端未出现任何「动作动词」路径（/spus/:id/copy 之类）",
  !pathHits.some((hit) => /\/(copy|create|batch-copy)(\b|\/|$)/.test(hit)),
  `hits=${pathHits.length}`
);

/* ───────── ③ 请求体字段集 ───────── */
const controllerSrc = read("backend/src/controllers/admin/library-copy.controller.ts");
const serviceSrc = read("backend/src/services/admin/library-copy.service.ts");

function balancedBlock(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`未找到标记：${marker}`);
  const open = source.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`对象块未闭合：${marker}`);
}

const ZOD_OPTION_KEYS = new Set(["invalid_type_error", "required_error", "errorMap", "message", "description", "fatal", "z", "string", "number", "array", "record", "object", "optional", "min", "max", "int", "positive", "coerce", "trim", "default"]);
function keysOf(block) {
  const keys = new Set();
  for (const m of block.matchAll(/(?:^|[\s,{])([A-Za-z_$][\w$]*)\s*\??\s*:/g)) {
    if (ZOD_OPTION_KEYS.has(m[1])) continue;
    keys.add(m[1]);
  }
  return keys;
}

const bodyKeys = keysOf(balancedBlock(controllerSrc, "const copyBodySchema = z.object("));
check(
  "③-a POST /copies 请求体字段集 = 卡内契约（librarySpuIds, skuSelection）",
  sameSet(bodyKeys, new Set(CARD_COPY_BODY_KEYS)),
  `backend=${JSON.stringify(sorted(bodyKeys))} card=${JSON.stringify(CARD_COPY_BODY_KEYS)}`
);

/* ───────── ④ result 取值常量 ───────── */
const resultValues = [...serviceSrc.matchAll(/^\s{2}([A-Z_]+):\s*"(CREATED|SKIPPED|REJECTED)"/gm)].map((m) => m[2]);
check(
  "④-a result 取值常量 = CREATED / SKIPPED / REJECTED（后端常量，不落库枚举）",
  sameSet(new Set(resultValues), new Set(CARD_RESULT_VALUES)),
  `service=${JSON.stringify(resultValues)}`
);
check(
  "④-b 流水表不设 result 列（只记成功 ⇒ 统计口径天然等于配额扣减次数，Q6）",
  !/^\s*result\s+VARCHAR/m.test(read("docs/migrations/190_商品库调取流水.sql")),
  "190 无 result 列"
);

/* ───────── ⑤ 迁移硬口径 ───────── */
/** 生产管线等价切块：剥离块开头的整行注释后按分号切（与 shared/migration.splitSqlStatements 同口径的简化版） */
function splitStatements(sql) {
  const stripped = sql
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  return stripped
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((chunk) => chunk.length > 0);
}

for (const rel of ["docs/migrations/190_商品库调取流水.sql", "docs/migrations/191_租户商品库调取映射.sql"]) {
  const sql = read(rel);
  const statements = splitStatements(sql);
  const joined = statements.join("\n");
  const tables = [...joined.matchAll(/CREATE TABLE IF NOT EXISTS/g)].length;
  const writes = statements.filter((s) => /^(INSERT|UPDATE|DELETE|REPLACE|CALL)\b/i.test(s));
  const textColumns = [...joined.matchAll(/CHARACTER SET utf8mb4/g)].length;
  const explicitCollate = [...joined.matchAll(/CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci/g)].length;
  const firstLine = sql.split("\n").find((line) => line.trim().length > 0) ?? "";
  const firstComment = sql.split("\n").findIndex((line) => line.trim().startsWith("--"));
  const lastExecutable = sql
    .split("\n")
    .reduce((last, line, index) => (line.trim().length > 0 && !line.trim().startsWith("--") ? index : last), 0);
  const asciiSemicolonInComments = sql
    .split("\n")
    .filter((line) => line.trim().startsWith("--"))
    .join("\n")
    .includes(";");

  const label = rel.split("/").pop();
  check(
    `⑤-a ${label}：1 条 CREATE TABLE IF NOT EXISTS 且首行即可执行语句（可执行语句顶格在注释之前）`,
    tables >= 1 && firstLine.trim().toUpperCase().startsWith("CREATE TABLE IF NOT EXISTS") && firstComment > lastExecutable,
    `tables=${tables} firstLine=${firstLine.trim().slice(0, 40)}…`
  );
  check(
    `⑤-b ${label}：零数据写语句（INSERT/UPDATE/DELETE/REPLACE/CALL 命中 ${writes.length}）`,
    writes.length === 0,
    `statements=${statements.length} writes=${JSON.stringify(writes).slice(0, 80)}`
  );
  check(
    `⑤-c ${label}：文本列显式 COLLATE utf8mb4_0900_ai_ci（${explicitCollate}/${textColumns}）且无 utf8mb4_unicode_ci`,
    textColumns > 0 && explicitCollate === textColumns && !joined.includes("utf8mb4_unicode_ci"),
    `textColumns=${textColumns} explicitCollate=${explicitCollate}`
  );
  check(
    `⑤-d ${label}：不建物理外键 / 无 DROP / 无反引号 / 注释内无 ASCII 分号（踩坑 [63]）`,
    !/FOREIGN\s+KEY/i.test(joined) &&
      !/REFERENCES/i.test(joined) &&
      !/DROP\s+TABLE/i.test(joined) &&
      !joined.includes("`") &&
      !asciiSemicolonInComments,
    `foreignKey=${/FOREIGN\s+KEY/i.test(joined)} backtick=${joined.includes("`")} semicolonInComment=${asciiSemicolonInComments}`
  );
}

/* ───────── ⑥ 权限点代码常量 ───────── */
const permSrc = read("backend/src/shared/library-permission-codes.ts");
check(
  "⑥-a 权限点常量 = library:view / library:copy，且路由用常量而非字面量（Q8 ①）",
  permSrc.includes('PERM_LIBRARY_VIEW = "library:view"') &&
    permSrc.includes('PERM_LIBRARY_COPY = "library:copy"') &&
    tenantRoutesSrc.includes("requirePermission(PERM_LIBRARY_VIEW)") &&
    tenantRoutesSrc.includes("requirePermission(PERM_LIBRARY_COPY)") &&
    !/requirePermission\("library:/.test(tenantRoutesSrc),
  "路由引用常量，无字面量权限码"
);
check(
  "⑥-b 迁移零预置：两文件均无任何角色授权 UPDATE（授权由凌舟在平台权限矩阵端点配置）",
  !read("docs/migrations/190_商品库调取流水.sql").includes("t_sys_role") &&
    !read("docs/migrations/191_租户商品库调取映射.sql").includes("t_sys_role"),
  "190/191 均不触碰 t_sys_role"
);

/* ───────── 输出 ───────── */
console.log("\n—— 后端注册路径（本单域内） ——");
console.log(`   租户 ${tenantPrefix}：${sorted(registeredTenant).join(" | ")}`);
console.log(`   平台 ${platformPrefix}：${sorted(registeredPlatform).join(" | ")}`);
console.log("\n—— 前端字面路径逐条（文件:行 ⇒ 归一化路径） ——");
if (pathHits.length === 0) console.log("   （前端暂无本单路径引用：本单为纯后端单，前端消费在后续步）");
for (const hit of pathHits) console.log(`   ${hit}`);
console.log(`\nDEFERRED（Q9 不实现，仅允许出现在前端 TODO）: ${sorted(DEFERRED_PATHS).join(", ")}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项断言，FAIL ${failed.length} 项 / EXIT=${failed.length ? 1 : 0}`);
process.exitCode = failed.length ? 1 : 0;
