import { query, queryOne } from "../../shared/db";
import { ok } from "../../shared/response";

export async function getPlatformOverview(req: any, res: any) {
  const tenantCount = await queryOne<any>("SELECT COUNT(*) AS count FROM tenant WHERE status = 'ACTIVE'");
  const userCount = await queryOne<any>("SELECT COUNT(*) AS count FROM t_sys_user WHERE status = 1");
  const storeCount = await queryOne<any>("SELECT COUNT(*) AS count FROM store WHERE status = 1");
  const orderCount = await queryOne<any>("SELECT COUNT(*) AS count FROM sale_order WHERE deleted = 0");

  res.json(ok({
    tenantCount: tenantCount?.count ?? 0,
    userCount: userCount?.count ?? 0,
    storeCount: storeCount?.count ?? 0,
    orderCount: orderCount?.count ?? 0
  }));
}

export async function listPlatformTenants(req: any, res: any) {
  const tenants = await query<any>(
    "SELECT id, tenant_name, status, created_at FROM tenant ORDER BY id DESC LIMIT 100"
  );
  res.json(ok(tenants ?? []));
}
