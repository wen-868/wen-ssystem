/**
 * WORKBENCH-13-F1 · UI 结构与状态契约测试（18 条；卡 §三.1/§三.2 要求 ≥12 且**自包含**）
 *
 * 覆盖四处修复 + F1 返工项（每处都有 file:line 级断言，防止回归）：
 *   A. 菜单空态不得污染业务页（§三.1）
 *   B. 设置中心与打印弹层只能一个可交互模态（§三.2）
 *   C. 深链接/刷新必须真实可见业务页（§三.3）
 *   D. 冷启动首击稳定 + 骨架可访问语义（§三.7/§三.10；凌舟驳回 §四.4）
 *   E. UIUX 注入不得当生产证据（§三.4/§六）
 *   F. 场景证据与机器门禁（§三.5/§三.6/§三.9/§三.11）——只读仓内
 *      `tests/uiux-scenarios-lib.mjs` 与 `tests/fixtures/uiux-scene-measures.json`，
 *      不再引用工作树外的 `evidence/`、`tools/`（凌舟驳回 §二.1）
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

await run("D2 骨架是真实可点击按钮：记录首击意图，且不伪装 aria-disabled", () => {
  assert.ok(/pendingRailGroup/.test(shellCode), "应记录待进入的组");
  assert.ok(/function\s+clickRailSkeleton/.test(shellCode), "骨架点击应有独立 handler");
  assert.ok(/data-rail-skeleton="true"/.test(shellSrc), "骨架必须带 DOM 标记（可被证据识别）");
  // 凌舟驳回 §四.4：骨架同时 aria-disabled=true ⇒ 可访问语义判为不可点击，与「要求点击记录意图」自相矛盾
  const skelBlock = shellSrc.match(/<button[^>]*v-for="group in railSkeletons"[\s\S]*?@click="clickRailSkeleton/)?.[0] ?? "";
  assert.ok(skelBlock.length > 0, "骨架按钮模板未找到");
  assert.ok(!/aria-disabled/.test(skelBlock), "骨架不得标 aria-disabled（F1 卡 §三.7：不得用 aria-disabled 伪装可点击语义）");
  assert.ok(/type="button"/.test(skelBlock), "骨架应为原生 <button type=button>（键盘 Enter/空格天然可触发）");
  assert.ok(/aria-pressed/.test(skelBlock), "pending 态应通过 aria-pressed 暴露");
  assert.ok(/aria-label=/.test(skelBlock), "骨架应有无障碍标签，说明非真实入口");
  assert.ok(!/pointer-events:\s*none/.test(shellSrc.match(/\.wb-rail-item\.is-rail-skeleton\s*\{[^}]*\}/)?.[0] ?? ""), "骨架 CSS 不得禁用指针事件（否则首击落空）");
  return "原生 button + aria-pressed + 无 aria-disabled/pointer-events";
});

await run("D3 ready 后自动应用首击意图；不可见时给可重试错误（不静默）", () => {
  const w = shellCode.match(/watch\(\s*menuState[\s\S]{0,700}?\n\}\);/)?.[0] ?? "";
  assert.ok(/visibleGroups\.value\.some/.test(w), "ready 后应尝试解析目标组");
  assert.ok(/selectedGroupCode\.value\s*=\s*pending/.test(w), "命中则自动选中（首击可进入）");
  assert.ok(/ElMessage\.warning/.test(w), "未命中应给可重试提示，不得静默失败");
  return "自动选中 + 未命中告警";
});

await run("D4 未命中告警在屏幕上真的看得见（函数式组件样式必须显式引入）", () => {
  // 根因：`import { ElMessage } from "element-plus"` 是显式导入，ElementPlusResolver 不给它补样式
  // ⇒ .el-message 没有 CSS，以静态块落到文档末尾（实测 top=视口高），提示在屏幕上完全不可见。
  const main = read("src/main.ts");
  assert.ok(
    /element-plus\/es\/components\/message\/style\/css/.test(main),
    "main.ts 必须显式引入 ElMessage 样式，否则告警只在 DOM 里、不在屏幕上",
  );
  const shell = read(SHELL);
  assert.ok(/from "element-plus"/.test(shell) && /ElMessage/.test(shell), "壳层应通过 ElMessage 给出可重试提示");
  return "message 样式显式引入（否则告警不可见）";
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

/* ══════ F. 视口、场景与机器门禁（全部依赖仓内文件） ══════ */

/**
 * F1 的改造点（凌舟驳回 §二.1）：
 *   旧写法读 `../evidence/final/final-shots.json`、回退读 `../tools/browser-evidence.mjs`，
 *   两者都在工作树外 ⇒ clean 检出必红，且「证据没跑就自动放行」。
 *   新写法只读同目录的 `uiux-scenarios-lib.mjs`（判定规则）与
 *   `fixtures/uiux-scene-measures.json`（真实采集产物，随仓入库），缺任一个直接 FAIL。
 */
await run("F1 场景证据自包含：三视口、零横向裁切、真不同场景全部达标", async () => {
  const libPath = path.join(here, "uiux-scenarios-lib.mjs");
  const fixturePath = path.join(here, "fixtures", "uiux-scene-measures.json");
  assert.ok(existsSync(libPath), "仓内应有 tests/uiux-scenarios-lib.mjs（门禁规则入库）");
  assert.ok(existsSync(fixturePath), "仓内应有 tests/fixtures/uiux-scene-measures.json（真实采集产物入库）");
  assert.ok(existsSync(path.join(here, "uiux-scenarios.mjs")), "仓内应有 tests/uiux-scenarios.mjs（采集脚本入库，不得放工作树外 tools/）");

  const lib = await import("./uiux-scenarios-lib.mjs");
  const bundle = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.equal(bundle.schema, "wb13-f1-scene-measures/v1", "证据产物版本标记不符");
  const scenes = bundle.scenes ?? [];
  assert.ok(scenes.length >= 20, `场景证据过少：${scenes.length} 条`);

  const violations = lib.collectViolations(bundle);
  assert.deepEqual(violations, [], `证据门禁判红：\n    ${violations.join("\n    ")}`);

  const vps = new Set(scenes.map((s) => s.viewport));
  for (const v of lib.VIEWPORTS) assert.ok(vps.has(v.id), `应有 ${v.id} 视口证据`);
  return `${scenes.length} 张、${vps.size} 视口、主场景 ${lib.countPrimaryScenes(scenes)} 个、零裁切、零重复平图`;
});

await run("F2 窄视口抽屉逻辑存在（390px rail 转抽屉，不裁切）", () => {
  assert.ok(/isNarrow/.test(shellCode), "应有窄视口判定");
  assert.ok(/WB_NARROW_MEDIA_QUERY/.test(shellCode) || /matchMedia/.test(shellCode), "应基于 media query");
  assert.ok(/sideCollapsed/.test(shellCode), "窄态应能收起第二栏");
  return "matchMedia + sideCollapsed";
});

await run("F3 门禁是活的：人造重复平图/裁切/未切换必须被判红", async () => {
  const lib = await import("./uiux-scenarios-lib.mjs");
  const base = [
    { viewport: "1440x1000", scene: "01-feed", sha256: "a".repeat(64), overflowX: 0, stateSignature: "path=/dashboard|mode=ai" },
    { viewport: "1440x1000", scene: "02-chat", sha256: "b".repeat(64), overflowX: 0, stateSignature: "path=/dashboard|mode=ai|chatShown=true" },
  ];

  // ① 同视口两张不同名场景 → 同一 SHA256（克隆平图）必须判红
  const cloned = [{ ...base[1], sha256: base[0].sha256 }];
  const dup = lib.findDuplicateHashes([...base, ...cloned]);
  assert.equal(dup.length, 1, "重复平图必须被点名");
  assert.deepEqual(dup[0].scenes.sort(), ["01-feed", "02-chat"], "应点名到具体场景对");

  // ② 辅助图（aux- 前缀）不参与判红，但必须分开命名
  const aux = lib.findDuplicateHashes([...base, { ...base[0], scene: `${lib.AUXILIARY_PREFIX}repeat` }]);
  assert.equal(aux.length, 0, "aux- 前缀辅助图不参与重复判红");
  assert.ok(lib.isAuxiliary("aux-x") && !lib.isAuxiliary("01-feed"), "辅助图命名判定应只认 aux- 前缀");

  // ③ 横向裁切必须判红（含 1px 这种「>2 才算」的宽松口径）
  assert.equal(lib.findClipped([{ viewport: "1440x1000", scene: "01-feed", overflowX: 1 }]).length, 1, "overflowX=1 也应判红");
  assert.equal(lib.findClipped([...base]).length, 0, "零裁切不得误报");

  // ④ 像素不同但结构读数相同 → 没有真实切换，判红
  const sameState = lib.findDuplicateSignatures([
    base[0],
    { ...base[1], sha256: "c".repeat(64), stateSignature: base[0].stateSignature },
  ]);
  assert.equal(sameState.length, 1, "状态读数重复（未真实切换）必须判红");

  // ⑤ 汇总门禁：真实 bundle 若被塞进克隆帧，collectViolations 必须非空
  const bundle = JSON.parse(readFileSync(path.join(here, "fixtures", "uiux-scene-measures.json"), "utf8"));
  const clean = lib.collectViolations(bundle);
  assert.deepEqual(clean, [], "真实证据本身必须零违例（否则不可用于反测基线）");
  const taintedScene = { ...bundle.scenes[0], scene: "99-taint-clone" };
  const dirty = lib.collectViolations({ ...bundle, scenes: [...bundle.scenes, taintedScene] });
  assert.ok(dirty.length > 0, "把同一帧改名成新场景后，门禁必须判红");

  // ⑥ 网络审计：白名单外的失败必须判红，AI 3016 只能单列
  const net = lib.findUnresolvedNetwork({
    failures: [
      { method: "GET", url: "http://localhost:8080/api/x", port: 8080, error: "net::ERR_FAILED", signature: "8080-x" },
      { method: "GET", url: "http://localhost:3016/api/ai", port: 3016, error: "net::ERR_CONNECTION_REFUSED", signature: "3016-x" },
    ],
    recovered: [],
  });
  assert.equal(net.length, 1, "只有白名单离线端口可被单列，其余一律判红");
  assert.equal(lib.portOfUrl("http://localhost:3016/api/ai"), 3016, "端口提取应支持无显式端口的 URL");
  assert.equal(lib.findExpectedOffline({ failures: net.concat([{ method: "GET", url: "http://localhost:3016/a", port: 3016, error: "x", signature: "s" }]) }).length, 1, "3016 应作为离线项单列");

  // ⑦ 脱敏：证据里不得留 JWT / token 参数 / CSRF token（常驻约束）
  const secret = [
    "GET /api/x?token=" + "a".repeat(40) + "&page=1",
    '{"csrfToken":"' + "b".repeat(40) + '"}',
    "Authorization: Bearer " + "c".repeat(60),
    "eyJ" + "d".repeat(30) + ".eyJ" + "e".repeat(30) + ".eyJ" + "f".repeat(30),
  ].join("  ");
  const red = lib.redactText(secret);
  assert.ok(!/eyJ[A-Za-z0-9_-]{8,}\./.test(red), "脱敏后不得残留 JWT 形态");
  assert.ok(!/[?&]token=(?!<REDACTED>)[^&\s"]/.test(red), "脱敏后不得残留 token 查询参数（?token=<REDACTED> 标记本身不算泄漏）");
  assert.ok(!/Bearer [A-Za-z0-9]{12,}/.test(red), "脱敏后不得残留 Bearer 凭据");
  assert.ok(!/"csrfToken":"[A-Za-z0-9]{8,}/.test(red), "脱敏后不得残留 csrfToken 值");
  assert.ok(/<REDACTED/.test(red) && /page=1/.test(red), "脱敏应显式留标记且不影响正常文本");
  return "重复平图/裁切/未切换/未闭合网络/凭据 五类判红均生效";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
