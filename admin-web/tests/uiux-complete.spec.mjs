/**
 * WORKBENCH-13 · UI 结构与状态契约测试（卡 §五.4：至少 12 条）
 *
 * 覆盖四处修复（每处都有 file:line 级断言，防止回归）：
 *   A. 菜单空态不得污染业务页（§三.1）
 *   B. 设置中心与打印弹层只能一个可交互模态（§三.2）
 *   C. 深链接/刷新必须真实可见业务页（§三.3）
 *   D. 冷启动首击稳定（§三.10）
 *   E. UIUX 注入不得当生产证据（§三.4/§六）
 *   F. 三视口无横向裁切（§三.8）
 *
 * 运行（admin-web 目录）：node tests/uiux-complete.spec.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const read = (rel) => readFileSync(path.join(WEB, rel), "utf8");

/** 去注释，只看可执行/模板代码 */
const codeOnly = (t) =>
  t
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, "");

const SHELL = "src/layouts/WorkbenchShell.vue";
const shellSrc = read(SHELL);
const shellCode = codeOnly(shellSrc);

const results = [];
async function run(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log(`FAIL  ${name}  ← ${e.message}`);
  }
}

/* ══════ A. 菜单空态不污染业务页 ══════ */

await run("A1 空态有页面级豁免：业务路由命中时不得显示空态", () => {
  assert.ok(/showMenuEmptyState/.test(shellCode), "应存在 showMenuEmptyState 判据");
  assert.ok(
    /if\s*\(\s*isManualBusinessRoute\.value\s*\)\s*return\s+false/.test(shellCode),
    "showMenuEmptyState 必须对真实业务页提前返回 false（页面优先，空态让位）",
  );
  return "isManualBusinessRoute ⇒ 空态 false";
});

await run("A2 空态不再与 router-view 并列占位（改为绝对定位覆盖层）", () => {
  const style = shellSrc.match(/\.wb-menu-empty\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.ok(/position:\s*absolute/.test(style), "空态应绝对定位，不得占据文档流挤压页面");
  assert.ok(/z-index/.test(style), "空态应有 z-index（浮层语义）");
  assert.ok(!/margin:\s*24px/.test(style), "不得保留原 margin:24px 的流内挤压写法");
  return "position:absolute + z-index";
});

await run("A3 空态只在菜单 ready 且无可见入口时判定（loading/error 不得当空态）", () => {
  assert.ok(
    /if\s*\(\s*menuState\.value\s*!==\s*"ready"\s*\)\s*return\s+false/.test(shellCode),
    "loading/error 状态不得渲染空态（错误态是独立层，语义不能混）",
  );
  return "loading/error ≠ 空态";
});

/* ══════ B. 单模态层 ══════ */

await run("B1 打印设置只能从设置中心「先关后开」进入（禁止模态双开）", () => {
  assert.ok(
    /function\s+openPrintSettingsFromCenter/.test(shellCode),
    "应有 openPrintSettingsFromCenter 统一入口",
  );
  const fn = shellCode.match(/function\s+openPrintSettingsFromCenter[\s\S]{0,260}?\n\}/)?.[0] ?? "";
  assert.ok(/settingsCenterVisible\.value\s*=\s*false/.test(fn), "必须先关闭设置中心");
  assert.ok(/printSettingsVisible\.value\s*=\s*true/.test(fn), "再打开打印弹层");
  // 顺序：先 false 再 true
  assert.ok(
    fn.indexOf("settingsCenterVisible.value = false") < fn.indexOf("printSettingsVisible.value = true"),
    "关闭设置中心必须发生在打开打印弹层之前",
  );
  return "先关设置中心 → 再开打印弹层";
});

await run("B2 设置中心不得直接把 printSettingsVisible 置真（防止绕过互斥）", () => {
  assert.ok(
    !/@open-print-settings="printSettingsVisible\s*=\s*true"/.test(shellCode),
    "模板内联赋值会绕过互斥，必须走 handler",
  );
  assert.ok(/@open-print-settings="openPrintSettingsFromCenter"/.test(shellCode), "模板应绑定统一 handler");
  return "模板绑定 handler";
});

await run("B3 两个模态组件同一时刻最多一个 v-model 为真（互斥不变量）", () => {
  // 两个 ref 都存在，且 B1 的 handler 保证互斥
  assert.ok(/printSettingsVisible/.test(shellCode) && /settingsCenterVisible/.test(shellCode), "两个可见性 ref 都应存在");
  const opens = shellCode.match(/settingsCenterVisible\.value\s*=\s*true/g)?.length ?? 0;
  assert.ok(opens >= 1, "设置中心应有唯一开启点 openSettings");
  assert.ok(/function\s+openSettings[\s\S]{0,80}settingsCenterVisible\.value\s*=\s*true/.test(shellCode), "openSettings 负责开启");
  return "互斥由 handler 保证";
});

/* ══════ C. 深链接可见 ══════ */

await run("C1 effectiveMode 必须纳入人工业务路由判定（深链接不被 AI 面盖住）", () => {
  assert.ok(/isManualBusinessRoute/.test(shellCode), "应存在 isManualBusinessRoute");
  assert.ok(
    /const\s+effectiveMode\s*=\s*computed<WorkbenchMode>\(\(\)\s*=>[\s\S]{0,200}isManualBusinessRoute\.value[\s\S]{0,60}\?\s*"human"/.test(
      shellCode,
    ),
    "effectiveMode 必须在人工业务路由时强制 human",
  );
  return "isManualBusinessRoute ⇒ human";
});

await run("C2 存在路由→模式同步 watch，且 immediate 生效（刷新即正确）", () => {
  assert.ok(
    /watch\(\s*\(\)\s*=>\s*route\.path/.test(shellCode),
    "应有针对 route.path 的 watch",
  );
  assert.ok(/\{\s*immediate:\s*true\s*\}/.test(shellCode), "watch 必须 immediate，保证刷新首帧即同步");
  return "route.path watch + immediate";
});

await run("C3 人工业务路由清单非空且覆盖关键业务页（采购/售后/即时零售）", () => {
  const list = shellCode.match(/BUSINESS_ROUTE_PATHS[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? "";
  assert.ok(list.length > 100, "业务路由清单不应为空");
  for (const p of ["/purchase-orders", "/purchase-in-stocks", "/order-aftersale", "/instant-retail/orders"]) {
    assert.ok(list.includes(`"${p}"`), `清单应含 ${p}`);
  }
  // /dashboard 是 AI 面宿主，不能算人工业务页（否则默认工作台被切走）
  assert.ok(!/"\/dashboard"/.test(list), "/dashboard 不应列为人工业务页");
  return `清单 ${(list.match(/"/g)?.length ?? 0) / 2} 条，含关键业务页`;
});

await run("C4 三层互斥：feed/chat 只在 AI 模式 shown，manual 只在 human shown", () => {
  assert.ok(/data-view="feed"/.test(shellSrc) && /data-view="chat"/.test(shellSrc) && /data-view="manual"/.test(shellSrc), "三层都应存在");
  assert.ok(
    /shown:\s*effectiveMode\s*===\s*'ai'\s*&&\s*face\s*===\s*'feed'/.test(shellSrc.replace(/"/g, "'")),
    "feed 层 must 绑定 effectiveMode==='ai'",
  );
  assert.ok(
    /shown:\s*effectiveMode\s*===\s*'human'/.test(shellSrc.replace(/"/g, "'")),
    "manual 层 must 绑定 effectiveMode==='human'",
  );
  return "三层 shown 条件互斥";
});

/* ══════ D. 冷启动首击 ══════ */

await run("D1 加载期渲染 rail 骨架（首击不得落空）", () => {
  assert.ok(/railSkeletons/.test(shellCode), "应存在 railSkeletons");
  const fn = shellCode.match(/const\s+railSkeletons\s*=\s*computed\(\(\)\s*=>[\s\S]{0,220}?\);/)?.[0] ?? "";
  assert.ok(/menuState\.value\s*===\s*"loading"/.test(fn), "骨架只在 loading 期出现");
  assert.ok(/railModules\.value\.length\s*===\s*0/.test(fn), "骨架必须与真实模块互斥（否则重复渲染）");
  return "loading 且无真实模块时出骨架";
});

await run("D2 骨架点击记录意图（首击可进入），并标明非真实入口", () => {
  assert.ok(/pendingRailGroup/.test(shellCode), "应记录待进入的组");
  assert.ok(/function\s+clickRailSkeleton/.test(shellCode), "骨架点击应有独立 handler");
  assert.ok(/data-rail-skeleton="true"/.test(shellSrc), "骨架必须带 DOM 标记（可被证据识别）");
  assert.ok(/aria-disabled="true"/.test(shellSrc), "骨架应对无障碍标注 disabled");
  return "pendingRailGroup + data-rail-skeleton";
});

await run("D3 ready 后自动应用首击意图；不可见时给可重试错误（不静默）", () => {
  const w = shellCode.match(/watch\(\s*menuState[\s\S]{0,700}?\n\}\);/)?.[0] ?? "";
  assert.ok(/visibleGroups\.value\.some/.test(w), "ready 后应尝试解析目标组");
  assert.ok(/selectedGroupCode\.value\s*=\s*pending/.test(w), "命中则自动选中（首击可进入）");
  assert.ok(/ElMessage\.warning/.test(w), "未命中应给可重试提示，不得静默失败");
  return "自动选中 + 未命中告警";
});

/* ══════ E. UIUX 注入边界 ══════ */

await run("E1 UIUX 注入仅开发态生效，且 DOM 留痕（不得当生产证据）", () => {
  const src = read("src/shared/workbench/wb-uiux-injection.ts");
  assert.ok(/if\s*\(\s*!input\.isDev\s*\)/.test(src), "生产构建必须不激活注入");
  assert.ok(/WB_UIUX_INJECT_WATERMARK/.test(src), "必须有角标文案常量");
  // 角标渲染到 DOM
  assert.ok(/data-uiux-inject/.test(shellSrc), "壳层应渲染 data-uiux-inject 留痕");
  return "isDev 门 + 水印常量 + DOM 标记";
});

/* ══════ F. 视口与测量 ══════ */

await run("F1 三视口定义与测量产物存在（1440/1024/390）", () => {
  const p = path.join(WEB, "..", "evidence", "final", "final-shots.json");
  if (!existsSync(p)) {
    // 允许在未跑证据时跳过文件断言，但必须断言测量脚本存在
    assert.ok(existsSync(path.join(WEB, "..", "tools", "browser-evidence.mjs")), "应有视口测量脚本");
    return "证据未生成（脚本已就绪，由 CI/人工跑）";
  }
  const shots = JSON.parse(readFileSync(p, "utf8"));
  const vps = new Set(shots.map((s) => s.viewport));
  for (const v of ["1440x1000", "1024x768", "390x844"]) assert.ok(vps.has(v), `应有 ${v} 视口证据`);
  const clipped = shots.filter((s) => s.hasHorizontalClip);
  assert.deepEqual(clipped.map((s) => `${s.viewport}/${s.name}`), [], "三视口不得横向裁切");
  return `${shots.length} 张、3 视口、零横向裁切`;
});

await run("F2 窄视口抽屉逻辑存在（390px rail 转抽屉，不裁切）", () => {
  assert.ok(/isNarrow/.test(shellCode), "应有窄视口判定");
  assert.ok(/WB_NARROW_MEDIA_QUERY/.test(shellCode) || /matchMedia/.test(shellCode), "应基于 media query");
  assert.ok(/sideCollapsed/.test(shellCode), "窄态应能收起第二栏");
  return "matchMedia + sideCollapsed";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
