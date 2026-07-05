/** 业务常量 */
export const constants = {
  /** 默认箱规 */
  DEFAULT_BOX_RATIO: 12,
  /** 导出上限 */
  MAX_EXPORT_LIMIT: 5000,
  /** 告警阈值（天） */
  ALERT_THRESHOLD_DAYS: 5,
  /** 默认保质期（天） */
  DEFAULT_SHELF_LIFE_DAYS: 365,
  /** 默认分页条数 */
  DEFAULT_PAGE_SIZE: 20,
  /** 最大分页条数 */
  MAX_PAGE_SIZE: 100,
  /** 售后截止时间（毫秒）48小时 */
  AFTERSALE_DEADLINE_MS: 48 * 60 * 60 * 1000,
  /** 账龄分组 */
  AR_AGING_GROUPS: [
    { label: "0-30天", min: 0, max: 30 },
    { label: "30-60天", min: 30, max: 60 },
    { label: "60-90天", min: 60, max: 90 },
    { label: "90天以上", min: 90, max: Infinity },
  ],
} as const;