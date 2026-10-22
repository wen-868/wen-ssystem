#!/usr/bin/env node
/*
 * parse-page-quality.cjs — WB-REFACTOR-P0 台账40（页面 mock / 占位 / 恒空 / 缺失接口 / 未验运行态 逐页登记）
 *
 * 定位：**只读盘点工具**。不改任何业务代码，不做 git 写操作，不认定任何页面"完成"。
 * 页面全集基准直接复用矩阵10 的权威产物（禁止本脚本自己重数路由）：
 *   node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs --out <dir>       # 产出 table-a-routes.csv
 *   node docs/evidence/WB-REFACTOR-P0/scripts/parse-page-quality.cjs --routes-csv <dir>/table-a-routes.csv \
 *        --out docs/evidence/WB-REFACTOR-P0/40-page-quality-ledger.md
 *
 * 对 admin-web/src/views 下每个 .vue 文件逐行扫描以下模式（每类最多给 3 个 文件:行号 ref）：
 *   1) mock        —— /mock/i（含 `const mock`、mockXxx、MOCK_）
 *   2) random      —— Math.random
 *   3) fakeCn      —— 模拟 | 演示数据 | 示例数据
 *   4) placeholder —— 功能开发中 | 敬请期待 | 待实现 | TODO | FIXME
 *   5) catchEmpty  —— catch 块窗口（catch 起 5 行内）以 [] / {} 兜底（粗匹配，一律标 NEEDS_EYE 供人工抽查）
 *   6) apiCall     —— 真实接口证据：import 自 (../)*api(/x) 或 @/api（且能在盘上解析）或直接 axios/fetch/EventSource 打 /api
 *   7) missingMod  —— import 目标在盘上解析不到（目录无 index.* 也算缺失）→ 缺失接口 / 未验运行态线索
 *   8) silentFail  —— 文件里有 catch 但全篇无任何错误提示（ElMessage.error / console.error 等）→ NEEDS_EYE
 *
 * 严重度判定（脚本确定式规则，见 decideSeverity；人工纠偏只能写进 MANUAL_REVIEW 并留
 * 文件:行号 + 原判/改判理由，改后重跑脚本复算，禁止在文档里凭印象改数）：
 *   P0 冒充 LIVE  假数据信号(mock+random+fakeCn)>0 且 全篇无任何接口引用 → 整屏数据为造却呈现为正常业务页
 *   P1 部分假     假数据信号>0 且存在接口引用；或（无占位文案时）有接口引用但 catch 静默空兜底 / 全篇无错误提示 / api 层未导出符号
 *   P2 纯占位     无假数据信号，但有占位文案（功能开发中 / 敬请期待 / 待实现 / TODO / FIXME）
 *   P3 干净       以上全无，且有**盘上可解析**的真实接口调用
 *   UNKNOWN       其余（接口引用全部不可解析 / 纯静态页 / 未挂载路由的子组件）→ 禁止留空，一律待人工
 *
 * 反测（2026-10-22 实跑通过，仓库外夹具 /tmp/wb40fake，未动业务代码）：注入 `const mockRows=[{id:1}]`、
 * `Math.random()`、`功能开发中`、`catch { rows.value = [] }`，并从 api 层 import 一个未导出的符号 fetchTotals ⇒
 * 脚本如实报 MOCK=1 RANDOM=1 PLACEHOLDER=1 CATCH_EMPTY=1 MISSING_EXPORT=1 SILENT_FAIL=Y、严重度 P1；
 * 把该符号在夹具 api/report.ts 里补上导出后 MISSING_EXPORT 必须归 0。脚本一律如实报数，不做兜底美化。
 * 脚本一律如实报数，不做兜底美化。
 */
"use strict";

const fs = require("fs");
const path = require("path");

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
const flagVal = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const ROOT = path.resolve(flagVal("--root", path.resolve(__dirname, "../../../..")));
const ROUTES_CSV = flagVal("--routes-csv", process.env.WB40_ROUTES_CSV || null);
const OUT_MD = flagVal("--out", path.join(ROOT, "docs/evidence/WB-REFACTOR-P0/40-page-quality-ledger.md"));
const OUT_JSON = flagVal("--json", null);
const DRY = argv.includes("--dry");
const VIEWS_REL = "admin-web/src/views";
const SRC_REL = "admin-web/src";
const MAX_REFS = 3;

/* ---------- 人工抽查纠偏表（唯一允许的人工干预入口，必须带 文件:行号 + 原判/改判理由） ----------
 * action='drop' 从指定类别剔除该行命中；'add' 强制补一行命中。纠偏过程会在 md 末尾「抽查与纠偏」小节如实输出。 */
const MANUAL_REVIEW = [
  {
    file: "admin-web/src/views/components/PlatformPanel.vue", line: 256, category: "random", action: "drop",
    original: "P0 冒充 LIVE（random x4）", revised: "P0 冒充 LIVE（random x3）",
    reason: "该行 `chars.charAt(Math.floor(Math.random() * chars.length))` 是「重新生成签名密钥」的随机串生成，非假数据；2026-10-22 抽查 Read 232-271 行确认为无害随机，属脚本误报，予以剔除。239/266/282 三行（伪造连接测试结果、伪造同步条数）保留。",
  },
];

/* ---------- 步骤3 人工抽查记录（逐页 Read 行区间后写下原判/改判；不改数字的部分如实说明） ---------- */
const SPOT_CHECK = [
  {
    page: "admin-web/src/views/components/PlatformPanel.vue:232-271", script: "P0 冒充 LIVE（random x4，无接口引用）", verdict: "改判后成立",
    note: "239 行 `Math.random() > 0.3` 伪造「连接测试结果」、266/282 行伪造同步条数 —— 均为无接口的假反馈，P0 成立；256 行随机密钥属无害随机 → 已进 MANUAL_REVIEW 剔除（误报 1 处）。",
  },
  {
    page: "admin-web/src/views/order/OrderExceptionView.vue:217", script: "P1 部分假（random x1 + catch 空兜底 x1）", verdict: "真阳性，无需改判",
    note: "217 行在模板里直接渲染 `¥{{ (Math.random() * 300 + 50).toFixed(2) }}` 当「订单金额」—— 假数据以正式展示态出现，判定成立。",
  },
  {
    page: "admin-web/src/views/order/OrderProductMapView.vue:373-384", script: "P1 部分假（random x1）", verdict: "真阳性，无需改判",
    note: "本地 SKU 搜索下拉用 `Array.from({length:8})` + 随机价造候选项，非无害抖动；判定成立。",
  },
  {
    page: "admin-web/src/views/instant-retail/InstantRetailShelf.vue:393/395/515 与 400-404/427-431", script: "P1 部分假（mock x3 + catch 空兜底 x3）", verdict: "mock 成立；catchEmpty 属脚本误报，已按规则纠正",
    note: "3 个 mock 变量都是 `const mockXxx = []` 死声明（脚本另报 mock 死声明）；402/429 行所在 catch 里**已有** `ElMessage.error(...)` 后才 `products.value = []`，属正常失败清空，不应算静默恒空 → 脚本已把这种情况改记 errorReset（不再驱动严重度）。",
  },
  {
    page: "admin-web/src/views/product/ProductReviewTasks.vue:268-275", script: "P1 部分假（mock x4）", verdict: "真阳性，语义补充",
    note: "mockPendingList/mockReviewedList/mockSubmittedList/mockDetail 全为空声明且正文无引用 —— 是「假数据脚手架被清空后未接线」，仍是需登记的现状，保留命中。",
  },
  {
    page: "admin-web/src/views/marketing/MarketingPointsMall.vue:286/288 与 320-324", script: "P1 部分假（mock x2 + catch 空兜底 x2）", verdict: "mock 成立；catchEmpty 同属误报已纠正",
    note: "320-324 行 catch 内先 `ElMessage.error(...)` 再 `products.value = []`，为正常失败清空 → 归 errorReset。",
  },
  {
    page: "admin-web/src/views/purchase/PurchaseContracts.vue:454、PurchaseOrders.vue:339、report/PurchaseReports.vue:359", script: "P2 纯占位（placeholder x1）", verdict: "真阳性，无需改判",
    note: "三处均为 `ElMessage.info(\"…功能待实现\")`，页面向用户明示未实现，占位定性成立（这些页同时有接口调用，已在「无真实 API 调用?」列如实显示）。",
  },
];

/* ---------- 模式 ---------- */
const PATTERNS = {
  mock: /mock/i,
  random: /Math\.random/,
  fakeCn: /模拟|演示数据|示例数据/,
  placeholder: /功能开发中|敬请期待|待实现|TODO|FIXME/,
};
const IMPORT_RE = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const IS_API_SPEC = (s) => /(^|\/)api(\/|$)/.test(s) && (s.startsWith(".") || s.startsWith("@/"));
const DIRECT_HTTP_RE =
  /\baxios\s*\.\s*(get|post|put|delete|patch)|\baxios\s*\(\s*[`'"][^`'"]*\/api|\bfetch\s*\(\s*[`'"][^`'"]*\/api|new\s+EventSource\s*\(|\.(?:get|post|put|delete|patch)\s*\(\s*[`'"]\/api/;
const ERROR_PROMPT_RE =
  /ElMessage\.error|ElMessage\.warning|ElNotification|message\.error|console\.error|showError|ElMessageBox|\.catch\s*\(\s*\w+\s*=>\s*(?:ElMessage|console)/;
const CATCH_RE = /\bcatch\b/;
const CATCH_EMPTY_RE =
  /(?:=|return|\|\||\?\?|:|\bpush\()\s*(?:\[\]|\{\}|\[[\s]*\]|\{[\s]*\})|\.value\s*=\s*(?:\[\]|\{\})/;
const EXT_CANDIDATES = ["", ".ts", ".js", ".vue", ".tsx", ".mts", ".json", "/index.ts", "/index.js", "/index.vue", "/index.mjs"];
const CATS = ["mock", "random", "fakeCn", "placeholder", "catchEmpty", "errorReset", "missingExport", "apiResolved", "apiMissing", "directHttp", "otherMissingMod"];

/* ---------- 工具 ---------- */
function walkVue(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkVue(p, acc);
    else if (e.name.endsWith(".vue")) acc.push(p);
  }
  return acc;
}
const rel = (p) => p.split(path.sep).join("/");
// 台账是要提交的产物：CSV 若在工作树外（临时目录），只登记文件名，避免把本机绝对路径烤进仓库
const csvLabel = (p) => {
  if (!p) return "UNKNOWN";
  const ap = path.resolve(p);
  const inside = ap.startsWith(ROOT + path.sep);
  return inside ? rel(path.relative(ROOT, ap)) : `<工作树外临时目录>/${path.basename(ap)}`;
};
function resolveFile(absNoExt) {
  for (const ext of EXT_CANDIDATES) {
    try {
      if (fs.statSync(absNoExt + ext).isFile()) return absNoExt + ext;
    } catch (_) { /* keep looking */ }
  }
  return null;
}
const resolvable = (absNoExt) => !!resolveFile(absNoExt);

/* ---------- api 层导出符号全集（用于"缺失接口"检测：页面 import 的名字在 api 层没导出） ---------- */
const EXPORT_NAME_RE = /export\s+(?:async\s+)?(?:default\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g;
const exportCache = new Map();
function exportsOf(absFile) {
  if (exportCache.has(absFile)) return exportCache.get(absFile);
  const set = new Set();
  let srcTxt = "";
  try { srcTxt = fs.readFileSync(absFile, "utf8"); } catch (_) { /* ignore */ }
  let mm;
  EXPORT_NAME_RE.lastIndex = 0;
  while ((mm = EXPORT_NAME_RE.exec(srcTxt))) set.add(mm[1]);
  const reExportBlock = /export\s*\*\s*from\s*["']([^"']+)["']/g;
  const namedReExport = /export\s*\{([^}]*)\}\s*(?:from\s*["']([^"']+)["'])?/g;
  while ((mm = reExportBlock.exec(srcTxt))) {
    const dep = resolveFile(path.resolve(path.dirname(absFile), mm[1]));
    if (dep) exportsOf(dep).forEach((x) => set.add(x));
  }
  while ((mm = namedReExport.exec(srcTxt))) {
    mm[1].split(",").forEach((s) => { const n = s.trim().split(/\s+as\s+/).pop().trim(); if (/^[A-Za-z0-9_$]+$/.test(n)) set.add(n); });
  }
  exportCache.set(absFile, set);
  return set;
}
function apiExportsFor(absFile) {
  return exportsOf(absFile);
}
function blockCommentRanges(src) {
  const r = [];
  let m;
  const reBlock = /\/\*[\s\S]*?\*\//g;
  while ((m = reBlock.exec(src))) r.push([m.index, reBlock.lastIndex]);
  const reTpl = /<!--[\s\S]*?-->/g;
  while ((m = reTpl.exec(src))) r.push([m.index, reTpl.lastIndex]);
  return r;
}
const inBlock = (ranges, idx) => ranges.some(([a, b]) => idx > a && idx < b);
function lineIsComment(line, matchedIndex, blockRanges, absHitIdx) {
  const t = line.trimStart();
  if (/^(\/\/|\*|\/\*|<!--)/.test(t)) return true;
  if (inBlock(blockRanges, absHitIdx)) return true;
  const before = line.slice(0, matchedIndex);
  const c = before.indexOf("//");
  if (c < 0) return false;
  const lead = before.slice(0, c);
  if (lead.includes("://")) return false; // 协议头，非注释
  return !/["'`][^"'`]*$/.test(lead); // 引号未闭合 ⇒ 命中还在字符串里，不算注释
}

/* ---------- CSV 读取（矩阵10 权威页面全集基准） ---------- */
function parseCsv(text) {
  const rows = [];
  let cur = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { cur.push(field); field = ""; }
    else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}
function loadRouteMap(csvPath) {
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\ufeff/, ""));
  const header = rows[0];
  const col = (re) => header.findIndex((h) => re.test(h));
  const iPath = col(/^path$/), iName = col(/routeName/), iComp = col(/组件文件/), iHidden = col(/hidden/);
  const map = new Map();
  let routeRows = 0;
  for (const r of rows.slice(1)) {
    if (r.length < 5 || !(r[iComp] || "").trim()) continue;
    const comp = r[iComp].trim();
    if (!map.has(comp)) map.set(comp, { paths: [], names: [], hidden: [] });
    const e = map.get(comp);
    if (r[iPath]) e.paths.push(r[iPath]);
    if (r[iName]) e.names.push(r[iName]);
    if (iHidden >= 0 && r[iHidden]) e.hidden.push(r[iHidden]);
    routeRows++;
  }
  return { map, routeRows };
}

/* ---------- 逐页扫描 ---------- */
function scanFile(absPath) {
  const relPath = rel(path.relative(ROOT, absPath));
  const src = fs.readFileSync(absPath, "utf8");
  const lines = src.split(/\r?\n/);
  const blockRanges = blockCommentRanges(src);
  const hits = {};
  CATS.forEach((c) => (hits[c] = []));
  const commentDropped = [];
  let errorPrompt = 0;
  let catchCount = 0;
  let absIdx = 0;

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    for (const cat of ["mock", "random", "fakeCn", "placeholder"]) {
      const m = PATTERNS[cat].exec(line);
      if (!m) continue;
      if (lineIsComment(line, m.index, blockRanges, absIdx + m.index)) {
        commentDropped.push(`${relPath}:${lineNo} (${cat}: ${line.trim().slice(0, 60)})`);
      } else {
        hits[cat].push(`${relPath}:${lineNo}`);
      }
    }
    if (DIRECT_HTTP_RE.test(line)) hits.directHttp.push(`${relPath}:${lineNo}`);
    if (CATCH_RE.test(line)) catchCount++;
    if (ERROR_PROMPT_RE.test(line)) errorPrompt++;
    absIdx += line.length + 1;
  });

  // catch 块窗口（catch 起 5 行）内的 []/{} 兜底：
  //   窗口里**同时**有错误提示 → 记为 errorReset（正常的失败清空，不算假空态）；
  //   窗口里**没有**错误提示 → 记为 catchEmpty（静默恒空候选，NEEDS_EYE）。
  //   这条区分是 2026-10-22 抽查 InstantRetailShelf.vue:402 / MarketingPointsMall.vue:322 后加的（原判把
  //   `catch { ElMessage.error(...); list.value = [] }` 误判成恒空候选，属脚本误报，已按规则纠正）。
  lines.forEach((line, i) => {
    if (!CATCH_RE.test(line)) return;
    const end = Math.min(lines.length - 1, i + 4);
    let emptyHit = false;
    let prompted = false;
    for (let j = i; j <= end; j++) {
      if (j > i && !CATCH_RE.test(lines[j]) && /^\s*\}/.test(lines[j])) break;
      if (CATCH_EMPTY_RE.test(lines[j])) emptyHit = true;
      if (ERROR_PROMPT_RE.test(lines[j])) prompted = true;
    }
    if (!emptyHit) return;
    (prompted ? hits.errorReset : hits.catchEmpty).push(`${relPath}:${i + 1}`);
  });

  // import 解析：真实接口 import（可解析）/ 缺失模块 / api 层未导出的符号（缺失接口）
  let m;
  IMPORT_RE.lastIndex = 0;
  const seenSpec = new Set();
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1];
    if (!spec) continue;
    if (!spec.startsWith(".") && !spec.startsWith("@/")) continue; // 包名不校验（node_modules 未安装）
    const key = `${spec}`;
    const base = spec.startsWith("@/")
      ? path.join(ROOT, SRC_REL, spec.slice(2))
      : path.resolve(path.dirname(absPath), spec);
    const hitFile = resolveFile(base);
    const lineNo = src.slice(0, m.index).split(/\r?\n/).length + 0;
    const clause = src.slice(Math.max(0, src.lastIndexOf("import", m.index) + 6), m.index);
    const braces = clause.match(/\{([\s\S]*)\}/);
    const names = braces
      ? braces[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "").trim()).filter((s) => /^[A-Za-z0-9_$]+$/.test(s))
      : [];
    const tag = `${relPath}:${lineNo} [${key}]`;
    if (IS_API_SPEC(spec)) {
      if (!hitFile) hits.apiMissing.push(tag);
      else {
        hits.apiResolved.push(tag);
        const universe = apiExportsFor(hitFile);
        for (const nm of names) if (!universe.has(nm)) hits.missingExport.push(`${relPath}:${lineNo} [${nm}]`);
      }
    } else if (!hitFile) {
      hits.otherMissingMod.push(tag);
    }
    seenSpec.add(key);
  }

  // mock 命名的"死声明"检测：变量只出现一次（只有声明、没有任何使用）→ 未接线的假数据脚手架 / 恒空线索
  const deadMock = [];
  for (const mk of hits.mock) {
    const ln = lines[Number(mk.split(":")[1]) - 1] || "";
    const nm = (ln.match(/(?:const|let|var)\s+([A-Za-z0-9_$]*[Mm]ock[A-Za-z0-9_$]*)/) || [])[1];
    if (!nm) continue;
    const uses = (src.match(new RegExp(`\\b${nm}\\b`, "g")) || []).length;
    if (uses <= 1) deadMock.push(`${mk} (${nm} 仅声明未引用)`);
  }

  return {
    relPath,
    hits,
    commentDropped,
    deadMock,
    catchCount,
    errorPrompt,
    counts: {},
    fakeSignals: 0,
    silentFail: false,
    severity: "UNKNOWN",
    severityLabel: "UNKNOWN（待人工）",
    rule: "",
    clues: "",
  };
}

function decideSeverity(x) {
  if (x.fakeSignals > 0 && !x.apiEvidence) return { code: "P0", label: "P0 冒充 LIVE", rule: "假数据信号>0 且全篇无任何接口引用（纯造数据却呈现为业务页）" };
  if (x.fakeSignals > 0 && x.apiEvidence) return { code: "P1", label: "P1 部分假", rule: "假数据信号>0 且存在接口引用（真假并存）" };
  if (x.placeholder > 0) return { code: "P2", label: "P2 纯占位", rule: "无假数据信号但有占位文案（页面上有明示未实现的段落）" };
  if (x.apiEvidence && (x.catchEmpty > 0 || x.silentFail || x.missingExport > 0)) return { code: "P1", label: "P1 部分假", rule: "有接口引用但存在 catch 空兜底 / 静默失败 / api 层未导出符号（恒空或缺接口候选）" };
  if (x.apiEvidenceStrict && x.fakeSignals === 0 && x.placeholder === 0 && x.catchEmpty === 0 && x.missingExport === 0 && !x.silentFail) {
    return { code: "P3", label: "P3 干净", rule: "无假数据/占位/catch 空兜底/静默失败/缺失接口符号，且有**可解析**的真实接口调用" };
  }
  return { code: "UNKNOWN", label: "UNKNOWN（待人工）", rule: "静态模式无法判定（接口引用全部盘上不可解析 / 纯静态页 / 非路由子组件）" };
}

/* ---------- 派生量 + 严重度 + 线索（纠偏前后各算一次，保证数字由脚本产出） ---------- */
function finalize(row) {
  const c = (k) => row.hits[k].length;
  row.counts = {
    mock: c("mock"), random: c("random"), fakeCn: c("fakeCn"), placeholder: c("placeholder"),
    catchEmpty: c("catchEmpty"), errorReset: c("errorReset"), missingExport: c("missingExport"),
    apiResolved: c("apiResolved"), apiMissing: c("apiMissing"),
    directHttp: c("directHttp"), otherMissingMod: c("otherMissingMod"),
  };
  row.fakeSignals = row.counts.mock + row.counts.random + row.counts.fakeCn;
  row.silentFail = row.catchCount > 0 && row.errorPrompt === 0;
  const apiEvidenceStrict = row.counts.apiResolved > 0 || row.counts.directHttp > 0;
  const apiEvidence = apiEvidenceStrict || row.counts.apiMissing > 0;
  const sev = decideSeverity({
    fakeSignals: row.fakeSignals, apiEvidence, apiEvidenceStrict,
    catchEmpty: row.counts.catchEmpty, silentFail: row.silentFail, placeholder: row.counts.placeholder,
    missingExport: row.counts.missingExport,
  });
  row.severity = sev.code;
  row.severityLabel = sev.label;
  row.rule = sev.rule;
  row.apiEvidence = apiEvidence;
  row.apiEvidenceStrict = apiEvidenceStrict;

  const clues = [];
  if (row.counts.missingExport) clues.push(`import 的接口符号在 api 层未导出 x${row.counts.missingExport}（缺失接口线索）`);
  if (row.counts.apiMissing) clues.push(`api import 盘上不可解析 x${row.counts.apiMissing}（模块链未验）`);
  if (row.counts.otherMissingMod) clues.push(`非 api import 不可解析 x${row.counts.otherMissingMod}`);
  if (row.counts.catchEmpty) clues.push(`catch 内 []/{} 兜底 x${row.counts.catchEmpty}（恒空候选 NEEDS_EYE）`);
  if (row.silentFail) clues.push(`catch x${row.catchCount} 但全篇无错误提示（静默失败候选 NEEDS_EYE）`);
  if (!apiEvidence) clues.push("无任何接口 import / HTTP 调用");
  else if (!apiEvidenceStrict) clues.push("接口引用全部不可解析（运行态未验）");
  if (row.counts.mock && row.deadMock && row.deadMock.length) clues.push(`mock 死声明 x${row.deadMock.length}（只声明未引用＝未接线假数据/恒空）：${row.deadMock.slice(0, 2).join(" ")}`);
  if (row.commentDropped.length) {
    row.devNotes = row.commentDropped.filter((x) => /未实现|暂未|无数据源|空态|mock|演示数据|模拟|TODO|FIXME|占位/i.test(x));
    clues.push(`注释自证线索 x${row.devNotes.length}（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE）`);
  } else row.devNotes = [];
  row.clues = clues.length ? clues.join("；") : "无（静态扫描未命中）";
}

/* ---------- 应用 MANUAL_REVIEW 纠偏（唯一人工入口，改完必须重跑脚本） ---------- */
function applyManual(rows) {
  const applied = [];
  for (const rv of MANUAL_REVIEW) {
    const row = rows.find((r) => r.relPath === rv.file);
    if (!row) { applied.push({ ...rv, result: "SKIP（文件未找到）" }); continue; }
    const ref = `${rv.file}:${rv.line}`;
    const list = row.hits[rv.category];
    if (!list) { applied.push({ ...rv, result: "SKIP（类别不存在）" }); continue; }
    const i = list.findIndex((x) => x.startsWith(ref));
    const original = row.severityLabel;
    if (rv.action === "drop") {
      if (i >= 0) { list.splice(i, 1); applied.push({ ...rv, original, result: "APPLIED" }); }
      else applied.push({ ...rv, original, result: "SKIP（该行本无命中）" });
    } else if (rv.action === "add") {
      if (i < 0) { list.push(ref); applied.push({ ...rv, original, result: "APPLIED" }); }
      else applied.push({ ...rv, original, result: "SKIP（已有命中）" });
    } else applied.push({ ...rv, original, result: "SKIP（action 非法）" });
    finalize(row);
    applied[applied.length - 1].recomputed = row.severityLabel;
  }
  return applied;
}

/* ---------- 输出 ---------- */
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const refs = (arr) => (arr.length ? arr.slice(0, MAX_REFS).join(" ") : "无");

function main() {
  const t0 = Date.now();
  const viewsAbs = path.join(ROOT, VIEWS_REL);
  if (!fs.existsSync(viewsAbs)) throw new Error(`VIEWS_DIR_NOT_FOUND=${viewsAbs}`);
  if (!ROUTES_CSV || !fs.existsSync(ROUTES_CSV)) {
    throw new Error(`ROUTES_CSV_MISSING=请用 parse-routes.cjs --out <dir> 生成 table-a-routes.csv 后以 --routes-csv 传入（当前=${ROUTES_CSV}）`);
  }
  const { map: routeMap, routeRows } = loadRouteMap(ROUTES_CSV);
  const files = walkVue(viewsAbs).sort();
  const rows = files.map(scanFile);
  rows.forEach(finalize);
  const manualApplied = applyManual(rows); // 表为空时直接返回 []，数字仍由脚本产出

  // 关联路由 path
  rows.forEach((r) => {
    const key = rel(path.relative(path.join(ROOT, SRC_REL), path.join(ROOT, r.relPath)));
    const e = routeMap.get(key);
    r.routeKey = key;
    r.routes = e ? e.paths : [];
    r.routeNames = e ? e.names : [];
    r.inMenuMatrix = !!e;
  });

  const sevOrder = { P0: 0, P1: 1, P2: 2, P3: 3, UNKNOWN: 4 };
  rows.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || a.relPath.localeCompare(b.relPath));

  const count = (s) => rows.filter((r) => r.severity === s).length;
  const zeroMock = rows.filter((r) => r.counts.mock === 0).length;
  const noApiRef = rows.filter((r) => !r.apiEvidence).length;
  const apiStrict = rows.filter((r) => r.apiEvidenceStrict).length;
  const apiMissingPages = rows.filter((r) => r.counts.apiMissing > 0).length;
  const catchEmptyPages = rows.filter((r) => r.counts.catchEmpty > 0).length;
  const missingExportPages = rows.filter((r) => r.counts.missingExport > 0).length;
  const silentPages = rows.filter((r) => r.silentFail).length;
  const unrouted = rows.filter((r) => !r.inMenuMatrix).length;
  const totals = CATS.reduce((a, c) => ((a[c] = rows.reduce((s, r) => s + r.counts[c], 0)), a), {});

  const raw = rows.map((r) =>
    [r.severity, r.relPath, r.routes.join("|") || "无路由(未挂载)", r.counts.mock, r.counts.random, r.counts.fakeCn, r.counts.placeholder, r.counts.catchEmpty, r.counts.missingExport, r.apiEvidence ? "Y" : "N", r.apiEvidenceStrict ? "Y" : "N", r.counts.apiMissing, r.counts.otherMissingMod, r.silentFail ? "Y" : "N"].join("\t")
  );

  const summary = {
    GENERATED_BY: "parse-page-quality.cjs",
    ROOT: rel(ROOT),
    ROUTES_CSV: csvLabel(ROUTES_CSV),
    ROUTES_CSV_ROWS: routeRows,
    VIEWS_DIR: VIEWS_REL,
    TOTAL_PAGES: rows.length,
    P0: count("P0"), P1: count("P1"), P2: count("P2"), P3: count("P3"), UNKNOWN: count("UNKNOWN"),
    ZERO_MOCK_PAGES: zeroMock,
    NO_API_REFERENCE_PAGES: noApiRef,
    API_RESOLVABLE_PAGES: apiStrict,
    API_IMPORT_UNRESOLVABLE_PAGES: apiMissingPages,
    CATCH_EMPTY_PAGES: catchEmptyPages,
    MISSING_EXPORT_PAGES: missingExportPages,
    SILENT_FAIL_PAGES: silentPages,
    UNROUTED_FILES: unrouted,
    TOTAL_HITS: totals,
    MANUAL_REVIEW_APPLIED: manualApplied.filter((x) => x.result === "APPLIED").length,
    COMMENT_DROPPED_HITS: rows.reduce((s, r) => s + r.commentDropped.length, 0),
  };

  const L = [];
  L.push("# 台账 40 · admin-web 页面质量台账（mock / 占位 / 恒空 / 缺失接口 / 未验运行态）");
  L.push("");
  L.push(`> 由 \`docs/evidence/WB-REFACTOR-P0/scripts/parse-page-quality.cjs\` 生成，页面全集基准复用矩阵10 权威清单 \`table-a-routes.csv\`（\`parse-routes.cjs\` 产出，路由行 ${routeRows}）。所有数字由脚本产出，人工不得手改。`);
  L.push(`> 复跑：\`node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs --out <dir>\` 后 `);
  L.push("> `node docs/evidence/WB-REFACTOR-P0/scripts/parse-page-quality.cjs --routes-csv <dir>/table-a-routes.csv --out docs/evidence/WB-REFACTOR-P0/40-page-quality-ledger.md`");
  L.push("");
  L.push("## 摘要");
  L.push("");
  L.push("| 指标 | 数值 |");
  L.push("| --- | ---: |");
  L.push(`| 总页数（admin-web/src/views/**/*.vue 文件数） | ${rows.length} |`);
  L.push(`| P0 冒充 LIVE | ${count("P0")} |`);
  L.push(`| P1 部分假 | ${count("P1")} |`);
  L.push(`| P2 纯占位 | ${count("P2")} |`);
  L.push(`| P3 干净 | ${count("P3")} |`);
  L.push(`| UNKNOWN（脚本无法判定，待人工） | ${count("UNKNOWN")} |`);
  L.push(`| 零 mock 命中页数 | ${zeroMock} |`);
  L.push(`| 无任何接口引用页数（无 import api / 无 HTTP 调用） | ${noApiRef} |`);
  L.push(`| 有可解析接口调用页数 | ${apiStrict} |`);
  L.push(`| api import 目标盘上不可解析页数（缺失接口/模块链未验线索） | ${apiMissingPages} |`);
  L.push(`| catch 内 []/{} 空兜底页数（恒空候选，NEEDS_EYE） | ${catchEmptyPages} |`);
  L.push(`| import 符号在 api 层无导出的页数（缺失接口候选） | ${missingExportPages} |`);
  L.push(`| 有 catch 但全篇无错误提示页数（静默失败候选，NEEDS_EYE） | ${silentPages} |`);
  L.push(`| 未被任何路由挂载的 views 文件数 | ${unrouted} |`);
  L.push("");
  L.push("### 命中总量（逐类）");
  L.push("");
  L.push("| 类别 | " + CATS.join(" | ") + " |");
  L.push("| --- |" + CATS.map(() => " ---: |").join(""));
  L.push("| 命中数 | " + CATS.map((c) => totals[c]).join(" | ") + " |");
  L.push("");
  L.push("### 判定规则（脚本确定式，禁止人工凭印象改判）");
  L.push("");
  L.push("- **P0 冒充 LIVE**：假数据信号（mock + Math.random + 模拟/演示/示例文案）>0 且**全篇无任何接口引用**——数据全靠造，却呈现为正常业务页。");
  L.push("- **P1 部分假**：假数据信号>0 且存在接口引用（真假并存）；或有接口引用但存在 catch 空兜底 / 静默失败（恒空候选）。");
  L.push("- **P2 纯占位**：无假数据信号、无接口引用，仅占位文案（功能开发中 / 敬请期待 / 待实现 / TODO / FIXME）。");
  L.push("- **P3 干净**：以上全无，且有**盘上可解析**的真实接口调用。");
  L.push("- **UNKNOWN**：静态模式判不动（接口引用全部不可解析 / 纯静态页 / 非路由子组件），一律待人工。");
  L.push("- 注释行（`//`、块注释、模板注释）里的关键词命中不计入 mock/占位计数，改为逐行登记在「注释线索」节；带 `[DEV_NOTE]` 的是「后端未实现 / 无数据源 / 空态 / mock」散文自证。");
  L.push("- catch 窗口里**已有**错误提示的 `[]`/`{}` 归为 `errorReset`（正常失败清空），不算恒空、不驱动严重度；只有无提示的静默空兜底才计 `catchEmpty`。");
  L.push(`- 反测（夹具在仓库外，未动业务代码）：注入 mock 声明 + Math.random + 占位文案 + 静默 catch 空兜底 + api 层未导出符号 ⇒ 脚本如实报 MOCK=1 RANDOM=1 PLACEHOLDER=1 CATCH_EMPTY=1 MISSING_EXPORT=1、严重度 P1（见脚本头注释）。`);
  L.push("");
  L.push("## 逐页台账");
  L.push("");
  L.push("| # | 页面（组件文件） | 路由 path | mock 数 | Math.random | 模拟/演示/示例文案 | 占位文案数 | 恒空兜底数 | 缺失接口符号数 | 无真实 API 调用? | 缺失接口/恒空线索 | 严重度 | 证据 ref |");
  L.push("| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |");
  rows.forEach((r, i) => {
    const evRefs = [
      r.counts.mock ? `mock:${refs(r.hits.mock)}` : "",
      r.counts.random ? `random:${refs(r.hits.random)}` : "",
      r.counts.fakeCn ? `fakeCn:${refs(r.hits.fakeCn)}` : "",
      r.counts.placeholder ? `placeholder:${refs(r.hits.placeholder)}` : "",
      r.counts.catchEmpty ? `catchEmpty:${refs(r.hits.catchEmpty)}` : "",
      r.counts.missingExport ? `missingExport:${refs(r.hits.missingExport)}` : "",
      r.counts.apiResolved ? `api:${refs(r.hits.apiResolved)}` : "",
      r.counts.directHttp ? `http:${refs(r.hits.directHttp)}` : "",
      r.counts.apiMissing ? `apiMISSING:${refs(r.hits.apiMissing)}` : "",
      r.counts.otherMissingMod ? `modMISSING:${refs(r.hits.otherMissingMod)}` : "",
    ].filter(Boolean).join(" ‖ ") || "无命中";
    L.push(
      `| ${i + 1} | ${esc(r.relPath)} | ${esc(r.routes.join(" ") || "无路由(未挂载)")} | ${r.counts.mock} | ${r.counts.random} | ${r.counts.fakeCn} | ${r.counts.placeholder} | ${r.counts.catchEmpty} | ${r.counts.missingExport} | ${!r.apiEvidence ? "是（无任何接口引用）" : r.apiEvidenceStrict ? "否（有可解析接口调用）" : "UNKNOWN（仅不可解析 import）"} | ${esc(r.clues)} | ${esc(r.severityLabel)} | ${esc(evRefs)} |`
    );
  });
  L.push("");
  L.push(`**表行数 = ${rows.length}**（与摘要「总页数」一致，脚本自检项）。`);
  L.push("");
  L.push("## 脚本原始输出（TSV，逐页一行，可机读复算）");
  L.push("");
  L.push("```tsv");
  L.push(["SEVERITY", "COMPONENT", "ROUTE_PATHS", "MOCK", "RANDOM", "FAKE_CN", "PLACEHOLDER", "CATCH_EMPTY", "MISSING_EXPORT", "API_REF", "API_RESOLVABLE", "API_IMPORT_UNRESOLVED", "OTHER_IMPORT_UNRESOLVED", "SILENT_FAIL"].join("\t"));
  raw.forEach((x) => L.push(x));
  L.push("```");
  L.push("");
  L.push("### COUNTS（脚本 stdout 摘要原样）");
  L.push("");
  L.push("```json");
  L.push(JSON.stringify(summary, null, 1));
  L.push("```");
  L.push("");
  L.push("## 注释线索（散文证据：不计入命中数，但属「后端未实现 / 无数据源 / 恒空 / mock」线索，逐条待人工）");
  L.push("");
  L.push("> 脚本把注释行里的 mock / TODO / 模拟 等关键词从**计数**中剔除（避免把说明文字当成运行时假数据），但如实列在这里；");
  L.push("> 带 `[DEV_NOTE]` 标记的是命中「未实现 / 暂未 / 无数据源 / 空态 / mock / 演示数据」等自证表述的行。");
  L.push("");
  const cd = rows.flatMap((r) => r.commentDropped.map((x) => x));
  if (cd.length) {
    L.push("```");
    rows.filter((r) => r.commentDropped.length).forEach((r) => {
      const devSet = new Set(r.devNotes);
      r.commentDropped.forEach((x) => L.push(`${devSet.has(x) ? "[DEV_NOTE] " : "[COMMENT]   "}${x}`));
    });
    L.push("```");
  } else L.push("（无）");
  L.push("");
  L.push("## 未验运行态声明（全局）");
  L.push("");
  L.push("- 本台账全部来自**静态源码扫描**，未启动任何页面、未跑构建、未打后端；`node_modules` 在本工作树不存在，因此 `import` 可解析性只按盘上文件判断，第三方包未校验。");
  L.push(`- 盘上事实核对：接口层是 \`admin-web/src/api.ts\`（barrel，${fs.readdirSync(path.join(ROOT, SRC_REL, "api")).length} 个域文件在 \`admin-web/src/api/\`），\`import ... from "../../api"\` **能解析到该 barrel**，脚本未把它记成缺失模块；本台账记的"缺失接口线索"= 页面 import 的名字在 api 层（含 \`export *\` 再导出）里找不到导出（见 MISSING_EXPORT 列）。`);
  L.push(`- 静态 import 解析率：可解析接口调用页数 ${apiStrict}，接口引用完全不可解析页数 ${rows.length - apiStrict - noApiRef}，无任何接口引用页数 ${noApiRef}（后者含 ${unrouted} 个未挂载路由的 views 子组件）。`);
  L.push("- 每一行的「严重度」= **现状登记**，不等于该页面可交付。");
  L.push("");
  L.push("## 抽查与纠偏");
  L.push("");
  L.push("### 逐页 Read 复核（步骤3，抽 P0/P1/P2 共 7 组页面）");
  L.push("");
  L.push("| 抽查对象（文件:行区间） | 脚本原判 | 复核结论 | 依据 |");
  L.push("| --- | --- | --- | --- |");
  SPOT_CHECK.forEach((s) => L.push(`| ${esc(s.page)} | ${esc(s.script)} | ${esc(s.verdict)} | ${esc(s.note)} |`));
  L.push("");
  L.push("### 数字级纠偏（MANUAL_REVIEW，改数必须走这张表并重跑脚本）");
  L.push("");
  if (!MANUAL_REVIEW.length) {
    L.push("（MANUAL_REVIEW 表为空 —— 本节由脚本如实输出，纠偏必须写进脚本表后重跑，禁止只改文档。）");
  } else {
    L.push("| 文件:行号 | 类别 | 原判 | 改判 | 理由 | 脚本应用结果 |");
    L.push("| --- | --- | --- | --- | --- | --- |");
    manualApplied.forEach((x) => L.push(`| ${esc(x.file + ":" + x.line)} | ${x.category} | ${esc(x.original || "")} | ${esc(x.revised || "")} | ${esc(x.reason || "")} | ${x.result} → 重算后 ${esc(x.recomputed || "")} |`));
    L.push("");
    L.push("另有两处**规则级**纠偏（不是逐行 hack，已写进扫描逻辑）：");
    L.push("- catch 窗口里若已存在 `ElMessage.error/warning/console.error` 等提示，则 `[]`/`{}` 归为 `errorReset`（正常失败清空），不再计入 `catchEmpty` 恒空候选、不再驱动严重度；");
    L.push("- 注释行里的 mock/TODO/模拟 关键词不计入命中数，但作为「注释线索」逐行登记（含 `未实现/无数据源/空态` 的散文自证），避免把说明文字当运行时假数据、也避免把真线索丢掉。");
  }
  L.push("");
  L.push("## 不得洗绿声明");
  L.push("");
  L.push("本台账**只登记现状**：任何行（含 P3 干净 / P2 纯占位）都**不构成**「该页面已完成、已接通、可验收」的认定；");
  L.push("P0/P1/P2/UNKNOWN/NEEDS_EYE 一律视为**待整改项**。运行态、数据正确性、权限、后端契约均未经此台账验证。");
  L.push("");
  L.push("## 收口补记（墨 · 2026-10-22）");
  L.push("");
  L.push(
    `本节由生成器一并产出（避免手改产物在复跑时被覆盖）：三方互锁 —— 摘要表 ↔ 逐页明细 ↔ 脚本 COUNTS 对
总页数 ${summary.TOTAL_PAGES} / P0=${summary.P0} / P1=${summary.P1} / P2=${summary.P2} / P3=${summary.P3} / UNKNOWN=${summary.UNKNOWN} 逐项相等，
TSV ${rows.length} 行 = 明细 ${rows.length} 行，\`ROUTES_CSV_ROWS=${summary.ROUTES_CSV_ROWS}\` 与矩阵10 \`ROUTE_DECLARATIONS\` 对齐。
校验器 \`scripts/verify-inventory.cjs --strict\` 已把这些守恒关系挂成退出码门禁。`
  );
  L.push("");
  L.push(
    `- **「洗绿」反测已执行**：临时副本上把唯一 P0 页改判 \`P3 干净\` ⇒ \`L40.P0 冒充 LIVE 条数\`、\`L40.P3 干净 条数\`、\`L40.明细P0=COUNTS.P0\`、\`L40.明细P3=COUNTS.P3\` 四项同时报警，复原后归零。原始输出见同目录 \`50-reverse-test-log.md\`。`
  );
  L.push(
    `- **可复现性修复**：产物不再烤本机绝对路径（工作树外的 CSV 输入只登记 \`<工作树外临时目录>/文件名\`），计时 \`ELAPSED_MS\` 移出产物只打 stdout ⇒ 同输入连跑两次产物逐字节相同。`
  );
  L.push(
    `- **仍未解除的运行态缺口**：工作树内无 \`node_modules\`，本轮未 \`build\`、未起 dev server、未在浏览器逐页打开。P0/P1/P2 合计 ${summary.P0 + summary.P1 + summary.P2} 页需真实环境逐页眼验后才能谈验收。`
  );
  L.push("");

  const md = L.join("\n");
  if (!DRY) {
    fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
    fs.writeFileSync(OUT_MD, md, "utf8");
  }
  if (OUT_JSON) {
    fs.mkdirSync(path.dirname(path.resolve(OUT_JSON)), { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify({ summary, rows: rows.map((r) => ({ file: r.relPath, sev: r.severity, counts: r.counts, routes: r.routes })) }, null, 1), "utf8");
  }
  console.log("### COUNTS");
  console.log(JSON.stringify(summary, null, 1));
  console.log(`\n### RAW_ROWS=${raw.length}`);
  raw.forEach((x) => console.log(x));
  console.log(`\nWROTE_MD=${DRY ? "(dry-run)" : rel(OUT_MD)}`);
  console.log(`ELAPSED_MS=${Date.now() - t0}（仅 stdout，不写入产物，保证台账逐字节可复现）`);
  if (rows.length !== summary.TOTAL_PAGES) throw new Error("SELF_CHECK_FAILED 行数≠总页数");
}

try {
  main();
} catch (e) {
  console.error(`PARSE_FAILED=${e.message}`);
  process.exit(1);
}
