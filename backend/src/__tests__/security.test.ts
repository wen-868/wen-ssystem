process.env.USE_MOCK_DB = "true";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const adminToken = signToken({ id: 1, username: "admin", roles: ["ADMIN"], storeId: 1 });
const staffToken = signToken({ id: 2, username: "staff", roles: ["STAFF"], storeId: 1 });
const base = "http://127.0.0.1:18770";
let server: http.Server;

function api(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const url = base + path;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const req = http.request(url, { method, headers }, (res) => {
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
  server = http.createServer(app).listen(18770);
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  resetMockDb();
});

describe("S402 - 安全测试", () => {
  describe("认证与权限测试", () => {
    it("未携带Token访问受保护接口 - 返回401", async () => {
      const result = await api("GET", "/api/admin/stores");
      expect(result.status).toBe(401);
    });

    it("无效Token访问接口 - 返回401", async () => {
      const result = await api("GET", "/api/admin/stores", undefined, "invalid-token");
      expect(result.status).toBe(401);
    });

    it("空Token访问接口 - 返回401", async () => {
      const result = await api("GET", "/api/admin/stores", undefined, "");
      expect(result.status).toBe(401);
    });

    it("管理员Token可访问管理员接口 - 返回200", async () => {
      const result = await api("GET", "/api/admin/stores", undefined, adminToken);
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
    });

    it("员工Token可访问管理员接口 - 返回200", async () => {
      const result = await api("GET", "/api/admin/stores", undefined, staffToken);
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
    });

    it("登录接口 - 正确密码返回Token", async () => {
      const result = await api("POST", "/api/admin/auth/login", {
        username: "admin",
        password: "admin123"
      });
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.data.data.token).toBeDefined();
    });

    it("登录接口 - 错误密码返回401", async () => {
      const result = await api("POST", "/api/admin/auth/login", {
        username: "admin",
        password: "wrongpassword"
      });
      expect(result.status).toBe(401);
    });

    it("登录接口 - 不存在的用户返回401", async () => {
      const result = await api("POST", "/api/admin/auth/login", {
        username: "nonexistent",
        password: "admin123"
      });
      expect(result.status).toBe(401);
    });
  });

  describe("输入安全测试", () => {
    it("SQL注入测试 - 商品搜索关键字包含SQL注入", async () => {
      const result = await api(
        "GET",
        "/api/admin/products?keyword=' OR '1'='1&pageSize=10&page=1",
        undefined,
        adminToken
      );
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.data.data.total).toBeGreaterThanOrEqual(0);
    });

    it("SQL注入测试 - 登录用户名包含SQL注入", async () => {
      const result = await api("POST", "/api/admin/auth/login", {
        username: "admin' OR '1'='1",
        password: "anypassword"
      });
      expect(result.status).toBe(401);
    });

    it("XSS测试 - 商品名称包含HTML标签", async () => {
      const result = await api("POST", "/api/admin/products", {
        name: "<script>alert('xss')</script>测试商品",
        categoryId: 1,
        skus: [
          {
            skuName: "测试SKU",
            barcode: "6900000000001",
            boxRatio: 6,
            retailPrice: 99
          }
        ]
      }, adminToken);
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      const listResult = await api("GET", "/api/admin/products?pageSize=10&page=1", undefined, adminToken);
      expect(listResult.status).toBe(200);
      expect(listResult.data.code).toBe("0");
    });

    it("特殊字符测试 - 商品名称包含特殊字符", async () => {
      const result = await api("POST", "/api/admin/products", {
        name: "特殊字符测试!@#$%^&*()_+-=[]{}|;':\",./<>?",
        categoryId: 1,
        skus: [
          {
            skuName: "SKU特殊字符!@#$",
            barcode: "6900000000002",
            boxRatio: 6,
            retailPrice: 99
          }
        ]
      }, adminToken);
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
    });

    it("超长字符串测试 - 商品名称超长", async () => {
      const longName = "a".repeat(1000);
      const result = await api("POST", "/api/admin/products", {
        name: longName,
        categoryId: 1,
        skus: [
          {
            skuName: "测试SKU",
            barcode: "6900000000003",
            boxRatio: 6,
            retailPrice: 99
          }
        ]
      }, adminToken);
      expect([200, 400]).toContain(result.status);
    });
  });

  describe("敏感数据保护测试", () => {
    it("用户信息不返回密码字段", async () => {
      const result = await api("GET", "/api/admin/auth/me", undefined, adminToken);
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      expect(result.data.data.password).toBeUndefined();
      expect(result.data.data.passwordHash).toBeUndefined();
      expect(result.data.data.password_hash).toBeUndefined();
    });

    it("员工列表不返回密码字段", async () => {
      const result = await api("GET", "/api/admin/staff", undefined, adminToken);
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
      if (result.data.data.records && result.data.data.records.length > 0) {
        const staff = result.data.data.records[0];
        expect(staff.password).toBeUndefined();
        expect(staff.passwordHash).toBeUndefined();
        expect(staff.password_hash).toBeUndefined();
      }
    });

    it("JWT Token格式正确", async () => {
      const loginResult = await api("POST", "/api/admin/auth/login", {
        username: "admin",
        password: "admin123"
      });
      const token = loginResult.data.data.token;
      expect(token).toBeDefined();
      const parts = token.split(".");
      expect(parts.length).toBe(3);
    });
  });

  describe("参数校验测试", () => {
    it("创建商品 - 缺少必填字段name返回400", async () => {
      const result = await api("POST", "/api/admin/products", {
        categoryId: 1,
        skus: [{ skuName: "测试", retailPrice: 99 }]
      }, adminToken);
      expect(result.status).toBe(400);
    });

    it("创建商品 - 价格为负数返回400", async () => {
      const result = await api("POST", "/api/admin/products", {
        name: "测试商品",
        categoryId: 1,
        skus: [{ skuName: "测试SKU", retailPrice: -10 }]
      }, adminToken);
      expect(result.status).toBe(400);
    });

    it("创建采购订单 - 缺少items返回400", async () => {
      const result = await api("POST", "/api/admin/purchase-orders", {
        supplierId: 1,
        storeId: 1,
        items: []
      }, adminToken);
      expect(result.status).toBe(400);
    });

    it("分页参数 - page为0应正常处理", async () => {
      const result = await api("GET", "/api/admin/products?page=0&pageSize=10", undefined, adminToken);
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
    });

    it("分页参数 - pageSize为负数应正常处理", async () => {
      const result = await api("GET", "/api/admin/products?page=1&pageSize=-10", undefined, adminToken);
      expect(result.status).toBe(200);
      expect(result.data.code).toBe("0");
    });
  });
});
