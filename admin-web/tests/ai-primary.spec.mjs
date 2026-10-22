/**
 * WORKBENCH-03 断言用例 —— AI 数字员工主交互面 / 能力台账 / 故障隔离
 *
 * 覆盖派单卡硬验收：
 *   ③ 能力台账与 P0 AI 功能矩阵逐项对账；状态总数守恒；LIVE 有可复跑真实接口依据
 *   ④ AI 故障下人工模式可进入并打开既有业务页面，不出现白屏/无限重试
 *   ⑤ 不接 /api/admin/menus/user，不实现业务写动作确认链
 *   ⑥ 反测两侧齐：能力状态被洗成 LIVE、AI 故障不提供人工保底 → 本用例必须变红
 *
 * 运行（admin-web 目录）：npm test
 * 说明：沿用 role-guard.spec.mjs 的 Node 原生 TS 剥离 + 模块钩子方案（不依赖 vitest/esbuild）。
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const REPO_ROOT = path.join(here, "..", "..");
const BASELINE = "d7e7cc6e96299dd0465614b070acd956a3cbe76b";

const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS =
  "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    if (specifier === "element-plus") return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});

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

const { default: router } = await import("../src/router/index.ts");
const { MANUAL_GROUPS, CASHIER_ITEMS, filterVisibleGroups, filterVisibleItems } = await import(
  "../src/shared/workbench/route-manifest.ts"
);
const {
  CAPABILITIES,
  QUICK_COMMANDS,
  countCapabilitiesByStatus,
  isCapabilityEnabled,
  getCapability,
} = await import("../src/shared/workbench/capability-registry.ts");

const EXPECTED_TOTAL = 19;
const EXPECTED_COUNTS = { LIVE: 1, PARTIAL: 12, PLANNED: 6, BLOCKED: 0 };

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

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
}

/** 递归收集源码文件（判断调用点唯一性用） */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|vue|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function resolveRoles(routeName) {
  const record = router.getRoutes().find((entry) => entry.name === routeName);
  if (!record) return null;
  const roles = record.meta?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role) => typeof role === "string");
}

await run("能力台账结构：19 项，ID/矩阵行号连续且唯一", () => {
  assert.equal(CAPABILITIES.length, EXPECTED_TOTAL, "能力条数应为 19");
  const ids = CAPABILITIES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "能力 ID 不得重复");
  CAPABILITIES.forEach((entry, index) => {
    assert.equal(entry.id, `ai-${String(index + 1).padStart(2, "0")}`, "ID 应按 ai-01…ai-19 连续");
    assert.equal(entry.matrixRow, index + 1, "matrixRow 应与明细行号一致");
    assert.ok(entry.group, `${entry.id} 缺少分区`);
    assert.ok(entry.realAction, `${entry.id} 缺少真实动作/接口说明`);
  });
  return "ai-01…ai-19 / matrixRow 1…19";
});

await run("状态守恒：LIVE 1 / PARTIAL 12 / PLANNED 6 / BLOCKED 0", () => {
  const counts = countCapabilitiesByStatus();
  assert.deepEqual(counts, EXPECTED_COUNTS, `状态计数应为 ${JSON.stringify(EXPECTED_COUNTS)}`);
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(sum, EXPECTED_TOTAL, "状态总数应守恒为 19");
  return "1+12+6+0=19";
});

await run("P0 矩阵对账：逐行比对标题与状态", () => {
  const matrixPath = path.join(REPO_ROOT, "docs", "evidence", "WB-REFACTOR-P0", "20-ai-feature-matrix.md");
  assert.ok(existsSync(matrixPath), "P0 矩阵文件应存在");
  const rows = readFileSync(matrixPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()));
  assert.equal(rows.length, EXPECTED_TOTAL, `矩阵明细应为 19 行，实际 ${rows.length}`);
  for (const cells of rows) {
    const rowNo = Number(cells[1]);
    const title = cells[2];
    const status = cells.slice(2).find((cell) => /^(LIVE|PARTIAL|PLANNED|BLOCKED)$/.test(cell));
    const entry = CAPABILITIES.find((item) => item.matrixRow === rowNo);
    assert.ok(entry, `台账缺少矩阵第 ${rowNo} 行`);
    assert.equal(
      entry.title.replace(/\s+/g, ""),
      title.replace(/\s+/g, ""),
      `#${rowNo} 标题应与矩阵一致`,
    );
    assert.equal(entry.status, status, `#${rowNo} 状态应与矩阵一致（矩阵 ${status}）`);
  }
  return "19 行标题/状态全量一致";
});

await run("LIVE 依据：ai-08 端点 + 挂载中的真实调用点", () => {
  const live = CAPABILITIES.filter((entry) => entry.status === "LIVE");
  assert.equal(live.length, 1, "LIVE 应仅有 1 项");
  assert.match(live[0].realAction, /\/api\/chat\/confirmations\//, "LIVE 应写明确认端点");
  const api = read("api/ai.ts");
  for (const endpoint of [
    "/api/chat/confirmations/${encodeURIComponent(confirmationId)}/confirm",
    "/api/chat/confirmations/${encodeURIComponent(confirmationId)}/cancel",
    "/api/chat/operations/${encodeURIComponent(operationId)}/revoke",
  ]) {
    assert.ok(api.includes(endpoint), `api/ai.ts 缺少端点 ${endpoint}`);
  }
  const panel = read("components/AiChat/AiSidePanel.vue");
  for (const fn of ["confirmAiOperation", "cancelAiOperation", "revokeAiOperation"]) {
    assert.ok(panel.includes(`${fn}(id)`) || panel.includes(`await ${fn}(`), `AiSidePanel 缺少 ${fn} 调用`);
  }
  return "confirm/cancel/revoke 有真实调用点";
});

await run("PLANNED：必填缺失原因且 UI 禁用，不伪造入口", () => {
  const planned = CAPABILITIES.filter((entry) => entry.status === "PLANNED");
  assert.equal(planned.length, 6, "PLANNED 应为 6 项");
  for (const entry of planned) {
    assert.ok(entry.missingReason && entry.missingReason.length > 6, `${entry.id} 缺少缺失原因`);
    assert.equal(isCapabilityEnabled(entry.status), false, `${entry.id} PLANNED 不应可交互`);
  }
  const feed = read("components/workbench/AiFeedContainer.vue");
  assert.ok(feed.includes("isCapabilityEnabled(capability.status)"), "台账应使用统一可用性判定");
  assert.ok(feed.includes("is-disabled"), "PLANNED 应有禁用样式");
  assert.ok(feed.includes("missingReason"), "PLANNED 应展示缺失原因");
  return "6 项待建设全部禁用并给出原因";
});

await run("无 mock：AI 主交互面无随机数/模拟数据/演示数字", () => {
  const files = [
    "shared/workbench/capability-types.ts",
    "shared/workbench/capability-entries-a.ts",
    "shared/workbench/capability-entries-b.ts",
    "shared/workbench/capability-registry.ts",
    "components/workbench/AiFeedContainer.vue",
    "components/workbench/AiChatPanel.vue",
  ];
  const banned = ["Math.random", "mock", "Mock", "fake", "假数据", "示例数据", "随机"];
  for (const rel of files) {
    const text = read(rel);
    for (const word of banned) {
      assert.ok(!text.includes(word), `${rel} 不得出现「${word}」`);
    }
  }
  return `${files.length} 文件零命中`;
});

await run("单一对话实现：AI 主交互面不复制第二套对话", () => {
  const duplicated = walk(SRC)
    .filter((file) => /(components[\\/]workbench|layouts)[\\/]/.test(file))
    .filter((file) => readFileSync(file, "utf8").includes("sendChatMessage("))
    .map((file) => path.relative(SRC, file).replace(/\\/g, "/"));
  assert.deepEqual(duplicated, [], `AI 主交互面不得直接调用对话接口，实际 ${duplicated}`);
  assert.ok(
    read("components/workbench/AiChatPanel.vue").includes("../AiChat/AiSidePanel.vue"),
    "AiChatPanel 应复用现有 AiSidePanel",
  );
  return "0 套新对话实现";
});

await run("约束：不接动态菜单，不新增 AI 写动作确认链", () => {
  const files = [
    "shared/workbench/capability-entries-a.ts",
    "shared/workbench/capability-entries-b.ts",
    "shared/workbench/capability-registry.ts",
    "components/workbench/AiFeedContainer.vue",
    "components/workbench/AiChatPanel.vue",
    "layouts/WorkbenchShell.vue",
  ];
  for (const rel of files) {
    const text = read(rel);
    assert.ok(!/["'`]\/admin\/menus\/user/.test(text), `${rel} 不得调用动态菜单`);
    for (const call of ["confirmAiOperation(", "cancelAiOperation(", "revokeAiOperation("]) {
      assert.ok(!text.includes(call), `${rel} 不得新增写动作确认链调用 ${call}`);
    }
  }
  return "6 文件零命中";
});

await run("AI 故障隔离：明确状态 + 一键回人工 + 人工路由不受阻", () => {
  const panel = read("components/workbench/AiChatPanel.vue");
  assert.ok(panel.includes("切换人工操作台"), "故障横幅应有切人工入口");
  assert.ok(panel.includes("emit('fallback')") || panel.includes('emit("fallback")'), "应 emit fallback");
  assert.ok(panel.includes('role="alert"'), "故障应有 alert 语义");
  const shell = read("layouts/WorkbenchShell.vue");
  assert.ok(shell.includes('@fallback="switchMode(\'human\')"'), "壳层应把 fallback 接到人工模式");
  assert.ok(shell.includes("<router-view />"), "人工模式必须保留 router-view");
  assert.ok(!/v-if=[^>]*\n?\s*<router-view/.test(shell), "router-view 不得被 AI 状态条件渲染");
  for (const banned of ["setInterval", "while (true)", "autoRetry"]) {
    assert.ok(!panel.includes(banned), `故障逻辑不得出现 ${banned}（无限重试）`);
  }
  return "alert + 切人工 + 人工路由无条件渲染";
});

await run("权限继承：AI 模式入口 = 角色可见项，收银 9 项不变", () => {
  const countFor = (roles) =>
    filterVisibleGroups(MANUAL_GROUPS, roles, resolveRoles).reduce((sum, g) => sum + g.items.length, 0);
  assert.equal(countFor(["SUPER_ADMIN"]), 71, "SUPER_ADMIN 人工入口应为 71");
  assert.equal(countFor(["STORE_MANAGER"]), 23, "STORE_MANAGER 人工入口应为 23");
  assert.equal(countFor(["STORE_OPERATOR"]), 0, "STORE_OPERATOR 不应看到人工入口");
  assert.equal(filterVisibleItems(CASHIER_ITEMS, ["STORE_OPERATOR"], resolveRoles).length, 9, "收银 9 项");
  const shell = read("layouts/WorkbenchShell.vue");
  assert.ok(shell.includes(':items="activeGroupItems"'), "AI 主交互面入口应来自角色过滤后的分组");
  return "71 / 23 / 0 + 收银 9";
});

await run("快捷指令：3 条，走真实对话（不新建指令端点）", () => {
  assert.equal(QUICK_COMMANDS.length, 3, "快捷指令应为 3 条");
  for (const command of QUICK_COMMANDS) {
    const entry = getCapability(command.capabilityId);
    assert.ok(entry, `指令 ${command.label} 缺少能力登记`);
    assert.notEqual(entry.status, "PLANNED", `${command.label} 不应指向待建设能力`);
  }
  const feed = read("components/workbench/AiFeedContainer.vue");
  assert.ok(feed.includes("emit('command', command.prompt)"), "主交互面应发出真实指令");
  const shell = read("layouts/WorkbenchShell.vue");
  assert.ok(shell.includes("@command=\"sendQuickCommand\""), "壳层应转发指令到会话面板");
  const panel = read("components/workbench/AiChatPanel.vue");
  assert.ok(panel.includes("sendQuickCommand"), "会话面板应暴露 sendQuickCommand");
  const side = read("components/AiChat/AiSidePanel.vue");
  assert.ok(side.includes("defineExpose({ sendText: sendSuggestion"), "AiSidePanel 应复用真实发送逻辑");
  return "3 条指令复用 POST /api/chat";
});

await run("业务冻结面：views / backend 相对基线零改动", () => {
  const changed = execSync(`git diff --name-only ${BASELINE} -- admin-web/src/views backend`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
  assert.equal(changed, "", `views/backend 不得改动，实际：${changed}`);
  return "0 文件";
});

const failed = results.filter((result) => !result.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
