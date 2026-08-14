import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as quickEntryService from "../../services/admin/quick-entry.service";

const createQuickEntrySchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().min(1),
  route: z.string().min(1),
  group: z.string().max(50).optional(),
  enabled: z.boolean().default(true),
  visibleRoles: z.array(z.string()).optional(),
});

const updateQuickEntrySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().optional(),
  route: z.string().optional(),
  group: z.string().max(50).optional(),
  enabled: z.boolean().optional(),
  visibleRoles: z.array(z.string()).optional(),
});

const sortQuickEntriesSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export const listQuickEntries = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const role = req.query.role as string | undefined;
  const result = await quickEntryService.listQuickEntries(tenantId, role);
  res.json(ok(result));
});

export const createQuickEntry = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = createQuickEntrySchema.parse(req.body);
  const { name, icon, route, group, enabled, visibleRoles } = body;
  const result = await quickEntryService.createQuickEntry(tenantId, {
    name, icon, route, group, enabled, visibleRoles
  });
  res.json(ok(result));
});

export const updateQuickEntry = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = updateQuickEntrySchema.parse(req.body);
  const { name, icon, route, group, enabled, visibleRoles } = body;
  const result = await quickEntryService.updateQuickEntry(tenantId, id, {
    name, icon, route, group, enabled, visibleRoles
  });
  res.json(ok(result));
});

export const deleteQuickEntry = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const result = await quickEntryService.deleteQuickEntry(tenantId, id);
  res.json(ok(result));
});

export const sortQuickEntries = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = sortQuickEntriesSchema.parse(req.body);
  const { ids } = body;
  const result = await quickEntryService.sortQuickEntries(tenantId, ids);
  res.json(ok(result));
});