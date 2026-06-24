import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

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

describe("供应商管理 /api/admin/suppliers", () => {
  it("创建供应商 - 正常流程", async () => {
    const r = await api("POST", "/api/admin/suppliers", {
      name: "测试白酒供应商A",
      shortName: "测试供应商",
      category: "BRAND",
      address: "成都市高新区",
      creditLevel: "A",
      settlementType: "MONTHLY",
      taxRate: 13,
      remark: "新增测试",
      contacts: [
        { name: "张经理", mobile: "13800000001", isPrimary: true, position: "采购经理" }
      ]
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.supplierCode).toBeDefined();
    expect(r.data.data.supplierCode).toMatch(/^GYS/);
  });

  it("GET 供应商列表", async () => {
    await api("POST", "/api/admin/suppliers", {
      name: "列表测试供应商",
      category: "WHOLESALER",
      creditLevel: "B",
      settlementType: "CASH"
    });
    const r = await api("GET", "/api/admin/suppliers");
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(Array.isArray(r.data.data.records)).toBe(true);
    expect(r.data.data.records.length).toBeGreaterThan(0);
  });

  it("GET /:id 供应商详情 - 包含联系人", async () => {
    const create = await api("POST", "/api/admin/suppliers", {
      name: "详情测试供应商",
      category: "BRAND",
      creditLevel: "A",
      settlementType: "MONTHLY",
      contacts: [
        { name: "李总", mobile: "13900000001", isPrimary: true },
        { name: "王助理", mobile: "13900000002", isPrimary: false }
      ]
    });
    const supplierId = create.data.data.supplierId;
    const r = await api("GET", `/api/admin/suppliers/${supplierId}`);
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.supplierId).toBe(supplierId);
    expect(Array.isArray(r.data.data.contacts)).toBe(true);
  });

  it("PUT 修改供应商 - 更新基本信息", async () => {
    const create = await api("POST", "/api/admin/suppliers", {
      name: "待更新供应商",
      category: "BRAND",
      creditLevel: "B",
      settlementType: "CASH"
    });
    const supplierId = create.data.data.supplierId;
    const update = await api("PUT", `/api/admin/suppliers/${supplierId}`, {
      name: "更新后的供应商名称",
      creditLevel: "A",
      settlementType: "MONTHLY"
    });
    expect(update.status).toBe(200);
    expect(update.data.code).toBe("0");
    expect(update.data.data.name).toBe("更新后的供应商名称");
    expect(update.data.data.creditLevel).toBe("A");
  });

  it("供应商状态切换 - 启用/禁用", async () => {
    const create = await api("POST", "/api/admin/suppliers", {
      name: "状态测试供应商",
      category: "BRAND",
      creditLevel: "A",
      settlementType: "CASH"
    });
    const supplierId = create.data.data.supplierId;
    const update = await api("PUT", `/api/admin/suppliers/${supplierId}`, {
      status: 0
    });
    expect(update.status).toBe(200);
    expect(update.data.data.status).toBe(0);
  });

  it("关键字搜索供应商", async () => {
    await api("POST", "/api/admin/suppliers", {
      name: "搜索测试供应商A",
      category: "BRAND",
      creditLevel: "A",
      settlementType: "CASH"
    });
    await api("POST", "/api/admin/suppliers", {
      name: "搜索测试供应商B",
      category: "WHOLESALER",
      creditLevel: "B",
      settlementType: "MONTHLY"
    });
    const r = await api("GET", "/api/admin/suppliers?keyword=测试供应商A");
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.records.length).toBeGreaterThanOrEqual(1);
  });

  it("按分类筛选供应商", async () => {
    await api("POST", "/api/admin/suppliers", {
      name: "品牌供应商",
      category: "BRAND",
      creditLevel: "A",
      settlementType: "CASH"
    });
    const r = await api("GET", "/api/admin/suppliers?category=BRAND");
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.records.length).toBeGreaterThanOrEqual(1);
  });
});
