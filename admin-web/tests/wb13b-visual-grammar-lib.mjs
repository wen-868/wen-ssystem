/**
 * WORKBENCH-13B · 业务页视觉语法「可解析性 + 画布作用域」校验库（卡 §三.A.4/6、§三.D、§六）
 *
 * 为什么需要这一层：13B 语法段全部写在 styles.css 的注释旁。CSS 注释里只要出现「星号紧跟斜杠」
 * 这一对字符（本单踩过两次：说明行写「11.5 归 11、字重 600」时把三个值用斜杠串起来，
 * 于是闭合符提前出现，注释后半段被当成代码），
 * 注释后半段 + 紧随其后的规则块会被解析器当成**垃圾选择器前奏**吞掉，规则静默失效。
 * 浏览器不报错、vite 不报错、tsc/eslint/build 全绿，只有真机读数暴露它
 * ——实测代价：一次 9 配对采集（≈8 分钟）+ 一整轮判红。
 * ⇒ 这里用不依赖浏览器的纯文本解析器复现「规则块是否活着」，并锁死两条红线：
 *   ① 语法段每条选择器都必须带 `main.wb-view-manual` 画布前缀（不得漏给旧后台控制台，卡 §二）；
 *   ② 取值必须是原型 V16 归一后的计算口径（14 / 10 / 999 阶梯，不得回写成源码字面量 12/13/99）。
 *
 * 只读文件文本，不启服务、不碰 DOM ⇒ clean 检出即可复现。
 */

export const CANVAS_PREFIX = "main.wb-view-manual";
export const GRAMMAR_MARKER = "WORKBENCH-13B · 业务页视觉语法";

/** 去掉注释与字符串后的「真实 CSS 代码」；注释按长度等量替换成空格 ⇒ 行号/偏移仍可追溯 */
export function stripCss(css) {
  let out = "";
  let i = 0;
  let line = 1;
  const lineAt = [];
  while (i < css.length) {
    const two = css.slice(i, i + 2);
    if (two === "/*") {
      const end = css.indexOf("*/", i + 2);
      const span = end === -1 ? css.length - i : end + 2 - i;
      const seg = css.slice(i, i + span);
      out += seg.replace(/[^\n]/g, " ");
      line += countNl(seg);
      i += span;
      continue;
    }
    if (two === "//") {
      const end = css.indexOf("\n", i);
      const span = end === -1 ? css.length - i : end - i;
      out += " ".repeat(span);
      i += span;
      continue;
    }
    if (two === '"' || two === "'") {
      const q = two;
      let j = i + 2;
      while (j < css.length && css[j] !== q) {
        if (css[j] === "\\") j += 1;
        if (css[j] === "\n") line += 1;
        j += 1;
      }
      const seg = css.slice(i, Math.min(j + 1, css.length));
      out += seg.replace(/\s+/g, " ");
      i += seg.length;
      continue;
    }
    if (css[i] === "\n") line += 1;
    lineAt[out.length] = line;
    out += css[i];
    i += 1;
  }
  return { code: out, lineAt };
}

function countNl(s) {
  let n = 0;
  for (const ch of s) if (ch === "\n") n += 1;
  return n;
}

/**
 * 纯文本 CSS 规则解析（够用于 styles.css）：返回每个规则块的 selector / 所在 @media / 声明表。
 * 解析时按「花括号配对」取块；块内以 `;` 切声明；块外的文本即前奏（prelude）。
 * 前奏里若残留 CJK／全角标点／`⇒`／`×` ⇒ 说明有注释被提前闭合，内容漏成了选择器。
 */
export function parseRules(css) {
  const { code } = stripCss(css);
  const rules = [];
  const stack = [];
  let buf = "";
  let line = 1;
  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === "\n") line += 1;
    if (ch === ";" && stack.length === 0 && buf.trim().startsWith("@")) {
      buf = ""; // 顶层 at-rule 语句（@import 等）：以分号收尾，不参与「选择器前奏」判定
      continue;
    }
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      stack.push({ prelude, line });
      continue;
    }
    if (ch === "}") {
      const frame = stack.pop();
      if (!frame) continue;
      const body = buf;
      buf = "";
      const at = frame.prelude.startsWith("@") ? frame.prelude : null;
      if (at && /^@(media|supports|layer|container)\b/.test(at)) continue; // 容器本身不是规则
      const decls = parseDecls(body);
      rules.push({
        selector: at ? frame.prelude.replace(/^@[a-z-]+\s*\(/, "(") : frame.prelude.replace(/\s+/g, " "),
        media: (stack[stack.length - 1]?.prelude ?? null),
        line: frame.line,
        decls,
        preludeRaw: frame.prelude,
      });
      continue;
    }
    buf += ch;
  }
  return rules;
}

function parseDecls(body) {
  const out = [];
  for (const piece of body.split(";")) {
    const idx = piece.indexOf(":");
    if (idx === -1) continue;
    const prop = piece.slice(0, idx).trim().replace(/\s+/g, " ");
    const value = piece.slice(idx + 1).trim().replace(/\s+/g, " ");
    if (!prop || !value) continue;
    out.push({ prop, value });
  }
  return out;
}

/** 前奏健康检查：注释被「星号+斜杠」提前截断时，中文说明会漏成「选择器」 */
export function findPreludeHazards(css) {
  const bad = /[一-鿿　-〿＀-￯→⇒×·｜]/;
  const out = [];
  for (const r of parseRules(css)) {
    const sel = r.preludeRaw ?? "";
    if (!sel) continue;
    if (bad.test(sel)) out.push({ line: r.line, kind: "prose-in-selector", selector: sel.slice(0, 80) });
    else if (/[;]/.test(sel)) out.push({ line: r.line, kind: "semicolon-in-selector", selector: sel.slice(0, 80) });
  }
  return out;
}

/** 取「13B 语法段」的起始行：以段头注释定位，段前的 R100 老皮肤不参与本段断言 */
export function grammarStartLine(css) {
  const idx = css.indexOf(GRAMMAR_MARKER);
  if (idx === -1) return -1;
  return countNl(css.slice(0, idx)) + 1;
}

/** 语法段内的规则（按行号截取） */
export function grammarRules(css) {
  const start = grammarStartLine(css);
  if (start < 0) return [];
  return parseRules(css).filter((r) => r.line >= start);
}

/**
 * 逗号切分**只在括号之外**生效：`:is(.filter-bar, .filter-card)` 里的逗号是函数参数分隔，
 * 朴素的 `split(",")` 会把它切成「.filter-card)」这种碎片 ⇒ 误报成漏出画布（假红）。
 */
export function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** 漏出画布的选择器：语法段内任何不带 main.wb-view-manual 前缀的规则（会打到旧后台控制台） */
export function findCanvasLeaks(css) {
  return grammarRules(css)
    .map((r) => {
      const parts = splitSelectors(r.preludeRaw ?? "");
      const leaked = parts.filter((p) => !p.startsWith(CANVAS_PREFIX));
      return leaked.length ? { line: r.line, selectors: leaked } : null;
    })
    .filter(Boolean);
}

/**
 * 按「选择器 + 属性」取声明值：找不到规则或属性返回 null（= 规则没活着的直接证据）。
 * 匹配口径（本单实测踩过的坑）：**整段选择器相等的规则优先**，一条都没有时才退到
 * 「片段后不接标识符字符」的包含匹配。朴素的 substring 会让 `main.wb-view-manual .table-card`
 * 命中 `.table-card-footer .el-button`（那一条有 padding 8×14 与白底）⇒ 断言读到别的规则，
 * 把「规则其实活着」判成假红。
 */
function normSel(s) {
  return s.replace(/\s+/g, " ").trim();
}

function hasExactSegment(prelude, selectorPart) {
  return splitSelectors(normSel(prelude)).includes(normSel(selectorPart));
}

function hasPartialSegment(prelude, selectorPart) {
  const escaped = normSel(selectorPart).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return splitSelectors(normSel(prelude)).some((p) => new RegExp(`${escaped}(?![\\w-])`).test(p));
}

export function declValue(css, selectorPart, prop) {
  const all = parseRules(css);
  const exact = all.filter((r) => hasExactSegment(r.preludeRaw ?? "", selectorPart));
  const pool = exact.length ? exact : all.filter((r) => hasPartialSegment(r.preludeRaw ?? "", selectorPart));
  for (const r of pool) {
    const d = r.decls.find((x) => x.prop === prop);
    if (d) return { value: d.value, line: r.line, selector: r.preludeRaw.replace(/\s+/g, " ") };
  }
  return null;
}
