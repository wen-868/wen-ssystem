/**
 * WORKBENCH-13-F2 · A 段（原型视觉基线）契约测试（32 条；卡 §三.C.16/§三.C.17）
 *
 * 只依赖三样东西，clean 检出即可复现绿色（与 f2-func-styles.spec.mjs 同一自包含口径）：
 *   1. 真源：`src/shared/workbench/prototype-nav.ts`、`src/layouts/WorkbenchShell.vue`、`src/layouts/WorkbenchSubnav.vue`
 *   2. 门禁纯函数：`tests/f2a-visual-baseline-lib.mjs`（与采集端共用）
 *   3. 仓内证据副本：`tests/fixtures/f2a-visual-measures.json`（真实浏览器并排采集产物）
 *
 * 分组：S 源码契约 / R 一级栏 rail / P 二级列与关键坐标 / B 主面区块 / D 差异表与容差 /
 * V 三视口与截图证据 / G 门禁反证（伪造读数必须逐条判红）/ E 全量复算与证据完整性。
 * G 组是卡 §六「不得只补测试不改真实样式」的机器形态：门禁若被阉割成恒放行，G 组当场变红
 * （由 f2a-visual-baseline-countertest.mjs 逐类注入验证，卡 §三.C.17 要求 ≥6 类视觉 mutation）。
 *
 * 运行（admin-web 目录）：node tests/f2a-visual-baseline.spec.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as lib from "./f2a-visual-baseline-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const read = (rel) => readFileSync(path.join(WEB, rel), "utf8");

const FIXTURE = "tests/fixtures/f2a-visual-measures.json";
assert.ok(existsSync(path.join(WEB, FIXTURE)), `缺少仓内证据副本 ${FIXTURE}（请先跑 node tests/f2a-visual-baseline.mjs <evidenceDir>）`);
const bundle = JSON.parse(read(FIXTURE));
const base = bundle.viewports?.[lib.BASE_VIEWPORT.id] ?? {};
const impl = base.impl ?? {};
const proto = base.prototype ?? {};
const protoRail = base.protoRail ?? {};
const implRail = base.implRail ?? {};
const itemsOf = (rail) => rail.items ?? [];
const clone = (x) => JSON.parse(JSON.stringify(x));

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

/* ══════ S. 源码契约（真源与卡面一致，防止「证据绿、源码已被改」） ══════ */

const navSrc = read("src/shared/workbench/prototype-nav.ts");
const shellSrc = read("src/layouts/WorkbenchShell.vue");
const subnavSrc = read("src/layouts/WorkbenchSubnav.vue");

await run("S1 prototype-nav.ts 的 rail 源码 = 卡面 §三.A.2 的 12 项（文案与顺序逐字节）", () => {
  let cursor = -1;
  for (const label of lib.RAIL_VISIBLE_LABELS) {
    const idx = navSrc.indexOf(`label: "${label}"`, cursor + 1);
    assert.ok(idx > cursor, `源码缺项或顺序漂移：${label}`);
    cursor = idx;
  }
  assert.ok(navSrc.includes('label: "设置"'), "设置项必须仍在一等列源码里（保留但视觉隐藏，不得删节点）");
  return `12 项顺序逐字节命中，设置项保留`;
});

await run("S2 二级列采集锚点齐备（data-testid 在真源，读数才不是凭空的）", () => {
  const anchors = [
    "second-nav-tabs",
    "second-nav-new-chat",
    "second-nav-search",
    "second-nav-search-toggle",
    "second-nav-account",
    "second-nav-dual-note",
    "second-nav-directory",
    "second-nav-sub-zone",
  ];
  const missing = anchors.filter((a) => !subnavSrc.includes(`data-testid="${a}"`));
  assert.equal(missing.length, 0, `WorkbenchSubnav.vue 缺锚点：${missing.join("/")}`);
  return `${anchors.length} 个 data-testid 锚点在源`;
});

await run("S3 壳层 rail 锚点与设置项节点在真源", () => {
  assert.ok(shellSrc.includes('data-testid="rail"'), "壳层缺 data-testid=\"rail\"");
  assert.ok(shellSrc.includes("wb-rail-set"), "壳层缺设置项节点（wb-rail-set）");
  assert.ok(shellSrc.includes('data-rail-key="set"'), "设置项 data-rail-key 锚点丢失");
  return "rail / 设置项锚点在 WorkbenchShell.vue";
});

/* ══════ R. 一级栏 rail（卡 §三.A.2 生产态 12 项） ══════ */

await run("R1 实现生产态 12 项：文案、顺序与原型实测逐项一致，且等于卡面清单", () => {
  const pLabels = itemsOf(protoRail).map((i) => String(i.label).trim());
  const iLabels = itemsOf(implRail).map((i) => String(i.label).trim());
  assert.deepEqual(iLabels, lib.RAIL_VISIBLE_LABELS, `实现项漂移：${iLabels.join("/")}`);
  assert.deepEqual(pLabels, lib.RAIL_VISIBLE_LABELS, `原型实测项与卡面不符：${pLabels.join("/")}`);
  assert.deepEqual(lib.findRailCount(itemsOf(protoRail), itemsOf(implRail)), [], "rail 项数/缺项门禁判红");
  return `12/12 文案顺序一致（${iLabels[0]}…${iLabels[11]}）`;
});

await run("R2 rail 项几何：逐项 x/y/宽/高与原型同容差，纵向步进一致", () => {
  const pItems = itemsOf(protoRail);
  const iItems = itemsOf(implRail);
  assert.equal(pItems.length, iItems.length, "两侧项数不同，无从逐项比几何");
  for (let k = 0; k < iItems.length; k += 1) {
    const p = pItems[k].metrics ?? {};
    const i = iItems[k].metrics ?? {};
    for (const metric of ["x", "y", "width", "height"]) {
      assert.ok(Math.abs(Number(i[metric]) - Number(p[metric])) <= lib.TOLERANCE.length, `第 ${k + 1} 项 ${metric}：原型=${p[metric]} 实现=${i[metric]}`);
    }
  }
  const pSteps = lib.railSteps(pItems);
  const iSteps = lib.railSteps(iItems);
  assert.deepEqual(iSteps, pSteps, `步进不一致：原型 ${pSteps.join("/")} vs 实现 ${iSteps.join("/")}`);
  return `12 项几何 ±${lib.TOLERANCE.length}px 内，步进 ${[...new Set(iSteps)].join("/")} 与原型同`;
});

await run("R3 rail logo 读数与原型对齐（位置/尺寸/圆角），标题为「智享全链」", () => {
  const num = (v) => Number.parseFloat(String(v));
  const p = protoRail.logo?.metrics ?? {};
  const i = implRail.logo?.metrics ?? {};
  for (const metric of lib.RAIL_LOGO_METRICS) {
    if (metric === "fontSize") continue; // 字体度量两侧渲染栈不同，留给差异表按容差判定
    assert.ok(Math.abs(num(i[metric]) - num(p[metric])) <= lib.TOLERANCE.length, `logo ${metric}：原型=${p[metric]} 实现=${i[metric]}`);
  }
  assert.equal(implRail.logo?.metrics?.title, "智享全链", "logo 标题不是「智享全链」");
  return `logo ${i.width}×${i.height}@(${i.x},${i.y})`;
});

await run("R4 选中态实色：工作台项背景=主蓝、文字/图标=白，与原型逐字节同值", () => {
  const p = protoRail.selected ?? {};
  const i = implRail.selected ?? {};
  for (const metric of lib.RAIL_SELECTED_METRICS) {
    const np = lib.normalizeColor(p[metric]);
    const ni = lib.normalizeColor(i[metric]);
    assert.equal(ni, np, `选中态 ${metric}：原型=${np} 实现=${ni}（容差 ${lib.TOLERANCE.color}）`);
  }
  assert.equal(i.backgroundColor, "rgb(37, 99, 235)", `选中底色不是主蓝实色：${i.backgroundColor}`);
  return `选中态 ${i.backgroundColor} / ${i.color} / 图标 ${i.iconColor}`;
});

await run("R5 设置项：原型与实现都保留 DOM 且 display:none（保留但视觉隐藏）", () => {
  for (const [side, rail] of [["原型", protoRail], ["实现", implRail]]) {
    const s = rail.settings;
    assert.equal(s?.exists, true, `${side}设置项节点被删（卡 §三.A.2 只许隐藏不许删）`);
    assert.equal(String(s?.metrics?.display), "none", `${side}设置项 display=${s?.metrics?.display}，非 none`);
    assert.deepEqual(lib.findRailSettingsHidden(s), [], `${side}设置项隐藏门禁判红`);
  }
  assert.equal(implRail.settings.metrics.text, "设置");
  return "双侧 exists=true 且 display:none";
});

await run("R6 生产态纯度：无骨架混入、无 ?wb_uiux 注入、rail 已落定 ready 态", () => {
  assert.deepEqual(lib.findRailSkeletonLeak(implRail), [], "生产态截图混入加载期骨架");
  assert.deepEqual(lib.findInjectionInProductionShot(base.production ?? {}), [], "生产态验收被注入污染");
  assert.equal(base.production?.uiuxInject, "off", `注入开关不是 off：${base.production?.uiuxInject}`);
  assert.ok(!String(base.production?.href ?? "").includes("wb_uiux"), `生产态 URL 带注入参数：${base.production?.href}`);
  assert.equal(base.railSettled, true, "一级栏未确认落定");
  assert.ok(Number(implRail.gap?.metrics?.height) >= 0, "底部分隔线读数缺失");
  return `无骨架/无注入/已落定（href=${base.production?.href}）`;
});

/* ══════ P. 二级列顺序、关键坐标与新对话（卡 §三.A.5/6/7） ══════ */

await run("P1 二级列纵向顺序：品牌区→说明块→常用功能→员工/对话横栏→目录→账号区", () => {
  for (const key of lib.SIDE_ORDER) {
    assert.equal(impl[key]?.exists, true, `顺序判定缺区域读数：${key}`);
  }
  assert.deepEqual(lib.findOrderViolations(impl, lib.SIDE_ORDER), [], "二级列顺序错位");
  return lib.SIDE_ORDER.map((k) => `${k}@y=${impl[k].metrics.y}`).join(" > ");
});

await run("P2 关键坐标落在卡面值：侧栏内容 y=66 · 横栏 y=422 h=32 · 目录 y=460 · 账号区 y=942 h=58", () => {
  const near = (key, want, metric = "y") => {
    const got = Number(impl[key]?.metrics?.[metric]);
    assert.ok(Math.abs(got - want) <= 1, `${key}.${metric}=${got}，卡面 ${want}`);
  };
  near("subZone", 66);
  near("segBar", 422);
  near("segBar", 32, "height");
  near("dir", 460);
  near("acct", 942);
  near("acct", 58, "height");
  // 两侧同容差（原型是权威真相源，卡面值只是速记）
  for (const [key, metric] of [["subZone", "y"], ["segBar", "y"], ["dir", "y"], ["acct", "y"], ["acct", "height"]]) {
    assert.ok(Math.abs(Number(impl[key]?.metrics?.[metric]) - Number(proto[key]?.metrics?.[metric])) <= lib.TOLERANCE.length, `${key}.${metric} 与原型读数偏差超容差`);
  }
  return "66 / 421.7→422,32 / 460 / 942,58 全部命中";
});

await run("P3 新对话：圆形小控件（≤40px）在员工/对话横栏右侧且为末位；整宽按钮已消失", () => {
  const n = impl.newChat?.metrics ?? {};
  assert.ok(Number(n.width) <= lib.MAX_NEWCHAT_WIDTH, `新对话宽 ${n.width}px，超过 ${lib.MAX_NEWCHAT_WIDTH}px ⇒ 还是大按钮`);
  assert.equal(Number(n.width), Number(n.height), `不是圆形控件：w=${n.width} h=${n.height}`);
  assert.equal(Number(n.rightMostWithinBar), 1, "横栏内右侧仍有其它可点控件，新对话不是末位");
  assert.deepEqual(lib.findNewChatPlacement(impl.newChat, impl.segBar), [], "新对话位置门禁判红");
  assert.deepEqual(lib.findFullWidthNewChat(base.newChatCandidates ?? []), [], "整宽新对话按钮仍在");
  return `${n.width}×${n.height} 圆控件@(${n.x},${n.y})，整宽候选 ${base.newChatCandidates?.length ?? 0} 个全部 ≤${lib.MAX_NEWCHAT_WIDTH}px`;
});

await run("P4 搜索框默认隐藏（节点保留 + focusable，隐藏不等于丢功能）", () => {
  assert.deepEqual(lib.findSearchVisibleByDefault(impl.search), [], "搜索框默认未隐藏");
  assert.equal(impl.search?.exists, true, "搜索框节点缺失");
  assert.equal(String(impl.search?.metrics?.display), "none", `默认 display=${impl.search?.metrics?.display}`);
  assert.equal(impl.search?.metrics?.focusable, true, "focusable=false：隐藏后不可能恢复可用");
  return "display:none 且 focusable 实测在";
});

await run("P5 搜索框可恢复：点击展开控件后真实绘制 + 可聚焦，再点回落回隐藏", () => {
  assert.deepEqual(lib.findSearchUnrecoverable(base.searchAfterToggle), [], "展开后不可恢复");
  assert.equal(base.searchAfterToggle?.visible, true, "展开后未绘制");
  assert.equal(base.searchAfterToggle?.metrics?.focused, "true", "展开后 activeElement 不是搜索框");
  assert.equal(base.searchAfterCollapse?.metrics?.display, "none", `收起后 display=${base.searchAfterCollapse?.metrics?.display}，没回到默认态`);
  return `展开 w=${base.searchAfterToggle?.metrics?.width} 可聚焦；收起回 none`;
});

await run("P6 账号区贴底：底边=视口高 1000（y=942 · h=58）", () => {
  assert.deepEqual(lib.findAccountNotPinned(impl.acct, lib.BASE_VIEWPORT.height), [], "账号区未贴底");
  const bottom = Number(impl.acct.metrics.y) + Number(impl.acct.metrics.height);
  assert.equal(bottom, lib.BASE_VIEWPORT.height, `底边 ${bottom} ≠ 1000`);
  return `y=${impl.acct.metrics.y} h=${impl.acct.metrics.height} → bottom=${bottom}`;
});

/* ══════ B. 主面区块顺序与诚实空位（卡 §三.A.8/9） ══════ */

await run("B1 主面区块顺序：KPI→待办审批→AI 播报→动作队列→任务步进（缺席区不参与顺序，但在场者不得乱序）", () => {
  assert.deepEqual(lib.findOrderViolations(base.implBody ?? impl, lib.BODY_ORDER), [], "主面区块顺序错位");
  const present = lib.BODY_ORDER.filter((k) => (base.implBody ?? impl)[k]?.exists === true && Number.isFinite(Number((base.implBody ?? impl)[k]?.metrics?.y)));
  assert.ok(present.length >= 3, `在场主面区域过少：${present.join("/")}`);
  return `${present.map((k) => `${k}@y=${(base.implBody ?? impl)[k].metrics.y}`).join(" > ")}`;
});

await run("B2 诚实 unavailable：审批卡/任务步进实现缺席时，读数与差异表都不得伪造存在", () => {
  for (const key of ["approvals", "taskStep"]) {
    const r = impl[key];
    assert.ok(r, `主面缺 ${key} 读数槽位`);
    assert.equal(r.exists, false, `${key}.exists=${r.exists}：数据不可得时必须如实缺席，不得用假数据占位（卡 §三.A.9）`);
    assert.deepEqual(Object.keys(r.metrics ?? {}), [], `${key} 缺席却携带伪造 metrics`);
    const rows = (base.diffTable ?? []).filter((x) => x.region === key);
    assert.ok(rows.length >= 1, `差异表缺 ${key} 行（缺席必须显式留痕，不得静默）`);
    for (const row of rows) assert.ok(["n/a", "explained"].includes(row.verdict), `${key} 差异行判读异常：${row.verdict}`);
  }
  return "approvals / taskStep：exists=false + metrics 空 + 差异表 n/a 留痕";
});

/* ══════ D. 差异表与容差（卡 §三.A.7「偏差必须逐项解释，原则上为 0」） ══════ */

await run("D1 差异表规模与门禁统计：门禁指标全部在容差内，超容差为 0", () => {
  const rows = base.diffTable ?? [];
  assert.deepEqual(lib.findEmptyDiff(rows), [], "差异表可疑（采集端可能没量到东西）");
  const stats = lib.gatedStats(rows);
  assert.ok(stats.gated >= 100, `门禁指标行仅 ${stats.gated} 条，疑似覆盖不足`);
  assert.equal(stats.offSpec, 0, `超容差且未解释 ${stats.offSpec} 条`);
  assert.equal(stats.withinTolerance, stats.gated, `容差内 ${stats.withinTolerance} ≠ 门禁总数 ${stats.gated}`);
  return `门禁 ${stats.gated} 指标：逐字节一致 ${stats.exact} · 容差内 ${stats.withinTolerance - stats.exact} · 超容差 0`;
});

await run("D2 偏差留痕：判红行为 0，「超容差但解释」的行必须带书面 note", () => {
  const rows = base.diffTable ?? [];
  assert.deepEqual(lib.findOffSpec(rows), [], "存在未解释的超容差/缺项行");
  for (const row of lib.findExplained(rows)) {
    assert.ok(String(row.note ?? "").length > 10, `${row.region}.${row.metric} 标为 explained 却没有逐项解释`);
  }
  return `off-spec 0 行 · explained ${lib.findExplained(rows).length} 行（均带说明）`;
});

await run("D3 差异表构造器反证：注入 18px 高度差必须产出行级判红", () => {
  const forged = clone(implRail);
  forged.items[0].metrics.height = Number(protoRail.items[0].metrics.height) + 18;
  const rows = lib.buildRailRows(protoRail, forged);
  const bad = lib.findOffSpec(rows).filter((r) => r.metric === "height");
  assert.ok(bad.length >= 1, "rail 高度被改 18px，差异表却没判红 ⇒ 构造器空转");
  assert.ok(lib.findEmptyDiff(rows.slice(0, 5)).length === 1, "行数塌陷没有被 findEmptyDiff 抓住");
  return `构造端对 ${forged.items[0].metrics.height}px 伪读数当场判红`;
});

/* ══════ V. 三视口与截图证据（卡 §三.A.1 / §三.C.14 / §五.1） ══════ */

await run("V1 三视口帧完整：并排 + 实现截图齐全、零横向裁切、哈希逐帧唯一", () => {
  const frames = bundle.frames ?? [];
  const need = [
    ["1440x1000", "prototype"],
    ["1440x1000", "implementation"],
    ["1440x1000", "side-by-side"],
    ["1024x768", "implementation"],
    ["390x844", "implementation"],
  ];
  for (const [vp, screen] of need) {
    assert.ok(frames.some((f) => f.viewport === vp && f.screen === screen), `缺证据帧 ${vp}/${screen}`);
  }
  for (const f of frames) assert.equal(Number(f.overflowX), 0, `${f.viewport}/${f.screen} overflowX=${f.overflowX}（横向裁切）`);
  assert.deepEqual(lib.findDuplicateHashes(frames), [], "帧 PNG 哈希重复（平图复用）");
  const thin = frames.filter((f) => Number(f.bytes) < 8000);
  assert.equal(thin.length, 0, `帧字节不足：${thin.map((f) => f.viewport + "/" + f.screen).join("；")}`);
  return `${frames.length} 帧 · 三视口零裁切 · 哈希唯一`;
});

await run("V2 并排证据：两张同视口真实截图 + 合成图面板由机器核对", () => {
  assert.deepEqual(lib.findMissingSideBySide(base.shots ?? {}), [], "并排三件套不齐");
  assert.deepEqual(lib.findSideBySideMismatch(base.sideBySide ?? {}), [], "并排图两侧非同视口");
  const s = base.sideBySide ?? {};
  assert.equal(s.panes, 2);
  assert.equal(s.sameViewport, true);
  assert.equal(s.heightMatch, 1);
  assert.deepEqual(s.protoRect && [s.protoRect.w, s.protoRect.h], [1440, 1000], "原型面板不是 1440×1000");
  assert.deepEqual(s.implRect && [s.implRect.w, s.implRect.h], [1440, 1000], "实现面板不是 1440×1000");
  return `并排 ${s.protoRect.w}×${s.protoRect.h} ⇄ ${s.implRect.w}×${s.implRect.h}`;
});

await run("V3 窄视口结构仍可达：1024/390 直接进入信息流且无注入", () => {
  for (const vp of lib.IMPL_ONLY_VIEWPORTS) {
    const entry = bundle.viewports?.[vp.id]?.implementationEntry ?? {};
    assert.equal(entry.feedShown, true, `${vp.id} 信息流面未进入（reachedFeed=${entry.reachedFeed}）`);
    assert.equal(entry.uiuxInject, "off", `${vp.id} 验收态带注入`);
  }
  return "1024×768 / 390×844 均真实进入";
});

/* ══════ G. 门禁反证：每类假读数必须当场判红（g 组被阉割 ⇒ 本组变红） ══════ */

await run("G1 findRailCount 反证：少一项 / 文案漂移都必须判红", () => {
  const twelve = itemsOf(implRail);
  assert.ok(twelve.length === 12, `基线 rail 项数已漂移：${twelve.length}`);
  assert.ok(lib.findRailCount(itemsOf(protoRail), twelve.slice(0, 11)).length >= 1, "11 项没有被判红");
  const renamed = twelve.map((it, k) => (k === 7 ? { ...it, label: "零售管理" } : it));
  assert.ok(lib.findRailCount(itemsOf(protoRail), renamed).some((x) => /缺项/.test(x.reason)), "第 8 项改名没有被判红");
  assert.ok(lib.findRailCount(itemsOf(protoRail).slice(0, 11), twelve).some((x) => /原型实测/.test(x.reason)), "原型侧少项没有被复核判红");
  return "少项 / 漂移 / 原型侧塌陷 三类均红";
});

await run("G2 findNewChatPlacement 反证：不同行、越出横栏、非末位都必须判红", () => {
  const off = lib.findNewChatPlacement({ exists: true, metrics: { ...impl.newChat.metrics, y: 700 } }, impl.segBar);
  assert.ok(off.some((x) => /不同行/.test(x.reason)), "新对话挪到 y=700 没被判红");
  const outside = lib.findNewChatPlacement({ exists: true, metrics: { ...impl.newChat.metrics, x: 999 } }, impl.segBar);
  assert.ok(outside.some((x) => /不在横栏/.test(x.reason)), "新对话越出横栏没被判红");
  const notLast = lib.findNewChatPlacement({ exists: true, metrics: { ...impl.newChat.metrics, rightMostWithinBar: 0 } }, impl.segBar);
  assert.ok(notLast.some((x) => /末位/.test(x.reason)), "非末位没被判红");
  assert.ok(lib.findNewChatPlacement({ exists: false }, impl.segBar).length === 1, "控件不存在没被判红");
  return "四路伪造全部判红";
});

await run("G3 findSearch 反证：默认绘制 / 展开不可聚焦 / 节点缺失都必须判红", () => {
  const painted = { exists: true, visible: true, metrics: { ...impl.search.metrics, display: "block", width: 201, height: 34 } };
  assert.ok(lib.findSearchVisibleByDefault(painted).length >= 1, "默认绘制没被判红");
  assert.equal(lib.findSearchVisibleByDefault(impl.search).length, 0, "真实读数被误判（反向）");
  const unfocusable = { exists: true, visible: true, metrics: { display: "block", width: 201, height: 34, focused: "false" } };
  assert.ok(lib.findSearchUnrecoverable(unfocusable).some((x) => /聚焦/.test(x.reason)), "不可聚焦没被判红");
  assert.ok(lib.findSearchUnrecoverable({ exists: false }).length === 1, "展开后节点消失没被判红");
  assert.ok(lib.findSearchVisibleByDefault({ exists: false }).length === 1, "默认态节点缺失没被判红");
  return "五路伪造全部判红";
});

await run("G4 findAccountNotPinned 反证：底边离开 1000 必须判红", () => {
  const floated = { exists: true, metrics: { y: 800, height: 58 } };
  assert.ok(lib.findAccountNotPinned(floated, 1000).length === 1, "底边 858 没被判红");
  assert.ok(lib.findAccountNotPinned({ exists: false }, 1000).length === 1, "账号区消失没被判红");
  assert.ok(lib.findAccountNotPinned({ exists: true, metrics: {} }, 1000).length === 1, "读数缺失没被判红");
  assert.equal(lib.findAccountNotPinned(impl.acct, 1000).length, 0, "真实读数被误判（反向）");
  return "浮动 / 消失 / 读数缺失 均红，真实读数绿";
});

await run("G5 findOrderViolations 反证：侧栏与主面各造一次乱序必须判红", () => {
  const swapped = clone(impl);
  swapped.dir.metrics.y = swapped.acct.metrics.y + 5; // 目录被挪到账号区之下
  const res = lib.findOrderViolations(swapped, lib.SIDE_ORDER);
  assert.equal(res.length, 1, "目录挪到账号区之下没被判红");
  assert.equal(res[0].actual, "brand > dualNote > grid > segBar > acct > dir", `乱序返回结构不对：${res[0]?.actual}`);
  const body = clone(base.implBody ?? impl);
  body.kpis.metrics.y = 900; // KPI 掉到队列之下
  assert.ok(lib.findOrderViolations(body, lib.BODY_ORDER).length === 1, "KPI 沉底没被判红");
  return "侧栏乱序 + 主面乱序 均红";
});

await run("G6 结构门禁反证：整宽按钮 / 设置项显形 / 骨架混入 / 注入 四类都必须判红", () => {
  assert.ok(lib.findFullWidthNewChat([{ selector: "button.big", width: 320 }]).length === 1, "320px 整宽按钮没被判红");
  assert.ok(lib.findRailSettingsHidden({ exists: true, metrics: { display: "flex" } }).length === 1, "设置项显形没被判红");
  assert.ok(lib.findRailSettingsHidden(undefined).length === 1, "设置项节点消失没被判红");
  assert.ok(lib.findRailSkeletonLeak({ skeletons: [{ n: 1 }, { n: 2 }] }).length === 1, "骨架混入没被判红");
  assert.ok(lib.findInjectionInProductionShot({ uiuxInject: true }).length === 1, "注入态冒充生产态没被判红");
  assert.ok(lib.findInjectionInProductionShot({ search: "?wb_uiux=12-groups" }).length === 1, "URL 注入参数没被判红");
  return "六路伪造全部判红";
});

await run("G7 并排证据反证：缺件 / 面板塌陷 / 高度不齐都必须判红", () => {
  assert.ok(lib.findMissingSideBySide({ prototype: { bytes: 100000 } }).length === 2, "缺两张图没被判满红");
  assert.ok(lib.findMissingSideBySide({ prototype: { bytes: 120 }, implementation: { bytes: 120 }, sideBySide: { bytes: 120 } }).length === 3, "字节过小的假图没被判红");
  assert.ok(lib.findSideBySideMismatch({ panes: 1, sameViewport: true, heightMatch: 1 }).length === 1, "面板数塌陷没被判红");
  assert.ok(lib.findSideBySideMismatch({ panes: 2, sameViewport: false, heightMatch: 0.9 }).length === 2, "视口/高度不齐没被判红");
  return "缺件 + 假图 + 塌陷 均红";
});

await run("G8 汇总门禁反证：对基线证据的每一类篡改，collectViolationsF2A 必须点名", () => {
  const forgeries = [
    (b) => { b.viewports["1440x1000"].impl.acct.metrics.y = 800; },
    (b) => { b.viewports["1440x1000"].impl.newChat.metrics.y = 700; },
    (b) => { b.viewports["1440x1000"].implRail.items = []; },
    (b) => { b.viewports["1440x1000"].impl.search = { exists: true, visible: true, metrics: { display: "block", width: 201, height: 34 } }; },
    (b) => { b.viewports["1440x1000"].sideBySide.heightMatch = 0.9; },
    (b) => { b.servers.portsAllDown = false; },
    (b) => { b.prototypeSha256 = "0".repeat(64); },
    (b) => { b.apiBase = "http://backend:8080"; },
    (b) => { b.errors = ["采集器吞掉的异常"]; },
  ];
  const caught = [];
  for (const forge of forgeries) {
    const f = clone(bundle);
    forge(f);
    const v = lib.collectViolationsF2A(f);
    assert.ok(v.length >= 1, "一类伪造被汇总门禁放行 ⇒ 门禁空转");
    caught.push(v[0].slice(0, 24));
  }
  assert.deepEqual(lib.collectViolationsF2A(bundle), [], "基线本身在汇总门禁下不绿");
  return `${forgeries.length} 类伪造全部点名拦截`;
});

/* ══════ E. 全量复算与证据完整性 ══════ */

await run("E1 全量门禁复算：仓内证据副本零违例，且与采集端入库判词一致", () => {
  const v = lib.collectViolationsF2A(bundle);
  assert.equal(v.length, 0, `门禁违例 ${v.length} 条：\n  - ${v.join("\n  - ")}`);
  assert.deepEqual(bundle.violations, [], "采集端入库时就有违例");
  assert.equal(bundle.servers.portsAllDown, true, "服务未自停");
  assert.equal(bundle.apiBase, "/api", "API 基址不是同源 /api");
  assert.equal(bundle.aborted, null, `采集中止：${bundle.aborted}`);
  assert.equal((bundle.errors ?? []).length, 0, `采集端异常未清零：${JSON.stringify(bundle.errors)}`);
  return `${(bundle.frames ?? []).length} 帧 0 违例（端口 ${bundle.servers.backendPort}/${bundle.servers.webPort} 已自停）`;
});

await run("E2 原型指纹与卡面逐字节相符（真相源没被换）", () => {
  const EXPECT = "6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51";
  assert.equal(bundle.prototypeSha256, EXPECT, `卡面指纹不符：${bundle.prototypeSha256}`);
  assert.equal(bundle.prototypeSource?.sha256, EXPECT, `实测指纹与卡面不符：${bundle.prototypeSource?.sha256}`);
  assert.ok(String(bundle.prototypeSource?.file ?? "").endsWith(".html"), "原型文件路径缺失");
  return "prototypeSource.sha256 == prototypeSha256 == 卡面值";
});

await run("E3 证据脱敏：A 段副本不得含凭据形态", () => {
  const text = read(FIXTURE);
  assert.ok(!/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text), "证据里残留 JWT");
  assert.ok(!/[?&]token=(?!<REDACTED>)[A-Za-z0-9._-]{12,}/.test(text), "证据里残留 token 参数");
  assert.ok(!/Bearer [A-Za-z0-9._-]{12,}/.test(text), "证据里残留 Bearer 凭据");
  assert.ok(!/"csrfToken":"[^<]/.test(text), "证据里残留 csrfToken 值");
  assert.ok(!/JWT_SECRET|CSRF_SECRET\s*[:=]\s*[0-9a-f]{16}/.test(text), "证据里残留一次性开发密钥");
  return "JWT / token / Bearer / csrfToken / 开发密钥 均未入证据";
});

await run("E4 网络审计闭合：失败要么恢复、要么落在 expectedOffline 白名单（3016 AI 编排）", () => {
  const unresolved = lib.findUnresolvedNetwork(bundle.network ?? {}, bundle.expectedOffline ?? []);
  assert.equal(unresolved.length, 0, `未闭合网络失败 ${unresolved.length} 条：${JSON.stringify(unresolved).slice(0, 300)}`);
  const offlinePorts = (bundle.expectedOffline ?? []).map((e) => Number(e.port));
  assert.ok(offlinePorts.includes(3016), "AI 编排服务未列 expectedOffline（离线口径没有单列）");
  const unexplained = (bundle.network?.failures ?? []).filter((f) => !offlinePorts.includes(Number(f.port)) && !(bundle.network.recovered ?? []).some((r) => r.signature === f.signature));
  assert.equal(unexplained.length, 0, "存在既非白名单又未恢复的失败");
  return `失败 ${bundle.network?.failures?.length ?? 0} 条全部闭合`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
