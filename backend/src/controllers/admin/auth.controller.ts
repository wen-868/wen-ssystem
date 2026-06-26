import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as authService from "../../services/admin/auth.service.js";

export const login = asyncHandler(async (req, res) => {
  const body = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  try {
    const result = await authService.login(body.username, body.password);
    res.json(ok(result));
  } catch (e: any) {
    res.status(401).json({ code: "401", message: e.message });
  }
});

export const getMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user!);
  res.json(ok(result));
});

export const getSettings = asyncHandler(async (req, res) => {
  const result = await authService.getSettings(req.user!.id, req.tenantId!);
  res.json(ok(result));
});

export const updateSettings = asyncHandler(async (req, res) => {
  const body = z.object({
    defaultHomepage: z.enum(['/admin', '/cashier']).optional()
  }).parse(req.body);
  const result = await authService.updateSettings(req.user!.id, body.defaultHomepage || null, req.tenantId!);
  res.json(ok(result));
});