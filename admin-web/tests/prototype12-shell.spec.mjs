/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · 壳层/几何/交互验收骨架
 *
 * 状态：PREPARED（未实跑）。实跑基线 = S1-S4 合并候选集成 worktree/HEAD。
 * 对齐：regression-matrix R01, R02, R04, R13, R14。
 *
 * 原则：结构/源码检查仅补充；商用验收需真实浏览器 1440/1024/390 截图 + DOM rect/scrollWidth + 真实交互。
 * 本文件为 node tests/*.spec.mjs 风格骨架；真实几何与交互以 Playwright e2e 取证为准。
 */
import assert from "node:assert/strict";

const PENDING = "PENDING_RUN_ON_S1_S4_MERGE_CANDIDATE";

const cases = [
  {
    id: "R01-geometry-1440",
    gate: "R01",
    desc: "1440×1000: rail=60, side=230, taskCenter=300, main≈850, top=42, 无整页横向溢出",
    evidence: ["screenshots/1440x1000-impl.png", "screenshots/1440x1000-prototype-sidebyside.png", "geometry/1440x1000.json"],
  },
  {
    id: "R02-geometry-1024",
    gate: "R02",
    desc: "1024×768: rail=60, side=230, taskCenter=300, main≈434, top=42, 无横向溢出；任务中心可收起",
    evidence: ["screenshots/1024x768-impl.png", "screenshots/1024x768-task-center-collapsed.png", "geometry/1024x768.json"],
  },
  {
    id: "R04-task-center-toggle",
    gate: "R04",
    desc: "任务中心默认进度明细；切任务跟踪；收起/展开主区扩宽；状态保持",
    evidence: ["screenshots/task-center-progress.png", "screenshots/task-center-track.png", "screenshots/task-center-collapsed.png", "dom/task-center-state.json"],
  },
  {
    id: "R13-manual-routes-survive-ai-fault",
    gate: "R13",
    desc: "router-view 常驻；订单/库存/财务≥3 深链可访问；AI 故障时人工页仍可用",
    evidence: ["raw/r13-deeplinks.log", "screenshots/r13-orders.png", "screenshots/r13-inventory.png", "screenshots/r13-finance.png"],
  },
  {
    id: "R14-responsive-390",
    gate: "R14",
    desc: "390 单列/抽屉不破坏，入口可达，无横向溢出",
    evidence: ["screenshots/390.png", "geometry/390.json"],
  },
];

// Skeleton: enumerate planned checks so receipt can reference prepared coverage.
for (const c of cases) {
  console.log(`[PREPARED][${c.id}] ${c.gate} ${c.desc}`);
  assert.ok(c.evidence.length > 0, `${c.id} must declare evidence targets`);
}

// Guard: do not claim pass without merge-candidate execution.
if (process.env.S5_MERGE_CANDIDATE_READY !== "1") {
  console.log(`SKIP_EXECUTION reason=${PENDING}`);
  process.exit(0);
}

// TODO(on candidate): implement real assertions (Playwright-driven geometry/interaction capture or imported helpers).
console.error("MERGE_CANDIDATE_READY=1 but skeleton has no executable assertions yet");
process.exit(2);
