/**
 * PAGES-SYSTEM-OPERATIONS-01 门2局部退回补拍（仅 /employees 两视口）
 *
 * 退回点：/employees 截图被 AI 会话壳层（is-ai 视图 + AI 故障 banner）遮挡，
 *         员工表格 4 行在 DOM 里但视觉不可见。
 * 补拍口径：
 *  1. 先切业务视图（壳层 localStorage wb.shell.mode=human / 点「切换人工操作台」）再截图；
 *  2. 截图前断言目标页主体（员工表格行 / 页头「员工管理」）在视口内可见，不满足重试；
 *  3. stateKind + visualKind 双字段，防壳层遮挡冒充 data 态；
 *  4. 1440x1000 + 1024x768 两视口。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.CAP_BASE || "http://127.0.0.1:5181";
const OUT = process.env.CAP_OUT;
const ROUTE = "/employees";
const VIEWPORTS = [{ w: 1440, h: 1000, tag: "1440x1000" }, { w: 1024, h: 768, tag: "1024x768" }];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

// 真实登录：浏览器内调后端 demo-login（服务端签发 JWT）
const lctx = await browser.newContext();
const lp = await lctx.newPage();
await lp.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
const login = await lp.evaluate(async () => {
  const r = await fetch("/api/admin/auth/demo-login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, token: j?.data?.token || null, user: j?.data?.user || null };
});
if (!login.token) { console.error("REAL_LOGIN_FAILED", JSON.stringify(login)); await browser.close(); process.exit(2); }
console.log(`REAL_LOGIN ok status=${login.status} tokenLen=${login.token.length} user=${login.user?.username}/${JSON.stringify(login.user?.roles)}`);
await lctx.close();

const out = { route: ROUTE, authMode: "real-demo-login (server-issued JWT)", viewMode: "human (business view)", ts: new Date().toISOString(), login: { status: login.status, tokenLen: login.token.length, user: login.user?.username, roles: login.user?.roles }, viewports: [] };

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  await ctx.addInitScript(([token, user]) => {
    localStorage.setItem("admin_auth", JSON.stringify({ token, user }));
    // 关键：先切业务视图，避免 AI 壳层遮挡业务页
    localStorage.setItem("wb.shell.mode", "human");
  }, [login.token, login.user]);
  const page = await ctx.newPage();
  const consoleErr = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 120)); });
  await page.goto(BASE + ROUTE, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // 若仍停在 AI 壳层（故障 banner 在），点「切换人工操作台」兜底
  const faultBtn = page.locator('[data-testid="ai-fault-banner"] button');
  if (await faultBtn.count().catch(() => 0)) {
    await faultBtn.first().click().catch(() => {});
    await page.waitForTimeout(1200);
    console.log(`[${vp.tag}] clicked fallback button (ai-fault-banner)`);
  }

  // 断言：员工表格行在视口内可见（最多重试 5 次）
  let visible = false, attempts = 0;
  for (; attempts < 5; attempts++) {
    visible = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".el-table__body tr")];
      const inView = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0;
      };
      const visibleRows = rows.filter(inView).length;
      // 壳层遮挡判定：AI 故障 banner 存在且面积大 ⇒ 视觉被挡
      const banner = document.querySelector('[data-testid="ai-fault-banner"]');
      const bannerBig = banner ? banner.getBoundingClientRect().height > 40 : false;
      const shell = document.querySelector(".wb-shell");
      const isAi = shell ? shell.classList.contains("is-ai") : false;
      return { visibleRows, totalRows: rows.length, bannerBig, isAi, ok: visibleRows > 0 && !isAi };
    });
    if (visible.ok) break;
    // 尝试再切一次 + 滚动表格入视口
    await page.evaluate(() => { localStorage.setItem("wb.shell.mode", "human"); });
    const btn = page.locator('[data-testid="ai-fault-banner"] button');
    if (await btn.count().catch(() => 0)) await btn.first().click().catch(() => {});
    await page.locator(".el-table__body").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1200);
  }

  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".el-table__body tr")];
    const inView = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0; };
    const visibleRows = rows.filter(inView).length;
    const shell = document.querySelector(".wb-shell");
    const header = [...document.querySelectorAll(".card-header span, .page-header, h2, h1")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 6);
    const txt = (document.querySelector("#app")?.innerText || "").slice(0, 4000);
    return {
      tableRows: rows.length, visibleRows,
      isAiShell: shell ? shell.classList.contains("is-ai") : false,
      header, textLen: txt.length,
      hasFaultBanner: !!document.querySelector('[data-testid="ai-fault-banner"]'),
      hasEmpty: /暂无数据|暂无相关数据|无数据/.test(txt),
      innerText: txt,
    };
  });

  const shot = path.join(OUT, `_employees.${vp.tag}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  const stateKind = m.tableRows > 0 ? "data" : (m.hasEmpty ? "empty" : "other");
  // visualKind：视觉是否真能看到目标页主体（防壳层遮挡冒充 data 态）
  const visualKind = m.visibleRows > 0 && !m.isAiShell ? "data-visible" : (m.isAiShell ? "shell-blocked" : "not-visible");
  out.viewports.push({
    vp: vp.tag, finalUrl: page.url(), geom: { w: vp.w, h: vp.h },
    tableRows: m.tableRows, visibleRows: m.visibleRows,
    stateKind, visualKind,
    isAiShell: m.isAiShell, hasFaultBanner: m.hasFaultBanner,
    header: m.header, textLen: m.textLen,
    attempts: attempts + 1, screenshot: path.basename(shot),
    consoleErrors: consoleErr.slice(0, 3),
  });
  console.log(`[${vp.tag}] rows=${m.tableRows} visibleRows=${m.visibleRows} isAiShell=${m.isAiShell} stateKind=${stateKind} visualKind=${visualKind} header=${JSON.stringify(m.header)} attempts=${attempts + 1}`);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "capture-employees-refix.json"), JSON.stringify(out, null, 2), "utf8");
const allOk = out.viewports.every((v) => v.visualKind === "data-visible");
console.log(`\nSUMMARY viewports=${out.viewports.length} allDataVisible=${allOk}`);
process.exit(allOk ? 0 : 3);
