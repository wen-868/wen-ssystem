import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// ========== 类型定义 ==========

/** 储值卡 card_no 行 */
interface StoreValueCardNoRow {
  card_no: string;
}

/** 储值卡信息行 */
interface StoreValueCardRow {
  cardNo: string;
  customerId: number | string;
  customerName: string | null;
  balance: number | string;
  totalRecharge: number | string;
  totalConsume: number | string;
  status: string;
  createdAt: string | Date;
}

/** 储值卡状态行 */
interface StoreValueCardStatusRow {
  card_no: string;
  status: string;
}

/** 储值卡交易流水行 */
interface StoreValueTransactionRow {
  transNo: string;
  type: string;
  amount: number | string;
  balanceAfter: number | string;
  payMethod: string | null;
  sourceNo: string | null;
  remark: string | null;
  operatorId: number | string | null;
  createdAt: string | Date;
}

/** COUNT(*) AS total 行 */
interface CountTotalRow {
  total: number;
}

export async function createStoreValueCard(params: { customerId: number; customerName?: string; initialAmount?: number; tenantId: string }) {
  const { customerId, customerName, initialAmount, tenantId } = params;
  const existing = await queryOneWithTenant<StoreValueCardNoRow>("SELECT card_no FROM t_store_value_card WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  if (existing) throw new Error("该客户已有储值卡");
  const cardNo = makeBizNo("CZ");
  const amount = initialAmount ?? 0;
  await queryWithTenant(
    "INSERT INTO t_store_value_card (card_no, customer_id, customer_name, balance, total_recharge, status, tenant_id) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)",
    [cardNo, customerId, customerName ?? null, amount, amount, tenantId], tenantId
  );
  if (amount > 0) {
    const transNo = makeBizNo("SV");
    await queryWithTenant(
      "INSERT INTO t_store_value_transaction (trans_no, card_no, customer_id, type, amount, balance_after, pay_method, tenant_id) VALUES (?, ?, ?, 'RECHARGE', ?, ?, 'CASH', ?)",
      [transNo, cardNo, customerId, amount, amount, tenantId], tenantId
    );
  }
  return { cardNo, customerId, balance: amount };
}

export async function listStoreValueCards(params: { customerId?: number; status?: string; page: number; pageSize: number; tenantId: string }) {
  const { customerId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (customerId !== undefined) { conditions.push("customer_id = ?"); values.push(customerId); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<StoreValueCardRow>(
    `SELECT card_no AS cardNo, customer_id AS customerId, customer_name AS customerName, balance, total_recharge AS totalRecharge, total_consume AS totalConsume, status, created_at AS createdAt
     FROM t_store_value_card ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_store_value_card ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getStoreValueCard(cardNo: string, tenantId: string) {
  const card = await queryOneWithTenant<StoreValueCardRow>(
    "SELECT card_no AS cardNo, customer_id AS customerId, customer_name AS customerName, balance, total_recharge AS totalRecharge, total_consume AS totalConsume, status, created_at AS createdAt FROM t_store_value_card WHERE card_no = ? AND tenant_id = ?",
    [cardNo, tenantId], tenantId
  );
  if (!card) throw new Error("储值卡不存在");
  return card;
}

async function addTransaction(cardNo: string, customerId: number, type: string, amount: number, balanceAfter: number, payMethod: string | null, sourceNo: string | null, remark: string | null, operatorId: number | null, tenantId: string) {
  const transNo = makeBizNo("SV");
  await queryWithTenant(
    "INSERT INTO t_store_value_transaction (trans_no, card_no, customer_id, type, amount, balance_after, pay_method, source_no, remark, operator_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [transNo, cardNo, customerId, type, amount, balanceAfter, payMethod ?? null, sourceNo ?? null, remark ?? null, operatorId ?? null, tenantId], tenantId
  );
  return transNo;
}

export async function rechargeCard(params: { cardNo: string; amount: number; payMethod?: string; operatorId: number; tenantId: string }) {
  const { cardNo, amount, payMethod, operatorId, tenantId } = params;
  const card = await getStoreValueCard(cardNo, tenantId);
  if (card.status !== "ACTIVE") throw new Error("储值卡状态异常");
  const newBalance = Number(card.balance) + amount;
  await queryWithTenant("UPDATE t_store_value_card SET balance = ?, total_recharge = total_recharge + ? WHERE card_no = ? AND tenant_id = ?", [newBalance, amount, cardNo, tenantId], tenantId);
  const transNo = await addTransaction(cardNo, Number(card.customerId), "RECHARGE", amount, newBalance, payMethod ?? "CASH", null, null, operatorId, tenantId);
  return { cardNo, transNo, amount, balanceAfter: newBalance };
}

export async function consumeCard(params: { cardNo: string; amount: number; sourceNo?: string; remark?: string; operatorId: number; tenantId: string }) {
  const { cardNo, amount, sourceNo, remark, operatorId, tenantId } = params;
  const card = await getStoreValueCard(cardNo, tenantId);
  if (card.status !== "ACTIVE") throw new Error("储值卡状态异常");
  if (Number(card.balance) < amount) throw new Error("余额不足");
  const newBalance = Number(card.balance) - amount;
  await queryWithTenant("UPDATE t_store_value_card SET balance = ?, total_consume = total_consume + ? WHERE card_no = ? AND tenant_id = ?", [newBalance, amount, cardNo, tenantId], tenantId);
  const transNo = await addTransaction(cardNo, Number(card.customerId), "CONSUME", -amount, newBalance, null, sourceNo ?? null, remark ?? null, operatorId, tenantId);
  return { cardNo, transNo, amount, balanceAfter: newBalance };
}

export async function refundCard(params: { cardNo: string; amount: number; remark?: string; operatorId: number; tenantId: string }) {
  const { cardNo, amount, remark, operatorId, tenantId } = params;
  const card = await getStoreValueCard(cardNo, tenantId);
  if (card.status !== "ACTIVE") throw new Error("储值卡状态异常");
  const newBalance = Number(card.balance) + amount;
  await queryWithTenant("UPDATE t_store_value_card SET balance = ? WHERE card_no = ? AND tenant_id = ?", [newBalance, cardNo, tenantId], tenantId);
  const transNo = await addTransaction(cardNo, Number(card.customerId), "REFUND", amount, newBalance, null, null, remark ?? null, operatorId, tenantId);
  return { cardNo, transNo, amount, balanceAfter: newBalance };
}

export async function freezeCard(cardNo: string, tenantId: string) {
  const card = await getStoreValueCard(cardNo, tenantId);
  if (card.status !== "ACTIVE") throw new Error("储值卡状态异常");
  await queryWithTenant("UPDATE t_store_value_card SET status = 'FROZEN' WHERE card_no = ? AND tenant_id = ?", [cardNo, tenantId], tenantId);
  return { cardNo, status: "FROZEN" };
}

export async function unfreezeCard(cardNo: string, tenantId: string) {
  const card = await queryOneWithTenant<StoreValueCardStatusRow>("SELECT card_no, status FROM t_store_value_card WHERE card_no = ? AND tenant_id = ?", [cardNo, tenantId], tenantId);
  if (!card) throw new Error("储值卡不存在");
  if (card.status !== "FROZEN") throw new Error("储值卡未冻结");
  await queryWithTenant("UPDATE t_store_value_card SET status = 'ACTIVE' WHERE card_no = ? AND tenant_id = ?", [cardNo, tenantId], tenantId);
  return { cardNo, status: "ACTIVE" };
}

export async function listStoreValueTransactions(params: { cardNo: string; page: number; pageSize: number; tenantId: string }) {
  const { cardNo, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<StoreValueTransactionRow>(
    "SELECT trans_no AS transNo, type, amount, balance_after AS balanceAfter, pay_method AS payMethod, source_no AS sourceNo, remark, operator_id AS operatorId, created_at AS createdAt FROM t_store_value_transaction WHERE card_no = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [cardNo, tenantId, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_store_value_transaction WHERE card_no = ? AND tenant_id = ?", [cardNo, tenantId], tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}