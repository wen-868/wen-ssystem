import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { queryOne, query } from "@shared/db";
import { platformLogin, getPlatformMe, createPlatformAdmin } from "@controllers/platform/platform-auth.controller";
import { hashPassword, validatePassword } from "@shared/password";

vi.mock("@shared/db");
vi.mock("@shared/password");
vi.mock("bcryptjs");
vi.mock("jsonwebtoken");

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
      await platformLogin({ body: { password: "123456" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("400");
      expect(callArgs.msg).toBe("用户名和密码不能为空");
    });

    it("should return error when password is missing", async () => {
      await platformLogin({ body: { username: "admin" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("400");
      expect(callArgs.msg).toBe("用户名和密码不能为空");
    });

    it("should return error when admin not found", async () => {
      (queryOne as vi.Mock).mockResolvedValue(null);

      await platformLogin({ body: { username: "admin", password: "123456" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("401");
      expect(callArgs.msg).toBe("用户名或密码错误");
    });

    it("should return error when password is wrong", async () => {
      (queryOne as vi.Mock).mockResolvedValue({ id: 1, username: "admin", password: "hashed", real_name: "Admin" });
      (bcrypt.compare as vi.Mock).mockResolvedValue(false);

      await platformLogin({ body: { username: "admin", password: "wrong" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("401");
      expect(callArgs.msg).toBe("用户名或密码错误");
    });

    it("should return success with token", async () => {
      (queryOne as vi.Mock).mockResolvedValue({ id: 1, username: "admin", password: "hashed", real_name: "Admin" });
      (bcrypt.compare as vi.Mock).mockResolvedValue(true);
      (jwt.sign as vi.Mock).mockReturnValue("token123");

      await platformLogin({ body: { username: "admin", password: "123456" } } as any, mockRes);

      expect(jwt.sign).toHaveBeenCalled();
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
      (queryOne as vi.Mock).mockResolvedValue(null);

      await getPlatformMe({ user: { id: 1 } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("404");
      expect(callArgs.msg).toBe("管理员不存在");
    });

    it("should return admin info", async () => {
      (queryOne as vi.Mock).mockResolvedValue({ id: 1, username: "admin", real_name: "Admin" });

      await getPlatformMe({ user: { id: 1 } } as any, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual({ id: 1, username: "admin", realName: "Admin" });
    });
  });

  describe("createPlatformAdmin", () => {
    it("should return error when username is missing", async () => {
      await createPlatformAdmin({ body: { password: "123456", realName: "Admin" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("400");
      expect(callArgs.msg).toBe("用户名、密码、真实姓名不能为空");
    });

    it("should return error when password is missing", async () => {
      await createPlatformAdmin({ body: { username: "admin", realName: "Admin" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("400");
      expect(callArgs.msg).toBe("用户名、密码、真实姓名不能为空");
    });

    it("should return error when realName is missing", async () => {
      await createPlatformAdmin({ body: { username: "admin", password: "123456" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("400");
      expect(callArgs.msg).toBe("用户名、密码、真实姓名不能为空");
    });

    it("should return error when password is invalid", async () => {
      (validatePassword as vi.Mock).mockReturnValue({ valid: false, errors: ["密码太短"] });

      await createPlatformAdmin({ body: { username: "admin", password: "123", realName: "Admin" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("400");
      expect(callArgs.msg).toBe("密码不符合要求：密码太短");
    });

    it("should return error when username already exists", async () => {
      (validatePassword as vi.Mock).mockReturnValue({ valid: true, errors: [] });
      (queryOne as vi.Mock).mockResolvedValue({ id: 1 });

      await createPlatformAdmin({ body: { username: "admin", password: "123456", realName: "Admin" } } as any, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("400");
      expect(callArgs.msg).toBe("用户名已存在");
    });

    it("should create admin successfully", async () => {
      (validatePassword as vi.Mock).mockReturnValue({ valid: true, errors: [] });
      (queryOne as vi.Mock).mockResolvedValue(null);
      (hashPassword as vi.Mock).mockResolvedValue("hashed_password");
      (query as vi.Mock).mockResolvedValue({ insertId: 2 });

      await createPlatformAdmin({
        body: { username: "newadmin", password: "123456", realName: "New Admin", email: "test@test.com", phone: "13800138000", role: "ADMIN" },
      } as any, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual({ id: 2, username: "newadmin", realName: "New Admin", message: "创建成功" });
    });

    it("should create admin with default values for optional fields", async () => {
      (validatePassword as vi.Mock).mockReturnValue({ valid: true, errors: [] });
      (queryOne as vi.Mock).mockResolvedValue(null);
      (hashPassword as vi.Mock).mockResolvedValue("hashed_password");
      (query as vi.Mock).mockResolvedValue({ insertId: 3 });

      await createPlatformAdmin({
        body: { username: "admin2", password: "123456", realName: "Admin 2" },
      } as any, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.code).toBe("0");
      expect(callArgs.msg).toBe("成功");
      expect(callArgs.data).toEqual({ id: 3, username: "admin2", realName: "Admin 2", message: "创建成功" });
    });
  });
});
