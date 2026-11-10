/**
 * MOBILE-REJECT-REDELIVER-ENTRY-01 · 拒收/配送失败恢复入口适配器
 *
 * 纯函数：页面只消费本模块结果，不直接猜测后端能力。
 * 当 retry_entry=store:manual-redeliver 但前端/后端动作未实现时 fail-closed 到人工客服文案。
 */
export type RecoveryEntryKind = 'none' | 'manual-fallback'

export interface RecoveryEntry {
  /** 入口类型：none=不渲染任何恢复入口；manual-fallback=人工客服兜底（不可点击动作） */
  kind: RecoveryEntryKind
  /** 展示文案（仅 manual-fallback 时有值） */
  text: string
  /** 是否可点击动作（本版恒 false：store:manual-redeliver 后端未实现） */
  clickable: boolean
  /** 绑定的失败原因（有 status_reason 时取，否则 undefined） */
  reason: string | null
  /** 内部诊断（不得渲染给商户） */
  internal: string
}

const MANUAL_FALLBACK_TEXT = '联系客服重新配送'

/** 配送失败/拒收的等价状态集合 */
const FAILURE_STATUSES = new Set(['DELIVERY_FAILED', 'REJECTED'])

/** 判断订单是否处于配送失败/拒收态 */
export function isDeliveryFailureStatus(status: string | null | undefined): boolean {
  return FAILURE_STATUSES.has((status || '').toUpperCase())
}

/** 解析恢复入口（唯一入口；页面不得自行猜测） */
export function resolveRecoveryEntry(params: {
  status?: string | null
  deliveryStatus?: string | null
  retryEntry?: string | null
  statusReason?: string | null
  /** 该动作的后端能力标记；'store:manual-redeliver' 后端未实现 ⇒ fail-closed */
  actionCapability?: string | null
}): RecoveryEntry {
  const status = (params.status || '').toUpperCase()
  const deliveryStatus = (params.deliveryStatus || '').toUpperCase()
  const failed = FAILURE_STATUSES.has(status) || FAILURE_STATUSES.has(deliveryStatus)

  if (!failed) return { kind: 'none', text: '', clickable: false, reason: null, internal: `status=${status} deliveryStatus=${deliveryStatus} ⇒ 非配送失败态` }

  // retry_entry 存在但动作不可点击（后端未实现 store:manual-redeliver）
  if (params.retryEntry === 'store:manual-redeliver') {
    const reason = params.statusReason || null
    return {
      kind: 'manual-fallback',
      text: reason ? `${MANUAL_FALLBACK_TEXT}（${reason}）` : MANUAL_FALLBACK_TEXT,
      clickable: false,
      reason,
      internal: 'retry_entry=store:manual-redeliver 后端未实现 ⇒ fail-closed 到人工客服',
    }
  }

  // 无 retry_entry 或其他值 ⇒ 默认人工兜底（不可点击）
  return {
    kind: 'manual-fallback',
    text: MANUAL_FALLBACK_TEXT,
    clickable: false,
    reason: params.statusReason || null,
    internal: '配送失败/拒收 ⇒ 人工客服兜底（无可点击动作）',
  }
}
