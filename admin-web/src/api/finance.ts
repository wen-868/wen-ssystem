import { api } from "./request";

// ==================== Bank Account APIs ====================
export async function fetchBankAccountsForFinance(params?: { page?: number; pageSize?: number; keyword?: string }) {
  const { data } = await api.get("/admin/bank-accounts", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createBankAccountForFinance(payload: { bankName: string; accountNo: string; accountName: string; branch?: string; balance?: number; remark?: string }) {
  const { data } = await api.post("/admin/bank-accounts", payload);
  return data.data;
}
export async function updateBankAccountForFinance(id: number, payload: { bankName?: string; accountNo?: string; accountName?: string; branch?: string; balance?: number; remark?: string }) {
  const { data } = await api.put(`/admin/bank-accounts/${id}`, payload);
  return data.data;
}
export async function toggleBankAccountStatus(id: number) {
  const { data } = await api.patch(`/admin/bank-accounts/${id}/status`);
  return data.data;
}
export async function fetchBankAccountTransactions(accountId: number, params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get(`/admin/bank-accounts/${accountId}/transactions`, { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createBankAccountTransaction(accountId: number, payload: { transactionType: "INCOME" | "EXPENSE"; amount: number; remark?: string }) {
  const { data } = await api.post(`/admin/bank-accounts/${accountId}/transactions`, payload);
  return data.data;
}


// ==================== Fund Report APIs ====================
export async function fetchFundTransactions(params?: { page?: number; pageSize?: number; transactionType?: string; accountId?: number; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/fund-transactions", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchFundStatistics(params?: { groupBy?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/fund-statistics", { params });
  return data.data;
}
export async function fetchFundTrend(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/fund-trend", { params });
  return data.data;
}


// ==================== Bill Management APIs ====================
export async function fetchBills(params?: { page?: number; pageSize?: number; keyword?: string; billType?: string; status?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/bills", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createBill(payload: { billNo: string; billType: "INVOICE" | "RECEIPT" | "CHECK" | "DRAFT"; amount: number; issueDate: string; dueDate: string; remark?: string }) {
  const { data } = await api.post("/admin/bills", payload);
  return data.data;
}
export async function updateBill(id: number, payload: { billNo?: string; billType?: "INVOICE" | "RECEIPT" | "CHECK" | "DRAFT"; amount?: number; issueDate?: string; dueDate?: string; remark?: string }) {
  const { data } = await api.put(`/admin/bills/${id}`, payload);
  return data.data;
}
export async function verifyBill(id: number) {
  const { data } = await api.post(`/admin/bills/${id}/verify`);
  return data.data;
}
export async function voidBill(id: number) {
  const { data } = await api.post(`/admin/bills/${id}/void`);
  return data.data;
}


// ==================== Phase 8: 财务往来 API ====================

// --- 收款 ---
export async function fetchReceipts(params?: { customerId?: number; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/receipts", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createReceipt(payload: { customerId: number; amount: number; paymentMethod: string; bankAccount: string; date: string }) {
  const { data } = await api.post("/admin/finance/receipts", payload);
  return data.data;
}
export async function getReceiptDetail(id: number) {
  const { data } = await api.get(`/admin/finance/receipts/${id}`);
  return data.data;
}
export async function writeoffReceipt(id: number, payload: { billIds: number[]; amounts: number[] }) {
  const { data } = await api.post(`/admin/finance/receipts/${id}/writeoff`, payload);
  return data.data;
}
export async function voidReceipt(id: number) {
  const { data } = await api.post(`/admin/finance/receipts/${id}/void`);
  return data.data;
}

// --- 付款 ---
export async function fetchPaymentsNew(params?: { supplierId?: number; type?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/payments", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createPaymentNew(payload: { supplierId: number; amount: number; type: string; paymentMethod: string; bankAccount: string; date: string }) {
  const { data } = await api.post("/admin/finance/payments", payload);
  return data.data;
}
export async function getPaymentDetail(id: number) {
  const { data } = await api.get(`/admin/finance/payments/${id}`);
  return data.data;
}
export async function writeoffPayment(id: number, payload: { billIds: number[]; amounts: number[] }) {
  const { data } = await api.post(`/admin/finance/payments/${id}/writeoff`, payload);
  return data.data;
}
export async function voidPayment(id: number) {
  const { data } = await api.post(`/admin/finance/payments/${id}/void`);
  return data.data;
}

// --- 应收应付汇总 ---
export async function fetchReceivablesSummary(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/finance/receivables-summary", { params });
  return data.data;
}
export async function fetchPayablesSummary(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/finance/payables-summary", { params });
  return data.data;
}

// --- 费用 ---
export async function fetchExpenses(params?: { expenseType?: string; status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/expenses", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createExpense(payload: { expenseType: string; category: string; amount: number; payee: string; paymentMethod: string; bankAccount: string; invoiceNo: string; expenseDate: string; remark: string }) {
  const { data } = await api.post("/admin/expenses", payload);
  return data.data;
}
export async function getExpenseDetail(id: number) {
  const { data } = await api.get(`/admin/expenses/${id}`);
  return data.data;
}
export async function approveExpense(id: number, approved: boolean) {
  const { data } = await api.post(`/admin/expenses/${id}/approve`, { approved });
  return data.data;
}
export async function voidExpense(id: number) {
  const { data } = await api.post(`/admin/expenses/${id}/void`);
  return data.data;
}
export async function fetchExpenseSummary(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/expense-summary", { params });
  return data.data;
}

// --- 对账 ---
export async function fetchCustomerReconciliation(params?: { status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/reconciliation/customer", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchCustomerReconciliationDetail(id: number) {
  const { data } = await api.get(`/admin/finance/reconciliation/customer/${id}`);
  return data.data;
}
export async function confirmCustomerReconciliation(id: number) {
  const { data } = await api.post(`/admin/finance/reconciliation/customer/${id}/confirm`);
  return data.data;
}
export async function fetchSupplierReconciliation(params?: { status?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/finance/reconciliation/supplier", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchSupplierReconciliationDetail(id: number) {
  const { data } = await api.get(`/admin/finance/reconciliation/supplier/${id}`);
  return data.data;
}
export async function confirmSupplierReconciliation(id: number) {
  const { data } = await api.post(`/admin/finance/reconciliation/supplier/${id}/confirm`);
  return data.data;
}
export async function generateReconciliation(payload: { reconType: string; entityId: number; periodStart: string; periodEnd: string }) {
  const { data } = await api.post("/admin/finance/reconciliation/generate", payload);
  return data.data;
}

// --- 驾驶舱 ---
export async function fetchFinanceDashboard() {
  const { data } = await api.get("/admin/finance/dashboard");
  return data.data;
}
export async function fetchCashFlow(params?: { range?: string }) {
  const { data } = await api.get("/admin/finance/cash-flow", { params });
  return data.data;
}
export async function fetchProfitTrend(params?: { range?: string }) {
  const { data } = await api.get("/admin/finance/profit-trend", { params });
  return data.data;
}
export async function fetchTopCustomersAR() {
  const { data } = await api.get("/admin/finance/top-customers-ar");
  return data.data;
}
export async function fetchTopSuppliersAP() {
  const { data } = await api.get("/admin/finance/top-suppliers-ap");
  return data.data;
}
export async function fetchDailyReport(params?: { month?: string }) {
  const { data } = await api.get("/admin/finance/daily-report", { params });
  return data.data;
}


// ==================== Payment Config APIs ====================
export const fetchPaymentConfig = (provider: string) => api.get(`/admin/payment/configs/${provider}`);
export const savePaymentConfig = (provider: string, data: any) => api.put(`/admin/payment/configs/${provider}`, data);
export const testPaymentConnection = (provider: string) => api.post(`/admin/payment/configs/${provider}/test`);
export const fetchPaymentStatus = () => api.get('/admin/payment/status');
export const fetchBankAccounts = () => api.get('/admin/payment/bank-accounts');
export const createBankAccount = (data: any) => api.post('/admin/payment/bank-accounts', data);
export const updateBankAccount = (id: number, data: any) => api.put(`/admin/payment/bank-accounts/${id}`, data);
export const deleteBankAccount = (id: number) => api.delete(`/admin/payment/bank-accounts/${id}`);
export const setDefaultBankAccount = (id: number) => api.put(`/admin/payment/bank-accounts/${id}/default`);


