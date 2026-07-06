/**
 * Phase 2 端到端流程测试
 * 测试完整的采购-入库-退货-对账-付款流程
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

    it("full customer → statement → payment → void flow", async () => {
      // Create customer statement
      const stmtRes = await request(app)
        .post("/api/store/customer-statements")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "E2E完整流客户",
          start_date: "2025-06-01", end_date: "2025-06-30", statement_type: "MONTHLY"
        });
      expect(stmtRes.status).toBe(200);
      const stmtNo = stmtRes.body.data.statement_no;

      // Confirm statement
      const confirmRes = await request(app)
        .post(`/api/store/customer-statements/${stmtNo}/confirm`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(confirmRes.status).toBe(200);

      // Create payment
      const paymentRes = await request(app)
        .post("/api/store/customer-payments")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "E2E完整流客户", amount: 1000,
          payment_method: "WECHAT", payment_date: "2025-06-15",
          source_type: "STATEMENT", source_no: stmtNo
        });
      expect(paymentRes.status).toBe(200);
      const paymentNo = paymentRes.body.data.receipt_no;

      // Void payment
      const voidRes = await request(app)
        .post(`/api/store/customer-payments/${paymentNo}/void`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(voidRes.status).toBe(200);
    });

    it("purchase order with multiple items full lifecycle", async () => {
      // Create order with 3 items
      const createRes = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "多商品E2E供应商", storeId: 1,
          items: [
            { skuId: 1, skuName: "商品A", boxQty: 2, bottleQty: 0, unitPrice: 100, taxRate: 0.13 },
            { skuId: 2, skuName: "商品B", boxQty: 1, bottleQty: 6, unitPrice: 200, taxRate: 0.13 },
            { skuId: 3, skuName: "商品C", boxQty: 0, bottleQty: 10, unitPrice: 50, taxRate: 0 }
          ]
        });
      expect(createRes.status).toBe(200);
      const orderNo = createRes.body.data.purchaseNo;
      expect(orderNo).toBeTruthy();

      // Get detail and verify items
      const detailRes = await request(app)
        .get(`/api/admin/purchase-orders/${orderNo}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(detailRes.status).toBe(200);

      // Submit
      const submitRes = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/submit`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(submitRes.status).toBe(200);

      // Approve
      const approveRes = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approveRes.status).toBe(200);

      // Verify status after approval
      const afterApprove = await request(app)
        .get(`/api/admin/purchase-orders/${orderNo}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(afterApprove.status).toBe(200);
    });

    it("sale return full cycle: create → approve → refund", async () => {
      const createRes = await request(app)
        .post("/api/store/sale-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customerId: 1, customerName: "E2E销售退货客户", storeId: 1,
          items: [{ skuId: 1, skuName: "E2E退货商品", boxQty: 0, bottleQty: 3, unitPrice: 150, reason: "质量问题" }]
        });
      expect(createRes.status).toBe(200);
      const returnNo = createRes.body.data.returnNo;
      expect(returnNo).toBeTruthy();

      // Check initial status
      const detail = await request(app)
        .get(`/api/store/sale-returns/${returnNo}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.return_status).toBe("PENDING");

      // Approve
      const approveRes = await request(app)
        .post(`/api/store/sale-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approveRes.status).toBe(200);

      // Check approved status
      const afterApprove = await request(app)
        .get(`/api/store/sale-returns/${returnNo}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(afterApprove.body.data.return_status).toBe("COMPLETED");

      // Refund
      const refundRes = await request(app)
        .post(`/api/store/sale-returns/${returnNo}/refund`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ refundMethod: "WECHAT" });
      expect(refundRes.status).toBe(200);
    });

    it("supplier CRUD with contacts full flow", async () => {
      // Create supplier
      const createRes = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          name: "E2E完整供应商",
          shortName: "E2E供应",
          supplyType: "白酒",
          category: "品牌商",
          province: "广东省",
          city: "深圳市",
          district: "南山区",
          address: "科技园路1号",
          creditLevel: "A",
          settlementType: "MONTHLY",
          settlementDay: 15,
          taxRate: 0.13
        });
      expect(createRes.status).toBe(200);
      const supplierId = createRes.body.data.id;

      // Add contact 1
      const c1 = await request(app)
        .post(`/api/admin/suppliers/${supplierId}/contacts`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "张经理", phone: "13900139001", position: "采购经理" });
      expect(c1.status).toBe(200);

      // Add contact 2
      const c2 = await request(app)
        .post(`/api/admin/suppliers/${supplierId}/contacts`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "李主管", phone: "13900139002", position: "财务主管" });
      expect(c2.status).toBe(200);

      // Get detail with contacts
      const detailRes = await request(app)
        .get(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.name).toBe("E2E完整供应商");

      // Update supplier
      const updateRes = await request(app)
        .put(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "E2E完整供应商(已更新)", creditLevel: "AA" });
      expect(updateRes.status).toBe(200);

      // Verify update
      const afterUpdate = await request(app)
        .get(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(afterUpdate.body.data.name).toBe("E2E完整供应商(已更新)");
    });
  });
});