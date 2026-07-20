import { describe, it, expect, vi, beforeEach } from "vitest";

const platformAuthMocks = vi.hoisted(() => ({
  login: vi.fn(),
  getMe: vi.fn(),
  createAdmin: vi.fn(),
}));

vi.mock("@services/platform/platform-auth.service", () => platformAuthMocks);

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test", apiCost: 1 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test", apiCost: 1 })),
}));

vi.mock("@shared/db", () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@shared/password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  validatePassword: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

import * as platformAuthService from "@services/platform/platform-auth.service";
import { platformLogin, getPlatformMe, createPlatformAdmin } from "@controllers/platform/platform-auth.controller";

describe("platform-auth.controller", () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("platformLogin", () => {
    it("should return error when username is missing", async () => {
      const error = Object.assign(new Error("缺少必填字段: username"), { statusCode: 400 });
      (platformAuthMocks.login as any).mockRejectedValue(error);

      await expect(platformLogin({ body: { password: "123456" } } as any, mockRes))
        .rejects.toMatchObject({ message: "缺少必填字段: username", statusCode: 400 });
    });

    it("should return error when password is missing", async () => {
      const error = Object.assign(new Error("缺少必填字段: password"), { statusCode: 400 });
      (platformAuthMocks.login as any).mockRejectedValue(error);

      await expect(platformLogin({ body: { username: "admin" } } as any, mockRes))
        .rejects.toMatchObject({ message: "缺少必填字段: password", statusCode: 400 });
    });

    it("should return error when admin not found", async () => {
      const error = Object.assign(new Error("用户名或密码错误"), { statusCode: 401 });
      (platformAuthMocks.login as any).mockRejectedValue(error);

      await expect(platformLogin({ body: { username: "admin", password: "123456" } } as any, mockRes))
        .rejects.toMatchObject({ message: "用户名或密码错误", statusCode: 401 });
    });

    it("should return error when password is wrong", async () => {
      const error = Object.assign(new Error("用户名或密码错误"), { statusCode: 401 });
      (platformAuthMocks.login as any).mockRejectedValue(error);

      await expect(platformLogin({ body: { username: "admin", password: "wrong" } } as any, mockRes))
        .rejects.toMatchObject({ message: "用户名或密码错误", statusCode: 401 });
    });

    it("should return success with token", async () => {
      (platformAuthMocks.login as any).mockResolvedValue({
        token: "token123",
        admin: { id: 1, username: "admin", realName: "Admin" },
      });

      await platformLogin({ body: { username: "admin", password: "123456" } } as any, mockRes);

      expect(platformAuthMocks.login).toHaveBeenCalledWith("admin", "123456");
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual({
        token: "token123",
        admin: { id: 1, username: "admin", realName: "Admin" },
      });
    });
  });

  describe("getPlatformMe", () => {
    it("should return error when admin not found", async () => {
      const error = Object.assign(new Error("管理员不存在"), { statusCode: 404 });
      (platformAuthMocks.getMe as any).mockRejectedValue(error);

      await expect(getPlatformMe({ user: { id: 1 } } as any, mockRes))
        .rejects.toMatchObject({ message: "管理员不存在", statusCode: 404 });
    });

    it("should return admin info", async () => {
      (platformAuthMocks.getMe as any).mockResolvedValue({ id: 1, username: "admin", realName: "Admin" });

      await getPlatformMe({ user: { id: 1 } } as any, mockRes);

      expect(platformAuthMocks.getMe).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual({ id: 1, username: "admin", realName: "Admin" });
    });
  });

  describe("createPlatformAdmin", () => {
    it("should return error when username is missing", async () => {
      const error = Object.assign(new Error("缺少必填字段: username"), { statusCode: 400 });
      (platformAuthMocks.createAdmin as any).mockRejectedValue(error);

      await expect(createPlatformAdmin({ body: { password: "123456", realName: "Admin" } } as any, mockRes))
        .rejects.toMatchObject({ message: "缺少必填字段: username", statusCode: 400 });
    });

    it("should return error when password is missing", async () => {
      const error = Object.assign(new Error("缺少必填字段: password"), { statusCode: 400 });
      (platformAuthMocks.createAdmin as any).mockRejectedValue(error);

      await expect(createPlatformAdmin({ body: { username: "admin", realName: "Admin" } } as any, mockRes))
        .rejects.toMatchObject({ message: "缺少必填字段: password", statusCode: 400 });
    });

    it("should return error when realName is missing", async () => {
      const error = Object.assign(new Error("缺少必填字段: realName"), { statusCode: 400 });
      (platformAuthMocks.createAdmin as any).mockRejectedValue(error);

      await expect(createPlatformAdmin({ body: { username: "admin", password: "123456" } } as any, mockRes))
        .rejects.toMatchObject({ message: "缺少必填字段: realName", statusCode: 400 });
    });

    it("should return error when password is invalid", async () => {
      const error = Object.assign(new Error("密码不符合要求：密码太短"), { statusCode: 400 });
      (platformAuthMocks.createAdmin as any).mockRejectedValue(error);

      await expect(createPlatformAdmin({ body: { username: "admin", password: "123", realName: "Admin" } } as any, mockRes))
        .rejects.toMatchObject({ message: "密码不符合要求：密码太短", statusCode: 400 });
    });

    it("should return error when username already exists", async () => {
      const error = Object.assign(new Error("用户名已存在"), { statusCode: 400 });
      (platformAuthMocks.createAdmin as any).mockRejectedValue(error);

      await expect(createPlatformAdmin({ body: { username: "admin", password: "123456", realName: "Admin" } } as any, mockRes))
        .rejects.toMatchObject({ message: "用户名已存在", statusCode: 400 });
    });

    it("should create admin successfully", async () => {
      (platformAuthMocks.createAdmin as any).mockResolvedValue({
        id: 2, username: "newadmin", realName: "New Admin", message: "创建成功",
      });

      await createPlatformAdmin({
        body: { username: "newadmin", password: "123456", realName: "New Admin", email: "test@test.com", phone: "13800138000", role: "ADMIN" },
      } as any, mockRes);

      expect(platformAuthMocks.createAdmin).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual({ id: 2, username: "newadmin", realName: "New Admin", message: "创建成功" });
    });

    it("should create admin with default values for optional fields", async () => {
      (platformAuthMocks.createAdmin as any).mockResolvedValue({
        id: 3, username: "admin2", realName: "Admin 2", message: "创建成功",
      });

      await createPlatformAdmin({
        body: { username: "admin2", password: "123456", realName: "Admin 2" },
      } as any, mockRes);

      expect(platformAuthMocks.createAdmin).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual({ id: 3, username: "admin2", realName: "Admin 2", message: "创建成功" });
    });
  });
});
