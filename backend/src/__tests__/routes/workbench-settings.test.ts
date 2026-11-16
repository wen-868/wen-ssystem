import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mockService = vi.hoisted(() => ({
  getWorkbenchSettings: vi.fn(),
  saveWorkbenchSettings: vi.fn(),
  resetWorkbenchSettings: vi.fn(),
}));

vi.mock("../../services/admin/workbench-settings.service", () => mockService);
vi.mock("../../services/admin/rbac.service", () => ({
  checkUserPermission: vi.fn(async (_userId: number, _tenantId: number, _permCode: string) => true),
}));
vi.mock("../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next),
}));

import { checkUserPermission } from "../../services/admin/rbac.service";
import { routeConfig, workbenchSettingsRouter } from "../../routes/workbench-settings.routes";

function buildApp(user: { id: number; tenantId: string; permissions?: string[]; realName?: string; username?: string; roles?: string[] }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { ...user, roles: user.roles ?? [] };
    (req as any).tenantId = user.tenantId;
    next();
  });
  app.use(routeConfig.prefix, workbenchSettingsRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || err.status || 500).json({ code: String(err.statusCode || err.status || 500), msg: err.message });
  });
  return app;
}

describe("workbench-settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkUserPermission).mockResolvedValue(true);
    mockService.getWorkbenchSettings.mockResolvedValue({ version: 1, revision: 0, updatedAt: null, values: {} });
    mockService.saveWorkbenchSettings.mockResolvedValue({ version: 1, revision: 1, updatedAt: "now", values: { a: 1 } });
    mockService.resetWorkbenchSettings.mockResolvedValue({ version: 1, revision: 2, updatedAt: "now", values: {} });
  });

  it("导出正确 routeConfig 与 auth", () => {
    expect(routeConfig.prefix).toBe("/api/admin/workbench-settings");
    expect(routeConfig.auth).toBe("requireAuthWithTenant");
  });

  it("个人设置读取/保存/重置仅使用 JWT user.id，不信任 body userId", async () => {
    const app = buildApp({ id: 42, tenantId: "t1", permissions: [] });
    await request(app).get("/api/admin/workbench-settings/me").expect(200);
    await request(app).put("/api/admin/workbench-settings/me").send({ settings: { "ui.density": "compact" }, userId: 999 }).expect(200);
    await request(app).post("/api/admin/workbench-settings/me/reset").send({ userId: 999 }).expect(200);

    expect(mockService.saveWorkbenchSettings).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "user", tenantId: "t1", userId: 42, settings: { "ui.density": "compact" } }),
    );
    expect(mockService.resetWorkbenchSettings).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "user", tenantId: "t1", userId: 42 }),
    );
  });

  it("租户设置写接口无 system:config 时返回 403", async () => {
    const { checkUserPermission } = await import("../../services/admin/rbac.service");
    vi.mocked(checkUserPermission).mockResolvedValue(false);
    const app = buildApp({ id: 1, tenantId: "t1", roles: ["STORE_MANAGER"], permissions: [] });
    const put = await request(app).put("/api/admin/workbench-settings/tenant").send({ settings: { a: 1 } });
    const reset = await request(app).post("/api/admin/workbench-settings/tenant/reset").send({});
    expect(put.status).toBe(403);
    expect(reset.status).toBe(403);
    expect(mockService.saveWorkbenchSettings).not.toHaveBeenCalled();
    expect(mockService.resetWorkbenchSettings).not.toHaveBeenCalled();
  });

  it("租户设置写接口有 system:config 时放行", async () => {
    const app = buildApp({ id: 1, tenantId: "t1", roles: ["STORE_MANAGER"], permissions: ["system:config"] });
    await request(app).put("/api/admin/workbench-settings/tenant").send({ settings: { a: 1 } }).expect(200);
    await request(app).post("/api/admin/workbench-settings/tenant/reset").send({}).expect(200);
    expect(mockService.saveWorkbenchSettings).toHaveBeenCalledWith(expect.objectContaining({ scope: "tenant", tenantId: "t1" }));
    expect(mockService.resetWorkbenchSettings).toHaveBeenCalledWith(expect.objectContaining({ scope: "tenant", tenantId: "t1" }));
  });

  it("租户设置读取不要求 system:config", async () => {
    const app = buildApp({ id: 1, tenantId: "t1", roles: ["STORE_OPERATOR"], permissions: [] });
    await request(app).get("/api/admin/workbench-settings/tenant").expect(200);
    expect(mockService.getWorkbenchSettings).toHaveBeenCalledWith(expect.objectContaining({ scope: "tenant", tenantId: "t1", userId: 1 }));
  });
});
