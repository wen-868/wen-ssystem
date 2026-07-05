/** 权限开关配置 */
export const permissionConfig = {
  /** 追溯码总开关 */
  TRACE_ENABLED: true,
  /** 批发价查看权限开关 */
  WHOLESALE_PRICE_ENABLED: true,
  /** 微信分享开关 */
  WECHAT_SHARE_ENABLED: false,
  /** API 按量计费开关 */
  API_BILLING_ENABLED: false,
} as const;