import { ok, fail } from "../../shared/response";
import {
  listTenants,
  getTenantById,
  checkTenantNameExists,
  createTenant,
  updateTenant,
  toggleTenantStatus,
} from "../../services/platform-tenant.service";

/** 租户列表 */
export async function listPlatformTenants(req: any, res: any) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = req.query.keyword as string | undefined;
  const result = await listTenants(page, pageSize, keyword);
  res.json(ok(result));
}

/** 租户详情 */
export async function getPlatformTenantById(req: any, res: any) {
  const tenant = await getTenantById(Number(req.params.id));
  if (!tenant) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(tenant));
}

/** 创建租户 */
export async function createPlatformTenant(req: any, res: any) {
  const { tenantName, contactName, contactMobile, contactEmail, adminUsername, adminPassword, expireAt } = req.body;

  if (!tenantName || !contactName || !contactMobile || !adminUsername || !adminPassword) {
    res.status(400).json(fail("缺少必填字段", "400"));
    return;
  }

  const exists = await checkTenantNameExists(tenantName);
  if (exists) {
    res.status(400).json(fail("租户名称已存在", "400"));
    return;
  }

  const tenantId = await createTenant({
    tenantName, contactName, contactMobile, contactEmail, adminUsername, adminPassword, expireAt
  });

  res.json(ok({ id: tenantId }));
}

/** 更新租户 */
export async function updatePlatformTenant(req: any, res: any) {
  await updateTenant(Number(req.params.id), req.body);
  res.json(ok({ success: true }));
}

/** 启用/禁用租户 */
export async function togglePlatformTenantStatus(req: any, res: any) {
  const { status } = req.body;
  if (!["ACTIVE", "DISABLED"].includes(status)) {
    res.status(400).json(fail("无效的状态值", "400"));
    return;
  }
  await toggleTenantStatus(Number(req.params.id), status);
  res.json(ok({ success: true }));
}
