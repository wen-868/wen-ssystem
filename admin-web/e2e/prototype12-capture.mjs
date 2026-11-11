/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · 真实浏览器取证采集
 *
 * 运行（worktree 根）：node admin-web/e2e/prototype12-capture.mjs
 * 输入：backend/.env（S5_TEST_PASSWORD 本地口令，不入证据）；无 mock，全部真实请求。
 * 输出：中央 evidence runs/<ts>/（截图 PNG / 几何与网络 JSON / 黑名单扫描 raw）。
 * 覆盖：R01/R02/R03/R04/R05/R06/R09(fail-closed UI)/R11(dom)/R14 证据采集。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const ENV_PATH = path.join(WT, "backend", ".env");
const envText = fs.readFileSync(ENV_PATH, "utf8");
const getEnv = (k) => (envText.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1];

const FRONTEND = process.env.S5_FRONTEND_URL || "http://127.0.0.1:5173";
const PW = getEnv("S5_TEST_PASSWORD");
if (!PW) { console.error("S5_TEST_PASSWORD missing in backend/.env"); process.exit(2); }

const RUNS = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01/runs";
const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const OUT = path.join(RUNS, ts);
fs.mkdirSync(OUT, { recursive: true });

const BLACKLIST = ["双入口左侧菜单", "待接入", "未接入", "不伪造成功", "端点缺失", "设计说明", "红星商行", "张三", "¥25,400", "¥8,900"];
const results = { ts, frontend: FRONTEND, roles: {}, errors: [] };
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function login(page, username, label) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(FRONTEND + "/login", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  const user = page.locator('input').first();
  await user.waitFor({ state: "visible", timeout: 15000 });
  await user.fill(username);
  await page.locator('input[type="password"]').fill(PW);
  const consoleLogs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleLogs.push(m.type() + ": " + m.text().slice(0, 200)); });
  await page.locator('input[type="password"]').press("Enter");
  await page.waitForTimeout(4000);
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /立即登录/ }).click().catch(() => {});
    await page.waitForTimeout(4000);
  }
  const stillLogin = page.url().includes("/login");
  if (stillLogin && label === "super") {
    throw new Error("super login did not navigate; url=" + page.url() + "; console=" + consoleLogs.slice(0, 8).join(" | "));
  }
  if (stillLogin) {
    // fail-closed 预期：无可用页角色被送回登录页（S3-132 设计）。留证。
    const shot = path.join(OUT, `${label}-failclosed-login.png`);
    await page.screenshot({ path: shot, fullPage: true });
    return { failedClosed: true, screenshot: path.relative(RUNS, shot), console: consoleLogs.slice(0, 8) };
  }
  return { failedClosed: false };
}

async function collectGeometry(page, BL = []) {
  return page.evaluate((BL) => {
    const pick = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const find = (pred) => [...document.querySelectorAll("body *")].find(pred);
    const shell = find((e) => /workbench-shell|wb-shell/i.test(e.className) && e.offsetHeight > 500) || document.getElementById("app");
    const rail = find((e) => /(^|\s)(rail|wb-rail)[\s"']|^rail$/i.test(e.className));
    const side = find((e) => /subnav|side(nav|bar)/i.test(e.className) && e.offsetWidth > 150 && e.offsetWidth < 400);
    const task = find((e) => /task[-_]?center/i.test(e.className + " " + (e.dataset?.testid || "")));
    const top = find((e) => /topbar|top-bar|header/i.test(e.className) && e.offsetHeight < 100);
    return {
      viewport: { w: innerWidth, h: innerHeight },
      docScroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
      clientScroll: { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight },
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rects: { shell: pick(shell), rail: pick(rail), side: pick(side), taskCenter: pick(task), top: pick(top) },
      counts: {
        textarea: document.querySelectorAll("textarea").length,
        textInputs: document.querySelectorAll("input[type=text], input:not([type])").length,
        dailyOpTitle: document.querySelectorAll('[data-testid="daily-op-title"]').length,
        navLinks: document.querySelectorAll("a[href]").length,
      },
      blacklistHits: (["双入口左侧菜单", "待接入", "未接入", "不伪造成功", "端点缺失", "设计说明", "红星商行", "张三", "¥25,400", "¥8,900"]).map((w) => {
        const n = (document.body.innerText.split(w).length - 1);
        return { word: w, count: n };
      }).filter((x) => x.count > 0),
    };
  });
}

async function captureRole(browser, username, label) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const net = [];
  page.on("response", async (res) => {
    const u = res.url();
    if (/\/api\//.test(u)) {
      const entry = { url: u.replace(/^https?:\/\/[^/]+/, ""), status: res.status() };
      try { if (/(employees|confirmations|plans|notifications|overview|inventory-warning|tasks)/.test(u)) entry.bodyHead = (await res.text()).slice(0, 300); } catch {}
      net.push(entry);
    }
  });
  const role = { username, screenshots: [], api_seen: 0 };
  try {
    const loginOutcome = await login(page, username, label);
    role.login = loginOutcome;
    if (loginOutcome.failedClosed) {
      // 无可用页角色：API 登录成功但被 fail-closed 送回登录页（S3-132 预期），已留证
      results.roles[label] = role;
      role.api_seen = net.length;
      fs.writeFileSync(path.join(OUT, `${label}-network.json`), JSON.stringify(net, null, 2));
      await ctx.close();
      log("captured", label, "failed-closed(预期) api_seen=" + role.api_seen);
      return;
    }
    role.login_ok = true;
    for (const vp of [{ name: "1440x1000", w: 1440, h: 1000 }, { name: "1024x768", w: 1024, h: 768 }, { name: "390x844", w: 390, h: 844 }]) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(FRONTEND + "/", { waitUntil: "networkidle", timeout: 30000 }).catch((e) => results.errors.push(`networkidle ${vp.name}: ${e.message}`));
      await page.waitForTimeout(1500);
      const shot = path.join(OUT, `${label}-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      role.screenshots.push(path.relative(RUNS, shot));
      const geo = await collectGeometry(page, BLACKLIST);
      fs.writeFileSync(path.join(OUT, `${label}-${vp.name}-geometry.json`), JSON.stringify(geo, null, 2));
      role[vp.name] = geo;
    }
    // R04: task center toggle（真实点击，super only；找不到如实记录）
    if (username === "s5_super") {
      const tcBtn = page.getByText(/任务跟踪|进度明细/).first();
      if (await tcBtn.count()) {
        const before = await collectGeometry(page, BLACKLIST);
        await tcBtn.click().catch((e) => results.errors.push("tc click: " + e.message));
        await page.waitForTimeout(800);
        const shot2 = path.join(OUT, `${label}-taskcenter-toggled.png`);
        await page.screenshot({ path: shot2, fullPage: true });
        role.taskCenterToggle = { before: before.rects, after: (await collectGeometry(page, BLACKLIST)).rects, screenshot: path.relative(RUNS, shot2) };
      } else role.taskCenterToggle = { found: false };
    }
  } catch (e) {
    role.error = String(e).slice(0, 400);
    const shot = path.join(OUT, `${label}-error-state.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  }
  role.api_seen = net.length;
  fs.writeFileSync(path.join(OUT, `${label}-network.json`), JSON.stringify(net, null, 2));
  await ctx.close();
  results.roles[label] = role;
  log("captured", label, "login_ok=" + !!role.login_ok, "api_seen=" + role.api_seen);
}

const browser = await chromium.launch();
try {
  await captureRole(browser, "s5_super", "super");
  await captureRole(browser, "s5_ghost", "ghost");
  await captureRole(browser, "s5_norole", "norole");
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, "capture-result.json"), JSON.stringify(results, null, 2));
log("DONE", OUT);
