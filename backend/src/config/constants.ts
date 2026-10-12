/** 业务常量 */
export const constants = {
  /**
   * 演示账号用户名（登录页「一键演示」用的那条账号）。
   *
   * S3-172：本常量是演示账号的**唯一事实来源**（`services/admin/auth.service.ts` 的
   * `DEMO_USERNAME` 与 `middleware/login-fail-limiter.ts` 的账号维度豁免都由它派生）。
   * 任何地方需要判断「是不是演示账号」，只允许引用本常量，禁止再写第二处 `"demo"` 字面量。
   */
  DEMO_USERNAME: "demo",
  /**
   * 演示/测试账号的**统一口令**（唯一来源）。
   *
   * S3-175（业主口径「演示帐号密码一定要统一」）：`demo`、`store_manager`、
   * `store_operator`、mock 态 `admin` 与全部测试脚本/测试文档一律使用本值。
   * 前端回退值另在 `admin-web/src/api/common.ts`、`app-mobile/src/api/modules/auth.ts`
   * （读 `VITE_DEMO_PASSWORD`，默认与本值同）。
   *
   * ⚠️ 真实超管（租户 `admin` / `tenant_admin` / 平台 `t_platform_admin.admin`）口令
   * **不参与统一**，且禁止在代码或迁移里写回任何公开值（见 shared/migration.ts）。
   */
  DEMO_PASSWORD: "Demo@2026",
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
