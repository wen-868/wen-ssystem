/** 工作台 AI 能力台账类型（WORKBENCH-03）｜人工对等扩展（WORKBENCH-03F1） */
export type CapabilityStatus = "LIVE" | "PARTIAL" | "PLANNED" | "BLOCKED";

export interface CapabilityEntry {
  /** 能力 ID（AI 矩阵项 ai-NN；动作能力 act:<actionId>） */
  id: string;
  /** 能力标题 */
  title: string;
  /** 归属分区（AI 主交互面展示分组） */
  group: string;
  /** 能力状态 */
  status: CapabilityStatus;
  /** 真实动作/接口（LIVE/PARTIAL 必须写明可复核的 method path 或调用点） */
  realAction: string;
  /** 缺失原因（PLANNED/BLOCKED 必填） */
  missingReason?: string;
  /** P0 矩阵明细行号（AI 矩阵项 1..19；动作能力为 0） */
  matrixRow: number;
  /** 覆盖的人工路由名（由 route-manifest 组件路径精确派生，不做名称相似匹配） */
  manualRouteNames?: readonly string[];
  /** 覆盖的人工动作 ID（30 矩阵 actionId 原样引用） */
  manualActionIds?: readonly string[];
  /** 体验收益（AI 代办后人工少做什么） */
  experienceGain?: string;
  /** 人工回退（AI 不可用时的人工路径，PLANNED/BLOCKED 必填） */
  manualFallback?: string;
  /** AI 原生能力（人工无对应动作）必须显式标记 */
  aiOnly?: boolean;
  /** AI_ONLY 的显式理由 */
  aiOnlyReason?: string;
  /** 责任域（缺失项归属） */
  ownerDomain?: string;
}

/** 动作台账原始行：30 动作权限矩阵逐行镜像（禁止手改，由脚本产出） */
export interface ParityActionRow {
  /** 30 矩阵 actionId（含 #N 变体后缀，原样保留） */
  id: string;
  /** 承载页面（相对 admin-web/src，一行可跨多页面） */
  pages: readonly string[];
  /** 这些页面命中的人工路由名（route-manifest 组件路径精确匹配派生） */
  routeNames: readonly string[];
  /** 业务域（actionId 前缀） */
  domain: string;
  /** HTTP method */
  method: string;
  /** 真实接口路径（矩阵原样） */
  apiPath: string;
  /** 权限码；NO_CODE=路由未挂权限中间件；UNKNOWN=本仓无对应后端注册 */
  permission: string;
  /** AI 工具现状（矩阵「AI 工具现状」列） */
  aiTool: boolean;
  /** 写确认链（矩阵「写确认」列） */
  confirmChain: boolean;
  /** 状态（判定规则见 parity-ledger.ts） */
  status: CapabilityStatus;
}

/** 人工入口原始行：71 人工 + 9 收银项逐项覆盖（脚本产出） */
export interface ParityManualEntry {
  menuCode: string;
  title: string;
  routeName: string | null;
  /** 所属人工分组标题（责任域） */
  ownerDomain: string;
  /** 承载页面（相对 admin-web/src；本地动作项为 null） */
  page: string | null;
  /** 命中的动作行数 */
  actionCount: number;
  /** 命中的动作行 ID */
  actionIds: readonly string[];
  /** 入口级状态（由所辖动作行聚合） */
  status: CapabilityStatus;
}

/** 对等报告（machine readable，落 docs/evidence/WORKBENCH-03F1/parity-report.json） */
export interface ParityReport {
  generatedFrom: readonly string[];
  baseline: string;
  manualEntries: number;
  manualEntriesMapped: number;
  missingManualMappings: number;
  actionRows: number;
  actionAnchors: number;
  unmappedActionRows: number;
  onMenuActionRows: number;
  offMenuActionRows: number;
  statusCounts: Record<CapabilityStatus, number>;
  manualStatusCounts: Record<CapabilityStatus, number>;
  aiCapabilities: number;
  actionCapabilities: number;
  orphanCapabilities: readonly string[];
  unregisteredDomains: readonly string[];
  missing: readonly string[];
  pass: boolean;
}
