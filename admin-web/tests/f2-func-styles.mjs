/**
 * WORKBENCH-13-F2 · 函数式组件样式真源采集器（自起自停服务 + 真实操作 + 机器门禁）
 *
 * 卡 §三/§五 要求的是「真实运行态」证据，所以本采集器只认三件事：
 *   1. 真实浏览器里浮层的 DOM 矩形 + computed style（有没有背景/圆角/阴影、是否脱离文档流、宽度是否受控）；
 *   2. 真实鼠标/键盘/触摸操作的结果（按钮 elementFromPoint 命中、取消不写、确认才写、抽屉真关掉）；
 *   3. 与截图、读数互证（同一帧的 PNG SHA256 + 状态签名都必须唯一）。
 * 判定规则全部在 `f2-func-styles-lib.mjs`，采集端与专项测试共用，口径不会分叉。
 *
 * 通知场景的数据来源披露（卡 §六「不伪造通知数据」）：
 *   本地 mock 后端的 `t_app_version` 无任何已发布行，`GET /api/app/version/admin_web` 恒返回
 *   `data:null` ⇒ 生产链路在这里永远走不到通知分支。采集器只在 HTTP 边界把**这一个端点**的响应
 *   换成真实契约形态（`{code,msg,data:{versionName,…}}`），版本比较、节流、`ElNotification` 调用、
 *   样式与点击刷新全部由 `src/modules/update/checker.ts` 原样执行；
 *   证据里以 `notify.payloadSource="harness-version-stub"` 标注来源，并用「只有该文件会写的
 *   localStorage 节流键 `zx_web_update_check_v1`」机器证明生产检查器真的跑过。
 *
 * 用法（admin-web 目录）：
 *   node tests/f2-func-styles.mjs <evidenceDir 绝对路径> [--only=1440x1000] [--scene=01] [--keep-servers]
 *
 * 输出：
 *   <evidenceDir>/shots/*.png                          真实浏览器截图
 *   <evidenceDir>/measure/f2-func-measures.json        浮层读数 + 操作结果 + 门禁结果
 *   <evidenceDir>/logs/f2-harness.json                 服务起停 / 网络审计 / 逐场景日志
 *   admin-web/tests/fixtures/f2-func-measures.json     同一 bundle 的仓内副本（专项测试只读它）
 */
import { createHash, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { EXPECTED_OFFLINE_ENDPOINTS } from "./uiux-scenarios-lib.mjs";
import { VIEWPORTS, collectViolationsF2, f2StateSignature, listLegacyOverflow, portOfUrl, redactText } from "./f2-func-styles-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");

const args = process.argv.slice(2);
const EVIDENCE = args.find((a) => !a.startsWith("--"));
if (!EVIDENCE) {
  console.error("用法：node tests/f2-func-styles.mjs <evidenceDir> [--only=<viewport>] [--scene=<子串>] [--keep-servers]");
  process.exit(2);
}
const ONLY = (args.find((a) => a.startsWith("--only=")) ?? "").replace("--only=", "");
const ONLY_SCENE = (args.find((a) => a.startsWith("--scene=")) ?? "").replace("--scene=", "");
const KEEP_SERVERS = args.includes("--keep-servers");
const OUT = path.resolve(EVIDENCE);
for (const dir of ["shots", "measure", "logs"]) mkdirSync(path.join(OUT, dir), { recursive: true });

/**
 * 端口默认 8080/5199（与 F1 同一口径，正式证据用默认值）。
 * 采集器从不代别人杀端口：端口被别的会话占着时，本机临时用 WB13_*_PORT 另开一口跑局部排查。
 */
const BACKEND_PORT = Number(process.env.WB13_BACKEND_PORT ?? 8080);
const WEB_PORT = Number(process.env.WB13_WEB_PORT ?? 5199);
const ORIGIN = `http://localhost:${WEB_PORT}`;
const API_BASE = "/api";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
/** 更新检查器的节流键：每场景开新上下文时清掉，否则 1 小时内的第二次不会出通知 */
const THROTTLE_KEY = "zx_web_update_check_v1";

/* ────────────────────────── 服务自起自停（与 F1 采集器同构） ────────────────────────── */

const harnessLog = [];
const backendTail = [];
const log = (msg) => {
  harnessLog.push(`${new Date().toISOString()} ${msg}`);
  console.log(msg);
};

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

/** vite 6 把 localhost 解析到 IPv6 ⇒ 双栈都探，否则会误判「未就绪」 */
async function probePort(port) {
  for (const host of ["127.0.0.1", "::1"]) if (await probeHost(host, port)) return true;
  return false;
}

function whoHoldsPort(port) {
  try {
    return execFileSync("netstat", ["-ano"], { encoding: "utf8" })
      .split("\n")
      .filter((l) => new RegExp(`:${port}\\s`).test(l) && /LISTENING/i.test(l))
      .map((l) => l.trim().replace(/\s+/g, " "))
      .slice(0, 3);
  } catch {
    return [];
  }
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
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
    log(`已停止 ${label}（pid=${child.pid}）`);
  } catch (e) {
    log(`停止 ${label} 失败：${String(e).slice(0, 120)}`);
  }
}

async function startBackend() {
  if (await probePort(BACKEND_PORT)) {
    throw new Error(`端口 ${BACKEND_PORT} 已被占用（${whoHoldsPort(BACKEND_PORT).join(" / ") || "未取到 PID"}）：采集器要求自起自停，请先释放`);
  }
  const child = spawn(process.execPath, ["scripts/dev-mock.mjs"], {
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      USE_MOCK_DB: "true",
      NODE_ENV: "development",
      PORT: String(BACKEND_PORT),
      // 本地一次性开发密钥：每次运行随机生成，不写进仓库，也不落进任何证据文件
      JWT_SECRET: randomBytes(32).toString("hex"),
      CSRF_SECRET: randomBytes(32).toString("hex"),
    },
  });
  children.push({ child, label: `backend:${BACKEND_PORT}` });
  const tail = (b) => backendTail.push(String(b));
  child.stdout.on("data", tail);
  child.stderr.on("data", tail);
  if (!(await waitForPort(BACKEND_PORT, true))) throw new Error(`后端 ${BACKEND_PORT} 未在 90s 内就绪`);
  boundPorts.add(BACKEND_PORT);
  log(`后端 mock 已起（127.0.0.1:${BACKEND_PORT}，USE_MOCK_DB=true）`);
}

async function startVite() {
  if (await probePort(WEB_PORT)) {
    throw new Error(`端口 ${WEB_PORT} 已被占用（${whoHoldsPort(WEB_PORT).join(" / ") || "未取到 PID"}）：采集器要求自起自停，请先释放`);
  }
  const child = spawn(
    process.execPath,
    [path.join(REPO, "node_modules", "vite", "bin", "vite.js"), "--port", String(WEB_PORT), "--strictPort"],
    {
      cwd: WEB,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, VITE_API_BASE: API_BASE, VITE_API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
    },
  );
  children.push({ child, label: `vite:${WEB_PORT}` });
  const viteTail = [];
  child.stdout.on("data", (b) => {
    viteTail.push(String(b));
    harnessLog.push(`[vite] ${String(b).trim()}`);
  });
  child.stderr.on("data", (b) => {
    viteTail.push(String(b));
    harnessLog.push(`[vite-err] ${String(b).trim()}`);
  });
  if (!(await waitForPort(WEB_PORT, true, 210000))) {
    throw new Error(`vite ${WEB_PORT} 未在 210s 内就绪：${redactText(viteTail.join("").slice(-600))}`);
  }
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

/* ────────────────────────── 真实登录（SUPER_ADMIN，经同源 /api 代理） ────────────────────────── */

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

/* ────────────────────────── 版本端点真实探查（不做默认假设） ────────────────────────── */

async function probeVersionEndpoint() {
  try {
    const res = await fetch(`${ORIGIN}${API_BASE}/app/version/admin_web`, { signal: AbortSignal.timeout(8000) });
    const j = await res.json().catch(() => null);
    return { httpStatus: res.status, dataNull: j?.data === null || j?.data === undefined, versionName: j?.data?.versionName ?? null };
  } catch (e) {
    return { httpStatus: null, dataNull: null, error: redactText(String(e)).slice(0, 200) };
  }
}

/* ────────────────────────── 页面侧读数 ────────────────────────── */

const READOUT = (probe) => {
  const STYLE_PROPS = ["position", "backgroundColor", "borderRadius", "boxShadow", "borderWidth", "visibility", "opacity", "zIndex", "width", "display"];
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const pick = (el) => {
    const s = getComputedStyle(el);
    const o = {};
    for (const p of STYLE_PROPS) o[p] = s[p] === undefined ? "" : String(s[p]);
    return o;
  };
  /** 遍历所有样式表（含 @media 内层规则），统计命中某类名的规则条数 ⇒ 样式是否真的进了文档 */
  const ruleCount = (classFragment) => {
    let n = 0;
    const walk = (rules) => {
      for (const r of rules) {
        if (r.selectorText && String(r.selectorText).indexOf(classFragment) >= 0) n += 1;
        if (r.cssRules && r.cssRules.length && String(r.selectorText || "").indexOf(classFragment) < 0) walk(r.cssRules);
      }
    };
    for (const sh of document.styleSheets) {
      try {
        walk(sh.cssRules);
      } catch {
        /* 跨源样式表读不到规则：本机同源，不会出现 */
      }
    }
    return n;
  };
  const labelOf = (el) => (el.textContent || "").trim().replace(/\s+/g, "");
  const hitTest = (el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      hit: !!top && (top === el || el.contains(top)),
      hitBy: top ? String(top.className || top.tagName).slice(0, 60) : "null",
    };
  };
  const readBox = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { rect: rectOf(el), computed: pick(el), text: labelOf(el).slice(0, 80) };
  };

  const kind = probe.kind || "message-box";
  const boxSel = kind === "notification" ? ".el-notification" : ".el-message-box";
  const wrapSel = kind === "notification" ? ".el-notification" : ".el-overlay-message-box";
  const box = readBox(boxSel);
  const wrapper = readBox(wrapSel);
  const btns = [...document.querySelectorAll(kind === "notification" ? ".el-notification" : ".el-message-box__btns button")].map((b) => {
    const h = hitTest(b);
    return {
      label: labelOf(b),
      tag: b.tagName,
      enabled: b.disabled !== true,
      rect: rectOf(b),
      hit: h.hit,
      hitBy: h.hitBy,
    };
  });
  const ae = document.activeElement;
  const inBox = !!ae && !!document.querySelector(boxSel) && (document.querySelector(boxSel).contains(ae) || document.querySelector(boxSel) === ae);
  const messages = [...document.querySelectorAll(".el-message")]
    .map((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return { el, r, st, text: labelOf(el) };
    })
    .filter((m) => m.r.top >= 0 && m.r.top < innerHeight && Number(m.st.opacity) > 0.5);
  const primary = probe.primaryAction ? document.querySelector(probe.primaryAction.selector) : null;
  const primaryHit = primary ? hitTest(primary) : null;
  const focusTrail = (probe.focusTrail || []).map((step) => {
    const el = document.querySelector(step.selector);
    if (!el) return { step: step.name, present: false };
    const h = hitTest(el);
    return { step: step.name, present: true, hit: h.hit, hitBy: h.hitBy, label: labelOf(el).slice(0, 60) };
  });

  return {
    path: location.pathname + location.search,
    shell: document.querySelector('[data-testid="wb-shell"]') ? "v2" : document.querySelector(".layout .global-header") ? "mainlayout" : "none",
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyTextLen: (document.body.innerText || "").trim().length,
    tableRendered: !!document.querySelector(".el-table"),
    toast: messages.map((m) => m.text).join(" / ").slice(0, 120),
    toastCount: messages.length,
    overlay: {
      required: probe.overlayRequired !== false,
      kind,
      exists: !!box,
      cssRules: ruleCount(kind === "notification" ? ".el-notification" : ".el-message-box"),
      messageRules: ruleCount(".el-message"),
      box,
      wrapper,
      buttons: btns,
      focus: {
        activeTag: ae ? ae.tagName : "null",
        activeClass: ae ? String(ae.className).slice(0, 60) : "",
        activeLabel: ae ? labelOf(ae).slice(0, 40) : "",
        insideBox: inBox,
      },
    },
    primaryAction: probe.primaryAction
      ? {
          required: true,
          label: probe.primaryAction.label,
          toastExpected: probe.primaryAction.toastExpected === true,
          hit: primaryHit ? primaryHit.hit : false,
          hitBy: primaryHit ? primaryHit.hitBy : "选择器未命中任何元素",
        }
      : null,
    focusTrail,
  };
};

/* ────────────────────────── 真实操作原语 ────────────────────────── */

/**
 * 遮罩/抽屉关闭：先用 elementFromPoint 网格实探一个真正露出的点，再打真实鼠标或真实触摸。
 * 找不到露出点 ⇒ 直接判红抛错，绝不用 force 绕过（卡 §六）。
 */
async function exposedPointOf(page, selector) {
  return page.evaluate(
    ({ sel }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const stepX = Math.max(4, Math.floor(r.width / 24));
      const stepY = Math.max(4, Math.floor(r.height / 24));
      for (let y = r.top + stepY / 2; y < r.bottom; y += stepY) {
        for (let x = r.left + stepX / 2; x < r.right; x += stepX) {
          const top = document.elementFromPoint(x, y);
          if (top === el) return { x: Math.round(x), y: Math.round(y) };
        }
      }
      return null;
    },
    { sel: selector },
  );
}

async function clickButtonByText(page, scopeSelector, text) {
  const btn = page.locator(`${scopeSelector} button`, { hasText: text }).first();
  await btn.waitFor({ state: "visible", timeout: 8000 });
  await btn.click();
}

async function waitForOverlay(page, selector, ms = 8000) {
  await page.waitForSelector(selector, { state: "visible", timeout: ms });
}

/* ────────────────────────── 场景定义 ────────────────────────── */

const MSG_PATH = "/messages";
const MARK_ALL_TEXT = "全部标为已读";
const READ_ALL_API = "/admin/wb-notifications/read-all";

/** 非强制更新通知的契约形态响应体（真实后端返回 data:null ⇒ 见文件头披露） */
const STUB_VERSION = {
  versionCode: 999,
  versionName: "0.2.0",
  minVersionCode: 0,
  isForce: false,
  updateUrl: "",
  packageUrl: "",
  updateNote: "F2 证据帧：真实非强制更新通知（函数式组件样式）",
  updatedAt: "2026-11-01 00:00:00",
};
const STUB_VERSION_FORCED = { ...STUB_VERSION, isForce: true, updateNote: "F2 证据帧：真实强制更新确认（MessageBox.alert）" };

/** 旧壳回滚路径：checkWebUpdate() 的既有挂载点在 MainLayout（新壳下不挂载，已在回传卡登记为产品缺口） */
const OLD_SHELL_FLAGS = { "wb.shell.v2": "0" };

const SCENES = [
  {
    scene: "01-confirm-open",
    viewports: ["1440x1000", "1024x768", "390x844"],
    note: "真实 SUPER_ADMIN 登录 → /messages → 真实点击「全部标为已读」→ 读确认框几何与 computed style",
    async run(page) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.getByRole("button", { name: MARK_ALL_TEXT }).click();
      await waitForOverlay(page, ".el-message-box");
      await page.waitForTimeout(400);
      return { probe: { kind: "message-box" }, expectButtons: ["取消", "确定"], expectWrites: 0 };
    },
  },
  {
    scene: "02-notify-update",
    viewports: ["1440x1000", "1024x768", "390x844"],
    versionPayload: STUB_VERSION,
    flags: OLD_SHELL_FLAGS,
    legacyLayout: true,
    note: "非强制更新通知：由 src/modules/update/checker.ts 的 ElNotification 真实产出（旧壳回滚路径：检查器的既有挂载点在 MainLayout）",
    async run(page, vp, state) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForOverlay(page, ".el-notification", 12000);
      await page.waitForTimeout(400);
      state.overlayText = await page.evaluate(() => (document.querySelector(".el-notification")?.textContent || "").replace(/\s+/g, ""));
      return { probe: { kind: "notification" }, notify: true };
    },
  },
  {
    scene: "03-alert-forced",
    viewports: ["1440x1000", "1024x768", "390x844"],
    versionPayload: STUB_VERSION_FORCED,
    flags: OLD_SHELL_FLAGS,
    legacyLayout: true,
    note: "强制更新：ElMessageBox.alert 在**不渲染 ZxElTable** 的 /messages 上必须有样式（卡 §三.2 去耦合的正证）",
    async run(page) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForOverlay(page, ".el-message-box", 12000);
      await page.waitForTimeout(400);
      return { probe: { kind: "message-box" }, expectButtons: ["立即刷新"] };
    },
  },
  {
    scene: "04-confirm-cancel",
    viewports: ["1440x1000"],
    note: "取消 ⇒ 确认框关闭且**不产生任何写请求**（卡 §四.2）",
    async run(page) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.getByRole("button", { name: MARK_ALL_TEXT }).click();
      await waitForOverlay(page, ".el-message-box");
      await clickButtonByText(page, ".el-message-box__btns", "取消");
      await page.waitForSelector(".el-message-box", { state: "detached", timeout: 8000 });
      await page.waitForTimeout(600);
      return { probe: { kind: "message-box", overlayRequired: false }, expectWrites: 0, cancelFlow: true };
    },
  },
  {
    scene: "05-confirm-ok",
    viewports: ["1440x1000"],
    note: "确定 ⇒ 真实发出 1 次 read-all 写请求 + 成功提示落在屏幕上（卡 §四.1/§四.2）",
    async run(page) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.getByRole("button", { name: MARK_ALL_TEXT }).click();
      await waitForOverlay(page, ".el-message-box");
      await clickButtonByText(page, ".el-message-box__btns", "确定");
      await page.waitForSelector(".el-message", { state: "visible", timeout: 8000 });
      await page.waitForTimeout(500);
      return { probe: { kind: "message-box", overlayRequired: false }, expectWrites: 1, expectSuccessToast: true };
    },
  },
  {
    scene: "06-confirm-keyboard",
    viewports: ["1440x1000"],
    note: "键盘：焦点进入确认框 → Tab 移到「确定」→ Enter 真正触发写（卡 §四.5）",
    async run(page, vp, state) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.getByRole("button", { name: MARK_ALL_TEXT }).click();
      await waitForOverlay(page, ".el-message-box");
      await page.waitForTimeout(300);
      const snap = () =>
        page.evaluate(() => {
          const ae = document.activeElement;
          const box = document.querySelector(".el-message-box");
          return {
            activeTag: ae ? ae.tagName : "null",
            activeClass: ae ? String(ae.className).slice(0, 60) : "",
            activeLabel: ae ? (ae.textContent || "").trim().replace(/\s+/g, "").slice(0, 40) : "",
            insideBox: !!box && (box === ae || box.contains(ae)),
          };
        });
      const trail = [];
      const step = async (name) => {
        const cur = await snap();
        trail.push({ step: name, ...cur });
        if (cur.insideBox) state.focusSnapshot = cur;
        return cur;
      };
      // ① 焦点进入确认框，并停在「取消」上（证明键盘真的能在框内移动，而不是页面背景）
      for (let i = 0; i < 8; i++) {
        const cur = await step(`tab${i}`);
        if (cur.insideBox && cur.activeLabel === "取消") break;
        await page.keyboard.press("Tab");
      }
      // ② 决定性瞬间自留一帧（焦点环在「取消」上，与鼠标帧 01 不是同一张图）
      state.decisive = await page.evaluate(READOUT, { kind: "message-box" });
      await page.screenshot({ path: state.shotPath, fullPage: false });
      state.selfShot = true;
      // ③ 再 Tab 到「确定」，Enter 真正触发写操作
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        const cur = await step(`to-confirm${i}`);
        if (cur.insideBox && cur.activeLabel === "确定") break;
      }
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      state.keyboardTrail = trail;
      return { probe: { kind: "message-box", overlayRequired: false }, expectKeyboard: true, expectKeyboardEnter: true, expectWrites: 1 };
    },
  },
  {
    scene: "07-notify-click-reload",
    viewports: ["1440x1000"],
    versionPayload: STUB_VERSION,
    flags: OLD_SHELL_FLAGS,
    legacyLayout: true,
    note: "通知可点：真实点击通知 ⇒ 页面真的重新加载（document 请求 +1），末帧留重载后旧提示不残留的结果态（卡 §四.3）",
    async run(page, vp, state) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForOverlay(page, ".el-notification", 12000);
      state.overlayText = await page.evaluate(() => (document.querySelector(".el-notification")?.textContent || "").replace(/\s+/g, ""));
      const before = state.documentRequests.length;
      const reloaded = page.waitForRequest((req) => req.resourceType() === "document", { timeout: 20000 }).catch(() => null);
      await page.locator(".el-notification").first().click();
      await reloaded;
      state.reloadDelta = state.documentRequests.length - before;
      // 重载后应用会再跑一次检查、通知会再次出现（生产节流键在重载时被新文档重新初始化）
      state.renotifiedAfterReload = await page
        .waitForSelector(".el-notification", { state: "visible", timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      // 8s 后自动关闭 ⇒ 末帧是「重载完成且旧提示不残留」的结果态
      state.notifyGoneAfterReload = await page
        .waitForSelector(".el-notification", { state: "detached", timeout: 25000 })
        .then(() => true)
        .catch(() => false);
      await page.waitForTimeout(500);
      return { probe: { kind: "notification", overlayRequired: false }, notify: true };
    },
  },
  {
    scene: "08-drawer-mouse",
    viewports: ["390x844"],
    note: "390×844 抽屉回归（新壳）：真实鼠标点遮罩露出点 ⇒ 抽屉关闭（卡 §四.4）",
    async run(page, vp, state) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator('[data-testid="side-toggle"]').first().click();
      await page.waitForSelector('[data-testid="side-mask"]', { state: "attached", timeout: 8000 });
      await page.waitForTimeout(500);
      state.drawer = { openBefore: true, method: "mouse" };
      const spot = await exposedPointOf(page, '[data-testid="side-mask"]');
      if (!spot) throw new Error("遮罩在 390 视口上没有任何可点露出点（抽屉关不掉）：真实缺陷，不用 force 绕过");
      state.drawer.exposedPoint = spot;
      await page.locator('[data-testid="side-mask"]').click({ position: { x: spot.x, y: spot.y } });
      await page.waitForSelector('[data-testid="side-mask"]', { state: "detached", timeout: 8000 });
      state.drawer.closedAfter = true;
      await page.waitForTimeout(300);
      return { probe: { kind: "message-box", overlayRequired: false }, drawer: true };
    },
  },
  {
    scene: "09-drawer-touch",
    viewports: ["390x844"],
    hasTouch: true,
    note: "390×844 抽屉回归：真实触摸 tap（hasTouch 上下文）同一露出点 ⇒ 抽屉关闭（卡 §四.4）",
    async run(page, vp, state) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator('[data-testid="side-toggle"]').first().click();
      await page.waitForSelector('[data-testid="side-mask"]', { state: "attached", timeout: 8000 });
      await page.waitForTimeout(500);
      state.drawer = { openBefore: true, method: "touch" };
      const spot = await exposedPointOf(page, '[data-testid="side-mask"]');
      if (!spot) throw new Error("遮罩在 390 视口上没有任何可点露出点（触摸关不掉）：真实缺陷，不用 force 绕过");
      state.drawer.exposedPoint = spot;
      // 触摸帧取「抽屉打开、露出点已实探」的决定性瞬间（鼠标帧 08 取关闭后的结果帧）：
      // 两帧都是本场景真实操作的一部分，且不会退化成同一张图
      await page.screenshot({ path: state.shotPath, fullPage: false });
      state.selfShot = true;
      await page.touchscreen.tap(spot.x, spot.y);
      await page.waitForSelector('[data-testid="side-mask"]', { state: "detached", timeout: 8000 });
      state.drawer.closedAfter = true;
      await page.waitForTimeout(300);
      return { probe: { kind: "message-box", overlayRequired: false }, drawer: true };
    },
  },
  {
    scene: "10-toast-not-blocking",
    viewports: ["390x844"],
    note: "窄屏 + 屏幕上同时有提示时，主操作「刷新」中心点仍命中自己（卡 §四.6：提示不盖主操作）",
    async run(page) {
      await page.goto(`${ORIGIN}${MSG_PATH}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.getByRole("button", { name: MARK_ALL_TEXT }).click();
      await waitForOverlay(page, ".el-message-box");
      await clickButtonByText(page, ".el-message-box__btns", "确定");
      await page.waitForSelector(".el-message", { state: "visible", timeout: 8000 });
      await page.waitForTimeout(300);
      return {
        probe: { kind: "message-box", overlayRequired: false, primaryAction: { selector: ".page-header-actions button:nth-child(2)", label: "刷新", toastExpected: true } },
        expectWrites: 1,
      };
    },
  },
];

/* ────────────────────────── 采集 ────────────────────────── */

const require = createRequire(path.join(WEB, "package.json"));
const { chromium } = require("playwright");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

const shots = [];
const sceneErrors = [];
const netFailures = [];
const netRecovered = [];

async function runScene(browser, vp, auth, def) {
  let ctx = null;
  try {
    ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      hasTouch: def.hasTouch === true,
    });
    await ctx.addInitScript(
      ({ token, csrf, user, flags, throttleKey }) => {
        localStorage.setItem("admin_auth", JSON.stringify({ token, user: { ...user, csrfToken: csrf } }));
        // 更新通知有 1 小时节流（生产逻辑）：每帧开新上下文时清掉节流键，保证每次都真跑一次检查
        localStorage.removeItem(throttleKey);
        for (const [k, v] of Object.entries(flags || {})) localStorage.setItem(k, String(v));
      },
      { token: auth.token, csrf: auth.csrfToken, user: auth.user, flags: def.flags, throttleKey: THROTTLE_KEY },
    );
    const page = await ctx.newPage();
    const shotFile = `${vp.id}-${def.scene}.png`;
    const state = { documentRequests: [], shotPath: path.join(OUT, "shots", shotFile) };
    const readAll = { count: 0 };
    page.on("request", (req) => {
      if (req.url().includes(READ_ALL_API)) readAll.count += 1;
      if (req.resourceType() === "document") state.documentRequests.push(req.url());
    });
    page.on("requestfailed", (req) => {
      netFailures.push({
        viewport: vp.id,
        scene: def.scene,
        method: req.method(),
        url: redactText(req.url()),
        port: portOfUrl(req.url()),
        error: String(req.failure()?.errorText ?? "unknown"),
        signature: `${req.method()} ${req.url()}`,
      });
    });
    page.on("response", (res) => {
      netRecovered.push({ signature: `${res.request().method()} ${res.url()}`, status: res.status(), scene: def.scene });
    });
    if (def.versionPayload) {
      const body = JSON.stringify({ code: "0", msg: "成功", data: def.versionPayload });
      await page.route("**/api/app/version/admin_web", (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
    }
    let extra = {};
    try {
      extra = (await def.run(page, vp, state)) ?? {};
    } catch (e) {
      sceneErrors.push({ viewport: vp.id, scene: def.scene, stage: "操作", error: redactText(String(e)).slice(0, 900) });
      log(`  ⚠ ${vp.id}/${def.scene} 操作失败：${redactText(String(e)).slice(0, 200)}`);
    }
    const readoutPost = await page.evaluate(READOUT, extra.probe ?? {});
    const throttleBefore = await page.evaluate((k) => localStorage.getItem(k), THROTTLE_KEY);
    // 场景可以在「决定性瞬间」自己按快门（例如键盘焦点停在取消按钮上那一刻）：
    // 那一帧之后还要继续操作，末帧已经看不到了。自留帧与末帧走同一条哈希/字节口径，
    // 浮层几何取自同一瞬间 ⇒ 截图与读数互证（卡 §五）。
    const readout = state.decisive
      ? { ...readoutPost, overlay: state.decisive.overlay, primaryAction: state.decisive.primaryAction ?? readoutPost.primaryAction, capturedAt: "decisive-moment(self-shot)" }
      : readoutPost;
    if (state.selfShot) readout.capturedAt = "decisive-moment(self-shot)";
    const buf = state.selfShot ? readFileSync(state.shotPath) : await page.screenshot({ path: state.shotPath, fullPage: false });
    readout.writes = { readAllRequests: readAll.count, endpoint: READ_ALL_API };
    if (extra.notify) {
      readout.notify = {
        required: true,
        throttleKeyWritten: !!throttleBefore,
        payloadSource: "harness-version-stub",
        // 文案证据取「通知还在屏上」那一刻的记录（重载后的末帧里它已经消失）
        overlayText: state.overlayText ?? String(readout.overlay?.box?.text ?? ""),
        checkerHitsElNotification: /v0\.2\.0/.test(String(state.overlayText ?? readout.overlay?.box?.text ?? "")),
        notificationGoneAfterReload: state.notifyGoneAfterReload ?? null,
        renotifiedAfterReload: state.renotifiedAfterReload ?? null,
        documentReloads: state.reloadDelta ?? 0,
        stubVersionName: def.versionPayload.versionName,
        stubIsForce: def.versionPayload.isForce,
      };
    }
    if (extra.expectKeyboard && state.focusSnapshot) readout.overlay.focus = state.focusSnapshot;
    if (state.keyboardTrail) readout.keyboardTrail = state.keyboardTrail;
    if (extra.drawer) {
      readout.drawer = {
        required: true,
        openBefore: state.drawer?.openBefore === true,
        closedAfter: state.drawer?.closedAfter === true,
        method: state.drawer?.method ?? null,
        exposedPoint: state.drawer?.exposedPoint ?? null,
        forceUsed: false,
      };
    }
    if (state.keyboardTrail) readout.keyboardTrail = state.keyboardTrail;
    const entry = {
      viewport: vp.id,
      scene: def.scene,
      contract: "production",
      note: def.note,
      shot: `shots/${shotFile}`,
      capturedAt: readout.capturedAt ?? "post-run",
      legacyLayout: def.legacyLayout === true,
      sha256: sha256(buf),
      bytes: buf.length,
      overflowX: readout.overflowX,
      expectButtons: extra.expectButtons ?? [],
      expectWrites: extra.expectWrites ?? null,
      expectKeyboard: extra.expectKeyboard === true,
      expectKeyboardEnter: extra.expectKeyboardEnter === true,
      readout: { ...readout, toast: redactText(readout.toast) },
      stateSignature: f2StateSignature(readout),
    };
    shots.push(entry);
    log(
      `  ✓ ${vp.id}/${def.scene} exists=${readout.overlay?.exists} rules=${readout.overlay?.cssRules} rect=${readout.overlay?.box ? `${readout.overlay.box.rect.x},${readout.overlay.box.rect.y},${readout.overlay.box.rect.w}x${readout.overlay.box.rect.h}` : "-"} writes=${readAll.count} hash=${entry.sha256.slice(0, 10)}`,
    );
  } catch (e) {
    sceneErrors.push({ viewport: vp.id, scene: def.scene, stage: "采集", error: redactText(String(e)).slice(0, 900) });
    log(`  ✗ ${vp.id}/${def.scene} 采集失败：${redactText(String(e)).slice(0, 200)}`);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
}

/* ══════════════ 执行 ══════════════ */

let browser = null;
let exitCode = 0;
let auth = null;
let versionProbe = null;
try {
  await startBackend();
  await startVite();
  versionProbe = await probeVersionEndpoint();
  log(`版本端点真实探查：GET ${API_BASE}/app/version/admin_web → ${JSON.stringify(versionProbe)}`);
  auth = await loginViaProxy();
  browser = await chromium.launch({ executablePath: CHROME, headless: true });

  const targetVps = ONLY ? VIEWPORTS.filter((v) => v.id === ONLY) : VIEWPORTS;
  const wanted = ONLY_SCENE ? ONLY_SCENE.split(",").filter(Boolean) : [];
  const sceneFilter = (s) => wanted.length === 0 || wanted.some((w) => s.scene.includes(w));
  for (const vp of targetVps) {
    const plan = SCENES.filter((s) => s.viewports.includes(vp.id)).filter(sceneFilter);
    log(`\n视口 ${vp.id}：${plan.length} 个场景`);
    for (const def of plan) await runScene(browser, vp, auth, def);
  }
} catch (e) {
  exitCode = 1;
  console.error(`采集器异常：${redactText(String(e)).slice(0, 500)}`);
  console.error(`后端日志尾部：${redactText(backendTail.join("").slice(-1200))}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopAll().catch(() => {});
}

const bundle = {
  schema: "wb13-f2-func-measures/v1",
  generatedAt: new Date().toISOString(),
  task: "WORKBENCH-13-WORKBENCH-UIUX-COMPLETE-01-F2",
  app: {
    origin: ORIGIN,
    apiBase: API_BASE,
    loginVia: `${ORIGIN}${API_BASE}/admin/auth/demo-login`,
    user: auth?.user?.username ?? null,
    roles: auth?.user?.roles ?? [],
  },
  apiBase: API_BASE,
  browsers: { engine: "chrome", headless: true, reducedMotion: "reduce", executable: CHROME },
  servers: { backendPort: BACKEND_PORT, webPort: WEB_PORT, startedBy: "harness", portsAllDown },
  viewports: targetViewportsForBundle(),
  versionEndpoint: {
    path: `${API_BASE}/app/version/admin_web`,
    realBackendRead: versionProbe,
    disclosure:
      "mock 后端 t_app_version 无已发布行 ⇒ 真实返回 data:null，客户端检查永远不会出通知；通知/强制帧只在 HTTP 边界替换这一个端点的响应体，版本比较·节流·ElNotification·样式·点击刷新全部由 src/modules/update/checker.ts 原样执行（payloadSource=harness-version-stub，生产代码运行以节流键 zx_web_update_check_v1 机器自证）",
    stubFields: ["versionCode", "versionName", "minVersionCode", "isForce", "updateUrl", "packageUrl", "updateNote", "updatedAt"],
  },
  updateCheckerMount: {
    file: "src/modules/update/checker.ts",
    calledBy: "src/layouts/MainLayout.vue (onMounted)",
    reachableWhen: 'wb.shell.v2=0（旧壳回滚路径）；新壳默认开启时 MainLayout 不挂载 ⇒ 已登记为产品缺口',
    localVersion: "0.1.0",
  },
  scenes: shots,
  findings: {
    legacyOverflow: listLegacyOverflow(shots),
    legacyOverflowNote:
      "更新通知/强制帧只能挂在 checkWebUpdate() 的既有挂载点（旧壳 MainLayout）上；旧壳本身不做窄屏适配 ⇒ 390 上的横向溢出登记为产品缺口（放开 MainLayout 写入权限后另单修），不静默放行、也不用 hack 推到首屏",
    updateCheckerNotMountedOnNewShell:
      "新壳（wb.shell.v2 默认开）不渲染 MainLayout ⇒ checkWebUpdate() 不执行 ⇒ 生产默认态下用户收不到更新提示；本卡不改业务页面，登记为产品缺口",
  },
  network: {
    failures: netFailures,
    recovered: netRecovered.filter((r) => netFailures.some((f) => f.signature === r.signature)),
    expectedOffline: EXPECTED_OFFLINE_ENDPOINTS,
  },
  sceneErrors,
  harness: { keepServers: KEEP_SERVERS, only: ONLY || null },
};
bundle.violations = collectViolationsF2(bundle);

function targetViewportsForBundle() {
  const ids = new Set(shots.map((s) => s.viewport));
  return VIEWPORTS.map((v) => v.id).filter((id) => ids.has(id));
}

writeFileSync(path.join(OUT, "measure", "f2-func-measures.json"), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
writeFileSync(path.join(OUT, "logs", "f2-harness.json"), `${JSON.stringify({ log: harnessLog.map(redactText), sceneErrors, versionProbe }, null, 2)}\n`, "utf8");
// 仓内副本：专项测试只读这个文件 ⇒ clean 检出即可复现绿色。
// 局部采集（--only/--scene）只出调试证据，绝不覆盖仓内 fixture。
if (ONLY || ONLY_SCENE) {
  log("\n（局部采集：跳过写入 tests/fixtures/f2-func-measures.json）");
} else {
  writeFileSync(path.join(WEB, "tests", "fixtures", "f2-func-measures.json"), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}

log(`\n截图 ${shots.length} 张 → ${path.join(OUT, "shots")}`);
log(`门禁违例 ${bundle.violations.length} 条${bundle.violations.length ? "：" : "（全部通过）"}`);
for (const v of bundle.violations) log(`  ✗ ${v}`);
process.exitCode = exitCode || (bundle.violations.length ? 1 : 0);
