/**
 * WORKBENCH-13B · 页面契约判定器用例（D 组第二张，卡 §三.A.4/6、§三.B、§六）
 *
 * 纯 node、不启服务、不碰 DOM ⇒ clean 检出即可复现（与 wb13b-visual-grammar.spec.mjs 同一自包含口径）。
 * 语法契约那张守的是「源码里写的口径」，这一张守的是「读数进来后怎么判」：
 *   buildPageDiffTable 的六种判定、容差、缺失即判红、结构性豁免、书面解释、
 *   纵向节奏、字体层级、状态签名、覆盖缺口、帧复用，以及采集包的五条 fail-closed。
 * 为什么必须单独成张（本单踩过的坑）：
 *   · `expect:"either` 的注释写「缺一不判红」，实现里却仍按 both 判 missing ⇒ 一轮真机采集凭空 30 条假红。
 *     这类「口径与实现两张皮」只有把语义钉成用例才不会复发（P5）。
 *   · 契约写了采集器根本不产出的指标 ⇒ 该行恒缺、恒不判红也恒不报，属于静默失效（P31 逐键对账）。
 *   · fail-closed 的判据（整屏读数、出帧门不过、注入态、同帧复用）必须各自被一条用例打到，
 *     否则删掉一条门禁分支没人发现（卡 §三.B）。
 *
 * 运行（admin-web 目录）：node tests/wb13b-page-contract.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as L from "./wb13b-page-contract-lib.mjs";
import { TOLERANCE, MISSING_IS_FATAL, normalizeMetric } from "./f2a-visual-baseline-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
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

/**
 * 造一条区域读数：默认「在场、可见、有尺寸」，指标由参数覆盖。
 * 指标名与采集器 `PAGE_REGION_READER` 的产出面保持一致（P31 逐键对账担保这一点）。
 */
const REG_METRICS = {
  x: 344, y: 120, width: 992, height: 44, right: 1336, bottom: 164,
  display: "flex", visibility: "visible", opacity: "1",
  backgroundColor: "rgb(249, 250, 251)", backgroundColorSource: "self", color: "rgb(22, 24, 29)",
  padding: "11px 13px", gap: "9px", margin: "0px 0px 13px", marginBottom: "13px",
  borderRadius: "14px", borderStyle: "solid", borderTopWidth: "1px", borderTopColor: "rgb(236, 238, 241)",
  borderBottomWidth: "1px", borderBottomColor: "rgb(236, 238, 241)", boxShadow: "none",
  fontSize: "12px", fontWeight: "400", lineHeight: "normal", gridColumns: "none",
  flexWrap: "wrap", flexDirection: "row", borderCollapse: "separate",
  tallestChildHeight: 30, tallestChild: "div.el-input=30", itemCount: 3, text: "样例",
};
const reg = (metrics = {}, over = {}) => ({
  exists: true,
  visible: true,
  selector: ".fixture",
  itemCount: metrics.itemCount ?? REG_METRICS.itemCount,
  metrics: { ...REG_METRICS, ...metrics },
  ...over,
});
/** 两侧同读数（默认全绿），只把 params 里点名的区域改成实现侧读数 */
function pair(protoOverrides = {}, implOverrides = {}) {
  const keys = L.PAGE_CONTRACT.map((r) => r.key);
  const proto = Object.fromEntries(keys.map((k) => [k, protoOverrides[k] ?? reg()]));
  const impl = Object.fromEntries(keys.map((k) => [k, implOverrides[k] ?? reg()]));
  return { proto, impl };
}
const rowOf = (rows, region, metric) => {
  const hit = rows.find((r) => r.region === region && r.metric === metric);
  assert.ok(hit, `差异表缺行 ${region}.${metric}`);
  return hit;
};

/* ══════ A. buildPageDiffTable 的六种判定 ══════ */

await run("P1 两侧逐字节相同 ⇒ 门禁行全 match、零判红", () => {
  const { proto, impl } = pair();
  const rows = L.buildPageDiffTable(proto, impl, {});
  assert.deepEqual(L.findPageOffSpec(rows), [], "同读数却判红 ⇒ 判定器自己坏了");
  const gated = rows.filter((r) => r.gated);
  assert.ok(gated.length > 20, `门禁行数 ${gated.length} 过少 ⇒ 契约或读数面被削`);
  assert.ok(gated.every((r) => r.verdict === "match"), "同读数却出现非 match 的门禁行");
  return `${rows.length} 行 / ${gated.length} 门禁行全 match`;
});

await run("P2 长度容差 ±1：+1 判 match，+2 判 off-spec（卡 §三.A.6 偏差 ≤±1px）", () => {
  const { proto, impl } = pair();
  const ok = L.buildPageDiffTable(proto, impl, {});
  assert.equal(rowOf(ok, "filterBar", "height").verdict, "match");
  assert.equal(rowOf(ok, "filterBar", "height").delta, 0);
  const bad = L.buildPageDiffTable(proto, { ...impl, filterBar: reg({ height: REG_METRICS.height + 2 }) }, {});
  const row = rowOf(bad, "filterBar", "height");
  assert.equal(row.verdict, "off-spec", "+2px 仍不判红 ⇒ 容差被放宽");
  assert.equal(row.delta, 2);
  assert.equal(row.tolerance, TOLERANCE.length);
  assert.ok(L.findPageOffSpec(bad).some((r) => r.region === "filterBar"), "判红行没进 offSpec 清单");
  return "1px 内放行 · 2px 判红 · 容差对象 import 自 f2a（未自立标准）";
});

await run("P3 颜色容差 0：RGB 任何一位不同即判红（卡 §三.A.6 颜色逐字节相同）", () => {
  const { proto, impl } = pair();
  const rows = L.buildPageDiffTable(proto, { ...impl, filterBar: reg({ backgroundColor: "rgb(249, 250, 252)" }) }, {});
  const row = rowOf(rows, "filterBar", "backgroundColor");
  assert.equal(row.verdict, "off-spec", "色差一档仍放行 ⇒ 颜色容差被放宽");
  assert.equal(row.tolerance, TOLERANCE.color);
  assert.equal(TOLERANCE.color, 0);
  return "250,251→250,252 判红（TOLERANCE.color=0）";
});

await run("P4 expect=both 且实现侧缺席 ⇒ missing 判红（MISSING_IS_FATAL 不被绕过）", () => {
  assert.equal(MISSING_IS_FATAL, true, "MISSING_IS_FATAL 被关闭 ⇒ 缺部位不再判红");
  const { proto, impl } = pair();
  const rows = L.buildPageDiffTable(proto, { ...impl, pageRoot: { exists: false, metrics: {} } }, {});
  const row = rowOf(rows, "pageRoot", "presence");
  assert.equal(row.verdict, "missing");
  assert.equal(row.gated, true, "判红行却不被门禁 ⇒ fail-closed 失效");
  assert.ok(L.findPageOffSpec(rows).some((r) => r.region === "pageRoot" && r.metric === "presence"));
  return "expect=both 缺席 ⇒ missing 且计入 offSpec";
});

await run("P5 expect=either 一侧缺席 ⇒ exempted 且不判红（口径与实现两张皮的历史 bug 守卫）", () => {
  const { proto, impl } = pair();
  for (const key of L.PAGE_CONTRACT.filter((r) => r.expect === "either").map((r) => r.key)) {
    const oneSided = L.buildPageDiffTable(proto, { ...impl, [key]: { exists: false, metrics: {} } }, {});
    const row = rowOf(oneSided, key, "presence");
    assert.equal(row.verdict, "exempted", `${key}（expect=either）一侧缺席被判 ${row.verdict} ⇒ 违反契约「缺一不判红」`);
    assert.equal(row.gated, false, `${key} 豁免行仍标 gated ⇒ 会被下游当门禁行统计`);
    assert.ok(L.findPageExempted(oneSided).some((r) => r.region === key), `${key} 豁免行没留在表里`);
    assert.equal(L.findPageOffSpec(oneSided).find((r) => r.region === key && r.metric === "presence"), undefined);
  }
  return `${L.PAGE_CONTRACT.filter((r) => r.expect === "either").length} 条 either 区域逐条复核：缺一不判红`;
});

await run("P6 proto-only / impl-only ⇒ 另一侧缺席是 exempted（设计口径差，不是页面差）", () => {
  const { proto, impl } = pair();
  const noDock = L.buildPageDiffTable(proto, { ...impl, dockInfo: { exists: false, metrics: {} } }, {});
  assert.equal(rowOf(noDock, "dockInfo", "presence").verdict, "exempted", "原型独有对接条缺席被误判为页面差");
  // inPageHeader 是 impl-only：原型侧本就没有（原型 L1752「顶栏唯一标题，页内不再重复渲染」）
  const noHeader = L.buildPageDiffTable({ ...proto, inPageHeader: { exists: false, metrics: {} } }, { ...impl, inPageHeader: { exists: false, metrics: {} } }, {});
  assert.equal(rowOf(noHeader, "inPageHeader", "presence").verdict, "n/a", "impl-only 且两侧同无应记 n/a");
  const extraDock = L.buildPageDiffTable({ ...proto, dockInfo: { exists: false, metrics: {} } }, impl, {});
  assert.ok(L.findPageOffSpec(extraDock).some((r) => r.region === "dockInfo" && r.metric === "presence"), "实现侧多出 proto-only 部位却放行 ⇒ 会漏报（原型没有，实现不该画）");
  return "proto-only/impl-only 三向都判对（缺席豁免 · 同无记 n/a · 多出判红）";
});

await run("P7 两侧都缺 ⇒ n/a（该版式本就不含此部位，如表单页没有表格）", () => {
  const { proto, impl } = pair();
  const gone = {};
  for (const key of ["statistics", "filterBar", "tableWrap", "table", "tableHeadCell", "tableCell", "pagination"]) {
    const both = L.buildPageDiffTable({ ...proto, [key]: { exists: false, metrics: {} } }, { ...impl, [key]: { exists: false, metrics: {} } }, {});
    assert.equal(rowOf(both, key, "presence").verdict, "n/a", `${key} 两侧同无却判 ${rowOf(both, key, "presence").verdict}`);
    gone[key] = { exists: false, metrics: {} };
  }
  assert.equal(L.findPageOffSpec(L.buildPageDiffTable({ ...proto, ...gone }, { ...impl, ...gone }, {})).length, 0, "整版式同无的区域不应判红");
  return "7 个列表区两侧同无 ⇒ 全 n/a、零判红";
});

await run("P8 书面解释：超容差 + notes ⇒ explained，且解释文本随行带回", () => {
  const { proto, impl } = pair();
  const rows = L.buildPageDiffTable(proto, { ...impl, pagination: reg({ height: 40 }) }, { "pagination.height": "共享组件带 sizes 下拉，实测 40 由 30px 子盒顶起" });
  const row = rowOf(rows, "pagination", "height");
  assert.equal(row.verdict, "explained");
  assert.equal(row.gated, true);
  assert.ok(row.note.includes("sizes"), "解释没进差异表 ⇒ 人读表时无从复核");
  assert.equal(L.findPageOffSpec(rows).find((r) => r.region === "pagination" && r.metric === "height"), undefined);
  assert.equal(L.findPageExplained(rows)[0].region, "pagination");
  return "超容差有解释 ⇒ explained（不隐身、不冒充 match）";
});

await run("P9 非门禁指标 ⇒ recorded（不参与判红，但读数必须留档）", () => {
  const { proto, impl } = pair();
  const rows = L.buildPageDiffTable(proto, { ...impl, filterBar: reg({ display: "grid" }) }, {});
  const row = rowOf(rows, "filterBar", "display");
  assert.equal(row.verdict, "recorded", "非门禁指标却进门禁判定");
  assert.equal(row.gated, false);
  assert.equal(row.tolerance, null);
  assert.equal(row.impl, "grid", "recorded 行丢失读数 ⇒ 复核者看不到");
  return "契约 gate 之外的读数只记不判（TOLERANCE.display 只约束门禁面）";
});

await run("P10 pageGatedStats：门禁计数 / 逐字节一致数 / 最大偏差都可复算", () => {
  const { proto, impl } = pair();
  const rows = L.buildPageDiffTable(proto, { ...impl, filterBar: reg({ height: 46, backgroundColor: "rgb(0, 0, 0)" }) }, {});
  const s = L.pageGatedStats(rows);
  assert.ok(s.gated > 20, `门禁数 ${s.gated} 过少`);
  assert.equal(s.offSpec, 2, `判红 ${s.offSpec} ≠ 实设 2 处`);
  assert.equal(s.maxAbsDelta, 2);
  assert.equal(s.withinTolerance, s.gated - s.offSpec, "容差内 + 已解释 + 判红应穷尽门禁行");
  assert.ok(s.exact <= s.gated);
  return `gated=${s.gated} exact=${s.exact} offSpec=${s.offSpec} maxΔ=${s.maxAbsDelta}`;
});

/* ══════ B. 区域清单与采集器产出面的对账（静默失效守卫） ══════ */

await run("P11 契约本身成立：key 唯一、每条都挂卡面条款、gate 指标非空", () => {
  const seen = new Set();
  for (const r of L.PAGE_CONTRACT) {
    assert.ok(r.key && r.label && r.card, `区域 ${r.key} 缺 key/label/card`);
    assert.ok(!seen.has(r.key), `重复 key ${r.key} ⇒ 后者会静默覆盖前者的读数`);
    seen.add(r.key);
    assert.match(r.card, /^§三\.[A-D]/, `${r.key}.card=${r.card} 未指向卡面条目`);
    assert.ok(Array.isArray(r.gate) && r.gate.length > 0, `${r.key} 无门禁指标 ⇒ 整区只记不判`);
    assert.ok(["both", "proto-only", "impl-only", "either"].includes(r.expect ?? "both"), `${r.key}.expect=${r.expect} 不在四种语义内`);
  }
  return `${L.PAGE_CONTRACT.length} 个区域全部带卡面出处与非空 gate`;
});

await run("P31 每条 gate 指标采集器都真的产出（写了不产出的指标＝恒缺恒不判的静默失效）", () => {
  const src = readFileSync(path.join(here, "wb13b-module-parity.mjs"), "utf8");
  const m = /metrics:\s*\{([\s\S]*?)\n\s*\},\n\s*\};/.exec(src);
  assert.ok(m, "找不到 PAGE_REGION_READER 的 metrics 产出块 ⇒ 对账无从进行");
  const produced = new Set([...m[1].matchAll(/^\s*([A-Za-z][\w]*)\s*:/gm)].map((x) => x[1]));
  assert.ok(produced.size >= 25, `产出指标仅 ${produced.size} 项 ⇒ 采集器读数面被削，对账失去意义`);
  const missing = [];
  for (const r of L.PAGE_CONTRACT) for (const g of r.gate) if (!produced.has(g)) missing.push(`${r.key}.${g}`);
  assert.deepEqual(missing, [], `契约门里写了采集器不产出的指标（永远不会有读数）：${missing.join(" | ")}`);
  return `${L.PAGE_CONTRACT.reduce((n, r) => n + r.gate.length, 0)} 个门禁指标 ⊆ 采集器产出的 ${produced.size} 项`;
});

await run("P12 版式分面：contractFor 按 types 收窄，表单页不带表格区、列表页不带表单区", () => {
  const form = L.contractFor("form").map((r) => r.key);
  assert.ok(form.includes("pageCard") && form.includes("formActions"), `form 版式缺信息卡/动作条：${form.join(">")}`);
  assert.ok(!form.includes("pagination"), "form 版式仍带分页 ⇒ 节奏表会把不存在的区域算进应有序列");
  const list = L.contractFor("list").map((r) => r.key);
  assert.ok(list.includes("tableWrap") && list.includes("pagination"), `list 版式缺表格/分页：${list.join(">")}`);
  assert.ok(!list.includes("formField"), "list 版式仍带表单字段");
  assert.ok(L.contractFor("pos").length <= L.PAGE_CONTRACT.length, "pos 版式未收窄");
  return `form ${form.length} 区 · list ${list.length} 区（全量 ${L.PAGE_CONTRACT.length} 区）`;
});

await run("P13 regionApplies 的三种判据：types 命中 / 无 types 全版式适用 / 未知版式不误收", () => {
  assert.equal(L.regionApplies({ types: ["form"] }, "form"), true);
  assert.equal(L.regionApplies({ types: ["form"] }, "list"), false);
  assert.equal(L.regionApplies({}, "board"), true, "未标 types 的区域应全版式适用");
  assert.equal(L.regionApplies({ types: ["form"] }, "unknown-layout"), false);
  return "types 缺失＝全版式通用；types 命中才收";
});

/* ══════ C. 节奏 · 字体 · 签名 ══════ */

await run("P14 纵向节奏：y 升序与版式应然序列一致 ⇒ 零违规", () => {
  const proto = L.contractFor("list");
  const readings = {};
  proto.forEach((r, i) => { readings[r.key] = reg({ y: 100 + i * 60 }); });
  assert.deepEqual(L.findPageRhythmViolations(readings, "list"), []);
  return (L.PAGE_RHYTHM_BY_TYPE.list ?? []).join(" > ");
});

await run("P15 纵向节奏：分页条画在表格之前 ⇒ 报出 expected/actual 可读的一条", () => {
  const readings = {};
  L.contractFor("list").forEach((r) => { readings[r.key] = reg({ y: 100 }); });
  readings.pagination = reg({ y: 50 });
  readings.filterBar = reg({ y: 60 });
  readings.tableWrap = reg({ y: 300 });
  readings.statistics = reg({ y: 200 });
  const v = L.findPageRhythmViolations(readings, "list");
  assert.equal(v.length, 1, "顺序错乱却未报节奏违规");
  assert.ok(v[0].expected.includes("filterBar") && v[0].actual.indexOf("pagination") < v[0].actual.indexOf("filterBar"));
  return `actual=${v[0].actual}`;
});

await run("P16 纵向节奏只比两侧共有的区域（原型独有对接条缺席不该假红）", () => {
  const readings = {};
  L.contractFor("list").forEach((r, i) => { if (r.key !== "dockInfo") readings[r.key] = reg({ y: 100 + i * 60 }); });
  readings.dockInfo = { exists: false, metrics: {} };
  assert.deepEqual(L.findPageRhythmViolations(readings, "list"), [], "一侧没有的区域被拉进节奏序列 ⇒ 数量不等的假节奏差");
  return "dockInfo 缺席时按共有区域重建子序列";
});

await run("P46 纵向节奏只数流程里的兄弟块：包住筛选条的包装卡不算错序（真错序照抓）", () => {
  // 实测（采购/供应商管理 1440×1000 实现侧）：筛选表单装进 el-card ⇒ 卡片 top(133) 天然在条 top(150) 之上。
  // 那是**宿主层**的位置，不等于「把信息卡画在了筛选条前面」⇒ 纵向包住别块的层退出节奏序列。
  const host = {
    filterBar: reg({ y: 150, height: 52 }),
    tableWrap: reg({ y: 310, height: 81 }),
    pagination: reg({ y: 391, height: 36 }),
    pageCard: reg({ y: 133, height: 86 }),
  };
  assert.deepEqual(L.findPageRhythmViolations(host, "fuse"), [], "包装卡被当成流程块 ⇒ 结构层差误报成节奏差");
  // 反面对照：卡片不包住任何块、又排在筛选条之前 ⇒ 位置真错，剔除规则不许把它吞掉
  const misplaced = { ...host, pageCard: reg({ y: 60, height: 40 }) };
  const v = L.findPageRhythmViolations(misplaced, "fuse");
  assert.equal(v.length, 1, "真正的错序没有报出 ⇒ 剔除规则写宽了");
  assert.ok(v[0].actual.startsWith("pageCard"), `错序卡片应排在序列头部，实报 ${v[0].actual}`);
  return "包住他块的层退出节奏；不包任何块且位置错 ⇒ 照旧判红";
});

await run("P17 字体层级：字号/字重/颜色逐字节比，差一档就出门禁项", () => {
  const v = L.findFontHierarchyViolations({ pageTitle: { exists: true, fontSize: "15px", fontWeight: "800", color: "rgb(22, 24, 29)" } }, { pageTitle: { exists: true, fontSize: "16px", fontWeight: "600", color: "rgb(22, 24, 29)" } });
  assert.equal(v.length, 2, `应报 fontSize+fontWeight 两处，实报 ${v.length}`);
  assert.deepEqual(v.map((x) => x.metric).sort(), ["fontSize", "fontWeight"]);
  assert.deepEqual(L.findFontHierarchyViolations({ pageTitle: { exists: true, fontSize: "15px" } }, { pageTitle: { exists: true, fontSize: "15px" } }), []);
  assert.deepEqual(L.findFontHierarchyViolations({ tableHead: { exists: true, fontSize: "11px" } }, { tableHead: { exists: false } }), [], "一侧读不到该角色时应跳过（缺失由差异表判，不在字体面重复判红）");
  return "逐字节（无容差）· 一侧不存在则跳过不判";
});

await run("P18 字体角色清单与契约同层：每个角色都必须有两侧选择器", () => {
  assert.ok(L.FONT_ROLES.length >= 6, `字体角色仅 ${L.FONT_ROLES.length} 项`);
  for (const f of L.FONT_ROLES) {
    assert.ok(f.proto && f.impl, `${f.role} 缺 proto/impl 选择器`);
    assert.ok(["shell", "page"].includes(f.scope ?? "page"), `${f.role}.scope=${f.scope} 非法`);
  }
  assert.ok(L.FONT_ROLES.some((f) => f.role === "statValue"), "统计值字号层级未进角色表 ⇒ 11.5⇒11 归一无人守");
  return `${L.FONT_ROLES.length} 个角色，顶栏/统计/表头/表体/分页全覆盖`;
});

await run("P19 状态签名：同视口同页同读数 ⇒ 同串（可复算、进 figcaption）", () => {
  const readings = {};
  L.contractFor("list").forEach((r) => { readings[r.key] = reg(); });
  const base = { viewport: "1440x1000", moduleKey: "sale", pageKey: "sl-overview", panelType: "list", overlays: 0 };
  assert.equal(L.pageStateSignature(readings, base), L.pageStateSignature(readings, { ...base }));
  assert.notEqual(L.pageStateSignature(readings, base), L.pageStateSignature(readings, { ...base, viewport: "1024x768" }));
  assert.notEqual(L.pageStateSignature(readings, base), L.pageStateSignature(readings, { ...base, overlays: 1 }), "活跃浮层数不进签名 ⇒ 弹层态能冒充静默态");
  assert.notEqual(L.pageStateSignature(readings, { ...base, pageKey: "sl-orders" }), L.pageStateSignature(readings, base));
  return `签名形如 ${L.pageStateSignature(readings, base).slice(0, 46)}…`;
});

await run("P20 状态签名的位向量只收「两侧应同有同无」的主结构区", () => {
  const readings = {};
  L.contractFor("list").forEach((r) => { readings[r.key] = reg(); });
  const s = L.pageStateSignature(readings, { viewport: "1440x1000", moduleKey: "sale", pageKey: "sl-1", panelType: "list", overlays: 0 });
  const bits = s.split("|").filter((x) => x.includes(":"));
  for (const key of ["pageRoot", "tableWrap", "pagination"]) assert.ok(bits.some((b) => b.startsWith(`${key}:1`)), `位向量缺 ${key}`);
  for (const key of ["dockInfo", "inPageHeader"]) assert.ok(!s.includes(`${key}:`), `${key} 属结构豁免，进签名会页页假红`);
  readings.pagination = { exists: true, visible: false, metrics: {} };
  assert.ok(L.pageStateSignature(readings, { viewport: "1440x1000", moduleKey: "sale", pageKey: "sl-1", panelType: "list", overlays: 0 }).includes("pagination:0"), "在场但不可见没反映进签名");
  return `位向量 ${bits.length} 位 · 结构豁免区不入签名`;
});

await run("P20b 两层签名：相等性只由 expect=both 的「同有同无面」判定，either 位的有无差只入证据", () => {
  const meta = { viewport: "1440x1000", moduleKey: "finance", pageKey: "fin-pay", panelType: "fuse", overlays: 0 };
  const proto = {};
  const impl = {};
  L.contractFor("fuse").forEach((r) => { proto[r.key] = reg(); impl[r.key] = reg(); });
  impl.statistics = { exists: false, metrics: {} };
  impl.pageCard = { exists: false, metrics: {} };
  assert.notEqual(L.pageStateSignature(proto, meta), L.pageStateSignature(impl, meta), "完整位向量应记录 either 层的有无差（逐侧入证据）");
  assert.equal(L.pageStateSignature(proto, meta, L.PAGE_CONTRACT, { sharedOnly: true }), L.pageStateSignature(impl, meta, L.PAGE_CONTRACT, { sharedOnly: true }), "版式相关部位之差打破了「同一页同一状态」的相等性判据 ⇒ 每页都假判状态不符（calib 实测）");
  impl.pageRoot = { exists: false, metrics: {} };
  assert.notEqual(L.pageStateSignature(proto, meta, L.PAGE_CONTRACT, { sharedOnly: true }), L.pageStateSignature(impl, meta, L.PAGE_CONTRACT, { sharedOnly: true }), "页根本身缺席必须打破 shared 签名");
  assert.ok(!L.pageStateSignature(proto, meta, L.PAGE_CONTRACT, { sharedOnly: true }).includes("dockInfo"), "proto-only 的对接条不得进相等性判据（每页必差）");
  return "shared = both 面（pageRoot/pageTitle/…）· full = 含 either 面（只入证据）";
});

/* ══════ D. 覆盖与帧完整性 ══════ */

const MODS = [{ key: "sale", name: "销售" }, { key: "report", name: "报表" }];
const VPS = L.PAGE_VIEWPORTS;

await run("P21 覆盖缺口：每模块每档至少 1 页（卡 §三.A.3）", () => {
  const pairs = [{ moduleKey: "sale", viewport: VPS[0].id, status: "captured" }];
  const gaps = L.findCoverageGaps(pairs, { modules: MODS, viewports: VPS });
  assert.ok(gaps.length >= 3, `缺口数 ${gaps.length} 过少 ⇒ 覆盖门未穷举模块×视口`);
  assert.ok(gaps.every((g) => g.captured === 0 && g.need === 1));
  const full = [...VPS].flatMap((vp) => MODS.flatMap((m) => [{ moduleKey: m.key, viewport: vp.id, status: "captured" }]));
  assert.deepEqual(L.findCoverageGaps(full, { modules: MODS, viewports: VPS }), []);
  return `模块×视口 ${MODS.length}×${VPS.length} 全穷举（缺 ${gaps.length} 格）`;
});

await run("P22 覆盖只算 captured：blocked 页不得充数（诚实阻断≠已覆盖）", () => {
  const pairs = [{ moduleKey: "sale", viewport: VPS[0].id, status: "blocked" }, { moduleKey: "report", viewport: VPS[0].id, status: "captured" }];
  const gaps = L.findCoverageGaps(pairs, { modules: MODS, viewports: VPS });
  assert.ok(gaps.some((g) => g.moduleKey === "sale" && g.viewport === VPS[0].id), "blocked 页被当成已覆盖");
  return "status=captured 才计数";
});

await run("P23 帧复用：同一 PNG 充当两份证据 ⇒ 报出（卡 §三.A.3 每档不得复用同一帧）", () => {
  const frames = [
    { file: "a.png", pair: "p1", side: "prototype", viewport: "1440x1000", sha256: "AA" },
    { file: "b.png", pair: "p1", side: "implementation", viewport: "1440x1000", sha256: "BB" },
    { file: "c.png", pair: "p2", side: "prototype", viewport: "1440x1000", sha256: "AA" },
  ];
  const reused = L.findReusedFrames(frames);
  assert.equal(reused.length, 2, `复用组应报出 2 帧，实报 ${reused.length}`);
  assert.deepEqual([...new Set(reused.map((f) => f.sha256))], ["AA"]);
  assert.deepEqual(L.findReusedFrames(frames.slice(0, 2)), [], "两帧不同哈希却报复用");
  assert.deepEqual(L.findReusedFrames([{ file: "x", viewport: "1440x1000" }, { file: "y", viewport: "1440x1000" }]), [], "无哈希的辅助帧应忽略（与 F2a/F3 同一把尺子）");
  // 分组口径与 F2a 一致：同视口同哈希才算复用（跨档同帧另由 identical-shots/pair 面兜住）
  assert.deepEqual(L.findReusedFrames([{ pair: "p1", side: "prototype", viewport: "1440x1000", sha256: "CC" }, { pair: "p2", side: "prototype", viewport: "1024x768", sha256: "CC" }]), []);
  return "同档跨页/跨侧同哈希即报 · 无 sha 的辅助帧不参与 · 分组尺子 = F2a findDuplicateHashes";
});

/* ══════ E. collectModuleParityViolations 的 fail-closed 面 ══════ */

const okPair = (over = {}) => ({
  id: "sale/sl-1@1440x1000",
  moduleKey: "sale",
  viewport: VPS[0].id,
  status: "captured",
  diff: { rows: [] },
  rhythm: [],
  fonts: [],
  signatures: { equal: true },
  shots: { prototype: { file: "p.png", sha256: "P1" }, implementation: { file: "i.png", sha256: "I1" } },
  implementation: { overflowX: 0, readScope: 'main[data-view="manual"].shown > *', uiuxInject: "off", paintGate: { ok: true } },
  prototype: { overflowX: 0 },
  ...over,
});
const bundleOf = (pairs, over = {}) => ({
  modules: MODS,
  viewports: VPS,
  requiredModules: ["sale"],
  pairs,
  ...over,
});
const kinds = (v) => [...new Set(v.map((x) => x.kind))].sort();

await run("P24 干净包零违规（其余用例的基线）", () => {
  const p = okPair();
  p.diff.rows = L.buildPageDiffTable(pair().proto, pair().impl, {});
  const v = L.collectModuleParityViolations(
    bundleOf([p, { ...p, id: "sale/sl-2@1440x1000", moduleKey: "sale", viewport: VPS[0].id, shots: { prototype: { file: "p2.png", sha256: "P2" }, implementation: { file: "i2.png", sha256: "I2" } } }], {
      modules: [{ key: "sale", name: "销售" }],
      viewports: [VPS[0]],
    }),
  );
  assert.deepEqual(v, [], `干净包却判红：${JSON.stringify(v).slice(0, 300)}`);
  return "并排帧不同哈希 · 签名相等 · 零溢出 · 零注入 · 读数落页根 ⇒ 0 条";
});

await run("P25 采集器中止 / 未采 / 阻断不完整 / 空差异表 ⇒ 四类完整性违规", () => {
  assert.deepEqual(kinds(L.collectModuleParityViolations(bundleOf([], { aborted: "chromium 启动失败" }))), ["aborted", "coverage", "module-missing"]);
  const half = okPair({ block: { reason: "入口不可达" } });
  half.status = "blocked";
  const v = L.collectModuleParityViolations(bundleOf([half]));
  assert.ok(v.some((x) => x.kind === "blocked-incomplete"), "BLOCKED 缺 owner/followUp 却放行");
  const other = okPair();
  other.status = "skipped";
  assert.ok(L.collectModuleParityViolations(bundleOf([other])).some((x) => x.kind === "not-captured"));
  const empty = okPair();
  assert.ok(L.collectModuleParityViolations(bundleOf([empty])).some((x) => x.kind === "empty-diff"), "差异表为空（无可比读数）必须判红");
  const complete = okPair();
  complete.status = "blocked";
  complete.block = { reason: "r", owner: "墨", followUp: "13B §三.B" };
  assert.ok(!L.collectModuleParityViolations(bundleOf([complete])).some((x) => x.kind === "blocked-incomplete"), "诚实阻断（reason+owner+followUp 齐）不该再报不完整");
  return "aborted / not-captured / blocked-incomplete / empty-diff 各自独立可判";
});

await run("P26 状态签名不符 / 溢出 / 并排同帧 ⇒ 三类视觉证据违规", () => {
  const sig = L.collectModuleParityViolations(bundleOf([okPair({ signatures: { equal: false, prototype: "A", implementation: "B" } })]));
  assert.ok(sig.some((x) => x.kind === "signature"));
  const of = L.collectModuleParityViolations(bundleOf([okPair({ implementation: { ...okPair().implementation, overflowX: 12 } })]));
  assert.ok(of.some((x) => x.kind === "overflow" && x.overflowX === 12), "实现侧横向溢出未判红（卡 §三.A.4 零横向溢出）");
  const same = okPair();
  same.shots = { prototype: { file: "a.png", sha256: "Z" }, implementation: { file: "b.png", sha256: "Z" } };
  assert.ok(L.collectModuleParityViolations(bundleOf([same])).some((x) => x.kind === "identical-shots"), "两张帧逐字节相同＝至少一侧没真实渲染");
  return "signature / overflow / identical-shots";
});

await run("P27 注入态当生产证据 ⇒ 判红（卡 §六 红线）", () => {
  for (const val of ["on", "12-groups", "true"]) {
    const v = L.collectModuleParityViolations(bundleOf([okPair({ implementation: { ...okPair().implementation, uiuxInject: val } })]));
    assert.ok(v.some((x) => x.kind === "injection"), `data-uiux-inject=${val} 仍被当生产证据`);
  }
  const clean = L.collectModuleParityViolations(bundleOf([okPair({ implementation: { ...okPair().implementation, uiuxInject: "off" } })]));
  assert.ok(!clean.some((x) => x.kind === "injection"), "off 态被误判为注入");
  return "on/值/true 三种注入态一律判红，off/absent/false 放行";
});

await run("P28 一级栏选中态：进入模块页后 .on 与 F2/F3 已验收主蓝（卡 §三.A.4）", () => {
  const rail = (over = {}) => ({ implementation: { on: true, backgroundColor: L.RAIL_SELECTED_BG ?? "rgb(37, 99, 235)", color: "rgb(255, 255, 255)" }, prototype: { on: true }, expectBackground: "rgb(37, 99, 235)", expectForeground: "rgb(255, 255, 255)", ...over });
  assert.deepEqual(L.collectModuleParityViolations(bundleOf([okPair({ railSelected: rail() })])).filter((x) => x.kind.startsWith("rail")), []);
  const off = L.collectModuleParityViolations(bundleOf([okPair({ railSelected: rail({ implementation: { on: false, backgroundColor: "rgb(37, 99, 235)", color: "rgb(255, 255, 255)" } }) })]));
  assert.ok(off.some((x) => x.kind === "rail-not-selected"), "rail 未选中未判红");
  const color = L.collectModuleParityViolations(bundleOf([okPair({ railSelected: rail({ implementation: { on: true, backgroundColor: "rgb(36, 99, 232)", color: "rgb(255, 255, 255)" } }) })]));
  assert.ok(color.some((x) => x.kind === "rail-selected-color" && x.metric === "backgroundColor"), "选中主蓝偏移未判红（F2/F3 口径颜色容差 0）");
  const proto = L.collectModuleParityViolations(bundleOf([okPair({ railSelected: rail({ prototype: { on: false } }) })]));
  assert.ok(proto.some((x) => x.kind === "rail-not-selected" && x.side === "prototype"), "原型侧 rail 未选中漏判 ⇒ 两侧对齐失去基准");
  return "on 缺失 / 主蓝偏移 / 前景偏移 / 原型侧偏移四种都打到";
});

await run("P29 读数落回整屏口径（readScope=null）或出帧行为门不过 ⇒ 新增两条 fail-closed", () => {
  const fallback = L.collectModuleParityViolations(bundleOf([okPair({ implementation: { ...okPair().implementation, readScope: null, readScopeFallback: "document（rootSel 未命中）" } })]));
  assert.ok(fallback.some((x) => x.kind === "scope-fallback"), "整屏读数被当页面证据放行（卡 §三.A.3 页面口径失守）");
  const gate = L.collectModuleParityViolations(bundleOf([okPair({ implementation: { ...okPair().implementation, paintGate: { ok: false, shell: true, manualShown: false } } })]));
  assert.ok(gate.some((x) => x.kind === "paint-gate"), "出帧门不过仍算 captured");
  return "本单实测踩到：rt-platform 帧 routeArrived=true 但 manualShown=false ⇒ 现在必然判红";
});

await run("P30 模块缺页 / 覆盖缺口 / 差异表判红行都会转成违规条目", () => {
  const withRed = okPair();
  const { proto, impl } = pair();
  withRed.diff.rows = L.buildPageDiffTable(proto, { ...impl, tableCell: reg({ height: 90 }) }, {});
  const v = L.collectModuleParityViolations(bundleOf([withRed], { requiredModules: ["sale", "report"] }));
  assert.ok(v.some((x) => x.kind === "off-spec" && x.region === "tableCell"), "差异表判红行没转成违规");
  assert.ok(v.some((x) => x.kind === "module-missing" && x.moduleKey === "report"), "requiredModules 缺一模块没判红");
  assert.ok(v.some((x) => x.kind === "coverage"));
  const rhythm = okPair({ rhythm: [{ expected: "a > b", actual: "b > a", panelType: "list" }] });
  assert.ok(L.collectModuleParityViolations(bundleOf([rhythm])).some((x) => x.kind === "rhythm"));
  const fonts = okPair({ fonts: [{ role: "topTitle", metric: "fontSize", prototype: "15px", impl: "16px" }] });
  assert.ok(L.collectModuleParityViolations(bundleOf([fonts])).some((x) => x.kind === "font"));
  return "off-spec / module-missing / coverage / rhythm / font 五类同源判红";
});

await run("P30b 违规条目带可复核字段（pair/region/metric/expected 都必须在）", () => {
  const p = okPair({ railSelected: null });
  const { proto, impl } = pair();
  p.diff.rows = L.buildPageDiffTable(proto, { ...impl, filterBar: reg({ height: 60 }) }, {});
  const v = L.collectModuleParityViolations(bundleOf([p]));
  const row = v.find((x) => x.kind === "off-spec");
  assert.ok(row, "判红行未转成违规条目");
  for (const f of ["pair", "region", "metric", "prototype", "impl", "delta", "tolerance", "card"]) {
    assert.ok(f in row, `违规条目缺字段 ${f} ⇒ 回传卡无法逐条复核`);
  }
  assert.equal(row.region, "filterBar");
  assert.match(row.card, /^§三\./, "违规条目没带卡面出处");
  return `off-spec 条目字段齐（${Object.keys(row).join("·")}）`;
});

await run("P32 容差/归一/判红一源：13B 不自立标准", () => {
  assert.deepEqual({ length: TOLERANCE.length, radius: TOLERANCE.radius, color: TOLERANCE.color, display: TOLERANCE.display }, { length: 1, radius: 1, color: 0, display: 0 });
  assert.equal(MISSING_IS_FATAL, true);
  assert.equal(normalizeMetric("padding", "11px 14px"), "11,14,11,14", "padding 归一口径变了 ⇒ 差异表两侧不可比");
  assert.equal(normalizeMetric("backgroundColor", "rgb(236, 238, 241)"), "236,238,241");
  assert.equal(normalizeMetric("gridColumns", "repeat(4, minmax(0, 1fr))"), normalizeMetric("gridColumns", "repeat(4, minmax(0, 1fr))"), "同一轨道串两次归一不一致 ⇒ 两侧永远比不平");
  assert.notEqual(normalizeMetric("gridColumns", "repeat(4, minmax(0, 1fr))"), normalizeMetric("gridColumns", "repeat(3, minmax(0, 1fr))"), "列数不同的轨道串归一成同值 ⇒ gridColumns 门失去信号");
  assert.equal(normalizeMetric("gridColumns", "none"), "none");
  return "容差对象与归一函数都来自 f2a 库（13B 侧零改写）";
});

await run("P33 视口档即卡面三档：1440×1000 / 1024×768（+ 390×844 回归档另测）", () => {
  const ids = L.PAGE_VIEWPORTS.map((v) => v.id);
  assert.ok(ids.includes("1440x1000") && ids.includes("1024x768"), `主视口档缺失：${ids.join(",")}`);
  for (const v of L.PAGE_VIEWPORTS) {
    assert.ok(Number.isFinite(v.width) && Number.isFinite(v.height) && v.width > 0 && v.height > 0, `${v.id} 尺寸非法`);
  }
  return ids.join(" · ");
});

await run("P34 toolbarActions 两侧都指主行动按钮（同一角色选错实例＝口径假红）", () => {
  const r = L.PAGE_CONTRACT.find((x) => x.key === "toolbarActions");
  assert.ok(String(r.proto[0]).includes("pri"), "原型侧未指向 .btn2.pri ⇒ 会拿蓝钮 ⇄ 白钮比底色");
  assert.ok(String(r.impl[0]).includes("--primary"), "实现侧未指向 el-button--primary ⇒ 同上");
  assert.ok(r.proto.length >= 2 && r.impl.length >= 4, "主按钮缺失时的兜底候选被削 ⇒ 该区域会误报缺失");
  const { proto, impl } = pair();
  const rows = L.buildPageDiffTable({ ...proto, toolbarActions: reg({ backgroundColor: "rgb(37, 99, 235)", color: "rgb(255, 255, 255)" }) }, { ...impl, toolbarActions: reg({ backgroundColor: "rgb(37, 99, 235)", color: "rgb(255, 255, 255)" }) }, {});
  assert.equal(rowOf(rows, "toolbarActions", "backgroundColor").verdict, "match", "同指主按钮后主蓝仍判红 ⇒ 归一或容差被动过");
  return "两侧同角色（蓝底白字主按钮）比对，颜色容差 0 才可用";
});

await run("P35 either 区域缺席不再充数：exempted 行不计入门禁一致率分母", () => {
  const { proto, impl } = pair();
  const rows = L.buildPageDiffTable(proto, { ...impl, statistics: { exists: false, metrics: {} } }, {});
  const s = L.pageGatedStats(rows);
  assert.equal(s.offSpec, 0, "一侧缺失的 either 区域进了判红面");
  assert.ok(!rows.some((r) => r.region === "statistics" && r.gated && r.metric !== "presence"), "区域缺席却仍产出门禁指标行");
  const exempted = L.findPageExempted(rows);
  assert.ok(exempted.some((r) => r.region === "statistics"));
  return `豁免行 ${exempted.length} 条留在表内（可复核），gated=${s.gated} 不含它们`;
});

await run("P36 契约别名一物一名到底：同一角色的宿主命名不得只写在采集侧", () => {
  const keysOf = (k) => L.PAGE_CONTRACT.find((r) => r.key === k).impl;
  for (const [k, must] of [
    ["statistics", [".stat-row", ".stats-row", ".stat-grid", ".stat-cards", ".stat-bar", ".wb-kpis"]],
    ["statCard", [".stat-item", ".stat-card", ".stat-grid-card", ".stat-bar-item"]],
    ["filterBar", [".filter-bar", ".filter-card"]],
    ["pagination", [".pagination", ".pagination-bar", ".pagination-wrapper", ".table-card-footer"]],
    ["emptyState", [".v17-empty", ".empty-state", ".empty-tip", ".el-empty"]],
  ]) {
    for (const alias of must) assert.ok(keysOf(k).includes(alias), `${k} 缺宿主别名 ${alias}（漏一个＝那批页面量到视图自绘皮肤 ⇒ 假红）`);
  }
  return "统计/筛选/分页/空态四组的视图实测命名全部进契约";
});

await run("P37 书面解释自带适用范围：{text,maxAbsDelta} 越界照旧判红（防一条泛化说明吞掉布局级大偏差）", () => {
  const { proto, impl } = pair();
  const cap = { "filterBar.width": { text: "卡片宿主内衬 1px+16px ⇒ 每侧 17px", maxAbsDelta: 40 } };
  const inset = L.buildPageDiffTable(proto, { ...impl, filterBar: reg({ width: 992 - 34 }) }, cap);
  assert.equal(rowOf(inset, "filterBar", "width").verdict, "explained", "≤maxAbsDelta 的宿主内衬差未被解释（说明写而不生效）");
  const layout = L.buildPageDiffTable(proto, { ...impl, filterBar: reg({ width: 992 - 270 }) }, cap);
  assert.equal(rowOf(layout, "filterBar", "width").verdict, "off-spec", "270px 的分栏布局差被 17px 的内衬说明吞掉 ⇒ 豁免越界");
  assert.equal(rowOf(layout, "filterBar", "width").note, "", "越界行仍带着说明文字 ⇒ 复核者会以为它已豁免");
  const plain = L.buildPageDiffTable(proto, { ...impl, filterBar: reg({ width: 992 - 270 }) }, { "filterBar.width": "无条件说明" });
  assert.equal(rowOf(plain, "filterBar", "width").verdict, "explained", "字符串值必须保持无条件解释（向后兼容旧写法）");
  assert.deepEqual(L.resolveNote(""), { text: "", applies: false, disposition: null, owner: "" }, "空说明不得算解释过");
  return "解释分两档：绝对位置类（y）无条件、尺寸类（宽/高）带上限";
});

await run("P38 说明作用域由窄到宽、越具体越优先（逐页理由不得被同名模块级说明吃掉）", () => {
  const scopes = {
    "*": { "tableWrap.y": "全局：内容量差" },
    "finance/*": { "tableWrap.y": "模块：对接信息条在原型侧" },
    "finance/fin-pay@*": { "tableWrap.y": "逐页两档共用：KPI 行在原型侧更高" },
    "finance/fin-pay@1024x768": { "tableWrap.y": "逐页单档：本档另有裁断" },
  };
  const merged = (pairId, moduleKey = "finance") => L.mergeDeviationNotes(scopes, { moduleKey, pairId })["tableWrap.y"];
  assert.equal(merged("finance/fin-statements@1440x1000"), "模块：对接信息条在原型侧", "同模块其他页没拿到模块级说明");
  assert.equal(merged("finance/fin-pay@1440x1000"), "逐页两档共用：KPI 行在原型侧更高", "page@* 没覆盖模块级");
  assert.equal(merged("finance/fin-pay@1024x768"), "逐页单档：本档另有裁断", "pairId 没拿到最高优先级");
  assert.equal(merged("retail/rt-shelf@1440x1000", "retail"), "全局：内容量差", "跨模块误读了 finance 的说明");
  return "四级作用域（* / module / page@* / page@vp）逐档验证";
});

await run("P39 字体角色的宿主必须是同义契约区域的宿主子集（错配宿主＝假红字体差）", () => {
  const mismatches = [];
  for (const role of L.FONT_ROLES) {
    const region = L.PAGE_CONTRACT.find((r) => r.key === role.role);
    if (!region) continue;
    for (const [side, list, base] of [
      ["impl", [].concat(role.impl), [].concat(region.impl)],
      ["proto", [].concat(role.proto), [].concat(region.proto)],
    ]) {
      for (const sel of list) if (!base.includes(sel)) mismatches.push(`${role.role}.${side}: ${sel}`);
      if (list[0] !== base[0]) mismatches.push(`${role.role}.${side} 首选宿主不同：${list[0]} vs ${base[0]}`);
    }
  }
  // 本单实锤：字体角色把 `.page-desc`（页标题下的说明文字 12/400/#6D6D6D）当成原型 `.s-sec`（板块标题 13/800/--ink）
  // 的对应元素 ⇒ 逐页多吃 3 行假红（fontSize/fontWeight/color）。角色与区域必须读同一个元素，否则「对齐」量的是两张皮。
  assert.deepEqual(mismatches, [], `字体角色与契约区域宿主两张皮：\n  ${mismatches.join("\n  ")}`);
  assert.ok(!L.FONT_ROLES.some((r) => [].concat(r.impl).includes(".page-desc")), ".page-desc 不得再充当板块标题宿主");
  return "同名角色/区域宿主一致（pageTitle、sectionTitle、tableCell）";
});

await run("P40 采集侧必须走 lib 的说明合并（内联一份就是把优先级写错的入口）", () => {
  const src = readFileSync(path.join(here, "wb13b-module-parity.mjs"), "utf8");
  assert.ok(/mergeDeviationNotes\(NOTES/.test(src), "采集器没有调用 mergeDeviationNotes ⇒ 说明优先级回到内联写法");
  assert.ok(!/\.\.\.\(NOTES\[pair\.id\][^\n]*\}\),\s*\.\.\.\(NOTES\[`\$\{pair\.moduleKey\}\/\*`\]/.test(src), "残留旧的内联合并（pairId 被 module/* 覆盖）");
  return "采集器只在 lib 里保留一份作用域优先级实现";
});

await run("P41 blocked 处置：超容差且本单不改的行必须带归属，缺 owner 照旧判红（卡 §三.A.7 三种处置分得开）", () => {
  const { proto, impl } = pair();
  const offSpec = (n) => ({ ...impl, tableWrap: reg({ width: 992 - n }) });
  const rows = L.buildPageDiffTable(proto, offSpec(272), { "tableWrap.width": { text: "原型表格内在宽由设计示意的 6 列撑出", disposition: "blocked", owner: "凌舟裁定 · 归 13C 视图收口" } });
  const r = rowOf(rows, "tableWrap", "width");
  assert.equal(r.verdict, "blocked", "带 owner 的 blocked 说明没有转成待裁定行");
  assert.equal(r.owner, "凌舟裁定 · 归 13C 视图收口", "待裁定行没带归属 ⇒ 回传卡没法交接，等于默默豁免");
  assert.deepEqual(L.findPageOffSpec(rows), [], "待裁定不得混进判红行");
  assert.equal(L.findPageBlocked(rows).length, 1, "findPageBlocked 没抓到待裁定行");
  const st = L.pageGatedStats(rows);
  assert.equal(st.blocked, 1, "门禁统计缺待裁定计数");
  assert.equal(st.withinTolerance, st.exact, "待裁定被算进「容差内」⇒ 假绿（无已解释行时两者应等于逐字节一致数）");
  const noOwner = L.buildPageDiffTable(proto, offSpec(272), { "tableWrap.width": { text: "没有归属", disposition: "blocked" } });
  assert.equal(rowOf(noOwner, "tableWrap", "width").verdict, "off-spec", "缺 owner 的 blocked＝没处置，必须落回判红（fail-closed）");
  const hybrid = L.buildPageDiffTable(proto, offSpec(20), { "tableWrap.width": { text: "包装卡内衬 ≤40 算解释，越界转待裁定", maxAbsDelta: 40, disposition: "blocked", owner: "13C" } });
  assert.equal(rowOf(hybrid, "tableWrap", "width").verdict, "explained", "幅度在上限内应按已解释收（越界才转待裁定）");
  // 只有 expect=both 的部位（pageRoot / pageTitle）才有「缺部位」这档；either 类缺一不判红，走 exempted
  const presence = L.buildPageDiffTable({ ...proto, pageTitle: { exists: false, metrics: {} } }, impl, { "pageTitle.presence": { text: "标题由路由 meta 决定", disposition: "blocked", owner: "凌舟裁定 · 归 13C 视图收口" } });
  assert.equal(rowOf(presence, "pageTitle", "presence").verdict, "blocked", "expect=both 的缺部位 blocked 没落进待裁定");
  return "explained / blocked / off-spec 三档互斥，blocked 一定要有名有主";
});

await run("P42 宿主顺序＝先角色后泛用（列卡对列卡、容器对容器，泛用别名只能兜底）", () => {
  const at = (key) => [].concat(L.PAGE_CONTRACT.find((r) => r.key === key).impl);
  const before = (key, a, b) => assert.ok(at(key).indexOf(a) < at(key).indexOf(b), `${key}：${a} 必须排在 ${b} 前面（先命中泛用别名＝量到页里另一层）`);
  before("chart", ".chart-container", "canvas");
  before("chart", ".chart-card", "canvas");
  before("boardCard", ".board-column", ".el-card");
  before("boardCard", ".board-card", ".el-card");
  before("boardGrid", ".board-container", ".el-row");
  before("formField", ".el-form:not(.el-form--inline) .el-form-item", ".el-form-item");
  assert.equal(at("chart").at(-1), "canvas", "canvas 是画布本体（padding 恒 0、无圆角、透明底），只能作最后回落");
  assert.ok(at("formField").some((s) => s.includes(":not(.el-form--inline)")), "内联筛选字段不得再当表单字段读（那是筛选条的角色）");
  return "三组区（图表/看板列卡/表单字段）的宿主顺序按角色近远排定";
});

await run("P43 采集侧必须把待裁定行分档写进证据与人读表（并进判红或整条抹掉都不成立）", () => {
  const src = readFileSync(path.join(here, "wb13b-module-parity.mjs"), "utf8");
  assert.match(src, /blocked: findPageBlocked\(rows\)/, "配对记录里没有 blocked 数组 ⇒ 待裁定行只存在于内存");
  assert.match(src, /pendingRulingRows/, "总账没有待裁定计数");
  assert.match(src, /待裁定行（差值真实存在/, "人读差异表没有待裁定章节");
  assert.match(src, /归属\/裁定人/, "待裁定章节没有归属列 ⇒ 交不出去");
  return "blocked 行三处落地：配对记录 · 总账计数 · 人读表（带归属列）";
});

await run("P44 旧片配对必须按当前说明文件重算判定档（几何不动，处置档不得冻在采集那一刻）", () => {
  const src = readFileSync(path.join(here, "wb13b-module-parity.mjs"), "utf8");
  assert.match(src, /rec\.regionMetrics = \{ prototype: slimRegions\(protoRegions\), implementation: slimRegions\(implRegions\) \}/, "采集没有把两侧区域读数写进证据 ⇒ 改一行解释就得重开浏览器重采");
  assert.match(src, /if \(p\.status === "captured" && rescorePreviousPair\(p\)\)/, "合并旧片时没有重算 ⇒ 上一片的处置档冻在旧说明文件上（同一条解释两档视口不一致）");
  assert.match(src, /mergeDeviationNotes\(NOTES, \{ moduleKey: p\.moduleKey, pairId: p\.id \}\)/, "重算没有走同一套四级作用域合并 ⇒ 逐页解释在重算时失效");
  assert.match(src, /const \{ regionMetrics, \.\.\.rest \} = p/, "fixtures 副本还带着整层读数 ⇒ 测试夹具无谓膨胀（正式证据里才需要可重算）");
  return "证据 JSON 自带可重算层；夹具副本只留判定结果";
});

await run("P45 区域取值必须落在真的排出尺寸的那一条命中上（隐藏分支量出的 0 不是页面本体）", () => {
  const src = readFileSync(path.join(here, "wb13b-module-parity.mjs"), "utf8");
  assert.match(src, /const shown = pool\.findIndex\(\(el\) => rendered\(el\) && laidOut\(el\)\)/, "同一选择器多条命中时没有优先取「可见且排出尺寸」的 ⇒ 隐藏 tab/抽屉里的同名节点会被当成页面区块");
  assert.match(src, /const mode = pool\.length === 1 \? "single" : `zeroSize-of-\$\{pool\.length\}`;\n\s*return \{ el: live, sel: s, mode \}/, "全部零尺寸时必须退回**可见的那一条**并如实量出 0（角色真没渲染 ≠ 借别的层凑数，也 ≠ 借一条隐藏子树）");
  assert.match(src, /`zeroSize-of-\$\{pool\.length\}`/, "全零退化路径没有读数标记 ⇒ 复核者看不出这条 0 是「没渲染」还是「量错层」");
  assert.match(src, /pickMode: hit\.mode/, "区域读数没带命中方式 ⇒ 证据里无法复现量的是第几条命中");
  assert.match(src, /implPick: implRegions\[r\.key\]\?\.pickMode/, "逐区命中身份没进 regionSel 证据");
  return "多条命中优先取排布者，全零如实退回；pickMode 同步落进区域读数与证据";
});

await run("P47 隐藏子树既不能借数也不能量成 0：整份候选都收起时判该区不存在（与真空容器分开）", () => {
  const src = readFileSync(path.join(here, "wb13b-module-parity.mjs"), "utf8");
  // ① 分辨「没渲染」与「渲染了但零尺寸」的尺子必须是 checkVisibility（display:none / visibility:hidden / hidden 属性都覆盖）
  assert.match(src, /el\.checkVisibility\(\)/, "没有 checkVisibility 判据 ⇒ 隐藏 tab 面板里的同名节点会顶掉可见那条，量出 h=0 的假红（会员系统实测）");
  // ② 全隐藏 ⇒ 继续找下一个别名，而不是就地返回
  assert.match(src, /allHidden = allHidden \?\? \{ sel: s, hiddenOnly: pool\.length \};\n\s*continue;/, "整份候选被收起就直接返回 ⇒ 后面的别名（真渲染出来的那条）再也没有机会命中");
  assert.match(src, /return allHidden;/, "所有别名都落在隐藏子树时必须把「隐藏缺失」交回调用方，而不是 null（null 会被当成「类名没写对」）");
  // ③ 区域层：hiddenOnly 必须写成 exists=false + 可复核的 pickMode ⇒ 存在性差交给契约 expect 档位
  assert.match(src, /pickMode: `hiddenOnly-of-\$\{hit\.hiddenOnly\}`/, "隐藏缺失没有读数标记 ⇒ 差异表看不出这一区是「这屏真没有」还是「采集器没命中」");
  assert.match(src, /if \(hit\.hiddenOnly\)[\s\S]{0,260}exists: false/, "hiddenOnly 仍写 exists:true ⇒ 零尺寸盒还是会被当成页面本体逐行判红");
  // ④ 字体角色同一条尺子：读到隐藏子树的字号＝假字体差（字体面逐字节，必红）
  assert.match(src, /if \(!hit \|\| hit\.hiddenOnly\)[\s\S]{0,200}fonts\[role\.role\] = \{ exists: false/, "字体角色没排除隐藏子树 ⇒ 隐藏分支的 14px 会顶掉可见那条的 11px，出门禁假红");
  return "隐藏子树＝该区/该角色不存在（交契约档位处置）；可见但零尺寸＝如实的 0（交差异表判缺失）";
});

await run("P48 节奏差与字体差走同一张差异表的处置通道：无说明必红，有 owner 才转待裁定", () => {
  const viol = [{ panelType: "list", side: "implementation", expected: "filterBar > tableWrap > pagination", actual: "pageCard > filterBar > tableWrap" }];
  const plain = L.buildRhythmRows(viol, {});
  assert.equal(plain.length, 1, "差条数变了 ⇒ 处置通道会吞掉或复制违规");
  assert.equal(plain[0].region, "rhythm");
  assert.equal(plain[0].metric, "order.implementation", "指标没带侧 ⇒ 两侧的错序会撞成同一行（说明文件写不给具体一侧）");
  assert.equal(plain[0].verdict, "off-spec", "没有书面处置的节奏差必须判红（卡 §三.A.7：每条不一致都要有去向）");
  const blocked = L.buildRhythmRows(viol, { "rhythm.order.implementation": { text: "页内 Tab 卡把筛选条整块包住 ⇒ 宿主层抢了节奏槽位", disposition: "blocked", owner: "凌舟裁定 · 归 WORKBENCH-13C 视图结构收口" } });
  assert.equal(blocked[0].verdict, "blocked");
  assert.equal(blocked[0].owner, "凌舟裁定 · 归 WORKBENCH-13C 视图结构收口");
  assert.deepEqual(L.findPageOffSpec(blocked), [], "待裁定不得混进判红行");
  assert.equal(L.findPageBlocked(blocked).length, 1);
  const noOwner = L.buildRhythmRows(viol, { "rhythm.order.implementation": { text: "没有归属", disposition: "blocked" } });
  assert.equal(noOwner[0].verdict, "off-spec", "缺 owner 的 blocked＝没处置，照旧判红（fail-closed）");
  const fontRows = L.buildFontRows([{ role: "statValue", metric: "fontSize", prototype: "20px", impl: "24px" }], { "font.statValue.fontSize": "画布口径 20px，视图嵌套待收口" });
  assert.equal(fontRows[0].region, "font");
  assert.equal(fontRows[0].metric, "statValue.fontSize");
  assert.equal(fontRows[0].verdict, "explained", "字体面逐字节 ⇒ 无条件解释生效");
  assert.equal(L.buildFontRows([{ role: "body", metric: "color", prototype: "rgb(22, 24, 29)", impl: "rgb(0, 0, 0)" }], {})[0].verdict, "off-spec");
  // 门禁只认处置行：同一差不得既算 off-spec 又算 rhythm（双计会让判红数虚高）
  const withRows = { status: "captured", id: "x", rhythm: viol, fonts: [], diff: { rows: [...plain], offSpec: plain, stats: {} }, implementation: { overflowX: 0, uiuxInject: "absent", readScope: ".page" }, prototype: { overflowX: 0 }, signatures: { equal: true }, shots: {} };
  const kinds = L.collectModuleParityViolations({ pairs: [withRows], modules: [], viewports: [], requiredModules: [] }).map((v) => v.kind);
  assert.ok(!kinds.includes("rhythm"), "已有处置行还补一条 rhythm 红 ⇒ 同一条差双计");
  assert.ok(kinds.includes("off-spec"), "处置行为红时门禁必须出红（不能因为改走差异表就静默）");
  const legacy = { ...withRows, diff: { rows: [], offSpec: [], stats: {} } };
  assert.ok(L.collectModuleParityViolations({ pairs: [legacy], modules: [], viewports: [], requiredModules: [] }).some((v) => v.kind === "rhythm"), "旧片证据没有处置行时必须照旧判红（fail-closed，不给静默绿灯）");
  // 采集侧接线：处置行必须真的并进差异表（只在库里函数＝证据里仍是硬编码红），且旧片重算走同一条通道
  const src = readFileSync(path.join(here, "wb13b-module-parity.mjs"), "utf8");
  assert.match(src, /rows\.push\(\.\.\.buildRhythmRows\(rec\.rhythm, notes\), \.\.\.buildFontRows\(rec\.fonts, notes\)\)/, "本片采集没把节奏/字体差并进差异表 ⇒ §三.A.7 的去向要求只落在库层，证据里看不见");
  assert.match(src, /rows\.push\(\.\.\.buildRhythmRows\(p\.rhythm, notes\), \.\.\.buildFontRows\(p\.fonts \?\? \[\], notes\)\)/, "重算旧片时没重建处置行 ⇒ 上一片的节奏/字体差不跟当前说明文件走");
  return "rhythm / font 与几何同行同档；有行走 verdict，没行仍直接红，绝不双计；采集侧两层接线都在";
});

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n小结：${passed} passed / ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
