/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · 增量复验 R10 菜单 fail-closed 四探针
 * 拦截 GET /api/admin/menus/user 返回 403/500/empty/unknown-code，验证：
 *  rail 常驻、菜单不回退全量（realEntries=0）、shell 存活、fail-closed 提示可见。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const API = "http://localhost:8080";
const FRONTEND = "http://localhost:5173";
const OUT = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01/incremental-20261112/runs";
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function demoLogin() {
  const r = await fetch(`${API}/api/admin/auth/demo-login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const j = await r.json();
  return j.data;
}

const PROBES = [
  { name: "403", status: 403, body: { code: "403", msg: "无权限" } },
  { name: "500", status: 500, body: { code: "500", msg: "服务器错误" } },
  { name: "empty", status: 200, body: { code: "0", msg: "成功", data: [] } },
  { name: "unknown-code", status: 200, body: { code: "0", msg: "成功", data: [{ id: 999, parentId: null, menuName: "未知菜单", menuCode: "UNKNOWN_XYZ_999", menuType: "MENU", path: "/unknown-xyz", sortNo: 1, status: 1 }] } },
];

const auth = await demoLogin();
const authData = { token: auth.token, user: { ...auth.user, csrfToken: auth.csrfToken } };
const results = { probes: {} };
const browser = await chromium.launch();
try {
  for (const probe of PROBES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    await ctx.addInitScript((d) => { try { localStorage.setItem("admin_auth", JSON.stringify(d)); } catch (e) {} }, authData);
    await page.route("**/api/admin/menus/user*", (route) => {
      route.fulfill({ status: probe.status, contentType: "application/json", body: JSON.stringify(probe.body) });
    });
    const rec = { probe: probe.name };
    try {
      await page.goto(FRONTEND + "/", { waitUntil: "networkidle", timeout: 30000 }).catch((e) => rec.gotoErr = String(e).slice(0, 160));
      await page.waitForTimeout(2000);
      rec.dom = await page.evaluate(() => {
        const q = (s) => document.querySelectorAll(s).length;
        const text = document.body ? document.body.innerText : "";
        const has = (kw) => text.includes(kw);
        return {
          path: location.pathname,
          shell: q('[data-testid="wb-shell"]') > 0,
          rail: q('[data-testid="rail"]'),
          secondNav: q('[data-testid="second-nav"]'),
          secondNavDirectory: q('[data-testid="second-nav-directory"]'),
          navItems: q('[data-testid="second-nav-directory"] a, [data-testid="second-nav-directory"] li, [data-testid="second-nav"] a'),
          menuEmptyVisible: has("暂无可显示的菜单") || has("菜单服务不可用"),
          failClosedHint: has("最小可见集") || has("不回退全量") || has("请重试或联系管理员"),
          fullMenuFallback: has("仪表盘") && has("营销") && has("商品") && has("库存"),
          bodyTextLen: text.length,
          sample: text.slice(0, 160),
        };
      });
      const shot = path.join(OUT, `r10-${probe.name}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      rec.screenshot = `r10-${probe.name}.png`;
    } catch (e) { rec.error = String(e).slice(0, 300); }
    await ctx.close();
    results.probes[probe.name] = rec;
    log("R10", probe.name, "shell=", rec.dom?.shell, "rail=", rec.dom?.rail, "navItems=", rec.dom?.navItems, "fullFallback=", rec.dom?.fullMenuFallback);
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT, "21-r10-failclosed.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
log("DONE R10");
