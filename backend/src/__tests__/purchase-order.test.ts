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
        { skuId: 101, skuName: "白酒A", bottleQty: 10, unitPrice: 50 },
        { skuId: 102, skuName: "白酒B", bottleQty: 20, unitPrice: 80 }
      ]
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.orderNo).toBeDefined();
    expect(Number(r.data.data.goodsAmount)).toBeCloseTo(500 + 1600, 2);
    expect(Number(r.data.data.payableAmount)).toBeCloseTo(2100, 2);
    expect(r.data.data.orderStatus).toBe("DRAFT");
  });

  it("GET 列表", async () => {
    await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 200, skuName: "测试", bottleQty: 5, unitPrice: 100 }]
    });
    const r = await api("GET", "/api/admin/purchase-orders");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data.data)).toBe(true);
    expect(r.data.data.length).toBeGreaterThan(0);
  });

  it("GET/:orderNo 详情 - 包含 items", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 300, skuName: "测试商品", bottleQty: 5, unitPrice: 100 }]
    });
    const orderNo = create.data.data.orderNo;
    const r = await api("GET", `/api/admin/purchase-orders/${orderNo}`);
    expect(r.status).toBe(200);
    expect(r.data.data.orderNo).toBe(orderNo);
    expect(Array.isArray(r.data.data.items)).toBe(true);
    expect(r.data.data.items.length).toBe(1);
    expect(Number(r.data.data.items[0].bottleQty)).toBe(5);
  });

  it("POST /submit 提交订单 - 状态变为 SUBMITTED", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 400, skuName: "X", bottleQty: 10, unitPrice: 50 }]
    });
    const orderNo = create.data.data.orderNo;
    const r = await api("POST", `/api/admin/purchase-orders/${orderNo}/submit`);
    expect(r.status).toBe(200);
    expect(r.data.data.orderStatus).toBe("SUBMITTED");
  });

  it("POST /audit 审核订单 - 状态变为 AUDITED", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 500, skuName: "Y", bottleQty: 10, unitPrice: 50 }]
    });
    const orderNo = create.data.data.orderNo;
    const r = await api("POST", `/api/admin/purchase-orders/${orderNo}/audit`);
    expect(r.status).toBe(200);
    expect(r.data.data.orderStatus).toBe("AUDITED");
  });

  it("POST /void 作废订单 - 状态变为 VOID", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 600, skuName: "Z", bottleQty: 10, unitPrice: 50 }]
    });
    const orderNo = create.data.data.orderNo;
    const r = await api("POST", `/api/admin/purchase-orders/${orderNo}/void`);
    expect(r.status).toBe(200);
    expect(r.data.data.orderStatus).toBe("VOID");
  });

  it("POST /close 关闭订单 - 状态变为 CLOSED", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 700, skuName: "W", bottleQty: 10, unitPrice: 50 }]
    });
    const orderNo = create.data.data.orderNo;
    const r = await api("POST", `/api/admin/purchase-orders/${orderNo}/close`);
    expect(r.status).toBe(200);
    expect(r.data.data.orderStatus).toBe("CLOSED");
  });

  it("POST /payment 付款 - 金额更新", async () => {
    const create = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 800, skuName: "V", bottleQty: 10, unitPrice: 50.01 }]
    });
    const orderNo = create.data.data.orderNo;
    const r = await api("POST", `/api/admin/purchase-orders/${orderNo}/payment`, {
      payAmount: 500.10,
      payMethod: "BANK"
    });
    expect(r.status).toBe(200);
    expect(r.data.data.orderNo).toBe(orderNo);
    expect(Number(r.data.data.payAmount)).toBeCloseTo(500.10, 2);
  });

  it("GET/:nonexistent 不存在的订单返回 404", async () => {
    const r = await api("GET", "/api/admin/purchase-orders/PO-NOT-EXIST");
    expect(r.status).toBe(404);
  });

  it("边界: 金额精度 0.01 元", async () => {
    const r = await api("POST", "/api/admin/purchase-orders", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 900, skuName: "测试精度", bottleQty: 1, unitPrice: 99.99 }]
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.data.payableAmount)).toBeCloseTo(99.99, 2);
  });
});
