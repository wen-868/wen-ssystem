import { beforeEach, describe, expect, it } from "vitest";
import { mockQuery, mockExecute, resetMockDb } from "../shared/mock-db.js";
import { makeBizNo } from "../shared/id.js";

// -------- 业务函数 --------
async function createStatement(input: {
  customerId: number;
  customerName: string;
  startBalance: number;
  items: { transType: string; transNo?: string; amount: number; remark?: string }[];
}) {
  if (input.items.length === 0) throw new Error("对账单至少需要 1 条明细");
  if (input.startBalance < 0) throw new Error("期初余额不能为负");
  if (input.items.some((it) => it.amount < 0)) throw new Error("金额不能为负");
  const statementNo = makeBizNo("DZ");
  const sales = input.items.filter(i => i.transType === "SALE").reduce((s, i) => s + i.amount, 0);
  const returns = input.items.filter(i => i.transType === "RETURN").reduce((s, i) => s + i.amount, 0);
  const received = input.items.filter(i => i.transType === "RECEIPT").reduce((s, i) => s + i.amount, 0);
  const endBalance = Math.round((input.startBalance + sales - returns - received) * 100) / 100;

  await mockExecute(
    `INSERT INTO customer_statement (statement_no, customer_id, customer_name, start_balance, sales_amount, return_amount, received_amount, end_balance, status, period) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [statementNo, input.customerId, input.customerName, input.startBalance, sales, returns, received, endBalance, "DRAFT", new Date().toISOString().slice(0, 7)]
  );
  for (const it of input.items) {
    await mockExecute(
      `INSERT INTO customer_statement_item (statement_no, trans_type, trans_no, amount, remark, created_at) VALUES (?,?,?,?,?,?)`,
      [statementNo, it.transType, it.transNo ?? null, it.amount, it.remark ?? null, new Date().toISOString()]
    );
  }
  const rows = await mockQuery<any>(
    `SELECT statement_no AS statementNo, customer_id AS customerId, customer_name AS customerName, start_balance AS startBalance, sales_amount AS salesAmount, return_amount AS returnAmount, received_amount AS receivedAmount, end_balance AS endBalance, status, period FROM customer_statement WHERE statement_no = ?`,
    [statementNo]
  );
  return rows[0];
}

async function confirmStatement(statementNo: string, operatorId: number = 1) {
  const rows = await mockQuery<any>(`SELECT status FROM customer_statement WHERE statement_no = ?`, [statementNo]);
  if (rows.length === 0) throw new Error("对账单不存在");
  if (rows[0].status === "CONFIRMED") throw new Error("对账单已确认");
  await mockExecute(`UPDATE customer_statement SET status = ?, auditor_id = ?, audit_time = ? WHERE statement_no = ?`, ["CONFIRMED", operatorId, new Date().toISOString(), statementNo]);
  const after = await mockQuery<any>(`SELECT statement_no AS statementNo, status, end_balance AS endBalance FROM customer_statement WHERE statement_no = ?`, [statementNo]);
  return after[0];
}

// -------- 测试 --------
describe("客户对账与收款", () => {
  beforeEach(() => resetMockDb());
  it("创建对账单 - 正常：期末余额 = 期初 + 销售 - 退货 - 收款", async () => {
    const st = await createStatement({
      customerId: 500, customerName: "客户A",
      startBalance: 1000,
      items: [
        { transType: "SALE", transNo: "SO1", amount: 500 },
        { transType: "RETURN", transNo: "RT1", amount: 100 },
        { transType: "RECEIPT", transNo: "RC1", amount: 800 }
      ]
    });
    expect(Number(st.startBalance)).toBe(1000);
    expect(Number(st.salesAmount)).toBe(500);
    expect(Number(st.returnAmount)).toBe(100);
    expect(Number(st.receivedAmount)).toBe(800);
    expect(Number(st.endBalance)).toBeCloseTo(1000 + 500 - 100 - 800, 2); // 600
    expect(st.status).toBe("DRAFT");
  });

  it("创建对账单 - 边界：期末余额 = 0（完全结清）", async () => {
    const st = await createStatement({
      customerId: 501, customerName: "客户B",
      startBalance: 300,
      items: [{ transType: "RECEIPT", amount: 300 }]
    });
    expect(Number(st.endBalance)).toBeCloseTo(0, 2);
  });

  it("创建对账单 - 异常：负金额拒绝", async () => {
    await expect(createStatement({
      customerId: 502, customerName: "X", startBalance: 100,
      items: [{ transType: "SALE", amount: -50 }]
    })).rejects.toThrow();
  });

  it("创建对账单 - 异常：空明细拒绝", async () => {
    await expect(createStatement({ customerId: 1, customerName: "X", startBalance: 0, items: [] })).rejects.toThrow();
  });

  it("创建对账单 - 异常：期初为负拒绝", async () => {
    await expect(createStatement({ customerId: 1, customerName: "X", startBalance: -10, items: [{ transType: "SALE", amount: 100 }] })).rejects.toThrow();
  });

  it("确认对账单 - 正常：状态切换为 CONFIRMED 且 auditorId 有值", async () => {
    const st = await createStatement({
      customerId: 503, customerName: "C",
      startBalance: 500,
      items: [{ transType: "RECEIPT", amount: 500 }]
    });
    const confirmed = await confirmStatement(st.statementNo, 88);
    expect(confirmed.status).toBe("CONFIRMED");
    const detail = await mockQuery<any>(`SELECT auditor_id AS auditorId FROM customer_statement WHERE statement_no = ?`, [st.statementNo]);
    expect(Number(detail[0].auditorId)).toBe(88);
  });

  it("确认对账单 - 异常：重复确认拒绝", async () => {
    const st = await createStatement({
      customerId: 504, customerName: "D",
      startBalance: 100,
      items: [{ transType: "SALE", amount: 100 }]
    });
    await confirmStatement(st.statementNo);
    await expect(confirmStatement(st.statementNo)).rejects.toThrow();
  });

  it("金额精度 - 分的四舍五入：start=10.005 sale=19.995 → end=30.00", async () => {
    const st = await createStatement({
      customerId: 505, customerName: "E",
      startBalance: 10.005,
      items: [{ transType: "SALE", amount: 19.995 }]
    });
    // 10.005 + 19.995 = 30.00
    expect(Number(st.endBalance)).toBeCloseTo(30.00, 2);
  });

  it("多条明细 - 混合销售/退货/收款，endBalance 正确", async () => {
    const st = await createStatement({
      customerId: 506, customerName: "F",
      startBalance: 2000,
      items: [
        { transType: "SALE", transNo: "SO10", amount: 300 },
        { transType: "SALE", transNo: "SO11", amount: 150 },
        { transType: "RETURN", transNo: "RT10", amount: 50 },
        { transType: "RECEIPT", transNo: "RC10", amount: 400 }
      ]
    });
    // 2000 + 450 - 50 - 400 = 2000
    expect(Number(st.endBalance)).toBeCloseTo(2000, 2);
  });
});
