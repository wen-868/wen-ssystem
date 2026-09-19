'use strict';
/*
 * admin-web/scripts/contrast-metric.cjs
 * ───────────────────────────────────────────────────────────────────────────
 * S3-64（A-8）配套复算脚本：纯计算（WCAG 2.1 相对亮度公式），不依赖浏览器。
 *
 * 用途：
 *   1) 改后复算：node contrast-metric.cjs <前景> <背景> [字号px] [bold:0|1]
 *   2) 判定有效性验证：以任意 < 4.5:1 的前景（含派单援引的 #406cd4）作样本传入，
 *      必须得到 FAIL（exit 1）——证明脚本不写死绿灯，对不达标值可红可绿。
 *      注意：#406cd4 并非本元素真实历史取值（见回传卡 §9），此处仅作 sub-4.5 代表样本。
 *   3) 批量    ：node contrast-metric.cjs --batch <json>   （json = [{fg,bg,fs,bold,label}]）
 *
 * 阈值（硬编码，不得改）：
 *   - TEXT_THRESHOLD = 4.5  普通文本（WCAG AA 1.4.3）
 *   - LARGE_TEXT_THRESHOLD = 3.0  大文本（≥24px 普通 或 ≥18.66px 粗体，WCAG AA 1.4.3）
 *   说明：3.0 是 WCAG 对「大文本」的法定阈值，并非把 4.5 放宽；普通文本仍严格 ≥4.5。
 *
 * 设计原则（对齐 scripts/contrast-check.cjs）：
 *   不把「期望值」写死在代码里。前景/背景由调用方显式传入（或读真实 token 文件），
 *   因此把任一颜色改回不达标值，本脚本必输出 FAIL（exit 1）——可被红测证明。
 */

const fs = require('fs');

// ── 阈值（硬编码，不得改）─────────────────────────────
const TEXT_THRESHOLD = 4.5;        // 普通文本
const LARGE_TEXT_THRESHOLD = 3.0;  // 大文本（WCAG 法定值，非放宽 4.5）

// ── WCAG 2.1 相对亮度 ───────────────────────────────
function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relLum(hex) {
  const h = hex.replace('#', '').replace(/\s/g, '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) {
    throw new Error('无法解析颜色: ' + hex);
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(fg, bg) {
  const L1 = relLum(fg);
  const L2 = relLum(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── 大文本判定（WCAG 1.4.3）─────────────────────────
function isLargeText(fsPx, bold) {
  if (!fsPx || Number.isNaN(fsPx)) return false; // 字号未知→按普通文本从严
  if (fsPx >= 24) return true;                   // 普通文本 ≥ 24px (18pt)
  if (bold && fsPx >= 18.66) return true;        // 粗体 ≥ 18.66px (14pt)
  return false;
}

// ── 单条判定 ───────────────────────────────────────
function judge(fg, bg, fsPx, bold, label) {
  const r = ratio(fg, bg);
  const large = isLargeText(fsPx, bold);
  const thr = large ? LARGE_TEXT_THRESHOLD : TEXT_THRESHOLD;
  const pass = r >= thr;
  return {
    label: label || '',
    fg, bg,
    fs: fsPx ? fsPx + 'px' : '?',
    bold: bold ? 'bold' : 'normal',
    large: large ? 'L' : 'N',
    ratio: r,
    threshold: thr,
    pass,
  };
}

function fmtRow(x) {
  return `| ${x.label || '-'} | ${x.fg} | ${x.bg} | ${x.fs}/${x.bold} | ${x.large} | ` +
    `${x.threshold} | ${x.ratio.toFixed(2)}:1 | ${x.pass ? 'PASS' : 'FAIL'} |`;
}

// ── CLI ───────────────────────────────────────────
function main() {
  const argv = process.argv.slice(2);

  // 批量模式
  if (argv[0] === '--batch') {
    const file = argv[1];
    if (!file) { console.error('用法: node contrast-metric.cjs --batch <json文件>'); process.exit(2); }
    const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log('| 标签 | 前景 | 背景 | 字号/粗细 | 大文本? | 阈值 | 比值 | 结论 |');
    console.log('|---|---|---|---|---|---|---|---|');
    let fail = 0;
    for (const it of arr) {
      const x = judge(it.fg, it.bg, parseFloat(it.fs), !!it.bold, it.label);
      console.log(fmtRow(x));
      if (!x.pass) fail++;
    }
    console.log(`\n批量共 ${arr.length} 项，不达标 ${fail} 项。`);
    process.exit(fail === 0 ? 0 : 1);
  }

  // 单条模式：<fg> <bg> [fs] [bold]
  const fg = argv[0];
  const bg = argv[1];
  if (!fg || !bg) {
    console.error('用法: node contrast-metric.cjs <前景#hex> <背景#hex> [字号px] [bold:0|1]');
    process.exit(2);
  }
  const fsPx = argv[2] ? parseFloat(argv[2]) : null;
  const bold = argv[3] === '1' || argv[3] === 'true' || argv[3] === 'bold';
  const x = judge(fg, bg, fsPx, bold, 'target');
  console.log('| 标签 | 前景 | 背景 | 字号/粗细 | 大文本? | 阈值 | 比值 | 结论 |');
  console.log('|---|---|---|---|---|---|---|---|');
  console.log(fmtRow(x));
  console.log(`\n结论: ${x.pass ? 'PASS' : 'FAIL'}（前景 ${x.fg} × 背景 ${x.bg} = ${x.ratio.toFixed(2)}:1，` +
    `${x.large === 'L' ? '大文本阈值 3.0' : '普通文本阈值 4.5'}）`);
  process.exit(x.pass ? 0 : 1);
}

if (require.main === module) main();

module.exports = { ratio, relLum, isLargeText, judge, TEXT_THRESHOLD, LARGE_TEXT_THRESHOLD };
