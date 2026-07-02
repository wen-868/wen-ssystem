/**
 * 采购退货 Phase 2 API 测试
 * 路径: /api/admin/purchase-returns
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

describe("Purchase Return API", () => {
  beforeAll(() => resetMockDb());

  it("should create a purchase return", async () => {
    const res = await request(app)
      .post("/api/admin/purchase-returns")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        supplier_id: 1, supplier_name: "测试供应商", store_id: 1,
        items: [{ sku_id: 1, sku_name: "测试商品", box_qty: 1, bottle_qty: 0, unit_price: 100, tax_rate: 0.13 }]
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.return_no).toBeTruthy();
    returnNo = res.body.data.return_no;
  });

  it("should get return list", async () => {
    const res = await request(app)
      .get("/api/admin/purchase-returns")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should get return detail", async () => {
    const res = await request(app)
      .get(`/api/admin/purchase-returns/${returnNo}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.return_no).toBe(returnNo);
  });

  it("should approve return", async () => {
    const res = await request(app)
      .post(`/api/admin/purchase-returns/${returnNo}/approve`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should reject approve of already approved return", async () => {
    const res = await request(app)
      .post(`/api/admin/purchase-returns/${returnNo}/approve`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it("should void a pending return", async () => {
    const createRes = await request(app)
      .post("/api/admin/purchase-returns")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        supplier_id: 1, supplier_name: "测试供应商", store_id: 1,
        items: [{ sku_id: 1, sku_name: "测试商品2", box_qty: 0, bottle_qty: 6, unit_price: 50, tax_rate: 0 }]
      });
    const voidReturnNo = createRes.body.data.return_no;

    const voidRes = await request(app)
      .post(`/api/admin/purchase-returns/${voidReturnNo}/void`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.code).toBe("0");
  });

  it("should return 404 for non-existent return", async () => {
    const res = await request(app)
      .get("/api/admin/purchase-returns/NONEXISTENT")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it("should filter by supplier", async () => {
    const res = await request(app)
      .get("/api/admin/purchase-returns?supplier_id=1")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });
});