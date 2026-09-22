import { queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { getTenantQuota } from "./tenant-quota.service";

/**
 * C1-2 A3：单租户概况聚合（只读）
 *
 * 每个维度都必须有**真实数据源**；无数据源的维度返回 null 并在 `unavailable` 里写明原因，
 * 禁止编造（凌舟硬性口径第 4 条）。
 *
 * 维度 → 数据源：
 * - goods        商品数量     → `t_product_spu` COUNT（tenant_id 过滤）
 * - goodsCap     套餐商品上限 → `t_subscription_plan.max_products`（走 tenant-quota.service，复用不重写）
 * - orders       本月订单量   → `t_sale_bill` COUNT（本月）
 * - ordersMomPct 环比         → 本月 vs 上月 `t_sale_bill` COUNT；上月为 0 时 null（无分母，不造 0）
 * - staff        员工用户数   → `t_sys_user` COUNT
 * - staffActive7d 近 7 日活跃 → `t_sys_user_login` COUNT(DISTINCT user_id)
 * - docCount     本月单据量   → 本月 `t_sale_bill` + 本月 `t_purchase_order`（口径写在 docBreakdown，可核）
 * - docRate      单据占比     → **无数据源**：套餐无「单据量」上限字段 → null
 * - store/storeRate 存储水位  → `t_upload_file.file_size` 合计 / 配额上限（走 tenant-quota.service，单位 GB）
 *
 * 租户隔离：所有查询均带 `tenant_id = ?`；租户存在性按 `t_tenant.id`（主键，VARCHAR）精确匹配。
 */

interface CountRow {
  total: number | string;
}

interface TenantRow {
  id: string;
  tenantCode: string | null;
  tenantName: string | null;
  status: unknown;
  expireAt: string | Date | null;
}

export interface TenantOverviewResult {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  status: string;
  expireAt: string | null;
  planName: string;
  goods: number | null;
  goodsCap: number | null;
  orders: number;
  ordersPrevMonth: number;
  ordersMomPct: number | null;
  staff: number;
  staffActive7d: number | null;
  docCount: number;
  docBreakdown: { saleBills: number; purchaseOrders: number };
  docRate: null;
  store: number | null;
  storeUnit: string;
  storeRate: number | null;
  unavailable: { key: string; reason: string }[];
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function formatDateTime(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(
      value.getHours()
    )}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  return String(value);
}

export async function getTenantOverview(tenantId: string): Promise<TenantOverviewResult> {
  const tenant = await queryOne<TenantRow>(
    `SELECT id, tenant_code AS tenantCode, tenant_name AS tenantName, status, expire_at AS expireAt
     FROM t_tenant WHERE id = ?`,
    [tenantId]
  );
  if (!tenant) throw new AppError("租户不存在", 404);

  const [counters, quota] = await Promise.all([fetchCounters(tenantId), getTenantQuota(String(tenant.id))]);

  const { goods, orders, ordersPrevMonth, staff, staffActive7d, purchaseOrders } = counters;
  const products = quota.quota.products;
  const storage = quota.quota.storage;

  return {
    tenantId: String(tenant.id),
    tenantCode: tenant.tenantCode ?? "",
    tenantName: tenant.tenantName ?? "",
    status: tenant.status == null ? "" : String(tenant.status),
    expireAt: formatDateTime(tenant.expireAt),
    planName: quota.planName,
    goods,
    goodsCap: products ? products.limit : null,
    orders,
    ordersPrevMonth,
    ordersMomPct: monthOverMonthPct(orders, ordersPrevMonth),
    staff,
    staffActive7d,
    docCount: orders + purchaseOrders,
    docBreakdown: { saleBills: orders, purchaseOrders },
    docRate: null,
    store: storage ? storage.used : null,
    storeUnit: storage ? storage.unit : "GB",
    storeRate: storage ? percentOf(storage.used, storage.limit) : null,
    unavailable: [
      {
        key: "docRate",
        reason:
          "套餐（t_subscription_plan）无「单据量」上限字段（仅 max_users/max_stores/max_customers/max_products/max_storage_mb），无占比分母",
      },
    ],
  };
}

interface OverviewCounters {
  goods: number;
  orders: number;
  ordersPrevMonth: number;
  staff: number;
  staffActive7d: number;
  purchaseOrders: number;
}

/** 各维度计数：全部按 tenant_id 过滤并并发查询 */
async function fetchCounters(tenantId: string): Promise<OverviewCounters> {
  const num = (row: CountRow | null | undefined) => Number(row?.total ?? 0);
  const [goodsRow, ordersRow, prevOrdersRow, staffRow, activeRow, purchaseRow] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total FROM t_product_spu WHERE tenant_id = ?`, [tenantId]),
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM t_sale_bill
       WHERE tenant_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [tenantId]
    ),
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM t_sale_bill
       WHERE tenant_id = ?
         AND created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01')
         AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [tenantId]
    ),
    queryOne<CountRow>(`SELECT COUNT(*) AS total FROM t_sys_user WHERE tenant_id = ?`, [tenantId]),
    queryOne<CountRow>(
      `SELECT COUNT(DISTINCT user_id) AS total FROM t_sys_user_login
       WHERE tenant_id = ? AND login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [tenantId]
    ),
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM t_purchase_order
       WHERE tenant_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [tenantId]
    ),
  ]);

  return {
    goods: num(goodsRow),
    orders: num(ordersRow),
    ordersPrevMonth: num(prevOrdersRow),
    staff: num(staffRow),
    staffActive7d: num(activeRow),
    purchaseOrders: num(purchaseRow),
  };
}

/** 环比：上月为 0 时无分母 → null（不造 0） */
function monthOverMonthPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return round2(((current - previous) / previous) * 100);
}

/** 占比：无上限或上限为 0 → null（不造 0%） */
function percentOf(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return round2((used / limit) * 100);
}
