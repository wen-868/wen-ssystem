/**
 * WORKBENCH-13-F2/F3 · A 段采集器（原型并排 + DOM/computed 差异表 + 机器门禁）
 *
 * 卡 §三.A.1 与 §五.1 要的是「在 1440×1000 同时采集原型和实现，提交并排截图与
 * DOM/computed 差异表」，卡 §六 又禁止「用代码类名或近似截图替代原型并排视觉验收」
 * ⇒ 本采集器不做任何源码字符串比对，而是在**同一次浏览器运行**里：
 *   1) 用 file:// 打开权威原型（先核 SHA256，指纹不符直接中止）；
 *   2) 自起自停后端与同源 /api 代理，用真实 SUPER_ADMIN 登录态打开默认工作台；
 *   3) 用**同一个页面函数**分别量两侧各区域的 rect + computed；
 *   4) 生成一张左右并排对照图，并让机器核对两侧面板确实同视口同高；
 *   5) 逐指标算差值 ⇒ 超容差且无书面解释即判红。
 *
 *  服务起停/登录/网络审计与 B 段采集器 `f2-func-styles.mjs` 同一口径；这里刻意自带一份
 * 实现而不去改已交付并通过反测的 B 段脚本，避免「为跑 A 段而动 B 段证据链」的耦合。
 *
 * F3 增量（卡 WORKBENCH-13-…-F3 §三.A「同状态」）：
 *   · 测量与截图前，两侧的**活跃模态**必须清零：原型 `#setwin.show`/`#login`/`#posPay`… 与
 *     实现 `.el-overlay`/`.el-notification`。「活跃」口径 = display≠none 且 visibility≠hidden
 *     且 opacity>0.05 且 pointer-events≠none 且尺寸>40px —— F2 曾把 opacity:0/pointer-events:none
 *     的常驻 `#mask` 误报成浮层，正是缺了这条口径；
 *   · 关闭只走真实交互：真实 Escape 键（原型 V.FIXES F7 / Element Plus 自带），再不行就
 *     elementFromPoint 实探遮罩空白点 + 真实鼠标点击，由弹层自己的 onclick 关闭；
 *     绝不手动 add/remove class —— 那是「把状态推给截图」（卡 §六 禁止）；
 *   · 两侧各由区域读数派生一份**状态签名**（视口+面+活跃模态数+逐区在场位向量），
 *     写进并排图 figcaption（进 PNG 证据）与 bundle；签名不等 ⇒ 门禁直接判红（§三.A.3）；
 *   · 主面五区在 REGION_CONTRACT 里升为 required：数据不可得也只能原位诚实占位，不得删区块（§三.B.6）。
 *
 * 用法（admin-web 目录）：
 *   node tests/f2a-visual-baseline.mjs <evidenceDir 绝对路径> [--only=1440x1000] [--keep-servers]
 * 环境变量：WB13_BACKEND_PORT（默认 8080）/ WB13_WEB_PORT（默认 5199）/ WB13_CHROME
 *           WB13_PROTOTYPE / WB13_PROTOTYPE_SHA256（默认取卡面权威值）
 *
 * 输出：
 *   <evidenceDir>/shots/proto-1440x1000.png               原型同视口截图
 *   <evidenceDir>/shots/impl-1440x1000.png                实现同视口截图
 *   <evidenceDir>/shots/side-by-side-1440x1000.png        并排对照图（机器核对同视口）
 *   <evidenceDir>/shots/impl-1024x768.png / impl-390x844.png  其余视口无裁切证据
 *   <evidenceDir>/measure/f2a-visual-measures.json        差异表 + 读数 + 门禁结果
 *   <evidenceDir>/logs/f2a-harness.json                   服务起停 / 网络尾部日志
 *   admin-web/tests/fixtures/f2a-visual-measures.json     仓内副本（专项测试只读它）
 */
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EXPECTED_OFFLINE_ENDPOINTS, VIEWPORTS, portOfUrl, redactText } from "./uiux-scenarios-lib.mjs";
import {
  BASE_VIEWPORT,
  BODY_ORDER,
  IMPL_ONLY_VIEWPORTS,
  REGION_CONTRACT,
  RAIL_VISIBLE_COUNT,
  RAIL_VISIBLE_LABELS,
  SIDE_ORDER,
  buildDiffTable,
  buildRailRows,
  collectViolationsF2A,
  gatedStats,
  stateSignatureOf,
} from "./f2a-visual-baseline-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");

const args = process.argv.slice(2);
const EVIDENCE = args.find((a) => !a.startsWith("--"));
if (!EVIDENCE) {
  console.error("用法：node tests/f2a-visual-baseline.mjs <evidenceDir> [--only=<viewport>] [--keep-servers]");
  process.exit(2);
}
const ONLY = (args.find((a) => a.startsWith("--only=")) ?? "").replace("--only=", "");
const KEEP_SERVERS = args.includes("--keep-servers");
const OUT = path.resolve(EVIDENCE);
mkdirSync(path.join(OUT, "shots"), { recursive: true });
mkdirSync(path.join(OUT, "measure"), { recursive: true });
mkdirSync(path.join(OUT, "logs"), { recursive: true });

const BACKEND_PORT = Number(process.env.WB13_BACKEND_PORT ?? 8080);
const WEB_PORT = Number(process.env.WB13_WEB_PORT ?? 5199);
const ORIGIN = `http://localhost:${WEB_PORT}`;
const API_BASE = "/api";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
/** 权威原型：卡面题头给出的路径与 SHA256 */
const PROTO_FILE = process.env.WB13_PROTOTYPE ?? "D:/Users/ZXQL/ZXQL-WORK/projects/ai/design/智享全链_工作台电脑端_UI原型_融合版.html";
const PROTO_SHA_EXPECT = (process.env.WB13_PROTOTYPE_SHA256 ?? "6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51").toUpperCase();
const PROTO_URL = pathToFileURL(PROTO_FILE).href;

/**
 * rail 两侧选择器：原型是真相源（`.rl-*`），实现是新壳（`.wb-rail-*`）。
 * 骨架项与真实项互斥是 F1 既有契约，所以实现侧的 item 排除骨架，另把骨架单独计数。
 */
const RAIL_SELECTORS = {
  proto: {
    container: "nav.rail",
    logo: "nav.rail .rl-logo",
    item: "nav.rail .rl-it:not(.rl-set)",
    gap: "nav.rail .rl-gap",
    settings: "nav.rail .rl-set",
    skeleton: "",
  },
  impl: {
    container: '[data-testid="rail"]',
    logo: '[data-testid="rail"] .wb-rail-logo',
    item: '[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton)',
    gap: '[data-testid="rail"] .wb-rail-gap',
    settings: '[data-testid="rail"] .wb-rail-set',
    skeleton: '[data-testid="rail"] [data-rail-skeleton="true"]',
  },
};

const harnessLog = [];
const backendTail = [];
const log = (msg) => {
  harnessLog.push(`${new Date().toISOString()} ${msg}`);
  console.log(msg);
};

/* ────────────────────────── 服务自起自停（与 B 段同一口径） ────────────────────────── */

function probeHost(host, port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (up) => {
      sock.destroy();
      resolve(up);
    };
    sock.setTimeout(800);
    sock.on("connect", () => done(true));
    sock.on("error", () => done(false));
    sock.on("timeout", () => done(false));
  });
}
/** vite 6 本机把 localhost 解析到 IPv6 ⇒ 双栈都探，否则会把已就绪误判成未就绪 */
async function probePort(port) {
  for (const host of ["127.0.0.1", "::1"]) if (await probeHost(host, port)) return true;
  return false;
}
function pidsListeningOn(port) {
  try {
    return execFileSync("netstat", ["-ano"], { encoding: "utf8" })
      .split("\n")
      .filter((l) => /LISTENING/i.test(l) && new RegExp(`[:.]${port}\\s`).test(l))
      .map((l) => l.trim().split(/\s+/).pop())
      .filter((p) => /^\d+$/.test(p));
  } catch {
    return [];
  }
}
async function forceFreePort(port) {
  for (let round = 0; round < 6; round++) {
    const pids = [...new Set(pidsListeningOn(port))];
    if (pids.length === 0 && !(await probePort(port))) return true;
    for (const pid of pids) {
      try {
        execFileSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
        log(`清理端口 ${port} 上的残留监听 pid=${pid}`);
      } catch {
        /* 已退出 */
      }
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return !(await probePort(port));
}
async function waitForPort(port, up, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if ((await probePort(port)) === up) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
const children = [];
const boundPorts = new Set();
function killTree(child, label) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
    log(`已停止 ${label}（pid=${child.pid}）`);
  } catch (e) {
    log(`停止 ${label} 失败：${String(e).slice(0, 120)}`);
  }
}
async function startBackend() {
  if (await probePort(BACKEND_PORT)) {
    throw new Error(`端口 ${BACKEND_PORT} 已被占用：采集器要求自起自停（本卡用 WB13_BACKEND_PORT 换空闲端口，不代别人杀进程）`);
  }
  const child = spawn(process.execPath, ["scripts/dev-mock.mjs"], {
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      USE_MOCK_DB: "true",
      NODE_ENV: "development",
      PORT: String(BACKEND_PORT),
      // 本地一次性开发密钥：随机派生，不写进仓库，也不落进任何证据文件
      JWT_SECRET: createHash("sha256").update(`${Date.now()}-jwt`).digest("hex"),
      CSRF_SECRET: createHash("sha256").update(`${Date.now()}-csrf`).digest("hex"),
    },
  });
  children.push({ child, label: `backend:${BACKEND_PORT}` });
  child.stdout.on("data", (b) => backendTail.push(String(b)));
  child.stderr.on("data", (b) => backendTail.push(String(b)));
  if (!(await waitForPort(BACKEND_PORT, true))) throw new Error(`后端 ${BACKEND_PORT} 未在 90s 内就绪`);
  boundPorts.add(BACKEND_PORT);
  log(`后端 mock 已起（127.0.0.1:${BACKEND_PORT}，USE_MOCK_DB=true）`);
}
async function startVite() {
  if (await probePort(WEB_PORT)) {
    throw new Error(`端口 ${WEB_PORT} 已被占用：采集器要求自起自停（本卡用 WB13_WEB_PORT 换空闲端口）`);
  }
  const child = spawn(
    process.execPath,
    [path.join(REPO, "node_modules", "vite", "bin", "vite.js"), "--port", String(WEB_PORT), "--strictPort"],
    {
      cwd: WEB,
      stdio: ["ignore", "pipe", "pipe"],
      // API 基址同源 /api，由 vite 代理到本机后端 ⇒ 不产生可避免的跨域失败
      env: { ...process.env, VITE_API_BASE: API_BASE, VITE_API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
    },
  );
  children.push({ child, label: `vite:${WEB_PORT}` });
  child.stdout.on("data", (b) => harnessLog.push(`[vite] ${String(b).trim()}`));
  child.stderr.on("data", (b) => harnessLog.push(`[vite-err] ${String(b).trim()}`));
  if (!(await waitForPort(WEB_PORT, true, 210000))) throw new Error(`vite ${WEB_PORT} 未在 210s 内就绪`);
  boundPorts.add(WEB_PORT);
  log(`前端 dev server 已起（${ORIGIN}，VITE_API_BASE=${API_BASE}）`);
}
let portsAllDown = false;
async function stopAll() {
  if (KEEP_SERVERS) {
    log("--keep-servers：保留服务（仅本地调试用，正式证据不得带此开关）");
    return false;
  }
  for (const c of children.slice().reverse()) killTree(c.child, c.label);
  const stillUp = [];
  for (const p of [BACKEND_PORT, WEB_PORT]) {
    if (!boundPorts.has(p)) {
      if (await probePort(p)) stillUp.push(p);
      continue;
    }
    if (!(await forceFreePort(p))) stillUp.push(p);
  }
  portsAllDown = stillUp.length === 0;
  log(`端口收尾：${portsAllDown ? `${BACKEND_PORT}/${WEB_PORT} 全部 DOWN` : `仍在线 ${stillUp.join(",")}`}`);
  return portsAllDown;
}
async function loginViaProxy() {
  let lastError = "未发起请求";
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const res = await fetch(`${ORIGIN}${API_BASE}/admin/auth/demo-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.data?.token) {
        log(`经 ${ORIGIN}${API_BASE} 同源代理登录成功（第 ${attempt} 次）：user=${j.data.user?.username} roles=${JSON.stringify(j.data.user?.roles ?? [])}`);
        return j.data;
      }
      const detail = `HTTP ${res.status} ${redactText(JSON.stringify(j ?? {})).slice(0, 160)}`;
      if (res.status < 500) throw new Error(`经 /api 代理登录失败：${detail}`);
      lastError = detail;
    } catch (e) {
      const msg = redactText(String(e));
      if (msg.includes("经 /api 代理登录失败")) throw e;
      lastError = msg;
    }
    log(`  · 登录第 ${attempt} 次未就绪（${lastError.slice(0, 80)}），3s 后重试`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`经 /api 代理登录始终失败：${lastError}`);
}

/* ────────────────────────── 页面侧量取（原型与实现共用同一个自包含函数） ────────────────────────── */

/**
 * 只量屏幕上真实渲染出来的东西：getBoundingClientRect + getComputedStyle。
 * 区域缺失也要留 exists=false 的读数 —— 「读不到」本身就是门禁输入，不许静默跳过。
 */
function pageReader({ sideKey, contract }) {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.01;
  };
  const out = {};
  for (const region of contract) {
    const sel = region[sideKey] ?? "";
    const el = document.querySelector(sel);
    if (!el) {
      out[region.key] = { exists: false, selector: sel, metrics: {} };
      continue;
    }
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    const segSel = (contract.find((c) => c.key === "segBar") ?? {})[sideKey];
    const bar = segSel ? document.querySelector(segSel) : null;
    const inBar = !!bar && bar.contains(el);
    const barBtns = inBar ? [...bar.querySelectorAll("button,[role=button],a")].filter((b) => b !== el && isVisible(b)) : [];
    out[region.key] = {
      exists: true,
      visible: isVisible(el),
      selector: sel,
      metrics: {
        x: Math.round(r.x * 100) / 100,
        y: Math.round(r.y * 100) / 100,
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
        right: Math.round(r.right * 100) / 100,
        bottom: Math.round(r.bottom * 100) / 100,
        display: st.display,
        visibility: st.visibility,
        opacity: st.opacity,
        position: st.position,
        backgroundColor: st.backgroundColor,
        padding: st.padding,
        gap: st.gap,
        borderRadius: st.borderTopLeftRadius,
        borderStyle: st.borderTopStyle,
        borderTopWidth: st.borderTopWidth,
        borderTopColor: st.borderTopColor,
        borderBottomWidth: st.borderBottomWidth,
        borderBottomColor: st.borderBottomColor,
        boxShadow: st.boxShadow === "none" ? "none" : "set",
        flexDirection: st.flexDirection,
        fontSize: st.fontSize,
        gridColumns: st.gridTemplateColumns === "none" ? "none" : st.gridTemplateColumns,
        marginBottom: st.marginBottom,
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
        focusable: ["INPUT", "BUTTON", "A"].includes(el.tagName) || el.tabIndex >= 0,
        ariaLabel: el.getAttribute("aria-label") ?? "",
        /** 新对话必须在员工/对话横栏内且位于最右（1=是，0=横栏内右侧还有别的控件，null=不在横栏内） */
        rightMostWithinBar: inBar ? (barBtns.every((b) => b.getBoundingClientRect().right <= r.right + 0.5) && barBtns.length >= 1 ? 1 : 0) : null,
      },
    };
  }
  out.__page = {
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    viewport: { width: innerWidth, height: innerHeight },
    title: document.title,
    url: location.href.replace(/[?#].*$/, ""),
    uiuxInject: document.querySelector('[data-testid="wb-shell"]')?.getAttribute("data-uiux-inject") ?? "absent",
    shell: document.querySelector('[data-testid="wb-shell"]') ? "v2" : document.querySelector(".layout .global-header") ? "mainlayout" : "none",
    feedShown: !!document.querySelector('[data-view="feed"].shown'),
  };
  return out;
}

/** 侧栏里所有「新对话」形态的可点节点（卡 §三.A.6 要求整宽那颗真的消失） */
function newChatScanner() {
  return [...document.querySelectorAll("button,[role=button],a,div")]
    .filter((el) => {
      const t = (el.textContent || "").trim().replace(/\s+/g, "");
      const cls = String(el.className || "").toLowerCase();
      return (t.includes("新对话") && t.length <= 8) || cls.includes("newchat");
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const isGradient = st.backgroundImage.includes("gradient");
      return {
        selector: `${el.tagName.toLowerCase()}.${(String(el.className || "").split(/\s+/)[0] ?? "").slice(0, 30)}`.slice(0, 48),
        testid: el.getAttribute("data-testid") ?? "",
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
        top: Math.round(r.top * 100) / 100,
        background: (isGradient ? "gradient " : "") + st.backgroundColor,
        text: (el.textContent || "").trim().replace(/\s+/g, "").slice(0, 12),
      };
    });
}

/**
 * F3 §三.A.1：原型层里会自己弹出来的模态（设置中心大弹窗 / 登录层 / 收银台支付层…）。
 * `#mask` 常驻 DOM 但从未被加 `.show`（opacity:0 + pointer-events:none），F2 的旧扫描把它
 * 误报成浮层 —— 所以「活跃」必须由下面的口径判定，而不是「节点存在且 fixed」。
 */
const PROTO_MODAL_SELECTORS = ["#setwin", "#mask", "#login", "#posPay", "#bizMask", "#actHelp", "#sDlgBox"];
/** 实现侧的模态形态：Element Plus 遮罩层 + 通知（默认工作台两者都应为 0） */
const IMPL_MODAL_SELECTORS = [".el-overlay", ".el-notification"];

/**
 * 页面函数：找出**真的在挡用户**的模态 —— display≠none、visibility≠hidden、
 * opacity>0.05、pointer-events≠none、尺寸>40px。原型常驻 inert 遮罩与 EP 关闭后残留的
 * display:none 层都会被正确排除，读数只反映绘制态。
 */
function activeModalScanner(selectors) {
  const out = [];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const active =
        st.display !== "none" &&
        st.visibility !== "hidden" &&
        Number(st.opacity) > 0.05 &&
        st.pointerEvents !== "none" &&
        r.width > 40 &&
        r.height > 40;
      if (!active) continue;
      out.push({
        selector: sel,
        id: el.id || "",
        cls: String(el.className || "").slice(0, 48),
        z: st.zIndex,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      });
    }
  }
  return out;
}

/**
 * 页面函数：找一个「点了就是点遮罩本身」的坐标 —— elementFromPoint 命中的节点必须**恰好是**
 * 该模态元素自身（不是它的子面板），即遮罩的空白可点区；找不到就返回 null（宁可判红不硬凑）。
 */
function backdropSpotFinder(target) {
  const els = [...document.querySelectorAll(target.sel)];
  const el = target.id ? els.find((e) => e.id === target.id) : els[0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const pts = [
    [Math.max(6, r.x + 12), Math.max(6, r.y + 12)],
    [Math.min(innerWidth - 6, r.right - 12), Math.max(6, r.y + 12)],
    [Math.max(6, r.x + 12), Math.min(innerHeight - 6, r.bottom - 12)],
    [Math.min(innerWidth - 6, r.right - 12), Math.min(innerHeight - 6, r.bottom - 12)],
    [(r.left + r.right) / 2, Math.max(6, r.y + 12)],
    [(r.left + r.right) / 2, Math.min(innerHeight - 6, r.bottom - 12)],
  ];
  for (const [x, y] of pts) {
    if (document.elementFromPoint(x, y) === el) return { x: Math.round(x), y: Math.round(y) };
  }
  return null;
}

/**
 * F3 §三.A.1/2：把活跃模态清零，**只走真实交互**，并等待落定后二次确认。
 *   1) 真实 Escape 键（原型 V.FIXES F7 绑了 sDlg>setwin>actHelp 优先级；EP 对话框/抽屉默认也吃 Esc）；
 *   2) 仍在 ⇒ 实探遮罩空白点 + 真实鼠标点击，由弹层自己的 onclick 关闭；
 *   3) 关不掉就如实留在 trail 里 ⇒ 门禁判红。绝不 add/remove class 或改 style ——
 *      那是「把状态推给截图」（卡 §六 禁止）。
 * 返回 { bootActive, trail, finalActive, finalList, stable }：stable = 间隔 400ms 两次都读到 0。
 */
async function dismissActiveModals(page, selectors, label) {
  const trail = [];
  const bootActive = await page.evaluate(activeModalScanner, selectors);
  let active = bootActive;
  for (let round = 0; round < 6 && active.length > 0; round++) {
    const entry = { round, before: active.map((m) => m.id || m.cls || m.selector), actions: [] };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(320);
    active = await page.evaluate(activeModalScanner, selectors);
    entry.actions.push(`Escape ⇒ 剩 ${active.length}`);
    for (const m of active.slice()) {
      const spot = await page.evaluate(backdropSpotFinder, { sel: m.selector, id: m.id });
      if (!spot) {
        entry.actions.push(`无空白遮罩可点：${m.selector}#${m.id}`);
        continue;
      }
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(320);
      entry.actions.push(`遮罩点击 ${m.selector}#${m.id} @${spot.x},${spot.y}`);
    }
    active = await page.evaluate(activeModalScanner, selectors);
    entry.after = active.map((m) => m.id || m.cls || m.selector);
    trail.push(entry);
  }
  await page.waitForTimeout(600);
  const pass1 = await page.evaluate(activeModalScanner, selectors);
  await page.waitForTimeout(400);
  const pass2 = await page.evaluate(activeModalScanner, selectors);
  return {
    side: label,
    bootActive: bootActive.map((m) => m.id || m.cls || m.selector),
    trail,
    finalActive: pass2.length,
    finalList: pass2,
    stable: pass1.length === 0 && pass2.length === 0 && active.length === 0,
  };
}

/**
 * 一级 rail 专项量取（卡 §三.A.2 点名：可见 12 项、项尺寸与步进、logo 坐标、
 * 选中态实色、`.rl-set` 视觉隐藏、底部只留分隔线）。
 * 两侧用同一份逻辑，只换选择器 ⇒ 差异表里原型值是**真实渲染读数**，不是源码推断。
 */
function railReader(cfg) {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return {
      x: Math.round(r.x * 100) / 100,
      y: Math.round(r.y * 100) / 100,
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
      display: st.display,
      visibility: st.visibility,
      backgroundColor: st.backgroundColor,
      color: st.color,
      padding: st.padding,
      gap: st.gap,
      borderRadius: st.borderTopLeftRadius,
      fontSize: st.fontSize,
      lineHeight: st.lineHeight,
      text: (el.textContent || "").trim().replace(/\s+/g, ""),
      title: el.getAttribute("title") ?? "",
    };
  };
  const all = (sel) => (sel ? [...document.querySelectorAll(sel)] : []);
  const container = document.querySelector(cfg.container);
  const live = (el) => {
    const b = box(el);
    return b.display !== "none" && b.width > 0 && b.height > 0;
  };
  const items = all(cfg.item).filter(live).map((el) => {
    const m = box(el);
    return { label: m.text, title: m.title, metrics: m };
  });
  const selectedEl = all(cfg.item).find((el) => live(el) && /(^|\s)(on|active)(\s|$)/.test(String(el.className ?? "")));
  const iconColorOf = (el) => {
    const svg = el?.querySelector("svg, .el-icon, i");
    return svg ? getComputedStyle(svg).color : "";
  };
  const skeleton = cfg.skeleton ? all(cfg.skeleton).filter((el) => getComputedStyle(el).display !== "none") : [];
  const logo = all(cfg.logo)[0];
  const gap = all(cfg.gap)[0];
  const settings = all(cfg.settings)[0];
  return {
    exists: !!container,
    container: container ? box(container) : null,
    items,
    selected: selectedEl
      ? { label: (selectedEl.textContent || "").trim().replace(/\s+/g, ""), className: String(selectedEl.className), backgroundColor: getComputedStyle(selectedEl).backgroundColor, color: getComputedStyle(selectedEl).color, iconColor: iconColorOf(selectedEl) }
      : null,
    logo: logo ? { exists: true, metrics: box(logo) } : { exists: false, metrics: {} },
    gap: gap ? { exists: true, metrics: box(gap) } : { exists: false, metrics: {} },
    settings: settings ? { exists: true, metrics: box(settings) } : { exists: false, metrics: {} },
    skeletons: skeleton.map((el) => box(el)),
  };
}

/* ────────────────────────── 采集 ────────────────────────── */

const require = createRequire(path.join(WEB, "package.json"));
const { chromium } = require("playwright");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

const netFailures = [];
const netRecovered = [];
const okUrls = new Map();

function attachNetwork(page) {
  page.on("response", (res) => {
    if (res.status() < 400) okUrls.set(res.url(), (okUrls.get(res.url()) ?? 0) + 1);
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    netFailures.push({ method: req.method(), url, port: portOfUrl(url), error: String(req.failure()?.errorText ?? "unknown"), signature: `${req.method()} ${url}` });
  });
}

async function newPage(browser, vp, auth) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  if (auth) {
    await ctx.addInitScript(
      ({ token, csrf, user }) => localStorage.setItem("admin_auth", JSON.stringify({ token, user: { ...user, csrfToken: csrf } })),
      { token: auth.token, csrf: auth.csrfToken, user: auth.user },
    );
  }
  const page = await ctx.newPage();
  attachNetwork(page);
  return { ctx, page };
}
const measure = (page, sideKey) => page.evaluate(pageReader, { sideKey, contract: REGION_CONTRACT });
const fileShot = (file) => ({ bytes: statSync(file).size, sha256: sha256(readFileSync(file)) });

/** 默认工作台 = 新壳信息流面；若当前路由把主面停在人工页，就点 rail 的「工作台」回归（真实点击，不注入） */
async function ensureDeskFeed(page) {
  if (await page.locator('[data-testid="feed-view"]').count()) return "直接进入信息流面";
  const desk = page.locator('[data-testid="rail"] [data-rail-key="desk"]').first();
  if ((await desk.count()) === 0) return "rail 工作台位不存在";
  await desk.click();
  await page.waitForTimeout(1200);
  return (await page.locator('[data-testid="feed-view"]').count()) ? "点 rail「工作台」回归信息流面" : "点后面仍无信息流面";
}

/**
 * 原型侧采集：命中「V38 自启首页 + 活跃模态=0 + desk 蓝色 .on」的窗口。
 *
 * 时序实探结论（原型融合版源码 + 探针 v1-v3，页内时钟自导航起点）：
 *   · V38 直达 `setTimeout(openWB('home'),60)`（L18962-18980）⇒ 首页五区（KPI/审批/播报/动作队列/
 *     任务步进）自 ~0.5s 起在场；`openWB` 不重绘 rail，desk 保持启动期涂的蓝 `.on`
 *     （deskOn 仅在信息流面为真，L2294-2297）。
 *   · 早期各层冒烟在 ~0.2-1.8s 反复开关 setwin/sDlg；约 1.9-2.4s 风暴平息 ⇒ 唯一零模态窗口；
 *     页钟 ≈2.5s V39 M6 冒烟 `openSetWin('print')`→`openSetWin('acct')`（L19390-19405）把 setwin
 *     重新弹成活跃遮罩。
 *   · 此后 V26/V32 族冒烟 teardown 调 `closeWB()`（L13381/L15037）⇒ wbView 失去 .show；首页**没有**
 *     任何真实点击可再打开的路径（openWB('home') 仅 V38 启动一处调用；rail「工作台」走
 *     goDeskHome 是回信息流面，还会反向 closeWB）。
 *   · ≥14s 演示推送 feedChanged() ⇒ DESK_ALERT=true ⇒ desk 永久红闪（L2146-2150/L2295）。
 * ⇒ 合法采集窗口 = 页钟 ~1.9-2.4s。策略：`domcontentloaded` 起 60ms 节奏快门轮询
 *   （单次 evaluate 三查：五区在场已绘制 + 活跃模态=0 + desk 蓝 .on），命中即先截图、
 *   再量取读数、截后再以同门复查；未命中 ⇒ 换新页面整页重采，最多 6 轮，每轮如实入档。
 *   绝不 add/remove class、不改 style、不拦截原型计时器 —— 那是「把状态推给截图」，卡 §六 禁止。
 */
const DESK_BLUE = "rgb(37, 99, 235)";

/** 页面函数（自包含，cfg 由参数传入）：快门 = 五区 ready + 活跃模态扫描 + desk 蓝态，三查合一 */
function PROTO_FAST_GATE(cfg) {
  const D = document;
  const t = Math.round(performance.now());
  const desk = D.querySelector("nav.rail .rl-it[data-rk='desk']");
  const deskInfo = desk
    ? { exists: true, hasOn: desk.classList.contains("on"), hasAlert: desk.classList.contains("alert"), backgroundColor: getComputedStyle(desk).backgroundColor, sinceLoadMs: t }
    : { exists: false, hasOn: false, hasAlert: false, backgroundColor: "", sinceLoadMs: t };
  const view = D.getElementById("wbView");
  const body = D.getElementById("wbBody");
  let why = "";
  if (!view || !view.classList.contains("show")) why = "wbView 未处于 .show（首页面板未开或已被冒烟 teardown 关闭）";
  else if (!body) why = "wbBody 缺失";
  else {
    const kpis = body.querySelector(".wb-kpis");
    const r = kpis ? kpis.getBoundingClientRect() : null;
    const five = !!kpis && !!r && r.width > 0 && r.height > 0
      && !!body.querySelector("#wbApps .wb-ap")
      && !!D.getElementById("al10BCBar")
      && !!D.getElementById("actHome")
      && !!body.querySelector(".act24-card");
    if (!five) why = "首页五区未齐或未绘制（.wb-kpis/#wbApps .wb-ap/#al10BCBar/#actHome/.act24-card）";
  }
  if (why) return { ok: false, stage: "ready", why, t, deskInfo, actives: [] };
  const actives = [];
  for (const sel of cfg.modalSelectors) {
    for (const el of D.querySelectorAll(sel)) {
      const st = getComputedStyle(el);
      const rr = el.getBoundingClientRect();
      const active =
        st.display !== "none" &&
        st.visibility !== "hidden" &&
        Number(st.opacity) > 0.05 &&
        st.pointerEvents !== "none" &&
        rr.width > 40 &&
        rr.height > 40;
      if (active) {
        actives.push({ selector: sel, id: el.id || "", cls: String(el.className || "").slice(0, 48), rect: [Math.round(rr.x), Math.round(rr.y), Math.round(rr.width), Math.round(rr.height)] });
      }
    }
  }
  if (actives.length) return { ok: false, stage: "modal", why: `活跃模态 ×${actives.length}：${actives.map((m) => m.id || m.selector).join(",")}`, t, deskInfo, actives };
  const blue = deskInfo.exists && deskInfo.hasOn === true && deskInfo.hasAlert === false && deskInfo.backgroundColor === cfg.deskBlue;
  if (!blue) return { ok: false, stage: "desk", why: `on=${deskInfo.hasOn} alert=${deskInfo.hasAlert} bg=${deskInfo.backgroundColor}`, t, deskInfo, actives };
  return { ok: true, t, desk: deskInfo, actives: [] };
}

/** 页面函数：通用浮层诊断扫描（常驻 inert 层不算活跃模态，口径与快门一致） */
function OVERLAY_SCANNER() {
  return [...document.querySelectorAll("body > *, .mask, [id*=etWin], [class*=mask]")]
    .filter((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (st.position === "fixed" || st.position === "absolute") && st.display !== "none" && r.width > 40 && r.height > 40 && Number(st.zIndex || 0) >= 1;
    })
    .slice(0, 8)
    .map((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id,
        cls: String(el.className || "").slice(0, 40),
        z: st.zIndex,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        // F3 口径修正：常驻层（opacity:0 + pointer-events:none）只是诊断痕迹，不算活跃模态
        opacity: st.opacity,
        pointerEvents: st.pointerEvents,
        active: st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.05 && st.pointerEvents !== "none",
      };
    });
}

/**
 * F3 主策略：CDP 虚拟时间停表采集。
 * 实探三轮一致：零模态窗口开于页钟 +2.34~2.47s、闭于 +2.59~2.69s（宽仅 160~270ms），
 * 而裸 CDP 快门本身要 147ms、Node 侧每拍 evaluate 往返 ~15-30ms ⇒ 实时竞速物理上吃不下窗口
 * （b0afy84xq 六轮全栽在「快门 147ms 落进 V39 M6 setwin」）。
 * 改为页钟步进：每步把虚拟时间预算推进 Δv 后**立刻停表**（policy=advance+budget，步间定时器不跑），
 * 在停表态里截图/读数 ⇒ 快门与末检之间窗口不可能再关闭。
 * 红线自查（卡 §六）：原型自身脚本与定时器**原样执行**，不拦截、不改写、不注入 class/style，
 * 只是把「观察时刻」停在时序真实存在过的零模态瞬间；证据里以 via=virtual-step 如实披露。
 */
async function vAdvance(cdp, stepMs) {
  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: stepMs });
}

/** 步进 stepMs（虚拟毫秒）后停表，并在停表态求快门读数；gate.t = performance.now() 即虚拟页钟 */
async function vPoll(cdp, fnsSrc, cfg, stepMs, trace) {
  await vAdvance(cdp, stepMs);
  trace.calls += 1;
  trace.budget += stepMs;
  try {
    const res = await cdp.send("Runtime.evaluate", { expression: `(${fnsSrc})(${JSON.stringify(cfg)})`, returnByValue: true });
    if (res.exceptionDetails || !res.result || res.result.value === undefined) {
      return { ok: false, stage: "err", why: `evaluate 无结果：${String(res.exceptionDetails?.exception?.description ?? res.exceptionDetails?.text ?? "undefined").slice(0, 80)}`, t: trace.budget, deskInfo: {}, actives: [] };
    }
    return res.result.value;
  } catch (e) {
    return { ok: false, stage: "err", why: `evaluate 失败：${String(e.message ?? e).slice(0, 80)}`, t: trace.budget, deskInfo: {}, actives: [] };
  }
}

/** 停表末态里完成：截图 → 合并读数 → 同表复查 → 组装该轮记录（快门/读数/末检处于同一停表页钟刻度） */
async function finalizePrototypeRound(cdp, page, ctx, { gate, pollTrail, firstModalTrail, protoConsole, attempt, vtrace }) {
  const tHit = vtrace ? { t: gate.t, via: "virtual-step" } : { t: gate.t, via: "realtime-race" };
  const home = gate.ok
    ? { ok: true, via: vtrace
        ? `原型 V38 自启直达首页；采集用 CDP 虚拟时间把页钟停在天然零模态瞬间（五区在场已绘制 · 活跃模态=0 · desk 蓝 .on，页钟 +${gate.t}ms），停表态内截图与读数；步间定时器不运行，绝不做 class/style 注入或改写原型脚本`
        : `原型 V38 自启直达首页（五区在场已绘制 · 活跃模态=0 · desk 蓝 .on），快门于页钟 +${gate.t}ms 命中；采集全程只读 + 真实截图，零点击零注入` }
    : { ok: false, via: `本轮未命中窗口（${pollTrail.join(" → ") || "无读数"}）` };
  const preProbe = gate.ok ? gate.desk : gate.deskInfo;
  const reasons = [];
  if (!home.ok) reasons.push(`未命中原型采集窗口（§三.A.1/2/8：五区 ready + 活跃模态=0 + desk 蓝 .on）：末拍 +${gate.t}ms ${gate.ok ? "" : gate.stage}:${gate.why}`);
  const f = path.join(OUT, "shots", `proto-${BASE_VIEWPORT.id}.png`);
  const tShot0 = Date.now();
  let shotVia = vtrace ? "cdp-virtual" : "cdp";
  try {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(f, Buffer.from(data, "base64"));
  } catch {
    shotVia = "playwright-fallback";
    await page.screenshot({ path: f, fullPage: false });
  }
  const shotMs = Date.now() - tShot0;
  const cap = await page.evaluate((payload) => {
    const { fnsSrc, cfg } = payload;
    const make = (s) => new Function(`return (${s})`)();
    const gateFn = make(fnsSrc.gate);
    const readerFn = make(fnsSrc.reader);
    const railFn = make(fnsSrc.railFn);
    const overlayFn = make(fnsSrc.overlayFn);
    const t0 = Math.round(performance.now());
    const measures = readerFn({ sideKey: cfg.sideKey, contract: cfg.contract });
    const rail = railFn(cfg.railSel);
    const overlays = overlayFn();
    const post = gateFn(cfg.gateCfg);
    return { t0, measures, rail, overlays, post };
  }, {
    // Playwright 参数不允许嵌套函数值（“Attempting to serialize unexpected value”），
    // 这四个都是自包含纯页面函数 ⇒ 传源码字符串、页内 new Function 还原；且 evaluate 只吃单一 arg。
    fnsSrc: { gate: PROTO_FAST_GATE.toString(), reader: pageReader.toString(), railFn: railReader.toString(), overlayFn: OVERLAY_SCANNER.toString() },
    cfg: { gateCfg: { modalSelectors: PROTO_MODAL_SELECTORS, deskBlue: DESK_BLUE }, sideKey: "proto", contract: REGION_CONTRACT, railSel: RAIL_SELECTORS.proto },
  });
  const proto = cap.measures;
  const protoRail = cap.rail;
  const overlays = cap.overlays;
  const postGate = cap.post;
  const postProbe = postGate.desk || postGate.deskInfo;
  const postActives = postGate.actives || [];
  if (home.ok && !postGate.ok) reasons.push(`量取与截图期间窗口关闭：快门 +${gate.t}ms · 读数起 +${cap.t0}ms · 末检 +${postGate.t}ms ${postGate.stage}:${postGate.why}`);
  if (postActives.length > 0) reasons.push(`采集后仍有活跃模态 ${postActives.length} 个（§三.A.1/2）：${postActives.map((m) => m.id || m.cls || m.selector).join(",")}`);
  const accepted = reasons.length === 0;
  const record = {
    prototype: proto,
    protoRail,
    prototypeFace: home,
    prototypeBootLog: protoConsole.slice(0, 12),
    prototypeOverlays: overlays,
    prototypeModals: {
      side: "prototype",
      bootActive: firstModalTrail,
      bootTrail: pollTrail,
      captureActive: gate.ok ? 0 : postActives.length,
      captureTrail: [`快门命中于 +${gate.t}ms（${gate.ok ? `零模态窗口内 · ${tHit.via}` : gate.stage}），截图耗时 ${shotMs}ms，末检于 +${postGate.t}ms`],
      finalActive: postActives.length,
      finalList: postActives,
      zero: home.ok && postGate.ok,
      stable: Boolean(postGate.ok),
      note: vtrace
        ? "F3 §三.A.1/2：弹层归零 = 把页钟停在原型自身启动时序的零模态瞬间（早期冒烟弹层风暴平息后、V39 M6 于 ~2.5s 弹 setwin 前）；CDP 虚拟时间步进只挪观察表，不改原型脚本/定时器/DOM；无 Escape、无点击、无注入"
        : "F3 §三.A.1/2：弹层归零靠命中原型自身启动时序的零模态窗口（早期冒烟弹层风暴平息后、V39 M6 于 ~2.5s 弹 setwin 前），快门前后双检；无 Escape、无点击、无注入",
    },
    prototypeRailWindow: {
      note: vtrace
        ? "F3：desk 蓝色 .on 是原型启动期渲染的既有 DOM 态（openWB 不重绘 rail；≥14s 演示推送置 DESK_ALERT 后永久红闪，且首页无真实点击再开路径）；采集用 CDP 虚拟时间步进把页钟停在该窗口内，截图与读数都在停表态完成，绝不做 class/style 注入"
        : "F3：desk 蓝色 .on 是原型启动期渲染的既有 DOM 态（openWB 不重绘 rail；≥14s 演示推送置 DESK_ALERT 后永久红闪，且首页无真实点击再开路径）；采集以 快门命中+整页重采 收敛到该窗口，绝不做 class/style 注入",
      preProbe,
      postProbe,
      windowMs: postProbe.sinceLoadMs,
      shotMs,
      shotVia,
      attempt,
      pollTrail,
      captureMode: vtrace ? "virtual-step" : "realtime-race",
      virtualTime: vtrace ? { steps: vtrace.calls, budgetMs: vtrace.budget, schedule: "advance 150ms 粗步进至页钟 1.6s → 20ms 细步进找窗口；命中后冻结", note: "policy=advance+budget：预算内原型定时器照常执行（脚本原样跑，不拦截不改写），预算耗尽即停表；截图/读数的 176ms 只花真实时间，页钟定格" } : undefined,
    },
    shots: { prototype: { file: `shots/proto-${BASE_VIEWPORT.id}.png`, ...fileShot(f) } },
  };
  return { attempt, accepted, reasons, record, gate, postGate, home, preProbe, postProbe, shotMs, shotVia, pollTrail };
}

/**
 * 主策略：虚拟时间步进找窗口并停表采集。
 * 粗步进 400ms 到 ready（五区在场），细步进 10ms 扫零模态窗口；命中 → 停表截图+读数；
 * 收下轮继续细步进直到模态复开 ⇒ 同一条停表时间轴测出「窗口开 +${openHit}ms / 闭 +${closeMs}ms」；
 * 若读到的表已被 M6 setwin 弄脏（stained）本轮作废整页重采（≤3 轮）。
 */
async function capturePrototypeVirtual(browser) {
  const gateFnSrc = PROTO_FAST_GATE.toString();
  const cfgJson = { modalSelectors: PROTO_MODAL_SELECTORS, deskBlue: DESK_BLUE };
  const rounds = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { ctx, page } = await newPage(browser, BASE_VIEWPORT, null);
    const protoConsole = [];
    page.on("console", (m) => {
      const t = String(m.text() ?? "");
      if (/V3[0-9]|DIRECT|BOOT|openWB/i.test(t)) protoConsole.push(t.slice(0, 180));
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    // 停表导航：policy=pause 冻结虚拟时钟；Page.navigate 命令在提交即返回（不等 load 事件），
    // 之后每 advance 一格才放行定时器 —— 启动冒烟（openWB 60ms、弹层风暴、V39 M6 setwin）都在我们拨表时才跑。
    await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
    await cdp.send("Page.navigate", { url: PROTO_URL });
    const trace = { budget: 0, calls: 0 };
    const pollTrail = [];
    const firstModalTrail = [];
    let lastMark = "";
    let gate = null;
    let windowNote = "";
    try {
      // 找窗口：早期粗步进（150ms）跨过启动与冒烟风暴，接近页钟 1.6s 后改 20ms 细步进扫描零模态窗口
      for (let guard = 0; guard < 400; guard += 1) {
        const step = trace.budget < 1600 ? 150 : 20;
        gate = await vPoll(cdp, gateFnSrc, cfgJson, step, trace);
        const mark = `${gate.stage}:${gate.why}`;
        if (gate.ok || mark !== lastMark) {
          pollTrail.push(`+${gate.t}ms ${gate.ok ? "窗口命中（五区齐·模态0·desk蓝.on）[virtual-step]" : mark}`);
          if (gate.stage === "modal") firstModalTrail.push(`+${gate.t}ms ${gate.why}`);
          lastMark = mark;
        }
        if (gate.ok || gate.t > 3200) break;
      }
      const hitT = gate.t;
      // 停表态内完成截图 + 读数 + 末检：页钟冻在 +hitTms，快门/读数期间 V39 M6 setwin 不会落画
      const fin = await finalizePrototypeRound(cdp, page, ctx, { gate, pollTrail, firstModalTrail, protoConsole, attempt, vtrace: trace });
      // 同一条时间轴继续细步进，测出窗口真实关闭点（供状态签名与回传卡叙述）
      let after = gate;
      for (let g = 0; g < 40; g += 1) {
        after = await vPoll(cdp, gateFnSrc, cfgJson, 20, trace);
        if (!after.ok) break;
      }
      const closeMs = after.ok ? null : after.t;
      windowNote = closeMs == null
        ? `窗口开 +${hitT}ms · 停表截图 · 细步进 +800ms 后仍零模态（关闭点晚于 ${after.t}ms 探测刻度）`
        : `窗口开 +${hitT}ms · 停表截图 · 窗口闭 +${closeMs}ms（${after.stage}:${after.why}）`;
      if (!after.ok) pollTrail.push(`+${after.t}ms 窗口关闭（${after.stage}:${after.why}）`);
      // 停表后页钟只允许被快门自身的 BeginFrame 消耗微小漂移（实测定格 ~10ms）；漂出容差 ⇒ 有真定时器漏跑，本轮不采信
      const stained = fin.accepted && fin.postGate.t - hitT > 120;
      const accepted = fin.accepted && !stained;
      if (stained) {
        fin.reasons.push(`读数时页钟 +${fin.postGate.t}ms 相对停表命中 +${hitT}ms 漂移超容差（>120ms，疑似过表）：本轮读数不采信`);
        fin.record.prototypeFace = { ok: false, via: `读数未停在同表刻度：${fin.reasons.join("；")}` };
      }
      rounds.push({ attempt, accepted, reasons: fin.reasons, windowMs: hitT, hit: gate.ok, desk: "", post: after.ok ? "ok" : `${after.stage}:${after.why}`, windowNote, captureMode: "virtual-step" });
      log(`原型侧第 ${attempt} 轮（virtual-step）：${accepted ? `命中采集窗口（快门 +${hitT}ms · 截图 ${fin.shotMs}ms · ${windowNote}）` : `未命中（${fin.reasons.join("；")}），整页重采`}`);
      await ctx.close();
      if (accepted) return { accepted: true, record: fin.record, rounds, windowNote };
    } catch (e) {
      rounds.push({ attempt, accepted: false, reasons: [`虚拟时间步进异常：${String(e.message ?? e).slice(0, 160)}`], captureMode: "virtual-step" });
      log(`原型侧第 ${attempt} 轮（virtual-step）异常：${String(e.message ?? e).slice(0, 160)}`);
      await ctx.close();
    }
  }
  return { accepted: false, rounds };
}

async function capturePrototype(browser) {
  const main = await capturePrototypeVirtual(browser);
  if (main.accepted) {
    const record = main.record;
    viewports[BASE_VIEWPORT.id] = record;
    const proto = record.prototype;
    const shotFile = path.join(OUT, "shots", `proto-${BASE_VIEWPORT.id}.png`);
    frames.push({ viewport: BASE_VIEWPORT.id, screen: "prototype", overflowX: proto.__page.overflowX, ...fileShot(shotFile) });
    log(`原型侧：区域 ${Object.keys(proto).length - 1} 个 · rail 可见项 ${record.protoRail.items.length} · overflowX=${proto.__page.overflowX} · 模态 快门前后均 0（zero=true stable=true）· 标题=${proto.__page.title} · 采集=virtual-step 停表 ${main.windowNote}`);
    return { accepted: true, attempts: main.rounds };
  }
  // 后备：原实时竞速策略（25ms 轮询 + 裸 CDP 快门），虚拟时间不可用时兜底，口径与披露不变
  log(`原型侧虚拟时间步进未收敛（${(main.rounds ?? []).map((r) => r.reasons?.join("；") ?? "").filter(Boolean).join(" / ") || "3 轮未命中"}）→ 转实时竞速后备`);
  const attempts = (main.rounds ?? []).map((r) => ({ ...r, captureMode: r.captureMode ?? "virtual-step" }));
  let last = null;
  const gateCfg = { modalSelectors: PROTO_MODAL_SELECTORS, deskBlue: DESK_BLUE };
  for (let attempt = 4; attempt <= 7; attempt += 1) {
    const { ctx, page } = await newPage(browser, BASE_VIEWPORT, null);
    const protoConsole = [];
    page.on("console", (m) => {
      const t = String(m.text() ?? "");
      if (/V3[0-9]|DIRECT|BOOT|openWB/i.test(t)) protoConsole.push(t.slice(0, 180));
    });
    // 窗口只有 ~350-420ms：Playwright 的 page.screenshot 实测 360-410ms，独自吃满窗口
    // （F3 六轮全部栽在“快门命中→截图结束”跨过 V39 M6 的 setwin）。改走裸 CDP 单帧抓取
    // （同一渲染面，只是省掉 Playwright 的稳定性等待与封装），先在 about:blank 热一次管线。
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Page.enable").catch(() => null);
    await cdp.send("Page.captureScreenshot", { format: "png" }).catch(() => null);
    // domcontentloaded 起跳（不等 networkidle+F2 的 1500ms 干等 —— 那正好跨过唯一窗口）
    await page.goto(PROTO_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
    // 快门轮询：25ms 一拍；页钟越过 3200ms（V39 M6 的 setwin 已落画）本轮即止，换页重采
    let gate = null;
    const pollTrail = [];
    const firstModalTrail = [];
    let lastMark = "";
    for (;;) {
      gate = await page.evaluate(PROTO_FAST_GATE, gateCfg);
      const mark = `${gate.stage}:${gate.why}`;
      if (gate.ok || mark !== lastMark) {
        pollTrail.push(`+${gate.t}ms ${gate.ok ? "窗口命中（五区齐·模态0·desk蓝.on）" : mark}`);
        if (gate.stage === "modal") firstModalTrail.push(`+${gate.t}ms ${gate.why}`);
        lastMark = mark;
      }
      if (gate.ok || gate.t > 3200) break;
      await page.waitForTimeout(25);
    }
    const home = gate.ok
      ? { ok: true, via: `原型 V38 自启直达首页（五区在场已绘制 · 活跃模态=0 · desk 蓝 .on），快门于页钟 +${gate.t}ms 命中；采集全程只读 + 真实截图，零点击零注入` }
      : { ok: false, via: `本轮未命中窗口（${pollTrail.join(" → ") || "无读数"}）` };
    const preProbe = gate.ok ? gate.desk : gate.deskInfo;
    const reasons = [];
    if (!home.ok) reasons.push(`未命中原型采集窗口（§三.A.1/2/8：五区 ready + 活跃模态=0 + desk 蓝 .on）：末拍 +${gate.t}ms ${gate.ok ? "" : gate.stage}:${gate.why}`);
    // 命中窗口：像素优先入盘（画面必须落在窗口内）；读数与末检合并成单次页内求值（实测 5ms）——
    // 4 个独立 evaluate 的 IPC 往返(~100ms+) 会把末检推出 V39 M6 setwin 之外。
    const f = path.join(OUT, "shots", `proto-${BASE_VIEWPORT.id}.png`);
    const tShot0 = Date.now();
    let shotVia = "cdp";
    try {
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(f, Buffer.from(data, "base64"));
    } catch {
      shotVia = "playwright-fallback";
      await page.screenshot({ path: f, fullPage: false });
    }
    const shotMs = Date.now() - tShot0;
    const cap = await page.evaluate((payload) => {
      const { fnsSrc, cfg } = payload;
      const make = (s) => new Function(`return (${s})`)();
      const gateFn = make(fnsSrc.gate);
      const readerFn = make(fnsSrc.reader);
      const railFn = make(fnsSrc.railFn);
      const overlayFn = make(fnsSrc.overlayFn);
      const t0 = Math.round(performance.now());
      const measures = readerFn({ sideKey: cfg.sideKey, contract: cfg.contract });
      const rail = railFn(cfg.railSel);
      const overlays = overlayFn();
      const post = gateFn(cfg.gateCfg);
      return { t0, measures, rail, overlays, post };
    }, {
      // Playwright 参数不允许嵌套函数值（“Attempting to serialize unexpected value”），
      // 这四个都是自包含纯页面函数 ⇒ 传源码字符串、页内 new Function 还原；且 evaluate 只吃单一 arg。
      fnsSrc: { gate: PROTO_FAST_GATE.toString(), reader: pageReader.toString(), railFn: railReader.toString(), overlayFn: OVERLAY_SCANNER.toString() },
      cfg: { gateCfg, sideKey: "proto", contract: REGION_CONTRACT, railSel: RAIL_SELECTORS.proto },
    });
    const proto = cap.measures;
    const protoRail = cap.rail;
    const overlays = cap.overlays;
    const postGate = cap.post;
    const postProbe = postGate.desk || postGate.deskInfo;
    const postActives = postGate.actives || [];
    if (home.ok && !postGate.ok) reasons.push(`量取与截图期间窗口关闭：快门 +${gate.t}ms · 读数起 +${cap.t0}ms · 末检 +${postGate.t}ms ${postGate.stage}:${postGate.why}`);
    if (postActives.length > 0) reasons.push(`采集后仍有活跃模态 ${postActives.length} 个（§三.A.1/2）：${postActives.map((m) => m.id || m.cls || m.selector).join(",")}`);
    const accepted = reasons.length === 0;
    const record = {
      prototype: proto,
      protoRail,
      prototypeFace: home,
      prototypeBootLog: protoConsole.slice(0, 12),
      prototypeOverlays: overlays,
      prototypeModals: {
        side: "prototype",
        bootActive: firstModalTrail,
        bootTrail: pollTrail,
        captureActive: gate.ok ? 0 : postActives.length,
        captureTrail: [`快门命中于 +${gate.t}ms（${gate.ok ? "零模态窗口内" : gate.stage}），截图耗时 ${shotMs}ms，末检于 +${postGate.t}ms`],
        finalActive: postActives.length,
        finalList: postActives,
        zero: home.ok && postGate.ok,
        stable: Boolean(postGate.ok),
        note: "F3 §三.A.1/2：弹层归零靠命中原型自身启动时序的零模态窗口（早期冒烟弹层风暴平息后、V39 M6 于 ~2.5s 弹 setwin 前），快门前后双检；无 Escape、无点击、无注入",
      },
      prototypeRailWindow: {
        note: "F3：desk 蓝色 .on 是原型启动期渲染的既有 DOM 态（openWB 不重绘 rail；≥14s 演示推送置 DESK_ALERT 后永久红闪，且首页无真实点击再开路径）；采集以 快门命中+整页重采 收敛到该窗口，绝不做 class/style 注入",
        preProbe,
        postProbe,
        windowMs: postProbe.sinceLoadMs,
        shotMs,
        shotVia,
        attempt,
        pollTrail,
      },
      shots: { prototype: { file: `shots/proto-${BASE_VIEWPORT.id}.png`, ...fileShot(f) } },
    };
    attempts.push({ attempt, accepted, reasons, windowMs: gate.t, hit: gate.ok, desk: `${preProbe.backgroundColor}${preProbe.hasAlert ? "(alert)" : preProbe.hasOn ? "(on)" : ""}`, post: postGate.ok ? "ok" : `${postGate.stage}:${postGate.why}` });
    log(`原型侧第 ${attempt} 轮：${accepted ? `命中采集窗口（快门 +${gate.t}ms · 截图 ${shotMs}ms · 末检 +${postGate.t}ms 通过）` : `未命中（${reasons.join("；")}），整页重采`}`);
    last = { accepted, reasons, record };
    if (accepted) {
      viewports[BASE_VIEWPORT.id] = record;
      frames.push({ viewport: BASE_VIEWPORT.id, screen: "prototype", overflowX: proto.__page.overflowX, ...fileShot(f) });
      log(`原型侧：区域 ${Object.keys(proto).length - 1} 个 · rail 可见项 ${protoRail.items.length} · overflowX=${proto.__page.overflowX} · 模态 快门前 0 / 末检 0（zero=true stable=true）· 标题=${proto.__page.title} · 采集窗口=页钟 +${gate.t}ms…+${postGate.t}ms`);
      await ctx.close();
      return { accepted: true, attempts };
    }
    await ctx.close();
  }
  // 6 轮都没收敛：最后一轮读数如实入档（不美化），错误照推
  viewports[BASE_VIEWPORT.id] = last.record;
  viewports[BASE_VIEWPORT.id].prototypeRailWindow.exhausted = true;
  frames.push({ viewport: BASE_VIEWPORT.id, screen: "prototype", overflowX: last.record.prototype.__page.overflowX, ...fileShot(path.join(OUT, "shots", `proto-${BASE_VIEWPORT.id}.png`)) });
  for (const r of last.reasons) errors.push(`原型采集未收敛（6 轮重采后）：${r}`);
  return { accepted: false, attempts };
}

let browser = null;
let exitCode = 0;
let auth = null;
let aborted = null;
const viewports = {};
const frames = [];
const errors = [];
const protoSha = sha256(readFileSync(PROTO_FILE));
log(`原型指纹：${protoSha}（卡面 ${PROTO_SHA_EXPECT}）`);

try {
  if (protoSha !== PROTO_SHA_EXPECT) throw new Error(`原型指纹与卡面不符：${protoSha} ≠ ${PROTO_SHA_EXPECT}`);
  await startBackend();
  await startVite();
  auth = await loginViaProxy();
  browser = await chromium.launch({ executablePath: CHROME, headless: true });

  // ── 1) 原型：file:// 直接渲染（权威真相源 · 蓝态采集窗口内整页重采至多 6 轮） ──
  await capturePrototype(browser);

  // ── 2) 实现：真实登录态默认工作台（不带 ?wb_uiux 注入 ⇒ 生产态读数） ──
  {
    const { ctx, page } = await newPage(browser, BASE_VIEWPORT, auth);
    await page.goto(ORIGIN, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
    const how = await ensureDeskFeed(page);
    await page.waitForTimeout(800);
    /* 生产态验收必须等菜单桥落定：加载期只有骨架项，量出来的 12 项不作数 */
    let railSettled = null;
    try {
      railSettled = await page.waitForFunction(
        () => {
          const real = [...document.querySelectorAll('[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton)')].filter(
            (el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
            },
          );
          const sk = document.querySelector('[data-testid="rail"] [data-rail-skeleton="true"]');
          return sk === null && real.length > 0;
        },
        { timeout: 30000, polling: 500 },
      );
    } catch {
      errors.push("等待一级栏脱离加载骨架态超时（30s）：生产态验收无法确认菜单桥已落定");
    }
    // F3 §三.A.2：实现侧测量/截图前清零 —— 默认信息流态本就不该有活跃 .el-overlay/通知；
    // 出现即说明有弹层漏进验收态，走真实关闭流程并如实记录（stable 需二次确认为 0）。
    const implModals = await dismissActiveModals(page, IMPL_MODAL_SELECTORS, "implementation");
    const impl = await measure(page, "impl");
    const implRail = await page.evaluate(railReader, RAIL_SELECTORS.impl);
    const production = await page.evaluate(() => {
      const inject = document.querySelector('[data-testid="wb-shell"]')?.getAttribute("data-uiux-inject") ?? "absent";
      /* 壳层无论注入与否都会留痕（off 也是合法生产态痕迹）⇒ 只有真值才算注入态 */
      const active = inject !== "absent" && inject !== "off" && inject !== "false" && inject !== "";
      return {
        search: location.search,
        href: location.href,
        uiuxInject: inject,
        injected: active || location.search.includes("wb_uiux"),
        menuFault: !!document.querySelector('[data-testid="menu-fault"]'),
        menuEmpty: !!document.querySelector('[data-testid="menu-empty"]'),
      };
    });
    const candidates = await page.evaluate(newChatScanner);
    if (implModals.finalActive !== 0 || implModals.stable !== true) {
      errors.push(`实现侧浮层未清零（§三.A.2）：活跃 .el-overlay/通知 ${implModals.finalActive} 个（${implModals.finalList.map((m) => m.cls || m.selector).join(",") || "∅"}）· stable=${implModals.stable}`);
    }
    const f = path.join(OUT, "shots", `impl-${BASE_VIEWPORT.id}.png`);
    await page.screenshot({ path: f, fullPage: false });
    viewports[BASE_VIEWPORT.id].implementation = impl;
    viewports[BASE_VIEWPORT.id].implRail = implRail;
    viewports[BASE_VIEWPORT.id].production = production;
    viewports[BASE_VIEWPORT.id].implOverlays = {
      side: "implementation",
      selectors: IMPL_MODAL_SELECTORS,
      bootActive: implModals.bootActive,
      trail: implModals.trail,
      active: implModals.finalActive,
      list: implModals.finalList,
      zero: implModals.finalActive === 0,
      stable: implModals.stable,
      note: "F3 §三.A.2：.el-overlay/.el-notification 必须为活跃 0 才能进差异表与签名",
    };
    viewports[BASE_VIEWPORT.id].railSettled = railSettled !== null;
    viewports[BASE_VIEWPORT.id].implementationEntry = { path: impl.__page.url, reachedFeed: how, feedShown: impl.__page.feedShown, uiuxInject: impl.__page.uiuxInject };
    viewports[BASE_VIEWPORT.id].newChatCandidates = candidates;
    viewports[BASE_VIEWPORT.id].shots.implementation = { file: `shots/impl-${BASE_VIEWPORT.id}.png`, ...fileShot(f) };
    frames.push({ viewport: BASE_VIEWPORT.id, screen: "implementation", overflowX: impl.__page.overflowX, ...fileShot(f) });
    log(`实现侧：区域 ${Object.keys(impl).length - 1} 个 · overflowX=${impl.__page.overflowX} · 进入方式=${how} · 注入=${impl.__page.uiuxInject} · 活跃浮层=${implModals.finalActive}（stable=${implModals.stable}）`);

    // 搜索框：默认隐藏后必须还能真的展开并可用（点开关 ⇒ 可见 ⇒ 可聚焦 ⇒ 能过滤）
    const toggleSel = '[data-testid="second-nav-search-toggle"]';
    if ((await page.locator(toggleSel).count()) > 0) {
      await page.locator(toggleSel).first().click();
      await page.waitForTimeout(400);
      const after = await measure(page, "impl");
      const focused = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="second-nav-search"]');
        if (!el) return false;
        el.focus();
        return document.activeElement === el;
      });
      const repainted = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="second-nav-search"]');
        if (!el) return { visible: false, display: "absent", width: 0, height: 0 };
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return { visible: r.width > 0 && r.height > 0 && st.display !== "none", display: st.display, width: r.width, height: r.height };
      });
      after.search = {
        ...(after.search ?? {}),
        exists: true,
        visible: repainted.visible,
        metrics: { ...(after.search?.metrics ?? {}), ...repainted, focused: focused ? "true" : "false" },
      };
      viewports[BASE_VIEWPORT.id].searchAfterToggle = after.search;
      await page.locator(toggleSel).first().click();
      await page.waitForTimeout(300);
      const back = await measure(page, "impl");
      viewports[BASE_VIEWPORT.id].searchAfterCollapse = back.search;
    } else {
      errors.push("未找到 [data-testid=\"second-nav-search-toggle\"]：搜索框无法恢复可用（卡 §三.A.5 隐藏不得等于丢功能）");
    }
    await ctx.close();
  }

  // ── 3) 并排合成图：两张真实截图左右并排，且由机器核对两侧面板同尺寸 ──
  {
    const base = viewports[BASE_VIEWPORT.id] ?? {};
    // F3 §三.A.3：两侧状态签名由**区域读数**派生（同一 lib 函数、同一口径），并写进 figcaption ⇒ 进 PNG 证据
    const protoSig = stateSignatureOf(base.prototype ?? {}, {
      viewport: BASE_VIEWPORT.id,
      face: base.prototypeFace?.ok === true ? "home-feed" : "not-home",
      overlays: base.prototypeModals?.finalActive ?? null,
    });
    const implSig = stateSignatureOf(base.implementation ?? {}, {
      viewport: BASE_VIEWPORT.id,
      face: base.implementation?.__page?.feedShown === true ? "home-feed" : "not-home",
      overlays: base.implOverlays?.active ?? null,
    });
    const sigEqual = protoSig === implSig;
    base.stateSignature = {
      prototype: protoSig,
      implementation: implSig,
      equal: sigEqual,
      note: "F3 §三.A.3：vp+面+活跃模态数+REGION_CONTRACT 逐区在场位向量，由读数经 stateSignatureOf 派生；门禁会重算比对",
    };
    const protoBuf = readFileSync(path.join(OUT, "shots", `proto-${BASE_VIEWPORT.id}.png`));
    const implBuf = readFileSync(path.join(OUT, "shots", `impl-${BASE_VIEWPORT.id}.png`));
    const vp = { width: BASE_VIEWPORT.width * 2 + 64, height: BASE_VIEWPORT.height + 120 };
    const { ctx, page } = await newPage(browser, vp, null);
    await page.setContent(
      `<body style="margin:0;background:#111;font:12px system-ui;color:#fff">
         <div class="sigline" style="padding:6px 16px;font-weight:600">状态签名 ${sigEqual ? "一致 ✓" : "不一致 ✗（门禁判红）"} · 活跃模态 原型=${base.prototypeModals?.finalActive ?? "∅"} 实现=${base.implOverlays?.active ?? "∅"}</div>
         <div style="display:flex;gap:16px;padding:16px">
           <figure style="margin:0"><figcaption>原型 ${BASE_VIEWPORT.id}（权威真相源 · file:// 渲染）· 状态签名：${protoSig}</figcaption>
             <img data-side="proto" src="data:image/png;base64,${protoBuf.toString("base64")}" style="display:block;width:${BASE_VIEWPORT.width}px;height:${BASE_VIEWPORT.height}px"></figure>
           <figure style="margin:0"><figcaption>实现 ${BASE_VIEWPORT.id}（真实 SUPER_ADMIN 登录态）· 状态签名：${implSig}</figcaption>
             <img data-side="impl" src="data:image/png;base64,${implBuf.toString("base64")}" style="display:block;width:${BASE_VIEWPORT.width}px;height:${BASE_VIEWPORT.height}px"></figure>
         </div>
       </body>`,
      { waitUntil: "load" },
    );
    const panes = await page.evaluate(() => {
      const rect = (s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      };
      return { proto: rect('[data-side="proto"]'), impl: rect('[data-side="impl"]') };
    });
    // 签名必须真的渲染进了这张合成图（textContent 回读），不是只写在 JSON 里自我声明
    const figTexts = await page.evaluate(() => [...document.querySelectorAll("figcaption,.sigline")].map((el) => el.textContent));
    const signaturesPrinted =
      figTexts.some((t) => t.includes("状态签名") && t.includes(protoSig)) &&
      figTexts.some((t) => t.includes("状态签名") && t.includes(implSig));
    const f = path.join(OUT, "shots", `side-by-side-${BASE_VIEWPORT.id}.png`);
    await page.screenshot({ path: f, fullPage: false });
    viewports[BASE_VIEWPORT.id].shots.sideBySide = { file: `shots/side-by-side-${BASE_VIEWPORT.id}.png`, ...fileShot(f) };
    viewports[BASE_VIEWPORT.id].sideBySide = {
      panes: 2,
      sameViewport: panes.proto.w === BASE_VIEWPORT.width && panes.impl.w === BASE_VIEWPORT.width && panes.proto.h === BASE_VIEWPORT.height,
      heightMatch: Math.round((panes.proto.h / Math.max(1, panes.impl.h)) * 100) / 100,
      protoRect: panes.proto,
      implRect: panes.impl,
      signatures: { prototype: protoSig, implementation: implSig, equal: sigEqual },
      signaturesPrinted,
      note: "并排图由两张同视口真实截图左右拼合；面板尺寸由机器核对；两侧状态签名写进 figcaption（F3 §三.A.3/4，PNG 证据自带状态声明）",
    };
    frames.push({ viewport: `${BASE_VIEWPORT.id}`, screen: "side-by-side", overflowX: 0, ...fileShot(f) });
    log(`并排图：原型面板 ${panes.proto.w}×${panes.proto.h} · 实现面板 ${panes.impl.w}×${panes.impl.h} · 签名一致=${sigEqual} · 入图=${signaturesPrinted}`);
    await ctx.close();
  }

  // ── 4) 其余视口：实现侧无裁切 + 结构仍可达（卡 §三.C.14） ──
  for (const vp of IMPL_ONLY_VIEWPORTS) {
    const { ctx, page } = await newPage(browser, vp, auth);
    await page.goto(ORIGIN, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
    const how = await ensureDeskFeed(page);
    await page.waitForTimeout(800);
    const impl = await measure(page, "impl");
    const f = path.join(OUT, "shots", `impl-${vp.id}.png`);
    await page.screenshot({ path: f, fullPage: false });
    viewports[vp.id] = {
      implementation: impl,
      implementationEntry: { path: impl.__page.url, reachedFeed: how, feedShown: impl.__page.feedShown, uiuxInject: impl.__page.uiuxInject },
      shots: { implementation: { file: `shots/impl-${vp.id}.png`, ...fileShot(f) } },
    };
    frames.push({ viewport: vp.id, screen: "implementation", overflowX: impl.__page.overflowX, ...fileShot(f) });
    log(`视口 ${vp.id}：overflowX=${impl.__page.overflowX} · 进入方式=${how}`);
    await ctx.close();
  }
} catch (e) {
  exitCode = 1;
  aborted = redactText(String(e)).slice(0, 400);
  errors.push(aborted);
  console.error(`A 段采集器异常：${aborted}`);
  console.error(`后端日志尾部：${redactText(backendTail.join("").slice(-1200))}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopAll().catch(() => {});
}

/* ────────────────────────── 差异表 + 门禁 ────────────────────────── */

/**
 * 超容差项的书面解释（卡 §三.A.7「偏差必须逐项解释，原则上为 0」）。
 * 只允许放有明确理由的条目；表外偏差 ⇒ 判红，不静默放行。
 */
const DEVIATION_NOTES = {};

const base = viewports[BASE_VIEWPORT.id] ?? {};
const regionRows = base.prototype && base.implementation ? buildDiffTable(base.prototype, base.implementation, DEVIATION_NOTES) : [];
const railRows = base.protoRail && base.implRail ? buildRailRows(base.protoRail, base.implRail, DEVIATION_NOTES) : [];
const diffTable = [...railRows, ...regionRows];
/* 门禁读的是**同一个 base 对象**：差异表与区域读数必须挂回这里，否则 collectViolationsF2A 拿到空表 ⇒ 假绿 */
base.diffTable = diffTable;
base.impl = base.implementation ?? {};
/* 主面五区顺序（§三.A.8）同样读实现页的区域读数：不挂这个键，BODY_ORDER 门禁会拿到空对象而**静默通过** */
base.implBody = base.implementation ?? {};

const bundle = {
  schema: "wb13-f2a-visual-measures/v2",
  generatedAt: new Date().toISOString(),
  task: "WORKBENCH-13-WORKBENCH-UIUX-COMPLETE-01-F3",
  segment: "A（原型视觉基线 · F3 同状态收口：弹层清零 + 状态签名入图 + 主面五区 required）",
  app: { origin: ORIGIN, apiBase: API_BASE, user: auth?.user?.username ?? null, roles: auth?.user?.roles ?? [] },
  apiBase: API_BASE,
  browsers: { engine: "chrome", headless: true, reducedMotion: "reduce", executable: CHROME },
  servers: { backendPort: BACKEND_PORT, webPort: WEB_PORT, startedBy: "harness", portsAllDown },
  prototypeSource: { file: PROTO_FILE.replace(/\\/g, "/"), url: PROTO_URL, sha256: protoSha },
  prototypeSha256: PROTO_SHA_EXPECT,
  method: "原型 file:// 渲染 vs 实现同源 /api + 真实 demo-login 态；同一页面函数逐区域量 rect + computed；并排图由两张同视口真实截图拼合并机器核对",
  contract: REGION_CONTRACT.map((r) => ({ key: r.key, label: r.label, card: r.card, proto: r.proto, impl: r.impl, gated: r.gate, required: r.required === true })),
  orders: { side: SIDE_ORDER, body: BODY_ORDER },
  railContract: {
    card: "§三.A.2",
    visibleCount: RAIL_VISIBLE_COUNT,
    labels: RAIL_VISIBLE_LABELS,
    prototypeMeasured: (base.protoRail?.items ?? []).map((it) => `${it.label}@y=${it.metrics?.y}`),
    implementationMeasured: (base.implRail?.items ?? []).map((it) => `${it.label}@y=${it.metrics?.y}`),
    note: "项数/顺序/坐标逐行进入差异表；生产态截图不得带 ?wb_uiux 注入（注入态只用于结构诊断）",
  },
  tolerance: { length: 1, color: 0, note: "坐标/尺寸/间距 ±1px（含原型 421.7 这类亚像素取整）；颜色与内边距要求逐字节一致" },
  /**
   * 卡 §三.A.4：原 F2 并排图采集时原型 `#setwin.show` 处于打开态（活跃模态≠0、无状态签名），
   * 自 F3 起标 superseded，不得继续作为通过证据。证据目录里同步留一份带 README 的存档副本。
   */
  supersededF2: (() => {
    const oldFile = process.env.WB13_F2_SIDEBYSIDE ?? "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-13-WORKBENCH-UIUX-COMPLETE-01-F2/shots/side-by-side-1440x1000.png";
    let sha = null;
    try {
      sha = sha256(readFileSync(oldFile));
    } catch {
      /* 别机检出处没有中央证据目录时如实留 null，门禁不因此判红但读数可见缺失 */
    }
    return {
      file: oldFile.replace(/\\/g, "/"),
      sha256: sha,
      status: "superseded",
      reason: "F2 并排采集时原型设置中心大弹窗（#setwin.show）未关闭，活跃模态≠0 且无状态签名，不满足 F3 §三.A ⇒ 仅作历史，不得继续作为通过证据（卡 §三.A.4）",
      replacedBy: `shots/side-by-side-${BASE_VIEWPORT.id}.png（本 F3 证据，两侧状态签名已写进 figcaption）`,
    };
  })(),
  deviationNotes: DEVIATION_NOTES,
  viewports,
  diffTable,
  gatedStats: gatedStats(diffTable),
  frames,
  errors,
  aborted,
  network: { failures: netFailures, recovered: netRecovered },
  expectedOffline: EXPECTED_OFFLINE_ENDPOINTS,
};
bundle.violations = collectViolationsF2A(bundle);

const payload = redactText(JSON.stringify(bundle, null, 2));
writeFileSync(path.join(OUT, "measure", "f2a-visual-measures.json"), payload, "utf8");
writeFileSync(path.join(OUT, "logs", "f2a-harness.json"), redactText(JSON.stringify({ harnessLog, backendTail: backendTail.join("").slice(-4000) }, null, 2)), "utf8");
if (!ONLY) writeFileSync(path.join(WEB, "tests", "fixtures", "f2a-visual-measures.json"), payload, "utf8");

console.log(`\nA 段采集完成：差异表 ${diffTable.length} 行（门禁指标 ${bundle.gatedStats.gated} 条 · 完全一致 ${bundle.gatedStats.exact} · 容差内 ${bundle.gatedStats.withinTolerance} · 超容差 ${bundle.gatedStats.offSpec}）`);
console.log(`截图帧 ${frames.length} 张（含并排图）`);
if (bundle.violations.length === 0) {
  console.log("门禁违例 0 条（全部通过）");
} else {
  console.log(`门禁违例 ${bundle.violations.length} 条：`);
  for (const v of bundle.violations.slice(0, 60)) console.log(`  ✗ ${v}`);
  exitCode = exitCode || 3;
}
console.log(`证据 → ${path.join(OUT, "measure", "f2a-visual-measures.json")}${ONLY ? "（--only 局部采集，不更新仓内 fixture 副本）" : " + 仓内 fixture 副本"}`);
process.exit(exitCode);
