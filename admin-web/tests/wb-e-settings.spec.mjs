/**
 * WORKBENCH-10-UIUX-PARITY-F1 · E 设置中心断言
 *
 * 覆盖卡 §三.E 的四件事：
 *   1. 7 个 Tab 的存在与命名（凌舟裁定：按卡面用词，不沿用原型 SW_TABS 字面）；
 *   2. 管理员 / 员工可见性差异（原型 swVisible() 的 admin:true 规则 + 路由 meta.roles fail-closed）；
 *   3. 明暗主题切换与恢复（本地持久化 + 恢复默认 + 属性与 CSS 层一一对应）；
 *   4. 未接能力显示「待接入」，禁止伪造（系统接入 / 运营 / 改密三处）。
 *
 * 另加两条本层自证的门禁（根 scripts/contrast-check.cjs 只读 tokens.css 浅色值，
 * 覆盖不到暗色层，因此暗色侧的可达性与 token 一致性由本用例自带）：
 *   5. wb-theme.css 覆盖的每个变量名都必须在 tokens.css 里有同名声明；
 *   6. 暗色「文本 × 背景」逐对按 WCAG 2.1 相对亮度公式核算 ≥4.5:1。
 *
 * 运行（admin-web 目录）：node tests/wb-e-settings.spec.mjs
 * mutation 证明：见 tests/wb-f1-mutation-countertest.mjs（本区 M8 砍 Tab、M9 暗色不落 DOM）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (readCandidate(candidate)) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});
function readCandidate(url) {
  try {
    return readFileSync(fileURLToPath(url), "utf8").length >= 0;
  } catch {
    return false;
  }
}

const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

const settingsSrc = read("shared/workbench/wb-settings.ts");
const themeSrc = read("shared/workbench/wb-theme.ts");
const darkCss = read("styles/wb-theme.css");
const lightCss = read("styles/tokens.css");
const globalCss = read("styles.css");
const dialogVue = read("components/workbench/WbSettingsCenter.vue");

const { SETTINGS_TABS, visibleSettingTabs, canSeeAdminTabs, unavailableCapability } = await import(
  pathToFileUrl("shared/workbench/wb-settings.ts")
);
const {
  WB_THEME_STORAGE_KEY,
  readStoredTheme,
  writeStoredTheme,
  clearStoredTheme,
  resolveTheme,
  oppositeTheme,
  themeDataAttribute,
} = await import(pathToFileUrl("shared/workbench/wb-theme.ts"));

function pathToFileUrl(rel) {
  return new URL("file:///" + path.join(SRC, rel).replace(/\\/g, "/")).href;
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

/** 内存版 ThemeStorage，用于证明持久化/恢复是真行为而不是 UI 文案 */
function memStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

/** 解析一个 CSS 文件里 `--name: value;` 的取值（只取第一个声明块，够用且可预测） */
function cssVars(text) {
  const cleaned = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map();
  for (const m of cleaned.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/g)) {
    if (!out.has(m[1])) out.set(m[1], m[2].trim());
  }
  return out;
}

const darkVars = cssVars(darkCss);
const lightVars = cssVars(lightCss);

/* ══════════════ 1 · 7 Tab 存在与命名 ══════════════ */

await run("§三.E.1 设置中心恰有 7 个 Tab", () => {
  assert.equal(SETTINGS_TABS.length, 7, `实际 ${SETTINGS_TABS.length} 个`);
  return `7 个：${SETTINGS_TABS.map((t) => t.label).join(" / ")}`;
});

await run("§三.E.1 Tab 名称与卡面用词逐项相等（顺序亦按卡面）", () => {
  const expected = ["系统接入", "AI 模型", "打印", "外观", "账号与安全", "运营", "系统配置"];
  assert.deepEqual(SETTINGS_TABS.map((t) => t.label), expected);
  return `与卡面 7 项逐字相同`;
});

await run("Tab key 唯一且与卡面一一对应", () => {
  const keys = SETTINGS_TABS.map((t) => t.key);
  assert.deepEqual(new Set(keys).size, keys.length, "存在重复 key");
  assert.deepEqual(keys, ["conn", "model", "print", "appear", "acct", "ops", "config"]);
  return `${keys.join(",")}`;
});

await run("卡面新增两块无原型锚点（prototypeKey=null），其余五块保留对账 key", () => {
  const withoutProto = SETTINGS_TABS.filter((t) => t.prototypeKey === null).map((t) => t.key);
  assert.deepEqual(withoutProto, ["ops", "config"], "非原型来源的分区名单变了");
  const mapped = SETTINGS_TABS.filter((t) => t.prototypeKey)
    .map((t) => `${t.key}→${t.prototypeKey}`)
    .sort();
  assert.deepEqual(mapped, ["acct→acct", "appear→appear", "conn→conn", "model→model", "print→print"]);
  return `原型 SW_TABS 五块对账：${mapped.join(" ")}`;
});

await run("冻结原型未被本单改动（SW_TABS 仍为 5 项）", () => {
  const proto = readFileSync(
    "D:/Users/ZXQL/ZXQL-WORK/projects/ai/design/智享全链_工作台电脑端_UI原型_融合版.html",
    "utf8",
  );
  const block = proto.match(/const SW_TABS=\[([\s\S]*?)\];/);
  assert.ok(block, "原型 SW_TABS 定义丢失");
  const n = (block[1].match(/\{k:'/g) || []).length;
  assert.equal(n, 5, `原型 SW_TABS 数量变为 ${n}，卡面 7 项来自本单新增而非原型变更`);
  return `原型 5 项原样保留，卡面 7 = 5 + 运营 + 系统配置`;
});

/* ══════════════ 2 · 可见性差异 ══════════════ */

const ADMIN_ROLE = ["SUPER_ADMIN"];
const STAFF_ROLE = ["STORE_OPERATOR"];

await run("§三.E.2 管理员见 7 个 Tab", () => {
  const tabs = visibleSettingTabs(ADMIN_ROLE, () => ["SUPER_ADMIN", "STORE_MANAGER"]);
  assert.equal(tabs.length, 7, `管理员实际可见 ${tabs.length}`);
  return `7 个`;
});

await run("§三.E.2 员工仅见「外观 + 账号与安全」两块", () => {
  const tabs = visibleSettingTabs(STAFF_ROLE, () => ["SUPER_ADMIN", "STORE_MANAGER"]);
  assert.deepEqual(
    tabs.map((t) => t.label),
    ["外观", "账号与安全"],
  );
  return `员工可见 ${tabs.map((t) => t.label).join("/")}`;
});

await run("adminOnly 标记与原型 admin:true 规则一致", () => {
  const adminOnly = SETTINGS_TABS.filter((t) => t.adminOnly).map((t) => t.key);
  assert.deepEqual(adminOnly, ["conn", "model", "print", "ops", "config"]);
  const open = SETTINGS_TABS.filter((t) => !t.adminOnly).map((t) => t.key);
  assert.deepEqual(open, ["appear", "acct"], "原型里外观/账号是人人可调（源码注释 L1196）");
  return `管理员专属 5 块 / 全员 2 块`;
});

await run("权限码不在前端硬编码：可见性只经 resolveRoles 取路由 meta.roles", () => {
  assert.doesNotMatch(settingsSrc, /["']SUPER_ADMIN["']/, "wb-settings.ts 里出现了硬编码角色名");
  assert.doesNotMatch(settingsSrc, /["']STORE_MANAGER["']/, "wb-settings.ts 里出现了硬编码角色名");
  return `wb-settings.ts 零角色字面量`;
});

await run("未知路由 fail-closed：resolveRoles 返回 null ⇒ 管理员 Tab 全不可见", () => {
  assert.equal(canSeeAdminTabs("system", ADMIN_ROLE, () => null), false);
  const tabs = visibleSettingTabs(ADMIN_ROLE, () => null);
  assert.deepEqual(tabs.map((t) => t.label), ["外观", "账号与安全"]);
  return `null 解析器下退化为员工可见面`;
});

await run("meta.roles 为空数组（无角色被授权）⇒ 非管理员", () => {
  assert.equal(canSeeAdminTabs("system", STAFF_ROLE, () => []), false);
  assert.equal(canSeeAdminTabs("system", ADMIN_ROLE, () => ["SUPER_ADMIN"]), true);
  return `空授权集判红，非空且命中判绿`;
});

await run("弹层对「零可见分区」有显式空态，不静默白屏", () => {
  assert.match(dialogVue, /data-testid="sw-no-tab"/, "缺零可见分区空态");
  assert.match(dialogVue, /当前账号没有任何可见的设置分区/, "空态文案缺失");
  return `sw-no-tab 在位`;
});

/* ══════════════ 3 · 明暗主题切换与恢复 ══════════════ */

await run("§三.E.3 首次进入按系统深浅偏好解析（本机无记录）", () => {
  const s = memStorage();
  assert.equal(readStoredTheme(s), null);
  assert.equal(resolveTheme(s, false), "light");
  assert.equal(resolveTheme(s, true), "dark");
  return `无记录 ⇒ 跟随系统`;
});

await run("§三.E.3 切换写盘且只接受 light/dark 两个字面值", () => {
  const s = memStorage();
  writeStoredTheme(s, "dark");
  assert.equal(s.map.get(WB_THEME_STORAGE_KEY), "dark");
  assert.equal(readStoredTheme(s), "dark");
  s.map.set(WB_THEME_STORAGE_KEY, "blue");
  assert.equal(readStoredTheme(s), null, "非法存储值必须视为未记录，否则主题会卡在脏值");
  return `脏值不入状态机`;
});

await run("§三.E.3 恢复默认＝删键而非写 light（否则无法区分跟随系统与强制亮色）", () => {
  const s = memStorage();
  writeStoredTheme(s, "dark");
  clearStoredTheme(s);
  assert.equal(s.map.has(WB_THEME_STORAGE_KEY), false, "恢复默认必须清键");
  assert.equal(resolveTheme(s, true), "dark", "清键后应回到系统偏好");
  return `清键 + 回落系统偏好`;
});

await run("记录态与跟随态在源码层可区分（themeSourceLabel 读存储而非读自己）", () => {
  assert.match(dialogVue, /readStoredTheme\(storage\)\s*\?\s*"本机已记录"/, "来源标签未回读存储");
  assert.match(dialogVue, /跟随系统（深色）/, "缺跟随系统深色文案");
  assert.match(dialogVue, /跟随系统（浅色）/, "缺跟随系统浅色文案");
  return `已记录 / 跟随系统 两态有独立文案`;
});

await run("亮色不残留 data-wb-theme 属性（两套状态不得并存）", () => {
  assert.equal(themeDataAttribute("light"), null);
  assert.equal(themeDataAttribute("dark"), "dark");
  assert.match(dialogVue, /removeAttribute\("data-wb-theme"\)/, "亮色必须摘属性");
  return `light⇒摘属性，dark⇒置属性`;
});

await run("主题切换按钮与当前值绑定，可反向证明", () => {
  assert.match(dialogVue, /data-theme-choice="light"/);
  assert.match(dialogVue, /data-theme-choice="dark"/);
  assert.match(dialogVue, /\{ on: theme === 'light' \}/);
  assert.match(dialogVue, /\{ on: theme === 'dark' \}/);
  assert.match(dialogVue, /data-testid="sw-theme-reset"/);
  return `两态按钮 + 恢复默认入口齐备`;
});

await run("切换/恢复都会同时落存储与 DOM（不得只改 UI 显示值）", () => {
  const choose = dialogVue.match(/function chooseTheme[\s\S]*?\n\}/);
  assert.ok(choose, "chooseTheme 缺失");
  assert.match(choose[0], /writeStoredTheme\(storage, value\)/);
  assert.match(choose[0], /applyToDom\(value\)/);
  const restore = dialogVue.match(/function restoreDefaultTheme[\s\S]*?\n\}/);
  assert.ok(restore, "restoreDefaultTheme 缺失");
  assert.match(restore[0], /clearStoredTheme\(storage\)/);
  assert.match(restore[0], /applyToDom\(theme\.value\)/);
  return `写盘+改 DOM 成对出现`;
});

await run("oppositeTheme 存在且双射", () => {
  assert.equal(oppositeTheme("light"), "dark");
  assert.equal(oppositeTheme("dark"), "light");
  return `互换函数可用于快捷键`;
});

/* ══════════════ 4 · 待接入与禁止伪造 ══════════════ */

await run("§三.E.4 无端点的两块标 unavailable 且说明真实缺失原因", () => {
  const un = SETTINGS_TABS.filter((t) => t.capability === "unavailable").map((t) => t.key);
  assert.deepEqual(un, ["conn", "ops"]);
  for (const tab of SETTINGS_TABS.filter((t) => t.capability === "unavailable")) {
    assert.match(tab.note, /端点|api\//, `${tab.label} 的缺失说明未指向可核查的端点事实`);
  }
  return `系统接入/运营 均写明缺哪类端点`;
});

await run("unavailable 文案落「待接入」字样（不得用空态冒充完成）", () => {
  const st = unavailableCapability(SETTINGS_TABS.find((t) => t.key === "conn"));
  assert.equal(st.state, "unavailable");
  assert.match(st.message, /待接入/);
  assert.match(dialogVue, /data-testid="sw-unavailable"/);
  assert.match(dialogVue, /待接入<\/span>/);
  return `state 与 UI 双处在位`;
});

await run("待接入分区仍提供重试入口，且重试不得翻成 ready", () => {
  assert.match(dialogVue, /@click="retryCapability"/);
  assert.match(dialogVue, /重试后仍未取到对接端点，保持待接入/);
  assert.doesNotMatch(dialogVue, /state:\s*"ready"[\s\S]{0,120}retryCapability/, "重试把未接能力伪装成就绪");
  return `重试只回读事实`;
});

await run("账号安全：改密无端点即标待接入，不放假表单", () => {
  assert.match(dialogVue, /data-testid="sw-acct-pwd"/);
  assert.match(dialogVue, /登录密码由业务系统统一管理，工作台侧无改密端点/);
  assert.doesNotMatch(dialogVue, /修改密码.*el-input/, "出现无端点的改密输入框");
  return `如实标注，不造改密表单`;
});

await run("AI 模型 / 打印 走真实端点或本机真实配置，未用静态假数据", () => {
  assert.match(dialogVue, /fetchAiModels|fetchAiTools/);
  assert.match(dialogVue, /getLocalPrintConfig/);
  assert.doesNotMatch(dialogVue, /Math\.random/, "设置中心出现随机数");
  assert.doesNotMatch(settingsSrc, /Math\.random/, "Tab 台账出现随机数");
  return `真调用 + 零随机源`;
});

await run("不得出现原型示例身份（红星商行 / 张三 / 王强）", () => {
  for (const [name, text] of [
    ["wb-settings.ts", settingsSrc],
    ["wb-theme.ts", themeSrc],
    ["WbSettingsCenter.vue", dialogVue],
  ]) {
    assert.doesNotMatch(text, /红星商行|张三|王强/, `${name} 混入原型示例身份`);
  }
  return `三处零原型假身份`;
});

/* ══════════════ 5 · 暗色层 token 一致性 ══════════════ */

await run("wb-theme.css 覆盖的变量名 100% 在 tokens.css 有声明", () => {
  const foreign = [...darkVars.keys()].filter((v) => !lightVars.has(v));
  assert.deepEqual(foreign, [], `暗色层引入了 tokens.css 没有的新 token：${foreign.join(", ")}`);
  return `${darkVars.size} 个覆盖项全部有浅色同源`;
});

await run("暗色层只由 html[data-wb-theme=\"dark\"] 选择，不改 :root", () => {
  assert.match(darkCss, /html\[data-wb-theme="dark"\]\s*\{/);
  assert.doesNotMatch(darkCss.replace(/\/\*[\s\S]*?\*\//g, ""), /(^|\n)\s*:root\s*\{/, "暗色层不得重写 :root");
  return `单一选择器`;
});

await run("暗色层已接入全局样式且晚于 tokens.css（后声明才覆盖）", () => {
  const tokensAt = globalCss.indexOf("./styles/tokens.css");
  const darkAt = globalCss.indexOf("./styles/wb-theme.css");
  assert.ok(tokensAt >= 0, "tokens.css 导入丢失");
  assert.ok(darkAt >= 0, "styles.css 未引入暗色层");
  assert.ok(darkAt > tokensAt, "暗色层必须晚于 tokens.css 导入");
  assert.match(globalCss.slice(0, 200), /@import/, "新增 @import 必须仍位于文件顶部");
  return `导入顺序正确（tokens → wb-theme）`;
});

/* ══════════════ 6 · 暗色可达性（WCAG 2.1） ══════════════ */

function srgbToLin(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const m = hex.trim().match(/^#([0-9a-fA-F]{6})$/);
  assert.ok(m, `非 6 位十六进制色值：${hex}`);
  const n = parseInt(m[1], 16);
  const r = srgbToLin((n >> 16) & 255);
  const g = srgbToLin((n >> 8) & 255);
  const b = srgbToLin(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

const DARK_PAIRS = [
  ["--text-primary", ["--bg-page", "--bg-card", "--bg-soft", "--bg-elevated", "--bg-sidebar", "--table-header-bg", "--tooltip-bg"]],
  ["--text-secondary", ["--bg-page", "--bg-card", "--bg-soft", "--bg-sidebar"]],
  ["--text-muted", ["--bg-page", "--bg-card", "--bg-soft", "--bg-sidebar", "--table-header-bg"]],
  ["--text-placeholder", ["--input-bg"]],
  ["--text-link", ["--bg-page", "--bg-card"]],
  ["--color-primary-text", ["--bg-page", "--bg-card", "--bg-soft"]],
  ["--color-success-text", ["--bg-card"]],
  ["--color-warning-text", ["--bg-card"]],
  ["--table-header-text", ["--table-header-bg"]],
  ["--sidebar-text-primary", ["--bg-sidebar"]],
  ["--sidebar-text-secondary", ["--bg-sidebar"]],
  ["--sidebar-text-muted", ["--bg-sidebar"]],
  ["--tooltip-text", ["--tooltip-bg"]],
];

await run("暗色文本×背景全部 ≥4.5:1（WCAG AA）", () => {
  const bad = [];
  let checked = 0;
  let min = Infinity;
  let minLabel = "";
  for (const [fgVar, bgVars] of DARK_PAIRS) {
    const fg = darkVars.get(fgVar);
    assert.ok(fg, `暗色层缺 ${fgVar}`);
    for (const bgVar of bgVars) {
      const bg = darkVars.get(bgVar);
      assert.ok(bg, `暗色层缺 ${bgVar}`);
      const r = ratio(fg, bg);
      checked += 1;
      if (r < min) {
        min = r;
        minLabel = `${fgVar}@${bgVar}`;
      }
      if (r < 4.5) bad.push(`${fgVar}(${fg}) on ${bgVar}(${bg}) = ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(bad, [], `不达 AA：${bad.join(" | ")}`);
  return `${checked} 对全达标，最低 ${min.toFixed(2)}:1（${minLabel}）`;
});

await run("暗色反色文本在品牌实色底上 ≥4.5:1（按钮/选中态）", () => {
  const r = ratio(darkVars.get("--text-inverse"), darkVars.get("--color-primary"));
  assert.ok(r >= 4.5, `text-inverse on color-primary = ${r.toFixed(2)}，暗色按钮文字不达 AA`);
  return `${r.toFixed(2)}:1`;
});

await run("非文本控件边框在暗底上 ≥3:1（WCAG 1.4.11）", () => {
  const pairs = [
    ["--input-border", "--input-bg"],
    ["--input-focus-border", "--input-bg"],
    ["--border-focus", "--bg-card"],
  ];
  const bad = [];
  const readouts = [];
  for (const [fgVar, bgVar] of pairs) {
    const fg = darkVars.get(fgVar);
    const bg = darkVars.get(bgVar);
    assert.ok(fg, `暗色层缺 ${fgVar}`);
    assert.ok(bg, `暗色层缺 ${bgVar}`);
    const r = ratio(fg, bg);
    readouts.push(`${fgVar}/${bgVar}=${r.toFixed(2)}`);
    if (r < 3) bad.push(`${fgVar}(${fg}) on ${bgVar}(${bg}) = ${r.toFixed(2)}`);
  }
  assert.deepEqual(bad, [], `控件边界/焦点指示不达 3:1：${bad.join(" | ")}`);
  return readouts.join(" ");
});

await run("浅色真值未被本单改动（暗色只做覆盖层）", () => {
  assert.match(lightCss, /--text-primary:\s*#000000/);
  assert.match(lightCss, /--bg-card:\s*#FFFFFF/);
  assert.match(lightCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  return `tokens.css 浅色值与 reduced-motion 原样保留`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
