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

  // 错误响应字段与生产 errorHandler 对齐：生产统一信封是 { code, msg, traceId }
  // （见 shared/response.ts 的 fail()、middleware/error-handler.ts:50）。
  // 历史夹具曾用 `message`，与生产字段名不一致 —— 会导致「后端发 msg、测试断言 message」
  // 的契约错配长期测不出来（前端 F1 的 message/msg 取错字段正是此类问题）。
  app.use((err: any, _req: any, res: any, _next: any) => {
    const statusCode = err?.statusCode || 500;
    const message = err?.message || "服务器内部错误";
    res.status(statusCode).json({ success: false, msg: message, code: String(statusCode), traceId: "test-trace" });
  });

  return app;
}
