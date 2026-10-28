/**
 * WORKBENCH-07 · mutation 反测装置（派单卡 §六 四类）
 *
 * 反测清单（逐条注入 → 断言**点名红** → 逐字节复原 SHA256 恒等 → 复跑回绿）：
 *   ① 适配器改回读扁平字段 ⇒ 今日/门店指标用例点名 0/undefined
 *   ② 接口 reject 映射为空数组 ⇒ 空态/失败态用例红
 *   ③ 门店工作台绕开共享适配器 ⇒ 结构负断言红
 *   ④ 入口改回 /customer/members ⇒ 路由用例红
 *
 * 运行（工作树根目录）：
 *   node admin-web/tests/dashboard-countertest.mjs --out <中央证据目录>
 *
 * 产物（WORKBENCH-07F1 起）：
 *   - 显式 `--out <dir>` ⇒ 写该绝对路径（相对路径按当前 cwd 解析为绝对路径）；
 *   - 未显式给 `--out` ⇒ 只写系统临时目录（可重复执行，不留痕）；
 *   - **绝不写代码仓**：内置守卫在写入前拒收任何落在仓库工作树内的 --out，
 *     并由 `dashboard-contract.spec.mjs` 的静态负断言守住"源码不得再出现仓库内证据路径"。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.resolve(path.join(WEB, ".."));
const SRC = path.join(WEB, "src");

/** 解析 --out <dir> / --out=<dir>；未给则空串 */
function parseOutArg(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") return argv[i + 1] ?? "";
    if (argv[i].startsWith("--out=")) return argv[i].slice("--out=".length);
  }
  return "";
}

const OUT_RAW = parseOutArg(process.argv.slice(2));
const OUT_IS_TMP = OUT_RAW.length === 0;
const OUT = OUT_IS_TMP
  ? path.join(os.tmpdir(), "wen-ssystem-mutation", "WORKBENCH-07F1", "redtest")
  : path.resolve(OUT_RAW); // 绝对路径解析：相对路径一律按 cwd 归一

// 红线守卫①：--out 绝不允许指向代码仓工作树内部
// （跨盘符时 path.relative 会返回目标绝对路径，故必须同时排除绝对路径结果）
const outRel = path.relative(REPO, path.resolve(OUT));
if (!outRel.startsWith("..") && !path.isAbsolute(outRel)) {
  throw new Error(`--out 不得指向代码仓内部：${OUT}（仓库根：${REPO}）`);
}
mkdirSync(OUT, { recursive: true });

const CONTRACT = path.join(SRC, "utils", "dashboard-contract.ts");
const DASH = path.join(SRC, "views", "dashboard", "Dashboard.vue");
const STORE = path.join(SRC, "views", "pos", "StoreDashboardView.vue");
const SPEC = path.join(WEB, "tests", "dashboard-contract.spec.mjs");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

/** 代码仓工作树的 git status --porcelain 行（不含空行） */
function repoDirty() {
  return execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

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

// 基线：mutation 前的工作树读数（守卫②的比对基准）
const dirtyBefore = repoDirty();
console.log(`工作树基线：git status --porcelain = ${dirtyBefore.length} 行`);

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

// ── 红线守卫②：收工自检，本装置不得让代码仓工作树的 git status 发生任何变化 ──
// （注入前 vs 复原后逐行比对：装置既不弄脏，也不顺手清理别人的东西）
const dirtyAfter = repoDirty();
const added = dirtyAfter.filter((l) => !dirtyBefore.includes(l));
const removed = dirtyBefore.filter((l) => !dirtyAfter.includes(l));
assert.deepEqual(added, [], `本装置弄脏了工作树：\n${added.join("\n")}`);
assert.deepEqual(removed, [], `工作树凭空少了行（装置越权清理）：\n${removed.join("\n")}`);

const md = [
  "# WORKBENCH-07F1 mutation 反测记录（四类）",
  "",
  "> 被测用例：`admin-web/tests/dashboard-contract.spec.mjs`",
  "> 装置：`admin-web/tests/dashboard-countertest.mjs`（注入 → 点名红 → 逐字节复原 SHA256 → 复跑回绿）",
  `> 输出目录（绝对路径）：\`${OUT}\`${OUT_IS_TMP ? "（未给 --out ⇒ 系统临时目录）" : "（--out 显式指定）"}`,
  `> 代码仓工作树：\`${REPO}\`（本装置不向其写入任何证据）`,
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
  "## 工作树洁净度（派单卡 §五-1）",
  "",
  `| 读数 | git status --porcelain |`,
  "|:--|--:|",
  `| mutation 运行前 | ${dirtyBefore.length} 行 |`,
  `| mutation 运行后 | ${dirtyAfter.length} 行 |`,
  `| 新增 / 减少 | ${added.length} / ${removed.length} |`,
  "",
  "## 复原后复跑",
  "",
  "```text",
  after.stdout.split("\n").filter((l) => l.startsWith("PASS") || l.startsWith("小结")).join("\n"),
  "```",
  "",
].join("\n");

const mdPath = path.join(OUT, "dashboard-countertest.md");
writeFileSync(mdPath, md);

console.log(`\n输出目录：${OUT}${OUT_IS_TMP ? "（默认系统临时目录）" : ""}`);
console.log(`证据已落盘：${mdPath}`);
console.log(`代码仓 git status --porcelain：运行前 ${dirtyBefore.length} 行 → 运行后 ${dirtyAfter.length} 行；新增 ${added.length} / 减少 ${removed.length}`);
console.log(`全部反测通过：${records.length}/${CASES.length} 点名变红 + ${records.length}/${CASES.length} SHA256 恒等 + 复原后回绿`);
