import { ok, fail } from "../../shared/response";
import { generateInitialPassword } from "../../shared/initial-password";
import {
  listTenants,
  getTenantById,
  checkTenantNameExists,
  createTenant,
  updateTenant,
  toggleTenantStatus,
  type TenantStatus,
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
  const tenant = await getTenantById(String(req.params.id));
  if (!tenant) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(tenant));
}

/** 创建租户 */
export async function createPlatformTenant(req: any, res: any) {
  const { tenantName, contactName, contactMobile, contactEmail, adminUsername, expireAt } = req.body;

  if (!tenantName || !contactName || !contactMobile || !adminUsername) {
    res.status(400).json(fail("缺少必填字段", "400"));
    return;
  }

  const exists = await checkTenantNameExists(tenantName);
  if (exists) {
    res.status(400).json(fail("租户名称已存在", "400"));
    return;
  }

  // MS-SECURITY-BASELINE-01F1：管理员口令不再由前端提交（旧实现"前端收密码但后端忽略"）。
  // 改由服务端用 crypto 随机源生成一次性初始口令：真实哈希落库，明文仅在创建响应返回一次，
  // 由前端一次性展示/复制/确认交付给操作者。
  const adminInitialPassword = generateInitialPassword();

  const tenantId = await createTenant({
    tenantName, contactName, contactMobile, contactEmail, adminUsername, adminPassword: adminInitialPassword, expireAt
  });

  res.json(ok({ id: tenantId, adminInitialPassword }));
}

/** 更新租户 */
export async function updatePlatformTenant(req: any, res: any) {
  await updateTenant(String(req.params.id), req.body);
  res.json(ok({ success: true }));
}

/** 启用/禁用租户 */
export async function togglePlatformTenantStatus(req: any, res: any) {
  const { status } = req.body;
  if (!["ACTIVE", "DISABLED"].includes(status)) {
    res.status(400).json(fail("无效的状态值", "400"));
    return;
  }
  const applied = await toggleTenantStatus(String(req.params.id), status as TenantStatus);
  res.json(ok({ success: true, status: applied }));
}
