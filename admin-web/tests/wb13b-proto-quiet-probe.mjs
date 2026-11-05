/**
 * WB13B-A2 前置实探：原型融合版加载后 45s 内的「活跃模态 / 首页面板 / 信息流面」时间线。
 * 目的：确定逐模块真实点击导航可用的静默窗口（不注入、不改原型脚本，只读 + 真实点击）。
 * 用法：node tests/wb13b-proto-quiet-probe.mjs [seconds]
 */
import { chromium } from "playwright";

const PROTO = process.env.WB13_PROTOTYPE ?? "D:/Users/ZXQL/ZXQL-WORK/projects/ai/design/智享全链_工作台电脑端_UI原型_融合版.html";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SECONDS = Number(process.argv[2] ?? 45);

const MODAL_SELECTORS = [".mask", "#setwin", "#sDlg", "#etWin", ".dlg", ".modal", "[class*=mask]"];

const SNAP = () => {
  const D = document;
  const t = Math.round(performance.now());
  const actives = [];
  const seen = new Set();
  for (const sel of ["#setwin", "#sDlg", "#etWin", ".mask", ".dlg", ".mdl", "#alertMask"]) {
    for (const el of D.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.05 && st.pointerEvents !== "none" && r.width > 40 && r.height > 40) {
        actives.push(el.id || String(el.className).slice(0, 24));
      }
    }
  }
  const view = D.getElementById("wbView");
  const desk = D.querySelector("nav.rail .rl-it[data-rk='desk']");
  return {
    t,
    modals: actives,
    wbShow: !!view && view.classList.contains("show"),
    wbTab: window.WB_TAB ?? null,
    wbBodyChildren: D.getElementById("wbBody")?.children.length ?? 0,
    wbBodyTextLen: (D.getElementById("wbBody")?.innerText ?? "").length,
    curMod: window.CUR_MOD ?? null,
    mainMode: window.mainMode ?? null,
    deskOn: !!desk && desk.classList.contains("on"),
    deskAlert: !!desk && desk.classList.contains("alert"),
    subCards: D.querySelectorAll("#subZone .sub-card").length,
    railOn: [...D.querySelectorAll("nav.rail .rl-it.on")].map((e) => e.getAttribute("data-rk")),
  };
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await page.goto(`file:///${PROTO.replace(/\\/g, "/")}`, { waitUntil: "domcontentloaded" });
const rows = [];
for (let ms = 0; ms <= SECONDS * 1000; ms += 500) {
  rows.push(await page.evaluate(SNAP).catch((e) => ({ err: String(e).slice(0, 60) })));
  await page.waitForTimeout(500);
}
console.log("秒\t模态\twbShow\tWB_TAB\tbody子\tbody字\tCUR_MOD\tmainMode\trailOn\t副卡");
for (const r of rows) {
  if (!r) continue;
  console.log(
    [
      (r.t / 1000).toFixed(1),
      (r.modals ?? []).join("|") || "0",
      r.wbShow,
      r.wbTab,
      r.wbBodyChildren,
      r.wbBodyTextLen,
      r.curMod,
      r.mainMode,
      (r.railOn ?? []).join("+"),
      r.subCards,
    ].join("\t"),
  );
}
await browser.close();
