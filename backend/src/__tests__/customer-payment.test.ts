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

describe("客户付款 /api/admin/customer-payments", () => {
  it("POST 登记客户付款 - 正常流程", async () => {
    const r = await api("POST", "/api/admin/customer-payments", {
      customerId: 1,
      amount: 500.00,
      paymentMethod: "CASH",
      paymentDate: "2026-06-01"
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.receiptNo).toBeDefined();
  });

  it("GET 付款记录列表", async () => {
    await api("POST", "/api/admin/customer-payments", {
      customerId: 1, amount: 100.00, paymentMethod: "BANK", paymentDate: "2026-06-02"
    });
    const r = await api("GET", "/api/admin/customer-payments");
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(Array.isArray(r.data.data.records)).toBe(true);
  });

  it("金额精确到分", async () => {
    const r = await api("POST", "/api/admin/customer-payments", {
      customerId: 1, amount: 99.99, paymentMethod: "CASH", paymentDate: "2026-06-03"
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.data.amount)).toBeCloseTo(99.99, 2);
  });

  it("多个 paymentMethod - BANK/WECHAT/ALIPAY/CASH", async () => {
    const methods = ["BANK", "WECHAT", "ALIPAY", "CASH"];
    for (let i = 0; i < methods.length; i++) {
      const r = await api("POST", "/api/admin/customer-payments", {
        customerId: 1, amount: (i + 1) * 100, paymentMethod: methods[i], paymentDate: "2026-06-04"
      });
      expect(r.status).toBe(200);
      expect(r.data.data.receiptNo).toBeDefined();
    }
  });

  it("边界: 零金额付款", async () => {
    const r = await api("POST", "/api/admin/customer-payments", {
      customerId: 1, amount: 0, paymentMethod: "CASH", paymentDate: "2026-06-05"
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.data.amount)).toBe(0);
  });
});
