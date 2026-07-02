/**
 * Phase 2 端到端流程测试
 * 测试完整的采购-入库-退货-对账-付款流程
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const TOKEN = signToken({
  id: 1, username: "admin", roles: ["SUPER_ADMIN"],
  storeId: null, tenantId: "default"
});

describe("Phase 2 E2E Flow", () => {
  beforeAll(() => resetMockDb());

  describe("Full Purchase Order → In-Stock Flow", () => {
    it("complete flow: create order → submit → approve → in-stock", async () => {
      // 1. Create purchase order
      const createRes = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "E2E测试供应商", storeId: 1,
          items: [{ skuId: 1, skuName: "E2E商品", barcode: "690000000002", boxQty: 2, bottleQty: 6, unitPrice: 80, taxRate: 0.13 }]
        });
      expect(createRes.status).toBe(200);
      const orderNo = createRes.body.data.purchaseNo;
      expect(orderNo).toBeTruthy();

      // 2. Submit for approval
      const submitRes = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/submit`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(submitRes.status).toBe(200);

      // 3. Approve
      const approveRes = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approveRes.status).toBe(200);

      // 4. In-stock via purchase order
      const stockRes = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/in-stock`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ items: [{ skuId: 1, boxQty: 1, bottleQty: 0 }] });
      expect(stockRes.status).toBe(200);
    });
  });

  describe("Full Purchase Return Flow", () => {
    it("complete flow: create return → approve", async () => {
      const createRes = await request(app)
        .post("/api/admin/purchase-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "E2E供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "E2E退货商品", box_qty: 1, bottle_qty: 0, unit_price: 100, tax_rate: 0.13 }]
        });
      expect(createRes.status).toBe(200);
      const returnNo = createRes.body.data.return_no;

      const approveRes = await request(app)
        .post(`/api/admin/purchase-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approveRes.status).toBe(200);
    });
  });

  describe("Full Sale Return Flow", () => {
    it("complete flow: create → approve → refund", async () => {
      const createRes = await request(app)
        .post("/api/admin/sale-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          storeId: 1, customerName: "E2E退货客户", customerMobile: "13800000001",
          items: [{ skuId: 1, skuName: "E2E销售退货", boxQty: 0, bottleQty: 6, unitPrice: 120, reason: "E2E测试" }]
        });
      expect(createRes.status).toBe(200);
      const returnNo = createRes.body.data.returnNo;

      const approveRes = await request(app)
        .post(`/api/admin/sale-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approveRes.status).toBe(200);

      const refundRes = await request(app)
        .post(`/api/admin/sale-returns/${returnNo}/refund`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ refundMethod: "WECHAT" });
      expect(refundRes.status).toBe(200);
    });
  });

  describe("Full Statement → Payment Flow", () => {
    it("complete flow: create statement → confirm → paid", async () => {
      const createRes = await request(app)
        .post("/api/store/customer-statements")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "E2E对账客户",
          start_date: "2025-01-01", end_date: "2025-01-31"
        });
      expect(createRes.status).toBe(200);
      const stmtNo = createRes.body.data.statement_no;

      const confirmRes = await request(app)
        .post(`/api/store/customer-statements/${stmtNo}/confirm`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(confirmRes.status).toBe(200);

      const paidRes = await request(app)
        .post(`/api/store/customer-statements/${stmtNo}/paid`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(paidRes.status).toBe(200);
    });
  });

  describe("Cross-module Integration", () => {
    it("supplier → purchase order → stock → return chain", async () => {
      // Create supplier
      const supplierRes = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "集成测试供应商", shortName: "集成", supplyType: "白酒" });
      expect(supplierRes.status).toBe(200);
      const supplierId = supplierRes.body.data.id;

      // Create purchase order
      const orderRes = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId, supplierName: "集成测试供应商", storeId: 1,
          items: [{ skuId: 1, skuName: "集成商品", boxQty: 1, bottleQty: 0, unitPrice: 100, taxRate: 0.13 }]
        });
      expect(orderRes.status).toBe(200);
      const orderNo = orderRes.body.data.purchaseNo;

      // Submit → Approve
      await request(app).post(`/api/admin/purchase-orders/${orderNo}/submit`).set("Authorization", `Bearer ${TOKEN}`);
      await request(app).post(`/api/admin/purchase-orders/${orderNo}/approve`).set("Authorization", `Bearer ${TOKEN}`);

      // Create in-stock
      const stockRes = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: supplierId, supplier_name: "集成测试供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "集成商品", box_qty: 1, bottle_qty: 0, unit_price: 100, tax_rate: 0.13 }]
        });
      expect(stockRes.status).toBe(200);

      // Create purchase return
      const returnRes = await request(app)
        .post("/api/admin/purchase-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: supplierId, supplier_name: "集成测试供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "集成商品", box_qty: 0, bottle_qty: 6, unit_price: 100, tax_rate: 0 }]
        });
      expect(returnRes.status).toBe(200);
    });
  });
});