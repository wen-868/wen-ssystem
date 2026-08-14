import express from "express";
import { Router } from "express";

export interface TestAppOptions {
  prefix?: string;
  router: Router;
  mockUser?: any;
  mockTenantId?: string;
}

export function createTestApp(options: TestAppOptions) {
  const { prefix = "/api/test", router, mockUser, mockTenantId = "test-tenant" } = options;

  const app = express();
  app.use(express.json());

  app.use((req: any, _res, next) => {
    req.tenantId = mockTenantId;
    req.user = mockUser || {
      id: 1,
      username: "testadmin",
      realName: "测试管理员",
      roles: ["SUPER_ADMIN"],
      tenantId: mockTenantId,
    };
    next();
  });

  app.use(prefix, router);

  app.use((err: any, _req: any, res: any, _next: any) => {
    const statusCode = err?.statusCode || 500;
    const message = err?.message || "服务器内部错误";
    res.status(statusCode).json({ success: false, message, code: String(statusCode) });
  });

  return app;
}
