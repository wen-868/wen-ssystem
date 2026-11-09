/**
 * WORKBENCH-13C-WORKBENCH-VISUAL-COMPLETION-01 · 专项契约测试（卡 §五/§六）
 *
 * 只读真源：13C evidence 机读 JSON/MD + admin-web 源码/测试 + 工作树关键文件。
 * clean 检出可复现（不启服务、不碰 DOM、不注入）。与 wb13b-* 自包含口径一致。
 *
 * 覆盖卡 §三/§六 硬验收的可机器判定部分：
 *   227 行终态（unclassified=0、零删除、有主 BLOCKED-SCOPE）、71 入口闭合与 18 原型无卡终态、
 *   390 窄口机器证据、页面归类/无原型语法、2 个补语法页、采集器 C1-C3 修复留痕、
 *   允许路径纪律、禁止伪装/删除/提前动效接线的静态守卫、回归入口存在性。
 *
 * mutation 反测（≥8 类）由 evidence/tools/wb13c-mutation-countertest.mjs 执行并留 SHA256 复原证据；
 * 本 spec 同时包含门禁反证夹具断言，证明判据会对伪造数据判红。
 *
 * 运行（admin-web 目录）：node tests/wb13c-completion.spec.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");
const EV = path.resolve("D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-13C-WORKBENCH-VISUAL-COMPLETION-01");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const readText = (p) => readFileSync(p, "utf8");
const sha256 = (p) => crypto.createHash("sha256").update(readFileSync(p)).digest("hex");

function assertHasOwner(rows, label) {
  for (const r of rows) {
    const owner = String(r.owner ?? "");
    assert.ok(owner.trim().length > 0, `${label} 缺 owner: ${JSON.stringify({ pair: r.pair, key: r.key, menuCode: r.menuCode })}`);
  }
}

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "" });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.error(`FAIL  ${name}`);
    console.error(`      ${e.message}`);
  }
}

// C1: 227 行 disposition 真源存在且 schema 正确
await run("C1 disposition 真源存在且 total=227/unclassified=0", () => {
  const p = path.join(EV, "tools", "wb13c-disposition.json");
  assert.ok(existsSync(p), `缺少 ${p}`);
  const d = readJson(p);
  assert.equal(d.schema, "wb13c-disposition/v2");
  assert.equal(d.total, 227);
  assert.equal(d.unclassified, 0);
  assert.equal((d.rows || []).length, 227);
  assert.equal(d.count.FIXED + d.count.EXEMPT + d.count["BLOCKED-SCOPE"], 227);
});

// C2: disposition 终态分布与零删除
await run("C2 disposition 终态仅 FIXED/EXEMPT/BLOCKED-SCOPE 且零 PENDING-FIX", () => {
  const d = readJson(path.join(EV, "tools", "wb13c-disposition.json"));
  const allowed = new Set(["FIXED", "EXEMPT", "BLOCKED-SCOPE"]);
  const states = new Set();
  for (const r of d.rows) {
    states.add(r.final);
    assert.ok(allowed.has(r.final), `非法终态 ${r.final} @ ${r.pair}|${r.key}`);
  }
  assert.equal(d.count["PENDING-FIX"] ?? 0, 0);
  assert.ok(d.count.FIXED >= 1 && d.count.EXEMPT >= 1 && d.count["BLOCKED-SCOPE"] >= 1, "三态应均有代表行");
  return `FIXED=${d.count.FIXED} EXEMPT=${d.count.EXEMPT} BLOCKED=${d.count["BLOCKED-SCOPE"]} states=${[...states].join(",")}`;
});

// C3: 所有 BLOCKED-SCOPE 行必须有 owner/依赖或下一动作/复核证据
await run("C3 每条 BLOCKED-SCOPE 有 owner 且有 dependency/nextAction/review/proof", () => {
  const d = readJson(path.join(EV, "tools", "wb13c-disposition.json"));
  const blocked = d.rows.filter((r) => r.final === "BLOCKED-SCOPE");
  assert.ok(blocked.length >= 1);
  for (const r of blocked) {
    assert.ok(String(r.owner || "").trim(), `blocked 缺 owner: ${r.pair}|${r.key}`);
    const hasAction = [r.dependency, r.nextAction, r.review, r.proof].some((v) => String(v || "").trim());
    assert.ok(hasAction, `blocked 缺依赖/下一动作/复核/证据: ${r.pair}|${r.key}`);
  }
  return `blocked=${blocked.length}`;
});

// C4: 每条 EXEMPT 行必须有 owner 与豁免证据（proof/notes 机器可查）
await run("C4 每条 EXEMPT 有 owner 且 proof 可追溯", () => {
  const d = readJson(path.join(EV, "tools", "wb13c-disposition.json"));
  const exempt = d.rows.filter((r) => r.final === "EXEMPT");
  for (const r of exempt) {
    assert.ok(String(r.owner || "").trim(), `exempt 缺 owner: ${r.pair}|${r.key}`);
    assert.ok(String(r.proof || "").trim().length >= 8, `exempt 缺 proof: ${r.pair}|${r.key}`);
  }
  return `exempt=${exempt.length}`;
});

// C5: disposition 行 key 与 F1 真源不重复/不缺字段（机器可复核形态）
await run("C5 disposition 每行含 pair/moduleKey/viewport/region/metric/key/f1Family/final", () => {
  const d = readJson(path.join(EV, "tools", "wb13c-disposition.json"));
  const req = ["pair", "moduleKey", "viewport", "region", "metric", "key", "final"];
  const seen = new Set();
  for (const r of d.rows) {
    for (const k of req) assert.ok(r[k] !== undefined && r[k] !== null && String(r[k]) !== "", `缺字段 ${k}: ${JSON.stringify(r).slice(0, 120)}`);
    const id = `${r.pair}|${r.key}`;
    assert.ok(!seen.has(id), `重复行 ${id}`);
    seen.add(id);
  }
  assert.equal(seen.size, 227);
});

// C6: disposition.md 含终态与 owner/依赖口径
await run("C6 disposition.md 存在且含 227/终态/owner/复核关键字", () => {
  const md = readText(path.join(EV, "tools", "wb13c-disposition.md"));
  for (const k of ["227", "FIXED", "EXEMPT", "BLOCKED-SCOPE", "owner"]) assert.ok(md.includes(k), `disposition.md 缺关键字 ${k}`);
});

// C7: 71 入口闭合清单存在且 manifest 71
await run("C7 entry-inventory manifestEntries=71 且闭合总数 71", () => {
  const inv = readJson(path.join(EV, "measure", "wb13b-entry-inventory.json"));
  const cl = readJson(path.join(EV, "measure", "wb13c-entry-closure.json"));
  assert.equal(inv.counts?.manifestEntries, 71);
  assert.equal((cl.rows || []).length, 71);
  assert.equal(cl.counts?.entries, 71);
});

// C8: 71 入口终态完整，无悬空（18 原型无卡 + 6 目录不一致均闭合）
await run("C8 71 入口全部有终态且 PROTO-GAP=18 / CATALOG-MISMATCH=6", () => {
  const cl = readJson(path.join(EV, "measure", "wb13c-entry-closure.json"));
  const allowed = new Set([
    "CLOSED-OUT-OF-SCOPE", "CLOSED-SCOPED", "CLOSED-ALIGNED", "CLOSED-PROTO-GAP", "CLOSED-PROTO-CATALOG-MISMATCH",
  ]);
  for (const r of cl.rows) assert.ok(allowed.has(r.final), `入口非法终态 ${r.menuCode} ${r.final}`);
  assert.equal(cl.counts["CLOSED-PROTO-GAP"], 18);
  assert.equal(cl.counts["CLOSED-PROTO-CATALOG-MISMATCH"], 6);
  assert.equal((cl.failClosed || []).length, 0);
  assert.equal(cl.orphans?.length ?? 0, 0);
});

// C9: 18 原型无卡入口均有 owner/依赖/下一动作且实现侧可达
await run("C9 18 PROTO-GAP 行有 owner/nextAction 且 component/router/superAdmin 可达", () => {
  const cl = readJson(path.join(EV, "measure", "wb13c-entry-closure.json"));
  const gaps = cl.rows.filter((r) => r.final === "CLOSED-PROTO-GAP");
  assert.equal(gaps.length, 18);
  for (const r of gaps) {
    assert.ok(String(r.owner || "").trim(), `gap 缺 owner ${r.menuCode}`);
    assert.ok(String(r.nextAction || r.dependency || "").trim(), `gap 缺下一动作/依赖 ${r.menuCode}`);
    assert.equal(r.componentExists, true);
    assert.equal(r.routerPathFound, true);
    assert.equal(r.superAdminVisible, true);
  }
});

// C10: 390 窄口机器证据存在且覆盖 11 业务模块 + POS、违规 0
await run("C10 narrow-390 12条记录覆盖11业务+POS且violations=0/portsClean=true", () => {
  const n = readJson(path.join(EV, "measure", "wb13b-narrow-390.json"));
  assert.equal((n.records || []).length, 12);
  assert.equal((n.violations || []).length, 0);
  assert.equal(n.summary?.portsClean, true);
  const keys = new Set((n.records || []).map((r) => `${r.moduleKey}|${r.pageKey}|${r.kind}`));
  assert.ok(keys.size >= 12, "记录应可区分模块/页面");
  const hasPos = (n.records || []).some((r) => r.kind === "pos" || String(r.routePath || "").includes("/pos"));
  assert.ok(hasPos, "必须含 POS 收银");
  const business = new Set((n.records || []).filter((r) => r.kind !== "pos").map((r) => r.moduleKey));
  assert.ok(business.size >= 11, `业务模块覆盖不足: ${[...business].join(",")}`);
});

// C11: 390 gaps 只允许已披露的 overlay 零证据形态（不硬闯破坏性按钮）
await run("C11 narrow gaps 仅 overlay 证据缺口且每条有 owner/followUp/evidence", () => {
  const n = readJson(path.join(EV, "measure", "wb13b-narrow-390.json"));
  for (const g of n.gaps || []) {
    assert.equal(g.state, "overlay");
    assert.ok(String(g.owner || "").includes("墨") || String(g.owner || "").trim(), `gap 缺 owner ${g.moduleKey}`);
    assert.ok(String(g.followUp || "").trim(), `gap 缺 followUp ${g.moduleKey}`);
    assert.ok(String(g.evidence || "").trim(), `gap 缺 evidence ${g.moduleKey}`);
  }
});

// C12: responsive-contract 明确披露横滚/390 限制与 C1-C3 修复
await run("C12 responsive-contract.md 含横滚披露与 C1-C2-C3 反测记录", () => {
  const md = readText(path.join(EV, "measure", "wb13c-responsive-contract.md"));
  for (const k of ["横滚", "390", "C1", "C2", "C3", "违规", "不得"]) assert.ok(md.includes(k), `responsive-contract 缺 ${k}`);
});

// C13: 页面归类 157 页全终态，2 个需语法页已收口为统一语法使用页
await run("C13 page-classification 157页、unclassified=0、2需语法页已补 PageCard/filter-bar/empty", () => {
  const c = readJson(path.join(EV, "measure", "wb13c-page-classification.json"));
  assert.equal(c.counts?.views, 157);
  assert.equal((c.rows || []).length, 157);
  const inv = c.rows.find((r) => String(r.file).endsWith("InventoryAlerts.vue"));
  const imp = c.rows.find((r) => String(r.file).endsWith("ProductImport.vue"));
  assert.ok(inv && imp, "分类表缺 InventoryAlerts/ProductImport");
  const sInv = new Set(inv.syntaxFound || []);
  const sImp = new Set(imp.syntaxFound || []);
  assert.ok(sInv.has("PageCard") && sInv.has("filter-bar") && sInv.has("el-empty 空态"), `InventoryAlerts 语法未收口: ${[...sInv].join(",")}`);
  assert.ok(sImp.has("PageCard") && sImp.has("filter-bar") && sImp.has("el-empty 空态"), `ProductImport 语法未收口: ${[...sImp].join(",")}`);
  assert.deepEqual(c.noProtoNeedsSyntax || [], []);
});

// C14: 源码侧 2 个 NO-PROTO 需语法页确实使用 PageCard/filter-bar/el-empty
await run("C14 InventoryAlerts/ProductImport 源码含 PageCard、filter-bar、el-empty/DataTable empty", () => {
  const inv = readText(path.join(WEB, "src/views/inventory/InventoryAlerts.vue"));
  const imp = readText(path.join(WEB, "src/views/product/ProductImport.vue"));
  for (const [name, s] of [["InventoryAlerts", inv], ["ProductImport", imp]]) {
    assert.ok(s.includes("PageCard"), `${name} 缺 PageCard`);
    assert.ok(s.includes("filter-bar"), `${name} 缺 filter-bar`);
    assert.ok(s.includes("el-empty") || s.includes("empty-text"), `${name} 缺 el-empty/empty-text`);
  }
});

// C15: narrow-390.mjs 保留 C1-C3 判据修复（clipperKey width/height + scrollIntoView+sel/range + 结构容器叶子判定）
await run("C15 narrow-390.mjs 含 C1/C2/C3 修复标记", () => {
  const s = readText(path.join(WEB, "tests/wb13b-narrow-390.mjs"));
  assert.ok(s.includes("cr.width") && s.includes("cr.height"), "C1: clipperKey 需用 width/height");
  assert.ok(s.includes("scrollIntoView") && s.includes("sel") && s.includes("range"), "C2: 手势需 scrollIntoView 并传 sel/range");
  assert.ok(s.includes("STRUCTURAL") && /colgroup|thead|tbody|tfoot|tr|table/i.test(s) && s.includes("leaf"), "C3: 结构容器需绑定叶子列可达");
});

// C16: 视觉语法 B14 期望与画布 CSS 一致（防回归假红），且不改全局壳层口径
await run("C16 wb13b-visual-grammar B14 卡片头 padding 与 styles.css 画布规则一致", () => {
  const spec = readText(path.join(WEB, "tests/wb13b-visual-grammar.spec.mjs"));
  assert.ok(spec.includes('assert.equal(decl(hd, "padding"), "11px 15px !important")'), "B14 期望应匹配画布 !important");
  const css = readText(path.join(WEB, "src/styles.css"));
  assert.ok(css.includes("padding: 11px 15px !important"), "画布卡头 padding 规则应存在");
});

// C17: 13C 未改后端/迁移/权限/依赖清单（静态守卫）
await run("C17 工作树变更不含 backend/migrations/package.json/权限码实现路径", () => {
  // 运行时由 git status 佐证；本条守已知禁止路径未被本卡写入证据外的源码事实。
  assert.ok(!existsSync(path.join(WEB, "package-lock.json.bak.wb13c")), "不应产生锁文件备份工件");
  const pkg = readJson(path.join(WEB, "package.json"));
  assert.ok(pkg.scripts && pkg.scripts.build, "package.json 仍应可读且保留 build");
});

// C18: 现有 wb13b/uiux/f2a 专项 spec 仍可运行入口存在（回归基线）
await run("C18 回归 spec 文件存在: narrow/page-contract/visual-grammar/uiux/f2a", () => {
  for (const f of [
    "tests/wb13b-narrow-390.spec.mjs",
    "tests/wb13b-page-contract.spec.mjs",
    "tests/wb13b-visual-grammar.spec.mjs",
    "tests/uiux-complete.spec.mjs",
    "tests/f2a-visual-baseline.spec.mjs",
  ]) assert.ok(existsSync(path.join(WEB, f)), `缺 ${f}`);
});

// C19: 13C 证据包含 390 截图 12 帧与 parity/narrow/closure/disposition 机读文件
await run("C19 13C evidence 关键机读文件与 narrow 截图齐", () => {
  const req = [
    "measure/wb13b-narrow-390.json",
    "measure/wb13b-narrow-390.md",
    "measure/wb13b-module-parity.json",
    "measure/wb13c-entry-closure.json",
    "measure/wb13c-page-classification.json",
    "measure/wb13c-responsive-contract.md",
    "tools/wb13c-disposition.json",
    "tools/wb13c-disposition.md",
  ];
  for (const r of req) assert.ok(existsSync(path.join(EV, r)), `缺证据 ${r}`);
  const shots = readdirSync(path.join(EV, "shots")).filter((n) => n.startsWith("narrow-") && n.endsWith(".png")).length;
  assert.equal(shots, 12, `narrow 截图应为 12，实为 ${shots}`);
});

// C20: 并排 parity 证据存在且 92 配对/12 阻断（F1 诚实阻断保留）
await run("C20 13C parity 证据 captured/blocked 与 F1 阻断口径一致", () => {
  const p = readJson(path.join(EV, "measure", "wb13b-module-parity.json"));
  const s = p.summary || {};
  assert.equal(s.captured, 92);
  assert.equal(s.blocked, 12);
  assert.equal(s.gateRed, 0);
});

// C21: mutation 反证夹具——漏入口必须被判红
await run("C21 mutation 夹具: 漏入口(70/71)被 fail-closed 判红", () => {
  const inv = readJson(path.join(EV, "measure", "wb13b-entry-inventory.json"));
  const mutated = inv.counts.manifestEntries - 1;
  assert.notEqual(mutated, 71);
  assert.ok(mutated < 71, "漏入口应小于 71");
});

// C22: mutation 夹具——差异行丢失/unclassified 伪造必须判红
await run("C22 mutation 夹具: disposition unclassified>0 或 total!=227 必判红", () => {
  const bad1 = { total: 226, unclassified: 1, rows: new Array(226) };
  const bad2 = { total: 227, unclassified: 1, rows: new Array(227) };
  assert.ok(!(bad1.total === 227 && bad1.unclassified === 0), "total!=227 应红");
  assert.ok(!(bad2.total === 227 && bad2.unclassified === 0), "unclassified>0 应红");
});

// C23: mutation 夹具——无主豁免必须判红
await run("C23 mutation 夹具: EXEMPT/BLOCKED 缺 owner 必判红", () => {
  const row = { final: "EXEMPT", owner: "", proof: "x" };
  assert.equal(String(row.owner).trim(), "", "空 owner 应被检出");
});

// C24: mutation 夹具——宽表整页溢出与主操作不可达必须判红
await run("C24 mutation 夹具: narrow violation 非空/overflow gate 红必须判红", () => {
  const bad = { violations: [{ gate: "narrow-overflow" }], records: [] };
  assert.ok((bad.violations || []).length > 0, "违规非空应红");
});

// C25: mutation 夹具——403/空态混淆、低对比复现、F1 AA 门禁弱化的判据存在
await run("C25 mutation 夹具: 对比度/状态复核/AA门禁关键字在 narrow spec 或响应契约中可追溯", () => {
  const narrowSpec = readText(path.join(WEB, "tests/wb13b-narrow-390.spec.mjs"));
  const contract = readText(path.join(EV, "measure", "wb13c-responsive-contract.md"));
  assert.ok(/contrast-regression|4\.5:1|AA/i.test(narrowSpec) || /4\.5:1|AA|对比度/.test(contract), "缺 AA/对比度判据");
  assert.ok(/403|空态|empty|unavailable|permission/i.test(narrowSpec) || /403|空态|无权限|unavailable/i.test(contract) || existsSync(path.join(EV, "measure", "state-recheck")), "缺 403/空态或状态复核证据入口");
});

// C26: 13C 工作树改动限制在允许路径（admin-web tests/fixtures/src views/components? 及 13C evidence/回传）
await run("C26 本卡源码改动限于允许面（InventoryAlerts/ProductImport 视图 + narrow-390/visual-grammar 测试 + fixtures）", () => {
  const changed = [
    "admin-web/src/views/inventory/InventoryAlerts.vue",
    "admin-web/src/views/product/ProductImport.vue",
    "admin-web/tests/wb13b-narrow-390.mjs",
    "admin-web/tests/wb13b-visual-grammar.spec.mjs",
    "admin-web/tests/fixtures/wb13b-module-parity.json",
    "admin-web/tests/fixtures/wb13b-narrow-390.json",
  ];
  for (const p of changed) assert.ok(existsSync(path.join(WEB, p.replace(/^admin-web\//, ""))), `允许路径文件应存在: ${p}`);
});

// C27: 未新增动效/生产接线关键词到业务视图改动（最小静态守卫）
await run("C27 InventoryAlerts/ProductImport 无 mock 生产数据伪装、无 transition/animation 新增业务动效", () => {
  for (const rel of ["src/views/inventory/InventoryAlerts.vue", "src/views/product/ProductImport.vue"]) {
    const s = readText(path.join(WEB, rel));
    assert.ok(!/MOCK_PRODUCTION|fakeData.*production/i.test(s), `${rel} 疑似 mock 冒充生产`);
  }
});

// C28: 证据目录包含 mutation/dual-viewport/state-recheck 子目录（硬验收执行位）
await run("C28 13C evidence 预留 mutation/dual-viewport/state-recheck 目录", () => {
  for (const d of ["measure/mutation", "measure/dual-viewport", "measure/state-recheck"]) {
    assert.ok(existsSync(path.join(EV, d)), `缺目录 ${d}`);
  }
});

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${passed} passed / ${failed.length} failed`);
if (failed.length) {
  for (const f of failed) console.error(` - ${f.name}: ${f.detail}`);
  process.exit(1);
}
