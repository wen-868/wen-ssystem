/**
 * 销售退货 Phase 2 API 测试
 * 路径: /api/admin/sale-returns
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

let returnNo: string;

describe("Sale Return API", () => {
  beforeAll(() => resetMockDb());

  it("should create a sale return", async () => {
    const res = await request(app)
      .post("/api/admin/sale-returns")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        storeId: 1, customerName: "测试客户", customerMobile: "13800000000",
        items: [{ skuId: 1, skuName: "测试商品", boxQty: 1, bottleQty: 0, unitPrice: 100, reason: "质量问题" }]
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.returnNo).toBeTruthy();
    returnNo = res.body.data.returnNo;
  });

  it("should get sale return list", async () => {
    const res = await request(app)
      .get("/api/admin/sale-returns")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should get sale return detail", async () => {
    const res = await request(app)
      .get(`/api/admin/sale-returns/${returnNo}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.return_no).toBe(returnNo);
  });

  it("should approve sale return", async () => {
    const res = await request(app)
      .post(`/api/admin/sale-returns/${returnNo}/approve`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should refund a completed sale return", async () => {
    const res = await request(app)
      .post(`/api/admin/sale-returns/${returnNo}/refund`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ refundMethod: "CASH" });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should return 404 for non-existent return", async () => {
    const res = await request(app)
      .get("/api/admin/sale-returns/NONEXISTENT")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it("should filter by store", async () => {
    const res = await request(app)
      .get("/api/admin/sale-returns?storeId=1")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should return 404 for non-existent sale bill", async () => {
    const res = await request(app)
      .get("/api/admin/sale-returns/sale-bills/NONEXISTENT")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });
});