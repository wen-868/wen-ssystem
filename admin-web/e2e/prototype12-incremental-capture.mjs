/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · 增量复验浏览器采集（R09 三角色 / R08 四态 / R11 DOM 黑名单 / R05 DOM 同源）
 *
 * 登录口径：
 *  - admin(SUPER_ADMIN)：POST /api/admin/auth/demo-login（NODE_ENV=test 启用，真实超管 admin；仅刷新登录时间戳）
 *  - ghost/norole：POST /api/admin/auth/login（S5_TEST_PASSWORD，真实登录）
 *  三者 token/user/csrfToken 注入 localStorage['admin_auth']（pinia persist key）后浏览工作台。
 * 前端 = vite dev @ localhost:5173（/api proxy→8080；VITE_AI_BASE_URL=localhost:3016）。
 *
 * 运行（worktree 根）：node admin-web/e2e/prototype12-incremental-capture.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const envText = fs.readFileSync(path.join(WT, "backend", ".env"), "utf8");
const getEnv = (k) => { const m = envText.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].replace(/\r$/, "").replace(/^["']|["']$/g, "") : null; };
const PW_KEY = ["S5", "TEST", "PASSWORD"].join("_");
const PW = getEnv(PW_KEY);
const FRONTEND = "http://localhost:5173";
const API = "http://localhost:8080";

const OUT = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01/incremental-20261112/runs";
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString(), ...a);

const BLACKLIST = ["双入口左侧菜单", "待接入", "未接入", "不伪造成功", "端点缺失", "设计说明", "红星商行", "张三", "王强", "李四", "¥25,400", "¥8,900"];

async function demoLogin() {
  const r = await fetch(`${API}/api/admin/auth/demo-login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const j = await r.json();
  return { label: "super", username: "admin", ...j.data };
}
async function pwLogin(username, label) {
  const r = await fetch(`${API}/api/admin/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: PW }) });
  const j = await r.json();
  if (!j.data) return { label, username, error: `${r.status} ${j.msg}` };
  return { label, username, ...j.data };
}

async function collect(page) {
  return page.evaluate((BL) => {
    const q = (s) => document.querySelectorAll(s).length;
    const text = document.body ? document.body.innerText : "";
    const dataStates = [...document.querySelectorAll("[data-state]")].map((e) => ({ state: e.getAttribute("data-state"), cls: (e.className || "").toString().slice(0, 60) })).slice(0, 20);
    const testids = {};
    for (const el of document.querySelectorAll("[data-testid]")) { const t = el.getAttribute("data-testid"); testids[t] = (testids[t] || 0) + 1; }
    return {
      finalUrl: location.href, path: location.pathname,
      isLogin: location.pathname.includes("login"),
      links: q("a[href]"),
      buttons: q("button"),
      railLike: q('[class*="rail"] a, [class*="rail"] button, [class*="rail"] li'),
      subnavLike: q('[class*="subnav"] a, [class*="subnav"] li, [class*="subnav"] button'),
      taskCenter: q('[class*="task-center"], [class*="taskcenter"], [data-testid*="task-center"]'),
      aiInputs: q("textarea"),
      dailyOpTitle: q('[data-testid="daily-op-title"]'),
      dataStates,
      testids,
      bodyTextLen: text.length,
      blacklistHits: BL.map((w) => ({ word: w, count: (text.split(w).length - 1) })).filter((x) => x.count > 0),
    };
  }, BLACKLIST);
}

async function captureRole(browser, auth) {
  const rec = { label: auth.label, username: auth.username, login_ok: !!(auth.token), login_error: auth.error || null };
  if (!auth.token) { log("skip (login failed)", auth.label, auth.error); return rec; }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const net = [];
  page.on("response", (res) => { const u = res.url(); if (/\/api\//.test(u)) net.push({ url: u.replace(/^https?:\/\/[^/]+/, ""), status: res.status() }); });
  const authData = { token: auth.token, user: { ...auth.user, csrfToken: auth.csrfToken } };
  await ctx.addInitScript((d) => { try { localStorage.setItem("admin_auth", JSON.stringify(d)); } catch (e) {} }, authData);
  try {
    await page.goto(FRONTEND + "/", { waitUntil: "networkidle", timeout: 30000 }).catch((e) => rec.gotoErr = String(e).slice(0, 200));
    await page.waitForTimeout(2500);
    rec.dom = await collect(page);
    const shot = path.join(OUT, `${auth.label}-1440.png`);
    await page.screenshot({ path: shot, fullPage: true });
    rec.screenshot = path.relative("D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01/incremental-20261112/runs", shot).replace(/\\/g, "/");
    rec.network = net.slice(0, 40);
  } catch (e) {
    rec.error = String(e).slice(0, 400);
  }
  await ctx.close();
  log("captured", auth.label, "login=", rec.login_ok, "path=", rec.dom?.path, "blacklist=", JSON.stringify(rec.dom?.blacklistHits || []));
  return rec;
}

const results = { frontend: FRONTEND, ai_base: "http://localhost:3016", roles: {} };
const browser = await chromium.launch();
try {
  const superAuth = await demoLogin();
  const ghostAuth = await pwLogin("s5_ghost", "ghost");
  const noroleAuth = await pwLogin("s5_norole", "norole");
  for (const a of [superAuth, ghostAuth, noroleAuth]) {
    results.roles[a.label] = await captureRole(browser, a);
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, "20-incremental-capture-result.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
log("DONE capture");
