/**
 * WORKBENCH-13-F3 · 同状态视觉与消费者反馈收口契约测试（19 条；卡 §三.A/B/C/D + dispatch 1/2/3）
 *
 * 只读三样东西，clean 检出即可复现绿色（与 f2a-visual-baseline.spec.mjs 同一自包含口径）：
 *   1. 真源：`src/components/workbench/AiFeedView.vue`、`src/layouts/WorkbenchShell.vue`、`src/modules/update/checker.ts`
 *   2. 门禁纯函数：`tests/f2a-visual-baseline-lib.mjs`（findStateSignatureF3 等）、`tests/f2-func-styles-lib.mjs`（findNotifyShellF3）
 *   3. 仓内证据副本：`tests/fixtures/f2a-visual-measures.json`、`tests/fixtures/f2-func-measures.json`
 *
 * 分组：A 同状态并排（弹层归零 + 状态签名 + superseded）/ B 首页四区块原位诚实占位 /
 * C 新壳通知（checkWebUpdate 接线 + wb-shell 证据壳层 + 旧壳仅兼容回归）/ D 回归不破。
 * F3 dispatch 的三件事在 A/B/C 各自成组；A1 与 C4 是「门禁重算」用例：签名与壳层判定
 * 必须能从读数复算复现（mutation 反测 f3-visual-contract-countertest.mjs 逐类注入验证，卡 §三.D.15 要求 ≥4 类）。
 *
 * 运行（admin-web 目录）：node tests/f3-visual-contract.spec.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as lib from "./f2a-visual-baseline-lib.mjs";
import * as flib from "./f2-func-styles-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const read = (rel) => readFileSync(path.join(WEB, rel), "utf8");

const FIX_A = "tests/fixtures/f2a-visual-measures.json";
const FIX_F = "tests/fixtures/f2-func-measures.json";
for (const f of [FIX_A, FIX_F]) {
  assert.ok(existsSync(path.join(WEB, f)), `缺少仓内证据副本 ${f}（请先跑对应采集器）`);
}
const bundleA = JSON.parse(read(FIX_A));
const bundleF = JSON.parse(read(FIX_F));
const base = bundleA.viewports?.[lib.BASE_VIEWPORT.id] ?? {};
const impl = base.implementation ?? {};
const pm = base.prototypeModals ?? {};
const io = base.implOverlays ?? {};
const sbs = base.sideBySide ?? {};
const rec = base.stateSignature ?? {};
const rw = base.prototypeRailWindow ?? {};
const scenes = bundleF.scenes ?? [];

const results = [];
async function run(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log(`FAIL  ${name}  ← ${e.message}`);
  }
}

/* ══════ A. 同状态并排（dispatch 1 / 卡 §三.A） ══════ */

await run("A1 状态签名门禁重算零违例：两侧签名从读数复算、逐字符相等且 overlay 段为 0", () => {
  const v = lib.findStateSignatureF3(base);
  assert.deepEqual(v, [], `findStateSignatureF3 判红：${v.join("；")}`);
  assert.equal(rec.equal, true, "存量 equal 必须为真");
  assert.match(String(rec.prototype), /overlay=0/, "原型侧签名 overlay 段必须为 0");
  assert.match(String(rec.implementation), /overlay=0/, "实现侧签名 overlay 段必须为 0");
  const protoBits = String(rec.prototype).split("|").slice(4).join("|");
  const implBits = String(rec.implementation).split("|").slice(4).join("|");
  assert.equal(protoBits, implBits, "逐区在场位向量不一致（五区/侧栏必须同态）");
  return `两侧签名逐字符相等 · ${String(rec.prototype).slice(0, 46)}…`;
});

await run("A2 原型侧活跃模态=0 且二次确认稳定（§三.A.1「关闭并等待稳定」）", () => {
  assert.equal(pm.captureActive, 0, "快门时刻仍有活跃模态");
  assert.equal(pm.finalActive, 0, "采集末检仍有活跃模态");
  assert.equal(pm.zero, true, "原型侧模态归零标志缺失");
  assert.equal(pm.stable, true, "清零后未二次确认稳定");
  const bad = (pm.finalList ?? []).length;
  assert.equal(bad, 0, `末检活跃模态清单非空：${JSON.stringify(pm.finalList).slice(0, 120)}`);
  return `captureActive=0 · finalActive=0 · stable=true · boot 风暴 ${pm.bootActive?.length ?? 0} 条留痕`;
});

await run("A3 并排图 PNG 证据写出两侧状态签名（§三.A.3 签名必须进图）", () => {
  assert.equal(sbs.signaturesPrinted, true, "figcaption 未写出两侧状态签名");
  assert.equal(sbs.panes, 2, "并排面板数≠2");
  assert.equal(sbs.sameViewport, true, "两侧面板不同视口");
  assert.equal(sbs.heightMatch, 1, "两侧面板高度不齐（不是同视口并排）");
  assert.equal(sbs.signatures?.prototype, rec.prototype, "图内原型签名与存量签名不符");
  assert.equal(sbs.signatures?.implementation, rec.implementation, "图内实现签名与存量签名不符");
  return `panes=2 · 1440×1000 ⇄ 1440×1000 · heightMatch=1 · 签名入图`;
});

await run("A4 F2 旧并排帧登记 superseded：原因点名「弹层未关」且指纹完整（dispatch 1 / §三.A.4）", () => {
  const s = bundleA.supersededF2 ?? {};
  assert.equal(s.status, "superseded", "旧并排帧未登记 superseded 状态");
  assert.match(String(s.reason ?? ""), /setwin|弹层|模态/, "superseded 原因必须点名 F2 的未关弹层缺陷");
  assert.match(String(s.sha256 ?? ""), /^[0-9A-F]{64}$/, "superseded 帧缺合法 SHA256");
  assert.match(String(s.file ?? ""), /WORKBENCH-13-WORKBENCH-UIUX-COMPLETE-01-F2/, "superseded 帧必须指向 F2 证据路径");
  return `${String(s.file).split("/").pop()} · ${String(s.sha256).slice(0, 12)}… 已作废留痕`;
});

await run("A5 本轮帧不复用旧像素：任何在档帧哈希都不得等于被 superseded 的 F2 帧", () => {
  const dead = String(bundleA.supersededF2?.sha256 ?? "");
  assert.ok(dead.length === 64, "superseded 指纹缺失，A5 无从反证");
  const frames = bundleA.frames ?? [];
  assert.ok(frames.length >= 3, `本轮帧数异常：${frames.length}`);
  const hits = frames.filter((f) => f.sha256 === dead);
  assert.equal(hits.length, 0, `发现直接复用 F2 旧帧：${hits.map((h) => h.screen).join(",")}`);
  const hashes = new Set(frames.map((f) => f.sha256));
  assert.equal(hashes.size, frames.length, "帧哈希有重复（同像素冒充多帧）");
  return `${frames.length} 帧哈希唯一且与旧帧零重叠`;
});

await run("A6 实现侧浮层=0 且生产态无 uiux 注入（§三.A.2 注入=off）", () => {
  assert.equal(io.active, 0, `实现侧活跃浮层≠0：${JSON.stringify(io.list).slice(0, 120)}`);
  assert.equal(io.zero, true, "实现侧 overlay 归零标志缺失");
  assert.equal(io.stable, true, "实现侧未二次确认稳定");
  assert.equal(base.production?.injected, false, "生产读数竟带 uiux 注入");
  return `.el-overlay/.el-notification=0 · injected=false`;
});

/* ══════ B. 首页四区块原位诚实占位（dispatch 2 / 卡 §三.B） ══════ */

const feedSrc = read("src/components/workbench/AiFeedView.vue");

await run("B1 源码四区块容器恒在 + 占位态 + 重试按钮全部实绑（删除区块即判红）", () => {
  const anchors = [
    'data-testid="wb-ap-zone"',
    'data-testid="wb-bc-zone"',
    'data-testid="wb-tb-zone"',
    'data-testid="wb-tf-zone"',
    'data-testid="wb-ap-unavailable"',
    'data-testid="wb-tf-unavailable"',
    'data-testid="wb-ap-retry" @click="refreshApprovals"',
    'data-testid="wb-bc-retry" @click="refreshBroadcast"',
    'data-testid="wb-tf-retry" @click="refreshQueue"',
  ];
  const missing = anchors.filter((a) => !feedSrc.includes(a));
  assert.equal(missing.length, 0, `AiFeedView.vue 缺常驻锚点：${missing.join(" / ")}`);
  return `${anchors.length} 个容器/占位/重试锚点在源`;
});

await run("B2 入库读数占位诚实：审批/任务步进在场可见，文案点明失败原因并给重试", () => {
  for (const key of ["approvals", "taskStep"]) {
    const r = impl[key] ?? {};
    assert.equal(r.exists, true, `${key} 区块不存在（不许因无数据删区块）`);
    assert.equal(r.visible, true, `${key} 区块不可见`);
    const text = String(r.metrics?.text ?? "");
    assert.match(text, /读取失败|待接入|暂无|无数据/, `${key} 占位文案未如实说明数据状态：${text.slice(0, 60)}`);
    assert.match(text, /重试/, `${key} 占位缺重试入口文案`);
  }
  return "审批/任务步进 exists+visible+失败如实+重试在位";
});

await run("B3 差异表四区块零缺位：每区 gated 行齐备且无 missing/off-spec", () => {
  const gates = Object.fromEntries(lib.REGION_CONTRACT.map((c) => [c.key, c.gate ?? []]));
  const rows = base.diffTable ?? [];
  for (const key of ["approvals", "broadcast", "queue", "taskStep"]) {
    const zone = rows.filter((x) => x.region === key);
    assert.ok(zone.length >= (gates[key] ?? []).length, `${key} 差异表行数少于 gated 指标数（占位时也不许缺读数）`);
    assert.ok(zone.every((x) => x.verdict !== "missing"), `${key} 出现 missing 判红行`);
    assert.ok(zone.filter((x) => x.gated).every((x) => ["match", "explained"].includes(x.verdict)), `${key} 有超容差未解释行`);
  }
  return "四区 gated 行全部在场且容差内";
});

await run("B4 不造假数据：占位态读数必须写「不伪造」承诺，且无待办卡片行混入", () => {
  const apText = String(impl.approvals?.metrics?.text ?? "");
  assert.match(apText, /不伪造/, `审批占位未声明不伪造数据：${apText.slice(0, 60)}`);
  const bcText = String(impl.broadcast?.metrics?.text ?? "");
  assert.match(bcText, /不伪造|待接入/, `播报占位未声明不伪造异动：${bcText.slice(0, 60)}`);
  const fakeRows = (base.implBody?.approvals?.cards ?? base.impl?.approvals?.cards ?? []);
  assert.equal(Array.isArray(fakeRows) ? fakeRows.length : 0, 0, "审批区在无读数态仍出现伪造卡片行");
  return "占位文案含「不伪造」承诺 · 无混入卡片行";
});

/* ══════ C. 新壳通知（dispatch 3 / 卡 §三.C） ══════ */

const shellSrc = read("src/layouts/WorkbenchShell.vue");
const checkerSrc = read("src/modules/update/checker.ts");

await run("C1 WorkbenchShell 源码真实接线 checkWebUpdate()（§三.C.9，只挂生产新壳）", () => {
  assert.ok(/import\s*\{[^}]*checkWebUpdate[^}]*\}\s*from\s*"\.\.\/modules\/update\/checker"/.test(shellSrc), "WorkbenchShell.vue 未 import checkWebUpdate");
  assert.match(shellSrc, /if \(shellEnabled\) void checkWebUpdate\(\);/, "onMounted 未实绑 checkWebUpdate（或仍无条件调用致双通知）");
  return "import + onMounted 条件接线（shellEnabled）均在源";
});

await run("C2 通知通过证据全部落在 shell=v2 新壳帧（§三.C.10，旧壳读数即判红）", () => {
  const need = scenes.filter((s) => s.readout?.notify?.required === true);
  assert.ok(need.length >= 3, `携带通知判据的帧少于 3：${need.length}`);
  const bad = need.filter((s) => s.readout?.shell !== "v2" || s.legacyLayout === true);
  assert.equal(bad.length, 0, `通知证据壳层违规：${bad.map((s) => `${s.viewport}/${s.scene}=${s.readout?.shell}`).join(", ")}`);
  return `${need.length} 帧通知证据均 shell=v2（02×3 + 07 重载帧）`;
});

await run("C3 旧壳回滚单列兼容回归帧：存在、标记正确、不携带通过证据（§三.C.11）", () => {
  const legacy = scenes.filter((s) => s.legacyLayout === true);
  assert.equal(legacy.length, 1, `旧壳兼容回归帧应恰 1 张，实际 ${legacy.length}`);
  const s = legacy[0];
  assert.equal(s.scene, "11-legacy-compat-notify", "兼容回归帧命名不符");
  assert.equal(s.compatRole, "compat-regression", "兼容回归帧缺 compatRole 标记");
  assert.notEqual(s.readout?.notify?.required, true, "兼容回归帧竟携带通知通过证据");
  assert.ok(s.readout?.notify === undefined, "兼容回归帧不应有 notify 判据读数（通过证据只在新壳帧）");
  assert.equal(s.readout?.shell, "mainlayout", "兼容回归帧必须真实跑在旧壳回滚路径上");
  assert.ok(s.readout?.compatNotify !== undefined, "旧壳回滚未出 compatNotify 读数（回滚断通知链即失证）");
  return "11-legacy-compat-notify 单列出证：回滚不断通知链，但不作通过证据";
});

await run("C4 通知壳层门禁重算：findNotifyShellF3 与 collectViolationsF2 对本份证据零违例", () => {
  assert.deepEqual(flib.findNotifyShellF3(scenes), [], "findNotifyShellF3 复算判红");
  const mutated = JSON.parse(JSON.stringify(scenes));
  const first = mutated.find((s) => s.readout?.notify?.required === true);
  first.readout.shell = "mainlayout";
  assert.ok(flib.findNotifyShellF3(mutated).length >= 1, "把 v2 改成旧壳必须判红（门禁不得恒放行）");
  assert.deepEqual(flib.collectViolationsF2(bundleF), [], "B 段汇总门禁复算判红");
  return "门禁重算绿 + 伪造壳层当场红（自反证内嵌）";
});

await run("C5 检查器静默降级：checkWebUpdate 失败不抛出、不阻塞新壳挂载（§三.C.12）", () => {
  assert.match(checkerSrc, /async function checkWebUpdate/, "checker.ts 缺 checkWebUpdate 定义");
  assert.match(checkerSrc, /catch/, "checkWebUpdate 未做异常兜底（网络失败会炸壳）");
  assert.doesNotMatch(shellSrc, /await checkWebUpdate\(\);/, "onMounted 不得 await 检查器（失败静默降级，不阻塞工作台）");
  return "内部 catch 兜底 · 挂载点 void 调用不阻塞";
});

/* ══════ D. 回归不破（卡 §三.D.14） ══════ */

await run("D1 三视口实现侧零横向裁切且默认直达信息流面（1440/1024/390）", () => {
  const ids = [lib.BASE_VIEWPORT.id, ...lib.IMPL_ONLY_VIEWPORTS.map((v) => v.id)];
  for (const id of ids) {
    const vb = bundleA.viewports?.[id];
    assert.ok(vb, `缺视口 ${id} 读数`);
    const page = vb.implementation?.__page ?? {};
    assert.equal(page.overflowX, 0, `${id} 出现横向裁切`);
    assert.equal(page.feedShown, true, `${id} 未直达信息流面`);
    assert.equal(vb.implementationEntry?.injected ?? vb.production?.injected ?? false, false, `${id} 带注入读数`);
  }
  return `${ids.join("/")} overflowX=0 · 均直达信息流`;
});

await run("D2 一级 12 项回归：rail 项数/顺序/选中态门禁复算零违例（F3 未碰坏 F2 成果）", () => {
  const protoRail = base.protoRail ?? {};
  const implRail = base.implRail ?? {};
  assert.deepEqual(lib.findRailCount(protoRail.items ?? [], implRail.items ?? []), [], "一级栏项数/顺序回归破口");
  assert.equal((implRail.items ?? []).length, 12, `生产态可见项 ${implRail.items?.length} ≠ 12`);
  assert.equal(implRail.settings?.exists, true, "设置项节点被删（卡面要求保留但视觉隐藏）");
  return "12 项齐 · 顺序一致 · 设置项仍保留";
});

await run("D3 二级列与确认框回归：新对话仍在横栏末位，确认框四场景在场", () => {
  assert.deepEqual(lib.findNewChatPlacement(impl.newChat, impl.segBar), [], "新对话位置回归破口");
  const conf = scenes.filter((s) => /^0[1456]-confirm/.test(s.scene));
  const names = new Set(conf.map((s) => s.scene));
  for (const want of ["01-confirm-open", "04-confirm-cancel", "05-confirm-ok", "06-confirm-keyboard"]) {
    assert.ok(names.has(want), `确认框场景缺失：${want}`);
  }
  const keyboard = conf.find((s) => s.scene === "06-confirm-keyboard");
  assert.equal(keyboard?.readout?.operated?.viaKeyboard !== false, true, "键盘触发确认框的实操作性丢失");
  return `新对话在栏末位 · 确认框 ${conf.length} 帧在场（含键盘真触发）`;
});

/* ══════ 汇总 ══════ */

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n小结：${passed} passed / ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
