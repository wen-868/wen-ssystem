/**
 * WORKBENCH-13B §三.B · 71 个真源入口逐条覆盖矩阵（fail-closed）
 *
 * 与采集器分工：采集器只产「能配对的页面」的并排证据；本工具反过来从 A1 的 71 条真源入口清单出发，
 * 逐条问「这一条在两档视口各是什么档」—— 没采到的、采了但判红的、采了且诚实阻断的，都必须有名有姓。
 * 为什么必须独立成一份：只看 bundle.summary 的聚合数会把「根本没进计划的入口」算成不存在，
 * 于是 40 个配对全绿也能盖住 31 条没量的入口（卡 §三.B.1「覆盖矩阵逐入口」正是针对这种静默漏采）。
 *
 * 处置档（卡 §三.A.7 的三种去向，逐入口而非逐指标）：
 *   修复   —— 两档都采到、判红 0 行 ⇒ 本单口径下逐字节对齐（含超容差但已书面解释的行仍算已处置）
 *   豁免   —— 采到但存在待裁定行（差值真实，改它要动本单禁区）⇒ 必须带 owner，逐条进回传待裁定
 *   阻断   —— 诚实阻断（原型侧无对应二级卡 / 到达路径不可点）或本单范围外（默认工作台属 F2/F3 壳层证据）
 *   FAIL   —— 既没采集也没有诚实阻断记录 ⇒ 覆盖缺口，工具以非 0 退出（不接受「口头已覆盖」）
 *
 *   node tests/wb13b-coverage-matrix.mjs <evidenceDir>
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const EV = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!EV) {
  console.error("用法：node tests/wb13b-coverage-matrix.mjs <evidenceDir>");
  process.exit(2);
}

const inv = JSON.parse(readFileSync(path.join(EV, "measure/wb13b-entry-inventory.json"), "utf8"));
const bundle = JSON.parse(readFileSync(path.join(EV, "measure/wb13b-module-parity.json"), "utf8"));
assert.match(inv.schema, /^wb13b-entry-inventory[@/]v1$/, "入口清单 schema 不符");
assert.match(bundle.schema, /^wb13b-module-parity[@/]v1$/, "并排证据 schema 不符");

/** 71 条真源入口＝manifest 声明了 menuCode 的那些（原型卡是「待接入」，不是入口本身） */
const entries = inv.entries.filter((e) => e.menuCode);
if (entries.length !== inv.counts?.manifestEntries) {
  console.error(`入口清单自相矛盾：manifestEntries=${inv.counts?.manifestEntries} 实数 ${entries.length}`);
  process.exit(1);
}

const tiers = bundle.viewports ?? [];
const pairs = bundle.pairs ?? [];
/** 配对 ⇄ 入口：采集器只在 captured 分支写 entry，阻断的配对没有 ⇒ 退回 page.routePath 匹配 */
const pairFor = (entry, viewport) =>
  pairs.find(
    (p) =>
      p.viewport === viewport &&
      (p.entry?.menuCode ? p.entry.menuCode === entry.menuCode : p.page?.routePath === entry.path),
  ) ?? null;

const DESK_RAIL = "desk";
const rows = [];
for (const e of entries) {
  const byTier = {};
  for (const vp of tiers) {
    const p = pairFor(e, vp);
    if (!p) {
      byTier[vp] = { status: "not-planned" };
      continue;
    }
    if (p.status === "blocked") {
      byTier[vp] = { status: "blocked", pairId: p.id, reason: p.block?.reason ?? "—", detail: p.block?.detail ?? "", owner: p.block?.owner ?? "", followUp: p.block?.followUp ?? "" };
      continue;
    }
    const d = p.diff ?? {};
    byTier[vp] = {
      status: "captured",
      pairId: p.id,
      panelType: p.panelType,
      offSpec: (d.offSpec ?? []).length,
      pending: (d.blocked ?? []).length,
      explained: (d.explained ?? []).length,
      exempted: (d.exempted ?? []).length,
      gated: d.stats?.gated ?? 0,
      exact: d.stats?.exact ?? 0,
      maxAbsDelta: d.stats?.maxAbsDelta ?? 0,
      rhythm: (p.rhythm ?? []).length,
      fonts: (p.fonts ?? []).length,
      signatureEqual: p.signatures?.equal === true,
      owners: [...new Set((d.blocked ?? []).map((r) => r.owner).filter(Boolean))],
      shots: { prototype: p.shots?.prototype?.sha256?.slice(0, 12) ?? null, implementation: p.shots?.implementation?.sha256?.slice(0, 12) ?? null },
    };
  }
  const tierList = Object.values(byTier);
  const captured = tierList.filter((t) => t.status === "captured");
  const red = tierList.reduce((n, t) => n + (t.offSpec ?? 0), 0);
  const pending = tierList.reduce((n, t) => n + (t.pending ?? 0), 0);
  const owners = [...new Set(tierList.flatMap((t) => t.owners ?? []))];
  let disposition;
  if (red > 0) disposition = "判红";
  else if (e.railKey === DESK_RAIL) {
    // 默认工作台不属于 13B 的业务页范围（F2/F3 已有壳层与默认台证据），但矩阵不许把它抹掉 ⇒ 单列一档
    disposition = "范围外";
  } else if (captured.length === tiers.length && tiers.length > 0) disposition = pending > 0 ? "豁免（待裁定）" : "修复";
  else if (captured.length > 0) disposition = "覆盖缺口";
  else if (tierList.every((t) => t.status === "blocked")) disposition = "阻断";
  else if (tiers.length && tierList.every((t) => t.status === "not-planned") && !e.protoSubnavLabel) {
    // 36 条 manifest 入口在原型侧根本没有二级卡（清单口径 navStatus=no-proto-slot）⇒ 无从并排，诚实阻断而不是「已覆盖」
    disposition = "阻断（原型无卡）";
  } else disposition = "覆盖缺口";
  rows.push({
    menuCode: e.menuCode,
    railKey: e.railKey,
    moduleTitle: e.railLabel ?? e.groupTitle,
    title: e.title,
    path: e.path,
    navStatus: e.navStatus,
    protoSubnavLabel: e.protoSubnavLabel ?? null,
    reachability: e.reachability,
    disposition,
    capturedTiers: captured.map((t) => t.pairId),
    pendingRows: pending,
    owners,
    block: disposition === "阻断（原型无卡）"
      ? {
          reason: "proto-sub-card-missing",
          detail: `入口清单里本条 navStatus=${e.navStatus}、无原型二级卡文案（reachability=${e.reachability ?? "—"}）⇒ 原型侧没有可真实点击的对应卡，无法并排采集`,
          owner: "墨（WORKBENCH-13B）",
          followUp: "WORKBENCH-13C：原型补二级卡或把该入口从「工作台人工入口」口径中除名（由凌舟裁定）",
        }
      : null,
    byTier,
  });
}

/** 反向核对：证据里不得有「71 条之外」的孤儿配对（说明连接键写错或采了别的域的页面） */
const known = new Set(entries.flatMap((e) => [e.menuCode, e.path]));
const orphans = pairs.filter((p) => (p.entry?.menuCode ? !known.has(p.entry.menuCode) : !known.has(p.page?.routePath ?? "")));

const counts = {};
for (const r of rows) counts[r.disposition] = (counts[r.disposition] ?? 0) + 1;

const failClosed = [];
for (const r of rows) {
  if (r.disposition === "判红") failClosed.push({ menuCode: r.menuCode, kind: "off-spec", tiers: r.byTier });
  if (r.disposition === "覆盖缺口") failClosed.push({ menuCode: r.menuCode, kind: "not-covered", tiers: r.byTier });
}
for (const p of orphans) failClosed.push({ pair: p.id, kind: "orphan-pair" });
for (const r of rows.filter((x) => x.disposition === "豁免（待裁定）")) {
  if (!r.owners.length) failClosed.push({ menuCode: r.menuCode, kind: "pending-without-owner" });
}
// 诚实阻断必须齐 reason/owner/followUp（与采集器门禁同一把尺子，这里再兜一层：矩阵口径下缺件＝覆盖缺口）
for (const r of rows) {
  for (const [vp, t] of Object.entries(r.byTier)) {
    if (t.status === "blocked" && (!t.reason || !t.owner || !t.followUp)) failClosed.push({ menuCode: r.menuCode, tier: vp, kind: "blocked-incomplete" });
  }
}

const OUT_DIR = path.join(EV, "measure");
const md = [];
md.push("# WORKBENCH-13B §三.B · 71 个真源入口逐条覆盖矩阵\n");
md.push(`- 真源入口 **${rows.length}** 条（清单口径 manifestEntries=${inv.counts.manifestEntries}）· 视口档 ${tiers.join(" / ")} · 证据配对 ${pairs.length} 条（采集 ${pairs.filter((p) => p.status === "captured").length} · 阻断 ${pairs.filter((p) => p.status === "blocked").length}）`);
md.push(`- 处置分布：${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
md.push(`- fail-closed：既没采到也没有诚实阻断的入口 ${failClosed.filter((f) => f.kind === "not-covered").length} 条 · 仍有判红行 ${failClosed.filter((f) => f.kind === "off-spec").length} 条 · 孤儿配对 ${orphans.length} 条 · 待裁定无归属 ${failClosed.filter((f) => f.kind === "pending-without-owner").length} 条`);
md.push(`- 390×844 手机档属卡 §三.D 响应式回归，另由 wb13b-responsive 证据出，不进本矩阵的两档判定\n`);
md.push("## 一、逐入口判定");
md.push("| menuCode | 模块 | 页面 | 到达 | 1440×1000 | 1024×768 | 处置 | 待裁定 | 归属 |");
md.push("| --- | --- | --- | --- | --- | --- | --- | ---: | --- |");
const cell = (r, vp) => {
  const t = r.byTier[vp];
  if (!t || t.status === "not-planned") return "未进计划";
  if (t.status === "blocked") return `阻断 ${t.reason}`;
  return `采到 门禁${t.exact}/${t.gated} 红${t.offSpec} 待裁${t.pending} 节奏${t.rhythm} 字体${t.fonts} 签名${t.signatureEqual ? "✓" : "✗"}`;
};
for (const r of rows) {
  md.push(`| ${r.menuCode} | ${r.moduleTitle} | ${r.title} | ${r.navStatus}/${r.reachability ?? "—"} | ${cell(r, tiers[0])} | ${cell(r, tiers[1])} | ${r.disposition} | ${r.pendingRows} | ${(r.owners[0] ?? "—").slice(0, 40)} |`);
}
md.push("\n## 二、阻断与范围外逐条理由（不得当成通过）\n");
md.push("| menuCode | 页面 | 档 | 原因 | 说明 | 归属 | 后续卡 |");
md.push("| --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) {
  for (const [vp, t] of Object.entries(r.byTier)) {
    if (t.status === "blocked") md.push(`| ${r.menuCode} | ${r.title} | ${vp} | ${t.reason} | ${String(t.detail).replace(/\|/g, "/").slice(0, 120)} | ${t.owner} | ${t.followUp} |`);
  }
  if (r.block) md.push(`| ${r.menuCode} | ${r.title} | 两档都不进计划 | ${r.block.reason} | ${String(r.block.detail).replace(/\|/g, "/").slice(0, 140)} | ${r.block.owner} | ${r.block.followUp} |`);
  if (r.disposition === "范围外") md.push(`| ${r.menuCode} | ${r.title} | — | 本单范围外 | 默认工作台（F2/F3 壳层与默认台已验收） | 墨（WORKBENCH-13B） | 不归 13B 业务模块对齐 |`);
}
md.push("\n## 三、待裁定行归属汇总（回传卡 §四 交接面）\n");
const pendingRows = rows.filter((r) => r.pendingRows > 0);
md.push(`- 共 ${pendingRows.length} 个入口带待裁定行 · 合计 ${pendingRows.reduce((n, r) => n + r.pendingRows, 0)} 行`);
const ownerMap = {};
for (const r of pendingRows) for (const o of r.owners) ownerMap[o] = (ownerMap[o] ?? 0) + r.pendingRows;
for (const [o, n] of Object.entries(ownerMap)) md.push(`  - ${o}：${n} 行`);
md.push(`\n生成时间：${new Date().toISOString()}\n`);

const json = {
  schema: "wb13b-coverage-matrix/v1",
  card: "WORKBENCH-13B-WORKBENCH-MODULE-VISUAL-PARITY-01",
  generatedAt: new Date().toISOString(),
  sources: { entryInventory: "measure/wb13b-entry-inventory.json", parityBundle: "measure/wb13b-module-parity.json", prototypeSha256: bundle.prototypeSource?.sha256 ?? null },
  viewports: tiers,
  counts: { entries: rows.length, pairs: pairs.length, ...counts },
  failClosed,
  orphans: orphans.map((p) => ({ id: p.id, moduleKey: p.moduleKey, page: p.page?.viewKey ?? null, routePath: p.page?.routePath ?? null })),
  rows,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, "wb13b-coverage-matrix.json"), `${JSON.stringify(json, null, 2)}\n`, "utf8");
writeFileSync(path.join(OUT_DIR, "wb13b-coverage-matrix.md"), `${md.join("\n")}\n`, "utf8");

console.log(`71 条入口判定：${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`fail-closed 条目 ${failClosed.length} · 孤儿配对 ${orphans.length}`);
console.log(`矩阵 → ${path.join(OUT_DIR, "wb13b-coverage-matrix.md")}`);
if (failClosed.length) {
  for (const f of failClosed.slice(0, 20)) console.log(`  ✗ ${JSON.stringify(f).slice(0, 160)}`);
  process.exitCode = 1;
}
