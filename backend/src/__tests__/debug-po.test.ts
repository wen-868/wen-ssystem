import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";
import { query, queryOne } from "../shared/db.js";

const token = signToken({ id: 1, username: "test", roles: ["ADMIN"], storeId: 1 });
const base = "http://127.0.0.1:18766";
let server: http.Server;

beforeAll(async () => {
  server = http.createServer(app).listen(18766);
});

afterAll(async () => {
  server.close();
});

beforeEach(() => {
  resetMockDb();
});

describe("DEBUG purchase order", () => {
  it("insert + query", async () => {
    await query(
      'INSERT INTO purchase_order (order_no, store_id, supplier_id, goods_amount, tax_amount, payable_amount, paid_amount, order_status, pay_status, remark, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['PO-DEBUG', 1, 1, 500, 0, 500, 0, 'DRAFT', 'UNPAID', null, 1]
    );
    const rows = await query(
      'SELECT order_no AS orderNo, store_id AS storeId, payable_amount AS payableAmount FROM purchase_order ORDER BY id DESC'
    );
    console.log('LIST rows:', JSON.stringify(rows));
    
    const detail = await queryOne(
      'SELECT order_no AS orderNo, store_id AS storeId FROM purchase_order WHERE order_no = ?',
      ['PO-DEBUG']
    );
    console.log('DETAIL:', JSON.stringify(detail));
    
    expect(Array.isArray(rows)).toBe(true);
  });
});
