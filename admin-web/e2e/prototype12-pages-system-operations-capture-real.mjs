/**
 * PAGES-SYSTEM-OPERATIONS-01 真实登录逐页视觉/DOM 取证（门2返工版）
 *
 * 与上一版区别：不再用自签 CAP_JWT 注入。本版在浏览器内**真实调用后端 demo-login
 * 接口**（服务端真实签发 SUPER_ADMIN JWT 会话，管理员免密门仅 NODE_ENV≠production 开），
 * 将服务端返回的真实 token+user 写入前端 persist key(admin_auth) 后进入登录态。
 * 这是服务端真实签发会话，非结构诊断。
 *
 * 前端：worktree vite dev 5181（proxy /api → 真后端 3001 隔离库）。
 * 后端：node dist/server.js @3001，DB_NAME=zxql_wb_verify_isolated, NODE_ENV=development。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.CAP_BASE || "http://127.0.0.1:5181";
const OUT = process.env.CAP_OUT;
const BLACKLIST = ["双入口左侧菜单","待接入","未接入","不伪造成功","端点缺失","设计说明","红星商行","张三","¥25,400","¥8,900"];

const PAGES = [
  { route: "/employees", name: "组织人事-员工", proto: "sys-org" },
  { route: "/organization", name: "组织架构", proto: "sys-org" },
  { route: "/department-manage", name: "部门管理", proto: "sys-org" },
  { route: "/position-manage", name: "岗位管理", proto: "sys-org" },
  { route: "/stores", name: "门店管理", proto: "sys-org" },
  { route: "/system/roles", name: "角色管理", proto: "sys-role" },
  { route: "/report-permissions", name: "报表权限", proto: "sys-role" },
  { route: "/system/approval/manage", name: "审批管理", proto: "sys-approval" },
  { route: "/system/approval/rules", name: "审批规则", proto: "sys-approval" },
  { route: "/system/approval/my", name: "我的审批", proto: "sys-approval" },
  { route: "/system/print", name: "打印模板", proto: "sys-print" },
  { route: "/system/print/designer", name: "模板设计", proto: "sys-print" },
  { route: "/system/config", name: "系统配置", proto: "sys-config" },
  { route: "/system/payment", name: "支付配置", proto: "sys-config" },
  { route: "/system/miniapp", name: "小程序配置", proto: "sys-config" },
  { route: "/audit-log", name: "操作日志", proto: "sys-log" },
  { route: "/error-log", name: "错误日志", proto: "sys-log" },
  { route: "/consumer-addresses", name: "收货地址", proto: "sys-log" },
  { route: "/monitor", name: "系统监控", proto: "sys-monitor" },
  { route: "/monitor-manage", name: "监控管理", proto: "sys-monitor" },
  { route: "/system/feedback", name: "反馈管理", proto: "sys-feedback" },
];
const VIEWPORTS = [{ w: 1440, h: 1000, tag: "1440x1000" }, { w: 1024, h: 768, tag: "1024x768" }];

const results = { base: BASE, authMode: "real-demo-login (server-issued JWT)", ts: new Date().toISOString(), login: null, pages: [] };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

// 1) 真实登录：在浏览器上下文内 fetch demo-login（走前端 proxy 到真后端），服务端真实签发 token
const loginCtx = await browser.newContext();
const loginPage = await loginCtx.newPage();
await loginPage.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
const login = await loginPage.evaluate(async () => {
  const r = await fetch("/api/admin/auth/demo-login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, token: j?.data?.token || null, user: j?.data?.user || null };
});
results.login = { status: login.status, tokenLen: login.token ? login.token.length : 0, user: login.user ? { username: login.user.username, roles: login.user.roles, tenantId: login.user.tenantId } : null };
if (!login.token) { console.error("REAL_LOGIN_FAILED", JSON.stringify(results.login)); await browser.close(); process.exit(2); }
console.log(`REAL_LOGIN ok status=${login.status} tokenLen=${login.token.length} user=${login.user?.username}/${JSON.stringify(login.user?.roles)}`);

// 2) 每个视口上下文注入真实会话（来自服务端签发 token+user）
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  await ctx.addInitScript(([token, user]) => {
    localStorage.setItem("admin_auth", JSON.stringify({ token, user }));
    // 系统页均属人工操作台业务视图：预置 human 模式，避免 AI 壳层遮挡业务页
    // （壳层 BUSINESS_ROUTE_PATHS 未覆盖 /employees 等系统路由，属壳层缺陷，已登记转墨卡）
    localStorage.setItem("wb.shell.mode", "human");
  }, [login.token, login.user]);
  for (const pg of PAGES) {
    const page = await ctx.newPage();
    const consoleErr = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 120)); });
    let httpErr = null;
    try {
      const resp = await page.goto(BASE + pg.route, { waitUntil: "networkidle", timeout: 25000 });
      if (resp && resp.status() >= 400) httpErr = resp.status();
    } catch (e) { httpErr = "goto:" + String(e.message).slice(0, 80); }
    // 等真实数据加载：优先等 el-table 行或加载指示消失；最多再等 4s
    await page.waitForFunction(() => {
      const app = document.querySelector("#app");
      if (!app) return false;
      const txt = app.innerText || "";
      const rows = document.querySelectorAll(".el-table__body tr").length;
      // 有表格行 或 出现空态文案 或 无 loading 遮罩
      return rows > 0 || /暂无数据|暂无相关数据|无数据/.test(txt) || !document.querySelector(".el-loading-mask");
    }, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const title = await page.title().catch(() => "");
    const m = await page.evaluate(() => {
      const el = document.querySelector("#app .el-main") || document.querySelector("#app") || document.body;
      const r = el.getBoundingClientRect();
      const txt = (document.querySelector("#app")?.innerText || "").slice(0, 6000);
      const tableRows = document.querySelectorAll(".el-table__body tr").length;
      const hasLoading = !!document.querySelector(".el-loading-mask");
      // 主体可见性：页头标题 + 主内容区是否在视口内，且是否被壳层遮挡
      const inView = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < window.innerHeight && b.bottom > 0 && b.left < window.innerWidth && b.right > 0; };
      const shell = document.querySelector(".wb-shell");
      const isAiShell = shell ? shell.classList.contains("is-ai") : false;
      const faultBanner = document.querySelector('[data-testid="ai-fault-banner"]');
      const mainEl = document.querySelector("#app .el-main") || document.querySelector(".wb-view-manual") || document.querySelector("#app");
      const mainBox = mainEl ? mainEl.getBoundingClientRect() : null;
      const heading = [...document.querySelectorAll(".card-header span, .page-header, h1, h2")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 4);
      const visibleRows = [...document.querySelectorAll(".el-table__body tr")].filter(inView).length;
      // 横向溢出：文档宽度超出视口即记录（响应式/挤压诊断）
      const docOverflowX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      const bodyOverflowX = Math.max(0, document.body.scrollWidth - window.innerWidth);
      // 二级导航是否挤压主内容区（新壳层重点核对项）
      const subnav = document.querySelector(".wb-subnav, [data-testid='wb-subnav']");
      const subnavBox = subnav ? subnav.getBoundingClientRect() : null;
      const mainOverlappedBySubnav = !!(subnavBox && mainBox && subnavBox.height > 0 &&
        mainBox.top < subnavBox.bottom - 1 && mainBox.bottom > subnavBox.top + 1 &&
        mainBox.left < subnavBox.right - 1 && mainBox.right > subnavBox.left + 1);
      return {
        w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left),
        innerText: txt, tableRows, visibleRows, hasLoading,
        isAiShell, hasFaultBanner: !!faultBanner, heading,
        mainBox: mainBox ? { w: Math.round(mainBox.width), h: Math.round(mainBox.height), top: Math.round(mainBox.top), left: Math.round(mainBox.left) } : null,
        mainInView: mainBox ? inView(mainEl) : false,
        docOverflowX, bodyOverflowX,
        hasSubnav: !!subnav,
        subnavBox: subnavBox ? { w: Math.round(subnavBox.width), h: Math.round(subnavBox.height), top: Math.round(subnavBox.top), left: Math.round(subnavBox.left) } : null,
        mainOverlappedBySubnav,
      };
    });
    const blHits = BLACKLIST.filter((t) => m.innerText.includes(t));
    const shot = path.join(OUT, `${pg.route.replace(/[/:]/g, "_") || "root"}.${vp.tag}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    let rec = results.pages.find((p) => p.route === pg.route);
    if (!rec) { rec = { route: pg.route, name: pg.name, proto: pg.proto, viewports: [] }; results.pages.push(rec); }
    const stateKind = m.tableRows > 0 ? "data" : (/暂无数据|暂无相关数据|无数据/.test(m.innerText) ? "empty" : "other");
    const bodyVisible = m.mainInView && !m.isAiShell;
    const visualKind = m.isAiShell ? "ai-shell-blocked" : (bodyVisible ? "manual-console" : "not-visible");
    rec.viewports.push({
      vp: vp.tag, finalUrl: page.url(), title, httpErr,
      geom: { w: m.w, h: m.h, top: m.top, left: m.left }, textLen: m.innerText.length,
      tableRows: m.tableRows, visibleRows: m.visibleRows, isLoaded: !m.hasLoading,
      stateKind, visualKind,
      isAiShell: m.isAiShell, hasFaultBanner: m.hasFaultBanner,
      heading: m.heading, mainBox: m.mainBox, mainInView: m.mainInView,
      docOverflowX: m.docOverflowX, bodyOverflowX: m.bodyOverflowX,
      hasSubnav: m.hasSubnav, subnavBox: m.subnavBox, mainOverlappedBySubnav: m.mainOverlappedBySubnav,
      blacklistHits: blHits, screenshot: path.basename(shot), consoleErrors: consoleErr.slice(0, 3),
    });
    await page.close();
    console.log(`${pg.route} [${vp.tag}] rows=${m.tableRows}/${m.visibleRows} visual=${visualKind} overflowX=${m.docOverflowX} subnav=${m.hasSubnav}(${m.mainOverlappedBySubnav ? "OVERLAP!" : "ok"}) bl=${blHits.length} http=${httpErr || "-"}`);
  }
  await ctx.close();
}
await browser.close();
let bl = 0, rendered = 0, blocked = 0, overlap = 0, overflow = 0;
for (const p of results.pages) for (const v of p.viewports) {
  bl += v.blacklistHits.length;
  if (v.textLen > 0) rendered++;
  if (v.visualKind === "ai-shell-blocked" || v.visualKind === "not-visible") blocked++;
  if (v.mainOverlappedBySubnav) overlap++;
  if (v.docOverflowX > 0) overflow++;
}
results.summary = { pages: results.pages.length, viewports: results.pages.length * 2, blacklistTotal: bl, rendered, blocked, subnavOverlap: overlap, horizontalOverflow: overflow };
fs.writeFileSync(path.join(OUT, "capture-results.json"), JSON.stringify(results, null, 2), "utf8");
console.log(`\nSUMMARY real-login pages=${results.pages.length} viewports=${results.pages.length * 2} blacklistTotal=${bl} rendered=${rendered} blocked=${blocked} subnavOverlap=${overlap} overflowX=${overflow}`);
process.exit(blocked > 0 ? 4 : 0);
