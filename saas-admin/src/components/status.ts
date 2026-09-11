/**
 * 状态色板语义定义
 * 设计稿 v1.6 口径：绿=正常 · 橙=欠费/预警 · 红=冻结/故障 · 紫=自定义
 * 扩展：蓝=进行中/信息 · 灰=中性/草稿
 */
export type StatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'purple'
  | 'info'
  | 'neutral'

/** 键值对列表项（供 KeyValueList 使用） */
export interface KeyValueItem {
  label: string
  value?: string | number
  /** 传了该值则 value 以 StatusTag 呈现 */
  tone?: StatusTone
  /** 自定义插槽名 */
  slot?: string
}

/** 业务状态 → 语义色板的推荐映射（供各板块统一引用，避免每页各写一套） */
export const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // 租户状态
  正常: 'success',
  欠费: 'warning',
  冻结: 'danger',
  已注销: 'neutral',
  // 账单/支付
  已支付: 'success',
  待支付: 'warning',
  支付失败: 'danger',
  已退款: 'purple',
  // 通用
  启用: 'success',
  禁用: 'neutral',
  草稿: 'neutral',
  待审核: 'warning',
  已发布: 'success',
  已撤回: 'danger',
  进行中: 'info',
  已完成: 'success',
  已超时: 'danger',
}
