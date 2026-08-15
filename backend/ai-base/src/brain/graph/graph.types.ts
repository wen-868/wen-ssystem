/**
 * 有状态图（Graph）类型定义 — 完善度 P0-1/P0-2
 *
 * 依据《管理系统AI底座完善计划》P0-1/P0-2：
 * - Orchestrator 支持 react（单 Agent 循环）与 graph（有状态图）双模式
 * - graph 节点 = 域 Agent / 工具 / 条件 / 结束；边 = 流转条件
 * - 状态由 Checkpointer 按 tenantId+sessionId 持久化（Redis），支持暂停/恢复/续跑
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-15
 */

/** 图节点类型 */
export type GraphNodeType = 'agent' | 'tool' | 'condition' | 'end';

/** 图节点 */
export interface GraphNode {
  /** 节点唯一 ID（图内） */
  id: string;
  /** 中文名（SSE 展示，如"搜索客户"） */
  label: string;
  /** 节点类型 */
  type: GraphNodeType;
  /** type=tool 时：要执行的工具名 */
  tool?: string;
  /** type=tool 时：工具参数（P0 骨架静态参数；真实任务参数解析由 agent 节点完善） */
  args?: Record<string, unknown>;
  /** type=agent 时：节点指令（追加到系统提示，引导该域 Agent） */
  prompt?: string;
  /** type=agent 时：域 Agent 配置（P0-3 多 Agent 协作） */
  agent?: {
    /** Agent 系统提示（覆盖 prompt，体现域职责） */
    systemPrompt?: string;
    /** 该 Agent 可调用的工具白名单（工具名列表；不填则仅文本生成） */
    tools?: string[];
    /** 节点内最大工具循环轮数（默认 3） */
    maxToolRounds?: number;
  };
  /** 默认下一节点 ID（end 节点可省略） */
  next?: string;
  /** type=condition 时：条件流转，返回下一节点 ID；返回 undefined 走 next */
  condition?: (state: GraphState) => string | undefined;
  /** 命中人工闸（P0-4 对接审核流程；当前预留钩子） */
  needsReview?: boolean;
  /** 人工闸说明（SSE 展示确认点） */
  reviewNote?: string;
}

/** 图定义 */
export interface GraphDefinition {
  /** 图唯一 ID（如 sale_create_graph） */
  id: string;
  /** 图名（中文） */
  name: string;
  /** 入口节点 ID */
  entry: string;
  /** 全部节点 */
  nodes: GraphNode[];
}

/** 图状态（Checkpointer 持久化） */
export interface GraphState {
  graphId: string;
  tenantId: string;
  sessionId: string;
  /** 当前节点 ID（断点续跑位置） */
  currentNodeId: string;
  /** 状态：running 执行中 / paused 暂停（人工闸） / done 完成 / error 错误 */
  status: 'running' | 'paused' | 'done' | 'error';
  /** 节点产物（nodeId → 工具返回 data） */
  results: Record<string, unknown>;
  /** 已执行节点顺序（time-travel 回放） */
  nodeOrder: string[];
  /** 节点执行历史（含 label，SSE 步骤流） */
  history: Array<{ nodeId: string; label: string; success: boolean }>;
  /** 错误信息 */
  error?: string;
  /** 更新时间戳 */
  updatedAt: number;
}

/** 图执行事件（Orchestrator SSE 输出） */
export type GraphEvent =
  | { type: 'node_start'; nodeId: string; label: string }
  | { type: 'node_end'; nodeId: string; label: string; success: boolean }
  | { type: 'graph_done'; graphId: string };

/** 内置图注册表（管理系统域，先落地骨架示例） */
export const BUILTIN_GRAPHS: Record<string, GraphDefinition> = {
  sale_create_graph: {
    id: 'sale_create_graph',
    name: '销售开单图',
    entry: 'search_customer',
    nodes: [
      {
        id: 'search_customer',
        label: '搜索客户',
        type: 'tool',
        tool: 'searchCustomer',
        next: 'check_inventory',
      },
      {
        id: 'check_inventory',
        label: '库存校验',
        type: 'tool',
        tool: 'checkInventory',
        next: 'create_sale',
      },
      {
        id: 'create_sale',
        label: '创建销售单',
        type: 'tool',
        tool: 'createSalesOrder',
        next: 'end',
      },
      { id: 'end', label: '完成', type: 'end' },
    ],
  },
};
