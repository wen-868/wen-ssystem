import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCanAccessPriceField,
  mockCanAccessPriceLevel,
  mockLogUnauthorizedAccess,
  mockFilterPriceFields,
  mockFilterPriceFieldsBatch,
} = vi.hoisted(() => ({
  mockCanAccessPriceField: vi.fn(),
  mockCanAccessPriceLevel: vi.fn(),
  mockLogUnauthorizedAccess: vi.fn(),
  mockFilterPriceFields: vi.fn(),
  mockFilterPriceFieldsBatch: vi.fn(),
}));

vi.mock("../../shared/price-guard.js", () => ({
  canAccessPriceField: mockCanAccessPriceField,
  canAccessPriceLevel: mockCanAccessPriceLevel,
  logUnauthorizedAccess: mockLogUnauthorizedAccess,
  filterPriceFields: mockFilterPriceFields,
  filterPriceFieldsBatch: mockFilterPriceFieldsBatch,
}));

import {
  requirePriceFieldAccess,
  requirePriceLevelAccess,
  requirePriceManagementAccess,
  requirePriceChangeLogAccess,
  priceResponseFilter,
  filterPriceResponse,
} from "../../middleware/price-guard.js";
import type { AuthUser } from "../../middleware/auth.js";
import type { Request, Response, NextFunction } from "express";

function makeUser(roles: string[]): AuthUser {
  return {
    id: 1,
    username: "test",
    roles,
    tenantId: "default",
  };
}

function mockReqRes(user?: AuthUser, opts?: { originalUrl?: string; tenantId?: string }) {
  const req = {
    user,
    originalUrl: opts?.originalUrl || "/api/test",
    tenantId: opts?.tenantId || "default",
    query: {},
    body: {},
    headers: {},
  } as unknown as Request;
  let jsonBody: unknown;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn((body: unknown) => {
      jsonBody = body;
      return res as unknown as Response;
    }),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next, getJsonBody: () => jsonBody };
}

describe("price-guard middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requirePriceFieldAccess", () => {
    it("未登录返回 401", () => {
      const { req, res, next } = mockReqRes();
      const mw = requirePriceFieldAccess("costPrice");
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("有权限调用 next", () => {
      mockCanAccessPriceField.mockReturnValue(true);
      const { req, res, next } = mockReqRes(makeUser(["SUPER_ADMIN"]));
      const mw = requirePriceFieldAccess("costPrice");
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("无权限返回 403 并记录越权", () => {
      mockCanAccessPriceField.mockReturnValue(false);
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = requirePriceFieldAccess("costPrice");
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockLogUnauthorizedAccess).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("多个字段部分无权限返回 403", () => {
      mockCanAccessPriceField
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = requirePriceFieldAccess("retailPrice", "costPrice");
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("tenantId 为 undefined 时传 unknown", () => {
      mockCanAccessPriceField.mockReturnValue(false);
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]), { tenantId: "" });
      (req as any).tenantId = undefined;
      const mw = requirePriceFieldAccess("costPrice");
      mw(req, res, next);
      expect(mockLogUnauthorizedAccess).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        "unknown"
      );
    });
  });

  describe("requirePriceLevelAccess", () => {
    it("未登录返回 401", async () => {
      const { req, res, next } = mockReqRes();
      const mw = requirePriceLevelAccess();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("无 levelCode 参数直接 next", async () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = requirePriceLevelAccess();
      await mw(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(mockCanAccessPriceLevel).not.toHaveBeenCalled();
    });

    it("query 中有 levelCode 且有权限则 next", async () => {
      mockCanAccessPriceLevel.mockResolvedValue(true);
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      req.query = { levelCode: "VIP" };
      const mw = requirePriceLevelAccess();
      await mw(req, res, next);
      expect(mockCanAccessPriceLevel).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("body 中有 levelCode 且有权限则 next", async () => {
      mockCanAccessPriceLevel.mockResolvedValue(true);
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      req.body = { levelCode: "VIP" };
      const mw = requirePriceLevelAccess("levelCode");
      await mw(req, res, next);
      expect(mockCanAccessPriceLevel).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("无权限返回 403 并记录越权", async () => {
      mockCanAccessPriceLevel.mockResolvedValue(false);
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      req.query = { levelCode: "VIP" };
      const mw = requirePriceLevelAccess();
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockLogUnauthorizedAccess).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("无 tenantId 时使用 unknown 兜底", async () => {
      mockCanAccessPriceLevel.mockResolvedValue(false);
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      (req as any).tenantId = "";
      req.query = { levelCode: "VIP" };
      const mw = requirePriceLevelAccess();
      await mw(req, res, next);
      expect(mockCanAccessPriceLevel).toHaveBeenCalledWith(
        expect.any(Object),
        "VIP",
        "unknown"
      );
      expect(mockLogUnauthorizedAccess).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        "unknown"
      );
    });

    it("自定义 codeParam", async () => {
      mockCanAccessPriceLevel.mockResolvedValue(true);
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      req.query = { priceLevel: "VIP" };
      const mw = requirePriceLevelAccess("priceLevel");
      await mw(req, res, next);
      expect(mockCanAccessPriceLevel).toHaveBeenCalledWith(
        expect.anything(),
        "VIP",
        expect.anything()
      );
    });
  });

  describe("requirePriceManagementAccess", () => {
    it("未登录返回 401", () => {
      const { req, res, next } = mockReqRes();
      const mw = requirePriceManagementAccess();
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("SUPER_ADMIN 有权限调用 next", () => {
      const { req, res, next } = mockReqRes(makeUser(["SUPER_ADMIN"]));
      const mw = requirePriceManagementAccess();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("STORE_MANAGER 有权限调用 next", () => {
      const { req, res, next } = mockReqRes(makeUser(["STORE_MANAGER"]));
      const mw = requirePriceManagementAccess();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("SALES_STAFF 无权限返回 403", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = requirePriceManagementAccess();
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockLogUnauthorizedAccess).toHaveBeenCalled();
    });

    it("无 tenantId 时使用 unknown 兜底", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      (req as any).tenantId = "";
      const mw = requirePriceManagementAccess();
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockLogUnauthorizedAccess).toHaveBeenCalledWith(
        expect.any(Object),
        "PRICE_MANAGEMENT_DENIED",
        expect.any(String),
        expect.any(String),
        "unknown"
      );
    });
  });

  describe("requirePriceChangeLogAccess", () => {
    it("未登录返回 401", () => {
      const { req, res, next } = mockReqRes();
      const mw = requirePriceChangeLogAccess();
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("SUPER_ADMIN 有权限调用 next", () => {
      const { req, res, next } = mockReqRes(makeUser(["SUPER_ADMIN"]));
      const mw = requirePriceChangeLogAccess();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("FINANCE_STAFF 有权限调用 next", () => {
      const { req, res, next } = mockReqRes(makeUser(["FINANCE_STAFF"]));
      const mw = requirePriceChangeLogAccess();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("SALES_STAFF 无权限返回 403", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = requirePriceChangeLogAccess();
      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("无权限不记录越权日志（price-guard 中未调用 logUnauthorizedAccess）", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = requirePriceChangeLogAccess();
      mw(req, res, next);
      expect(mockLogUnauthorizedAccess).not.toHaveBeenCalled();
    });
  });

  describe("priceResponseFilter", () => {
    it("无用户直接 next 不过滤", () => {
      const { req, res, next } = mockReqRes();
      req.user = undefined;
      const mw = priceResponseFilter();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("SUPER_ADMIN 直接 next 不过滤", () => {
      const { req, res, next } = mockReqRes(makeUser(["SUPER_ADMIN"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("普通用户会劫持 res.json", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("过滤 data 字段（对象）", () => {
      mockFilterPriceFields.mockReturnValue({ filtered: { name: "test" } });
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      res.json({ code: "0", data: { name: "test", costPrice: 10 } });
      expect(mockFilterPriceFields).toHaveBeenCalled();
    });

    it("过滤 data 字段（数组）", () => {
      mockFilterPriceFieldsBatch.mockReturnValue({ filtered: [{ name: "test" }] });
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      res.json({ code: "0", data: [{ name: "test" }] });
      expect(mockFilterPriceFieldsBatch).toHaveBeenCalled();
    });

    it("过滤 records 字段（列表响应）", () => {
      mockFilterPriceFieldsBatch.mockReturnValue({ filtered: [{ name: "test" }] });
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      res.json({ code: "0", records: [{ name: "test" }] });
      expect(mockFilterPriceFieldsBatch).toHaveBeenCalled();
    });

    it("body 非对象直接返回", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      res.json("string-body");
      expect(mockFilterPriceFields).not.toHaveBeenCalled();
    });

    it("body 为 null 直接返回", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      res.json(null as unknown as object);
      expect(mockFilterPriceFields).not.toHaveBeenCalled();
    });

    it("data 非对象且非数组不过滤", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      res.json({ code: "0", data: "string-data" });
      expect(mockFilterPriceFields).not.toHaveBeenCalled();
      expect(mockFilterPriceFieldsBatch).not.toHaveBeenCalled();
    });

    it("过滤失败时降级返回（catch 分支）", () => {
      mockFilterPriceFields.mockImplementation(() => {
        throw new Error("filter error");
      });
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      const originalData = { code: "0", data: { name: "test" } };
      expect(() => res.json(originalData)).not.toThrow();
    });

    it("records 非数组不过滤", () => {
      const { req, res, next } = mockReqRes(makeUser(["SALES_STAFF"]));
      const mw = priceResponseFilter();
      mw(req, res, next);
      res.json({ code: "0", records: "not-array" });
      expect(mockFilterPriceFieldsBatch).not.toHaveBeenCalled();
    });
  });

  describe("filterPriceResponse", () => {
    it("SUPER_ADMIN 直接返回原值", () => {
      const data = { name: "test", costPrice: 10 };
      const result = filterPriceResponse(makeUser(["SUPER_ADMIN"]), data);
      expect(result).toBe(data);
      expect(mockFilterPriceFields).not.toHaveBeenCalled();
    });

    it("数组调用 filterPriceFieldsBatch", () => {
      mockFilterPriceFieldsBatch.mockReturnValue({ filtered: [{ name: "test" }] });
      const data = [{ name: "test" }];
      const result = filterPriceResponse(makeUser(["SALES_STAFF"]), data);
      expect(mockFilterPriceFieldsBatch).toHaveBeenCalled();
      expect(result).toEqual([{ name: "test" }]);
    });

    it("对象调用 filterPriceFields", () => {
      mockFilterPriceFields.mockReturnValue({ filtered: { name: "test" } });
      const data = { name: "test" };
      const result = filterPriceResponse(makeUser(["SALES_STAFF"]), data);
      expect(mockFilterPriceFields).toHaveBeenCalled();
      expect(result).toEqual({ name: "test" });
    });

    it("非对象非数组直接返回", () => {
      const result = filterPriceResponse(makeUser(["SALES_STAFF"]), "string-data");
      expect(result).toBe("string-data");
    });

    it("null 直接返回", () => {
      const result = filterPriceResponse(makeUser(["SALES_STAFF"]), null);
      expect(result).toBeNull();
    });
  });
});
