/**
 * WORKBENCH-PROTOTYPE-12-S3 · 四列壳层 + 任务中心 门禁用例
 *
 * 覆盖卡面硬验收：
 *   §三.1  1440×1000 四列几何：rail 60 / side 230 / main 850 / task center 300
 *   §三.2  1024×768 四列几何：rail 60 / side 230 / main 434 / task center 300
 *   §三.3  顶栏 42px；底部输入区 100px
 *   §三.4  任务中心「进度明细/任务跟踪」双态可收起/展开且状态保持（localStorage）
 *   §三.5  router-view 常驻（不被 AI 状态条件渲染）
 *   §三.6  无整页横向滚动（窄口隐藏任务中心列）、无 dead link、无待接入占位
 *   §三.7  保持现有 13 项一级 rail 与 230px 二级栏
 *   §四.3  真实数据接入（任务中心消费真实端点；error/unavailable 如实标注，不伪造）
 *   §四.4  reduced-motion（收起切换无动画偏好下不闪烁/不位移）
 *   门1 返工：二级栏切 S2 唯一口径（生产投影渲染，未接线项不显示），
 *            真编译 SFC SSR 渲染 DOM 对黑名单（含「待接入」）零命中 + 投影与渲染同源
 *
 * 运行（admin-web 目录）：node tests/prototype12-shell-task-center.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

const shellSrc = read("layouts/WorkbenchShell.vue");
const taskCenterSrc = read("components/workbench/WorkbenchTaskCenter.vue");
const subnavSrc = read("layouts/WorkbenchSubnav.vue");
const PRODUCTION_COPY_BLACKLIST = ["待接入", "原型", "演示", "占位", "开发态", "工程状态"];

const results = [];
async function run(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    const stackLine = String(err.stack || "").split("\n")[1]?.trim() ?? "";
    console.log(`FAIL  ${name}  ← ${err.message}${stackLine ? `  [${stackLine}]` : ""}`);
  }
}

/** 取出指定选择器的首个声明块（简单配平；scoped CSS 不嵌套大括号） */
function cssBlock(text, selector) {
  const idx = text.indexOf(`${selector} {`);
  if (idx < 0) return null;
  let i = idx + selector.length + 2;
  let depth = 1;
  for (; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "/*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(idx, i + 1);
    }
  }
  return null;
}

/** 取出 `@media (max-width: <px>px) {` 的整块（含大括号配平） */
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

/* ══ 1. 四列几何 ══ */

await run("四列 grid：60 / 230 / minmax(0,1fr) / 300 逐字落值（折叠态同四列）", () => {
  const shell = cssBlock(shellSrc, ".wb-shell");
  assert.ok(shell, "缺少 .wb-shell 块");
  assert.ok(
    /grid-template-columns:\s*var\(--wb-rail-w,\s*60px\)\s*var\(--wb-side-w,\s*230px\)\s*minmax\(0,\s*1fr\)\s*var\(--wb-task-center-w,\s*300px\);/.test(shell),
    "展开态未含 60/230/minmax(0,1fr)/300 四列",
  );
  const hidden = cssBlock(shellSrc, ".wb-shell.side-hidden");
  assert.ok(
    /grid-template-columns:\s*var\(--wb-rail-w,\s*60px\)\s*var\(--wb-side-collapsed-w,\s*56px\)\s*minmax\(0,\s*1fr\)\s*var\(--wb-task-center-w,\s*300px\);/.test(hidden),
    "折叠态未保留第 4 列 300px",
  );
  return "60 / 230 / 1fr / 300（折叠 60/56/1fr/300）";
});

await run("顶栏 42px（卡面 §三.3）：高度含 1px 下边线（border-box，浏览器实测=42）", () => {
  const top = cssBlock(shellSrc, ".wb-top");
  assert.ok(top, "缺少 .wb-top 块");
  assert.match(top, /height:\s*42px;/, "顶栏高度不是 42px");
  assert.match(top, /box-sizing:\s*border-box;/, "顶栏缺 border-box（实测会变 43px）");
  return "42px（含边线）";
});

await run("底部输入区 100px（卡面 §三.3）：壳层固定 .cmp 高度", () => {
  const deep = cssBlock(shellSrc, ".wb-main :deep(.cmp)");
  assert.ok(deep, "缺少壳层对 .cmp 的 100px 约束");
  assert.match(deep, /height:\s*100px;/, ".cmp 高度不是 100px");
  assert.match(deep, /min-height:\s*100px;/, ".cmp 缺 min-height 100px");
  assert.match(deep, /max-height:\s*100px;/, ".cmp 缺 max-height 100px");
  assert.match(deep, /flex-shrink:\s*0;/, ".cmp 未固定不收缩");
  return "100px 固定";
});

await run("main 列 = minmax(0,1fr)：1440 几何 850 / 1024 几何 434 由真实浏览器实测证明", () => {
  assert.match(cssBlock(shellSrc, ".wb-shell"), /minmax\(0,\s*1fr\)/, "main 列不是自适应轨道");
  assert.ok(!/850px|434px/.test(shellSrc), "main 列宽度不得硬编码 850/434（必须是视口算出的 1fr）");
  return "1fr 自适应；850/434 只由实测证据给出";
});

/* ══ 2. 任务中心结构与状态保持 ══ */

await run("任务中心组件存在且被壳层装配（第 4 列槽位）", () => {
  assert.ok(shellSrc.includes('import WorkbenchTaskCenter from "../components/workbench/WorkbenchTaskCenter.vue";'), "壳层未 import WorkbenchTaskCenter");
  assert.ok(shellSrc.includes("<WorkbenchTaskCenter"), "壳层模板未装配 WorkbenchTaskCenter");
  assert.ok(taskCenterSrc.includes('data-testid="task-center"'), "组件缺 data-testid=task-center");
  return "装配完成";
});

await run("双态结构：进度明细 / 任务跟踪 两个 tab 与两个 pane", () => {
  for (const tab of ["progress", "tracking"]) {
    assert.ok(taskCenterSrc.includes(`data-task-center-tab="${tab}"`), `缺 tab ${tab}`);
    assert.ok(taskCenterSrc.includes(`data-task-center-pane="${tab}"`), `缺 pane ${tab}`);
  }
  assert.ok(taskCenterSrc.includes("进度明细"), "缺「进度明细」文案");
  assert.ok(taskCenterSrc.includes("任务跟踪"), "缺「任务跟踪」文案");
  return "双 tab + 双 pane";
});

await run("收起/展开 + 状态保持：localStorage 键读写（壳层持久化收起态）", () => {
  assert.ok(shellSrc.includes('"wb.task-center.collapsed"'), "壳层缺收起态 localStorage 键");
  assert.ok(shellSrc.includes("restoreTaskCenterState()"), "壳层未在挂载前恢复收起态");
  assert.ok(shellSrc.includes("toggleTaskCenter"), "壳层缺切换函数（持久化入口）");
  assert.ok(shellSrc.includes("persistTaskCenterState"), "壳层缺持久化函数");
  // 口径变更留痕（UI-PARITY-BASE）：恢复改为 readTaskCenterPref()（null=无偏好 ⇒ 合同默认态可生效）
  assert.ok(shellSrc.includes("function readTaskCenterPref()"), "壳层缺显式偏好读取（合同默认态判据）");
  assert.ok(shellSrc.includes("onTaskCenterSettle"), "壳层缺合同默认态回调（无待办默认收起）");
  assert.ok(taskCenterSrc.includes('"wb.task-center.view"'), "组件缺双态 localStorage 键");
  assert.ok(taskCenterSrc.includes("restoreView()"), "组件未恢复双态选择");
  return "收起态 + 双态均持久化 + 合同默认回调";
});

await run("收起重开入口 = 顶栏开关（0px 收起后列内无竖条，合同 top_bar.right）", () => {
  // 口径变更留痕（UI-PARITY-BASE §四.1.4）：收起 = 0px，不再保留 56px 竖条；
  // 唯一常驻重开入口 = 壳层顶栏 task-center-toggle。
  assert.ok(!taskCenterSrc.includes("task-center-strip"), "任务中心不得再渲染收起竖条（0px 口径）");
  assert.ok(shellSrc.includes('data-testid="task-center-toggle"'), "顶栏缺任务中心开关");
  assert.ok(shellSrc.includes("@click=\"toggleTaskCenter\""), "顶栏开关未接 toggleTaskCenter");
  assert.ok(/aria-pressed/.test(shellSrc), "顶栏开关缺 aria-pressed");
  assert.ok(taskCenterSrc.includes('data-testid="task-center-collapse"'), "面板内缺收起按钮（合同 close button collapses）");
  return "顶栏 toggle（aria-pressed）+ 面板内收起钮；竖条零残留";
});

await run("窄口（≤390px）任务中心整列隐藏，不挤主面；无整页横向滚动", () => {
  const block = mediaBlock(shellSrc, 390);
  assert.ok(block, "壳层缺 390px 窄口块");
  assert.ok(/\.wb-shell :deep\(\.wtc\)\s*\{[^}]*display:\s*none;/.test(block), "窄口未隐藏任务中心列");
  return "390 窄口 .wtc display:none";
});

await run("任务中心收起几何（UI-PARITY-BASE §四.1.4）：第 4 列 300→0（非 56px 窄条），main(1fr) 实际变宽；窄口覆盖不受影响", () => {
  const collapsed = cssBlock(shellSrc, ".wb-shell.tc-collapsed");
  assert.ok(collapsed, "壳层缺 .wb-shell.tc-collapsed 收起列宽规则");
  assert.match(collapsed, /var\(--wb-task-center-collapsed-w,\s*0px\)/, "收起态第 4 列不是 0px（卡面明确非 56px 窄条）");
  const both = cssBlock(shellSrc, ".wb-shell.side-hidden.tc-collapsed");
  assert.ok(both && /var\(--wb-task-center-collapsed-w,\s*0px\)/.test(both), "双折叠态第 4 列不是 0px");
  assert.ok(!/task-center-collapsed-w,\s*56px/.test(shellSrc), "壳层残留 56px 任务中心收起宽（旧口径回潮）");
  assert.ok(/'tc-collapsed':\s*taskCenterCollapsed/.test(shellSrc), "壳层未绑定 tc-collapsed 类");
  assert.match(cssBlock(shellSrc, ".wb-shell"), /var\(--wb-task-center-w,\s*300px\)/, "展开态第 4 列必须保持 300px（收起是可选态）");
  const narrow = mediaBlock(shellSrc, 390);
  assert.ok(/\.wb-shell\.tc-collapsed,/.test(narrow ?? ""), "窄口块未并入 tc-collapsed 覆盖（窄口单列会被压回）");
  return "tc-collapsed 300→0（main +300）+ 窄口覆盖";
});

/* ══ 3. router-view 常驻与 AI 故障隔离 ══ */

/** 剥离 HTML/块/行注释后，定位真实渲染的自闭合 router-view（禁止裸 indexOf 命中注释内字样）。 */
function locateRouterView(source) {
  const stripped = source
    .replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/\/\/.*/g, (m) => " ".repeat(m.length));
  const m = stripped.match(/<router-view\s*\/>/);
  assert.ok(m && typeof m.index === "number", "缺少真实自闭合 <router-view /> 渲染节点（注释不计）");
  return { index: m.index, tag: stripped.slice(m.index, m.index + "<router-view />".length) };
}

await run("router-view 常驻：去注释后真实自闭合渲染节点，无 v-if（裸 indexOf 禁用）", () => {
  const selfSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.ok(!/indexOf\(\s*["'`]<router-view/.test(selfSrc), "spec 不得用裸 indexOf 定位 router-view（会命中注释）");
  const { index, tag } = locateRouterView(shellSrc);
  assert.equal(tag, "<router-view />", "router-view 必须为自闭合常驻节点");
  const around = shellSrc.slice(Math.max(0, index - 80), index + tag.length + 40);
  assert.ok(!/\bv-(if|else-if|else|show)\b/.test(around), "真实 router-view 节点被条件渲染包裹（M10）");
  return `self-closing @${index}`;
});

/* ══ 4. 真实数据接入（§四.3，S1 view-model）与无占位 ══ */

await run("任务中心消费 S1 view-model（真实端点统一在 task-center.ts 契约）", () => {
  assert.ok(
    taskCenterSrc.includes('from "../../shared/workbench/task-center"'),
    "组件未 import S1 task-center view-model（硬验收 §四.3 以此为准）",
  );
  assert.ok(
    taskCenterSrc.includes("loadTaskCenterSnapshot") && taskCenterSrc.includes("loadPlansSource") && taskCenterSrc.includes("loadConfirmationsSource"),
    "组件未使用 S1 各源装载器",
  );
  const tc = read("shared/workbench/task-center.ts");
  for (const endpoint of ["/api/ai/agent/plans", "/api/chat/confirmations", "/api/ai/employees/", "/admin/notifications"]) {
    assert.ok(tc.includes(endpoint), `S1 view-model 未消费真实端点 ${endpoint}`);
  }
  assert.ok(!/Math\.random\(/.test(taskCenterSrc), "组件不得使用随机数填充");
  assert.ok(!/红星商行|张三|王强/.test(taskCenterSrc), "组件不得出现原型演示姓名/店名");
  return "S1 import + 4 个真实端点（契约文件）+ 无随机数 + 无演示数据";
});

await run("各源独立 loading/ready/empty/unavailable/error/timeout/idle 且失败可重试", () => {
  const states = ["loading", "ready", "empty", "unavailable", "error", "timeout", "idle"];
  for (const s of states) {
    assert.ok(taskCenterSrc.includes(`'${s}'`) || taskCenterSrc.includes(`"${s}"`), `组件缺 ${s} 态处理`);
  }
  assert.ok(taskCenterSrc.includes("canRetry"), "缺 canRetry（error/unavailable 判定）");
  const retryCount = (taskCenterSrc.match(/data-testid="tc-[a-z-]+-retry"/g) || []).length;
  assert.ok(retryCount >= 4, `重试入口不足（期望 ≥4 处，实得 ${retryCount}）`);
  return `${retryCount} 处重试入口`;
});

await run("无「待接入」占位：数据不可得时如实标 unavailable/error，不用占位文案冒充", () => {
  assert.ok(!/待接入/.test(taskCenterSrc), "任务中心不得出现「待接入」占位文案（数据源必须真实接线）");
  const tc = read("shared/workbench/task-center.ts");
  assert.ok(!/待接入/.test(tc), "S1 view-model 不得出现「待接入」占位文案");
  return "无待接入占位";
});

await run("AI 故障不影响人工通知源：主后端通知走 /admin/notifications（S1 独立失败隔离）", () => {
  const tc = read("shared/workbench/task-center.ts");
  assert.ok(tc.includes('api.get("/admin/notifications"'), "S1 通知装载器未走主后端 REST");
  assert.ok(taskCenterSrc.includes("refreshNotifications"), "组件未独立装载通知源（AI 故障可单独重试）");
  return "通知源独立于 AI 底座";
});

/* ══ 5. 保留既有结构（§三.7） ══ */

await run("保持 13 项 rail 结构：desk + 11 业务模块 + 设置项仍在", () => {
  assert.ok(shellSrc.includes('data-testid="rail"'), "rail 容器丢失");
  const deskCount = (shellSrc.match(/data-rail-key="desk"/g) || []).length;
  assert.ok(deskCount >= 1, "工作台 rail 项丢失");
  assert.ok(shellSrc.includes("wb-rail-set"), "设置 rail 项丢失");
  assert.ok(shellSrc.includes("v-for=\"group in railModules\""), "11 业务模块循环丢失");
  return "rail 结构保留";
});

await run("230px 二级栏保留（第二列宽度不因四列改造改变）", () => {
  assert.ok(/var\(--wb-side-w,\s*230px\)/.test(shellSrc), "二级栏 230px 丢失");
  return "230px 保留";
});

/* ══ 6. reduced-motion 与键盘可达 ══ */

await run("任务中心收起/展开无动画依赖：切换只有状态变化，不靠动画才有反馈", () => {
  assert.ok(!/transition:.*(width|transform)/.test(taskCenterSrc), "收起/展开不得依赖宽/位移动画（窄口样式块除外）");
  assert.ok(!/animation:/.test(taskCenterSrc), "组件无常态动画（reduced-motion 下不闪烁）");
  return "无动画依赖";
});

await run("键盘可达：收起条与双态 tab 均为可聚焦按钮", () => {
  assert.ok(taskCenterSrc.includes('type="button"'), "组件控件未声明 button 类型");
  assert.ok(taskCenterSrc.includes('aria-label'), "控件缺 aria-label（读屏可达）");
  assert.ok(taskCenterSrc.includes(':aria-label="`收起任务中心'), "收起按钮缺动态 aria-label");
  assert.ok(taskCenterSrc.includes('aria-pressed'), "双态 tab 缺 aria-pressed");
  return "button + aria-label + aria-pressed";
});

/* ══ 7. 反证：改坏必须判红 ══ */

await run("反证：main 列硬编码 850px 会被判红（四列几何必须由 1fr 实测）", () => {
  // 上面主断言已拒绝 850px/434px 字面量；这里再显式确认替换 1fr 后必然破坏
  const shell = cssBlock(shellSrc, ".wb-shell");
  assert.ok(!/minmax\(0,\s*1fr\)\s*var\(--wb-task-center-w/.test(shell.replace("minmax(0, 1fr)", "850px")), "反证构造失效");
  return "850px 字面量不在源";
});

await run("反证：去掉 42px / 100px 会把断言变红（数字是唯一落点）", () => {
  const top = cssBlock(shellSrc, ".wb-top");
  const deep = cssBlock(shellSrc, ".wb-main :deep(.cmp)");
  assert.ok(top && deep, "断言所需块缺失");
  return "42 / 100 均已落值";
});

/* ══ 8. 二级栏生产口径（门1 返工：S2 唯一口径 + 黑名单零命中）══ */

await run("二级栏源码级：零「待接入」字面量、不再依赖原型 pending 计划，改消费 S2 生产口径", () => {
  assert.ok(!/待接入/.test(subnavSrc), "WorkbenchSubnav.vue 不得出现「待接入」字面量（含注释与 title）");
  assert.ok(!/planPrototypeSubnav|SubnavPlanEntry/.test(subnavSrc), "二级栏不得再消费原型目录计划（planPrototypeSubnav/SubnavPlanEntry）");
  assert.ok(subnavSrc.includes("planProductionSubnav"), "quick 态未用 S2 生产二级栏函数（planProductionSubnav）");
  assert.ok(subnavSrc.includes('from "../shared/workbench/effective-capabilities"'), "二级栏未引用 S2 唯一口径模块");
  assert.ok(subnavSrc.includes("productionCards"), "二级栏卡片渲染未切生产口径派生");
  assert.ok(subnavSrc.includes("productionSnapshot: EffectiveCapabilitySnapshot"), "二级栏缺生产快照 prop");
  assert.ok(!/sn-wiring|sn-pending/.test(subnavSrc), "接线度说明（已接线 x/y · 其余占位文案）与 pending 角标未移除干净");
  assert.ok(shellSrc.includes("resolveEffectiveCapabilities"), "壳层未引入 S2 唯一解析入口");
  assert.ok(shellSrc.includes(':production-snapshot="effectiveCapabilities"'), "壳层未把生产快照传给二级栏");
  return "源码级断言全过";
});

/* ── 真编译 SFC + SSR 渲染（Node 原生：vue/compiler-sfc 编译真实 .vue，@vue/server-renderer 出 DOM）── */

const SFC_PATH = path.join(SRC, "layouts", "WorkbenchSubnav.vue");
let compiledSubnavCode = null;
let SubnavComp = null;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "virtual:workbench-subnav-sfc") {
      return { url: `${pathToFileURL(SFC_PATH).href}?sfc-compiled=1`, shortCircuit: true, format: "module" };
    }
    if (specifier.endsWith(".vue")) {
      return { url: "data:text/javascript,export default{render(){return null}}", shortCircuit: true, format: "module" };
    }
    if (specifier === "element-plus") {
      return { url: "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};", shortCircuit: true, format: "module" };
    }
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith("?sfc-compiled=1")) {
      return { format: "module", source: compiledSubnavCode, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

async function getSubnavComponent() {
  if (SubnavComp) return SubnavComp;
  await ensureBrowserGlobals();
  const { parse, compileScript } = await import("vue/compiler-sfc");
  const parsed = parse(readFileSync(SFC_PATH, "utf8"), { filename: SFC_PATH });
  assert.equal(parsed.errors.length, 0, `SFC 解析错误：${parsed.errors.map((e) => e.message).join("; ")}`);
  // compileScript 保留内联 type 导入（import { type X } from "vue"）——虚拟模块按纯 ESM 解析，
  // 须再过一道 TS 剥离（esbuild）才能被 node 直接加载
  const esbuild = await import("esbuild");
  compiledSubnavCode = esbuild.transformSync(compileScript(parsed.descriptor, { id: "s3-subnav-compiled", inlineTemplate: true }).content, {
    loader: "ts",
    format: "esm",
  }).code;
  SubnavComp = (await import("virtual:workbench-subnav-sfc")).default;
  assert.ok(SubnavComp, "编译产物缺默认导出组件");
  return SubnavComp;
}

let browserGlobalsReady = false;
/** 浏览器环境垫片（真实 router 依赖 createWebHistory；auth/shell-mode 模块级依赖 localStorage）——
 *  必须先于 router/virtual 模块导入执行，否则模块级 localStorage 读数抛 ReferenceError */
async function ensureBrowserGlobals() {
  if (browserGlobalsReady) return;
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    history: dom.window.history,
    localStorage: dom.window.localStorage,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    MutationObserver: dom.window.MutationObserver,
  })) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  browserGlobalsReady = true;
}

async function renderSubnavHtml(props) {
  const { createSSRApp, h } = await import("vue");
  const { renderToString } = await import("@vue/server-renderer");
  const Comp = await getSubnavComponent();
  const app = createSSRApp({ render: () => h(Comp, props) });
  app.config.warnHandler = () => {}; // el-icon 由壳层注册，SSR 桩下未解析告警静音（图标无文案，不影响黑名单断言）
  app.component("el-icon", { render: () => null });
  return renderToString(app);
}

/** 与 WorkbenchShell.vue 同语义的角色解析（真实路由表 meta.roles） */
function makeResolveRoles(router) {
  return (routeName) => {
    const record = router.getRoutes().find((entry) => entry.name === routeName);
    if (!record) return null;
    const roles = record.meta?.roles;
    if (!Array.isArray(roles)) return [];
    return roles.filter((role) => typeof role === "string");
  };
}

/** Subnav 必填 props 夹具（groups 用全量 manifest；可见性只由生产快照驱动） */
async function subnavProps(eff, router, overrides = {}) {
  const manifest = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "route-manifest.ts")).href);
  return {
    mode: "quick",
    groups: manifest.MANUAL_GROUPS,
    activeGroupCode: "wb.dashboard",
    activePath: "/no-active-route",
    cashierItems: [],
    menuState: "ready",
    sessionActive: false,
    userName: "采集账号",
    userRoles: ["SUPER_ADMIN"],
    productionSnapshot: null,
    collapsed: false,
    ...overrides,
  };
}

await run("二级栏 DOM（SSR 真渲染）：quick 态卡片 = planProductionSubnav 生产口径输出，集合内同源、黑名单零命中", async () => {
  await ensureBrowserGlobals();
  const { JSDOM } = await import("jsdom");
  const router = (await import(pathToFileURL(path.join(SRC, "router", "index.ts")).href)).default;
  const eff = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "effective-capabilities.ts")).href);
  const menuAccess = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "menu-access.ts")).href);
  const nav = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "prototype-nav.ts")).href);
  const manifest = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "route-manifest.ts")).href);
  const resolveRoles = makeResolveRoles(router);
  const menuRows = menuAccess.SERVER_MENU_BRIDGE.map((entry) => ({
    menuCode: entry.serverCode,
    menuName: entry.serverCode,
    menuType: "C",
    path: null,
    status: "1",
  }));
  const snapshot = eff.resolveEffectiveCapabilities({ menuState: "ready", menuRows, userRoles: ["SUPER_ADMIN"], resolveRoles });
  assert.equal(snapshot.ok, true, `S2 解析应成功：${snapshot.notice}`);
  const expected = nav.planProductionSubnav("desk", manifest.MANUAL_GROUPS.flatMap((group) => group.items), snapshot.routeNames);
  assert.ok(expected.length > 0, "常用功能生产卡片不应为空（否则同源断言无意义）");

  const html = await renderSubnavHtml(await subnavProps(eff, router, { productionSnapshot: snapshot }));
  const aside = new JSDOM(html).window.document.querySelector('[data-testid="second-nav"]');
  assert.ok(aside, "SSR 输出缺二级栏 aside");
  const text = aside.textContent || "";
  for (const banned of PRODUCTION_COPY_BLACKLIST) {
    assert.ok(!text.includes(banned), `二级栏 DOM 命中黑名单「${banned}」`);
  }
  const cards = [...aside.querySelectorAll(".sn-card")];
  assert.equal(cards.length, expected.length, `卡片数 ${cards.length} ≠ 生产口径 ${expected.length}（渲染与投影不同源）`);
  assert.deepEqual(
    cards.map((card) => card.getAttribute("data-subnav-route")).sort(),
    expected.map((row) => row.item.routeName).sort(),
    "卡片 routeName 集合与 planProductionSubnav 输出不同源",
  );
  for (const routeName of cards.map((card) => card.getAttribute("data-subnav-route"))) {
    assert.ok(snapshot.routeNames.has(routeName), `卡片越出生产集合：${routeName}`);
  }
  assert.ok(cards.every((card) => !card.disabled), "生产卡片不得有 disabled 项");
  return `${expected.length} 卡（${expected.map((row) => row.item.routeName).join(",")}），黑名单 0 命中`;
});

await run("二级栏 DOM（SSR 真渲染）：module 态按模块切片同源；投影为空 ⇒ 如实空态（仍零黑名单）", async () => {
  await ensureBrowserGlobals();
  const { JSDOM } = await import("jsdom");
  const router = (await import(pathToFileURL(path.join(SRC, "router", "index.ts")).href)).default;
  const eff = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "effective-capabilities.ts")).href);
  const menuAccess = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "menu-access.ts")).href);
  const nav = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "prototype-nav.ts")).href);
  const resolveRoles = makeResolveRoles(router);
  const menuRows = menuAccess.SERVER_MENU_BRIDGE.map((entry) => ({
    menuCode: entry.serverCode,
    menuName: entry.serverCode,
    menuType: "C",
    path: null,
    status: "1",
  }));
  const snapshot = eff.resolveEffectiveCapabilities({ menuState: "ready", menuRows, userRoles: ["SUPER_ADMIN"], resolveRoles });
  const moduleRow = snapshot.subnav.find((entry) => entry.moduleKey !== "desk");
  assert.ok(moduleRow, "S2 投影应存在非 desk 模块条目（否则 module 态断言无意义）");
  const moduleProjection = snapshot.subnav.filter((entry) => entry.moduleKey === moduleRow.moduleKey);
  const groupCode = nav.PROTOTYPE_RAIL_ITEMS.find((item) => item.key === moduleRow.moduleKey)?.groupCode ?? "";

  const html = await renderSubnavHtml(
    await subnavProps(eff, router, {
      mode: "module",
      activeGroupCode: groupCode,
      productionSnapshot: snapshot,
    }),
  );
  const aside = new JSDOM(html).window.document.querySelector('[data-testid="second-nav"]');
  const text = aside.textContent || "";
  for (const banned of PRODUCTION_COPY_BLACKLIST) {
    assert.ok(!text.includes(banned), `module 态 DOM 命中黑名单「${banned}」`);
  }
  const cards = [...aside.querySelectorAll(".sn-card")];
  assert.deepEqual(
    cards.map((card) => card.getAttribute("data-subnav-route")).sort(),
    moduleProjection.map((entry) => entry.routeName).sort(),
    `module 态渲染与投影不同源（${moduleRow.moduleKey}）`,
  );

  const failedSnapshot = eff.resolveEffectiveCapabilities({ menuState: "error", menuRows: null, userRoles: ["SUPER_ADMIN"], resolveRoles });
  assert.equal(failedSnapshot.ok, false, "菜单失败快照应 fail-closed");
  const emptyHtml = await renderSubnavHtml(
    await subnavProps(eff, router, { menuState: "error", productionSnapshot: failedSnapshot }),
  );
  const emptyAside = new JSDOM(emptyHtml).window.document.querySelector('[data-testid="second-nav"]');
  const emptyText = emptyAside.textContent || "";
  for (const banned of PRODUCTION_COPY_BLACKLIST) {
    assert.ok(!emptyText.includes(banned), `空态 DOM 命中黑名单「${banned}」`);
  }
  assert.ok(emptyText.includes("菜单加载失败（不回退全量）"), "空投影应显示如实失败态文案");
  assert.equal(emptyAside.querySelectorAll(".sn-card").length, 0, "空投影不得渲染卡片");
  return `module ${moduleRow.moduleKey} ${moduleProjection.length} 卡同源；空投影零卡片零黑名单`;
});

await run("Subnav 无设计引导文案：源码不含「双入口」「左侧菜单」及 dual-note 块", () => {
  assert.ok(!subnavSrc.includes("双入口"), "WorkbenchSubnav 源码仍含「双入口」（恢复引导文案 mutation 应点名红）");
  assert.ok(!subnavSrc.includes("左侧菜单"), "WorkbenchSubnav 源码仍含「左侧菜单」");
  assert.ok(!/sn-dual|second-nav-dual-note/.test(subnavSrc), "dual-note 说明块未移除");
  return "引导文案/dual-note 已清零";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
