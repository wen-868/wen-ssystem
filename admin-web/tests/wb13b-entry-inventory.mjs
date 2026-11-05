/**
 * WORKBENCH-13B §三.A.1 / §三.B.7 —— 人工入口真源清单生成器
 *
 * 真源（不做人工抄写）：
 * - `src/shared/workbench/manifest-manual-a.ts` + `manifest-manual-b.ts`（12 组 71 项）
 * - `src/router/index.ts`（真实路由：path/name/component/meta.roles/meta.title）
 * - `src/shared/workbench/prototype-nav.ts`（原型 rail + 二级目录，实测值）
 * - `tests/fixtures/workbench-prototype-rail.json`（同一份原型数据的机器副本，交叉校验）
 *
 * 产物：`wb13b-entry-inventory.json` + `wb13b-entry-inventory.md`
 * 用法：`node tests/wb13b-entry-inventory.mjs <evidenceDir>`
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_WEB = resolve(HERE, "..");
const SRC = join(ADMIN_WEB, "src");
const outDir = process.argv[2];
if (!outDir) {
  console.error("用法: node tests/wb13b-entry-inventory.mjs <evidenceDir>");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const read = (p) => readFileSync(p, "utf8");
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

// ── 1. 路由真源 ──────────────────────────────────────────────────────────────
const routerText = read(join(SRC, "router/index.ts"));
const routesByPath = new Map();
const routesByName = new Map();
for (const line of routerText.split(/\r?\n/)) {
  if (!/\bpath:\s*"/.test(line)) continue;
  const path = line.match(/\bpath:\s*"([^"]*)"/)?.[1];
  const name = line.match(/\bname:\s*"([^"]*)"/)?.[1] ?? null;
  const comp = line.match(/import\("([^"]+)"\)/)?.[1] ?? null;
  const rolesRaw = line.match(/roles:\s*\[([^\]]*)\]/)?.[1] ?? "";
  const roles = [...rolesRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const title = line.match(/\btitle:\s*"([^"]*)"/)?.[1] ?? null;
  if (!path) continue;
  const abs = path.startsWith("/") ? path : `/${path}`;
  const entry = { path: abs, name, comp, roles, title, hasRoles: roles.length > 0 };
  routesByPath.set(abs, entry);
  if (name) routesByName.set(name, entry);
}

// ── 2. 人工入口 manifest 真源 ────────────────────────────────────────────────
function parseManifest(file) {
  const text = read(join(SRC, "shared/workbench", file));
  const groups = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const g = line.match(/groupCode:\s*"([^"]+)"/);
    if (g) {
      current = { groupCode: g[1], title: null, items: [] };
      groups.push(current);
      continue;
    }
    const t = line.match(/^\s*title:\s*"([^"]+)"/);
    if (t && current && !current.title) {
      current.title = t[1];
      continue;
    }
    const it = line.match(
      /item\(\s*"([^"]+)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]+)",\s*\(\)\s*=>\s*import\("([^"]+)"\)\s*\)/,
    );
    if (it && current) {
      const [, menuCode, routeName, path, title, compRel] = it;
      current.items.push({
        menuCode,
        routeName: routeName || null,
        path: path || null,
        title,
        compRel,
      });
    }
  }
  return groups;
}
const groups = [
  ...parseManifest("manifest-manual-a.ts"),
  ...parseManifest("manifest-manual-b.ts"),
];

// ── 3. 原型真源（rail + 二级目录）+ 夹具交叉校验 ─────────────────────────────
const navText = read(join(SRC, "shared/workbench/prototype-nav.ts"));
const railItems = [...navText.matchAll(
  /\{\s*key:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*groupCode:\s*(null|"[^"]+"),\s*kind:\s*"([^"]+)"/g,
)].map((m) => ({
  key: m[1],
  label: m[2],
  title: m[3],
  groupCode: m[4] === "null" ? null : m[4].replace(/"/g, ""),
  kind: m[5],
}));
const catBlock = navText.slice(
  navText.indexOf("PROTOTYPE_SUBCATALOG"),
  navText.indexOf("/** 第二列布局度量"),
);
const protoCatalog = {};
{
  const keys = [...catBlock.matchAll(/(?:^{|\s|,)\s*"?([a-z-]+)"?\s*:\s*\[/g)].map((m) => m[1]);
  for (const key of keys) {
    const start = catBlock.indexOf(`${key}: [`) >= 0 ? catBlock.indexOf(`${key}: [`) : catBlock.indexOf(`"${key}": [`);
    const open = catBlock.indexOf("[", start);
    let depth = 0, end = open;
    for (let i = open; i < catBlock.length; i++) {
      if (catBlock[i] === "[") depth++;
      else if (catBlock[i] === "]") { depth--; if (depth === 0) { end = i; break; } }
    }
    protoCatalog[key] = [...catBlock.slice(open, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }
}
const fixturePath = join(ADMIN_WEB, "tests/fixtures/workbench-prototype-rail.json");
const fixture = JSON.parse(read(fixturePath));
/**
 * 两份原型真源交叉校验：`prototype-nav.ts`（运行态代码真源）× `workbench-prototype-rail.json`（WORKBENCH-10 实测夹具）。
 * 「设置」按实现口径回落到 desk 的「常用功能」（`resolveSubnavCatalogKey`），
 * 夹具里记的是**运行态实际渲染**的六项，故比对必须先做同一回落，否则会误报顺序分歧。
 */
const catalogCrossCheck = railItems.map((r) => {
  const fallback = (protoCatalog[r.key] ?? []).length === 0;
  const resolved = fallback ? "desk" : r.key;
  const navList = protoCatalog[resolved] ?? [];
  const fixList = fixture.subnavByName[r.label] ?? null;
  return {
    railKey: r.key,
    railLabel: r.label,
    resolvedCatalogKey: resolved,
    settingsStyleFallback: fallback,
    navTsCount: navList.length,
    fixtureCount: (fixList ?? []).length,
    sameOrder: JSON.stringify(navList) === JSON.stringify(fixList ?? []),
  };
});

const railByGroup = new Map(railItems.filter((r) => r.groupCode).map((r) => [r.groupCode, r]));

/**
 * 复刻实现侧口径（`WorkbenchSubnav.vue:299-312` × `prototype-nav.ts:resolveSubnavCatalogKey`）：
 * - 「设置」无专属二级目录 ⇒ 回落到 desk 的「常用功能」（原型实测行为）；
 * - 「常用功能」六宫格按**全量已接线入口**匹配，module 态才只取本组项；
 * - 二级目录显示的一律是原型文案，manifest 项只提供路由；标题逐字命中才算 wired。
 */
function resolveCatalogKey(railKey) {
  if (!railKey) return "desk";
  return (protoCatalog[railKey] ?? []).length > 0 ? railKey : "desk";
}
const ALL_ITEMS = groups.flatMap((g) => g.items);

/** 复刻 `planPrototypeSubnav`（`prototype-nav.ts:275-287`）：labels 与匹配池按标题逐字命中，一个入口只吃一个槽位 */
function planCatalog(railKey, pool) {
  const labels = protoCatalog[resolveCatalogKey(railKey)] ?? [];
  const remaining = [...pool];
  return labels.map((label, index) => {
    const hit = remaining.findIndex((entry) => entry.title === label);
    if (hit < 0) return { index, label, status: "pending", item: null };
    const [item] = remaining.splice(hit, 1);
    return { index, label, status: "wired", item };
  });
}
/**
 * 「常用功能」快面（quick 态）的匹配池是**全量入口**（`WorkbenchSubnav.vue:311` 传 `groups.flatMap(g => g.items)`），
 * 所以六张卡认领的往往是别的组的页面（如「库存查询」→ wb.inventory）。
 * 若按 wb.dashboard 自己那一条入口去对账，六张卡会全报「待接入」——那是把实现口径抄错，
 * 会把已经能点开的原型槽位误登记成缺口。
 */
const quickPlan = planCatalog("desk", ALL_ITEMS);
const quickClaimByMenu = new Map(quickPlan.filter((p) => p.item).map((p) => [p.item.menuCode, p]));

// ── 4. 逐项对账 ──────────────────────────────────────────────────────────────
const entries = [];
/** 原型有槽位、本目录匹配池未认领 ⇒ 仍登记为 pending（实现侧渲染但禁用标「待接入」，不得静默丢弃，派单卡 §六） */
function protoSlotRow(group, rail, catalogKey, slot, claimsMenuCode, claimsGroupCode) {
  return {
    groupCode: group.groupCode,
    groupTitle: group.title,
    railKey: rail?.key ?? null,
    catalogKey,
    railLabel: rail?.label ?? null,
    menuCode: null,
    claimsMenuCode,
    claimsGroupCode,
    routeName: null,
    path: null,
    title: slot.label,
    component: null,
    componentExists: null,
    routerPathFound: null,
    routerName: null,
    routerTitle: null,
    routerRoles: [],
    superAdminVisible: null,
    routeNameMatchesRouter: null,
    titleMatchesRouterMeta: null,
    protoSubnavLabel: slot.label,
    protoSubnavIndex: slot.index,
    quickSlotLabel: null,
    quickSlotIndex: -1,
    navStatus: slot.status === "wired" ? "wired" : "pending",
  };
}
for (const group of groups) {
  const rail = railByGroup.get(group.groupCode) ?? null;
  const catalogKey = rail ? resolveCatalogKey(rail.key) : null;
  const isQuickRail = rail?.key === "desk";
  // module 态匹配池 = 本组入口；quick（常用功能）态匹配池 = 全量入口
  const plan = isQuickRail ? quickPlan : planCatalog(rail?.key ?? "desk", group.items);
  const slotByMenu = new Map(plan.filter((p) => p.item).map((p) => [p.item.menuCode, p]));
  for (const item of group.items) {
    const route = item.path ? routesByPath.get(item.path) : null;
    const byName = item.routeName ? routesByName.get(item.routeName) : null;
    const compAbs = resolve(SRC, "shared/workbench", item.compRel);
    const slot = slotByMenu.get(item.menuCode) ?? null;
    const quick = quickClaimByMenu.get(item.menuCode) ?? null;
    entries.push({
      groupCode: group.groupCode,
      groupTitle: group.title,
      railKey: rail?.key ?? null,
      catalogKey,
      railLabel: rail?.label ?? null,
      menuCode: item.menuCode,
      claimsMenuCode: item.menuCode,
      claimsGroupCode: group.groupCode,
      routeName: item.routeName,
      path: item.path,
      title: item.title,
      component: item.compRel,
      componentExists: existsSync(compAbs),
      routerPathFound: Boolean(route),
      routerName: route?.name ?? null,
      routerTitle: route?.title ?? null,
      routerRoles: route?.roles ?? [],
      superAdminVisible: (route?.roles ?? []).includes("SUPER_ADMIN"),
      routeNameMatchesRouter: Boolean(route && byName && route.name === item.routeName),
      titleMatchesRouterMeta: route ? route.title === item.title : null,
      protoSubnavLabel: slot ? slot.label : null,
      protoSubnavIndex: slot ? slot.index : -1,
      quickSlotLabel: quick ? quick.label : null,
      quickSlotIndex: quick ? quick.index : -1,
      navStatus: slot ? "wired" : "no-proto-slot",
    });
  }
  for (const slot of plan) {
    if (slot.status === "wired") {
      // 本组自己的入口已用带 menuCode 的行承载该槽位，不重复出一行
      if (!isQuickRail || slot.item.groupCode === group.groupCode) continue;
      entries.push(protoSlotRow(group, rail, catalogKey, slot, slot.item.menuCode, slot.item.groupCode));
      continue;
    }
    entries.push(protoSlotRow(group, rail, catalogKey, slot, null, null));
  }
}

// ── 4b. 到达路径（实现侧渲染口径：`WorkbenchSubnav.vue:56-104`）────────────────
// module 态除原型二级卡外另有「已接入入口（N）」real zone，承载本组全部 manifest 项；
// quick（常用功能）态不渲染 real zone，只渲染那 6 张原型卡，且匹配池是**全量入口**。
for (const e of entries) {
  if (!e.menuCode) continue;
  const ownCatalog = e.catalogKey === "desk" ? "proto-slot(quick)" : "proto-slot(module)";
  e.reachability =
    e.navStatus === "wired" ? ownCatalog : e.quickSlotLabel ? "proto-slot(quick)" : "real-zone(module)";
}

// ── 5. 汇总 ─────────────────────────────────────────────────────────────────
const manifestOnly = entries.filter((e) => e.menuCode);
const counts = {
  groups: groups.length,
  manifestEntries: manifestOnly.length,
  wired: manifestOnly.filter((e) => e.navStatus === "wired").length,
  noProtoSlot: manifestOnly.filter((e) => e.navStatus === "no-proto-slot").length,
  protoPending: entries.filter((e) => e.navStatus === "pending").length,
  protoSlotsTotal: entries.filter((e) => e.protoSubnavIndex >= 0).length,
  wiredSlots: entries.filter((e) => e.navStatus === "wired").length,
  quickGridSlots: quickPlan.length,
  quickGridWired: quickPlan.filter((p) => p.status === "wired").length,
  quickGridWiredByOtherGroup: quickPlan.filter((p) => p.item && p.item.groupCode !== "wb.dashboard").map((p) => `${p.label}→${p.item.menuCode}`),
  reachableViaQuickGrid: manifestOnly.filter((e) => e.reachability === "proto-slot(quick)").length,
  reachableViaRealZone: manifestOnly.filter((e) => e.reachability === "real-zone(module)").length,
  unreachableFromWorkbench: manifestOnly.filter((e) => e.reachability === "none").map((e) => e.menuCode),
  businessModules: railItems.filter((r) => r.kind === "module").length,
  defects: {
    componentMissing: manifestOnly.filter((e) => e.componentExists === false).map((e) => e.menuCode),
    routerPathMissing: manifestOnly.filter((e) => e.routerPathFound === false).map((e) => e.menuCode),
    routeNameMismatch: manifestOnly.filter((e) => e.routeNameMatchesRouter === false).map((e) => e.menuCode),
    notVisibleToSuperAdmin: manifestOnly.filter((e) => e.superAdminVisible === false).map((e) => e.menuCode),
    manifestTitleVsRouterTitle: manifestOnly
      .filter((e) => e.titleMatchesRouterMeta === false)
      .map((e) => `${e.menuCode}: manifest「${e.title}」≠ router「${e.routerTitle}」`),
    catalogOrderDisagreement: catalogCrossCheck.filter((c) => !c.sameOrder).map((c) => c.railKey),
  },
};

const report = {
  schema: "wb13b-entry-inventory@v1",
  generatedFrom: {
    manifestA: "src/shared/workbench/manifest-manual-a.ts",
    manifestB: "src/shared/workbench/manifest-manual-b.ts",
    router: "src/router/index.ts",
    prototypeNav: "src/shared/workbench/prototype-nav.ts",
    fixture: "tests/fixtures/workbench-prototype-rail.json",
    routerEntriesParsed: routesByPath.size,
  },
  counts,
  catalogCrossCheck,
  groups: groups.map((g) => {
    const rail = railByGroup.get(g.groupCode);
    const labels = rail ? protoCatalog[resolveCatalogKey(rail.key)] ?? [] : [];
    const mine = manifestOnly.filter((e) => e.groupCode === g.groupCode);
    const rows = entries.filter((e) => e.groupCode === g.groupCode);
    return {
      groupCode: g.groupCode,
      groupTitle: g.title,
      railKey: rail?.key ?? null,
      railLabel: rail?.label ?? null,
      subnavHead: fixture.headByName[rail?.label ?? ""] ?? null,
      manifestItemCount: mine.length,
      protoCatalogCount: labels.length,
      wiredCount: rows.filter((e) => e.navStatus === "wired").length,
      protoPendingLabels: rows.filter((e) => e.navStatus === "pending").map((e) => e.title),
      manifestTitlesWithoutProtoSlot: mine.filter((e) => e.navStatus === "no-proto-slot").map((e) => e.title),
      protoCatalog: labels,
    };
  }),
  entries,
};

writeFileSync(join(outDir, "wb13b-entry-inventory.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

// Markdown 矩阵
const md = [];
md.push("# WB13B §三.A.1 人工入口真源清单（机生成）\n");
md.push(`- 真源：\`manifest-manual-a.ts\` + \`manifest-manual-b.ts\` + \`src/router/index.ts\` + \`prototype-nav.ts\` + \`fixtures/workbench-prototype-rail.json\``);
md.push(`- 组数 **${counts.groups}** ／ manifest 入口 **${counts.manifestEntries}** ／ 原型二级槽位 **${counts.protoSlotsTotal}**（wired ${counts.wiredSlots} · 待接入 ${counts.protoPending}）`);
md.push(`- manifest 有、原型二级目录无槽位：**${counts.noProtoSlot}**；其中经「常用功能」六宫格到达 ${counts.reachableViaQuickGrid}，经 module 态「已接入入口」real zone 到达 ${counts.reachableViaRealZone}，工作台内不可达 ${counts.unreachableFromWorkbench.length}`);
md.push(`- 原型二级槽位总数 **${counts.protoSlotsTotal}**（wired ${counts.wiredSlots} + 待接入 ${counts.protoPending}）；待接入项实现侧渲染但禁用并标「待接入」，不静默丢弃（§六）`);
md.push(`- 「常用功能」六宫格按**全量入口**匹配（` + "`WorkbenchSubnav.vue:311`" + `）：6 槽中 wired ${counts.quickGridWired}，其中跨组认领 ${counts.quickGridWiredByOtherGroup.length} → ${counts.quickGridWiredByOtherGroup.join("、") || "—"}`);
md.push(`- 缺陷：组件缺失 ${counts.defects.componentMissing.length} · 路由缺失 ${counts.defects.routerPathMissing.length} · 路由名不符 ${counts.defects.routeNameMismatch.length} · SUPER_ADMIN 不可见 ${counts.defects.notVisibleToSuperAdmin.length} · 标题与 router meta 不符 ${counts.defects.manifestTitleVsRouterTitle.length} · 原型目录两份真源顺序不符 ${counts.defects.catalogOrderDisagreement.length}\n`);
md.push("## 一、12 组 × 原型二级目录 汇总\n");
md.push("| 组码 | 组题 | rail 键 | rail 标签 | 二级栏标题 | manifest 项 | 原型二级项 | wired | 原型待接入 | manifest 无槽位 |");
md.push("| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |");
for (const g of report.groups) {
  md.push(
    `| ${g.groupCode} | ${g.groupTitle} | ${g.railKey ?? "—"} | ${g.railLabel ?? "—"} | ${g.subnavHead ?? "—"} | ${g.manifestItemCount} | ${g.protoCatalogCount} | ${g.wiredCount} | ${g.protoPendingLabels.join("、") || "—"} | ${g.manifestTitlesWithoutProtoSlot.join("、") || "—"} |`,
  );
}
md.push("\n## 二、逐项对账（71 个 manifest 入口 + 原型未接线二级项）\n");
md.push("| 组 | rail | 状态 | 到达路径 | 名称 | menuCode | routeName | path | 组件存在 | router 命中 | router 标题 | SUPER_ADMIN | 原型二级序号 | 常用功能卡 | 槽位归属组 |");
md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- |");
for (const e of entries) {
  md.push(
    `| ${e.groupTitle} | ${e.railKey ?? "—"} | ${e.navStatus} | ${e.reachability ?? "—"} | ${e.title} | ${e.menuCode ?? "—"} | ${e.routeName ?? "—"} | ${e.path ?? "—"} | ${e.componentExists === null ? "n/a" : e.componentExists ? "✓" : "✗"} | ${e.routerPathFound === null ? "n/a" : e.routerPathFound ? "✓" : "✗"} | ${e.routerTitle ?? "—"} | ${e.superAdminVisible === null ? "n/a" : e.superAdminVisible ? "✓" : "✗"} | ${e.protoSubnavIndex >= 0 ? e.protoSubnavIndex + 1 : "—"} | ${e.quickSlotLabel ?? "—"} | ${e.claimsGroupCode ?? "—"} |`,
  );
}
md.push("\n## 三、原型二级目录两份真源交叉校验\n");
md.push("| railKey | rail 标签 | 回落目录 | 专属目录为空 | prototype-nav.ts | fixture JSON | 顺序一致 |");
md.push("| --- | --- | --- | --- | ---: | ---: | --- |");
for (const c of catalogCrossCheck) {
  md.push(
    `| ${c.railKey} | ${c.railLabel} | ${c.resolvedCatalogKey} | ${c.settingsStyleFallback ? "是" : "否"} | ${c.navTsCount} | ${c.fixtureCount} | ${c.sameOrder ? "✓" : "✗"} |`,
  );
}
writeFileSync(join(outDir, "wb13b-entry-inventory.md"), md.join("\n") + "\n", "utf8");

const protoFile = fixture.source.prototype;
const protoSha = existsSync(protoFile) ? sha(protoFile) : null;
console.log(
  JSON.stringify(
    {
      ok: true,
      counts,
      prototype_sha256: protoSha,
      prototype_sha256_match: protoSha && protoSha.toUpperCase() === fixture.source.prototype_sha256.toUpperCase(),
      exitGate: "0=真源自洽",
    },
    null,
    2,
  ),
);
process.exit(counts.defects.componentMissing.length + counts.defects.routerPathMissing.length + counts.defects.routeNameMismatch.length + counts.defects.catalogOrderDisagreement.length === 0 ? 0 : 1);
