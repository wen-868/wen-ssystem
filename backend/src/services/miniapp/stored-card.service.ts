import { queryWithTenant, queryOneWithTenant, query } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/** 储值卡信息行 */
interface StoredCardRow {
  card_no: string;
  customer_name: string | null;
  balance: number | string;
  total_recharge: number | string;
  total_consume: number | string;
  status: string;
}

/** 交易记录行 */
interface StoredTransactionRow {
  trans_no: string;
  type: string;
  amount: number | string;
  balance_after: number | string;
  pay_method: string | null;
  remark: string | null;
  created_at: string | Date;
}

/** 当前用户储值卡信息 */
export async function getMyStoredCard(customerId: number, tenantId: string) {
  const card = await queryOneWithTenant<StoredCardRow>(
    `SELECT card_no, customer_name, balance, total_recharge, total_consume, status
     FROM t_store_value_card WHERE customer_id = ? AND tenant_id = ? AND status = 'ACTIVE'`,
    [customerId, tenantId],
    tenantId
  );
  if (!card) return null;
  return {
    cardNo: card.card_no,
    balance: Number(card.balance),
    totalRecharge: Number(card.total_recharge),
    totalConsume: Number(card.total_consume),
    status: card.status,
  };
}

/** 当前用户储值卡交易记录 */
export async function getMyStoredRecords(customerId: number, tenantId: string, page: number, pageSize: number, type?: string) {
  const card = await queryOneWithTenant<StoredCardRow>(
    `SELECT card_no FROM t_store_value_card WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId],
    tenantId
  );
  if (!card) return { total: 0, page, pageSize, records: [] };
  const offset = (page - 1) * pageSize;
  const conditions = ["card_no = ?", "tenant_id = ?", "remark <> 'PENDING_PAY' OR remark IS NULL"];
  const params: unknown[] = [card.card_no, tenantId];
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const totalRow = await queryOneWithTenant<{ total: number | string }>(
    `SELECT COUNT(*) AS total FROM t_store_value_transaction ${where}`,
    params,
    tenantId
  );
  const records = await queryWithTenant<StoredTransactionRow>(
    `SELECT trans_no, type, amount, balance_after, pay_method, remark, created_at
     FROM t_store_value_transaction ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );
  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: records.map((r) => ({
      id: r.trans_no,
      type: r.type,
      amount: Number(r.amount),
      balance: Number(r.balance_after),
      reason: r.remark || "",
      createdAt: r.created_at,
    })),
  };
}

/** 充值套餐（默认档位；后续可接入系统配置自定义） */
export async function getRechargeOptions(): Promise<Array<{ id: number; amount: number; giftAmount: number; tag?: string }>> {
  return [
    { id: 1, amount: 100, giftAmount: 0, tag: "无赠送" },
    { id: 2, amount: 200, giftAmount: 10, tag: "赠10" },
    { id: 3, amount: 500, giftAmount: 50, tag: "赠50" },
    { id: 4, amount: 1000, giftAmount: 150, tag: "赠150" },
  ];
}

/**
 * 储值卡充值下单：预创建 PENDING 交易（remark 标记），微信 JSAPI 支付，返回调起参数
 */
export async function createRecharge(params: {
  customerId: number;
  tenantId: string;
  amount: number;
  openid: string;
}) {
  const card = await queryOneWithTenant<StoredCardRow & { customer_name: string | null }>(
    `SELECT card_no, customer_name FROM t_store_value_card
     WHERE customer_id = ? AND tenant_id = ? AND status = 'ACTIVE'`,
    [params.customerId, params.tenantId],
    params.tenantId
  );
  if (!card) {
    throw Object.assign(new Error("未开通储值卡，请先到门店开通"), { statusCode: 400 });
  }
  const transNo = makeBizNo("CV");
  // 预创建交易（remark=PENDING_PAY 占位，支付成功后更新）
  await query(
    `INSERT INTO t_store_value_transaction
       (trans_no, card_no, customer_id, type, amount, balance_after, pay_method, remark, tenant_id)
     VALUES (?, ?, ?, 'RECHARGE', ?, 0, 'WECHAT', 'PENDING_PAY', ?)`,
    [transNo, card.card_no, params.customerId, params.amount, params.tenantId]
  );

  const { createJsapiPayment } = await import("../wechat-pay.service");
  const payParams = await createJsapiPayment({
    tenantId: params.tenantId,
    openid: params.openid,
    orderNo: transNo,
    amountYuan: params.amount,
    description: `储值卡充值${card.card_no}`,
  });
  return { rechargeId: transNo, amount: params.amount, payParams };
}

/** 充值支付成功回调：更新交易与卡余额 */
export async function completeRecharge(transNo: string, tenantId: string) {
  const tx = await queryOneWithTenant<StoredTransactionRow & { card_no: string }>(
    `SELECT trans_no, card_no, amount, remark FROM t_store_value_transaction
     WHERE trans_no = ? AND tenant_id = ? AND type = 'RECHARGE'`,
    [transNo, tenantId],
    tenantId
  );
  if (!tx || tx.remark === "PAID") {
    return; // 幂等
  }
  const amount = Number(tx.amount);
  const card = await queryOneWithTenant<{ balance: number | string }>(
    `SELECT balance FROM t_store_value_card WHERE card_no = ? AND tenant_id = ?`,
    [tx.card_no, tenantId],
    tenantId
  );
  const newBalance = Number(card?.balance ?? 0) + amount;
  await query(
    `UPDATE t_store_value_card SET balance = ?, total_recharge = total_recharge + ?, updated_at = NOW()
     WHERE card_no = ? AND tenant_id = ?`,
    [newBalance, amount, tx.card_no, tenantId]
  );
  await query(
    `UPDATE t_store_value_transaction SET balance_after = ?, remark = 'PAID', updated_at = NOW()
     WHERE trans_no = ? AND tenant_id = ?`,
    [newBalance, transNo, tenantId]
  );
}
