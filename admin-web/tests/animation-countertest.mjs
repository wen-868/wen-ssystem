/**
 * WORKBENCH-06F3 动效 mutation 装置（门禁铁律：证明断言会红）
 *
 * 对 8 项动效修复逐个注入"删除/退化"，断言 tests/ui-animation.spec.mjs **点名变红**；
 * 每次注入后逐字节复原并校验 SHA256 恒等，末尾复跑回绿。
 *
 * 运行（工作树根目录）：node admin-web/tests/animation-countertest.mjs
 * 产物：docs/evidence/WORKBENCH-06F3/redtest/animation-countertest.md
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");
const OUT = path.join(WEB, "..", "docs", "evidence", "WORKBENCH-06F3", "redtest");
mkdirSync(OUT, { recursive: true });

const SHELL = path.join(SRC, "layouts", "WorkbenchShell.vue");
const SUBNAV = path.join(SRC, "layouts", "WorkbenchSubnav.vue");
const FEED = path.join(SRC, "components", "workbench", "AiFeedView.vue");
const SPEC = path.join(WEB, "tests", "ui-animation.spec.mjs");

const sha256 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").toUpperCase();

function runSpec() {
  try {
    const stdout = execFileSync(process.execPath, [SPEC], { cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/**
 * 删除文本中第一次出现的目标片段；找不到则抛错（保证 mutation 真生效）。
 *
 * ⚠️ 本仓 .vue 为 **CRLF**，而注入点模板用 `\n` 书写 ⇒ 必须先把 haystack 归一为 `\n` 再查找，
 *    否则每条都会"注入点未找到"（F1 的 mutation E 踩过同坑，此处统一处理）。
 */
function drop(text, needle, id) {
  const normalized = text.replace(/\r\n/g, "\n");
  const needleNorm = needle.replace(/\r\n/g, "\n");
  assert.ok(normalized.includes(needleNorm), `${id}: 注入点未找到 → ${needleNorm.slice(0, 90)}`);
  return normalized.replace(needleNorm, "");
}

const CASES = [
  {
    id: "M1-drop-rail-transition",
    title: "删除 rail 项 transition",
    target: SHELL,
    mutate: (t) => drop(t, "  transition: background-color 150ms ease, color 150ms ease;\n}\n.wb-rail-item:hover {", "M1")
      .replace("}\n.wb-rail-item:hover {", "}\n.wb-rail-item:hover {"),
    expect: "#1",
  },
  {
    id: "M2-drop-alert-background",
    title: "删除 rail .alert 的 background（退回到 F1 缺陷：keyframes 底色不生效）",
    target: SHELL,
    mutate: (t) => drop(t, "  background: #dc2626;\n  color: #fff;\n  animation: wb-rail-blink", "M2")
      .replace("  animation: wb-rail-blink", "  color: #fff;\n  animation: wb-rail-blink"),
    expect: "#2",
  },
  {
    id: "M3-drop-grid-transition",
    title: "删除壳层 grid-template-columns 过渡",
    target: SHELL,
    mutate: (t) => drop(t, "  transition: grid-template-columns 250ms ease;\n", "M3"),
    expect: "#3",
  },
  {
    id: "M4a-drop-subnav-transition",
    title: "删除二级卡 transition",
    target: SUBNAV,
    mutate: (t) => drop(t, "  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;\n", "M4a"),
    expect: "#4-a",
  },
  {
    id: "M4b-drop-fdv-item-hover",
    title: "删除信息流卡片 hover 边框规则",
    target: FEED,
    mutate: (t) => drop(t, ".fdv-item:hover {\n  border-color: var(--wb-primary, #2563eb);\n}\n", "M4b"),
    expect: "#4-b",
  },
  {
    id: "M5-drop-enter-animation",
    title: "删除信息流卡片入场动画引用",
    target: FEED,
    mutate: (t) => drop(t, "  animation: wb-fdv-in 350ms ease-out both;\n", "M5"),
    expect: "#5",
  },
  {
    id: "M7-drop-ask-transition",
    title: "删除提问条 transition",
    target: FEED,
    mutate: (t) => drop(t, "  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;\n", "M7"),
    expect: "#7",
  },
  {
    id: "M8-drop-seg-transition",
    title: "删除胶囊项 transition",
    target: SHELL,
    mutate: (t) => drop(t, "  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;\n", "M8"),
    expect: "#8",
  },
  {
    id: "M8b-drop-seg-hover",
    title: "删除胶囊未选中项 hover 规则（二轮审计发现的真缺陷）",
    target: SHELL,
    mutate: (t) =>
      drop(
        t,
        ".wb-mode-seg-item:hover {\n  color: var(--wb-ink, #16181d);\n}\n",
        "M8b",
      ),
    expect: "#8b",
  },
  {
    id: "M9-drop-reduced-motion-in-feed",
    title: "删除组件内 reduced-motion（断言应守住无障碍）",
    target: FEED,
    mutate: (t) => {
      /**
       * 不依赖注释文本定位（注释措辞会随维护变化，正则容易失配——M9 首版即因此失败）。
       * 直接找「AiFeedView 里最后一个 @media (prefers-reduced-motion: reduce) 块」并按花括号配对删除。
       */
      const normalized = t.replace(/\r\n/g, "\n");
      const marker = "@media (prefers-reduced-motion: reduce) {";
      const at = normalized.indexOf(marker);
      assert.ok(at >= 0, "M9: 组件内未找到 reduced-motion 媒体查询");
      // 从 marker 起做花括号配对找到块尾
      let depth = 0;
      let end = -1;
      for (let i = at + marker.length - 1; i < normalized.length; i += 1) {
        if (normalized[i] === "{") depth += 1;
        else if (normalized[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      assert.ok(end > at, "M9: reduced-motion 块未闭合");
      return normalized.slice(0, at) + normalized.slice(end);
    },
    expect: "#9",
  },
];

const originals = new Map();
for (const f of [SHELL, SUBNAV, FEED]) originals.set(f, readFileSync(f));

console.log("基线 SHA256：");
for (const [f, buf] of originals) console.log(`  ${path.basename(f)} = ${createHash("sha256").update(buf).digest("hex").toUpperCase()}`);

const base = runSpec();
console.log(`\n基线复跑（应绿）：EXIT=${base.code}`);
console.log(base.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(base.code, 0, "基线必须为绿");

const records = [];
for (const item of CASES) {
  const original = readFileSync(item.target);
  const originalHash = sha256(item.target);
  const mutated = item.mutate(original.toString("utf8"));
  assert.notEqual(mutated, original.toString("utf8"), `${item.id}: 注入未生效`);
  // 复原靠写回原始字节（original Buffer），因此注入侧只需保证"内容被改"，
  // 不必回填 CRLF；但为避免 diff 噪声，注入文本按 CRLF 写回（drop 内已归一为 LF）。
  writeFileSync(item.target, mutated.replace(/\n/g, "\r\n"));
  const injectedHash = sha256(item.target);

  const result = runSpec();
  const failedLines = result.stdout.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = failedLines.some((l) => l.includes(item.expect));

  console.log(`\n[反测 ${item.id}] ${item.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  EXIT=${result.code}；FAIL=${failedLines.length}；点名「${item.expect}」=${named}`);
  for (const l of failedLines) console.log(`  ${l}`);

  writeFileSync(item.target, original);
  const restoredHash = sha256(item.target);
  console.log(`  复原 SHA256 = ${restoredHash}；恒等=${restoredHash === originalHash}`);

  records.push({
    id: item.id,
    title: item.title,
    target: path.relative(WEB, item.target).replace(/\\/g, "/"),
    exitCode: result.code,
    failedCount: failedLines.length,
    named,
    expect: item.expect,
    injectedHash,
    originalHash,
    restoredHash,
    restoredIdentical: restoredHash === originalHash,
    failedLines,
  });

  assert.equal(result.code, 1, `${item.id}: 注入后必须变红`);
  assert.ok(named, `${item.id}: 未点名「${item.expect}」`);
  assert.ok(records.at(-1).restoredIdentical, `${item.id}: 复原 SHA256 必须恒等`);
}

const after = runSpec();
console.log(`\n复原后复跑：EXIT=${after.code}`);
console.log(after.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(after.code, 0, "复原后必须回绿");

const log = [
  "# WORKBENCH-06F3 动效 mutation 记录",
  "",
  "> 被测用例：`admin-web/tests/ui-animation.spec.mjs`（11 例）",
  "> 装置：`admin-web/tests/animation-countertest.mjs`（注入 → 断言点名红 → 逐字节复原 SHA256 → 复跑回绿）",
  "",
  "| 反测 | 目标文件 | 注入 | EXIT | FAIL | 点名 | 复原恒等 |",
  "|:--|:--|:--|--:|--:|:--:|:--:|",
  ...records.map(
    (r) =>
      `| ${r.id} | \`${r.target}\` | ${r.title} | ${r.exitCode} | ${r.failedCount} | ${r.named ? "✅" : "❌"} | ${r.restoredIdentical ? "✅" : "❌"} |`,
  ),
  "",
  "## 逐条 FAIL 原文",
  "",
  ...records.flatMap((r) => [`### ${r.id}（${r.title}）`, "", "```text", ...r.failedLines, "```", ""]),
  "## 复原后复跑",
  "",
  "```text",
  after.stdout.split("\n").filter((l) => l.startsWith("PASS") || l.startsWith("小结")).join("\n"),
  "```",
  "",
].join("\n");

writeFileSync(path.join(OUT, "animation-countertest.md"), log);
console.log("\n证据已落盘：docs/evidence/WORKBENCH-06F3/redtest/animation-countertest.md");
console.log(`全部反测通过：${records.length}/${CASES.length} 点名变红 + ${records.length}/${CASES.length} SHA256 恒等 + 复原后回绿`);
