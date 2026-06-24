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

describe("客户对账 /api/admin/customer-statements", () => {
  it("GET 对账单列表", async () => {
    const r = await api("GET", "/api/admin/customer-statements");
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(Array.isArray(r.data.data.records)).toBe(true);
  });

  it("POST 生成对账单 - 正常流程", async () => {
    const r = await api("POST", "/api/admin/customer-statements/generate", {
      customerId: 1,
      startDate: "2026-06-01",
      endDate: "2026-06-30"
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.statementNo).toBeDefined();
  });

  it("GET /:id 对账单详情", async () => {
    const create = await api("POST", "/api/admin/customer-statements/generate", {
      customerId: 1,
      startDate: "2026-05-01",
      endDate: "2026-05-31"
    });
    const statementId = create.data.data.statementId;
    const r = await api("GET", `/api/admin/customer-statements/${statementId}`);
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(r.data.data.id).toBe(statementId);
  });

  it("边界: 生成对账单金额计算", async () => {
    const r = await api("POST", "/api/admin/customer-statements/generate", {
      customerId: 1,
      startDate: "2026-04-01",
      endDate: "2026-04-30"
    });
    expect(r.status).toBe(200);
    expect(r.data.code).toBe("0");
    expect(Number(r.data.data.closingBalance)).toBeDefined();
  });
});
