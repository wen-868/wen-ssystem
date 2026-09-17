'use strict';
/*
 * S3-53 对比度矩阵门禁（WCAG 2.1 相对亮度公式）
 * 用法（CI / 本地均可）：node scripts/contrast-check.cjs
 *
 * 设计要点（与 S3-47 旧脚本的本质区别）：
 *   - 旧脚本把 NEW/OLD 值「写死」在代码里 → 即使把 tokens.css 改回 #999999，脚本仍打印 PASS（假绿灯）。
 *   - 本脚本**读取 tokens.css / theme.ts 的真实取值**，构建 token × surface 矩阵后判定。
 *     因此把任一 token 改回不达标值，本步骤必红（exit 1）——门禁可被红测证明。
 *
 * 覆盖范围（每个「文本 token」×「它可能出现的 surface 背景」，而非只算白底）：
 *   - saas-admin 文本 token：--text-primary / --text-secondary / --text-muted(S3-47)
 *     / --sidebar-text-primary / --sidebar-text-secondary / --sidebar-text-muted(S3-47) / --text-link
 *   - 每个文本 token 在 white / #f7f7f7(--g0) / #f0f0f0(--bg-soft，最严边界) 上判定 4.5:1
 *   - 侧边栏文本 token 在侧边栏白底上判定 4.5:1
 *   - admin-web CHART_COLORS.textMuted / textSecondary：canvas/ECharts 文字，axe 扫不到，
 *     由本矩阵替代核查（S3-53 要求 3）——在图表白底上判定 4.5:1
 *
 * 不纳入「失败判定」的项（仍在 docs/design 工作台页面设计规范.md §八 登记为可接受偏差/待定）：
 *   - CHART_COLORS 系列填充色（primary/success/warning/...）：图形填充，属「图表配色设计变更」，
 *     不在本门禁的失败集合内（部分在白底上 < 3:1，改动需凌舟裁定，单列待定）。
 *
 * S3-54 裁定已转正（原 §八 待裁定项，现已纳入下方「S3-54 裁定锁定」矩阵）：
 *   - --text-placeholder 占位提示文本 → 白底输入框内，WCAG AA 文本 ≥4.5:1
 *   - --input-border / --ctl-border 输入框/控件边框 → WCAG 1.4.11 非文本 ≥3:1
 *   三项动态读取 saas-admin/src/styles/tokens.css 真实取值，改回坏值必红（非写死期望值）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOKENS_CSS = path.join(ROOT, 'saas-admin', 'src', 'styles', 'tokens.css');
const THEME_TS = path.join(ROOT, 'admin-web', 'src', 'styles', 'theme.ts');

const TEXT_THRESHOLD = 4.5; // WCAG AA 普通文本
const NON_TEXT_THRESHOLD = 3.0; // WCAG 1.4.11 非文本（UI 组件及其状态）
const FAIL = 'FAIL';
const PASS = 'PASS';

// ── WCAG 2.1 相对亮度 ───────────────────────────────
function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relLum(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(fg, bg) {
  const L1 = relLum(fg);
  const L2 = relLum(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}
function fmt(n) { return n.toFixed(2); }

// 把字符串安全地放入 RegExp：转义所有正则元字符（含反斜杠）
// CodeQL js/incomplete-sanitization 要求不只是转义 `-`。
function escapeForRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\// ── 解析（读取真实文件取值）─────────────────────────");
}

// ── 解析（读取真实文件取值）─────────────────────────
function parseTokensCss(filePath, names) {
  const src = fs.readFileSync(filePath, 'utf8');
  const found = {};
  const missing = [];
  for (const name of names) {
    // 匹配 `--name: #rrggbb`（容忍行尾注释）
    // CodeQL（js/incomplete-sanitization）：拼接 RegExp 必须转义正则元字符，
    // 仅转义 `-` 而不转义 `\` 会被判定为不完整的转义/编码。
    const re = new RegExp('--' + escapeForRegExp(name) + ':\\s*#([0-9a-fA-F]{6})');
    const m = src.match(re);
    if (m) found[name] = '#' + m[1].toUpperCase();
    else missing.push(name);
  }
  return { found, missing };
}

function parseChartColors(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const obj = {};
  const re = /(\w+):\s*"#([0-9a-fA-F]{6})"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    obj[m[1]] = '#' + m[2].toUpperCase();
  }
  return obj;
}

// ── 表面（surface）背景 ─────────────────────────────
const SURFACES = {
  white: '#FFFFFF',
  g0: '#f7f7f7',       // --bg-page / --g0
  soft: '#f0f0f0',     // --bg-soft / --g1（最严边界）
  sidebarWhite: '#FFFFFF',
  chartWhite: '#FFFFFF',
};
const SURFACE_LABEL = {
  white: '白底 #FFFFFF',
  g0: '#f7f7f7(--g0/--bg-page)',
  soft: '#f0f0f0(--bg-soft 最严边界)',
  sidebarWhite: '侧边栏白底 #FFFFFF',
  chartWhite: '图表白底 #FFFFFF',
};

// ── 文本 token × surface 矩阵定义 ──────────────────
const TEXT_TOKENS = [
  { name: 'text-primary', surfaces: ['white', 'g0', 'soft'] },
  { name: 'text-secondary', surfaces: ['white', 'g0', 'soft'] },
  { name: 'text-muted', surfaces: ['white', 'g0', 'soft'], note: 'S3-47' },
  { name: 'sidebar-text-primary', surfaces: ['sidebarWhite'] },
  { name: 'sidebar-text-secondary', surfaces: ['sidebarWhite'] },
  { name: 'sidebar-text-muted', surfaces: ['sidebarWhite'], note: 'S3-47' },
  { name: 'text-link', surfaces: ['white', 'g0', 'soft'] },
];

// ── 非文本 UI token × surface 矩阵（WCAG 1.4.11 3:1）──────
// 说明：axe 扫不到伪元素（::-webkit-scrollbar-thumb），属工具盲区，由本矩阵替代核查。
const NON_TEXT_TOKENS = [
  { name: 'gray-300', surfaces: ['white', 'g0', 'soft'], note: '滚动条滑块·默认态' },
  { name: 'gray-400', surfaces: ['white', 'g0', 'soft'], note: '滚动条滑块·hover 态' },
];

// ── S3-54 裁定锁定（验收人裁定：占位符文本 ≥4.5:1；输入框/控件边框 ≥3:1）──
// 动态读取 saas-admin/src/styles/tokens.css 真实取值，改回坏值必红（非写死期望值）。
// 真实相邻色：
//   - text-placeholder：占位提示文本落在白底输入框内(--input-bg #FFFFFF) → 文本 4.5:1，白底即最严面；
//   - input-border / ctl-border：边框对比「最严边界」#f0f0f0(--bg-soft)（项目门禁既定最严面，
//     通过它即保证白底(#FFFFFF)/#f7f7f7 也 ≥3:1，故只测 soft 即覆盖真实相邻面，无需重复组合）。
const S3_54_TOKENS = [
  { name: 'text-placeholder', surfaces: ['white'], threshold: TEXT_THRESHOLD, kind: 'text', note: 'S3-54 占位提示文本(白底输入框内)≥4.5:1' },
  { name: 'input-border', surfaces: ['soft'], threshold: NON_TEXT_THRESHOLD, kind: 'non-text', note: 'S3-54 输入框边框(1.4.11 最严边界 #f0f0f0)≥3:1' },
  { name: 'ctl-border', surfaces: ['soft'], threshold: NON_TEXT_THRESHOLD, kind: 'non-text', note: 'S3-54 控件边框 .btn/.ipt/.sel(1.4.11 最严边界)≥3:1' },
];

const rows = [];
const failures = [];

// saas-admin 文本 token
const tokenNames = [
  ...TEXT_TOKENS.map((t) => t.name),
  ...NON_TEXT_TOKENS.map((t) => t.name),
  ...S3_54_TOKENS.map((t) => t.name),
];
const { found: tok, missing: tokMissing } = parseTokensCss(TOKENS_CSS, tokenNames);

for (const t of TEXT_TOKENS) {
  const fg = tok[t.name];
  if (!fg) continue; // 缺失由下方统一报错
  for (const s of t.surfaces) {
    const bg = SURFACES[s];
    const r = ratio(fg, bg);
    const ok = r >= TEXT_THRESHOLD;
    rows.push({
      group: 'saas-admin token',
      label: `--${t.name}${t.note ? ' (' + t.note + ')' : ''} ${fg}`,
      surface: SURFACE_LABEL[s],
      r,
      threshold: TEXT_THRESHOLD,
      ok,
    });
    if (!ok) {
      failures.push({
        file: 'saas-admin/src/styles/tokens.css',
        msg: `--${t.name} ${fg} × ${SURFACE_LABEL[s]} = ${fmt(r)}:1 < ${TEXT_THRESHOLD} (WCAG AA 文本)`,
      });
    }
  }
}

// admin-web 图表文字色（canvas 盲区替代核查，S3-53 要求 3）
const chart = parseChartColors(THEME_TS);
const CHART_TEXT = [
  { key: 'textMuted', note: 'S3-47/S3-53' },
  { key: 'textSecondary', note: '' },
];
for (const c of CHART_TEXT) {
  const fg = chart[c.key];
  if (!fg) {
    failures.push({
      file: 'admin-web/src/styles/theme.ts',
      msg: `CHART_COLORS.${c.key} 缺失（无法判定对比度）`,
    });
    continue;
  }
  const bg = SURFACES.chartWhite;
  const r = ratio(fg, bg);
  const ok = r >= TEXT_THRESHOLD;
  rows.push({
    group: 'admin-web chart text (canvas 替代核查)',
    label: `CHART_COLORS.${c.key} ${fg}${c.note ? ' (' + c.note + ')' : ''}`,
    surface: SURFACE_LABEL.chartWhite,
    r,
    threshold: TEXT_THRESHOLD,
    ok,
  });
  if (!ok) {
    failures.push({
      file: 'admin-web/src/styles/theme.ts',
      msg: `CHART_COLORS.${c.key} ${fg} × 图表白底 = ${fmt(r)}:1 < ${TEXT_THRESHOLD} (canvas 文字 WCAG AA；axe 扫不到，须本矩阵兜底)`,
    });
  }
}


// 非文本 UI 组件（1.4.11 3:1；伪元素为 axe 盲区，本矩阵替代核查）
for (const t of NON_TEXT_TOKENS) {
  const fg = tok[t.name];
  if (!fg) continue; // 缺失由下方统一报错
  for (const s of t.surfaces) {
    const bg = SURFACES[s];
    const r = ratio(fg, bg);
    const ok = r >= NON_TEXT_THRESHOLD;
    rows.push({
      group: 'saas-admin 非文本 UI (1.4.11)',
      label: `--${t.name} (${t.note}) ${fg}`,
      surface: SURFACE_LABEL[s],
      r,
      threshold: NON_TEXT_THRESHOLD,
      ok,
    });
    if (!ok) {
      failures.push({
        file: 'saas-admin/src/styles/tokens.css',
        msg: `--${t.name} ${fg} (${t.note}) × ${SURFACE_LABEL[s]} = ${fmt(r)}:1 < ${NON_TEXT_THRESHOLD} (WCAG 1.4.11 非文本；axe 扫不到伪元素，须本矩阵兜底)`,
      });
    }
  }
}

// ── S3-54 裁定锁定项（动态读 token，门禁兜底）────────────
for (const t of S3_54_TOKENS) {
  const fg = tok[t.name];
  if (!fg) continue; // 缺失由下方统一报错
  for (const s of t.surfaces) {
    const bg = SURFACES[s];
    const r = ratio(fg, bg);
    const ok = r >= t.threshold;
    rows.push({
      group: 'saas-admin token (S3-54 裁定锁定)',
      label: `--${t.name} (${t.note}) ${fg}`,
      surface: SURFACE_LABEL[s],
      r,
      threshold: t.threshold,
      ok,
    });
    if (!ok) {
      failures.push({
        file: 'saas-admin/src/styles/tokens.css',
        msg: `--${t.name} ${fg} (${t.note}) × ${SURFACE_LABEL[s]} = ${fmt(r)}:1 < ${t.threshold} (${t.kind === 'text' ? 'WCAG AA 文本；S3-54 裁定锁定' : 'WCAG 1.4.11 非文本；S3-54 裁定锁定'})`,
      });
    }
  }
}

// ── 输出 ───────────────────────────────────────────
console.log('| 分组 | 前景 token | surface 背景 | 比值 | 阈值(文本4.5/非文本3.0) | 结论 |');
console.log('|---|---|---|---|---|---|');
for (const x of rows) {
  console.log(`| ${x.group} | ${x.label} | ${x.surface} | ${fmt(x.r)}:1 | ${x.threshold} | ${x.ok ? PASS : FAIL} |`);
}

// 缺失 token 也计入失败
for (const name of tokMissing) {
  failures.push({
    file: 'saas-admin/src/styles/tokens.css',
    msg: `token --${name} 在文件中未找到（无法判定对比度，疑似被误删）`,
  });
}

console.log('');
if (failures.length === 0) {
  console.log(`✅ 对比度矩阵全部达标：共 ${rows.length} 个 token×surface 组合（文本 ≥ 4.5:1，非文本 UI ≥ 3:1）`);
  process.exit(0);
} else {
  console.log(`❌ 对比度矩阵存在 ${failures.length} 个不达标项（文本需 ≥ 4.5:1，非文本 UI 需 ≥ 3:1）：`);
  for (const f of failures) {
    console.log(`::error file=${f.file}::${f.msg}`);
    console.log(`  - [${f.file}] ${f.msg}`);
  }
  process.exit(1);
}
