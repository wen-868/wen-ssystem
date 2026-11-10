/**
 * AI 能力台账明细 A（WORKBENCH-03）
 * 真相源：`docs/evidence/WB-REFACTOR-P0/20-ai-feature-matrix.md` 明细 #1…#10。
 */
import type { CapabilityEntry } from "./capability-types";

export const CAPABILITIES_A: readonly CapabilityEntry[] = [
  {
    id: "ai-01",
    title: "新对话与历史会话｜新对话·清空当前会话",
    group: "会话",
    status: "PARTIAL",
    realAction: "POST /api/chat（conversationId 续接）；AiSidePanel.vue clearChat 清空本地会话",
    missingReason: "底座无独立“新建会话”端点，清空仅重置本地会话",
    matrixRow: 1,
  },
  {
    id: "ai-02",
    title: "新对话与历史会话｜历史会话列表与找回",
    group: "会话",
    status: "PLANNED",
    realAction: "无",
    missingReason: "底座无商家侧会话列表端点；仅运维侧 GET /api/admin/session-archive",
    matrixRow: 2,
  },
  {
    id: "ai-03",
    title: "AI 信息流/晨报｜AI 信息流",
    group: "信息流",
    status: "PARTIAL",
    realAction: "面板仅列现有业务入口（Dashboard.vue 经营动态）；无 AI 生成 feed 端点",
    missingReason: "信息流为业务接口拼装、非 AI 生成，AI 信息流本体未接",
    matrixRow: 3,
  },
  {
    id: "ai-04",
    title: "AI 信息流/晨报｜AI 晨报",
    group: "信息流",
    status: "PARTIAL",
    realAction: "底座巡检 daily_briefing；GET /api/admin/proactive/jobs、POST /api/admin/proactive/jobs/:name/run",
    missingReason: "admin-web 0 调用，无晨报卡片/页面",
    matrixRow: 4,
  },
  {
    id: "ai-05",
    title: "快捷经营指令",
    group: "指令",
    status: "PARTIAL",
    realAction: "复用 POST /api/chat（AiSidePanel 已有真实发送逻辑）；底座无指令注册/解析端点",
    missingReason: "无图钉/频率个性化，也不能为每条指令沉淀独立会话",
    matrixRow: 5,
  },
  {
    id: "ai-06",
    title: "Agent 工作过程与进度",
    group: "Agent",
    status: "PARTIAL",
    realAction:
      "底座 GET /api/ai/agent/plans（计划列表，含 steps.status 六态）→ 顶部「任务进度」；GET /api/ai/employees（数字员工列表）→ 顶部「数字员工 N 人就绪」。接线点：shared/workbench/agent-metrics.ts（parseEmployeesPayload/parsePlansPayload + loadAgentTopMetrics）→ AgentStatusBar.vue；另 GET /api/ai/employees/:id/tasks、GET /api/ai/agent/plans/:id 可用未接",
    missingReason:
      "已接：员工计数 + 计划进度（步骤 C/T 或进行中计划 N），各数据源独立降级。仍缺：① 对话框内实时工具过程卡片（AiSidePanel onToolStart 仍静默，未消费 tool_start/tool_result）；② 单员工任务列表与计划详情未在 UI 展开；③ 底座无员工「在线」字段 ⇒ 只显示「N 人就绪」，不写 N/M 分母",
    matrixRow: 6,
  },
  {
    id: "ai-07",
    title: "主动提醒",
    group: "提醒",
    status: "PARTIAL",
    realAction: "WS /api/ai/ws；封装 connectAiPushSocket（api/ai.ts）",
    missingReason: "唯一消费者 AiChatWindow 未挂载，线上收不到主动提醒",
    matrixRow: 7,
  },
  {
    id: "ai-08",
    title: "读写工具调用与写操作确认｜预览→确认→执行→撤销",
    group: "写操作",
    status: "LIVE",
    realAction:
      "POST /api/chat/confirmations/:id/confirm|cancel、POST /api/chat/operations/:id/revoke；调用点 AiSidePanel.vue 的确认/取消/撤销函数",
    matrixRow: 8,
  },
  {
    id: "ai-09",
    title: "读写工具调用与写操作确认｜tools 能力列表",
    group: "写操作",
    status: "PARTIAL",
    realAction: "底座 GET /api/admin/tools（118 个工具定义）",
    missingReason: "api/ai.ts fetchAiTools 0 调用点，工作台不展示能力清单",
    matrixRow: 9,
  },
  {
    id: "ai-10",
    title: "读写工具调用与写操作确认｜待确认列表拉取（刷新/切页找回）",
    group: "写操作",
    status: "PARTIAL",
    realAction: "GET /api/chat/confirmations（当前租户待确认列表）",
    missingReason: "fetchAiConfirmations 0 调用点，刷新/切页后待确认项在 UI 上消失",
    matrixRow: 10,
  },
];
