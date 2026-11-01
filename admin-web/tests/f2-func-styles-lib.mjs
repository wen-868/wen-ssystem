/**
 * WORKBENCH-13-F2 · 函数式组件样式真源的门禁逻辑（纯函数，无 IO、无网络）
 *
 * 沿用 F1 的口径（凌舟驳回 §二.1）：判定规则随仓入库，采集端 `f2-func-styles.mjs`
 * 与专项测试 `f2-func-styles.spec.mjs` 共用同一份函数 ⇒ 机器判红和人工看截图不会分叉。
 *
 * 本卡要判的是「函数式组件（消息 / 确认框 / 通知）在真实浏览器里到底有没有被样式覆盖、
 * 是否在视口内、能否真的点」，所以读数是 DOM 几何 + computed style + 真实操作结果，
 * 三者必须互相印证（卡 §五）。
 */
import {
  MIN_PNG_BYTES,
  VIEWPORTS,
  findClipped,
  findDuplicateHashes,
  findMissingViewports,
  portOfUrl,
  redactText,
} from "./uiux-scenarios-lib.mjs";

export { VIEWPORTS, redactText, portOfUrl, findClipped, findDuplicateHashes, findMissingViewports, MIN_PNG_BYTES };

/** main.ts 必须显式加载的三类函数式组件样式入口（卡 §三.1） */
export const REQUIRED_STYLE_ENTRIES = [
  "element-plus/es/components/message/style/css",
  "element-plus/es/components/message-box/style/css",
  "element-plus/es/components/notification/style/css",
];

/** 应用入口（唯一被允许改动的 src 文件，卡 §二） */
export const APP_ENTRY = "src/main.ts";
/** 旧侧证：message-box 样式此前只是这个组件的副作用（卡 §三.2 要摆脱的耦合） */
export const LEGACY_COUPLING_FILE = "src/components/zx/ZxElTable.vue";

/** 视口内浮层至少要匹配到这么多条 CSS 规则，才认为样式真的进了文档 */
export const MIN_CSS_RULES = 8;
/** 确认框宽度不得超过视口宽度的这个比例（卡 §三.3「宽度受控」；EP 自身是 width:100% + max-width:420px，窄屏上会紧贴两侧 16px 安全边距） */
export const MAX_OVERLAY_WIDTH_RATIO = 0.95;

/** 必须出证的场景（卡 §三.3/§三.4/§三.5 + §四 六项） */
export const REQUIRED_SCENES = [
  { scene: "01-confirm-open", viewports: ["1440x1000", "1024x768", "390x844"] },
  { scene: "02-notify-update", viewports: ["1440x1000", "1024x768", "390x844"] },
  { scene: "03-alert-forced", viewports: ["1440x1000", "1024x768", "390x844"] },
  { scene: "04-confirm-cancel", viewports: ["1440x1000"] },
  { scene: "05-confirm-ok", viewports: ["1440x1000"] },
  { scene: "06-confirm-keyboard", viewports: ["1440x1000"] },
  { scene: "07-notify-click-reload", viewports: ["1440x1000"] },
  { scene: "08-drawer-mouse", viewports: ["390x844"] },
  { scene: "09-drawer-touch", viewports: ["390x844"] },
  { scene: "10-toast-not-blocking", viewports: ["390x844"] },
];

/** 场景状态签名：证明「这一帧的操作真的发生过」，改名复用同一帧过不了（卡 §三.7） */
export function f2StateSignature(readout = {}) {
  const o = readout.overlay ?? {};
  const n = readout.notify ?? {};
  const d = readout.drawer ?? {};
  return [
    `path=${readout.path ?? ""}`,
    `shell=${readout.shell ?? ""}`,
    `kind=${o.kind ?? ""}`,
    `exists=${o.exists === true ? 1 : 0}`,
    `rules=${o.cssRules ?? ""}`,
    `rect=${o.box ? `${o.box.rect.x},${o.box.rect.y},${o.box.rect.w},${o.box.rect.h}` : ""}`,
    `pos=${o.box ? o.box.computed.position : ""}`,
    `shadow=${o.box ? String(o.box.computed.boxShadow).slice(0, 24) : ""}`,
    `btns=${(o.buttons ?? []).map((b) => `${b.label}:${b.hit ? 1 : 0}`).join("+")}`,
    `focus=${o.focus ? `${o.focus.insideBox ? 1 : 0}|${o.focus.activeLabel ?? ""}` : ""}`,
    `table=${readout.tableRendered === true ? 1 : 0}`,
    `writes=${readout.writes ? readout.writes.readAllRequests : ""}`,
    `throttle=${n.throttleKeyWritten === true ? 1 : 0}`,
    `notifyRect=${n.rect ? `${n.rect.x},${n.rect.y},${n.rect.w},${n.rect.h}` : ""}`,
    `reload=${n.documentReloads ?? ""}`,
    `drawer=${d.openBefore === true ? 1 : 0}>${d.closedAfter === true ? 1 : 0}:${d.method ?? ""}`,
    `toast=${redactText(readout.toast ?? "").slice(0, 40)}`,
    `blocked=${readout.primaryAction ? `${readout.primaryAction.label}:${readout.primaryAction.hit ? 1 : 0}` : ""}`,
    `keyTrail=${(readout.keyboardTrail ?? []).map((t) => `${t.insideBox ? 1 : 0}:${t.activeLabel}`).join(">")}`,
  ].join("|");
}

/** main.ts 缺哪几个样式入口（返回缺失项数组，空 = 达标） */
export function findMissingStyleEntries(mainSource = "") {
  return REQUIRED_STYLE_ENTRIES.filter((entry) => !mainSource.includes(`"${entry}"`));
}

/**
 * 确认框样式是否仍只是某个业务组件的副作用（卡 §三.2）。
 * 达标 = main.ts 里已有 message-box 入口；否则任何不渲染 ZxElTable 的页面都会退化成裸块。
 */
export function findOverlayStyleCoupling(mainSource = "") {
  const inEntry = REQUIRED_STYLE_ENTRIES.map((e) => ({ entry: e, present: mainSource.includes(`"${e}"`) }));
  const messageBoxAtEntry = inEntry.find((i) => i.entry === "element-plus/es/components/message-box/style/css")?.present === true;
  return { messageBoxAtEntry, entries: inEntry };
}

/** 场景是否缺席（三视口 + 关键操作帧都必须有） */
export function findMissingScenes(scenes = []) {
  const have = new Set(scenes.map((s) => `${s.viewport}|${s.scene}`));
  const missing = [];
  for (const req of REQUIRED_SCENES) {
    for (const vp of req.viewports) {
      if (!have.has(`${vp}|${req.scene}`)) missing.push({ viewport: vp, scene: req.scene });
    }
  }
  return missing;
}

const TRANSPARENT = new Set(["", "none", "transparent", "rgba(0, 0, 0, 0)"]);

function radiusPx(value = "") {
  const m = /(\d+(?:\.\d+)?)px/.exec(String(value));
  return m ? Number(m[1]) : 0;
}

/**
 * 浮层「有样式」的机器判据（卡 §五：真实运行态 DOM 矩形 + computed style 互证）：
 * 存在 + 视口内 + 定位脱离文档流 + 有背景 + 有圆角 + 有阴影 + 宽度受控 + 样式规则数达标。
 * 任一项不达标 ⇒ 判红（透明层、static 裸块都过不了这里）。
 */
export function findUnstyledOverlays(scenes = []) {
  const out = [];
  for (const s of scenes) {
    const o = s.readout?.overlay;
    if (!o || !o.required) continue;
    const bad = [];
    if (o.exists !== true) bad.push("DOM 中不存在");
    const box = o.box;
    if (box) {
      const c = box.computed ?? {};
      if (TRANSPARENT.has(String(c.backgroundColor ?? ""))) bad.push(`背景透明(${String(c.backgroundColor)})`);
      if (radiusPx(c.borderRadius) <= 0) bad.push(`无圆角(${String(c.borderRadius)})`);
      if (TRANSPARENT.has(String(c.boxShadow ?? ""))) bad.push(`无阴影(${String(c.boxShadow)})`);
      if (String(c.visibility) === "hidden" || Number(c.opacity) === 0) bad.push(`不可见(opacity=${String(c.opacity)} visibility=${String(c.visibility)})`);
      if (String(o.wrapper?.computed?.position) !== "fixed") bad.push(`遮罩未脱离文档流(position=${String(o.wrapper?.computed?.position)})`);
      if (box.rect.w > Math.floor((VIEWPORTS.find((v) => v.id === s.viewport)?.width ?? 1440) * MAX_OVERLAY_WIDTH_RATIO)) {
        bad.push(`宽度失控(${box.rect.w}px)`);
      }
    }
    if (Number(o.cssRules ?? 0) < MIN_CSS_RULES) bad.push(`匹配到的 CSS 规则仅 ${String(o.cssRules)}`);
    if (bad.length) out.push({ viewport: s.viewport, scene: s.scene, kind: o.kind, reasons: bad });
  }
  return out;
}

/** 浮层必须整块在视口内（卡 §三.4「固定且落在屏幕内」） */
export function findOffscreenOverlays(scenes = []) {
  const out = [];
  for (const s of scenes) {
    const o = s.readout?.overlay;
    if (!o?.required) continue;
    const vp = VIEWPORTS.find((v) => v.id === s.viewport);
    for (const [which, box] of [["面板", o.box], ["遮罩", o.wrapper]]) {
      const r = box?.rect;
      if (!r) {
        out.push({ viewport: s.viewport, scene: s.scene, part: which, reason: "无矩形读数" });
        continue;
      }
      const inside = r.x >= -1 && r.y >= -1 && r.x + r.w <= vp.width + 1 && r.y + r.h <= vp.height + 1 && r.w > 0 && r.h > 0;
      if (!inside) out.push({ viewport: s.viewport, scene: s.scene, part: which, reason: `矩形 ${r.x},${r.y},${r.w}x${r.h} 超出 ${vp.width}x${vp.height}` });
    }
  }
  return out;
}

/** 确认框按钮必须真的可点（elementFromPoint 命中 + 未禁用），不接受 force 点击（卡 §六） */
export function findUnoperableButtons(scenes = []) {
  const out = [];
  for (const s of scenes) {
    const want = s.expectButtons;
    if (!Array.isArray(want) || want.length === 0) continue;
    const got = s.readout?.overlay?.buttons ?? [];
    for (const label of want) {
      const b = got.find((x) => x.label === label);
      if (!b) out.push({ viewport: s.viewport, scene: s.scene, label, reason: "按钮不存在" });
      else if (b.enabled !== true) out.push({ viewport: s.viewport, scene: s.scene, label, reason: "按钮被禁用" });
      else if (b.hit !== true) out.push({ viewport: s.viewport, scene: s.scene, label, reason: `中心点被 ${b.hitBy ?? "未知元素"} 遮挡` });
    }
  }
  return out;
}

/**
 * 取消不写、确认才写（卡 §四.2）。
 * 判据取真实网络：`/admin/wb-notifications/read-all` 的请求次数，不看前端自述。
 */
export function findWriteMismatch(scenes = []) {
  const out = [];
  for (const s of scenes) {
    const expect = s.expectWrites;
    if (expect === undefined || expect === null) continue;
    const n = Number(s.readout?.writes?.readAllRequests ?? -1);
    if (n !== expect) out.push({ viewport: s.viewport, scene: s.scene, expected: expect, actual: n });
  }
  return out;
}

/**
 * 通知必须由生产代码触发（卡 §六「不伪造通知数据」）：
 * `zx_web_update_check_v1` 这个 localStorage 节流键只有 `modules/update/checker.ts` 会写，
 * 所以它是「真的跑了 checkWebUpdate()」的机器证据；测试端自己 new 一个通知过不了这里。
 */
export function findSyntheticNotification(scenes = []) {
  const out = [];
  for (const s of scenes) {
    const n = s.readout?.notify;
    if (!n?.required) continue;
    if (n.throttleKeyWritten !== true) out.push({ viewport: s.viewport, scene: s.scene, reason: "更新检查器未真实运行（节流键未写入）" });
    if (n.payloadSource !== "harness-version-stub" && n.payloadSource !== "backend") {
      out.push({ viewport: s.viewport, scene: s.scene, reason: `通知数据来源未声明（${String(n.payloadSource)}）` });
    }
    if (n.checkerHitsElNotification !== true) out.push({ viewport: s.viewport, scene: s.scene, reason: "未观察到 checker 的文案模板产出" });
  }
  return out;
}

/** 键盘必须能进入确认框并操作按钮（卡 §四.5） */
export function findKeyboardBlocked(scenes = []) {
  const out = [];
  for (const s of scenes) {
    if (s.expectKeyboard !== true) continue;
    const f = s.readout?.overlay?.focus;
    if (f?.insideBox !== true) out.push({ viewport: s.viewport, scene: s.scene, reason: `焦点未进入确认框（activeElement=${String(f?.activeClass || f?.activeTag)}）` });
    if (s.expectKeyboardEnter === true && Number(s.readout?.writes?.readAllRequests ?? -1) !== 1) {
      out.push({ viewport: s.viewport, scene: s.scene, reason: "回车未真正触发确认写操作" });
    }
  }
  return out;
}

/**
 * 抽屉回归（卡 §三.6 + §四.4）：390×844 上鼠标与触摸都必须真的关掉抽屉，
 * 且不得用 force 点击绕过（forceUsed 必须为 false，命中点由 elementFromPoint 网格实探）。
 */
export function findStuckDrawer(scenes = []) {
  const out = [];
  for (const s of scenes) {
    const d = s.readout?.drawer;
    if (!d?.required) continue;
    if (d.forceUsed === true) out.push({ viewport: s.viewport, scene: s.scene, reason: "使用了 force 点击（红线）" });
    if (d.openBefore !== true) out.push({ viewport: s.viewport, scene: s.scene, reason: "抽屉没有先打开" });
    if (d.closedAfter !== true) out.push({ viewport: s.viewport, scene: s.scene, reason: `抽屉关不掉（method=${String(d.method)}）` });
  }
  const methods = new Set(scenes.filter((s) => s.readout?.drawer?.required).map((s) => s.readout.drawer.method));
  for (const m of ["mouse", "touch"]) if (!methods.has(m)) out.push({ viewport: "390x844", scene: `drawer-${m}`, reason: `缺少 ${m} 关闭方式的真实证据` });
  return out;
}

/** 提示不得盖住主操作（卡 §四.6）：toast 在屏时，主操作按钮中心点仍须命中自己 */
export function findToastBlockingAction(scenes = []) {
  const out = [];
  for (const s of scenes) {
    const p = s.readout?.primaryAction;
    if (!p?.required) continue;
    if (String(s.readout?.toast ?? "").trim() === "" && p.toastExpected === true) {
      out.push({ viewport: s.viewport, scene: s.scene, reason: "没有出现在屏上的提示，无法证明不遮挡" });
    }
    if (p.hit !== true) out.push({ viewport: s.viewport, scene: s.scene, reason: `主操作「${p.label}」被 ${p.hitBy ?? "提示层"} 盖住` });
  }
  return out;
}

/** 逐视口内 PNG 是否各帧唯一（改名复用同帧过不了） */
export function countFrames(scenes = []) {
  const by = new Map();
  for (const s of scenes) by.set(s.viewport, (by.get(s.viewport) ?? 0) + 1);
  return [...by.entries()].map(([viewport, frames]) => ({ viewport, frames })).sort((a, b) => a.viewport.localeCompare(b.viewport));
}

/**
 * 横向裁切（沿用 F1 口径：生产壳 overflowX 必须为 0）。
 * 唯一豁免必须是「看得见的旧壳」：更新通知/强制帧只能挂在 `checkWebUpdate()` 的既有挂载点
 * （MainLayout）上，而旧壳本身不做窄屏适配 ⇒ 390 的溢出登记为已知产品缺口（卡 §六「不用 hack
 * 把错误布局推到首屏」的反面：这里既不推，也不静默放行，读数里 shell 必须是 mainlayout 才豁免）。
 */
export function findClippedF2(scenes = []) {
  const out = [];
  for (const s of scenes) {
    const ovf = Number(s.overflowX ?? 0);
    if (ovf === 0) continue;
    if (s.readout?.shell === "mainlayout" && s.legacyLayout === true) continue;
    out.push({ viewport: s.viewport, scene: s.scene, overflowX: ovf, shell: String(s.readout?.shell) });
  }
  return out;
}

/** 旧壳溢出的豁免帧（显式列出，供 receipt / 回传卡登记产品缺口，不静默丢弃） */
export function listLegacyOverflow(scenes = []) {
  return scenes
    .filter((s) => Number(s.overflowX ?? 0) !== 0 && s.readout?.shell === "mainlayout" && s.legacyLayout === true)
    .map((s) => ({ viewport: s.viewport, scene: s.scene, overflowX: s.overflowX }));
}

/** 汇总门禁违例：空数组 = 证据合格 */
export function collectViolationsF2(bundle = {}) {
  const scenes = bundle.scenes ?? [];
  const out = [];
  for (const g of findDuplicateHashes(scenes)) out.push(`重复平图：${g.viewport} 内 ${g.scenes.join("、")} 的 PNG SHA256 完全一致（${g.sha256.slice(0, 12)}…）`);
  const dupSig = new Map();
  for (const s of scenes) {
    const key = `${s.viewport}|${s.stateSignature}`;
    dupSig.set(key, [...(dupSig.get(key) ?? []), s.scene]);
  }
  for (const [key, list] of dupSig) if (list.length > 1) out.push(`状态签名重复：${key.split("|")[0]} 内 ${list.join("、")} 的操作读数完全一致（未真实切换）`);
  for (const m of findMissingScenes(scenes)) out.push(`证据场景缺席：${m.viewport}/${m.scene}`);
  for (const v of findMissingViewports(scenes)) out.push(`视口缺口：${v} 无证据帧`);
  for (const u of findUnstyledOverlays(scenes)) out.push(`浮层无样式：${u.viewport}/${u.scene}（${u.kind}）→ ${u.reasons.join("；")}`);
  for (const o of findOffscreenOverlays(scenes)) out.push(`浮层出屏：${o.viewport}/${o.scene} ${o.part} → ${o.reason}`);
  for (const b of findUnoperableButtons(scenes)) out.push(`按钮不可点：${b.viewport}/${b.scene}「${b.label}」→ ${b.reason}`);
  for (const w of findWriteMismatch(scenes)) out.push(`写操作与预期不符：${w.viewport}/${w.scene} 期望 ${w.expected} 次，实际 ${w.actual} 次`);
  for (const n of findSyntheticNotification(scenes)) out.push(`通知非生产路径：${n.viewport}/${n.scene} → ${n.reason}`);
  for (const k of findKeyboardBlocked(scenes)) out.push(`键盘操作受阻：${k.viewport}/${k.scene} → ${k.reason}`);
  for (const d of findStuckDrawer(scenes)) out.push(`抽屉回归：${d.viewport}/${d.scene} → ${d.reason}`);
  for (const t of findToastBlockingAction(scenes)) out.push(`提示遮挡主操作：${t.viewport}/${t.scene} → ${t.reason}`);
  for (const c of findClippedF2(scenes)) out.push(`横向裁切：${c.viewport}/${c.scene} overflowX=${c.overflowX}（生产壳要求 0，读数壳层=${c.shell}）`);
  const blank = scenes.filter((s) => Number(s.bytes ?? 0) < MIN_PNG_BYTES);
  for (const b of blank) out.push(`疑似空帧：${b.viewport}/${b.scene} bytes=${b.bytes}`);
  for (const e of bundle.sceneErrors ?? []) out.push(`场景采集失败：${e.viewport}/${e.scene} ${e.stage} → ${e.error}`);
  const allowedPorts = new Set((bundle.network?.expectedOffline ?? []).map((e) => Number(e.port)));
  const closed = new Set((bundle.network?.recovered ?? []).map((f) => f.signature));
  for (const f of bundle.network?.failures ?? []) {
    if (allowedPorts.has(Number(f.port)) || closed.has(f.signature)) continue;
    out.push(`未闭合网络失败：${f.method} ${f.url} → ${f.error}`);
  }
  const servers = bundle.servers ?? {};
  if (servers.portsAllDown !== true) out.push(`服务未自停：${servers.backendPort}/${servers.webPort} 未全部 DOWN`);
  if (bundle.apiBase !== "/api") out.push(`API 基址未统一：${String(bundle.apiBase)}（要求同源 /api 代理）`);
  return out;
}
