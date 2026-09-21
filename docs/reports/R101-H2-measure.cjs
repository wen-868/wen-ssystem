'use strict';
/*
 * R101-H2 浏览器实测取数 harness（数据驱动，v2：含建议值/两列最严/黑字对比）
 * ---------------------------------------------------------------------------
 * 输入：候选 JSON 配置（token 清单 + 面清单 + 前景/底色对 + proposals 建议值）。
 *      配置缺省时本脚本会就地生成默认配置到 _h2_measure_config.json；
 *      编辑 proposals 字段追加「建议值」即可重跑对比。
 * 流程：抽取四端 :root token -> 改写作用域为 .end-<端> -> 生成基准页(含黑字对比/组件/
 *      深底反白/建议值对照) -> Playwright 打开(file://) -> 逐项 getComputedStyle 实测 ->
 *      半透明底色向上合成 -> 计算 WCAG 2.x 对比度 -> 全矩阵最严 + 常规浅底最严 + 建议后比值。
 * 红线：本脚本只读源码、只生成 docs/reports/R101-H2-* 三个文件与临时 _h2_computed.json，
 *      不改动任何受控源码；不 commit/push。
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require(require.resolve('playwright', {
  paths: [path.resolve(__dirname, '..', '..')]
}));

const hex2 = n => n.toString(16).padStart(2, '0');
const toHex = c => '#' + hex2(Math.round(c.r)) + hex2(Math.round(c.g)) + hex2(Math.round(c.b));
const round2 = x => Math.round(x * 100) / 100;

// ===========================================================================
// 默认候选配置（首次运行写入临时 JSON；之后以该 JSON 为准，便于追加建议值重跑）
// ===========================================================================
const DEFAULT_CONFIG = {
  projectRoot: path.resolve(__dirname, '..', '..'),
  tempDir: 'D:/Users/ZXQL/ZXQL-MS',
  // 常规浅底（不透明）集合：用于「常规浅底最严」列，排除徽章 translucent 底
  conventionalSurfaces: {
    'admin-web': ['#FFFFFF', '--bg-page', '--bg-card', '--bg-soft', '--bg-sidebar', '--table-header-bg', '--table-row-hover'],
    'saas-admin': ['#FFFFFF', '--bg-page', '--bg-card', '--bg-soft', '--bg-sidebar', '--table-header-bg', '--table-row-hover'],
    'app-mobile': ['#FFFFFF', '--uni-bg-color-page', '--uni-bg-color', '--uni-bg-color-soft', '--uni-bg-color-grey'],
    'website': ['#FFFFFF', '--bg', '--bg-alt', '--border']
  },
  ends: {
    'admin-web': {
      label: 'admin-web 工作台', scope: 'admin-web',
      baseBgToken: '--bg-page', darkSurface: '--gray-900',
      midSurface: '--bg-soft', statusSurface: '--color-primary',
      importOrder: ['admin-web/src/styles/tokens.css', 'admin-web/src/styles.css'],
      files: [
        { path: 'admin-web/src/styles/tokens.css', kind: 'css-root' },
        { path: 'admin-web/src/styles.css', kind: 'css-root' }
      ],
      aliases: {
        primary: '--color-primary', primarySoft: '--color-primary-soft', inverse: '--text-inverse',
        border: '--border-normal', tableHeaderBg: '--table-header-bg', tableHeaderText: '--table-header-text',
        tableBorder: '--table-border', inputBg: '--input-bg', inputBorder: '--input-border'
      },
      foregrounds: [
        { name: '--text-primary', role: 'text' }, { name: '--text-secondary', role: 'text' },
        { name: '--text-muted', role: 'text' }, { name: '--text-placeholder', role: 'text' },
        { name: '--text-link', role: 'text' }, { name: '--text-inverse', role: 'text' },
        { name: '--table-header-text', role: 'text' },
        { name: '--color-primary', role: 'graphic' }, { name: '--color-success', role: 'graphic' },
        { name: '--color-warning', role: 'graphic' }, { name: '--color-danger', role: 'graphic' },
        { name: '--color-info', role: 'graphic' }, { name: '#FFFFFF', role: 'text', literal: true }
      ],
      surfaces: [
        { name: '#FFFFFF', literal: true }, { name: '--bg-page' }, { name: '--bg-card' },
        { name: '--bg-soft' }, { name: '--bg-sidebar' }, { name: '--table-header-bg' },
        { name: '--table-row-hover' }, { name: '--color-primary-soft' }, { name: '--color-primary-bg' },
        { name: '--color-success-soft' }, { name: '--color-warning-soft' }, { name: '--color-danger-soft' },
        { name: '--color-primary', solid: true }, { name: '--color-success', solid: true },
        { name: '--color-warning', solid: true }, { name: '--color-danger', solid: true }
      ]
    },
    'saas-admin': {
      label: 'saas-admin 租户后台', scope: 'saas-admin',
      baseBgToken: '--bg-page', darkSurface: '--gray-900',
      midSurface: '--bg-soft', statusSurface: '--color-primary',
      importOrder: ['saas-admin/src/style.css', 'saas-admin/src/styles/tokens.css',
        'saas-admin/src/styles/components.css', 'saas-admin/src/styles/layout.css'],
      files: [
        { path: 'saas-admin/src/style.css', kind: 'css-root', lightOnly: true },
        { path: 'saas-admin/src/styles/tokens.css', kind: 'css-root' },
        { path: 'saas-admin/src/styles/components.css', kind: 'css-root' },
        { path: 'saas-admin/src/styles/layout.css', kind: 'css-root' }
      ],
      aliases: {
        primary: '--color-primary', primarySoft: '--color-primary-soft', inverse: '--text-inverse',
        border: '--border-normal', tableHeaderBg: '--table-header-bg', tableHeaderText: '--table-header-text',
        tableBorder: '--table-border', inputBg: '--input-bg', inputBorder: '--input-border'
      },
      foregrounds: [
        { name: '--text-primary', role: 'text' }, { name: '--text-secondary', role: 'text' },
        { name: '--text-muted', role: 'text' }, { name: '--text-placeholder', role: 'text' },
        { name: '--text-link', role: 'text' }, { name: '--text-inverse', role: 'text' },
        { name: '--table-header-text', role: 'text' },
        { name: '--color-primary', role: 'graphic' }, { name: '--color-success', role: 'graphic' },
        { name: '--color-warning', role: 'graphic' }, { name: '--color-danger', role: 'graphic' },
        { name: '--color-info', role: 'graphic' }, { name: '#FFFFFF', role: 'text', literal: true }
      ],
      surfaces: [
        { name: '#FFFFFF', literal: true }, { name: '--bg-page' }, { name: '--bg-card' },
        { name: '--bg-soft' }, { name: '--bg-sidebar' }, { name: '--table-header-bg' },
        { name: '--table-row-hover' }, { name: '--color-primary-soft' }, { name: '--color-primary-bg' },
        { name: '--color-success-soft' }, { name: '--color-warning-soft' }, { name: '--color-danger-soft' },
        { name: '--color-primary', solid: true }, { name: '--color-success', solid: true },
        { name: '--color-warning', solid: true }, { name: '--color-danger', solid: true }
      ]
    },
    'app-mobile': {
      label: 'app-mobile 商户端', scope: 'app-mobile',
      baseBgToken: '--uni-bg-color-page', darkSurface: '--uni-gray-900',
      midSurface: '--uni-bg-color-soft', statusSurface: '--uni-color-primary',
      importOrder: ['app-mobile/src/uni.scss'],
      files: [{ path: 'app-mobile/src/uni.scss', kind: 'scss' }],
      aliases: {
        primary: '--uni-color-primary', primarySoft: '--uni-color-primary-soft', inverse: '--uni-text-color-inverse',
        border: '--uni-border-color', tableHeaderBg: '--color-primary-soft', tableHeaderText: '--uni-text-color',
        tableBorder: '--uni-border-color', inputBg: '--uni-bg-color', inputBorder: '--uni-border-color'
      },
      foregrounds: [
        { name: '--uni-text-color', role: 'text' }, { name: '--uni-text-color-secondary', role: 'text' },
        { name: '--uni-text-color-grey', role: 'text' }, { name: '--uni-text-color-placeholder', role: 'text' },
        { name: '--uni-text-color-link', role: 'text' }, { name: '--uni-text-color-inverse', role: 'text' },
        { name: '--uni-color-primary', role: 'graphic' }, { name: '--uni-color-success', role: 'graphic' },
        { name: '--uni-color-warning', role: 'graphic' }, { name: '--uni-color-error', role: 'graphic' },
        { name: '--uni-color-info', role: 'graphic' }, { name: '#FFFFFF', role: 'text', literal: true }
      ],
      surfaces: [
        { name: '#FFFFFF', literal: true }, { name: '--uni-bg-color-page' }, { name: '--uni-bg-color' },
        { name: '--uni-bg-color-soft' }, { name: '--uni-bg-color-grey' },
        { name: '--uni-color-primary-soft' }, { name: '--uni-color-success-soft' },
        { name: '--uni-color-warning-soft' }, { name: '--uni-color-error-soft' },
        { name: '--uni-color-primary', solid: true }, { name: '--uni-color-success', solid: true },
        { name: '--uni-color-warning', solid: true }, { name: '--uni-color-error', solid: true },
        { name: '--uni-color-info', solid: true }
      ]
    },
    'website': {
      label: 'website 官网', scope: 'website',
      baseBgToken: '--bg', darkSurface: '--bg-dark',
      midSurface: '--bg-alt', statusSurface: '--primary',
      importOrder: ['website/src/assets/global.css'],
      files: [{ path: 'website/src/assets/global.css', kind: 'css-root' }],
      aliases: {
        primary: '--primary', primarySoft: '--primary-light', inverse: '#FFFFFF',
        border: '--border', tableHeaderBg: '--bg-alt', tableHeaderText: '--text',
        tableBorder: '--border', inputBg: '#FFFFFF', inputBorder: '--border'
      },
      foregrounds: [
        { name: '--text', role: 'text' }, { name: '--text-secondary', role: 'text' },
        { name: '--primary', role: 'text' }, { name: '#FFFFFF', role: 'text', literal: true }
      ],
      surfaces: [
        { name: '#FFFFFF', literal: true }, { name: '--bg' }, { name: '--bg-alt' },
        { name: '--bg-dark', dark: true }, { name: '--primary', solid: true },
        { name: '--primary-light' }, { name: '--border' }
      ]
    }
  },
  // 建议值候选（阶段1冻结口径后的统一提案；空数组/空对象=不跑建议值）
  proposals: {
    'admin-web': {
      '--bg-page': '#F7F7F7', '--bg-sidebar': '#FFFFFF',
      '--table-header-bg': '#F8F8F8', '--table-row-hover': '#F8F8F8',
      '--text-primary': '#171717', '--text-secondary': '#525252', '--text-muted': '#6B6B6B',
      '--text-placeholder': ['#6B6B6B', '#767676'], '--text-link': '#2563EB',
      '--color-primary': '#2563EB', '--color-primary-hover': '#1D4ED8', '--color-primary-active': '#1E40AF',
      '--color-success': '#047857', '--color-warning': '#8E5D27', '--color-danger': '#C0392B', '--color-info': '#2563EB',
      '--border-normal': '#E5E5E5', '--table-border': '#E5E5E5', '--input-border': '#888888', '--border-focus': '#2563EB',
      '--gray-300': '#D4D4D4', '--gray-400': '#A3A3A3', '--gray-500': '#737373', '--gray-600': '#525252', '--gray-700': '#404040'
    },
    'saas-admin': {
      '--bg-page': '#F7F7F7', '--sidebar-bg': '#FFFFFF',
      '--table-header-bg': '#F8F8F8', '--table-row-hover': '#F8F8F8',
      '--text-primary': '#171717', '--text-secondary': '#525252', '--text-muted': '#6B6B6B',
      '--text-placeholder': ['#6B6B6B', '#767676'], '--text-link': '#2563EB',
      '--color-primary': '#2563EB', '--color-primary-hover': '#1D4ED8', '--color-primary-active': '#1E40AF',
      '--color-success': '#047857', '--color-warning': '#8E5D27', '--color-danger': '#C0392B', '--color-info': '#2563EB',
      '--border-normal': '#E5E5E5', '--table-border': '#E5E5E5', '--input-border': '#888888', '--border-focus': '#2563EB',
      '--gray-300': '#D4D4D4', '--gray-400': '#A3A3A3', '--gray-500': '#737373', '--gray-600': '#525252', '--gray-700': '#404040'
    },
    'app-mobile': {
      '--uni-bg-color-page': '#F7F7F7',
      '--uni-text-color': '#171717', '--uni-text-color-secondary': '#525252', '--uni-text-color-grey': '#6B6B6B',
      '--uni-text-color-placeholder': ['#6B6B6B', '#767676'], '--uni-text-color-link': '#2563EB',
      '--uni-color-primary': '#2563EB', '--uni-color-primary-hover': '#1D4ED8', '--uni-color-primary-active': '#1E40AF',
      '--uni-color-success': '#047857', '--uni-color-warning': '#8E5D27', '--uni-color-error': '#C0392B', '--uni-color-info': '#2563EB',
      '--uni-border-color': '#E5E5E5', '--uni-border-color-focus': '#2563EB',
      '--uni-gray-300': '#D4D4D4', '--uni-gray-400': '#A3A3A3', '--uni-gray-500': '#737373', '--uni-gray-600': '#525252', '--uni-gray-700': '#404040'
    },
    'website': {
      '--text': '#171717', '--text-secondary': '#525252', '--primary': '#2563EB', '--border': '#E5E5E5'
    }
  }
};

// ===========================================================================
// 颜色工具
// ===========================================================================
function parseColor(str) {
  if (!str) return null;
  let s = String(str).trim();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length === 8) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255 };
    if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    return null;
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a: m[4] === undefined ? 1 : parseFloat(m[4]) };
  return null;
}
function compositeOver(fg, bg) {
  if (fg.a >= 1) return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
  const a = fg.a + bg.a * (1 - fg.a);
  if (a <= 0) return { r: bg.r, g: bg.g, b: bg.b, a: 1 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a, a: 1
  };
}
function relLum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrastRatio(c1, c2) {
  const L1 = relLum(c1), L2 = relLum(c2), hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

// ===========================================================================
// 抽取四端 token 为作用域化 CSS
// ===========================================================================
function extractCssRootBlocks(css, scope, lightOnly) {
  const out = []; const n = css.length; let i = 0, depth = 0, inDarkMedia = false;
  while (i < n) {
    if (!inDarkMedia && css.startsWith('@media', i)) {
      const j = css.indexOf('{', i);
      if (/prefers-color-scheme:\s*dark/.test(css.slice(i, j))) inDarkMedia = true;
    }
    if (depth === 0 && !inDarkMedia && css.startsWith(':root', i)) {
      let j = i; while (j < n && css[j] !== '{') j++;
      const selector = css.slice(i, j).trim();
      const start = j; let k = j + 1, d = 1;
      while (k < n && d > 0) { if (css[k] === '{') d++; else if (css[k] === '}') d--; k++; }
      const body = css.slice(start + 1, k - 1);
      out.push(selector.replace(/:root/g, '.end-' + scope) + ' {' + body + '}');
      i = k; continue;
    }
    if (css[i] === '{') { depth++; } else if (css[i] === '}') { depth--; if (depth === 0) inDarkMedia = false; }
    i++;
  }
  return out;
}
function convertScssToCss(scss, scope) {
  const decls = [];
  for (let line of scss.split('\n')) {
    let s = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    const m = s.match(/^\s*\$([\w-]+)\s*:\s*([^;]+);\s*$/);
    if (m) decls.push('--' + m[1] + ': ' + m[2].trim() + ';');
  }
  return '.end-' + scope + ' {\n' + decls.join('\n') + '\n}';
}
function buildFixtureCss(cfg, root) {
  const blocks = [], notes = [];
  for (const endId of Object.keys(cfg.ends)) {
    const end = cfg.ends[endId];
    for (const f of end.files) {
      let css;
      try { css = fs.readFileSync(path.join(root, f.path), 'utf8'); }
      catch (e) { notes.push('[缺失] ' + f.path + ' : ' + e.message); continue; }
      if (f.kind === 'scss') blocks.push(convertScssToCss(css, end.scope));
      else {
        blocks.push(extractCssRootBlocks(css, end.scope, !!f.lightOnly).join('\n'));
        if (f.lightOnly) notes.push('saas-admin/style.css 仅取 light 组（dark 组 @media 内已丢弃）：' + f.path);
      }
    }
  }
  return { css: blocks.join('\n\n'), notes };
}
function buildComponentHelperCss(cfg) {
  const parts = [];
  for (const endId of Object.keys(cfg.ends)) {
    const a = cfg.ends[endId].aliases, s = '.end-' + cfg.ends[endId].scope;
    parts.push(`
${s} .btn-demo{display:inline-flex;align-items:center;justify-content:center;padding:8px 18px;border:none;border-radius:8px;
  background:var(${a.primary});color:var(${a.inverse},#fff);font-size:14px;font-weight:600;cursor:pointer;}
${s} .tag-demo{display:inline-flex;align-items:center;padding:2px 10px;border-radius:999px;font-size:12px;
  background:var(${a.primarySoft});color:var(${a.primary});}
${s} .border-demo{height:0;border-top:2px solid var(${a.border});margin:10px 0;}
${s} .tbl-demo{width:100%;border-collapse:collapse;font-size:13px;}
${s} .tbl-demo th{background:var(${a.tableHeaderBg});color:var(${a.tableHeaderText});text-align:left;padding:6px 10px;}
${s} .tbl-demo td{padding:6px 10px;border-top:1px solid var(${a.tableBorder});}
${s} .inp-demo{display:block;width:220px;padding:7px 10px;border-radius:6px;font-size:13px;
  background:var(${a.inputBg},#fff);border:1px solid var(${a.inputBorder});color:#222;}
${s} .inp-demo::placeholder{color:#999;}`);
  }
  return parts.join('\n');
}
function endContainers(cfg) {
  return Object.keys(cfg.ends).map(id =>
    `<section class="end-${cfg.ends[id].scope}" id="end-${id}"></section>`).join('\n');
}

// ===========================================================================
// 视觉基准页（含 黑字对比 / 组件样例 / 深底反白 / 建议值对照）
// ===========================================================================
function buildBaselineHtml(fixtureCss, helperCss, cfg, measured, report) {
  const ends = Object.keys(cfg.ends);
  // 黑字：四端正文主色并排
  const bodyToken = { 'admin-web': '--text-primary', 'saas-admin': '--text-primary', 'app-mobile': '--uni-text-color', 'website': '--text' };
  const heiRows = ends.map(id => {
    const m = measured[id] || {}; const tok = bodyToken[id];
    const c = parseColor(m.foregrounds && m.foregrounds[tok]);
    const hex = c ? toHex(c) : '?'; const ratio = c ? round2(contrastRatio({ r: 255, g: 255, b: 255 }, c)) : '?';
    return `<div class="hei-col"><div class="hei-token">${id}<br><code>${tok}</code></div>
      <div class="hei-specimen" style="color:${hex}">智享全链 正文主色 Aa 永</div>
      <div class="hei-meta">现值 <b>${hex}</b><br>白底对比 <b>${ratio}:1</b></div></div>`;
  }).join('');

  // 每端组件样例（白底 / 中浅灰 / 状态色）
  const catBlocks = [
    { label: '白底', surf: '#FFFFFF', literal: true },
    { label: '中浅灰', surf: 'midSurface' },
    { label: '状态色', surf: 'statusSurface' }
  ];
  const sections = ends.map(id => {
    const end = cfg.ends[id];
    const cats = catBlocks.map(cat => {
      const bg = cat.literal ? cat.surf : 'var(' + end[cat.surf] + ')';
      return `<div class="cat"><div class="cat-title">${cat.label} <code>${cat.literal ? cat.surf : end[cat.surf]}</code></div>
        <div class="cat-body" style="background:${bg}">
          <button class="btn-demo">按钮·底+字</button><span class="tag-demo">标签 Tag</span>
          <div class="border-demo"></div>
          <table class="tbl-demo"><thead><tr><th>表头单元格</th></tr></thead><tbody><tr><td>表格分隔线行</td></tr></tbody></table>
          <input class="inp-demo" placeholder="输入框 placeholder"></div></div>`;
    }).join('');
    return `<section class="end-${end.scope}" id="end-sec-${id}"><h2>${end.label} <span class="endid">(${id})</span></h2>
      <div class="cats">${cats}</div></section>`;
  }).join('\n');

  // 深底反白（附）
  const darkRows = ends.map(id => {
    const end = cfg.ends[id]; const ds = 'var(' + end.darkSurface + ')';
    return `<div class="end-${end.scope} dark-col"><div class="cat-title">${id}<br><code>${end.darkSurface}</code></div>
      <div class="cat-body" style="background:${ds}">
        <div style="color:var(${end.aliases.inverse},#fff);font-size:14px;">反白文字 Aa</div>
        <button class="btn-demo">按钮·白字</button><span class="tag-demo">标签</span>
        <input class="inp-demo" placeholder="输入框"></div></div>`;
  }).join('');

  // 建议值对照
  let propHtml = '<p class="muted">未配置建议值（proposals 为空）。</p>';
  if (report.proposalsReport && report.proposalsReport.length) {
    const rows = report.proposalsReport.map(p => {
      const cls = p.exempt ? 'ex' : (p.pass ? 'ok' : 'bad');
      const tag = p.exempt ? '装饰豁免' : (p.pass ? '达标' : '未达');
      return `<tr><td><code>${p.end}</code></td><td><code>${p.token}</code></td><td>${p.kind}</td>
        <td>${p.currentHex}</td><td><b>${p.proposedHex}</b></td>
        <td>${p.currentRatio}</td><td><b>${p.proposedRatio}</b></td>
        <td>≥${p.threshold}</td><td class="${cls}">${p.proposedRatio} ${tag}</td></tr>`;
    }).join('');
    propHtml = `<table class="rtbl"><thead><tr><th>端</th><th>token</th><th>类</th><th>现值</th><th>建议值</th>
      <th>现比值</th><th>建议后</th><th>门槛</th><th>结论</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  // 底+字 替代方案
  let diHtml = '';
  if (report.diizi) {
    const dr = ends.map(id => {
      const d = report.diizi[id] || {};
      return `<tr><td><code>${id}</code></td>
        <td>${d.primary ? d.primary.whiteCurrent + ' → ' + d.primary.whiteProposed : '-'}</td>
        <td>${d.success ? d.success.whiteCurrent + ' → ' + d.success.whiteProposed : '-'}</td>
        <td>白字 ${d.warning ? d.warning.whiteCurrent : '-'} → 建议 ${d.warning ? d.warning.whiteProposed : '-'}<br>替代(深字#171717压现warning) ${d.warning ? d.warning.darkAlt : '-'}</td>
        <td>${d.danger ? d.danger.whiteCurrent : '-'}</td></tr>`;
    }).join('');
    diHtml = `<table class="rtbl"><thead><tr><th>端</th><th>白×primary</th><th>白×success</th><th>白×warning（含深字替代）</th><th>白×danger</th></tr></thead><tbody>${dr}</tbody></table>`;
  }

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>R101-H2 视觉基准页（阶段1·现值冻结 + 建议值对照）</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; background: #e9edf5; color: #1a1a1a; padding: 24px; }
h1 { font-size: 20px; margin: 0 0 4px; } .sub { color: #555; font-size: 13px; margin-bottom: 18px; }
h2 { font-size: 16px; margin: 0 0 12px; } .endid { color: #999; font-weight: 400; font-size: 13px; }
section, .panel { background: #fff; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.panel h2 { border-left: 4px solid #3F6FEF; padding-left: 10px; }
.cats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.cat { border: 1px solid #e3e3e3; border-radius: 10px; overflow: hidden; }
.cat-title { font-size: 12px; font-weight: 600; padding: 8px 10px; background: #f6f7f9; color: #333; }
.cat-title code { color: #888; font-weight: 400; }
.cat-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; min-height: 220px; }
.hei-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.hei-col { border: 1px solid #e3e3e3; border-radius: 10px; padding: 12px; background: #fff; }
.hei-token { font-size: 12px; color: #666; margin-bottom: 8px; } .hei-token code { color: #3F6FEF; }
.hei-specimen { font-size: 22px; line-height: 1.5; border: 1px solid #eee; padding: 10px; border-radius: 6px; min-height: 60px; }
.hei-meta { font-size: 12px; color: #555; margin-top: 8px; }
.dark-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.dark-col { border: 1px solid #e3e3e3; border-radius: 10px; overflow: hidden; }
.dark-col .cat-body { min-height: 160px; }
.rtbl { border-collapse: collapse; width: 100%; font-size: 12px; }
.rtbl th, .rtbl td { border: 1px solid #e3e3e3; padding: 5px 8px; text-align: left; }
.rtbl th { background: #f6f7f9; }
.rtbl .ok { color: #0a7d33; font-weight: 600; } .rtbl .bad { color: #c0392b; font-weight: 600; } .rtbl .ex { color: #b8860b; }
code { font-family: ui-monospace, Consolas, monospace; }
.muted { color: #888; }
@media (max-width: 1100px){ .cats, .hei-grid, .dark-grid { grid-template-columns: repeat(2,1fr); } }
${helperCss}
</style><style>${fixtureCss}</style></head>
<body>
<h1>R101-H2 全局统一色板 · 视觉基准页</h1>
<div class="sub">阶段1 只冻结「现值」口径，不改任何颜色。所有颜色来自各端 token 的 getComputedStyle 实测。下方含「黑字四端对比」「组件样例(白底/中浅灰/状态色)」「附·深底反白」「建议值 vs 现值对照」「底+字替代方案」。</div>

<div class="panel"><h2>黑字 · 四端正文主色并排对比（同一白底）</h2>
  <p class="muted">一屏看出四端「黑字」不是同一个黑：$\textcolor 各异，距纯黑 #000000 均有偏差。</p>
  <div class="hei-grid">${heiRows}</div></div>

${sections}

<div class="panel"><h2>附 · 深底反白（深色背景上的反白文字/组件）</h2>
  <div class="dark-grid">${darkRows}</div></div>

<div class="panel"><h2>建议值 vs 现值 对照（统一提案）</h2>${propHtml}</div>

<div class="panel"><h2>底+字 组合：白字压状态实底（派单要求补的一类）</h2>${diHtml}</div>
</body></html>`;
}

// ===========================================================================
// 对比度分析（当前 / 建议后 / 常规浅底）
// ===========================================================================
function analyze(end, fgColors, surfColors, baseOpaque, cfg) {
  const surfKind = {};
  for (const s of end.surfaces) surfKind[s.name] = s.dark ? 'dark' : (s.solid ? 'solid' : 'light');
  const convSet = (cfg.conventionalSurfaces && cfg.conventionalSurfaces[end.scope]) || [];
  const perFg = [];
  for (const f of end.foregrounds) {
    const fc = fgColors[f.name];
    if (!fc) { perFg.push({ token: f.name, role: f.role, status: 'absent' }); continue; }
    const fgIsWhite = fc.r === 255 && fc.g === 255 && fc.b === 255 && fc.a >= 0.999;
    let strictest = null, strictestName = null, convStrictest = null, convName = null;
    for (const s of end.surfaces) {
      const sc = surfColors[s.name];
      if (!sc || sc.a <= 0) continue;
      const eff = sc.a < 1 ? compositeOver(sc, baseOpaque) : sc;
      const ratio = contrastRatio(fc, eff);
      const eligible = fgIsWhite ? (surfKind[s.name] === 'solid' || surfKind[s.name] === 'dark') : surfKind[s.name] === 'light';
      const degenerate = ratio < 1.02;
      if (eligible && !degenerate && (strictest === null || ratio < strictest)) { strictest = ratio; strictestName = s.name; }
      if (convSet.includes(s.name) && !degenerate && (convStrictest === null || ratio < convStrictest)) { convStrictest = ratio; convName = s.name; }
    }
    const thr = f.role === 'text' ? 4.5 : 3;
    perFg.push({
      token: f.name, role: f.role, strictestSurface: strictestName, strictestRatio: strictest === null ? null : round2(strictest),
      conventionalSurface: convName, conventionalRatio: convStrictest === null ? null : round2(convStrictest),
      threshold: thr, pass: strictest === null ? null : strictest >= thr
    });
  }
  return perFg;
}

function buildProposalsReport(cfg, endId, end, fgColors, surfColors, proposedFg, proposedSurf, measured) {
  const p = (cfg.proposals && cfg.proposals[endId]) || {};
  const rows = [];
  const fgNames = new Set(end.foregrounds.map(f => f.name));
  const surfNames = new Set(end.surfaces.map(s => s.name));
  const bodyTok = { 'admin-web': '--text-primary', 'saas-admin': '--text-primary', 'app-mobile': '--uni-text-color', 'website': '--text' }[endId];
  const pageTok = end.baseBgToken;
  const bodyProp = (p[bodyTok] && (Array.isArray(p[bodyTok]) ? p[bodyTok][0] : p[bodyTok])) || (measured[endId] && measured[endId].foregrounds[bodyTok]);
  const pageProp = (p[pageTok] && (Array.isArray(p[pageTok]) ? p[pageTok][0] : p[pageTok])) || (measured[endId] && measured[endId].surfaces[pageTok]);
  for (const tok of Object.keys(p)) {
    const vals = Array.isArray(p[tok]) ? p[tok] : [p[tok]];
    vals.forEach(proposedVal => {
      const isFg = fgNames.has(tok);
      const isSurf = surfNames.has(tok);
      const borderLikePre = /border|table-border|^--gray-|^--uni-gray-/.test(tok);
      // 未分类（既非前景、也非面、也非边界/灰阶）的 token 不再产出行——
      // 否则会拿错判据算出一个假的 FAIL（同族坑：口径错当缺陷报）
      if (!isFg && !isSurf && !borderLikePre) return;
      const kind = isFg ? '前景' : (isSurf ? '面' : '结构');
      const currentHex = (isFg ? measured[endId].foregrounds[tok] : (isSurf ? measured[endId].surfaces[tok] : (measured[endId].surfaces[tok] || measured[endId].foregrounds[tok]))) || '?';
      let threshold, currentRatio, proposedRatio, exempt = false;
      if (isFg) {
        threshold = (end.foregrounds.find(f => f.name === tok).role === 'text') ? 4.5 : 3;
        currentRatio = '见前景'; proposedRatio = '见前景';
      } else {
        const borderLike = /border|table-border|^--gray-|^--uni-gray-/.test(tok);
        threshold = borderLike ? 3 : 4.5;
        if (borderLike) exempt = /border-normal|^--border$|table-border|^--gray-300$|^--gray-400$|^--uni-border-color$|^--uni-gray-300$|^--uni-gray-400$/.test(tok);
        const curBorder = parseColor(typeof currentHex === 'string' ? currentHex : '?');
        const propBorder = parseColor(proposedVal);
        const curPage = parseColor(typeof (measured[endId].surfaces[pageTok]) === 'string' ? measured[endId].surfaces[pageTok] : (p[pageTok] && (Array.isArray(p[pageTok]) ? p[pageTok][0] : p[pageTok])) || '#FFFFFF');
        if (borderLike) {
          const cp = parseColor(pageProp || (measured[endId].surfaces[pageTok]));
          const pp = parseColor(p[pageTok] && (Array.isArray(p[pageTok]) ? p[pageTok][0] : p[pageTok]) || measured[endId].surfaces[pageTok]);
          currentRatio = cp ? round2(contrastRatio(curBorder || { r: 0, g: 0, b: 0, a: 1 }, cp)) : '?';
          proposedRatio = pp ? round2(contrastRatio(propBorder || { r: 0, g: 0, b: 0, a: 1 }, pp)) : '?';
        } else {
          // 实底面（按钮底/状态底/hover 底）：正确判据是「**白字压在该实底上**」，
          // 而不是「正文字色压在该实底上」——后者会把 hover 色误判成缺陷。
          const solidSurf = (end.surfaces || []).find(s => s.name === tok && s.solid);
          if (solidSurf) {
            const W = { r: 255, g: 255, b: 255, a: 1 };
            threshold = 4.5;
            currentRatio = curBorder ? round2(contrastRatio(W, curBorder)) : '?';
            proposedRatio = propBorder ? round2(contrastRatio(W, propBorder)) : '?';
          } else {
            const cb = parseColor(bodyProp || (measured[endId].foregrounds[bodyTok]));
            const pb = parseColor(p[bodyTok] && (Array.isArray(p[bodyTok]) ? p[bodyTok][0] : p[bodyTok]) || measured[endId].foregrounds[bodyTok]);
            currentRatio = cb ? round2(contrastRatio(cb, curBorder || { r: 255, g: 255, b: 255, a: 1 })) : '?';
            proposedRatio = pb ? round2(contrastRatio(pb, propBorder || { r: 255, g: 255, b: 255, a: 1 })) : '?';
          }
        }
      }
      const pass = (typeof proposedRatio === 'number') ? (exempt ? true : proposedRatio >= threshold) : null;
      rows.push({ end: endId, token: tok, kind, currentHex: parseColor(currentHex) ? toHex(parseColor(currentHex)) : currentHex, proposedHex: proposedVal,
        currentRatio, proposedRatio, threshold, exempt, pass });
    });
  }
  return rows;
}

function buildDiizi(cfg, endId, end, measured, fgColors, surfColors, proposedSurf) {
  const solids = end.surfaces.filter(s => s.solid).map(s => s.name);
  const out = {};
  for (const sName of solids) {
    const cur = surfColors[sName]; if (!cur) continue;
    const prop = proposedSurf[sName] || cur;
    const white = { r: 255, g: 255, b: 255, a: 1 };
    const dark = { r: 23, g: 23, b: 23, a: 1 }; // #171717
    const rec = {
      whiteCurrent: round2(contrastRatio(white, cur)),
      whiteProposed: round2(contrastRatio(white, prop))
    };
    if (/warning/i.test(sName)) rec.darkAlt = round2(contrastRatio(dark, cur));
    out[sName] = rec;
  }
  return out;
}

// ===========================================================================
// 主流程
// ===========================================================================
async function main() {
  const argConfig = process.argv[2];
  const cfgPath = argConfig || path.join(DEFAULT_CONFIG.tempDir, '_h2_measure_config.json');
  let cfg;
  if (fs.existsSync(cfgPath)) cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  else { cfg = DEFAULT_CONFIG; fs.mkdirSync(path.dirname(cfgPath), { recursive: true }); fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8'); console.log('[配置] 已生成默认候选配置：' + cfgPath); }
  const root = cfg.projectRoot || path.resolve(__dirname, '..', '..');
  const htmlOut = path.join(root, 'docs', 'reports', 'R101-H2-baseline-page.html');
  const pngOut = path.join(root, 'docs', 'reports', 'R101-H2-baseline-page.png');
  const jsonOut = path.join(cfg.tempDir || DEFAULT_CONFIG.tempDir, '_h2_computed.json');
  fs.mkdirSync(path.dirname(htmlOut), { recursive: true });

  const { css: fixtureCss, notes } = buildFixtureCss(cfg, root);
  const helperCss = buildComponentHelperCss(cfg);

  // —— 第1步：测量（加载含 end 容器的极简页）——
  const measureHtml = `<!DOCTYPE html><html><head><style>${fixtureCss}</style></head><body>${endContainers(cfg)}</body></html>`;
  const measureFile = path.join(cfg.tempDir || DEFAULT_CONFIG.tempDir, '_h2_measure_tmp.html');
  fs.writeFileSync(measureFile, measureHtml, 'utf8');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await page.goto('file:///' + measureFile.replace(/\\/g, '/'));
  await page.waitForTimeout(150);
  const measured = await page.evaluate((spec) => {
    const res = {};
    for (const endId of Object.keys(spec)) {
      const endEl = document.getElementById('end-' + endId);
      if (!endEl) { res[endId] = { error: 'end container missing' }; continue; }
      const e = { foregrounds: {}, surfaces: {}, baseBg: null };
      for (const f of spec[endId].foregrounds) {
        const d = document.createElement('div'); d.style.display = 'inline-block';
        d.style.color = f.literal ? f.name : 'var(' + f.name + ')'; endEl.appendChild(d);
        e.foregrounds[f.name] = getComputedStyle(d).color; endEl.removeChild(d);
      }
      for (const s of spec[endId].surfaces) {
        const d = document.createElement('div'); d.style.display = 'inline-block';
        d.style.backgroundColor = s.literal ? s.name : 'var(' + s.name + ')'; endEl.appendChild(d);
        e.surfaces[s.name] = getComputedStyle(d).backgroundColor; endEl.removeChild(d);
      }
      const bd = document.createElement('div'); bd.style.display = 'inline-block'; bd.style.backgroundColor = 'var(' + spec[endId].baseBgToken + ')';
      endEl.appendChild(bd); e.baseBg = getComputedStyle(bd).backgroundColor; endEl.removeChild(bd);
      res[endId] = e;
    }
    return res;
  }, (() => { const s = {}; for (const id of Object.keys(cfg.ends)) s[id] = { foregrounds: cfg.ends[id].foregrounds, surfaces: cfg.ends[id].surfaces, baseBgToken: cfg.ends[id].baseBgToken }; return s; })());
  await browser.close();
  console.log('[实测] 完成 ' + Object.keys(measured).length + ' 端 getComputedStyle');

  // —— 第2步：计算（当前 / 建议后 / 常规浅底 / 建议值 / 底+字）——
  const hasProp = !!(cfg.proposals && Object.keys(cfg.proposals).length);
  const report = { generatedAt: new Date().toISOString(), configPath: cfgPath, hasProposals: hasProp, notes, ends: {} };
  let totalCombos = 0, failText = 0, failGraphic = 0, failStatus45 = 0;
  let propTotal = 0, propPass = 0, propExempt = 0;
  const proposalsReportAll = [];
  const diiziAll = {};

  for (const endId of Object.keys(cfg.ends)) {
    const end = cfg.ends[endId]; const m = measured[endId] || {};
    const baseBg = parseColor(m.baseBg) || { r: 255, g: 255, b: 255, a: 1 };
    const baseOpaque = baseBg.a < 1 ? compositeOver(baseBg, { r: 255, g: 255, b: 255, a: 1 }) : baseBg;
    const fgColors = {}, surfColors = {};
    for (const f of end.foregrounds) { const c = parseColor(m.foregrounds && m.foregrounds[f.name]); fgColors[f.name] = c; }
    for (const s of end.surfaces) { const c = parseColor(m.surfaces && m.surfaces[s.name]); surfColors[s.name] = c && c.a > 0 ? c : null; }
    const cur = analyze(end, fgColors, surfColors, baseOpaque, cfg);
    for (const pf of cur) { if (pf.status === 'absent') continue; totalCombos += end.surfaces.length; if (pf.role === 'text') { if (!pf.pass) failText++; } else { if (!pf.pass) failGraphic++; } if (pf.role === 'graphic' && pf.strictestRatio !== null && pf.strictestRatio < 4.5) failStatus45++; }

    // 建议后
    let prop = null;
    if (hasProp) {
      const p = cfg.proposals[endId] || {};
      const fg2 = { ...fgColors }, surf2 = { ...surfColors };
      for (const tok of Object.keys(p)) {
        const v = Array.isArray(p[tok]) ? p[tok][0] : p[tok];
        const c = parseColor(v);
        if (tok in fgColors) fg2[tok] = c;
        if (tok in surfColors) surf2[tok] = c && c.a > 0 ? c : null;
      }
      const baseBg2 = parseColor((p[end.baseBgToken] && (Array.isArray(p[end.baseBgToken]) ? p[end.baseBgToken][0] : p[end.baseBgToken])) || m.baseBg) || baseOpaque;
      const baseOpaque2 = baseBg2.a < 1 ? compositeOver(baseBg2, { r: 255, g: 255, b: 255, a: 1 }) : baseBg2;
      prop = analyze(end, fg2, surf2, baseOpaque2, cfg);
      const pr = buildProposalsReport(cfg, endId, end, fgColors, surfColors, fg2, surf2, measured);
      proposalsReportAll.push(...pr);
      propTotal += pr.length; pr.forEach(r => { if (r.exempt) propExempt++; else if (r.pass) propPass++; });
      diiziAll[endId] = buildDiizi(cfg, endId, end, measured, fgColors, surfColors, surf2);
    }

    report.ends[endId] = {
      label: end.label, importOrder: end.importOrder,
      measuredBaseBg: m.baseBg, effectiveBaseBg: baseOpaque,
      measuredSurfaces: m.surfaces, measuredForegrounds: m.foregrounds,
      current: cur, proposed: prop
    };
  }
  report.summary = { totalCombosMeasured: totalCombos, failText4_5: failText, failGraphic3: failGraphic, failStatusAsText4_5_ref: failStatus45 };
  if (hasProp) {
    report.proposalsReport = proposalsReportAll;
    report.proposalsSummary = { total: propTotal, passNonExempt: propPass, exempt: propExempt };
    report.diizi = diiziAll;
  }

  // —— 第3步：生成基准页 + 截图 ——
  const html = buildBaselineHtml(fixtureCss, helperCss, cfg, measured, report);
  fs.writeFileSync(htmlOut, html, 'utf8');
  console.log('[基准页] 已写入 ' + htmlOut);
  const browser2 = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page2 = await browser2.newPage({ viewport: { width: 1500, height: 1000 } });
  await page2.goto('file:///' + htmlOut.replace(/\\/g, '/'));
  await page2.waitForTimeout(200);
  await page2.screenshot({ fullPage: true, path: pngOut });
  await browser2.close();
  console.log('[截图] 已写入 ' + pngOut);

  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf8');
  console.log('[数据] 已写入 ' + jsonOut);
  console.log('组合总数=' + totalCombos + ' 文字(4.5)不达标=' + failText + ' 非文本(3)不达标=' + failGraphic +
    (hasProp ? ('  建议值条数=' + propTotal + ' 达标(非豁免)=' + propPass + ' 装饰豁免=' + propExempt) : ''));
  for (const id of Object.keys(cfg.ends)) { const t = cfg.ends[id]; console.log('  ' + id + ': 前景=' + t.foregrounds.length + ' 面=' + t.surfaces.length); }
  if (notes.length) { console.log('—— 注意 ——'); notes.forEach(n => console.log('  ' + n)); }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
