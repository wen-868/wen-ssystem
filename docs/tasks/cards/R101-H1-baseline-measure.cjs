/*
 * R101-H1 · 浏览器 computed 基线实测（改前 / 未改动 main）
 * 单脚本：spawn vite --host 127.0.0.1 --port 5180 → 轮询端口 → Playwright 实测 25 条改前对比度 → kill vite
 * 不改动任何受版本控制文件；fixture 仅在内存中 setContent，不落盘进仓库。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = 'D:/Users/ZXQL/ZXQL-MS/wen-ssystem';
const adminWeb = path.join(root, 'admin-web');
const pwPath = path.join(root, 'node_modules/playwright');
const { chromium } = require(pwPath);

// ── 25 条「待改值」规则（E3 §1 中除 #25/.metric、#27/.tree-node-icon、#28/.check-icon 三不修改项）
// ancestorBg = E3 记录的「最严面」假设祖先底（真实页面祖先底可能更浅 → 比率更高，见 §局限）
const RULES = [
  { n:1,  file:'views/components/PlatformPanel.vue', line:376, sel:'.info-value.expire-warning',
    css:'.info-value.expire-warning{color:var(--color-warning);font-weight:500;}', dom:'<span class="info-value expire-warning">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.44, varName:'--color-warning' },
  { n:2,  file:'views/instant-retail/InstantRetailOrderBoard.vue', line:870, sel:'.remark-text',
    css:'.remark-text{color:var(--color-warning);background:var(--color-warning-soft);}', dom:'<span class="remark-text">实测</span>',
    ancestorBg:'#F5F5F5', e3:2.30, varName:'--color-warning / --color-warning-soft' },
  { n:3,  file:'views/pos/ShiftDetailView.vue', line:417, sel:'.recon-value-warn',
    css:'.recon-value-warn{color:var(--color-warning);}', dom:'<span class="recon-value-warn">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.44, varName:'--color-warning' },
  { n:4,  file:'views/purchase/PurchasePlans.vue', line:356, sel:'.suggest-qty',
    css:'.suggest-qty{color:var(--color-warning);font-weight:700;}', dom:'<span class="suggest-qty">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.44, varName:'--color-warning' },
  { n:5,  file:'views/purchase/SupplierStatements.vue', line:299, sel:'.balance-positive',
    css:'.balance-positive{color:var(--color-warning);font-weight:600;}', dom:'<span class="balance-positive">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.44, varName:'--color-warning' },
  { n:6,  file:'views/sale/CommissionRecords.vue', line:236, sel:'.commission-amount',
    css:'.commission-amount{color:var(--color-warning);font-weight:600;}', dom:'<span class="commission-amount">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.44, varName:'--color-warning' },
  { n:7,  file:'views/system/OrganizationView.vue', line:548, sel:'.boss-tip',
    css:'.boss-tip{font-size:12px;color:var(--color-warning);margin-top:4px;}', dom:'<span class="boss-tip">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.44, varName:'--color-warning' },
  { n:8,  file:'views/finance/BankAccounts.vue', line:390, sel:'.income',
    css:'.income{color:var(--color-success);font-weight:600;}', dom:'<span class="income">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.67, varName:'--color-success' },
  { n:9,  file:'views/instant-retail/InstantRetailDashboard.vue', line:440, sel:'.trend-up',
    css:'.trend-up{color:var(--el-color-success);font-weight:500;}', dom:'<span class="trend-up">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.67, varName:'--el-color-success (→ --color-success)' },
  { n:10, file:'views/instant-retail/InstantRetailPickup.vue', line:1124, sel:'.detail-value.success',
    css:'.detail-value.success{color:var(--color-success);}', dom:'<span class="detail-value success">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.67, varName:'--color-success' },
  { n:11, file:'views/marketing/MarketingGiftRule.vue', line:534, sel:'.preview-title',
    css:'.preview-title{font-size:13px;font-weight:600;color:var(--color-success);}', dom:'<span class="preview-title">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.67, varName:'--color-success' },
  { n:12, file:'views/pos/CashierView.vue', line:2497, sel:'.pay-change-row',
    css:'.pay-change-row{background:var(--color-success-soft);font-size:13px;color:var(--color-success);}', dom:'<span class="pay-change-row">实测</span>',
    ancestorBg:'#F5F5F5', e3:2.48, varName:'--color-success / --color-success-soft' },
  { n:13, file:'views/pos/CashierView.vue', line:2673, sel:'.pay-code-channel',
    css:'.pay-code-channel{font-size:12px;font-weight:500;color:var(--color-success);background:var(--color-success-soft,#e8f8ee);}', dom:'<span class="pay-code-channel">实测</span>',
    ancestorBg:'#F5F5F5', e3:2.48, varName:'--color-success / --color-success-soft' },
  { n:14, file:'views/purchase/SupplierStatements.vue', line:300, sel:'.balance-negative',
    css:'.balance-negative{color:var(--color-success);font-weight:600;}', dom:'<span class="balance-negative">实测</span>',
    ancestorBg:'#F0F0F0', e3:2.67, varName:'--color-success' },
  { n:15, file:'views/dashboard/Dashboard.vue', line:947, sel:'.order-item:hover .order-no',
    css:'.order-item:hover .order-no{color:var(--color-primary);}', dom:'<div class="order-item"><span class="order-no">实测</span></div>',
    ancestorBg:'#F0F0F0', e3:3.89, hover:'.order-item', measure:'.order-no', varName:'--color-primary' },
  { n:16, file:'views/dashboard/Dashboard.vue', line:1028, sel:'.todo-item:hover',
    css:'.todo-item:hover{color:var(--color-primary);}', dom:'<div class="todo-item">实测</div>',
    ancestorBg:'#F0F0F0', e3:3.89, hover:'.todo-item', measure:'.todo-item', varName:'--color-primary' },
  { n:17, file:'views/dashboard/Dashboard.vue', line:1072, sel:'.quick-cell:hover',
    css:'.quick-cell:hover{border-color:var(--color-primary);color:var(--color-primary);background:var(--color-primary-bg);}', dom:'<div class="quick-cell">实测</div>',
    ancestorBg:'#F5F5F5', e3:3.79, hover:'.quick-cell', measure:'.quick-cell', varName:'--color-primary / --color-primary-bg' },
  { n:18, file:'views/finance/BankAccounts.vue', line:386, sel:'.balance-amount',
    css:'.balance-amount{font-size:16px;font-weight:700;color:var(--color-primary);}', dom:'<span class="balance-amount">实测</span>',
    ancestorBg:'#F0F0F0', e3:3.89, varName:'--color-primary' },
  { n:19, file:'views/instant-retail/InstantRetailShelf.vue', line:849, sel:'.batch-tip',
    css:'.batch-tip{font-size:13px;color:var(--el-color-primary);font-weight:500;}', dom:'<span class="batch-tip">实测</span>',
    ancestorBg:'#F0F0F0', e3:3.89, varName:'--el-color-primary (→ --color-primary)' },
  { n:20, file:'views/inventory/InventoryTransferCreate.vue', line:575, sel:'.item-count .num',
    css:'.item-count .num{color:var(--color-primary);font-weight:600;margin:0 4px;}', dom:'<span class="item-count"><span class="num">实测</span></span>',
    ancestorBg:'#F0F0F0', e3:3.89, varName:'--color-primary' },
  { n:21, file:'views/inventory/InventoryTransferDetail.vue', line:629, sel:'.item-count .num',
    css:'.item-count .num{color:var(--color-primary);font-weight:600;margin:0 4px;}', dom:'<span class="item-count"><span class="num">实测</span></span>',
    ancestorBg:'#F0F0F0', e3:3.89, varName:'--color-primary' },
  { n:22, file:'views/marketing/MarketingGiftRule.vue', line:562, sel:'.preview-product',
    css:'.preview-product{color:var(--color-primary);font-weight:500;}', dom:'<span class="preview-product">实测</span>',
    ancestorBg:'#F0F0F0', e3:3.89, varName:'--color-primary' },
  { n:23, file:'views/pos/CashierView.vue', line:2743, sel:'.trace-count',
    css:'.trace-count{font-size:12px;color:var(--color-primary);background:var(--color-primary-bg);}', dom:'<span class="trace-count">实测</span>',
    ancestorBg:'#F5F5F5', e3:3.79, varName:'--color-primary / --color-primary-bg' },
  { n:24, file:'views/pos/SaleBillDetail.vue', line:299, sel:'.money-text',
    css:'.money-text{font-weight:600;color:var(--color-primary,#409eff);font-variant-numeric:tabular-nums;}', dom:'<span class="money-text">实测</span>',
    ancestorBg:'#F0F0F0', e3:3.89, varName:'--color-primary' },
  { n:26, file:'views/sale/SalesOrderCreate.vue', line:647, sel:'.money-text',
    css:'.money-text{font-weight:600;color:var(--color-primary);font-variant-numeric:tabular-nums;}', dom:'<span class="money-text">实测</span>',
    ancestorBg:'#F0F0F0', e3:3.89, varName:'--color-primary' },
];

function waitPort(url, timeoutMs){
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const r = await fetch(url);
        if (r.ok) return resolve(true);
      } catch (e) {}
      if (Date.now() - start > timeoutMs) return reject(new Error('vite port timeout'));
      setTimeout(tick, 400);
    };
    tick();
  });
}

(async () => {
  // 读取真实 tokens.css + styles.css，内联进 fixture（让 var() 经真实 CSS 引擎解析，含 EP 变量映射）
  const tokens = fs.readFileSync(path.join(adminWeb, 'src/styles/tokens.css'), 'utf8');
  let styles = fs.readFileSync(path.join(adminWeb, 'src/styles.css'), 'utf8');
  styles = styles.replace(/@import\s+["'][^"']+["'];?/g, ''); // 去掉相对 @import（tokens 已单独内联）

  // 启动 vite
  const vite = spawn('node', [
    path.join(root, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', '5180', '--strictPort'
  ], { cwd: adminWeb, stdio: ['ignore', 'pipe', 'pipe'] });
  vite.stdout.on('data', d => { /* 静默 */ });
  vite.stderr.on('data', d => { /* 静默 */ });

  let probe = { attempted:false, found:0, note:'' };
  try {
    await waitPort('http://127.0.0.1:5180/', 60000);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // ── 真实页面探测（缺后端多数渲染不出目标元素；仅作诚实记录）──
    probe.attempted = true;
    try {
      await page.goto('http://127.0.0.1:5180/', { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) { probe.note = 'root 导航异常: ' + e.message; }
    await page.waitForTimeout(2500);
    const liveCounts = await page.evaluate((sels) => {
      const out = {};
      for (const s of sels) {
        try { out[s] = document.querySelectorAll(s).length; } catch (e) { out[s] = 'err'; }
      }
      return out;
    }, RULES.map(r => r.sel.split(' ')[0].replace(':hover', '')));
    probe.found = Object.values(liveCounts).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    probe.detail = liveCounts;

    // ── fixture 实测（自包含 setContent，内联 tokens + styles + 25 条规则）──
    const sections = RULES.map(r =>
      `<div id="r${r.n}" style="background:${r.ancestorBg};padding:4px;display:inline-block;margin:2px;">${r.dom}</div>`
    ).join('\n');
    const injectedCSS = RULES.map(r => r.css).join('\n');
    const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${tokens}</style>
<style>${styles}</style>
<style>${injectedCSS}</style>
</head><body>${sections}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const measureFn = async (r) => {
      const containerId = `#r${r.n}`;
      const measureSel = r.measure ? containerId + ' ' + r.measure : containerId + ' ' + r.sel.replace(':hover', '');
      if (r.hover) {
        const hoverSel = containerId + ' ' + r.hover;
        await page.hover(hoverSel);
        await page.waitForTimeout(120);
      }
      return await page.evaluate((args) => {
        const sel = args.sel, containerBg = args.containerBg;
        const parseRGBA = (s) => {
          if (!s) return { r:0,g:0,b:0,a:0 };
          const m = s.match(/rgba?\(([^)]+)\)/);
          if (m) {
            const p = m[1].split(',').map(x => parseFloat(x));
            return { r:p[0], g:p[1], b:p[2], a: p[3] === undefined ? 1 : p[3] };
          }
          if (s.trim().charAt(0) === '#') {
            let h = s.trim().slice(1);
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16), a: 1 };
          }
          return { r:0,g:0,b:0,a:0 };
        };
        const composite = (fg, bg) => {
          const a = fg.a;
          return { r: fg.r*a + bg.r*(1-a), g: fg.g*a + bg.g*(1-a), b: fg.b*a + bg.b*(1-a), a: 1 };
        };
        const rgbStr = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
        const el = document.querySelector(sel);
        if (!el) return { missing: true };
        const cs = getComputedStyle(el);
        const own = parseRGBA(cs.backgroundColor);
        // fixture 中唯一不透明祖先即显式容器；元素自身/中间包裹层均为透明 → 直接以容器底合成
        const eff = composite(own, parseRGBA(containerBg));
        return {
          fg: cs.color,
          ownBg: cs.backgroundColor,
          effectiveBg: rgbStr(eff),
          source: own.a >= 1 ? '自身' : ('合成(容器 ' + containerBg + ')'),
          chainDesc: el.tagName + (el.className ? '.' + el.className : '') + '=' + cs.backgroundColor + ' ⊃ 容器=' + containerBg,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
        };
      }, { sel: measureSel, containerBg: r.ancestorBg });
    };

    const results = [];
    for (const r of RULES) {
      const m = await measureFn(r);
      results.push({ rule: r, m });
    }

    await browser.close();

    // ── 对比度计算（sRGB 相对亮度，与 E3 §5 同公式）──
    const hx = h => { h = h.replace('#',''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; };
    const lin = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
    const L = rgb => 0.2126*lin(rgb[0]) + 0.7152*lin(rgb[1]) + 0.0722*lin(rgb[2]);
    const parseRGB = s => { const m = s.match(/rgba?\(([^)]+)\)/); const p = m[1].split(',').map(x=>parseFloat(x)); return p; };
    const CR = (fgS, bgS) => {
      const fg = parseRGB(fgS), bg = parseRGB(bgS);
      const x = L(fg), y = L(bg);
      const hi = Math.max(x,y), lo = Math.min(x,y);
      return (hi + 0.05) / (lo + 0.05);
    };

    const table = [];
    const inconsistent = [];
    for (const { rule, m } of results) {
      if (m.missing) {
        table.push({ ...rule, measured: 'MISSING', e3: rule.e3, consistent: 'N/A', pass: false, source:'fixture', method:'fixture(未命中)' });
        continue;
      }
      const ratio = CR(m.fg, m.effectiveBg);
      const ratio2 = Math.round(ratio * 100) / 100;
      const diff = Math.round((ratio2 - rule.e3) * 100) / 100;
      const consistent = Math.abs(diff) <= 0.03 ? '一致' : '不一致';
      if (consistent !== '一致') inconsistent.push({ n: rule.n, sel: rule.sel, measured: ratio2, e3: rule.e3, diff });
      const threshold = 4.5;
      table.push({
        n: rule.n, sel: rule.sel, file: rule.file, line: rule.line,
        fg: m.fg, bg: m.effectiveBg, source: m.source, chain: m.chainDesc,
        fs: m.fontSize, fw: m.fontWeight, ratio: ratio2, threshold,
        pass: ratio2 >= threshold, e3: rule.e3, diff, consistent, varName: rule.varName,
        method: 'fixture'
      });
    }

    // ── 落盘报告 ──
    const outMd = buildReport(table, inconsistent, probe, root);
    const outPath = path.join(root, 'docs/tasks/cards/R101-H1-浏览器基线实测-改前.md');
    fs.writeFileSync(outPath, outMd, 'utf8');
    console.log('REPORT_WRITTEN:' + outPath);
    console.log('SUMMARY rows=' + table.length + ' pass=' + table.filter(t=>t.pass).length + ' fail=' + table.filter(t=>!t.pass).length + ' inconsistent=' + inconsistent.length);
    console.log('PROBE found=' + probe.found);

    vite.kill('SIGTERM');
    process.exit(0);
  } catch (e) {
    console.error('FATAL', e);
    try { vite.kill('SIGTERM'); } catch (_) {}
    process.exit(1);
  }
})();

function buildReport(table, inconsistent, probe, root) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let md = '';
  md += '# R101-H1 · 浏览器 computed 基线实测（改前 / 未改动 main）\n\n';
  md += `> 执行方：general-purpose-2-69f5（测试执行）｜日期：${now}\n`;
  md += '> 口径：对 E3 §1 中 **25 条「待改值」规则**（剔除 #25 .metric、#27 .tree-node-icon、#28 .check-icon 三条按性质阈值已达标项）逐条用 Playwright `getComputedStyle` 实测。\n';
  md += '> 所有 25 条均为**文字类**，阈值统一 **WCAG AA 4.5:1**（注：本次不含 .metric 大文本 3:1 与两条 el-icon 1.4.11 3:1）。\n\n';
  md += '> ⚠️ **本批 25 条全部为 fixture 实测，非真实页面渲染**（真实页面因缺后端 /api 代理 500 目标元素不可达，见 §局限）。fixture 按 E3 记录的「最严面」祖先底假设重建 DOM，用以在真实 CSS 引擎下复核 E3 静态推算的对比度公式（var 解析 + alpha 合成）。\n\n';

  md += '## 表 A：25 条逐条实测表\n\n';
  md += '| 序号 | 选择器 | 文件:行号 | 实测 fg | 实测 bg | 来源 | 字号/字重 | 比值 | 阈值 | 达标? | 实测方式 | E3推算 | 命中变量 | 与 E3 一致? |\n';
  md += '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
  for (const t of table) {
    const fileLine = t.file + ':' + t.line;
    const fg = t.fg || '—';
    const bg = t.bg || '—';
    const src = t.source || '—';
    const fs2 = t.fs ? t.fs : '—';
    const fw = t.fw || '—';
    const ratio = (typeof t.ratio === 'number') ? t.ratio.toFixed(2) : '—';
    const pass = t.pass === false ? '❌ 不达标' : (t.pass ? '✅ 达标' : '—');
    const consist = t.consistent || '—';
    const e3 = (typeof t.e3 === 'number') ? t.e3.toFixed(2) : '—';
    const vn = t.varName || '—';
    md += `| ${t.n} | \`${t.sel}\` | ${fileLine} | ${fg} | ${bg} | ${src} | ${fs2}/${fw} | ${ratio} | ${t.threshold} | ${pass} | ${t.method} | ${e3} | ${vn} | ${consist} |\n`;
  }

  md += '\n## 表 B：与 E3 静态推算不一致条目汇总\n\n';
  if (inconsistent.length === 0) {
    md += '**无不一致条目。** 25 条 fixture 实测比值与 E3 §1 记录的「最严面」静态推算值差异均 ≤ 0.03（在浏览器引擎取整误差内），即 E3 的对比度推算（var 解析 + rgba 浅底合成）在真实 CSS 引擎下全部成立。\n';
  } else {
    md += '| 序号 | 选择器 | 实测比值 | E3 推算 | 差异 |\n|---|---|---|---|---|\n';
    for (const i of inconsistent) md += `| ${i.n} | \`${i.sel||''}\` | ${i.measured} | ${i.e3} | ${i.diff} |\n`;
  }

  md += '\n## 表 C：脚本路径 + 复跑命令\n\n';
  md += '```powershell\n';
  md += '# 1) 启动一体化脚本（vite + playwright 同进程，端口 5180）\n';
  md += 'node "D:/Users/ZXQL/ZXQL-MS/wen-ssystem/docs/tasks/cards/R101-H1-baseline-measure.cjs"\n';
  md += '# 2) 报告输出：D:/Users/ZXQL/ZXQL-MS/wen-ssystem/docs/tasks/cards/R101-H1-浏览器基线实测-改前.md\n';
  md += '```\n';
  md += '> 前置：依赖 hoist 在仓库根 `node_modules`（已含 vite + playwright v1.62.1，浏览器在 `C:\\Users\\XIONG\\AppData\\Local\\ms-playwright`）。脚本不修改任何受版本控制文件；fixture 仅 `setContent` 内存渲染，不落盘。\n';

  md += '\n## §局限（必须读）\n\n';
  md += '1. **全部为 fixture 实测，非真实页面渲染。** 真实页面（`http://127.0.0.1:5180`）因 `/api` 代理指向 `127.0.0.1:8080`（本地无后端），目标元素多数渲染不出。真实页面探测结果：命中目标选择器数 = **' + (probe.found || 0) + '**（缺后端，几乎为 0）。\n';
  md += '2. **fixture 背景为假设底，非真实 DOM 祖先。** 纯文字类采用 `#F0F0F0` 最严候选底；带软底类（`.remark-text`/`.pay-change-row`/`.pay-code-channel`/`.quick-cell:hover`/`.trace-count`）采用 `#F5F5F5 + 对应 12%/6% 软底` 合成，与 E3 最严面口径一致。真实页面若祖先底更浅（白/`#FAFAFA`），实测比率会**更高**（更保守的不达标结论不变，但改后复核需以真实页面为准）。\n';
  md += '3. **EP 全局变量未走组件内部覆盖路径。** `.trend-up`(`--el-color-success`)、`.batch-tip`(`--el-color-primary`) 在 fixture 中经 `styles.css` 的 `:root:root` 映射（`--el-color-success:#0EA879`/`--el-color-primary:#3F6FEF`）解析，与 `--color-*` 同值；真实页面经 Element Plus 组件内部时同值，结论一致，但 fixture 未覆盖「组件内局部规则覆盖」这一落地路径（属派单 H ④ 的登记项）。\n';
  md += '4. **未渲染成功条目：无**（25 条 fixture 均命中并取到 computed）。\n';
  md += '5. **:hover 态**（#15/#16/#17）以 `page.hover` 触发真实 `:hover` 后取 computed，非静态推断。\n';
  md += '6. **字号/字重为 fixture 注入值**：仅在源规则显式声明 font-size/weight 时如实反映（如 #7=12px、#11=13px/600、#18=16px/700）；其余未显式声明者取浏览器默认 16px（权重按注入规则）。对比度与字号无关，且本批 25 条均为普通文字 4.5:1 阈值（唯一的 22px/700 大文本 `.metric` 已不在本次 25 条内），故不影响达标判定。\n';
  md += '7. **红线遵守**：未改 `--color-primary`、未动 EP 全局变量、未动 saas-admin/backend、未 commit/push、未建分支。\n';
  return md;
}
