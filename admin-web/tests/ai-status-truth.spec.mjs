/**
 * WORKBENCH-06F1 断言用例 —— AI 状态真实性 + 顶部 Agent 真实数据
 *
 * 覆盖派单卡（docs/tasks/inbox/WORKBENCH-06F1-agent-status-real-endpoints.md）§二.4 / §三：
 *   ① idle ≠ online：状态机只有真实探针 ready 才绿；
 *   ② health ready 才 online；degraded / error / unchecked / checking 一律非绿；
 *   ③ 员工端点：真实调用 + 成功/空数组/异常形状/网络失败四种降级；
 *   ④ 计划端点：真实调用 + 真实进度折算 + 失败降级（不显示假 0）；
 *   ⑤ mutation A/B/C 的**判据侧**（注入验证在 prototype-agent-countertest.mjs）：
 *      - A: 若把 idle 映射回 online ⇒ 本用例必红；
 *      - B: 若删掉 employees 真实调用/改常量 ⇒ 本用例必红；
 *      - C: 若删掉 plans 真实调用/改常量 ⇒ 本用例必红。
 *   ⑥ 结构：顶部三个数据格（AI 状态 / 数字员工 / 任务进度）真实接线，无假分母。
 *
 * 运行（admin-web 目录）：node tests/ai-status-truth.spec.mjs（已串入 npm test）
 * 说明：沿用仓内 harness（Node 原生 TS 剥离 + 模块钩子），不依赖 vitest/esbuild。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

const STUB_ELEMENT_PLUS = "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";
/**
 * 测试环境 shim：`api/ai.ts` 顶层读 `import.meta.env.VITE_AI_BASE_URL`（Vite 注入），
 * Node 原生 ESM 下 `import.meta.env` 为 undefined ⇒ 会抛错。
 * 这是**测试运行环境**差异，不是产品缺陷（产品走 Vite，env 恒有）。
 * 用桩替换该模块，只保留被测代码真正依赖的 `AI_BASE_URL` 常量。
 */
const STUB_AI_API = "data:text/javascript,export const AI_BASE_URL='http://ai.test';export const fetchAiConfirmations=async()=>[];export const sendChatMessage=async()=>{};";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) {
      return { url: "data:text/javascript,export default{render(){return null}}", shortCircuit: true, format: "module" };
    }
    if (specifier === "element-plus") {
      return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    }
    // agent-metrics.ts 以 "../../api/ai" 引入 AI_BASE_URL ⇒ 统一桩掉，避免 import.meta.env
    if (/\/api\/ai(\.ts)?$/.test(specifier)) {
      return { url: STUB_AI_API, shortCircuit: true, format: "module" };
    }
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
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const readiness = await import("../src/shared/workbench/ai-readiness.ts");
const metrics = await import("../src/shared/workbench/agent-metrics.ts");

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
}

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

// ═══════════════════════════════════════════════════════════════════════════
// 一、AI 状态机：idle ≠ online；只有真实 ready 才绿
// ═══════════════════════════════════════════════════════════════════════════

await run("状态机：只有 ready 判绿（isAiOnline 唯一真值）", () => {
  assert.equal(readiness.isAiOnline("ready"), true, "ready 必须判绿");
  for (const state of ["unchecked", "checking", "degraded", "error"]) {
    assert.equal(readiness.isAiOnline(state), false, `${state} 一律不得判绿（红线）`);
  }
  return "ready=true / 其余 4 态=false";
});

await run("状态机：resolveReadiness 真值表（网络失败/CORS/401/形状异常 全非绿）", () => {
  // 真实 ready：body.status=ready 或 X-AI-Readiness=ready
  assert.equal(readiness.resolveReadiness({ httpOk: true, bodyStatus: "ready" }), "ready", "body.status=ready ⇒ ready");
  assert.equal(readiness.resolveReadiness({ httpOk: true, headerStatus: "ready" }), "ready", "header=ready ⇒ ready");
  // degraded：任一信号为 degraded 即 degraded（即便另一个是 ready —— 从严）
  assert.equal(readiness.resolveReadiness({ httpOk: true, bodyStatus: "degraded" }), "degraded");
  assert.equal(
    readiness.resolveReadiness({ httpOk: true, bodyStatus: "ready", headerStatus: "degraded" }),
    "degraded",
    "body/header 冲突时取从严（degraded 优先）",
  );
  // 网络层失败（fetch 抛错 / 超时 / CORS）
  assert.equal(readiness.resolveReadiness({ httpOk: false, networkError: "net::ERR_FAILED" }), "error");
  assert.equal(readiness.resolveReadiness({ httpOk: false, networkError: "aborted" }), "error");
  // HTTP 非 2xx（401/403/5xx —— 注意底座 ready 恒 200，非 200 即异常）
  assert.equal(readiness.resolveReadiness({ httpOk: false, bodyStatus: "ready" }), "error", "非 2xx 不得判绿");
  // 形状异常：既无 body.status 也无 header（例如代理返回 HTML）
  assert.equal(readiness.resolveReadiness({ httpOk: true }), "error", "无任何就绪信号 ⇒ 不得乐观判绿");
  assert.equal(readiness.resolveReadiness({ httpOk: true, bodyStatus: "unknown-value" }), "error", "未知枚举不放行");
  assert.equal(readiness.resolveReadiness({ httpOk: true, bodyStatus: 123 }), "error", "非字符串 status ⇒ error");
  return "8 组判定全部符合（无一条把失败判绿）";
});

await run("状态机：文案纪律 —— 只有 ready 文案允许出现「在线/就绪」", () => {
  assert.match(readiness.readinessLabel("ready"), /就绪|在线/, "ready 文案应表达就绪");
  for (const state of ["unchecked", "checking", "degraded", "error"]) {
    const label = readiness.readinessLabel(state);
    assert.doesNotMatch(label, /在线待命|在线$/, `${state} 文案不得出现「在线」：${label}`);
  }
  return "ready=就绪 / 其余=未检测·检测中·降级·不通";
});

await run("状态机：探针真实走 GET /api/health/ready（源码 + 允许注入 url）", () => {
  const src = read("shared/workbench/ai-readiness.ts");
  assert.ok(src.includes("/api/health/ready"), "必须使用 health/ready 探针");
  assert.ok(src.includes("X-AI-Readiness"), "必须读取 X-AI-Readiness 响应头（契约要求）");
  assert.ok(src.includes("bodyStatus"), "必须读 body.status（契约：不能只看 HTTP 码）");
  assert.ok(src.includes("RETRY_COOLDOWN_MS"), "必须有重试冷却（防请求风暴）");
  assert.ok(src.includes("if (inFlight) return inFlight"), "必须并发去重（防请求风暴）");
  assert.ok(src.includes("AbortController"), "必须有超时（避免悬挂）");
  return "health/ready + 双信号 + 冷却 + 并发去重 + 超时";
});

await run("状态机·实跑：桩 fetch 成功 ready ⇒ 状态转 ready（真调用路径）", async () => {
  readiness.__resetProbeThrottleForTest();
  const calls = [];
  const stubFetch = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === "x-ai-readiness" ? "ready" : null) },
      json: async () => ({ status: "ready" }),
    };
  };
  await readiness.probeAiReadiness({ url: "http://ai.test/api/health/ready", fetchImpl: stubFetch, force: true });
  assert.equal(calls.length, 1, "应真实发起 1 次请求");
  assert.ok(calls[0].includes("/api/health/ready"), `探针路径应含 health/ready：${calls[0]}`);
  assert.equal(readiness.aiReadiness.value.state, "ready", "真实 ready ⇒ 状态 ready");
  assert.equal(readiness.isAiOnline(readiness.aiReadiness.value.state), true);
  return `1 次真实调用 → ready（${calls[0]}）`;
});

await run("状态机·实跑：桩 fetch 网络失败 ⇒ error（绝不假绿）", async () => {
  readiness.__resetProbeThrottleForTest();
  const stubFetch = async () => {
    throw new Error("net::ERR_FAILED");
  };
  await readiness.probeAiReadiness({ url: "http://ai.test/api/health/ready", fetchImpl: stubFetch, force: true });
  assert.equal(readiness.aiReadiness.value.state, "error", "网络失败 ⇒ error");
  assert.equal(readiness.isAiOnline(readiness.aiReadiness.value.state), false, "error 状态必须非绿");
  return "ERR_FAILED ⇒ error / 非绿";
});

await run("状态机·实跑：HTTP 500 + body ready ⇒ error（body 不可信当 HTTP 失败）", async () => {
  readiness.__resetProbeThrottleForTest();
  const stubFetch = async () => ({
    ok: false,
    status: 500,
    headers: { get: () => null },
    json: async () => ({ status: "ready" }),
  });
  await readiness.probeAiReadiness({ url: "http://ai.test/api/health/ready", fetchImpl: stubFetch, force: true });
  assert.equal(readiness.aiReadiness.value.state, "error", "非 2xx ⇒ error（不因 body 而判绿）");
  return "HTTP 500 ⇒ error";
});

await run("状态机·实跑：并发探测只发 1 次请求（防风暴）", async () => {
  readiness.__resetProbeThrottleForTest();
  let calls = 0;
  const stubFetch = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 20));
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === "x-ai-readiness" ? "ready" : null) },
      json: async () => ({ status: "ready" }),
    };
  };
  const p1 = readiness.probeAiReadiness({ url: "http://ai.test/api/health/ready", fetchImpl: stubFetch, force: true });
  const p2 = readiness.probeAiReadiness({ url: "http://ai.test/api/health/ready", fetchImpl: stubFetch, force: true });
  const p3 = readiness.probeAiReadiness({ url: "http://ai.test/api/health/ready", fetchImpl: stubFetch, force: true });
  await Promise.all([p1, p2, p3]);
  assert.equal(calls, 1, `并发 3 次调用应合并为 1 次真实请求，实际 ${calls}`);
  return "3 并发 → 1 请求";
});

// ═══════════════════════════════════════════════════════════════════════════
// 二、员工端点：真实调用 + 四态降级
// ═══════════════════════════════════════════════════════════════════════════

await run("员工：解析成功（数组 ⇒ ready + 真实 count）", () => {
  const metric = metrics.parseEmployeesPayload([
    { id: 1, name: "小播", post: "播报", department: "运营" },
    { id: 2, name: "小审", post: "审单", department: "财务" },
  ]);
  assert.equal(metric.state, "ready");
  assert.equal(metric.count, 2);
  assert.equal(metric.error, null);
  return "2 名员工 ⇒ ready/count=2";
});

await run("员工：空数组 ⇒ ready 且 count=0（真空是真实结果，不是失败）", () => {
  const metric = metrics.parseEmployeesPayload([]);
  assert.equal(metric.state, "ready", "空数组是合法真实结果");
  assert.equal(metric.count, 0, "空数组 count 必须是 0（真实的 0，不是假 0）");
  return "[] ⇒ ready/count=0";
});

await run("员工：异常形状 ⇒ unknown 且 count=null（绝不假 0）", () => {
  for (const payload of [null, undefined, {}, "string", 42, { records: [] }]) {
    const metric = metrics.parseEmployeesPayload(payload);
    assert.equal(metric.state, "unknown", `形状 ${JSON.stringify(payload)} 应 unknown`);
    assert.equal(metric.count, null, `unknown 时 count 必须 null（不得假 0）`);
    assert.ok(metric.error, "unknown 必须给出原因");
  }
  return "6 种异常形状全部 unknown/count=null";
});

await run("员工：真实 HTTP 调用（走 AI_BASE_URL + JWT header），失败 ⇒ unknown", async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), auth: init?.headers?.Authorization ?? null });
    throw new Error("net::ERR_FAILED");
  };
  try {
    metrics.__resetAgentMetricsForTest();
    await metrics.loadAgentEmployees();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(seen.length >= 1, `应真实发起请求，实际 ${seen.length}（state=${metrics.agentEmployees.value.state}, error=${metrics.agentEmployees.value.error}）`);
  assert.ok(seen[0].url.includes("/api/ai/employees"), `应打 /api/ai/employees：${seen[0].url}`);
  assert.equal(metrics.agentEmployees.value.state, "unknown", "网络失败 ⇒ unknown");
  assert.equal(metrics.agentEmployees.value.count, null, "失败时 count 必须 null（不假 0）");
  assert.ok(metrics.agentEmployees.value.error, "失败必须带原因");
  return `${seen.length} 次真实调用 ${seen[0].url.replace(/^https?:\/\/[^/]+/, "")} ⇒ unknown`;
});

await run("员工：JWT 透传（有 token 时必须带 Authorization）", async () => {
  const { useAuthStore } = await import("../src/stores/auth.ts");
  const { setActivePinia, createPinia } = await import("pinia");
  setActivePinia(createPinia());
  useAuthStore().setAuth("header.payload.sig", { realName: "测试" });
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push(init?.headers?.Authorization ?? null);
    return { ok: true, status: 200, json: async () => [] };
  };
  try {
    metrics.__resetAgentMetricsForTest();
    await metrics.loadAgentEmployees();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(seen[0], "Bearer header.payload.sig", "必须携带真实 JWT");
  return "Authorization: Bearer <token> 已透传";
});

// ═══════════════════════════════════════════════════════════════════════════
// 三、计划端点：真实进度折算 + 降级
//    ⚠️ 状态夹具全部取自 AI 底座真实契约 `ZXQL-AI/src/brain/agent/agent.types.ts:14-23`：
//       PlanStepStatus = pending | running | success | failed | suspended | skipped
//       PlanState      = PlanStepStatus
//    WORKBENCH-06F1 曾用后端不存在的 done/completed/succeeded 作夹具（导致 23/23 全绿也证明不了真实契约），
//    WORKBENCH-06F2 已全部改为真实枚举；**测试里不得再出现虚构状态字面量**（下面有护栏用例）。
// ═══════════════════════════════════════════════════════════════════════════

await run("计划·真实契约：success 计划不计进行中、success 步骤计完成、skipped 不计完成", () => {
  const metric = metrics.parsePlansPayload({
    success: true,
    total: 4,
    items: [
      // 运行中计划：2 步成功、1 步运行中、1 步跳过
      {
        id: "p1",
        state: "running",
        steps: [{ status: "success" }, { status: "success" }, { status: "running" }, { status: "skipped" }],
      },
      // 成功终态计划：全部 success ⇒ 不计进行中
      { id: "p2", state: "success", steps: [{ status: "success" }, { status: "success" }] },
      // 失败计划：不计进行中
      { id: "p3", state: "failed", steps: [{ status: "success" }, { status: "failed" }] },
      // 跳过计划：不计进行中
      { id: "p4", state: "skipped", steps: [{ status: "skipped" }] },
    ],
  });
  assert.equal(metric.state, "ready");
  assert.equal(metric.totalPlans, 4);
  assert.equal(metric.runningPlans, 1, "只有 state=running 的 p1 算进行中（success/failed/skipped 都是终态）");
  // 步骤：success 计完成 = p1(2) + p2(2) + p3(1) = 5；总数 = 4+2+2+1 = 9
  assert.equal(metric.stepsDone, 5, "完成只认 status=success");
  assert.equal(metric.stepsTotal, 9, "skipped 也计入总步骤（占位）但不计完成");
  assert.equal(metric.unknownStates, 0, "真实六态不应产生未知状态");
  return "running=1（success/failed/skipped 皆终态）/ steps=5/9（skipped 计总数不计完成）";
});

await run("计划·真实契约：pending / suspended 属非终态（计入进行中，suspended 待人处理）", () => {
  const metric = metrics.parsePlansPayload({
    success: true,
    total: 3,
    items: [
      { id: "p1", state: "pending", steps: [] },
      { id: "p2", state: "suspended", steps: [] },
      { id: "p3", state: "running", steps: [] },
    ],
  });
  assert.equal(metric.runningPlans, 3, "pending/running/suspended 三者均非终态");
  return "pending+suspended+running ⇒ 3（suspended 不算 success，也不当终态丢弃）";
});

await run("计划·真实契约：单条成功计划 ⇒ running=0（B2-1 核心：不得把 success 算成进行中）", () => {
  const metric = metrics.parsePlansPayload({
    success: true,
    total: 1,
    items: [{ id: "p1", state: "success", steps: [{ status: "success" }] }],
  });
  assert.equal(metric.runningPlans, 0, "真实 success 计划必须不计入进行中（旧实现会算成 1）");
  assert.equal(metric.stepsDone, 1, "真实 success 步骤必须计入完成（旧实现会算成 0）");
  assert.equal(metric.stepsTotal, 1);
  return "success 计划 running=0 / steps=1/1 —— 旧缺陷已修";
});

await run("计划·真实契约：非六态的未知状态不被猜（计 unknownStates，不进任何桶）", () => {
  const metric = metrics.parsePlansPayload({
    success: true,
    total: 2,
    items: [
      { id: "p1", state: "done", steps: [{ status: "completed" }] }, // 旧虚构别名，底座不存在
      { id: "p2", state: "running", steps: [{ status: "success" }] },
    ],
  });
  assert.equal(metric.runningPlans, 1, "只认真实 running；未知 state 不猜成进行中");
  assert.equal(metric.stepsDone, 1, "completed 不是底座状态 ⇒ 不计完成");
  assert.equal(metric.stepsTotal, 2, "未知步骤仍占总数（如实计位）");
  assert.equal(metric.unknownStates, 2, "1 个未知 state + 1 个未知 step status = 2");
  return "未知状态不猜：unknownStates=2，不混入 running/stepsDone";
});

await run("计划：无 steps ⇒ 步骤口径置 null（不伪造 0/0）", () => {
  const metric = metrics.parsePlansPayload({
    success: true,
    total: 1,
    items: [{ id: "p1", state: "running", steps: [] }],
  });
  assert.equal(metric.state, "ready");
  assert.equal(metric.stepsTotal, null, "无 steps 时 stepsTotal 必须 null，不得 0");
  assert.equal(metric.stepsDone, null);
  assert.equal(metric.runningPlans, 1, "仍可给出进行中计划数");
  return "steps=null/null（不写 0/0），running=1";
});

await run("计划：success=false ⇒ unknown（底座显式失败）", () => {
  const metric = metrics.parsePlansPayload({ success: false, total: 0, items: [], error: "未认证" });
  assert.equal(metric.state, "unknown", "success=false 不得当 ready");
  assert.equal(metric.totalPlans, null, "失败时不得给 0");
  assert.equal(metric.error, "未认证");
  return "success=false ⇒ unknown/error=未认证";
});

await run("计划：异常形状 ⇒ unknown（不猜数据）", () => {
  for (const payload of [null, undefined, "x", 42, {}, { success: true }]) {
    const metric = metrics.parsePlansPayload(payload);
    assert.equal(metric.state, "unknown", `形状 ${JSON.stringify(payload)} 应 unknown`);
    assert.equal(metric.totalPlans, null);
    assert.equal(metric.runningPlans, null);
  }
  return "6 种异常形状全部 unknown";
});

await run("计划：真实 HTTP 调用（/api/ai/agent/plans），失败 ⇒ unknown", async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), auth: init?.headers?.Authorization ?? null });
    throw new Error("net::ERR_FAILED");
  };
  try {
    metrics.__resetAgentMetricsForTest();
    await metrics.loadAgentPlans();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(seen.length, 1, "应真实发起 1 次请求");
  assert.ok(seen[0].url.includes("/api/ai/agent/plans"), `应打 /api/ai/agent/plans：${seen[0].url}`);
  assert.equal(metrics.agentPlans.value.state, "unknown");
  assert.equal(metrics.agentPlans.value.runningPlans, null, "失败时不得给假 0");
  return `1 次真实调用 ${seen[0].url.replace(/^https?:\/\/[^/]+/, "")} ⇒ unknown`;
});

await run("两源独立降级：员工失败不影响计划成功，反之亦然", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/ai/employees")) throw new Error("employees down");
    return { ok: true, status: 200, json: async () => ({ success: true, total: 1, items: [{ state: "running", steps: [{ status: "success" }] }] }) };
  };
  try {
    metrics.__resetAgentMetricsForTest();
    await metrics.loadAgentTopMetrics();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(metrics.agentEmployees.value.state, "unknown", "员工源应 unknown");
  assert.equal(metrics.agentPlans.value.state, "ready", "计划源应 ready（互不影响）");
  return "employees=unknown / plans=ready（独立降级成立）";
});

// ═══════════════════════════════════════════════════════════════════════════
// 四、结构：顶栏按 UI-PARITY-BASE / DELTA-CONTRACT 收敛（待审阅徽标；无健康探针/步骤计数/台账）
//   口径变更留痕（非静默改断言）：WORKBENCH-PROTOTYPE-12-UI-PARITY-BASE-01 卡 §四.2.5
//   「顶栏仅保留原型业务要素：菜单开关、工作台/收银台、日常经营、待审阅、任务中心开关；
//   移除常驻研发健康指标和无上下文步骤数字」+ interaction-contract.json top_bar.forbidden
//   （研发阶段状态 / 内部健康探针 / 能力台账 / 无上下文步骤计数）。
//   旧三格接线断言与该合同正相反，属已作废旧契约 —— 与 prototype-nav.spec 同类修正。
// ═══════════════════════════════════════════════════════════════════════════

await run("结构：顶栏收敛为待审阅徽标（无健康探针/员工数/步骤计数/台账格）", () => {
  const bar = read("components/workbench/AgentStatusBar.vue");
  assert.ok(bar.includes('data-testid="agent-status-bar"'), "缺 agent-status-bar 容器");
  assert.ok(bar.includes('data-testid="agent-pending-review"'), "缺待审阅徽标");
  for (const banned of ["agent-ai-state", "agent-employees", "agent-plans", "agent-ai-retry", "agent-ledger-entry"]) {
    assert.ok(!bar.includes(`data-testid="${banned}"`), `顶栏不得再出现 ${banned}（UI-PARITY-BASE §四.2.5 / top_bar.forbidden）`);
  }
  // 红线不回退：null = 未取到 ⇒ 徽标整体隐藏（不显示假 0）
  assert.ok(/v-if="pendingReviewCount !== null"/.test(bar), "待审阅徽标必须在 null 时隐藏（不显示假 0）");
  return "徽标容器 + null 隐藏 + 五个旧数据格零残留";
});

await run("结构：壳层顶栏按合同接线（任务中心开关 + 日常经营标题；探针/指标调用移除）", () => {
  const shell = read("layouts/WorkbenchShell.vue");
  assert.ok(shell.includes('data-testid="task-center-toggle"'), "顶栏缺任务中心开关（合同 top_bar.right 唯一右侧业务要素）");
  assert.ok(/aria-pressed/.test(shell), "任务中心开关缺 aria-pressed（可访问性合同）");
  assert.ok(shell.includes("日常经营"), "顶栏标题未落「日常经营」（合同 top_bar.left）");
  // 研发健康指标移出顶栏 ⇒ 壳层不再调用探针/装载顶部指标（模块本身保留）
  assert.ok(!shell.includes("probeAiReadiness"), "壳层不得再调用探针展示（健康指标移出顶栏）");
  assert.ok(!shell.includes("loadAgentTopMetrics"), "壳层不得再装载顶部员工/计划指标");
  assert.ok(!shell.includes("agent-ledger-entry"), "顶栏不得有台账入口（top_bar.forbidden: 能力台账）");
  /**
   * 旧负断言保留（WORKBENCH-06F2 真实负断言）：AgentStatusBar 标签内不得出现 session-state 绑定
   * （B1 假绿根因）。壳层仍渲染 AiFeedView / AiChatPanel，它们合法使用 :session-state，
   * 因此只限定在 AgentStatusBar 标签范围内检查。
   */
  const agentBarTag = shell.match(/<AgentStatusBar\b[\s\S]*?\/>/);
  assert.ok(agentBarTag, "壳层必须渲染 <AgentStatusBar>");
  assert.ok(
    !/:(session-state|sessionState)\b/.test(agentBarTag[0]),
    `AgentStatusBar 不得接 session-state（B1 假绿根因）；实际标签：${agentBarTag[0].replace(/\s+/g, " ")}`,
  );
  return "任务中心开关 + 日常经营标题 + 探针/指标/台账移除 + 无 session-state（真实负断言）";
});

await run("结构：能力台账 ai-06 文案已改为真实情况（不再是「无真实端点」）", () => {
  const entries = read("shared/workbench/capability-entries-a.ts");
  const ai06 = entries.slice(entries.indexOf('id: "ai-06"'), entries.indexOf('id: "ai-07"'));
  assert.ok(ai06.includes("/api/ai/agent/plans"), "realAction 必须写明计划端点");
  assert.ok(ai06.includes("/api/ai/employees"), "realAction 必须写明员工端点");
  assert.ok(ai06.includes("agent-metrics.ts"), "realAction 必须写明前端接线点");
  assert.ok(!ai06.includes("无真实端点"), "不得再写「无真实端点」（前提已被证伪）");
  assert.ok(ai06.includes("N 人就绪"), "必须写明不写 N/M 分母的口径");
  assert.ok(/status: "PARTIAL"/.test(ai06), "ai-06 必须保持 PARTIAL（派单卡 §二.3）");
  // ai-02 必须仍 PLANNED（派单卡 §二.3 明写保留）
  const ai02 = entries.slice(entries.indexOf('id: "ai-02"'), entries.indexOf('id: "ai-03"'));
  assert.ok(/status: "PLANNED"/.test(ai02), "ai-02 必须保持 PLANNED");
  return "ai-06 真实文案 + PARTIAL；ai-02 仍 PLANNED";
});

await run("回归：隐藏旧行为 —— 源码不得把 idle/挂载 当作在线", () => {
  const files = ["components/workbench/AgentStatusBar.vue", "layouts/WorkbenchShell.vue", "shared/workbench/ai-readiness.ts"];
  for (const rel of files) {
    const text = read(rel);
    // 允许出现在注释里说明"不得这样做"，但不得出现在可执行映射
    const codeLines = text
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trim();
        return t && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    assert.ok(!/idle['"]?\s*[:=]\s*['"]?(online|ready)/i.test(codeLines), `${rel}: 不得把 idle 映射为 online/ready`);
    assert.ok(!/sessionState[\s\S]{0,40}在线/.test(codeLines), `${rel}: 不得由 sessionState 直接产出"在线"文案`);
  }
  return "3 文件代码区零「idle⇒在线」映射";
});

// ═══════════════════════════════════════════════════════════════════════════
// 六、契约护栏（WORKBENCH-06F2 新增）：计划状态只认真实六态
// ═══════════════════════════════════════════════════════════════════════════

await run("契约护栏：agent-metrics.ts 代码区不得把虚构状态当作底座原生终态", () => {
  const src = read("shared/workbench/agent-metrics.ts");
  // 只查代码区（剥注释）：注释里可合法出现"旧实现曾用 done/completed"这类历史说明
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"])\/\/.*$/gm, "$1");
  for (const fake of ["done", "completed", "succeeded", "cancelled", "canceled", "rejected", "aborted"]) {
    assert.ok(
      !new RegExp(`["'\`]${fake}["'\`]`).test(codeOnly),
      `代码区不得再出现虚构状态字面量 "${fake}"（底座真实 enum 无此值）`,
    );
  }
  // 真实六态必须齐备
  for (const real of ["pending", "running", "success", "failed", "suspended", "skipped"]) {
    assert.ok(codeOnly.includes(`"${real}"`), `必须声明真实状态 "${real}"`);
  }
  return "代码区零虚构状态；真实六态齐备";
});

await run("契约护栏：测试夹具只用真实六态（不再出现虚构状态字面量）", () => {
  const spec = readFileSync(path.join(here, "ai-status-truth.spec.mjs"), "utf8");
  /**
   * 只扫「计划状态夹具」区域（`parsePlansPayload({...})` 的实参），并排除两类**合法例外**：
   *   ① 负向验证用例段：`计划·真实契约：非六态的未知状态不被猜` —— 该用例**故意**喂 done/completed
   *      来证明它们不被识别（这是本单要求的反向证据，删掉它等于失去分辨力）；
   *   ② 员工夹具的 `post/department` 占位符（与计划状态无关）。
   * 其余任何 `state: / status: "xxx"` 都必须落在真实六态内。
   */
  const planCalls = [...spec.matchAll(/parsePlansPayload\(\{[\s\S]*?\n  \}\)/g)].map((m) => m[0]);
  const allowed = new Set(["pending", "running", "success", "failed", "suspended", "skipped"]);
  const bad = [];
  for (const call of planCalls) {
    // 跳过"故意用虚构状态做负向验证"的那条用例
    if (call.includes("旧虚构别名，底座不存在")) continue;
    for (const m of call.matchAll(/(?:state|status)\s*:\s*"([a-z]+)"/g)) {
      if (!allowed.has(m[1])) bad.push(m[1]);
    }
  }
  assert.deepEqual([...new Set(bad)], [], `计划夹具出现非契约状态值：${[...new Set(bad)].join(", ")}`);
  return `${planCalls.length} 处计划夹具（含 1 处负向验证用例）状态值全部在真实六态内`;
});

await run("契约护栏：normalizePlanStatus 只接受真实六态", () => {
  for (const real of ["pending", "running", "success", "failed", "suspended", "skipped"]) {
    assert.equal(metrics.normalizePlanStatus(real), real, `真实状态 ${real} 应被接受`);
    assert.equal(metrics.normalizePlanStatus(real.toUpperCase()), real, `大写 ${real} 应归一为小写`);
  }
  for (const fake of ["done", "completed", "succeeded", "cancelled", "rejected", "aborted", "", null, 42, {}]) {
    assert.equal(metrics.normalizePlanStatus(fake), null, `非契约值 ${JSON.stringify(fake)} 必须返回 null（不猜）`);
  }
  return "6 真实态通过 / 10 非契约值返回 null";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
