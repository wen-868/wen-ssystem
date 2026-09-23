/**
 * C2-4 独立核验工具库（执行：苏然 / 测试·QA）
 *
 * 方法（与凌舟侧取证**不同**）：
 *   1) 从**后端源码**反向推导端点集合（routeConfig.prefix × 路由注册语句，按**源码出现顺序**）；
 *   2) 从**前端 api 模块源码**推导调用集合（request.<method> 字面量路径 × utils/request.ts 的 baseURL）；
 *   3) 两侧集合做**双向差集**；
 *   4) 通配吞并风险用**同文件注册顺序 + 全仓同路径竞争**静态证明；
 *   5) 视图引用用「导入表 + 调用点」静态证明。
 *
 * 本文件不执行任何业务代码、不 mock 任何模块、不依赖 vitest/vite/esbuild。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";

/** 本单被核验的两个后端路由文件 */
export const TARGET_ROUTE_FILES = [
  "backend/src/routes/platform-templates.routes.ts",
  "backend/src/routes/admin-platform-announcement.routes.ts",
];

/** 本单被核验的两个前端 api 模块 + 两个视图 */
export const TARGET_API_FILES = [
  "saas-admin/src/api/platform-template.ts",
  "saas-admin/src/api/announcement.ts",
];

export const VIEW_BINDINGS = [
  {
    view: "saas-admin/src/views/platform/TemplateCenter.vue",
    apiModule: "platform-template",
  },
  {
    view: "saas-admin/src/views/Announcements.vue",
    apiModule: "announcement",
  },
];

export const REQUEST_CLIENT_FILE = "saas-admin/src/utils/request.ts";

/** 行注释/块注释行清空（保留行数，便于报「文件:行」） */
export function blankCommentLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") ? "" : line;
    })
    .join("\n");
}

/** 路径规范化：动态模板 `${...}` 与 express 参数 `:x` 统一成 `:param` */
export function canonicalPath(p) {
  const normalized = String(p)
    .replace(/\$\{[^}]*\}/g, ":param")
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ":param")
    .replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

export function joinPrefix(prefix, p) {
  if (!p || p === "/") return prefix;
  return `${prefix}${p.startsWith("/") ? "" : "/"}${p}`;
}

/** 收集仓库内所有路由文件（用于「同路径竞争」扫描） */
export function listAllRouteFiles(root) {
  const dir = join(root, "backend", "src", "routes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".routes.ts"))
    .sort()
    .map((f) => `backend/src/routes/${f}`);
}

/**
 * 解析单个后端路由文件 → 端点集合（含源码行号）
 */
export function extractRouteFile(root, relPath) {
  const raw = readFileSync(join(root, relPath), "utf8");
  const rawLines = raw.split(/\r?\n/);
  const code = blankCommentLines(raw);

  const prefixMatch = /export\s+const\s+routeConfig\s*:\s*RouteConfig\s*=\s*\{[\s\S]*?prefix\s*:\s*"([^"]+)"/.exec(code);
  const prefix = prefixMatch ? prefixMatch[1] : null;
  const authMatch = /export\s+const\s+routeConfig\s*:\s*RouteConfig\s*=\s*\{[\s\S]*?auth\s*:\s*"([^"]+)"/.exec(code);

  const declaredRouters = new Set();
  let m;
  const reDecl = /const\s+([A-Za-z_$][\w$]*)\s*=\s*Router\(\)/g;
  while ((m = reDecl.exec(code))) declaredRouters.add(m[1]);

  const endpoints = [];
  const reRoute = /([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*"([^"]*)"/g;
  while ((m = reRoute.exec(code))) {
    const [, routerVar, method, path] = m;
    if (!declaredRouters.has(routerVar)) continue;
    const line = code.slice(0, m.index).split("\n").length;
    endpoints.push({
      file: relPath,
      router: routerVar,
      method: method.toUpperCase(),
      path,
      fullPath: joinPrefix(prefix, path),
      line,
      lineText: rawLines[line - 1].trim(),
    });
  }

  // 完整性自检：源码里 `.<verb>(` 出现次数必须等于解析出的端点条数
  const verbOccurrences = (code.match(/\.\s*(get|post|put|delete|patch)\s*\(/g) || []).length;

  return {
    file: relPath,
    prefix,
    auth: authMatch ? authMatch[1] : null,
    routers: [...declaredRouters],
    endpoints,
    verbOccurrences,
    parseComplete: verbOccurrences === endpoints.length,
  };
}

/** 读取前端请求层 baseURL */
export function extractClientBaseUrl(root) {
  const code = blankCommentLines(readFileSync(join(root, REQUEST_CLIENT_FILE), "utf8"));
  const m = /baseURL\s*:\s*["'`]([^"'`]+)["'`]/.exec(code);
  return m ? m[1] : null;
}

/**
 * 解析单个前端 api 模块 → 封装函数集合（每个函数绑定的 request 调用）
 */
export function extractApiModule(root, relPath) {
  const raw = readFileSync(join(root, relPath), "utf8");
  const code = blankCommentLines(raw);
  const marks = [];
  let m;
  const reFn = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = reFn.exec(code))) marks.push({ name: m[1], index: m.index });

  const functions = marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : code.length;
    const body = code.slice(mark.index, end);
    const calls = [];
    const reCall = /request\s*\.\s*(get|post|put|delete|patch)\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
    let cm;
    while ((cm = reCall.exec(body))) {
      calls.push({ method: cm[1].toUpperCase(), pathLiteral: cm[2].slice(1, -1) });
    }
    return {
      file: relPath,
      name: mark.name,
      line: code.slice(0, mark.index).split("\n").length,
      calls,
    };
  });

  const verbOccurrences = (code.match(/request\s*\.\s*(get|post|put|delete|patch)\s*\(/g) || []).length;

  return {
    file: relPath,
    functions,
    verbOccurrences,
    parseComplete: verbOccurrences === functions.reduce((n, f) => n + f.calls.length, 0),
  };
}

/** 视图 ↔ 封装函数 绑定关系（导入表 + 调用点） */
export function extractViewUsage(root, viewPath, wrapperNames) {
  const raw = readFileSync(join(root, viewPath), "utf8");
  const code = blankCommentLines(raw);

  const imported = new Set();
  const reImport = /import\s*\{([^}]*)\}\s*from\s*["'][^"']*["']/g;
  let m;
  while ((m = reImport.exec(code))) {
    m[1]
      .split(",")
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean)
      .forEach((n) => imported.add(n));
  }

  const bodyWithoutImports = code.replace(reImport, "");
  const usage = {};
  for (const name of wrapperNames) {
    const reCall = new RegExp(`(^|[^\\w$.])${name}\\s*\\(`, "g");
    usage[name] = {
      imported: imported.has(name),
      callSites: (bodyWithoutImports.match(reCall) || []).length,
    };
  }
  return { view: viewPath, importedCount: imported.size, usage };
}

/** express 路径 → 正则（`:param` 段匹配单段） */
export function pathToRegExp(fullPath) {
  const pattern = canonicalPath(fullPath)
    .split("/")
    .map((seg) => (seg === ":param" ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${pattern}$`);
}

/** 递归收集文件（用于全仓扫描） */
export function walkFiles(dir, extFilter) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full, extFilter));
    else if (!extFilter || extFilter(full)) out.push(full);
  }
  return out;
}

export function toRepoPath(root, absPath) {
  return relative(root, absPath).split(sep).join("/");
}

/** 判断某路径是否被通配路由吞并（先注册的通配能匹配后注册的字面量） */
export function detectShadowing(endpoints) {
  const hazards = [];
  for (let i = 0; i < endpoints.length; i++) {
    const a = endpoints[i];
    if (!a.fullPath.includes(":")) continue;
    const re = pathToRegExp(a.fullPath);
    for (let j = i + 1; j < endpoints.length; j++) {
      const b = endpoints[j];
      if (b.method !== a.method) continue;
      if (b.fullPath.includes(":")) continue;
      if (re.test(canonicalPath(b.fullPath))) {
        hazards.push({
          kind: "同文件先通配后字面量",
          shadow: { method: a.method, path: a.fullPath, file: a.file, line: a.line },
          victim: { method: b.method, path: b.fullPath, file: b.file, line: b.line },
        });
      }
    }
  }
  return hazards;
}

/**
 * ── 核验①主逻辑（可被 01 CLI 与 02 反测**进程内**直接调用） ──
 *
 * 之所以做成函数：本沙箱内 `node` 的 child_process spawn 被拒（EPERM），
 * 反测无法用「另起子进程跑检测器」的方式做，只能在**同一进程内**用
 * 「指向副本目录的同一分析函数」实现 —— 检测逻辑仍是同一份，不降低强度。
 *
 * @returns {{lines: string[], failures: string[], data: object}}
 */
export function analyzeStaticDiff(ROOT, label = "baseline") {
  const lines = [];
  const log = (s = "") => lines.push(s);
  const failures = [];

  log(`[C2-4/01] 静态端点差集核验  label=${label}`);
  log(`[C2-4/01] 仓库根：${ROOT}`);
  log("");

  // ── A. 后端端点集合（反向推导） ────────────────────────────────
  const baseUrl = extractClientBaseUrl(ROOT);
  log(`[A] 前端请求层 baseURL = ${baseUrl}（来自 ${REQUEST_CLIENT_FILE}）`);
  if (baseUrl !== "/api") failures.push(`baseURL 不是 /api（实际 ${baseUrl}）`);

  const routeFiles = TARGET_ROUTE_FILES.map((f) => extractRouteFile(ROOT, f));
  const backendEndpoints = [];
  for (const rf of routeFiles) {
    log(`\n[A] ${rf.file}`);
    log(`    routeConfig.prefix = ${rf.prefix}   auth = ${rf.auth}`);
    log(`    routers = ${rf.routers.join(", ")}`);
    log(`    解析端点 = ${rf.endpoints.length}，源码 <verb>( 出现 = ${rf.verbOccurrences}，parseComplete=${rf.parseComplete}`);
    if (!rf.parseComplete) failures.push(`${rf.file} 解析条数与源码出现次数不一致（正则漏解析风险）`);
    for (const ep of rf.endpoints) {
      log(`      ${String(ep.line).padStart(4)}: ${ep.method.padEnd(6)} ${ep.fullPath}`);
      backendEndpoints.push(ep);
    }
  }

  log("");
  log(`[A] 后端端点合计 = ${backendEndpoints.length}`);

  const backendKey = (method, fullPath) => `${method} ${canonicalPath(fullPath)}`;
  const backendSet = new Map();
  for (const ep of backendEndpoints) {
    const key = backendKey(ep.method, ep.fullPath);
    if (!backendSet.has(key)) backendSet.set(key, []);
    backendSet.get(key).push(ep);
  }
  const dupBackend = [...backendSet.entries()].filter(([, v]) => v.length > 1);
  if (dupBackend.length) {
    log(`[A] ⚠ 后端重复注册（同一规范化路径出现多次）：`);
    for (const [key, v] of dupBackend) log(`      ${key} ← ${v.map((e) => `${e.file}:${e.line}`).join(" / ")}`);
  }

  // ── B. 前端调用集合（含 baseURL 拼接，落实「URL × 前缀 × 方法」三件套） ──
  const apiModules = TARGET_API_FILES.map((f) => extractApiModule(ROOT, f));
  const frontendCalls = [];
  for (const mod of apiModules) {
    log("");
    log(`[B] ${mod.file}：封装函数 ${mod.functions.length} 个，request 调用 ${mod.verbOccurrences} 处，parseComplete=${mod.parseComplete}`);
    if (!mod.parseComplete) failures.push(`${mod.file} 解析条数与源码出现次数不一致`);
    for (const fn of mod.functions) {
      if (!fn.calls.length) {
        log(`      ${String(fn.line).padStart(4)}: ${fn.name}()  ⚠ 未发现 request 调用`);
        failures.push(`${mod.file}:${fn.line} ${fn.name}() 未解析到 request 调用`);
      }
      for (const c of fn.calls) {
        const fullPath = `${baseUrl}${c.pathLiteral}`;
        log(`      ${String(fn.line).padStart(4)}: ${fn.name}() -> ${c.method} ${fullPath}`);
        frontendCalls.push({
          module: mod.file,
          fn: fn.name,
          line: fn.line,
          method: c.method,
          pathLiteral: c.pathLiteral,
          fullPath,
        });
      }
    }
  }

  log("");
  log(`[B] 前端接线合计 = ${frontendCalls.length} 条（${apiModules.map((m) => `${m.file.split("/").pop()}:${m.functions.length}`).join(" + ")}）`);

  // ── C. 差集（前端 → 后端） ────────────────────────────────────
  const unmatched = [];
  const matched = [];
  for (const call of frontendCalls) {
    const key = backendKey(call.method, call.fullPath);
    if (backendSet.has(key)) matched.push({ call, backend: backendSet.get(key) });
    else unmatched.push({ call, key });
  }

  log("");
  log(`[C] 逐条对账：命中后端真实路由 ${matched.length} / ${frontendCalls.length}`);
  for (const { call, backend } of matched) {
    const target = backend[0];
    log(
      `      OK   ${call.method.padEnd(6)} ${call.fullPath.padEnd(48)} ← ${target.file}:${target.line}（${call.module.split("/").pop()}:${call.line} ${call.fn}）`
    );
  }
  if (unmatched.length) {
    log("");
    log(`[C] ✗ 不一致 ${unmatched.length} 条（前端有调用、后端无对应路由）：`);
    for (const u of unmatched) {
      log(`      FAIL ${u.call.method} ${u.call.fullPath}  ← ${u.call.module}:${u.call.line} ${u.call.fn}()`);
      failures.push(`前端调用无后端路由：${u.call.method} ${u.call.fullPath}（${u.call.module}:${u.call.line}）`);
    }
  }

  // 反向：后端有、前端未调用（仅告知，不作红）
  const unusedBackend = backendEndpoints.filter((ep) => {
    const key = backendKey(ep.method, ep.fullPath);
    return !frontendCalls.some((c) => backendKey(c.method, c.fullPath) === key);
  });
  log("");
  log(`[C] 反向：后端已注册但两个前端模块未调用 = ${unusedBackend.length}`);
  for (const ep of unusedBackend) log(`      - ${ep.method} ${ep.fullPath}  ← ${ep.file}:${ep.line}`);

  // ── D. 通配吞并（同文件注册顺序） ─────────────────────────────
  const sameFileHazards = routeFiles.flatMap((rf) => detectShadowing(rf.endpoints));
  log("");
  log(`[D] 同文件「先通配后字面量」吞并风险 = ${sameFileHazards.length}`);
  for (const h of sameFileHazards) {
    log(`      ✗ ${h.victim.method} ${h.victim.path}（${h.victim.file}:${h.victim.line}）会被 ${h.shadow.path}（${h.shadow.file}:${h.shadow.line}）吞掉`);
    failures.push(`通配吞并：${h.victim.method} ${h.victim.path}`);
  }

  // 专项：/announcements/templates 是否被 /:id 吞
  const templatesRoute = backendEndpoints.find(
    (ep) => ep.method === "GET" && canonicalPath(ep.fullPath) === canonicalPath("/api/platform/announcements/templates")
  );
  const idRoute = backendEndpoints.find(
    (ep) => ep.method === "GET" && canonicalPath(ep.fullPath) === canonicalPath("/api/platform/announcements/:id")
  );
  log("");
  log(`[D-专项] GET /api/platform/announcements/templates 注册行 = ${templatesRoute ? `${templatesRoute.file}:${templatesRoute.line}` : "未找到"}`);
  log(`[D-专项] GET /api/platform/announcements/:id 注册行 = ${idRoute ? `${idRoute.file}:${idRoute.line}` : "未找到"}`);
  if (templatesRoute && idRoute) {
    const ok = templatesRoute.line < idRoute.line;
    log(`[D-专项] templates 注册早于 /:id ? ${ok ? "是（不会被吞）" : "否（会被吞）"}`);
    if (!ok) failures.push("/announcements/templates 注册晚于 /:id，会被通配吞掉");
  } else {
    failures.push("未同时解析到 templates 与 /:id 两条注册");
  }

  // ── E. 视图引用（导入表 + 调用点） ────────────────────────────
  log("");
  log("[E] 视图 ↔ 封装函数 绑定（导入 + 调用点）");
  const viewReport = [];
  for (const binding of VIEW_BINDINGS) {
    const mod = apiModules.find((m) => m.file.endsWith(`${binding.apiModule}.ts`));
    const names = mod.functions.map((f) => f.name);
    const usage = extractViewUsage(ROOT, binding.view, names);
    log(`      ${binding.view}`);
    for (const name of names) {
      const u = usage.usage[name];
      const state = !u.imported ? "未导入" : u.callSites === 0 ? "已导入未调用" : "已接线";
      log(`        ${name.padEnd(32)} imported=${String(u.imported).padEnd(5)} callSites=${String(u.callSites).padEnd(3)} ${state}`);
    }
    const dead = names.filter((n) => !usage.usage[n].imported || usage.usage[n].callSites === 0);
    viewReport.push({ ...usage, deadWrappers: dead });
    if (dead.length) {
      log(`        ⚠ 视图未使用的封装：${dead.join(", ")}（属"封装已定义但界面无入口"，需澄清是否计入"接线"）`);
    }
  }

  // ── F. 结论 ───────────────────────────────────────────────────
  log("");
  log(`[F] 结论：不一致 ${failures.length} 项`);
  for (const f of failures) log(`      ✗ ${f}`);
  log(`RESULT: ${failures.length === 0 ? "ALL PASS" : "FAILURES"}`);
  log(`EXIT=${failures.length === 0 ? 0 : 1}`);

  return {
    lines,
    failures,
    data: {
      label,
      root: ROOT,
      baseUrl,
      routeFiles,
      backendEndpoints,
      apiModules,
      frontendCalls,
      unmatched,
      unusedBackend,
      sameFileHazards,
      templatesRoute,
      idRoute,
      viewReport,
      failures,
    },
  };
}

/**
 * ── 核验①b 主逻辑：全仓「同路径竞争」离线判定（可进程内调用，供反测 M4） ──
 *
 * 依据 backend/src/shared/auto-routes.ts 的真实规则：
 *   1) 扫描 backend/src/routes/*.routes.ts，**按文件名升序**注册（files.sort()）；
 *   2) 每个文件用 routeConfig.prefix 作为 app.use 前缀；
 *   3) express 先匹配先命中（同一 prefix 下按注册顺序）。
 *
 * @returns {{lines: string[], failures: string[], data: object}}
 */
export function analyzeCrossFile(ROOT, target = "GET:/api/platform/announcements/templates") {
  const lines = [];
  const log = (s = "") => lines.push(s);
  const failures = [];
  const [targetMethod, targetPath] = target.split(/:(?=\/)/);

  const extractPrefixes = (code) => {
    const prefixes = [];
    const reSingle = /export\s+const\s+routeConfig\s*:\s*RouteConfig\s*=\s*\{[\s\S]*?prefix\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = reSingle.exec(code))) prefixes.push(m[1]);
    const reMulti = /prefix\s*:\s*"([^"]+)"/g;
    while ((m = reMulti.exec(code))) if (!prefixes.includes(m[1])) prefixes.push(m[1]);
    return prefixes;
  };

  const extractRegistrations = (code) => {
    const out = [];
    const re = /([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(code))) {
      const line = code.slice(0, m.index).split("\n").length;
      out.push({ router: m[1], method: m[2].toUpperCase(), path: m[3], line });
    }
    return out;
  };

  log(`[C2-4/01b] 全仓同路径竞争模拟  root=${ROOT}`);
  log(`[C2-4/01b] 目标：${targetMethod} ${targetPath}`);
  log(`[C2-4/01b] 注册顺序规则：files.sort() 文件名升序（backend/src/shared/auto-routes.ts:88-90）`);
  log("");

  const mounts = [];
  for (const rel of listAllRouteFiles(ROOT)) {
    const raw = readFileSync(join(ROOT, rel), "utf8");
    const code = blankCommentLines(raw);
    mounts.push({ file: rel, prefixes: extractPrefixes(code), regs: extractRegistrations(code) });
  }

  log(`[C2-4/01b] 扫描路由文件 ${mounts.length} 个（排序后依次挂载）`);
  const targetCanonical = canonicalPath(targetPath);
  const candidates = [];
  let order = 0;
  for (const mount of mounts) {
    for (const prefix of mount.prefixes) {
      const fits =
        targetPath === prefix ||
        targetPath.startsWith(`${prefix}/`) ||
        canonicalPath(targetPath).startsWith(`${canonicalPath(prefix)}/`);
      if (!fits) continue;
      for (const reg of mount.regs) {
        const full = `${prefix}${reg.path === "/" ? "" : reg.path}`;
        if (reg.method !== targetMethod) continue;
        const re = pathToRegExp(full);
        if (re.test(targetCanonical)) {
          candidates.push({
            order: order++,
            file: mount.file,
            prefix,
            method: reg.method,
            path: reg.path,
            fullPath: full,
            line: reg.line,
          });
        }
      }
    }
  }

  log("");
  log(`[C2-4/01b] 能匹配目标的行（按 express 命中顺序）共 ${candidates.length} 条：`);
  for (const c of candidates) {
    log(`      #${c.order}  ${c.method} ${c.fullPath.padEnd(46)} ← ${c.file}:${c.line}（prefix=${c.prefix}）`);
  }

  const winner = candidates[0];
  log("");
  if (!winner) {
    log("[C2-4/01b] ✗ 无任何路由匹配目标 ⇒ 该路径会 404");
    failures.push(`无任何路由匹配目标 ${target} ⇒ 该路径会 404`);
    log("RESULT: FAILURES");
    return { lines, failures, data: { target, candidates, winner: null } };
  }
  log(`[C2-4/01b] 实际命中的 handler = ${winner.file}:${winner.line} → ${winner.method} ${winner.fullPath}`);
  const isTemplatesHandler = winner.path === "/templates";
  log(`[C2-4/01b] 是否由「/templates」专门 handler 命中（而非被 /:id 通配吞掉）: ${isTemplatesHandler ? "是" : "否"}`);
  const competing = candidates.filter((c) => c.path === "/:id");
  if (competing.length) {
    log(`[C2-4/01b] 存在同方法通配候选 ${competing.length} 条：${competing.map((c) => `${c.file}:${c.line}`).join(", ")}`);
    log(`[C2-4/01b] 它们位于命中之后 ⇒ 不会抢先处理（注册顺序已证明）`);
  }
  if (!isTemplatesHandler) failures.push(`目标 ${target} 被 ${winner.fullPath} 抢先命中（通配吞并）`);
  log(`RESULT: ${failures.length === 0 ? "ALL PASS" : "FAILURES"}`);

  return { lines, failures, data: { target, candidates, winner } };
}
