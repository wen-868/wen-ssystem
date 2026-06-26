import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as authService from "../../services/store/auth.service.js";

export const login = asyncHandler(async (req, res) => {
  try {
    const result = await authService.login(req.body.username, req.body.password);
    res.json(ok(result));
  } catch (e: any) {
    res.status(401).json({ code: "401", message: e.message });
  }
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(ok(authService.getCurrentUser(req.user!)));
});

export const getStoreInfo = asyncHandler(async (req, res) => {
  const store = await authService.getStoreInfo(req.user?.storeId ?? 1, req.tenantId!);
  if (!store) { res.status(404).json({ code: "1", message: "门店不存在" }); return; }
  res.json(ok(store));
});