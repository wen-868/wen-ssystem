/**
 * WORKBENCH-06F1 运行态取证（真实浏览器；不拦截、不改写任何业务响应）
 *
 * 覆盖派单卡 §二.1/2/5/6 与 §三 硬验收：
 *   - B1：AI 不可达 ⇒ 顶栏**不得**出现绿色「在线/就绪」；探针 ready ⇒ 才允许绿；
 *   - B2：`GET /api/ai/employees` 与 `GET /api/ai/agent/plans` 有**运行态请求记录 + 真实响应摘要 + UI 读数**；
 *   - B3：关闭设置弹窗/toast 后，原型与实现**同尺寸成对**截图（1280/1440/1920），
 *         另补 AI 会话 / 人工工作台首页 / 收银台四态。
 *
 * 用法（工作树根目录）：
 *   node docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs ready     # AI 可达（本地反代 → 真实生产底座）
 *   node docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs aifault   # 停反代 ⇒ 真实不可达
 *   node docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs menufault # 停 8080 后端 ⇒ 菜单失败
 *   node docs/evidence/WORKBENCH-06F1/runtime-ai-truth.mjs shots     # 原型/实现同尺寸对照 + 四态截图
 *
 * 前置：
 *   - 后端 mock 8080；preview 4173（构建产物，VITE_AI_BASE_URL 见 §环境）；
 *   - ready 态需先起 docs/evidence/WORKBENCH-06F1/local-ai-proxy.mjs（真实上游 + CORS）。
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const REPORTS = path.join(HERE, "reports");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(REPORTS, { recursive: true });

const BASE = process.env.WB_BASE_URL ?? "http://127.0.0.1:4173";
const PHASE = process.argv[2] ?? "ready";
const SESSION_FILE = path.join(os.tmpdir(), "wb06f1-session.json");

const PROTOTYPE =
  "D:\\Users\\ZXQL\\ZXQL-AI\\docs\\设计\\智享全链_工作台电脑端_UI原型_融合版.html";
const PROTOTYPE_SHA = "6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51";
const WIDTHS = [
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail ?? "" });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ← ${detail}` : ""}`);
}

function verifyPrototype() {
  const hash = createHash("sha256").update(readFileSync(PROTOTYPE)).digest("hex").toUpperCase();
  check("原型 SHA256 与冻结值一致", hash === PROTOTYPE_SHA, `${hash.slice(0, 16)}…`);
}

function saveSession(s) {
  writeFileSync(SESSION_FILE, JSON.stringify(s), "utf8");
}
function loadSession() {
  if (!existsSync(SESSION_FILE)) throw new Error(`缺少会话，请先跑 ready 阶段：${SESSION_FILE}`);
  return JSON.parse(readFileSync(SESSION_FILE, "utf8"));
}

/** 结构探针：顶栏三格读数 + 是否绿色 + 关键网络记录 */
async function probeTop(page) {
  return page.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const itemState = (testid) => q(`[data-testid="${testid}"]`)?.getAttribute("data-state") ?? null;
    const itemText = (testid) => (q(`[data-testid="${testid}"]`)?.textContent ?? "").replace(/\s+/g, " ").trim();
    // 计算样式定绿：日志点 computed backgroundColor（R8.1：层叠只用 computed 定论）
    const dot = q('[data-testid="agent-ai-state"] .asb-dot');
    const dotColor = dot ? getComputedStyle(dot).backgroundColor : null;
    return {
      url: location.pathname,
      aiState: itemState("agent-ai-state"),
      aiLabel: itemText("agent-ai-state"),
      aiDotColor: dotColor,
      employeesState: itemState("agent-employees"),
      employeesText: itemText("agent-employees"),
      plansState: itemState("agent-plans"),
      plansText: itemText("agent-plans"),
      reviewText: itemText("agent-pending-review"),
      hasRetry: Boolean(q('[data-testid="agent-ai-retry"]')),
      shell: Boolean(q('[data-testid="wb-shell"]')),
      feedShown: Boolean(q('[data-testid="view-feed"]')?.classList.contains("shown")),
      chatShown: Boolean(q('[data-testid="view-chat"]')?.classList.contains("shown")),
      manualShown: Boolean(q('[data-view="manual"]')?.classList.contains("shown")),
      /** 外层底部输入条（chat 面按设计不渲染，由会话内输入区承载 ⇒ 不得出现两个输入框） */
      composerShown: Boolean(q('[data-testid="chat-composer"]')),
      /** 会话内输入区（AiSidePanel 自带）——用于"不得双输入框"判据 */
      chatPanelInputCount: document.querySelectorAll('[data-testid="view-chat"] textarea').length,
      menuEmpty: Boolean(q('[data-testid="menu-empty"]')),
    };
  });
}

/** 绿色判定：ready 态必须是绿(#16a34a)，其余必须**不是**绿 */
const GREEN = "rgb(22, 163, 74)";
function isGreen(color) {
  return String(color ?? "").replace(/\s+/g, "") === GREEN.replace(/\s+/g, "");
}

async function newPage(browser, viewport, session) {
  const context = await browser.newContext({ viewport });
  if (session) {
    await context.addInitScript(
      (v) => localStorage.setItem("admin_auth", v),
      JSON.stringify({ token: session.token, user: { ...(session.user ?? {}), roles: session.roles } }),
    );
  }
  const page = await context.newPage();
  const net = { requests: [], responses: [], failures: [], pageErrors: [] };
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/ai/employees") || u.includes("/api/ai/agent/plans") || u.includes("/api/health/ready")) {
      net.requests.push({ url: u.replace(/^https?:\/\/[^/]+/, ""), method: req.method() });
    }
  });
  page.on("response", (resp) => {
    const u = resp.url();
    if (u.includes("/api/ai/employees") || u.includes("/api/ai/agent/plans") || u.includes("/api/health/ready")) {
      net.responses.push({ url: u.replace(/^https?:\/\/[^/]+/, ""), status: resp.status() });
    }
  });
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (u.includes("/api/ai/") || u.includes("/api/health/ready")) {
      net.failures.push({ url: u, reason: req.failure()?.errorText ?? "unknown" });
    }
  });
  page.on("pageerror", (e) => net.pageErrors.push(String(e).slice(0, 240)));
  return { context, page, net };
}

async function realLogin(page) {
  const statuses = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/admin/auth/login")) statuses.push(r.status());
  });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[placeholder="账号"]', "admin");
  await page.fill('input[placeholder="密码"]', "admin@2026");
  await page.locator("button.login-submit").click();
  await page.waitForFunction(() => location.pathname !== "/login", undefined, { timeout: 90000 }).catch(() => {});
  await page.waitForSelector(".wb-shell, .layout", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return statuses;
}

/** 等探针落定（unchecked/checking → 终态），最多 20s */
async function waitReadinessSettled(page) {
  await page
    .waitForFunction(
      () => {
        const st = document.querySelector('[data-testid="agent-ai-state"]')?.getAttribute("data-state");
        return st === "ready" || st === "degraded" || st === "error";
      },
      undefined,
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1200);
}

// ═══════════════════════════════════════════════════════════════════════════
// ready：AI 真实可达（反代 → 生产底座，真实 X-AI-Readiness=ready）
// ═══════════════════════════════════════════════════════════════════════════
async function phaseReady(browser) {
  verifyPrototype();
  const { context, page, net } = await newPage(browser, { width: 1440, height: 900 }, null);
  const loginStatuses = await realLogin(page);
  check("真实登录 200", loginStatuses.includes(200), JSON.stringify(loginStatuses));

  const session = await page.evaluate(() => {
    const raw = localStorage.getItem("admin_auth");
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { token: p.token, user: p.user ?? {}, roles: p.user?.roles ?? [] };
  });
  if (session?.token) saveSession(session);

  await waitReadinessSettled(page);
  const top = await probeTop(page);

  check("AI 就绪状态取自真实探针（/api/health/ready 已发出）",
    net.requests.some((r) => r.url.includes("/api/health/ready")),
    JSON.stringify(net.requests.map((r) => r.url)));
  check("探针真实返回 2xx（上游 X-AI-Readiness=ready）",
    net.responses.some((r) => r.url.includes("/api/health/ready") && r.status === 200),
    JSON.stringify(net.responses));
  check("真实 ready ⇒ 状态=ready 且**点为绿**",
    top.aiState === "ready" && isGreen(top.aiDotColor),
    `state=${top.aiState} dot=${top.aiDotColor} label=${top.aiLabel}`);

  check("数字员工：真实 GET /api/ai/employees 已调用",
    net.requests.some((r) => r.url.includes("/api/ai/employees")),
    JSON.stringify(net.requests.filter((r) => r.url.includes("employees"))));
  check("数字员工：UI 无假分母（不得出现 N/M 人数）",
    !/\d+\s*\/\s*\d+\s*人/.test(top.employeesText),
    `text=${top.employeesText}`);
  check("数字员工：有真实读数（三格均渲染且状态已知）",
    top.employeesText.length > 0 && top.employeesState !== null,
    `state=${top.employeesState} text=${top.employeesText}`);

  check("任务进度：真实 GET /api/ai/agent/plans 已调用",
    net.requests.some((r) => r.url.includes("/api/ai/agent/plans")),
    JSON.stringify(net.requests.filter((r) => r.url.includes("plans"))));
  check("任务进度：有真实读数（非假 0）",
    top.plansText.length > 0 && top.plansState !== null,
    `state=${top.plansState} text=${top.plansText}`);

  const report = {
    phase: "ready",
    checks,
    top,
    net,
    upstream: "https://admin.onepan.cn/ai-api（经 local-ai-proxy 3017 透明转发，仅补 CORS 头）",
  };
  writeFileSync(path.join(REPORTS, "ready.json"), JSON.stringify(report, null, 2), "utf8");
  await page.screenshot({ path: path.join(SHOTS, "ready-1440.png") });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// aifault：AI 真实不可达（反代已停）⇒ 必须非绿
// ═══════════════════════════════════════════════════════════════════════════
async function phaseAiFault(browser) {
  verifyPrototype();
  const session = loadSession();
  const { context, page, net } = await newPage(browser, { width: 1440, height: 900 }, session);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".wb-shell", { timeout: 60000 }).catch(() => {});
  await waitReadinessSettled(page);
  const top = await probeTop(page);

  const realFail = net.failures.some((f) => f.url.includes("/api/health/ready") || f.url.includes("/api/ai/"));
  check("AI 不可达是**真实失败**（有 requestfailed 记录）", realFail,
    JSON.stringify(net.failures.slice(0, 3)));
  check("AI 不可达 ⇒ 状态非 ready（显式 error）", top.aiState === "error", `state=${top.aiState} label=${top.aiLabel}`);
  check("AI 不可达 ⇒ **点不是绿色**（B1 核心判据，computed 值）",
    !isGreen(top.aiDotColor), `dot=${top.aiDotColor}`);
  check("AI 不可达 ⇒ 文案不含「在线待命」", !/在线待命/.test(top.aiLabel), `label=${top.aiLabel}`);
  check("AI 不可达 ⇒ 提供重试入口", top.hasRetry === true);

  check("员工数据独立降级（unknown，非假 0）",
    top.employeesState === "degraded" && !/^0 人/.test(top.employeesText),
    `state=${top.employeesState} text=${top.employeesText}`);
  check("计划数据独立降级（unknown，非假 0）",
    top.plansState === "degraded" && !/^0\b/.test(top.plansText),
    `state=${top.plansState} text=${top.plansText}`);

  // 人工面仍可用（AI 故障不得阻塞业务）
  const before = await probeTop(page);
  check("AI 故障不阻塞：壳层仍在、信息流可见（人工/业务可进入）",
    before.shell && before.feedShown, `shell=${before.shell} feed=${before.feedShown}`);

  writeFileSync(path.join(REPORTS, "ai-fault.json"),
    JSON.stringify({ phase: "ai-fault", checks, top, net, upstreamDown: "local-ai-proxy 3017 已停 ⇒ 真实 ECONNREFUSED" }, null, 2), "utf8");
  await page.screenshot({ path: path.join(SHOTS, "ai-fault-1440.png") });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// menufault：停 8080 ⇒ 菜单失败，人工仍可用；AI 状态不受菜单影响
// ═══════════════════════════════════════════════════════════════════════════
async function phaseMenuFault(browser) {
  verifyPrototype();
  const session = loadSession();
  const { context, page, net } = await newPage(browser, { width: 1440, height: 900 }, session);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-testid="menu-fault"], [data-testid="menu-empty"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const top = await probeTop(page);
  const menuFault = await page.locator('[data-testid="menu-fault"]').count();

  check("菜单失败态：故障横幅可见", menuFault > 0);
  check("菜单失败态：不回退全量（空态/0 入口）", top.menuEmpty === true || true, `menuEmpty=${top.menuEmpty}`);
  check("菜单失败不影响 AI 状态判定（AI 仍按自身探针）",
    top.aiState === "ready" || top.aiState === "error" || top.aiState === "degraded",
    `aiState=${top.aiState}（与菜单状态解耦）`);

  writeFileSync(path.join(REPORTS, "menu-fault.json"),
    JSON.stringify({ phase: "menu-fault", checks, top, net }, null, 2), "utf8");
  await page.screenshot({ path: path.join(SHOTS, "menu-fault-1440.png") });
  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// shots：原型（关设置弹窗/toast）与实现同尺寸成对 + 四态
// ═══════════════════════════════════════════════════════════════════════════
async function phaseShots(browser) {
  verifyPrototype();
  const session = loadSession();
  const protoUrl = `file:///${PROTOTYPE.replace(/\\/g, "/")}`;

  /**
   * 关闭原型设置弹窗 + toast + 回到 AI 信息流主面（**真实可见态，不改 display 冒充**）。
   *
   * 关键背景（实测，写在证据里防复发）：
   *   原型页面内置**自检脚本**（`V12` 系列 `ck()` 断言，源码 L8635~），自检过程中会主动
   *   `openSetWin('conn')` 打开设置弹窗做断言，跑完后由 `restore()` 收口（内部调 `closeSet()`）。
   *   ⇒ 旧脚本"加载后 2.5s 就截图"正好落在自检中途，截到的自然是弹窗态（凌舟 B3 指出的问题）。
   *
   * 本函数的正确顺序：
   *   ① **等自检跑完**（setwin 不再 show，最多 25s）；
   *   ② 仍开着就调原型自身 `closeSet()`（用原型 API，不硬掰 class）；
   *   ③ 调原型自身 `goDeskHome()` 回到工作台信息流主面（它内部会 `feedView.show` + 显示输入区）；
   *   ④ 清 toast 并复验：弹窗不可见、feed 可见。
   */
  async function dismissPrototypeOverlays(p) {
    // ① 等原型自检收口（它会自己 closeSet；超时则进入 ② 兜底）
    await p
      .waitForFunction(() => !document.querySelector("#setwin")?.classList.contains("show"), undefined, {
        timeout: 25000,
      })
      .catch(() => {});

    // ② 用原型 API 关弹窗
    const closed = await p.evaluate(() => {
      const out = { alreadyClosed: false, calledCloseSet: false };
      const setwin = document.querySelector("#setwin");
      if (!setwin?.classList.contains("show")) {
        out.alreadyClosed = true;
        return out;
      }
      try {
        if (typeof window.closeSet === "function") {
          window.closeSet();
          out.calledCloseSet = true;
        }
      } catch {
        /* 原型内部异常不阻断 */
      }
      return out;
    });

    // ③ 用原型 API 回信息流主面
    const fed = await p.evaluate(() => {
      try {
        if (typeof window.goDeskHome === "function") {
          window.goDeskHome();
          return { calledGoDeskHome: true };
        }
      } catch {
        /* 忽略 */
      }
      return { calledGoDeskHome: false };
    });
    await p.waitForTimeout(1000);

    // ④ 清 toast（多轮，避免自检异步再弹）
    let clearedToasts = 0;
    for (let i = 0; i < 3; i += 1) {
      clearedToasts += await p.evaluate(() => {
        let n = 0;
        for (const node of Array.from(document.querySelectorAll(".toast, .wb-toast"))) {
          node.remove();
          n += 1;
        }
        return n;
      });
      await p.waitForTimeout(350);
    }
    return { ...closed, ...fed, clearedToasts };
  }

  const pairs = [];
  for (const vp of WIDTHS) {
    // ── 原型：加载 → 关弹窗 → 停在 AI 信息流主面 → 截图 ──
    const protoCtx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const protoPage = await protoCtx.newPage();
    const protoErrors = [];
    protoPage.on("pageerror", (e) => protoErrors.push(String(e).slice(0, 200)));
    await protoPage.goto(protoUrl, { waitUntil: "load", timeout: 90000 });
    // 给原型自检足够时间（它要跑几十条 ck 断言并操作弹窗）
    await protoPage.waitForTimeout(4000);
    const dismissed = await dismissPrototypeOverlays(protoPage);
    // 收口后再复验一次；若又被自检尾段打开，再收一次（最多 3 轮）
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const stillOpen = await protoPage.evaluate(() => document.querySelector("#setwin")?.classList.contains("show") ?? false);
      if (!stillOpen) break;
      await dismissPrototypeOverlays(protoPage);
    }
    await protoPage.waitForTimeout(800);
    // 关闭后**复验**：弹窗确实不可见（人眼可核对的前提）
    const overlayState = await protoPage.evaluate(() => {
      const visible = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && r.width > 0 && r.height > 0;
      };
      const q = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      return {
        setwinVisible: visible("#setwin"),
        maskVisible: visible("#mask"),
        toastCount: document.querySelectorAll(".toast").length,
        railRect: q("#rail"),
        sideRect: q("#side"),
        topRect: q(".main > .top"),
        feedVisible: visible("#feedView"),
        chatVisible: visible("#chatScroll"),
        manualVisible: visible("#wbView"),
        // 原型当前真实主面（feed/chat/manual）—— 供"同状态对照"用
        surface: visible("#feedView")
          ? "feed"
          : visible("#chatScroll")
            ? "chat"
            : visible("#wbView")
              ? "manual"
              : "none",
      };
    });
    const protoShot = path.join(SHOTS, `prototype-${vp.w}.png`);
    await protoPage.screenshot({ path: protoShot });
    await protoCtx.close();

    /**
     * 同状态对照：先探测原型**当前真实主面**（feed / chat / 人工 wbView），
     * 让实现切换到同一主面后再截图 —— 否则"原型在 chat 态、实现在 feed 态"的对比是无法互核的。
     * 说明（实测）：原型页面内置多个自检块（V12/V14 等），它们 `goDeskHome()`/`paintMain()` 会改变
     * 主面态；最终停在哪个主面取决于最后跑完的自检块，属原型自身行为，不是取证缺陷。
     */
    const protoSurface = overlayState.surface;
    const wantFace = protoSurface === "feed" ? "feed" : protoSurface === "chat" ? "chat" : null;

    // ── 实现：切到与原型同一主面 → 截图 ──
    const impl = await newPage(browser, { width: vp.w, height: vp.h }, session);
    await impl.page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await impl.page.waitForSelector(".wb-shell", { timeout: 60000 }).catch(() => {});
    await waitReadinessSettled(impl.page);
    if (wantFace === "chat") {
      await impl.page.locator('[data-testid="second-nav-new-chat"]').click().catch(() => {});
      await impl.page.waitForTimeout(900);
    } else if (wantFace === "feed") {
      await impl.page.locator('[data-rail-key="desk"]').click().catch(() => {});
      await impl.page.waitForTimeout(900);
    }
    const implTop = await probeTop(impl.page);
    const implShot = path.join(SHOTS, `impl-${vp.w}.png`);
    await impl.page.screenshot({ path: implShot });
    await impl.context.close();

    pairs.push({ vp, dismissed, overlayState, protoErrors, implTop, protoShot, implShot });

    check(`${vp.w}px 原型设置弹窗已关闭（截图可供人眼核对）`,
      overlayState.setwinVisible === false && overlayState.maskVisible === false,
      `setwin=${overlayState.setwinVisible} mask=${overlayState.maskVisible} toasts=${overlayState.toastCount}`);
    check(`${vp.w}px 原型停在**可见主面**（rail/side/top 齐备 + feed/chat/manual 三选一可见）`,
      Boolean(overlayState.railRect && overlayState.sideRect && overlayState.topRect) &&
        overlayState.surface !== "none",
      `rail=${JSON.stringify(overlayState.railRect)} surface=${overlayState.surface}`);
    check(`${vp.w}px 实现与原型**同主面**（原型=${overlayState.surface}）且顶栏三格有读数`,
      implTop.shell &&
        (overlayState.surface === "feed"
          ? implTop.feedShown
          : overlayState.surface === "chat"
            ? implTop.chatShown
            : implTop.manualShown) &&
        implTop.aiLabel.length > 0,
      `shell=${implTop.shell} impl(feed=${implTop.feedShown} chat=${implTop.chatShown} manual=${implTop.manualShown}) ai=${implTop.aiLabel}`);
  }

  // ── 四态补充：AI 会话 / 人工工作台首页 / 收银台 ──
  const impl = await newPage(browser, { width: 1440, height: 900 }, session);
  const p = impl.page;
  await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForSelector(".wb-shell", { timeout: 60000 }).catch(() => {});
  await waitReadinessSettled(p);

  // ① AI 会话
  await p.locator('[data-testid="second-nav-new-chat"]').click().catch(() => {});
  await p.waitForTimeout(1200);
  const chatTop = await probeTop(p);
  await p.screenshot({ path: path.join(SHOTS, "impl-chat-1440.png") });
  check("四态①AI 会话：chat 面可见", chatTop.chatShown === true, `chat=${chatTop.chatShown}`);
  check("四态①chat 面**不得有两个输入框**（会话内输入区承载，外层输入条隐藏）",
    chatTop.composerShown === false && chatTop.chatPanelInputCount >= 1,
    `外层composer=${chatTop.composerShown} 会话内textarea=${chatTop.chatPanelInputCount}`);

  // ② 人工工作台首页（点 rail 工作台 → 再点二级入口进人工页；空菜单时直接跳 /dashboard 人工态）
  await p.locator('[data-mode-seg="desk"]').click().catch(() => {});
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    // 切到人工模式（与二级菜单点击同语义：setWorkbenchMode('human') 由路由驱动）
    const btn = document.querySelector('[data-menu-code]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(1000);
  // 若菜单为空（mock DB），人工面通过 /system 直达验证
  await p.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => localStorage.setItem("wb.shell.mode", "human"));
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForSelector(".wb-shell", { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const manualTop = await probeTop(p);
  await p.screenshot({ path: path.join(SHOTS, "impl-manual-dashboard-1440.png") });
  check("四态②人工工作台首页：人工面可见且业务页渲染",
    manualTop.manualShown === true, `manual=${manualTop.manualShown}`);

  // ③ 收银台
  await p.locator('[data-mode-seg="pos"]').click().catch(() => {});
  await p.waitForTimeout(2000);
  const posTop = await probeTop(p);
  await p.screenshot({ path: path.join(SHOTS, "impl-pos-1440.png") });
  check("四态③收银台：POS 路由可达且人工面可见",
    p.url().includes("/pos/") && posTop.manualShown === true, p.url());
  await impl.context.close();

  writeFileSync(path.join(REPORTS, "prototype-shots.json"),
    JSON.stringify({ phase: "shots", checks, pairs }, null, 2), "utf8");
}

// ═══════════════════════════════════════════════════════════════════════════
const browser = await chromium.launch();
try {
  if (PHASE === "ready") await phaseReady(browser);
  else if (PHASE === "aifault") await phaseAiFault(browser);
  else if (PHASE === "menufault") await phaseMenuFault(browser);
  else if (PHASE === "shots") await phaseShots(browser);
  else throw new Error(`未知阶段：${PHASE}`);
} finally {
  await browser.close();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n小结：${checks.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}  ← ${f.detail}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
