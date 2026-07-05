import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePlatformAuth } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import {
  listTenants, getTenantById, checkTenantNameExists,
  createTenant, updateTenant, toggleTenantStatus
} from "../services/platform-tenant.service.js";

export const platformTenantRouter = Router();

// 所有平台租户管理接口需要平台管理员认证
platformTenantRouter.use(requirePlatformAuth);

// GET /api/platform/tenants - 租户列表
platformTenantRouter.get("/", asyncHandler(async (req: any, res: any) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = req.query.keyword as string | undefined;
  const result = await listTenants(page, pageSize, keyword);
  res.json(ok(result));
}));

// GET /api/platform/tenants/:id - 租户详情
platformTenantRouter.get("/:id", asyncHandler(async (req: any, res: any) => {
  const tenant = await getTenantById(Number(req.params.id));
  if (!tenant) {
    res.status(404).json(fail("租户不存在", "404"));
    return;
  }
  res.json(ok(tenant));
}));

// POST /api/platform/tenants - 创建租户
platformTenantRouter.post("/", asyncHandler(async (req: any, res: any) => {
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
}));

// PUT /api/platform/tenants/:id - 更新租户
platformTenantRouter.put("/:id", asyncHandler(async (req: any, res: any) => {
  try {
    await updateTenant(Number(req.params.id), req.body);
    res.json(ok({ success: true }));
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ code: String(err.statusCode || 500), message: err.message });
  }
}));

// POST /api/platform/tenants/:id/toggle - 启用/禁用租户
platformTenantRouter.post("/:id/toggle", asyncHandler(async (req: any, res: any) => {
  const { status } = req.body;
  if (!["ACTIVE", "DISABLED"].includes(status)) {
    res.status(400).json(fail("无效的状态值", "400"));
    return;
  }
  await toggleTenantStatus(Number(req.params.id), status);
  res.json(ok({ success: true }));
}));