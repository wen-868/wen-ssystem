#!/usr/bin/env node
/**
 * G38 门禁 · guard:evidence-secrets（S3-218 · 收口总清单第 70 项）
 *
 * 防的是什么（根因）：
 *   本仓证据纪律要求「证据/日志不得承载口令、令牌等敏感键的**值**」。
 *   2026-10-16 的第 69 项，是靠**人眼**发现 `verify-demo-login.mjs` 把
 *   `constants.DEMO_PASSWORD` 明文打进日志、并被输出件带进仓库（`DEMO_PASSWORD=Demo@2026`）。
 *   人眼不是判据：同族写法只要换一处文件就静默复现 —— 与踩坑[63]（注释吃掉语句）、
 *   `guard:utf8-encoding`（U+FFFD 躺 3 个月）完全同形：**没有机械判据 ⇒ 长期存续**。
 *
 * 判据 R1（本版唯一规则，"宁准勿宽"）：
 *   日志/打屏调用的实参里，把**敏感键标识符的值**写出去 ⇒ 命中。
 *   · 敏感键标识符：名字匹配 /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|CREDENTIAL)/i
 *   · "写出去"的三种形态：模板插值 `${X}`、字符串拼接 `"..." + X`、直接传参 `log(X)`
 *
 * 安全例外（下列情形**不算**命中，逐条在输出里给理由）：
 *   ① 结论型表达式：比较（==/===/!=/!==）、`.length`、`Boolean(x)`、`typeof x`、
 *      条件为敏感键而两支均为字面量的三元、以及名字以 `Matches` 结尾的标识符
 *      —— 它们输出的是"是否 / 多长"的**结论**，不是值本身（第 69 项的两条 CodeQL 误报正是此类）。
 *   ② 脱敏占位：同一处输出里出现 `已脱敏` / `<masked>` / `****`；
 *      或值先经**脱敏函数**（名字以 redact / mask / maskSql… / sanitize / obscure / desensitize 开头）
 *      处理后再输出（实测依据：`s3-160-remember-me.mjs` 的 `redact()` 返回
 *      `<已脱敏 len=N sha256=xxxxxxxx>`）。判据按**函数命名**认，不跨文件核验实现。
 *   ③ 显式 allowlist（见 ALLOWLIST）：具名登记「文件 + 行 + 理由 + 归属单号」，
 *      同时在输出里逐条打印；登记项若**全程 0 命中**只 warn（选择器可能已失效），不判红。
 *
 * 扫描范围（只看**可执行脚本**，不看历史捕获物）：
 *   docs/evidence 下 `harness/` 与 `tools/` 子目录的 .mjs/.js/.ts、
 *   `scripts/` 的 .mjs/.js、`tests/` 的 .mjs、`backend/scripts/` 的 .mjs
 *   排除（按目录名，含其全部子目录）：`outputs`、`raw`、`archive`、`ref`
 *   （历史捕获物按第 69 项 §四-B 层政策原样保留，不在本守卫管辖）
 *
 * ⚠️ 已知边界（写在明处，不藏着）：
 *   · 静态扫描 + 判据字符串匹配，**不是 AST**：`eval` / `new Function` / 动态拼 key 等间接形态覆盖不到；
 *   · 正则字面量（`/.../`）里的括号/斜杠会干扰结构扫描（后果是漏报，不是误报）；
 *   · 同一行多个调用只按第一个命中登记（定位用，不影响判红）；
 *   · 本脚本**零外部依赖**（只用 node:fs / node:path / node:process）；
 *     它**未接 CI**：`.github/**` 属 S3-218 派单红线，接线由凌舟在合并时完成。
 *
 * 用法：
 *   node backend/scripts/guard-evidence-secrets.mjs              # 人读；EXIT 0=绿 / 1=红
 *   node backend/scripts/guard-evidence-secrets.mjs --json       # 机读
 *   node backend/scripts/guard-evidence-secrets.mjs --root <dir> # 以指定目录为仓库根（反测用）
 *   `--json` 输出含 `scannedList`（本次实扫的文件清单）与 `allowlist` / `staleAllowlist`，
 *   便于"清单与判据同源"地核对扫描面（取样可核对）。
 */
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const rootIdx = argv.indexOf("--root");
const cliRoot = rootIdx >= 0 ? argv[rootIdx + 1] : null;
const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : ".";
const repoRoot = cliRoot ? path.resolve(cliRoot) : path.resolve(path.dirname(scriptPath), "..", "..");

/**
 * 显式 allowlist：登记「文件相对路径 + 行号 + 理由 + 归属单号」之后，该处不再判红，
 * 并在输出里逐条打印（与"剔除"同源，避免两套逻辑跑偏）。
 * 登记项若全程 0 命中 ⇒ 只 warn（选择器可能已失效），**不**判红。
 */
const ALLOWLIST = [
  {
    file: "scripts/mysql-smoke-test.mjs",
    line: 174,
    reason:
      "`${CREDENTIAL_MISSING_HINT}` 输出的是**提示文案常量**（第 56 行值为「未配置 SMOKE_ADMIN_USERNAME/SMOKE_ADMIN_PASSWORD，冒烟无法执行」）：常量名含 CREDENTIAL，值里不含任何凭据。属判据的命名误伤，非值泄露。",
    ticket: "S3-218",
  },
];

/** 敏感键标识符（规则 R1 的判据核心）。 */
const SENSITIVE_RE = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|CREDENTIAL)/i;
/** 脱敏占位：出现即视为"写的是占位符，不是值"。 */
const MASK_MARKS = ["已脱敏", "<masked>", "****"];
/** 日志/打屏调用（含本仓自建的 say()/log() tee 包装器）。 */
const LOG_CALL_RE =
  /(?:\bconsole\s*\.\s*(?:log|error|warn|info|debug|trace)|\bprocess\s*\.\s*stdout\s*\.\s*write|(?<![\w$.])(?:say|log|tee|print|println|originalLog))\s*\(/g;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".vite",
  "test-results",
  "storage",
  "logs",
  "archive",
]);
const EXCLUDED_EVIDENCE_SEGMENTS = new Set(["outputs", "raw", "archive", "ref"]);
const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "return",
  "await",
  "async",
  "typeof",
  "new",
  "process",
  "console",
  "env",
  "String",
  "Number",
  "Boolean",
  "JSON",
  "Object",
  "Array",
  "true",
  "false",
  "null",
  "undefined",
  "if",
  "else",
  "function",
]);

/**
 * 单遍结构扫描：给出 ①每个 `(` 对应的 `)` 位置、②注释区间、③模板插值 `${...}` 的内容区间。
 * 支持字符串 / 模板 / 模板内嵌模板 / 注释，用于**精确**切出一个调用的实参，
 * 避免"某种写法让括号平衡失控、把后面若干行代码吞进实参"造成误报。
 */
function scanStructure(text) {
  const parens = new Map();
  const comments = [];
  const interpolations = [];
  const stack = [];
  const ctx = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const top = ctx.length ? ctx[ctx.length - 1] : null;
    const c = text[i];
    const c2 = text[i + 1];
    if (top && top.kind === "line") {
      if (c === "\n") {
        comments.push([top.start, i]);
        ctx.pop();
      }
      i++;
      continue;
    }
    if (top && top.kind === "block") {
      if (c === "*" && c2 === "/") {
        comments.push([top.start, i + 2]);
        ctx.pop();
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (top && top.kind === "literal") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === top.q) {
        ctx.pop();
      }
      i++;
      continue;
    }
    if (top && top.kind === "template") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        ctx.pop();
        i++;
        continue;
      }
      if (c === "$" && c2 === "{") {
        ctx.push({ kind: "expr", depth: 1, start: i + 1 });
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (top && top.kind === "expr") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        ctx.push({ kind: "template" });
        i++;
        continue;
      }
      if (c === "'" || c === '"') {
        ctx.push({ kind: "literal", q: c });
        i++;
        continue;
      }
      if (c === "{") {
        top.depth++;
        i++;
        continue;
      }
      if (c === "}") {
        top.depth--;
        if (top.depth === 0) {
          interpolations.push([top.start + 1, i]);
          ctx.pop();
        }
        i++;
        continue;
      }
      if (c === "(") {
        stack.push(i);
        i++;
        continue;
      }
      if (c === ")") {
        const open = stack.pop();
        if (open !== undefined) parens.set(open, i);
        i++;
        continue;
      }
      i++;
      continue;
    }
    // code
    if (c === "/" && c2 === "/") {
      ctx.push({ kind: "line", start: i });
      i += 2;
      continue;
    }
    if (c === "/" && c2 === "*") {
      ctx.push({ kind: "block", start: i });
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      ctx.push({ kind: "literal", q: c });
      i++;
      continue;
    }
    if (c === "`") {
      ctx.push({ kind: "template" });
      i++;
      continue;
    }
    if (c === "(") {
      stack.push(i);
      i++;
      continue;
    }
    if (c === ")") {
      const open = stack.pop();
      if (open !== undefined) parens.set(open, i);
      i++;
      continue;
    }
    i++;
  }
  return { parens, comments, interpolations };
}

/** 把字符串 / 模板字面量的**内容**清成空格（保留引号），用于"只认字面量之外的标识符"。 */
function blankLiterals(text) {
  const out = text.split("");
  let i = 0;
  let quote = "";
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === "\\") {
        out[i] = " ";
        if (i + 1 < text.length) out[i + 1] = " ";
        i += 2;
        continue;
      }
      if (c === quote || c === "\n") {
        quote = "";
        i++;
        continue;
      }
      out[i] = " ";
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      i++;
      continue;
    }
    i++;
  }
  return out.join("");
}

/** 顶层按分隔符拆分（括号 / 引号 / 模板外才是分隔符）。 */
function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) quote = "";
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === sep && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

const isLiteral = (s) => {
  const t = s.trim();
  if (!t) return true;
  if (/^`[^`]*`$/.test(t)) return !t.includes("${");
  if (/^'[^']*'$/.test(t) || /^"[^"]*"$/.test(t)) return true;
  return /^-?\d+(\.\d+)?$/.test(t) || /^(true|false|null|undefined)$/.test(t);
};

/**
 * 判断一个"值表达式"是否属于安全例外（结论型 / 脱敏占位）。
 * 返回 null 表示不是例外（即：把值写出去了）。
 */
function safeReason(expr) {
  const t = expr.trim();
  if (!t) return "空表达式";
  if (MASK_MARKS.some((m) => t.includes(m))) return "脱敏占位（已脱敏 / <masked> / ****）";
  if (/^\s*(?:[A-Za-z_$][\w$]*\.)*(?:redact|mask|sanitize|obscure|desensitize)[A-Za-z0-9_$]*\s*\(/i.test(t)) {
    return "脱敏包装：值先经 redact / mask / sanitize 类函数处理后才输出";
  }
  if (/[!=]==?/.test(t)) return "结论型：比较运算（==/===/!=/!==）";
  if (/\.length\b/.test(t)) return "结论型：.length（长度，不含值）";
  if (/^\s*Boolean\s*\(/.test(t)) return "结论型：Boolean(...)（布尔化）";
  if (/\btypeof\b/.test(t)) return "结论型：typeof（类型名，不含值）";
  const ids = t.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
  const sensitiveIds = ids.filter((id) => SENSITIVE_RE.test(id));
  if (sensitiveIds.length && sensitiveIds.every((id) => /matches$/i.test(id))) {
    return "结论型：*Matches 标识符（是否匹配的结论，不含值）";
  }
  const ternary = splitTopLevel(t, "?");
  if (ternary.length === 2) {
    const [cond, rest] = ternary;
    const branches = splitTopLevel(rest, ":");
    if (branches.length >= 2 && SENSITIVE_RE.test(cond) && branches.every((b) => isLiteral(b))) {
      return "结论型：条件为敏感键、两支均为字面量的三元（如 x ? \"已配置\" : \"未配置\"）";
    }
  }
  return null;
}

/** 分析一处日志调用的实参；命中返回 { identifier, reason }，否则 null。 */
function analyzeArgs(argsText) {
  const { interpolations } = scanStructure(argsText);
  const candidates = [];
  for (const [s, e] of interpolations) candidates.push({ expr: argsText.slice(s, e), reason: "模板插值" });
  const plusParts = splitTopLevel(argsText, "+");
  if (plusParts.length > 1) {
    for (const p of plusParts) {
      const inner = scanStructure(p).interpolations;
      if (inner.length) {
        for (const [s, e] of inner) candidates.push({ expr: p.slice(s, e), reason: "模板插值" });
      } else {
        candidates.push({ expr: p, reason: "字符串拼接" });
      }
    }
  }
  if (candidates.length === 0) candidates.push({ expr: argsText, reason: "直接传参" });
  for (const { expr, reason } of candidates) {
    // 标识符只认"字面量之外"的：`console.log("请设置 SMOKE_ADMIN_PASSWORD")` 是字面量，不是把值写出去。
    const ids = (blankLiterals(expr).match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || []).filter((id) => !KEYWORDS.has(id));
    const hit = ids.find((id) => SENSITIVE_RE.test(id));
    if (!hit) continue;
    if (safeReason(expr) !== null) continue;
    return { identifier: hit, reason: `规则 R1：敏感键的值经「${reason}」写进日志` };
  }
  return null;
}

function walk(dir, relParts, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const abs = path.join(dir, entry.name);
    const parts = relParts.concat(entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (parts[0] === "docs" && parts[1] === "evidence" && EXCLUDED_EVIDENCE_SEGMENTS.has(entry.name)) continue;
      walk(abs, parts, onFile);
      continue;
    }
    if (!entry.isFile()) continue;
    onFile(abs, parts.join("/"));
  }
}

const targets = new Set();
const collectScripts = (rootName, exts) => {
  const absRoot = path.join(repoRoot, rootName);
  if (!fs.existsSync(absRoot)) return;
  walk(absRoot, rootName.split("/"), (abs, rel) => {
    if (exts.includes(path.extname(abs).toLowerCase())) targets.add(rel);
  });
};

collectScripts("scripts", [".mjs", ".js"]);
collectScripts("tests", [".mjs"]);
collectScripts("backend/scripts", [".mjs"]);
const evidenceRoot = path.join(repoRoot, "docs", "evidence");
if (fs.existsSync(evidenceRoot)) {
  walk(evidenceRoot, ["docs", "evidence"], (abs, rel) => {
    if (["outputs", "raw", "archive", "ref"].some((s) => rel.split("/").includes(s))) return;
    const segs = rel.split("/");
    if (!segs.includes("harness") && !segs.includes("tools")) return;
    if (![".mjs", ".js", ".ts"].includes(path.extname(abs).toLowerCase())) return;
    targets.add(rel);
  });
}

const hits = [];
for (const rel of [...targets].sort()) {
  const abs = path.join(repoRoot, rel);
  let text;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    continue;
  }
  const { parens, comments } = scanStructure(text);
  const inComment = (pos) => comments.some(([s, e]) => pos >= s && pos < e);
  const lines = text.split("\n");
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);
  LOG_CALL_RE.lastIndex = 0;
  let m;
  while ((m = LOG_CALL_RE.exec(text)) !== null) {
    const callStart = m.index;
    if (inComment(callStart)) continue;
    if (/function\s+$/.test(text.slice(Math.max(0, callStart - 12), callStart))) continue;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = parens.get(openIdx);
    if (closeIdx === undefined) continue;
    const argsText = text.slice(openIdx + 1, closeIdx);
    const verdict = analyzeArgs(argsText);
    if (!verdict) continue;
    let lineNo = 1;
    while (lineNo < lineStarts.length && lineStarts[lineNo] <= callStart) lineNo++;
    const col = callStart - lineStarts[lineNo - 1] + 1;
    const snippet = (lines[lineNo - 1] || "").trim();
    const allowed = ALLOWLIST.find((a) => a.file === rel && a.line === lineNo);
    hits.push({
      file: rel,
      line: lineNo,
      col,
      identifier: verdict.identifier,
      rule: verdict.reason,
      snippet,
      allowed: allowed ? { reason: allowed.reason, ticket: allowed.ticket } : null,
    });
  }
}

const violations = hits.filter((h) => !h.allowed);
const allowedHits = hits.filter((h) => h.allowed);
const staleAllowlist = ALLOWLIST.filter((a) => !allowedHits.some((h) => h.file === a.file && h.line === a.line) && !hits.some((h) => h.file === a.file && h.line === a.line));
const ok = violations.length === 0;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok,
        root: repoRoot,
        scannedFiles: targets.size,
        scannedList: [...targets].sort(),
        hits: violations,
        allowed: allowedHits,
        allowlist: ALLOWLIST,
        staleAllowlist,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`[guard:evidence-secrets] 扫描可执行脚本 ${targets.size} 个（root=${repoRoot}）`);
  if (violations.length) {
    console.log(`✗ 命中 ${violations.length} 处（敏感键的值被写进日志/证据）：`);
    for (const h of violations) {
      console.log(`   - ${h.file}:${h.line}:${h.col}  标识符 ${h.identifier}  ${h.rule}`);
      console.log(`       ${h.line} | ${h.snippet}`);
      console.log("       改法：只留来源/结论（如 `x ? \"已配置\" : \"未配置\"`、`x.length`、`Boolean(x)`），");
      console.log("             或写脱敏占位（含 `已脱敏`/`<masked>`/`****`），或在 ALLOWLIST 具名登记理由。");
    }
  }
  for (const h of allowedHits) {
    console.log(`   · allowlist 豁免 ${h.file}:${h.line}（${h.allowed.ticket}：${h.allowed.reason}）`);
  }
  for (const a of staleAllowlist) {
    console.log(
      `   ! warn：allowlist 登记项 ${a.file}:${a.line}（${a.ticket}）全程 0 命中 —— 选择器可能已失效，请复核（不判红）`,
    );
  }
  console.log(
    ok
      ? `[guard:evidence-secrets] PASS（命中 0 处 / 豁免 ${allowedHits.length} 处）`
      : `[guard:evidence-secrets] FAIL（命中 ${violations.length} 处）`,
  );
}

process.exit(ok ? 0 : 1);
