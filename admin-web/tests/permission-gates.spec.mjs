/**
 * S3-240 断言用例 —— 工作台「按钮级权限门」两侧反测（含真实 DOM 渲染）
 *
 * 覆盖（对应派单卡验收标准① ②）：
 *   一、判据同源：`matchPermissionCode` 与后端 `matchPermission` 四条规则逐条等价
 *       （`*` / `<dom>:*` / `*:<action>` / 精确码），含生产 `["*"]` 全通配角色的用例；
 *   二、注册表 ↔ 源码一致性：页面里出现的门 id 必须**全部**登记在注册表里，
 *       且每个 `status='gated'` 的门都必须在其声明的**每个页面**里被引用（不许多、不许少）；
 *   三、**两侧反测（真实 DOM）**：把源码里带 `v-if="canGate('<id>')"` 的**真实元素**
 *       抽出来编译渲染到 jsdom：
 *         · 持码（生产店主 `["*"]`）          ⇒ 按钮**必渲染**；
 *         · 不持码（生产店长真实权限串）      ⇒ 按钮**必不渲染**；
 *         · 未取到权限码（null）/ 空权限串     ⇒ 按钮**必不渲染**（失败关闭）。
 *
 * 运行（admin-web 目录）：npm test  （= node tests/role-guard.spec.mjs && node tests/landing.spec.mjs
 *                                && node tests/permission-gates.spec.mjs）
 *
 * 说明：与 tests/role-guard.spec.mjs / tests/landing.spec.mjs 同一套 harness
 *       （Node 原生 TS 剥离 + 进程内模块钩子 + jsdom，不依赖 vitest / vite / esbuild）。
 *       被测对象是**真实源码**：注册表模块、Pinia store、composable，以及页面 `.vue` 里
 *       **真实的那一行模板**——不是用例内复刻的判定表达式。把页面上的 `v-if="canGate(…)"`
 *       摘掉、或把 store 的判据换回 `includes()`，本用例立刻变红（见回执「反测」栏原始输出）。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const VIEWS = path.join(SRC, "views");

// ── 模块钩子：无扩展名相对导入 → .ts（与既有 harness 同一条）────────────────
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  }
});

// ── jsdom 浏览器全局（Vue runtime-dom 渲染需要）─────────────────────────────
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
  Element: dom.window.Element,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  SVGElement: dom.window.SVGElement
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const Vue = await import("vue");
globalThis.Vue = Vue; // 被 `@vue/compiler-dom` mode:'function' 的产物引用
const { compile } = await import("@vue/compiler-dom");
const { createPinia, setActivePinia } = await import("pinia");

const { BUTTON_GATES, matchPermissionCode, hasPermissionCodes, normalizePermissionList } = await import(
  "../src/config/permission-gates.ts"
);
const { useAppStore } = await import("../src/stores/app.ts");
const { usePermissionGate } = await import("../src/composables/usePermissionGate.ts");

// ============================================================================
// 生产权限串（逐字取自 `docs/evidence/_shared/prod-roles-20261016.txt` §一）
// ============================================================================
const PERMS_OWNER = ["*"]; // SUPER_ADMIN（唯一实际在用账号即店主）
const PERMS_STORE_MANAGER = [
  "store:*",
  "sale:*",
  "customer:*",
  "inventory:*",
  "report:*",
  "dashboard:*",
  "finance:payment",
  "goods:price",
  "finance:daily-settle",
  "goods:create", // 生产批注：204 迁移后店长持 goods:create / goods:edit（**不含** goods:delete）
  "goods:edit"
];

// ============================================================================
// 一、判据同源：与后端 `matchPermission` 四条规则逐条等价
// ============================================================================
const MATCH_CASES = [
  // [持码串, 待判码, 期望, 依据]
  [["*"], "goods:delete", true, "① 全通配"],
  [["*"], "system:role:create", true, "① 全通配（生产 SUPER_ADMIN / OPERATION_ADMIN）"],
  [["goods:*"], "goods:delete", true, "② 模块通配"],
  // ② 模块通配的通配段 = 码的**首段**（后端 `matchPermission` 用 indexOf(":") 切段，逐条等价）：
  //    即 `store:*` 能覆盖 `store:transfer`，但 `system:user:*` **不**覆盖 `system:user:create`
  //    （三段码只有一个通配段可匹配）。本用例把这条语义钉住，防后续有人"顺手放宽"成前缀匹配。
  [["system:user:*"], "system:user:create", false, "② 通配段 = 首段（三段码须精确持码）"],
  [["system:*"], "system:user:create", true, "② 通配段 = 首段（system:* 覆盖三段码）"],
  [["system:user:*"], "system:role:edit", false, "② 模块通配不跨域"],
  [["*:delete"], "goods:delete", true, "③ 动作通配"],
  [["*:edit"], "system:user:edit", true, "③ 动作通配"],
  [["goods:edit"], "goods:delete", false, "④ 精确码：编辑 ≠ 删除"],
  [["goods:delete"], "goods:delete", true, "④ 精确码"],
  [PERMS_STORE_MANAGER, "goods:delete", false, "生产店长真实串：不含 goods:delete"],
  [PERMS_STORE_MANAGER, "goods:edit", true, "生产店长真实串：含 goods:edit"],
  [PERMS_STORE_MANAGER, "system:user:edit", false, "生产店长真实串：不含 system:user:edit"],
  [PERMS_STORE_MANAGER, "system:role:create", false, "生产店长真实串：不含 system:role:create"],
  [null, "goods:delete", false, "未取到权限码 ⇒ 不通过（失败关闭）"],
  [undefined, "goods:delete", false, "未取到权限串 ⇒ 不通过（失败关闭）"],
  [[], "goods:delete", false, "空权限串 ⇒ 不通过"],
  [["*"], "", false, "空码不通过"]
];

for (const [perms, code, expected, why] of MATCH_CASES) {
  const actual = matchPermissionCode(perms, code);
  assert.equal(actual, expected, `matchPermissionCode(${JSON.stringify(perms)}, ${code}) 应为 ${expected}（${why}）`);
}
assert.equal(hasPermissionCodes(null, ["goods:delete"]), false, "hasPermissionCodes：未取到 ⇒ 失败关闭");
assert.equal(hasPermissionCodes([], []), true, "hasPermissionCodes：门码为空 ⇒ 不设门（放行）");
assert.equal(hasPermissionCodes(["goods:delete"], ["goods:delete"]), true, "hasPermissionCodes：全部持有");
assert.equal(
  hasPermissionCodes(["goods:delete"], ["goods:delete", "goods:edit"]),
  false,
  "hasPermissionCodes：缺一码即不通过（不做「任一持有」宽松判定）"
);
assert.equal(normalizePermissionList(undefined), null, "normalizePermissionList：非数组 ⇒ null（未取到）");
assert.equal(normalizePermissionList("goods:delete"), null, "normalizePermissionList：字符串 ⇒ null");
assert.deepEqual(normalizePermissionList(["a", "a", 1, null, "b"]), ["a", "b"], "normalizePermissionList：仅留字符串并去重");

// ============================================================================
// 二、注册表 ↔ 源码一致性
// ============================================================================
function walkVueFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkVueFiles(full));
    else if (entry.name.endsWith(".vue")) out.push(full);
  }
  return out;
}

const GATED_IDS = BUTTON_GATES.filter((g) => g.status === "gated").map((g) => g.id);
const REGISTERED_IDS = BUTTON_GATES.filter((g) => g.status === "registered").map((g) => g.id);
const VIEW_FILES = walkVueFiles(VIEWS);

/** 源码里出现的门 id → 该 id 出现在哪些文件 */
const refsById = new Map();
for (const file of VIEW_FILES) {
  const text = readFileSync(file, "utf8");
  const rel = path.relative(SRC, file).split(path.sep).join("/");
  for (const m of text.matchAll(/canGate\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!refsById.has(m[1])) refsById.set(m[1], []);
    refsById.get(m[1]).push(rel);
  }
}

const unregistered = [...refsById.keys()].filter((id) => !BUTTON_GATES.some((g) => g.id === id));
assert.deepEqual(unregistered, [], `页面里出现了未登记的门 id（注册表是唯一真相源）：${unregistered.join(", ")}`);

for (const g of BUTTON_GATES.filter((x) => x.status === "gated")) {
  const files = refsById.get(g.id) || [];
  for (const page of g.pages) {
    assert.ok(
      files.includes(page),
      `门 ${g.id} 声明的作用页 ${page} 里没有引用（漏接线）`
    );
  }
  assert.equal(
    files.length,
    g.pages.length,
    `门 ${g.id} 的引用页数与注册表声明不一致：源里 ${files.length} 处（${files.join(", ")}），声明 ${g.pages.length} 处`
  );
}
for (const id of REGISTERED_IDS) {
  assert.ok(!refsById.has(id), `登记项 ${id} 不应被页面引用（登记 = 不门）`);
}

// ============================================================================
// 三、两侧反测：真实元素 + 真实判据 ⇒ 真实 DOM
// ============================================================================

/** 从页面源码里抽出「带 v-if/v-else-if="canGate('<id>')" 的那个元素」的完整片段 */
function extractGatedElement(source, gateId) {
  const re = new RegExp(
    `<(el-[a-z-]+)([^>]*?)(v-if|v-else-if)="canGate\\(\\s*'${gateId}'\\s*\\)"([^>]*?)(/?)>`
  );
  const m = source.match(re);
  assert.ok(m, `源码里找不到带 canGate('${gateId}') 的元素`);
  const tag = m[1];
  const start = m.index;
  const openEnd = m.index + m[0].length;
  if (m[5] === "/") return source.slice(start, openEnd);
  const closeToken = `</${tag}>`;
  const closeIdx = source.indexOf(closeToken, openEnd);
  assert.ok(closeIdx > openEnd, `元素 <${tag}> 未找到闭合标签`);
  const snippet = source.slice(start, closeIdx + closeToken.length);
  // `v-else-if` 单独抽出来编译会报 "no adjacent v-if"：本用例只测**该门自己的显隐语义**，
  // 故把 `v-else-if="canGate(…)"` 归一为 `v-if="canGate(…)"`（同一条件的等价渲染）。
  return snippet.replace(/v-else-if="canGate\(/, 'v-if="canGate(');
}

/** 链式占位对象：模板里对 row/group 之类的取属性在渲染期不会抛错 */
function chain() {
  const fn = () => chain();
  return new Proxy(fn, {
    get: (_t, prop) => (prop === Symbol.toPrimitive ? () => "" : chain()),
    has: () => true,
    apply: () => chain()
  });
}

const ElButtonStub = {
  name: "ElButton",
  setup(_props, { slots }) {
    return () => Vue.h("button", { type: "button" }, slots.default ? slots.default() : []);
  }
};
const ElPopconfirmStub = {
  name: "ElPopconfirm",
  setup(_props, { slots }) {
    return () => Vue.h("span", {}, slots.reference ? slots.reference() : []);
  }
};

const renderCache = new Map();
function renderSource(template) {
  if (!renderCache.has(template)) {
    const { code } = compile(template, { mode: "function", prefixIdentifiers: true });
    renderCache.set(template, new Function(code)()); // eslint-disable-line no-new-func
  }
  return renderCache.get(template);
}

/** 用给定权限串渲染「真实模板片段」，返回该片段里渲染出的按钮个数 + HTML */
function renderButtons(template, perms) {
  setActivePinia(createPinia());
  const appStore = useAppStore();
  appStore.setPermissions(perms);
  const { canGate } = usePermissionGate();

  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = Vue.createApp({
    components: { "el-button": ElButtonStub, "el-popconfirm": ElPopconfirmStub },
    setup() {
      return { canGate, row: chain(), group: chain(), node: chain(), item: chain() };
    },
    render: renderSource(template)
  });
  app.config.warnHandler = () => undefined;
  app.mount(container);
  const buttons = container.querySelectorAll("button").length;
  const html = container.innerHTML;
  app.unmount();
  container.remove();
  return { buttons, html };
}

const deviceRows = [];
for (const g of BUTTON_GATES.filter((x) => x.status === "gated")) {
  for (const page of g.pages) {
    const source = readFileSync(path.join(SRC, page), "utf8");
    const element = extractGatedElement(source, g.id);

    const owner = renderButtons(element, PERMS_OWNER);
    const manager = renderButtons(element, PERMS_STORE_MANAGER);
    const notLoaded = renderButtons(element, null);
    const empty = renderButtons(element, []);

    assert.equal(
      owner.buttons >= 1,
      true,
      `持码（店主 ["*"]）时 ${g.id}@${page} 的按钮必须渲染（实际 buttons=${owner.buttons}）`
    );
    assert.equal(
      manager.buttons,
      0,
      `不持码（生产店长串）时 ${g.id}@${page} 的按钮必须**不渲染**（实际 buttons=${manager.buttons}）`
    );
    assert.equal(notLoaded.buttons, 0, `未取到权限码时 ${g.id}@${page} 必须不渲染（失败关闭）`);
    assert.equal(empty.buttons, 0, `空权限串时 ${g.id}@${page} 必须不渲染（失败关闭）`);

    deviceRows.push({
      gate: g.id,
      page,
      codes: g.codes.join("+"),
      element: element.replace(/\s+/g, " ").slice(0, 120),
      owner: owner.buttons,
      manager: manager.buttons,
      nullPerms: notLoaded.buttons,
      emptyPerms: empty.buttons
    });
  }
}

console.log(`[permission-gates] 判据用例 ${MATCH_CASES.length} 条：全通过`);
console.log(
  `[permission-gates] 注册表：gated ${GATED_IDS.length} 个 / registered ${REGISTERED_IDS.length} 个；源码引用 ${[...refsById.values()].flat().length} 处（页面 ${new Set([...refsById.values()].flat()).size} 个）`
);
console.log(`[permission-gates] DOM 反测（共 ${deviceRows.length} 行：门 × 页面）：`);
for (const r of deviceRows) {
  console.log(
    `  · ${r.gate.padEnd(24)} ${r.page.padEnd(34)} 码=${r.codes.padEnd(18)}` +
      `店主(["*"])=${r.owner} 店长串=${r.manager} null=${r.nullPerms} []=${r.emptyPerms}`
  );
}
console.log("[permission-gates] 全部断言通过（两侧反测：持码必渲染 / 不持码必不渲染）");
