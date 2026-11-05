/**
 * WORKBENCH-13B · 390×844 窄口回归契约测试（D 组，卡 §三.D.15/16/17/18 + §六）
 *
 * 40 条用例，只读四类真源，不启服务、不碰 DOM ⇒ clean 检出即可复现（与 A/B/C 组同一自包含口径）：
 *   1. `tests/fixtures/wb13b-narrow-390.json` —— 真实浏览器 390 窄口采集的仓内副本（由 tests/wb13b-narrow-390.mjs 写入）
 *   2. `src/styles/tokens.css` + `src/layouts/WorkbenchShell.vue` + `src/shared/workbench/wb-viewport.ts` —— 焦点环 / 断点 / 窄壳结构
 *   3. `tests/wb13b-narrow-390.mjs` —— 采集器自身的阈值与门禁词汇表（守住「只改测试夹具不改实现」这条红线）
 *   4. `src/styles.css` + `src/views/pos/CashierView.vue` —— 画布语法段与收银台窄口视图：聚焦态口径、≤390 换行（N33/N35 守）
 *
 * 为什么这一组用例必须存在（卡面原文）：
 *   §三.D.15 主验收 1440×1000 / 1024×768，390×844 作窄口回归 ⇒ **无横向裁切**且抽屉/弹层/主操作可用；
 *   §三.D.16 键盘焦点、按钮语义、对比度、触控命中区**不得因视觉对齐退步**；
 *   §三.D.17 F3 已通过的一级 12 项、二级顺序、圆形新对话、通知、确认框、**390 鼠标/触摸抽屉**必须保持。
 *   A/B/C 三段把 1440/1024 的「形」钉住了，但 13B 的取色、尺寸、状态改造同样落在 390 档上；
 *   没有这组用例，「窄口没被压坏」就只是一句主张。基线复算（Explore 逐条点名）：既有 79 条 13B 用例里
 *   390/键盘焦点/对比度/触控命中区**零覆盖** ⇒ 本组就是 §三.D.18「新增 ≥24 条」的 D 组部分。
 *
 * 分块假红的收口口径（C 段刚踩过的坑，这里反过来用）：采集器逐块跑时**不拿「本块没跑到的模块」判红**，
 * roster 只落成发现项；「12 个模块（11 业务 + 收银台）必须全部入档」由 N3 在收口时硬判。
 *
 * 两条判据升级（首轮 390 采到 10 条红，逐条复算后只有 6 条是真的）：
 *   · 焦点环不能只看 activeElement 自身 outline —— Element Plus 把环画在包装层 box-shadow，
 *     因此判据改为「自身 outline ∪ 聚焦/失焦逐节点样式差」（N20/N31），并保留「只有常驻 shadow」
 *     的宽松度披露（focus-ring-shadow-unverified）。筛选栏 input/select、AI 输入 textarea 那批红
 *     复算后是采集器误判（包装层聚焦态描边 #ECEEF1→#2563EB 确实变了）；但分页「每页条数 / 跳至」
 *     两条在升级后仍 changedCount=0 ⇒ 那是**真的视觉对齐退步**：画布把 `.el-pagination` 控件钉成
 *     `box-shadow: none` + 静态描边，而 EP 的 `.el-input__inner{outline:none}` 压过全局 `:focus-visible`，
 *     聚焦后零变化。已在 styles.css 补回聚焦态（N33 守），不许把这条红说成误判。
 *   · 出视口 ≠ 不可用 —— 分页钮落在首屏下方由纵向滚动可达，属正常长页；判红只留给「任何可滚祖先
 *     都带不进视口」的硬越界（N19），滚得到的记发现项。
 *   · 「再收=false」≠ 收起按钮坏了 —— 12 个模块全挂同一条读数，复算源结构才看清：≤390 抽屉展开时
 *     `.wb-subnav` 是 fixed/z-index:45/width min(320px,86vw)，把顶部 header 的 side-toggle 整颗压在
 *     下面（遮罩 z44 也在其下），拿抽屉收起时的旧坐标盲点第二下落到的是一张抽屉面板空白（实测
 *     落点 topEl=span.sn-logo）。收腿前必须逐钮 elementFromPoint 命中测试（N13 四段 + N37 源结构）：
 *     改点展开态可见的抽屉头部 second-nav-collapse，命中可点却收不掉＝真缺陷判红，两颗钮都不可达＝
 *     置 null + drawer-close-control-unreachable 发现项（关闭由遮罩腿证明，属 F3 壳层层级口径）；
 *     收银台同样补齐四段（钮开 ⇒ 遮罩收 ⇒ 钮重开 ⇒ 收起钮收），不再豁免关闭证据。
 *   真实的产品缺陷是底部横条：`.wb-rail` 在 ≤390 写成 `overflow: hidden auto`，13 个一级条目横向
 *   溢出 ~210px 却滚不动 ⇒ 右侧入口被裁死。修复方向 = 横向可滚，且横条豁免必须有**真实 wheel 手势**
 *   证据（N23 源结构 + N32 读数），脚本写 scrollLeft 属注入态，禁止。
 *   · 「越界读数 0」曾经是靠切片假出来的 —— 采集器把 offenders 截到 40 格再判门禁，而 railScroller
 *     与离屏抽屉两桶常年占满这 40 格，真正的页级裁切（inventory 表头 10 个）躲在 DOM 后面 ⇒ 假绿。
 *     现在门禁只读全量 pageOffenders（N38），Element Plus 那类 `overflow-x:hidden` 的同步容器要豁免，
 *     必须同时给出「分档真实横滚把容器滚起来」+「逐元素几何可达」两条证据（N39）；带不到位的
 *     （列比视口还宽、找不到同一控件的横滚容器）一律回到 narrow-overflow 红。豁免只说明「内容没丢、
 *     要横滚才看得到」，报告必须逐组点名披露，不许把豁免说成 390 下不用横滚。
 *   · 分块合并自己也会造假：roster-incomplete 是全局项（moduleKey=null），逐块各写一条，跑齐后前面三块
 *     的老账还留在档里，把「已齐」说成「还缺 9 个」（v6 实测 3 条）⇒ 合并端丢弃、按全量重算，N3 双向钉；
 *     同理，每块自起一遍后端+vite、端口每次现换，而 scope.origin 只描述最后一块，拿它套全档等于拿别人的
 *     服务冒充自己的（v6 的 N6 假红）⇒ 逐条记录必须自带 captureOrigin/端口并与自身 URL 对齐，
 *     缺项由采集器判 record-incomplete（N6 逐条同源 + N40 来路口径）。
 *
 * 对比度冲突（N26/N28，本组最重要的诚实点）：13B 依原型把二级文字取色从基线 `#333333`（同底色 12.09:1）
 * 换成 ink2 `#8A8F98`（画布底色实测 3.11:1 / 3.25:1），在 11px 层级跌破 WCAG AA 4.5:1 ⇒ §三.A「与原型取色一致」与 §三.D.16
 * 「对比度不得退步」在同一处文字上对撞。本组**不软化红**：`contrast-regression` 必须仍在档，且每条红都要
 * 在 `deviations` 台账里点名（比值、选择器、基线比值、owner、裁定路径）。当场改色抹平＝推翻 §三.A 已定档的
 * 104 对并排证据，属卡 §六 红线，禁止。
 *
 * 运行（admin-web 目录）：node tests/wb13b-narrow-390.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const FIX = path.join(here, "fixtures", "wb13b-narrow-390.json");
const RAIL_FIX = path.join(here, "fixtures", "workbench-prototype-rail.json");
/* 磁盘是 CRLF（autocrlf），跨行正则必须先看换行符 ⇒ 读入即归一，否则块级匹配会假红 */
const read = (p) => readFileSync(p, "utf8").replace(/\r\n?/g, "\n");
const TOKENS = read(path.join(WEB, "src/styles/tokens.css"));
const STYLES = read(path.join(WEB, "src/styles.css"));
const CASHIER = read(path.join(WEB, "src/views/pos/CashierView.vue"));
const SHELL = read(path.join(WEB, "src/layouts/WorkbenchShell.vue"));
const VIEWPORT_TS = read(path.join(WEB, "src/shared/workbench/wb-viewport.ts"));
const HARNESS = read(path.join(here, "wb13b-narrow-390.mjs"));

const BUNDLE = existsSync(FIX) ? JSON.parse(readFileSync(FIX, "utf8")) : null;
const RECORDS = BUNDLE?.records ?? [];
const VIOLATIONS = BUNDLE?.violations ?? [];
const GAPS = BUNDLE?.gaps ?? [];
const FINDINGS = BUNDLE?.findings ?? [];
const DEVIATIONS = BUNDLE?.deviations ?? [];
const ROWS = BUNDLE?.summary?.perModule ?? [];

/** 卡 §三.D 的模块口径：11 个业务模块 + 收银台，一个都不能少 */
const BUSINESS = ["sale", "order", "purchase", "inventory", "customer", "product", "retail", "finance", "report", "marketing", "system"];
const ROSTER = [...BUSINESS, "pos"];

const results = [];
async function run(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e.message });
    console.log(`FAIL  ${name}  ← ${e.message}`);
  }
}
/** 证据缺席一律判红（fail-closed）：不许「没采到」被读成「没问题」 */
function needBundle() {
  assert.ok(BUNDLE, `仓内证据副本缺失：${path.relative(WEB, FIX)} 不存在 ⇒ 先跑 node tests/wb13b-narrow-390.mjs（分块 4 轮），不许拿「还没采」当通过`);
  return BUNDLE;
}
const recOf = (k) => RECORDS.filter((r) => r.moduleKey === k);
const rowOf = (k) => ROWS.find((r) => r.moduleKey === k) ?? {};
const vOf = (kind) => VIOLATIONS.filter((v) => v.kind === kind);
const fOf = (kind) => FINDINGS.filter((f) => f.kind === kind);
/** 逐模块不变量：把断言摊到 12 个模块上，任何一块缺失或越线都点名（§三.D.18 要求覆盖代表页，不是抽查） */
function eachModule(label, pick) {
  const bad = [];
  for (const k of ROSTER) {
    const rs = recOf(k);
    if (!rs.length) {
      bad.push(`${k}：无记录`);
      continue;
    }
    for (const r of rs) {
      const msg = pick(r, k);
      if (msg) bad.push(`${k}/${r.pageKey}：${msg}`);
    }
  }
  assert.equal(bad.length, 0, `${label} 未过 ⇒ ${bad.join(" ｜ ")}`);
  return `${ROSTER.length} 个模块全过（${ROSTER.join(",")}）`;
}

/* ══════════ 甲 · 证据口径与自包含（卡 §六 红线） ══════════ */

await run("N1 仓内证据副本存在、schema 与卡面口径对得上（§三.D.15）", () => {
  needBundle();
  assert.equal(BUNDLE.schema, "wb13b-narrow-390/v1", `schema=${BUNDLE.schema} 非 wb13b-narrow-390/v1`);
  assert.match(BUNDLE.card, /三\.D\.15\/16\/17/, "card 段没写明 §三.D.15/16/17 ⇒ 证据不知道自己在证什么");
  assert.deepEqual(BUNDLE.scope.viewport, "390x844", `视口 ${BUNDLE.scope.viewport} ≠ 390x844（窄口回归档位）`);
  assert.equal(BUNDLE.redLines.length >= 3, true, "redLines 必须带着卡 §六 三条原文入库");
  return `记录 ${RECORDS.length} 条 · 违规 ${VIOLATIONS.length} 条 · 生成 ${BUNDLE.generatedAt}`;
});

await run("N2 采集未被中止且端口自停（半途而废的证据不算证据）", () => {
  needBundle();
  assert.equal(BUNDLE.summary.aborted, null, `采集中止：${String(BUNDLE.summary.aborted).slice(0, 160)}`);
  assert.equal(BUNDLE.summary.portsClean, true, `端口收尾未清理（portsClean=${BUNDLE.summary.portsClean}）⇒ 自起自停契约破了，现场不可复现`);
  return `aborted=null · portsClean=true · ${BUNDLE.scope.backendPort}/${BUNDLE.scope.webPort} 已 DOWN`;
});

await run("N3 12 个模块（11 业务 + 收银台）全部入档，逐块假红由收口硬判（§三.D.18）", () => {
  needBundle();
  const missing = ROSTER.filter((k) => !recOf(k).length);
  const stale = fOf("roster-incomplete");
  /* roster-incomplete 必须由「合并后的全量 roster」重算：分块各自往档里追加，跑齐后还留着前面几块的老账，
     就是把已齐说成「还缺 9 个」（v6 实测 3 条陈谎）。跑齐 ⇒ 0 条；没跑齐 ⇒ 恰好 1 条且点名与真实缺失逐字一致。 */
  if (missing.length) {
    assert.equal(stale.length, 1, `缺模块 ${missing.join("/")} 时应当只有 1 条重算后的 roster-incomplete，实际 ${stale.length} 条 ⇒ 分块追加没被合并端清理`);
    const claimed = [].concat(stale[0]?.detail?.missing ?? []);
    assert.deepEqual([...claimed].sort(), [...missing].sort(), `roster-incomplete 点名的缺失模块 ${claimed.join("/")} 与真实缺失 ${missing.join("/")} 不一致 ⇒ 陈谎或漏报`);
  } else {
    assert.equal(stale.length, 0, `roster 已齐但还留着陈旧的 roster-incomplete 发现项：${stale.map((f) => JSON.stringify(f.detail?.missing)).join("；")}`);
  }
  assert.match(HARNESS, /keptFind = keptFind\.filter\(\(f\) => f\.kind !== "roster-incomplete"\);/, "合并端不再丢弃陈旧 roster-incomplete ⇒ 分块跑齐后收口无从判齐");
  assert.deepEqual(missing, [], `缺模块 ${missing.join("/")} ⇒ 分块没跑完；采集器只写发现项（roster-incomplete=${stale.length} 条），收口必须判红`);
  const extra = [...new Set(RECORDS.map((r) => r.moduleKey))].filter((k) => !ROSTER.includes(k));
  assert.deepEqual(extra, [], `出现卡面范围外的模块 ${extra.join("/")} ⇒ 别的在办任务文件混进了本分支的证据`);
  return `${ROSTER.length}/12 入档 · 每模块记录数 ${ROSTER.map((k) => recOf(k).length).join("/")}`;
});
await run("N4 口径钉死：视口 390×844 + hasTouch + deviceScaleFactor=1，逐条一致", () => {
  needBundle();
  return eachModule("窄口运行口径", (r) => {
    if (r.viewport !== "390x844") return `viewport=${r.viewport}`;
    if (r.hasTouch !== true) return "hasTouch≠true（触摸抽屉腿必须有触摸能力上下文）";
    if (r.deviceScaleFactor !== 1) return `deviceScaleFactor=${r.deviceScaleFactor}`;
    return null;
  });
});

await run("N5 一页一帧、帧 SHA 全局唯一、命名可追溯（不许拿别人的图冒充采集）", () => {
  needBundle();
  const withFrame = RECORDS.filter((r) => r.frame);
  assert.equal(withFrame.length, RECORDS.length, `出帧 ${withFrame.length} < 记录 ${RECORDS.length} ⇒ 有模块没留下一张可复核的截图`);
  const bySha = new Map();
  for (const r of withFrame) bySha.set(r.frame.sha256, [...(bySha.get(r.frame.sha256) ?? []), r.captureKey]);
  const dupes = [...bySha.entries()].filter(([, ks]) => ks.length > 1);
  assert.equal(dupes.length, 0, `复用帧：${dupes.map(([, ks]) => ks.join("＝")).join(" ｜ ")} ⇒ 「每模块一页一帧」未满足`);
  assert.deepEqual(BUNDLE.summary.reusedFrames, [], `summary.reusedFrames 非空：${JSON.stringify(BUNDLE.summary.reusedFrames).slice(0, 200)}`);
  for (const r of withFrame) assert.equal(r.frame.file, `shots/narrow-${r.moduleKey}-${r.pageKey}.png`, `${r.captureKey} 帧名 ${r.frame.file} 不符合 narrow-<模块>-<页>.png`);
  return `${withFrame.length} 帧全部唯一且命名合规`;
});

await run("N6 零注入自证：无 ?query、无注入态标记、同源真实登录（卡 §六）", () => {
  needBundle();
  const origin = String(BUNDLE.scope.origin ?? "");
  assert.doesNotMatch(origin, /\?[A-Za-z]/, `origin 带 query（${origin}）⇒ 用 query 造状态属红线`);
  assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):5\d{3}$/, `origin ${origin} 不是采集器自起的本地同源服务 ⇒ 证据来路不明`);
  for (const r of RECORDS) {
    const p = r.paint ?? {};
    assert.doesNotMatch(String(p.path ?? ""), /\?/, `${r.captureKey} 落位路径带 query：${p.path}`);
    assert.doesNotMatch(String(p.pageRootClass ?? ""), /uiux-inject|dev-injected/, `${r.captureKey} 页根带注入态 class ⇒ 不是生产视觉`);
    /* 端口是每次现换的（8080/5199 被在办单占住就得换），而且分块每跑一块会自起一遍后端+vite，
       所以「同源」只能逐条自证：拿最后一块的 scope.origin 去套前面 11 块，等于拿别人的服务冒充自己的。 */
    const own = String(r.captureOrigin ?? "");
    assert.match(own, /^http:\/\/(127\.0\.0\.1|localhost):5\d{3}$/, `${r.captureKey} 缺逐条采集 origin（读到的 ${own || "空"}）⇒ 这条记录说不出它是从哪个自起服务采来的`);
    assert.equal(Number(r.captureWebPort), Number(own.split(":").pop()), `${r.captureKey} 的 origin 端口与记录里的 webPort ${r.captureWebPort} 对不上 ⇒ 来路读数自相矛盾`);
    const u = String(p.url ?? "");
    assert.ok(u.startsWith(own), `${r.captureKey} 页面 URL ${u} 不在这条记录自己的同源 ${own} 上`);
    assert.doesNotMatch(u, /\?[A-Za-z]/, `${r.captureKey} 页面 URL ${u} 带 query ⇒ 状态是注入出来的`);
    assert.doesNotMatch(u, /#(\/)?\?/, `${r.captureKey} 页面 URL ${u} 带 hash-query ⇒ 同上`);
  }
  const origins = [...new Set(RECORDS.map((r) => r.captureOrigin))].sort();
  assert.deepEqual([...(BUNDLE.scope?.chunkOrigins ?? [])].sort(), origins, `scope.chunkOrigins ${JSON.stringify(BUNDLE.scope?.chunkOrigins)} 与逐条 origin ${JSON.stringify(origins)} 不一致 ⇒ 分块来路汇总失真`);
  assert.ok(origins.includes(origin), `本块 scope.origin ${origin} 不在逐条 origin 里 ⇒ 汇总指向了一个没产出任何记录的服务`);
  assert.match(HARNESS, /captureOrigin: ORIGIN,/, "记录不再逐条写采集 origin ⇒ 「同源」退化成只认最后一块");
  assert.match(HARNESS, /chunkOrigins: \[\.\.\.new Set\(records\.map\(\(r\) => r\.captureOrigin\)/, "档里不再汇总各块 origin ⇒ 读者只能拿单一 origin 套全档");
  assert.doesNotMatch(HARNESS, /page\.goto\([^)]*\?[A-Za-z-]+=/, "采集器源码里的 goto 带 query ⇒ 状态是注入出来的，不是走出来的（卡 §六 红线）");
  assert.doesNotMatch(HARNESS, /uiux-inject|dev-injected|WB13_FORCE_STATE/, "采集器源码里出现注入态标记 ⇒ 390 证据不是生产视觉");
  return `${RECORDS.length} 条记录全部真路由落位（path 无 query / 页根无注入 class / 逐条同源 ${origins.join("+")}）`;
});

/* ══════════ 乙 · §三.D.15 无横向裁切 ══════════ */

await run("N7 逐模块文档零横滚：scrollWidth 不超 390（§三.D.15 硬口径）", () => {
  needBundle();
  return eachModule("文档横滚", (r) => (r.overflow && r.overflow.docOverflowX <= 1 ? null : `docOverflowX=${r.overflow?.docOverflowX ?? "未采"}`));
});

await run("N8 逐模块硬越界为 0：page 桶要么本就没有，要么每组都被「真实手势滚得动 + 逐元素几何可达」豁免并披露（§三.D.15）", () => {
  needBundle();
  const cov = new Map();
  for (const f of fOf("hidden-clipper-scroll-synced")) {
    if (!cov.has(f.moduleKey)) cov.set(f.moduleKey, new Set());
    cov.get(f.moduleKey).add(f.detail?.clipperKey);
  }
  const bad = [];
  const exempt = [];
  for (const k of ROSTER) {
    const rs = recOf(k);
    if (!rs.length) {
      bad.push(`${k}：无记录`);
      continue;
    }
    for (const r of rs) {
      const page = r.overflow?.pageOffenders ?? [];
      const hard = r.overflowGate?.hard ?? page.filter((o) => !o.clipperKey).length;
      if (!page.length) continue;
      if (hard > 0) {
        bad.push(`${r.moduleKey}/${r.pageKey}：${hard} 个硬越界未消（page 桶共 ${page.length}）`);
        continue;
      }
      const groups = new Set(page.filter((o) => o.clipperKey).map((o) => o.clipperKey));
      const got = cov.get(r.moduleKey) ?? new Set();
      const uncovered = [...groups].filter((g) => !got.has(g));
      if (uncovered.length) bad.push(`${r.moduleKey}/${r.pageKey}：${uncovered.length} 组 hidden 同步容器越界既没豁免证据也没判红`);
      else exempt.push(`${r.moduleKey}(${groups.size} 组/${page.length} 个)`);
    }
  }
  assert.deepEqual(bad, [], `§三.D.15「无横向裁切」未过 ⇒ ${bad.join(" ｜ ")}`);
  return `${ROSTER.length} 模块硬越界 0；靠横滚才看得到的 hidden 同步容器：${exempt.join(" ") || "无"}`;
});

await run("N9 每个越界元素都带分桶理由，且桶名只准四类（不许 unknown 静默吞掉）", () => {
  needBundle();
  const ok = /^(page|offCanvas|railScroller|scroller:.+)$/;
  let total = 0;
  const bad = [];
  for (const r of RECORDS) for (const o of r.overflow?.offenders ?? []) {
    total += 1;
    if (!ok.test(String(o.reason))) bad.push(`${r.captureKey}→${o.reason}`);
  }
  assert.deepEqual(bad, [], `未知越界分桶：${bad.slice(0, 6).join(" ｜ ")}`);
  for (const r of RECORDS) for (const o of r.overflow?.offenders ?? []) assert.ok(o.sel && o.rect, `${r.captureKey} 越界元素缺 sel/rect 读数`);
  return `越界元素 ${total} 个，全部落 page/offCanvas/railScroller/scroller:* 四类`;
});

await run("N10 豁免桶必须披露为发现项（软化点不许静默放行）", () => {
  needBundle();
  const withExempt = RECORDS.filter((r) => (r.overflow?.counts?.exempt ?? 0) > 0).map((r) => r.moduleKey);
  const disclosed = new Set(fOf("overflow-exempt-bucket").map((f) => f.moduleKey));
  const missing = withExempt.filter((k) => !disclosed.has(k));
  assert.deepEqual(missing, [], `有豁免越界读数却没写发现项的模块：${missing.join("/")} ⇒ 分桶不是免检`);
  return `豁免桶模块 ${withExempt.length} 个（${withExempt.join(",") || "无"}）· 披露 ${disclosed.size} 条`;
});

/* ══════════ 丙 · §三.D.15/17 抽屉（鼠标 + 触摸，F3 保持项） ══════════ */

await run("N11 鼠标轨迹：业务模块抽屉由真实点击一级 rail 展开（F3 390 鼠标抽屉保持）", () => {
  needBundle();
  const bad = [];
  for (const k of BUSINESS) for (const r of recOf(k)) {
    const dm = r.drawer?.mouse;
    if (!dm) {
      bad.push(`${k}：无鼠标轨迹`);
      continue;
    }
    if (dm.via !== "rail") bad.push(`${k}：via=${dm.via}（业务模块必须真点一级 rail）`);
    if (dm.openedByRealClick !== true) bad.push(`${k}：点开=${dm.openedByRealClick}`);
    if (!(dm.cards > 0)) bad.push(`${k}：抽屉目录卡 ${dm.cards}`);
    if (!Number.isFinite(dm.transformX)) bad.push(`${k}：transformX 读数缺失`);
  }
  assert.deepEqual(bad, [], bad.join(" ｜ "));
  return `${BUSINESS.length} 个业务模块真点开抽屉 · 目录卡数 ${BUSINESS.map((k) => recOf(k)[0]?.drawer?.mouse?.cards).join("/")}`;
});

await run("N12 鼠标收起闭环：点条目自动收起或点遮罩收起，二者必须有一为真", () => {
  needBundle();
  const bad = [];
  for (const k of BUSINESS) for (const r of recOf(k)) {
    const dm = r.drawer?.mouse ?? {};
    const closed = dm.autoClosedAfterPick === true || dm.maskTapClosed === true;
    if (!closed) bad.push(`${k}：随条目收=${dm.autoClosedAfterPick}/遮罩收=${dm.maskTapClosed}`);
  }
  assert.deepEqual(bad, [], `抽屉收不回去＝390 下用户被困在遮罩里 ⇒ ${bad.join(" ｜ ")}`);
  return `11 个业务模块收起闭环（自动收 ${BUSINESS.filter((k) => recOf(k)[0]?.drawer?.mouse?.autoClosedAfterPick === true).length} / 遮罩收 ${BUSINESS.filter((k) => recOf(k)[0]?.drawer?.mouse?.maskTapClosed === true).length}）`;
});

await run("N13 触摸轨迹四段：tap 开 ⇒ 遮罩收 ⇒ 钮重开 ⇒ 收起钮收，逐段带真读数（F3 触摸抽屉，含收银台）", () => {
  needBundle();
  const bad = [];
  for (const k of ROSTER) for (const r of recOf(k)) {
    const dt = r.drawer?.touch;
    if (!dt) {
      bad.push(`${k}：无触摸轨迹`);
      continue;
    }
    if (dt.error) bad.push(`${k}：触摸轨迹异常 ${dt.error.slice(0, 60)}`);
    if (dt.openedByTap !== true) bad.push(`${k}：tap 开=${dt.openedByTap}`);
    if (dt.closedByMaskTap !== true) bad.push(`${k}：遮罩收=${dt.closedByMaskTap}`);
    if (dt.reopenedByToggleTap !== true) bad.push(`${k}：钮重开=${dt.reopenedByToggleTap}`);
    /* 「再收」三态各带各的证据：真收＝true + closeControl 点名哪颗钮 ／ 两颗钮都命中不到＝null + 发现项
       ／ 命中可点却收不掉＝false + 点名红。裸 false 是盲点旧坐标的采集假象（≤390 抽屉 z45 盖住
       header 的 side-toggle，实测落在 span.sn-logo 上），不许当成缺陷，也不许悄悄放行。 */
    if (dt.closedByToggleTap === true) {
      if (!["side-toggle", "second-nav-collapse"].includes(dt.closeControl)) bad.push(`${k}：再收=true 但没记录是哪颗钮收的（closeControl=${dt.closeControl}）`);
    } else if (dt.closedByToggleTap === false) {
      const named = vOf("drawer-unusable").some((v) => v.moduleKey === k && String(v.reason).includes("收起钮失效"));
      if (!named) bad.push(`${k}：再收=false 却没有点名「收起钮失效」的 drawer-unusable ⇒ 疑似旧坐标盲点的假读数`);
    } else if (dt.closeControlsUnreachable === true) {
      const f = fOf("drawer-close-control-unreachable").find((x) => x.moduleKey === k);
      if (!f) bad.push(`${k}：声明两颗钮都不可达却没写 drawer-close-control-unreachable 发现项`);
      else if (!(f.detail?.tried ?? []).length || (f.detail?.tried ?? []).some((t) => t.topIsSelf === true)) bad.push(`${k}：不可达发现项没有逐钮命中测试读数（tried=${JSON.stringify(f.detail?.tried).slice(0, 90)}）`);
    } else bad.push(`${k}：再收读数缺失（closedByToggleTap=${dt.closedByToggleTap} / closeControlsUnreachable=${dt.closeControlsUnreachable}）`);
  }
  assert.deepEqual(bad, [], bad.join(" ｜ "));
  const byControl = RECORDS.reduce((m, r) => {
    const c = r.drawer?.touch?.closeControl;
    if (c) m[c] = (m[c] ?? 0) + 1;
    return m;
  }, {});
  return `${ROSTER.length} 个模块触摸四段齐全 · 收起钮 ${JSON.stringify(byControl)} · 钮全不可达 ${RECORDS.filter((r) => r.drawer?.touch?.closeControlsUnreachable === true).length} 条`;
});

await run("N14 落位真实：抽屉条目点击后人工层真画出来（壳+manual 视图+标题+路径一致）", () => {
  needBundle();
  return eachModule("渲染门", (r) => {
    const p = r.paint;
    if (!p) return "没有渲染门读数";
    if (p.ok !== true) return `渲染门未过（shell=${p.shell}/manualShown=${p.manualShown}/title=${JSON.stringify(p.title)}）`;
    if (p.path !== r.routePath && !String(p.path).endsWith(String(r.routePath))) return `落位 ${p.path} ≠ 计划 ${r.routePath}`;
    if (p.emptyState === true) return "落位后是权限菜单空态，不是业务代表页";
    return null;
  });
});

await run("N15 收银台入口如实二选一：模式段真点，或退回真路由并挂发现项（不许假装点到了）", () => {
  needBundle();
  const pos = recOf("pos")[0];
  assert.ok(pos, "收银台无记录");
  const dm = pos.drawer?.mouse ?? {};
  const honest = dm.via === "mode-seg" ? Boolean(dm.modeSegPoint ?? dm.routeFallback) : true;
  assert.ok(honest, `pos 记录既非模式段真点也非路由兜底：via=${dm.via}`);
  if (dm.routeFallback) {
    const disclosed = fOf("pos-mode-seg-not-clickable").length > 0 || fOf("toggle-not-visible").length > 0;
    assert.ok(disclosed, "pos 走了路由兜底却没有对应发现项 ⇒ 兜底必须点名");
  }
  return `pos via=${dm.via} · 模式段可见=${dm.modeSegVisible ?? "n/a"} · 路由兜底=${dm.routeFallback ?? false}`;
});

/* ══════════ 丁 · §三.D.15 弹层可用 + 主操作可达 ══════════ */

await run("N16 弹层可达者必须没被 390 裁掉且关得掉（Escape/取消/遮罩任一为真）", () => {
  needBundle();
  const bad = [];
  for (const r of RECORDS.filter((x) => x.overlay && !x.overlay.reason)) {
    const o = r.overlay;
    if (!o.overlaySettle || !(o.overlaySettle.rounds >= 1)) bad.push(`${r.moduleKey}：弹层几何没有复测轮次（${JSON.stringify(o.overlaySettle)}）⇒ 可能量在入场动画中途`);
    if (o.reachable !== true) bad.push(`${r.moduleKey}：reachable=${o.reachable}`);
    if (o.closed === false) bad.push(`${r.moduleKey}：关不掉（closeTrail=${JSON.stringify(o.closeTrail).slice(0, 80)}）`);
    const box = o.overlay?.rect ?? o.overlay?.box ?? null;
    if (!box) bad.push(`${r.moduleKey}：弹层没有几何读数 ⇒ 「没裁掉」无从证明`);
    else if (Number(box.right) > 391 || Number(box.x) < -1) bad.push(`${r.moduleKey}：弹层 x=${box.x} right=${box.right} 越出 390`);
  }
  assert.deepEqual(bad, [], `弹层不可用 ⇒ ${bad.join(" ｜ ")}`);
  return `可达弹层 ${RECORDS.filter((r) => r.overlay && !r.overlay.reason).length} 个 · 关闭链全为真`;
});

await run("N17 弹层测不到必须带理由 + gap 归属（fail-closed：不许静默跳过）", () => {
  needBundle();
  const skipped = RECORDS.filter((r) => r.overlay?.reason);
  for (const r of skipped) {
    const g = GAPS.filter((x) => x.moduleKey === r.moduleKey && x.state === "overlay");
    assert.ok(g.length, `${r.moduleKey} 弹层记了 ${r.overlay.reason} 却没有对应 gap ⇒ 缺口没人接`);
    for (const x of g) assert.ok(x.owner && x.followUp, `${r.moduleKey} 的 overlay gap 缺 owner/followUp`);
  }
  return `未触发弹层 ${skipped.length} 个模块（${skipped.map((r) => `${r.moduleKey}:${r.overlay.reason}`).join(", ") || "无"}）· gap ${GAPS.filter((g) => g.state === "overlay").length} 条`;
});

await run("N18 触发白名单可复核：真点到的弹层触发全是安全动词，破坏性动词零点击", () => {
  needBundle();
  const verbs = JSON.parse(`[${HARNESS.match(/const SAFE_TRIGGER_VERBS = \[([^\]]*)\]/)[1]}]`);
  const destructive = new RegExp(HARNESS.match(/const DESTRUCTIVE_RE = "([^"]*)"/)[1]);
  for (const v of verbs) assert.equal(destructive.test(v), false, `安全白名单里混进破坏性动词「${v}」⇒ 采集器会去点删除/结算，越「只开不提交」红线`);
  const fired = [];
  for (const r of RECORDS) {
    const t = r.overlay?.trigger;
    if (!t) continue;
    const text = String(t.text ?? t.label ?? "");
    fired.push(`${r.moduleKey}:${text}`);
    assert.ok(verbs.some((v) => text.includes(v.replace(/["']/g, ""))), `${r.moduleKey} 触发文案「${text}」不在安全动词白名单 ⇒ 采集器越权点了别的按钮`);
    assert.equal(destructive.test(text), false, `${r.moduleKey} 点击了破坏性动作「${text}」⇒ 违反「只开不提交」红线`);
  }
  assert.ok(fired.length > 0, "一条弹层都没触发 ⇒ 无法证明白名单在生效");
  return `真触发 ${fired.length} 次（${fired.slice(0, 6).join(", ")}…）全部命中白名单且不含破坏性动词`;
});

await run("N19 主操作零硬越界 + 滚得到的越界必须披露 + 命中区读数逐模块在档（<44 计数不软化）", () => {
  needBundle();
  const offBad = [];
  for (const r of RECORDS) {
    if (!r.actions) {
      offBad.push(`${r.moduleKey}：无主操作读数`);
      continue;
    }
    if (r.actions.offscreenCount !== 0) offBad.push(`${r.moduleKey}：${r.actions.offscreenCount} 个动作钮越界且没有任何可滚祖先能带入（硬越界 ⇒ 用户够不到）`);
    for (const s of r.actions.offscreen ?? []) {
      assert.ok(Array.isArray(s.offNeed) && s.offNeed.length > 0, `${r.moduleKey}：被判越界的 ${s.sel} 没有 offNeed 方向读数 ⇒ 判据不可追溯`);
      assert.ok(s.offByScroller.every((w) => !w.scroller), `${r.moduleKey}：${s.sel} 记为硬越界，却存在可滚祖先 ${s.offByScroller.map((w) => w.scroller).filter(Boolean).join("/")} ⇒ 分类自相矛盾`);
    }
    if (!Number.isFinite(r.actions.below44) || !Number.isFinite(r.actions.below24)) offBad.push(`${r.moduleKey}：命中区计数缺失`);
    if (r.actions.below24 > r.actions.below44) offBad.push(`${r.moduleKey}：<24(${r.actions.below24}) > <44(${r.actions.below44}) 逻辑不自洽`);
    if ((r.actions.reachByScrollCount ?? 0) > 0) {
      const f = fOf("action-reachable-by-scroll").find((x) => x.moduleKey === r.moduleKey);
      if (!f) offBad.push(`${r.moduleKey}：有 ${r.actions.reachByScrollCount} 个「滚得到」的越界钮却没写 action-reachable-by-scroll 发现项 ⇒ 豁免必须留痕`);
    }
  }
  assert.deepEqual(offBad, [], offBad.join(" ｜ "));
  const small = RECORDS.filter((r) => (r.actions?.below44 ?? 0) > 0).map((r) => r.moduleKey);
  const disclosed = new Set(fOf("touch-target-small").map((f) => f.moduleKey));
  assert.deepEqual(small.filter((k) => !disclosed.has(k)), [], `有 <44×44 命中区却没写发现项：${small.filter((k) => !disclosed.has(k)).join("/")}`);
  return `硬越界 0 · 滚得到 ${RECORDS.reduce((a, r) => a + (r.actions?.reachByScrollCount ?? 0), 0)} 个已披露 · 命中区偏小的模块 ${small.length} 个已全部披露（按钮总数 ${RECORDS.reduce((a, r) => a + (r.actions?.total ?? 0), 0)}）`;
});

/* ══════════ 戊 · §三.D.16 键盘焦点 / 按钮语义 / 对比度 ══════════ */

await run("N20 键盘焦点：每模块 Tab 站 ≥1、视口内零无环站，且环判据必须含聚焦/失焦对照（§三.D.16）", () => {
  needBundle();
  assert.match(HARNESS, /async function FOCUS_RING_DIFF\(\)/, "采集器缺 FOCUS_RING_DIFF ⇒ 环判据退回「只看元素自身 outline」，会把 Element Plus 包装层环误判成不可见（此前 3 条假红就是这么来的）");
  return eachModule("键盘焦点", (r) => {
    const f = r.focus;
    if (!f) return "没有键盘行走读数";
    if (!(f.stopsCount > 0)) return "Tab 0 站（键盘路径根本没走起来）";
    if (f.ringMethod !== "outline-or-focus-blur-diff") return `环判据是 ${f.ringMethod}，不是「outline ∪ 聚焦/失焦逐节点差」`;
    if (f.noRingInViewport !== 0) return `视口内 ${f.noRingInViewport} 站既无 outline、聚焦/失焦比对也无变化`;
    if (f.ringOutline + f.ringShadow + (f.ringByDiff ?? 0) === 0) return "有站点但没有任何成环读数";
    if ((f.ringShadow ?? 0) > 0 && !fOf("focus-ring-shadow-unverified").some((x) => x.moduleKey === r.moduleKey)) return `${f.ringShadow} 站只凭常驻 box-shadow 判成环，却没披露宽松度`;
    if (!(f.stopsCount <= f.cap)) return `站点 ${f.stopsCount} 超上限 ${f.cap}`;
    return null;
  });
});

await run("N21 焦点环实现真源：tokens.css 的 :focus-visible 有 2px outline + offset（此前零覆盖）", () => {
  const block = TOKENS.match(/:focus-visible\s*\{([^}]*)\}/);
  assert.ok(block, "tokens.css 里没有 :focus-visible 规则 ⇒ 键盘焦点不可见");
  assert.match(block[1], /outline:\s*2px\s+solid/, "outline 不是 2px solid（焦点环弱化为 1px/none 都算退步）");
  assert.match(block[1], /outline-offset:\s*2px/, "缺 outline-offset:2px ⇒ 环会被自身边框吃掉");
  return `:focus-visible { ${block[1].trim().replace(/\s+/g, " ")} }`;
});

await run("N22 断点唯一真相源：wb-viewport.ts 的 390 与窄壳媒体查询逐字对齐", () => {
  const n = Number(VIEWPORT_TS.match(/WB_NARROW_MAX_WIDTH_PX\s*=\s*(\d+)/)[1]);
  assert.equal(n, 390, `真相源断点 ${n} ≠ 390（卡 §三.D.15 钉死窄口档位）`);
  const queries = [...SHELL.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => m[1]);
  assert.ok(queries.includes("390"), `WorkbenchShell.vue 没有 @media (max-width: 390px) 段`);
  const rogue = queries.filter((q) => q !== "390");
  assert.deepEqual(rogue, [], `窄壳里混进其它断点 ${rogue.join("/")} ⇒ 断点必须单一真相源`);
  return `wb-viewport.ts=${n} ⇄ shell @media(max-width:390px) ×${queries.length}`;
});

await run("N23 390 窄壳结构在源：底部条 56px、抽屉默认 translateX(-100%)、层级遮罩<抽屉<底栏", () => {
  const block = SHELL.match(/@media \(max-width: 390px\)([\s\S]*?)\n\}\n/);
  assert.ok(block, "找不到 390 窄壳媒体查询段");
  const css = block[1];
  assert.match(css, /\.wb-rail\s*\{[\s\S]*?flex-direction:\s*row/, "rail 没在 390 转成横向底部条");
  assert.match(css, /\.wb-rail\s*\{[\s\S]*?height:\s*56px/, "底部条高度不是 56px（卡 §三.D.15 触控可达口径）");
  const railBlock = css.match(/\.wb-rail\s*\{([^}]*)\}/)[1];
  assert.match(railBlock, /overflow:\s*auto hidden/, "底部横条的溢出方向错了：横向必须可滚（390 实测 13 个一级条目横向溢出 ~210px，写成 hidden auto 就是右侧入口被裁死、点不到）");
  assert.doesNotMatch(railBlock, /overflow:\s*hidden auto/, "rail 仍是「横不可滚、纵可滚」⇒ 一级入口在窄口不可达");
  assert.match(css, /transform:\s*translateX\(-100%\)/, "抽屉默认态没离屏 ⇒ 「默认收起」契约不成立");
  assert.match(css, /:not\(\.side-hidden\)[\s\S]{0,80}?transform:\s*translateX\(0\)/, "展开态没有 translateX(0) 回来");
  const maskZ = Number(SHELL.match(/\.wb-side-mask\s*\{[^}]*?z-index:\s*(\d+)/)[1]);
  const subZ = Number(css.match(/\.wb-subnav[\s\S]*?z-index:\s*(\d+)/)[1]);
  const railZ = Number(css.match(/\.wb-rail\s*\{[\s\S]*?z-index:\s*(\d+)/)[1]);
  assert.ok(maskZ < subZ && subZ < railZ, `层级倒挂：遮罩 ${maskZ} / 抽屉 ${subZ} / 底栏 ${railZ}`);
  return `遮罩 z${maskZ} < 抽屉 z${subZ} < 底栏 z${railZ} · 底栏 56px · 抽屉默认离屏`;
});

await run("N24 按钮语义：壳层关键控件都有可读名称，页内无标签图标钮如实计数（§三.D.16）", () => {
  needBundle();
  assert.match(SHELL, /class="wb-rail"[^>]*aria-label="一级模块导航"/, "一级 rail 缺 aria-label ⇒ 屏幕阅读器读不出导航语义");
  assert.match(SHELL, /data-testid="side-toggle"[\s\S]{0,240}?:aria-label=|:aria-label=[\s\S]{0,240}?data-testid="side-toggle"/, "390 展开导航按钮缺 aria-label");
  assert.match(SHELL, /aria-label="工作台\/收银台切换"[\s\S]{0,80}?data-testid="mode-seg"|data-testid="mode-seg"[\s\S]{0,80}?aria-label=/, "工作台/收银台切换段缺 aria-label（role=group 必须带名）");
  const bad = [];
  for (const r of RECORDS.filter((x) => x.actions)) {
    if (!Number.isFinite(r.actions.unlabeled)) bad.push(`${r.moduleKey}：无标签计数缺失`);
    if (r.actions.unlabeled > 0 && !fOf("icon-button-unlabeled").some((f) => f.moduleKey === r.moduleKey)) bad.push(`${r.moduleKey}：${r.actions.unlabeled} 个无标签图标钮没披露`);
  }
  assert.deepEqual(bad, [], bad.join(" ｜ "));
  return `壳层三处语义齐备 · 页内无标签图标钮合计 ${RECORDS.reduce((a, r) => a + (r.actions?.unlabeled ?? 0), 0)} 个（全部入发现项）`;
});

await run("N25 对比度硬底线：一级文字 ink 对两种底色必须达 AA 4.5:1", () => {
  needBundle();
  const bad = [];
  for (const r of RECORDS.filter((x) => x.contrast)) for (const p of r.contrast.samples ?? []) {
    if (p.fgToken === "ink" && (p.bgToken === "side" || p.bgToken === "bg")) {
      const need = p.need ?? 4.5;
      if (p.ratio < need) bad.push(`${r.moduleKey}：ink-on-${p.bgToken} ${p.ratio}:1（需 ${need}:1）`);
    }
  }
  assert.deepEqual(bad, [], `一级文字对比度不达标 ⇒ ${bad.slice(0, 4).join(" ｜ ")}`);
  const w = RECORDS.map((r) => r.contrast?.weakestCanvas?.ratio).filter(Number.isFinite);
  return `ink 全达标 · 画布最弱读数 ${Math.min(...w)}:1（ink2 见 N26 冲突台账）`;
});

await run("N26 对比度冲突逐条入台账：红保留、基线比值/选择器/owner/裁定路径齐（不许软化）", () => {
  needBundle();
  const reds = vOf("contrast-regression");
  assert.equal(reds.length > 0, DEVIATIONS.length > 0, `红 ${reds.length} 条 / 台账 ${DEVIATIONS.length} 条对不上 ⇒ 冲突必须一一对得上`);
  for (const d of DEVIATIONS) {
    assert.ok(recOf(d.moduleKey).some((r) => r.pageKey === d.pageKey), `台账点了 ${d.moduleKey}/${d.pageKey}，记录里却没有这条`);
    assert.ok(d.pairs?.length, `${d.moduleKey} 台账缺 pairs（选择器/字号/比值）`);
    for (const p of d.pairs) assert.ok(p.ratio < (p.need ?? 4.5), `${d.moduleKey} pairs 里 ${p.ratio}:1 并不低于阈值 ⇒ 台账条目对不上红`);
    assert.ok(Number.isFinite(d.baselineRatioOnSameBg) && d.baselineRatioOnSameBg > 4.5, `${d.moduleKey} 缺基线同底色比值（#333333 实测 12.09:1）⇒ 无法证明这是「退步」`);
    assert.ok(d.owner && d.followUp, `${d.moduleKey} 台账缺 owner/followUp（fail-closed：blocked 必带归属）`);
    assert.match(d.whyNotSilentlyFixed, /104|并排/, `${d.moduleKey} 没写清为何不当场改色抹平`);
  }
  const byMod = new Set(DEVIATIONS.map((d) => d.moduleKey));
  const redMod = new Set(reds.map((v) => v.moduleKey));
  assert.deepEqual([...redMod].filter((k) => !byMod.has(k)), [], `有 contrast-regression 红未入台账：${[...redMod].filter((k) => !byMod.has(k)).join("/")}`);
  return `红 ${reds.length} 条 ⇒ 台账 ${DEVIATIONS.length} 条，基线 ${DEVIATIONS[0]?.baselineRatioOnSameBg ?? "-"}:1 → 现值 ${DEVIATIONS[0]?.pairs?.[0]?.ratio ?? "-"}:1，待凌舟裁定`;
});

await run("N27 装饰线 ≈1.11:1 的 WCAG incidental 豁免必须披露为发现项（软化点见报告）", () => {
  needBundle();
  const withLine = RECORDS.filter((r) => (r.contrast?.linePairs?.length ?? 0) > 0).map((r) => r.moduleKey);
  const disclosed = new Set(fOf("contrast-hairline-recorded").map((f) => f.moduleKey));
  assert.deepEqual(withLine.filter((k) => !disclosed.has(k)), [], `有装饰线读数却没披露：${withLine.filter((k) => !disclosed.has(k)).join("/")}`);
  for (const f of fOf("contrast-hairline-recorded")) assert.match(f.reason, /豁免|报告/, `hairline 发现项没写明是软化点：${f.reason}`);
  assert.equal(vOf("contrast-regression").every((v) => !/line-on-/.test(String(v.reason))), true, "装饰分隔线被误判进门禁 ⇒ 口径串了");
  return `装饰线模块 ${withLine.length} 个已披露为发现项（不判红，报告必须点名）`;
});

/* ══════════ 己 · 收口一致性（门禁清零 + 交叉真源 + 采集器不被弱化） ══════════ */

await run("N28 除对比度冲突外，六类具名门禁与四类完整性门全部为 0", () => {
  needBundle();
  const gates = ["narrow-overflow", "drawer-unusable", "overlay-unusable", "action-offscreen", "focus-invisible", "module-timeout", "module-without-capture", "reused-frame", "record-incomplete"];
  const hit = gates.map((k) => [k, vOf(k).length]).filter(([, n]) => n > 0);
  assert.deepEqual(hit, [], `门禁红：${hit.map(([k, n]) => `${k}×${n}`).join(" ｜ ")}`);
  const contrastRed = vOf("contrast-regression").length;
  assert.equal(VIOLATIONS.length, contrastRed, `违规总数 ${VIOLATIONS.length} ≠ 对比度红 ${contrastRed} ⇒ 有红没被本用例点名的 kind 覆盖`);
  return `九类门禁 0 红 · 仅对比度冲突 ${contrastRed} 条在档（N26 台账，待裁定）`;
});

await run("N29 窄口模块集合与 F3 一级导航真源一致（§三.D.17 一级 12 项保持）", () => {
  needBundle();
  const rail = JSON.parse(readFileSync(RAIL_FIX, "utf8"));
  assert.equal(rail.railNames.length, 13, `原型一级 ${rail.railNames.length} 项 ≠ 13（12 模块 + 设置），F3 口径漂移`);
  const kinds = new Set(RECORDS.map((r) => r.kind));
  assert.deepEqual([...kinds].sort(), ["business", "pos"], `窄口记录的 kind 不是 business/pos 两类：${[...kinds].join("/")}`);
  assert.equal(RECORDS.filter((r) => r.kind === "business").length >= 11, true, "业务模块记录数 <11");
  assert.ok(RECORDS.every((r) => r.railKey || r.kind === "pos"), "有业务模块没有一级 rail 归属 ⇒ 无法证明走的是真实导航");
  return `一级 ${rail.railNames.length} 项真源在档 · 窄口 business=${RECORDS.filter((r) => r.kind === "business").length} pos=${RECORDS.filter((r) => r.kind === "pos").length}`;
});

await run("N30 网络失败零吞：非 2xx 必须为空或逐条有归属（降级读数不许冒充正常）", () => {
  needBundle();
  const net = BUNDLE.network ?? [];
  assert.ok(Array.isArray(net), "network 段缺失");
  if (net.length) {
    for (const n of net) assert.ok(n.moduleKey === undefined || recOf(String(n.moduleKey)).length, `网络失败点了 ${n.moduleKey}，但记录里没有这个模块`);
    assert.ok(fOf("touch-pass-skipped").length + GAPS.length > 0, `有 ${net.length} 条网络失败却没有任何 gap/发现项承接`);
  }
  return `网络失败 ${net.length} 条（${net.length ? "已承接" : "零失败"}）`;
});

await run("N31 采集器契约未被弱化：阈值、门禁词汇表与「红即非零退出」都在源里（卡 §六）", () => {
  const num = (name) => Number(HARNESS.match(new RegExp(`const ${name} = (\\d+)`))[1]);
  assert.equal(num("TOUCH_TARGET_MIN_PX"), 44, "触控命中区阈值被改小 ⇒ 命中区口径退步");
  assert.equal(num("MIN_CONTROL_PX"), 24, "最小控件尺寸阈值被改小");
  assert.equal(num("TAB_STOP_CAP"), 25, "Tab 站点上限被改动");
  assert.match(HARNESS, /const NARROW = \{ id: "390x844", width: 390, height: 844 \}/, "窄口档位被改动");
  for (const k of ["narrow-overflow", "drawer-unusable", "overlay-unusable", "action-offscreen", "focus-invisible", "contrast-regression", "module-timeout", "module-without-capture", "reused-frame", "record-incomplete"]) {
    assert.ok(HARNESS.includes(`kind: "${k}"`), `采集器里 ${k} 门禁不见了 ⇒ 用例失去证据来源`);
  }
  assert.match(HARNESS, /process\.exit\(violations\.length \? 1 : 0\)/, "采集器不再「有红就非零退出」⇒ 门禁被拔牙");
  assert.match(HARNESS, /4\.5/, "AA 4.5:1 阈值不见了");
  assert.match(HARNESS, /function RAIL_SCROLL_PROBE\(\)/, "railScroller 豁免桶失去真实横滚手势判据 ⇒ 裁掉的一级入口会被当成豁免");
  assert.match(HARNESS, /const scrollerFor = \(el, dir\) =>/, "越界判据退回「出视口即红」，不再区分滚得到/滚不到 ⇒ 判据词汇表漂移");
  assert.match(HARNESS, /el\.getAttribute\("data-plan-status"\) === "pending"/, "抽屉入口匹配不再识别「待接入」占位卡 ⇒ 点了不导航的卡会被判成窄口缺陷");
  assert.match(HARNESS, /kind: "drawer-entry-route-fallback"/, "路由兜底不再挂发现项 ⇒ 抽屉点不到的腿被悄悄换成路由（§三.D.17 空话）");
  assert.match(HARNESS, /state: "drawer-entry"/, "路由兜底不再挂 gap ⇒ 无人认领的入口缺口被藏起来");
  assert.match(HARNESS, /while \(!rail\.resolved && Date\.now\(\) - t0 < waitMs\)/, "rail 解析不再等待骨架消退 ⇒ 首帧就把模块判成「入口裁死」的假红");
  assert.match(HARNESS, /for \(const g of G\) if \(!g\.evidence\) g\.evidence = rec\.frame\.file;/, "早于建帧的缺口不再回填证据帧 ⇒ 复核无路可走");
  return `阈值 44/24/25/390×844/4.5 齐 · 十类门禁 kind、process.exit(红?1:0)、横滚/滚动可达、占位卡剔除与路由兜底判据都在源里`;
});

await run("N32 底部横条一级入口的可达性：railScroller 豁免必须有真实横滚手势证据，滚不到就是红", () => {
  needBundle();
  assert.match(HARNESS, /function RAIL_SCROLL_PROBE\(\)/, "采集器缺 rail 横滚探针 ⇒ 横条豁免桶只能靠口头假设");
  assert.match(HARNESS, /await page\.mouse\.wheel\(d, 0\);/, "横滚可用性不再是真实 wheel 手势（改成脚本写 scrollLeft 就是注入态，不能当生产证据）");
  assert.doesNotMatch(HARNESS, /rail\.scrollLeft\s*=[^=]/, "不许用脚本直接给 rail.scrollLeft 赋值冒充用户横滚（注入态，卡 §六 红线）");
  const bad = [];
  let probed = 0;
  for (const r of RECORDS) {
    const bucketN = r.overflow?.byReason?.railScroller ?? (r.overflow?.offenders ?? []).filter((o) => o.reason === "railScroller").length;
    if (!bucketN && !r.railScroll) continue;
    probed += 1;
    const p = r.railScroll;
    if (!p) {
      bad.push(`${r.moduleKey}：rail 内有 ${bucketN} 个横向越界元素却没做横滚探针 ⇒ 豁免桶无证据`);
      continue;
    }
    if (!p.found) bad.push(`${r.moduleKey}：探针找不到 rail 节点`);
    else if (p.maxScrollLeft <= 1) bad.push(`${r.moduleKey}：rail 无可滚量程（maxScrollLeft=${p.maxScrollLeft}）却把越界条目记成 railScroller 豁免`);
    else {
      if (!(p.after?.scrollLeft > 0)) bad.push(`${r.moduleKey}：真实 wheel 未让 rail 横滚（${p.scrollLeft}→${p.after?.scrollLeft}）`);
      if (p.after?.edgeItem?.inView !== true) bad.push(`${r.moduleKey}：横滚到底后末位一级入口 ${p.after?.edgeItem?.key ?? "?"} 仍不在视口 ⇒ 390 下该入口不可达`);
      if (p.restored !== true) bad.push(`${r.moduleKey}：探针未把 rail 还原到初始 scrollLeft ⇒ 截图口径与被滚动态不一致`);
    }
  }
  assert.deepEqual(bad, [], bad.join(" ｜ "));
  assert.ok(probed > 0, "整轮窄口采集没出现过 railScroller 越界读数 ⇒ 底部横条的可达性从未被测");
  return `${probed} 页录到横滚量程，真实 wheel 手势后末位一级入口入视口、截图前已还原`;
});

await run("N33 分页控件聚焦态：画布把 EP 焦点环钉掉的退步已补回（源侧硬判 + 数据侧不许再点名分页）", () => {
  /* 390 首轮复算：筛选栏控件的「无环」是采集器误判，但 .el-pagination 的每页条数/跳至两个输入框
     在聚焦/失焦逐节点比对下仍 changedCount=0 ⇒ 真退步。画布把静止态钉成 box-shadow:none + 静态描边，
     EP 的 outline:none 又压过全局 :focus-visible ⇒ 键盘焦点完全看不见。 */
  needBundle();
  const pinAt = STYLES.indexOf(".el-pagination__sizes .el-select__wrapper,");
  assert.ok(pinAt >= 0, "画布不再钉分页控件的静止态 ⇒ N33 的前提变了，请同步复核聚焦态是否还需要单独补（不许直接删本用例）");
  const pinBlock = STYLES.slice(STYLES.indexOf("{", pinAt), STYLES.indexOf("}", pinAt) + 1);
  assert.match(pinBlock, /box-shadow:\s*none/, `分页控件静止态已不再被钉成 box-shadow:none（读到 ${pinBlock.slice(0, 120)}）⇒ 若 EP 原生环回来了，本用例应改判「不需要聚焦态规则」，而不是留个假绿`);
  const focus = STYLES.match(/main\.wb-view-manual \.el-pagination \.el-pagination__sizes \.el-select__wrapper\.is-focused,\s*\n[^{]*\.el-pagination__jump \.el-input__wrapper\.is-focus\s*\{([^}]*)\}/);
  assert.ok(focus, "分页控件缺聚焦态规则 ⇒ 键盘 Tab 走到「每页条数 / 跳至」时零视觉变化（§三.D.16 禁止的退步）");
  const body = focus[1];
  assert.match(body, /border-color:\s*var\(--wb-primary/, `分页聚焦态必须把描边换成分页宿主的主色（现读到：${body.trim().slice(0, 160)}）`);
  assert.match(body, /box-shadow:\s*0 0 0 3px/, "分页聚焦态必须有 3px 主色光晕：1px 描边在 390 小控件上不足以构成可见焦点指示");
  const paginationReds = vOf("focus-invisible").filter((v) => JSON.stringify(v.detail ?? []).includes("el-pagination"));
  assert.deepEqual(paginationReds, [], paginationReds.map((v) => `${v.moduleKey}：${JSON.stringify((v.detail ?? []).map((d) => d.sel))}`).join(" ｜ "));
  const diffed = RECORDS.reduce((n, r) => n + ((r.focus?.ringOutline ?? 0) + (r.focus?.ringByDiff ?? 0)), 0);
  assert.ok(diffed > 0, "整轮窄口没有任何一站通过 outline 或聚焦/失焦差判定 ⇒ 焦点判据没在生效");
  return `源侧三条聚焦态断言齐（描边主色 + 3px 光晕）· 数据侧 focus-invisible 零次点名 .el-pagination · 已判定的可见焦点站 ${diffed}`;
});

await run("N34 抽屉入口匹配必须剔掉「待接入」占位卡：点了不导航的卡不算入口（采集器假点 ⇒ 模块假红）", () => {
  needBundle();
  /* 390 第二轮复算：inventory/product 报「人工层没画出来」，逐条查现场快照才发现采集器点的是
     `.sn-card.pending`（data-plan-status=pending、disabled、文案「库存列表待接入」）——
     文本包含目标标签就先命中，而占位卡本来就点不动。这不是产品缺陷，是采集器把入口点错，
     所以两头都要判住：源里必须有剔除逻辑，档里不能有「点过待接入卡」的记录。 */
  assert.match(HARNESS, /const isPending = \(el\) =>/, "采集器不再识别待接入占位卡 ⇒ 会把「点了没反应」误判成窄口缺陷");
  assert.match(HARNESS, /el\.getAttribute\("data-plan-status"\) === "pending"|data-plan-status/, "剔除判据必须覆盖 data-plan-status=pending（WorkbenchSubnav.vue:64 的真源属性）");
  const tierPick = HARNESS.match(/const live = tier\.all\.filter\(\(el\) => !isPending\(el\)\);[\s\S]{0,200}?live\.findIndex\(matches\)/);
  assert.ok(tierPick, "抽屉匹配池没有先剔占位卡再找目标（tier.all 直接 findIndex）⇒ 假点回来了");
  const picked = RECORDS.filter((r) => String(r.drawer?.mouse?.entryTrail?.matched ?? "").includes("待接入"));
  assert.deepEqual(picked, [], picked.map((r) => `${r.moduleKey}：点在占位卡「${r.drawer.mouse.entryTrail.matched}」`).join(" ｜ "));
  const pendingGap = vOf("module-without-capture").filter((v) => String(v.detail?.entryTrail?.matched ?? "").includes("待接入"));
  assert.deepEqual(pendingGap, [], pendingGap.map((v) => `${v.moduleKey} 的失败原因是采集器点了待接入占位卡`).join(" ｜ "));
  const landed = RECORDS.filter((r) => r.drawer?.mouse?.entryTrail?.matched).length;
  assert.ok(landed > 0, "没有任何一条记录带过抽屉条目命中 ⇒ 匹配池判据从未生效，无法证明剔除在起作用");
  return `${landed} 条记录带抽屉命中且零「待接入」；源侧剔除判据（class/data-plan-status/disabled）齐`;
});

await run("N35 390 两条实测缺陷的修法必须留在源里：收银台搜索行换行 + 区间选择器聚焦态（改回去就红）", () => {
  needBundle();
  /* 这两条都是 390 采集器点名出来的真缺陷（不是口径误判）：
     · 收银台搜索行 nowrap flex ⇒ 「全屏」钮 right=426 溢出 390，无可滚祖先 ⇒ action-offscreen 硬越界；
     · 区间选择器聚焦时 EP 打的是 `.is-active`（不是 is-focus），画布把包装层钉成 box-shadow:none 后
       聚焦态无人接手 ⇒ focus-invisible。两处都已在实现侧修复，本用例守住「修完又漂回去」。 */
  const narrowBlock = CASHIER.slice(CASHIER.indexOf("@media (max-width: 390px)"));
  assert.ok(narrowBlock.length > 0, "CashierView.vue 的 ≤390 媒体查询块不见了");
  const bar = narrowBlock.match(/\.product-searchbar\s*\{([^}]*)\}/);
  assert.ok(bar, "≤390 块里没有 .product-searchbar 的窄口口径 ⇒ 搜索行回到 nowrap，「全屏」钮会被裁出 390");
  assert.match(bar[1], /flex-wrap:\s*wrap/, `搜索行必须换行（读到 ${bar[1].trim().slice(0, 120)}）`);
  const daterange = STYLES.match(/main\.wb-view-manual :is\(\.filter-bar, \.filter-card\) \.el-date-editor\.el-input__wrapper\.is-active\s*\{([^}]*)\}/);
  assert.ok(daterange, "画布缺 `.el-date-editor.el-input__wrapper.is-active` 的聚焦态规则 ⇒ 区间选择器键盘焦点重新变成不可见（§三.D.16）");
  assert.match(daterange[1], /border-color:\s*var\(--wb-primary/, "区间选择器聚焦态描边必须取画布主色");
  const offRed = vOf("action-offscreen").filter((v) => JSON.stringify(v.detail ?? []).includes("pos-full-btn"));
  assert.deepEqual(offRed, [], offRed.map((v) => `${v.moduleKey}：${JSON.stringify((v.detail ?? []).map((x) => x?.sel))}`).join(" ｜ "));
  const focusRed = vOf("focus-invisible").filter((v) => JSON.stringify(v.detail ?? []).includes("el-date-editor") || JSON.stringify(v.detail ?? []).includes("el-range-input"));
  assert.deepEqual(focusRed, [], focusRed.map((v) => `${v.moduleKey}：区间选择器聚焦仍不可见`).join(" ｜ "));
  return `搜索行 ≤390 换行在源（wrap）· 区间聚焦态描边在源 · 读数侧 pos-full-btn / el-date-editor 零点名`;
});

await run("N36 路由兜底不许藏缺口：凡抽屉腿退过真实路由，必须有 drawer-entry 缺口 + owner + 复核路径", () => {
  needBundle();
  /* 抽屉里点不到代表页时，采集器退回真实路由把其余五条腿量完（与收银台模式段同一口径）。
     这条退路只有在「同时挂出人工缺口」时才可接受：否则 390 的抽屉可用性证据被悄悄换成路由，
     §三.D.17「390 鼠标/触摸抽屉必须保持」就成了空话。 */
  const fellBack = RECORDS.filter((r) => r.drawer?.mouse?.entryTrail?.via === "route-fallback");
  for (const r of fellBack) {
    const g = GAPS.find((x) => x.moduleKey === r.moduleKey && x.state === "drawer-entry");
    assert.ok(g, `${r.moduleKey}：抽屉腿退过真实路由（${r.drawer.mouse.routeFallback}）却没有 drawer-entry 缺口 ⇒ 把点不到的入口藏起来了`);
    assert.ok(g.owner, `${r.moduleKey} 的 drawer-entry 缺口没有 owner ⇒ 没人认领，等于没披露`);
    assert.ok(String(g.followUp).length > 0 && String(g.evidence ?? "").length > 0, `${r.moduleKey} 的 drawer-entry 缺口缺复核路径或证据帧`);
    assert.match(String(g.reason), /待接入|mismatch|没有匹配/, `${r.moduleKey} 的缺口理由没写清点不到的是什么（读到 ${String(g.reason).slice(0, 90)}）`);
    assert.ok(r.paint?.ok, `${r.moduleKey}：退回路由后渲染门没通过，却仍被当成有效窄口记录`);
  }
  const noClick = vOf("module-without-capture").filter((v) => String(v.reason).includes("找不到代表页条目"));
  assert.deepEqual(noClick, [], `${noClick.length} 个模块因「抽屉找不到条目」判红：要么补可点入口，要么走路由兜底 + gap，不许留裸红`);
  return fellBack.length ? `${fellBack.length} 个模块走过路由兜底（${fellBack.map((r) => r.moduleKey).join("/")}），缺口全部有 owner 与复核路径` : "全部模块都由抽屉真实点击落位，无路由兜底";
});

await run("N37 触摸收腿与 rail 横滚的采集口径没被弱化：收腿先过 elementFromPoint，横滚位移正反对称可逆", () => {
  /* 两条都是「读数口径」而不是「产品缺陷」：
     · ≤390 抽屉展开时 .wb-subnav(z45) 把 header 的 side-toggle 整颗盖在下面（实测落点 topEl=
       span.sn-logo，F3 壳层层级口径），拿收起态的旧坐标盲点第二下落到的是一张抽屉面板 ⇒
       「再收=false」是采集假象；改点展开态可见的抽屉头部 second-nav-collapse，逐钮命中测试；
     · 合成 wheel 的 deltaX 与像素 1:1 且到边界钳位，固定 ±280 在起始位非 0 时（点完末位模块
       rail 自选位停在 20）反向钳到 0 ⇒ 「探针未还原」的判据假红。
     两者都必须由源结构证明已改成可复核的口径，否则 D 组窄口证据里的抽屉/手势行不可信。 */
  assert.match(HARNESS, /function DRAWER_CLOSE_SPOT\(\)[\s\S]{0,900}?elementFromPoint/, "采集器缺 DRAWER_CLOSE_SPOT 逐钮命中探针 ⇒ 收腿回到盲点旧坐标");
  assert.match(HARNESS, /if \(!hit && visible && rec\.topIsSelf\) hit = rec;/, "只有 elementFromPoint 落在钮自身（或它的子节点）才算这一腿可测");
  assert.match(HARNESS, /const probe = await page\.evaluate\(DRAWER_CLOSE_SPOT\);[\s\S]{0,160}?out\.closeProbe = probe;/, "抽屉展开态下没有对收起钮做实时命中测试");
  assert.match(HARNESS, /if \(hit\) \{[\s\S]{0,500}?out\.closedByToggleTap = await waitDrawer\(page, false, 5000\);[\s\S]{0,120}?out\.closeControl = hit\.name;/, "命中可点才真 tap，且必须记录是哪颗钮收的");
  assert.match(HARNESS, /out\.closedByToggleTap = null;[\s\S]{0,160}?out\.closeControlsUnreachable = true;/, "两颗钮都命中不到时「再收」必须置 null 并挂发现项，不许留裸 false 冒充缺陷");
  assert.match(HARNESS, /kind: "drawer-close-control-unreachable"[\s\S]{0,600}?F3 壳层层级口径/, "不可达发现项必须点名它属 F3 壳层层级口径（非 13B 视觉对齐引入的退步）");
  assert.match(HARNESS, /收起钮失效/, "命中可点却收不掉必须判成 drawer-unusable（点名「收起钮失效」），不许静默放行");
  assert.match(HARNESS, /out\.via = "side-toggle@pos";[\s\S]{0,600}?const pClose = await closeDrawerByMask\(page, "touch"\);/, "收银台触摸腿必须补齐遮罩收，不再豁免关闭证据");
  assert.match(HARNESS, /const d = p0\.maxScrollLeft - p0\.scrollLeft;[\s\S]{0,220}?await page\.mouse\.wheel\(d, 0\);[\s\S]{0,220}?await page\.mouse\.wheel\(-d, 0\);/, "rail 横滚必须用「到端点的精确位移」正反对称；±280 定值会在非 0 起始位钳到 0 造成假红");
  assert.match(HARNESS, /railP\.restored = Math\.abs\(back\.scrollLeft - p0\.scrollLeft\) <= 2;/, "还原判据必须是带容差的回位比较");
  assert.match(HARNESS, /railP\.restoredTo = back\.scrollLeft;/, "还原读数没落档 ⇒ 「还原=true」无从复核");

  const unreachable = fOf("drawer-close-control-unreachable");
  for (const f of unreachable) {
    const tried = f.detail?.tried ?? [];
    assert.ok(tried.length >= 2, `${f.moduleKey}：不可达发现项没有逐钮读数（tried=${tried.length} 颗）`);
    assert.ok(tried.every((t) => t.topIsSelf !== true), `${f.moduleKey}：发现项自相矛盾（有钮命中测试本可点）`);
    assert.ok(recOf(f.moduleKey).some((r) => r.drawer?.touch?.closeControlsUnreachable === true), `${f.moduleKey}：发现项说钮不可达，但触摸轨迹记录没置 closeControlsUnreachable`);
  }
  const bare = RECORDS.filter((r) => r.drawer?.touch?.closedByToggleTap === false);
  assert.deepEqual(bare, [], `${bare.map((r) => r.moduleKey).join("/")} 仍有裸 false 的再收读数 ⇒ 采集口径未升级`);
  const scrolled = RECORDS.filter((r) => r.railScroll?.found && Number(r.railScroll?.maxScrollLeft) > 1);
  const notRestored = scrolled.filter((r) => r.railScroll.restored !== true);
  assert.deepEqual(notRestored, [], `${notRestored.map((r) => `${r.moduleKey}(回位 ${r.railScroll.restoredTo}≠起 ${r.railScroll.scrollLeft})`).join(" ｜ ")}：横滚手势没还原 ⇒ 截图口径与被滚动态不一致`);
  return `命中测试守卫在源（DRAWER_CLOSE_SPOT/topIsSelf/三态落档）· pos 补齐遮罩腿 · 对称位移 ±d 与容差判据在源 · 钮不可达 ${unreachable.length} 模块 · 已还原横滚 ${scrolled.length} 模块`;
});

await run("N38 越界门禁读全量 pageOffenders，不吃 40 格展示切片；rail 桶与硬越界都用全量计数（判据不许退回假绿）", () => {
  needBundle();
  assert.match(HARNESS, /pageOffenders: offenders\.filter\(\(o\) => o\.reason === "page"\), offenders: offenders\.slice\(0, 40\)/, "采集器不再单独带出全量 pageOffenders ⇒ 展示切片重新变成门禁输入（rail/离屏抽屉占满 40 格就假绿）");
  assert.match(HARNESS, /const gateOff = ov\.pageOffenders \?\? \[\];/, "窄口判红退回从切片里 filter page ⇒ 页级真裁切会被静默吞掉");
  assert.match(HARNESS, /const railBucket = \(ov\.byReason\?\.railScroller \?\? 0\) > 0;/, "rail 桶成立与否改回查切片 ⇒ 桶被占满时横滚可用性判据失效");
  assert.match(HARNESS, /offscreenCount: items\.filter\(\(i\) => i\.offscreen\)\.length,/, "硬越界必须另有全量计数（旧写法拿 12 格切片的 length 当数量报，读数会说谎）");
  assert.match(HARNESS, /if \(ac\.offscreenCount\) V\.push\(\{ kind: "action-offscreen"/, "action-offscreen 门禁不再读 ac.offscreen.length ⇒ 判据词汇表漂移");
  assert.match(HARNESS, /if \(r\.overflow\?\.pageOffenders\?\.length && !r\.overflowGate\) missing\.push\("①c 隐藏同步容器手势"\)/, "有页级越界却没跑手势腿的记录不再被完整性门放过");
  assert.match(HARNESS, /if \(r\.overflow && !Array\.isArray\(r\.overflow\.pageOffenders\)\) missing\.push\("① 越界全量判据\(pageOffenders\)"\)/, "缺全量判据字段的记录必须记 record-incomplete");
  assert.match(HARNESS, /nonExemptOffenders: r\.overflowGate\?\.hard \?\? r\.overflow\?\.counts\?\.page \?\? null/, "摘要行的「越界」数必须取手势后的硬越界数");

  const badShape = [];
  const badCount = [];
  const badRow = [];
  for (const r of RECORDS) {
    if (!Array.isArray(r.overflow?.pageOffenders)) {
      badShape.push(`${r.moduleKey}/${r.pageKey}`);
      continue;
    }
    if ((r.overflow.counts?.page ?? 0) !== r.overflow.pageOffenders.length) badCount.push(`${r.moduleKey}（counts.page=${r.overflow.counts?.page} vs 全量 ${r.overflow.pageOffenders.length}）`);
    if ((r.actions?.offscreenCount ?? 0) < (r.actions?.offscreen?.length ?? 0)) badCount.push(`${r.moduleKey}：offscreenCount 小于样本数 ⇒ 计数被切片截断`);
    const row = rowOf(r.moduleKey);
    const want = r.overflowGate?.hard ?? r.overflow.counts?.page ?? null;
    if (row.nonExemptOffenders !== want) badRow.push(`${r.moduleKey}（摘要 ${row.nonExemptOffenders} vs 硬越界 ${want}）`);
  }
  assert.deepEqual(badShape, [], `${badShape.join("/")} 的记录没有 pageOffenders 全量字段 ⇒ 是旧口径采的，必须重采`);
  assert.deepEqual(badCount, [], `${badCount.join(" ｜ ")} ⇒ 全量计数与样本自相矛盾`);
  assert.deepEqual(badRow, [], `${badRow.join(" ｜ ")} ⇒ 摘要表读数与门禁不一致`);
  return `全量判据在源（pageOffenders/byReason/offscreenCount/两条 record-incomplete）· ${RECORDS.length} 条记录 counts.page==全量、摘要行==硬越界数`;
});

await run("N39 hidden 同步容器（EP 表头）豁免必须双证：真实手势滚得动 + 逐元素几何可达；带不到位的必须回到 narrow-overflow 红", () => {
  needBundle();
  assert.match(HARNESS, /function HEADER_SYNC_GESTURE\(cfg\) \{/, "隐藏同步容器的手势探针不见了 ⇒ 豁免重新变成静态 CSS 一句话");
  assert.match(HARNESS, /"scroller-not-in-clipper-subtree"\) : "no-horizontal-scroller-under-clipper"/, "探针不再要求横滚容器与隐藏容器同属一个控件 ⇒ 滚别处也能算豁免");
  assert.match(HARNESS, /rec\.clipperKey = /, "越界元素没有可核对的归属容器键 ⇒ 手势后无从复测");
  assert.match(HARNESS, /for \(let guard = 0; guard <= 30; guard \+= 1\) \{[\s\S]{0,700}?await page\.mouse\.wheel\(nxt, 0\);/, "豁免不再分档真实横滚（一次性滚到端点会把前序列推出左边界 ⇒ 假红，且没有滚动手势证据）");
  assert.match(HARNESS, /restored = unreachable\.length === 0 && t\.lastClipperScrollLeft > gp\.clipperScrollLeft;/, "豁免判据必须同时要求「几何可达 0 不可达」与「容器真被滚起来」");
  assert.match(HARNESS, /if \(!restored\) hardOff\.push\(\.\.\.g\.offenders\);/, "手势带不回的组必须回到硬越界，不许静默丢弃");
  assert.match(HARNESS, /\} else if \(hardOff\.length\) \{[\s\S]{0,400}?隐藏同步容器也没有可证明带回的手势/, "narrow-overflow 的红理由不再点名隐藏同步容器判据");
  assert.match(HARNESS, /kind: "hidden-clipper-scroll-synced"/, "豁免发现项词汇表漂移 ⇒ 报告无法披露「要横滚才看得到」");

  const synced = fOf("hidden-clipper-scroll-synced");
  const bad = [];
  for (const f of synced) {
    const d = f.detail ?? {};
    const okShape = d.verdict === "手势带回" && d.after?.unreachableCount === 0 && Number(d.after?.clipperScrollLeftMax) > Number(d.before?.clipperScrollLeft) && Number(d.after?.steps) >= 2 && d.after?.backToPageTotal === d.after?.pageTotalBefore && d.before?.ok === true;
    if (!okShape) bad.push(`${f.moduleKey}：豁免证据不全（verdict=${d.verdict} 滚 ${d.before?.clipperScrollLeft}→${d.after?.clipperScrollLeftMax} 档 ${d.after?.steps} 不可达 ${d.after?.unreachableCount} 回位 ${d.after?.backToPageTotal}/${d.after?.pageTotalBefore} 探针 ok=${d.before?.ok}）`);
    if (!/横滚才看得到/.test(f.reason ?? "")) bad.push(`${f.moduleKey}：豁免发现项没写明「390 下这些列要横滚才看得到」`);
  }
  for (const r of RECORDS) {
    const groups = new Set((r.overflow?.pageOffenders ?? []).filter((o) => o.clipperKey).map((o) => o.clipperKey));
    const covered = new Set(synced.filter((f) => f.moduleKey === r.moduleKey && f.detail?.clipperKey).map((f) => f.detail.clipperKey));
    const leaked = [...groups].filter((k) => !covered.has(k));
    const hasRed = vOf("narrow-overflow").some((v) => v.moduleKey === r.moduleKey);
    if (leaked.length && !hasRed) bad.push(`${r.moduleKey}：${leaked.length} 组 hidden 容器越界既没豁免也没判红 ⇒ 门禁漏网`);
    if ((r.overflowGate?.hard ?? 0) > 0 && !hasRed) bad.push(`${r.moduleKey}：硬越界 ${r.overflowGate.hard} 个却没有 narrow-overflow 红`);
    if ((r.overflowGate?.synced ?? 0) > 0 && r.overflowGate.synced !== synced.filter((f) => f.moduleKey === r.moduleKey).length) bad.push(`${r.moduleKey}：豁免组数 ${r.overflowGate.synced} 与发现项条数不一致`);
  }
  assert.deepEqual(bad, [], bad.join(" ｜ "));
  const clipped = RECORDS.filter((r) => (r.overflowGate?.synced ?? 0) > 0);
  return `双证判据在源（探针/同控件/分档手势/几何复核/回硬越界）· 豁免 ${synced.length} 组（${clipped.map((r) => r.moduleKey).join("/") || "无"}）· 漏网与不一致 0`;
});

await run("N40 采集来路口径逐条入库：缺 origin/端口/不同源 ⇒ record-incomplete 判红（分块证据不许靠最后一块的 scope 自证）", () => {
  needBundle();
  assert.match(HARNESS, /captureOrigin: ORIGIN,\n\s*captureWebPort: WEB_PORT,\n\s*captureBackendPort: BACKEND_PORT,/, "记录段不再逐条落 origin/端口 ⇒ 分块跑完后「同源」无从判（N6 会退回套最后一块）");
  assert.match(HARNESS, /const lack = \[\];[\s\S]{0,700}?if \(lack\.length\) violations\.push\(\{ kind: "record-incomplete"/, "采集来路缺项不再进完整性门 ⇒ 断链的证据会被当正常入档");
  assert.match(HARNESS, /记录缺采集来路口径/, "完整性红的理由不再点名「采集来路」⇒ 收口读不出是哪一段断的");
  assert.match(HARNESS, /if \(r\.paint\?\.url && r\.captureOrigin && !String\(r\.paint\.url\)\.startsWith\(String\(r\.captureOrigin\)\)\)/, "URL 与自身 origin 不同源不再判红 ⇒ 别的服务/别端口的页面能混进档");

  const bad = [];
  for (const r of RECORDS) {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):[0-9]{4,5}$/.test(String(r.captureOrigin ?? ""))) bad.push(`${r.captureKey} origin=${r.captureOrigin ?? "无"}`);
    if (!Number.isFinite(r.captureWebPort) || !Number.isFinite(r.captureBackendPort)) bad.push(`${r.captureKey} 端口=${r.captureWebPort ?? "无"}/${r.captureBackendPort ?? "无"}`);
  }
  assert.deepEqual(bad, [], `${bad.join(" ｜ ")} ⇒ 这份档是分块合并出来的，缺来路的那几条无从复现，必须整档重采`);
  const lies = vOf("record-incomplete").filter((v) => /采集来路/.test(String(v.reason ?? "")));
  assert.deepEqual(lies, [], `采集器已判出采集来路断链：${lies.map((v) => `${v.moduleKey}(${v.reason})`).join(" ｜ ")}`);
  return `${RECORDS.length} 条记录逐条带 origin/端口 · 采集器自判来路断链 0 条 · 各块 origin ${[...new Set(RECORDS.map((r) => r.captureOrigin))].join("/")}`;
});

/* ══════════ 汇总 ══════════ */
const failed = results.filter((r) => !r.ok);
console.log("─".repeat(76));
console.log(`WORKBENCH-13B · D 组窄口回归契约：${results.length} 条（通过 ${results.length - failed.length} · 失败 ${failed.length}）`);
if (failed.length) for (const f of failed) console.log(`  FAIL ${f.name}`);
console.log(`模块覆盖：${ROSTER.length} 个（11 业务 + 收银台）× 代表页；§三.D.18 要求 ≥24 条 ⇒ 本组 ${results.length} 条`);
process.exit(failed.length ? 1 : 0);
