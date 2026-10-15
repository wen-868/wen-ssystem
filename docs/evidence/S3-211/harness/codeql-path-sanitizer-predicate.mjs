/**
 * S3-211 证据装置 · **本地等价判据**：用 TypeScript 编译器 API 在源码上核对
 * 「`path.resolve(path.join(根目录, 段))` + `if (!resolved.startsWith(根目录 + path.sep))`」这一
 * CodeQL 已建模的净化形态（依据见 `docs/evidence/S3-211/README.md` 二、1）是否**逐处存在**。
 *
 * 说明：本地跑不了 CodeQL（它只在 push/PR/schedule 触发，本单禁 push、禁开 PR），
 * 因此本判据是**必要条件**而非充分条件：它只能证明"形态写对了"，最终由合并后的 CodeQL run 判定。
 *
 * 用法：
 *   node codeql-path-sanitizer-predicate.mjs [--repo <目录>] [--quiet]
 * 退出码：0 = 四处落点全部命中；1 = 有缺失（含"给副本跑"的反测用法）。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const requireFromRepo = createRequire(path.join(here, "../../../..", "package.json"));
const ts = requireFromRepo("typescript");

const args = process.argv.slice(2);
const repoIdx = args.indexOf("--repo");
const repo = repoIdx >= 0 ? path.resolve(args[repoIdx + 1]) : path.resolve(here, "../../../..");
const quiet = args.includes("--quiet");

/** 落点清单：文件 → 期望的「归一 + 校验」对数 + 覆盖的告警号（见 README 二、2） */
const SITES = [
  { file: "backend/src/controllers/admin/avatar.controller.ts", pairs: 1, alerts: [265] },
  { file: "backend/src/controllers/admin/product-image.controller.ts", pairs: 1, alerts: [266] },
  { file: "backend/src/services/admin/miniapp-upload.service.ts", pairs: 2, alerts: [267, 268, 269, 270, 271, 272, 273, 274] },
  { file: "backend/src/services/admin/miniapp-package.service.ts", pairs: 1, alerts: [275, 276] },
];

/** 纯工具（不含净化点）：告警落在这里，但根目录只有调用方知道 */
const TOOL_FILES = [{ file: "backend/src/shared/zip.ts", alerts: [275, 276], note: "净化点在唯一生产调用方 miniapp-package.service.ts" }];

function textOf(node, sf) {
  return node ? node.getText(sf) : "";
}

/** 收集「归一 + 校验」对 */
function collectPairs(sf) {
  const pairs = [];
  const walk = (node) => {
    if (ts.isCallExpression(node) && /(^|\.)resolve$/.test(textOf(node.expression, sf))) {
      const arg = node.arguments[node.arguments.length - 1];
      let segment = null;
      if (arg && ts.isCallExpression(arg) && /(^|\.)join$/.test(textOf(arg.expression, sf))) {
        segment = arg.arguments[arg.arguments.length - 1];
      } else {
        segment = arg;
      }
      const decl = findDeclarator(node);
      const resolvedName = decl && ts.isIdentifier(decl.name) ? decl.name.text : null;
      pairs.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        resolvedName,
        segmentKind:
          segment && (ts.isIdentifier(segment) || ts.isPropertyAccessExpression(segment) || ts.isElementAccessExpression(segment))
            ? "变量/属性（CodeQL AccessPath 实例）"
            : `非变量：${segment ? ts.SyntaxKind[segment.kind] : "无参数"}`,
        guarded: false,
        guardLine: null,
      });
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);

  // 逐个 resolve 找同一函数内的 `if (!<name>.startsWith(... path.sep ...))`
  const guards = [];
  const walkIf = (node) => {
    if (ts.isIfStatement(node)) {
      let test = node.expression;
      let negated = false;
      while (ts.isPrefixUnaryExpression(test) && test.operator === ts.SyntaxKind.ExclamationToken) {
        negated = !negated;
        test = test.operand;
      }
      if (ts.isParenthesizedExpression(test)) test = test.expression;
      if (test && ts.isCallExpression(test) && /\.startsWith$/.test(textOf(test.expression, sf))) {
        const base = test.expression.expression;
        const arg = test.arguments[0];
        guards.push({
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          negated,
          baseName: base ? textOf(base, sf) : "",
          substring: arg ? textOf(arg, sf) : "",
        });
      }
    }
    ts.forEachChild(node, walkIf);
  };
  walkIf(sf);

  for (const pair of pairs) {
    const guard = guards.find(
      (g) => pair.resolvedName && g.baseName === pair.resolvedName && g.substring.includes("path.sep") && g.negated && g.line > pair.line
    );
    if (guard) {
      pair.guarded = true;
      pair.guardLine = guard.line;
    }
  }
  return pairs;
}

function findDeclarator(node) {
  let cur = node;
  while (cur) {
    if (ts.isVariableDeclaration(cur)) return cur;
    cur = cur.parent;
  }
  return null;
}

let failures = 0;
if (!quiet) {
  console.log(`[S3-211 判据] 仓库：${repo}`);
  console.log(`[S3-211 判据] 形态：path.resolve(path.join(根目录, 段)) + !resolved.startsWith(根目录 + path.sep)；段必须是变量/属性（CodeQL AccessPath 实例）`);
}

for (const site of SITES) {
  const abs = path.join(repo, site.file);
  const sf = ts.createSourceFile(abs, fs.readFileSync(abs, "utf8"), ts.ScriptTarget.ES2022, true);
  const pairs = collectPairs(sf);
  // 只认"段是变量/属性"的归一调用：字符串字面量（仓库根探测）与 call（keyDir 归一等）不是污染段，天然无需校验
  const relevant = pairs.filter((p) => p.segmentKind.startsWith("变量"));
  const ignored = pairs.filter((p) => !p.segmentKind.startsWith("变量"));
  const ok = relevant.filter((p) => p.guarded).length;
  const pass = ok >= site.pairs && relevant.every((p) => p.guarded);
  if (!pass) failures += 1;
  if (!quiet) {
    console.log(`\n${pass ? "PASS" : "FAIL"} ${site.file}（告警 ${site.alerts.join("/")}）命中 ${ok}/${site.pairs} 对（无关归一调用 ${ignored.length} 个已忽略）`);
    for (const p of relevant) {
      console.log(`   - resolve@${p.line} → ${p.resolvedName ?? "?"}（段：${p.segmentKind}）；校验@${p.guardLine ?? "**缺失**"} ${p.guarded ? "" : "← 未命中"}`);
    }
    for (const p of ignored) {
      console.log(`   - （忽略）resolve@${p.line} → ${p.resolvedName ?? "?"}（段：${p.segmentKind}）`);
    }
  }
}

for (const tool of TOOL_FILES) {
  const abs = path.join(repo, tool.file);
  const sf = ts.createSourceFile(abs, fs.readFileSync(abs, "utf8"), ts.ScriptTarget.ES2022, true);
  const pairs = collectPairs(sf);
  if (!quiet) {
    const hit = pairs.filter((p) => p.guarded).length;
    console.log(`\nNOTE ${tool.file}（告警 ${tool.alerts.join("/")}）：本文件校验对 ${hit} 个；${tool.note}`);
  }
}

if (!quiet) console.log(`\n[S3-211 判据] 结论：${failures === 0 ? "EXIT=0（四处落点全部命中）" : `EXIT=1（${failures} 处未命中）`}`);
process.exit(failures === 0 ? 0 : 1);
