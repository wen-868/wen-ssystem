process.env.USE_MOCK_DB = "true";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18769";
let server: http.Server;

function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: any; duration: number }> {
  return new Promise((resolve) => {
    const url = base + path;
    const start = Date.now();
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
        const duration = Date.now() - start;
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data || "{}"), duration });
        } catch {
          resolve({ status: res.statusCode || 0, data: null, duration });
        }
      });
    });
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

beforeAll(async () => {
  server = http.createServer(app).listen(18769);
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  resetMockDb();
});

async function seedProducts(count: number) {
  const results = [];
  for (let i = 1; i <= count; i++) {
    const r = await api("POST", "/api/admin/products", {
      name: `性能测试商品${i}`,
      categoryId: 1,
      mainImage: "https://dummyimage.com/120x120/9b1c31/ffffff&text=Wine",
      skus: [
        {
          skuName: `性能测试商品${i} 常温`,
          barcode: `69${String(i).padStart(11, '0')}`,
          boxRatio: 6,
          temperature: "NORMAL",
          traceEnabled: false,
          warningThreshold: 10,
          costPrice: 50 + i,
          retailPrice: 99 + i,
          wholesalePrice: 80 + i,
          miniappPrice: 89 + i
        }
      ]
    });
    results.push(r);
  }
  return results;
}

describe("S401 - 性能测试", () => {
  describe("接口响应时间测试", () => {
    it("商品列表查询 - 响应时间应 < 500ms", async () => {
      await seedProducts(50);
      const result = await api("GET", "/api/admin/products?pageSize=20&page=1");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.duration).toBeLessThan(500);
    });

    it("门店列表查询 - 响应时间应 < 200ms", async () => {
      const result = await api("GET", "/api/admin/stores");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.duration).toBeLessThan(200);
    });

    it("库存余额查询 - 响应时间应 < 500ms", async () => {
      await seedProducts(30);
      const result = await api("GET", "/api/admin/inventory/balances?pageSize=20&page=1");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.duration).toBeLessThan(500);
    });

    it("仪表盘统计 - 响应时间应 < 500ms", async () => {
      const result = await api("GET", "/api/admin/reports/dashboard");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.duration).toBeLessThan(500);
    });

    it("采购订单列表查询 - 响应时间应 < 500ms", async () => {
      const result = await api("GET", "/api/admin/purchase-orders?pageSize=20&page=1");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.duration).toBeLessThan(500);
    });

    it("库存预警查询 - 响应时间应 < 300ms", async () => {
      const result = await api("GET", "/api/admin/inventory/alerts");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.duration).toBeLessThan(300);
    });
  });

  describe("并发请求测试", () => {
    it("10个并发商品查询 - 全部成功且响应 < 1s", async () => {
      await seedProducts(30);
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(api("GET", "/api/admin/products?pageSize=10&page=1"));
      }
      const results = await Promise.all(promises);
      for (const r of results) {
        expect(r.status).toBe(200);
        expect(r.data.code).toBe("0");
        expect(r.duration).toBeLessThan(1000);
      }
    });

    it("5个并发创建采购订单 - 全部成功且单号不重复", async () => {
      await seedProducts(10);
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(api("POST", "/api/admin/purchase-orders", {
          supplierId: 1,
          storeId: 1,
          items: [
            { skuId: 1, skuName: "测试商品", bottleQty: 100, unitPrice: 50.00 }
          ]
        }));
      }
      const results = await Promise.all(promises);
      const orderNos = new Set();
      for (const r of results) {
        expect(r.status).toBe(200);
        expect(r.data.code).toBe("0");
        orderNos.add(r.data.data.orderNo);
      }
      expect(orderNos.size).toBe(5);
    });

    it("10个并发仪表盘查询 - 全部成功", async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(api("GET", "/api/admin/reports/dashboard"));
      }
      const results = await Promise.all(promises);
      for (const r of results) {
        expect(r.status).toBe(200);
        expect(r.data.code).toBe("0");
        expect(r.duration).toBeLessThan(1000);
      }
    });
  });

  describe("大数据量测试", () => {
    it("100条商品数据 - 分页查询正常", async () => {
      await seedProducts(100);
      const result = await api("GET", "/api/admin/products?pageSize=50&page=2");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.data.data.total).toBeGreaterThanOrEqual(100);
      expect(Array.isArray(result.data.data.records)).toBe(true);
      expect(result.duration).toBeLessThan(1000);
    });

    it("关键字搜索大数据量 - 响应时间 < 500ms", async () => {
      await seedProducts(100);
      const result = await api("GET", "/api/admin/products?keyword=性能测试商品1&pageSize=20&page=1");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.duration).toBeLessThan(500);
    });

    it("采购订单列表 - 空数据快速响应", async () => {
      const result = await api("GET", "/api/admin/purchase-orders?pageSize=20&page=1");
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.duration).toBeLessThan(200);
    });
  });
});
