/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · 视觉/文案黑名单验收骨架
 *
 * 状态：PREPARED（未实跑）。实跑基线 = S1-S4 合并候选集成 worktree/HEAD。
 * 对齐：regression-matrix R03, R11。
 */

const PENDING = "PENDING_RUN_ON_S1_S4_MERGE_CANDIDATE";

export const COPY_BLACKLIST = [
  "双入口左侧菜单",
  "待接入",
  "未接入",
  "不伪造成功",
  "端点缺失",
  "设计说明",
  "红星商行",
  "张三",
  "¥25,400",
  "¥8,900",
];

const checks = [
  { id: "R03", desc: "中央主面标题“日常经营”；晨报在会话内；无 feed/chat 双入口；输入控件计数=1" },
  { id: "R11-dom", desc: "生产 DOM innerText 黑名单零命中（全页面关键路由抽样）" },
  { id: "R11-dist", desc: "dist 构建产物文案黑名单零命中（排除 sourcemap/非用户可见元数据需标注）" },
];

for (const c of checks) console.log(`[PREPARED][${c.id}] ${c.desc}`);
console.log(`[PREPARED][R11] blacklist=${JSON.stringify(COPY_BLACKLIST)}`);

if (process.env.S5_MERGE_CANDIDATE_READY !== "1") {
  console.log(`SKIP_EXECUTION reason=${PENDING}`);
  process.exit(0);
}

console.error("MERGE_CANDIDATE_READY=1 but skeleton has no executable assertions yet");
process.exit(2);
