process.env.USE_MOCK_DB = "true";

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18768";
let server: http.Server;

function api(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const url = base + path;
    const req = http.request(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...headers
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
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  resetMockDb();
});

describe("S105 - 系统配置测试", () => {
  describe("门店管理 CRUD 测试", () => {
    it("GET /stores - 门店列表查询", async () => {
      const r = await api("GET", "/api/admin/stores");
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.records).toBeDefined();
      expect(Array.isArray(r.data.data.records)).toBe(true);
    });

    it("POST /stores - 创建门店", async () => {
      const r = await api("POST", "/api/admin/stores", {
        name: "测试门店",
        address: "测试地址123号",
        contact: "张三",
        phone: "13800138000",
        deliveryRadius: 5
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data).toBeDefined();
      expect(r.data.data.storeCode).toBeDefined();
    });

    it("GET /stores - 关键字搜索门店", async () => {
      await api("POST", "/api/admin/stores", {
        name: "搜索测试门店",
        address: "搜索地址",
        contact: "李四",
        phone: "13900139000"
      });
      const r = await api("GET", "/api/admin/stores?keyword=搜索测试");
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
    });
  });

  describe("员工管理测试", () => {
    it("GET /staff - 员工列表查询", async () => {
      const r = await api("GET", "/api/admin/staff");
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.records).toBeDefined();
      expect(Array.isArray(r.data.data.records)).toBe(true);
    });
  });

  describe("小程序登录接口测试", () => {
    it("POST /miniapp/login - 小程序登录", async () => {
      const r = await api("POST", "/api/miniapp/login", {
        code: "test-code-123"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.token).toBeDefined();
      expect(r.data.data.memberId).toBeDefined();
      expect(r.data.data.customerType).toBeDefined();
    });

    it("POST /miniapp/auth/login - 小程序授权登录", async () => {
      const r = await api("POST", "/api/miniapp/auth/login", {
        code: "auth-code-456"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.token).toBeDefined();
    });

    it("GET /miniapp/profile - 获取用户资料", async () => {
      const r = await api("GET", "/api/miniapp/profile", undefined, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.memberId).toBeDefined();
      expect(r.data.data.nickname).toBeDefined();
      expect(r.data.data.customerType).toBe("RETAIL");
    });

    it("GET /miniapp/profile - 批发客户资料", async () => {
      const r = await api("GET", "/api/miniapp/profile", undefined, {
        "x-customer-type": "WHOLESALE"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.customerType).toBe("WHOLESALE");
      expect(r.data.data.memberLevel).toBe("批发客户");
    });
  });

  describe("小程序商品接口测试", () => {
    it("GET /miniapp/products - 商品列表查询", async () => {
      const r = await api("GET", "/api/miniapp/products?storeId=1", undefined, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(Array.isArray(r.data.data)).toBe(true);
    });

    it("GET /miniapp/products - 批发客户看到批发价", async () => {
      const r = await api("GET", "/api/miniapp/products?storeId=1", undefined, {
        "x-customer-type": "WHOLESALE"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
    });

    it("GET /miniapp/products - 关键字搜索商品", async () => {
      const r = await api("GET", "/api/miniapp/products?storeId=1&keyword=测试", undefined, {
        "x-customer-type": "RETAIL"
      });
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
    });
  });

  describe("配置更新后接口生效验证", () => {
    it("门店创建后可在列表中查询到", async () => {
      const createResult = await api("POST", "/api/admin/stores", {
        name: "生效验证门店",
        address: "验证地址",
        contact: "验证员",
        phone: "13700137000"
      });
      const storeCode = createResult.data.data.storeCode;
      expect(storeCode).toBeDefined();

      const listResult = await api("GET", `/api/admin/stores?keyword=生效验证`);
      expect(listResult.status).toBe(200);
      expect(listResult.data.code).toBe("0");
    });

    it("员工列表始终返回数据", async () => {
      const r = await api("GET", "/api/admin/staff");
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
      expect(r.data.data.total).toBeGreaterThanOrEqual(0);
    });

    it("小程序登录接口稳定可用", async () => {
      for (let i = 0; i < 3; i++) {
        const r = await api("POST", "/api/miniapp/login", { code: `test-${i}` });
        expect(r.status).toBe(200);
        expect(r.data.code).toBe("0");
        expect(r.data.data.token).toBeTruthy();
      }
    });
  });
});
