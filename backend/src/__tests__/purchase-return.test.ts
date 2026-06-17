import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";
import { query } from "../shared/db.js";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18768";
let server: http.Server;

function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const req = http.request(base + path, {
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
  server = http.createServer(app).listen(18768);
});

afterAll(async () => {
  server.close();
});

beforeEach(() => {
  resetMockDb();
});

describe("采购退货 /api/admin/purchase-returns", () => {
  it("POST 创建退货单 - 正常", async () => {
    const r = await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1,
      storeId: 1,
      items: [
        { skuId: 9001, skuName: "退货商品A", qty: 5, unitPrice: 100.00 }
      ]
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.returnNo).toBeDefined();
    expect(r.data.data.status).toBe("PENDING");
  });

  it("GET 退货单列表", async () => {
    await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 9002, skuName: "B", qty: 2, unitPrice: 50 }]
    });
    const r = await api("GET", "/api/admin/purchase-returns");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data.data)).toBe(true);
    expect(r.data.data.length).toBeGreaterThan(0);
  });

  it("GET /:returnNo 退货单详情 - 包含 items", async () => {
    const create = await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 9003, skuName: "C", qty: 3, unitPrice: 80 }]
    });
    const returnNo = create.data.data.returnNo;
    const r = await api("GET", `/api/admin/purchase-returns/${returnNo}`);
    expect(r.status).toBe(200);
    expect(r.data.data.returnNo).toBe(returnNo);
    expect(Array.isArray(r.data.data.items)).toBe(true);
    expect(r.data.data.items.length).toBe(1);
  });

  it("POST /approve 审核退货 - 状态变更为 AUDITED", async () => {
    const create = await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 9004, skuName: "D", qty: 4, unitPrice: 50 }]
    });
    const returnNo = create.data.data.returnNo;
    const r = await api("POST", `/api/admin/purchase-returns/${returnNo}/approve`);
    expect(r.status).toBe(200);
    expect(r.data.data.status).toBe("AUDITED");
    expect(r.data.data.stockRollbackFlag).toBe(1);
  });

  it("POST /void 作废退货单", async () => {
    const create = await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 9005, skuName: "E", qty: 1, unitPrice: 200 }]
    });
    const returnNo = create.data.data.returnNo;
    await api("POST", `/api/admin/purchase-returns/${returnNo}/approve`);

    const voidR = await api("POST", `/api/admin/purchase-returns/${returnNo}/void`);
    expect(voidR.status).toBe(200);
    expect(voidR.data.data.status).toBe("VOID");
  });

  it("边界: 金额精度 unitPrice=99.99, qty=3", async () => {
    const r = await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 9006, skuName: "F", qty: 3, unitPrice: 99.99 }]
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.data.totalAmount)).toBeCloseTo(299.97, 2);
  });

  it("GET 多商品退货", async () => {
    const r = await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1, storeId: 1,
      items: [
        { skuId: 9007, skuName: "G", qty: 2, unitPrice: 50 },
        { skuId: 9008, skuName: "H", qty: 1, unitPrice: 100 }
      ]
    });
    expect(Number(r.data.data.totalAmount)).toBeCloseTo(200, 2);
  });

  it("GET /:returnNo 不存在的单号 - 返回 404", async () => {
    const r = await api("GET", "/api/admin/purchase-returns/INVALID-NO");
    expect(r.status).toBe(404);
  });

  it("创建后 status 为 PENDING", async () => {
    const r = await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 9009, skuName: "I", qty: 1, unitPrice: 10 }]
    });
    expect(r.data.data.status).toBe("PENDING");
  });

  it("审核后详情查询 status=AUDITED", async () => {
    const create = await api("POST", "/api/admin/purchase-returns", {
      supplierId: 1, storeId: 1,
      items: [{ skuId: 9010, skuName: "J", qty: 5, unitPrice: 20 }]
    });
    const returnNo = create.data.data.returnNo;
    await api("POST", `/api/admin/purchase-returns/${returnNo}/approve`);
    const detail = await api("GET", `/api/admin/purchase-returns/${returnNo}`);
    expect(detail.status).toBe(200);
    expect(detail.data.data.status).toBe("AUDITED");
  });
});
