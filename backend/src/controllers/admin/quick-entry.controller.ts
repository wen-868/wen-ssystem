import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as quickEntryService from "../../services/admin/quick-entry.service.js";

export const listQuickEntries = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const role = req.query.role as string | undefined;
  const result = await quickEntryService.listQuickEntries(tenantId, role);
  res.json(ok(result));
});

export const createQuickEntry = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { name, icon, route, group, enabled, visibleRoles } = req.body;
  if (!name || !icon || !route) {
    res.status(400).json({ code: "400", message: "name、icon、route 为必填项" });
    return;
  }
  const result = await quickEntryService.createQuickEntry(tenantId, {
    name, icon, route, group, enabled, visibleRoles
  });
  res.json(ok(result));
});

export const updateQuickEntry = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const { name, icon, route, group, enabled, visibleRoles } = req.body;
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
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ code: "400", message: "ids 为必填的数组" });
    return;
  }
  const result = await quickEntryService.sortQuickEntries(tenantId, ids);
  res.json(ok(result));
});