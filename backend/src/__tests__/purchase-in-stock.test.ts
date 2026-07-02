/**
 * 采购入库 Phase 2 API 测试
 * 路径: /api/admin/purchase-in-stocks
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

let stockNo: string;

describe("Purchase In-Stock API", () => {
  beforeAll(() => resetMockDb());

  it("should create a purchase in-stock record", async () => {
    const res = await request(app)
      .post("/api/admin/purchase-in-stocks")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        supplier_id: 1, supplier_name: "测试供应商", store_id: 1,
        items: [{ sku_id: 1, sku_name: "测试商品", box_qty: 1, bottle_qty: 0, unit_price: 100, tax_rate: 0.13 }]
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.stock_no).toBeTruthy();
    stockNo = res.body.data.stock_no;
  });

  it("should get in-stock list", async () => {
    const res = await request(app)
      .get("/api/admin/purchase-in-stocks")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should get in-stock detail", async () => {
    const res = await request(app)
      .get(`/api/admin/purchase-in-stocks/${stockNo}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.stock_no).toBe(stockNo);
  });

  it("should approve in-stock", async () => {
    const res = await request(app)
      .post(`/api/admin/purchase-in-stocks/${stockNo}/approve`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should reject approve of already approved in-stock", async () => {
    const res = await request(app)
      .post(`/api/admin/purchase-in-stocks/${stockNo}/approve`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it("should void a pending in-stock", async () => {
    const createRes = await request(app)
      .post("/api/admin/purchase-in-stocks")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        supplier_id: 1, supplier_name: "测试供应商", store_id: 1,
        items: [{ sku_id: 1, sku_name: "测试商品2", box_qty: 0, bottle_qty: 6, unit_price: 50, tax_rate: 0 }]
      });
    const voidStockNo = createRes.body.data.stock_no;

    const voidRes = await request(app)
      .post(`/api/admin/purchase-in-stocks/${voidStockNo}/void`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.code).toBe("0");
  });

  it("should return 404 for non-existent in-stock", async () => {
    const res = await request(app)
      .get("/api/admin/purchase-in-stocks/NONEXISTENT")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it("should filter by supplier", async () => {
    const res = await request(app)
      .get("/api/admin/purchase-in-stocks?supplier_id=1")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });
});