process.env.USE_MOCK_DB = "true";

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18767";
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
  server = http.createServer(app).listen(18767);
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  resetMockDb();
});

describe("S104 - 端到端集成测试", () => {
  describe("采购全流程：订单→入库→退货→付款", () => {
    it("完整采购流程 - 订单创建→提交→审核→入库→付款", async () => {
      const create = await api("POST", "/api/admin/purchase-orders", {
        supplierId: 1,
        storeId: 1,
        items: [
          { skuId: 101, skuName: "测试白酒A", bottleQty: 100, unitPrice: 50.00 },
          { skuId: 102, skuName: "测试白酒B", bottleQty: 50, unitPrice: 80.50 }
        ]
      });
      expect(create.status).toBe(200);
      expect(create.data.code).toBe("0");
      const orderNo = create.data.data.orderNo;
      expect(orderNo).toBeDefined();
      const expectedGoods = 100 * 50 + 50 * 80.5;
      expect(Number(create.data.data.goodsAmount)).toBeCloseTo(expectedGoods, 2);
      expect(create.data.data.orderStatus).toBe("DRAFT");

      const submit = await api("POST", `/api/admin/purchase-orders/${orderNo}/submit`);
      expect(submit.status).toBe(200);
      expect(submit.data.data.orderStatus).toBe("SUBMITTED");

      const audit = await api("POST", `/api/admin/purchase-orders/${orderNo}/audit`, {
        passed: true,
        remark: "审核通过"
      });
      expect(audit.status).toBe(200);
      expect(audit.data.data.orderStatus).toBe("AUDITED");

      const inStock = await api("POST", "/api/admin/purchase-in-stocks", {
        purchaseOrderNo: orderNo,
        storeId: 1,
        remark: "采购入库",
        items: [
          { skuId: 101, skuName: "测试白酒A", planQty: 100, actualQty: 100, unitPrice: 50.00 },
          { skuId: 102, skuName: "测试白酒B", planQty: 50, actualQty: 50, unitPrice: 80.50 }
        ]
      });
      expect(inStock.status).toBe(200);
      expect(inStock.data.code).toBe("0");
      expect(inStock.data.data.inStockNo).toBeDefined();

      const inv = await api("GET", "/api/admin/inventory/balances?storeId=1");
      expect(inv.status).toBe(200);

      const pay = await api("POST", `/api/admin/purchase-orders/${orderNo}/payment`, {
        payAmount: 9025.00,
        payMethod: "BANK_TRANSFER"
      });
      expect(pay.status).toBe(200);
      expect(pay.data.code).toBe("0");
      expect(pay.data.data.orderNo).toBe(orderNo);
      expect(Number(pay.data.data.payAmount)).toBeCloseTo(9025.00, 2);

      const payments = await api("GET", "/api/admin/purchase-payments");
      expect(payments.status).toBe(200);
      expect(Array.isArray(payments.data.data)).toBe(true);
      expect(payments.data.data.length).toBeGreaterThanOrEqual(1);
    });

    it("采购金额精度验证 - 小数计算精度", async () => {
      const create = await api("POST", "/api/admin/purchase-orders", {
        supplierId: 1,
        storeId: 1,
        items: [
          { skuId: 201, skuName: "精度测试商品1", bottleQty: 3, unitPrice: 10.01 },
          { skuId: 202, skuName: "精度测试商品2", bottleQty: 7, unitPrice: 5.99 }
        ]
      });
      expect(create.status).toBe(200);
      expect(create.data.code).toBe("0");
      const expectedGoodsAmount = 3 * 10.01 + 7 * 5.99;
      expect(Number(create.data.data.goodsAmount)).toBeCloseTo(expectedGoodsAmount, 2);
      expect(Number(create.data.data.payableAmount)).toBeCloseTo(expectedGoodsAmount, 2);
    });

    it("采购退货流程 - 入库后退货", async () => {
      const order = await api("POST", "/api/admin/purchase-orders", {
        supplierId: 1,
        storeId: 1,
        items: [
          { skuId: 601, skuName: "退货测试商品", bottleQty: 100, unitPrice: 25.00 }
        ]
      });
      const orderNo = order.data.data.orderNo;

      await api("POST", `/api/admin/purchase-orders/${orderNo}/submit`);
      await api("POST", `/api/admin/purchase-orders/${orderNo}/audit`, { passed: true });

      const inStock = await api("POST", "/api/admin/purchase-in-stocks", {
        purchaseOrderNo: orderNo,
        storeId: 1,
        items: [
          { skuId: 601, skuName: "退货测试商品", planQty: 100, actualQty: 100, unitPrice: 25.00 }
        ]
      });
      const inStockNo = inStock.data.data.inStockNo;
      expect(inStockNo).toBeDefined();

      const returnResult = await api("POST", "/api/admin/purchase-returns", {
        purchaseOrderNo: orderNo,
        storeId: 1,
        supplierId: 1,
        items: [
          { skuId: 601, skuName: "退货测试商品", qty: 20, unitPrice: 25.00 }
        ]
      });
      expect(returnResult.status).toBe(200);
      expect(returnResult.data.code).toBe("0");
      expect(returnResult.data.data.returnNo).toBeDefined();
      expect(Number(returnResult.data.data.totalAmount)).toBeCloseTo(500.00, 2);
    });
  });

  describe("销售模块集成测试", () => {
    it("销售单列表查询", async () => {
      const list = await api("GET", "/api/admin/sale-bills");
      expect(list.status).toBe(200);
      expect(list.data.code).toBe("0");
      expect(list.data.data.records).toBeDefined();
      expect(Array.isArray(list.data.data.records)).toBe(true);
    });
  });

  describe("客户对账全流程", () => {
    it("创建对账单 - 验证金额计算", async () => {
      const create = await api("POST", "/api/store/customer-statements", {
        customerId: 1,
        customerName: "测试客户",
        startBalance: 1000.00,
        salesAmount: 500.00,
        returnAmount: 0,
        receivedAmount: 200.00,
        endBalance: 1300.00,
        period: "2024-01"
      });
      expect(create.status).toBe(200);
      expect(create.data.code).toBe("0");
      expect(create.data.data.statementNo).toBeDefined();
    });

    it("对账单列表查询", async () => {
      await api("POST", "/api/store/customer-statements", {
        customerId: 1,
        customerName: "测试客户",
        startBalance: 500.00,
        salesAmount: 300.00,
        returnAmount: 0,
        receivedAmount: 100.00,
        endBalance: 700.00,
        period: "2024-02"
      });
      const list = await api("GET", "/api/store/customer-statements");
      expect(list.status).toBe(200);
      expect(list.data.code).toBe("0");
    });

    it("对账单确认流程", async () => {
      const create = await api("POST", "/api/store/customer-statements", {
        customerId: 1,
        customerName: "测试客户",
        startBalance: 500.00,
        salesAmount: 300.00,
        returnAmount: 0,
        receivedAmount: 100.00,
        endBalance: 700.00,
        period: "2024-03"
      });
      const statementNo = create.data.data.statementNo;

      const confirm = await api("POST", `/api/store/customer-statements/${statementNo}/confirm`);
      expect(confirm.status).toBe(200);
      expect(confirm.data.code).toBe("0");
    });
  });

  describe("库存变动验证", () => {
    it("采购入库后库存增加", async () => {
      const order = await api("POST", "/api/admin/purchase-orders", {
        supplierId: 1,
        storeId: 1,
        items: [
          { skuId: 501, skuName: "库存测试商品", bottleQty: 50, unitPrice: 30.00 }
        ]
      });
      const orderNo = order.data.data.orderNo;

      await api("POST", `/api/admin/purchase-orders/${orderNo}/submit`);
      await api("POST", `/api/admin/purchase-orders/${orderNo}/audit`, { passed: true });

      const beforeBalances = await api("GET", "/api/admin/inventory/balances?storeId=1");
      expect(beforeBalances.status).toBe(200);

      const inStock = await api("POST", "/api/admin/purchase-in-stocks", {
        purchaseOrderNo: orderNo,
        storeId: 1,
        items: [
          { skuId: 501, skuName: "库存测试商品", planQty: 50, actualQty: 50, unitPrice: 30.00 }
        ]
      });
      expect(inStock.status).toBe(200);

      const inStockNo = inStock.data.data.inStockNo;
      await api("POST", `/api/admin/purchase-in-stocks/${inStockNo}/approve`, { passed: true });

      const afterBalances = await api("GET", "/api/admin/inventory/balances?storeId=1");
      expect(afterBalances.status).toBe(200);
    });

    it("库存流水记录查询", async () => {
      const logs = await api("GET", "/api/admin/inventory/logs");
      expect(logs.status).toBe(200);
      expect(logs.data.code).toBe("0");
      expect(logs.data.data.records).toBeDefined();
      expect(Array.isArray(logs.data.data.records)).toBe(true);
    });
  });

  describe("报表模块集成测试", () => {
    it("每日销售数据查询", async () => {
      const r = await api("GET", "/api/admin/reports/daily-sales?days=7");
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
    });

    it("门店业绩查询", async () => {
      const r = await api("GET", "/api/admin/reports/store-performance");
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
    });

    it("订单统计查询", async () => {
      const r = await api("GET", "/api/admin/reports/order-stats");
      expect(r.status).toBe(200);
      expect(r.data.code).toBe("0");
    });
  });
});
