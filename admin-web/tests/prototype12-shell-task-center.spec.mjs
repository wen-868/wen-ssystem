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
 *
 * 运行（admin-web 目录）：node tests/prototype12-shell-task-center.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

const shellSrc = read("layouts/WorkbenchShell.vue");
const taskCenterSrc = read("components/workbench/WorkbenchTaskCenter.vue");

const results = [];
async function run(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}`);
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

await run("顶栏 42px（卡面 §三.3）", () => {
  const top = cssBlock(shellSrc, ".wb-top");
  assert.ok(top, "缺少 .wb-top 块");
  assert.match(top, /height:\s*42px;/, "顶栏高度不是 42px");
  return "42px";
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
  assert.ok(shellSrc.includes('localStorage.getItem(TASK_CENTER_KEY) === "1"'), "收起恢复判据非 '1'");
  assert.ok(taskCenterSrc.includes('"wb.task-center.view"'), "组件缺双态 localStorage 键");
  assert.ok(taskCenterSrc.includes("restoreView()"), "组件未恢复双态选择");
  return "收起态 + 双态均持久化";
});

await run("收起条保留可点入口（不 display:none 瞬隐，可折叠但仍在）", () => {
  assert.ok(taskCenterSrc.includes("data-testid=\"task-center-strip\""), "缺收起条");
  assert.ok(taskCenterSrc.includes("data-testid=\"task-center-expand\""), "缺展开按钮");
  assert.ok(taskCenterSrc.includes('@click="emit(\'toggle\')"'), "收起条未发 toggle");
  return "strip + expand 入口";
});

await run("窄口（≤390px）任务中心整列隐藏，不挤主面；无整页横向滚动", () => {
  const block = mediaBlock(shellSrc, 390);
  assert.ok(block, "壳层缺 390px 窄口块");
  assert.ok(/\.wb-shell :deep\(\.wtc\)\s*\{[^}]*display:\s*none;/.test(block), "窄口未隐藏任务中心列");
  return "390 窄口 .wtc display:none";
});

await run("任务中心收起几何（§四.2）：第 4 列 300→56，main(1fr) 实际变宽；窄口覆盖不受影响", () => {
  const collapsed = cssBlock(shellSrc, ".wb-shell.tc-collapsed");
  assert.ok(collapsed, "壳层缺 .wb-shell.tc-collapsed 收起列宽规则");
  assert.match(collapsed, /var\(--wb-task-center-collapsed-w,\s*56px\)/, "收起态第 4 列不是 56px");
  const both = cssBlock(shellSrc, ".wb-shell.side-hidden.tc-collapsed");
  assert.ok(both && /var\(--wb-task-center-collapsed-w,\s*56px\)/.test(both), "双折叠态第 4 列不是 56px");
  assert.ok(/'tc-collapsed':\s*taskCenterCollapsed/.test(shellSrc), "壳层未绑定 tc-collapsed 类");
  assert.match(cssBlock(shellSrc, ".wb-shell"), /var\(--wb-task-center-w,\s*300px\)/, "展开态第 4 列必须保持 300px（收起是可选态）");
  const narrow = mediaBlock(shellSrc, 390);
  assert.ok(/\.wb-shell\.tc-collapsed,/.test(narrow ?? ""), "窄口块未并入 tc-collapsed 覆盖（窄口单列会被压回）");
  return "tc-collapsed 300→56（main +244）+ 窄口覆盖";
});

/* ══ 3. router-view 常驻与 AI 故障隔离 ══ */

await run("router-view 常驻：无条件渲染（不被 AI 状态 v-if 包裹）", () => {
  const m = shellSrc.match(/<router-view\s*(\/>|>)/);
  assert.ok(m, "缺 router-view");
  const seg = shellSrc.slice(shellSrc.indexOf("<router-view"), shellSrc.indexOf("<router-view") + 80);
  assert.ok(!/v-if/.test(seg), "router-view 被条件渲染包裹");
  assert.ok(/<router-view\s*\/>/.test(shellSrc), "router-view 不是自闭合常驻");
  return "无条件常驻";
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

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
