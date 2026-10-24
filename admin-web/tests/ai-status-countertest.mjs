/**
 * WORKBENCH-06F1 反测装置（派单卡 §二.4 mutation A/B/C + §三.5）
 *
 * 三条 mutation，逐条注入 → 断言 `ai-status-truth.spec.mjs` **点名变红** → 逐字节复原（SHA256 恒等）→ 复绿：
 *
 *   A. 把 `idle` 改回在线：在状态机里让 `resolveReadiness` 忽略失败直接返回 ready
 *      （等价于旧版"idle 即在线"的假绿路径）⇒ 必须被「网络失败/CORS/非 2xx 一律非绿」判红。
 *   B. 删除 employees 真实调用或改成常量：把 `loadAgentEmployees` 的 fetch 换成写死常量
 *      ⇒ 必须被「真实 HTTP 调用」与「失败 ⇒ unknown 不假 0」判红。
 *   C. 删除 plans 真实调用或改成常量：同法处理 `loadAgentPlans`
 *      ⇒ 必须被「真实 HTTP 调用 /api/ai/agent/plans」判红。
 *
 * 运行（工作树根目录）：node admin-web/tests/ai-status-countertest.mjs
 * 产物：docs/evidence/WORKBENCH-06F1/redtest/*.md
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
const OUT = path.join(WEB, "..", "docs", "evidence", "WORKBENCH-06F1", "redtest");
mkdirSync(OUT, { recursive: true });

const READINESS = path.join(SRC, "shared", "workbench", "ai-readiness.ts");
const METRICS = path.join(SRC, "shared", "workbench", "agent-metrics.ts");
const SPEC = path.join(WEB, "tests", "ai-status-truth.spec.mjs");

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase();
}
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

const CASES = [
  {
    id: "A-idle-as-online",
    title: "把失败/idle 改回「在线」：resolveReadiness 直接返回 ready（忽略网络失败与非 2xx）",
    target: READINESS,
    mutate: (text) => {
      // 在函数体开头插一行"永远 ready"，彻底绕开失败判据（等价旧假绿）
      const marker = "  if (input.networkError) return \"error\";";
      assert.ok(text.includes(marker), "mutation A 注入点未找到");
      return text.replace(marker, "  return \"ready\"; // MUTATION-A\n" + marker);
    },
    expectName: "状态机",
  },
  {
    id: "B-employees-constant",
    title: "删除 employees 真实调用：改成写死常量（不走 fetch）",
    target: METRICS,
    mutate: (text) => {
      const marker = "    const payload = await fetchJson(\"/api/ai/employees\");";
      assert.ok(text.includes(marker), "mutation B 注入点未找到");
      return text.replace(
        marker,
        "    const payload = [{ id: 1, name: \"假员工\", post: \"x\", department: \"y\" }]; // MUTATION-B（不走真实调用）",
      );
    },
    expectName: "员工",
  },
  {
    id: "C-plans-constant",
    title: "删除 plans 真实调用：改成写死常量（不走 fetch）",
    target: METRICS,
    mutate: (text) => {
      const marker = "    const payload = await fetchJson(\"/api/ai/agent/plans\");";
      assert.ok(text.includes(marker), "mutation C 注入点未找到");
      return text.replace(
        marker,
        "    const payload = { success: true, total: 1, items: [{ state: \"running\", steps: [{ status: \"done\" }] }] }; // MUTATION-C（不走真实调用）",
      );
    },
    expectName: "计划",
  },
];

const originals = new Map();
for (const file of [READINESS, METRICS]) originals.set(file, readFileSync(file));

console.log("基线 SHA256：");
for (const [file, buf] of originals) console.log(`  ${path.basename(file)} = ${createHash("sha256").update(buf).digest("hex").toUpperCase()}`);

const base = runSpec();
console.log(`\n基线复跑（应绿）：EXIT=${base.code}`);
console.log(base.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(base.code, 0, "基线必须为绿，否则反测无意义");

const records = [];
for (const item of CASES) {
  const original = readFileSync(item.target);
  const originalHash = sha256(item.target);
  const mutated = item.mutate(original.toString("utf8"));
  writeFileSync(item.target, mutated);
  const injectedHash = sha256(item.target);

  const result = runSpec();
  const failedLines = result.stdout.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = failedLines.some((line) => line.includes(item.expectName));

  console.log(`\n[反测 ${item.id}] ${item.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  EXIT=${result.code}；FAIL=${failedLines.length}；点名「${item.expectName}」=${named}`);
  for (const line of failedLines) console.log(`  ${line}`);

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
    injectedHash,
    originalHash,
    restoredHash,
    restoredIdentical: restoredHash === originalHash,
    failedLines,
  });

  assert.equal(result.code, 1, `${item.id}: 注入后用例必须变红`);
  assert.ok(named, `${item.id}: 变红但未点名「${item.expectName}」`);
  assert.ok(records.at(-1).restoredIdentical, `${item.id}: 复原后 SHA256 必须恒等`);
}

const after = runSpec();
console.log(`\n复原后复跑：EXIT=${after.code}`);
console.log(after.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(after.code, 0, "复原后必须回绿");

const log = [
  "# WORKBENCH-06F1 反测记录（三条 mutation）",
  "",
  "> 被测用例：`admin-web/tests/ai-status-truth.spec.mjs`（23 例）",
  "> 装置：`admin-web/tests/ai-status-countertest.mjs`（注入 → 断言点名红 → 逐字节复原 SHA256 → 复跑回绿）",
  "",
  "| 反测 | 目标文件 | 注入手法 | EXIT | FAIL 行数 | 点名命中 | 注入后 SHA256 | 复原 SHA256 | 恒等 |",
  "|:--|:--|:--|--:|--:|:--:|:--|:--|:--:|",
  ...records.map(
    (r) =>
      `| ${r.id} | \`${r.target}\` | ${r.title.replace(/：.*/, "")} | ${r.exitCode} | ${r.failedCount} | ${r.named ? "✅" : "❌"} | \`${r.injectedHash.slice(0, 16)}…\` | \`${r.restoredHash.slice(0, 16)}…\` | ${r.restoredIdentical ? "✅" : "❌"} |`,
  ),
  "",
  "## 逐条 FAIL 原文",
  "",
  ...records.flatMap((r) => [`### ${r.id}`, "", "```text", ...r.failedLines, "```", ""]),
  "## 复原后复跑",
  "",
  "```text",
  after.stdout.split("\n").filter((l) => l.startsWith("PASS") || l.startsWith("FAIL") || l.startsWith("小结")).join("\n"),
  "```",
  "",
].join("\n");

writeFileSync(path.join(OUT, "ai-status-countertest.md"), log);
console.log("\n证据已落盘：docs/evidence/WORKBENCH-06F1/redtest/ai-status-countertest.md");
console.log("全部反测通过：3/3 点名变红 + 3/3 SHA256 恒等 + 复原后回绿");
