/**
 * WORKBENCH-10-UIUX-PARITY-F1 · F 390px 窄视口断言
 *
 * 卡 §三.F 口径：390px 要有「底部或抽屉导航 + 单列主面 + 可用收银台」。
 * 原型是 1440 桌面稿，没有移动端布局 ⇒ 本组用例证明的是**不裁剪、可触达**这条底线：
 *   1. 断点只有一个真相源（wb-viewport.ts 的 390），三处 CSS 与它逐字一致；
 *   2. 窄口下壳层放弃三列（60+230=290px 固定列会把主面压到 100px）；
 *   3. rail 转底部横条、二级导航转左滑抽屉 + 遮罩，且抽屉默认收起；
 *   4. 收银台三列工作区转单列，购物车/支付方式仍可达；
 *   5. 传送带外（body 上的弹窗/抽屉/确认框）由 styles.css 收口，不再横向溢出。
 *
 * 运行（admin-web 目录）：node tests/wb-f-narrow.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (readCandidate(candidate)) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});
function readCandidate(url) {
  try {
    return readFileSync(fileURLToPath(url), "utf8").length >= 0;
  } catch {
    return false;
  }
}

const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

const viewportSrc = read("shared/workbench/wb-viewport.ts");
const shellSrc = read("layouts/WorkbenchShell.vue");
const cashierSrc = read("views/pos/CashierView.vue");
const globalCss = read("styles.css");

const {
  WB_NARROW_MAX_WIDTH_PX,
  WB_NARROW_MEDIA_QUERY,
  isNarrowViewport,
  desktopColumnsClip,
  DESKTOP_SIDE_COLUMNS_PX,
} = await import(new URL("file:///" + path.join(SRC, "shared/workbench/wb-viewport.ts").replace(/\\/g, "/")).href);

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

/** 取出 `@media (max-width: <px>px) {` 的整块（含大括号配平，注释与字符串里的括号忽略） */
function mediaBlock(text, maxWidth) {
  const marker = `@media (max-width: ${maxWidth}px) {`;
  const start = text.indexOf(marker);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start + marker.length - 1; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "/*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/* ── 1. 断点真相源 ── */
await run("断点真相源＝390px，媒体查询串与之同源", () => {
  assert.equal(WB_NARROW_MAX_WIDTH_PX, 390, "卡 §三.F 口径 390px");
  assert.equal(WB_NARROW_MEDIA_QUERY, "(max-width: 390px)");
  return "390 / (max-width: 390px)";
});

await run("isNarrowViewport 边界：390 含、391 不含、非法宽度不猜", () => {
  assert.equal(isNarrowViewport(390), true, "390 应判窄（含边界）");
  assert.equal(isNarrowViewport(391), false, "391 不应判窄");
  assert.equal(isNarrowViewport(1440), false);
  for (const bad of [null, undefined, 0, -390, Number.NaN]) {
    assert.equal(isNarrowViewport(bad), false, `${String(bad)} 必须按桌面处理，不做窄化猜测`);
  }
  return "390=true 391=false 非法=×6 全 false";
});

await run("桌面三列在 390px 确实会裁剪 ⇒ 降级有依据而非随意改版", () => {
  assert.equal(DESKTOP_SIDE_COLUMNS_PX, 290, "原型 rail 60 + side 230");
  assert.equal(desktopColumnsClip(390), true, "290px 固定列占 390px 视口 ≥50% ⇒ 主面只剩 100px");
  assert.equal(desktopColumnsClip(1440), false, "桌面视口不受影响");
  return "290/390=74% 主面仅剩 100px";
});

/* ── 2. 壳层窄口结构 ── */
await run("壳层媒体查询逐字等于真相源，且不自造断点数字", () => {
  assert.ok(
    shellSrc.includes('import { WB_NARROW_MEDIA_QUERY } from "../shared/workbench/wb-viewport";'),
    "壳层必须 import 断点常量供 matchMedia 使用",
  );
  assert.ok(/window\.matchMedia\(WB_NARROW_MEDIA_QUERY\)/.test(shellSrc), "matchMedia 必须用常量而非再打一遍数字");
  assert.ok(!/matchMedia\(["'`]?\(max-width/.test(shellSrc), "壳层不得出现硬编码的第二份 (max-width 查询串");
  const block = mediaBlock(shellSrc, WB_NARROW_MAX_WIDTH_PX);
  assert.ok(block, `壳层缺少 @media (max-width: ${WB_NARROW_MAX_WIDTH_PX}px) 块`);
  return "同源 1 处断点";
});

await run("窄口主面单列：三列与折叠态一律改覆盖，不留固定列宽", () => {
  const block = mediaBlock(shellSrc, 390);
  for (const selector of [".wb-shell,", ".wb-shell.side-hidden,", ".wb-shell.is-ai"]) {
    assert.ok(block.includes(selector), `窄口未覆盖 ${selector.slice(0, 22)}（折叠/信息流态仍会保留三列）`);
  }
  assert.ok(/grid-template-columns:\s*minmax\(0, 1fr\);/.test(block), "窄口必须把 grid 收成单列");
  assert.ok(!/230px|var\(--wb-side-w/.test(block), "窄口块内不应再出现桌面固定列宽");
  return "shell/side-hidden/is-ai 三态同覆 minmax(0,1fr)";
});

await run("一级导航降级为底部横条（卡面「底部或抽屉导航」之底部）", () => {
  const block = mediaBlock(shellSrc, 390);
  const rail = block.slice(block.indexOf(".wb-rail {"));
  assert.ok(/position:\s*fixed;/.test(rail) && /bottom:\s*0;/.test(rail), "rail 需固定在视口底部");
  assert.ok(/flex-direction:\s*row;/.test(rail), "rail 需由纵向改横向");
  assert.ok(/\.wb-main\s*\{[^}]*padding-bottom:\s*56px;/.test(block), "主面需留出底部条高度，否则末行内容被盖");
  assert.ok(/height:\s*56px;/.test(rail), "底部条高度须与主面留白同源（56px）");
  return "fixed bottom row + 主面 padding-bottom 56 = rail 56";
});

await run("二级导航降级为左滑抽屉 + 遮罩，默认收起", () => {
  const block = mediaBlock(shellSrc, 390);
  assert.ok(/transform:\s*translateX\(-100%\);/.test(block), "收起态需滑出视口");
  assert.ok(/\.wb-shell:not\(\.side-hidden\)\s*:deep\(\.wb-subnav\)\s*\{[^}]*translateX\(0\)/.test(block), "展开态需滑回");
  assert.ok(/width:\s*min\(320px, 86vw\);/.test(block), "抽屉宽度受视口约束，不能写死桌面 230/320");
  assert.ok(shellSrc.includes('data-testid="side-mask"'), "缺少抽屉遮罩节点");
  assert.ok(/v-if="isNarrow && !sideCollapsed"/.test(shellSrc), "遮罩只能窄口 + 展开时渲染");
  assert.ok(/applyNarrow\(narrowQuery\.matches\)/.test(shellSrc), "挂载时须按当前视口初始化，不能等 resize");
  assert.ok(/sideCollapsed\.value = narrow;/.test(shellSrc), "进入窄口默认收起，离开恢复常驻");
  assert.ok(/narrowQuery\?\.removeEventListener\("change", onNarrowChange\)/.test(shellSrc), "卸载须解绑，防泄漏");
  return "抽屉 + 遮罩 + 双向同步 + 卸载解绑";
});

/* ── 3. 收银台窄口 ── */
await run("收银台三列工作区在窄口转单列，购物车不再被整列裁掉", () => {
  const block = mediaBlock(cashierSrc, 390);
  assert.ok(block, "CashierView 缺少 390px 窄口块");
  const ws = block.slice(block.indexOf(".cashier-workspace {"));
  assert.ok(/grid-template-columns:\s*minmax\(0, 1fr\);/.test(ws), "工作区必须转单列");
  assert.ok(/height:\s*auto;/.test(ws), "单列纵向流不能再锁 100% 高");
  assert.ok(/\.product-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/.test(block), "商品区窄口转两列");
  assert.ok(/\.pay-methods,\s*\.cart-action-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/.test(block), "支付方式与动作区转两列");
  return "workspace 1 列 / 商品 2 列 / 支付 2 列";
});

/* ── 4. 传送带外弹层收口 ── */
await run("弹窗/抽屉/确认框在窄口统一收口（scoped 管不到 body 传送）", () => {
  const block = mediaBlock(globalCss, 390);
  assert.ok(block, "styles.css 缺少 390px 窄口块");
  assert.ok(/\.el-dialog\s*\{[^}]*width:\s*94vw\s*!important/.test(block), "el-dialog 固定 width= 属性需被视口宽度压制");
  assert.ok(/\.el-drawer[^{]*\{[^}]*width:\s*100vw\s*!important/.test(block), "抽屉窄口占满视口");
  assert.ok(/\.el-message-box\s*\{[^}]*width:\s*92vw\s*!important/.test(block), "确认框需随视口收窄");
  assert.ok(/max-height:\s*calc\(100vh - 190px\)/.test(block), "弹窗正文需可滚，不能顶出视口");
  return "dialog 94vw / drawer 100vw / msgbox 92vw";
});

await run("styles.css 引入顺序不被窄口改动破坏（暗色层仍晚于 tokens）", () => {
  const tokens = globalCss.indexOf('./styles/tokens.css"');
  const theme = globalCss.indexOf('./styles/wb-theme.css"');
  assert.ok(tokens >= 0 && theme > tokens, "wb-theme.css 必须晚于 tokens.css，否则同名 token 被浅色盖回");
  assert.equal(mediaBlock(globalCss, 600) === null, false, "既有 600px 断点不应被删");
  return "tokens → wb-theme → 窄口块（仅追加）";
});

await run("390 断点每处只写一次，且不嵌在别的媒体查询里", () => {
  const cssFiles = { "WorkbenchShell.vue": shellSrc, CashierView: cashierSrc, "styles.css": globalCss };
  for (const [name, text] of Object.entries(cssFiles)) {
    const hits = text.split("@media (max-width: 390px)").length - 1;
    assert.equal(hits, 1, `${name} 的 390 断点应恰好 1 处，实得 ${hits}`);
  }
  // 真相源是 TS，只出数字不携带 CSS（注释里引用查询串不算）
  assert.ok(!/^\s*@media/m.test(viewportSrc), "wb-viewport.ts 不应内嵌 CSS 规则");
  assert.ok(
    (globalCss.match(/@media \(max-width: (600|900|1200)px\)/g) || []).length >= 4,
    "既有 600/900/1200 断点不得被窄口改造删掉",
  );
  return "三处 CSS 各 1 处 390；真相源无 CSS；历史断点全留";
});

await run("窄口改造不引入假数据与演示态", () => {
  for (const [name, text] of Object.entries({ viewportSrc, shellSrc, cashierSrc })) {
    assert.ok(!/Math\.random\(/.test(text), `${name} 不得使用随机数填充`);
    assert.ok(!/红星商行|张三|王强/.test(text), `${name} 不得出现原型演示姓名/店名`);
  }
  assert.ok(!/position:\s*fixed[\s\S]{0,80}display:\s*none/.test(mediaBlock(shellSrc, 390)), "底部条不能用 display:none 假装存在");
  return "无随机数 / 无演示店名姓名";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
