/**
 * WORKBENCH-13-F2 · 函数式组件样式真源契约测试（18 条；卡 §三.6 要求 ≥8 且**自包含**）
 *
 * 只依赖三样东西，clean 检出即可复现绿色（沿用 F1 的返工口径）：
 *   1. `src/main.ts`（本卡唯一允许改的业务侧文件）
 *   2. `tests/f2-func-styles-lib.mjs`（与采集端共用的纯函数门禁）
 *   3. `tests/fixtures/f2-func-measures.json`（真实浏览器采集产物，入库）
 *
 * 分组：A 样式真源 / B 确认框真实运行态 / C 更新通知 / D 390 抽屉与遮挡 / E 证据完整性与门禁自检。
 * E3 专门反证「门禁不是空转」：喂给它 static 裸块、出屏矩形、force 关抽屉、取消却写了
 * 四类假读数，必须逐条判红 ⇒ 卡 §六「不得只补测试不改真实样式」在这里是机器可查的。
 *
 * 运行（admin-web 目录）：node tests/f2-func-styles.spec.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as lib from "./f2-func-styles-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const read = (rel) => readFileSync(path.join(WEB, rel), "utf8");

const FIXTURE = "tests/fixtures/f2-func-measures.json";
assert.ok(existsSync(path.join(WEB, FIXTURE)), `缺少仓内证据副本 ${FIXTURE}（请先跑 node tests/f2-func-styles.mjs <evidenceDir>）`);
const bundle = JSON.parse(read(FIXTURE));
const scenes = bundle.scenes ?? [];
const at = (scene, viewport) => scenes.find((s) => s.scene === scene && (!viewport || s.viewport === viewport));

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

/* ══════ A. 样式真源在应用入口（卡 §三.1/§三.2） ══════ */

const mainSrc = read("src/main.ts");

await run("A1 main.ts 显式加载 message 样式入口", () => {
  assert.ok(mainSrc.includes('"element-plus/es/components/message/style/css"'), "main.ts 缺 message 样式入口");
  return "message/style/css 在应用入口";
});

await run("A2 main.ts 显式加载 message-box 样式入口（确认框不再靠组件副作用）", () => {
  assert.ok(mainSrc.includes('"element-plus/es/components/message-box/style/css"'), "main.ts 缺 message-box 样式入口");
  return "message-box/style/css 在应用入口";
});

await run("A3 main.ts 显式加载 notification 样式入口", () => {
  assert.ok(mainSrc.includes('"element-plus/es/components/notification/style/css"'), "main.ts 缺 notification 样式入口");
  return "notification/style/css 在应用入口";
});

await run("A4 三类入口都是顶层 import（先于 createApp / mount 生效）", () => {
  const mountIdx = mainSrc.indexOf('app.mount("#app")');
  assert.ok(mountIdx > 0, "main.ts 应挂载应用");
  for (const e of lib.REQUIRED_STYLE_ENTRIES) {
    const idx = mainSrc.indexOf(`"${e}"`);
    assert.ok(idx > 0 && idx < mountIdx, `${e} 必须在 mount 之前`);
    const line = mainSrc.slice(mainSrc.lastIndexOf("\n", idx) + 1, idx + e.length + 2);
    assert.ok(/^\s*import\s+"/.test(line), `${e} 必须是顶层 import，不能塞进条件分支：${line.trim()}`);
  }
  return "3 条顶层 import 均早于 app.mount";
});

await run("A5 去耦合正证：不渲染表格的页面上确认框仍有样式", () => {
  const frames = scenes.filter((s) => s.readout?.overlay?.required && s.readout.overlay.kind === "message-box");
  assert.ok(frames.length >= 3, `至少要有 3 帧确认框读数，实际 ${frames.length}`);
  const noTable = frames.filter((s) => s.readout.tableRendered === false);
  assert.ok(noTable.length === frames.length, "确认框证据帧必须全部落在**没有渲染 el-table** 的页面上（/messages）");
  for (const f of noTable) {
    assert.ok(f.readout.overlay.cssRules >= lib.MIN_CSS_RULES, `${f.viewport}/${f.scene} 只匹配到 ${f.readout.overlay.cssRules} 条样式规则`);
    assert.ok(f.readout.overlay.box?.computed?.backgroundColor === "rgb(255, 255, 255)", `${f.viewport}/${f.scene} 背景不是实色：${f.readout.overlay.box?.computed?.backgroundColor}`);
  }
  return `${noTable.length} 帧无表格页面均达标（规则数 ≥${lib.MIN_CSS_RULES}、实色背景）`;
});

/* ══════ B. 确认框的真实运行态（卡 §三.3 + §四.1/§四.2/§四.5） ══════ */

await run("B1 三视口确认框：脱离文档流的遮罩 + 背景 + 圆角 + 阴影 + 宽度受控", () => {
  const ids = lib.VIEWPORTS.map((v) => v.id);
  for (const vp of ids) {
    const f = at("01-confirm-open", vp);
    assert.ok(f, `${vp} 缺 01-confirm-open`);
    const o = f.readout.overlay;
    assert.equal(o.wrapper.computed.position, "fixed", `${vp} 遮罩不是 fixed（裸块/静态定位）：${o.wrapper.computed.position}`);
    assert.ok(!/transparent|rgba\(0, 0, 0, 0\)/.test(o.box.computed.backgroundColor), `${vp} 确认框背景透明`);
    assert.ok(/px/.test(o.box.computed.borderRadius) && parseFloat(o.box.computed.borderRadius) > 0, `${vp} 无圆角`);
    assert.notEqual(o.box.computed.boxShadow, "none", `${vp} 无阴影`);
    const vpWidth = lib.VIEWPORTS.find((v) => v.id === vp).width;
    assert.ok(o.box.rect.w <= Math.floor(vpWidth * lib.MAX_OVERLAY_WIDTH_RATIO), `${vp} 宽度失控：${o.box.rect.w}px`);
    assert.ok(o.box.rect.h > 60, `${vp} 确认框高度异常：${o.box.rect.h}`);
  }
  return `${ids.join("/")} 均满足 fixed 遮罩 + 实色背景 + 圆角 + 阴影 + 宽度受控`;
});

await run("B2 确认框整块在视口内，取消/确定中心点都命中自己", () => {
  const f = at("01-confirm-open", "1440x1000");
  assert.deepEqual(lib.findOffscreenOverlays([f]), [], "确认框出屏");
  assert.deepEqual(lib.findUnoperableButtons([f]), [], "取消/确定不可点");
  const labels = f.readout.overlay.buttons.map((b) => b.label);
  assert.ok(labels.includes("取消") && labels.includes("确定"), `按钮文案应为取消/确定，实际 ${labels.join("/")}`);
  for (const b of f.readout.overlay.buttons) assert.equal(b.hit, true, `「${b.label}」被 ${b.hitBy} 遮挡`);
  return "取消/确定 均可点且未被遮挡";
});

await run("B3 取消不写、确认才写（真实网络计数，不看前端自述）", () => {
  const cancel = at("04-confirm-cancel");
  const ok = at("05-confirm-ok");
  assert.ok(cancel && ok, "缺 04/05 操作帧");
  assert.equal(cancel.readout.writes.readAllRequests, 0, "取消却发出了写请求");
  assert.equal(cancel.readout.toast, "", "取消却弹了成功提示");
  assert.equal(ok.readout.writes.readAllRequests, 1, "确认没有真正写入");
  assert.ok(/标为已读/.test(ok.readout.toast), `确认后的成功提示不在屏上：${ok.readout.toast}`);
  assert.deepEqual(lib.findWriteMismatch([cancel, ok]), [], "写操作门禁判红");
  return `取消=0 次写入 / 确定=1 次写入 + 屏幕提示「${ok.readout.toast}」`;
});

await run("B4 键盘能进入确认框并操作按钮，Enter 真的触发写", () => {
  const f = at("06-confirm-keyboard");
  assert.ok(f, "缺 06-confirm-keyboard");
  assert.deepEqual(lib.findKeyboardBlocked([f]), [], "键盘门禁判红");
  const trail = f.readout.keyboardTrail ?? [];
  assert.ok(trail.length >= 3, `键盘轨迹太短，看不出 Tab 在框内移动：${trail.length}`);
  const onCancel = trail.findIndex((t) => t.insideBox && t.activeLabel === "取消");
  // 打开时 Element Plus 默认已把焦点放在「确定」上，所以要证明的是「取消之后还能 Tab 回确定」
  const movedAfterCancel = trail.slice(onCancel + 1).some((t) => t.insideBox && t.activeLabel === "确定");
  assert.ok(onCancel >= 0, "Tab 从未把焦点移到「取消」");
  assert.ok(movedAfterCancel, "Tab 未能从「取消」继续走到「确定」");
  assert.ok(trail.every((t) => t.insideBox), "键盘轨迹里有焦点跑出确认框的步骤");
  assert.equal(f.readout.writes.readAllRequests, 1, "Enter 未触发写操作");
  return `焦点路径 ${trail.map((t) => t.activeLabel || "框体").join(" → ")}，Enter 写入 1 次`;
});

/* ══════ C. 更新通知（卡 §三.4 + §四.3） ══════ */

await run("C1 通知固定定位且整块落在屏幕内（三视口）", () => {
  for (const vp of lib.VIEWPORTS.map((v) => v.id)) {
    const f = at("02-notify-update", vp);
    assert.ok(f, `${vp} 缺 02-notify-update`);
    const o = f.readout.overlay;
    assert.equal(o.kind, "notification");
    assert.equal(o.box.computed.position, "fixed", `${vp} 通知不是 fixed：${o.box.computed.position}`);
    assert.ok(o.cssRules >= lib.MIN_CSS_RULES, `${vp} 通知样式规则仅 ${o.cssRules} 条`);
    assert.ok(o.box.computed.visibility !== "hidden" && Number(o.box.computed.opacity) > 0.5, `${vp} 通知不可见`);
    assert.deepEqual(lib.findOffscreenOverlays([f]), [], `${vp} 通知出屏`);
  }
  return "3 视口通知均 fixed + 在屏 + 样式规则达标";
});

await run("C2 通知由生产检查器产出（节流键自证 + 数据来源显式披露）", () => {
  const f = at("02-notify-update", "1440x1000");
  const n = f.readout.notify;
  assert.equal(n.throttleKeyWritten, true, "localStorage 节流键未写入 ⇒ 不是 checker.ts 跑出来的通知");
  assert.match(n.overlayText, /新版本v0\.2\.0/, `通知文案不是 checker 的模板产出：${n.overlayText}`);
  assert.equal(n.payloadSource, "harness-version-stub", "通知数据来源必须标注（不得伪造，也不得假装来自后端）");
  assert.ok(String(bundle.versionEndpoint?.disclosure ?? "").length > 40, "缺少版本端点披露说明");
  assert.deepEqual(lib.findSyntheticNotification(scenes.filter((s) => s.readout?.notify?.required)), [], "通知门禁判红");
  return `真实后端返回 ${JSON.stringify(bundle.versionEndpoint?.realBackendRead)} ⇒ 仅在 HTTP 边界补契约形态`;
});

await run("C3 点击通知 ⇒ 页面真的重新加载，旧提示不残留", () => {
  const f = at("07-notify-click-reload");
  assert.ok(f, "缺 07-notify-click-reload");
  assert.equal(f.readout.notify.documentReloads, 1, `点击后没有发生真实重载（document 请求增量=${f.readout.notify.documentReloads}）`);
  assert.equal(f.readout.notify.notificationGoneAfterReload, true, "重载后通知层残留");
  assert.equal(f.readout.overlay.required, false, "07 末帧应是重载后的干净结果态");
  return "点击 → document 重载 1 次 → 通知再次出现后自动关闭";
});

/* ══════ D. 390 抽屉回归与「提示不盖主操作」（卡 §三.6 + §四.4/§四.6） ══════ */

await run("D1 390×844 抽屉：真实鼠标与真实触摸都能关掉（无 force）", () => {
  const mouse = at("08-drawer-mouse");
  const touch = at("09-drawer-touch");
  assert.ok(mouse && touch, "缺 08/09 抽屉帧");
  for (const [name, f] of [["mouse", mouse], ["touch", touch]]) {
    const d = f.readout.drawer;
    assert.equal(d.method, name, `${name} 帧的操作方式读数不符`);
    assert.equal(d.forceUsed, false, `${name} 用了 force 点击（红线）`);
    assert.ok(d.exposedPoint && d.exposedPoint.x >= 0 && d.exposedPoint.y >= 0, `${name} 没有实探到遮罩露出点`);
    assert.equal(d.openBefore, true, `${name} 抽屉没先打开`);
    assert.equal(d.closedAfter, true, `${name} 关不掉抽屉`);
  }
  assert.deepEqual(lib.findStuckDrawer([mouse, touch]), [], "抽屉门禁判红");
  return `鼠标点 ${JSON.stringify(mouse.readout.drawer.exposedPoint)} / 触摸点 ${JSON.stringify(touch.readout.drawer.exposedPoint)} 均已关闭`;
});

await run("D2 窄屏提示在屏时，主操作中心点仍命中自己（不被提示盖住）", () => {
  const f = at("10-toast-not-blocking");
  assert.ok(f, "缺 10-toast-not-blocking");
  assert.notEqual(f.readout.toast, "", "这一帧屏幕上必须真的有提示，否则「不遮挡」无意义");
  assert.equal(f.readout.primaryAction.hit, true, `主操作「${f.readout.primaryAction.label}」被 ${f.readout.primaryAction.hitBy} 盖住`);
  assert.deepEqual(lib.findToastBlockingAction([f]), [], "遮挡门禁判红");
  return `提示「${f.readout.toast}」在场时「${f.readout.primaryAction.label}」仍可点`;
});

/* ══════ E. 证据完整性 + 门禁不是空转 ══════ */

await run("E1 三视口全覆盖、必需场景齐全、逐视口帧唯一", () => {
  assert.deepEqual(lib.findMissingScenes(scenes), [], "有必需场景缺席");
  assert.deepEqual(lib.findMissingViewports(scenes), [], "有视口无证据");
  assert.deepEqual(lib.findDuplicateHashes(scenes), [], "同一视口内有 PNG 哈希重复（平图复用）");
  const dup = new Map();
  for (const s of scenes) dup.set(`${s.viewport}|${s.stateSignature}`, [...(dup.get(`${s.viewport}|${s.stateSignature}`) ?? []), s.scene]);
  const collided = [...dup.entries()].filter(([, list]) => list.length > 1);
  assert.equal(collided.length, 0, `状态签名重复：${collided.map(([k, l]) => `${k.split("|")[0]}:${l.join("/")}`).join("；")}`);
  const frames = lib.countFrames(scenes);
  assert.ok(scenes.length >= 16, `证据帧过少：${scenes.length}`);
  return `${scenes.length} 帧 / ${frames.map((f) => `${f.viewport}:${f.frames}`).join(" ")}`;
});

await run("E2 全量门禁：仓内证据副本必须零违例", () => {
  const v = lib.collectViolationsF2(bundle);
  assert.equal(v.length, 0, `门禁违例 ${v.length} 条：\n  - ${v.join("\n  - ")}`);
  assert.equal(bundle.servers.portsAllDown, true, "服务未自停");
  assert.equal(bundle.apiBase, "/api", "API 基址不是同源 /api");
  return `${scenes.length} 帧 0 违例（端口 ${bundle.servers.backendPort}/${bundle.servers.webPort} 已自停）`;
});

await run("E3 门禁反证：四类假读数必须逐条判红（不得只补测试）", () => {
  const vp = "1440x1000";
  const real = at("01-confirm-open", vp);
  const mk = (patch) => {
    const s = JSON.parse(JSON.stringify(real));
    patch(s);
    s.stateSignature = lib.f2StateSignature(s.readout);
    return s;
  };
  // ① 把确认框推成 static 裸块（卡 §六「不得用固定定位 hack」的反面：静态裸块必须判红）
  const asStatic = mk((s) => {
    s.readout.overlay.wrapper.computed.position = "static";
  });
  assert.ok(lib.findUnstyledOverlays([asStatic]).length === 1, "static 裸块没有被判红");
  // ② 出屏（top = 视口高，等于看不见）
  const offscreen = mk((s) => {
    s.readout.overlay.box.rect = { x: 0, y: 1400, w: 420, h: 120 };
  });
  assert.ok(lib.findOffscreenOverlays([offscreen]).length >= 1, "出屏浮层没有被判红");
  // ③ 用 force 冒充抽屉可用
  const forced = JSON.parse(JSON.stringify(at("08-drawer-mouse")));
  forced.readout.drawer.forceUsed = true;
  assert.ok(lib.findStuckDrawer([forced, at("09-drawer-touch")]).some((x) => /force/.test(x.reason)), "force 点击没有被判红");
  // ④ 取消却写了
  const cancelWrites = JSON.parse(JSON.stringify(at("04-confirm-cancel")));
  cancelWrites.readout.writes.readAllRequests = 1;
  assert.ok(lib.findWriteMismatch([cancelWrites]).length === 1, "取消却写入没有被判红");
  // ⑤ 测试端自己造通知（没有跑过 checker）
  const fakeNotify = JSON.parse(JSON.stringify(at("02-notify-update", vp)));
  fakeNotify.readout.notify.throttleKeyWritten = false;
  assert.ok(lib.findSyntheticNotification([fakeNotify]).length >= 1, "合成通知没有被判红");
  // ⑥ 透明遮罩冒充「有样式」
  const transparent = mk((s) => {
    s.readout.overlay.box.computed.backgroundColor = "rgba(0, 0, 0, 0)";
    s.readout.overlay.box.computed.boxShadow = "none";
  });
  assert.ok(lib.findUnstyledOverlays([transparent])[0]?.reasons.length >= 2, "透明无阴影层没有被判红");
  return "static 裸块 / 出屏 / force / 取消写入 / 合成通知 / 透明层 六类判红均生效";
});

await run("E4 证据脱敏：仓内副本不得含凭据形态", () => {
  const text = read(FIXTURE);
  assert.ok(!/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text), "证据里残留 JWT");
  assert.ok(!/[?&]token=(?!<REDACTED>)[A-Za-z0-9._-]{12,}/.test(text), "证据里残留 token 参数");
  assert.ok(!/Bearer [A-Za-z0-9._-]{12,}/.test(text), "证据里残留 Bearer 凭据");
  assert.ok(!/"csrfToken":"[^<]/.test(text), "证据里残留 csrfToken 值");
  assert.ok(!/JWT_SECRET|CSRF_SECRET\s*[:=]\s*[0-9a-f]{16}/.test(text), "证据里残留一次性开发密钥");
  return "JWT / token 参数 / Bearer / csrfToken / 开发密钥 均未入证据";
});

await run("E5 披露守恒：通知通过证据必须落在 wb-shell 生产新壳，旧壳只留兼容回归帧（F3 §三.C.10/C.11 反转口径）", () => {
  const notifyFrames = scenes.filter((s) => s.readout?.notify?.required);
  assert.ok(notifyFrames.length >= 4, `通知证据帧不足：${notifyFrames.length}`);
  for (const f of notifyFrames) {
    assert.equal(f.readout.shell, "v2", `${f.viewport}/${f.scene} 的壳层读数不是 [data-testid="wb-shell"] 生产新壳`);
    assert.equal(f.legacyLayout, false, `${f.viewport}/${f.scene} 旧壳回滚帧不得携带通知通过证据（卡 §三.C.11）`);
  }
  assert.deepEqual(lib.findNotifyShellF3(notifyFrames), [], "通知壳层门禁判红");
  const compat = scenes.find((s) => s.compatRole === "compat-regression");
  assert.ok(compat, "缺旧壳兼容回归帧（§三.C.11 要求回滚路径单列出证）");
  assert.equal(compat.readout.shell, "mainlayout", "兼容帧必须落在旧壳读数上");
  assert.equal(compat.readout.notify, undefined, "兼容回归帧不得标为通知通过证据");
  assert.equal(compat.readout.compatNotify?.checkerHitsElNotification, true, "旧壳回滚路径必须仍能真实产出通知（兼容回归正证）");
  assert.ok(String(bundle.findings?.updateCheckerOnNewShell ?? "").length > 30, "新壳接入说明必须写进证据");
  assert.ok(!("updateCheckerNotMountedOnNewShell" in (bundle.findings ?? {})), "F3 已闭合的缺口不得再以旧名登记");
  assert.equal(bundle.updateCheckerMount?.file, "src/modules/update/checker.ts", "通知来源文件必须写明");
  assert.match(String(bundle.updateCheckerMount?.calledBy ?? ""), /WorkbenchShell\.vue/, "挂载点必须写明新壳 WorkbenchShell");
  return `${notifyFrames.length} 帧均 shell=v2；旧壳兼容回归帧 1 张单列；新壳挂载口径入证`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
