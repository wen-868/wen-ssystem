import { query, queryOne } from "../../shared/db";

/**
 * R101-S2-01 批 4 · 租户「资源配额使用情况」只读聚合
 *
 * 仅对现有表做 COUNT / SUM，不新建任何表（凌舟裁定 4.3）。
 * 换算统一在后端完成（裁定③：前端零换算、零除法）。
 *
 * 响应：`{ tenantId, planName, quota, unavailable }`
 * - quota 固定 6 键：accounts / products / stores / storage / apiDaily / aiMonthly
 * - 有数据源：值为 { used, limit, unit }
 * - 无数据源（apiDaily）：值恒为 null，并在 unavailable 给出 { key, reason }
 * - 无订阅：planName = ""，各 limit = null（但 used 仍返回真实计数）
 */

/** 2 位小数四舍五入（合同口径：后端一次性换算） */
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** 套餐限额字段：列值为 null 时回退 null，不落 0（避免「0 上限」误导） */
function planLimit(value: unknown): number | null {
  return value == null ? null : Number(value);
}

export interface QuotaDimension {
  used: number;
  limit: number | null;
  unit: string;
  unlimited?: boolean;
}

export interface TenantQuotaResult {
  tenantId: string;
  planName: string;
  quota: {
    accounts: QuotaDimension | null;
    products: QuotaDimension | null;
    stores: QuotaDimension | null;
    storage: QuotaDimension | null;
    apiDaily: null;
    aiMonthly: QuotaDimension | null;
  };
  unavailable: { key: string; reason: string }[];
}

interface CountRow {
  total: number | string;
}

interface PlanRow {
  planName: string | null;
  maxUsers: number | null;
  maxStores: number | null;
  maxProducts: number | null;
  maxStorageMb: number | null;
}

interface StorageCfgRow {
  storage_limit: number | string | null;
  storage_limit_unit: string | null;
}

interface AiBillingRow {
  monthly_chat_limit: number | string | null;
}

/**
 * 取租户「资源配额使用情况」只读聚合。
 * @param tenantId 租户 ID（来自路由 :id，字符串）
 */
export async function getTenantQuota(tenantId: string): Promise<TenantQuotaResult> {
  // 套餐与限额（最近一次 ACTIVE 订阅优先）
  const planRow = await queryOne<PlanRow>(
    `SELECT p.plan_name AS planName, p.max_users AS maxUsers, p.max_stores AS maxStores,
            p.max_products AS maxProducts, p.max_storage_mb AS maxStorageMb
     FROM t_subscription s JOIN t_subscription_plan p ON p.id = s.plan_id
     WHERE s.tenant_id = ?
     ORDER BY (s.status = 'ACTIVE') DESC, s.created_at DESC, s.id DESC
     LIMIT 1`,
    [tenantId]
  );

  // 租户级存储配额（key/value 表：按 config_key 精确定位，口径与 storage-guard.ts 一致）
  const storageCfgRow = await queryOne<StorageCfgRow>(
    `SELECT storage_limit, storage_limit_unit FROM t_tenant_config
     WHERE tenant_id = ? AND config_key = 'storage_limit' AND storage_limit IS NOT NULL
     LIMIT 1`,
    [tenantId]
  );

  // AI 月度限额（0 = 不限量）
  const aiBillingRow = await queryOne<AiBillingRow>(
    `SELECT monthly_chat_limit FROM t_tenant_ai_billing WHERE tenant_id = ? LIMIT 1`,
    [tenantId]
  );

  // 用量：全部并发
  const [accountsRow, productsRow, storesRow, storageUsedRow, aiUsedRow] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total FROM t_sys_user WHERE tenant_id = ?`, [tenantId]),
    queryOne<CountRow>(`SELECT COUNT(*) AS total FROM t_product_spu WHERE tenant_id = ?`, [tenantId]),
    // 仓库与门店同表（t_store），按 store_type='WAREHOUSE' 区分，口径与 warehouse.service.ts 一致
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM t_store WHERE tenant_id = ? AND store_type = 'WAREHOUSE'`,
      [tenantId]
    ),
    queryOne<CountRow>(
      `SELECT IFNULL(SUM(file_size),0) AS total FROM t_upload_file WHERE tenant_id = ? AND status = 1`,
      [tenantId]
    ),
    queryOne<CountRow>(
      `SELECT IFNULL(SUM(chat_count),0) AS total FROM t_ai_usage_daily
       WHERE tenant_id = ? AND stat_date >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [tenantId]
    ),
  ]);

  // accounts / products / stores
  const accounts: QuotaDimension = {
    used: Number(accountsRow?.total ?? 0),
    limit: planLimit(planRow?.maxUsers),
    unit: "个",
  };
  const products: QuotaDimension = {
    used: Number(productsRow?.total ?? 0),
    limit: planLimit(planRow?.maxProducts),
    unit: "个",
  };
  const stores: QuotaDimension = {
    used: Number(storesRow?.total ?? 0),
    limit: planLimit(planRow?.maxStores),
    unit: "个",
  };

  // storage：字节 → GB（后端换算），限额优先取 t_tenant_config，取不到回退套餐 max_storage_mb
  const bytes = Number(storageUsedRow?.total ?? 0);
  const storageUsedGb = round2(bytes / 1024 ** 3);
  let storageLimitGb: number | null = null;
  if (storageCfgRow && storageCfgRow.storage_limit != null) {
    const lim = Number(storageCfgRow.storage_limit);
    if (storageCfgRow.storage_limit_unit === "MB") {
      storageLimitGb = round2(lim / 1024);
    } else if (storageCfgRow.storage_limit_unit === "GB") {
      storageLimitGb = round2(lim);
    } else if (storageCfgRow.storage_limit_unit === "TB") {
      storageLimitGb = round2(lim * 1024);
    }
    // 单位不在 MB/GB/TB 白名单内时，storageLimitGb 保持 null，走下面套餐回退
  }
  if (storageLimitGb == null) {
    // 回退套餐 max_storage_mb（单位为 MB，统一折算成响应单位 GB）
    const mb = planLimit(planRow?.maxStorageMb);
    storageLimitGb = mb == null ? null : round2(mb / 1024);
  }
  const storage: QuotaDimension = {
    used: storageUsedGb,
    limit: storageLimitGb,
    unit: "GB",
  };

  // aiMonthly
  const aiUsed = Number(aiUsedRow?.total ?? 0);
  const monthlyLimit = aiBillingRow ? Number(aiBillingRow.monthly_chat_limit) : null;
  const aiMonthly: QuotaDimension = {
    used: aiUsed,
    limit: monthlyLimit === 0 ? null : monthlyLimit,
    unit: "次·月",
    ...(monthlyLimit === 0 ? { unlimited: true } : {}),
  };

  // apiDaily：后端无调用计数数据源 → 恒 null
  const unavailable: { key: string; reason: string }[] = [
    { key: "apiDaily", reason: "后端无 API 调用计数数据源（无调用计数表）" },
  ];

  return {
    tenantId: String(tenantId),
    planName: planRow?.planName || "",
    quota: {
      accounts,
      products,
      stores,
      storage,
      apiDaily: null,
      aiMonthly,
    },
    unavailable,
  };
}
