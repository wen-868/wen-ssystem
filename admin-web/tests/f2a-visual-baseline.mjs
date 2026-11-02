/**
 * WORKBENCH-13-F2 · A 段采集器（原型并排 + DOM/computed 差异表 + 机器门禁）
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
 * 服务起停/登录/网络审计与 B 段采集器 `f2-func-styles.mjs` 同一口径；这里刻意自带一份
 * 实现而不去改已交付并通过反测的 B 段脚本，避免「为跑 A 段而动 B 段证据链」的耦合。
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
 * 把原型落到**它自己声明的默认首页面**，再量卡 §三.A.8 的五区。
 *
 * 事实（原型融合版源码 + 真实渲染实测）：`.wb-view{display:none}` / `.wb-view.show{display:block}`，
 * `#wbBody` 在 `#wbView` 里；打开动作是 `openWB('home')`，而原型的 V38 自启就是 `setTimeout(openWB('home'),60)`。
 * 但 `openWB` 有 busy 门（`if(busy){toast('正在回复中…');return}`），AI 演示回复在飞时自启会整段落空 ⇒
 * `.wb-kpis` 读数为 0×0、`#wbApps`/`#al10BCBar`/`#actHome`/`.act24-card` 根本不在 DOM。
 * 所以：先等它自落定，等不到就**真实点击**原型 V39 注入的首页待办行（该行 onClick 就调 openWB('home')）。
 * 绝不手动 add class / 改 CSS —— 那是「把状态推给截图」，卡 §六 明令禁止。
 */
const PROTO_HOME_READY = () => {
  const view = document.getElementById("wbView");
  if (!view || !view.classList.contains("show")) return false;
  const body = document.getElementById("wbBody");
  if (!body) return false;
  const kpis = body.querySelector(".wb-kpis");
  if (!kpis) return false;
  const r = kpis.getBoundingClientRect();
  return r.width > 0 && r.height > 0
    && !!body.querySelector("#wbApps .wb-ap")
    && !!document.getElementById("al10BCBar")
    && !!document.getElementById("actHome")
    && !!body.querySelector(".act24-card");
};

async function revealPrototypeHome(page) {
  try {
    await page.waitForFunction(PROTO_HOME_READY, null, { timeout: 12000 });
    return { ok: true, via: "原型 V38 自启（openWB('home')）落定首页面" };
  } catch {
    /* busy 门拦截了自启：改走真实点击 */
  }
  const row = page.locator('#v39BizTodo .v39-biz-row[data-v39a="wbApps"]').first();
  if ((await row.count()) === 0) {
    return { ok: false, via: "原型首页待办行 #v39BizTodo 不存在，无法进入首页面" };
  }
  await row.click({ timeout: 8000 });
  try {
    await page.waitForFunction(PROTO_HOME_READY, null, { timeout: 10000 });
    return { ok: true, via: "真实点击原型 #v39BizTodo 待办行（其 onclick 调 openWB('home')）进入首页面" };
  } catch (e) {
    return { ok: false, via: `点击后首页五区仍未齐备：${String(e.message ?? e).slice(0, 120)}` };
  }
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

  // ── 1) 原型：file:// 直接渲染（权威真相源） ──
  {
    const { ctx, page } = await newPage(browser, BASE_VIEWPORT, null);
    await page.goto(PROTO_URL, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1500);
    const home = await revealPrototypeHome(page);
    if (!home.ok) errors.push(`原型首页面未落定（§三.A.8 五区无从量取）：${home.via}`);
    const proto = await measure(page, "proto");
    const protoRail = await page.evaluate(railReader, RAIL_SELECTORS.proto);
    const overlays = await page.evaluate(() =>
      [...document.querySelectorAll("body > *, .mask, [id*=etWin], [class*=mask]")]
        .filter((el) => {
          const st = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return (st.position === "fixed" || st.position === "absolute") && st.display !== "none" && r.width > 40 && r.height > 40 && Number(st.zIndex || 0) >= 1;
        })
        .slice(0, 8)
        .map((el) => ({ tag: el.tagName.toLowerCase(), id: el.id, cls: String(el.className || "").slice(0, 40), z: getComputedStyle(el).zIndex, rect: [Math.round(el.getBoundingClientRect().x), Math.round(el.getBoundingClientRect().y), Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)] })),
    );
    const f = path.join(OUT, "shots", `proto-${BASE_VIEWPORT.id}.png`);
    await page.screenshot({ path: f, fullPage: false });
    viewports[BASE_VIEWPORT.id] = {
      prototype: proto,
      protoRail,
      prototypeFace: home,
      prototypeOverlays: overlays,
      shots: { prototype: { file: `shots/proto-${BASE_VIEWPORT.id}.png`, ...fileShot(f) } },
    };
    frames.push({ viewport: BASE_VIEWPORT.id, screen: "prototype", overflowX: proto.__page.overflowX, ...fileShot(f) });
    log(`原型侧：区域 ${Object.keys(proto).length - 1} 个 · rail 可见项 ${protoRail.items.length} · overflowX=${proto.__page.overflowX} · 标题=${proto.__page.title}`);
    await ctx.close();
  }

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
    const f = path.join(OUT, "shots", `impl-${BASE_VIEWPORT.id}.png`);
    await page.screenshot({ path: f, fullPage: false });
    viewports[BASE_VIEWPORT.id].implementation = impl;
    viewports[BASE_VIEWPORT.id].implRail = implRail;
    viewports[BASE_VIEWPORT.id].production = production;
    viewports[BASE_VIEWPORT.id].railSettled = railSettled !== null;
    viewports[BASE_VIEWPORT.id].implementationEntry = { path: impl.__page.url, reachedFeed: how, feedShown: impl.__page.feedShown, uiuxInject: impl.__page.uiuxInject };
    viewports[BASE_VIEWPORT.id].newChatCandidates = candidates;
    viewports[BASE_VIEWPORT.id].shots.implementation = { file: `shots/impl-${BASE_VIEWPORT.id}.png`, ...fileShot(f) };
    frames.push({ viewport: BASE_VIEWPORT.id, screen: "implementation", overflowX: impl.__page.overflowX, ...fileShot(f) });
    log(`实现侧：区域 ${Object.keys(impl).length - 1} 个 · overflowX=${impl.__page.overflowX} · 进入方式=${how} · 注入=${impl.__page.uiuxInject}`);

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
    const protoBuf = readFileSync(path.join(OUT, "shots", `proto-${BASE_VIEWPORT.id}.png`));
    const implBuf = readFileSync(path.join(OUT, "shots", `impl-${BASE_VIEWPORT.id}.png`));
    const vp = { width: BASE_VIEWPORT.width * 2 + 64, height: BASE_VIEWPORT.height + 96 };
    const { ctx, page } = await newPage(browser, vp, null);
    await page.setContent(
      `<body style="margin:0;background:#111;font:12px system-ui;color:#fff">
         <div style="display:flex;gap:16px;padding:16px">
           <figure style="margin:0"><figcaption>原型 ${BASE_VIEWPORT.id}（权威真相源 · file:// 渲染）</figcaption>
             <img data-side="proto" src="data:image/png;base64,${protoBuf.toString("base64")}" style="display:block;width:${BASE_VIEWPORT.width}px;height:${BASE_VIEWPORT.height}px"></figure>
           <figure style="margin:0"><figcaption>实现 ${BASE_VIEWPORT.id}（真实 SUPER_ADMIN 登录态）</figcaption>
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
    const f = path.join(OUT, "shots", `side-by-side-${BASE_VIEWPORT.id}.png`);
    await page.screenshot({ path: f, fullPage: false });
    viewports[BASE_VIEWPORT.id].shots.sideBySide = { file: `shots/side-by-side-${BASE_VIEWPORT.id}.png`, ...fileShot(f) };
    viewports[BASE_VIEWPORT.id].sideBySide = {
      panes: 2,
      sameViewport: panes.proto.w === BASE_VIEWPORT.width && panes.impl.w === BASE_VIEWPORT.width && panes.proto.h === BASE_VIEWPORT.height,
      heightMatch: Math.round((panes.proto.h / Math.max(1, panes.impl.h)) * 100) / 100,
      protoRect: panes.proto,
      implRect: panes.impl,
      note: "并排图由两张同视口真实截图左右拼合；面板尺寸由机器核对，不是手写说明",
    };
    frames.push({ viewport: `${BASE_VIEWPORT.id}`, screen: "side-by-side", overflowX: 0, ...fileShot(f) });
    log(`并排图：原型面板 ${panes.proto.w}×${panes.proto.h} · 实现面板 ${panes.impl.w}×${panes.impl.h}`);
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
  schema: "wb13-f2a-visual-measures/v1",
  generatedAt: new Date().toISOString(),
  task: "WORKBENCH-13-WORKBENCH-UIUX-COMPLETE-01-F2",
  segment: "A（原型视觉基线：壳层 · 二级导航 · 默认工作台）",
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
