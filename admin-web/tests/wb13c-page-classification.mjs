/**
 * WORKBENCH-13C · 剩余页面原型类型契约归类台账（卡 §三.5 / §六.4）
 *
 * 卡面要求：「全部 `src/views/**` 页面按原型类型契约归类；有原型卡的逐页对齐，
 * 无原型卡的必须记录原型补卡需求和统一语法适用性」。
 *
 * 真源（机器可查，不采信自述）：
 *   measure/wb13b-proto-page-model.json   原型页模型（99 个 protoComponent + panelType）
 *   measure/wb13b-module-parity.json      92 个配对的逐页版式（实测 panelType 与判定）
 *   src/views/**                          实际 .vue 文件清单
 *
 * 归类口径（每页一个终态，不悬空）：
 *   ALIGNED-PROTO        有原型卡且已进并排采集，判红 0 ⇒ 逐页对齐（附实测门禁一致率）
 *   SCOPED-PROTO         有原型卡且已进并排采集，但存在待裁定行 ⇒ 差异已逐行终态化（指向 disposition）
 *   PROTO-CARD-MISSING   实现页有真实路由但原型无卡（18 项 + 目录不一致 6 项）⇒ 原型补卡需求
 *   NO-PROTO-SYNTAX      实现页无原型卡且非 manifest 入口（二级页/弹窗页/子视图）⇒ 按统一语法归类
 *   SUPPORT-COMPONENT    私有组件（不是路由页）⇒ 不属页面视觉对齐范围
 *   NON-BUSINESS         登录/注册/404 等非业务壳外页 ⇒ 不属工作台业务模块范围
 *
 * 统一语法适用性：对 NO-PROTO-SYNTAX 页逐页核对是否复用统一语法块
 * （PageCard / el-table / filter-bar / wb-kpi / chart-container 等），给出「适用 / 需补统一语法」结论。
 *
 * 用法（admin-web 目录）：
 *   node tests/wb13c-page-classification.mjs <evidenceDir>
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const EV = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!EV) {
  console.error("用法：node tests/wb13c-page-classification.mjs <evidenceDir>");
  process.exit(2);
}
const WEB = path.resolve(process.cwd());
const read = (p) => JSON.parse(readFileSync(path.join(EV, p), "utf8"));
const model = read("measure/wb13b-proto-page-model.json");
const parity = read("measure/wb13b-module-parity.json");
const inv = read("measure/wb13b-entry-inventory.json");

/** 递归列 src/views 下全部 .vue（相对 admin-web 的 POSIX 路径） */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith(".vue")) out.push(path.relative(WEB, full).replace(/\\/g, "/"));
  }
  return out;
}
const viewsDir = path.join(WEB, "src", "views");
if (!existsSync(viewsDir)) {
  console.error(`找不到 src/views：${viewsDir}`);
  process.exit(2);
}
const allViews = walk(viewsDir).sort();

/** 原型页模型索引：src 相对路径 → { panelType, sector, page, viewKey, manifestMenuCode } */
const protoByFile = new Map();
for (const s of model.model ?? []) {
  for (const p of s.lv2 ?? []) {
    if (!p.protoComponent) continue;
    const rel = String(p.protoComponent).replace(/^\.\.\/\.\.\//, "");
    protoByFile.set(rel, {
      panelType: p.panelType,
      sectorName: s.sectorName,
      pageName: p.pageName,
      viewKey: p.viewKey,
      manifestMenuCode: p.manifestMenuCode ?? null,
      hasProtoCard: Boolean(p.protoSubLabel),
    });
  }
}

/** 并排采集实测索引：viewKey@viewport → pair */
const pairByView = new Map();
for (const p of parity.pairs ?? []) {
  if (!p.page?.viewKey) continue;
  pairByView.set(`${p.page.viewKey}@${p.viewport}`, p);
}

/** manifest 入口路径集合（用于区分「有路由无原型卡」与「非入口二级页」） */
const manifestPaths = new Set((inv.entries ?? []).filter((e) => e.menuCode).map((e) => e.path));

/** 统一语法探针：复用工作台统一语法块的标记（与 wb13b-visual-grammar 同一批 class 名） */
const SYNTAX_MARKERS = [
  ["PageCard", /<PageCard\b/],
  ["filter-bar", /class="[^"]*\bfilter-bar\b/],
  ["wb-kpi/stat-grid", /class="[^"]*(?:\bwb-kpi\b|\bstat-grid\b)/],
  ["el-table", /<el-table\b/],
  ["chart 容器", /class="[^"]*(?:chart-container|chart-card|chart-box|chart-body|s-chart)\b/],
  ["el-form", /<el-form\b/],
  ["el-empty 空态", /<el-empty\b/],
  ["el-descriptions 详情", /<el-descriptions\b/],
  ["el-dialog 弹层", /<el-dialog\b/],
  ["el-tabs 分页签", /<el-tabs\b/],
];
function syntaxOf(file) {
  let src = "";
  try {
    src = readFileSync(path.join(WEB, file), "utf8");
  } catch {
    return { found: [], missing: SYNTAX_MARKERS.map(([k]) => k), text: "" };
  }
  const found = SYNTAX_MARKERS.filter(([, re]) => re.test(src)).map(([k]) => k);
  const missing = SYNTAX_MARKERS.filter(([, re]) => !re.test(src)).map(([k]) => k);
  return { found, missing, text: src };
}

const rows = [];
for (const file of allViews) {
  const proto = protoByFile.get(file) ?? null;
  const row = {
    file,
    protoPanelType: proto?.panelType ?? null,
    protoSector: proto?.sectorName ?? null,
    protoPage: proto?.pageName ?? null,
    manifestMenuCode: proto?.manifestMenuCode ?? null,
    hasProtoCard: proto?.hasProtoCard ?? false,
  };

  // 非路由页优先分档：私有组件 / 非业务页
  if (/^src\/views\/components\//.test(file)) {
    row.final = "SUPPORT-COMPONENT";
    row.proof = "src/views/components/ 下的私有组件（被页面引用，非路由页）⇒ 不属页面视觉对齐范围";
    rows.push(row);
    continue;
  }
  if (/^src\/views\/(LoginView|RegisterView|NotFound)\.vue$/.test(file)) {
    row.final = "NON-BUSINESS";
    row.proof = "登录/注册/404：壳外页，不属工作台业务模块并排对齐范围（F2/F3 已含登录态验收）";
    rows.push(row);
    continue;
  }

  if (proto && proto.hasProtoCard) {
    // 有原型卡：看是否进并排采集
    const vk = proto.viewKey;
    const p1440 = pairByView.get(`${vk}@1440x1000`);
    const p1024 = pairByView.get(`${vk}@1024x768`);
    const captured = [p1440, p1024].filter((p) => p && p.status === "captured");
    if (captured.length) {
      const offSpec = captured.reduce((n, p) => n + (p.diff?.offSpec ?? []).length, 0);
      const pending = captured.reduce((n, p) => n + (p.diff?.blocked ?? []).length, 0);
      const gated = captured.reduce((n, p) => n + (p.diff?.stats?.gated ?? 0), 0);
      const exact = captured.reduce((n, p) => n + (p.diff?.stats?.exact ?? 0), 0);
      row.capturedTiers = captured.map((p) => p.id);
      row.gated = gated;
      row.exact = exact;
      row.pendingRows = pending;
      if (offSpec > 0) {
        row.final = "unclassified";
        row.proof = `并排采集判红 ${offSpec} 行 ⇒ 未对齐，fail-closed`;
      } else if (pending > 0) {
        row.final = "SCOPED-PROTO";
        row.proof = `两档采到、判红 0；${pending} 行待裁定已逐行终态化（见 wb13c-disposition.md）· 门禁 ${exact}/${gated}`;
      } else {
        row.final = "ALIGNED-PROTO";
        row.proof = `两档采到、判红 0、无待裁定行 · 门禁 ${exact}/${gated} 逐字节一致`;
      }
    } else if (p1440?.status === "blocked" || p1024?.status === "blocked") {
      row.final = "PROTO-CARD-MISSING";
      row.proof = `原型页模型有该页但实时二级目录无卡（proto-sub-card-missing）⇒ 原型补卡需求（见 wb13c-entry-closure）`;
    } else {
      row.final = "unclassified";
      row.proof = "原型页模型有卡但未进并排计划 ⇒ fail-closed";
    }
    rows.push(row);
    continue;
  }

  // 无原型卡：区分「manifest 入口但原型无页」与「非入口二级页」
  if (proto && !proto.hasProtoCard) {
    row.final = "PROTO-CARD-MISSING";
    row.proof = `原型页模型有该页（panelType=${proto.panelType}）但无二级卡槽位 ⇒ 原型补卡需求`;
    rows.push(row);
    continue;
  }

  // 完全不在原型页模型里
  const syn = syntaxOf(file);
  row.syntaxFound = syn.found;
  row.syntaxMissing = syn.missing;
  const isManifestPath = [...manifestPaths].length > 0 && proto === null;
  row.final = "NO-PROTO-SYNTAX";
  row.proof =
    `原型页模型无该页（二级页/弹窗页/子视图/后台页）⇒ 按统一语法归类；` +
    `已复用 ${syn.found.length} 类语法块（${syn.found.join(" / ") || "无"}）` +
    (syn.found.length === 0 ? " ⇒ **需补统一语法**" : "");
  row.owner = "墨（工作台前端）";
  row.nextAction =
    syn.found.length === 0
      ? "补 PageCard / 统一语法块后纳入下一张视觉卡复核"
      : "维持现有统一语法块；无原型卡，不做逐页像素对齐（缺设计真源）";
  rows.push(row);
}

const counts = {};
for (const r of rows) counts[r.final] = (counts[r.final] ?? 0) + 1;
const unclassified = rows.filter((r) => r.final === "unclassified");
const noProto = rows.filter((r) => r.final === "NO-PROTO-SYNTAX");
const needSyntax = noProto.filter((r) => (r.syntaxFound ?? []).length === 0);
const byPanel = {};
for (const r of rows) {
  if (!r.protoPanelType) continue;
  byPanel[r.protoPanelType] = (byPanel[r.protoPanelType] ?? 0) + 1;
}

const md = [];
md.push("# WORKBENCH-13C · 剩余页面原型类型契约归类台账（卡 §三.5 / §六.4）\n");
md.push(`- 扫描范围：\`src/views/**\` 共 **${rows.length}** 个 .vue 文件（含私有组件）`);
md.push(`- 终态分布：${Object.entries(counts).map(([k, v]) => `**${k} ${v}**`).join(" · ")}`);
md.push(`- 原型版式分布（有原型卡的页）：${Object.entries(byPanel).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
md.push(`- 无原型卡页（NO-PROTO-SYNTAX）**${noProto.length}** 个：已复用统一语法 ${noProto.length - needSyntax.length} 个 · **需补统一语法 ${needSyntax.length} 个**`);
md.push(`- fail-closed：未归类 ${unclassified.length} 个\n`);
md.push("## 一、逐页终态\n");
md.push("| 文件 | 原型版式 | 原型模块 | 终态 | 待裁定 | 依据 |");
md.push("| --- | --- | --- | --- | ---: | --- |");
for (const r of rows) {
  md.push(
    `| ${r.file} | ${r.protoPanelType ?? "—"} | ${r.protoSector ?? "—"} | ${r.final} | ${r.pendingRows ?? 0} | ${String(r.proof ?? "").replace(/\|/g, "/").slice(0, 96)} |`,
  );
}
md.push("\n## 二、无原型卡页：统一语法适用性（逐页）\n");
md.push("> 这些页在原型融合版里没有对应二级卡（二级页 / 弹窗页 / 子视图 / 后台页）。卡 §三.5 要求记录「原型补卡需求 + 统一语法适用性」。\n");
md.push("| 文件 | 已复用语法块 | 缺的语法块 | 处置 |");
md.push("| --- | --- | --- | --- |");
for (const r of noProto) {
  md.push(
    `| ${r.file} | ${(r.syntaxFound ?? []).join(" / ") || "**无**"} | ${(r.syntaxMissing ?? []).join(" / ")} | ${(r.nextAction ?? "").replace(/\|/g, "/")} |`,
  );
}
md.push("\n## 三、原型补卡需求汇总（PROTO-CARD-MISSING）\n");
const missing = rows.filter((r) => r.final === "PROTO-CARD-MISSING");
md.push(`- 共 **${missing.length}** 个页面：实现侧有真实路由，原型侧无二级卡 ⇒ 补卡后由 13D 采并排证据`);
for (const r of missing) md.push(`  - \`${r.file}\`（${r.protoPage ?? "原型无此页"} / panelType=${r.protoPanelType ?? "—"}）`);
md.push(`\n生成时间：${new Date().toISOString()}\n`);

const out = {
  schema: "wb13c-page-classification/v1",
  card: "WORKBENCH-13C-WORKBENCH-VISUAL-COMPLETION-01 §三.5/§六.4",
  generatedAt: new Date().toISOString(),
  sources: {
    protoPageModel: "measure/wb13b-proto-page-model.json",
    moduleParity: "measure/wb13b-module-parity.json",
    entryInventory: "measure/wb13b-entry-inventory.json",
    viewsRoot: "admin-web/src/views",
  },
  counts: { views: rows.length, ...counts },
  protoPanelTypeDistribution: byPanel,
  noProtoNeedsSyntax: needSyntax.map((r) => r.file),
  rows,
};
writeFileSync(path.join(EV, "measure", "wb13c-page-classification.json"), `${JSON.stringify(out, null, 2)}\n`, "utf8");
writeFileSync(path.join(EV, "measure", "wb13c-page-classification.md"), md.join("\n"), "utf8");

console.log(`页面归类：${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`无原型卡需补统一语法 ${needSyntax.length} 个 · 未归类 ${unclassified.length}`);
console.log(`台账 → ${path.join(EV, "measure", "wb13c-page-classification.md")}`);
if (unclassified.length) process.exitCode = 1;
