/**
 * 供应商管理 Phase 2 API 测试
 * 路径: /api/admin/suppliers
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../server.js";
import { signToken } from "../middleware/auth.js";
import { resetMockDb } from "./mocks/mock-db.js";

const TOKEN = signToken({
  id: 1, username: "admin", roles: ["SUPER_ADMIN"],
  storeId: null, tenantId: "default"
});

let supplierId: number;

describe("Supplier API", () => {
  beforeAll(() => resetMockDb());

  it("should create a supplier", async () => {
    const res = await request(app)
      .post("/api/admin/suppliers")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "测试供应商", shortName: "测试", supplyType: "白酒", settlementType: "MONTHLY", settlementDay: 15, contactPerson: "张三", contactMobile: "13800000000" });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.id).toBeGreaterThan(0);
    expect(res.body.data.supplierCode).toBeTruthy();
    supplierId = res.body.data.id;
  });

  it("should get supplier list", async () => {
    const res = await request(app)
      .get("/api/admin/suppliers")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it("should get supplier detail", async () => {
    const res = await request(app)
      .get(`/api/admin/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.name).toBe("测试供应商");
  });

  it("should update supplier", async () => {
    const res = await request(app)
      .put(`/api/admin/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "更新后的供应商", remark: "测试备注" });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should add supplier contact", async () => {
    const res = await request(app)
      .post(`/api/admin/suppliers/${supplierId}/contacts`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "李四", mobile: "13900000001", isPrimary: true });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.id).toBeGreaterThan(0);
  });

  it("should get supplier stats", async () => {
    const res = await request(app)
      .get(`/api/admin/suppliers/${supplierId}/stats`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data).toHaveProperty("orderCount");
    expect(res.body.data).toHaveProperty("totalAmount");
  });

  it("should get supplier purchase orders", async () => {
    const res = await request(app)
      .get(`/api/admin/suppliers/${supplierId}/purchase-orders`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should return 404 for non-existent supplier", async () => {
    const res = await request(app)
      .get("/api/admin/suppliers/99999")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });
});