import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18769";
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
  server = http.createServer(app).listen(18769);
});

afterAll(async () => {
  server.close();
});

beforeEach(() => {
  resetMockDb();
});

describe("客户对账 /api/store/customer-statements", () => {
  it("POST 创建对账单 - 正常流程", async () => {
    const r = await api("POST", "/api/store/customer-statements", {
      customerId: 101,
      customerName: "测试客户",
      startBalance: 500.00,
      salesAmount: 1500.00,
      returnAmount: 100.00,
      receivedAmount: 800.00,
      period: "2026-06"
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.statementNo).toBeDefined();
    expect(Number(r.data.data.endBalance)).toBeCloseTo(1100.00, 2);
  });

  it("GET 对账单列表", async () => {
    await api("POST", "/api/store/customer-statements", {
      customerId: 102, startBalance: 0, salesAmount: 100, returnAmount: 0, receivedAmount: 50, period: "2026-06"
    });
    const r = await api("GET", "/api/store/customer-statements");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data.data)).toBe(true);
    expect(r.data.data.length).toBeGreaterThan(0);
  });

  it("GET /:statementNo 对账单详情", async () => {
    const create = await api("POST", "/api/store/customer-statements", {
      customerId: 103, startBalance: 100, salesAmount: 200, returnAmount: 50, receivedAmount: 100, period: "2026-05"
    });
    const statementNo = create.data.data.statementNo;
    const r = await api("GET", `/api/store/customer-statements/${statementNo}`);
    expect(r.status).toBe(200);
    expect(r.data.data.statementNo).toBe(statementNo);
    expect(Number(r.data.data.startBalance)).toBe(100);
  });

  it("POST /confirm 确认对账单", async () => {
    const create = await api("POST", "/api/store/customer-statements", {
      customerId: 104, startBalance: 50, salesAmount: 200, returnAmount: 10, receivedAmount: 100, period: "2026-06"
    });
    const statementNo = create.data.data.statementNo;
    const r = await api("POST", `/api/store/customer-statements/${statementNo}/confirm`);
    expect(r.status).toBe(200);
    expect(r.data.data.status).toBe("CONFIRMED");
  });

  it("endBalance 计算: startBalance + sales - return - received", async () => {
    const r = await api("POST", "/api/store/customer-statements", {
      customerId: 105, startBalance: 1000.00, salesAmount: 500.00, returnAmount: 100.00, receivedAmount: 300.00, period: "2026-06"
    });
    // 1000 + 500 - 100 - 300 = 1100
    expect(Number(r.data.data.endBalance)).toBeCloseTo(1100.00, 2);
  });

  it("边界: 零余额", async () => {
    const r = await api("POST", "/api/store/customer-statements", {
      customerId: 106, startBalance: 0, salesAmount: 0, returnAmount: 0, receivedAmount: 0, period: "2026-06"
    });
    expect(Number(r.data.data.endBalance)).toBeCloseTo(0, 2);
  });

  it("边界: 金额精确到分", async () => {
    const r = await api("POST", "/api/store/customer-statements", {
      customerId: 107, startBalance: 0.01, salesAmount: 99.99, returnAmount: 0.01, receivedAmount: 50.00, period: "2026-06"
    });
    // 0.01 + 99.99 - 0.01 - 50 = 49.99
    expect(Number(r.data.data.endBalance)).toBeCloseTo(49.99, 2);
  });

  it("GET /:statementNo 不存在的单号 - 返回 404", async () => {
    const r = await api("GET", "/api/store/customer-statements/NOT-EXIST");
    expect(r.status).toBe(404);
  });

  it("POST 含明细创建", async () => {
    const r = await api("POST", "/api/store/customer-statements", {
      customerId: 108, startBalance: 0, salesAmount: 500, returnAmount: 0, receivedAmount: 200, period: "2026-06",
      items: [
        { transType: "SALE", transNo: "SO-001", amount: 300 },
        { transType: "PAYMENT", transNo: "SK-001", amount: 200 }
      ]
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.data.endBalance)).toBeCloseTo(300, 2);
  });

  it("确认后详情查询 status=CONFIRMED", async () => {
    const create = await api("POST", "/api/store/customer-statements", {
      customerId: 109, startBalance: 200, salesAmount: 100, returnAmount: 0, receivedAmount: 50, period: "2026-06"
    });
    const statementNo = create.data.data.statementNo;
    await api("POST", `/api/store/customer-statements/${statementNo}/confirm`);
    const detail = await api("GET", `/api/store/customer-statements/${statementNo}`);
    expect(detail.status).toBe(200);
    expect(detail.data.data.status).toBe("CONFIRMED");
  });
});
