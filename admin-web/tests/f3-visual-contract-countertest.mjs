/**
 * WORKBENCH-13-F3 · 同状态/四区块/新壳通知契约 mutation 反测装置（卡 §三.D.15：≥4 类，本次 12 类）
 *
 * 与 f2a-visual-baseline-countertest.mjs 同构：把缺陷注回**真源 / 门禁纯函数 / 已入库读数**
 * 三种位置 → 断言点名那条 F3 契约用例变红 → 逐字节复原并校验 SHA256 恒等 → 全部复原后复跑回绿。
 *
 *   M1  源码摘掉 checkWebUpdate 接线          → C1
 *   M2  源码重试按钮解绑 @click               → B1
 *   M3  伪造签名：overlay 段 0→1              → A1
 *   M4  伪造读数：审批区块 exists=false        → B2
 *   M5  伪造读数：原型末检活跃模态 0→2         → A2
 *   M6  伪造读数：figcaption 不再签名          → A3
 *   M7  伪造登记：superseded 改回 current      → A4
 *   M8  伪造像素：本轮帧直接复用 F2 旧哈希     → A5
 *   M9  伪造读数：通知证据壳层 v2→mainlayout   → C2
 *   M10 伪造读数：旧壳兼容帧抹掉 compatRole    → C3
 *   M11 门禁失效：findNotifyShellF3 恒放行     → C4
 *   M12 伪造读数：生产态盖上注入标志           → A6
 *
 * 运行（必须显式给输出目录，避免把中间产物写进工作树而破坏 clean）：
 *   node tests/f3-visual-contract-countertest.mjs <outDir>
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
  shell: path.join(WEB, "src", "layouts", "WorkbenchShell.vue"),
  feed: path.join(WEB, "src", "components", "workbench", "AiFeedView.vue"),
  fgate: path.join(WEB, "tests", "f2-func-styles-lib.mjs"),
  afix: path.join(WEB, "tests", "fixtures", "f2a-visual-measures.json"),
  ffix: path.join(WEB, "tests", "fixtures", "f2-func-measures.json"),
};

const SPEC = path.join(WEB, "tests", "f3-visual-contract.spec.mjs");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!OUT) {
  console.error("必须显式传入证据输出目录（默认写进工作树会破坏 clean）：node tests/f3-visual-contract-countertest.mjs <outDir>");
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

/** A 段副本定点篡改（页钟停表读数在 viewports['1440x1000']，bundle 级字段在顶层） */
function mutateA(json, mutate, id) {
  const bundle = JSON.parse(json);
  const base = bundle.viewports?.["1440x1000"];
  assert.ok(base, `${id}: 证据里缺 1440x1000 基线视口`);
  mutate(base, bundle);
  const out = JSON.stringify(bundle, null, 2);
  assert.notEqual(out, json.replace(/\r\n/g, "\n"), `${id}: 篡改没有实际改变内容`);
  return out;
}

/** B 段副本定点篡改（逐场景读数） */
function mutateF(json, mutate, id) {
  const bundle = JSON.parse(json);
  assert.ok(Array.isArray(bundle.scenes) && bundle.scenes.length > 0, `${id}: 证据里没有场景读数`);
  mutate(bundle);
  const out = JSON.stringify(bundle, null, 2);
  assert.notEqual(out, json.replace(/\r\n/g, "\n"), `${id}: 篡改没有实际改变内容`);
  return out;
}

const CASES = [
  {
    id: "M1-shell-checkwebupdate-unwired",
    title: "源码摘掉新壳 checkWebUpdate 接线（通知回到只在旧壳跑的 F2 缺口）",
    target: TARGETS.shell,
    mutate: (t) => patch(t, "  if (shellEnabled) void checkWebUpdate();\n", "", "M1"),
    expect: "C1",
  },
  {
    id: "M2-taskstep-retry-unbound",
    title: "源码把任务步进重试按钮解绑（占位只剩死文案）",
    target: TARGETS.feed,
    mutate: (t) => patch(t, 'data-testid="wb-tf-retry" @click="refreshQueue"', 'data-testid="wb-tf-retry"', "M2"),
    expect: "B1",
  },
  {
    id: "M3-forged-signature-overlay",
    title: "伪造签名：存量原型签名 overlay 段 0→1（手写的签名不来自读数）",
    target: TARGETS.afix,
    mutate: (t) => mutateA(t, (base) => { base.stateSignature.prototype = String(base.stateSignature.prototype).replace("overlay=0", "overlay=1"); }, "M3"),
    expect: "A1",
  },
  {
    id: "M4-forged-approvals-dropped",
    title: "伪造读数：审批区块被「无数据即删块」摘掉（exists=false）",
    target: TARGETS.afix,
    mutate: (t) => mutateA(t, (base) => { base.implementation.approvals.exists = false; }, "M4"),
    expect: "B2",
  },
  {
    id: "M5-forged-prototype-modals",
    title: "伪造读数：原型末检活跃模态 0→2（setwin 没关也报绿）",
    target: TARGETS.afix,
    mutate: (t) => mutateA(t, (base) => { base.prototypeModals.finalActive = 2; }, "M5"),
    expect: "A2",
  },
  {
    id: "M6-forged-figcaption-unsigned",
    title: "伪造读数：并排图 figcaption 不再写状态签名",
    target: TARGETS.afix,
    mutate: (t) => mutateA(t, (base) => { base.sideBySide.signaturesPrinted = false; }, "M6"),
    expect: "A3",
  },
  {
    id: "M7-forged-superseded-reverted",
    title: "伪造登记：F2 未关弹层的旧并排帧改回 current（拿旧缺陷帧冒充本轮）",
    target: TARGETS.afix,
    mutate: (t) => mutateA(t, (_base, bundle) => { bundle.supersededF2.status = "current"; }, "M7"),
    expect: "A4",
  },
  {
    id: "M8-forged-frame-reuse",
    title: "伪造像素：本轮原型帧直接复用被 superseded 的 F2 旧哈希",
    target: TARGETS.afix,
    mutate: (t) => mutateA(t, (_base, bundle) => { bundle.frames[0].sha256 = bundle.supersededF2.sha256; }, "M8"),
    expect: "A5",
  },
  {
    id: "M9-forged-notify-shell",
    title: "伪造读数：通知通过证据的壳层从 v2 退回旧壳（冒充新壳产出）",
    target: TARGETS.ffix,
    mutate: (t) => mutateF(t, (b) => {
      const s = b.scenes.find((x) => x.readout?.notify?.required === true);
      assert.ok(s, "M9: 找不到携带通知判据的帧");
      s.readout.shell = "mainlayout";
    }, "M9"),
    expect: "C2",
  },
  {
    id: "M10-forged-compat-frame",
    title: "伪造读数：旧壳兼容回归帧抹掉 compatRole（伪装成普通通过帧）",
    target: TARGETS.ffix,
    mutate: (t) => mutateF(t, (b) => {
      const s = b.scenes.find((x) => x.legacyLayout === true);
      assert.ok(s, "M10: 找不到旧壳兼容回归帧");
      delete s.compatRole;
    }, "M10"),
    expect: "C3",
  },
  {
    id: "M11-notify-shell-gate-neutered",
    title: "门禁失效：findNotifyShellF3 恒放行（壳层违规不再判红）",
    target: TARGETS.fgate,
    mutate: (t) => patch(
      t,
      "export function findNotifyShellF3(scenes = []) {\n  const out = [];",
      "export function findNotifyShellF3(scenes = []) {\n  const out = [];\n  if (Array.isArray(scenes)) return out;",
      "M11",
    ),
    expect: "C4",
  },
  {
    id: "M12-forged-production-injected",
    title: "伪造读数：生产态读数盖上 uiux 注入标志（借测试注入蒙混验收）",
    target: TARGETS.afix,
    mutate: (t) => mutateA(t, (base) => { base.production.injected = true; }, "M12"),
    expect: "A6",
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
  "# WORKBENCH-13-F3 · 同状态契约 mutation 反测记录",
  "",
  `- 卡 §三.D.15 要求：≥4 类 mutation 点名变红 + SHA256 复原 + 复跑回绿。本次 **${records.length} 类**（源码 2 · 门禁函数 1 · 入库读数 9），全部点名变红并复原恒等：**${redCount}/${records.length}**。`,
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
writeFileSync(path.join(OUT, "f3-mutation-record.md"), md, "utf8");
writeFileSync(
  path.join(OUT, "f3-mutation-record.json"),
  `${JSON.stringify({ schema: "wb13-f3-mutation/v1", generatedAt: new Date().toISOString(), cases: records, baselineGreen: true, restoredGreen: true }, null, 2)}\n`,
  "utf8",
);
console.log(`\n全部反测通过：${redCount}/${records.length} 点名变红 + ${redCount}/${records.length} SHA256 恒等 + 复原后回绿`);
console.log(`记录 → ${path.join(OUT, "f3-mutation-record.md")}`);
