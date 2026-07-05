/** 租户配额配置 */
export const tenantConfig = {
  /** 默认存储配额（MB） */
  DEFAULT_STORAGE_MB: 10240, // 10G
  /** 最大租户数 */
  MAX_TENANTS: 100,
  /** 试用期（天） */
  TRIAL_DAYS: 30,
} as const;