/**
 * PAGES-SYSTEM-OPERATIONS-01 逐页视觉 + DOM 几何 + DOM 黑名单取证。
 * 用 worktree vite preview(5180) 的真实渲染；注入 admin_auth(JWT+SUPER_ADMIN) 进入登录态。
 * 对每个系统组路由，1440×1000 / 1024×768 各截图 + 采集标题/主内容几何/黑名单命中。
 * 后端 API 不可达时页面走空态/fail-closed —— 仍作为"状态呈现"证据如实记录（不伪造数据）。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.CAP_BASE || "http://127.0.0.1:5180";
const OUT = process.env.CAP_OUT;
const token = fs.readFileSync(process.env.CAP_JWT, "utf8").trim();
const user = {
  id: 1, userId: 1, username: "admin", realName: "系统管理员",
  roles: ["SUPER_ADMIN"], role: "SUPER_ADMIN", tenantId: "default", storeId: null,
};

const BLACKLIST = ["双入口左侧菜单","待接入","未接入","不伪造成功","端点缺失","设计说明","红星商行","张三","¥25,400","¥8,900"];

// 系统组代表路由（8 原型页主路由 + 关键子页）
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

const VIEWPORTS = [
  { w: 1440, h: 1000, tag: "1440x1000" },
  { w: 1024, h: 768, tag: "1024x768" },
];

const results = { base: BASE, ts: new Date().toISOString(), pages: [] };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
// 注入登录态：admin_auth = {token,user}（pinia persist pick token,user）
await ctx.addInitScript(([t, u, key]) => {
  localStorage.setItem(key, JSON.stringify({ token: t, user: u }));
}, [token, user, "admin_auth"]);

for (const pg of PAGES) {
  const rec = { route: pg.route, name: pg.name, proto: pg.proto, viewports: [] };
  for (const vp of VIEWPORTS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const consoleErr = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 120)); });
    let httpErr = null;
    try {
      const resp = await page.goto(BASE + pg.route, { waitUntil: "networkidle", timeout: 25000 });
      if (resp && resp.status() >= 400) httpErr = resp.status();
    } catch (e) { httpErr = "goto:" + e.message.slice(0, 80); }
    await page.waitForTimeout(600);
    const url = page.url();
    const title = await page.title().catch(() => "");
    // 主内容几何 + 可见文本
    const metrics = await page.evaluate(() => {
      const el = document.querySelector("#app .el-main") || document.querySelector("#app") || document.body;
      const r = el.getBoundingClientRect();
      const txt = (document.querySelector("#app")?.innerText || "").slice(0, 4000);
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), innerText: txt };
    });
    const blHits = BLACKLIST.filter((t) => metrics.innerText.includes(t));
    const shot = path.join(OUT, `${pg.route.replace(/[/:]/g, "_") || "root"}.${vp.tag}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    rec.viewports.push({
      vp: vp.tag, finalUrl: url, title, httpErr,
      geom: { w: metrics.w, h: metrics.h, top: metrics.top, left: metrics.left },
      textLen: metrics.innerText.length, blacklistHits: blHits,
      docScrollH: await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0),
      screenshot: path.basename(shot), consoleErrors: consoleErr.slice(0, 3),
    });
    await page.close();
  }
  results.pages.push(rec);
  const v = rec.viewports[0];
  console.log(`${rec.route} [${v.vp}] url=${v.finalUrl} geom=${v.geom.w}x${v.geom.h} bl=${v.blacklistHits.length} httpErr=${v.httpErr || "-"} textLen=${v.textLen}`);
}
await browser.close();
fs.writeFileSync(path.join(OUT, "capture-results.json"), JSON.stringify(results, null, 2), "utf8");

// 汇总
let blTotal = 0, reachable = 0;
for (const p of results.pages) for (const v of p.viewports) { blTotal += v.blacklistHits.length; if (v.textLen > 0) reachable++; }
console.log(`\nSUMMARY pages=${results.pages.length} viewports=${results.pages.length * VIEWPORTS.length} blacklistTotal=${blTotal} renderedWithText=${reachable}`);
process.exit(0);
