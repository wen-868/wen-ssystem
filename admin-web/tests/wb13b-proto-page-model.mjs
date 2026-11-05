/**
 * WORKBENCH-13B §三.A.1 / §三.A.5 —— 原型页面模型抽取 + 与人工入口联接
 *
 * 原型融合版自带机器可读的页面注册表（不是人工抄写）：
 *   · `const SECTORS=[...]`（L3013）：13 个版块 × lv2 页面 {k,n,t,c,a}
 *     - `k` = 视图键（二级卡 actSub → openWB(k) 命中 `__SEC_LV2[k]` → `secPanel(k)` 出页面）
 *     - `t` = 版式类型（board/list/form/detail/bill/order/print/pos/fuse）⇒ 页面类型视觉契约的来源
 *     - `c` = 该页面对应的实现组件路径 ⇒ 与 manifest 入口的联接键
 *     - `a` = 该页面声明的接口 ⇒ 数据/端点依赖的如实来源
 *   · `const MODS=[...]`（L2265）：11 个一级模块 × 二级卡 {n,i,t,v}（运行态会被 V12/V15 splice/push）
 *   · 版式工厂 `PANEL={list,form,detail,board,bill,order,print,fuse}`（L3273）+ `secPanel()`（L3277）
 *     = 卡 §三.A.5 所指「原型统一页面语法」：原型未为某页单独画界面时，按 PANEL[t] 的语法出图。
 *
 * 用法：`node tests/wb13b-proto-page-model.mjs <evidenceDir>`
 * 产物：`wb13b-proto-page-model.json` + `.md`
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_WEB = resolve(HERE, "..");
const SRC = join(ADMIN_WEB, "src");
const OUT = resolve(process.argv[2] ?? "");
if (!OUT) {
  console.error("用法: node tests/wb13b-proto-page-model.mjs <evidenceDir>");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const PROTO = process.env.WB13_PROTOTYPE ?? "D:/Users/ZXQL/ZXQL-WORK/projects/ai/design/智享全链_工作台电脑端_UI原型_融合版.html";
const PROTO_SHA_EXPECT = (process.env.WB13_PROTOTYPE_SHA256 ?? "6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51").toUpperCase();
if (!existsSync(PROTO)) {
  console.error(`原型文件不存在：${PROTO}`);
  process.exit(3);
}
const protoBuf = readFileSync(PROTO);
const protoSha = createHash("sha256").update(protoBuf).digest("hex").toUpperCase();
if (protoSha !== PROTO_SHA_EXPECT) {
  console.error(`原型 SHA256 不符：实测 ${protoSha} ≠ 卡面 ${PROTO_SHA_EXPECT}`);
  process.exit(3);
}
const lines = protoBuf.toString("utf8").split(/\r?\n/);

/** 在指定行附近找 `NAME=[...]` 的 JSON 数组字面量（原型里 SECTORS 是单行 JSON） */
function extractJsonArray(name) {
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf(`${name}=[`);
    if (idx < 0) continue;
    const from = idx + name.length + 1;
    let depth = 0;
    for (let j = from; j < lines[i].length; j++) {
      const ch = lines[i][j];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) return { value: JSON.parse(lines[i].slice(from, j + 1)), line: i + 1 };
      }
    }
  }
  return null;
}

/**
 * MODS 是 JS 对象字面量（键无引号、值用单引号），不是 JSON。
 * 原样求值，绝不「先改字符再 parse」——那会把值里的引号吃掉，抽出来的名单悄悄变形还不报错。
 * 求值失败即硬失败（抽取不可信时，证据必须没有，而不是有一份错的）。
 */
function extractMods() {
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf("const MODS=[");
    if (idx < 0) continue;
    const from = idx + "const MODS=".length;
    let depth = 0;
    for (let j = from; j < lines[i].length; j++) {
      if (lines[i][j] === "[") depth++;
      else if (lines[i][j] === "]") {
        depth--;
        if (depth === 0) {
          const lit = lines[i].slice(from, j + 1);
          try {
            const value = new Function(`return (${lit})`)();
            if (!Array.isArray(value) || value.some((m) => !m.k || !Array.isArray(m.subs))) return null;
            return { value, line: i + 1 };
          } catch (e) {
            console.error(`MODS 求值失败（L${i + 1}）：${String(e.message ?? e).slice(0, 160)}`);
            process.exit(1);
          }
        }
      }
    }
  }
  return null;
}

const sectorsWrap = extractJsonArray("SECTORS");
const modsWrap = extractMods();
if (!sectorsWrap || !modsWrap) {
  console.error(`抽取失败：SECTORS=${Boolean(sectorsWrap)} MODS=${Boolean(modsWrap)}`);
  process.exit(1);
}

/** PANEL 版式工厂与 secPanel 钩子（只登记锚点，供证据追溯） */
const panelLine = lines.findIndex((l) => l.includes("const PANEL={")) + 1;
const secPanelLine = lines.findIndex((l) => l.includes("function secPanel(")) + 1;
const renderWbHookLine = lines.findIndex((l) => l.includes("renderWB=function(){const k=WB_TAB")) + 1;
const actSubLine = lines.findIndex((l) => l.includes("function actSub(")) + 1;

// ── manifest 联接（组件路径为键）────────────────────────────────────────────
function parseManifest(file) {
  const text = readFileSync(join(SRC, "shared/workbench", file), "utf8");
  const out = [];
  let group = null;
  for (const line of text.split(/\r?\n/)) {
    const g = line.match(/groupCode:\s*"([^"]+)"/);
    if (g) {
      group = { groupCode: g[1], title: null };
      continue;
    }
    const t = line.match(/^\s*title:\s*"([^"]+)"/);
    if (t && group && !group.title) group.title = t[1];
    const it = line.match(/item\(\s*"([^"]+)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]+)",\s*\(\)\s*=>\s*import\("([^"]+)"\)\s*\)/);
    if (it && group) {
      out.push({
        groupCode: group.groupCode,
        groupTitle: group.title,
        menuCode: it[1],
        routeName: it[2],
        path: it[3],
        title: it[4],
        // `../../views/sale/X.vue` → `views/sale/X.vue`，与 SECTORS.c 同一口径
        compKey: it[5].replace(/^(\.\.)\//, "").replace(/^(\.\.\/)+/, ""),
      });
    }
  }
  return out;
}
const manifest = [...parseManifest("manifest-manual-a.ts"), ...parseManifest("manifest-manual-b.ts")];
const manifestByComp = new Map(manifest.map((m) => [m.compKey, m]));

// ── 路由联接（path → 真实 router 条目）──────────────────────────────────────
const routerText = readFileSync(join(SRC, "router/index.ts"), "utf8");
const routesByPath = new Map();
for (const line of routerText.split(/\r?\n/)) {
  const p = line.match(/\bpath:\s*"([^"]*)"/)?.[1];
  if (!p) continue;
  const abs = p.startsWith("/") ? p : `/${p}`;
  routesByPath.set(abs, {
    path: abs,
    name: line.match(/\bname:\s*"([^"]*)"/)?.[1] ?? null,
    compKey: line.match(/import\("([^"]+)"\)/)?.[1]?.replace(/^(\.\.\/)+/, "") ?? null,
    roles: [...(line.match(/roles:\s*\[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    title: line.match(/\btitle:\s*"([^"]*)"/)?.[1] ?? null,
  });
}

// ── 运行态二级目录联接（prototype-nav.ts = 实现侧渲染用的二级卡文案）────────────
/**
 * 同一份原型有两套机器可读结构，口径并不天然一致：
 *   · `SECTORS`（L3013）：每个 lv2 页面 = 一张**页面**（版式 `t` + 实现组件 `c` + 接口 `a`）
 *   · `PROTOTYPE_SUBCATALOG`（prototype-nav.ts）：F3 已验收的**运行态**二级卡文案，
 *     由 V12/V15 `trimMenu()` 对 `MODS` 做 splice/push 后实测而来
 * ⇒ §三.A.2 逐模块对照前必须先登记两者分歧（谁多谁少、差在哪一条），
 *   不能拿 SECTORS 的页面清单直接当实现侧应该出现的二级卡，反之亦然。
 */
function parsePrototypeNavCatalog() {
  const text = readFileSync(join(SRC, "shared/workbench", "prototype-nav.ts"), "utf8");
  const railItems = [...text.matchAll(
    /\{\s*key:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*groupCode:\s*(null|"[^"]+"),\s*kind:\s*"([^"]+)"/g,
  )].map((m) => ({ key: m[1], label: m[2], title: m[3], kind: m[5] }));
  const block = text.slice(text.indexOf("PROTOTYPE_SUBCATALOG"), text.indexOf("/** 第二列布局度量"));
  const catalog = {};
  for (const m of block.matchAll(/(?:^|[{,\s])"?([a-z-]+)"?\s*:\s*\[/g)) {
    const key = m[1];
    if (catalog[key]) continue;
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = open;
    for (let i = open; i < block.length; i++) {
      if (block[i] === "[") depth++;
      else if (block[i] === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    catalog[key] = [...block.slice(open, end).matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  return { railItems, catalog };
}
const nav = parsePrototypeNavCatalog();
const railByLabel = new Map(nav.railItems.map((r) => [r.label, r]));

/** SECTORS 页面清单 × 运行态二级目录 的分歧登记见下方 catalogReconciliation */

// ── 组装 ────────────────────────────────────────────────────────────────────
const modsBySectorKey = new Map(modsWrap.value.map((m) => [m.k, m]));
const model = sectorsWrap.value.map((sector) => {
  const mod = modsBySectorKey.get(sector.k) ?? null;
  const subsByView = new Map((mod?.subs ?? []).map((s) => [s.v, s]));
  return {
    sectorKey: sector.k,
    sectorName: sector.n,
    sectorDesc: sector.d ?? null,
    modsKey: mod?.k ?? null,
    modsName: mod?.n ?? null,
    modsSubCount: mod?.subs.length ?? 0,
    lv2: sector.lv2.map((page) => {
      const m = manifestByComp.get(page.c) ?? null;
      const route = m?.path ? routesByPath.get(m.path) ?? null : null;
      const sub = subsByView.get(page.k) ?? null;
      return {
        viewKey: page.k,
        pageName: page.n,
        panelType: page.t,
        protoComponent: page.c,
        protoApis: page.a ?? null,
        protoSubLabel: sub?.n ?? null,
        protoSubIcon: sub?.i ?? null,
        protoSubType: sub?.t ?? null,
        manifestMenuCode: m?.menuCode ?? null,
        manifestTitle: m?.title ?? null,
        manifestGroup: m?.groupCode ?? null,
        routeName: route?.name ?? null,
        routePath: m?.path ?? null,
        routeCompKey: route?.compKey ?? null,
        routeTitle: route?.title ?? null,
        routerComponentMatchesProto: route?.compKey ? route.compKey === page.c : null,
        superAdminVisible: route ? route.roles.includes("SUPER_ADMIN") : null,
      };
    }),
  };
});

const allPages = model.flatMap((s) => s.lv2);
const byType = {};
for (const p of allPages) byType[p.panelType] = (byType[p.panelType] ?? 0) + 1;
const businessSectors = model.filter((s) => s.sectorKey !== "dash" && s.sectorKey !== "pos");
const businessPages = businessSectors.flatMap((s) => s.lv2);

/** 版块 × 运行态二级目录 分歧登记 */
const catalogReconciliation = model.map((sector) => {
  const rail = railByLabel.get(sector.sectorName) ?? null;
  const runtime = rail ? nav.catalog[rail.key] ?? [] : [];
  const pageNames = sector.lv2.map((p) => p.pageName);
  return {
    sectorKey: sector.sectorKey,
    sectorName: sector.sectorName,
    railKey: rail?.key ?? null,
    runtimeCatalogCount: runtime.length,
    sectorsPageCount: pageNames.length,
    modsSubCount: sector.modsSubCount,
    onlyInSectors: pageNames.filter((n) => !runtime.includes(n)),
    onlyInRuntime: runtime.filter((l) => !pageNames.includes(l)),
    sameOrder: rail ? JSON.stringify(pageNames) === JSON.stringify(runtime) : null,
  };
});

/** 一个实现组件被多张原型页面复用 ⇒ 逐页对照时必须按页面分别出图，不能只截一次组件 */
const pagesByComponent = new Map();
for (const s of model) for (const p of s.lv2) {
  if (!p.protoComponent) continue;
  const list = pagesByComponent.get(p.protoComponent) ?? [];
  list.push(`${s.sectorKey}/${p.viewKey}`);
  pagesByComponent.set(p.protoComponent, list);
}
const sharedComponents = [...pagesByComponent].filter(([, pages]) => pages.length > 1).map(([comp, pages]) => `${comp} ← ${pages.join(", ")}`);

const summary = {
  sectors: model.length,
  businessSectors: businessSectors.length,
  pagesTotal: allPages.length,
  businessPages: businessPages.length,
  panelTypes: byType,
  manifestEntries: manifest.length,
  pagesLinkedToManifest: allPages.filter((p) => p.manifestMenuCode).length,
  pagesWithoutManifestLink: model.flatMap((s) =>
    s.lv2.filter((p) => !p.manifestMenuCode).map((p) => `${s.sectorName}/${p.viewKey}:${p.pageName}:${p.protoComponent}`),
  ),
  manifestEntriesWithoutProtoPage: manifest
    .filter((m) => !allPages.some((p) => p.protoComponent === m.compKey))
    .map((m) => `${m.menuCode}:${m.title}:${m.compKey}`),
  routerComponentDisagree: allPages.filter((p) => p.routerComponentMatchesProto === false).map((p) => `${p.viewKey}: proto「${p.protoComponent}」≠ router「${p.routeCompKey}」`),
  superAdminBlockedPages: allPages.filter((p) => p.superAdminVisible === false).map((p) => p.viewKey),
  catalogRailUnmatched: catalogReconciliation.filter((c) => !c.railKey).map((c) => `${c.sectorKey}:${c.sectorName}`),
  catalogDisagreementSectors: catalogReconciliation
    .filter((c) => c.railKey && (c.onlyInSectors.length || c.onlyInRuntime.length))
    .map((c) => `${c.sectorKey}: 仅SECTORS ${c.onlyInSectors.length}（${c.onlyInSectors.join("/") || "—"}）· 仅运行态 ${c.onlyInRuntime.length}（${c.onlyInRuntime.join("/") || "—"}）`),
  sharedComponents,
};

const report = {
  schema: "wb13b-proto-page-model@v1",
  prototype: { file: PROTO, sha256: protoSha, bytes: protoBuf.length, lines: lines.length },
  anchors: {
    sectorsLine: sectorsWrap.line,
    modsLine: modsWrap.line,
    panelFactoryLine: panelLine,
    secPanelLine,
    renderWbHookLine,
    actSubLine,
  },
  summary,
  catalogReconciliation,
  runtimeCatalogs: nav.catalog,
  model,
};
writeFileSync(join(OUT, "wb13b-proto-page-model.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# WB13B §三.A.1/§三.A.5 原型页面模型（机抽取）\n");
md.push(`- 原型：\`${PROTO}\` · SHA256 \`${protoSha}\`（与卡面一致）· ${protoBuf.length} bytes`);
md.push(`- 抽取锚点：SECTORS L${sectorsWrap.line} · MODS L${modsWrap.line} · PANEL 版式工厂 L${panelLine} · secPanel() L${secPanelLine} · renderWB 钩子 L${renderWbHookLine} · actSub() L${actSubLine}`);
md.push(`- ${summary.sectors} 版块（其中一级业务模块 ${summary.businessSectors}）／${summary.pagesTotal} 个页面（业务 ${summary.businessPages}）`);
md.push(`- 版式分布：${Object.entries(byType).map(([k, v]) => `${k}×${v}`).join(" · ")}`);
md.push(
  "- 页面 ↔ manifest 入口联接：" +
    `${summary.pagesLinkedToManifest}/${summary.pagesTotal}；无原型页面对应的 manifest 入口 ${summary.manifestEntriesWithoutProtoPage.length}；` +
    "router 组件与原型 SECTORS.c 不符 " +
    `${summary.routerComponentDisagree.length}\n`,
);
md.push("## 一、版块 × 页面 × 入口联接\n");
md.push("| 版块 | 视图键 | 页面名 | 版式 | 原型二级卡 | 二级序号 | manifest menuCode | 路由名 | 路由 | 组件一致 | SUPER_ADMIN | 接口 |");
md.push("| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |");
for (const s of model) {
  const subs = modsBySectorKey.get(s.sectorKey)?.subs ?? [];
  for (const p of s.lv2) {
    const idx = subs.findIndex((x) => x.v === p.viewKey);
    md.push(
      `| ${s.sectorName} | ${p.viewKey} | ${p.pageName} | ${p.panelType} | ${p.protoSubLabel ?? "—"} | ${idx >= 0 ? idx + 1 : "—"} | ${p.manifestMenuCode ?? "—"} | ${p.routeName ?? "—"} | ${p.routePath ?? "—"} | ${p.routerComponentMatchesProto === null ? "n/a" : p.routerComponentMatchesProto ? "✓" : "✗"} | ${p.superAdminVisible === null ? "n/a" : p.superAdminVisible ? "✓" : "✗"} | ${p.protoApis ?? "—"} |`,
    );
  }
}
md.push("\n## 二、未联接项（如实登记，不隐藏）\n");
md.push(`### 原型有页面、manifest 无入口（${summary.pagesWithoutManifestLink.length}）`);
for (const x of summary.pagesWithoutManifestLink) md.push(`- ${x}`);
md.push(`\n### manifest 有入口、原型无页面（${summary.manifestEntriesWithoutProtoPage.length}）`);
for (const x of summary.manifestEntriesWithoutProtoPage) md.push(`- ${x}`);
if (summary.routerComponentDisagree.length) {
  md.push(`\n### 原型 SECTORS.c 与 router 组件不符（${summary.routerComponentDisagree.length}）`);
  for (const x of summary.routerComponentDisagree) md.push(`- ${x}`);
}
writeFileSync(join(OUT, "wb13b-proto-page-model.md"), md.join("\n") + "\n", "utf8");
console.log(JSON.stringify({ ok: true, summary, anchors: report.anchors }, null, 2));
process.exit(0);
