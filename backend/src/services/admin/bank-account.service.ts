import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

/** t_bank_account 完整行（queryWithTenant/queryOneWithTenant 用，驼峰别名） */
interface BankAccountRow {
  id: number | string;
  accountName: string;
  bankName: string;
  accountNo: string;
  accountType: string | null;
  balance: number | string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** t_bank_account 简表行（新建后返回） */
interface BankAccountSimpleRow {
  id: number | string;
  accountName: string;
  bankName: string;
  accountNo: string;
}

/** 余额查询行 */
interface BankAccountBalanceRow {
  balance: number | string;
}

/** 状态查询行 */
interface BankAccountStatusRow {
  status: string;
}

/** 状态与余额查询行 */
interface BankAccountStatusBalanceRow {
  status: string;
  balance: number | string;
}

/** 合计余额行 */
interface BankAccountTotalRow {
  totalBalance: number | string;
}

/** COUNT(*) AS total 通用行 */
interface CountTotalRow {
  total: number;
}

export async function listBankAccounts(params: { status?: string; page: number; pageSize: number; tenantId: string }) {
  const { status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<BankAccountRow>(
    `SELECT id, account_name AS accountName, bank_name AS bankName, account_no AS accountNo, account_type AS accountType, balance, status, created_at AS createdAt, updated_at AS updatedAt
     FROM t_bank_account ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_bank_account ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getBankAccount(id: number, tenantId: string) {
  const account = await queryOneWithTenant<BankAccountRow>(
    "SELECT id, account_name AS accountName, bank_name AS bankName, account_no AS accountNo, account_type AS accountType, balance, status, created_at AS createdAt, updated_at AS updatedAt FROM t_bank_account WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!account) throw Object.assign(new Error("银行账户不存在"), { statusCode: 404 });
  return account;
}

export async function createBankAccount(params: { accountName: string; bankName: string; accountNo: string; accountType?: string; balance?: number; tenantId: string }) {
  const { accountName, bankName, accountNo, accountType, balance, tenantId } = params;
  await queryWithTenant(
    "INSERT INTO t_bank_account (account_name, bank_name, account_no, account_type, balance, status, tenant_id) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)",
    [accountName, bankName, accountNo, accountType ?? "GENERAL", balance ?? 0, tenantId], tenantId
  );
  const created = await queryOneWithTenant<BankAccountSimpleRow>("SELECT id, account_name AS accountName, bank_name AS bankName, account_no AS accountNo FROM t_bank_account WHERE account_no = ? AND tenant_id = ?", [accountNo, tenantId], tenantId);
  return created;
}

export async function updateBankAccount(id: number, params: { accountName?: string; bankName?: string; accountType?: string; tenantId: string }) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (params.accountName !== undefined) { fields.push("account_name = ?"); values.push(params.accountName); }
  if (params.bankName !== undefined) { fields.push("bank_name = ?"); values.push(params.bankName); }
  if (params.accountType !== undefined) { fields.push("account_type = ?"); values.push(params.accountType); }
  if (fields.length === 0) throw Object.assign(new Error("没有需要更新的字段"), { statusCode: 400 });
  values.push(id, params.tenantId);
  await queryWithTenant(`UPDATE t_bank_account SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, params.tenantId);
  return { id, ...params };
}

export async function updateBankAccountBalance(id: number, amount: number, tenantId: string) {
  const account = await queryOneWithTenant<BankAccountBalanceRow>("SELECT balance FROM t_bank_account WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!account) throw Object.assign(new Error("银行账户不存在"), { statusCode: 404 });
  const newBalance = Number(account.balance) + amount;
  await queryWithTenant("UPDATE t_bank_account SET balance = ? WHERE id = ? AND tenant_id = ?", [newBalance, id, tenantId], tenantId);
  return { id, balance: newBalance };
}

export async function freezeBankAccount(id: number, tenantId: string) {
  const account = await queryOneWithTenant<BankAccountStatusRow>("SELECT status FROM t_bank_account WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!account) throw Object.assign(new Error("银行账户不存在"), { statusCode: 404 });
  if (account.status !== "ACTIVE") throw Object.assign(new Error("银行账户状态异常"), { statusCode: 400 });
  await queryWithTenant("UPDATE t_bank_account SET status = 'FROZEN' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id, status: "FROZEN" };
}

export async function unfreezeBankAccount(id: number, tenantId: string) {
  const account = await queryOneWithTenant<BankAccountStatusRow>("SELECT status FROM t_bank_account WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!account) throw Object.assign(new Error("银行账户不存在"), { statusCode: 404 });
  if (account.status !== "FROZEN") throw Object.assign(new Error("银行账户未冻结"), { statusCode: 400 });
  await queryWithTenant("UPDATE t_bank_account SET status = 'ACTIVE' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id, status: "ACTIVE" };
}

export async function closeBankAccount(id: number, tenantId: string) {
  const account = await queryOneWithTenant<BankAccountStatusBalanceRow>("SELECT status, balance FROM t_bank_account WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!account) throw Object.assign(new Error("银行账户不存在"), { statusCode: 404 });
  if (Number(account.balance) > 0) throw Object.assign(new Error("账户余额不为零，无法销户"), { statusCode: 400 });
  await queryWithTenant("UPDATE t_bank_account SET status = 'CLOSED' WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id, status: "CLOSED" };
}

export async function getTotalBalance(tenantId: string) {
  const result = await queryOneWithTenant<BankAccountTotalRow>(
    "SELECT COALESCE(SUM(balance), 0) AS totalBalance FROM t_bank_account WHERE tenant_id = ? AND status = 'ACTIVE'",
    [tenantId], tenantId
  );
  return { totalBalance: result?.totalBalance ?? 0 };
}
