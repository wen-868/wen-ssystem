/**
 * WB13B-A2 前置实探 v2：静默窗口内，用**真实点击**（Playwright 点元素）驱动原型
 * rail 一级模块 → 二级卡 → 页面面板，确认逐模块并排采集在 1440×1000 / 1024×768 都能落地。
 * 只读 + 真实点击，绝不注入 class/style、绝不直接调用内部函数伪造状态。
 * 用法：node tests/wb13b-proto-click-probe.mjs
 */
import { chromium } from "playwright";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium: cr } = require("playwright");

const PROTO = process.env.WB13_PROTOTYPE ?? "D:/Users/ZXQL/ZXQL-WORK/projects/ai/design/智享全链_工作台电脑端_UI原型_融合版.html";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = `file:///${PROTO.replace(/\\/g, "/")}`;

const SNAP = () => {
  const D = document;
  const view = D.getElementById("wbView");
  const body = D.getElementById("wbBody");
  const head = D.querySelector("#wbView .wb-hd");
  const desk = D.querySelector("nav.rail .rl-it[data-rk='desk']");
  const on = [...D.querySelectorAll("nav.rail .rl-it.on")].map((e) => e.getAttribute("data-rk"));
  const cards = [...D.querySelectorAll("#subZone .sub-card")].map((c) => c.textContent.trim());
  const actives = [];
  for (const el of D.querySelectorAll("#setwin,#sDlg,#etWin,.mask,.dlg,.mdl,#alertMask")) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.05 && st.pointerEvents !== "none" && r.width > 40 && r.height > 40) {
      actives.push(el.id || String(el.className).slice(0, 20));
    }
  }
  return {
    t: Math.round(performance.now()),
    modals: actives,
    wbShow: !!view && view.classList.contains("show"),
    wbTab: window.WB_TAB ?? null,
    headText: (head?.innerText ?? "").replace(/\s+/g, " ").slice(0, 60),
    bodyChildren: body?.children.length ?? 0,
    bodyTextLen: (body?.innerText ?? "").length,
    bodyKpis: !!body?.querySelector(".wb-kpis"),
    bodyTableRows: body?.querySelectorAll("table tbody tr").length ?? 0,
    bodyPanelCls: body ? [...body.firstElementChild?.classList ?? []].join(".").slice(0, 40) : "",
    qkTitle: D.querySelector("#subZone .qk-t")?.textContent ?? null,
    subCards: cards,
    railOn: on,
    deskOn: !!desk && desk.classList.contains("on"),
    deskAlert: !!desk && desk.classList.contains("alert"),
    scrollW: D.documentElement.scrollWidth,
    clientW: D.documentElement.clientWidth,
  };
};

const TARGETS = [
  { railKey: "sale", label: "销售管理", card: "销售单据" },
  { railKey: "report", label: "数据报表", card: "经营分析" },
  { railKey: "system", label: "系统管理", card: "打印模板" },
];

const browser = await cr.launch({ executablePath: CHROME, headless: true });
for (const vp of [
  { id: "1440x1000", width: 1440, height: 1000 },
  { id: "1024x768", width: 1024, height: 768 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4200);
  console.log(`\n######## ${vp.id} 静默后基线 ${JSON.stringify(await page.evaluate(SNAP))}`);
  for (const t of TARGETS) {
    await page.locator(`nav.rail .rl-it[data-rk='${t.railKey}']`).first().click({ timeout: 5000 });
    await page.waitForTimeout(400);
    const afterRail = await page.evaluate(SNAP);
    const idx = afterRail.subCards.findIndex((c) => c === t.card || c.includes(t.card));
    let afterCard = null;
    if (idx >= 0) {
      await page.locator("#subZone .sub-card").nth(idx).click({ timeout: 5000 });
      await page.waitForTimeout(500);
      afterCard = await page.evaluate(SNAP);
    }
    console.log(`--- ${t.label} / ${t.card} ---`);
    console.log(`rail后: railOn=${afterRail.railOn} qk=${afterRail.qkTitle} cards=${afterRail.subCards.length} 模态=${afterRail.modals.length}`);
    console.log(`卡命中 idx=${idx} 卡名=${afterRail.subCards[idx] ?? "∅"}`);
    console.log(`点后: ${afterCard ? JSON.stringify({ wbShow: afterCard.wbShow, tab: afterCard.wbTab, head: afterCard.headText, kids: afterCard.bodyChildren, len: afterCard.bodyTextLen, kpis: afterCard.bodyKpis, rows: afterCard.bodyTableRows, panel: afterCard.bodyPanelCls, modals: afterCard.modals }) : "未点到卡"}`);
  }
  console.log(`pageerror=${errs.length ? errs.join(" | ") : "无"}`);
  await ctx.close();
}
await browser.close();
