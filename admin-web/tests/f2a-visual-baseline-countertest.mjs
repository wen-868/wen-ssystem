/**
 * WORKBENCH-13-F2 · A 段视觉基线 mutation 反测装置（卡 §三.C.17：≥6 类，本次 15 类）
 *
 * 与 B 段 f2-func-styles-countertest.mjs 同构：把缺陷注回**真源 / 门禁纯函数 / 已入库读数**
 * 三种位置 → 断言点名那条 A 段契约用例变红 → 逐字节复原并校验 SHA256 恒等 → 全部复原后复跑回绿。
 * 「测试只认死证据」「门禁只认自己」两种偷懒都过不了：
 *
 *   N1 源码 rail 项改名              → S1
 *   N2 源码删掉新对话采集锚点        → S2
 *   N3 门禁 findRailCount 恒放行     → G1
 *   N4 门禁 findNewChatPlacement 阉 → G2
 *   N5 门禁 findAccountNotPinned 阉 → G4
 *   N6 门禁 findOrderViolations 阉   → G5
 *   N7 汇总 collectViolationsF2A 阉 → G8
 *   F8 伪造读数：rail 第 4 项宽度    → R2
 *   F1 伪造读数：rail 少一项         → R1
 *   F2 伪造读数：选中态底色偏一蓝    → R4
 *   F4 伪造读数：新对话挪去别处      → P3
 *   F5 伪造读数：搜索框默认就绘制    → P4
 *   F6 伪造读数：账号区浮起          → P6
 *   F7 伪造读数：KPI 沉到队列之下    → B1
 *   F8 伪造读数：并排图高度不齐      → V2
 *
 * （下表与 CASES 一一对应：rail 几何伪读数为 F3，并排图高度为 F8。）
 *
 * 运行（必须显式给输出目录，避免把中间产物写进工作树而破坏 clean）：
 *   node admin-web/tests/f2a-visual-baseline-countertest.mjs <outDir>
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");

const TARGETS = {
  nav: path.join(WEB, "src", "shared", "workbench", "prototype-nav.ts"),
  subnav: path.join(WEB, "src", "layouts", "WorkbenchSubnav.vue"),
  gate: path.join(WEB, "tests", "f2a-visual-baseline-lib.mjs"),
  fixture: path.join(WEB, "tests", "fixtures", "f2a-visual-measures.json"),
};

const SPEC = path.join(WEB, "tests", "f2a-visual-baseline.spec.mjs");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!OUT) {
  console.error("必须显式传入证据输出目录（默认写进工作树会破坏 clean）：node tests/f2a-visual-baseline-countertest.mjs <outDir>");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const sha256 = (b) => createHash("sha256").update(b).digest("hex").toUpperCase();

function runSpec() {
  try {
    const out = execFileSync(process.execPath, [SPEC], { cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/** 文本注入点必须存在，否则说明源已漂移，反测本身失效 */
function patch(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  assert.ok(norm.includes(f), `${id}: 注入点未找到 → ${f.slice(0, 90)}`);
  return norm.replace(f, to.replace(/\r\n/g, "\n"));
}

/** 读数伪造：A 段基线视口的实现侧读数在 JSON 里序列化了三份同值副本，逐份同步篡改 */
function falsifyReadout(json, mutate, id) {
  const bundle = JSON.parse(json);
  const base = bundle.viewports?.["1440x1000"];
  assert.ok(base, `${id}: 证据里缺 1440x1000 基线视口`);
  mutate(base, bundle);
  return JSON.stringify(bundle, null, 2);
}

const CASES = [
  {
    id: "N1-rail-label-source-drift",
    title: "源码 rail 项改名（一级栏文案偏离卡面 12 项）",
    target: TARGETS.nav,
    mutate: (t) => patch(t, `label: "即时零售", title: "即时零售"`, `label: "零售X", title: "即时零售"`, "N1"),
    expect: "S1",
  },
  {
    id: "N2-newchat-anchor-removed",
    title: "源码删掉新对话采集锚点（读数将无从锚定）",
    target: TARGETS.subnav,
    mutate: (t) => patch(t, `data-testid="second-nav-new-chat"`, `data-testid="second-nav-new-chat-removed"`, "N2"),
    expect: "S2",
  },
  {
    id: "N3-railcount-gate-neutered",
    title: "门禁失效：findRailCount 恒放行（12 项塌陷不再判红）",
    target: TARGETS.gate,
    mutate: (t) =>
      patch(
        t,
        '  if (missing.length > 0) out.push({ reason: `实现缺项：${missing.join("/")}` });\n  return out;',
        '  if (missing.length > 0) out.push({ reason: `实现缺项：${missing.join("/")}` });\n  return [];',
        "N3",
      ),
    expect: "G1",
  },
  {
    id: "N4-newchat-gate-neutered",
    title: "门禁失效：findNewChatPlacement 恒放行（新对话错位不再判红）",
    target: TARGETS.gate,
    mutate: (t) =>
      patch(
        t,
        `export function findNewChatPlacement(newChat, segBar) {
  const out = [];`,
        `export function findNewChatPlacement(newChat, segBar) {
  const out = [];
  if (newChat && segBar) return out;`,
        "N4",
      ),
    expect: "G2",
  },
  {
    id: "N5-account-gate-neutered",
    title: "门禁失效：findAccountNotPinned 恒放行（账号区浮起不再判红）",
    target: TARGETS.gate,
    mutate: (t) =>
      patch(
        t,
        `export function findAccountNotPinned(acct, viewportHeight) {
  if (!acct || acct.exists !== true) return [{ reason: "账号区不存在" }];`,
        `export function findAccountNotPinned(acct, viewportHeight) {
  if (acct) return [];
  if (!acct || acct.exists !== true) return [{ reason: "账号区不存在" }];`,
        "N5",
      ),
    expect: "G4",
  },
  {
    id: "N6-order-gate-neutered",
    title: "门禁失效：findOrderViolations 恒放行（乱序不再判红）",
    target: TARGETS.gate,
    mutate: (t) =>
      patch(
        t,
        `  if (sorted.join(">") === want.join(">")) return [];
  return [{ expected: want.join(" > "), actual: sorted.join(" > ") }];`,
        `  if (sorted.join(">") === want.join(">")) return [];
  return [];`,
        "N6",
      ),
    expect: "G5",
  },
  {
    id: "N7-aggregate-gate-neutered",
    title: "门禁失效：collectViolationsF2A 恒返回空（A 段整套判红被掏空）",
    target: TARGETS.gate,
    mutate: (t) =>
      patch(
        t,
        `export function collectViolationsF2A(bundle = {}) {
  const out = [];`,
        `export function collectViolationsF2A(bundle = {}) {
  const out = [];
  if (bundle) return out;`,
        "N7",
      ),
    expect: "G8",
  },
  {
    id: "F1-forged-rail-item-dropped",
    title: "伪造读数：生产态一级栏被删到 11 项",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyReadout(t, (base) => {
        base.implRail.items.splice(4, 1);
      }, "F1"),
    expect: "R1",
  },
  {
    id: "F2-forged-selected-color",
    title: "伪造读数：选中态底色从 235 偏到 236（色差一档冒充一致）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyReadout(t, (base) => {
        base.implRail.selected.backgroundColor = "rgb(37, 99, 236)";
      }, "F2"),
    expect: "R4",
  },
  {
    id: "F3-forged-rail-geometry",
    title: "伪造读数：rail 第 4 项宽度被写成 52px（超容差 6px）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyReadout(t, (base) => {
        base.implRail.items[3].metrics.width = 52;
      }, "F3"),
    expect: "R2",
  },
  {
    id: "F4-forged-newchat-row",
    title: "伪造读数：新对话控件挪到 y=700（离开员工/对话横栏）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyReadout(t, (base) => {
        for (const side of [base.implementation, base.impl]) if (side?.newChat) side.newChat.metrics.y = 700;
      }, "F4"),
    expect: "P3",
  },
  {
    id: "F5-forged-search-painted",
    title: "伪造读数：搜索框默认即绘制（原型态应为 display:none）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyReadout(t, (base) => {
        for (const side of [base.implementation, base.impl]) {
          if (!side?.search) continue;
          side.search.visible = true;
          side.search.metrics.display = "block";
          side.search.metrics.width = 201;
          side.search.metrics.height = 34;
        }
      }, "F5"),
    expect: "P4",
  },
  {
    id: "F6-forged-account-float",
    title: "伪造读数：账号区底边浮到 942（未贴视口底 1000）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyReadout(t, (base) => {
        for (const side of [base.implementation, base.impl]) if (side?.acct) side.acct.metrics.y = 884;
      }, "F6"),
    expect: "P6",
  },
  {
    id: "F7-forged-body-order",
    title: "伪造读数：KPI 区沉到动作队列之下（主面区块顺序被打乱）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyReadout(t, (base) => {
        for (const side of [base.implementation, base.impl, base.implBody]) if (side?.kpis) side.kpis.metrics.y = 900;
      }, "F7"),
    expect: "B1",
  },
  {
    id: "F8-forged-sidebyside-height",
    title: "伪造读数：并排图两侧高度比写成 0.97（拿不同视口硬拼）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyReadout(t, (base) => {
        base.sideBySide.heightMatch = 0.97;
      }, "F8"),
    expect: "V2",
  },
];

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
  // 源文件保持工作树既有换行（CRLF 文件注入后仍按 CRLF 写回；采集端 JSON 为 LF 口径）
  const wantCRLF = original.includes(0x0d);
  const bytes = wantCRLF ? mutated.replace(/\n/g, "\r\n") : mutated;
  writeFileSync(c.target, bytes);
  const injectedHash = sha256(readFileSync(c.target));

  const r = runSpec();
  const fails = r.out.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = fails.some((l) => l.includes(c.expect));

  writeFileSync(c.target, original);
  const restoredHash = sha256(readFileSync(c.target));

  console.log(`\n[反测 ${c.id}] ${c.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  点名变红 ${c.expect}：${named ? "是" : "否"}（FAIL ${fails.length} 条：${fails.map((f) => f.slice(0, 46)).join(" | ") || "无"}）`);
  console.log(`  复原 SHA256 恒等：${restoredHash === originalHash ? "是" : "否"}（${restoredHash.slice(0, 12)}…）`);

  assert.ok(named, `${c.id}：注入缺陷后 ${c.expect} 没有变红 ⇒ 契约测试是装饰`);
  assert.equal(restoredHash, originalHash, `${c.id}：复原后 SHA256 与基线不一致`);
  records.push({
    id: c.id,
    title: c.title,
    target: path.relative(WEB, c.target).replace(/\\/g, "/"),
    baselineSha256: originalHash,
    injectedSha256: injectedHash,
    restoredSha256: restoredHash,
    restoreIdentical: restoredHash === originalHash,
    expectCase: c.expect,
    namedRed: named,
    failLines: fails,
    specExitWhileMutated: r.code,
  });
}

const green = runSpec();
console.log(`\n复原后复跑（应绿）：EXIT=${green.code}`);
console.log(green.out.split("\n").filter((l) => l.startsWith("小结") || l.startsWith("FAIL")).join("\n"));
assert.equal(green.code, 0, "复原后必须回绿");

const redCount = records.filter((r) => r.namedRed && r.restoreIdentical).length;
const lines = [
  "# WORKBENCH-13-F2 · A 段视觉基线 mutation 反测记录",
  "",
  `- 卡 §三.C.17 要求：≥6 类视觉 mutation 点名变红 + SHA256 复原 + 复跑回绿。本次 **${records.length} 类**（源码 2 · 门禁函数 5 · 入库读数 8），全部点名变红并复原恒等：**${redCount}/${records.length}**。`,
  `- 基线复跑：EXIT=0（绿）；全部复原后复跑：EXIT=0（绿）。`,
  `- 专项测试：${green.out.split("\n").find((l) => l.startsWith("小结")) ?? "-"}`,
  "",
  "| # | 注入的缺陷 | 目标文件 | 点名用例 | 变红 | 注入后 SHA256 | 复原恒等 |",
  "| - | ---------- | -------- | -------- | ---- | ------------- | -------- |",
  ...records.map(
    (r) =>
      `| ${r.id} | ${r.title} | ${r.target} | ${r.expect} | ${r.namedRed ? "✔" : "✗"} | ${r.injectedSha256.slice(0, 16)}… | ${r.restoreIdentical ? "✔" : "✗"} |`,
  ),
  "",
  "## 逐条 FAIL 原文（截取）",
  "",
  ...records.flatMap((r) => [`- **${r.id}**（spec EXIT=${r.specExitWhileMutated}）`, ...r.failLines.map((l) => `  \`${l.trim()}\``)]),
  "",
  `生成时间：${new Date().toISOString()}`,
  "",
];
const md = `${lines.join("\n")}`;
writeFileSync(path.join(OUT, "f2a-mutation-record.md"), md, "utf8");
writeFileSync(
  path.join(OUT, "f2a-mutation-record.json"),
  `${JSON.stringify({ schema: "wb13-f2a-mutation/v1", generatedAt: new Date().toISOString(), cases: records, baselineGreen: true, restoredGreen: true }, null, 2)}\n`,
  "utf8",
);
console.log(`\n全部反测通过：${redCount}/${records.length} 点名变红 + ${redCount}/${records.length} SHA256 恒等 + 复原后回绿`);
console.log(`记录 → ${path.join(OUT, "f2a-mutation-record.md")}`);
