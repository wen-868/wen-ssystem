/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · Mutation 反测装置（M1-M10）
 *
 * 纪律（对齐 prototype-nav-countertest.mjs / 卡面 §三.6）：
 *   1. 基线先绿（prototype12-mutation-gates.mjs 全绿）；
 *   2. 每次单点注入真实缺陷 → 跑门禁断言**点名红**；
 *   3. 逐字节复原（SHA256 before==after，恒等）；
 *   4. 复跑同门禁回绿；
 *   5. 收工自检：git status 不因本装置新增/减少任何行（不入库、不留痕）。
 *
 * 运行（worktree 根）：
 *   node admin-web/e2e/prototype12-mutation.mjs --out <中央证据目录>/mutations
 *   （未给 --out ⇒ 系统临时目录，可重复执行不留痕）
 *
 * 门禁映射（对齐 regression-matrix M1-M10 expected_red → prototype12-mutation-gates.mjs）：
 *   M1 → R11 copy blacklist   → gates[0] AiFeedView 可见模板黑名单
 *   M2 → R05 真实数据 + R11    → gates[1] 任务中心演示员工
 *   M3 → R09 集合差值          → gates[2] quickEntry = entries
 *   M4 → R10 fail-closed      → gates[3] 菜单 error 态 fail-closed
 *   M5 → R11 + 导航可达性      → gates[4] planProductionSubnav 过滤 pending
 *   M6 → R01/R02/R04          → gates[5] 收起条/展开/收起按钮齐全
 *   M7 → R05/R08              → gates[6] 顶部计数走 counts 派生
 *   M8 → R03                  → gates[7] AiChatPanel 无第二输入
 *   M9 → R06                  → gates[8] confirmations items 分支
 *   M10 → R13                 → gates[9] router-view 真实渲染点无条件
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, "..");
const REPO = path.resolve(WEB, "..");
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
  ? path.join(os.tmpdir(), "wen-ssystem-mutation", "PROTOTYPE12-S5", "redtest")
  : path.resolve(OUT_RAW);

// 红线守卫①：--out 绝不允许指向代码仓工作树内部
const outRel = path.relative(REPO, path.resolve(OUT));
if (!outRel.startsWith("..") && !path.isAbsolute(outRel)) {
  throw new Error(`--out 不得指向代码仓内部：${OUT}（仓库根：${REPO}）`);
}
mkdirSync(OUT, { recursive: true });

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

/** 代码仓工作树的 git status --porcelain 行（不含空行） */
function repoDirty() {
  return execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** 在归一化(LF)文本中定位并替换；找不到即抛错（保证 mutation 真生效） */
function patch(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  assert.ok(norm.includes(f), `${id}: 注入点未找到 → ${f.slice(0, 100)}`);
  return norm.replace(f, to.replace(/\r\n/g, "\n"));
}

/** 按原文件行尾风格写回（本仓 .vue 为 CRLF、.ts 为 LF，写错会让工作树凭空变脏） */
function writeKeepingEol(file, originalText, newText) {
  const crlf = originalText.includes("\r\n");
  writeFileSync(file, crlf ? newText.replace(/\n/g, "\r\n") : newText);
}

/** 门禁 runner：跑 mutation gates 脚本（自建精确断言），返回 { code, stdout } */
function runGates() {
  const gatesPath = path.join(here, "prototype12-mutation-gates.mjs");
  try {
    const stdout = execFileSync(process.execPath, [gatesPath], {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/**
 * M1-M10 注入定义。
 * target: 注入文件（相对 SRC）
 * mutate: (text) => mutated —— 必须真改（断言注入生效）
 * redContains: 注入后 gates 的 FAIL 点名行必须包含其中至少一个 token
 * greenNote: 复原后 gates 必须全绿（exit 0）
 */
const CASES = [
  {
    id: "M1",
    title: "恢复「双入口左侧菜单」设计说明块（AiFeedView 产品可见模板）",
    target: "components/workbench/AiFeedView.vue",
    mutate: (t) =>
      patch(
        t,
        `<div class="fdv-name" data-testid="daily-op-title">日常经营</div>`,
        `<div class="fdv-name" data-testid="daily-op-title">日常经营</div>
        <div data-testid="mut-m1">双入口左侧菜单 = 人工操作入口 · 底部对话框 = AI 智能入口</div>`,
        "M1",
      ),
    redContains: ["双入口左侧菜单"],
    redNote: "R11 copy blacklist（AiFeedView 产品可见模板命中「双入口左侧菜单」）",
  },
  {
    id: "M2",
    title: "任务中心右栏硬编码原型演示员工（红星商行/张三/王强）",
    target: "components/workbench/WorkbenchTaskCenter.vue",
    mutate: (t) =>
      patch(
        t,
        `const VIEW_KEY = "wb.task-center.view";`,
        `const VIEW_KEY = "wb.task-center.view";
// MUTATION-M2：右栏硬编码原型演示员工（R05 真实数据 + R11 黑名单必须红）
const M2_DEMO_STAFF = ["红星商行 王强", "张三", "李四"];`,
        "M2",
      ),
    redContains: ["红星商行"],
    redNote: "R05 真实数据 + R11 黑名单（任务中心含原型演示员工）",
  },
  {
    id: "M3",
    title: "rail 与 subnav 各自裁剪，破坏唯一集合（quickEntry 不再=集合）",
    target: "shared/workbench/effective-capabilities.ts",
    mutate: (t) =>
      patch(
        t,
        `  const quickEntry = entries;`,
        `  const quickEntry = entries.filter((entry) => entry.groupCode === "wb.finance"); // MUTATION-M3`,
        "M3",
      ),
    redContains: ["quickEntry 不再 = entries 全量"],
    redNote: "R09 集合差值（quickEntry ≠ entries 全量）",
  },
  {
    id: "M4",
    title: "绕过服务端菜单交集：菜单失败回退全量（不 fail-closed）",
    target: "shared/workbench/effective-capabilities.ts",
    mutate: (t) =>
      patch(
        t,
        `  if (input.menuState === "error") {
    return emptySnapshot(
      "menu-error",
      "菜单服务不可用：已按最小可见集处理（不回退全量菜单），请重试或联系管理员",
    );
  }`,
        `  if (input.menuState === "error") {
    // MUTATION-M4：菜单失败回退全量（不 fail-closed）——必须被 R10 点名红
    return {
      ok: true,
      failReason: null,
      notice: "MUTATION-M4 回退全量",
      routeNames: new Set(ALL_MANIFEST_ITEMS.map((item) => item.routeName).filter(Boolean) as string[]),
      entries: [],
      rail: [],
      subnav: [],
      quickEntry: [],
      quickCommands: [],
      ai: [],
      taskCenter: [],
      diagnostics: { serverMenuCount: 0, unmappedMenuCodes: [], unroutableRouteNames: [], trimmedRouteNames: [], restricted: true },
    };
  }`,
        "M4",
      ),
    redContains: ["error 分支不再 emptySnapshot"],
    redNote: "R10 fail-closed（菜单 error 不再 emptySnapshot menu-error + 不回退全量）",
  },
  {
    id: "M5",
    title: "恢复 pending 待接入卡：planProductionSubnav 返回原型未接线目录项",
    target: "shared/workbench/prototype-nav.ts",
    mutate: (t) =>
      patch(
        t,
        `    if (entry.status !== "wired" || entry.item === null) continue;`,
        `    if (entry.item === null) continue; // MUTATION-M5：恢复 pending 待接入卡（未接线目录项也返回）`,
        "M5",
      ),
    redContains: ["不再过滤未接线"],
    redNote: "R11 + 导航可达性（planProductionSubnav 不再过滤未接线/pending 目录项）",
  },
  {
    id: "M6",
    title: "移除任务中心收起交互（收起条/展开/收起按钮缺一）",
    target: "components/workbench/WorkbenchTaskCenter.vue",
    mutate: (t) =>
      patch(
        t,
        `data-testid="task-center-collapse"`,
        `data-testid="task-center-collapse-mutated"`,
        "M6",
      ),
    redContains: ["缺收起交互控件"],
    redNote: "R01/R02/R04（收起交互控件缺失）",
  },
  {
    id: "M7",
    title: "任务中心顶部计数用固定 0（不读真实源）",
    target: "components/workbench/WorkbenchTaskCenter.vue",
    mutate: (t) =>
      patch(
        t,
        `const activeTotal = computed<number | null>(() => {`,
        `const activeTotal = computed<number | null>(() => {
  return 0; // MUTATION-M7：固定 0（R05/R08 必须红：不显示假 0）`,
        "M7",
      ),
    redContains: ["顶部计数固定 0"],
    redNote: "R05/R08（顶部计数固定 0 / 脱离 deriveTaskCenterCounts）",
  },
  {
    id: "M8",
    title: "恢复 feed/chat 双入口或双输入框（AiChatPanel 增加第二文本输入）",
    target: "components/workbench/AiChatPanel.vue",
    mutate: (t) =>
      patch(
        t,
        `<template>`,
        `<template>
  <!-- MUTATION-M8：恢复第二输入框（R03 输入计数=1 必须红） -->
  <input type="text" data-testid="mut-m8-input" placeholder="第二输入" />`,
        "M8",
      ),
    redContains: ["AiChatPanel 出现第二套输入控件"],
    redNote: "R03（AiChatPanel 出现第二套输入控件）",
  },
  {
    id: "M9",
    title: "confirmations 只读 confirmations 键，不读 items（现行底座形态解析失败）",
    target: "shared/workbench/task-center.ts",
    mutate: (t) =>
      patch(
        t,
        `    if (Array.isArray(payload.items)) {
      // 现行底座契约：{ total, items }（chat.controller.ts:256）
      const reportedTotal = typeof payload.total === "number" ? payload.total : null;
      return fromRows(payload.items, "items", reportedTotal);
    }`,
        `    // MUTATION-M9：只认 confirmations 键，不读 items（现行 {total,items} 形态归 unknown）
    // (fromRows 的 items 分支被移除)`,
        "M9",
      ),
    redContains: ["confirmations 解析不再读 items 键"],
    redNote: "R06（confirmations 解析不再读 items 键）",
  },
  {
    id: "M10",
    title: "任务中心异常时条件渲染 router-view（AI 故障时人工页不可用）",
    target: "layouts/WorkbenchShell.vue",
    mutate: (t) =>
      patch(
        t,
        `          <router-view />`,
        `          <router-view v-if="!taskCenterCollapsed" /> <!-- MUTATION-M10：任务中心异常时人工页被条件渲染 -->`,
        "M10",
      ),
    redContains: ["router-view 渲染点被条件渲染包裹"],
    redNote: "R13（router-view 渲染点被条件渲染包裹）",
  },
];

// ── 基线：mutation 前的工作树读数（守卫②比对基准）──
const dirtyBefore = repoDirty();
console.log(`工作树基线：git status --porcelain = ${dirtyBefore.length} 行`);
for (const l of dirtyBefore) console.log(`  ${l}`);

const originals = new Map();
for (const item of CASES) {
  const f = path.join(SRC, item.target);
  originals.set(item.target, readFileSync(f));
}
console.log("基线 SHA256：");
for (const [rel, buf] of originals) console.log(`  ${path.basename(rel)} = ${sha256(buf)}`);

// 基线复跑：gates 必须全绿（exit 0）
const baseOut = runGates();
console.log(`基线门禁 prototype12-mutation-gates.mjs：EXIT=${baseOut.code} ${baseOut.code === 0 ? "✅" : "❌"}`);
assert.equal(baseOut.code, 0, "基线门禁必须全绿（gates 脚本基线 FAIL 说明候选基线存在缺陷，先记缺陷再修）");

const records = [];
for (const item of CASES) {
  const original = originals.get(item.target);
  const originalText = original.toString("utf8");
  const originalHash = sha256(original);
  const mutated = item.mutate(originalText);
  assert.notEqual(mutated, originalText.replace(/\r\n/g, "\n"), `${item.id}: 注入未生效`);
  writeKeepingEol(path.join(SRC, item.target), originalText, mutated);
  const injectedHash = sha256(readFileSync(path.join(SRC, item.target)));

  const redOut = runGates();
  const failedLines = redOut.stdout.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = item.redContains.some((token) => failedLines.some((l) => l.includes(token)));
  const allRed = redOut.code !== 0;

  console.log(`\n[反测 ${item.id}] ${item.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  EXIT=${redOut.code}；FAIL=${failedLines.length}；点名「${item.redContains.join(" / ")}」=${named}`);
  for (const l of failedLines) console.log(`  ${l}`);

  writeFileSync(path.join(SRC, item.target), original);
  const restoredHash = sha256(readFileSync(path.join(SRC, item.target)));
  console.log(`  复原 SHA256 = ${restoredHash}；恒等=${restoredHash === originalHash}`);

  const greenOut = runGates();
  const greenAllOk = greenOut.code === 0;
  console.log(`  复原后复跑 EXIT=${greenOut.code} ${greenAllOk ? "✅" : "❌"}`);

  records.push({
    id: item.id,
    title: item.title,
    target: item.target,
    redNote: item.redNote,
    injectedHash,
    originalHash,
    restoredHash,
    restoredIdentical: restoredHash === originalHash,
    exitCode: redOut.code,
    failedCount: failedLines.length,
    named,
    allRed,
    greenExitCode: greenOut.code,
    greenAllOk,
    failedLines,
  });

  assert.ok(allRed, `${item.id}: 注入后必须变红（门禁非 0）`);
  assert.ok(named, `${item.id}: 未点名「${item.redContains.join(" / ")}」`);
  assert.ok(records.at(-1).restoredIdentical, `${item.id}: 复原 SHA256 必须恒等`);
  assert.ok(greenAllOk, `${item.id}: 复原后必须回绿`);
}

// ── 红线守卫②：收工自检，本装置不得让代码仓工作树的 git status 发生任何变化 ──
const dirtyAfter = repoDirty();
const added = dirtyAfter.filter((l) => !dirtyBefore.includes(l));
const removed = dirtyBefore.filter((l) => !dirtyAfter.includes(l));
assert.deepEqual(added, [], `本装置弄脏了工作树：\n${added.join("\n")}`);
assert.deepEqual(removed, [], `工作树凭空少了行（装置越权清理）：\n${removed.join("\n")}`);

writeFileSync(
  path.join(OUT, "redtest.md"),
  [
    "# WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · Mutation 反测记录（M1-M10）",
    "",
    "> 装置：`admin-web/e2e/prototype12-mutation.mjs`（注入 → 点名红 → 逐字节复原 SHA256 → 复跑回绿）",
    "> 门禁：`admin-web/e2e/prototype12-mutation-gates.mjs`（源码精确断言，允许路径内自建）",
    `> 输出目录（绝对路径）：\`${OUT}\`${OUT_IS_TMP ? "（未给 --out ⇒ 系统临时目录）" : "（--out 显式指定）"}`,
    `> 代码仓工作树：\`${REPO}\`（本装置不向其写入任何证据；注入文件逐字节复原）`,
    `> 运行时刻：${new Date().toISOString()}`,
    "",
    "| M | 目标 | 注入 | 门禁点名 | EXIT | FAIL | 点名 | 复原恒等 | 复跑回绿 |",
    "|:--|:--|:--|:--|--:|--:|:--:|:--:|:--:|",
    ...records.map(
      (r) =>
        `| ${r.id} | \`${r.target}\` | ${r.title} | ${r.redNote} | ${r.exitCode} | ${r.failedCount} | ${r.named ? "✅" : "❌"} | ${r.restoredIdentical ? "✅" : "❌"} | ${r.greenAllOk ? "✅" : "❌"} |`,
    ),
    "",
    "## 逐条 FAIL 原文（注入后）",
    "",
    ...records.flatMap((r) => [`### ${r.id}（${r.title}）`, "", "```text", ...r.failedLines, "```", ""]),
    "## 工作树洁净度",
    "",
    "| 读数 | git status --porcelain |",
    "|:--|--:|",
    `| mutation 运行前 | ${dirtyBefore.length} 行 |`,
    `| mutation 运行后 | ${dirtyAfter.length} 行 |`,
    `| 新增行 | ${added.length} |`,
    `| 减少行 | ${removed.length} |`,
    "",
    "## 基线门禁状态",
    "",
    `- \`prototype12-mutation-gates.mjs\`：基线 EXIT=${baseOut.code} ${baseOut.code === 0 ? "✅" : "❌"}`,
    "",
  ].join("\n"),
);

writeFileSync(path.join(OUT, "redtest.json"), `${JSON.stringify(records, null, 2)}\n`);

const passed = records.filter((r) => r.named && r.restoredIdentical && r.allRed && r.greenAllOk).length;
console.log(
  `\n小结：${passed}/${CASES.length} 点名变红 + ${records.filter((r) => r.restoredIdentical).length}/${CASES.length} SHA256 恒等 + 复跑回绿`,
);
console.log(`证据目录：${OUT}`);
