/**
 * WORKBENCH-PROTOTYPE-12-PAGES-SALES-RETAIL-MARKETING-01 · 27 页视觉/DOM 几何取证采集
 *
 * 卡面「必须完成」§2：1440×1000、1024×768 逐页视觉和 DOM 几何。
 * 运行（worktree 根）：node admin-web/e2e/prototype12-pages-sales-retail-marketing-geometry.mjs
 *   可选环境变量：SRM_FRONTEND_URL（默认 http://127.0.0.1:5273，本卡专属 dev server）
 *
 * 口径：
 *   - 登录凭据运行时从 e2e/prototype12-capture.mjs 源解析（账号 + backend/.env 键名），
 *     .env 优先本 worktree，缺省回退主检出 backend/.env；明文不落本脚本、不落证据。
 *   - 后端为共享 8080（只读导航取证，不做任何写操作/确认类点击）。
 *   - 输出：中央 evidence geometry/（每页每视口 geometry JSON + 全页截图 PNG + 汇总）。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const FRONTEND = process.env.SRM_FRONTEND_URL || "http://127.0.0.1:5273";
const BACKEND = process.env.SRM_BACKEND_URL || "http://127.0.0.1:8080";
const OUT = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-PAGES-SALES-RETAIL-MARKETING-01/geometry";
fs.mkdirSync(OUT, { recursive: true });

/* ── 凭据解析（运行时，明文不落盘）── */
const captureSrc = fs.readFileSync(path.join(HERE, "prototype12-capture.mjs"), "utf8");
const ENV_KEY = (captureSrc.match(/getEnv\("([^"]+)"\)/) || [])[1];
const SUPER_USER = (captureSrc.match(/captureRole\(browser,\s*"([^"]+)",\s*"super"\)/) || [])[1];
if (!ENV_KEY || !SUPER_USER) { console.error("无法从 capture.mjs 解析凭据键名/账号"); process.exit(2); }
const envCandidates = [
  path.join(WT, "backend", ".env"),
  "D:/Users/ZXQL/ZXQL-WORK/worktrees/ms/WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01/backend/.env",
  "D:/Users/ZXQL/ZXQL-MS/wen-ssystem/backend/.env",
];
const envPath = envCandidates.find((p) => fs.existsSync(p));
if (!envPath) { console.error("backend/.env 未找到：" + envCandidates.join(" | ")); process.exit(2); }
const envText = fs.readFileSync(envPath, "utf8");
const PW = (envText.match(new RegExp("^" + ENV_KEY + "=(.*)$", "m")) || [])[1];
if (!PW) { console.error("backend/.env 缺键 " + ENV_KEY + "（" + envPath + "）"); process.exit(2); }
console.log("凭据解析 OK：账号=" + SUPER_USER + "，.env=" + envPath + "，键=" + ENV_KEY + "（值不落日志）");

/* ── 27 页路由（与合同 spec ROUTES 同源）── */
const ROUTES = [
  ["sale/CollectionLinks", "/sales/collection-links"],
  ["sale/CustomerPrices", "/sales/customer-prices"],
  ["sale/CommissionRules", "/sales/commission/rules"],
  ["sale/CommissionRecords", "/sales/commission/records"],
  ["sale/SalesReports", "/sales/reports"],
  ["instant-retail/InstantRetailDashboard", "/instant-retail/dashboard"],
  ["instant-retail/InstantRetailOrders", "/instant-retail/orders"],
  ["instant-retail/InstantRetailConfig", "/instant-retail/config"],
  ["instant-retail/InstantRetailShelf", "/instant-retail/shelf"],
  ["instant-retail/InstantRetailPickup", "/instant-retail/pickup"],
  ["instant-retail/InstantRetailPayment", "/instant-retail/payment"],
  ["instant-retail/InstantRetailDelivery", "/instant-retail/delivery"],
  ["instant-retail/InstantRetailReport", "/instant-retail/report"],
  ["instant-retail/InstantRetailPlatform", "/instant-retail/platform"],
  ["instant-retail/InstantRetailOrderBoard", "/instant-retail/order-board"],
  ["instant-retail/RetailAnnouncement", "/instant-retail/announcements"],
  ["instant-retail/InstantRetailSync", "/instant-retail/sync"],
  ["marketing/MarketingView", "/marketing"],
  ["marketing/MarketingTags", "/marketing/tags"],
  ["marketing/MarketingLimitedDiscount", "/marketing/limited-discount"],
  ["marketing/MarketingGiftRule", "/marketing/gift-rule"],
  ["marketing/MarketingPointsMall", "/marketing/points-mall"],
  ["marketing/MarketingDashboard", "/marketing/dashboard"],
  ["marketing/MarketingMaterial", "/marketing/materials"],
  ["marketing/CouponManage", "/marketing/coupon"],
  ["marketing/FlashSale", "/marketing/flash-sale"],
  ["marketing/FullReduction", "/marketing/full-reduction"],
  ["marketing/AftersaleView", "/aftersale"],
];
const VIEWPORTS = [
  { name: "1440x1000", width: 1440, height: 1000 },
  { name: "1024x768", width: 1024, height: 768 },
];
const BLACKLIST = ["双入口左侧菜单", "待接入", "未接入", "不伪造成功", "端点缺失", "设计说明", "红星商行", "张三", "¥25,400", "¥8,900"];

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ── 页面几何采集（页卡/表格/筛选/分页/弹层容器/横向溢出）── */
async function collectPageGeometry(page) {
  return page.evaluate((BL) => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const q = (sel) => document.querySelector(sel);
    const qa = (sel) => [...document.querySelectorAll(sel)];
    const pageEl = q(".page");
    const firstCard = q(".page .el-card");
    const tableWrap = q(".page .el-table");
    const filterBar = q(".page .filter-bar, .page .tab-toolbar, .page .stats-row, .page .board-grid");
    const pagination = q(".page .el-pagination");
    const dialog = qa(".el-dialog").map((d) => ({ title: (d.querySelector(".el-dialog__title") || {}).textContent || "", rect: rect(d) }));
    const drawer = qa(".el-drawer").map((d) => ({ rect: rect(d) }));
    return {
      viewport: { w: innerWidth, h: innerHeight },
      docScroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      // 门1 强制项：页头标题必须非空（空洞 ok:true 会被驳回）
      pageTitle: ((q(".page .page-title") || q(".page .page-header h2") || {}).textContent || "").trim(),
      bodyTextLen: document.body.innerText.trim().length,
      rects: {
        page: rect(pageEl),
        pageHeader: rect(q(".page .page-header")),
        firstCard: rect(firstCard),
        filterBar: rect(filterBar),
        table: rect(tableWrap),
        pagination: rect(pagination),
        statCards: qa(".page .stat-card, .page .metric-card").slice(0, 8).map(rect),
      },
      counts: {
        tables: qa(".page .el-table").length,
        dialogs: qa(".page .el-dialog").length,
        dialogsInDom: dialog.length,
        drawers: drawer.length,
        buttons: qa(".page button").length,
        tags: qa(".page .el-tag").length,
        progressBars: qa(".page .el-progress").length,
      },
      dialogsOpen: dialog,
      drawersOpen: drawer,
      blacklistHits: BL.map((w) => ({ word: w, count: document.body.innerText.split(w).length - 1 })).filter((x) => x.count > 0),
    };
  }, BLACKLIST);
}

/* ── 真实会话：demo-login 服务端签发（对齐阿坚先例 L41-44）── */
async function getDemoAuth(page) {
  const resp = await page.request.post(`${BACKEND}/api/admin/auth/demo-login`, { data: {} });
  if (resp.status() !== 200) throw new Error(`demo-login HTTP ${resp.status()}: ${(await resp.text()).slice(0, 200)}`);
  const j = await resp.json();
  const auth = j.data;
  if (!auth?.token) throw new Error("demo-login 未返回 token");
  summary.auth = { username: auth.user?.username, roles: auth.user?.roles, tokenChars: String(auth.token).length, demo: auth.demo === true };
  return auth;
}

/* ── 登录（保留供回退诊断；正式路径已改 demo-login）── */
async function login(page) {
  const netLog = [];
  page.on("response", (res) => {
    if (/\/api\//.test(res.url())) netLog.push({ url: res.url().replace(/^https?:\/\/[^/]+/, ""), status: res.status() });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(FRONTEND + "/login", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  const user = page.locator("input").first();
  await user.waitFor({ state: "visible", timeout: 15000 });
  await user.fill(SUPER_USER);
  await page.locator('input[type="password"]').fill(PW);
  // 登录页 form @submit.prevent，Enter 不提交；必须点 .login-submit 按钮
  await page.locator(".login-submit").click({ timeout: 8000 });
  await page.waitForTimeout(4500);
  if (page.url().includes("/login")) {
    await page.waitForTimeout(6000);
  }
  if (page.url().includes("/login")) {
    const msg = await page.evaluate(() => [...document.querySelectorAll(".el-message, .el-form-item__error")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 5));
    console.error("登录诊断 net=" + JSON.stringify(netLog));
    console.error("页面提示=" + JSON.stringify(msg));
    throw new Error("登录未跳转 url=" + page.url());
  }
  return true;
}

const summary = { ts: new Date().toISOString(), frontend: FRONTEND, backend: BACKEND, pages: {}, errors: [] };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  // 前端 request.ts 无 VITE_API_BASE 时打绝对 http://localhost:8080/api（跨源被 CORS 拦）。
  // 取证层把 8080 请求重写到同源 FRONTEND（vite 代理 /api → 8080），不改代码仓、不影响他人。
  await ctx.route("http://localhost:8080/**", async (route) => {
    const orig = route.request().url();
    const mapped = orig.replace(/^http:\/\/localhost:8080/, FRONTEND);
    await route.continue({ url: mapped });
  });
  const page = await ctx.newPage();
  // 真实会话：demo-login 服务端签发（NODE_ENV≠production 门控；门2 驳回先例禁止 CAP_JWT 注入 / alg:none 伪 JWT）
  const auth = await getDemoAuth(page);
  await ctx.addInitScript((a) => { try { localStorage.setItem("admin_auth", JSON.stringify({ token: a.token, user: a.user })); } catch (e) {} }, auth);
  log("demo-login 服务端真实签发成功（token 不落日志），开始逐页取证…");

  for (const [pageKey, routePath] of ROUTES) {
    summary.pages[pageKey] = {};
    for (const vp of VIEWPORTS) {
      const tag = `${pageKey} ${vp.name}`;
      let done = false;
      for (let attempt = 1; attempt <= 3 && !done; attempt += 1) {
        try {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(FRONTEND + routePath, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => summary.errors.push(`${tag} goto: ${e.message}`));
          // 等主容器真实渲染（旧口径固定 1.8s 会在慢页采到空白）
          await page.waitForSelector(".page", { state: "attached", timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(1200);
          const geo = await collectPageGeometry(page);
          geo.route = routePath;
          geo.finalUrl = page.url();
          geo.attempt = attempt;
          // 门1 强制项：finalUrl≠/login 且页头非空（空洞 ok:true 会被驳回）
          if (geo.finalUrl.includes("/login")) throw new Error("落到 /login（会话无效）");
          if (!geo.rects.page) throw new Error("主容器 .page 未渲染");
          if (!geo.pageTitle) throw new Error("页头标题为空（门1 强制项）");
          const shot = path.join(OUT, `${pageKey.replace("/", "-")}-${vp.name}.png`);
          await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
          geo.screenshot = path.basename(shot);
          fs.writeFileSync(path.join(OUT, `${pageKey.replace("/", "-")}-${vp.name}-geometry.json`), JSON.stringify(geo, null, 2));
          summary.pages[pageKey][vp.name] = {
            pageRect: geo.rects.page,
            firstCard: geo.rects.firstCard,
            table: geo.rects.table,
            horizontalOverflow: geo.horizontalOverflow,
            blacklistHits: geo.blacklistHits,
            counts: geo.counts,
            screenshot: geo.screenshot,
            finalUrl: geo.finalUrl,
          };
          log(`${tag} ✓ overflow=${geo.horizontalOverflow} tables=${geo.counts.tables}${attempt > 1 ? ` (retry ${attempt})` : ""}`);
          done = true;
        } catch (e) {
          const msg = String(e).slice(0, 200);
          if (attempt < 3 && /Execution context was destroyed|未渲染|Timeout/i.test(msg)) {
            log(`${tag} ↻ 第 ${attempt} 次失败重试：${msg.slice(0, 80)}`);
            await page.waitForTimeout(1200);
            continue;
          }
          summary.pages[pageKey][vp.name] = { error: msg };
          summary.errors.push(`${tag}: ${msg}`);
          log(`${tag} ✗ ${msg.slice(0, 120)}`);
          done = true;
        }
      }
    }
    // 逐页增量落盘：进程意外退出不丢已采几何
    fs.writeFileSync(path.join(OUT, "geometry-summary.json"), JSON.stringify(summary, null, 2));
  }
  await ctx.close();
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, "geometry-summary.json"), JSON.stringify(summary, null, 2));
const bad = Object.entries(summary.pages).filter(([, v]) => !v["1440x1000"]?.pageRect || !v["1024x768"]?.pageRect);
log(`DONE 27 页 × 2 视口，无有效几何页=${bad.length}，错误=${summary.errors.length} → ${OUT}`);
if (bad.length) log("无效页：" + bad.map(([k]) => k).join(", "));
process.exit(bad.length === 0 ? 0 : 1);
