/**
 * WORKBENCH-06 反测装置（硬验收 §三.5）
 *
 * 对四条结构必选项逐条注入违规，断言新用例 `prototype-parity.spec.mjs` **点名变红**；
 * 每次注入后逐字节复原并校验 SHA256 与注入前一致，末尾复跑证明回绿。
 *
 * 反测项（派单卡 §三.5 原文四条）：
 *   A. 删除一级 rail
 *   B. 删除第二列导航
 *   C. 删除底部输入区
 *   D. 删除旧壳回退分支
 *
 * 运行（工作树根目录）：node admin-web/tests/prototype-parity-countertest.mjs
 * 产物：docs/evidence/WORKBENCH-06/redtest/*.log
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
const SHELL = path.join(SRC, "layouts", "WorkbenchShell.vue");
const SPEC = path.join(WEB, "tests", "prototype-parity.spec.mjs");
const OUT = path.join(WEB, "..", "docs", "evidence", "WORKBENCH-06", "redtest");

mkdirSync(OUT, { recursive: true });

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase();
}

/** 跑新用例，返回 { code, stdout } */
function runSpec() {
  try {
    const stdout = execFileSync(process.execPath, [SPEC], {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const original = readFileSync(SHELL);
const originalHash = sha256(SHELL);

const CASES = [
  {
    id: "A-remove-rail",
    title: "删除一级模块图标栏（rail）",
    mutate: (text) =>
      text.replace(/\n\s*<!-- ══ 一级模块图标栏[\s\S]*?<\/nav>\n/, "\n"),
    expectName: "一级 rail",
  },
  {
    id: "B-remove-second-nav",
    title: "删除第二列上下文导航（WorkbenchSubnav）",
    mutate: (text) =>
      text.replace(/\n\s*<!-- ══ 第二列上下文导航[\s\S]*?\/>\n/, "\n"),
    expectName: "第二列导航",
  },
  {
    id: "C-remove-composer",
    title: "删除底部固定 AI 输入区（AiChatComposer）",
    mutate: (text) =>
      text.replace(/\n\s*<!-- ══ 底部固定 AI 输入区[\s\S]*?\/>\n/, "\n"),
    expectName: "底部输入区",
  },
  {
    id: "D-remove-fallback",
    title: "删除旧壳回退分支（MainLayout v-if）",
    mutate: (text) =>
      text.replace(/\n\s*<!-- 灰度回滚路径[\s\S]*?<MainLayout v-if="!shellEnabled" \/>\n/, "\n"),
    expectName: "旧壳回退",
  },
];

console.log(`基线 SHA256(WorkbenchShell.vue) = ${originalHash}`);
console.log(`基线复跑（应绿）：`);

const base = runSpec();
console.log(base.stdout.split("\n").filter((l) => l.startsWith("PASS") || l.startsWith("FAIL") || l.startsWith("小结")).join("\n"));
assert.equal(base.code, 0, "基线必须为绿，否则反测无意义");

const records = [];
for (const item of CASES) {
  const mutated = item.mutate(original.toString("utf8"));
  assert.notEqual(mutated, original.toString("utf8"), `${item.id}: 注入未生效（正则未命中）——反测无效`);
  writeFileSync(SHELL, mutated);
  const mutatedHash = sha256(SHELL);

  const result = runSpec();
  const failedLines = result.stdout.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = failedLines.some((line) => line.includes(item.expectName));
  const record = {
    id: item.id,
    title: item.title,
    injectedSha256: mutatedHash,
    exitCode: result.code,
    failedCount: failedLines.length,
    named: named,
    failedLines,
  };
  records.push(record);

  console.log(`\n[反测 ${item.id}] ${item.title}`);
  console.log(`  注入后 SHA256 = ${mutatedHash}`);
  console.log(`  EXIT=${result.code}；FAIL 行数=${failedLines.length}；点名「${item.expectName}」=${named}`);
  for (const line of failedLines) console.log(`  ${line}`);

  // 复原（逐字节）
  writeFileSync(SHELL, original);
  const restoredHash = sha256(SHELL);
  record.restoredSha256 = restoredHash;
  record.restoredIdentical = restoredHash === originalHash;
  console.log(`  复原 SHA256 = ${restoredHash}；与基线一致=${record.restoredIdentical}`);

  assert.equal(result.code, 1, `${item.id}: 注入后用例必须变红`);
  assert.ok(named, `${item.id}: 变红但未点名「${item.expectName}」——反测未打到位`);
  assert.ok(record.restoredIdentical, `${item.id}: 复原后与基线不一致`);
}

// 复原后复跑（回绿）
const after = runSpec();
console.log(`\n复原后复跑：EXIT=${after.code}`);
console.log(after.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(after.code, 0, "复原后必须回绿");

// 落盘证据
const log = [
  `# WORKBENCH-06 反测记录（prototype-parity）`,
  ``,
  `> 基线 SHA256(admin-web/src/layouts/WorkbenchShell.vue) = \`${originalHash}\``,
  `> 装置：\`admin-web/tests/prototype-parity-countertest.mjs\`（逐条注入 → 断言点名红 → 逐字节复原 → 复跑回绿）`,
  ``,
  `| 反测 | 注入 | EXIT | FAIL 行数 | 点名命中 | 注入后 SHA256 | 复原 SHA256 | 逐字节一致 |`,
  `|:--|:--|:--:|--:|:--:|:--|:--|:--:|`,
  ...records.map(
    (r) =>
      `| ${r.id} | ${r.title} | ${r.exitCode} | ${r.failedCount} | ${r.named ? "✅" : "❌"} | \`${r.injectedSha256.slice(0, 16)}…\` | \`${r.restoredSha256.slice(0, 16)}…\` | ${r.restoredIdentical ? "✅" : "❌"} |`,
  ),
  ``,
  `## 逐条 FAIL 原文`,
  ``,
  ...records.flatMap((r) => [
    `### ${r.id} · ${r.title}`,
    "",
    "```text",
    ...r.failedLines,
    "```",
    "",
  ]),
  `## 复原后复跑`,
  ``,
  "```text",
  after.stdout.split("\n").filter((l) => l.startsWith("PASS") || l.startsWith("FAIL") || l.startsWith("小结")).join("\n"),
  "```",
  ``,
].join("\n");

writeFileSync(path.join(OUT, "prototype-parity-countertest.md"), log);
console.log(`\n证据已落盘：docs/evidence/WORKBENCH-06/redtest/prototype-parity-countertest.md`);
console.log(`\n全部反测通过：4/4 点名变红 + 4/4 逐字节复原 + 复原后回绿`);
