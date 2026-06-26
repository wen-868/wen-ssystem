import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { adminRouter } from "../routes/admin.routes.js";
import { signToken } from "../shared/auth.js";

process.env.USE_MOCK_DB = "true";
process.env.JWT_SECRET = "test-secret";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || 500).json({ code: String(err.status || 500), message: err.message });
  });
  return app;
}

let BASE: string;
let TOKEN: string;
let server: any;

beforeAll(async () => {
  TOKEN = signToken({ id: 1, username: "admin", roles: ["SUPER_ADMIN"], storeId: 1 });
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      BASE = `http://127.0.0.1:${addr.port}/api/admin`;
      resolve();
    });
  });
});

afterAll(() => {
  if (server) server.close();
});

async function api(method: string, path: string, body?: unknown) {
  const opts: any = { method, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  return { status: r.status, data: await r.json() };
}

/** 创建供应商并返回 supplierId */
async function createTestSupplier(name: string) {
  const r = await api("POST", "/suppliers", {
    name,
    contacts: [{ name: `${name}联系人`, mobile: `1380000${String(Math.random()).slice(2, 10)}`, isPrimary: true }],
  });
  expect(r.status).toBe(200);
  return r.data.data?.supplierId || r.data.data?.id;
}

describe("采购入库集成测试", () => {
  it("POST 创建入库单 - 正常流程", async () => {
    const supplierId = await createTestSupplier("入库测试供应商");
    const r = await api("POST", "/purchase-in-stocks", {
      supplierId,
      storeId: 1,
      remark: "测试入库",
      items: [
        { skuId: 201, skuName: "白酒X", actualQty: 100, unitPrice: 30, subtotalAmount: 3000 },
        { skuId: 202, skuName: "啤酒Y", actualQty: 200, unitPrice: 10, subtotalAmount: 2000 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.stockNo).toBeDefined();
  });

  it("GET 入库单列表", async () => {
    const r = await api("GET", "/purchase-in-stocks");
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.records).toBeDefined();
    expect(r.data.data.total).toBeGreaterThanOrEqual(0);
  });

  it("GET 入库单详情 - 按 ID 查询", async () => {
    const supplierId = await createTestSupplier("详情测试供应商");
    const created = await api("POST", "/purchase-in-stocks", {
      supplierId,
      storeId: 1,
      items: [{ skuId: 301, skuName: "红酒Z", actualQty: 50, unitPrice: 100, subtotalAmount: 5000 }],
    });
    const stockId = created.data.data?.id;
    expect(stockId).toBeDefined();

    const r = await api("GET", `/purchase-in-stocks/${stockId}`);
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.stockNo).toBeDefined();
    expect(r.data.data.items).toBeDefined();
    expect(r.data.data.items.length).toBe(1);
    expect(r.data.data.items[0].skuName).toBe("红酒Z");
  });

  it("GET 入库单详情 - 按 stockNo 查询", async () => {
    const r = await api("GET", "/purchase-in-stocks");
    const records = r.data.data?.records || [];
    if (records.length > 0) {
      const stockNo = records[0].stockNo;
      const detail = await api("GET", `/purchase-in-stocks/${stockNo}`);
      expect(detail.status).toBe(200);
      expect(detail.data.code).toBe("0");
      expect(detail.data.data.stockNo).toBe(stockNo);
    }
  });

  it("POST 审核入库单 - 状态变更为 AUDITED", async () => {
    const supplierId = await createTestSupplier("审核测试供应商");
    const created = await api("POST", "/purchase-in-stocks", {
      supplierId,
      storeId: 1,
      items: [{ skuId: 401, skuName: "白酒W", actualQty: 30, unitPrice: 80, subtotalAmount: 2400 }],
    });
    const stockId = created.data.data?.id;
    expect(stockId).toBeDefined();

    const r = await api("POST", `/purchase-in-stocks/${stockId}/approve`);
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");

    const detail = await api("GET", `/purchase-in-stocks/${stockId}`);
    expect(detail.data.data.stockStatus).toBe("AUDITED");
  });

  it("POST 审核入库单 - 重复审核应失败", async () => {
    const r = await api("GET", "/purchase-in-stocks");
    const audited = (r.data.data?.records || []).find((s: any) => s.stockStatus === "AUDITED");
    if (audited) {
      const approve = await api("POST", `/purchase-in-stocks/${audited.id}/approve`);
      expect(approve.status).toBe(400);
    }
  });

  it("POST 作废入库单 - 状态变更为 VOID", async () => {
    const supplierId = await createTestSupplier("作废测试供应商");
    const created = await api("POST", "/purchase-in-stocks", {
      supplierId,
      storeId: 1,
      items: [{ skuId: 501, skuName: "白酒V", actualQty: 20, unitPrice: 60, subtotalAmount: 1200 }],
    });
    const stockId = created.data.data?.id;
    expect(stockId).toBeDefined();

    await api("POST", `/purchase-in-stocks/${stockId}/approve`);

    const r = await api("POST", `/purchase-in-stocks/${stockId}/void`);
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");

    const detail = await api("GET", `/purchase-in-stocks/${stockId}`);
    expect(detail.data.data.stockStatus).toBe("VOID");
  });
});

describe("采购退货集成测试", () => {
  it("POST 创建采购退货单", async () => {
    const supplierId = await createTestSupplier("退货测试供应商");
    const r = await api("POST", "/purchase-returns", {
      supplierId,
      storeId: 1,
      remark: "测试退货",
      items: [
        { skuId: 601, skuName: "退货商品A", bottleQty: 5, totalBottleQty: 5, unitPrice: 50, reason: "质量问题" },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.returnNo).toBeDefined();
  });

  it("GET 采购退货列表", async () => {
    const r = await api("GET", "/purchase-returns");
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.records).toBeDefined();
  });
});

describe("供应商 CRUD 集成测试", () => {
  it("POST 创建供应商 - 含联系人", async () => {
    const r = await api("POST", "/suppliers", {
      name: "CRUD测试供应商",
      shortName: "CRUD",
      category: "GENERAL",
      address: "测试地址",
      settlementType: "CASH",
      contacts: [
        { name: "主联系人", mobile: "13800000020", isPrimary: true },
        { name: "副联系人", mobile: "13800000021", isPrimary: false },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.supplierId).toBeDefined();
  });

  it("GET 供应商列表", async () => {
    const r = await api("GET", "/suppliers");
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.records).toBeDefined();
    expect(r.data.data.total).toBeGreaterThan(0);
  });

  it("GET 供应商详情 - 包含联系人", async () => {
    const list = await api("GET", "/suppliers");
    const first = list.data.data.records[0];
    const r = await api("GET", `/suppliers/${first.id}`);
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.contacts).toBeDefined();
  });

  it("PUT 修改供应商", async () => {
    const list = await api("GET", "/suppliers");
    const first = list.data.data.records[0];
    const r = await api("PUT", `/suppliers/${first.id}`, {
      name: "修改后名称",
      category: "BAIJIU",
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");

    const detail = await api("GET", `/suppliers/${first.id}`);
    expect(detail.data.data.name).toBe("修改后名称");
  });

  it("GET 供应商采购订单", async () => {
    const list = await api("GET", "/suppliers");
    const first = list.data.data.records[0];
    const r = await api("GET", `/suppliers/${first.id}/purchase-orders`);
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
  });

  it("GET 供应商绩效统计", async () => {
    const list = await api("GET", "/suppliers");
    const first = list.data.data.records[0];
    const r = await api("GET", `/suppliers/${first.id}/stats`);
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.supplierId).toBeDefined();
  });
});
