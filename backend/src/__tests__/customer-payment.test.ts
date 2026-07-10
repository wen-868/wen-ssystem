/**
 * 客户付款 Phase 2 API 测试
 * 路径: /api/store/customer-payments
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

let receiptNo: string;

describe("Customer Payment API", () => {
  beforeAll(() => resetMockDb());

  it("should create a customer payment", async () => {
    const res = await request(app)
      .post("/api/store/customer-payments")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        customer_id: 1, customer_name: "默认零售客户", amount: 500,
        payment_method: "CASH", payment_date: "2025-01-15"
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.receipt_no).toBeTruthy();
    receiptNo = res.body.data.receipt_no;
  });

  it("should get payment list", async () => {
    const res = await request(app)
      .get("/api/store/customer-payments")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it.skip("should get payment detail", async () => {
    const res = await request(app)
      .get(`/api/store/customer-payments/${receiptNo}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.receipt_no).toBe(receiptNo);
  });

  it.skip("should void a payment", async () => {
    const res = await request(app)
      .post(`/api/store/customer-payments/${receiptNo}/void`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it.skip("should reject void of already voided payment", async () => {
    const res = await request(app)
      .post(`/api/store/customer-payments/${receiptNo}/void`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it("should return 404 for non-existent payment", async () => {
    const res = await request(app)
      .get("/api/store/customer-payments/NONEXISTENT")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it("should filter by customer", async () => {
    const res = await request(app)
      .get("/api/store/customer-payments?customer_id=1")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it.skip("should create payment with source billing", async () => {
    const res = await request(app)
      .post("/api/store/customer-payments")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        customer_id: 1, customer_name: "默认零售客户", amount: 200,
        payment_method: "WECHAT", source_type: "SALE_BILL", source_no: "BILL001",
        payment_date: "2025-01-16"
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.receipt_no).toBeTruthy();

    const voidRes = await request(app)
      .post(`/api/store/customer-payments/${res.body.data.receipt_no}/void`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(voidRes.status).toBe(200);
  });

  it("should create payment with voucher", async () => {
    const res = await request(app)
      .post("/api/store/customer-payments")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        customer_id: 1, customer_name: "默认零售客户", amount: 300,
        payment_method: "BANK", voucher_no: "VCH001", payment_date: "2025-01-17"
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });
});
