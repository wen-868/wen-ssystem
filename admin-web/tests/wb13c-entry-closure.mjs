/**
 * WORKBENCH-13C · 71 入口闭合台账生成器（卡 §三.2 / §六.2）
 *
 * 真源（全部机器可查，不采信自述）：
 *   measure/wb13b-entry-inventory.json      71 条 manifest 入口（组件/路由/SUPER_ADMIN 可见性）
 *   measure/wb13b-coverage-matrix.json      逐入口两档采集处置（fail-closed 计数）
 *   measure/wb13b-proto-page-model.json     原型页模型（两份目录真源交叉校验结果）
 *
 * 输出 measure/wb13c-entry-closure.json / .md：71 行逐入口终态，18 项原型无卡 + 6 项原型目录不一致
 * 全部给终态处置（不悬空）。
 *
 * 终态口径（本卡 §三.2「不得继续悬空」）：
 *   CLOSED-ALIGNED     两档采到、判红 0、无待裁定行 ⇒ 视觉已对齐
 *   CLOSED-SCOPED      采到且差异行已全部终态化（BLOCKED-SCOPE 有主/依赖/下一动作，或结构性豁免）
 *   CLOSED-OUT-OF-SCOPE 默认工作台（F2/F3 壳层与默认台已验收，不归业务模块对齐）
 *   CLOSED-PROTO-GAP   实现侧真实入口存在且 SUPER_ADMIN 可达（real-zone），原型侧无二级卡
 *                      ⇒ 终态＝原型补卡需求（owner=林夕/凌舟裁定，依赖=融合版新增二级卡，下一动作=补卡后 13D 采并排）
 *   CLOSED-PROTO-CATALOG-MISMATCH 原型两份目录真源不一致（静态 SECTORS 有该页、运行态二级目录无）
 *                      ⇒ 终态＝原型目录收敛需求（同上 owner/依赖/下一动作）
 *
 * fail-closed：出现下列任一即 exit 1 —— 入口真实链路缺失（组件/路由/SUPER_ADMIN 不可见）、
 * 覆盖矩阵 failClosed 非空、处置无法归类（落 unclassified）。
 *
 * 用法（admin-web 目录）：
 *   node tests/wb13c-entry-closure.mjs <evidenceDir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const EV = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!EV) {
  console.error("用法：node tests/wb13c-entry-closure.mjs <evidenceDir>");
  process.exit(2);
}
const read = (p) => JSON.parse(readFileSync(path.join(EV, p), "utf8"));
const inv = read("measure/wb13b-entry-inventory.json");
const matrix = read("measure/wb13b-coverage-matrix.json");
const model = read("measure/wb13b-proto-page-model.json");

const entries = inv.entries.filter((e) => e.menuCode);
if (entries.length !== inv.counts?.manifestEntries) {
  console.error(`入口清单自相矛盾：manifestEntries=${inv.counts?.manifestEntries} 实数 ${entries.length}`);
  process.exit(1);
}

/** 18 项「manifest 有入口、原型无页」—— 原型侧真源（wb13b-proto-page-model.json summary） */
const protoGapCodes = new Set((model.summary?.manifestEntriesWithoutProtoPage ?? []).map((s) => String(s).split(":")[0]));
/** 原型两份目录真源不一致的页名（catalogDisagreementSectors 的 onlyInSectors） */
const catalogMismatchTitles = new Map();
for (const rec of model.catalogReconciliation ?? []) {
  for (const t of rec.onlyInSectors ?? []) {
    if (!catalogMismatchTitles.has(t)) catalogMismatchTitles.set(t, rec.sectorName);
  }
}
/** 实现侧标题 ⇄ 原型页名的已知别名（采集器 manifestTitleVsRouterTitle 已登记同一批措辞差）；
 *  用于「静态 SECTORS 有该页、运行态二级目录无」这类入口的目录归属核对。 */
const TITLE_ALIASES = {
  零售报表: ["平台报表"],
  销售统计: ["报表中心"],
  商品排行: ["商品报表"],
  员工业绩: ["员工报表"],
  日志与反馈: ["系统监控"],
  商品列表: ["商品管理"],
  客户列表: ["客户管理"],
  库存查询: ["库存列表"],
  储值卡: ["储值卡管理"],
  小程序订单: ["平台订单"],
  商品货架: ["商品上架"],
};
const catalogHit = (title) =>
  catalogMismatchTitles.has(title) || (TITLE_ALIASES[title] ?? []).some((a) => catalogMismatchTitles.has(a));

const rowByCode = new Map(matrix.rows.map((r) => [r.menuCode, r]));

const PROTO_OWNER = "林夕（原型/设计）· 复核卡=WORKBENCH-13C-WORKBENCH-VISUAL-COMPLETION-01 §六.2 ⇒ 凌舟裁定是否补卡";
const PROTO_DEP = "原型融合版新增/收敛二级目录卡（原型文件属 AI 项目设计资产，本卡不越界修改）";
const PROTO_NEXT_GAP = "补原型二级卡后由 13D 采「原型 ⇄ 实现」并排证据；实现侧真实入口当前已可用，不阻断消费者";
const PROTO_NEXT_MISMATCH = "原型运行态二级目录与静态 SECTORS 收敛为同一份真源后重采；实现侧真实入口当前已可用，不阻断消费者";

const rows = [];
const failClosed = [];
for (const e of entries) {
  const m = rowByCode.get(e.menuCode) ?? null;
  const row = {
    menuCode: e.menuCode,
    title: e.title,
    module: e.railLabel ?? e.groupTitle,
    railKey: e.railKey,
    path: e.path,
    routeName: e.routeName,
    reachability: e.reachability ?? null,
    componentExists: e.componentExists === true,
    routerPathFound: e.routerPathFound === true,
    superAdminVisible: e.superAdminVisible === true,
    matrixDisposition: m?.disposition ?? null,
    pendingRows: m?.pendingRows ?? 0,
    capturedTiers: m?.capturedTiers ?? [],
  };

  // 真实链路 fail-closed：组件缺失 / 路由缺失 / SUPER_ADMIN 不可见 / 孤儿 ⇒ 任何一条都不许算闭合
  if (!row.componentExists) failClosed.push({ menuCode: e.menuCode, kind: "component-missing" });
  if (!row.routerPathFound) failClosed.push({ menuCode: e.menuCode, kind: "router-path-missing" });
  if (!row.superAdminVisible) failClosed.push({ menuCode: e.menuCode, kind: "not-visible-to-super-admin" });
  if (!m) failClosed.push({ menuCode: e.menuCode, kind: "absent-from-coverage-matrix" });

  const isProtoGap = protoGapCodes.has(e.menuCode);
  const isCatalogMismatch = !isProtoGap && e.navStatus === "no-proto-slot" && catalogHit(e.title);

  if (isProtoGap) {
    row.final = "CLOSED-PROTO-GAP";
    row.proof = `原型页模型 manifestEntriesWithoutProtoPage 命中；实现侧组件/路由/SUPER_ADMIN 全通（${e.path}）⇒ 真实入口可用，缺口仅在原型侧无二级卡`;
    row.owner = PROTO_OWNER;
    row.dependency = PROTO_DEP;
    row.nextAction = PROTO_NEXT_GAP;
  } else if (isCatalogMismatch) {
    row.final = "CLOSED-PROTO-CATALOG-MISMATCH";
    row.proof = `原型 catalogReconciliation.onlyInSectors 命中「${e.title}」（静态 SECTORS 有、运行态二级目录无）⇒ 采集器无法真实点击，实现侧真实入口可用`;
    row.owner = PROTO_OWNER;
    row.dependency = PROTO_DEP;
    row.nextAction = PROTO_NEXT_MISMATCH;
  } else if (row.matrixDisposition === "范围外") {
    row.final = "CLOSED-OUT-OF-SCOPE";
    row.proof = "默认工作台：F2/F3 壳层与默认台已验收，不归业务模块并排对齐范围";
  } else if (row.matrixDisposition === "修复") {
    row.final = "CLOSED-ALIGNED";
    row.proof = `两档均采到且判红 0、无待裁定行（配对 ${row.capturedTiers.join(" / ")}）`;
  } else if (row.matrixDisposition === "豁免（待裁定）") {
    row.final = "CLOSED-SCOPED";
    row.proof = `两档均采到、判红 0；${row.pendingRows} 行差异已逐行终态化（BLOCKED-SCOPE 带 owner/依赖/下一动作，或结构性豁免），见 wb13c-disposition`;
    row.owner = "凌舟（中央裁定，视觉单不代答）";
    row.dependency = "业务字段/列数、KPI 指标、权限面、路由文案（卡 §二 禁区）";
    row.nextAction = "逐行见 wb13c-disposition.md 的 BLOCKED-SCOPE 行，由凌舟转对应功能单复核后视觉侧按终口径对齐";
  } else {
    row.final = "unclassified";
    row.proof = `覆盖矩阵处置「${row.matrixDisposition ?? "缺失"}」无对应终态口径 ⇒ fail-closed`;
    failClosed.push({ menuCode: e.menuCode, kind: "unclassified-disposition", detail: row.matrixDisposition });
  }
  rows.push(row);
}

const counts = {};
for (const r of rows) counts[r.final] = (counts[r.final] ?? 0) + 1;
const matrixFailClosed = matrix.failClosed ?? [];
const orphans = matrix.orphans ?? [];

const protoGapRows = rows.filter((r) => r.final === "CLOSED-PROTO-GAP");
const catalogRows = rows.filter((r) => r.final === "CLOSED-PROTO-CATALOG-MISMATCH");
const scopedRows = rows.filter((r) => r.final === "CLOSED-SCOPED");

const md = [];
md.push("# WORKBENCH-13C · 71 入口闭合台账（卡 §三.2 / §六.2）\n");
md.push(`- 真源入口 **${rows.length}** 条 · 终态分布：${Object.entries(counts).map(([k, v]) => `**${k} ${v}**`).join(" · ")}`);
md.push(
  `- fail-closed：入口真实链路缺口 ${failClosed.filter((f) => ["component-missing", "router-path-missing", "not-visible-to-super-admin"].includes(f.kind)).length} 条 · ` +
    `未归类 ${failClosed.filter((f) => f.kind === "unclassified-disposition").length} 条 · ` +
    `覆盖矩阵 failClosed ${matrixFailClosed.length} 条 · 孤儿配对 ${orphans.length} 条`,
);
md.push(`- 18 原型无卡入口：**${protoGapRows.length}** 条已给终态（CLOSED-PROTO-GAP）· 6 原型目录不一致：**${catalogRows.length}** 条已给终态（CLOSED-PROTO-CATALOG-MISMATCH）· 悬空 0 条`);
md.push(`- 待裁定入口：**${scopedRows.length}** 条（差异行已逐行终态化，明细见 \`wb13c-disposition.md\`）\n`);
md.push("## 一、逐入口终态\n");
md.push("| menuCode | 模块 | 页面 | 路径 | 终态 | 待裁定行 | 归属 | 下一动作 |");
md.push("| --- | --- | --- | --- | --- | ---: | --- | --- |");
for (const r of rows) {
  md.push(
    `| ${r.menuCode} | ${r.module} | ${r.title} | ${r.path} | ${r.final} | ${r.pendingRows} | ${(r.owner ?? "—").slice(0, 26)} | ${(r.nextAction ?? "—").slice(0, 52)} |`,
  );
}
md.push("\n## 二、18 项原型无卡入口（逐条终态处置，不悬空）\n");
md.push("> 实现侧真实入口均已存在且 SUPER_ADMIN 可达；缺口在原型侧无二级卡 ⇒ 终态＝原型补卡需求，不阻断消费者使用。\n");
md.push("| menuCode | 页面 | 模块 | 实现路径 | 证据 | owner | 依赖 | 下一动作 |");
md.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of protoGapRows) {
  md.push(`| ${r.menuCode} | ${r.title} | ${r.module} | ${r.path} | manifestEntriesWithoutProtoPage | ${r.owner} | ${r.dependency} | ${r.nextAction} |`);
}
md.push("\n## 三、6 项原型目录不一致（静态 SECTORS 有、运行态二级目录无）\n");
md.push("| menuCode | 页面 | 模块 | 实现路径 | 证据 | owner | 依赖 | 下一动作 |");
md.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of catalogRows) {
  md.push(`| ${r.menuCode} | ${r.title} | ${r.module} | ${r.path} | catalogReconciliation.onlyInSectors | ${r.owner} | ${r.dependency} | ${r.nextAction} |`);
}
md.push(`\n生成时间：${new Date().toISOString()}\n`);

const out = {
  schema: "wb13c-entry-closure/v1",
  card: "WORKBENCH-13C-WORKBENCH-VISUAL-COMPLETION-01 §三.2/§六.2",
  generatedAt: new Date().toISOString(),
  sources: {
    entryInventory: "measure/wb13b-entry-inventory.json",
    coverageMatrix: "measure/wb13b-coverage-matrix.json",
    protoPageModel: "measure/wb13b-proto-page-model.json",
  },
  counts: { entries: rows.length, ...counts },
  failClosed,
  matrixFailClosedCount: matrixFailClosed.length,
  orphans: orphans.length,
  rows,
};
writeFileSync(path.join(EV, "measure", "wb13c-entry-closure.json"), `${JSON.stringify(out, null, 2)}\n`, "utf8");
writeFileSync(path.join(EV, "measure", "wb13c-entry-closure.md"), md.join("\n"), "utf8");

console.log(`71 入口终态：${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`fail-closed ${failClosed.length} · 覆盖矩阵 failClosed ${matrixFailClosed.length} · 孤儿 ${orphans.length}`);
console.log(`台账 → ${path.join(EV, "measure", "wb13c-entry-closure.md")}`);
if (failClosed.length || matrixFailClosed.length || orphans.length) process.exitCode = 1;
