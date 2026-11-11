/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · Mutation 门禁（源码精确断言）
 *
 * 为 M1-M10 反测提供**精确点名**的源码断言集（允许路径 admin-web/e2e/prototype12-*）。
 * 每个 gate 输出 PASS/FAIL 点名行，exit=0 全绿 / exit=1 有红。
 * 用途：mutation 装置注入真实缺陷 → 本门禁点名红 → 逐字节复原 → 本门禁回绿。
 *
 * 运行（worktree 根）：node admin-web/e2e/prototype12-mutation-gates.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");

const results = [];
function gate(name, fn) {
  try {
    const d = fn();
    results.push({ name, ok: true, detail: d });
    console.log(`PASS  ${name}${d ? `  ← ${d}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

/** 剥注释，只留产品可见字符串/可执行代码 */
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

// ── M1：AiFeedView 产品可见模板不得含「双入口左侧菜单」──
gate("M1/R11：AiFeedView 可见模板无「双入口左侧菜单」", () => {
  const src = stripComments(read("components/workbench/AiFeedView.vue"));
  const tpl = src.match(/<template>([\s\S]*?)<\/template>/)?.[1] ?? "";
  assert.ok(tpl.includes('data-testid="daily-op-title"'), "AiFeedView 缺 daily-op-title（模板定位失败）");
  assert.ok(!tpl.includes("双入口左侧菜单"), "AiFeedView 产品可见模板命中「双入口左侧菜单」");
  return "可见模板黑名单 0 命中";
});

// ── M2：任务中心无原型演示员工/店名 ──
gate("M2/R05+R11：任务中心无原型演示员工（红星商行/张三/王强/李四）", () => {
  const src = read("components/workbench/WorkbenchTaskCenter.vue");
  for (const demo of ["红星商行", "张三", "王强", "李四"]) {
    assert.ok(!src.includes(demo), `任务中心含原型演示数据「${demo}」`);
  }
  return "演示姓名零命中";
});

// ── M3：quickEntry 必须与 entries 同源（唯一集合）──
gate("M3/R09：quickEntry 投影 = entries 全量（不各自裁剪）", () => {
  const src = read("shared/workbench/effective-capabilities.ts");
  assert.ok(src.includes("const quickEntry = entries;"), "quickEntry 不再 = entries 全量（集合被各自裁剪）");
  return "quickEntry = entries 同源";
});

// ── M4：菜单 error 必须 fail-closed（不回退全量）──
gate("M4/R10：菜单 error 态 fail-closed（emptySnapshot + 不回退全量文案）", () => {
  const src = read("shared/workbench/effective-capabilities.ts");
  const branch = src.match(/if \(input\.menuState === "error"\) \{([\s\S]*?)\n  \}/);
  assert.ok(branch, "菜单 error 分支缺失");
  assert.ok(branch[1].includes('"menu-error"'), "error 分支不再 emptySnapshot(\"menu-error\")（回退全量）");
  assert.ok(branch[1].includes("已按最小可见集处理"), "error 分支不再 fail-closed 文案（回退全量）");
  return "menu-error emptySnapshot 在位（error 分支局部断言）";
});

// ── M5：planProductionSubnav 过滤未接线（pending）目录项 ──
gate("M5/R11+导航：planProductionSubnav 过滤 pending 未接线项", () => {
  const src = read("shared/workbench/prototype-nav.ts");
  assert.ok(
    src.includes('entry.status !== "wired"') && src.includes("!effectiveRouteNames.has(routeName)"),
    "planProductionSubnav 不再过滤未接线(pending)/未授权目录项（恢复待接入卡）",
  );
  return "wired + 授权双过滤在位";
});

// ── M6：任务中心收起/展开按钮齐全（strip/expand/collapse）──
gate("M6/R01+R02+R04：任务中心收起条/展开/收起按钮齐全", () => {
  const src = read("components/workbench/WorkbenchTaskCenter.vue");
  for (const testid of ['data-testid="task-center-strip"', 'data-testid="task-center-expand"', 'data-testid="task-center-collapse"']) {
    assert.ok(src.includes(testid), `缺收起交互控件 ${testid}`);
  }
  assert.ok(src.includes('@click="emit(\'toggle\')"'), "收起条未发 toggle 事件");
  return "strip + expand + collapse + toggle 齐全";
});

// ── M7：顶部计数必须走 deriveTaskCenterCounts 派生，不固定 0 ──
gate("M7/R05+R08：任务中心顶部计数走 counts 派生（不固定 0/演示数字）", () => {
  const src = read("components/workbench/WorkbenchTaskCenter.vue");
  assert.ok(src.includes("deriveTaskCenterCounts"), "任务中心不再消费 deriveTaskCenterCounts（顶部计数脱离真实源）");
  assert.ok(!/return 0;\s*\/\/ MUTATION-M7/.test(src), "顶部计数固定 0（假 0 禁止）");
  assert.ok(!/Math\.random\(/.test(src), "顶部计数使用随机数伪造");
  return "deriveTaskCenterCounts 派生 + 无固定 0/随机数";
});

// ── M8：AiChatPanel 无第二输入控件 ──
gate("M8/R03：AiChatPanel 无输入控件（输入单源于 AiSidePanel）", () => {
  const src = read("components/workbench/AiChatPanel.vue");
  assert.ok(!/<el-input|<input\s/.test(src), "AiChatPanel 出现第二套输入控件（输入必须单源）");
  return "无 el-input/<input";
});

// ── M9：confirmations 解析必须含 {total,items} 分支 ──
gate("M9/R06：parseConfirmationsPayload 保留 {total,items} 现行形态分支", () => {
  const src = read("shared/workbench/task-center.ts");
  assert.ok(
    src.includes("Array.isArray(payload.items)") && src.includes('return fromRows(payload.items, "items", reportedTotal);'),
    "confirmations 解析不再读 items 键（现行 {total,items} 形态被破坏）",
  );
  return "items 分支在位";
});

// ── M10：真实渲染点 router-view 无条件常驻（无 v-if）──
gate("M10/R13：WorkbenchShell 真实渲染点 router-view 无条件常驻", () => {
  const src = read("layouts/WorkbenchShell.vue");
  // 先剥注释：模板注释里有对 <router-view> 的文字引用（含「不加 v-if」），必须只查真实渲染点
  const tpl = stripComments(src).match(/<template>([\s\S]*?)<\/template>/)?.[1] ?? "";
  assert.ok(tpl.includes("<router-view"), "模板缺 router-view 渲染点");
  const rvIdx = tpl.indexOf("<router-view");
  const seg = tpl.slice(rvIdx, rvIdx + 40);
  assert.ok(!/v-if/.test(seg), "router-view 渲染点被条件渲染包裹（AI 故障时人工页被隐藏）");
  assert.ok(/<router-view\s*\/>/.test(tpl), "router-view 不是自闭合常驻");
  return "真实渲染点无条件自闭合（剥注释后定位）";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
