import { query, queryOne } from "../shared/db";

interface CountRow {
  count: number;
}

interface TenantBriefRow {
  id: number;
  tenant_name: string;
  status: string;
  created_at: string;
}

export async function getOverview() {
  const [tenantCount, userCount, storeCount, orderCount] = await Promise.all([
    queryOne<CountRow>("SELECT COUNT(*) AS count FROM t_tenant WHERE status = 'ACTIVE'"),
    queryOne<CountRow>("SELECT COUNT(*) AS count FROM t_sys_user WHERE status = 1"),
    queryOne<CountRow>("SELECT COUNT(*) AS count FROM t_store WHERE status = 1"),
    queryOne<CountRow>("SELECT COUNT(*) AS count FROM t_sale_order WHERE deleted = 0"),
  ]);

  return {
    tenantCount: tenantCount?.count ?? 0,
    userCount: userCount?.count ?? 0,
    storeCount: storeCount?.count ?? 0,
    orderCount: orderCount?.count ?? 0,
  };
}

export async function getTenants() {
  const tenants = await query<TenantBriefRow>(
    "SELECT id, tenant_name, status, created_at FROM t_tenant ORDER BY id DESC LIMIT 100"
  );
  return tenants ?? [];
}

export async function getHealth() {
  return { status: "healthy", timestamp: new Date().toISOString() };
}