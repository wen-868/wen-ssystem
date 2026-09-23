/**
 * 开放平台常量（事件目录 / 投递常量）
 *
 * 依据：`docs/tasks/cards/R101-C3-0-凌舟裁定.md` §二.4（事件目录不在本批实现范围内，
 *       但 `GET /api/platform/open/events` 需返回码表）+ C3-0 清账 C3-0-17。
 *
 * 口径说明（诚实边界）：
 * - 事件码表在后端此前**只存在于前端文案/设计稿**，本文件是后端**唯一来源**（常量枚举、零 DDL）。
 * - 本文件只收录 C3-0 清账里已给出的 4 个示例事件码，**不自行扩张**码表；
 *   最终码表须由产品/凌舟确认后登记 API 契约（防线2），已列入回传卡「需裁定/登记」清单。
 */

export interface OpenPlatformEvent {
  /** 事件类型码（Webhook 订阅入参取值） */
  code: string;
  /** 中文名称（前端下拉展示） */
  name: string;
  /** 触发时机说明 */
  description: string;
}

/** 开放平台事件目录（常量，无数据库依赖） */
export const OPEN_PLATFORM_EVENTS: OpenPlatformEvent[] = [
  {
    code: "order.created",
    name: "订单创建",
    description: "开放平台订单创建成功后推送",
  },
  {
    code: "order.approved",
    name: "订单审核通过",
    description: "订单审核通过后推送",
  },
  {
    code: "inventory.below_threshold",
    name: "库存低于阈值",
    description: "SKU 可用库存低于预警阈值时推送",
  },
  {
    code: "tenant.status_changed",
    name: "租户状态变更",
    description: "租户启用/停用/欠费等状态变更后推送",
  },
];

/** 事件码列表（zod 枚举入参用） */
export const OPEN_PLATFORM_EVENT_CODES: string[] = OPEN_PLATFORM_EVENTS.map((e) => e.code);

/** 事件码是否在目录内 */
export function isOpenPlatformEvent(code: string): boolean {
  return OPEN_PLATFORM_EVENT_CODES.includes(code);
}
