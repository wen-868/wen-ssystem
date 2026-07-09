import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../server.js";
import { signToken } from "../middleware/auth.js";
import { resetMockDb } from "./mocks/mock-db.js";

const TOKEN = signToken({
  id: 1, username: "admin", roles: ["SUPER_ADMIN"],
  storeId: null, tenantId: "default"
});

const TOKEN_TENANT2 = signToken({
  id: 2, username: "admin2", roles: ["SUPER_ADMIN"],
  storeId: null, tenantId: "tenant-2"
});

describe.skip("Phase 1-2 Integration Tests", () => {
  beforeAll(() => resetMockDb());

  // ============ 认证与租户隔离 ============
  describe("Auth & Tenant Isolation", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(app).get("/api/admin/suppliers");
      expect(res.status).toBe(401);
    });

    it("rejects invalid token", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers")
        .set("Authorization", "Bearer invalid.token.here");
      expect(res.status).toBe(401);
    });

    it("accepts valid token and returns data", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
    });

    it("isolates data between tenants - supplier", async () => {
      const s1 = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "租户A供应商", supplyType: "白酒" });
      expect(s1.status).toBe(200);
      const id1 = s1.body.data.id;

      const list1 = await request(app)
        .get("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`);
      const hasInTenant1 = list1.body.data.records.some((r: any) => r.id === id1);
      expect(hasInTenant1).toBe(true);

      const list2 = await request(app)
        .get("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN_TENANT2}`);
      const hasInTenant2 = list2.body.data.records.some((r: any) => r.id === id1);
      expect(hasInTenant2).toBe(false);
    });

    it("isolates data between tenants - purchase order", async () => {
      const o1 = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "租户A采购", storeId: 1,
          items: [{ skuId: 1, skuName: "租户A商品", boxQty: 1, bottleQty: 0, unitPrice: 100, taxRate: 0 }]
        });
      const orderNo1 = o1.body.data.purchaseNo;

      const d1 = await request(app)
        .get(`/api/admin/purchase-orders/${orderNo1}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(d1.status).toBe(200);

      const d2 = await request(app)
        .get(`/api/admin/purchase-orders/${orderNo1}`)
        .set("Authorization", `Bearer ${TOKEN_TENANT2}`);
      expect(d2.status).toBe(404);
    });
  });

  // ============ 供应商模块 ============
  describe("Supplier Module - CRUD", () => {
    let supplierId: number;

    it("creates a supplier with all fields", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          name: "CRUD全字段供应商", shortName: "CRUD全",
          supplyType: "白酒", contactPerson: "张经理",
          contactMobile: "13811112222", contactPhone: "010-12345678",
          province: "四川省", city: "宜宾市", address: "翠屏区XX路1号",
          creditLevel: "AA", settlementType: "MONTHLY", settlementDay: 15,
          taxRate: 0.13, bankName: "工商银行",
          bankAccount: "6222021234567890123",
          bankAccountName: "全字段供应商有限公司", remark: "集成测试"
        });
      expect(res.status).toBe(200);
      supplierId = res.body.data.id;
      expect(supplierId).toBeTruthy();
    });

    it("lists suppliers with pagination", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers?page=1&pageSize=10")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data.records).toBeInstanceOf(Array);
      expect(typeof res.body.data.total).toBe("number");
    });

    it("gets supplier detail with contacts", async () => {
      const res = await request(app)
        .get(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("CRUD全字段供应商");
      expect(res.body.data.contacts).toBeInstanceOf(Array);
    });

    it("updates supplier fields", async () => {
      const res = await request(app)
        .put(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "CRUD已更新供应商", creditLevel: "AAA" });
      expect(res.status).toBe(200);

      const detail = await request(app)
        .get(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(detail.body.data.name).toBe("CRUD已更新供应商");
    });

    it("searches suppliers by keyword", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers?keyword=CRUD已更新")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
    });

    it("filters suppliers by supplyType", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers?supplyType=白酒")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  describe("Supplier Module - Contacts", () => {
    let supplierId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "联系人测试供应商", contactPerson: "主联系人", contactMobile: "13800000101" });
      supplierId = res.body.data.id;
    });

    it("adds a contact", async () => {
      const res = await request(app)
        .post(`/api/admin/suppliers/${supplierId}/contacts`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "李经理", mobile: "13900000001", isPrimary: true, position: "采购总监", email: "li@test.com" });
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeTruthy();
    });

    it("lists contacts via supplier detail", async () => {
      const res = await request(app)
        .get(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.body.data.contacts.length).toBeGreaterThanOrEqual(1);
    });

    it("deletes a contact", async () => {
      const detail = await request(app)
        .get(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      const contactId = detail.body.data.contacts[0].id;

      const del = await request(app)
        .delete(`/api/admin/suppliers/${supplierId}/contacts/${contactId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(del.status).toBe(200);
    });
  });

  // ============ 采购订单模块 ============
  describe("Purchase Order Module", () => {
    it("creates order with multiple items", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "多商品供应商", storeId: 1,
          items: [
            { skuId: 1, skuName: "商品A", boxQty: 2, bottleQty: 3, unitPrice: 100, taxRate: 0.13 },
            { skuId: 2, skuName: "商品B", boxQty: 0, bottleQty: 6, unitPrice: 50, taxRate: 0.13 },
          ]
        });
      expect(res.status).toBe(200);
      expect(res.body.data.purchaseNo).toBeTruthy();
    });

    it("status transitions: DRAFT → PENDING → APPROVED", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "状态流供应商", storeId: 1,
          items: [{ skuId: 1, skuName: "状态流商品", boxQty: 1, bottleQty: 0, unitPrice: 100, taxRate: 0 }]
        });
      const orderNo = create.body.data.purchaseNo;

      const d1 = await request(app).get(`/api/admin/purchase-orders/${orderNo}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(d1.body.data.status).toBe("DRAFT");

      await request(app).post(`/api/admin/purchase-orders/${orderNo}/submit`).set("Authorization", `Bearer ${TOKEN}`);
      const d2 = await request(app).get(`/api/admin/purchase-orders/${orderNo}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(d2.body.data.status).toBe("PENDING");

      await request(app).post(`/api/admin/purchase-orders/${orderNo}/approve`).set("Authorization", `Bearer ${TOKEN}`);
      const d3 = await request(app).get(`/api/admin/purchase-orders/${orderNo}`).set("Authorization", `Bearer ${TOKEN}`);
      expect(d3.body.data.status).toBe("APPROVED");
    });

    it("cancels a pending order", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "取消测试", storeId: 1,
          items: [{ skuId: 1, skuName: "取消商品", boxQty: 0, bottleQty: 2, unitPrice: 10, taxRate: 0 }]
        });
      const orderNo = create.body.data.purchaseNo;

      await request(app).post(`/api/admin/purchase-orders/${orderNo}/submit`).set("Authorization", `Bearer ${TOKEN}`);

      const cancel = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/cancel`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(cancel.status).toBe(200);
    });

    it("deletes a draft order", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "删除测试", storeId: 1,
          items: [{ skuId: 1, skuName: "删除商品", boxQty: 0, bottleQty: 1, unitPrice: 5, taxRate: 0 }]
        });
      const orderNo = create.body.data.purchaseNo;

      const del = await request(app)
        .delete(`/api/admin/purchase-orders/${orderNo}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(del.status).toBe(200);
    });

    it("updates draft order items", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "更新测试", storeId: 1,
          items: [{ skuId: 1, skuName: "旧商品", boxQty: 0, bottleQty: 1, unitPrice: 10, taxRate: 0 }]
        });
      const orderNo = create.body.data.purchaseNo;

      const update = await request(app)
        .put(`/api/admin/purchase-orders/${orderNo}`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          items: [{ skuId: 1, skuName: "新商品", boxQty: 1, bottleQty: 0, unitPrice: 120, taxRate: 0.13 }]
        });
      expect(update.status).toBe(200);
    });

    it("rejects submitting already submitted order", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "重复提交测试", storeId: 1,
          items: [{ skuId: 1, skuName: "重复商品", boxQty: 1, bottleQty: 0, unitPrice: 10, taxRate: 0 }]
        });
      const orderNo = create.body.data.purchaseNo;

      await request(app).post(`/api/admin/purchase-orders/${orderNo}/submit`).set("Authorization", `Bearer ${TOKEN}`);
      const second = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/submit`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(second.status).toBe(400);
    });

    it("rejects approving non-pending order", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "直接审批测试", storeId: 1,
          items: [{ skuId: 1, skuName: "直审商品", boxQty: 1, bottleQty: 0, unitPrice: 10, taxRate: 0 }]
        });
      const orderNo = create.body.data.purchaseNo;

      const approve = await request(app)
        .post(`/api/admin/purchase-orders/${orderNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approve.status).toBe(400);
    });

    it("lists purchase orders with filters", async () => {
      const res = await request(app)
        .get("/api/admin/purchase-orders?page=1&pageSize=10&status=DRAFT")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  // ============ 采购入库模块 ============
  describe("Purchase In-Stock Module", () => {
    it("creates and approves in-stock", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "入库流供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "入库流商品", box_qty: 2, bottle_qty: 3, unit_price: 100, tax_rate: 0.13 }]
        });
      expect(create.status).toBe(200);
      const stockNo = create.body.data.stock_no;

      const approve = await request(app)
        .post(`/api/admin/purchase-in-stocks/${stockNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approve.status).toBe(200);
    });

    it("creates with batch info", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "批次测试", store_id: 1,
          items: [{
            sku_id: 1, sku_name: "批次商品", box_qty: 0, bottle_qty: 12, unit_price: 80,
            batch_no: "BATCH2026-001", production_date: "2026-01-01", expiry_date: "2028-01-01"
          }]
        });
      expect(res.status).toBe(200);
    });

    it("rejects approving already approved stock", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "重复审核入库", store_id: 1,
          items: [{ sku_id: 1, sku_name: "复审商品", box_qty: 1, bottle_qty: 0, unit_price: 10, tax_rate: 0 }]
        });
      const stockNo = create.body.data.stock_no;

      await request(app).post(`/api/admin/purchase-in-stocks/${stockNo}/approve`).set("Authorization", `Bearer ${TOKEN}`);
      const second = await request(app)
        .post(`/api/admin/purchase-in-stocks/${stockNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(second.status).toBe(400);
    });

    it("returns 404 for non-existent stock", async () => {
      const res = await request(app)
        .get("/api/admin/purchase-in-stocks/INVALID_STOCK_NO")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });
  });

  // ============ 采购退货模块 ============
  describe("Purchase Return Module", () => {
    it("creates and approves return", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "退货流供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "退货流商品", box_qty: 0, bottle_qty: 6, unit_price: 100, tax_rate: 0 }]
        });
      expect(create.status).toBe(200);
      const returnNo = create.body.data.return_no;

      const approve = await request(app)
        .post(`/api/admin/purchase-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approve.status).toBe(200);
    });

    it("rejects approving already approved return", async () => {
      const create = await request(app)
        .post("/api/admin/purchase-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "重复审核退货", store_id: 1,
          items: [{ sku_id: 1, sku_name: "复退商品", box_qty: 0, bottle_qty: 2, unit_price: 10, tax_rate: 0 }]
        });
      const returnNo = create.body.data.return_no;

      await request(app).post(`/api/admin/purchase-returns/${returnNo}/approve`).set("Authorization", `Bearer ${TOKEN}`);
      const second = await request(app)
        .post(`/api/admin/purchase-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(second.status).toBe(400);
    });

    it("returns 404 for non-existent return", async () => {
      const res = await request(app)
        .get("/api/admin/purchase-returns/INVALID_RETURN_NO")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });
  });

  // ============ 销售退货模块 ============
  describe("Sale Return Module", () => {
    it("create → approve → refund flow", async () => {
      const create = await request(app)
        .post("/api/store/sale-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customerId: 1, customerName: "销售退流客户", storeId: 1,
          items: [{ skuId: 1, skuName: "销售退流商品", boxQty: 0, bottleQty: 6, unitPrice: 120, reason: "破损" }]
        });
      expect(create.status).toBe(200);
      const returnNo = create.body.data.returnNo;

      const approve = await request(app)
        .post(`/api/store/sale-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approve.status).toBe(200);

      const refund = await request(app)
        .post(`/api/store/sale-returns/${returnNo}/refund`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ refundMethod: "WECHAT" });
      expect(refund.status).toBe(200);
    });

    it("rejects refund on non-completed return", async () => {
      const create = await request(app)
        .post("/api/store/sale-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customerId: 1, customerName: "未审客户", storeId: 1,
          items: [{ skuId: 1, skuName: "未审商品", boxQty: 0, bottleQty: 2, unitPrice: 10, reason: "测试" }]
        });
      const returnNo = create.body.data.returnNo;

      const refund = await request(app)
        .post(`/api/store/sale-returns/${returnNo}/refund`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ refundMethod: "CASH" });
      expect(refund.status).toBe(400);
    });

    it("returns 404 for non-existent return detail", async () => {
      const res = await request(app)
        .get("/api/store/sale-returns/INVALID_NO")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });
  });

  // ============ 客户对账单模块 ============
  describe("Customer Statement Module", () => {
    it("create → confirm → paid full flow", async () => {
      const create = await request(app)
        .post("/api/store/customer-statements")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "对账流客户",
          start_date: "2026-01-01", end_date: "2026-01-31", statement_type: "MONTHLY"
        });
      expect(create.status).toBe(200);
      const stmtNo = create.body.data.statement_no;

      const confirm = await request(app)
        .post(`/api/store/customer-statements/${stmtNo}/confirm`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(confirm.status).toBe(200);

      const paid = await request(app)
        .post(`/api/store/customer-statements/${stmtNo}/paid`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(paid.status).toBe(200);
    });

    it("rejects paid on non-confirmed statement", async () => {
      const create = await request(app)
        .post("/api/store/customer-statements")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "未确认客户",
          start_date: "2026-02-01", end_date: "2026-02-28", statement_type: "MONTHLY"
        });
      const stmtNo = create.body.data.statement_no;

      const paid = await request(app)
        .post(`/api/store/customer-statements/${stmtNo}/paid`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(paid.status).toBe(400);
    });

    it("rejects confirming already confirmed statement", async () => {
      const create = await request(app)
        .post("/api/store/customer-statements")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "重复确认客户",
          start_date: "2026-03-01", end_date: "2026-03-31", statement_type: "MONTHLY"
        });
      const stmtNo = create.body.data.statement_no;

      await request(app).post(`/api/store/customer-statements/${stmtNo}/confirm`).set("Authorization", `Bearer ${TOKEN}`);
      const second = await request(app)
        .post(`/api/store/customer-statements/${stmtNo}/confirm`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(second.status).toBe(400);
    });

    it("filters statements by status", async () => {
      const res = await request(app)
        .get("/api/store/customer-statements?status=DRAFT&page=1&pageSize=10")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  // ============ 客户收款单模块 ============
  describe("Customer Payment Module", () => {
    it("create → void flow", async () => {
      const create = await request(app)
        .post("/api/store/customer-payments")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "付款流客户", amount: 1000,
          payment_method: "CASH", payment_date: "2026-01-15", remark: "集成测试收款"
        });
      expect(create.status).toBe(200);
      const receiptNo = create.body.data.receipt_no;

      const voidRes = await request(app)
        .post(`/api/store/customer-payments/${receiptNo}/void`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(voidRes.status).toBe(200);
    });

    it("rejects voiding already voided payment", async () => {
      const create = await request(app)
        .post("/api/store/customer-payments")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "重复作废客户", amount: 500,
          payment_method: "BANK", payment_date: "2026-01-20"
        });
      const receiptNo = create.body.data.receipt_no;

      await request(app).post(`/api/store/customer-payments/${receiptNo}/void`).set("Authorization", `Bearer ${TOKEN}`);
      const second = await request(app)
        .post(`/api/store/customer-payments/${receiptNo}/void`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(second.status).toBe(400);
    });

    it("filters payments by method", async () => {
      const res = await request(app)
        .get("/api/store/customer-payments?payment_method=CASH&page=1&pageSize=10")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  // ============ 跨模块集成测试 ============
  describe("Cross-Module Integration", () => {
    it("supplier → purchase order → in-stock → return chain", async () => {
      const sup = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "链路测试供应商", supplyType: "白酒" });
      expect(sup.status).toBe(200);
      const supplierId = sup.body.data.id;

      const order = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId, supplierName: "链路测试供应商", storeId: 1,
          items: [{ skuId: 1, skuName: "链路商品", boxQty: 5, bottleQty: 0, unitPrice: 100, taxRate: 0.13 }]
        });
      expect(order.status).toBe(200);
      const orderNo = order.body.data.purchaseNo;

      await request(app).post(`/api/admin/purchase-orders/${orderNo}/submit`).set("Authorization", `Bearer ${TOKEN}`);
      await request(app).post(`/api/admin/purchase-orders/${orderNo}/approve`).set("Authorization", `Bearer ${TOKEN}`);

      const stock = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          order_no: orderNo, supplier_id: supplierId, supplier_name: "链路测试供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "链路商品", box_qty: 5, bottle_qty: 0, unit_price: 100, tax_rate: 0.13 }]
        });
      expect(stock.status).toBe(200);
      const stockNo = stock.body.data.stock_no;

      await request(app).post(`/api/admin/purchase-in-stocks/${stockNo}/approve`).set("Authorization", `Bearer ${TOKEN}`);

      const ret = await request(app)
        .post("/api/admin/purchase-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          stock_no: stockNo, supplier_id: supplierId, supplier_name: "链路测试供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "链路商品", box_qty: 1, bottle_qty: 0, unit_price: 100, tax_rate: 0.13, reason: "质量问题" }]
        });
      expect(ret.status).toBe(200);
      const returnNo = ret.body.data.return_no;

      const approveRet = await request(app)
        .post(`/api/admin/purchase-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approveRet.status).toBe(200);
    });

    it("customer → statement → payment integration", async () => {
      const stmt = await request(app)
        .post("/api/store/customer-statements")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "集成对账客户",
          start_date: "2026-04-01", end_date: "2026-04-30", statement_type: "MONTHLY"
        });
      expect(stmt.status).toBe(200);
      const stmtNo = stmt.body.data.statement_no;

      await request(app).post(`/api/store/customer-statements/${stmtNo}/confirm`).set("Authorization", `Bearer ${TOKEN}`);

      const payment = await request(app)
        .post("/api/store/customer-payments")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customer_id: 1, customer_name: "集成对账客户", amount: 500,
          payment_method: "WECHAT", payment_date: "2026-04-15",
          source_type: "STATEMENT", source_no: stmtNo
        });
      expect(payment.status).toBe(200);
    });

    it("sale return inventory impact consistency", async () => {
      const ret = await request(app)
        .post("/api/store/sale-returns")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          customerId: 1, customerName: "库存测试客户", storeId: 1,
          items: [{ skuId: 1, skuName: "库存影响商品", boxQty: 0, bottleQty: 5, unitPrice: 100, reason: "质量问题" }]
        });
      const returnNo = ret.body.data.returnNo;

      const before = await request(app)
        .get(`/api/store/sale-returns/${returnNo}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(before.body.data.return_status).toBe("PENDING");

      const approve = await request(app)
        .post(`/api/store/sale-returns/${returnNo}/approve`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(approve.status).toBe(200);

      const after = await request(app)
        .get(`/api/store/sale-returns/${returnNo}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(after.body.data.return_status).toBe("COMPLETED");
    });

    it("creates multiple in-stock records", async () => {
      const stock1 = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "多次入库供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "商品A", box_qty: 1, bottle_qty: 0, unit_price: 100, tax_rate: 0.13 }]
        });
      expect(stock1.status).toBe(200);
      expect(stock1.body.data.stock_no).toBeTruthy();

      const stock2 = await request(app)
        .post("/api/admin/purchase-in-stocks")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplier_id: 1, supplier_name: "多次入库供应商", store_id: 1,
          items: [{ sku_id: 1, sku_name: "商品A", box_qty: 2, bottle_qty: 0, unit_price: 100, tax_rate: 0.13 }]
        });
      expect(stock2.status).toBe(200);
      expect(stock2.body.data.stock_no).toBeTruthy();
      expect(stock2.body.data.stock_no).not.toBe(stock1.body.data.stock_no);
    });

    it("supplier update reflects in detail query", async () => {
      const supplierRes = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "更新测试供应商", supplyType: "白酒" });
      expect(supplierRes.status).toBe(200);
      const supplierId = supplierRes.body.data.id;

      const updateRes = await request(app)
        .put(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "更新后的供应商" });
      expect(updateRes.status).toBe(200);

      const detailRes = await request(app)
        .get(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.name).toBe("更新后的供应商");
    });

    it("multiple contacts on supplier", async () => {
      const supplierRes = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "多联系人供应商", supplyType: "白酒" });
      expect(supplierRes.status).toBe(200);
      const supplierId = supplierRes.body.data.id;

      const c1 = await request(app)
        .post(`/api/admin/suppliers/${supplierId}/contacts`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "联系人1", phone: "13800138001" });
      expect(c1.status).toBe(200);

      const c2 = await request(app)
        .post(`/api/admin/suppliers/${supplierId}/contacts`)
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "联系人2", phone: "13800138002" });
      expect(c2.status).toBe(200);

      const detailRes = await request(app)
        .get(`/api/admin/suppliers/${supplierId}`)
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(detailRes.status).toBe(200);
    });
  });

  // ============ 边界条件与错误处理 ============
  describe("Edge Cases & Error Handling", () => {
    it("rejects empty order items", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ supplierId: 1, supplierName: "空商品", storeId: 1, items: [] });
      expect(res.status).toBe(400);
    });

    it("rejects negative box quantity", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "负数数量", storeId: 1,
          items: [{ skuId: 1, skuName: "负数商品", boxQty: -1, bottleQty: 0, unitPrice: 100, taxRate: 0 }]
        });
      expect(res.status).toBe(400);
    });

    it("rejects negative unit price", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "负价格", storeId: 1,
          items: [{ skuId: 1, skuName: "负价商品", boxQty: 1, bottleQty: 0, unitPrice: -1, taxRate: 0 }]
        });
      expect(res.status).toBe(400);
    });

    it("rejects missing supplier name", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent supplier detail", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers/99999")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent supplier update", async () => {
      const res = await request(app)
        .put("/api/admin/suppliers/99999")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "不存在" });
      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent purchase order", async () => {
      const res = await request(app)
        .get("/api/admin/purchase-orders/INVALID_ORDER_NO")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    });

    it("handles zero bottle and box quantity", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "零数量", storeId: 1,
          items: [{ skuId: 1, skuName: "零商品", boxQty: 0, bottleQty: 0, unitPrice: 100, taxRate: 0 }]
        });
      expect(res.status).toBe(200);
      expect(res.body.data.purchaseNo).toBeTruthy();
    });

    it("handles very long supplier name", async () => {
      const longName = "A".repeat(200);
      const res = await request(app)
        .post("/api/admin/suppliers")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: longName, supplyType: "白酒" });
      expect([200, 400]).toContain(res.status);
    });

    it("rejects invalid tax rate (>1)", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          supplierId: 1, supplierName: "税率超限", storeId: 1,
          items: [{ skuId: 1, skuName: "税超商品", boxQty: 1, bottleQty: 0, unitPrice: 100, taxRate: 2 }]
        });
      expect(res.status).toBe(400);
    });
  });

  // ============ 分页与排序 ============
  describe("Pagination & Sorting", () => {
    it("supports pagination with page and pageSize", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers?page=1&pageSize=5")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data.pageSize).toBe(5);
      expect(res.body.data.page).toBe(1);
    });

    it("handles page 0 gracefully", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers?page=0&pageSize=10")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });

    it("handles large pageSize", async () => {
      const res = await request(app)
        .get("/api/admin/suppliers?page=1&pageSize=1000")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
    });
  });
});
