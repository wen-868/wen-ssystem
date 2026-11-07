import { ok, fail } from "../../shared/response";
import {
  listTenants,
  getTenantById,
  checkTenantNameExists,
  createTenant,
  updateTenant,
  toggleTenantStatus,
  type TenantStatus,
} from "../../services/platform-tenant.service";
// TOTAL-TENANT-NAME-SERVER-TRUTH-01：名称真源单点（回退链 tenantName→name→companyName、
// 全空→「未命名租户」）只实现在 tenant-admin.service 的 enrichTenantRecords 一处，
// 列表/详情/导出三类出口共用，禁止各层各写口径。
import { enrichTenantRecords } from "../../services/platform/tenant-admin.service";

/** 租户列表 */
export async function listPlatformTenants(req: any, res: any) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = req.query.keyword as string | undefined;
  const result = await listTenants(page, pageSize, keyword);
  // 名称真源：出口补齐 name / companyName / tenantDisplayName 三字段。
  // 前端 TenantList（UI 阶段）将用同一规则（tenantName → name → companyName → 「未命名租户」）
  // 计算单一 tenantDisplayName，后端出口语义与前端单点 helper 对齐；
  // tenantCode / contactMobile 为标识/联系字段，空值原样透传（不冒充、不出「—」）。
  // `|| []`：上游异常形态（无 records 字段）不 500，与既有路由级契约兼容。
  const records = await enrichTenantRecords(result.records || []);
  res.json(ok({ ...result, records }));
}

/** 租户详情 */
export async function getPlatformTenantById(req: any, res: any) {
  const tenant = await getTenantById(String(req.params.id));
  if (!tenant) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  // 与列表同一单点规则（TenantDetail 前端将复算同一 tenantDisplayName）
  const [enriched] = await enrichTenantRecords([tenant]);
  res.json(ok(enriched));
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
