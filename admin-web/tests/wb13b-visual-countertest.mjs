/**
 * WORKBENCH-13B · 业务页视觉语法 / 逐页契约 / 390 窄口门禁 mutation 反测装置（卡 §三.D.19：≥10 类，本次 55 类）
 *
 * 与 f3-visual-contract-countertest.mjs 同构，但目标面是本单的四层真源：
 *   ① `src/styles.css` 的画布语法段（口径本体）      → 点名 wb13b-visual-grammar.spec 的用例变红
 *   ② `tests/wb13b-page-contract-lib.mjs`（判定函数） → 点名 wb13b-page-contract.spec 的用例变红
 *   ③ `tests/wb13b-module-parity.mjs`（采集侧接线）    → 点名 wb13b-page-contract.spec 的采集侧用例变红
 *   ④ 窄口五份真源：`WorkbenchShell.vue` / `styles/tokens.css` / `shared/workbench/wb-viewport.ts` /
 *      `views/pos/CashierView.vue` / `tests/wb13b-narrow-390.mjs` → 点名 wb13b-narrow-390.spec 的 N 组用例变红
 * 每条注入后必须**点名那条用例**变红（不是"整个套件红了"就算），随后逐字节复原并校验 SHA256 恒等，
 * 全部复原后三个专项都必须回绿 —— 否则说明门禁只是装饰。
 *
 *   M01 页根包装内边距 60⇒40                        → A4      M12 节奏剔除规则写死成不剔除      → P46
 *   M02 图表下边距规则丢掉画布前缀                  → A3      M13 书面解释的幅度上限失效          → P37
 *   M03 筛选条内边距 11×13⇒12×13                    → B1      M14 缺 owner 的待裁定直接放行        → P41
 *   M04 筛选控件宽度剥掉 !important                  → B3      M15 泛用别名 canvas 抢到角色别名前面  → P42
 *   M05 工具条按钮药丸 999⇒99                        → B5      M16 契约加别名而 CSS 不跟进          → C3
 *   M06 统计栅格 4 等分⇒3 等分                       → B9      M17 either 一侧缺席不再豁免          → P5
 *   M07 分页控件 26×26⇒24×24                         → B12     M18 区域取值退回首条命中            → P45
 *   M08 卡片头内衬 11×15⇒14×15                       → B14     M19 合并旧片时不重算处置档          → P44
 *   M09 看板/图表卡面描边剥净                        → B17     M20 采集侧不再走 lib 的说明合并      → P40
 *   M10 画布正文墨色回到 #000                        → B16     M21 待裁定行不再写进配对记录        → P43
 *   M11 长度容差 ±1⇒±2                               → P2      M22 隐藏子树不再分辨                → P47
 *   M23 本片采集不把节奏/字体差并进差异表             → P48     M24 重算旧片时不重建处置行          → P48
 *   M25 画布漏配 .stat-info 嵌套宿主                  → B10
 *   —— 以下 25 类全部落在 D 组窄口（390×844）真源上 ——
 *   M26 底部横条溢出方向翻回 hidden auto（入口裁死）  → N23     M32 focus-invisible 门禁词汇被改名    → N31
 *   M27 底部横条 56⇒40px（尺寸漂移）                  → N23     M33 真实 wheel 横滚换成脚本写值      → N32
 *   M28 断点真相源 390⇒375（采的不再是窄口档）        → N22     M34 goto 带 ?uiux-inject=1（注入冒充）→ N6
 *   M29 焦点环 2px⇒1px（键盘可见性退步）              → N21     M35 安全动词白名单放进「删除」        → N18
 *   M30 触控阈值 44⇒36（把不达标说成达标）            → N31     M36 390 抽屉默认收起⇒展开（绕 F3）    → N23
 *   M31 采集档位 390×844⇒414×896（尺寸漂移）          → N31     M37 底栏 z-index 46⇒43（层级漂移）     → N23
 *   M38 分页聚焦态选择器改名（焦点不可见复发）          → N33     M40 收银台 ≤390 搜索行 wrap⇒nowrap     → N35
 *   M39 区间选择器聚焦态选择器改名                     → N35     M41 抽屉匹配池不剔「待接入」占位卡    → N34
 *   M42 触摸收腿去掉命中测试（盲点旧坐标）                → N37     M44 还原读数不落档（只剩一个布尔）      → N37
 *   M43 rail 横滚回到固定 ±280（非 0 起始位钳到 0）        → N37
 *   M45 越界门禁退回读 40 格展示切片（页级裁切被吞）      → N38     M48 手势带不回的组不回灌硬越界          → N39
 *   M46 railScroller 桶成立与否改回查切片                → N38     M49 硬越界按钮数取 12 格样本 length     → N38
 *   M47 hidden 同步容器只按静态判据就免红                → N39     M50 手势腿缺失不再记 record-incomplete  → N38
 *   M51 合并端不清陈旧 roster-incomplete（已齐说成缺）   → N3      M53 各块 origin 汇总写成单值            → N6
 *   M52 记录不再逐条落 captureOrigin                     → N40     M54 URL 与自身 origin 不再比对          → N40
 *   M55 行注释里重新写 glob（views/**，F3 C3 假红根因）   → D4（回到 A 组语法：与 D 组判据同一条红线，
 *        —— 朴素去注释吞代码这类「解析口径」缺陷只跑 F3 链才暴露，tsc/eslint/build 全绿不代表安全）
 *
 * 运行（必须显式给证据输出目录，避免把中间产物写进工作树而破坏 clean）：
 *   node tests/wb13b-visual-countertest.mjs <outDir>
 * ⚠️ 本装置会就地改写 styles.css 与采集器源 ⇒ 不得与 wb13b-module-parity / wb13b-narrow-390 采集同时跑
 *    （启动前自检 WB13_BACKEND_PORT/WB13_WEB_PORT，占用即中止；跑反测时要把这两个变量指到**当前空闲**端口）。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");

const TARGETS = {
  css: path.join(WEB, "src", "styles.css"),
  lib: path.join(WEB, "tests", "wb13b-page-contract-lib.mjs"),
  col: path.join(WEB, "tests", "wb13b-module-parity.mjs"),
  shell: path.join(WEB, "src", "layouts", "WorkbenchShell.vue"),
  tokens: path.join(WEB, "src", "styles", "tokens.css"),
  viewport: path.join(WEB, "src", "shared", "workbench", "wb-viewport.ts"),
  narrow: path.join(WEB, "tests", "wb13b-narrow-390.mjs"),
  posview: path.join(WEB, "src", "views", "pos", "CashierView.vue"),
};
const SPECS = {
  G: path.join(WEB, "tests", "wb13b-visual-grammar.spec.mjs"),
  P: path.join(WEB, "tests", "wb13b-page-contract.spec.mjs"),
  N: path.join(WEB, "tests", "wb13b-narrow-390.spec.mjs"),
};
const SPEC_LABEL = { G: "wb13b-visual-grammar.spec", P: "wb13b-page-contract.spec", N: "wb13b-narrow-390.spec" };
const LAYER_LABEL = {
  css: "画布语法源（styles.css）",
  lib: "判定门禁函数（契约库）",
  col: "采集侧接线（并排采集器源）",
  shell: "窄壳结构真源（WorkbenchShell.vue）",
  tokens: "焦点环实现真源（tokens.css）",
  viewport: "断点唯一真相源（wb-viewport.ts）",
  narrow: "采集侧接线（390 窄口采集器源）",
  posview: "收银台窄口视图真源（CashierView.vue）",
};

const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!OUT) {
  console.error("必须显式传入证据输出目录（默认写进工作树会破坏 clean）：node tests/wb13b-visual-countertest.mjs <outDir>");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const sha256 = (b) => createHash("sha256").update(b).digest("hex").toUpperCase();

function runSpec(which) {
  try {
    const out = execFileSync(process.execPath, [SPECS[which]], { cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/** 注入点必须存在且唯一，否则说明源已漂移（或该值在别处也出现），反测本身失效 */
function patch(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  const n = norm.split(f).length - 1;
  assert.equal(n, 1, `${id}: 注入点出现 ${n} 次（应为 1 次，多处命中请改用 patchAll）→ ${f.slice(0, 70)}`);
  return norm.replace(f, to.replace(/\r\n/g, "\n"));
}

/** 同一缺陷写在该文件的多个宿主上（别名分组、成对记录字段）⇒ 必须全量注入，留一条活口就是假绿 */
function patchAll(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  const n = norm.split(f).length - 1;
  assert.ok(n >= 1, `${id}: 注入点未找到 → ${f.slice(0, 70)}`);
  return norm.split(f).join(to.replace(/\r\n/g, "\n"));
}

const CASES = [
  {
    id: "M01-page-wrap-padding-shrunk",
    title: "画布页根下内边距从原型 60 改小 ⇒ 包装层口径失效，逐页可用高度全变",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "max-width: 1080px;\n    margin: 0 auto;\n    padding: 32px 44px 60px;", "max-width: 1080px;\n    margin: 0 auto;\n    padding: 32px 44px 40px;", "M01"),
    expect: "A4",
  },
  {
    id: "M02-canvas-prefix-dropped",
    title: "图表下边距规则丢掉 `main.wb-view-manual` 前缀 ⇒ 工作台口径打到旧后台控制台（卡 §二 禁区）",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "main.wb-view-manual :is(.s-chart, .chart-container, .chart-card) {\n  margin-bottom: 14px;", ":is(.s-chart, .chart-container, .chart-card) {\n  margin-bottom: 14px;", "M02"),
    expect: "A3",
  },
  {
    id: "M03-filter-bar-padding",
    title: "筛选条内边距 11×13⇒12×13（原型 L764 口径被改写一处宿主）",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "padding: 11px 13px;", "padding: 12px 13px;", "M03"),
    expect: "B1",
  },
  {
    id: "M04-filter-width-not-important",
    title: "筛选控件宽度剥掉 `!important` ⇒ 156 处视图内联宽度重新顶穿画布口径",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "width: 148px !important;", "width: 148px;", "M04"),
    expect: "B3",
  },
  {
    id: "M05-button-radius-not-pill",
    title: "工具条按钮药丸 999⇒99（V16 归阶梯被改回原型字面量，宿主分组整体失配）",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "  height: 34px;\n  gap: 6px;\n  padding: 8px 14px;\n  border-radius: 999px;", "  height: 34px;\n  gap: 6px;\n  padding: 8px 14px;\n  border-radius: 99px;", "M05"),
    expect: "B5",
  },
  {
    id: "M06-stat-grid-3-columns",
    title: "统计栅格 4 等分⇒3 等分（原型 L216 .wb-kpis 的四卡口径）",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patchAll(t, "repeat(4, minmax(0, 1fr));", "repeat(3, minmax(0, 1fr));", "M06"),
    expect: "B9",
  },
  {
    id: "M07-pagination-control-24",
    title: "分页控件 26×26⇒24×24（原型 L773-774 尺度，差异表按 ±1 判红的那类差）",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "  min-width: 26px;\n  height: 26px;\n  line-height: 24px;", "  min-width: 24px;\n  height: 24px;\n  line-height: 22px;", "M07"),
    expect: "B12",
  },
  {
    id: "M08-card-header-padding",
    title: "卡片头内衬 11×15⇒14×15（原型 L778 .s-fc-hd；卡片头与卡片体同一份内衬＝层归属错）",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "padding: 11px 15px;", "padding: 14px 15px;", "M08"),
    expect: "B14",
  },
  {
    id: "M09-board-chart-surface-borderless",
    title: "看板列卡/图表块卡面描边剥净 ⇒ 回到实现侧自绘的无边框灰块（原型 L795/L801 有 1px 框）",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "main.wb-view-manual :is(.s-focus, .board-column, .chart-container, .chart-card, .s-chart) {\n  box-sizing: border-box;\n  background: var(--wb-panel, #ffffff);\n  border: 1px solid var(--wb-line, #eceef1);", "main.wb-view-manual :is(.s-focus, .board-column, .chart-container, .chart-card, .s-chart) {\n  box-sizing: border-box;\n  background: var(--wb-panel, #ffffff);\n  border: none;", "M09"),
    expect: "B17",
  },
  {
    id: "M10-canvas-ink-to-black",
    title: "画布正文墨色退回浏览器默认 #000 ⇒ 逐页字体门禁的每一行 body.color 都是真差",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "main.wb-view-manual {\n  color: var(--wb-ink, #16181d);\n}", "main.wb-view-manual {\n  color: #000000;\n}", "M10"),
    expect: "B16",
  },
  {
    id: "M11-length-tolerance-2px",
    title: "门禁失效：长度容差 ±1⇒±2（卡 §三.A.6 的 ≤±1px 被自己放宽）",
    spec: "P",
    target: TARGETS.lib,
    mutate: (t) => patch(t, "Math.abs(delta) <= tol", "Math.abs(delta) <= tol + 1", "M11"),
    expect: "P2",
  },
  {
    id: "M12-rhythm-wrapper-exemption-off",
    title: "门禁失效：节奏不再剔除包装壳 ⇒ 卡片包住筛选条的页全部误报成错序（结构层差冒充节奏差）",
    spec: "P",
    target: TARGETS.lib,
    mutate: (t) => patch(t, "const seq = want.filter((a) => !want.some((b) => wraps(a, b)));", "const seq = want;", "M12"),
    expect: "P46",
  },
  {
    id: "M13-note-cap-ignored",
    title: "书面解释越权：解释自带的幅度上限被忽略 ⇒ 270px 的分栏布局差也能被一句泛化说明吞掉",
    spec: "P",
    target: TARGETS.lib,
    mutate: (t) => patch(t, "const cap = isObj ? raw.maxAbsDelta : null;", "const cap = null;", "M13"),
    expect: "P37",
  },
  {
    id: "M14-blocked-without-owner-passes",
    title: "门禁失效：缺 owner 的待裁定不再落回判红 ⇒ 「本单不改」变成无需署名的静默豁免",
    spec: "P",
    target: TARGETS.lib,
    mutate: (t) => patch(t, "if (wantsBlocked && !owner) return { ...empty, text };", 'if (wantsBlocked && !owner) return { text, applies: true, disposition: "blocked", owner: "" };', "M14"),
    expect: "P41",
  },
  {
    id: "M15-generic-host-first",
    title: "宿主顺序倒置：泛用别名 `canvas` 抢到图表角色别名前面 ⇒ 量到画布本体（padding 恒 0）的假差",
    spec: "P",
    target: TARGETS.lib,
    mutate: (t) => patch(t, 'impl: [".s-chart", ".chart-container", ".chart-card", ".chart-box", ".chart", "[data-testid=\'page-chart\']", "canvas"],', 'impl: ["canvas", ".s-chart", ".chart-container", ".chart-card", ".chart-box", ".chart", "[data-testid=\'page-chart\']"],', "M15"),
    expect: "P42",
  },
  {
    id: "M16-contract-alias-without-css",
    title: "两张皮：契约给信息卡新增 `.wb-ghost-card` 宿主而画布语法段不跟进 ⇒ 换到该宿主的页面拿不到卡面口径",
    spec: "G",
    target: TARGETS.lib,
    mutate: (t) => patch(t, 'impl: [".el-card", ".form-card", "[data-testid=\'page-card\']"],', 'impl: [".el-card", ".form-card", "[data-testid=\'page-card\']", ".wb-ghost-card"],', "M16"),
    expect: "C3",
  },
  {
    id: "M17-either-absence-fatal",
    title: "判定档错置：expect=either 的一侧缺席不再豁免 ⇒ 版式差异重新冒充页面缺陷",
    spec: "P",
    target: TARGETS.lib,
    mutate: (t) => patch(t, '} else if (expect === "either") {', '} else if (expect === "either-never") {', "M17"),
    expect: "P5",
  },
  {
    id: "M18-pick-hides-zero-size",
    title: "采集口径退化：多条命中不再优先取排布者 ⇒ 隐藏 tab/抽屉里的同名节点充当页面区块（量出一堆 0）",
    spec: "P",
    target: TARGETS.col,
    mutate: (t) => patch(t, "const shown = pool.findIndex((el) => rendered(el) && laidOut(el));", "const shown = -1;", "M18"),
    expect: "P45",
  },
  {
    id: "M19-no-rescore-on-merge",
    title: "分片合并冻档：旧片配对不按当前说明文件重算 ⇒ 同一解释在两档视口给出不同处置",
    spec: "P",
    target: TARGETS.col,
    mutate: (t) => patch(t, 'if (p.status === "captured" && rescorePreviousPair(p))', 'if (p.status === "captured" && false)', "M19"),
    expect: "P44",
  },
  {
    id: "M20-inline-notes-merge",
    title: "采集侧自建说明合并：不再调用 lib 的四级作用域合并 ⇒ 逐页理由被同名模块级说明吃掉",
    spec: "P",
    target: TARGETS.col,
    mutate: (t) => patchAll(t, "mergeDeviationNotes(NOTES", "inlineScopeMerge(NOTES", "M20"),
    expect: "P40",
  },
  {
    id: "M21-blocked-row-dropped-from-evidence",
    title: "证据面缺失：待裁定行不再写进配对记录 ⇒ 只有内存里有，回传卡交接不出去",
    spec: "P",
    target: TARGETS.col,
    mutate: (t) => patchAll(t, "blocked: findPageBlocked(rows)", "blockedRows: findPageBlocked(rows)", "M21"),
    expect: "P43",
  },
  {
    id: "M22-hidden-subtree-counted-as-page",
    title: "采集口径退化：不再用 checkVisibility 分辨隐藏子树 ⇒ 没渲染的 DOM 量出 0 充当页面读数（会员系统实测）",
    spec: "P",
    target: TARGETS.col,
    mutate: (t) => patch(t, 'typeof el.checkVisibility === "function" ? el.checkVisibility() :', 'typeof el.checkVisibility === "function" ? laidOut(el) :', "M22"),
    expect: "P47",
  },
  {
    id: "M23-rhythm-rows-not-merged-fresh",
    title: "处置通道断在一层：本片采集不把节奏/字体差并进差异表 ⇒ 去向只写在库里，证据与人读表里没有",
    spec: "P",
    target: TARGETS.col,
    mutate: (t) => patch(t, "rows.push(...buildRhythmRows(rec.rhythm, notes), ...buildFontRows(rec.fonts, notes));", "void notes;", "M23"),
    expect: "P48",
  },
  {
    id: "M24-rhythm-rows-not-rebuilt-on-rescore",
    title: "处置通道断在另一层：重算旧片时不重建节奏/字体处置行 ⇒ 旧片的这两类差冻在采集那一刻的说明上",
    spec: "P",
    target: TARGETS.col,
    mutate: (t) => patch(t, "rows.push(...buildRhythmRows(p.rhythm, notes), ...buildFontRows(p.fonts ?? [], notes));", "void notes;", "M24"),
    expect: "P48",
  },
  {
    id: "M25-nested-stat-host-dropped",
    title: "画布漏配嵌套宿主：剥掉 `.stat-card .stat-info .stat-value` ⇒ 视图 (0,4,0) 顶回 24px/600，逐页字体门禁吃真红",
    spec: "G",
    target: TARGETS.css,
    mutate: (t) => patch(t, "main.wb-view-manual .stat-card .stat-info .stat-value,\n", "", "M25"),
    expect: "B10",
  },
  /* ── D 组（390 窄口 / 可访问性）新增 12 类，对上卡 §三.D.19 的十类口径 ── */
  {
    id: "M26-narrow-rail-scroll-direction-flipped",
    title: "窄壳溢出方向被翻回 `hidden auto` ⇒ 底部横条 13 个一级入口横向溢出后彻底滚不到（390 实测右侧入口被裁死）",
    spec: "N",
    target: TARGETS.shell,
    mutate: (t) => patch(t, "overflow: auto hidden;", "overflow: hidden auto;", "M26"),
    expect: "N23",
  },
  {
    id: "M27-narrow-rail-height-shrunk",
    title: "尺寸漂移：底部横条 56⇒40px ⇒ 与主面 padding-bottom 的同源口径断裂，触控命中区被压",
    spec: "N",
    target: TARGETS.shell,
    mutate: (t) => patch(t, "    height: 56px;", "    height: 40px;", "M27"),
    expect: "N23",
  },
  {
    id: "M28-narrow-breakpoint-drift",
    title: "断点真相源从 390 漂到 375 ⇒ 采的不再是卡 §三.D.15 钉死的窄口档，媒体查询与真相源脱钩",
    spec: "N",
    target: TARGETS.viewport,
    mutate: (t) => patch(t, "WB_NARROW_MAX_WIDTH_PX = 390", "WB_NARROW_MAX_WIDTH_PX = 375", "M28"),
    expect: "N22",
  },
  {
    id: "M29-focus-ring-weakened",
    title: "焦点环从 2px 实线弱化到 1px ⇒ 键盘焦点可见性退步（§三.D.16 禁止项，A/B/C 段此前零覆盖）",
    spec: "N",
    target: TARGETS.tokens,
    mutate: (t) => patch(t, "outline: 2px solid var(--color-primary);", "outline: 1px solid var(--color-primary);", "M29"),
    expect: "N21",
  },
  {
    id: "M30-touch-target-threshold-loosened",
    title: "门禁失效：触控命中区阈值 44⇒36（把不达标说成达标，而不是把控件做大）",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "const TOUCH_TARGET_MIN_PX = 44", "const TOUCH_TARGET_MIN_PX = 36", "M30"),
    expect: "N31",
  },
  {
    id: "M31-narrow-viewport-size-drift",
    title: "尺寸漂移：采集档位从 390×844 改成 414×896 ⇒ 量的是别的视口，整段窄口口径失证",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, 'const NARROW = { id: "390x844", width: 390, height: 844 }', 'const NARROW = { id: "390x844", width: 414, height: 896 }', "M31"),
    expect: "N31",
  },
  {
    id: "M32-focus-gate-renamed-away",
    title: "缺状态：focus-invisible 门禁词汇被改名 ⇒ 键盘焦点不可见不再进门禁（采集器被拔牙）",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, '"focus-invisible"', '"focus-ring-note"', "M32"),
    expect: "N31",
  },
  {
    id: "M33-rail-gesture-replaced-by-script",
    title: "注入冒充生产：真实 wheel 横滚换成脚本写 scrollLeft ⇒「用户滚得到」变成「采集器自己滚的」",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "await page.mouse.wheel(d, 0);", "await page.evaluate((v) => { const rail = document.querySelector('.wb-rail'); if (rail) rail.scrollLeft = rail.scrollLeft + v; }, d);", "M33"),
    expect: "N32",
  },
  {
    id: "M34-collection-url-gets-query-injection",
    title: "注入冒充生产：goto 带上 ?uiux-inject=1 ⇒ 用 query 造出窄口状态，截图与读数不再是生产视觉（卡 §六 红线）",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patchAll(t, "page.goto(`${ORIGIN}${plan.routePath}`", "page.goto(`${ORIGIN}${plan.routePath}?uiux-inject=1`", "M34"),
    expect: "N6",
  },
  {
    id: "M35-safe-verbs-admit-destructive",
    title: "越权点击：安全触发白名单放进「删除」⇒ 采集器会去点破坏性动作，越「只开不提交」红线",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, '"导出", "打印", "刷新"];', '"导出", "打印", "刷新", "删除"];', "M35"),
    expect: "N18",
  },
  {
    id: "M36-subnav-default-open",
    title: "绕过 F3 回归：390 抽屉默认收起被改成默认展开 ⇒ F3 已验收的「默认收起 + 点击受控」口径作废",
    spec: "N",
    target: TARGETS.shell,
    mutate: (t) => patch(t, "transform: translateX(-100%);", "transform: translateX(0);", "M36"),
    expect: "N23",
  },
  {
    id: "M37-layer-order-inverted",
    title: "层级漂移：底部横条 z-index 46⇒43 被压到遮罩(44)之下 ⇒ 抽屉展开时主操作条点不动",
    spec: "N",
    target: TARGETS.shell,
    mutate: (t) => patch(t, "    z-index: 46;", "    z-index: 43;", "M37"),
    expect: "N23",
  },
  {
    id: "M38-pagination-focus-selector-renamed",
    title: "缺状态：分页聚焦态选择器被改成接不到控件的 `.is-focused-removed` ⇒ 「每页条数/跳至」重新变成键盘焦点不可见",
    spec: "N",
    target: TARGETS.css,
    mutate: (t) => patch(t, "main.wb-view-manual .el-pagination .el-pagination__sizes .el-select__wrapper.is-focused,", "main.wb-view-manual .el-pagination .el-pagination__sizes .el-select__wrapper.is-focused-removed,", "M38"),
    expect: "N33",
  },
  {
    id: "M39-daterange-focus-selector-renamed",
    title: "缺状态：区间选择器聚焦态选择器 `.is-active` 被改名 ⇒ 390 实测过的「结束日期」焦点不可见退步复发",
    spec: "N",
    target: TARGETS.css,
    mutate: (t) => patch(t, "main.wb-view-manual :is(.filter-bar, .filter-card) .el-date-editor.el-input__wrapper.is-active {", "main.wb-view-manual :is(.filter-bar, .filter-card) .el-date-editor.el-input__wrapper.is-active-removed {", "M39"),
    expect: "N35",
  },
  {
    id: "M40-pos-searchbar-wrap-removed",
    title: "硬越界：收银台 ≤390 搜索行换行被改回 nowrap ⇒ 「全屏」钮再次落到 426px，390 里点不动（action-offscreen 真缺陷）",
    spec: "N",
    target: TARGETS.posview,
    mutate: (t) => patch(t, "  .product-searchbar {\n    flex-wrap: wrap;\n  }", "  .product-searchbar {\n    flex-wrap: nowrap;\n  }", "M40"),
    expect: "N35",
  },
  {
    id: "M41-pending-card-not-excluded",
    title: "采集器假点：抽屉匹配池不再剔 `.sn-card.pending`（待接入占位卡）⇒ 点了不导航的卡被当成入口，模块判成假红",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "const live = tier.all.filter((el) => !isPending(el));", "const live = tier.all;", "M41"),
    expect: "N34",
  },
  {
    id: "M42-toggle-close-leg-blind-tap",
    title: "采集器假红：触摸收腿去掉逐钮命中测试 ⇒ 盲点被 z45 抽屉盖住的旧坐标，把采集假象说成「收起钮失效」",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "if (!hit && visible && rec.topIsSelf) hit = rec;", "if (!hit) hit = rec;", "M42"),
    expect: "N37",
  },
  {
    id: "M43-rail-wheel-fixed-delta",
    title: "采集器假红：rail 横滚回到固定 ±280 ⇒ 起始位非 0 时反向钳到 0，「探针未还原」把可逆手势判成截图口径不一致",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "const d = p0.maxScrollLeft - p0.scrollLeft;", "const d = 280;", "M43"),
    expect: "N37",
  },
  {
    id: "M44-restore-reading-dropped",
    title: "证据缺失：还原读数不入库（只留一个布尔）⇒ 「还原=true」无从复核，容差判据变成自说自话",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "        railP.restoredTo = back.scrollLeft;\n", "", "M44"),
    expect: "N37",
  },
  {
    id: "M45-overflow-gate-back-to-display-slice",
    title: "采集器假绿：narrow-overflow 门禁退回读 40 格展示切片 ⇒ rail/离屏抽屉把切片占满后，页级真裁切（inventory 表头 10 个）被静默吞掉",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "const gateOff = ov.pageOffenders ?? [];", 'const gateOff = ov.offenders.filter((o) => o.reason === "page");', "M45"),
    expect: "N38",
  },
  {
    id: "M46-rail-bucket-detected-from-slice",
    title: "采集器假绿：railScroller 桶成立与否改回查切片 ⇒ 桶被占满时横滚可用性判据整条失效，一级入口裁死无人知",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "const railBucket = (ov.byReason?.railScroller ?? 0) > 0;", 'const railBucket = ov.offenders.some((o) => o.reason === "railScroller");', "M46"),
    expect: "N38",
  },
  {
    id: "M47-hidden-clipper-exemption-without-gesture",
    title: "软化豁免：hidden 同步容器只按静态 CSS/几何就免红 ⇒ 容器实为滚不动的死 hidden 时，被裁的列照样算「通过」",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "restored = unreachable.length === 0 && t.lastClipperScrollLeft > gp.clipperScrollLeft;", "restored = unreachable.length === 0;", "M47"),
    expect: "N39",
  },
  {
    id: "M48-unreachable-group-dropped",
    title: "门禁漏网：手势带不回的组不再回灌硬越界 ⇒ 裁死的表头既没豁免也没判红，退出码 0",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "if (!restored) hardOff.push(...g.offenders);", "", "M48"),
    expect: "N39",
  },
  {
    id: "M49-action-offscreen-count-truncated",
    title: "读数说谎：硬越界按钮数量取 12 格样本的 length ⇒ 20 个够不到的按钮报成 12 个，红还是那条红但台账不可复核",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "offscreenCount: items.filter((i) => i.offscreen).length,", "offscreenCount: items.filter((i) => i.offscreen).slice(0, 12).length,", "M49"),
    expect: "N38",
  },
  {
    id: "M50-gesture-leg-completeness-guard-removed",
    title: "完整性门松口：有页级越界却没跑手势腿的记录不再记 record-incomplete ⇒ 半截采集能被读成「没有裁切」",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, '  if (r.overflow?.pageOffenders?.length && !r.overflowGate) missing.push("①c 隐藏同步容器手势");\n', "", "M50"),
    expect: "N38",
  },
  {
    id: "M51-stale-roster-finding-carried",
    title: "分块合并的陈谎：全局 roster-incomplete 不再丢弃重算 ⇒ 跑齐 12 个模块后档里还写着「还缺 9 个」",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, 'keptFind = keptFind.filter((f) => f.kind !== "roster-incomplete");', 'keptFind = keptFind.filter((f) => f.kind !== "roster-never");', "M51"),
    expect: "N3",
  },
  {
    id: "M52-per-record-origin-dropped",
    title: "采集来路无从自证：记录不再逐条落 captureOrigin ⇒ 「同源」只能拿最后一块的 scope.origin 套全档",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "    captureOrigin: ORIGIN,\n", "", "M52"),
    expect: "N40",
  },
  {
    id: "M53-chunk-origins-summary-fake",
    title: "分块来路汇总失真：chunkOrigins 写成单值 ⇒ 12 条记录被读成都出自最后一块那台服务",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "chunkOrigins: [...new Set(records.map((r) => r.captureOrigin).filter(Boolean))],", "chunkOrigins: [ORIGIN],", "M53"),
    expect: "N6",
  },
  {
    id: "M54-url-vs-own-origin-check-removed",
    title: "不同源的页面混进档：URL 与记录自身 origin 的比对被摘掉 ⇒ 别的服务/别端口采的页也算同源证据",
    spec: "N",
    target: TARGETS.narrow,
    mutate: (t) => patch(t, "if (r.paint?.url && r.captureOrigin && !String(r.paint.url).startsWith(String(r.captureOrigin))) lack.push(", "if (false) lack.push(", "M54"),
    expect: "N40",
  },
  {
    id: "M55-glob-inside-line-comment",
    title: "行注释里重新写回 glob（views/**）⇒ 朴素去注释把后面的路由清单当块注释吞掉，F3 C3 读到截断清单",
    spec: "G",
    target: TARGETS.shell,
    mutate: (t) => patch(t, "指向 views 下同一批 .vue", "指向 component: views/**", "M55"),
    expect: "D4",
  },
];

/** 采集在跑时禁止注入：本装置会就地改写 styles.css，Vite 正在服务同一份文件 */
function assertNoCollectionRunning() {
  const ports = [Number(process.env.WB13_BACKEND_PORT ?? 8080), Number(process.env.WB13_WEB_PORT ?? 5199)];
  for (const port of ports) {
    const srv = net.createServer();
    try {
      srv.listen({ port, host: "127.0.0.1" });
    } catch (e) {
      if (e.code === "EADDRINUSE") throw new Error(`端口 ${port} 已被占用 ⇒ 采集器正在跑，反测不得同时改写 styles.css / 采集器源`);
      throw e;
    }
    srv.close();
  }
}
assertNoCollectionRunning();

const originals = new Map();
for (const f of Object.values(TARGETS)) originals.set(f, readFileSync(f));

/* 注入点预检：把每一类的 patch 先打在**内存里的原始文本**上过一遍（不落盘）。
   真源改了、反测锚点没跟着改（v7 就踩了：横滚换成对称 ±d 后 M33 还锚在旧的 wheel(280, 0)），
   按顺序跑到那一类才炸 ⇒ 前面几十类的复跑全白跑，还可能停在「已改写未复原」的中间态。 */
const anchorErrs = [];
for (const c of CASES) {
  try { c.mutate(originals.get(c.target).toString("utf8")); } catch (e) { anchorErrs.push(`${c.id}：${String(e?.message ?? e).split("\n")[0].slice(0, 130)}`); }
}
assert.deepEqual(anchorErrs, [], `注入点预检失败 ${anchorErrs.length} 类 ⇒ 反测锚点与真源漂移，先修锚点再谈变红：\n  ${anchorErrs.join("\n  ")}`);
console.log(`注入点预检：${CASES.length} 类锚点全部存在且唯一（未落盘）`);

console.log("基线 SHA256：");
for (const [f, b] of originals) console.log(`  ${path.basename(f)} = ${sha256(b)}`);

const baseG = runSpec("G");
const baseP = runSpec("P");
const baseN = runSpec("N");
console.log(`\n基线复跑（应绿）：语法 EXIT=${baseG.code} · 契约 EXIT=${baseP.code} · 窄口 EXIT=${baseN.code}`);
for (const [label, r] of [["语法", baseG], ["契约", baseP], ["窄口", baseN]]) {
  console.log(`  ${label}：${r.out.split("\n").find((l) => l.startsWith("小结") || l.includes("条（通过")) ?? "-"}`);
  assert.equal(r.code, 0, `基线必须为绿（${label}）\n${r.out.split("\n").filter((l) => l.startsWith("FAIL")).join("\n")}`);
}

const records = [];
for (const c of CASES) {
  const original = readFileSync(c.target);
  const originalHash = sha256(original);
  const mutated = c.mutate(original.toString("utf8"));
  // 源文件保持工作树既有换行（CRLF 文件注入后仍按 CRLF 写回）
  const wantCRLF = original.includes(0x0d);
  const bytes = wantCRLF ? mutated.replace(/\n/g, "\r\n") : mutated;
  writeFileSync(c.target, bytes);
  const injectedHash = sha256(readFileSync(c.target));

  const r = runSpec(c.spec);
  const fails = r.out.split("\n").filter((l) => l.startsWith("FAIL"));
  // 点名匹配按 `FAIL  <ID> ` 的行首字段，避免 B1 命中 B10/B12 这类同前缀用例
  const named = fails.some((l) => new RegExp(`^FAIL\\s+${c.expect}(\\s|$)`).test(l.trim()));

  writeFileSync(c.target, original);
  const restoredHash = sha256(readFileSync(c.target));

  console.log(`\n[反测 ${c.id}] ${c.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  点名变红 ${c.expect}：${named ? "是" : "否"}（FAIL ${fails.length} 条：${fails.map((f) => f.slice(0, 40)).join(" | ") || "无"}）`);
  console.log(`  复原 SHA256 恒等：${restoredHash === originalHash ? "是" : "否"}`);

  assert.ok(named, `${c.id}：注入缺陷后 ${c.expect} 没有变红 ⇒ 契约测试是装饰`);
  assert.equal(restoredHash, originalHash, `${c.id}：复原后 SHA256 与基线不一致`);
  records.push({
    id: c.id,
    title: c.title,
    spec: SPEC_LABEL[c.spec],
    layer: LAYER_LABEL[Object.keys(TARGETS).find((k) => TARGETS[k] === c.target)],
    target: path.relative(WEB, c.target).replace(/\\/g, "/"),
    baselineSha256: originalHash,
    injectedSha256: injectedHash,
    restoredSha256: restoredHash,
    restoreIdentical: restoredHash === originalHash,
    expectCase: c.expect,
    namedRed: named,
    failCount: fails.length,
    failLines: fails,
    specExitWhileMutated: r.code,
  });
}

const greenG = runSpec("G");
const greenP = runSpec("P");
const greenN = runSpec("N");
console.log(`\n复原后复跑（应绿）：语法 EXIT=${greenG.code} · 契约 EXIT=${greenP.code} · 窄口 EXIT=${greenN.code}`);
assert.equal(greenG.code, 0, `复原后语法专项必须回绿\n${greenG.out.split("\n").filter((l) => l.startsWith("FAIL")).join("\n")}`);
assert.equal(greenP.code, 0, `复原后契约专项必须回绿\n${greenP.out.split("\n").filter((l) => l.startsWith("FAIL")).join("\n")}`);
assert.equal(greenN.code, 0, `复原后窄口专项必须回绿\n${greenN.out.split("\n").filter((l) => l.startsWith("FAIL")).join("\n")}`);

const redCount = records.filter((r) => r.namedRed && r.restoreIdentical).length;
const layerCounts = Object.values(LAYER_LABEL)
  .map((label) => `${label} ${records.filter((r) => r.layer === label).length}`)
  .filter((s) => !s.endsWith(" 0"))
  .join(" · ");
const specSummary = (which, r) => `${SPEC_LABEL[which]}：${r.out.split("\n").find((l) => l.startsWith("小结")) ?? "-"}`;
const lines = [
  "# WORKBENCH-13B · 视觉语法 / 逐页契约 / 390 窄口门禁 mutation 反测记录",
  "",
  `- 卡 §三.D.19 要求：≥10 类 mutation 点名变红 + SHA256 复原 + 复跑回绿。本次 **${records.length} 类**（${layerCounts}），全部点名变红并复原恒等：**${redCount}/${records.length}**。`,
  `- 基线复跑：语法 EXIT=${baseG.code} · 契约 EXIT=${baseP.code} · 窄口 EXIT=${baseN.code}（0＝绿）；全部复原后复跑：语法 EXIT=${greenG.code} · 契约 EXIT=${greenP.code} · 窄口 EXIT=${greenN.code}。`,
  `- 复原后专项规模：${specSummary("G", greenG)} ／ ${specSummary("P", greenP)} ／ ${specSummary("N", greenN)}`,
  `- 反测与采集互斥：启动自检 ${TARGETS.css} 正被 Vite 服务时拒绝注入（端口 ${process.env.WB13_WEB_PORT ?? 5199} 占用即中止）。`,
  "",
  "| # | 注入的缺陷 | 层 | 点名用例 | 变红 | 注入后 SHA256 | 复原恒等 |",
  "| - | ---------- | -- | -------- | ---- | ------------- | -------- |",
  ...records.map(
    (r) =>
      `| ${r.id} | ${r.title} | ${r.layer} | ${r.spec} ${r.expectCase} | ${r.namedRed ? "✔" : "✗"} | ${r.injectedSha256.slice(0, 16)}… | ${r.restoreIdentical ? "✔" : "✗"} |`,
  ),
  "",
  "## 逐条 FAIL 原文（截取）",
  "",
  ...records.flatMap((r) => [`- **${r.id}**（${r.spec} EXIT=${r.specExitWhileMutated}，共 ${r.failCount} 条红）`, ...r.failLines.map((l) => `  \`${l.trim()}\``)]),
  "",
  `生成时间：${new Date().toISOString()}`,
  "",
];
writeFileSync(path.join(OUT, "wb13b-mutation-record.md"), lines.join("\n"), "utf8");
writeFileSync(
  path.join(OUT, "wb13b-mutation-record.json"),
  `${JSON.stringify({ schema: "wb13b-mutation/v1", generatedAt: new Date().toISOString(), cases: records, baselineGreen: { grammar: baseG.code === 0, contract: baseP.code === 0, narrow: baseN.code === 0 }, restoredGreen: { grammar: greenG.code === 0, contract: greenP.code === 0, narrow: greenN.code === 0 } }, null, 2)}\n`,
  "utf8",
);
console.log(`\n全部反测通过：${redCount}/${records.length} 点名变红 + ${redCount}/${records.length} SHA256 恒等 + 复原后语法/契约/窄口三专项回绿`);
console.log(`记录 → ${path.join(OUT, "wb13b-mutation-record.md")}`);
