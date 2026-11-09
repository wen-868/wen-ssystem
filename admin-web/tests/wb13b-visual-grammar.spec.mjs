/**
 * WORKBENCH-13B · 业务页视觉语法契约测试（A 组，卡 §三.A.4/6、§三.D、§六）
 *
 * 只读文本，不启服务、不碰 DOM ⇒ clean 检出即可复现（与 f3-visual-contract.spec.mjs 同一自包含口径）。
 * 真源三样：
 *   1. `src/styles.css` 的「13B 业务页视觉语法」段（逐条取自原型融合版 CSS 与实测读数）
 *   2. `src/layouts/WorkbenchShell.vue`（画布底色与顶栏标题字号层级）
 *   3. `tests/wb13b-visual-grammar-lib.mjs`（纯文本 CSS 解析器 + 画布作用域守卫）
 *
 * 为什么这一组用例存在（本单踩过的坑，必须留成机器门禁）：
 *   · CSS 注释里把三个值用斜杠串起来写（例：「11.5 归 11、600」写成 11.5⇒11、600 再加斜杠），
 *     「星号紧跟斜杠」会提前闭合注释 ⇒ 后半段中文说明漏成「选择器」，紧随其后的规则块被吞进垃圾前奏。
 *     浏览器不报错、vite/tsc/eslint/build 全绿，只有一轮真机读数（≈8 分钟）才暴露 ⇒ A1/A2 逐字节守住。
 *   · 语法段一旦漏掉 `main.wb-view-manual` 前缀，就会把工作台口径打到旧后台控制台（卡 §二 禁区）⇒ A3 守住。
 *   · 契约选择器与 CSS 声明必须互相覆盖：契约认某个分页宿主、CSS 却没给它口径 ⇒ 换宿主就漏配 ⇒ A14 守住。
 *
 * 运行（admin-web 目录）：node tests/wb13b-visual-grammar.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as g from "./wb13b-visual-grammar-lib.mjs";
import { PAGE_CONTRACT } from "./wb13b-page-contract-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const CSS = readFileSync(path.join(WEB, "src/styles.css"), "utf8");
const SHELL = readFileSync(path.join(WEB, "src/layouts/WorkbenchShell.vue"), "utf8");

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

/** 取语法段里某选择器片段的声明值（规则被截断吞掉时返回 null ⇒ 断言直接红，而不是静默通过） */
const decl = (sel, prop) => {
  const d = g.declValue(CSS, sel, prop);
  assert.ok(d, `规则不存活或缺声明：${sel} { ${prop}: … }（styles.css 里找不到 ⇒ 视为被注释截断吞掉）`);
  return d.value;
};

/* ══════ A. 可解析性与画布作用域（卡 §六 红线） ══════ */

await run("A1 语法段可定位且规则成规模（段头注释存在，段内规则 ≥30 条）", () => {
  const start = g.grammarStartLine(CSS);
  assert.ok(start > 0, "找不到「WORKBENCH-13B · 业务页视觉语法」段头 ⇒ 语法段被删或被截断");
  const rules = g.grammarRules(CSS);
  assert.ok(rules.length >= 30, `语法段规则数 ${rules.length} < 30 ⇒ 有规则块被前奏吞掉`);
  return `起始 L${start} · 段内 ${rules.length} 条 · 全文件 ${g.parseRules(CSS).length} 条`;
});

await run("A2 全文件零「前奏残文」：注释截断会把中文说明漏成选择器（本单两次踩坑的机器守卫）", () => {
  const hazards = g.findPreludeHazards(CSS);
  assert.deepEqual(hazards, [], `前奏出现中文/全角残文或裸分号 ⇒ 注释被「星号+斜杠」提前闭合：${JSON.stringify(hazards).slice(0, 400)}`);
  return "281 条规则的前奏全部干净";
});

await run("A3 语法段零画布泄漏：每条选择器都带 main.wb-view-manual 前缀（不得打到旧后台控制台）", () => {
  const leaks = g.findCanvasLeaks(CSS);
  assert.deepEqual(leaks, [], `语法段有裸选择器（会污染旧后台控制台，卡 §二）：${JSON.stringify(leaks).slice(0, 400)}`);
  return `${g.grammarRules(CSS).length} 条规则全部限定在画布内`;
});

await run("A4 页根包装规则活着：@media 768 以上 1080 上限 + 32/44/60 内边距（原型 L195 .wb-wrap）", () => {
  const sel = "main.wb-view-manual > *:not(.wb-menu-empty)";
  assert.equal(decl(sel, "max-width"), "1080px", "页根宽度上限不是原型口径 1080px");
  assert.equal(decl(sel, "padding"), "32px 44px 60px", "页根内边距不是原型口径 32 44 60");
  assert.equal(decl(sel, "width"), "100%", "页根未撑满可用宽度");
  const pos = "main.wb-view-manual > .pos-cashier";
  assert.equal(decl(pos, "max-width"), "none", "收银台未被排除出 1080 上限（原型 L197 .wb-wrap.pos-full）");
  assert.equal(decl(pos, "padding"), "16px 26px 18px", "收银台内边距不是原型口径 16 26 18");
  return "1080@325 与 32/44/60 由 CSS 规则本身担保（非读数口头声明）";
});

/* ══════ B. 逐部位取值＝原型 V16 归一后的计算口径 ══════ */

// 画布内筛选条有两种宿主命名（`.filter-bar`×86 与 `.filter-card`×5），§2 段用 `:is()` 合成一条口径。
// 断言取**分组后**的整串选择器 ⇒ 一旦有人把它改回只认 `.filter-bar`，B 组立刻红（漏配那 5 页）。
const FB = "main.wb-view-manual :is(.filter-bar, .filter-card)";

await run("B1 筛选条：radius 14、gap 9、内边距 11×13、下外边距 13、#F9FAFB 底 + 1px #ECEEF1（原型 L764）｜两种宿主同一组规则", () => {
  const sel = FB;
  assert.equal(decl(sel, "border-radius"), "14px");
  assert.equal(decl(sel, "gap"), "9px");
  assert.equal(decl(sel, "padding"), "11px 13px");
  assert.equal(decl(sel, "margin-bottom"), "13px");
  assert.equal(decl(sel, "background"), "var(--wb-side, #f9fafb)");
  assert.equal(decl(sel, "border"), "1px solid var(--wb-line, #eceef1)");
  assert.ok(CSS.includes(".filter-card"), "语法段不再认识 `.filter-card` 宿主 ⇒ 那 5 页会掉回旧皮肤");
  return "源码写归一后的 14（不是原型源码字面量 12）";
});

await run("B2 筛选控件：148×30、radius 10、12px、1px 实线 #ECEEF1（原型 L767-769，V16 归一 9⇒10）", () => {
  const box = `${FB} .el-input__wrapper`;
  assert.equal(decl(box, "min-height"), "30px");
  assert.equal(decl(box, "height"), "30px", "只有 min-height ⇒ 带前缀图标/尺寸变体的控件实测 32（差异表 filterField.height 30 vs 32）");
  assert.equal(decl(box, "border-radius"), "10px");
  assert.equal(decl(box, "border"), "1px solid var(--wb-line, #eceef1)");
  assert.equal(decl(box, "font-size"), "12px");
  assert.equal(decl(box, "box-shadow"), "none", "EP 默认的 inset 描边未剥 ⇒ 差异表 borderBottomColor 读出 none（假红）");
  return "描边落在 wrapper（EP 的可视盒），与原型量同一层";
});

await run("B3 筛选控件宽度必须压过视图内联写法：148px !important + 日期类例外（156 处内联宽度的收口）", () => {
  const sel = `${FB} .el-input:not(.el-date-editor)`;
  assert.equal(decl(sel, "width"), "148px !important", "无 !important ⇒ 视图内联 style 宽度顶穿画布口径（实测 filterField.width 148⇒200/220）");
  assert.ok(sel.includes("not(.el-date-editor)"), "未排除日期控件 ⇒ 区间选择器会被压到 148 而裁切（§三.C.14）");
  assert.equal(decl(`${FB} .el-select`, "width"), "148px !important");
  assert.equal(decl(`${FB} .el-input`, "--el-component-size"), "30px", "EP 尺寸变量未压到 30 ⇒ 控件实际高 32/34");
  return "内联样式优先级高于选择器 ⇒ !important 是画布内唯一可行的归一手段";
});

await run("B4 筛选条间距一源：条目不带 margin，画布只认 gap 9（原型 L764 无条目外边距）", () => {
  assert.equal(decl(`${FB} > *`, "margin"), "0 !important");
  assert.equal(decl(`${FB} .filter-bar-items`, "display"), "contents", "「条内套条」的内层未收进同一行（实测 filterBar.height 101⇒136）");
  assert.equal(decl(`${FB} .toolbar-right`, "margin-left"), "auto !important", "右侧动作组未贴右（原型 L2764 margin-left:auto）");
  assert.equal(decl(`${FB} .toolbar-right`, "gap"), "8px");
  assert.equal(decl(`${FB} label`, "font-size"), "11px", "字段标签未取原型 11.5⇒11 口径");
  return "嵌套重复筛选条已改名 .filter-bar-items，display:contents 复原单层行";
});

await run("B5 工具条按钮：高 34、内边距 8×14、radius 999 药丸、12px（原型 L212 .btn2，V16 归一 99⇒999）", () => {
  const sel = "main.wb-view-manual .page-header-actions .el-button";
  assert.equal(decl(sel, "height"), "34px");
  assert.equal(decl(sel, "padding"), "8px 14px");
  assert.equal(decl(sel, "border-radius"), "999px");
  assert.equal(decl(sel, "font-size"), "12px");
  const hosts = [`${FB} .el-button`, "main.wb-view-manual .acts-bar .el-button", "main.wb-view-manual .table-card-footer .el-button"];
  for (const h of hosts) assert.equal(decl(h, "border-radius"), "999px", `${h} 未同步药丸口径`);
  assert.equal(decl("main.wb-view-manual .page-header-actions .el-button--primary", "background"), "var(--wb-primary, #2563eb)");
  assert.equal(decl(`${FB} .el-button--primary`, "color"), "#ffffff", "主按钮白字缺失 ⇒ 蓝底深字（原型 L214 .btn2.pri）");
  return "四类宿主（筛选条/页头/操作条/表格脚）同一药丸尺度";
});

await run("B6 表格框：radius 14 + 1px #ECEEF1，宿主皮肤剥净（原型 L269，V16 归一 13⇒14）", () => {
  assert.equal(decl("main.wb-view-manual .el-table", "border-radius"), "14px");
  assert.equal(decl("main.wb-view-manual .el-table", "border"), "1px solid var(--wb-line, #eceef1)");
  for (const host of ["main.wb-view-manual .table-card", "main.wb-view-manual .data-table"]) {
    assert.equal(decl(host, "background"), "transparent", `${host} 仍带 R100 卡片底色`);
    assert.equal(decl(host, "border"), "none");
    assert.equal(decl(host, "box-shadow"), "none");
    assert.equal(decl(host, "border-radius"), "0");
  }
  return "视图自绘 .table-card 与共享组件 .data-table 两种宿主同层剥皮";
});

await run("B7 表头单元格：11px/600 #8A8F98、内边距 10×14、#F9FAFB 底、无下边框（原型 L270）", () => {
  const sel = "main.wb-view-manual .el-table th.el-table__cell";
  assert.equal(decl(sel, "font-size"), "11px");
  assert.equal(decl(sel, "font-weight"), "600");
  assert.equal(decl(sel, "padding"), "10px 14px");
  assert.equal(decl(sel, "border-bottom"), "none", "原型行分隔由 td 上边框提供，表头不得再多画一条");
  assert.ok(decl(sel, "background").includes("!important"), "未用 !important 压不住 R100 全局皮肤 styles.css:1259 的 th 底色");
  return "11.5⇒11 取归一后计算值（真相源＝收敛后的 computed）";
});

await run("B8 表体单元格：12px #16181D、内边距 11×14、行分隔改到上边框（原型 L272）", () => {
  const sel = "main.wb-view-manual .el-table td.el-table__cell";
  assert.equal(decl(sel, "font-size"), "12px");
  assert.equal(decl(sel, "color"), "var(--wb-ink, #16181d)");
  assert.equal(decl(sel, "padding"), "11px 14px");
  assert.equal(decl(sel, "border-top"), "1px solid var(--wb-line, #eceef1)");
  assert.equal(decl(sel, "border-bottom"), "none", "EP 默认把行隔画在下边框 ⇒ 末行会多压一条线，与原型不同侧");
  const cell = "main.wb-view-manual .el-table td.el-table__cell > .cell";
  assert.equal(decl(cell, "padding"), "0", "EP 的 .cell 默认 padding 会顶高行（原型文字直接在 td 内）");
  assert.equal(decl(cell, "line-height"), "normal");
  return "12.5⇒12 · 实测行高 55 的构成：11+11+16(12px×normal 1.33≈16)+1 上边框";
});

await run("B9 统计条宿主与卡片：宿主别名齐（grid 4 列 gap13），卡片 14×16、radius 14、无边框图（原型 L216-220）", () => {
  for (const host of [".stat-row", ".stats-row", ".stat-grid", ".stat-cards", ".wb-kpis", ".stat-bar"]) {
    const sel = `main.wb-view-manual ${host}`;
    assert.equal(decl(sel, "grid-template-columns"), "repeat(4, minmax(0, 1fr))", `${host} 未同步 4 列`);
    assert.equal(decl(sel, "gap"), "13px", `${host} 未同步 gap 13`);
    // 原型 L216 `.wb-kpis` 不带下边距（实测 margin=0,0,0,0）⇒ 画布自加的 13px 会让每一页
    // statistics.marginBottom 吃一行 Δ=13 的真红，这里按渲染真值钉死为 0。
    assert.equal(decl(sel, "margin-bottom"), "0", `${host} 下外边距不是原型的 0（原型 .wb-kpis 只有 gap）`);
  }
  for (const card of [".stat-item", ".stat-card", ".stat-grid-card", ".wb-kpi"]) {
    const sel = `main.wb-view-manual ${card}`;
    assert.equal(decl(sel, "padding"), "14px 16px", `${card} 内边距不是原型口径`);
    assert.equal(decl(sel, "border-radius"), "14px");
    assert.equal(decl(sel, "border-image"), "none", `${card} 仍带 R100 左侧渐变色条（原型没有）`);
    assert.equal(decl(sel, "box-shadow"), "none");
  }
  return "宿主 6 别名 + 卡片 4 别名 = src/views 实测同类命名（漏一个就误报 statistics 缺失或量到视图自绘皮肤）";
});

await run("B9b StatBar.vue（客户 订单 商品 库存 财务 共用）：条状皮肤剥净，每格长成 .wb-kpi", () => {
  const bar = "main.wb-view-manual .stat-bar";
  assert.equal(decl(bar, "background"), "transparent", "KPI 条仍带整条灰底 ⇒ 与原型「4 张独立卡」结构不同");
  assert.equal(decl(bar, "border"), "none");
  assert.equal(decl(bar, "border-radius"), "0");
  assert.equal(decl(bar, "box-shadow"), "none");
  assert.equal(decl(bar, "padding"), "0");
  const item = "main.wb-view-manual .stat-bar-item";
  assert.equal(decl(item, "padding"), "14px 16px");
  assert.equal(decl(item, "border-radius"), "14px");
  assert.equal(decl(item, "background"), "var(--wb-side, #f9fafb)");
  assert.equal(decl(item, "text-align"), "left", "原型 .wb-kpi 左对齐，组件默认居中（scoped 样式在画布内必须还原）");
  assert.equal(decl(item, "border"), "1px solid var(--wb-line, #eceef1)", "卡间竖分隔线必须换成四边 1px 框（原型 .wb-kpi 口径）");
  return "组件本体一字未改（旧后台控制台共用），只在工作台画布内还原（卡 §二）";
});

await run("B10 统计值与统计标签：20px/800 上边距 6 ｜ 11px #8A8F98（原型 L219-220）", () => {
  const v = "main.wb-view-manual .stat-item .stat-value";
  assert.equal(decl(v, "font-size"), "20px");
  assert.equal(decl(v, "font-weight"), "800");
  assert.equal(decl(v, "margin-top"), "6px");
  assert.equal(decl(v, "color"), "var(--wb-ink, #16181d)");
  const l = "main.wb-view-manual .stat-item .stat-label";
  assert.equal(decl(l, "font-size"), "11px");
  assert.equal(decl(l, "color"), "var(--wb-ink2, #8a8f98)");
  for (const alt of [".stat-card .stat-value", ".stat-card .stat-info .stat-value", ".stat-grid-card .stat-grid-value", ".wb-kpi .v", ".stat-bar-value"]) assert.equal(decl(`main.wb-view-manual ${alt}`, "font-size"), "20px", `${alt} 未同步统计值口径`);
  for (const alt of [".stat-card .stat-label", ".stat-card .stat-info .stat-label", ".stat-grid-card .stat-grid-label", ".wb-kpi .l", ".stat-bar-label"]) assert.equal(decl(`main.wb-view-manual ${alt}`, "font-size"), "11px", `${alt} 未同步统计标签口径`);
  // .stat-info 多一层嵌套 = 视图 scoped 样式 (0,4,0) 会顶掉画布 (0,3,1)（ProductReview 等 8 视图实测）⇒ 画布必须同样写满四层。
  const info = "main.wb-view-manual .stat-card .stat-info";
  for (const alt of [" .stat-value", " .stat-label"]) {
    const sel = info + alt;
    assert.equal(sel.split(" ").length, 4, "写漏层级就没赢过视图");
    assert.match(decl(sel, "color"), /^var\(--wb-/, `${sel} 颜色没走画布令牌`);
  }
  assert.equal(decl(info + " .stat-label", "margin-bottom"), "0", "视图给标签留了 4px 下边距 ⇒ 与画布 6px 上边距叠加，间距翻倍");
  assert.equal(decl("main.wb-view-manual .stat-bar-value", "margin-top"), "0", "StatBar 是「数值在前 标签在后」⇒ 6px 间距必须挂在后出现的标签上，否则两块间距翻倍");
  assert.equal(decl("main.wb-view-manual .stat-bar-label", "margin-top"), "6px");
  return "11.5⇒11 · 四套视图命名（stat-value / stat-grid-value / stat-bar-value / .v）全部覆盖";
});

await run("B11 分页宿主：space-between + 10×4×0 + 11px #8A8F98 + 透明无框（原型 L771-774，实测高 36）", () => {
  for (const host of [".pagination-bar", ".table-card-footer", ".pagination-wrapper"]) {
    const sel = `main.wb-view-manual ${host}`;
    assert.equal(decl(sel, "justify-content"), "space-between", `${host} 未同原型左总数右按钮`);
    assert.equal(decl(sel, "padding"), "10px 4px 0", `${host} 内边距不是原型口径`);
    assert.equal(decl(sel, "font-size"), "11px");
    assert.equal(decl(sel, "color"), "var(--wb-ink2, #8a8f98)");
    assert.equal(decl(sel, "background"), "transparent", `${host} 仍带 R100 皮肤底色`);
    assert.equal(decl(sel, "border"), "none");
    assert.equal(decl(sel, "box-shadow"), "none");
  }
  return "三种宿主（视图自绘两种 + 共享组件 DataTable 的 .pagination-wrapper）同层剥皮";
});

await run("B12 分页控件：26×26、内边距 0×7、radius 10、11px；当前页 #2563EB 白字（原型 L773-774）", () => {
  const sel = "main.wb-view-manual .el-pagination .el-pager li";
  assert.equal(decl(sel, "height"), "26px");
  assert.equal(decl(sel, "min-width"), "26px");
  assert.equal(decl(sel, "padding"), "0 7px");
  assert.equal(decl(sel, "border-radius"), "10px");
  assert.equal(decl(sel, "font-size"), "11px");
  assert.equal(decl(sel, "border"), "1px solid var(--wb-line, #eceef1)");
  const active = "main.wb-view-manual .el-pagination .el-pager li.is-active";
  assert.equal(decl(active, "background"), "var(--wb-primary, #2563eb)");
  assert.equal(decl(active, "color"), "#ffffff");
  return "8⇒10 取归一后阶梯（RM 阶梯 5/7⇒6、8/9/11⇒10、12/13/16⇒14）";
});

await run("B13 分页行高不得被 sizes/jumper 顶起：下拉与跳转盒压到 26（实测宿主 36⇒44 的根因）", () => {
  for (const sel of [
    "main.wb-view-manual .el-pagination .el-pagination__sizes .el-select__wrapper",
    "main.wb-view-manual .el-pagination .el-pagination__sizes .el-input__wrapper",
    "main.wb-view-manual .el-pagination .el-pagination__jump .el-input__wrapper",
  ]) {
    assert.equal(decl(sel, "height"), "26px", `${sel} 未压到 26 ⇒ flex 行高变 34，宿主量出 44`);
    assert.equal(decl(sel, "border-radius"), "10px");
    assert.equal(decl(sel, "font-size"), "11px");
  }
  assert.equal(decl("main.wb-view-manual .el-pagination", "height"), "26px", "控件本体未钉高 ⇒ 宿主里最高一层仍是 EP 给本体画的 30 高盒，分页宿主实测 40（原型 36）");
  return "共享组件 DataTable.vue 的 layout 带 sizes/jumper，组件本体不改，只在画布内同尺";
});

await run("B14 信息卡 / 板块标题 / 空态：radius 14、卡片头 11×15 + 12px/700、.s-sec 13px/800、空态 38×20 虚线（原型 L777-780、L775、L9890）", () => {
  assert.equal(decl("main.wb-view-manual :is(.el-card, .form-card, [data-testid='page-card'])", "border-radius"), "14px !important");
  assert.equal(decl("main.wb-view-manual :is(.el-card, .form-card, [data-testid='page-card'])", "margin-bottom"), "13px");
  assert.equal(decl("main.wb-view-manual :is(.el-card, .form-card, [data-testid='page-card'])", "box-shadow"), "none !important");
  assert.ok(decl("main.wb-view-manual :is(.el-card, .form-card, [data-testid='page-card'])", "border").includes("!important"), "卡片描边未带 !important ⇒ 被全局皮肤剥成无边框");
  const hd = "main.wb-view-manual :is(.el-card__header, .form-card-header, [data-testid='page-card-header'])";
  // 13C：画布卡头需 !important 压回全局 .el-card__header 的壳层 padding（styles.css:669/2040）；declValue 返回原值含 !important
  assert.equal(decl(hd, "padding"), "11px 15px !important");
  assert.equal(decl(hd, "font-size"), "12px");
  assert.equal(decl(hd, "font-weight"), "700");
  assert.equal(decl(hd, "border-bottom"), "1px solid var(--wb-line, #eceef1) !important");
  assert.equal(decl("main.wb-view-manual :is(.el-card__body, .form-card-body, [data-testid='page-card-body'])", "padding"), "14px 15px");
  assert.equal(decl("main.wb-view-manual .s-sec", "font-size"), "13px");
  assert.equal(decl("main.wb-view-manual .s-sec", "font-weight"), "800");
  assert.equal(decl("main.wb-view-manual .s-sec", "margin"), "22px 0 11px");
  for (const e of [".v17-empty", ".empty-state", ".empty-tip", ".el-empty"]) {
    const sel = `main.wb-view-manual ${e}`;
    assert.equal(decl(sel, "padding"), "38px 20px", `${e} 未同步空态尺度`);
    assert.equal(decl(sel, "border-radius"), "14px");
    assert.ok(decl(sel, "border").includes("dashed"), `${e} 边框不是虚线（原型 L9890 1px dashed #ECEEF1）`);
    assert.equal(decl(sel, "background"), "var(--wb-panel, #ffffff)", `${e} 底色与原型 L9890 的 var(--panel) 不同（画布上视觉相同，但差异表按计算值逐字节比）`);
    assert.equal(decl(sel, "text-align"), "center");
    assert.equal(decl(sel, "margin"), "2px 0");
  }
  return "13.5⇒13、12.5⇒12、13⇒14 全部按 V16 归一后取值";
});

await run("B15 画布底色与顶栏标题层级：白底（原型 L10 --bg + L193 .wb-view）｜ 15px/800/0.3px（原型 L99 .top .name）", () => {
  assert.match(SHELL, /\.wb-view-manual\s*\{[^}]*background:\s*var\(--wb-bg,\s*#ffffff\)/, "画布底色不是原型白底");
  assert.match(SHELL, /\.wb-top-title\s*\{[^}]*font-size:\s*15px/, "顶栏标题字号不是原型 15px");
  assert.match(SHELL, /\.wb-top-title\s*\{[^}]*font-weight:\s*800/, "顶栏标题字重不是原型 800（原实现 600 ⇒ 差异表判红）");
  assert.match(SHELL, /\.wb-top-title\s*\{[^}]*letter-spacing:\s*0\.3px/, "顶栏标题字距不是原型 0.3px");
  return "字重/字距属字号层级，不改几何 ⇒ 不触碰 F3 已验收的壳层尺寸口径";
});

await run("B16 画布正文墨色 = 原型 --ink（原型 L27 body{color:var(--ink)} 一路继承进 #wbBody ⇒ 22,24,29）", () => {
  // 逐页字体门禁的 body 角色取的是**页面根容器自身**的计算色。实现侧的壳层与视图都没给业务页根设过 color，
  // 旧状态落在浏览器默认 0,0,0 ⇒ 11 个模块 × 2 视口的每一条配对都吃一行 body.color 真红（画布级缺口，不是某页的问题）。
  assert.equal(decl("main.wb-view-manual", "color"), "var(--wb-ink, #16181d)", "画布未继承原型墨色 ⇒ 页根 computed color 回到 0,0,0");
  // 画布底色仍属壳层口径（F3 已验收），本条只补文字色，不得顺手把 background 也改写
  assert.ok(declValueSkipsBackground(), "§0 规则里出现了 background ⇒ 越界改动 F3 已验收的画布底色口径");
  return "只补一条继承源头；EP 组件自带文字色（表格/表单 token）不受选择器影响，仍逐字节判";
});
function declValueSkipsBackground() {
  const rule = g.grammarRules(CSS).find((r) => (r.preludeRaw ?? "").trim() === "main.wb-view-manual");
  assert.ok(rule, "找不到画布正文墨色规则本体（选择器不是独占的 main.wb-view-manual）");
  return !(rule.decls ?? []).some((d) => /background/i.test(d.prop));
}

await run("B17 看板列卡 / 图表块卡面＝原型 .s-focus｜.s-chart（L795/L801：1px #ECEEF1 + radius14 + 14×15 内边距 + 白底 + 图区块 mb14）", () => {
  const CARD = "main.wb-view-manual :is(.s-focus"; // 五个宿主写进同一条 :is() 分组 ⇒ 任一片段命中即拿到口径
  assert.equal(decl(CARD, "border-radius"), "14px", "看板列卡/图表块圆角不是原型 14（实测 .board-column 落 --radius-md、canvas 落 0 ⇒ 差异表假差）");
  assert.equal(decl(CARD, "padding"), "14px 15px", "卡面内边距不是原型 14×15（L795/L801）");
  assert.equal(decl(CARD, "background"), "var(--wb-panel, #ffffff)", "卡面底色不是原型 --bg 白底（L795 background:var(--bg)）");
  assert.equal(decl(CARD, "border"), "1px solid var(--wb-line, #eceef1)", "卡面描边不是原型 1px #ECEEF1（实测 .board-column 没有描边）");
  assert.equal(decl(CARD, "box-shadow"), "none", "卡面留着阴影 ⇒ 原型没有阴影");
  // L801 `.s-chart` 比 `.s-focus` 多一条 margin-bottom:14；L795 `.s-focus` 没有 ⇒ 两条必须分开钉
  assert.equal(decl("main.wb-view-manual :is(.s-chart", "margin-bottom"), "14px", "图表块下外边距不是原型 14（L801）");
  // `.chart-box` 单独当图表块时才画卡面；画在卡片里时它＝原型 `.s-cbox`（L802 只有高度和下基线）⇒ :not() 排除嵌套档
  assert.equal(decl("main.wb-view-manual .chart-box", "border-radius"), "14px", "独立图表块没有卡面圆角");
  assert.ok(/:not\(/.test(g.grammarRules(CSS).find((r) => (r.preludeRaw ?? "").includes(".chart-box"))?.preludeRaw ?? ""), "`.chart-box` 没有用 :not() 排除嵌套档 ⇒ 卡片里会再套一层框（条内套条）");
  // `.chart-card` 的头/体各自带内衬 ⇒ 外层 14×15 之外再叠一层，图表块整体比原型高（原型 L2778 只有一个内边距层）
  assert.equal(decl("main.wb-view-manual .chart-card > .chart-card-header", "padding"), "0", "图表卡头仍自带 14×16 内衬 ⇒ 双层内边距");
  assert.equal(decl("main.wb-view-manual .chart-card > .chart-card-body", "padding"), "0", "图表卡体仍自带 12×16 内衬 ⇒ 双层内边距");
  assert.equal(decl("main.wb-view-manual .chart-card > .chart-card-header", "font-size"), "12px", "图表标题不是原型 12.5⇒12（L2778）");
  assert.equal(decl("main.wb-view-manual .chart-card > .chart-card-header", "font-weight"), "800", "图表标题字重不是原型 800（L2778）");
  // 页面包装壳退透明：原型看板把三张列卡直接摆进 .s-g3（L3149），外层再画一圈框＝框归属错层
  assert.equal(decl("main.wb-view-manual .board-card", "background"), "transparent", "看板包装壳还画着卡片底 ⇒ 与列卡双层框");
  assert.equal(decl("main.wb-view-manual .board-card", "border"), "none", "看板包装壳还画着描边 ⇒ 与列卡双层框");
  assert.equal(decl("main.wb-view-manual .board-column > .column-header", "font-weight"), "800", "列卡标题不是原型 .ft 的 800（L796）");
  return "看板列卡/图表块统一到原型那一层，包装壳退透明；:not() 守住「独立块有框、嵌套块无框」";
});

/* ══════ C. 契约与 CSS 的互相覆盖（防止「换个宿主就漏配」） ══════ */await run("C1 契约里的分页/统计/空态/筛选/表格宿主必须都在画布语法段内拿到口径（CSS 与契约不得两张皮）", () => {
  // 只看**语法段内**的选择器（段前的 R100 老皮肤也算「文件里出现过这个类」，用它做覆盖判定会假绿）
  const cssClasses = new Set();
  for (const r of g.grammarRules(CSS)) {
    for (const m of (r.preludeRaw ?? "").matchAll(/\.([A-Za-z0-9_-]+)/g)) cssClasses.add(m[1]);
  }
  // 例外（写在这里而不是删掉别名）：这 4 页（供应商 / 采购付款 / 商品审核 / 库存盘点）把筛选表单
  // 画在卡片**里面**（`PageCard > el-form inline`、`el-card.search-card > el-form inline`），
  // 框与内边距由 §6 的 .el-card 口径提供 ⇒ 再给 `.el-form--inline` 打一遍 §2 的宿主皮肤就是双层 11×13 内边距
  // （与 D1 修的「条内套条」同一类缺陷）。别名保留：没有它会把这 4 页误读成「筛选条缺失」（假红）。
  const READ_ONLY_ALIASES = { filterBar: [".el-form--inline"] };
  const uncovered = [];
  for (const key of ["pagination", "statistics", "statCard", "emptyState", "filterBar", "filterField", "toolbarActions", "tableWrap", "table"]) {
    const region = PAGE_CONTRACT.find((r) => r.key === key);
    assert.ok(region, `契约缺区域 ${key}`);
    for (const raw of [].concat(region.impl ?? [])) {
      if (raw.startsWith("[data-testid")) continue;
      const cls = raw.match(/\.[\w-]+/g)?.[0];
      if (!cls) continue;
      if ((READ_ONLY_ALIASES[key] ?? []).includes(cls)) continue;
      if (!cssClasses.has(cls.slice(1))) uncovered.push(`${key} ⇒ ${raw}`);
    }
  }
  assert.deepEqual(uncovered, [], `契约认了这些宿主但语法段没有对应规则：${uncovered.join(" | ")}`);
  return "契约 impl 选择器与 styles.css 画布规则一一对齐（漏一个宿主＝那批页面量到视图自绘皮肤 ⇒ 假红）";
});

await run("C3 看板 / 图表 / 信息卡区宿主必须成对拿到卡面口径（契约加别名而 CSS 不跟进＝换宿主漏配）", () => {
  const inCss = new Set();
  for (const r of g.grammarRules(CSS)) for (const m of (r.preludeRaw ?? "").matchAll(/\.([A-Za-z0-9_-]+)/g)) inCss.add(m[1]);
  // 只回落、不单独命中的别名：`.chart` 全仓没有视图用它当图表块（实测类名是 chart-container/card/box/body/header），
  // 留它只为兼容将来写法 ⇒ 没有元素命中它，也就不需要 CSS 口径。写在这里而不是删掉别名，删了等于把回落面关掉。
  const FALLBACK_ONLY = new Set(["chart"]);
  const missing = [];
  for (const key of ["chart", "boardCard", "pageCard"]) {
    const region = PAGE_CONTRACT.find((r) => r.key === key);
    for (const raw of [].concat(region.impl ?? [])) {
      if (raw.startsWith("[data-testid")) continue;
      const cls = raw.match(/\.[\w-]+/)?.[0];
      if (!cls || FALLBACK_ONLY.has(cls.slice(1))) continue;
      if (!inCss.has(cls.slice(1))) missing.push(`${key} ⇒ ${raw}`);
    }
  }
  assert.deepEqual(missing, [], `契约宿主在画布语法段里没有卡面口径：${missing.join("、")}`);
  return "chart / boardCard / pageCard 的每一个真实别名都在 §6/§6b 里拿到同一份卡面";
});

await run("C1b :is() 分组不算泄漏：findCanvasLeaks 必须只在括号外切逗号", () => {
  const probe = `/* ${g.GRAMMAR_MARKER} */\n${g.CANVAS_PREFIX} :is(.a, .b) x { color: red }`;
  assert.deepEqual(g.findCanvasLeaks(probe), [], "括号内逗号被当成选择器分隔 ⇒ `:is()` 分组会误报成画布泄漏（假红）");
  const bad = `/* ${g.GRAMMAR_MARKER} */\n${g.CANVAS_PREFIX} .a, .b { color: red }`;
  assert.equal(g.findCanvasLeaks(bad).length, 1, "真泄漏（裸 `.b`）没被抓到 ⇒ A3 失去意义");
  return "分组语法与泄漏守卫同时成立";
});

await run("C2 契约容差与 fail-closed 红线：长度 ±1、颜色 0、缺失即判红，且 13B 不另立标准", async () => {
  const f2a = await import("./f2a-visual-baseline-lib.mjs");
  assert.deepEqual({ length: f2a.TOLERANCE.length, radius: f2a.TOLERANCE.radius, color: f2a.TOLERANCE.color }, { length: 1, radius: 1, color: 0 }, "容差被放宽 ⇒ 违反卡 §三.A.6「偏差 ≤±1px，颜色逐字节相同」");
  assert.equal(f2a.MISSING_IS_FATAL, true, "MISSING_IS_FATAL 被关掉 ⇒ 缺部位不再判红（违反 §三.B fail-closed）");
  const page = await import("./wb13b-page-contract-lib.mjs");
  assert.equal(page.TOLERANCE, undefined, "13B 自建了容差对象 ⇒ 必须复用 f2a 的同一份，否则两张皮");
  assert.equal(page.MISSING_IS_FATAL, undefined, "13B 自建了判红开关 ⇒ 必须复用 f2a 的 MISSING_IS_FATAL");
  const src = readFileSync(path.join(WEB, "tests/wb13b-page-contract-lib.mjs"), "utf8");
  assert.match(src, /from "\.\/f2a-visual-baseline-lib\.mjs"/, "13B 契约库没有 import f2a 口径");
  for (const sym of ["TOLERANCE", "MISSING_IS_FATAL", "normalizeMetric", "numericOf", "isLengthMetric"]) {
    assert.ok(new RegExp(`^\\s*${sym},?`, "m").test(src), `13B 契约库没有从 f2a 复用 ${sym}`);
  }
  return "归一/容差/判红全部 import 自 f2a 库，13B 侧零自立标准";
});

/* ══════ D. 视图标记与画布口径的配套（改一处必须同步另一处） ══════ */

const VIEW_FILES = {
  "views/marketing/MarketingView.vue": readFileSync(path.join(WEB, "src/views/marketing/MarketingView.vue"), "utf8"),
  "views/marketing/CouponManage.vue": readFileSync(path.join(WEB, "src/views/marketing/CouponManage.vue"), "utf8"),
  "views/marketing/FlashSale.vue": readFileSync(path.join(WEB, "src/views/marketing/FlashSale.vue"), "utf8"),
  "views/marketing/FullReduction.vue": readFileSync(path.join(WEB, "src/views/marketing/FullReduction.vue"), "utf8"),
  "views/instant-retail/InstantRetailOrderBoard.vue": readFileSync(path.join(WEB, "src/views/instant-retail/InstantRetailOrderBoard.vue"), "utf8"),
  "views/instant-retail/InstantRetailShelf.vue": readFileSync(path.join(WEB, "src/views/instant-retail/InstantRetailShelf.vue"), "utf8"),
};

/** 全仓 .vue（views + components + modules）：D1 的扫描面必须是**全部**，只扫改过的 6 个文件等于没守 | */
function listVueFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) listVueFiles(fp, out);
    else if (e.name.endsWith(".vue")) out.push(fp);
  }
  return out;
}
const VUE_FILES = ["views", "components", "modules"]
  .flatMap((d) => listVueFiles(path.join(WEB, "src", d)))
  .map((f) => [f, readFileSync(f, "utf8")]);

/**
 * 「条内套条」结构扫描（纯文本，按标签深度追祖先链）：
 * 原型 L2761 的 `.s-filter` 只有一层 flex；实现侧写成条里再套一条 ⇒ 同一条上叠两层 11×13 内边距 +
 * 两层 1px 描边（实测 filterBar.height 101⇒136，条目被推进第二层）。
 * 弹窗/抽屉（el-dialog / el-drawer）里的条**不算**：EP 把浮层 teleport 到 body，不在 `main.wb-view-manual`
 * 画布内 ⇒ 采集器读不到，画布口径也不该打进去（卡 §二：不得把工作台口径漏给别的层）。
 * 逐元素产出 { line, isBar, inFloat, nestedBar }，D1 与 D1b 共用同一份遍历（两套口径必须同源，
 * 否则「扫描器说没有嵌套、计数器说有两条」这种自相矛盾就是测试自己的洞）。
 */
function walkFilterBars(text) {
  const tpl = text.slice(0, text.indexOf("<script") > -1 ? text.indexOf("<script") : text.length);
  const out = [];
  const stack = [];
  for (const m of tpl.matchAll(/<(\/?)(div|el-dialog|el-drawer|template|el-card|el-tab-pane)\b([^>]*)>/g)) {
    const [full, close, tag, attrs] = m;
    if (full.endsWith("/>")) continue;
    if (close) {
      for (let i = stack.length - 1; i >= 0; i -= 1) if (stack[i].tag === tag) { stack.splice(i); break; }
      continue;
    }
    const cls = ((attrs.match(/class="([^"]*)"/) ?? [, ""])[1] ?? "").split(/[\s'"]+/);
    const isBar = cls.includes("filter-bar") || cls.includes("filter-card");
    const inFloat = stack.some((s) => s.tag === "el-dialog" || s.tag === "el-drawer");
    if (isBar) out.push({ line: tpl.slice(0, m.index).split("\n").length, inFloat, nestedBar: stack.some((s) => s.isBar) });
    stack.push({ tag, isBar });
  }
  return out;
}

function findNestedFilterBars(files) {
  const out = [];
  for (const [file, text] of files) {
    for (const b of walkFilterBars(text)) {
      if (b.nestedBar && !b.inFloat) out.push({ file: path.relative(WEB, file).replace(/\\/g, "/"), line: b.line });
    }
  }
  return out;
}

await run("D1 全仓零「条内套条」：任何 .filter-bar / .filter-card 元素都不得嵌在另一条之内（弹窗内的除外）", () => {
  const nested = findNestedFilterBars(VUE_FILES);
  assert.deepEqual(nested, [], `仍有视图把筛选条套在筛选条里（同一条上叠两层 11×13 内边距 + 两层描边，实测 filterBar.height 101⇒136）：${JSON.stringify(nested)}`);
  return `${VUE_FILES.length} 个 .vue 逐层扫描：内层已统一改名 .filter-bar-items / .toolbar-right，画布 display:contents 复原单层行`;
});

await run("D1b 六视图各有一条**页级**筛选条且内层用 .filter-bar-items：只改 CSS 不改标记（或反之）都算半修", () => {
  const bad = [];
  for (const [file, text] of Object.entries(VIEW_FILES)) {
    const pageBars = walkFilterBars(VIEW_FILES[file]).filter((b) => !b.inFloat).length;
    if (pageBars !== 1) bad.push(`${file} ⇒ 页级筛选条 ${pageBars} 条（应为 1；弹窗/抽屉内的条不计，它不在画布内）`);
    if (!text.includes("filter-bar-items")) bad.push(`${file} ⇒ 没有 .filter-bar-items（内层未收口）`);
  }
  assert.deepEqual(bad, [], bad.join(" | "));
  return "六个视图（营销 4 + 即时零售 2）逐文件核对通过";
});

await run("D2 内层改名后画布仍有口径：.filter-bar-items 的 display:contents 与 .toolbar-right 的贴右成对存在", () => {
  assert.equal(decl(`${FB} .filter-bar-items`, "display"), "contents");
  assert.equal(decl(`${FB} .toolbar-right`, "margin-left"), "auto !important");
  const renamed = Object.entries(VIEW_FILES).filter(([, t]) => t.includes("filter-bar-items")).length;
  assert.ok(renamed >= 6, `.filter-bar-items 只出现在 ${renamed} 个视图 ⇒ 其余视图的内层条仍在叠皮肤`);
  return "CSS 与视图标记同进同退：只改一边必红（本单实测过「改名了但画布没口径」的半修）";
});

await run("D3 查询按钮必须是主按钮（原型 L2762 .btn2.pri = 蓝底白字），且宿主类名不泄漏到旧控制台口径", () => {
  const mk = VIEW_FILES["views/marketing/MarketingView.vue"];
  assert.match(mk, /<el-button[^>]*type="primary"[^>]*>\s*搜索/, "营销页查询按钮未标 primary ⇒ 画布内它不是蓝底（与原型 .btn2.pri 不符）");
  const leaks = [...Object.values(VIEW_FILES)].filter((t) => /class="[^"]*\bfilter-bar\b[^"]*\bfilter-bar\b/.test(t));
  assert.deepEqual(leaks, [], "视图里同一行同时写了两个 filter-bar 类 ⇒ 画布口径会重复叠加");
  return "标记层与语法层的命名一一对应，无残留";
});

/**
 * 「去注释后代码变短」守卫：F3 的 uiux-complete.spec 用一条正则粗暴去注释
 * （先 `/\*[\s\S]*?\*\//` 删块注释，再删 `//` 行注释）。当行注释里写了 glob（如 `views/**`），
 * 那个斜杠星号会被当成**块注释开头**，从该处一路吞到下一个星号斜杠 ⇒ 中间的代码在「注释文本」里消失。
 * 本轮 13B 就在 WorkbenchShell 的路由清单注释上踩过：C3 读到被截断的清单 ⇒ 判「清单应含 /purchase-orders」
 * 假红，而 vue-tsc / eslint / build 全绿（真实解析器认这是行注释）⇒ 只有跑 F3 链才暴露。
 * 判据用**自比较**而非硬编码清单：同一份源码，去注释前后提取到的 BUSINESS_ROUTE_PATHS 必须逐字节相等；
 * 再加一条正控制（合成坏样本必须被检出），否则这条用例本身可能是惰性的。
 */
await run("D4 行注释里不许出现 /* 序列：去注释前后同一份代码必须等价（F3 C3 假红的机器守卫）", () => {
  const stripComments = (t) =>
    t
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
      .replace(/<!--[\s\S]*?-->/g, "");
  const grabList = (text) => text.match(/BUSINESS_ROUTE_PATHS[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? "";
  const norm = (s) => (s.match(/"[^"]+"/g) ?? []).join(",");
  const raw = SHELL.replace(/\r\n/g, "\n");
  const before = norm(grabList(raw));
  const after = norm(grabList(stripComments(raw)));
  /* 正控制：这条用例不能惰性 ⇒ 同样写法的合成样本必须被同一判据抓到 */
  const poisoned = raw.replace(
    '"/finance/report",',
    '"/finance/report",\n  // 合成样本 views/** 会提前闭合注释\n  "/__poison_probe__",',
  );
  const poisonCaught =
    norm(grabList(poisoned)) !== norm(grabList(stripComments(poisoned))) &&
    !norm(grabList(stripComments(poisoned))).includes("/__poison_probe__");
  assert.ok(poisonCaught, "正控制失效：判据抓不到合成的「行注释含 /* ⇒ 后续代码被吞」⇒ 这条用例本身是惰性的");
  assert.equal(
    after,
    before,
    `去注释后路由清单变短（${before.split(",").length} ⇒ ${after.split(",").length} 条）⇒ 有 /* 序列落在行注释里，` +
      "F3 uiux-complete C3 会读到截断清单并假红；把注释里的 glob 改成文字表述",
  );
  const hits = [];
  for (const [file, text] of [["layouts/WorkbenchShell.vue", raw], ["styles.css", CSS], ...VUE_FILES]) {
    text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .forEach((line, i) => {
        const at = line.indexOf("//");
        if (at >= 0 && line.slice(at + 2).includes("/*")) hits.push(`${file}:${i + 1}`);
      });
  }
  assert.deepEqual(hits, [], `行注释内含 /* 的文件行：${hits.join(", ")} ⇒ 朴素去注释会把后面的代码当块注释吞掉`);
  return `清单 ${before.split(",").length} 条去注释前后逐字节等价 · 正控制可检出 · ${VUE_FILES.length + 2} 个文件 0 处 /* 落进行注释`;
});

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n小结：${passed} passed / ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
