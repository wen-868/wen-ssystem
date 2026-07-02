/**
 * 采购订单 Phase 2 API 测试
 * 路径: /api/admin/purchase-orders
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";
import { mockQuery } from "../shared/mock-db.js";

const TOKEN = signToken({
  id: 1, username: "admin", roles: ["SUPER_ADMIN"],
  storeId: null, tenantId: "default"
});

let orderNo: string;

describe("Purchase Order API", () => {
  beforeAll(() => resetMockDb());

  it("should create a purchase order", async () => {
    const res = await request(app)
      .post("/api/admin/purchase-orders")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        supplierId: 1, supplierName: "测试供应商", storeId: 1,
        items: [{ skuId: 1, skuName: "测试商品", barcode: "690000000001", boxQty: 1, bottleQty: 0, unitPrice: 100, taxRate: 0.13 }]
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.purchaseNo).toBeTruthy();
    orderNo = res.body.data.purchaseNo;
  });

  it("should get purchase order list", async () => {
    const res = await request(app)
      .get("/api/admin/purchase-orders")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
  });

  it("should get purchase order detail", async () => {
    const res = await request(app)
      .get(`/api/admin/purchase-orders/${orderNo}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.orderNo).toBe(orderNo);
    expect(res.body.data.status).toBe("DRAFT");
  });

  it("should submit purchase order", async () => {
    const res = await request(app)
      .post(`/api/admin/purchase-orders/${orderNo}/submit`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should approve purchase order", async () => {
    const res = await request(app)
      .post(`/api/admin/purchase-orders/${orderNo}/approve`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should reject submit of non-draft order", async () => {
    const res = await request(app)
      .post(`/api/admin/purchase-orders/${orderNo}/submit`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it("should create a second order and cancel it", async () => {
    const createRes = await request(app)
      .post("/api/admin/purchase-orders")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        supplierId: 1, supplierName: "测试供应商", storeId: 1,
        items: [{ skuId: 1, skuName: "测试商品2", boxQty: 0, bottleQty: 6, unitPrice: 50, taxRate: 0.13 }]
      });
    const orderNo2 = createRes.body.data.purchaseNo;

    const cancelRes = await request(app)
      .post(`/api/admin/purchase-orders/${orderNo2}/cancel`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.code).toBe("0");
  });

  it("should return 404 for non-existent order", async () => {
    const res = await request(app)
      .get("/api/admin/purchase-orders/NOEXISTENT")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it("should update a draft purchase order", async () => {
    const createRes = await request(app)
      .post("/api/admin/purchase-orders")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        supplierId: 1, supplierName: "测试供应商", storeId: 1,
        items: [{ skuId: 1, skuName: "test", boxQty: 1, bottleQty: 0, unitPrice: 10, taxRate: 0 }]
      });
    const updOrderNo = createRes.body.data.purchaseNo;

    const updateRes = await request(app)
      .put(`/api/admin/purchase-orders/${updOrderNo}`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ remark: "更新备注" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.code).toBe("0");
  });

  it("should delete a draft purchase order", async () => {
    const createRes = await request(app)
      .post("/api/admin/purchase-orders")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        supplierId: 1, supplierName: "测试供应商", storeId: 1,
        items: [{ skuId: 1, skuName: "test-del", boxQty: 0, bottleQty: 2, unitPrice: 20, taxRate: 0 }]
      });
    const delOrderNo = createRes.body.data.purchaseNo;

    const delRes = await request(app)
      .delete(`/api/admin/purchase-orders/${delOrderNo}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.code).toBe("0");
  });
});