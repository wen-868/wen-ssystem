import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/workbench-settings.service";

const settingsValue = z.union([z.string().max(4096), z.number().finite(), z.boolean(), z.null()]);
const saveSchema = z.object({
  settings: z.record(z.string(), settingsValue),
  baseRevision: z.number().int().min(0).nullable().optional(),
});
const resetSchema = z.object({
  keys: z.array(z.string()).optional(),
  baseRevision: z.number().int().min(0).nullable().optional(),
});

function actor(req: any): service.WorkbenchSettingsActor {
  return {
    userId: Number(req.user?.id || 0),
    userName: String(req.user?.realName || req.user?.username || "未识别"),
    role: Array.isArray(req.user?.roles) ? req.user.roles.join(",") : "",
    ip: String(req.ip || req.socket?.remoteAddress || "").replace("::ffff:", ""),
    userAgent: String(req.headers?.["user-agent"] || ""),
  };
}

function tenantId(req: any): string {
  return String(req.tenantId || req.user?.tenantId || "");
}

export const getTenantSettings = asyncHandler(async (req, res) => {
  const result = await service.getWorkbenchSettings({
    scope: "tenant",
    tenantId: tenantId(req),
    userId: Number(req.user!.id),
  });
  res.json(ok(result));
});

export const saveTenantSettings = asyncHandler(async (req, res) => {
  const body = saveSchema.parse(req.body);
  const result = await service.saveWorkbenchSettings({
    scope: "tenant",
    tenantId: tenantId(req),
    userId: Number(req.user!.id),
    settings: body.settings,
    baseRevision: body.baseRevision,
    actor: actor(req),
  });
  res.json(ok(result));
});

export const resetTenantSettings = asyncHandler(async (req, res) => {
  const body = resetSchema.parse(req.body);
  const result = await service.resetWorkbenchSettings({
    scope: "tenant",
    tenantId: tenantId(req),
    userId: Number(req.user!.id),
    keys: body.keys,
    baseRevision: body.baseRevision,
    actor: actor(req),
  });
  res.json(ok(result));
});

export const getMySettings = asyncHandler(async (req, res) => {
  const result = await service.getWorkbenchSettings({
    scope: "user",
    tenantId: tenantId(req),
    userId: Number(req.user!.id),
  });
  res.json(ok(result));
});

export const saveMySettings = asyncHandler(async (req, res) => {
  const body = saveSchema.parse(req.body);
  const result = await service.saveWorkbenchSettings({
    scope: "user",
    tenantId: tenantId(req),
    userId: Number(req.user!.id),
    settings: body.settings,
    baseRevision: body.baseRevision,
    actor: actor(req),
  });
  res.json(ok(result));
});

export const resetMySettings = asyncHandler(async (req, res) => {
  const body = resetSchema.parse(req.body);
  const result = await service.resetWorkbenchSettings({
    scope: "user",
    tenantId: tenantId(req),
    userId: Number(req.user!.id),
    keys: body.keys,
    baseRevision: body.baseRevision,
    actor: actor(req),
  });
  res.json(ok(result));
});
