/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · 数据/状态/同源验收骨架
 *
 * 状态：PREPARED（未实跑）。实跑基线 = S1-S4 合并候选集成 worktree/HEAD。
 * 对齐：regression-matrix R05, R06, R07, R08, R11（数据/文案黑名单数据面）。
 *
 * 原则：禁止 mock 冒充真实契约成功；真实来源对账需网络响应+DOM 同源证据。
 */
import assert from "node:assert/strict";

const PENDING = "PENDING_RUN_ON_S1_S4_MERGE_CANDIDATE";

const gates = [
  { id: "R05", name: "真实员工/任务", checks: [
    "员工来自 GET /api/ai/employees",
    "员工任务来自 GET /api/ai/employees/:id/tasks",
    "计划来自 GET /api/ai/agent/plans（及详情按契约）",
    "14 个原型演示姓名零命中（DOM/数据快照）",
  ]},
  { id: "R06", name: "待确认契约", checks: [
    "后端 {total,items} 正确解析（含真实接口响应留存）",
    "顶部待审阅与列表计数一致（同源）",
  ]},
  { id: "R07", name: "晨报业务字段", checks: [
    "库存安全线/应收到期/毛利异常各有来源与时间或业务不可用态",
    "示例金额/店名单号零命中",
    "无本地伪造读数填充",
  ]},
  { id: "R08", name: "四态与恢复", checks: [
    "员工/任务/待确认/晨报各自 loading/empty/error/timeout 独立",
    "网络拦截与 20s 超时探针后重试恢复，不清空其他区",
  ]},
  { id: "R11-data", name: "演示数据黑名单", checks: [
    "红星商行/张三/¥25,400/¥8,900 等样例零命中（与 R11 全局黑名单联动）",
  ]},
];

for (const g of gates) {
  console.log(`[PREPARED][${g.id}] ${g.name}`);
  for (const c of g.checks) console.log(`  - ${c}`);
  assert.ok(g.checks.length > 0);
}

if (process.env.S5_MERGE_CANDIDATE_READY !== "1") {
  console.log(`SKIP_EXECUTION reason=${PENDING}`);
  process.exit(0);
}

console.error("MERGE_CANDIDATE_READY=1 but skeleton has no executable assertions yet");
process.exit(2);
