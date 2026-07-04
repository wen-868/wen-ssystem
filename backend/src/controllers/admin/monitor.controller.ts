import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import { getDbStatus, getApiStats, getExpiringTenants, notifyExpiringTenants } from "../services/admin/monitor.service.js";

export const getDbStatusCtrl = asyncHandler(async (_req: any, res: any) => {
  const status = await getDbStatus();
  res.json(ok(status));
});

export const getApiStatsCtrl = asyncHandler(async (_req: any, res: any) => {
  const stats = await getApiStats();
  res.json(ok(stats));
});

export const getExpiringTenantsCtrl = asyncHandler(async (req: any, res: any) => {
  const days = parseInt(req.query.days as string) || 7;
  const tenants = await getExpiringTenants(days);
  res.json(ok(tenants));
});

export const notifyExpiringTenantsCtrl = asyncHandler(async (req: any, res: any) => {
  const { tenantIds } = req.body;
  const count = await notifyExpiringTenants(tenantIds || []);
  res.json(ok({ notifiedCount: count }));
});