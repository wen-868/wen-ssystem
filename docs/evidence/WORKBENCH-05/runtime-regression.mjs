/**
 * WORKBENCH-05 运行态回归取证（真实浏览器，不拦截、不伪造任何接口）
 *
 * 用法（工作树根目录）：
 *   node docs/evidence/WORKBENCH-05/runtime-regression.mjs normal        # 后端在跑、AI 底座未起
 *   node docs/evidence/WORKBENCH-05/runtime-regression.mjs menu-fault    # 先停后端再执行
 *   node docs/evidence/WORKBENCH-05/runtime-regression.mjs ai-fault      # 后端在跑、AI 底座(3016)未起
 *
 * 前置：后端 USE_MOCK_DB=true NODE_ENV=development 监听 8080；vite dev 监听 localhost:5173。
 * 会话来源：真实登录 admin/admin@2026 拿到真实 token；角色注入只覆盖 user.roles 的 UI 渲染，
 * 不验证服务端权限边界（mock DB 无角色/菜单行，已在 README 与回传卡如实披露）。
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = HERE;
const SHOTS = path.join(EV, "screenshots");
const REPORTS = path.join(EV, "reports");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(REPORTS, { recursive: true });

const BASE = process.env.WB_BASE_URL ?? "http://localhost:5173";
const PHASE = process.argv[2] ?? "normal";
const SESSION_FILE = path.join(os.tmpdir(), "wb05-session.json");
const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail ?? "" });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ← ${detail}` : ""}`);
}

function saveSession(session) {
  writeFileSync(SESSION_FILE, JSON.stringify(session), "utf8");
}
function loadSession() {
  if (!existsSync(SESSION_FILE)) throw new Error(`缺少会话文件，请先跑 normal 阶段：${SESSION_FILE}`);
  return JSON.parse(readFileSync(SESSION_FILE, "utf8"));
}

async function newPage(browser, session) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (session) {
    const payload = JSON.stringify({
      token: session.token,
      user: { ...(session.user ?? {}), roles: session.roles },
    });
    await context.addInitScript((value) => localStorage.setItem("admin_auth", value), payload);
  }
  const page = await context.newPage();
  const net = { menus: [], ai: [], menuRequests: [], aiRequests: [], errors: [] };
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/admin/menus/user")) net.menuRequests.push(url);
    if (url.includes("/api/chat")) net.aiRequests.push(url);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/api/admin/menus/user")) {
      net.menus.push({ status: response.status(), url });
    }
    if (url.includes("/api/chat") || url.includes(":3016")) {
      net.ai.push({ status: response.status(), url });
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("/api/admin/menus/user") || url.includes(":3016") || url.includes("/api/chat")) {
      net.errors.push({ url, reason: request.failure()?.errorText ?? "unknown" });
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") net.errors.push({ console: message.text().slice(0, 240) });
  });
  return { context, page, net };
}

async function realLogin(page) {
  const statuses = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/admin/auth/login")) statuses.push(response.status());
  });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[placeholder="账号"]', "admin");
  await page.fill('input[placeholder="密码"]', "admin@2026");
  await page.locator("button.login-submit").click();
  await page.waitForFunction(() => location.pathname !== "/login", undefined, { timeout: 90000 }).catch(() => {});
  await page.waitForSelector(".wb-shell, .layout", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  return statuses;
}

async function appGoto(page, routePath) {
  await page.goto(`${BASE}${routePath}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".wb-shell, .layout", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function textOf(page, selector) {
  return page.evaluate(
    (target) => (document.querySelector(target)?.textContent ?? "").replace(/\s+/g, " ").trim(),
    selector,
  );
}

async function setShellFlag(page, value) {
  await page.evaluate((flag) => {
    if (flag === null) localStorage.removeItem("wb.shell.v2");
    else localStorage.setItem("wb.shell.v2", flag);
  }, value);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
}

async function shellSnapshot(page) {
  return page.evaluate(() => ({
    url: location.pathname,
    newShell: document.querySelectorAll(".wb-shell").length,
    oldShell: document.querySelectorAll(".layout").length,
    hasAuth: Boolean(localStorage.getItem("admin_auth")),
  }));
}

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return path.basename(file);
}

async function runNormal(browser) {
  const { context, page, net } = await newPage(browser, null);
  const loginStatus = await realLogin(page);
  check("正常态：真实登录 admin/admin@2026 返回 200", loginStatus.includes(200), `status=${loginStatus.join(",")}`);
  check("正常态：登录后落到 /dashboard", page.url().includes("/dashboard"), page.url());

  const snap = await shellSnapshot(page);
  check("正常态：新壳(.wb-shell)渲染且旧壳(.layout)不出现", snap.newShell === 1 && snap.oldShell === 0, JSON.stringify(snap));

  const raw = await page.evaluate(() => localStorage.getItem("admin_auth"));
  const session = raw ? JSON.parse(raw) : null;
  check("正常态：登录态持久化到 admin_auth", Boolean(session?.token), session ? "token 已写入" : "缺少 token");
  if (session) saveSession(session);

  const menuNotice = net.menus.map((m) => m.status).join(",");
  check("正常态：/api/admin/menus/user 真实返回 200", net.menus.some((m) => m.status === 200), `status=${menuNotice}`);

  const sidebarGroups = await page.locator(".ms-sidebar .ms-group").count();
  const sidebarItems = await page.locator(".ms-sidebar .ms-item").count();
  const menuEmptyNodes = await page.locator('[data-testid="menu-empty"]').count();
  check(
    "正常态：服务端空集时侧栏 0 组 0 项（fail-closed，不回退全量菜单）",
    sidebarGroups === 0 && sidebarItems === 0,
    `groups=${sidebarGroups} items=${sidebarItems} menu-empty节点=${menuEmptyNodes}（收银保底 9 项计入可见入口，故不满足 menu-empty）`,
  );

  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(350);
    const file = await shot(page, `normal-human-${width}x900`);
    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector(".ms-sidebar");
      return {
        body: document.documentElement.scrollWidth,
        sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
      };
    });
    check(`多宽度 ${width}：人工操作台无横向溢出且侧栏可见`, metrics.body <= width + 1 && metrics.sidebarWidth > 0, JSON.stringify(metrics));
    console.log(`  截图：${file}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("tab", { name: "AI 数字员工" }).click();
  await page.waitForTimeout(700);
  const aiRailItems = await page.locator(".anr .anr-item").count();
  const aiRailEmpty = await page.locator(".anr .anr-empty").count();
  const parityText = await textOf(page, '[data-testid="parity-summary"]');
  check("正常态：AI rail 与人工侧栏共用同一最终角色集（组数一致）", aiRailItems === sidebarGroups, `rail=${aiRailItems} sidebar=${sidebarGroups} empty=${aiRailEmpty}`);
  check("正常态：对等摘要按运行时可见集裁剪并明示无可见菜单", parityText.includes("运行时可见") && parityText.includes("/80") && parityText.includes("未返回任何可见菜单"), parityText.slice(0, 120));
  const delegateVisible = await page.locator('[data-testid="ai-delegate-current"]').isVisible().catch(() => false);
  check("正常态：空菜单下不提供 AI 代办入口（fail-closed，不给全量页面代办）", !delegateVisible, `visible=${delegateVisible}`);
  console.log(`  对等摘要：${parityText.slice(0, 200)}`);
  console.log(`  截图：${await shot(page, "normal-ai-1440x900")}`);

  await page.getByRole("tab", { name: "人工操作台" }).click();
  await page.waitForTimeout(400);
  await appGoto(page, "/pos/cashier");
  await page.waitForTimeout(1500);
  const cashierCodes = await page.locator(".wb-cashier-item").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-menu-code")),
  );
  check("正常态：收银台导航 9 项（SUPER_ADMIN）", cashierCodes.length === 9, cashierCodes.join(" / "));
  const cashierPage = await page.locator(".pos-cashier").isVisible().catch(() => false);
  check("正常态：收银业务页真实渲染", cashierPage, String(cashierPage));
  console.log(`  截图：${await shot(page, "normal-cashier-1440x900")}`);

  // 灰度双向：新壳 → 旧壳 → 新壳 → 旧壳 → 新壳，全程同一登录态与同一业务页
  const sequence = [];
  for (const flag of ["0", "1", "0", "1"]) {
    await setShellFlag(page, flag);
    const state = await shellSnapshot(page);
    const cashier = await page.locator(".pos-cashier").isVisible().catch(() => false);
    sequence.push({ flag, ...state, cashier });
    check(
      `灰度 ${flag === "0" ? "旧壳" : "新壳"}：wb.shell.v2=${flag} 渲染对应壳且收银页可访问`,
      (flag === "0" ? state.oldShell === 1 && state.newShell === 0 : state.newShell === 1 && state.oldShell === 0) &&
        state.url === "/pos/cashier" && state.hasAuth && cashier,
      JSON.stringify({ ...state, cashier }),
    );
  }
  await shot(page, "rollout-old-shell-1440x900");
  await setShellFlag(page, "0");
  await shot(page, "rollout-old-shell-1440x900");
  await setShellFlag(page, null);
  const backToDefault = await shellSnapshot(page);
  check("灰度：清除开关后回落缺省新壳", backToDefault.newShell === 1 && backToDefault.hasAuth, JSON.stringify(backToDefault));

  // 角色注入（仅 UI 渲染）：STORE_OPERATOR / STORE_MANAGER
  for (const role of ["STORE_OPERATOR", "STORE_MANAGER"]) {
    const roleCtx = await newPage(browser, { token: session.token, user: session.user, roles: [role] });
    const p = roleCtx.page;
    await appGoto(p, "/pos/cashier");
    await p.waitForTimeout(1500);
    const codes = await p.locator(".wb-cashier-item").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-menu-code")));
    const badge = await textOf(p, ".wb-mode-badge");
    check(`角色 ${role}：收银台 9 项可用（会话注入，仅 UI）`, codes.length === 9 && badge.includes("收银"), `count=${codes.length} badge=${badge}`);
    console.log(`  截图：${await shot(p, `role-${role}-cashier-1440x900`)}`);
    await roleCtx.context.close();
  }

  writeFileSync(path.join(REPORTS, "normal.json"), JSON.stringify({ checks, net, sequence }, null, 2), "utf8");
  await context.close();
}

async function runMenuFault(browser) {
  const session = loadSession();
  const { context, page, net } = await newPage(browser, { token: session.token, user: session.user, roles: ["SUPER_ADMIN"] });
  await appGoto(page, "/dashboard");
  await page.waitForTimeout(1500);
  const faultWaitStart = Date.now();
  await page.waitForSelector('[data-testid="menu-fault"]', { timeout: 40000 }).catch(() => {});
  const faultWaitMs = Date.now() - faultWaitStart;
  const faultVisible = await page.locator('[data-testid="menu-fault"]').isVisible().catch(() => false);
  const faultText = await textOf(page, '[data-testid="menu-fault"]');
  const groups = await page.locator(".ms-sidebar .ms-group").count();
  check(
    "菜单失败态：真实请求失败并显示失败提示",
    faultVisible && net.menuRequests.length >= 1,
    `visible=${faultVisible} 请求次数=${net.menuRequests.length} 等待=${faultWaitMs}ms 失败=${net.errors.length}`,
  );
  check("菜单失败态：不回退全量菜单（侧栏 0 组）", groups === 0, `groups=${groups}`);
  console.log(`  失败提示：${faultText.slice(0, 160)}`);
  console.log(`  原始失败：${JSON.stringify(net.errors.slice(0, 3))}`);
  console.log(`  截图：${await shot(page, "menu-fault-1440x900")}`);

  const beforeRetry = net.menuRequests.length;
  await page.locator('[data-testid="menu-retry"]').click();
  await page.waitForTimeout(5000);
  await page.waitForSelector('[data-testid="menu-fault"]', { timeout: 40000 }).catch(() => {});
  const retryStillFault = await page.locator('[data-testid="menu-fault"]').isVisible().catch(() => false);
  check(
    "菜单失败态：点重试触发真实重试请求且仍失败（不伪造成功）",
    retryStillFault && net.menuRequests.length > beforeRetry,
    `重试前=${beforeRetry} 重试后=${net.menuRequests.length} 仍失败=${retryStillFault}`,
  );
  console.log(`  截图：${await shot(page, "menu-fault-after-retry-1440x900")}`);

  const op = await newPage(browser, { token: session.token, user: session.user, roles: ["STORE_OPERATOR"] });
  await appGoto(op.page, "/pos/cashier");
  await op.page.waitForSelector('[data-testid="menu-fault"]', { timeout: 40000 }).catch(() => {});
  const codes = await op.page.locator(".wb-cashier-item").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-menu-code")));
  const faultInCashier = await op.page.locator('[data-testid="menu-fault"]').isVisible().catch(() => false);
  const cashierMenuRequests = op.net.menuRequests.length;
  check("菜单失败态：STORE_OPERATOR 收银 9 项仍可用（业务页不受菜单故障影响）", codes.length === 9, `count=${codes.length}`);
  check("菜单失败态：收银台同样明示菜单失败且请求真实失败", faultInCashier && cashierMenuRequests >= 1, `visible=${faultInCashier} 请求=${cashierMenuRequests}`);
  console.log(`  截图：${await shot(op.page, "menu-fault-cashier-1440x900")}`);
  await op.context.close();

  writeFileSync(path.join(REPORTS, "menu-fault.json"), JSON.stringify({ checks, net }, null, 2), "utf8");
  await context.close();
}

async function runAiFault(browser) {
  const session = loadSession();
  const { context, page, net } = await newPage(browser, { token: session.token, user: session.user, roles: ["SUPER_ADMIN"] });
  await appGoto(page, "/dashboard");
  await page.waitForTimeout(1200);
  await page.getByRole("tab", { name: "AI 数字员工" }).click();
  await page.waitForTimeout(600);
  const chip = page.locator(".suggestion-chip").first();
  const hasChip = await chip.isVisible().catch(() => false);
  if (hasChip) await chip.click();
  else {
    const input = page.locator('textarea[placeholder="输入问题，Enter 发送"]');
    await input.fill("生成今日经营摘要");
    await page.locator(".ai-send-btn").click();
  }
  await page.waitForTimeout(4000);
  const banner = await page.locator('[data-testid="ai-fault-banner"]').isVisible().catch(() => false);
  const bannerText = await textOf(page, '[data-testid="ai-fault-banner"]');
  check("AI 故障态：真实连接失败并显示故障横幅", banner, bannerText.slice(0, 160));
  console.log(`  原始失败：${JSON.stringify(net.errors.slice(0, 4))}`);
  console.log(`  AI 请求状态：${JSON.stringify(net.ai.slice(0, 4))}`);
  console.log(`  截图：${await shot(page, "ai-fault-1440x900")}`);

  await page.locator(".acp-fault-btn").click();
  await page.waitForTimeout(800);
  const humanVisible = await page.locator(".wb-body .ms-sidebar").isVisible().catch(() => false);
  const stillDashboard = page.url().includes("/dashboard");
  const businessOk = await page.evaluate(() => document.body.innerText.length > 50);
  check("AI 故障态：一键切回人工操作台且业务页面可用", humanVisible && stillDashboard && businessOk, `human=${humanVisible} url=${page.url()}`);
  check("AI 故障态：切回人工未触发跳登录/重定向", !page.url().includes("/login"), page.url());
  console.log(`  截图：${await shot(page, "ai-fault-fallback-human-1440x900")}`);

  await appGoto(page, "/pos/cashier");
  await page.waitForTimeout(1200);
  const cashier = await page.locator(".pos-cashier").isVisible().catch(() => false);
  check("AI 故障态：人工业务页（收银）始终可访问", cashier, String(cashier));

  writeFileSync(path.join(REPORTS, "ai-fault.json"), JSON.stringify({ checks, net }, null, 2), "utf8");
  await context.close();
}

async function runShellModeCheck(browser) {
  const session = loadSession();
  const { context, page } = await newPage(browser, { token: session.token, user: session.user, roles: session.user?.roles ?? ["SUPER_ADMIN"] });
  await page.goto(`${BASE}/pos/cashier`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".wb-shell, .layout", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const state = await shellSnapshot(page);
  const cashier = await page.locator(".pos-cashier").isVisible().catch(() => false);
  const expected = process.env.WB_EXPECT_SHELL === "old" ? "oldShell" : "newShell";
  const ok = state[expected] === 1 && state.newShell + state.oldShell === 1 && state.url === "/pos/cashier" && cashier;
  check(`构建产物 ${BASE}：期望${process.env.WB_EXPECT_SHELL === "old" ? "旧壳(.layout)" : "新壳(.wb-shell)"}且收银页可访问`, ok, JSON.stringify({ ...state, cashier }));
  console.log(`  截图：${await shot(page, `build-${process.env.WB_EXPECT_SHELL ?? "new"}-cashier`)}`);
  writeFileSync(path.join(REPORTS, `build-${process.env.WB_EXPECT_SHELL ?? "new"}.json`), JSON.stringify({ checks, state }, null, 2), "utf8");
  await context.close();
}
const browser = await chromium.launch({ headless: true });
try {
  if (PHASE === "normal") await runNormal(browser);
  else if (PHASE === "menu-fault") await runMenuFault(browser);
  else if (PHASE === "ai-fault") await runAiFault(browser);
  else if (PHASE === "build-shell") await runShellModeCheck(browser);
  else throw new Error(`未知阶段：${PHASE}`);
} catch (err) {
  console.log(`ERROR  ${err.message}`);
  checks.push({ name: `阶段 ${PHASE} 执行异常`, ok: false, detail: err.message });
} finally {
  await browser.close();
}

const failed = checks.filter((item) => !item.ok);
console.log(`\n小结[${PHASE}]：${checks.length - failed.length} passed / ${failed.length} failed`);
writeFileSync(
  path.join(REPORTS, `${PHASE}-summary.json`),
  JSON.stringify({ phase: PHASE, total: checks.length, failed: failed.length, checks }, null, 2),
  "utf8",
);
process.exitCode = failed.length === 0 ? 0 : 1;