/* S3-47 对比度计算（WCAG 2.1 相对亮度公式）
 * 用法：node contrast-check.cjs
 * 仅用于生成本轮改动的对比度证据，不参与任何构建。
 */
'use strict';

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

// 关键背景 token（saas-admin / admin-web 共用的最深浅底口径）
const BG = {
  white: '#FFFFFF',
  g0: '#f7f7f7',
  soft: '#f0f0f0', // saas-admin --bg-soft / --gray-100 / --g1（最深浅底，约束边界）
  darkUI: '#16171d', // saas-admin/src/style.css 暗色模式 --bg
};

// 设计稿权威取值
const DESIGN = {
  muted: '#737373',   // 设计稿 .muted{color:var(--g5)}  --g5
  small: '#a3a3a3',   // 设计稿 .small{color:var(--g4)}  --g4（含图表坐标/图例文字）
  sidebarNg: '#9ca3af', // 设计稿 .sh-nav .ng{color:#9ca3af}
};

const NEW = '#6D6D6D'; // 本轮采用值（与管理稿/上一轮 admin-web --text-muted 一致）

const rows = [];
function add(label, fg, bg, thrText, thrNon) {
  const r = ratio(fg, bg);
  rows.push({
    label, fg, bg, r,
    text: thrText ? (r >= thrText ? 'PASS' : 'FAIL') : '-',
    non: thrNon ? (r >= thrNon ? 'PASS' : 'FAIL') : '-',
    thrText: thrText || '-', thrNon: thrNon || '-',
  });
}

// ── saas-admin 主改动 ───────────────────────────────
add('saas-admin --text-muted OLD #999999 / 白底', '#999999', BG.white, 4.5, 3);
add('saas-admin --text-muted OLD #999999 / #f7f7f7', '#999999', BG.g0, 4.5, 3);
add('saas-admin --text-muted OLD #999999 / --bg-soft #f0f0f0(边界)', '#999999', BG.soft, 4.5, 3);
add('saas-admin --text-muted NEW #6D6D6D / 白底', NEW, BG.white, 4.5, 3);
add('saas-admin --text-muted NEW #6D6D6D / #f7f7f7', NEW, BG.g0, 4.5, 3);
add('saas-admin --text-muted NEW #6D6D6D / --bg-soft #f0f0f0(边界)', NEW, BG.soft, 4.5, 3);

add('saas-admin --sidebar-text-muted OLD #9CA3AF / --sidebar-bg #FFFFFF', '#9CA3AF', BG.white, 4.5, 3);
add('saas-admin --sidebar-text-muted NEW #6D6D6D / --sidebar-bg #FFFFFF', NEW, BG.white, 4.5, 3);

// saas-admin 残留同族（非本次改动，仅登记说明）
add('saas-admin --gray-400 #999999(滚动条/非文本) / 白底', '#999999', BG.white, '-', 3);
add('saas-admin style.css 暗模式 --text #9ca3af / #16171d', '#9ca3af', BG.darkUI, 4.5, 3);

// ── 批次1：theme.ts CHART_COLORS.textMuted（canvas/ECharts 文字+图形）──
add('批次1 textMuted OLD #999999 / 图表白底', '#999999', BG.white, 4.5, 3);
add('批次1 textMuted NEW #6D6D6D / 图表白底(文字)', NEW, BG.white, 4.5, '-');
add('批次1 textMuted NEW #6D6D6D / 图表白底(图形/非文本)', NEW, BG.white, '-', 3);

// ── 批次2：3 处硬编码小字文本（var(--text-muted)=#6D6D6D）──
add('批次2 硬编码#999999 OLD / 卡片白底', '#999999', BG.white, 4.5, 3);
add('批次2 var(--text-muted)=#6D6D6D / 卡片白底', NEW, BG.white, 4.5, 3);

// ── 批次3：2 处图标回退色（1.4.11 非文本 3:1）──
add('批次3 图标回退 OLD #999999 / 白底(非文本)', '#999999', BG.white, '-', 3);
add('批次3 图标回退 NEW #6D6D6D / 白底(非文本)', NEW, BG.white, '-', 3);

// ── 设计稿对照基准 ─────────────────────────────────
add('设计稿 muted --g5 #737373 / 白底', DESIGN.muted, BG.white, 4.5, 3);
add('设计稿 muted --g5 #737373 / --bg-soft #f0f0f0', DESIGN.muted, BG.soft, 4.5, 3);
add('设计稿 small --g4 #a3a3a3(图表文字) / 白底', DESIGN.small, BG.white, 4.5, 3);
add('设计稿 sidebar .ng #9ca3af / 白底', DESIGN.sidebarNg, BG.white, 4.5, 3);

// 输出表
console.log('| 场景 | 前景 | 背景 | 比值 | 阈值(文本4.5) | 文本 | 阈值(非文本3) | 非文本 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const x of rows) {
  console.log(`| ${x.label} | ${x.fg} | ${x.bg} | ${fmt(x.r)}:1 | ${x.thrText} | ${x.text} | ${x.thrNon} | ${x.non} |`);
}

// 汇总关键结论
console.log('\n=== 关键结论 ===');
const check = (label, fg, bg, thr) => {
  const r = ratio(fg, bg);
  console.log(`${label}: ${fmt(r)}:1 (阈值 ${thr}) -> ${r >= thr ? 'PASS' : 'FAIL'}`);
};
check('saas-admin --text-muted #6D6D6D @ 最深浅底 #f0f0f0 (文本4.5)', NEW, BG.soft, 4.5);
check('saas-admin --sidebar-text-muted #6D6D6D @ 白底 (文本4.5)', NEW, BG.white, 4.5);
check('批次1 textMuted #6D6D6D @ 白底 (文字4.5)', NEW, BG.white, 4.5);
check('批次3 图标回退 #6D6D6D @ 白底 (非文本3)', NEW, BG.white, 3);
