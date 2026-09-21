/*
 * R101-H1 · 改后 computed 复核 + 反测（独立验证，fresh eyes）
 * ---------------------------------------------------------------------------
 * 用法（在仓库内任意 cwd）：
 *   node docs/tasks/cards/R101-H1-verify-after.cjs
 *
 * 设计要点（为什么另起一个脚本）：
 *   改前基线脚本 docs/tasks/cards/R101-H1-baseline-measure.cjs 把 25 条规则的
 *   color 声明 **手抄成字符串** 写死在 RULES.css 里，且 root 写死 main。
 *   拿它跑分支只会重复测到旧值 —— 属「期望值写死 ⇒ 改回坏值也不红」的假门禁。
 *   本脚本：
 *     1) root 参数化，可分别指向 main 与分支 worktree；
 *     2) color 声明 **从该 root 下的真实 .vue 文件读**，严禁手抄；
 *     3) 内联该 root 的真实 tokens.css + styles.css（按应用真实加载顺序）；
 *     4) 逐条 getComputedStyle 取 fg 与 **真实生效背景**（向上合成 alpha）；
 *     5) 反测两种做法，各自必须回落至不达标。
 *
 * 只读源码、只写 docs/tasks/cards/ 下的报告；不 commit / 不 push / 不改任何值。
 */
const fs = require('fs');
const path = require('path');

const ROOT_MAIN = 'D:/Users/ZXQL/ZXQL-MS/wen-ssystem';
const ROOT_BRANCH = 'D:/d/Users/ZXQL/ZXQL-MS/wt-h1-impl';
const TMP = 'D:/Users/ZXQL/ZXQL-MS/_h1_antitest';
const OUT_MD = path.join(ROOT_MAIN, 'docs/tasks/cards/R101-H1-改后复核-反测.md');
const OUT_JSON = path.join(TMP, '_h1_verify_after.json');

const { chromium } = require(path.join(ROOT_MAIN, 'node_modules/playwright'));

// 25 条：文件 + 行号，来自 git diff main...ed8f369b 的 hunk 头（-N +N，无偏移）
const RULES = [
  { n: 1,  file: 'views/components/PlatformPanel.vue',               line: 376,  bg: '#F0F0F0' },
  { n: 2,  file: 'views/instant-retail/InstantRetailOrderBoard.vue', line: 870,  bg: '#F5F5F5' },
  { n: 3,  file: 'views/pos/ShiftDetailView.vue',                    line: 417,  bg: '#F0F0F0' },
  { n: 4,  file: 'views/purchase/PurchasePlans.vue',                 line: 356,  bg: '#F0F0F0' },
  { n: 5,  file: 'views/purchase/SupplierStatements.vue',            line: 299,  bg: '#F0F0F0' },
  { n: 6,  file: 'views/sale/CommissionRecords.vue',                 line: 236,  bg: '#F0F0F0' },
  { n: 7,  file: 'views/system/OrganizationView.vue',                line: 548,  bg: '#F0F0F0' },
  { n: 8,  file: 'views/finance/BankAccounts.vue',                   line: 390,  bg: '#F0F0F0' },
  { n: 9,  file: 'views/instant-retail/InstantRetailDashboard.vue',  line: 440,  bg: '#F0F0F0' },
  { n: 10, file: 'views/instant-retail/InstantRetailPickup.vue',     line: 1124, bg: '#F0F0F0' },
  { n: 11, file: 'views/marketing/MarketingGiftRule.vue',            line: 534,  bg: '#F0F0F0' },
  { n: 12, file: 'views/pos/CashierView.vue',                        line: 2497, bg: '#F5F5F5' },
  { n: 13, file: 'views/pos/CashierView.vue',                        line: 2673, bg: '#F5F5F5' },
  { n: 14, file: 'views/purchase/SupplierStatements.vue',            line: 300,  bg: '#F0F0F0' },
  { n: 15, file: 'views/dashboard/Dashboard.vue',                    line: 947,  bg: '#F0F0F0' },
  { n: 16, file: 'views/dashboard/Dashboard.vue',                    line: 1028, bg: '#F0F0F0' },
  { n: 17, file: 'views/dashboard/Dashboard.vue',                    line: 1072, bg: '#F0F0F0' },
  { n: 18, file: 'views/finance/BankAccounts.vue',                   line: 386,  bg: '#F0F0F0' },
  { n: 19, file: 'views/instant-retail/InstantRetailShelf.vue',      line: 849,  bg: '#F0F0F0' },
  { n: 20, file: 'views/inventory/InventoryTransferCreate.vue',      line: 575,  bg: '#F0F0F0' },
  { n: 21, file: 'views/inventory/InventoryTransferDetail.vue',      line: 629,  bg: '#F0F0F0' },
  { n: 22, file: 'views/marketing/MarketingGiftRule.vue',            line: 562,  bg: '#F0F0F0' },
  { n: 23, file: 'views/pos/CashierView.vue',                        line: 2743, bg: '#F5F5F5' },
  { n: 24, file: 'views/pos/SaleBillDetail.vue',                     line: 299,  bg: '#F0F0F0' },
  { n: 25, file: 'views/sale/SalesOrderCreate.vue',                  line: 647,  bg: '#F0F0F0' },
];

// 3 条「性质上已达标故不改」
const UNCHANGED = [
  { n: 'U1', file: 'views/pos/StoreDashboardView.vue', line: 172, sel: '.metric',          thr: 3,  role: '大文本(22px/700)' },
  { n: 'U2', file: 'views/system/DepartmentManage.vue', line: 349, sel: '.tree-node-icon', thr: 3,  role: '非文本 1.4.11' },
  { n: 'U3', file: 'views/system/MiniappConfigView.vue', line: 840, sel: '.check-icon',    thr: 3,  role: '非文本 1.4.11' },
];

const CHOSEN_ANTITEST = [1, 15]; // 一条 warning、一条 primary

// ── 从真实 .vue 读该行附近的 `color:` 声明（不手抄）────────────────────────
function readDecl(root, rule) {
  const abs = path.join(root, 'admin-web/src', rule.file);
  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split('\n');
  const idx = rule.line - 1;
  // 命中行本身，否则在 ±6 行内找含 `color:` 的行
  const cands = [idx];
  for (let d = 1; d <= 6; d++) cands.push(idx - d, idx + d);
  for (const i of cands) {
    if (i < 0 || i >= lines.length) continue;
    const L = lines[i];
    if (/color\s*:/.test(L) && /--(el-)?color|#|rgb/.test(L)) {
      const m = L.match(/color\s*:\s*([^;]+);?/);
      if (m) return { raw: L.trim(), decl: m[0].replace(/;?$/, ''), colorVal: m[1].trim(), atLine: i + 1 };
    }
  }
  return null;
}

// ── 从声明处向上找选择器（CSS 块开头）────────────────────────────────────
function readSelector(root, rule) {
  const src = fs.readFileSync(path.join(root, 'admin-web/src', rule.file), 'utf8');
  const lines = src.split('\n');
  for (let i = rule.line - 1; i >= Math.max(0, rule.line - 45); i--) {
    const L = lines[i];
    if (!/\{\s*$/.test(L)) continue;
    const sel = L.replace(/\{\s*$/, '').trim();
    if (!sel || /=>|function|@media|@keyframes|:root/.test(sel)) continue;
    if (/[.#][\w-]|\[/.test(sel)) return sel;
  }
  return null;
}

// ── fixture 页面构建 ───────────────────────────────────────────────────────
function buildHtml(root, injections) {
  const tok = fs.readFileSync(path.join(root, 'admin-web/src/styles/tokens.css'), 'utf8');
  const sty = fs.readFileSync(path.join(root, 'admin-web/src/styles.css'), 'utf8')
    .replace(/@import\s+["'][^"']*tokens\.css["']\s*;?/g, ''); // 去重（真实加载顺序 tokens→styles）
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${tok}</style><style>${sty}</style>
<style>
  body{margin:0;transition:none!important;animation:none!important}
  .probe{position:relative;transition:none!important;animation:none!important}
  .host{position:relative}
</style>
</head><body>
<div id="stage"></div>
<script>
window.__INJ__ = ${JSON.stringify(injections)};
</script>
</body></html>`;
}

const HELPER = `
function parseColor(s){
  if(!s) return null;
  s = String(s).trim();
  if(s === 'transparent') return {r:0,g:0,b:0,a:0};
  let m = s.match(/^rgba?\\(([^)]+)\\)$/);
  if(m){ const p = m[1].split(',').map(x=>parseFloat(x.trim())); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
  m = s.match(/^#([0-9a-f]{6})$/i);
  if(m){ const h=m[1]; return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1}; }
  m = s.match(/^#([0-9a-f]{3})$/i);
  if(m){ const h=m[1]; return {r:parseInt(h[0]+h[0],16),g:parseInt(h[1]+h[1],16),b:parseInt(h[2]+h[2],16),a:1}; }
  return null;
}
function over(top,bot){ // top 叠在 bot 之上
  const a = top.a + bot.a*(1-top.a);
  if(a === 0) return {r:0,g:0,b:0,a:0};
  return { r:(top.r*top.a + bot.r*bot.a*(1-top.a))/a,
           g:(top.g*top.a + bot.g*bot.a*(1-top.a))/a,
           b:(top.b*top.a + bot.b*bot.a*(1-top.a))/a, a };
}
function effBg(el){
  let acc = null, node = el;
  while(node && node.nodeType===1){
    const c = parseColor(getComputedStyle(node).backgroundColor);
    if(c && c.a > 0){ acc = acc ? over(acc,c) : c; if(acc.a >= 1) break; }
    node = node.parentElement;
  }
  if(!acc) acc = {r:255,g:255,b:255,a:1};
  if(acc.a < 1) acc = over(acc,{r:255,g:255,b:255,a:1});
  return acc;
}
function lum(c){
  const f = v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
}
function ratio(a,b){ const l1=lum(a), l2=lum(b); const hi=Math.max(l1,l2), lo=Math.min(l1,l2); return (hi+0.05)/(lo+0.05); }
function toHex(c){ const h=v=>Math.round(v).toString(16).padStart(2,'0'); return ('#'+h(c.r)+h(c.g)+h(c.b)).toUpperCase(); }
function buildAndMeasure(inj){
  const stage = document.getElementById('stage');
  stage.innerHTML = '';
  const out = [];
  for(const it of inj){
    const host = document.createElement('div');
    host.className = 'host';
    host.style.background = it.bg;
    host.style.display = 'inline-block';
    host.style.transition = 'none';
    const el = document.createElement('span');
    el.className = it.cls;
    el.textContent = '实测ABC 123';
    el.style.cssText = it.decl + ';transition:none;animation:none';
    host.appendChild(el);
    stage.appendChild(host);
    const cs = getComputedStyle(el);
    out.push({ id: it.id, cls: it.cls, decl: it.decl, bg: it.bg,
      fgRaw: cs.color, bgEff: toHex(effBg(el)),
      ratio: Math.round(ratio(parseColor(cs.color), effBg(el))*100)/100,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight });
  }
  return out;
}
`;

async function run(page, root, injections) {
  await page.setContent(buildHtml(root, injections));
  await page.addScriptTag({ content: HELPER });
  return await page.evaluate((inj) => window.buildAndMeasure(inj), injections);
}

function selectorToCls(sel) {
  // 去掉伪类；把后代选择器拍平成多重 class（保持观感一致）
  const cleaned = sel.replace(/::?[a-z-]+(\([^)]*\))?/g, '');
  const parts = cleaned.split(/\s+/).filter(p => /^[.#\w-]+$/.test(p));
  const cls = [];
  for (const p of parts) {
    p.split(/(?=[.#])/).forEach(t => { if (t.startsWith('.')) cls.push(t.slice(1)); });
  }
  return [...new Set(cls)].join(' ') || 'probe';
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const report = { generatedAt: new Date().toISOString(), roots: { main: ROOT_MAIN, branch: ROOT_BRANCH }, rules: [], unchanged: [], antiTest: {}, notes: [] };

  // ── 组装改前 / 改后注入项（声明均来自真实文件）──
  const injMain = [], injBranch = [];
  const meta = [];
  for (const r of RULES) {
    const dm = readDecl(ROOT_MAIN, r);
    const db = readDecl(ROOT_BRANCH, r);
    const selM = readSelector(ROOT_MAIN, r);
    const selB = readSelector(ROOT_BRANCH, r);
    const sel = selB || selM || '.probe';
    const cls = selectorToCls(sel);
    meta.push({ n: r.n, file: 'admin-web/src/' + r.file, line: r.line, sel, cls, bg: r.bg,
      declMain: dm && dm.decl, declBranch: db && db.decl, readAtMain: dm && dm.atLine, readAtBranch: db && db.atLine });
    injMain.push({ id: r.n, cls, decl: (dm && dm.decl) || 'color: inherit', bg: r.bg });
    injBranch.push({ id: r.n, cls, decl: (db && db.decl) || 'color: inherit', bg: r.bg });
  }
  const mMain = await run(page, ROOT_MAIN, injMain);
  const mBr = await run(page, ROOT_BRANCH, injBranch);

  const byId = (arr) => Object.fromEntries(arr.map(x => [x.id, x]));
  const a = byId(mMain), b = byId(mBr);
  for (const mt of meta) {
    const A = a[mt.n] || {}, B = b[mt.n] || {};
    report.rules.push({ ...mt, main: A, branch: B, thr: 4.5,
      passBefore: (A.ratio || 0) >= 4.5, passAfter: (B.ratio || 0) >= 4.5 });
  }

  // ── 3 条不改项（改后）──
  const injU = UNCHANGED.map(u => ({ id: u.n, cls: selectorToCls(u.sel), decl: 'color: var(--color-primary)', bg: '#FFFFFF' }));
  // 用真实声明的更好：直接读各自文件里的 color
  for (let i = 0; i < UNCHANGED.length; i++) {
    const u = UNCHANGED[i];
    const d = readDecl(ROOT_BRANCH, { file: u.file, line: u.line });
    if (d) injU[i].decl = d.decl;
  }
  const mU = await run(page, ROOT_BRANCH, injU);
  for (const u of UNCHANGED) {
    const R = mU.find(x => x.id === u.n) || {};
    report.unchanged.push({ ...u, measured: R, pass: (R.ratio || 0) >= u.thr });
  }

  // ── 反测 ──
  // (i) 回退令牌值：把 --color-*-text 改回旧值（在仓库外临时目录复制一份 tokens.css）
  const tokBr = fs.readFileSync(path.join(ROOT_BRANCH, 'admin-web/src/styles/tokens.css'), 'utf8');
  const tokReveted = tokBr
    .replace(/--color-warning-text\s*:\s*[^;]+;/, '--color-warning-text: #D48B3A;')
    .replace(/--color-primary-text\s*:\s*[^;]+;/, '--color-primary-text: #3F6FEF;')
    .replace(/--color-success-text\s*:\s*[^;]+;/, '--color-success-text: #0EA879;');
  fs.writeFileSync(path.join(TMP, 'tokens.reverted.css'), tokReveted, 'utf8');
  const changed = tokReveted !== tokBr;
  report.notes.push('反测(i) 令牌值回退：tokens.css 是否被改写 = ' + changed);

  // 用临时目录搭一个"伪 root"，只为让 fixture 读到回退后的 tokens.css
  const fakeRoot = path.join(TMP, 'fake-root');
  fs.mkdirSync(path.join(fakeRoot, 'admin-web/src/styles'), { recursive: true });
  fs.writeFileSync(path.join(fakeRoot, 'admin-web/src/styles/tokens.css'), tokReveted, 'utf8');
  fs.copyFileSync(path.join(ROOT_BRANCH, 'admin-web/src/styles.css'), path.join(fakeRoot, 'admin-web/src/styles.css'));

  const injRevTok = CHOSEN_ANTITEST.map(n => {
    const mt = meta.find(x => x.n === n);
    return { id: n, cls: mt.cls, decl: mt.declBranch, bg: mt.bg };
  });
  const mRevTok = await run(page, fakeRoot, injRevTok);
  report.antiTest.tokenValueRevert = mRevTok.map(x => ({ n: x.id, fgRaw: x.fgRaw, ratio: x.ratio, pass: x.ratio >= 4.5 }));

  // (ii) 回退引用：把 var(--color-x-text) 换回 var(--color-x)
  const injRevRef = CHOSEN_ANTITEST.map(n => {
    const mt = meta.find(x => x.n === n);
    const decl = mt.declBranch.replace(/(--color-(?:primary|success|warning))-text/g, '$1');
    return { id: n, cls: mt.cls, decl, bg: mt.bg, declUsed: decl };
  });
  const mRevRef = await run(page, ROOT_BRANCH, injRevRef);
  report.antiTest.refRevert = mRevRef.map(x => ({ n: x.id, decl: x.decl, fgRaw: x.fgRaw, ratio: x.ratio, pass: x.ratio >= 4.5 }));

  await browser.close();

  // ── 汇总 ──
  const passBefore = report.rules.filter(r => r.passBefore).length;
  const passAfter = report.rules.filter(r => r.passAfter).length;
  report.summary = { rules: report.rules.length, passBefore, passAfter,
    failAfter: report.rules.filter(r => !r.passAfter).map(r => r.n),
    unchangedPass: report.unchanged.filter(u => u.pass).length + '/' + report.unchanged.length,
    antiTestRed: report.antiTest.tokenValueRevert.every(x => !x.pass) && report.antiTest.refRevert.every(x => !x.pass) };

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');

  // ── Markdown ──
  const L = [];
  L.push('# R101-H1 · 改后 computed 复核 + 反测（独立验证）');
  L.push('');
  L.push('- 生成时间：' + report.generatedAt);
  L.push('- 改前 root：`' + ROOT_MAIN + '`（main `d434d6db`）');
  L.push('- 改后 root：`' + ROOT_BRANCH + '`（分支 `fix/s366-1-h1-values` @ `ed8f369b`）');
  L.push('- 方法：**从真实 .vue 文件读 `color` 声明**（不手抄）+ 内联该 root 的真实 `tokens.css`/`styles.css`，浏览器 `getComputedStyle` 实测 fg 与**真实生效背景**（向上合成 alpha），WCAG 2.x 比值。');
  L.push('- 复跑：`node "D:/Users/ZXQL/ZXQL-MS/wen-ssystem/docs/tasks/cards/R101-H1-verify-after.cjs"`');
  L.push('');
  L.push('## 1) 25 条：改前 vs 改后');
  L.push('');
  L.push('| # | 文件:行 | 选择器 | 改前声明 | 改前 fg | 改前比值 | 改后声明 | 改后 fg | 改后比值 | 阈值 | 改后 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of report.rules) {
    L.push('| ' + r.n + ' | ' + r.file + ':' + r.line + ' | `' + r.sel + '` | `' + (r.declMain || '?') + '` | ' + (r.main.fgRaw || '?') +
      ' | ' + (r.main.ratio != null ? r.main.ratio : '?') + ' | `' + (r.declBranch || '?') + '` | ' + (r.branch.fgRaw || '?') +
      ' | **' + (r.branch.ratio != null ? r.branch.ratio : '?') + '** | 4.5 | ' + (r.passAfter ? '✅' : '❌') + ' |');
  }
  L.push('');
  L.push('**改前达标 ' + passBefore + '/25 → 改后达标 ' + passAfter + '/25**');
  if (report.summary.failAfter.length) L.push('');
  if (report.summary.failAfter.length) L.push('改后仍不达标：# ' + report.summary.failAfter.join(', '));
  L.push('');
  L.push('## 2) 反测（未反测＝未验收）');
  L.push('');
  L.push('### (i) 回退**令牌值**（`--color-warning-text`→`#D48B3A`、`--color-primary-text`→`#3F6FEF`）');
  L.push('');
  L.push('| # | 实测 fg | 比值 | 是否回落至不达标 |');
  L.push('|---|---|---|---|');
  for (const x of report.antiTest.tokenValueRevert) L.push('| ' + x.n + ' | ' + x.fgRaw + ' | ' + x.ratio + ' | ' + (x.pass ? '❌ 未变红（反测失败）' : '✅ 已变红') + ' |');
  L.push('');
  L.push('### (ii) 回退**引用**（`var(--color-x-text)` → `var(--color-x)`）');
  L.push('');
  L.push('| # | 注入声明 | 实测 fg | 比值 | 是否回落至不达标 |');
  L.push('|---|---|---|---|---|');
  for (const x of report.antiTest.refRevert) L.push('| ' + x.n + ' | `' + x.decl + '` | ' + x.fgRaw + ' | ' + x.ratio + ' | ' + (x.pass ? '❌ 未变红（反测失败）' : '✅ 已变红') + ' |');
  L.push('');
  L.push('## 3) 3 条「性质上已达标故不改」改后复核');
  L.push('');
  L.push('| # | 文件:行 | 选择器 | 性质 | 阈值 | 改后比值 | 结果 |');
  L.push('|---|---|---|---|---|---|---|');
  for (const u of report.unchanged) L.push('| ' + u.n + ' | ' + 'admin-web/src/' + u.file + ':' + u.line + ' | `' + u.sel + '` | ' + u.role + ' | ' + u.thr + ' | ' + (u.measured.ratio != null ? u.measured.ratio : '?') + ' | ' + (u.pass ? '✅' : '❌') + ' |');
  L.push('');
  L.push('## 4) 方法与局限');
  L.push('');
  L.push('- **fixture 实测，非真实页面**：本地无后端（`admin-web` 的 `/api` proxy → `127.0.0.1:8080` 必 500），依赖接口数据的页面渲染不出目标元素，已二次证实。');
  L.push('- 祖先背景取 E3 记录的「最严面」假设值，与改前基线同口径 ⇒ 改前/改后**可比**；真实祖先底若更浅，比率只会更高（不达标结论方向不变）。');
  L.push('- 声明读取行自校验：main 读到位 ' + report.rules.filter(r => r.readAtMain).length + '/25，branch 读到位 ' + report.rules.filter(r => r.readAtBranch).length + '/25。');
  L.push('- 选择器含伪类的（如 `:hover`）已剥离伪类，测的是该规则声明的 color。');
  L.push('');
  L.push('## 5) 机械自检');
  L.push('');
  L.push('```json');
  L.push(JSON.stringify(report.summary, null, 2));
  L.push('```');
  fs.writeFileSync(OUT_MD, L.join('\n'), 'utf8');

  console.log('=== SUMMARY ===');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('\\n[改前→改后]');
  for (const r of report.rules) console.log('  #' + String(r.n).padStart(2) + ' ' + (r.passBefore ? 'OK' : 'XX') + ' ' + String(r.main.ratio).padEnd(6) + ' -> ' + (r.passAfter ? 'OK' : 'XX') + ' ' + String(r.branch.ratio).padEnd(6) + '  ' + r.sel);
  console.log('\\n[反测(i) 令牌值回退]'); report.antiTest.tokenValueRevert.forEach(x => console.log('  #' + x.n + ' ' + x.fgRaw + ' = ' + x.ratio + '  ' + (x.pass ? 'NOT-RED(FAIL)' : 'RED(ok)')));
  console.log('[反测(ii) 引用回退]'); report.antiTest.refRevert.forEach(x => console.log('  #' + x.n + ' ' + x.fgRaw + ' = ' + x.ratio + '  ' + (x.pass ? 'NOT-RED(FAIL)' : 'RED(ok)')));
  console.log('\\n[3 条不改项]'); report.unchanged.forEach(u => console.log('  ' + u.n + ' ' + u.sel + ' = ' + u.measured.ratio + ' thr=' + u.thr + ' ' + (u.pass ? 'OK' : 'XX')));
  console.log('\\n报告 -> ' + OUT_MD);
  console.log('数据 -> ' + OUT_JSON);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
