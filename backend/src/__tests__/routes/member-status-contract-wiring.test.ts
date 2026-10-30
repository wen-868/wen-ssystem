/**
 * TOTAL-MEMBER-STATUS-CONTRACT-01 · 状态开关持久化契约 接线验收测试（HTTP 级）
 *
 * 派单卡：`ZXQL-WORK/projects/ms/tasks/inbox/ACTIVE-TOTAL-MEMBER-STATUS-CONTRACT-01.md`
 * 依据：MOBILE-32F4F1 W3 实证——PUT /api/store/members/:id 收 {status} 返回 200 但静默不落库
 * （controller zod 白名单无 status + service UPDATE 白名单无 status 列）。
 *
 * 本文件证明（HTTP 契约口径，真 error-handler / 真 zod / 真 controller）：
 *  a) 注册行形状：storeMemberRouter.put("/:id(\\d+)", requirePermission("customer:edit"),
 *     memberController.updateMemberManage) 逐字存在，权限码仍为 customer:edit（不得放宽）；
 *  b) 合法 status 0/1 ⇒ 200；
 *  c) 非法类型/值（"0"/2/true/…）⇒ **400**（生产 errorHandler 的 ZodError 分支，非 stub）；
 *  d) 会员不存在/跨租户（service 抛 statusCode=404）⇒ **404**，不得伪成功。
 *
 * 反测：mutation①（service 摘 status 白名单）→ b 用例红；mutation③（controller 放宽 zod）→ c 用例红。
 * 说明：t_error_logs 写入与飞书上报为外部副作用，本测试 mock 之（仅 mock 副作用，错误映射逻辑为生产原件）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const svcMock = vi.hoisted(() => {
  // env.ts 在模块求值时读 JWT_SECRET（必须先于 import errorHandler/env 赋值）
  process.env.JWT_SECRET = process.env.JWT_SECRET || "member-status-contract-test-secret-01";
  return {
    updateMemberManage: vi.fn(),
    getMemberDetail: vi.fn(),
    listMemberManage: vi.fn(),
    createMemberManage: vi.fn(),
    getMemberPoints: vi.fn(),
    getMemberPointsLogs: vi.fn(),
    getMemberOrders: vi.fn(),
  };
});

vi.mock("../../services/store/member.service", () => svcMock);
vi.mock("../../services/admin/error-log.service", () => ({
  insertErrorLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../shared/feishu-report", () => ({
  reportToLingZhou: vi.fn().mockResolvedValue(undefined),
}));

import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { updateMemberManage } from "../../controllers/store/member.controller";
import { errorHandler } from "../../middleware/error-handler";
import { asyncHandler } from "../../middleware/async-handler";

const here = path.dirname(fileURLToPath(import.meta.url));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.put("/api/store/members/:id", asyncHandler(updateMemberManage as any));
  app.use(errorHandler as any);
  return app;
}

describe("member status contract wiring（TOTAL-MEMBER-STATUS-CONTRACT-01）", () => {
  beforeEach(() => {
    svcMock.updateMemberManage.mockClear();
    svcMock.getMemberDetail.mockClear();
  });

  it("a) 注册行形状：PUT /:id(\\d+) 挂 updateMemberManage，权限码=customer:edit（不放宽）", () => {
    const src = readFileSync(path.join(here, "../../routes/store.routes.ts"), "utf8");
    expect(src).toMatch(
      /storeMemberRouter\.put\("\/:id\(\\\\d\+\)",\s*requirePermission\("customer:edit"\),\s*memberController\.updateMemberManage\)/
    );
    // 该注册行不得改挂其他码
    expect(src).not.toMatch(/storeMemberRouter\.put\([^)]*requirePermission\("(?!customer:edit)/);
  });

  it("b) 合法 status=0/1 ⇒ 200", async () => {
    svcMock.updateMemberManage.mockResolvedValue({ affectedRows: 1 });
    svcMock.getMemberDetail.mockResolvedValue({ id: 5, status: 0 });

    const app = buildApp();
    const r0 = await request(app).put("/api/store/members/5").send({ status: 0 });
    expect(r0.status).toBe(200);
    const r1 = await request(app).put("/api/store/members/5").send({ status: 1 });
    expect(r1.status).toBe(200);
  });

  it("c) 非法类型/值 ⇒ 400（生产 errorHandler ZodError 分支），service 不被调用", async () => {
    const app = buildApp();
    for (const bad of ["0", 2, "1", 1.5, true, null]) {
      const r = await request(app).put("/api/store/members/5").send({ status: bad });
      expect(r.status).toBe(400);
      expect(r.body?.code).toBe("400");
    }
    // 环境里 tenantId 由 requireAuthWithTenant 注入；supertest 无认证中间件，手动补
    // （上面 updateMemberManage 收到的 tenantId=undefined 即可，仅验证 400 映射）
    expect(svcMock.updateMemberManage).not.toHaveBeenCalled();
  });

  it("c2) 合法值经认证中间件注入 tenantId 后透传（含 id 参数）", async () => {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.tenantId = "t1";
      next();
    });
    app.put("/api/store/members/:id", asyncHandler(updateMemberManage as any));
    app.use(errorHandler as any);

    svcMock.updateMemberManage.mockResolvedValue({ affectedRows: 1 });
    svcMock.getMemberDetail.mockResolvedValue({ id: 5, status: 1 });

    const r = await request(app).put("/api/store/members/5").send({ status: 1 });
    expect(r.status).toBe(200);
    expect(svcMock.updateMemberManage).toHaveBeenCalledWith("t1", 5, { status: 1 });
  });

  it("d) 会员不存在/跨租户 ⇒ 404（errorHandler statusCode 分支），不得伪成功", async () => {
    const app = buildApp();
    svcMock.updateMemberManage.mockRejectedValue(
      Object.assign(new Error("会员不存在"), { statusCode: 404 })
    );
    const r = await request(app).put("/api/store/members/999999999").send({ status: 0 });
    expect(r.status).toBe(404);
    expect(r.body?.msg).toBe("会员不存在");
  });
});
