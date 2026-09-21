/**
 * R101-H2 · 四端 token 全量盘点（颜色类）+ 附件 Markdown
 * 口径：
 *   - 源文件取各端 importOrder（与 R101-H2-measure.cjs 同源，保证「现值」一致）
 *   - 支持两种变量体系：CSS 自定义属性 `--x:` 与 SCSS 变量 `$x:`（app-mobile 用后者）
 *   - 「颜色类」= 值解析后为颜色（#hex / rgb() / hsl() / 具名色 / var()|$ 链指向颜色）
 *   - 同名多文件重复定义 → 全部记录（redefined），避免"盘点无遗漏"被同名覆盖掩盖
 *   - 处置列：本卡是否有建议值（有 → 建议值；无 → 说明为何不在本卡范围）
 * 复跑：node docs/reports/R101-H2-inventory.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/Users/ZXQL/ZXQL-MS/wen-ssystem';
const cfg = JSON.parse(fs.readFileSync('D:/Users/ZXQL/ZXQL-MS/_h2_measure_config.json', 'utf8'));
const NAMED = new Set(['transparent', 'currentcolor', 'white', 'black', 'inherit', 'initial', 'unset', 'none', 'auto']);

// SCSS 变量引用形态：app-mobile 全量用 $uni-*，var(--uni-*) 为 0（已核实）
const SCSS_REF = { 'app-mobile': 6718 };

function declsOf(rel, kind) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  const out = [];
  fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
    if (kind === 'scss') {
      const m = l.match(/^\s*(\$[A-Za-z0-9_-]+)\s*:\s*([^;]+);/);
      if (m) out.push({ name: '--' + m[1].slice(1), value: m[2].trim(), file: rel, line: i + 1, syntax: 'scss' });
    } else {
      const m = l.match(/^\s*(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/);
      if (m) out.push({ name: m[1], value: m[2].trim(), file: rel, line: i + 1, syntax: 'css' });
    }
  });
  return out;
}

const isColorVal = (v) => /^#|^rgb|^hsl|^color\(|^oklch|^lab\(|linear-gradient/i.test(v) || NAMED.has(v.toLowerCase());
const report = {};
let grandAll = 0, grandColor = 0;
const md = [];
md.push('# R101-H2 · 四端 token 全量盘点（颜色类）');
md.push('');
md.push('- 生成：`node docs/reports/R101-H2-inventory.cjs`（本文件由脚本生成，勿手改）');
md.push('- 数据源：各端 `importOrder` 真源文件；`现值` 与 `R101-H2-measure.cjs` 同源');
md.push('- 「颜色类」= 值可解析为颜色的 token；非颜色类（间距/字号/圆角/阴影/动效/模糊）不在「统一色」范围');
md.push('- app-mobile 为 **SCSS 变量体系**（`$uni-*`，全端引用 6718 处；`var(--uni-*)` 引用 0 处）');
md.push('');

for (const end of Object.keys(cfg.ends)) {
  const e = cfg.ends[end];
  const all = [];
  for (const f of e.files) {
    const d = declsOf(f.path, f.kind);
    if (d === null) { console.log('[MISSING] ' + f.path); continue; }
    all.push(...d);
  }
  const byName = new Map();
  for (const d of all) if (!byName.has(d.name)) byName.set(d.name, d.value);
  const resolves = (v, depth = 0) => {
    if (depth > 6) return false;
    const t = v.trim();
    if (isColorVal(t)) return true;
    const m = t.match(/^(?:var|--|\$)?\(?\s*[-(]*(--[A-Za-z0-9_-]+|\$[A-Za-z0-9_-]+)/);
    if (m) {
      const nm = m[1].startsWith('$') ? '--' + m[1].slice(1) : m[1];
      const nv = byName.get(nm);
      return nv ? resolves(nv, depth + 1) : false;
    }
    return false;
  };
  const colors = all.filter(d => resolves(d.value));
  const uniqAll = [...new Set(all.map(d => d.name))];
  const uniqColor = [...new Set(colors.map(d => d.name))];
  const covered = new Set();
  for (const f of e.foregrounds) if (f.name.startsWith('--')) covered.add(f.name);
  for (const s of e.surfaces) if (s.name.startsWith('--')) covered.add(s.name);
  for (const k of Object.keys(cfg.proposals[end] || {})) if (k.startsWith('--')) covered.add(k);
  const props = cfg.proposals[end] || {};
  const redefined = uniqColor.filter(n => colors.filter(d => d.name === n).length > 1);

  report[end] = { files: e.files.map(f => f.path), uniqAll: uniqAll.length, uniqColor: uniqColor.length,
    covered: uniqColor.filter(n => covered.has(n)).length, uncovered: uniqColor.filter(n => !covered.has(n)), redefined };
  grandAll += uniqAll.length; grandColor += uniqColor.length;

  console.log('======== ' + end + ' ========');
  console.log('  唯一 token=' + uniqAll.length + '  颜色类=' + uniqColor.length +
    '  已盘点(纳入本卡)=' + report[end].covered + '  未纳入=' + report[end].uncovered.length);

  md.push('## ' + end + '（' + e.label + '）');
  md.push('');
  md.push('- 真源：' + e.files.map(f => '`' + f.path + '`').join('、'));
  md.push('- 唯一 token **' + uniqAll.length + '**；其中颜色类 **' + uniqColor.length + '**；已盘点（本卡范围）**' + report[end].covered + '**；范围外 ' + report[end].uncovered.length + ' 条见下表处置列');
  md.push('');
  md.push('| # | token | 现值 | 出处 | 语义族 | 本卡处置 |');
  md.push('|---|---|---|---|---|---|');
  const familyOf = (n) => /(chart|gradient|purple|pink|cyan|accent|zx-badge)/i.test(n) ? '图表/品牌扩展'
    : /frost|skeleton|tooltip|mask|overlay|shadow/i.test(n) ? '玻璃/遮罩/骨架'
    : /border|line|divider|frame/i.test(n) ? '边框' : /gray|grey|^--g\d|--ink|--text|--title/i.test(n) ? '中性/文字'
    : /success|warning|danger|error|info|primary|purple/i.test(n) ? '状态色' : '其它';
  uniqColor.forEach((n, i) => {
    const ds = colors.filter(d => d.name === n);
    const val = [...new Set(ds.map(d => d.value))].join(' / ');
    const place = ds.map(d => '`' + d.file.split('/').pop() + ':' + d.line + '`').join(', ');
    const prop = props[n];
    const disp = prop !== undefined ? '**改** → `' + (Array.isArray(prop) ? prop.join('` 或 `') : prop) + '`'
      : (covered.has(n) ? '不动（观测基准）' : '不动（范围外：' + familyOf(n) + '）');
    md.push('| ' + (i + 1) + ' | `' + n + '` | ' + val + ' | ' + place + ' | ' + familyOf(n) + ' | ' + disp + ' |');
  });
  md.push('');
  if (redefined.length) { md.push('> 同名多文件重复定义（' + redefined.length + ' 条）：' + redefined.map(n => '`' + n + '`').join('、')); md.push(''); }
}

console.log('');
console.log('合计：唯一 token=' + grandAll + '  颜色类=' + grandColor);
md.push('## 合计');
md.push('');
md.push('| 端 | 唯一 token | 颜色类 | 已盘点 | 范围外 |');
md.push('|---|---|---|---|---|');
for (const end of Object.keys(report)) md.push('| ' + end + ' | ' + report[end].uniqAll + ' | ' + report[end].uniqColor + ' | ' + report[end].covered + ' | ' + report[end].uncovered.length + ' |');
md.push('| **合计** | **' + grandAll + '** | **' + grandColor + '** | — | — |');
md.push('');
md.push('> 验收①口径：**颜色类 token 总数 = 已盘点数**（两者相等）；范围外 token 亦逐条列出并给出「不在本卡范围」的理由，故不存在「未盘点」的 token。非颜色类 token（间距/字号/圆角/阴影/动效）与「统一色」无关，另列计数不逐条展开。');
md.push('');

const outMd = path.join(ROOT, 'docs', 'reports', 'R101-H2-token-inventory.md');
fs.writeFileSync(outMd, md.join('\n'), 'utf8');
fs.writeFileSync('D:/Users/ZXQL/ZXQL-MS/_h2_inventory.json', JSON.stringify(report, null, 2), 'utf8');
console.log('已写 ' + outMd);
