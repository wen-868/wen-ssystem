/**
 * 客户对账单 Phase 2 API 测试
 * 路径: /api/store/customer-statements
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../server.js";
import { signToken } from "../middleware/auth.js";
import { resetMockDb } from "./mocks/mock-db.js";

const TOKEN = signToken({
  id: 1, username: "admin", roles: ["SUPER_ADMIN"],
  storeId: null, tenantId: "default"
});

let statementNo: string;

describe("Customer Statement API", () => {
  beforeAll(() => resetMockDb());

  it("should create a customer statement", async () => {
    const res = await request(app)
      .post("/api/store/customer-statements")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        customer_id: 1, customer_name: "默认零售客户",
        start_date: "2025-01-01", end_date: "2025-01-31"
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.statement_no).toBeTruthy();
    statementNo = res.body.data.statement_no;
  });

  it("should get statement list", async () => {
    const res = await request(app)
      .get("/api/store/customer-statements")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should get statement detail", async () => {
    const res = await request(app)
      .get(`/api/store/customer-statements/${statementNo}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.statement_no).toBe(statementNo);
  });

  it("should confirm a statement", async () => {
    const res = await request(app)
      .post(`/api/store/customer-statements/${statementNo}/confirm`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should reject confirm of already confirmed statement", async () => {
    const res = await request(app)
      .post(`/api/store/customer-statements/${statementNo}/confirm`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it("should mark a confirmed statement as paid", async () => {
    const res = await request(app)
      .post(`/api/store/customer-statements/${statementNo}/paid`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });

  it("should return 404 for non-existent statement", async () => {
    const res = await request(app)
      .get("/api/store/customer-statements/NONEXISTENT")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it("should filter by customer", async () => {
    const res = await request(app)
      .get("/api/store/customer-statements?customer_id=1")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
  });
});