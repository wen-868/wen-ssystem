/**
 * AI 能力台账明细 B（WORKBENCH-03）
 * 真相源：`docs/evidence/WB-REFACTOR-P0/20-ai-feature-matrix.md` 明细 #11…#19。
 */
import type { CapabilityEntry } from "./capability-types";

export const CAPABILITIES_B: readonly CapabilityEntry[] = [
  {
    id: "ai-11",
    title: "读写工具调用与写操作确认｜执行后留痕",
    group: "写操作",
    status: "PARTIAL",
    realAction: "GET /api/chat/operations/:operationId、GET /api/admin/audit-logs",
    missingReason: "工作台不查不展示，执行历史只活在组件内存",
    matrixRow: 11,
  },
  {
    id: "ai-12",
    title: "AI 代办入口",
    group: "代办",
    status: "PARTIAL",
    realAction: "GET /api/admin/todos + /todos/stats（TodoList.vue 直调）",
    missingReason: "无“单据 → AI 代办”交接入口（无组件通信机制）",
    matrixRow: 12,
  },
  {
    id: "ai-13",
    title: "AI 模板设计",
    group: "模板",
    status: "PLANNED",
    realAction: "无（仅人工模板 CRUD：/api/admin/print/templates）",
    missingReason: "底座无模板设计工具，AI 生成/AI 改模板全仓无任何 method/path",
    matrixRow: 13,
  },
  {
    id: "ai-14",
    title: "收银台 AI 预警弹窗",
    group: "收银",
    status: "PLANNED",
    realAction: "无（通用预警 /api/admin/alerts，非收银台专用）",
    missingReason: "无收银台专用端点；收银台当前显式屏蔽 AI 面板",
    matrixRow: 14,
  },
  {
    id: "ai-15",
    title: "模型管理",
    group: "模型",
    status: "PARTIAL",
    realAction: "GET /api/chat/models、GET /api/admin/ai-config/*（saas-admin 实调）",
    missingReason: "工作台无模型管理页、无对话级模型切换（fetchAiModels 0 调用）",
    matrixRow: 15,
  },
  {
    id: "ai-16",
    title: "插件",
    group: "扩展",
    status: "PLANNED",
    realAction: "无",
    missingReason: "底座无 plugin 端点（原型安装/试运行为本地 SEED 演示）",
    matrixRow: 16,
  },
  {
    id: "ai-17",
    title: "Skill",
    group: "扩展",
    status: "PLANNED",
    realAction: "无（能力以 118 个 tools 承载）",
    missingReason: "无 Skill 注册/启停/试运行端点，原型 dryRun 自陈“模拟输出”",
    matrixRow: 17,
  },
  {
    id: "ai-18",
    title: "故障演练与降级引导｜熔断/降级机制",
    group: "故障",
    status: "PARTIAL",
    realAction: "GET /api/admin/circuit-breakers、POST /api/admin/circuit-breakers/reset",
    missingReason: "工作台 0 调用，UI 无熔断态展示与一键恢复",
    matrixRow: 18,
  },
  {
    id: "ai-19",
    title: "故障演练与降级引导｜演练开关与额度耗尽引导",
    group: "故障",
    status: "PLANNED",
    realAction: "无（额度侧仅配置端点，闸门 BillingService.checkQuota 0 调用点）",
    missingReason: "底座无演练/引导端点",
    matrixRow: 19,
  },
];
