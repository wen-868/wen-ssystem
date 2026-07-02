/**
 * Phase 1 + Phase 2 集成测试
 * 测试跨模块协作和边界情况
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

describe("Phase 1-2 Integration", () => {
  beforeAll(() => resetMockDb());

  describe("Auth & Tenant", () => {
    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get("/api/admin/suppliers");
      expect(res.status).toBe(401);
    });

    it("should reject invalid token", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers")
        .set("Authorization", "Bearer invalid.token.here");
      expect(res.status).toBe(401);
    });

    it("should accept valid token", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  describe("Supplier CRUD", () => {
    it("create → list → detail → update → list flow", async () => {
      const createRes = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "CRUD测试供应商", shortName: "CRUD" });
      expect(createRes.status).toBe(200);
      const id = createRes.body.data.id;

      const listRes = await request(app).get("/api/admin/suppliers").set("Authorization", `Bearer ${TOKEN}`);
      expect(listRes.body.data.records.some((r: any) => r.id === id)).toBe(true);

      const detailRes = await request(app).get(`/api/admin/suppliers/${id}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(detailRes.body.data.name).toBe("CRUD测试供应商");

      await request(app).put(`/api/admin/suppliers/${id}`).set("Authorization", `Bearer ${TOKEN}`).send({ name: "CRUD已更新" });

      const updatedRes = await request(app).get(`/api/admin/suppliers/${id}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(updatedRes.body.data.name).toBe("CRUD已更新");
    });

    it("should handle search by keyword", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers?keyword=CRUD")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle search by supplyType", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers?supplyType=白酒")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  describe("Supplier Contacts", () => {
    let supplierId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "联系人测试供应商", contactPerson: "主联系人", contactMobile: "13800000001" });
      supplierId = res.body.data.id;
    });

    it("should add and list contacts", async () => {
      const addRes = await request(app)
        .post(`/api/admin/suppliers/${supplierId}/contacts`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "新增联系人", mobile: "13800000002", isPrimary: false });
      expect(addRes.status).toBe(200);

      const detailRes = await request(app).get(`/api/admin/suppliers/${supplierId}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(detailRes.body.data.contacts.length).toBeGreaterThanOrEqual(1);
    });

    it("should delete contact", async () => {
      const detailRes = await request(app).get(`/api/admin/suppliers/${supplierId}`).set("Authorization", `Bearer ${TOKEN}`);
      const contactId = detailRes.body.data.contacts[0].id;

      const delRes = await request(app)
        .delete(`/api/admin/suppliers/${supplierId}/contacts/${contactId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(delRes.status).toBe(200);
    });
  });

  describe("Purchase Order Lifecycle", () => {
    it("create with multiple items", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "多商品供应商", storeId: 1,
          items: [
            { skuId: 1, skuName: "商品A", boxQty: 1, bottleQty: 0, unitPrice: 100, taxRate: 0.13 },
            { skuId: 2, skuName: "商品B", boxQty: 0, bottleQty: 6, unitPrice: 50, taxRate: 0.13 },
          ]
        });
      expect(res.status).toBe(200);
      expect(res.body.data.purchaseNo).toBeTruthy();
    });

    it("status transitions: DRAFT → PENDING → APPROVED", async () => {
      const createRes = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "状态流供应商", storeId: 1,
          items: [{ skuId: 1, skuName: "状态流商品", boxQty: 1, bottleQty: 0, unitPrice: 100, taxRate: 0 }]
        });
      const orderNo = createRes.body.data.purchaseNo;

      const detail1 = await request(app).get(`/api/admin/purchase-orders/${orderNo}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(detail1.body.data.status).toBe("DRAFT");

      await request(app).post(`/api/admin/purchase-orders/${orderNo}/submit`).set("Authorization", `Bearer ${TOKEN}`);
      const detail2 = await request(app).get(`/api/admin/purchase-orders/${orderNo}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(detail2.body.data.status).toBe("PENDING");

      await request(app).post(`/api/admin/purchase-orders/${orderNo}/approve`).set("Authorization", `Bearer ${TOKEN}`);
      const detail3 = await request(app).get(`/api/admin/purchase-orders/${orderNo}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(detail3.body.data.status).toBe("APPROVED");
    });

    it("should cancel a pending order", async () => {
      const createRes = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "取消测试供应商", storeId: 1,
          items: [{ skuId: 1, skuName: "取消商品", boxQty: 0, bottleQty: 2, unitPrice: 10, taxRate: 0 }]
        });
      const orderNo = createRes.body.data.purchaseNo;

      const cancelRes = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/cancel`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(cancelRes.status).toBe(200);
    });

    it("should delete a draft order", async () => {
      const createRes = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "删除测试供应商", storeId: 1,
          items: [{ skuId: 1, skuName: "删除商品", boxQty: 0, bottleQty: 1, unitPrice: 5, taxRate: 0 }]
        });
      const orderNo = createRes.body.data.purchaseNo;

      const delRes = await request(app)
        .delete(`/api/admin/purchase-orders/${orderNo}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(delRes.status).toBe(200);
    });

    it("should update draft order items", async () => {
      const createRes = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "更新测试供应商", storeId: 1,
          items: [{ skuId: 1, skuName: "旧商品", boxQty: 0, bottleQty: 1, unitPrice: 10, taxRate: 0 }]
        });
      const orderNo = createRes.body.data.purchaseNo;

      const updateRes = await request(app)
        .put(`/api/admin/purchase-orders/${orderNo}`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          items: [{ skuId: 1, skuName: "新商品", boxQty: 1, bottleQty: 0, unitPrice: 120, taxRate: 0.13 }]
        });
      expect(updateRes.status).toBe(200);
    });
  });

  describe("Purchase In-Stock Lifecycle", () => {
    it("create → approve flow", async () => {
      const createRes = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "入库流供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "入库流商品", box_qty: 1, bottle_qty: 0, unit_price: 100, tax_rate: 0.13 }]
        });
      expect(createRes.status).toBe(200);
      const stockNo = createRes.body.data.stock_no;

      const approveRes = await request(app)
        .post(`/api/admin/purchase-in-stocks/${stockNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approveRes.status).toBe(200);
    });

    it("create with batch info", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "批次测试供应商", store_id: 1,
          items: [{
            sku_id: 1, sku_name: "批次商品", box_qty: 0, bottle_qty: 12, unit_price: 80,
            batch_no: "BATCH2025-001", production_date: "2025-01-01", expiry_date: "2027-01-01"
          }]
        });
      expect(res.status).toBe(200);
    });
  });

  describe("Purchase Return Lifecycle", () => {
    it("create → approve flow", async () => {
      const createRes = await request(app)
        .post("/api/admin/purchase-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "退货流供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "退货流商品", box_qty: 0, bottle_qty: 6, unit_price: 100, tax_rate: 0 }]
        });
      expect(createRes.status).toBe(200);
      const returnNo = createRes.body.data.return_no;

      const approveRes = await request(app)
        .post(`/api/admin/purchase-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approveRes.status).toBe(200);
    });
  });

  describe("Sale Return Lifecycle", () => {
    it("create → approve → refund flow", async () => {
      const createRes = await request(app)
        .post("/api/admin/sale-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          storeId: 1, customerName: "销售退流客户", customerMobile: "13800000003",
          items: [{ skuId: 1, skuName: "销售退流商品", boxQty: 0, bottleQty: 6, unitPrice: 120, reason: "破损" }]
        });
      expect(createRes.status).toBe(200);
      const returnNo = createRes.body.data.returnNo;

      await request(app).post(`/api/admin/sale-returns/${returnNo}/approve`).set("Authorization", `Bearer ${TOKEN}`);
      const refundRes = await request(app)
        .post(`/api/admin/sale-returns/${returnNo}/refund`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ refundMethod: "BANK" });
      expect(refundRes.status).toBe(200);
    });

    it("should reject refund on non-completed return", async () => {
      const createRes = await request(app)
        .post("/api/admin/sale-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          storeId: 1, customerName: "未审客户", customerMobile: "13800000004",
          items: [{ skuId: 1, skuName: "未审商品", boxQty: 0, bottleQty: 2, unitPrice: 10, reason: "测试" }]
        });
      const returnNo = createRes.body.data.returnNo;

      const refundRes = await request(app)
        .post(`/api/admin/sale-returns/${returnNo}/refund`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ refundMethod: "CASH" });
      expect(refundRes.status).toBe(400);
    });
  });

  describe("Customer Statement Lifecycle", () => {
    it("create → confirm → paid flow", async () => {
      const createRes = await request(app)
        .post("/api/store/customer-statements")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "对账流客户",
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

    it("should reject paid on non-confirmed statement", async () => {
      const createRes = await request(app)
        .post("/api/store/customer-statements")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "未确认客户",
          start_date: "2025-02-01", end_date: "2025-02-28"
        });
      const stmtNo = createRes.body.data.statement_no;

      const paidRes = await request(app)
        .post(`/api/store/customer-statements/${stmtNo}/paid`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(paidRes.status).toBe(400);
    });
  });

  describe("Customer Payment Lifecycle", () => {
    it("create → void flow", async () => {
      const createRes = await request(app)
        .post("/api/store/customer-payments")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "付款流客户", amount: 1000,
          payment_method: "CASH", payment_date: "2025-01-15"
        });
      expect(createRes.status).toBe(200);
      const receiptNo = createRes.body.data.receipt_no;

      const voidRes = await request(app)
        .post(`/api/store/customer-payments/${receiptNo}/void`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(voidRes.status).toBe(200);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should reject empty order items", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ supplierId: 1, supplierName: "空商品", storeId: 1, items: [] });
      expect(res.status).toBe(400);
    });

    it("should reject negative quantity", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "负数数量", storeId: 1,
          items: [{ skuId: 1, skuName: "负数商品", boxQty: -1, bottleQty: 0, unitPrice: 100, taxRate: 0 }]
        });
      expect(res.status).toBe(400);
    });

    it("should reject negative unit price", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "负价格", storeId: 1,
          items: [{ skuId: 1, skuName: "负价商品", boxQty: 1, bottleQty: 0, unitPrice: -1, taxRate: 0 }]
        });
      expect(res.status).toBe(400);
    });

    it("should reject missing supplier name", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent supplier detail", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers/99999")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });

    it("should return 404 for non-existent supplier update", async () => {
      const res = await request(app)
        .put("/api/admin/suppliers/99999")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "不存在" });
      expect(res.status).toBe(404);
    });
  });
});