/**
 * C6-2-T6：平台角色与权限点目录 7 条端点的路由级测试（路径 / 方法 / 鉴权 / 校验 400 / 业务码）
 *
 * 范式：src/__tests__/routes/platform-templates.test.ts（create-test-app 夹具 + service mock）。
 * 鉴权反向：单独挂载**真实** requirePlatformAuth（不带 Authorization）⇒ 401。
 * 路径口径来自派单卡「交付物②」——路径由卡钉死，本文件逐条断言，防后续被改名/挪前缀。
 *
 * 注意：本沙箱 vitest 无法启动（spawn EPERM，见 R101-C2-0 裁定 §六），本文件只负责「写好用例」，
 *       执行由凌舟在本机跑。
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  listPlatformRoles: vi.fn(),
  listPermissionCatalog: vi.fn(),
  createPlatformRole: vi.fn(),
  updatePlatformRole: vi.fn(),
  deletePlatformRole: vi.fn(),
  getRolePermissions: vi.fn(),
  replaceRolePermissions: vi.fn(),
}));

vi.mock("../../services/platform/platform-role.service", () => ({
  ROLE_CODE_PATTERN: /^[a-z][a-z0-9_]{1,31}$/,
  listPlatformRoles: mocks.listPlatformRoles,
  listPermissionCatalog: mocks.listPermissionCatalog,
  createPlatformRole: mocks.createPlatformRole,
  updatePlatformRole: mocks.updatePlatformRole,
  deletePlatformRole: mocks.deletePlatformRole,
  getRolePermissions: mocks.getRolePermissions,
  replaceRolePermissions: mocks.replaceRolePermissions,
}));

import { AppError } from "../../shared/app-error";
import { routeConfigs } from "../../routes/platform-role.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const rolesConfig = routeConfigs.find((c) => c.prefix === "/api/platform/roles")!;
const adminsConfig = routeConfigs.find((c) => c.prefix === "/api/platform/admins")!;
const permissionsConfig = routeConfigs.find((c) => c.prefix === "/api/platform/permissions")!;

const rolesApp = createTestApp({ prefix: rolesConfig.prefix, router: rolesConfig.router });
const adminsApp = createTestApp({ prefix: adminsConfig.prefix, router: adminsConfig.router });
const permissionsApp = createTestApp({
  prefix: permissionsConfig.prefix,
  router: permissionsConfig.router,
});

/** 真实鉴权守卫（无 Authorization ⇒ 401），用于三条前缀各自的「无令牌」反测 */
const guardedApp = express();
guardedApp.use(express.json());
// S3-119：测试内自建 app 也必须显式挂限流——CodeQL `js/missing-rate-limiting` 只认注册点上内联出现的 `rateLimit(...)`
guardedApp.use(rateLimit({ windowMs: 60_000, max: 10_000 })); // 测试用高上限 10000：避免用例之间互相触发 429
for (const config of routeConfigs) {
  guardedApp.use(config.prefix, requirePlatformAuth, config.router);
}
guardedApp.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
});

describe("C6-2-T6 · 路由声明（路径钉死 + 全量 requirePlatformAuth）", () => {
  it("三条前缀与派单卡交付物② 逐字一致，且 auth 全为 requirePlatformAuth", () => {
    expect(routeConfigs.map((c) => c.prefix)).toEqual([
      "/api/platform/admins",
      "/api/platform/permissions",
      "/api/platform/roles",
    ]);
    expect(routeConfigs.map((c) => c.auth)).toEqual([
      "requirePlatformAuth",
      "requirePlatformAuth",
      "requirePlatformAuth",
    ]);
  });

  it("无令牌访问三条前缀的代表端点 ⇒ 401（不落到业务层）", async () => {
    const results = await Promise.all([
      request(guardedApp).get("/api/platform/admins/roles"),
      request(guardedApp).get("/api/platform/permissions/catalog"),
      request(guardedApp).get("/api/platform/roles/1/permissions"),
      request(guardedApp).post("/api/platform/roles").send({ name: "x", code: "ab" }),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
    expect(mocks.listPlatformRoles).not.toHaveBeenCalled();
    expect(mocks.createPlatformRole).not.toHaveBeenCalled();
  });
});

describe("C6-2-T6 · #1 GET /api/platform/admins/roles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空态 roles: []（不是 null/undefined，不造数据）", async () => {
    mocks.listPlatformRoles.mockResolvedValue({ roles: [] });
    const res = await request(adminsApp).get("/api/platform/admins/roles");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toEqual({ roles: [] });
  });

  it("200 + 角色行含 id/name/code/type/domainCount（前端 :194-199 按 type 统计）", async () => {
    mocks.listPlatformRoles.mockResolvedValue({
      roles: [{ id: 1, name: "超级管理员", code: "super_admin", type: "builtin", domainCount: 7 }],
    });
    const res = await request(adminsApp).get("/api/platform/admins/roles");

    expect(res.status).toBe(200);
    expect(res.body.data.roles[0]).toEqual({
      id: 1,
      name: "超级管理员",
      code: "super_admin",
      type: "builtin",
      domainCount: 7,
    });
  });
});

describe("C6-2-T6 · #2 GET /api/platform/permissions/catalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 空目录 modules: []", async () => {
    mocks.listPermissionCatalog.mockResolvedValue({ modules: [] });
    const res = await request(permissionsApp).get("/api/platform/permissions/catalog");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ modules: [] });
  });

  it("200 + 三级权限点（MENU/BUTTON/DATA）按域分组返回", async () => {
    mocks.listPermissionCatalog.mockResolvedValue({
      modules: [
        {
          moduleCode: "ticket",
          moduleName: "工单系统",
          permissions: [{ permCode: "ticket:view", permName: "查看工单系统", permLevel: "MENU" }],
        },
      ],
    });
    const res = await request(permissionsApp).get("/api/platform/permissions/catalog");

    expect(res.status).toBe(200);
    expect(res.body.data.modules[0].moduleCode).toBe("ticket");
    expect(res.body.data.modules[0].permissions[0].permLevel).toBe("MENU");
  });
});

describe("C6-2-T6 · #3 POST /api/platform/roles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("201 + { id }（成功只回 id）", async () => {
    mocks.createPlatformRole.mockResolvedValue({ id: 12 });
    const res = await request(rolesApp)
      .post("/api/platform/roles")
      .send({ name: "工单专员", code: "ticket_ops" });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: 12 });
    expect(mocks.createPlatformRole).toHaveBeenCalledWith({
      name: "工单专员",
      code: "ticket_ops",
    });
  });

  it("code 不合法 ⇒ zod 400，且不调用 service", async () => {
    const res = await request(rolesApp)
      .post("/api/platform/roles")
      .send({ name: "大写编码", code: "Ticket-Ops" });

    expect(res.status).toBe(400);
    expect(mocks.createPlatformRole).not.toHaveBeenCalled();
  });

  it("code 冲突 ⇒ 409（业务码直通）", async () => {
    mocks.createPlatformRole.mockRejectedValue(new AppError("角色编码已存在：ticket_ops", 409));
    const res = await request(rolesApp)
      .post("/api/platform/roles")
      .send({ name: "重复", code: "ticket_ops" });

    expect(res.status).toBe(409);
  });
});

describe("C6-2-T6 · #4 PUT /api/platform/roles/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + { id, changedFields }", async () => {
    mocks.updatePlatformRole.mockResolvedValue({ id: 5, changedFields: ["remark"] });
    const res = await request(rolesApp).put("/api/platform/roles/5").send({ remark: "备注" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5, changedFields: ["remark"] });
    expect(mocks.updatePlatformRole).toHaveBeenCalledWith(5, { remark: "备注" });
  });

  it("内置角色改 name ⇒ 400", async () => {
    mocks.updatePlatformRole.mockRejectedValue(new AppError("内置角色的名称不可修改", 400));
    const res = await request(rolesApp).put("/api/platform/roles/1").send({ name: "改名" });

    expect(res.status).toBe(400);
  });

  it("角色不存在 ⇒ 404", async () => {
    mocks.updatePlatformRole.mockRejectedValue(new AppError("角色不存在：9", 404));
    const res = await request(rolesApp).put("/api/platform/roles/9").send({ name: "改名" });

    expect(res.status).toBe(404);
  });
});

describe("C6-2-T6 · #5 DELETE /api/platform/roles/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + { id, deletedPermissions }", async () => {
    mocks.deletePlatformRole.mockResolvedValue({ id: 8, deletedPermissions: 3 });
    const res = await request(rolesApp).delete("/api/platform/roles/8");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 8, deletedPermissions: 3 });
  });

  it("内置角色 ⇒ 400", async () => {
    mocks.deletePlatformRole.mockRejectedValue(new AppError("内置角色不可删除", 400));
    const res = await request(rolesApp).delete("/api/platform/roles/1");

    expect(res.status).toBe(400);
  });
});

describe("C6-2-T6 · #6 GET /api/platform/roles/:id/permissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 矩阵空值档（目录域名 + false/false/''）", async () => {
    mocks.getRolePermissions.mockResolvedValue({
      roleId: 2,
      matrix: [{ moduleCode: "ticket", canMenu: false, canPageBtn: false, dataScope: "" }],
    });
    const res = await request(rolesApp).get("/api/platform/roles/2/permissions");

    expect(res.status).toBe(200);
    expect(res.body.data.matrix[0]).toEqual({
      moduleCode: "ticket",
      canMenu: false,
      canPageBtn: false,
      dataScope: "",
    });
  });

  it("角色不存在 ⇒ 404", async () => {
    mocks.getRolePermissions.mockRejectedValue(new AppError("角色不存在：2", 404));
    const res = await request(rolesApp).get("/api/platform/roles/2/permissions");

    expect(res.status).toBe(404);
  });
});

describe("C6-2-T6 · #7 PUT /api/platform/roles/:id/permissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + { roleId, saved }，布尔字段归一化为 0/1 传给 service", async () => {
    mocks.replaceRolePermissions.mockResolvedValue({ roleId: 3, saved: 1 });
    const res = await request(rolesApp)
      .put("/api/platform/roles/3/permissions")
      .send({
        matrix: [
          { moduleCode: "ticket", canMenu: true, canPageBtn: 1, dataScope: "scope:all" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ roleId: 3, saved: 1 });
    const matrix = (mocks.replaceRolePermissions.mock.calls[0][1] as any[])[0];
    expect(matrix).toEqual({
      moduleCode: "ticket",
      canMenu: true,
      canPageBtn: true,
      dataScope: "scope:all",
    });
  });

  it("body 缺 matrix ⇒ zod 400，且不调用 service", async () => {
    const res = await request(rolesApp).put("/api/platform/roles/3/permissions").send({});

    expect(res.status).toBe(400);
    expect(mocks.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it("非法 moduleCode（service 判定目录外）⇒ 400", async () => {
    mocks.replaceRolePermissions.mockRejectedValue(
      new AppError("功能域不在权限点目录内：not_in_catalog", 400)
    );
    const res = await request(rolesApp)
      .put("/api/platform/roles/3/permissions")
      .send({ matrix: [{ moduleCode: "not_in_catalog", canMenu: true, canPageBtn: false }] });

    expect(res.status).toBe(400);
  });

  it("非法 dataScope（不在 4 档内）⇒ 400", async () => {
    mocks.replaceRolePermissions.mockRejectedValue(new AppError("数据范围不在 4 档内：本人", 400));
    const res = await request(rolesApp)
      .put("/api/platform/roles/3/permissions")
      .send({ matrix: [{ moduleCode: "ticket", canMenu: true, dataScope: "本人" }] });

    expect(res.status).toBe(400);
  });
});
