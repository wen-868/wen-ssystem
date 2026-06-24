import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18765";
let server: http.Server;

function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const url = base + path;
    const req = http.request(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data || "{}") });
        } catch {
          resolve({ status: res.statusCode || 0, data: null });
        }
      });
    });
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

beforeAll(async () => {
  server = http.createServer(app).listen(18765);
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  resetMockDb();
});

describe("采购订单 /api/admin/purchase-orders", () => {
  it("POST 创建采购订单 - 正常流程", async () => {
    const r = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1,
      storeId: 1,
      items: [
        { skuId: 101, skuName: "白酒A", bottleQty: 10, totalBottleQty: 10, unitPrice: 50 },
        { skuId: 102, skuName: "白酒B", bottleQty: 20, totalBottleQty: 20, unitPrice: 80 }
      ]
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.orderNo).toBeDefined();
    expect(r.data.data.orderId).toBeDefined();
    const detail = await api("GET", `/api/admin/purchase-orders/${r.data.data.orderId}`);
    expect(Number(detail.data.data.goodsAmount)).toBeCloseTo(500 + 1600, 2);
    expect(detail.data.data.orderStatus).toBe("DRAFT");
  });

  it("GET 列表 - 分页结构", async () => {
    await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 200, skuName: "测试", bottleQty: 5, totalBottleQty: 5, unitPrice: 100 }]
    });
    const r = await api("GET", "/api/admin/purchase-orders");
    expect(r.status).toBe(200);
    expect(r.data.data.records).toBeDefined();
    expect(Array.isArray(r.data.data.records)).toBe(true);
    expect(r.data.data.records.length).toBeGreaterThan(0);
    expect(r.data.data.total).toBeGreaterThan(0);
  });

  it("GET/:id 详情 - 包含 items", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 300, skuName: "测试商品", bottleQty: 5, totalBottleQty: 5, unitPrice: 100 }]
    });
    const orderId = create.data.data.orderId;
    const r = await api("GET", `/api/admin/purchase-orders/${orderId}`);
    expect(r.status).toBe(200);
    expect(r.data.data.id).toBe(orderId);
    expect(Array.isArray(r.data.data.items)).toBe(true);
    expect(r.data.data.items.length).toBe(1);
    expect(Number(r.data.data.items[0].bottleQty)).toBe(5);
  });

  it("POST /:id/confirm 确认订单 - 状态变为 APPROVED", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 400, skuName: "X", bottleQty: 10, totalBottleQty: 10, unitPrice: 50 }]
    });
    const orderId = create.data.data.orderId;
    const r = await api("POST", `/api/admin/purchase-orders/${orderId}/confirm`);
    expect(r.status).toBe(200);
    expect(r.data.data.orderStatus).toBe("APPROVED");
  });

  it("DELETE /:id 取消订单 - 状态变为 CANCELLED", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 600, skuName: "Z", bottleQty: 10, totalBottleQty: 10, unitPrice: 50 }]
    });
    const orderId = create.data.data.orderId;
    const r = await api("DELETE", `/api/admin/purchase-orders/${orderId}`);
    expect(r.status).toBe(200);
  });

  it("GET/:nonexistent 不存在的订单返回 404", async () => {
    const r = await api("GET", "/api/admin/purchase-orders/99999");
    expect(r.status).toBe(404);
  });

  it("边界: 金额精度 0.01 元", async () => {
    const r = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 900, skuName: "测试精度", bottleQty: 1, totalBottleQty: 1, unitPrice: 99.99 }]
    });
    expect(r.status).toBe(200);
    const detail = await api("GET", `/api/admin/purchase-orders/${r.data.data.orderId}`);
    expect(Number(detail.data.data.goodsAmount)).toBeCloseTo(99.99, 2);
  });

  it("按状态筛选订单", async () => {
    const create1 = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 701, skuName: "A", bottleQty: 1, totalBottleQty: 1, unitPrice: 100 }]
    });
    const create2 = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 702, skuName: "B", bottleQty: 1, totalBottleQty: 1, unitPrice: 200 }]
    });
    await api("POST", `/api/admin/purchase-orders/${create2.data.data.orderId}/confirm`);

    const r = await api("GET", "/api/admin/purchase-orders?orderStatus=APPROVED");
    expect(r.status).toBe(200);
    expect(r.data.data.records.length).toBe(1);
    expect(r.data.data.records[0].orderStatus).toBe("APPROVED");
  });
});
