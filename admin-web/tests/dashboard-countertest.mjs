/**
 * WORKBENCH-07 · mutation 反测装置（派单卡 §六 四类）
 *
 * 反测清单（逐条注入 → 断言**点名红** → 逐字节复原 SHA256 恒等 → 复跑回绿）：
 *   ① 适配器改回读扁平字段 ⇒ 今日/门店指标用例点名 0/undefined
 *   ② 接口 reject 映射为空数组 ⇒ 空态/失败态用例红
 *   ③ 门店工作台绕开共享适配器 ⇒ 结构负断言红
 *   ④ 入口改回 /customer/members ⇒ 路由用例红
 *
 * 运行（工作树根目录）：node admin-web/tests/dashboard-countertest.mjs
 * 产物：docs/evidence/WORKBENCH-07/redtest/dashboard-countertest.md（中央副本另存）
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");
const SRC = path.join(WEB, "src");
const OUT = path.join(REPO, "docs", "evidence", "WORKBENCH-07", "redtest");
mkdirSync(OUT, { recursive: true });

const CONTRACT = path.join(SRC, "utils", "dashboard-contract.ts");
const DASH = path.join(SRC, "views", "dashboard", "Dashboard.vue");
const STORE = path.join(SRC, "views", "pos", "StoreDashboardView.vue");
const SPEC = path.join(WEB, "tests", "dashboard-contract.spec.mjs");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

function runSpec() {
  try {
    const stdout = execFileSync(process.execPath, [SPEC], { cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/** 在归一化(LF)文本中定位并替换；找不到即抛错（保证 mutation 真生效） */
function patch(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  assert.ok(norm.includes(f), `${id}: 注入点未找到 → ${f.slice(0, 90)}`);
  return norm.replace(f, to.replace(/\r\n/g, "\n"));
}

const CASES = [
  {
    id: "M1-flat-fields-only",
    title: "适配器改回只读扁平字段（去掉嵌套优先）",
    target: CONTRACT,
    mutate: (t) =>
      patch(
        t,
        `    salesAmount: pick(t.salesAmount, o.todaySalesAmount) ?? 0,
    orderCount: pick(t.orderCount, o.todayOrderCount) ?? 0,`,
        `    salesAmount: pick(undefined, o.todaySalesAmount) ?? 0, // MUTATION-1（退回扁平）
    orderCount: pick(undefined, o.todayOrderCount) ?? 0, // MUTATION-1`,
        "M1",
      ),
    expect: "嵌套契约",
    expectExit: 1,
  },
  {
    id: "M2-fail-as-empty",
    title: "把接口失败映射为空数组（失败伪装成空态）",
    target: CONTRACT,
    mutate: (t) =>
      patch(
        t,
        `  if (!Array.isArray(raw)) {
    return { ok: false, reason: "预警响应不是数组（形状异常）" };
  }`,
        `  if (!Array.isArray(raw)) {
    return { ok: true, data: [], state: "empty" }; // MUTATION-2（失败→空）
  }`,
        "M2",
      ),
    expect: "alerts",
    expectExit: 1,
  },
  {
    id: "M3-store-bypass-adapter",
    title: "门店工作台绕开共享适配器（手写字段映射）",
    target: STORE,
    mutate: (t) =>
      patch(
        t,
        `    const parsed = parseDashboardOverview(data);`,
        `    // MUTATION-3：绕开适配器，直接手写嵌套字段
    const parsed = { ok: true, data: { month: { salesAmount: Number((data as any)?.month?.salesAmount || 0), orderCount: Number((data as any)?.month?.orderCount || 0) } } } as any;`,
        "M3",
      ),
    expect: "共用（强断言）",
    expectExit: 1,
  },
  {
    id: "M4-dead-link",
    title: "入口改回死链 /customer/members",
    target: DASH,
    mutate: (t) => patch(t, `@click="navTo(CUSTOMER_MEMBERS_ROUTE)"`, `@click="navTo('/customer/members')"`, "M4"),
    expect: "入口",
    expectExit: 1,
  },
];

const originals = new Map();
for (const f of [CONTRACT, DASH, STORE]) originals.set(f, readFileSync(f));

console.log("基线 SHA256：");
for (const [f, buf] of originals) console.log(`  ${path.basename(f)} = ${sha256(buf)}`);

const base = runSpec();
console.log(`\n基线复跑（应绿）：EXIT=${base.code}`);
console.log(base.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(base.code, 0, "基线必须为绿");

const records = [];
for (const item of CASES) {
  const original = readFileSync(item.target);
  const originalHash = sha256(original);
  const mutated = item.mutate(original.toString("utf8"));
  assert.notEqual(mutated, original.toString("utf8").replace(/\r\n/g, "\n"), `${item.id}: 注入未生效`);
  writeFileSync(item.target, mutated.replace(/\n/g, "\r\n"));
  const injectedHash = sha256(readFileSync(item.target));

  const result = runSpec();
  const failedLines = result.stdout.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = failedLines.some((l) => l.includes(item.expect));

  console.log(`\n[反测 ${item.id}] ${item.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  EXIT=${result.code}；FAIL=${failedLines.length}；点名「${item.expect}」=${named}`);
  for (const l of failedLines) console.log(`  ${l}`);

  writeFileSync(item.target, original);
  const restoredHash = sha256(readFileSync(item.target));
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

  assert.equal(result.code, item.expectExit, `${item.id}: 注入后必须变红`);
  assert.ok(named, `${item.id}: 未点名「${item.expect}」`);
  assert.ok(records.at(-1).restoredIdentical, `${item.id}: 复原 SHA256 必须恒等`);
}

const after = runSpec();
console.log(`\n复原后复跑：EXIT=${after.code}`);
console.log(after.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(after.code, 0, "复原后必须回绿");

const md = [
  "# WORKBENCH-07 mutation 反测记录（四类）",
  "",
  "> 被测用例：`admin-web/tests/dashboard-contract.spec.mjs`",
  "> 装置：`admin-web/tests/dashboard-countertest.mjs`（注入 → 点名红 → 逐字节复原 SHA256 → 复跑回绿）",
  "",
  "| 反测 | 目标 | 注入 | EXIT | FAIL | 点名 | 复原恒等 |",
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
writeFileSync(path.join(OUT, "dashboard-countertest.md"), md);
console.log("\n证据已落盘：docs/evidence/WORKBENCH-07/redtest/dashboard-countertest.md");
console.log(`全部反测通过：${records.length}/${CASES.length} 点名变红 + ${records.length}/${CASES.length} SHA256 恒等 + 复原后回绿`);
