/**
 * S3-67 静态清点：扫描 admin-web/src 内 `--border-normal` 的全部引用点
 *
 * 产出（落盘，可复跑）：
 *   docs/evidence/S3-67/raw/static-inventory.json   —— 逐条 file:line + 所属选择器 + 四类判定
 *   docs/evidence/S3-67/raw/static-inventory.txt    —— 人读摘要
 *
 * 用途：为 D2 派单卡 §四「40 处引用点覆盖基线」提供**现场行号**（卡上行号存在 +3 漂移），
 *      并给出四类判定（控件 / 分隔线 / 容器 / 装饰）的**判定依据**（哪条规则命中）。
 *
 * 🔴 纪律：
 *   - 本脚本只做静态清点，**不做任何"哪个变量生效"的结论**（R8.1：层叠/覆盖只能由运行期 computed 定论）；
 *   - 只读 admin-web/src，不写任何业务文件。
 *
 * 用法：node docs/evidence/S3-67/tools/s3-67-static-inventory.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(__dirname, "..", "..", "..", ".."); // worktree 根
const SRC = path.join(WT, "admin-web", "src");
const RAW = path.join(WT, "docs", "evidence", "S3-67", "raw");

// ── 派单卡 §四 声称的 40 条基线（file:line 以卡上为准，用于漂移比对）────────────
const CARD_BASELINE = [
  ["admin-web/src/styles/tokens.css", 320, ".el-button--danger"],
  ["admin-web/src/styles.css", 74, ""],
  ["admin-web/src/styles.css", 125, ""],
  ["admin-web/src/styles.css", 155, ""],
  ["admin-web/src/styles.css", 194, ""],
  ["admin-web/src/styles.css", 217, ""],
  ["admin-web/src/styles.css", 245, ""],
  ["admin-web/src/styles.css", 251, ""],
  ["admin-web/src/styles.css", 293, ""],
  ["admin-web/src/styles.css", 317, ""],
  ["admin-web/src/styles.css", 330, ""],
  ["admin-web/src/styles.css", 448, ""],
  ["admin-web/src/styles.css", 661, ""],
  ["admin-web/src/styles.css", 709, ""],
  ["admin-web/src/styles.css", 1148, ""],
  ["admin-web/src/styles.css", 1158, ""],
  ["admin-web/src/styles.css", 1321, ""],
  ["admin-web/src/layouts/MainLayout.vue", 1087, ""],
  ["admin-web/src/views/dashboard/TodoList.vue", 353, ""],
  ["admin-web/src/views/dashboard/MessageCenter.vue", 285, ""],
  ["admin-web/src/views/dashboard/MessageCenter.vue", 296, ""],
  ["admin-web/src/views/dashboard/QuickEntryConfig.vue", 371, ""],
  ["admin-web/src/views/dashboard/QuickEntryConfig.vue", 381, ""],
  ["admin-web/src/components/AiChat/AiSidePanel.vue", 475, ""],
  ["admin-web/src/views/system/PaymentConfigView.vue", 684, ""],
  ["admin-web/src/views/system/SystemConfigView.vue", 855, ""],
  ["admin-web/src/components/AiChat/AiMessageCard.vue", 371, ""],
  ["admin-web/src/components/AiChat/AiChatWindow.vue", 484, ""],
  ["admin-web/src/components/AiChat/AiPreviewCard.vue", 104, ""],
  ["admin-web/src/views/order/OrderAftersaleView.vue", 624, ""],
  ["admin-web/src/views/order/OrderBoardView.vue", 256, ""],
  ["admin-web/src/views/order/OrderExceptionView.vue", 237, ""],
  ["admin-web/src/views/pos/CashierView.vue", 1819, ""],
  ["admin-web/src/views/pos/CashierView.vue", 2105, ""],
  ["admin-web/src/views/pos/CashierView.vue", 2148, ""],
  ["admin-web/src/views/pos/CashierView.vue", 2184, ""],
  ["admin-web/src/views/pos/CashierView.vue", 2410, ""],
  ["admin-web/src/views/pos/CashierView.vue", 2456, ""],
  ["admin-web/src/views/pos/CashierView.vue", 2687, ""],
  ["admin-web/src/views/pos/CashierView.vue", 2750, ""],
];

// ── 语义判定覆盖表（人工给定，仅覆盖"静态可确定"的语义；其余靠规则推断并标 inferred）──
// 这些条目是**人工判据**，写在这里是为了让判定可复核（每条都在矩阵里标注来源=override/rule）
const SEMANTIC_OVERRIDES = [
  { file: "admin-web/src/styles/tokens.css", line: 320, kind: "控件", why: "选择器 .el-button--danger ⇒ 按钮（可交互控件）边框" },
  { file: "admin-web/src/styles.css", line: 709, kind: "控件候选", why: "--el-button-border-color⇒EP 按钮边框变量（是否生效须 computed 定论）" },
  { file: "admin-web/src/views/pos/CashierView.vue", line: 1819, kind: "控件", why: ".product-search-input .el-input__wrapper 内嵌 box-shadow 边框 ⇒ 输入框控件边框" },
  { file: "admin-web/src/views/pos/CashierView.vue", line: 2687, kind: "控件", why: ".pay-code-input .el-input__wrapper 内嵌 box-shadow 边框 ⇒ 输入框控件边框" },
  { file: "admin-web/src/views/pos/CashierView.vue", line: 2750, kind: "控件", why: ".trace-code-input .el-input__wrapper 内嵌 box-shadow 边框 ⇒ 输入框控件边框（追溯弹窗）" },
  { file: "admin-web/src/views/pos/CashierView.vue", line: 2105, kind: "控件", why: ".qty-btn（加/减按钮）实线边框 ⇒ 控件边框" },
  { file: "admin-web/src/views/pos/CashierView.vue", line: 2184, kind: "控件", why: ".pay-method-btn（支付方式按钮）实线边框 ⇒ 控件边框" },
  { file: "admin-web/src/views/pos/CashierView.vue", line: 2410, kind: "控件", why: ".pay-method-card（支付方式卡片按钮）实线边框 ⇒ 控件边框" },
  { file: "admin-web/src/views/pos/CashierView.vue", line: 2456, kind: "控件", why: ".numpad-key（数字键盘按键）实线边框 ⇒ 控件边框" },
  { file: "admin-web/src/views/pos/CashierView.vue", line: 2148, kind: "分隔线", why: "border-top: 1px dashed ⇒ 虚线分隔线（非控件识别边界）" },
  { file: "admin-web/src/views/order/OrderExceptionView.vue", line: 237, kind: "分隔线", why: "模板内联 style 的 border-top ⇒ 内容区分隔线" },
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(vue|css|scss|ts|tsx|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

function stripComments(line) {
  return line.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/, "");
}

/** 从命中行往回找最近的"未闭合规则头"，即所属选择器 */
function enclosingSelector(lines, idx) {
  let depth = 0;
  for (let i = idx; i >= 0; i--) {
    const line = stripComments(lines[i]);
    for (let k = line.length - 1; k >= 0; k--) {
      const ch = line[k];
      if (ch === "}") depth++;
      else if (ch === "{") {
        depth--;
        if (depth < 0) {
          // 组装选择器文本：本行 '{' 之前的内容 + 需要时向上补几行
          let parts = [line.slice(0, k)];
          let j = i - 1;
          while (j >= 0 && parts.join(" ").trim().length === 0) {
            const prev = stripComments(lines[j]);
            if (/[};]/.test(prev)) break;
            parts.unshift(prev);
            j--;
          }
          let text = parts.join(" ").replace(/\s+/g, " ").trim();
          // 截掉上一个块的尾巴
          const cut = Math.max(text.lastIndexOf("}"), text.lastIndexOf(";"));
          if (cut >= 0) text = text.slice(cut + 1).trim();
          return { selector: text, braceLine: i + 1 };
        }
      }
    }
  }
  return { selector: null, braceLine: null };
}

/** 命中行是不是模板内联 style 属性 */
function inlineStyleOf(line) {
  if (!/style\s*=\s*"/.test(line)) return null;
  const tag = (line.match(/<([a-zA-Z][\w-]*)/) || [])[1] || null;
  return { tag };
}

/** 四类判定规则（静态、可复核；不可静态确定的一律标"待运行期"） */
function classify(rel, declLine, line, selector) {
  const s = selector || "";
  const prop = (line.match(/^\s*(border[a-z-]*|box-shadow)\s*:/) || [])[1] || "";
  const isShadow = prop === "box-shadow";
  const isSideOnly = /^border-(top|bottom|left|right)$/.test(prop);
  const dashed = /dashed|dotted/.test(line);
  const isTableVar = /--el-table-border-color/.test(line);
  const isButtonVar = /--el-button-border-color/.test(line);

  if (isButtonVar) return { kind: "控件候选", why: "写 EP 按钮边框变量（生效与否须 computed 定论）" };
  if (isTableVar) return { kind: "分隔线候选", why: "写 EP 表格边框变量（生效与否须 computed 定论）" };
  if (isShadow) return { kind: "控件", why: "inset box-shadow 画边框（EP 系控件边框的既有手法）" };
  if (dashed) return { kind: "分隔线", why: "虚线边框 ⇒ 内容分隔线" };
  if (isSideOnly) return { kind: "分隔线", why: "仅单边实线边框 ⇒ 分区/表格分隔线" };
  // 有效控件名（可交互元素）
  if (/(^|[\s,>])(button|input|select|textarea|\.el-button|\.el-input|\.el-select|\.el-textarea|\.el-radio|\.el-checkbox|\.el-switch|\.el-tag)/i.test(s))
    return { kind: "控件", why: "选择器指向可交互控件" };
  if (/kbd\b/i.test(s)) return { kind: "装饰", why: "kbd 快捷键提示 ⇒ 纯装饰性元素" };
  if (/\.el-card|\.el-dialog|\.el-drawer|\.panel|\.card|\.box|\.wrapper|\.container|\.section|\.item|\.area|\.header|\.tabs|\.bar|\.menu|\.hero/i.test(s))
    return { kind: "容器", why: "选择器指向容器/面板" };
  return { kind: "容器", why: "既非控件也非单边分隔（默认按容器登记，运行期矩阵再定性）" };
}

const TOKENS = ["--border-normal", "--border-light", "--table-border", "--input-border", "--el-border-color"];
const files = walk(SRC);
const inventory = [];
const tokenCounts = {};

for (const abs of files) {
  const rel = path.relative(WT, abs).replace(/\\/g, "/");
  const text = fs.readFileSync(abs, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const tok of TOKENS) {
      const n = line.split(tok).length - 1;
      if (n > 0) tokenCounts[tok] = (tokenCounts[tok] || 0) + 1;
    }
    if (!line.includes("--border-normal")) return;
    const isDecl = /^\s*--border-normal\s*:/.test(line);
    const enc = isDecl ? { selector: ":root（tokens.css 声明处）", braceLine: null } : enclosingSelector(lines, i);
    const inline = inlineStyleOf(line);
    const selector = inline ? `<inline style 属性（${inline.tag || "未知标签"}）>` : enc.selector;
    const lineNo = i + 1;
    const ov = SEMANTIC_OVERRIDES.find((o) => o.file === rel && o.line === lineNo);
    const cls = isDecl
      ? { kind: "声明处（token 定义）", why: "token 声明本身不是引用点" }
      : ov
        ? { kind: ov.kind, why: ov.why }
        : classify(rel, lineNo, line, selector);
    inventory.push({
      file: rel,
      line: lineNo,
      raw: line.trim(),
      isTokenDeclaration: isDecl,
      selector,
      selectorBraceLine: enc.braceLine,
      kind: cls.kind,
      kindSource: isDecl ? "declaration" : ov ? "manual-override" : "rule",
      kindWhy: cls.why,
    });
  });
}

const refs = inventory.filter((x) => !x.isTokenDeclaration);
const decls = inventory.filter((x) => x.isTokenDeclaration);

// ── 与派单卡 §四 基线逐条比对（行号漂移）─────────────────────────────────────
const drift = CARD_BASELINE.map(([file, cardLine, note]) => {
  const exact = refs.find((r) => r.file === file && r.line === cardLine);
  if (exact) return { file, cardLine, liveLine: cardLine, drift: 0, matched: true, note, selector: exact.selector, raw: exact.raw };
  // 同文件内最接近的未匹配引用点（按行号差绝对值）
  const sameFile = refs.filter((r) => r.file === file);
  const near = sameFile.sort((a, b) => Math.abs(a.line - cardLine) - Math.abs(b.line - cardLine))[0];
  return {
    file, cardLine, liveLine: near ? near.line : null, drift: near ? near.line - cardLine : null,
    matched: false, matchedByFileOnly: Boolean(near), note,
    selector: near ? near.selector : null,
    raw: near ? near.raw : null,
  };
});
const unmatchedLive = refs.filter((r) => !drift.some((d) => d.matched && d.file === r.file && d.liveLine === r.line));

// ── token 声明行号漂移（派单卡 §二.1 声称 +3 漂移，逐条核对）──────────────────
const CARD_DECLARATIONS = [
  ["--border-normal", "admin-web/src/styles/tokens.css", 115, "#E2E2E2"],
  ["--border-light", "admin-web/src/styles/tokens.css", 116, "#F0F0F0"],
  ["--table-border", "admin-web/src/styles/tokens.css", 274, "#E2E2E2"],
  ["--input-border", "admin-web/src/styles/tokens.css", 280, "#888888"],
];
const declarationDrift = CARD_DECLARATIONS.map(([tok, file, cardLine, cardValue]) => {
  const abs = path.join(WT, file);
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  const live = [];
  lines.forEach((l, i) => {
    const m = l.match(new RegExp("^\\s*" + tok.replace(/[-]/g, "\\-") + "\\s*:\\s*([^;]+);"));
    if (m) live.push({ line: i + 1, value: m[1].trim() });
  });
  const hit = live.find((x) => x.line === cardLine);
  const nearest = live[0] || null;
  return {
    token: tok, file, cardLine, cardValue,
    liveLine: nearest ? nearest.line : null,
    liveValue: nearest ? nearest.value : null,
    drift: nearest ? nearest.line - cardLine : null,
    matchedExactly: Boolean(hit),
  };
});

const result = {
  meta: {
    generatedAt: new Date().toISOString(),
    root: WT,
    scanned: "admin-web/src",
    script: "docs/evidence/S3-67/tools/s3-67-static-inventory.mjs",
    note: "静态清点：不做'哪个变量生效'的结论（R8.1）",
  },
  counts: {
    filesScanned: files.length,
    totalBorderNormalLines: inventory.length,
    declarations: decls.length,
    referencePoints: refs.length,
    cardBaselineClaimed: CARD_BASELINE.length,
    cardBaselineMatchedExactly: drift.filter((d) => d.matched).length,
    liveRefsNotInCardBaseline: unmatchedLive.length,
    tokenLineCounts: tokenCounts,
  },
  declarationDrift,
  declarations: decls,
  references: refs,
  cardBaselineDrift: drift,
  liveRefsNotInCardBaseline: unmatchedLive,
};

fs.mkdirSync(RAW, { recursive: true });
fs.writeFileSync(path.join(RAW, "static-inventory.json"), JSON.stringify(result, null, 2), "utf8");

const L = [];
L.push("S3-67 静态清点（admin-web/src，`--border-normal`）");
L.push(`生成时间=${result.meta.generatedAt}`);
L.push(`扫描文件数=${result.counts.filesScanned}  --border-normal 行命中=${result.counts.totalBorderNormalLines}（声明 ${result.counts.declarations} + 引用 ${result.counts.referencePoints}）`);
L.push(`派单卡基线=${result.counts.cardBaselineClaimed} 条，行号精确命中=${result.counts.cardBaselineMatchedExactly}，卡外新增引用=${result.counts.liveRefsNotInCardBaseline}`);
L.push(`各 token 行命中：${JSON.stringify(tokenCounts)}`);
L.push("");
L.push("【token 声明处（现场行号 + 现值）+ 派单卡行号漂移核对】");
for (const d of declarationDrift) {
  L.push(`${d.token} 卡:${d.cardLine}(${d.cardValue}) → 现场:${d.liveLine}=${d.liveValue} Δ=${d.drift > 0 ? "+" : ""}${d.drift} ${d.matchedExactly ? "" : "⚠行号不一致"}`);
}
L.push("");
L.push("【引用点逐条（现场行号 + 所属选择器 + 四类判定）】");
for (const r of refs) {
  L.push(`${r.file}:${r.line}  [${r.kind}](${r.kindSource})  选择器=${r.selector}`);
  L.push(`      ${r.raw}`);
}
L.push("");
L.push("【与派单卡 §四 基线比对（行号漂移）】");
for (const d of drift) {
  L.push(`${d.matched ? "精确命中" : "行号漂移/需核对"} 卡:${d.cardLine} → 现场:${d.liveLine} (Δ=${d.drift}) ${d.file}  ${d.selector || ""}`);
}
L.push("");
L.push("【卡基线之外的现场引用点】");
for (const r of unmatchedLive) L.push(`+ ${r.file}:${r.line} [${r.kind}] ${r.raw}`);
fs.writeFileSync(path.join(RAW, "static-inventory.txt"), L.join("\n"), "utf8");

console.log(L.join("\n"));
