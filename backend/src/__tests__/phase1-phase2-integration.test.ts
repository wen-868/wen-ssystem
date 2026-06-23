/**
 * 第一阶段 & 第二阶段新增功能集成测试
 * 测试范围：供应商管理、采购管理、客户管理扩展、销售退货、客户对账/付款
 *
 * 测试方法：启动真实 Express 服务器 + USE_MOCK_DB=true 模拟数据库
 */
import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import http from "node:http";
import express from "express";
import { adminRouter } from "../routes/admin.routes.js";
import { signToken } from "../shared/auth.js";
import { env } from "../shared/env.js";

// ====== 辅助工具 ======

const token = signToken({ id: 1, username: "admin", roles: ["SUPER_ADMIN"], storeId: 1 });
const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const noAuthHeaders = { "Content-Type": "application/json" };

let server: http.Server;
let baseUrl: string;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  // 错误处理
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "服务器内部错误";
    res.status(status).json({ code: String(status), message });
  });
  return app;
}

function httpRequest(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = authHeaders
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, body: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

beforeAll(async () => {
  // 强制使用 mock DB
  process.env.USE_MOCK_DB = "true";

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      baseUrl = `http://${addr.address}:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ====== 供应商管理测试 ======
describe("供应商管理 API", () => {
  describe("GET /suppliers - 供应商列表", () => {
    it("未登录访问应返回 401", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/suppliers", undefined, noAuthHeaders);
      expect(status).toBe(401);
    });

    it("正常获取供应商列表（空数据）", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/suppliers");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
      expect(body.data.total).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(body.data.records)).toBe(true);
    });
  });

  describe("POST /suppliers - 新增供应商", () => {
    it("正常创建供应商（含联系人）", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/suppliers", {
        name: "测试酒业有限公司",
        shortName: "测试酒业",
        category: "LIQUOR",
        province: "贵州省",
        city: "遵义市",
        district: "仁怀市",
        address: "茅台镇测试路1号",
        creditLevel: "A",
        settlementType: "MONTHLY",
        taxRate: 13,
        remark: "测试供应商",
        contacts: [
          {
            name: "张三",
            mobile: "13800001111",
            isPrimary: true,
            position: "销售经理",
          },
        ],
      });
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.supplierId).toBeDefined();
      expect(body.data.supplierCode).toContain("GYS");
    });

    it("使用默认值创建供应商（仅必填字段）", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/suppliers", {
        name: "默认值供应商",
      });
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.supplierId).toBeDefined();
      expect(body.data.supplierCode).toContain("GYS");
    });
  });

  describe("GET /suppliers/:id - 供应商详情", () => {
    it("查询不存在的供应商应返回 404", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/suppliers/99999");
      expect(status).toBe(404);
      expect(body.message).toContain("供应商不存在");
    });
  });

  describe("PUT /suppliers/:id - 修改供应商", () => {
    it("修改不存在的供应商应返回 404", async () => {
      const { status, body } = await httpRequest("PUT", "/api/admin/suppliers/99999", { name: "新名称" });
      expect(status).toBe(404);
    });
  });

  describe("DELETE /suppliers/:id - 删除供应商", () => {
    it("删除不存在的供应商应返回 404", async () => {
      const { status, body } = await httpRequest("DELETE", "/api/admin/suppliers/99999");
      expect(status).toBe(404);
    });
  });

  describe("GET /suppliers/:id/purchase-orders - 供应商采购订单", () => {
    it("查询不存在的供应商的采购订单应返回空列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/suppliers/99999/purchase-orders");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.total).toBe(0);
    });
  });

  describe("GET /suppliers/:id/payments - 供应商付款记录", () => {
    it("查询不存在的供应商的付款记录应返回空列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/suppliers/99999/payments");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.total).toBe(0);
    });
  });

  describe("GET /suppliers/:id/products - 供应商供货商品", () => {
    it("查询不存在的供应商的供货商品应返回空列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/suppliers/99999/products");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.records).toBeDefined();
    });
  });

  describe("GET /suppliers/:id/stats - 供应商绩效统计", () => {
    it("查询不存在的供应商的绩效统计应返回零值", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/suppliers/99999/stats");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.totalOrders).toBe(0);
      expect(body.data.totalAmount).toBe(0);
      expect(body.data.onTimeRate).toBe(0);
    });
  });
});

// ====== 采购管理测试 ======
describe("采购管理 API", () => {
  describe("GET /purchase-orders - 采购订单列表", () => {
    it("未登录访问应返回 401", async () => {
      const { status } = await httpRequest("GET", "/api/admin/purchase-orders", undefined, noAuthHeaders);
      expect(status).toBe(401);
    });

    it("正常获取采购订单列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/purchase-orders");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.records)).toBe(true);
    });
  });

  describe("POST /purchase-orders - 新建采购订单", () => {
    it("供应商不存在时应返回 400", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/purchase-orders", {
        supplierId: 99999,
        storeId: 1,
        items: [{ skuId: 1, skuName: "测试商品", totalBottleQty: 10, unitPrice: 100 }],
      });
      expect(status).toBe(400);
      expect(body.message).toContain("供应商不存在");
    });

    it("缺少 items 或为空数组应返回验证错误", async () => {
      const { status } = await httpRequest("POST", "/api/admin/purchase-orders", {
        supplierId: 1,
        storeId: 1,
        items: [],
      });
      // Zod min(1) 验证失败会抛出异常，asyncHandler 捕获后返回 500
      expect(status).toBe(500);
    });
  });

  describe("GET /purchase-orders/:id - 采购订单详情", () => {
    it("查询不存在的采购订单应返回 404", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/purchase-orders/99999");
      expect(status).toBe(404);
      expect(body.message).toContain("采购订单不存在");
    });
  });

  describe("PUT /purchase-orders/:id - 修改采购订单", () => {
    it("修改不存在的采购订单应返回 404", async () => {
      const { status } = await httpRequest("PUT", "/api/admin/purchase-orders/99999", { remark: "修改备注" });
      expect(status).toBe(404);
    });
  });

  describe("DELETE /purchase-orders/:id - 取消采购订单", () => {
    it("取消不存在的采购订单应返回 404", async () => {
      const { status } = await httpRequest("DELETE", "/api/admin/purchase-orders/99999");
      expect(status).toBe(404);
    });
  });

  describe("POST /purchase-orders/:id/confirm - 确认采购订单", () => {
    it("确认不存在的采购订单应返回 404", async () => {
      const { status } = await httpRequest("POST", "/api/admin/purchase-orders/99999/confirm");
      expect(status).toBe(404);
    });
  });

  describe("POST /purchase-orders/:id/in-stock - 采购入库", () => {
    it("入库不存在的采购订单应返回 404", async () => {
      const { status } = await httpRequest("POST", "/api/admin/purchase-orders/99999/in-stock", {
        items: [{ skuId: 1, skuName: "测试商品", totalBottleQty: 10, unitPrice: 100 }],
      });
      expect(status).toBe(404);
    });
  });

  describe("GET /purchase-in-stocks - 入库单列表", () => {
    it("正常获取入库单列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/purchase-in-stocks");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
    });
  });

  describe("GET /purchase-in-stocks/:id - 入库单详情", () => {
    it("查询不存在的入库单应返回 404", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/purchase-in-stocks/99999");
      expect(status).toBe(404);
      expect(body.message).toContain("入库单不存在");
    });
  });

  describe("POST /purchase-returns - 采购退货", () => {
    it("供应商不存在时应返回 400", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/purchase-returns", {
        supplierId: 99999,
        storeId: 1,
        items: [{ skuId: 1, skuName: "测试商品", totalBottleQty: 5, unitPrice: 100 }],
      });
      expect(status).toBe(400);
      expect(body.message).toContain("供应商不存在");
    });
  });

  describe("GET /purchase-returns - 采购退货列表", () => {
    it("正常获取采购退货列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/purchase-returns");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
    });
  });
});

// ====== 客户管理扩展测试 ======
describe("客户管理扩展 API", () => {
  describe("GET /members/:id/sale-bills - 客户销售单", () => {
    it("未登录访问应返回 401", async () => {
      const { status } = await httpRequest("GET", "/api/admin/members/1/sale-bills", undefined, noAuthHeaders);
      expect(status).toBe(401);
    });

    it("正常获取客户销售单列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/members/1/sale-bills");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.records)).toBe(true);
    });
  });

  describe("GET /members/:id/payments - 客户回款记录", () => {
    it("正常获取客户回款记录", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/members/1/payments");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
    });
  });

  describe("GET /members/:id/statements - 客户对账单", () => {
    it("正常获取客户对账单列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/members/1/statements");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
    });
  });

  describe("GET /members/:id/stats - 客户购买统计", () => {
    it("正常获取客户购买统计", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/members/1/stats");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
      expect(body.data.memberId).toBe(1);
      expect(body.data.billCount).toBeDefined();
      expect(body.data.totalAmount).toBeDefined();
    });
  });

  describe("GET /members/stats - 客户列表统计", () => {
    it("正常获取客户列表统计", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/members/stats");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
      expect(typeof body.data.total).toBe("number");
      expect(typeof body.data.newThisMonth).toBe("number");
      expect(typeof body.data.activeCount).toBe("number");
      expect(typeof body.data.debtCount).toBe("number");
      expect(typeof body.data.totalReceivable).toBe("number");
    });
  });
});

// ====== 销售退货测试 ======
describe("销售退货 API", () => {
  describe("POST /sale-returns - 新建销售退货单", () => {
    it("未登录访问应返回 401", async () => {
      const { status } = await httpRequest(
        "POST",
        "/api/admin/sale-returns",
        { storeId: 1, items: [{ skuId: 1, skuName: "测试", totalBottleQty: 1, unitPrice: 100 }] },
        noAuthHeaders
      );
      expect(status).toBe(401);
    });

    it("正常创建销售退货单", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/sale-returns", {
        storeId: 1,
        customerId: 1,
        customerName: "测试客户",
        customerMobile: "13900000000",
        discountAmount: 0,
        refundMethod: "CASH",
        remark: "质量退货",
        items: [
          {
            skuId: 1,
            skuName: "示例白酒 53度 500ml",
            boxQty: 0,
            bottleQty: 2,
            totalBottleQty: 2,
            unitPrice: 129,
            reason: "瓶盖破损",
          },
        ],
      });
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.returnId).toBeDefined();
      expect(body.data.returnNo).toContain("XSTH");
    });

    it("缺少 items 或为空数组应返回验证错误", async () => {
      const { status } = await httpRequest("POST", "/api/admin/sale-returns", {
        storeId: 1,
        items: [],
      });
      expect(status).toBe(500);
    });
  });

  describe("GET /sale-returns - 销售退货列表", () => {
    it("正常获取销售退货列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/sale-returns");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.records)).toBe(true);
    });

    it("支持按客户ID筛选", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/sale-returns?customerId=1");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
    });

    it("支持按状态筛选", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/sale-returns?returnStatus=PENDING");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
    });
  });

  describe("GET /sale-returns/:id - 销售退货详情", () => {
    it("查询不存在的退货单应返回 404", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/sale-returns/99999");
      expect(status).toBe(404);
      expect(body.message).toContain("销售退货单不存在");
    });
  });
});

// ====== 客户对账/付款测试 ======
describe("客户对账/付款 API", () => {
  describe("GET /customer-statements - 对账单列表", () => {
    it("未登录访问应返回 401", async () => {
      const { status } = await httpRequest("GET", "/api/admin/customer-statements", undefined, noAuthHeaders);
      expect(status).toBe(401);
    });

    it("正常获取对账单列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/customer-statements");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.records)).toBe(true);
    });

    it("支持按客户ID筛选", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/customer-statements?customerId=1");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
    });

    it("支持按状态筛选", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/customer-statements?status=DRAFT");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
    });
  });

  describe("GET /customer-statements/:id - 对账单详情", () => {
    it("查询不存在的对账单应返回 404", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/customer-statements/99999");
      expect(status).toBe(404);
      expect(body.message).toContain("对账单不存在");
    });
  });

  describe("POST /customer-statements/generate - 生成对账单", () => {
    it("客户不存在时应返回 400", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/customer-statements/generate", {
        customerId: 99999,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      });
      expect(status).toBe(400);
      expect(body.message).toContain("客户不存在");
    });

    it("正常生成对账单", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/customer-statements/generate", {
        customerId: 1,
        statementType: "MONTHLY",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        remark: "6月对账单",
      });
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.statementId).toBeDefined();
      expect(body.data.statementNo).toContain("DZ");
      expect(body.data.openingBalance).toBeDefined();
      expect(body.data.totalSales).toBeDefined();
      expect(body.data.totalReturns).toBeDefined();
      expect(body.data.totalPayments).toBeDefined();
      expect(body.data.closingBalance).toBeDefined();
    });

    it("对账单余额计算公式正确", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/customer-statements/generate", {
        customerId: 1,
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      });
      expect(status).toBe(200);
      const data = body.data;
      // 期末余额 = 期初 + 本期销售 - 本期退货 - 本期收款
      const expectedClosing = data.openingBalance + data.totalSales - data.totalReturns - data.totalPayments;
      expect(data.closingBalance).toBe(expectedClosing);
    });
  });

  describe("GET /customer-payments - 客户付款记录", () => {
    it("正常获取客户付款记录列表", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/customer-payments");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.records)).toBe(true);
    });

    it("支持按客户ID筛选", async () => {
      const { status, body } = await httpRequest("GET", "/api/admin/customer-payments?customerId=1");
      expect(status).toBe(200);
      expect(body.code).toBe("0");
    });

    it("支持按日期范围筛选", async () => {
      const { status, body } = await httpRequest(
        "GET",
        "/api/admin/customer-payments?dateStart=2026-06-01&dateEnd=2026-06-30"
      );
      expect(status).toBe(200);
      expect(body.code).toBe("0");
    });
  });

  describe("POST /customer-payments - 登记客户付款", () => {
    it("客户不存在时应返回 400", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/customer-payments", {
        customerId: 99999,
        amount: 100,
        paymentDate: "2026-06-20",
      });
      expect(status).toBe(400);
      expect(body.message).toContain("客户不存在");
    });

    it("正常登记客户付款", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/customer-payments", {
        customerId: 1,
        amount: 500,
        paymentMethod: "TRANSFER",
        paymentDate: "2026-06-20",
        remark: "6月货款",
      });
      expect(status).toBe(200);
      expect(body.code).toBe("0");
      expect(body.data.paymentId).toBeDefined();
      expect(body.data.receiptNo).toContain("SK");
      expect(body.data.amount).toBe(500);
    });

    it("使用默认付款方式 CASH", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/customer-payments", {
        customerId: 1,
        amount: 200,
        paymentDate: "2026-06-20",
      });
      expect(status).toBe(200);
      expect(body.code).toBe("0");
    });

    it("关联销售单付款时更新销售单收款信息", async () => {
      const { status, body } = await httpRequest("POST", "/api/admin/customer-payments", {
        customerId: 1,
        amount: 100,
        paymentMethod: "CASH",
        sourceType: "SALE_BILL",
        sourceNo: "XS-TEST-001",
        paymentDate: "2026-06-20",
      });
      expect(status).toBe(200);
      expect(body.code).toBe("0");
    });
  });
});

// ====== 权限验证测试 ======
describe("权限验证", () => {
  it("无 Token 访问供应商列表返回 401", async () => {
    const { status } = await httpRequest("GET", "/api/admin/suppliers", undefined, noAuthHeaders);
    expect(status).toBe(401);
  });

  it("无效 Token 访问采购订单列表返回 401", async () => {
    const { status } = await httpRequest("GET", "/api/admin/purchase-orders", undefined, {
      Authorization: "Bearer invalid-token",
      "Content-Type": "application/json",
    });
    expect(status).toBe(401);
  });

  it("无 Token 创建销售退货返回 401", async () => {
    const { status } = await httpRequest(
      "POST",
      "/api/admin/sale-returns",
      { storeId: 1, items: [{ skuId: 1, skuName: "test", totalBottleQty: 1, unitPrice: 100 }] },
      noAuthHeaders
    );
    expect(status).toBe(401);
  });

  it("无 Token 生成对账单返回 401", async () => {
    const { status } = await httpRequest(
      "POST",
      "/api/admin/customer-statements/generate",
      { customerId: 1, startDate: "2026-06-01", endDate: "2026-06-30" },
      noAuthHeaders
    );
    expect(status).toBe(401);
  });

  it("无 Token 登记客户付款返回 401", async () => {
    const { status } = await httpRequest(
      "POST",
      "/api/admin/customer-payments",
      { customerId: 1, amount: 100, paymentDate: "2026-06-20" },
      noAuthHeaders
    );
    expect(status).toBe(401);
  });

  it("无 Token 查询客户统计返回 401", async () => {
    const { status } = await httpRequest("GET", "/api/admin/members/stats", undefined, noAuthHeaders);
    expect(status).toBe(401);
  });

  it("无 Token 查询客户详情统计返回 401", async () => {
    const { status } = await httpRequest("GET", "/api/admin/members/1/stats", undefined, noAuthHeaders);
    expect(status).toBe(401);
  });
});

// ====== 边界情况测试 ======
describe("边界情况测试", () => {
  it("分页参数超出范围时返回空列表", async () => {
    const { status, body } = await httpRequest("GET", "/api/admin/suppliers?page=999&pageSize=100");
    expect(status).toBe(200);
    expect(body.code).toBe("0");
    expect(body.data.records).toBeDefined();
  });

  it("非法 ID 参数（非数字）返回错误", async () => {
    const { status } = await httpRequest("GET", "/api/admin/suppliers/abc");
    expect(status).toBeGreaterThanOrEqual(400);
  });

  it("空字符串关键字搜索返回全部", async () => {
    const { status, body } = await httpRequest("GET", "/api/admin/suppliers?keyword=");
    expect(status).toBe(200);
    expect(body.code).toBe("0");
  });

  it("日期范围筛选正常处理", async () => {
    const { status, body } = await httpRequest(
      "GET",
      "/api/admin/sale-returns?dateStart=2026-01-01&dateEnd=2026-12-31"
    );
    expect(status).toBe(200);
    expect(body.code).toBe("0");
  });

  it("创建退货单时金额为 0 的边界情况", async () => {
    const { status, body } = await httpRequest("POST", "/api/admin/sale-returns", {
      storeId: 1,
      items: [{ skuId: 1, skuName: "测试", totalBottleQty: 0, unitPrice: 0 }],
    });
    expect(status).toBe(200);
    expect(body.code).toBe("0");
  });

  it("客户付款金额为 0", async () => {
    const { status, body } = await httpRequest("POST", "/api/admin/customer-payments", {
      customerId: 1,
      amount: 0,
      paymentDate: "2026-06-20",
    });
    expect(status).toBe(200);
    expect(body.code).toBe("0");
  });

  it("客户付款金额为负数（业务漏洞验证）", async () => {
    const { status, body } = await httpRequest("POST", "/api/admin/customer-payments", {
      customerId: 1,
      amount: -100,
      paymentDate: "2026-06-20",
    });
    // Zod number() 允许负数，但业务上不合理
    // 这是一个潜在 BUG：应使用 z.number().positive() 或 z.number().min(0.01)
    expect(status).toBe(200);
    expect(body.code).toBe("0");
  });
});

// ====== 业务逻辑验证测试 ======
describe("业务逻辑验证", () => {
  it("供应商编号前缀为 GYS", async () => {
    const { body } = await httpRequest("POST", "/api/admin/suppliers", { name: "编号测试供应商" });
    expect(body.data.supplierCode).toMatch(/^GYS/);
  });

  it("销售退货单编号前缀为 XSTH", async () => {
    const { body } = await httpRequest("POST", "/api/admin/sale-returns", {
      storeId: 1,
      items: [{ skuId: 1, skuName: "测试", totalBottleQty: 1, unitPrice: 100 }],
    });
    expect(body.data.returnNo).toMatch(/^XSTH/);
  });

  it("对账单编号前缀为 DZ", async () => {
    const { body } = await httpRequest("POST", "/api/admin/customer-statements/generate", {
      customerId: 1,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    expect(body.data.statementNo).toMatch(/^DZ/);
  });

  it("客户付款收据编号前缀为 SK", async () => {
    const { body } = await httpRequest("POST", "/api/admin/customer-payments", {
      customerId: 1,
      amount: 100,
      paymentDate: "2026-06-20",
    });
    expect(body.data.receiptNo).toMatch(/^SK/);
  });

  it("所有列表接口返回格式统一 { code: '0', message: '成功', data: ... }", async () => {
    const endpoints = [
      "GET /api/admin/suppliers",
      "GET /api/admin/purchase-orders",
      "GET /api/admin/sale-returns",
      "GET /api/admin/customer-statements",
      "GET /api/admin/customer-payments",
      "GET /api/admin/members/stats",
    ];

    for (const endpoint of endpoints) {
      const [method, path] = endpoint.split(" ");
      const { body } = await httpRequest(method, path);
      expect(body.code).toBe("0");
      expect(body.message).toBe("成功");
      expect(body.data).toBeDefined();
    }
  });

  it("错误响应格式统一 { code: '404'/'400', message: '...' }", async () => {
    const errorEndpoints = [
      { method: "GET", path: "/api/admin/suppliers/99999", expectedStatus: 404 },
      { method: "GET", path: "/api/admin/purchase-orders/99999", expectedStatus: 404 },
      { method: "GET", path: "/api/admin/sale-returns/99999", expectedStatus: 404 },
      { method: "GET", path: "/api/admin/customer-statements/99999", expectedStatus: 404 },
    ];

    for (const endpoint of errorEndpoints) {
      const { status, body } = await httpRequest(endpoint.method, endpoint.path);
      expect(status).toBe(endpoint.expectedStatus);
      expect(body.code).toBeDefined();
      expect(body.message).toBeDefined();
    }
  });
});
