/** 业务常量 */
export const constants = {
  /**
   * **唯一对外账号**的用户名（登录页「一键演示」用的那条账号）。
   *
   * S3-172：本常量是演示账号的**唯一事实来源**（`services/admin/auth.service.ts` 的
   * `DEMO_USERNAME` 与 `middleware/login-fail-limiter.ts` 的账号维度豁免都由它派生）。
   * 任何地方需要判断「是不是演示账号」，只允许引用本常量，禁止再写第二处字面量。
   *
   * S3-203（业主 2026-10-15 口径「不要做那么多的和演示相关账号，全部统一为一个，
   * 另外就是真实租户账号」）：唯一对外账号不再是独立的 `demo` 账号，而是
   * **租户 default 的真实超管 `admin`** —— 它既是真实超管，同时承担演示入口。
   * 历史 `demo` 账号（租户 demo）由迁移 `docs/migrations/200_账号口径统一.sql` 停用。
   */
  DEMO_USERNAME: "admin",
  /**
   * 唯一对外账号的**统一口令**（唯一来源）。
   *
   * S3-175（业主口径「演示帐号密码一定要统一」）建立了"全系统只有一个公开口令"的原则；
   * S3-203 沿用该原则、只把**值与承载账号**换成业主 2026-10-15 定案的这一套：
   *   · 对外只有一个账号与一个口令：`admin` / `admin@2026`（租户 default 的真实超管）；
   *   · 前端回退值在 `admin-web/src/api/common.ts`、`app-mobile/src/api/modules/auth.ts`
   *     （读 `VITE_DEMO_PASSWORD`，默认与本值同）；
   *   · 线上权威值由迁移 200 写入（本文件只是代码侧口径，改本值不会自动改库）。
   *
   * ⚠️ 与 S3-175 的差别（**不要按旧口径理解**）：`store_manager` / `store_operator` 这两个
   * 门店角色演示账号**不再**与本值同口令 —— 迁移 200 已把它们轮换为**不公开的强口令**
   * （只留哈希，明文不入仓）；mock 态（单测/`USE_MOCK_DB`）里的门店账号口令仍是本值，
   * 那是**测试夹具**，不代表生产现状。
   * ⚠️ 平台侧 `t_platform_admin.admin` 与租户侧 `t_sys_user.admin` **同名同口令但身份独立**：
   * 前者走 `requirePlatformPermission`，后者走租户 RBAC；不存在"一个账号一套权限"。
   */
  DEMO_PASSWORD: "admin@2026",
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
