import { query, queryOne } from "../shared/db.js";

export async function getOverview() {
  const [tenantCount, userCount, storeCount, orderCount] = await Promise.all([
    queryOne<any>("SELECT COUNT(*) AS count FROM tenant WHERE status = 'ACTIVE'"),
    queryOne<any>("SELECT COUNT(*) AS count FROM t_sys_user WHERE status = 1"),
    queryOne<any>("SELECT COUNT(*) AS count FROM store WHERE status = 1"),
    queryOne<any>("SELECT COUNT(*) AS count FROM sale_order WHERE deleted = 0"),
  ]);

  return {
    tenantCount: tenantCount?.count ?? 0,
    userCount: userCount?.count ?? 0,
    storeCount: storeCount?.count ?? 0,
    orderCount: orderCount?.count ?? 0,
  };
}

export async function getTenants() {
  const tenants = await query<any>(
    "SELECT id, tenant_name, status, created_at FROM tenant ORDER BY id DESC LIMIT 100"
  );
  return tenants ?? [];
}

export async function getHealth() {
  return { status: "healthy", timestamp: new Date().toISOString() };
}