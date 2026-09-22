import { query } from "../../shared/db";

/**
 * C1-2 A1：租户各状态计数（平台跨租户只读聚合）
 *
 * 数据源与枚举取证（逐条可复跑）：
 * - 表：`t_tenant`（`backend/src/shared/migration.ts:211`、`docs/migrations/092_租户ID.sql:64`）
 * - 后端**实际写入/比较**的状态值只有 ACTIVE / DISABLED / EXPIRED：
 *   · `backend/src/controllers/platform/tenant.controller.ts:61` 强校验 `["ACTIVE","DISABLED"]`
 *   · `backend/src/services/platform-tenant.service.ts:89` 新建租户写 `'ACTIVE'`
 *   · `backend/src/services/platform/platform-overview.service.ts:124-125` 统计 DISABLED / EXPIRED
 *   · `backend/src/services/subscription-expiry.service.ts:93` 订阅到期写 `'EXPIRED'`
 * - 历史表定义注释为 TINYINT（`1=正常 0=停用`，`docs/migrations/092_租户ID.sql:68`），
 *   故 `'1'/'0'` 亦按该注释映射到 正常/停用（两套取值都可能存在于存量数据）。
 * - 设计稿四态中的「欠费」「已注销」在后端**无对应枚举值**：不做猜测映射，
 *   对应键恒为 0，真实但无法归入四态的取值原样列在 `unmapped`。
 *
 * 租户隔离说明：`t_tenant` 是租户主表本身（表内无 tenant_id 过滤目标），
 * 本聚合按设计就是**跨租户**，故不起用 queryWithTenant。
 */

export interface TenantStatusStats {
  /** 租户总数（全部状态求和） */
  total: number;
  /** 四态计数（前端 tab 口径）+ 已到期；无对应枚举值者恒为 0 */
  counts: {
    normal: number;
    owed: number;
    frozen: number;
    cancelled: number;
    expired: number;
  };
  /** 库内真实 status 分布（原样，便于核对） */
  byStatus: { status: string; count: number }[];
  /** 无法归入上述键的真实取值（禁止静默丢弃） */
  unmapped: { status: string; count: number }[];
}

const NORMAL_VALUES = new Set(["ACTIVE", "1"]);
const FROZEN_VALUES = new Set(["DISABLED", "0"]);
const EXPIRED_VALUES = new Set(["EXPIRED"]);

export async function getTenantStatusStats(): Promise<TenantStatusStats> {
  const rows = await query<{ statusValue: unknown; total: number | string }>(
    `SELECT status AS statusValue, COUNT(*) AS total FROM t_tenant GROUP BY status`
  );

  const counts = { normal: 0, owed: 0, frozen: 0, cancelled: 0, expired: 0 };
  const byStatus: { status: string; count: number }[] = [];
  const unmapped: { status: string; count: number }[] = [];
  let total = 0;

  for (const row of rows) {
    const raw = row.statusValue == null ? "" : String(row.statusValue);
    const count = Number(row.total ?? 0);
    total += count;
    byStatus.push({ status: raw, count });

    const key = raw.trim().toUpperCase();
    if (NORMAL_VALUES.has(key)) counts.normal += count;
    else if (FROZEN_VALUES.has(key)) counts.frozen += count;
    else if (EXPIRED_VALUES.has(key)) counts.expired += count;
    else unmapped.push({ status: raw, count });
  }

  return { total, counts, byStatus, unmapped };
}
