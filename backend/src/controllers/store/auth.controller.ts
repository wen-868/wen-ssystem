import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as authService from "../../services/store/auth.service";

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.username, req.body.password);
  res.json(ok(result));
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(ok(authService.getCurrentUser(req.user!)));
});

export const getStoreInfo = asyncHandler(async (req, res) => {
  const store = await authService.getStoreInfo(req.user?.storeId ?? 1, req.tenantId!);
  if (!store) { res.status(404).json(fail("门店不存在", "1")); return; }
  res.json(ok(store));
});