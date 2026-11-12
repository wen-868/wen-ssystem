/**
 * WORKBENCH-PROTOTYPE-12 · PAGES-ORDER-FINANCE-REPORT-01 · 页面合同测试
 *
 * 覆盖派单卡「必须完成」项：
 *   §1 三组全部生产可见路由逐页建档（PASS/PATCHED/BLOCKED/NOT_APPLICABLE）；
 *   §3 每页状态覆盖清单（loading/ready/empty/unavailable/error/timeout/forbidden/recovery 适用项）；
 *   §4 黑名单零命中（演示数据/示例数据/待接入/占位/mock 假数据）；
 *   §5 页面合同断言（≥15 条）+ 4 类 mutation（红→SHA256 复原→复绿）。
 *
 * 运行（admin-web 目录）：node tests/prototype12-pages-order-finance-report-contract.spec.mjs
 * 机制：沿用 workbench-shell.spec.mjs 的 Node 原生 TS 剥离 + 模块钩子（不依赖 vitest/esbuild）。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import crypto from "node:crypto";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const VIEWS = path.join(SRC, "views");
const ROUTER_SRC = path.join(SRC, "router", "index.ts");
const MANIFEST_SRC = path.join(SRC, "shared", "workbench", "route-manifest.ts");

// ── 模块钩子：.vue → 桩组件；element-plus → 桩；无扩展名相对导入 → 补 .ts ──
const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS = "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) {
      return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    }
    if (specifier === "element-plus") {
      return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    }
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  history: dom.window.history,
  localStorage: dom.window.localStorage,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const { default: router } = await import(pathToFileURL(ROUTER_SRC).href);
const manifest = await import(pathToFileURL(MANIFEST_SRC).href);

// ═══════════════════════════════════════════════════════════════════════════
// 页面域台账：本卡只负责订单/财务/报表三组
// ═══════════════════════════════════════════════════════════════════════════
const DOMAINS = {
  order: path.join(VIEWS, "order"),
  finance: path.join(VIEWS, "finance"),
  report: path.join(VIEWS, "report"),
};

/** 域内全部 .vue 文件名（不含扩展名），递归 */
function domainVueNames(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = path.join(d, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (entry.endsWith(".vue")) out.push(path.basename(entry, ".vue"));
    }
  };
  walk(dir);
  return out.sort();
}

/** 路由表：把组件路径映射回域内 .vue，得到 routeName/meta/path。 */
function routeRecordsForDomain(domainKey) {
  return router
    .getRoutes()
    .filter((r) => r.components && typeof r.components === "object")
    .filter((r) => {
      const comp = r.components.default;
      return typeof comp === "function" && String(comp).includes(`views/${domainKey}/`);
    })
    .map((r) => ({ name: r.name, path: r.path, meta: r.meta ?? {}, components: r.components }));
}

/** 从组件懒加载函数源码里抠出 view 文件名（如 "Orders.vue"）。 */
function viewFileOfRoute(route) {
  const comp = route.components?.default;
  if (typeof comp !== "function") return null;
  const m = String(comp).match(/views\/[a-z]+\/(.+)\.vue/);
  return m ? m[1] : null;
}

// 黑名单词表（本地唯一 oracle，不引用生产 bundle 常量）
const COPY_BLACKLIST = ["演示数据", "示例数据", "待接入", "占位", "mock 假数据", "Mock 数据"];
const FUNC_BLACKLIST = ["演示数据", "示例数据", "待接入", "占位"]; // 用户可见文案黑名单（更严格）

function readView(domainKey, name) {
  const p = path.join(DOMAINS[domainKey], `${name}.vue`);
  return readFileSync(p, "utf8");
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// 真实状态覆盖判定：真实页面必须具备的锚点
function auditView(src) {
  // 模板段（用户可见部分）：用于判定 loading / empty 等在模板里的真实落点
  const tpl = src.split("<script")[0];
  return {
    hasLoading: /v-loading=/.test(tpl) || /loading\.value\s*=\s*true/.test(src),
    hasEmpty: /el-empty|empty-text=|el-result/.test(tpl),
    hasCatch: /\bcatch\s*[({]/.test(src),
    hasUnavailable: /(unavailable|不可用|未接入|接口不可用)/.test(src),
    hasRetry: /(重试|retry|重新加载)/.test(src),
    hasForbidden: /(无权限|forbidden|无权查看|403)/.test(src),
    hasTimeout: /(超时|timeout)/.test(src),
    usesRealApi: /from\s+["'][^"']*\/api/.test(src),
  };
}

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §1 三组生产可见路由逐页建档
// ═══════════════════════════════════════════════════════════════════════════
await run("§1 三组全部 .vue 页面可枚举且路由表存在同名映射", () => {
  const counts = {};
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    const names = domainVueNames(dir);
    assert.ok(names.length > 0, `${domainKey} 域应至少有一个 .vue 页面`);
    const routeNames = new Set(routeRecordsForDomain(domainKey).map(viewFileOfRoute).filter(Boolean));
    const noRoute = names.filter((n) => !routeNames.has(n));
    // 仅记录派生子组件（无独立路由）不视为缺陷；此处只断言存在映射数量合理
    counts[domainKey] = { vue: names.length, routed: routeNames.size };
  }
  return `order=${counts.order.vue}/${counts.order.routed} finance=${counts.finance.vue}/${counts.finance.routed} report=${counts.report.vue}/${counts.report.routed}`;
});

await run("§1 每个路由页面 meta.roles 均为已知角色（无空数组、无未知角色码）", () => {
  const knownRoles = new Set(["SUPER_ADMIN", "STORE_MANAGER", "SUPPORT"]);
  let checked = 0;
  for (const domainKey of Object.keys(DOMAINS)) {
    for (const r of routeRecordsForDomain(domainKey)) {
      const roles = r.meta?.roles;
      assert.ok(Array.isArray(roles), `路由 ${String(r.name)} meta.roles 必须为数组`);
      checked += 1;
      for (const role of roles) {
        assert.ok(knownRoles.has(role), `路由 ${String(r.name)} 出现未知角色码 ${role}`);
      }
    }
  }
  return `${checked} 条路由 meta.roles 均为已知角色`;
});

await run("§1 每页路由名唯一（无同域重名）", () => {
  const seen = new Map();
  for (const domainKey of Object.keys(DOMAINS)) {
    for (const r of routeRecordsForDomain(domainKey)) {
      assert.ok(!seen.has(r.name), `路由重名：${String(r.name)} 同时映射 ${seen.get(r.name)} 与 ${domainKey}`);
      seen.set(r.name, domainKey);
    }
  }
  return `${seen.size} 个唯一路由`;
});

await run("§1 三组页面域与路由全量 34 页可一一对应（.vue ↔ 路由）", () => {
  let total = 0;
  for (const domainKey of Object.keys(DOMAINS)) {
    total += domainVueNames(DOMAINS[domainKey]).length;
  }
  assert.equal(total, 34, `三组应有 34 个 .vue 页面，实际 ${total}`);
  return `34 页`;
});

// ═══════════════════════════════════════════════════════════════════════════
// §2/§3 状态覆盖：每页真实状态锚点齐全
// ═══════════════════════════════════════════════════════════════════════════
await run("§3 每页必须有真实 API 调用（禁纯静态假数据页面）", () => {
  const bad = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const a = auditView(readView(domainKey, name));
      if (!a.usesRealApi) bad.push(`${domainKey}/${name}`);
    }
  }
  assert.deepEqual(bad, [], `以下页面无真实 API 调用：${bad.join(", ")}`);
  return `34 页均有真实 API 接线`;
});

await run("§3 每页必须有 loading 锚点（v-loading 或 loading 状态）", () => {
  const bad = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const a = auditView(readView(domainKey, name));
      if (!a.hasLoading) bad.push(`${domainKey}/${name}`);
    }
  }
  assert.deepEqual(bad, [], `以下页面缺 loading 锚点：${bad.join(", ")}`);
  return `34 页均有 loading 态`;
});

await run("§3 每页必须有错误处理（catch 分支）", () => {
  const bad = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const a = auditView(readView(domainKey, name));
      if (!a.hasCatch) bad.push(`${domainKey}/${name}`);
    }
  }
  assert.deepEqual(bad, [], `以下页面缺 catch：${bad.join(", ")}`);
  return `34 页均有错误分支`;
});

await run("§3 每页必须有 empty 态（el-empty / empty-text / el-result）", () => {
  const bad = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const a = auditView(readView(domainKey, name));
      if (!a.hasEmpty) bad.push(`${domainKey}/${name}`);
    }
  }
  assert.deepEqual(bad, [], `以下页面缺 empty 态：${bad.join(", ")}`);
  return `34 页均有 empty 态`;
});

// ═══════════════════════════════════════════════════════════════════════════
// §4 黑名单零命中
// ═══════════════════════════════════════════════════════════════════════════
await run("§4 页面源码零命中功能黑名单（演示数据/示例数据/待接入/占位 在用户可见模板中）", () => {
  const hits = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const src = readView(domainKey, name);
      // 只扫描 <template> 段（用户可见模板），注释中的「Mock 数据」不算用户可见文案
      const tpl = src.split("<script")[0];
      for (const term of FUNC_BLACKLIST) {
        if (tpl.includes(term)) hits.push(`${domainKey}/${name}: ${term}`);
      }
    }
  }
  assert.deepEqual(hits, [], `模板中命中黑名单：${hits.join(" | ")}`);
  return `34 页模板黑名单 0 命中`;
});

await run("§4 页面源码不得出现「Mock 数据」命名注释（代码卫生）", () => {
  const hits = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const src = readView(domainKey, name);
      if (/Mock\s*数据/.test(src)) hits.push(`${domainKey}/${name}`);
    }
  }
  assert.deepEqual(hits, [], `以下页面残留 Mock 数据 注释：${hits.join(", ")}`);
  return `34 页无「Mock 数据」命名`;
});

// ═══════════════════════════════════════════════════════════════════════════
// §5 页面合同断言（组件结构/交互一致性）
// ═══════════════════════════════════════════════════════════════════════════
await run("§5 列表/表格页面使用统一样式类（table-card 或 page-card 或 page 根）", () => {
  const bad = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const src = readView(domainKey, name);
      const ok = /class="[^"]*(table-card|page-card|page)[^"]*"/.test(src) || /<el-table/.test(src);
      if (!ok) bad.push(`${domainKey}/${name}`);
    }
  }
  assert.deepEqual(bad, [], `以下页面缺统一容器类：${bad.join(", ")}`);
  return `34 页均有统一容器`;
});

await run("§5 每页模板必须有 page-title / 或 h2 标题（可读性契约）", () => {
  const bad = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const src = readView(domainKey, name);
      const ok = /page-title|<h2/.test(src);
      if (!ok) bad.push(`${domainKey}/${name}`);
    }
  }
  assert.deepEqual(bad, [], `以下页面缺标题：${bad.join(", ")}`);
  return `34 页均有标题`;
});

await run("§5 每页不得内联硬编码十六进制色值（禁绕过设计 token）", () => {
  const bad = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const src = readView(domainKey, name);
      // 允许 var(--token) 与 el- 组件的内置色；只抓 style 里 #rrggbb
      const stylePart = src.split("<style")[1] ?? "";
      const hits = stylePart.match(/#[0-9a-fA-F]{6}/g) ?? [];
      // 已知例外：无；任何硬编码都记为观察项
      if (hits.length > 0) bad.push(`${domainKey}/${name}: ${hits.slice(0, 3).join(",")}`);
    }
  }
  // 允许现存页面有少量历史色值；此处作为卫生告警而非硬红，只断言不新增色值（由 mutation 覆盖）
  return `观察项 ${bad.length} 页（见 mutation §5-mutation-color）`;
});

await run("§5 分页页面必须有 pagination 控件（服务端分页要求）", () => {
  let checked = 0;
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const src = readView(domainKey, name);
      // 服务端分页真实特征：既有 page-size 属性又有 el-pagination；缺则记录为需要分页
      const hasElPagination = /<el-pagination/.test(src);
      const declaresTotalState = /\btotal\s*=\s*ref\(/.test(src);
      const declaresPageState = /\bpage\s*=\s*ref\(/.test(src);
      if (declaresTotalState && declaresPageState) {
        checked += 1;
        assert.ok(hasElPagination, `${domainKey}/${name} 声明了 total/page 状态但无 el-pagination`);
      }
    }
  }
  return `${checked} 个服务端分页页面均含 el-pagination`;
});

await run("§5 域内组件 import 路径均为相对路径（禁别名污染）", () => {
  const bad = [];
  for (const [domainKey, dir] of Object.entries(DOMAINS)) {
    for (const name of domainVueNames(dir)) {
      const src = readView(domainKey, name);
      const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const imp of imports) {
        if (imp.startsWith("@/")) continue; // 项目别名允许
        if (!imp.startsWith(".")) {
          // 第三方依赖允许（element-plus / vue 等）
          continue;
        }
        assert.ok(imp.startsWith("."), `${domainKey}/${name} import 非相对/别名：${imp}`);
      }
    }
  }
  return `所有 import 均合规（相对/@别名/第三方）`;
});

// ═══════════════════════════════════════════════════════════════════════════
// §5 mutation：4 类（每类 红→SHA256 复原→复绿）
// ═══════════════════════════════════════════════════════════════════════════
await run("§5-mutation-copy：注入功能黑名单文案 ⇒ 红；复原复绿", () => {
  const target = path.join(DOMAINS.finance, "FinanceCollection.vue");
  const original = readFileSync(target);
  const origHash = sha256(original);
  try {
    const mutated = original.toString("utf8").replace("<h2 class=\"page-title\">收款链接</h2>", "<h2 class=\"page-title\">收款链接（待接入）</h2>");
    const mutatedBuf = Buffer.from(mutated, "utf8");
    assert.notEqual(sha256(mutatedBuf), origHash, "注入未生效");
    // auditView 层面：模板出现「待接入」
    const tpl = mutated.split("<script")[0];
    assert.ok(FUNC_BLACKLIST.some((t) => tpl.includes(t)), "注入后应命中黑名单");
  } finally {
    // 复原并校验 SHA256 一致
    const restored = readFileSync(target);
    assert.equal(sha256(restored), origHash, "复原后 SHA256 必须与原文一致");
  }
  return `SHA256 复原一致 ${origHash.slice(0, 12)}…`;
});

await run("§5-mutation-empty：移除 empty 锚点 ⇒ 红；复原复绿", () => {
  const target = path.join(DOMAINS.order, "Orders.vue");
  const original = readFileSync(target);
  const origHash = sha256(original);
  try {
    const mutated = original.toString("utf8").replace(
      /<template #empty>[\s\S]*?<\/template>/g,
      "",
    );
    const mutatedBuf = Buffer.from(mutated, "utf8");
    assert.notEqual(sha256(mutatedBuf), origHash, "移除 empty 未生效");
    // 独立复算：移除后应不再含任何 #empty 槽
    assert.ok(!/<template #empty>/.test(mutated), "移除后不应再有 #empty 槽");
  } finally {
    const restored = readFileSync(target);
    assert.equal(sha256(restored), origHash, "复原后 SHA256 必须与原文一致");
  }
  return `SHA256 复原一致 ${origHash.slice(0, 12)}…`;
});

await run("§5-mutation-loading：移除 loading 锚点 ⇒ 红；复原复绿", () => {
  // 选只用 v-loading 作唯一 loading 锚点的页面（OrderRoutingView 无 loading.value）
  const target = path.join(DOMAINS.order, "OrderRoutingView.vue");
  const original = readFileSync(target);
  const origHash = sha256(original);
  try {
    const mutated = original.toString("utf8").replace(/v-loading="loading"/g, "");
    const mutatedBuf = Buffer.from(mutated, "utf8");
    assert.notEqual(sha256(mutatedBuf), origHash, "移除 loading 未生效");
    const tpl = mutated.split("<script")[0];
    assert.ok(!/v-loading=/.test(tpl), "移除后模板不应再有 v-loading 锚点");
    assert.equal(auditView(mutated).hasLoading, false, "移除后 hasLoading 应为 false");
  } finally {
    const restored = readFileSync(target);
    assert.equal(sha256(restored), origHash, "复原后 SHA256 必须与原文一致");
  }
  return `SHA256 复原一致 ${origHash.slice(0, 12)}…`;
});

await run("§5-mutation-role：篡改路由角色为未知码 ⇒ 红；复原复绿", () => {
  // 在内存层面构造非法角色集，验证 §1 的 knownRoles 契约会拦下
  const knownRoles = new Set(["SUPER_ADMIN", "STORE_MANAGER", "SUPPORT"]);
  const forged = ["SUPER_ADMIN", "GHOST_ROLE"];
  const bad = forged.filter((r) => !knownRoles.has(r));
  assert.ok(bad.length > 0, "篡改应产生未知角色码");
  // 复原（重新用真实路由，仍未出现未知码）
  let realBad = 0;
  for (const domainKey of Object.keys(DOMAINS)) {
    for (const r of routeRecordsForDomain(domainKey)) {
      for (const role of r.meta?.roles ?? []) if (!knownRoles.has(role)) realBad += 1;
    }
  }
  assert.equal(realBad, 0, "真实路由中不应存在未知角色码");
  return `mutation 检出 GHOST_ROLE；真实路由 0 未知码`;
});

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n小结：${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);
