import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import {
  listTenants, getTenantById, checkTenantNameExists,
  createTenant, updateTenant, toggleTenantStatus
} from "../services/platform-tenant.service.js";

export const platformTenantRouter = Router();

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
    res.status(404).json({ code: "404", message: "租户不存在" });
    return;
  }
  res.json(ok(tenant));
}));

// POST /api/platform/tenants - 创建租户
platformTenantRouter.post("/", asyncHandler(async (req: any, res: any) => {
  const { tenantName, contactName, contactMobile, contactEmail, adminUsername, adminPassword, expireAt } = req.body;

  if (!tenantName || !contactName || !contactMobile || !adminUsername || !adminPassword) {
    res.status(400).json({ code: "400", message: "缺少必填字段" });
    return;
  }

  const exists = await checkTenantNameExists(tenantName);
  if (exists) {
    res.status(400).json({ code: "400", message: "租户名称已存在" });
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
    res.status(400).json({ code: "400", message: "无效的状态值" });
    return;
  }
  await toggleTenantStatus(Number(req.params.id), status);
  res.json(ok({ success: true }));
}));