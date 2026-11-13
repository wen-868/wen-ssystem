/**
 * PAGES-SYSTEM-OPERATIONS-01 门2 R3 驳回补拍（仅 /employees 两视口）
 *
 * R3 驳回点：仅 visibleRows>0 不证明关键列可读——
 *  1440 角色列被白色悬浮层（fixed 列粘性渲染）遮挡；1024 页头逐字竖排、表格只露 ID/操作列。
 * R3 补拍口径（门2 终审逐条）：
 *  1. 先切业务视图（壳层 localStorage wb.shell.mode=human / 点「切换人工操作台」）再截图；
 *  2. fail-closed 断言：5 个关键列（用户名/姓名/手机号/角色/操作）逐列核验
 *     offsetWidth>0 + visibility=visible + getBoundingClientRect 与视口相交，
 *     不满足重试（最多 3 次），仍不满足退出码 3 不入账；
 *  3. 1024 允许表格容器横向滚动，但须证明滚动容器存在且所有关键列滚动后可达；
 *  4. 页头标题不得逐字竖排（标题行高须为正常单行/正常换行高度）。
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
// SPA 首屏可能异步跳转，等路由稳定后再在页面内取真实会话（最多 3 次）
await lp.waitForTimeout(900).catch(() => {});
let login = null;
for (let i = 0; i < 3; i++) {
  try {
    login = await lp.evaluate(async () => {
      const r = await fetch("/api/admin/auth/demo-login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, token: j?.data?.token || null, user: j?.data?.user || null };
    });
    break;
  } catch (e) {
    console.log(`login attempt ${i + 1}: ${String(e.message).slice(0, 90)}`);
    await lp.waitForTimeout(900).catch(() => {});
  }
}
if (!login) { console.error("REAL_LOGIN_FAILED (context destroyed 3x)"); await browser.close(); process.exit(2); }
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

  // 断言：员工表格行 + 5 个关键列逐列可见可读（fail-closed，最多重试 3 次）
  const KEY_COLS = ["用户名", "姓名", "手机号", "角色", "操作"];
  let visible = false, attempts = 0, lastChecks = null;
  for (; attempts < 3; attempts++) {
    visible = await page.evaluate((keyLabels) => {
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
      // 横向滚动容器（Element Plus 用 el-scrollbar__wrap 承载 scrollWidth）
      const scrollWrap = document.querySelector(".el-table__body-wrapper .el-scrollbar__wrap")
        || document.querySelector(".el-table__body-wrapper");
      const clip = scrollWrap ? scrollWrap.getBoundingClientRect() : { left: 0, right: window.innerWidth };
      const scrollable = scrollWrap ? scrollWrap.scrollWidth > scrollWrap.clientWidth + 1 : false;
      const maxScroll = scrollWrap ? Math.max(0, scrollWrap.scrollWidth - scrollWrap.clientWidth) : 0;
      // 逐列滚动探针：把该列滚入容器可见区，验证「所有列可滚动访问」，随后复位
      const reach = (el) => {
        if (!scrollWrap || !scrollable) return { ok: null, reason: "no-scroll" };
        const before = el.getBoundingClientRect();
        let target = scrollWrap.scrollLeft;
        if (before.right > clip.right) target += before.right - clip.right + 8;
        else if (before.left < clip.left) target -= clip.left - before.left + 8;
        target = Math.max(0, Math.min(maxScroll, target));
        scrollWrap.scrollLeft = target;
        const after = el.getBoundingClientRect();
        const ok = after.width > 0 && after.height > 0 && after.left >= clip.left - 2 && after.right <= clip.right + 2;
        scrollWrap.scrollLeft = 0;
        return { ok, scrolledTo: Math.round(target), beforeLeft: Math.round(before.left), afterLeft: Math.round(after.left) };
      };
      const headerCells = [...document.querySelectorAll(".el-table__header-wrapper th")];
      const keyCols = keyLabels.map((label) => {
        const th = headerCells.find((h) => (h.textContent || "").trim() === label);
        if (!th) return { label, found: false, ok: false };
        const thBox = th.getBoundingClientRect();
        // body 内同 index 列
        const thIndex = headerCells.indexOf(th);
        const firstRow = document.querySelector(".el-table__body tr");
        const tds = firstRow ? [...firstRow.children] : [];
        const td = tds[thIndex];
        const el = td || th;
        const box = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        const readWidth = Math.min(thBox.width, box.width);
        const inView = box.width > 0 && box.height > 0 && box.top < window.innerHeight && box.bottom > 0 && box.left < window.innerWidth && box.right > 0;
        const inClip = box.left >= clip.left - 2 && box.right <= clip.right + 2;
        // 滚动可达：当前已在可见区，或滚动后证明可达
        const probe = reach(el);
        const reachable = inClip || probe.ok === true;
        const ok = el.offsetWidth > 0 && st.visibility === "visible" && inView && reachable && (!td || (td.offsetWidth > 0 && getComputedStyle(td).visibility === "visible"));
        return { label, found: true, ok, offsetWidth: el.offsetWidth, visibility: st.visibility, inView, inClip, reachable, scrollProbe: probe, readWidth: Math.round(readWidth) };
      });
      // 页头标题不逐字竖排：标题 span 高度应 ≤ 2 行正常行高（竖排时高>宽且逐字换行）
      const titleEl = [...document.querySelectorAll(".card-header > span, .card-header span")].find((s) => (s.textContent || "").trim() === "员工管理");
      let titleOk = true, titleBox = null;
      if (titleEl) {
        titleBox = titleEl.getBoundingClientRect();
        titleOk = !(titleBox.height > titleBox.width * 1.2 && titleBox.width < 40);
      }
      const keyColsOk = keyCols.every((c) => c.found && c.ok);
      return { visibleRows, totalRows: rows.length, bannerBig, isAi, keyCols, keyColsOk, titleOk, titleBox: titleBox ? { w: Math.round(titleBox.width), h: Math.round(titleBox.height) } : null,
        scrollable, maxScroll, clip: { left: Math.round(clip.left), right: Math.round(clip.right), width: Math.round(clip.right - clip.left) },
        ok: visibleRows > 0 && !isAi && keyColsOk && titleOk };
    }, KEY_COLS);
    if (visible.ok) break;
    // 尝试再切一次 + 滚动表格入视口
    await page.evaluate(() => { localStorage.setItem("wb.shell.mode", "human"); });
    const btn = page.locator('[data-testid="ai-fault-banner"] button');
    if (await btn.count().catch(() => 0)) await btn.first().click().catch(() => {});
    // R3：若关键列不可读而滚动可达，横向滚动表格容器让列进入视口后再断言
    await page.evaluate(() => {
      document.querySelectorAll(".el-table__body-wrapper, .el-table__header-wrapper").forEach((w) => { w.scrollLeft = 0; });
    });
    await page.locator(".el-table__body").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1200);
  }
  lastChecks = visible;

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

  // 截图前复位横向滚动到起始位置（滚动探针只在读数阶段使用）
  await page.evaluate(() => {
    document.querySelectorAll(".el-table__body-wrapper .el-scrollbar__wrap, .el-table__body-wrapper").forEach((w) => { w.scrollLeft = 0; });
  });
  await page.waitForTimeout(250);

  const shot = path.join(OUT, `_employees.${vp.tag}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  const stateKind = m.tableRows > 0 ? "data" : (m.hasEmpty ? "empty" : "other");
  // visualKind：视觉呈现归属（门2 口径命名）
  //  - manual-console：人工操作台视图（wb.shell.mode=human，无 AI 壳层遮挡），且目标页主体在视口内可见 ⇒ 合格
  //  - ai-shell-blocked：仍处 AI 壳层（is-ai + 故障 banner 占主区）⇒ 遮挡，不合格
  //  - not-visible：既非 AI 壳层但表格行仍不在视口内 ⇒ 不可见，不合格
  const bodyVisible = m.visibleRows > 0 && !m.isAiShell;
  const visualKind = m.isAiShell ? "ai-shell-blocked" : (bodyVisible ? "manual-console" : "not-visible");
  // R3：关键列可读 + 页头不竖排 也必须成立，否则视作 not-visible（fail-closed）
  const keyColsOk = !!(visible && visible.keyColsOk && visible.titleOk);
  out.viewports.push({
    vp: vp.tag, finalUrl: page.url(), geom: { w: vp.w, h: vp.h },
    tableRows: m.tableRows, visibleRows: m.visibleRows,
    stateKind, visualKind: keyColsOk ? visualKind : "not-visible",
    keyCols: visible ? visible.keyCols : null,
    keyColsOk, titleOk: visible ? visible.titleOk : false,
    titleBox: visible ? visible.titleBox : null,
    scrollable: visible ? visible.scrollable : false,
    maxScroll: visible ? visible.maxScroll : 0,
    clip: visible ? visible.clip : null,
    isAiShell: m.isAiShell, hasFaultBanner: m.hasFaultBanner,
    header: m.header, textLen: m.textLen,
    attempts: attempts + 1, screenshot: path.basename(shot),
    consoleErrors: consoleErr.slice(0, 3),
  });
  console.log(`[${vp.tag}] rows=${m.tableRows} visibleRows=${m.visibleRows} isAiShell=${m.isAiShell} stateKind=${stateKind} visualKind=${keyColsOk ? visualKind : "not-visible(keyCols/title fail)"} keyColsOk=${keyColsOk} titleOk=${visible ? visible.titleOk : "-"} scrollable=${visible ? visible.scrollable : "-"} maxScroll=${visible ? visible.maxScroll : "-"} attempts=${attempts + 1}`);
  if (visible && visible.keyCols) {
    for (const c of visible.keyCols) console.log(`  col ${c.label}: found=${c.found} ok=${c.ok} offsetWidth=${c.offsetWidth} visibility=${c.visibility} inView=${c.inView} inClip=${c.inClip} reachable=${c.reachable} readWidth=${c.readWidth} scrollProbe=${JSON.stringify(c.scrollProbe)}`);
  }
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "capture-employees-refix.json"), JSON.stringify(out, null, 2), "utf8");
const allOk = out.viewports.every((v) => v.visualKind === "manual-console" && v.keyColsOk && v.titleOk);
console.log(`\nSUMMARY viewports=${out.viewports.length} allDataVisible=${allOk}`);
process.exit(allOk ? 0 : 3);

