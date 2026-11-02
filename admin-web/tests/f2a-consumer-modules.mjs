/**
 * WORKBENCH-13-F2 · 消费者验收采集器（卡 §四.1/3/4 · 生产态 · 真实 SUPER_ADMIN）
 *
 * F1 时代的 rail 模块扫描只有 **?wb_uiux 注入态**（场景 27/28/29），而 F2 卡 §三.A.2 末条
 * 明确「注入态只可用于结构诊断，不得作为生产验收证据」⇒ 本采集器把 §四.1/§四.3/§四.4
 * 重新落在**无注入的生产 URL** 上：
 *   1) 自起自停后端与同源 /api 代理，真实 SUPER_ADMIN 登录；
 *   2) 工作台页先做「员工 ⇄ 对话」分段双向切换（aria-label / 目录状态实测随切换变化）；
 *   3) 逐个真实点击 11 个一级业务模块：选中态主蓝、二级目录在场、主面有可见内容、零裁切；
 *   4) 点回「工作台」：信息流面 + 双入口说明块 + 常用功能六宫格回位；
 *   5) 逐场景截图入证据，读数走 collectConsumerViolations 机器门禁，仓内留副本。
 *
 * 服务起停/登录/网络审计与 A/B 段采集器同一口径（刻意自带一份实现，不动已交付的 A/B 脚本）。
 *
 * 用法（admin-web 目录）：
 *   node tests/f2a-consumer-modules.mjs <evidenceDir 绝对路径>
 * 环境变量：WB13_BACKEND_PORT / WB13_WEB_PORT / WB13_CHROME
 *
 * 输出：
 *   <evidenceDir>/shots/consumer-*.png                    逐模块 + 分段切换 + 回退截图
 *   <evidenceDir>/measure/f2a-consumer-modules.json       消费者读数 + 门禁结果
 *   <evidenceDir>/logs/f2a-consumer-harness.json          服务起停 / 网络尾部日志
 *   admin-web/tests/fixtures/f2a-consumer-modules.json    仓内副本（专项测试只读它）
 */
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { EXPECTED_OFFLINE_ENDPOINTS, portOfUrl, redactText } from "./uiux-scenarios-lib.mjs";
import { BASE_VIEWPORT, CONSUMER_MODULE_LABELS, collectConsumerViolations } from "./f2a-visual-baseline-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");

const EVIDENCE = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!EVIDENCE) {
  console.error("用法：node tests/f2a-consumer-modules.mjs <evidenceDir>");
  process.exit(2);
}
const OUT = path.resolve(EVIDENCE);
mkdirSync(path.join(OUT, "shots"), { recursive: true });
mkdirSync(path.join(OUT, "measure"), { recursive: true });
mkdirSync(path.join(OUT, "logs"), { recursive: true });

const BACKEND_PORT = Number(process.env.WB13_BACKEND_PORT ?? 8080);
const WEB_PORT = Number(process.env.WB13_WEB_PORT ?? 5199);
const ORIGIN = `http://localhost:${WEB_PORT}`;
const API_BASE = "/api";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const harnessLog = [];
const backendTail = [];
const log = (msg) => {
  harnessLog.push(`${new Date().toISOString()} ${msg}`);
  console.log(msg);
};

/* ────────────────────────── 服务自起自停（与 A/B 段同一口径） ────────────────────────── */

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
    throw new Error(`端口 ${BACKEND_PORT} 已被占用：采集器要求自起自停（用 WB13_BACKEND_PORT 换空闲端口）`);
  }
  const child = spawn(process.execPath, ["scripts/dev-mock.mjs"], {
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      USE_MOCK_DB: "true",
      NODE_ENV: "development",
      PORT: String(BACKEND_PORT),
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
    throw new Error(`端口 ${WEB_PORT} 已被占用：采集器要求自起自停（用 WB13_WEB_PORT 换空闲端口）`);
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
  child.stdout.on("data", (b) => harnessLog.push(`[vite] ${String(b).trim()}`));
  child.stderr.on("data", (b) => harnessLog.push(`[vite-err] ${String(b).trim()}`));
  if (!(await waitForPort(WEB_PORT, true, 210000))) throw new Error(`vite ${WEB_PORT} 未在 210s 内就绪`);
  boundPorts.add(WEB_PORT);
  log(`前端 dev server 已起（${ORIGIN}，VITE_API_BASE=${API_BASE}）`);
}
let portsAllDown = false;
async function stopAll() {
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
        log(`经 /api 同源代理登录成功（第 ${attempt} 次）：user=${j.data.user?.username} roles=${JSON.stringify(j.data.user?.roles ?? [])}`);
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

/* ────────────────────────── 浏览器与读数 ────────────────────────── */

const require = createRequire(path.join(WEB, "package.json"));
const { chromium } = require("playwright");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

const netFailures = [];
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
  await ctx.addInitScript(
    ({ token, csrf, user }) => localStorage.setItem("admin_auth", JSON.stringify({ token, user: { ...user, csrfToken: csrf } })),
    { token: auth.token, csrf: auth.csrfToken, user: auth.user },
  );
  const page = await ctx.newPage();
  attachNetwork(page);
  return { ctx, page };
}

const fileShot = (file) => ({ file: `shots/${path.basename(file)}`, bytes: statSync(file).size, sha256: sha256(readFileSync(file)) });

/** rail 全部真实项（排除骨架/设置项）：data-rail-key + 文案 + 选中态 computed，顺带点击 */
function railProbeReader() {
  const items = [...document.querySelectorAll('[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton)')];
  return items.map((el) => {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const icon = el.querySelector("svg, .el-icon, [class*=ic]");
    return {
      railKey: el.getAttribute("data-rail-key") ?? "",
      label: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 20),
      className: el.className,
      on: el.classList.contains("on"),
      rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      backgroundColor: st.backgroundColor,
      color: st.color,
      iconColor: icon ? getComputedStyle(icon).color : "",
      clickable: r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden",
    };
  });
}

/** 主面与二级列的在场读数：可见性 + 文本样本 + 溢出 */
function sceneReader() {
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.01;
  };
  const q = (sel) => document.querySelector(sel);
  const main = q(".wb-main");
  const search = q('[data-testid="second-nav-search"]');
  const segOn = q('[data-testid="second-nav-tabs"] .sn-seg-btn.on');
  const dir = q('[data-testid="second-nav-directory"]');
  return {
    url: location.href.replace(/[?#].*$/, ""),
    href: location.href,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mainVisible: visible(main),
    mainText: (main?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
    hasContent: visible(main) && (main?.textContent || "").trim().length > 0,
    feedShown: !!q('[data-view="feed"].shown') || !!q('[data-testid="feed-view"]'),
    secondNavVisible: visible(q('[data-testid="second-nav"]')),
    subZoneVisible: visible(q('[data-testid="second-nav-sub-zone"]')),
    dualNoteVisible: visible(q('[data-testid="second-nav-dual-note"]')),
    gridVisible: visible(q('[data-testid="second-nav-sub-zone"] .sn-grid')) || visible(q(".sn-grid")),
    dirVisible: visible(dir),
    dirState: dir?.getAttribute("data-dir-state") ?? "",
    dirText: (dir?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
    segActiveTab: (segOn?.textContent || "").trim(),
    searchAriaLabel: search?.getAttribute("aria-label") ?? "",
    uiuxInject: q('[data-testid="wb-shell"]')?.getAttribute("data-uiux-inject") ?? "absent",
    shellMounted: !!q('[data-testid="wb-shell"]'),
  };
}

let browser = null;
let exitCode = 0;
let aborted = null;
const errors = [];
const frames = [];
const modules = [];
let segToggle = {};
let backToDesk = {};
let production = {};
let auth = null;

try {
  await startBackend();
  await startVite();
  auth = await loginViaProxy();
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const { ctx, page } = await newPage(browser, BASE_VIEWPORT, auth);
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(redactText(String(e)).slice(0, 300)));

  await page.goto(ORIGIN, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
  if (!(await page.locator('[data-testid="feed-view"]').count())) {
    const desk = page.locator('[data-testid="rail"] [data-rail-key="desk"]').first();
    if ((await desk.count()) > 0) {
      await desk.click();
      await page.waitForTimeout(1200);
    }
  }
  const desk0 = await page.evaluate(sceneReader);
  production = { href: desk0.href, injected: String(desk0.uiuxInject) === "on", uiuxInject: desk0.uiuxInject, shellMounted: desk0.shellMounted };
  if (!desk0.feedShown) errors.push("生产 URL 打开后未落定信息流面（§四.1）");

  /* ── 1) 员工 ⇄ 对话 分段双向切换（§四.4） ── */
  segToggle.before = { activeTab: desk0.segActiveTab, searchAriaLabel: desk0.searchAriaLabel, dirState: desk0.dirState, dirText: desk0.dirText };
  await page.locator('[data-testid="second-nav-tabs"] [data-side-tab="对话"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  const chat = await page.evaluate(sceneReader);
  const chatShot = path.join(OUT, "shots", "consumer-seg-chat.png");
  await page.screenshot({ path: chatShot });
  frames.push({ label: "seg-chat", ...fileShot(chatShot), overflowX: chat.overflowX });
  segToggle.afterChat = { activeTab: chat.segActiveTab, searchAriaLabel: chat.searchAriaLabel, dirState: chat.dirState, dirText: chat.dirText, overflowX: chat.overflowX, shot: fileShot(chatShot) };
  await page.locator('[data-testid="second-nav-tabs"] [data-side-tab="员工"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  const staff = await page.evaluate(sceneReader);
  const staffShot = path.join(OUT, "shots", "consumer-seg-staff.png");
  await page.screenshot({ path: staffShot });
  frames.push({ label: "seg-staff", ...fileShot(staffShot), overflowX: staff.overflowX });
  segToggle.afterStaffAgain = { activeTab: staff.segActiveTab, searchAriaLabel: staff.searchAriaLabel, dirState: staff.dirState, dirText: staff.dirText, overflowX: staff.overflowX, shot: fileShot(staffShot) };

  /* ── 2) 逐个真实点击 11 个业务模块（§四.3） ── */
  for (const label of CONSUMER_MODULE_LABELS) {
    const errBase = pageErrors.length;
    const railItem = page.locator(`[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton) >> text=${label}`).first();
    await railItem.click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    const read = await page.evaluate(sceneReader);
    const rails = await page.evaluate(railProbeReader);
    const hit = rails.find((x) => x.label === label) ?? rails.find((x) => x.label.includes(label)) ?? {};
    const shot = path.join(OUT, "shots", `consumer-module-${label}.png`);
    await page.screenshot({ path: shot });
    frames.push({ label: `module-${label}`, ...fileShot(shot), overflowX: read.overflowX });
    modules.push({
      label,
      railKey: hit.railKey ?? "",
      clicked: true,
      railItem: { on: hit.on === true, backgroundColor: hit.backgroundColor ?? "", color: hit.color ?? "", iconColor: hit.iconColor ?? "", rect: hit.rect ?? {} },
      main: { url: read.url, hasContent: read.hasContent, mainVisible: read.mainVisible, mainText: read.mainText, overflowX: read.overflowX },
      subnav: { secondNavVisible: read.secondNavVisible, dirVisible: read.dirVisible, dirState: read.dirState, subZoneVisible: read.subZoneVisible },
      pageerror: pageErrors.slice(errBase),
      shot: fileShot(shot),
    });
    log(`模块 ${label}：railKey=${hit.railKey} on=${hit.on} 主面=${read.hasContent ? "有内容" : "空白"} 目录=${read.dirState || "∅"} overflowX=${read.overflowX}`);
  }

  /* ── 3) 点回工作台，回退常用功能（§四.3 末项） ── */
  await page.locator('[data-testid="rail"] [data-rail-key="desk"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  const deskBack = await page.evaluate(sceneReader);
  const railsDesk = await page.evaluate(railProbeReader);
  const deskHit = railsDesk.find((x) => x.label === "工作台") ?? {};
  const shotDesk = path.join(OUT, "shots", "consumer-back-desk.png");
  await page.screenshot({ path: shotDesk });
  frames.push({ label: "back-desk", ...fileShot(shotDesk), overflowX: deskBack.overflowX });
  backToDesk = {
    feedShown: deskBack.feedShown,
    dualNoteVisible: deskBack.dualNoteVisible,
    gridVisible: deskBack.gridVisible,
    overflowX: deskBack.overflowX,
    railItem: { on: deskHit.on === true, backgroundColor: deskHit.backgroundColor ?? "", color: deskHit.color ?? "" },
    url: deskBack.url,
    shot: fileShot(shotDesk),
  };
  log(`回退工作台：feed=${deskBack.feedShown} 说明块=${deskBack.dualNoteVisible} 六宫格=${deskBack.gridVisible}`);

  if (pageErrors.length) errors.push(`页面未捕获异常 ${pageErrors.length} 条：${pageErrors[0].slice(0, 120)}`);
  await ctx.close();
} catch (e) {
  exitCode = 1;
  aborted = redactText(String(e)).slice(0, 400);
  errors.push(aborted);
  console.error(`消费者采集器异常：${aborted}`);
  console.error(`后端日志尾部：${redactText(backendTail.join("").slice(-1200))}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopAll().catch(() => {});
}

const bundle = {
  schema: "wb13-f2a-consumer-modules/v1",
  generatedAt: new Date().toISOString(),
  task: "WORKBENCH-13-WORKBENCH-UIUX-COMPLETE-01-F2",
  segment: "A · 消费者验收（生产 URL · 真实 SUPER_ADMIN · 无注入）",
  app: { origin: ORIGIN, apiBase: API_BASE, user: auth?.user?.username ?? null, roles: auth?.user?.roles ?? [] },
  apiBase: API_BASE,
  browsers: { engine: "chrome", headless: true, reducedMotion: "reduce", executable: CHROME },
  servers: { backendPort: BACKEND_PORT, webPort: WEB_PORT, startedBy: "harness", portsAllDown },
  production,
  method: "逐个真实点击 11 个业务模块（不注入、不 force）：读选中态 computed 实色 + 二级目录在场 + 主面可见文本；员工⇄对话分段双向切换读 aria-label 与目录状态迁移",
  modules,
  backToDesk,
  segToggle,
  frames,
  errors,
  aborted,
  network: { failures: netFailures, recovered: [] },
  expectedOffline: EXPECTED_OFFLINE_ENDPOINTS,
};
const recoveredSignatures = new Set();
for (const f of netFailures) {
  const pathOnly = f.url.replace(/[?#].*$/, "");
  if ((okUrls.get(pathOnly) ?? 0) > 0) recoveredSignatures.add(f.signature);
}
bundle.network.recovered = netFailures.filter((f) => recoveredSignatures.has(f.signature)).map((f) => ({ signature: f.signature, via: "同 URL 在验收窗口内有 2xx/3xx 成功响应" }));
bundle.violations = collectConsumerViolations(bundle);

const payload = redactText(JSON.stringify(bundle, null, 2));
writeFileSync(path.join(OUT, "measure", "f2a-consumer-modules.json"), payload, "utf8");
writeFileSync(path.join(OUT, "logs", "f2a-consumer-harness.json"), redactText(JSON.stringify({ harnessLog, backendTail: backendTail.join("").slice(-4000) }, null, 2)), "utf8");
writeFileSync(path.join(WEB, "tests", "fixtures", "f2a-consumer-modules.json"), payload, "utf8");

console.log(`\n消费者采集完成：模块 ${modules.length} 个 · 帧 ${frames.length} 张`);
if (bundle.violations.length === 0) {
  console.log("消费者门禁违例 0 条（§四.1/3/4 通过）");
} else {
  console.log(`消费者门禁违例 ${bundle.violations.length} 条：`);
  for (const v of bundle.violations.slice(0, 40)) console.log(`  ✗ ${v}`);
  exitCode = exitCode || 3;
}
console.log(`证据 → ${path.join(OUT, "measure", "f2a-consumer-modules.json")} + 仓内 fixture 副本`);
process.exit(exitCode);
