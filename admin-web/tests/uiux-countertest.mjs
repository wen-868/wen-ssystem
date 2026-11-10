/**
 * WORKBENCH-13-F1 · mutation 反测装置（卡 §三.3：9 类，≥6）
 *
 * 缺陷逐条注入 → 断言**点名变红** → 逐字节复原 SHA256 恒等 → 复跑回绿：
 *   M1 modal 双开         ：把「先关设置中心」删掉，退回模态双开            → B1
 *   M2 空态覆盖页面        ：删掉业务页豁免（空态重新污染业务页）             → A1
 *   M3 深链接隐藏          ：effectiveMode 去掉 isManualBusinessRoute        → C1
 *   M4 假 live 状态        ：把注入 isDev 门去掉（注入可当生产可达）          → E1
 *   M5 错误禁用态          ：删掉「未命中给可重试告警」，静默失败              → D3
 *   M6 首击骨架缺失        ：删掉 railSkeletons（首击重新落空）               → D1
 *   M7 假可点击语义        ：回插 aria-disabled=true（凌舟驳回 §四.4 回归位）  → D2
 *   M8 门禁失效            ：findDuplicateHashes 恒返回空（重复平图不判红）    → F3
 *   M9 告警不可见          ：删掉 main.ts 的 ElMessage 样式引入（提示掉到屏外） → D4
 *
 * 运行（必须显式给证据目录，避免把中间产物写进工作树而破坏 clean）：
 *   node admin-web/tests/uiux-countertest.mjs <outDir>
 *   例：node admin-web/tests/uiux-countertest.mjs <central>/projects/ms/evidence/WORKBENCH-13-WORKBENCH-UIUX-COMPLETE-01-F1/mutation
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

const TARGETS = {
  shell: path.join(SRC, "layouts", "WorkbenchShell.vue"),
  inject: path.join(SRC, "shared", "workbench", "wb-uiux-injection.ts"),
  gate: path.join(WEB, "tests", "uiux-scenarios-lib.mjs"),
  main: path.join(SRC, "main.ts"),
};

const SPEC = path.join(WEB, "tests", "uiux-complete.spec.mjs");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!OUT) {
  console.error("必须显式传入证据输出目录（默认写进工作树会破坏 clean）：node tests/uiux-countertest.mjs <outDir>");
  process.exit(2);
}
const sha256 = (b) => createHash("sha256").update(b).digest("hex").toUpperCase();

function runSpec() {
  try {
    const out = execFileSync(process.execPath, [SPEC], { cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function patch(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  assert.ok(norm.includes(f), `${id}: 注入点未找到 → ${f.slice(0, 90)}`);
  return norm.replace(f, to.replace(/\r\n/g, "\n"));
}

const CASES = [
  {
    id: "M1-modal-double-open",
    title: "modal 双开：删掉「先关设置中心」，退回只开打印弹层",
    target: TARGETS.shell,
    mutate: (t) =>
      patch(
        t,
        `function openPrintSettingsFromCenter(): void {
  settingsCenterVisible.value = false;
  nextTick(() => {
    printSettingsVisible.value = true;
  });
}`,
        `function openPrintSettingsFromCenter(): void {
  printSettingsVisible.value = true;
}`,
        "M1",
      ),
    expect: "B1",
  },
  {
    id: "M2-empty-covers-page",
    title: "空态覆盖页面：删掉业务页豁免",
    target: TARGETS.shell,
    mutate: (t) =>
      patch(
        t,
        `  // 关键豁免：当前路由是一个真实人工业务页 ⇒ 页面优先，空态让位
  if (isManualBusinessRoute.value) return false;
  return true;`,
        `  return true;`,
        "M2",
      ),
    expect: "A1",
  },
  {
    id: "M3-deeplink-hidden",
    title: "深链接隐藏：effectiveMode 退回只认 /pos",
    target: TARGETS.shell,
    mutate: (t) =>
      patch(
        t,
        `const effectiveMode = computed<WorkbenchMode>(() =>
  isCashierRoute.value || isManualBusinessRoute.value ? "human" : workbenchMode.value,
);`,
        `const effectiveMode = computed<WorkbenchMode>(() =>
  isCashierRoute.value ? "human" : workbenchMode.value,
);`,
        "M3",
      ),
    expect: "C1",
  },
  {
    id: "M4-fake-live-injection",
    title: "假 live 状态：去掉 isDev 门（注入可当生产可达）",
    target: TARGETS.inject,
    mutate: (t) =>
      patch(
        t,
        `  if (!input.isDev) {
    return { active: false, reason: "生产构建（import.meta.env.DEV=false）不开放测试注入" };`,
        `  if (false) {
    return { active: false, reason: "生产构建（import.meta.env.DEV=false）不开放测试注入" };`,
        "M4",
      ),
    expect: "E1",
  },
  {
    id: "M5-silent-failure",
    title: "错误禁用态：删掉未命中告警，静默失败",
    target: TARGETS.shell,
    mutate: (t) =>
      patch(
        t,
        `  // 加载完成但该组不可见：明确告知并可重试（不静默、不伪造可见）
  ElMessage.warning("该模块当前账号无可见权限，请重试或联系管理员开通");`,
        `  // MUTATION-5：静默丢弃意图`,
        "M5",
      ),
    expect: "D3",
  },
  {
    id: "M6-no-rail-skeleton",
    title: "首击骨架缺失：删掉 railSkeletons（首击重新落空）",
    target: TARGETS.shell,
    mutate: (t) =>
      patch(
        t,
        `const railSkeletons = computed(() =>
  menuState.value === "loading" && railModules.value.length === 0
    ? decorateRailGroups(MANUAL_GROUPS)
    : [],
);`,
        `const railSkeletons = computed(() => []);`,
        "M6",
      ),
    expect: "D1",
  },
  {
    // 凌舟驳回 §四.4：骨架 aria-disabled=true 与「要求点击记录意图」自相矛盾；F1 已改为原生按钮语义
    id: "M7-aria-disabled-mask",
    title: "假可点击语义：把 aria-disabled=true 回插骨架（伪装不可点击却要求点击）",
    target: TARGETS.shell,
    mutate: (t) =>
      patch(
        t,
        `        data-rail-skeleton="true"
        :aria-busy=`,
        `        data-rail-skeleton="true"
        aria-disabled="true"
        :aria-busy=`,
        "M7",
      ),
    expect: "D2",
  },
  {
    // 卡 §三.5「重复平图机器判红」必须是**活的**判定，而不是只在报告里写一句
    id: "M8-gate-neutered",
    title: "门禁失效：findDuplicateHashes 恒返回空（重复平图不再判红）",
    target: TARGETS.gate,
    mutate: (t) =>
      patch(
        t,
        `  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ viewport: key.split("|")[0], sha256: key.split("|")[1], scenes: list }));`,
        `  return [];`,
        "M8",
      ),
    expect: "F3",
  },
  {
    // 三视口实测：不显式引入 message 样式 ⇒ .el-message 以静态块落到文档末尾（top=视口高），
    // 屏幕上根本看不见「可重试告警」，卡 §三.8 的不静默要求形同虚设。
    id: "M9-invisible-warning",
    title: "告警不可见：删掉 main.ts 的 ElMessage 样式引入（提示只在 DOM、不在屏幕）",
    target: TARGETS.main,
    mutate: (t) =>
      patch(
        t,
        `import "element-plus/es/components/message/style/css";\n`,
        ``,
        "M9",
      ),
    expect: "D4",
  },
];

/* 基线 */
const originals = new Map();
for (const f of Object.values(TARGETS)) originals.set(f, readFileSync(f));

console.log("基线 SHA256：");
for (const [f, b] of originals) console.log(`  ${path.basename(f)} = ${sha256(b)}`);

const base = runSpec();
console.log(`\n基线复跑（应绿）：EXIT=${base.code}`);
console.log(base.out.split("\n").filter((l) => l.startsWith("小结") || l.startsWith("FAIL")).join("\n"));
assert.equal(base.code, 0, "基线必须为绿");

const records = [];
for (const c of CASES) {
  const original = readFileSync(c.target);
  const originalHash = sha256(original);
  const mutated = c.mutate(original.toString("utf8"));
  writeFileSync(c.target, mutated.replace(/\n/g, "\r\n"));
  const injectedHash = sha256(readFileSync(c.target));

  const r = runSpec();
  const fails = r.out.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = fails.some((l) => l.includes(c.expect));

  console.log(`\n[反测 ${c.id}] ${c.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  EXIT=${r.code}；FAIL=${fails.length}；点名「${c.expect}」=${named}`);
  for (const l of fails) console.log(`  ${l}`);

  writeFileSync(c.target, original);
  const restored = sha256(readFileSync(c.target));
  console.log(`  复原 SHA256 = ${restored}；恒等=${restored === originalHash}`);

  records.push({
    id: c.id,
    title: c.title,
    target: path.relative(WEB, c.target).replace(/\\/g, "/"),
    exitCode: r.code,
    failedCount: fails.length,
    named,
    expect: c.expect,
    fails,
    injectedHash,
    originalHash,
    restoredHash: restored,
    restoredIdentical: restored === originalHash,
  });

  assert.ok(named, `${c.id}: 未点名「${c.expect}」`);
  assert.ok(records.at(-1).restoredIdentical, `${c.id}: 复原必须 SHA256 恒等`);
}

const after = runSpec();
console.log(`\n复原后复跑：EXIT=${after.code}`);
console.log(after.out.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(after.code, 0, "复原后必须回绿");

mkdirSync(OUT, { recursive: true });
const md = [
  "# WORKBENCH-13-F1 mutation 反测记录（9 类）",
  "",
  "> 被测用例：`admin-web/tests/uiux-complete.spec.mjs`（18 条）",
  "> 装置：`admin-web/tests/uiux-countertest.mjs`（注入 → 点名红 → 逐字节复原 SHA256 → 复跑回绿）",
  "",
  "| 反测 | 目标 | 注入缺陷 | FAIL | 点名 | 复原恒等 |",
  "|:--|:--|:--|--:|:--:|:--:|",
  ...records.map((r) => `| ${r.id} | \`${r.target}\` | ${r.title} | ${r.failedCount} | ${r.named ? "✅" : "❌"} | ${r.restoredIdentical ? "✅" : "❌"} |`),
  "",
  "## 逐条 FAIL 原文",
  "",
  ...records.flatMap((r) => [`### ${r.id}（${r.title}）`, "", "```text", ...r.fails, "```", ""]),
  "## SHA256 复原",
  "",
  "| 反测 | 基线 | 注入后 | 复原后 | 恒等 |",
  "|:--|:--|:--|:--|:--:|",
  ...records.map((r) => `| ${r.id} | \`${r.originalHash.slice(0, 16)}…\` | \`${r.injectedHash.slice(0, 16)}…\` | \`${r.restoredHash.slice(0, 16)}…\` | ${r.restoredIdentical ? "✅" : "❌"} |`),
  "",
  "## 复原后复跑",
  "",
  "```text",
  after.out.split("\n").filter((l) => l.startsWith("PASS") || l.startsWith("小结")).join("\n"),
  "```",
  "",
].join("\n");
writeFileSync(path.join(OUT, "uiux-countertest.md"), md);
console.log(`\n证据已落盘：${path.join(OUT, "uiux-countertest.md")}`);
console.log(`全部反测通过：${records.length}/${CASES.length} 点名变红 + ${records.length}/${CASES.length} SHA256 恒等 + 复原后回绿`);
