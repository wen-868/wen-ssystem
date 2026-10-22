/** 工作台 AI 能力台账类型（WORKBENCH-03） */
export type CapabilityStatus = "LIVE" | "PARTIAL" | "PLANNED" | "BLOCKED";

export interface CapabilityEntry {
  /** 能力 ID（与 P0 矩阵明细行一一对应：ai-NN） */
  id: string;
  /** 冻结清单项｜子项 */
  title: string;
  /** 归属分区（AI 主交互面展示分组） */
  group: string;
  /** 能力状态 */
  status: CapabilityStatus;
  /** 真实动作/接口（LIVE/PARTIAL 必须写明可复核的 method path 或调用点） */
  realAction: string;
  /** 缺失原因（PLANNED 必填：原型有、后端无） */
  missingReason?: string;
  /** P0 矩阵明细行号（逐项对账用） */
  matrixRow: number;
}
