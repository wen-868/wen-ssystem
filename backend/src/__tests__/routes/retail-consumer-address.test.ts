import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/miniapp/retail-consumer-address.service", () => ({
  listAddresses: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setDefault: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

import * as addressService from "../../services/miniapp/retail-consumer-address.service";
import { consumerAddressRouter } from "../../routes/retail-consumer-address.routes";

const app = createTestApp({ prefix: "/api/retail-consumer-address", router: consumerAddressRouter });

describe("routes/retail-consumer-address 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /miniapp/addresses", () => {
    it("应返回收货地址列表", async () => {
      (addressService.listAddresses as any).mockResolvedValue([{ id: 1, name: "家" }]);
      const res = await request(app).get("/api/retail-consumer-address/miniapp/addresses");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(addressService.listAddresses).toHaveBeenCalledWith(1);
    });

    it("service 抛错时返回500", async () => {
      (addressService.listAddresses as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/retail-consumer-address/miniapp/addresses");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /miniapp/addresses", () => {
    it("应创建收货地址", async () => {
      (addressService.createAddress as any).mockResolvedValue({ id: 1, name: "公司" });
      const res = await request(app)
        .post("/api/retail-consumer-address/miniapp/addresses")
        .send({
          name: "公司",
          mobile: "13800138000",
          province: "广东省",
          city: "深圳市",
          district: "南山区",
          detail: "科技园",
        });
      expect(res.status).toBe(200);
      expect(addressService.createAddress).toHaveBeenCalledWith(1, expect.objectContaining({ name: "公司" }));
    });

    it("缺少必填字段时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/retail-consumer-address/miniapp/addresses")
        .send({ name: "公司" });
      expect(res.status).toBe(500);
      expect(addressService.createAddress).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (addressService.createAddress as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/retail-consumer-address/miniapp/addresses")
        .send({
          name: "公司",
          mobile: "13800138000",
          province: "广东省",
          city: "深圳市",
          district: "南山区",
          detail: "科技园",
        });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /miniapp/addresses/:id", () => {
    it("应更新收货地址", async () => {
      (addressService.updateAddress as any).mockResolvedValue(undefined);
      const res = await request(app)
        .put("/api/retail-consumer-address/miniapp/addresses/1")
        .send({ name: "新地址" });
      expect(res.status).toBe(200);
      expect(addressService.updateAddress).toHaveBeenCalledWith(1, 1, expect.objectContaining({ name: "新地址" }));
    });

    it("service 抛错时返回500", async () => {
      (addressService.updateAddress as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/retail-consumer-address/miniapp/addresses/1")
        .send({ name: "新地址" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /miniapp/addresses/:id", () => {
    it("应删除收货地址", async () => {
      (addressService.deleteAddress as any).mockResolvedValue(undefined);
      const res = await request(app).delete("/api/retail-consumer-address/miniapp/addresses/1");
      expect(res.status).toBe(200);
      expect(addressService.deleteAddress).toHaveBeenCalledWith(1, 1);
    });

    it("service 抛错时返回500", async () => {
      (addressService.deleteAddress as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/retail-consumer-address/miniapp/addresses/1");
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /miniapp/addresses/:id/default", () => {
    it("应设置默认地址", async () => {
      (addressService.setDefault as any).mockResolvedValue(undefined);
      const res = await request(app).put("/api/retail-consumer-address/miniapp/addresses/1/default");
      expect(res.status).toBe(200);
      expect(addressService.setDefault).toHaveBeenCalledWith(1, 1);
    });

    it("service 抛错时返回500", async () => {
      (addressService.setDefault as any).mockRejectedValue(new Error("set default error"));
      const res = await request(app).put("/api/retail-consumer-address/miniapp/addresses/1/default");
      expect(res.status).toBe(500);
    });
  });
});
