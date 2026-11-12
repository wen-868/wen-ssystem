/**
 * WORKBENCH-13-F1 · 真实场景采集器（自起自停服务 + 逐场景状态切换 + 机器门禁）
 *
 * 为什么重写（凌舟驳回 §二.3/§二.4/§二.5）：
 *   旧采集器对 01/02/03/05 四个「场景」全部 `goto("/dashboard")` 且不做任何切换
 *   ⇒ 同视口 4 张 PNG 哈希完全相同；骨架还同时 `aria-disabled=true` 要求点击。
 *   本采集器的原则：**每个场景自带切换动作，先切换、再截图**，并用「结构读数签名 +
 *   PNG SHA256」双重判红 ⇒ 把同一帧改名成新场景不可能通过。
 *   判定规则在 `uiux-scenarios-lib.mjs`，采集端与专项测试共用同一份，口径不会分叉。
 *
 * 用法（admin-web 目录，需 8080/5199 空闲）：
 *   node tests/uiux-scenarios.mjs <evidenceDir 绝对路径> [--only=1440x1000] [--scene=21] [--keep-servers]
 *
 * 输出：
 *   <evidenceDir>/shots/*.png                          真实浏览器截图
 *   <evidenceDir>/measure/f1-scene-measures.json       场景读数 + 哈希 + 门禁结果
 *   <evidenceDir>/logs/f1-harness.json                 服务起停 / 网络审计 / 逐场景日志
 *   admin-web/tests/fixtures/uiux-scene-measures.json  同一 bundle 的仓内副本（专项测试只读它）
 */
import { createHash, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_OFFLINE_ENDPOINTS,
  VIEWPORTS,
  collectViolations,
  portOfUrl,
  redactText,
  sceneStateSignature,
} from "./uiux-scenarios-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");

const args = process.argv.slice(2);
const EVIDENCE = args.find((a) => !a.startsWith("--"));
if (!EVIDENCE) {
  console.error("用法：node tests/uiux-scenarios.mjs <evidenceDir> [--only=<viewport>] [--keep-servers]");
  process.exit(2);
}
const ONLY = (args.find((a) => a.startsWith("--only=")) ?? "").replace("--only=", "");
/** 调试用：只跑场景名包含该子串的条目（不改变门禁口径，仅缩小采集范围） */
const ONLY_SCENE = (args.find((a) => a.startsWith("--scene=")) ?? "").replace("--scene=", "");
const KEEP_SERVERS = args.includes("--keep-servers");
const OUT = path.resolve(EVIDENCE);
mkdirSync(path.join(OUT, "shots"), { recursive: true });
mkdirSync(path.join(OUT, "measure"), { recursive: true });
mkdirSync(path.join(OUT, "logs"), { recursive: true });

/**
 * 端口默认按卡面 8080/5199（正式证据必须用默认值）。
 * 只有「8080 被别的会话占着」这类外部冲突时才临时改端口做局部排查；采集器从不代别人杀端口。
 */
const BACKEND_PORT = Number(process.env.WB13_BACKEND_PORT ?? 8080);
const WEB_PORT = Number(process.env.WB13_WEB_PORT ?? 5199);
const ORIGIN = `http://localhost:${WEB_PORT}`;
const API_BASE = "/api";
const INJECT_PARAM = "wb_uiux=12-groups";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

/* ────────────────────────── 服务自起自停 ────────────────────────── */

const harnessLog = [];
const backendTail = [];
const log = (msg) => {
  const line = `${new Date().toISOString()} ${msg}`;
  harnessLog.push(line);
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

/**
 * vite 6 在本机把 `localhost` 解析到 **IPv6**（`[::1]:5199`），
 * 只探 127.0.0.1 会误判为「未就绪」⇒ 双栈都探。
 */
async function probePort(port) {
  for (const host of ["127.0.0.1", "::1"]) {
    if (await probeHost(host, port)) return true;
  }
  return false;
}

/** 端口占用时给出 PID 线索，便于「自起自停」失败后定位是谁占了口 */
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

/**
 * 端口上现在的监听者一定是本次采集器自己拉起的（启动前已校验端口空闲），
 * 所以这里可以安全地按 PID 精确清理 —— 包括 `tsx watch` 在父进程被杀后重生子的情况。
 */
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

async function waitForPort(port, up, timeoutMs = 90000) {  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if ((await probePort(port)) === up) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const children = [];
/** 本次由采集器自己绑上的端口：只有这些端口允许被强制清理（不去杀别人的服务） */
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
      // 本地一次性开发密钥：每次运行随机生成，不写死在仓库里，也不落进任何证据文件
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
      // 关键（卡 §三.9）：API 基址同源 /api，由 vite 代理到 127.0.0.1:8080 ⇒ 不产生可避免的跨域失败
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
  // 首次在新工作树里跑时 vite 要做依赖预构建，90s 不够
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
    // 只清理本次自己绑上的端口：若某个端口从头到尾不是我们起的，绝不代别人杀
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

/* ────────────────────────── 真实登录（经同源 /api 代理） ────────────────────────── */

async function loginViaProxy() {
  // 端口一开不等于路由已挂好：mock 后端的 auto-routes/定时任务还在初始化时，首发请求可能 500。
  // 只对 5xx/连接错误重试（4xx 是真故障，直接判红），最多 6 次；每次都必须走同源 /api 代理。
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

/* ────────────────────────── 页面读数 ────────────────────────── */

const READOUT = () => {
  const shell = document.querySelector('[data-testid="wb-shell"]');
  const shown = (name) => {
    const el = document.querySelector(`[data-view="${name}"]`);
    return !!(el && el.classList.contains("shown"));
  };
  const visCount = (sel) =>
    [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden";
    }).length;
  const railBtns = [...document.querySelectorAll("[data-rail-key]")];
  const skels = [...document.querySelectorAll('[data-rail-skeleton="true"]')];
  const text = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
  };
  const de = document.documentElement;
  const overflowX = Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth;
  const toasts = [...document.querySelectorAll(".el-message")]
    // 只认「屏幕上真的看得见」的提示：淡入淡出中的 toast 仍在 DOM 里，
    // 若把它记进读数而截图里没有，就会出现「读数不同、平图相同」的假切换（390 实测踩到）
    .filter((t) => {
      const r = t.getBoundingClientRect();
      const st = getComputedStyle(t);
      return r.width > 0 && r.height > 0 && r.top >= 0 && r.top < innerHeight && Number(st.opacity) > 0.5;
    })
    .map((t) => t.textContent.trim().replace(/\s+/g, " "));
  const userMsgs = [...document.querySelectorAll(".ai-message.is-user .user-bubble")].map((b) =>
    b.textContent.trim().replace(/\s+/g, " ").slice(0, 60),
  );
  const dir = document.querySelector('[data-testid="second-nav-directory"]');
  // 已关闭的 el-dialog 仍留在 DOM 里 ⇒ 只认「可见」的那一层，否则读数是脏的
  const visDlg = [...document.querySelectorAll(".el-dialog")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const inDlg = (sel) => {
    for (const d of visDlg) {
      const el = d.querySelector(sel);
      if (el) return el;
    }
    return null;
  };
  const pane = inDlg(".pane[data-pane]");
  const activeTab = inDlg(".sw-nav-item.on");
  const onRail = railBtns.find((b) => b.classList.contains("on"));
  const pressed = skels.find((b) => b.getAttribute("aria-pressed") === "true");
  return {
    path: location.pathname,
    query: location.search,
    title: text(".wb-top-title") || document.title,
    mode: shell ? (shell.classList.contains("is-ai") ? "ai" : "human") : "none",
    uiuxInject: shell ? shell.dataset.uiuxInject ?? "" : "",
    feedShown: shown("feed"),
    chatShown: shown("chat"),
    manualShown: shown("manual"),
    settingTab: activeTab ? activeTab.dataset.settingTab ?? "" : "",
    dialogHeader: visDlg.length
      ? (visDlg[0].querySelector(".sw-title, .el-dialog__title, .el-dialog__header")?.textContent ?? "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40)
      : "",
    activePane: pane ? pane.dataset.pane : "",
    overlayCount: visCount(".el-overlay"),
    dialogCount: visCount(".el-dialog"),
    emptyCount: visCount(".el-empty"),
    menuLoading: !!document.querySelector('[data-testid="menu-loading"]'),
    menuFault: !!document.querySelector('[data-testid="menu-fault"]'),
    menuRetry: !!document.querySelector('[data-testid="menu-retry"]'),
    menuEmpty: !!document.querySelector('[data-testid="menu-empty"]'),
    railSkeletonCount: skels.length,
    railKeys: railBtns.map((b) => b.dataset.railKey),
    selectedRailKey: onRail ? onRail.dataset.railKey : "",
    pendingRailKey: pressed ? pressed.dataset.railKey : "",
    pendingRailPressed: !!pressed,
    railAriaDisabledCount: railBtns.filter((b) => b.getAttribute("aria-disabled") === "true").length,
    sideCollapsed: shell ? shell.classList.contains("side-hidden") : false,
    drawerOpen: !!document.querySelector('[data-testid="side-mask"]'),
    ledgerOpen: !!document.querySelector('[data-testid="ledger-drawer"]'),
    dirState: dir ? dir.dataset.dirState ?? "" : "",
    wiringNote: text('[data-testid="second-nav-wiring-note"]'),
    subZoneTitle: text('[data-testid="second-nav-sub-title"]'),
    composerVisible: visCount('[data-testid="chat-composer"]') > 0,
    chatMsgCount: document.querySelectorAll(".ai-message").length,
    chatLastUserText: userMsgs[userMsgs.length - 1] ?? "",
    chatSessionsOpen: document.querySelector('[data-testid="chat-sessions-toggle"]')?.getAttribute("aria-expanded") === "true",
    aiFault: !!document.querySelector('[data-testid="ai-fault-banner"]'),
    toast: toasts[toasts.length - 1] ?? "",
    toastRects: [...document.querySelectorAll(".el-message")].map((t) => {
      const r = t.getBoundingClientRect();
      const st = getComputedStyle(t);
      return {
        top: Math.round(r.top),
        left: Math.round(r.left),
        w: Math.round(r.width),
        h: Math.round(r.height),
        opacity: st.opacity,
        pos: st.position,
        z: st.zIndex,
        text: t.textContent.trim().replace(/\s+/g, " ").slice(0, 24),
      };
    }),
    bodyTextLen: document.body.innerText.trim().length,
    // 卡 §四.2「深链接打开采购订单，页面与数据真实可见」+ §六.2「不得仅凭 URL 变化证明页面可见」：
    // 只读 path/title/bodyTextLen 会放过「路由切换了但表格是空的」，所以把可见行数与首行内容一起记进读数。
    bizRows: [...document.querySelectorAll(".el-table__body tr")].filter((r) => r.getBoundingClientRect().height > 0).length,
    bizFirstRow: (document.querySelector(".el-table__body tr")?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    overflowX,
    docScrollWidth: Math.max(de.scrollWidth, document.body.scrollWidth),
    clientWidth: de.clientWidth,
  };
};

/* ────────────────────────── 场景切换原语 ────────────────────────── */

async function open(page, routePath, { inject = false, waitIdle = true } = {}) {
  const url = `${ORIGIN}${routePath}${inject ? `?${INJECT_PARAM}` : ""}`;
  await page.goto(url, { waitUntil: waitIdle ? "networkidle" : "domcontentloaded", timeout: 45000 });
  await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 20000 });
}

const act = {
  async menuReady(page) {
    await page.waitForFunction(() => !document.querySelector('[data-testid="menu-loading"]'), { timeout: 25000 });
    await page.waitForTimeout(400);
  },
  async newChat(page) {
    await page.getByTestId("second-nav-new-chat").click({ timeout: 8000 });
    await page.waitForTimeout(800);
  },
  async openSessions(page) {
    await page.getByTestId("chat-sessions-toggle").click({ timeout: 8000 });
    await page.waitForTimeout(600);
  },
  /**
   * 窄屏抽屉的真实关闭路径：点遮罩。
   * 遮罩 inset:0 但**抽屉面板与一级导航条压在它上面**（居中/右下角都会点到别人身上），
   * 所以先网格化命中测试，找一个人眼看得见的遮罩露出区再点；找不到就是真缺陷，如实报错而不是 force 绕过。
   */
  async closeDrawer(page, vp) {
    const mask = page.locator('[data-testid="side-mask"]');
    if ((await mask.count()) === 0) return;
    const spot = await page.evaluate(() => {
      const m = document.querySelector('[data-testid="side-mask"]');
      if (!m) return null;
      for (let y = Math.round(window.innerHeight * 0.5); y < window.innerHeight; y += 16) {
        for (let x = window.innerWidth - 16; x >= 16; x -= 16) {
          if (document.elementFromPoint(x, y) === m) return { x, y };
        }
      }
      return null;
    });
    if (!spot) {
      throw new Error("遮罩在窄屏上没有任何可点露出区（抽屉关不掉）：真实缺陷，不用 force 绕过");
    }
    await mask.first().click({ timeout: 8000, position: spot });
    await page.waitForSelector('[data-testid="side-mask"]', { state: "detached", timeout: 8000 });
    await page.waitForTimeout(400);
  },
  async sendChat(page, text) {    await page.getByTestId("composer-input").fill(text);
    await page.getByTestId("composer-send").click({ timeout: 8000 });
    await page.waitForTimeout(2600);
  },
  /**
   * 卡 §三.A.2 末条：原型最后一层把 rail 末位 `.rl-set` **保留在 DOM 但视觉隐藏**，
   * 设置入口移到第二列底部账号区（`WorkbenchSubnav` 的 `second-nav-settings` → shell `@open-settings`）。
   * 因此这里点的是**真实可见的那个入口**，不是隐藏的 `[data-rail-key="set"]`
   * （隐藏节点点得到≠用户点得到；用 force 点击冒充可用是卡 §六 红线）。
   * rail 里的 set 节点仍存在，由 prototype-nav / prototype-parity 的源码契约继续守住。
   */
  async openSettings(page) {
    await page.locator('[data-testid="second-nav-settings"]').first().click({ timeout: 8000 });
    await page.waitForSelector(".sw-bd", { timeout: 10000 });
    await page.waitForTimeout(700);
  },
  async settingTab(page, key) {
    await page.locator(`[data-setting-tab="${key}"]`).first().click({ timeout: 8000 });
    await page.waitForTimeout(800);
  },
  async openPrintPanel(page) {
    await page.locator('[data-pane="print"]').getByRole("button", { name: "打开打印设置" }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1000);
  },
  /**
   * UI-PARITY-BASE 口径留痕：能力台账抽屉已按 top_bar.forbidden 移除，
   * 旧 openLedger（点击 agent-ledger-entry）作废；改为顶栏任务中心开关往返（合同 top_bar.right）。
   */
  async openTaskCenter(page) {
    const shell = page.locator('[data-testid="wb-shell"]');
    const collapsedBefore = await shell.evaluate((el) => el.classList.contains("tc-collapsed"));
    await page.getByTestId("task-center-toggle").click({ timeout: 8000 });
    await page.waitForTimeout(700);
    const collapsedAfter = await shell.evaluate((el) => el.classList.contains("tc-collapsed"));
    if (collapsedBefore === collapsedAfter) throw new Error("task-center-toggle 点击后 tc-collapsed 态未翻转");
    // 翻回原态，保持场景其余步骤的基线几何
    await page.getByTestId("task-center-toggle").click({ timeout: 8000 });
    await page.waitForTimeout(700);
    const collapsedBack = await shell.evaluate((el) => el.classList.contains("tc-collapsed"));
    if (collapsedBack !== collapsedBefore) throw new Error("task-center-toggle 二次点击未复原");
  },
  async collapseSide(page) {
    await page.getByTestId("second-nav-collapse").first().click({ timeout: 8000 });
    await page.waitForTimeout(600);
  },
  async toggleSide(page) {
    await page.getByTestId("side-toggle").click({ timeout: 8000 });
    await page.waitForTimeout(700);
  },
  /**
   * 窄视口（≤480）下第二栏默认收起，`second-nav-*` 控件不可点。
   * 需要操作二级导航的场景必须先展开抽屉——否则「点击失败」会被误当成页面缺陷。
   */
  async showSubnav(page, vp) {
    if (vp.width > 480) return;
    const collapsed = await page.evaluate(() =>
      document.querySelector('[data-testid="wb-shell"]')?.classList.contains("side-hidden"),
    );
    if (collapsed) await act.toggleSide(page);
  },
  async clickRail(page, key) {
    await page.locator(`[data-rail-key="${key}"]`).first().click({ timeout: 8000 });
    await page.waitForTimeout(700);
  },
  async slowMenus(page, ms = 3000) {
    await page.route("**/api/admin/menus/user*", async (route) => {
      await new Promise((r) => setTimeout(r, ms));
      await route.continue().catch(() => {});
    });
  },
  async failMenus(page) {
    await page.route("**/api/admin/menus/user*", (route) => route.abort("failed"));
  },
  async unrouteMenus(page) {
    await page.unroute("**/api/admin/menus/user*").catch(() => {});
    await page.waitForTimeout(500);
  },
  async skeleton(page, groupCode) {
    return page.locator(`[data-rail-skeleton="true"][data-rail-key="${groupCode}"]`).first();
  },
  async waitForSkeletons(page) {
    await page.waitForSelector('[data-rail-skeleton="true"]', { timeout: 15000 });
    await page.waitForTimeout(300);
  },
  async keyboardOnSkeleton(page, groupCode, key) {
    const skel = await act.skeleton(page, groupCode);
    await skel.focus({ timeout: 8000 });
    await page.keyboard.press(key);
    await page.waitForTimeout(500);
  },
  async mouseOnSkeleton(page, groupCode) {
    await (await act.skeleton(page, groupCode)).click({ timeout: 8000 });
    await page.waitForTimeout(500);
  },
};

/* ────────────────────────── 场景表 ────────────────────────── */

/**
 * 每个场景 `run` 自带导航 + 切换动作（不依赖上一场景遗留状态，因为每个场景用全新 context）。
 * `contract`：production = 真实权限链；injected = 开发态注入（DOM 必带 data-uiux-inject=on 水印，
 * 门禁会校验两者不得互相冒充）。
 * `vps`：该场景在哪些视口采集（390 不采集模态弹层，窄屏弹窗不属于本轮卡面验收范围）。
 */
const ALL3 = ["1440x1000", "1024x768", "390x844"];
const WIDE = ["1440x1000", "1024x768"];

const SCENES = [
  { scene: "01-ai-feed-default", vps: ALL3, contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); } },
  { scene: "02-ai-chat-new", vps: ALL3, contract: "production", run: async (p, vp) => {
      await open(p, "/dashboard");
      await act.menuReady(p);
      await act.showSubnav(p, vp);
      await act.newChat(p);
    } },
  { scene: "03-ai-chat-sent", vps: ["1440x1000"], contract: "production", run: async (p) => {
      // 真实发送路径：信息流态的底部输入条提交 ⇒ 壳层切到会话面并带上这条消息（enterChatAndSend）。
      // 先点「新对话」反而进不去：会话面内没有 composer-input（输入条只在非会话态渲染），会截到与会话空态同形的帧。
      await open(p, "/dashboard");
      await act.menuReady(p);
      await act.sendChat(p, "今天有哪些待处理事项？");
    } },
  { scene: "04-settings-center-appear", vps: WIDE, contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openSettings(p); } },
  { scene: "05-settings-tab-model", vps: WIDE, contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openSettings(p); await act.settingTab(p, "model"); } },
  { scene: "06-settings-tab-print", vps: WIDE, contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openSettings(p); await act.settingTab(p, "print"); } },
  { scene: "07-print-panel-single-modal", vps: WIDE, contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openSettings(p); await act.settingTab(p, "print"); await act.openPrintPanel(p); } },
  { scene: "08-settings-tab-conn-unavailable", vps: WIDE, contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openSettings(p); await act.settingTab(p, "conn"); } },
  { scene: "09-settings-tab-acct", vps: ["1440x1000"], contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openSettings(p); await act.settingTab(p, "acct"); } },
  { scene: "10-settings-tab-ops", vps: ["1440x1000"], contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openSettings(p); await act.settingTab(p, "ops"); } },
  { scene: "11-settings-tab-config", vps: ["1440x1000"], contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openSettings(p); await act.settingTab(p, "config"); } },
  { scene: "12-pos-cashier", vps: ALL3, contract: "production", run: async (p) => { await open(p, "/pos/cashier"); await p.waitForTimeout(1200); } },
  { scene: "13-purchase-orders-deeplink", vps: ALL3, contract: "production", run: async (p) => { await open(p, "/purchase-orders"); await p.waitForTimeout(1400); } },
  { scene: "14-order-aftersale", vps: ALL3, contract: "production", run: async (p) => { await open(p, "/order-aftersale"); await p.waitForTimeout(1400); } },
  { scene: "15-instant-retail-orders", vps: WIDE, contract: "production", run: async (p) => { await open(p, "/instant-retail/orders"); await p.waitForTimeout(1400); } },
  { scene: "16-task-center-toggle", vps: WIDE, contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.openTaskCenter(p); } },
  { scene: "17-coldstart-rail-skeleton", vps: ALL3, contract: "production", run: async (p) => { await act.slowMenus(p); await open(p, "/dashboard", { waitIdle: false }); await act.waitForSkeletons(p); } },
  { scene: "18-skeleton-intent-enter", vps: ALL3, contract: "production", run: async (p) => { await act.slowMenus(p); await open(p, "/dashboard", { waitIdle: false }); await act.waitForSkeletons(p); await act.keyboardOnSkeleton(p, "wb.purchase", "Enter"); } },
  { scene: "19-skeleton-intent-space", vps: ["1440x1000"], contract: "production", run: async (p) => { await act.slowMenus(p); await open(p, "/dashboard", { waitIdle: false }); await act.waitForSkeletons(p); await act.keyboardOnSkeleton(p, "wb.sales", "Space"); } },
  { scene: "20-skeleton-intent-mouse", vps: ALL3, contract: "production", run: async (p) => { await act.slowMenus(p); await open(p, "/dashboard", { waitIdle: false }); await act.waitForSkeletons(p); await act.mouseOnSkeleton(p, "wb.product"); } },
  { scene: "21-intent-miss-warning", vps: ALL3, contract: "production", run: async (p, vp) => {
      // 生产真实路径：/menus/user 返回空集 ⇒ 意图无法命中 ⇒ 可重试告警（不静默）
      await act.slowMenus(p);
      await open(p, "/dashboard", { waitIdle: false });
      await act.waitForSkeletons(p);
      await act.mouseOnSkeleton(p, "wb.purchase");
      await act.unrouteMenus(p);
      await act.menuReady(p);
      // 可重试告警必须**在屏幕上看得见**才成立（卡 §三.8）：等到视口内且不透明；
      // 只等到 DOM 里有一条 toast 不算数——实测过它曾整条落在 fold 之外，读数有字、截图没字。
      await p.waitForFunction(
        () => {
          const t = [...document.querySelectorAll(".el-message")].pop();
          if (!t) return false;
          const r = t.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.top >= 0 &&
            r.top < window.innerHeight &&
            Number(getComputedStyle(t).opacity) > 0.95
          );
        },
        null,
        { timeout: 12000 },
      );
    } },
  { scene: "22-menu-fault", vps: ALL3, contract: "production", run: async (p) => {
      // 端点不可用（真实中断，不是假数据）⇒ 错误态 + 重试入口
      await act.failMenus(p);
      await open(p, "/dashboard", { waitIdle: false });
      await p.waitForSelector('[data-testid="menu-fault"]', { timeout: 20000 });
      await p.waitForTimeout(500);
    } },
  { scene: "23-subnav-collapsed", vps: WIDE, contract: "production", run: async (p, vp) => { await open(p, "/dashboard"); await act.menuReady(p); await act.showSubnav(p, vp); await act.collapseSide(p); } },
  { scene: "24-narrow-drawer-open", vps: ["390x844"], contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); await act.toggleSide(p); } },
  { scene: "25-narrow-pos-drawer", vps: ["390x844"], contract: "production", run: async (p) => { await open(p, "/pos/cashier"); await p.waitForTimeout(1200); await act.toggleSide(p); } },
  { scene: "26-narrow-chat-sessions-open", vps: ["390x844"], contract: "production", run: async (p, vp) => {
      // 窄屏会话态第二层：抽屉里点「新对话」后抽屉**仍开着**（真实行为，见回传卡发现 F-26），
      // 所以必须先按遮罩收起抽屉，会话面板上的控件才真的可点 ⇒ 得到「会话态 + 抽屉已收起 + 会话列表展开」
      await open(p, "/dashboard");
      await act.menuReady(p);
      await act.showSubnav(p, vp);
      await act.newChat(p);
      await act.closeDrawer(p, vp);
      await act.openSessions(p);
    } },
  {
    scene: "27-first-click-enters-module-injected",
    vps: ALL3,
    contract: "injected",
    note: "首击即进入业务模块（注入态）：生产权限链下 /menus/user 返回空集 ⇒ 加载期只有骨架位、意图命中分支不可达，"
        + "命中语义由专项用例 D3 覆盖；此处以注入态的真实分组按钮首击证明「点得进、进得对」。",
    run: async (p) => {
      await act.slowMenus(p);
      await open(p, "/dashboard", { inject: true, waitIdle: false });
      const btn = p.locator('[data-rail-key="wb.purchase"]').first();
      await btn.waitFor({ state: "visible", timeout: 15000 });
      await btn.click({ timeout: 8000 });
      await act.unrouteMenus(p);
      await p.waitForTimeout(900);
    },
  },
  { scene: "28-rail-modules-injected", vps: WIDE, contract: "injected", run: async (p) => { await open(p, "/dashboard", { inject: true }); await act.menuReady(p); } },
  { scene: "29-module-zone-injected", vps: WIDE, contract: "injected", run: async (p) => {
      await open(p, "/dashboard", { inject: true });
      await act.menuReady(p);
      await act.clickRail(p, "wb.order");
    } },

];

/**
 * 辅助图：显式 `aux-` 前缀，不参与「每场景必须不同帧」判定（卡 §三.10「重复/辅助图分开命名」）。
 * 只用于两类无法做成独立场景的证据：整页长截图、以及「恢复后与默认态同形」的恢复位。
 */
const AUX_SCENES = [
  {
    scene: "aux-quick-functions-restored-injected",
    fullPage: false,
    contract: "injected",
    note: "凌舟驳回 §一.5「模块二次点击恢复常用功能」的回归位：恢复后的终态与 28 号场景同形（本就应如此），"
        + "因此按辅助图记录，不作为独立场景充数",
    run: async (p) => {
      await open(p, "/dashboard", { inject: true });
      await act.menuReady(p);
      await act.clickRail(p, "wb.order");
      await act.clickRail(p, "desk");
    },
  },
  { scene: "aux-purchase-orders-fullpage", fullPage: true, contract: "production", run: async (p) => { await open(p, "/purchase-orders"); await p.waitForTimeout(1500); } },
  { scene: "aux-dashboard-fullpage", fullPage: true, contract: "production", run: async (p) => { await open(p, "/dashboard"); await act.menuReady(p); } },
  {
    scene: "aux-menu-fault-recovered",
    fullPage: false,
    contract: "production",
    note: "错误态点重试后恢复：结构与 01 默认态同形，故列为辅助图（卡 §四.6 异常态可恢复）",
    run: async (p) => {
      await act.failMenus(p);
      await open(p, "/dashboard", { waitIdle: false });
      await p.waitForSelector('[data-testid="menu-fault"]', { timeout: 20000 });
      await act.unrouteMenus(p);
      await p.locator('[data-testid="menu-retry"]').first().click({ timeout: 6000 });
      await act.menuReady(p);
      await p.waitForTimeout(600);
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

function attachNetwork(page, vpId, sceneName) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("requestfailed", (req) => {
    netFailures.push({
      viewport: vpId,
      scene: sceneName,
      method: req.method(),
      url: redactText(req.url()),
      port: portOfUrl(req.url()),
      error: String(req.failure()?.errorText ?? "unknown"),
      signature: `${req.method()} ${req.url()}`,
    });
  });
  page.on("response", (res) => {
    netRecovered.push({ signature: `${res.request().method()} ${res.url()}`, status: res.status(), scene: sceneName });
  });
  page.on("pageerror", (e) => pageErrors.push(redactText(String(e)).slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(redactText(m.text()).slice(0, 300));
  });
  return { pageErrors, consoleErrors };
}

async function newAuthedPage(browser, vp, auth) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  // 先注入凭据，再让应用自己启动：旧的「goto /login 后 evaluate 写 localStorage」会在
  // 登录页发生跳转时撞上 Execution context was destroyed（路由守卫一导航就废掉这次 evaluate）。
  await ctx.addInitScript(
    ({ token, csrf, user }) => {
      localStorage.setItem("admin_auth", JSON.stringify({ token, user: { ...user, csrfToken: csrf } }));
    },
    { token: auth.token, csrf: auth.csrfToken, user: auth.user },
  );
  const page = await ctx.newPage();
  return { ctx, page };
}

async function captureScene(browser, vp, auth, item) {
  let ctx = null;
  let entry = null;
  try {
    const opened = await newAuthedPage(browser, vp, auth);
    ctx = opened.ctx;
    const { page } = opened;
    const { pageErrors, consoleErrors } = attachNetwork(page, vp.id, item.scene);
    try {
      await item.run(page, vp);
    } catch (e) {
      sceneErrors.push({ viewport: vp.id, scene: item.scene, stage: "切换", error: redactText(String(e)).slice(0, 900) });
      log(`  ⚠ ${vp.id}/${item.scene} 切换失败：${redactText(String(e)).slice(0, 180)}`);
    }
    let readout = null;
    try {
      readout = await page.evaluate(READOUT);
    } catch (e) {
      sceneErrors.push({ viewport: vp.id, scene: item.scene, stage: "读数", error: redactText(String(e)).slice(0, 300) });
    }
    if (!readout) return null;
    const file = `${vp.id}-${item.scene}.png`;
    const buf = await page.screenshot({ path: path.join(OUT, "shots", file), fullPage: false });
    entry = {
      viewport: vp.id,
      scene: item.scene,
      contract: item.contract,
      note: item.note,
      shot: `shots/${file}`,
      sha256: sha256(buf),
      bytes: buf.length,
      overflowX: readout.overflowX,
      readout: { ...readout, toast: redactText(readout.toast) },
      stateSignature: sceneStateSignature(readout),
      pageErrors: pageErrors.slice(0, 6),
      consoleErrors: consoleErrors.slice(0, 6),
    };
    log(`  ✓ ${vp.id}/${item.scene} ovfX=${entry.overflowX} bytes=${entry.bytes} hash=${entry.sha256.slice(0, 10)} rail=${entry.readout.selectedRailKey || "-"} tab=${entry.readout.settingTab || "-"}`);
    shots.push(entry);
  } catch (e) {
    // 单个场景的建页/截图异常只记在该场景名下，绝不连带中断整轮采集（否则一处抖动会毁掉全部证据）
    sceneErrors.push({ viewport: vp.id, scene: item.scene, stage: "采集", error: redactText(String(e)).slice(0, 900) });
    log(`  ✗ ${vp.id}/${item.scene} 采集失败：${redactText(String(e)).slice(0, 180)}`);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
  return entry;
}

async function captureAux(browser, vp, auth, item) {
  let ctx = null;
  try {
    const opened = await newAuthedPage(browser, vp, auth);
    ctx = opened.ctx;
    const { page } = opened;
    attachNetwork(page, vp.id, item.scene);
    try {
      await item.run(page, vp);
    } catch (e) {
      sceneErrors.push({ viewport: vp.id, scene: item.scene, stage: "辅助图", error: redactText(String(e)).slice(0, 300) });
      log(`  ⚠ 辅助图 ${item.scene} 失败：${redactText(String(e)).slice(0, 160)}`);
    }
    const file = `${vp.id}-${item.scene}.png`;
    const buf = await page.screenshot({ path: path.join(OUT, "shots", file), fullPage: item.fullPage === true });
    const readout = await page.evaluate(READOUT);
    shots.push({
      viewport: vp.id,
      scene: item.scene,
      contract: item.contract ?? "production",
      auxiliary: true,
      shot: `shots/${file}`,
      sha256: sha256(buf),
      bytes: buf.length,
      overflowX: readout.overflowX,
      readout: { ...readout, toast: redactText(readout.toast) },
      stateSignature: sceneStateSignature(readout),
      note: item.note ?? "整页辅助图（fullPage）：仅用于人工核对长页面，不参与场景去重判定",
    });
    log(`  · ${item.scene} bytes=${buf.length}（辅助图）`);
  } catch (e) {
    sceneErrors.push({ viewport: vp.id, scene: item.scene, stage: "辅助图采集", error: redactText(String(e)).slice(0, 300) });
    log(`  ✗ 辅助图 ${item.scene} 采集失败：${redactText(String(e)).slice(0, 160)}`);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
}

/* ══════════════ 执行 ══════════════ */

let browser = null;
let exitCode = 0;
let auth = null;
try {
  await startBackend();
  await startVite();
  auth = await loginViaProxy();
  browser = await chromium.launch({ executablePath: CHROME, headless: true });

  const targetVps = ONLY ? VIEWPORTS.filter((v) => v.id === ONLY) : VIEWPORTS;
  const wanted = ONLY_SCENE ? ONLY_SCENE.split(",").filter(Boolean) : [];
  const sceneFilter = (s) => wanted.length === 0 || wanted.some((w) => s.scene.includes(w));
  for (const vp of targetVps) {
    const plan = SCENES.filter((s) => s.vps.includes(vp.id)).filter(sceneFilter);
    log(`\n视口 ${vp.id}：${plan.length} 个场景`);
    for (const item of plan) await captureScene(browser, vp, auth, item);
  }
  for (const item of AUX_SCENES.filter(sceneFilter)) await captureAux(browser, VIEWPORTS[0], auth, item);
} catch (e) {
  exitCode = 1;
  console.error(`采集器异常：${redactText(String(e)).slice(0, 500)}`);
  console.error(`后端日志尾部：${redactText(backendTail.join("").slice(-1200))}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopAll().catch(() => {});
}

const bundle = {
  schema: "wb13-f1-scene-measures/v1",
  generatedAt: new Date().toISOString(),
  task: "WORKBENCH-13-WORKBENCH-UIUX-COMPLETE-01-F1",
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
  viewports: VIEWPORTS.map((v) => v.id),
  scenes: shots.map((s) => ({
    viewport: s.viewport,
    scene: s.scene,
    contract: s.contract,
    note: s.note,
    auxiliary: s.auxiliary === true,
    shot: s.shot,
    sha256: s.sha256,
    bytes: s.bytes,
    overflowX: s.overflowX,
    stateSignature: s.stateSignature,
    readout: s.readout,
  })),
  network: {
    failures: netFailures,
    // 同一 URL 后续成功 ⇒ 视为已闭合（重试成功），不计入未闭合
    recovered: netRecovered.filter((r) => netFailures.some((f) => f.signature === r.signature)),
    expectedOffline: EXPECTED_OFFLINE_ENDPOINTS,
  },
  sceneErrors,
  harness: { keepServers: KEEP_SERVERS, only: ONLY || null },
};
bundle.violations = collectViolations(bundle);

writeFileSync(path.join(OUT, "measure", "f1-scene-measures.json"), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
writeFileSync(path.join(OUT, "logs", "f1-harness.json"), `${JSON.stringify({ log: harnessLog.map(redactText), sceneErrors }, null, 2)}\n`, "utf8");
// 仓内副本：专项测试只读这个文件 ⇒ clean 检出即可复现绿色（凌舟驳回 §二.1）。
// 局部采集（--only/--scene）只能出调试证据，**绝不覆盖**仓内 fixture，否则部分帧会被当成全量达标证据。
if (ONLY || ONLY_SCENE) {
  log("\n（局部采集：跳过写入 tests/fixtures/uiux-scene-measures.json）");
} else {
  writeFileSync(path.join(WEB, "tests", "fixtures", "uiux-scene-measures.json"), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}

log(`\n截图 ${shots.length} 张 → ${path.join(OUT, "shots")}`);
log(`门禁违例 ${bundle.violations.length} 条${bundle.violations.length ? "：" : "（全部通过）"}`);
for (const v of bundle.violations) log(`  ✗ ${v}`);
process.exitCode = exitCode || (bundle.violations.length ? 1 : 0);
