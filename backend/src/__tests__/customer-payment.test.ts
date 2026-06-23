import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18770";
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
  server = http.createServer(app).listen(18770);
});

afterAll(async () => {
  server.close();
});

beforeEach(() => {
  resetMockDb();
});

describe("客户收款 /api/store/customer-payments", () => {
  it("POST 创建收款单 - 正常流程", async () => {
    const r = await api("POST", "/api/store/customer-payments", {
      customerId: 201,
      customerName: "客户A",
      payAmount: 500.00,
      payMethod: "CASH"
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.receiptNo).toBeDefined();
    expect(r.data.data.status).toBe("PAID");
  });

  it("GET 收款单列表", async () => {
    await api("POST", "/api/store/customer-payments", {
      customerId: 202, payAmount: 100.00, payMethod: "BANK"
    });
    const r = await api("GET", "/api/store/customer-payments");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data.data)).toBe(true);
    expect(r.data.data.length).toBeGreaterThan(0);
  });

  it("GET /:receiptNo 收款单详情", async () => {
    const create = await api("POST", "/api/store/customer-payments", {
      customerId: 203, payAmount: 888.88, payMethod: "WECHAT"
    });
    const receiptNo = create.data.data.receiptNo;
    const r = await api("GET", `/api/store/customer-payments/${receiptNo}`);
    expect(r.status).toBe(200);
    expect(r.data.data.receiptNo).toBe(receiptNo);
    expect(Number(r.data.data.payAmount)).toBeCloseTo(888.88, 2);
  });

  it("POST /void 作废收款单", async () => {
    const create = await api("POST", "/api/store/customer-payments", {
      customerId: 204, payAmount: 1000.00, payMethod: "ALIPAY"
    });
    const receiptNo = create.data.data.receiptNo;
    const r = await api("POST", `/api/store/customer-payments/${receiptNo}/void`);
    expect(r.status).toBe(200);
    expect(r.data.data.status).toBe("VOID");
  });

  it("金额精确到分", async () => {
    const r = await api("POST", "/api/store/customer-payments", {
      customerId: 205, payAmount: 99.99, payMethod: "CASH"
    });
    expect(Number(r.data.data.payAmount)).toBeCloseTo(99.99, 2);
  });

  it("作废后详情查询 status=VOID", async () => {
    const create = await api("POST", "/api/store/customer-payments", {
      customerId: 206, payAmount: 50.00, payMethod: "BANK"
    });
    const receiptNo = create.data.data.receiptNo;
    await api("POST", `/api/store/customer-payments/${receiptNo}/void`);
    const detail = await api("GET", `/api/store/customer-payments/${receiptNo}`);
    expect(detail.status).toBe(200);
    expect(detail.data.data.status).toBe("VOID");
  });

  it("GET /:receiptNo 不存在的单号 - 返回 404", async () => {
    const r = await api("GET", "/api/store/customer-payments/NO-EXIST");
    expect(r.status).toBe(404);
  });

  it("多个 payMethod - BANK/WECHAT/ALIPAY/CASH", async () => {
    const methods = ["BANK", "WECHAT", "ALIPAY", "CASH"];
    for (let i = 0; i < methods.length; i++) {
      const r = await api("POST", "/api/store/customer-payments", {
        customerId: 300 + i, payAmount: (i + 1) * 100, payMethod: methods[i]
      });
      expect(r.status).toBe(200);
      expect(r.data.data.receiptNo).toBeDefined();
    }
  });

  it("创建后列表查询", async () => {
    await api("POST", "/api/store/customer-payments", {
      customerId: 207, payAmount: 250.50, payMethod: "CASH"
    });
    const list = await api("GET", "/api/store/customer-payments");
    expect(list.status).toBe(200);
    expect(list.data.data[0].payMethod).toBeDefined();
  });

  it("边界: 零金额收款", async () => {
    const r = await api("POST", "/api/store/customer-payments", {
      customerId: 208, payAmount: 0, payMethod: "CASH"
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.data.payAmount)).toBe(0);
  });
});
