/**
 * WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01 · 四域逐页视觉/DOM 几何采集
 *
 * 运行（worktree 根）：node admin-web/e2e/prototype12-pages-supply-customer-product-capture.mjs
 * 前置：后端 8080（隔离验证库）+ admin-web dev 5173 已起；NODE_ENV=test ⇒ demo-login 免密通道可用。
 * 输出：中央 evidence runs/<ts>/——每页每视口截图 PNG + DOM 几何 JSON + 网络错误清单。
 * 口径：真实登录（demo-login，NODE_ENV=test 唯一口径）、真实路由跳转、真实 API；无 mock 注入。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const FRONTEND = process.env.CAP_FRONTEND_URL || "http://127.0.0.1:5173";
const BACKEND = process.env.CAP_BACKEND_URL || "http://127.0.0.1:8080";
const OUT = process.argv[2] || path.join("D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01", "runs", new Date().toISOString().replace(/[:.]/g, "").slice(0, 15));
fs.mkdirSync(OUT, { recursive: true });

// 四域 51 条生产路由（与合同测试同源解析）
const routerSrc = fs.readFileSync(path.join(WT, "admin-web", "src", "router", "index.ts"), "utf8");
const routes = [];
const routeRe = /path:\s*"([^"]+)"[^}]*?component:\s*\(\)\s*=>\s*import\("\.\.\/views\/((?:purchase|inventory|customer|product)\/[A-Za-z]+\.vue)"\)[^}]*?roles:\s*\[([^\]]*)\][^}]*?title:\s*"([^"]+)"/g;
let m;
while ((m = routeRe.exec(routerSrc)) !== null) {
  routes.push({ path: m[1], component: m[2], title: m[4] });
}
console.log(`routes: ${routes.length}`);

const VIEWPORTS = [
  { name: "v1440", width: 1440, height: 1000 },
  { name: "v1024", width: 1024, height: 768 },
];

const browser = await chromium.launch({ headless: true });
const results = [];

// demo-login 取真实 JWT（NODE_ENV=test 下唯一免密口径；口令参数为空）
async function getAuth(page) {
  const resp = await page.request.post(`${BACKEND}/api/admin/auth/demo-login`, { data: {} });
  if (resp.status() !== 200) throw new Error(`demo-login HTTP ${resp.status}: ${await resp.text()}`);
  const j = await resp.json();
  return j.data; // { token, user, ... }
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const auth = await getAuth(page);
if (!auth?.token) throw new Error("no token");
console.log("demo-login OK (token obtained, not logged)");

// 预注入持久化认证：与 stores/auth.ts pinia-persist 键一致（admin_auth = {token,user}）
await ctx.addInitScript((a) => { try { localStorage.setItem("admin_auth", JSON.stringify({ token: a.token, user: a.user })); } catch {} }, auth);
await page.goto(`${FRONTEND}/`, { waitUntil: "load", timeout: 60000 }).catch(() => {});
console.log(`frontend first load url=${page.url()}`);
await page.waitForTimeout(2500);

const geoNdjson = path.join(OUT, "geo-per-page.ndjson");

for (const r of routes) {
  const entry = { path: r.path, title: r.title, component: r.component, viewports: {} };
  for (const vp of VIEWPORTS) {
    const p2 = await ctx.newPage();
    try {
      await p2.setViewportSize({ width: vp.width, height: vp.height });
      const netErrors = [];
      p2.on("response", (resp) => { if (resp.status() >= 400) netErrors.push({ url: resp.url().replace(FRONTEND, "").split("?")[0], status: resp.status() }); });
      const url = `${FRONTEND}/${r.path}`;
      try {
        await p2.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      } catch { await p2.waitForTimeout(3000); }
      await p2.waitForTimeout(800);
      const shot = path.join(OUT, `${r.path.replace(/[\/:]/g, "_")}_${vp.name}.png`);
      await p2.screenshot({ path: shot, fullPage: false });
      const geo = await p2.evaluate(() => {
        const q = (sel) => document.querySelector(sel);
        const rectOf = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        const tbl = q(".el-table");
        const overflowX = tbl ? (tbl.scrollWidth > tbl.clientWidth + 2) : null;
        return {
          viewport: { w: window.innerWidth, h: window.innerHeight },
          pageHeader: rectOf(q(".page-header")),
          pageTitle: document.querySelector(".page-title, .page-header h2")?.textContent?.trim() || null,
          tableCount: document.querySelectorAll(".el-table").length,
          tableOverflowX: overflowX,
          hasEmpty: !!q(".el-empty"),
          hasPagination: !!q(".el-pagination"),
          dialogOpen: !!q(".el-dialog"),
          bodyScrollW: document.documentElement.scrollWidth,
          bodyClientW: document.documentElement.clientWidth,
        };
      });
      entry.viewports[vp.name] = { screenshot: path.basename(shot), geo, netErrors: netErrors.slice(0, 8) };
    } catch (e) {
      entry.viewports[vp.name] = { error: String(e && e.message || e).slice(0, 300) };
    } finally {
      await p2.close().catch(() => {});
    }
  }
  results.push(entry);
  // 逐页增量落盘：进程意外退出不丢已采几何
  fs.appendFileSync(geoNdjson, JSON.stringify(entry) + "\n", "utf8");
  fs.writeFileSync(path.join(OUT, "capture-summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), frontend: FRONTEND, backend: BACKEND, count: results.length, results }, null, 2), "utf8");
  console.log(`captured ${r.path} (${entry.viewports.v1440?.geo?.pageTitle || entry.viewports.v1440?.error?.slice(0, 60) || "?"})`);
}

await ctx.close();
await browser.close();
fs.writeFileSync(path.join(OUT, "capture-summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), frontend: FRONTEND, backend: BACKEND, count: results.length, results }, null, 2), "utf8");
console.log(`\nDONE: ${results.length} pages × 2 viewports → ${OUT}`);
