/**
 * WORKBENCH-13-F1 · 场景证据的门禁逻辑（纯函数，无 IO、无网络）
 *
 * 为什么单独成文件：凌舟驳回 §二.1/§二.5 —— 专项测试读的是**工作树外**的
 * `evidence/`、`tools/` 文件，clean 检出后那些文件不存在，绿色无法复现。
 * 这里把「重复平图判红 / 横向裁切判红 / 场景未真实切换判红」的判定规则
 * 收敛成可单测的纯函数，随仓入库；`uiux-complete.spec.mjs` 只依赖本文件与
 * 同目录的 `fixtures/uiux-scene-measures.json`（真实采集产物，入库）。
 *
 * 采集端 `uiux-scenarios.mjs` 复用同一批函数 ⇒ 判定与采集不可能口径分叉。
 */

/** 三视口（卡 §三.11） */
export const VIEWPORTS = [
  { id: "1440x1000", width: 1440, height: 1000 },
  { id: "1024x768", width: 1024, height: 768 },
  { id: "390x844", width: 390, height: 844 },
];

/** 卡 §三.10：主场景（非辅助图）至少 15 个真正不同的场景 */
export const MIN_PRIMARY_SCENES = 15;

/** 辅助图命名前缀：允许与主场景重复，但必须分开命名（卡 §三.10） */
export const AUXILIARY_PREFIX = "aux-";

/**
 * 已知的「离线依赖」端口：AI 编排服务 3016 本地未起。
 * 卡 §三.9 允许单列，但只按端口+路径白名单放行，不得泛化吞掉失败。
 */
export const EXPECTED_OFFLINE_ENDPOINTS = [
  { port: 3016, reason: "AI 编排服务（本地未启动，单列不并入 CORS）" },
];

/** 场景名以 `aux-` 开头者视为辅助图 */
export function isAuxiliary(sceneName) {
  return typeof sceneName === "string" && sceneName.startsWith(AUXILIARY_PREFIX);
}

/**
 * 状态签名：截图之外、能证明「画面确实切换过」的结构读数。
 * 只看状态，不看像素 ⇒ 两个场景签名相同 = 没有真实切换（卡 §三.4/§三.6）。
 */
export function sceneStateSignature(readout = {}) {
  const keys = [
    "path",
    "mode",
    "feedShown",
    "chatShown",
    "manualShown",
    "settingTab",
    "dialogHeader",
    "activePane",
    "overlayCount",
    "dialogCount",
    "emptyCount",
    "menuLoading",
    "menuFault",
    "menuRetry",
    "menuEmpty",
    "railSkeletonCount",
    "railKeys",
    "selectedRailKey",
    "pendingRailKey",
    "pendingRailPressed",
    "railAriaDisabledCount",
    "sideCollapsed",
    "drawerOpen",
    "ledgerOpen",
    "dirState",
    "wiringNote",
    "subZoneTitle",
    "toast",
    "composerVisible",
    "chatMsgCount",
    "chatLastUserText",
    "chatSessionsOpen",
    "aiFault",
    "bizRows",
    "bizFirstRow",
    "title",
    "uiuxInject",
  ];
  return keys
    .map((k) => {
      const v = readout[k];
      return `${k}=${Array.isArray(v) ? v.join("+") : v === undefined ? "" : String(v)}`;
    })
    .join("|");
}

/** 同视口内 SHA256 重复（辅助图除外）⇒ 判红 */
export function findDuplicateHashes(scenes = []) {
  const groups = new Map();
  for (const s of scenes) {
    if (isAuxiliary(s.scene)) continue;
    if (!s.sha256) continue;
    const key = `${s.viewport}|${s.sha256}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s.scene);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ viewport: key.split("|")[0], sha256: key.split("|")[1], scenes: list }));
}

/** 同视口内状态签名重复 ⇒ 采集端没有真实切换（判红） */
export function findDuplicateSignatures(scenes = []) {
  const groups = new Map();
  for (const s of scenes) {
    if (isAuxiliary(s.scene)) continue;
    const key = `${s.viewport}|${s.stateSignature}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s.scene);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ viewport: key.split("|")[0], scenes: list }));
}

/** 横向裁切（卡 §三.11：三视口 overflowX 必须为 0） */
export function findClipped(scenes = []) {
  return scenes
    .filter((s) => !isAuxiliary(s.scene))
    .filter((s) => Number(s.overflowX) !== 0)
    .map((s) => ({ viewport: s.viewport, scene: s.scene, overflowX: s.overflowX }));
}

/** 三视口是否都有主场景证据 */
export function findMissingViewports(scenes = []) {
  const covered = new Set(scenes.filter((s) => !isAuxiliary(s.scene)).map((s) => s.viewport));
  return VIEWPORTS.map((v) => v.id).filter((id) => !covered.has(id));
}

/** 主场景去重后的数量（跨视口按场景名去重） */
export function countPrimaryScenes(scenes = []) {
  return new Set(scenes.filter((s) => !isAuxiliary(s.scene)).map((s) => s.scene)).size;
}

/** 可见性下限：只有 URL 变化、画面仍是空壳 ⇒ 判红（卡 §三.3「不得仅凭 URL 变化证明页面可见」） */
export const MIN_BODY_TEXT_LEN = 30;
export const MIN_PNG_BYTES = 8000;

export function findBlankFrames(scenes = []) {
  return scenes
    .filter((s) => !isAuxiliary(s.scene))
    .filter((s) => Number(s.bytes ?? 0) < MIN_PNG_BYTES || Number(s.readout?.bodyTextLen ?? 0) < MIN_BODY_TEXT_LEN)
    .map((s) => ({
      viewport: s.viewport,
      scene: s.scene,
      bytes: s.bytes,
      bodyTextLen: s.readout?.bodyTextLen,
    }));
}

/**
 * 未命中告警必须看得见（卡 §三.8）：`toast` 读数只收「视口内 + 不透明」的提示，
 * 所以「场景名带 intent-miss 但 toast 为空」= 告警在 DOM 里却不在屏幕上 ⇒ 判红。
 */
export function findSilentWarnings(scenes = []) {
  return scenes
    .filter((s) => !isAuxiliary(s.scene) && /intent-miss/.test(s.scene))
    .filter((s) => !String(s.readout?.toast ?? "").trim())
    .map((s) => ({ viewport: s.viewport, scene: s.scene }));
}

/**
 * 注入态与生产态必须各自留痕（卡 §三.4 + §六「不得用注入冒充生产可达」）：
 *   contract=production ⇒ data-uiux-inject 必须为 off；
 *   contract=injected   ⇒ 必须为 on（截图上有水印角标）。
 */
export function findInjectionMislabel(scenes = []) {
  return scenes
    .filter((s) => s.contract === "production" || s.contract === "injected")
    .filter((s) => (s.contract === "injected" ? s.readout?.uiuxInject !== "on" : s.readout?.uiuxInject !== "off"))
    .map((s) => ({ viewport: s.viewport, scene: s.scene, contract: s.contract, uiuxInject: s.readout?.uiuxInject }));
}

/**
 * 网络审计（卡 §三.9）：只允许「已声明的离线端口」，其余一律判红。
 * 同一 URL 既有失败又有成功（重试闭合）不算未闭合。
 */
export function findUnresolvedNetwork(audit = {}) {
  const failures = audit.failures ?? [];
  const allowedPorts = new Set(EXPECTED_OFFLINE_ENDPOINTS.map((e) => e.port));
  const closed = new Set((audit.recovered ?? []).map((f) => f.signature));
  return failures
    .filter((f) => !allowedPorts.has(Number(f.port)))
    .filter((f) => !closed.has(f.signature))
    .map((f) => ({ method: f.method, url: f.url, port: f.port, error: f.error }));
}

/** 离线端口是否被单列（不是被忽略，而是显式记录） */
export function findExpectedOffline(audit = {}) {
  const allowedPorts = new Set(EXPECTED_OFFLINE_ENDPOINTS.map((e) => e.port));
  return (audit.failures ?? []).filter((f) => allowedPorts.has(Number(f.port)));
}

/**
 * 一次性汇总所有门禁违例。空数组 = 证据合格。
 * 采集端与专项测试共用，保证「机器判红」与「人工看截图」是同一套规则。
 */
export function collectViolations(bundle = {}) {
  const scenes = bundle.scenes ?? [];
  const out = [];
  for (const g of findDuplicateHashes(scenes)) {
    out.push(`重复平图：${g.viewport} 内 ${g.scenes.join("、")} 的 PNG SHA256 完全一致（${g.sha256.slice(0, 12)}…）`);
  }
  for (const g of findDuplicateSignatures(scenes)) {
    out.push(`场景未真实切换：${g.viewport} 内 ${g.scenes.join("、")} 的结构读数一致`);
  }
  for (const c of findClipped(scenes)) {
    out.push(`横向裁切：${c.viewport}/${c.scene} overflowX=${c.overflowX}（要求 0）`);
  }
  for (const b of findBlankFrames(scenes)) {
    out.push(`疑似空帧：${b.viewport}/${b.scene} bytes=${b.bytes} bodyTextLen=${b.bodyTextLen}（不得仅凭 URL 变化声明可见）`);
  }
  for (const m of findSilentWarnings(scenes)) {
    out.push(`告警不可见：${m.viewport}/${m.scene} 意图未命中却没有屏幕上的可重试提示（卡 §三.8 要求不静默）`);
  }
  for (const m of findInjectionMislabel(scenes)) {
    out.push(`注入态留痕不符：${m.viewport}/${m.scene} 声明 ${m.contract} 但 data-uiux-inject=${String(m.uiuxInject)}`);
  }
  for (const v of findMissingViewports(scenes)) {
    out.push(`视口缺口：${v} 无主场景证据`);
  }
  const primary = countPrimaryScenes(scenes);
  if (primary < MIN_PRIMARY_SCENES) {
    out.push(`真不同场景不足：主场景 ${primary} 个 < ${MIN_PRIMARY_SCENES}（卡 §三.10）`);
  }
  for (const n of findUnresolvedNetwork(bundle.network ?? {})) {
    out.push(`未闭合网络失败：${n.method} ${n.url} → ${n.error}`);
  }
  const servers = bundle.servers ?? {};
  if (servers.portsAllDown !== true) {
    out.push(
      `服务未自停：${servers.backendPort ?? 8080}/${servers.webPort ?? 5199} 未全部 DOWN（portsAllDown=${String(servers.portsAllDown)}）`,
    );
  }
  if (bundle.apiBase !== "/api") {
    out.push(`API 基址未统一：${String(bundle.apiBase)}（要求同源 /api 代理）`);
  }
  return out;
}

/**
 * 脱敏：证据文件里不得出现 JWT / token 参数（常驻约束）。
 * 只处理已知凭据形态，不改变其余文本。
 */
export function redactText(text) {
  return String(text ?? "")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "<REDACTED_JWT>")
    .replace(/Bearer\s+[A-Za-z0-9._-]{12,}/gi, "Bearer <REDACTED>")
    .replace(/([?&]token=)[^&\s"']+/gi, "$1<REDACTED>")
    .replace(/("(?:csrfToken|accessToken|refreshToken|password)"\s*:\s*")[^"]*(")/gi, "$1<REDACTED>$2");
}

/** 从 URL 提取端口，用于离线白名单判定 */
export function portOfUrl(url) {
  try {
    const u = new URL(url);
    return Number(u.port || (u.protocol === "https:" ? 443 : 80));
  } catch {
    return null;
  }
}
