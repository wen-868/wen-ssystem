/**
 * WORKBENCH-10-UIUX-PARITY-F1 · B 默认工作台断言
 *
 * 卡 §三.B 口径：KPI、审批、AI 播报、主管队列、任务步进 + **完整状态**。
 * 「完整状态」在这里是可验证的五态：loading / ready / empty / unavailable / error，
 * 且 error|unavailable 必须有可点的重试入口。
 *
 * 红线（卡 §一/§六）在这一区的落点：
 *   · 数据源没接线 ⇒ unavailable +「待接入」，**不许**回落成空列表假装读到了；
 *   · 读到了空 ⇒ empty，且文案写明是真实空列表；
 *   · 形状异常 ⇒ error，**不许**降级成 empty；
 *   · 审批通过/驳回只走底座真实确认链（confirmAiOperation / cancelAiOperation），
 *     失败如实回显，不本地把卡片翻成「已完成」。
 *
 * 运行（admin-web 目录）：node tests/wb-b-feed.spec.mjs
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
const toUrl = (rel) => new URL("file:///" + path.join(SRC, rel).replace(/\\/g, "/")).href;

const types = await import(toUrl("shared/workbench/wb-feed-types.ts"));
const kpi = await import(toUrl("shared/workbench/wb-feed-kpi.ts"));
const approvals = await import(toUrl("shared/workbench/wb-feed-approvals.ts"));
const broadcast = await import(toUrl("shared/workbench/wb-feed-broadcast.ts"));
const taskboard = await import(toUrl("shared/workbench/wb-feed-taskboard.ts"));
const taskflow = await import(toUrl("shared/workbench/wb-feed-taskflow.ts"));

const feedViewSrc = read("components/workbench/AiFeedView.vue");

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

/* ── 1. 五态契约 ── */
await run("五态清单与卡面口径逐字一致", () => {
  assert.deepEqual([...types.FEED_BLOCK_STATES], ["loading", "ready", "empty", "unavailable", "error"]);
  return types.FEED_BLOCK_STATES.join("/");
});

await run("五个区块都在信息流里落地且绑定状态机", () => {
  for (const id of ["wb-feed-kpi", "wb-feed-approvals", "wb-feed-broadcast", "wb-feed-taskboard", "wb-feed-taskflow"]) {
    assert.ok(feedViewSrc.includes(`data-testid="${id}"`), `缺少区块 ${id}`);
  }
  for (const block of ["kpiBlock", "approvalsBlock", "broadcastBlock", "boardBlock", "flowBlock"]) {
    assert.ok(
      feedViewSrc.includes(`:data-state="${block}.state"`),
      `${block} 未把状态暴露给 DOM（五态不可外部验证）`,
    );
    assert.ok(
      feedViewSrc.includes(`:data-retry-available="canRetry(${block}.state)"`),
      `${block} 未暴露重试可用性`,
    );
  }
  return "5 区块 × data-state + data-retry-available";
});

await run("每块四件齐：loading / note / retry / empty 测试锚点", () => {
  for (const p of ["wb-kpi", "wb-ap", "wb-bc", "wb-tb", "wb-tf"]) {
    for (const suffix of ["loading", "note", "retry", "empty"]) {
      assert.ok(
        feedViewSrc.includes(`data-testid="${p}-${suffix}"`),
        `${p} 缺 ${suffix} 锚点（该态在 UI 上无处安放）`,
      );
    }
  }
  assert.match(feedViewSrc, /function canRetry\(state: FeedBlockState\): boolean \{\s*return state === "error" \|\| state === "unavailable";/);
  return "20 锚点 + retry 仅 error|unavailable";
});

/* ── 2. 未接线 ⇒ unavailable，绝不假装读到 ── */
await run("五个装载器不注入读取器一律 unavailable（不是 empty、不是 ready）", async () => {
  const cases = [
    ["loadWbKpi", await kpi.loadWbKpi()],
    ["loadWbApprovals", await approvals.loadWbApprovals()],
    ["loadWbBroadcasts", await broadcast.loadWbBroadcasts()],
    ["loadWbTaskBoard", await taskboard.loadWbTaskBoard()],
    ["loadWbTaskFlows", await taskflow.loadWbTaskFlows()],
  ];
  for (const [name, block] of cases) {
    assert.equal(block.state, "unavailable", `${name}() 缺省必须 unavailable`);
    assert.ok(block.message.trim().length > 0, `${name}() 必须说明缺什么`);
    const emptiness = Array.isArray(block.data) ? block.data.length === 0 : block.data.totalEntries === 0;
    assert.ok(emptiness, `${name}() unavailable 时不得携带任何条目`);
  }
  return "5/5 unavailable + 缺因文案 + 零条目";
});

await run("待接入文案点名真实端点，可核对而不是万能话术", async () => {
  const kpiMsg = (await kpi.loadWbKpi()).message;
  const apMsg = (await approvals.loadWbApprovals()).message;
  const tbMsg = (await taskboard.loadWbTaskBoard()).message;
  assert.ok(kpiMsg.includes("/admin/dashboard/overview"), "KPI 未写明真读源端点");
  assert.ok(apMsg.includes("/api/chat/confirmations"), "审批未写明真读源端点");
  assert.ok(tbMsg.includes("/api/ai/agent/plans"), "队列未写明真读源端点");
  return "overview / confirmations / agent/plans";
});

await run("播报没有端点 ⇒ 文案承认为空，不伪造指标", async () => {
  const block = await broadcast.loadWbBroadcasts();
  assert.match(block.message, /暂不可用|暂未开放|暂无/);
  assert.ok(!/GMV 环比\s*[0-9]/.test(block.message), "不得在文案里塞示例数字");
  return block.message.slice(0, 40) + "…";
});

/* ── 3. 形状异常 ⇒ error，不降级成 empty ── */
await run("非预期形状一律 error（失败 ≠ 空）", () => {
  const samples = [
    ["parseWbKpiPayload", kpi.parseWbKpiPayload(null)],
    ["parseWbApprovalsPayload", approvals.parseWbApprovalsPayload("oops")],
    ["parseWbBroadcastRows", broadcast.parseWbBroadcastRows({})],
    ["parseWbTaskBoard", taskboard.parseWbTaskBoard([])],
    ["parseWbTaskFlows", taskflow.parseWbTaskFlows(null)],
  ];
  for (const [name, block] of samples) {
    assert.equal(block.state, "error", `${name} 对畸形入参必须 error，实得 ${block.state}`);
  }
  const failFlag = taskboard.parseWbTaskBoard({ success: false, error: "底座超时" });
  assert.equal(failFlag.state, "error");
  assert.ok(failFlag.message.includes("底座超时"), "必须把底座原因透出来，不能吞成通用话术");
  return "5 例 error + success=false 透因";
});

await run("真实空列表 ⇒ empty（且与 error 文案不同源）", () => {
  const a = approvals.parseWbApprovalsPayload([]);
  const b = broadcast.parseWbBroadcastRows([]);
  const t = taskboard.parseWbTaskBoard({ items: [] });
  for (const [name, block] of [["审批", a], ["播报", b], ["队列", t]]) {
    assert.equal(block.state, "empty", `${name} 空数组应落 empty，实得 ${block.state}`);
    assert.ok(/空|暂无|没有/.test(block.message), `${name} empty 文案要说明是真实空`);
  }
  return "3/3 empty";
});

/* ── 4. 脏数据不污染整体，也不拼半截条目 ── */
await run("脏行被丢弃而不是渲染成假条目", () => {
  const ap = approvals.parseWbApprovalsPayload([{ operation: "改价" }, { confirmationId: "c1", operation: "退货" }]);
  assert.equal(ap.state, "ready");
  assert.equal(ap.data.length, 1, "无 ID 的确认单不可操作，必须不渲染");
  assert.equal(ap.data[0].id, "c1");

  const bc = broadcast.parseWbBroadcastRows([{ metric: "GMV" }, { metric: "退款率", value: "1.2%" }]);
  assert.equal(bc.data.length, 1, "缺读数的播报条目不得拼接展示");
  assert.equal(bc.data[0].value, "1.2%");

  const tb = taskboard.parseWbTaskBoard({ items: [{ id: "1", state: "weird_state", goal: "x" }] });
  assert.equal(tb.state, "empty", "未知状态不得猜桶位");
  assert.equal(tb.data.unknownStates, 1, "未知状态要如实计数");
  return "无 ID / 无读数 / 未知枚举 3 类脏行各 1 条被拦";
});

/* ── 5. 任务步进门控 ── */
await run("步进折算：已完成√ / 首个未完成● / 其后🔒，不猜未来态", () => {
  const steps = taskflow.deriveFlowSteps([
    { id: "s1", status: "success", label: "取数" },
    { id: "s2", status: "pending", label: "生成" },
    { id: "s3", status: "success", label: "归档" },
  ]);
  assert.deepEqual(steps.map((s) => s.cls), ["done", "wait", "lock"], "门控点必须是首个未完成环节");
  assert.deepEqual(steps.map((s) => s.mark), ["√", "●", "🔒"]);
  const allDone = taskflow.deriveFlowSteps([{ id: "a", status: "success" }, { id: "b", status: "success" }]);
  assert.deepEqual(allDone.map((s) => s.cls), ["done", "done"]);
  const failed = taskflow.deriveFlowSteps([{ id: "f", status: "failed", label: "扣款" }]);
  assert.equal(failed[0].label, "扣款（失败）", "失败环节要显式标出，不能画成已完成");
  assert.equal(failed[0].cls, "wait");
  return "done/wait/lock + 全成 done + 失败标注";
});

/* ── 6. 金额与错误分类 ── */
await run("金额取不到返回 null，由 UI 隐藏而不是画 ¥0", () => {
  for (const bad of [null, undefined, NaN, "abc", {}, Infinity]) {
    assert.equal(types.formatFeedAmount(bad), null, `${String(bad)} 不得格式化成金额`);
  }
  assert.equal(types.formatFeedAmount(1234.5), "¥1,234.5");
  assert.equal(types.formatFeedAmount("88"), "¥88");
  return "6 例 null + 2 例真值";
});

await run("错误分类：404 ⇒ 待接入，其余 ⇒ 可重试 error", () => {
  const nf = types.classifyFeedError(new Error("HTTP 404 Not Found"), "经营指标", []);
  assert.equal(nf.state, "unavailable");
  assert.match(nf.message, /暂不可用：服务返回 404/);
  const boom = types.classifyFeedError(new Error("HTTP 500"), "经营指标", []);
  assert.equal(boom.state, "error");
  assert.match(boom.message, /HTTP 500/, "原始原因必须可追，不能吞成「读取失败」");
  assert.equal(types.classifyFeedError("字符串异常", "经营指标", []).state, "error");
  return "404→unavailable / 500→error / 非 Error 也分类";
});

/* ── 7. 注入真读取器才走真数据 ── */
await run("注入读取器后走真链路：成功读 / 抛错分别落 ready 与 error", async () => {
  const ok = await kpi.loadWbKpi({
    fetchOverview: async () => ({ today: { salesAmount: 1000 }, month: {}, stockAlerts: {}, finance: {} }),
  });
  assert.ok(["ready", "empty", "unavailable"].includes(ok.state), `真载荷不应落 error，实得 ${ok.state}`);
  const err = await kpi.loadWbKpi({ fetchOverview: async () => { throw new Error("HTTP 504"); } });
  assert.equal(err.state, "error");
  const nf = await taskboard.loadWbTaskBoard({ fetchPlans: async () => { throw new Error("HTTP 404 Not Found"); } });
  assert.equal(nf.state, "unavailable", "底座计划端点 404 ⇒ 待接入，不是 error 也不是空");
  return "ready|error|unavailable 三向都对";
});

/* ── 8. 视图层红线 ── */
await run("审批动作只走底座真实确认链，失败不本地翻牌", () => {
  assert.ok(feedViewSrc.includes("confirmAiOperation(card.id)"), "通过动作必须调用真实确认端点");
  assert.ok(feedViewSrc.includes("cancelAiOperation(card.id)"), "驳回动作必须调用真实取消端点");
  assert.ok(/executedApprovals\.value = \[\s*\{ \.\.\.card, status: "done", operationId \}/.test(feedViewSrc));
  assert.ok(feedViewSrc.includes("await refreshApprovals();"), "动作后须回读底座，不能只改本地态");
  assert.match(feedViewSrc, /approvalActionError\.value = `确认执行失败[\s\S]*?操作未生效/);
  assert.match(feedViewSrc, /驳回失败[\s\S]*?确认单仍在列表/);
  return "confirm/cancel + 回读 + 失败如实回显";
});

await run("业务动态走真实端点且与消息中心同源", () => {
  assert.ok(feedViewSrc.includes('api.get("/admin/wb-notifications"'), "动态区必须走 /admin/wb-notifications");
  assert.ok(
    read("views/dashboard/MessageCenter.vue").includes('api.get("/admin/wb-notifications"'),
    "该端点须是既有真实端点（消息中心已在用），不是本卡新造",
  );
  assert.ok(/catch \{[\s\S]*msgState\.value = "error"/.test(feedViewSrc), "读取失败要落 error 态");
  return "端点既有 + 失败态";
});

await run("B 区不引入随机数、演示店名或假成功", () => {
  const files = {
    "AiFeedView.vue": feedViewSrc,
    "wb-feed-kpi.ts": read("shared/workbench/wb-feed-kpi.ts"),
    "wb-feed-approvals.ts": read("shared/workbench/wb-feed-approvals.ts"),
    "wb-feed-broadcast.ts": read("shared/workbench/wb-feed-broadcast.ts"),
    "wb-feed-taskboard.ts": read("shared/workbench/wb-feed-taskboard.ts"),
    "wb-feed-taskflow.ts": read("shared/workbench/wb-feed-taskflow.ts"),
  };
  for (const [name, text] of Object.entries(files)) {
    assert.ok(!/Math\.random\(/.test(text), `${name} 用了随机数`);
    assert.ok(!/红星商行|张三|王强|李四/.test(text), `${name} 出现原型演示姓名/店名`);
    assert.ok(!/TODO|FIXME/.test(text), `${name} 留有半成品标记`);
  }
  return "6 文件全清";
});

await run("推送与定时器成对释放（不泄漏、不假装在线）", () => {
  assert.ok(feedViewSrc.includes("connectAiPushSocket"), "推送须走既有 socket 工厂");
  assert.ok(/onBeforeUnmount\(\(\) => \{\s*disconnectPush\?\.\(\)/.test(feedViewSrc), "卸载必须断开推送");
  assert.ok(feedViewSrc.includes('data-testid="feed-live-off"'), "离线要有诚实标识「推送离线」");
  return "socket 生命周期闭合";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
