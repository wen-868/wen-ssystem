/**
 * WORKBENCH-13-F2 · mutation 反测装置（卡 §三.7：8 类，≥4）
 *
 * 每条都是「把缺陷注回真源或注伪造读数」→ 断言**点名那条契约测试变红** → 逐字节复原并校验
 * SHA256 恒等 → 全部复原后复跑回绿。前 4 类打样式真源与门禁函数本体，后 4 类打已入库的测量值，
 * 这样「测试只认死值」和「门禁只认测试」两种偷懒都过不了。
 *
 *   M1 删 message 样式入口        → A1
 *   M2 删 message-box 样式入口    → A2（确认框重新退化成裸块）
 *   M3 删 notification 样式入口   → A3（通知重新看不见）
 *   M4 门禁 findUnstyledOverlays 恒返回空 → E3（浮层无样式不再判红）
 *   M5 伪造读数：确认框遮罩是 static 裸块 → B1
 *   M6 伪造读数：取消却发出了写请求      → B3
 *   M7 伪造读数：抽屉用 force 点击关闭   → D1
 *   M8 伪造读数：通知没跑过生产检查器    → C2
 *
 * 运行（必须显式给输出目录，避免把中间产物写进工作树而破坏 clean）：
 *   node admin-web/tests/f2-func-styles-countertest.mjs <outDir>
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
  main: path.join(WEB, "src", "main.ts"),
  gate: path.join(WEB, "tests", "f2-func-styles-lib.mjs"),
  fixture: path.join(WEB, "tests", "fixtures", "f2-func-measures.json"),
};

const SPEC = path.join(WEB, "tests", "f2-func-styles.spec.mjs");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!OUT) {
  console.error("必须显式传入证据输出目录（默认写进工作树会破坏 clean）：node tests/f2-func-styles-countertest.mjs <outDir>");
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

/** 读数伪造：按 viewport/scene 定位那一帧，改掉一个字段后按采集端同格式回写 */
function falsifyScene(json, viewport, scene, mutate, id) {
  const bundle = JSON.parse(json);
  const s = bundle.scenes.find((x) => x.viewport === viewport && x.scene === scene);
  assert.ok(s, `${id}: 证据帧不存在 ${viewport}/${scene}`);
  mutate(s);
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

const CASES = [
  {
    id: "M1-message-style-removed",
    title: "消息样式入口被删（ElMessage 提示掉到屏幕外）",
    target: TARGETS.main,
    mutate: (t) => patch(t, `import "element-plus/es/components/message/style/css";\n`, "", "M1"),
    expect: "A1",
  },
  {
    id: "M2-messagebox-style-removed",
    title: "确认框样式入口被删（回到「只有渲染了表格的页面才有 CSS」）",
    target: TARGETS.main,
    mutate: (t) => patch(t, `import "element-plus/es/components/message-box/style/css";\n`, "", "M2"),
    expect: "A2",
  },
  {
    id: "M3-notification-style-removed",
    title: "通知样式入口被删（ElNotification 退化成静态裸块）",
    target: TARGETS.main,
    mutate: (t) => patch(t, `import "element-plus/es/components/notification/style/css";\n`, "", "M3"),
    expect: "A3",
  },
  {
    id: "M4-unstyled-gate-neutered",
    title: "门禁失效：findUnstyledOverlays 恒返回空（裸块不再判红）",
    target: TARGETS.gate,
    mutate: (t) =>
      patch(
        t,
        `    if (bad.length) out.push({ viewport: s.viewport, scene: s.scene, kind: o.kind, reasons: bad });
  }
  return out;`,
        `    if (bad.length) out.push({ viewport: s.viewport, scene: s.scene, kind: o.kind, reasons: bad });
  }
  return [];`,
        "M4",
      ),
    expect: "E3",
  },
  {
    id: "M5-forged-static-bare-box",
    title: "伪造读数：确认框遮罩写成 static 裸块（非模态、不脱流）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyScene(t, "1440x1000", "01-confirm-open", (s) => {
        s.readout.overlay.wrapper.computed.position = "static";
      }, "M5"),
    expect: "B1",
  },
  {
    id: "M6-forged-cancel-writes",
    title: "伪造读数：取消按钮却发出了写请求",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyScene(t, "1440x1000", "04-confirm-cancel", (s) => {
        s.readout.writes.readAllRequests = 1;
      }, "M6"),
    expect: "B3",
  },
  {
    id: "M7-forged-force-drawer",
    title: "伪造读数：390 抽屉靠 force 点击关闭（红线）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyScene(t, "390x844", "08-drawer-mouse", (s) => {
        s.readout.drawer.forceUsed = true;
      }, "M7"),
    expect: "D1",
  },
  {
    id: "M8-forged-synthetic-notification",
    title: "伪造读数：通知没有生产检查器的节流键痕迹（测试端自己造的）",
    target: TARGETS.fixture,
    mutate: (t) =>
      falsifyScene(t, "1440x1000", "02-notify-update", (s) => {
        s.readout.notify.throttleKeyWritten = false;
      }, "M8"),
    expect: "C2",
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
  // 源文件按工作树既有换行（CRLF）写回；JSON 读数保持采集端的 LF 口径
  const bytes = c.target.endsWith(".json") ? mutated : mutated.replace(/\n/g, "\r\n");
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
  "# WORKBENCH-13-F2 · mutation 反测记录",
  "",
  `- 卡 §三.7 要求：≥4 类变红 + SHA256 恒等复原 + 复原后回绿。本次 **${records.length} 类**，全部点名变红并复原恒等：**${redCount}/${records.length}**。`,
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
writeFileSync(path.join(OUT, "f2-mutation-record.md"), md, "utf8");
writeFileSync(
  path.join(OUT, "f2-mutation-record.json"),
  `${JSON.stringify({ schema: "wb13-f2-mutation/v1", generatedAt: new Date().toISOString(), cases: records, baselineGreen: true, restoredGreen: true }, null, 2)}\n`,
  "utf8",
);
console.log(`\n全部反测通过：${redCount}/${records.length} 点名变红 + ${redCount}/${records.length} SHA256 恒等 + 复原后回绿`);
console.log(`记录 → ${path.join(OUT, "f2-mutation-record.md")}`);
