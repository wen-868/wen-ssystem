import { api } from "./request";

// ==================== Dashboard APIs ====================
export async function fetchDashboardOverview() {
  const { data } = await api.get("/admin/dashboard/overview");
  return data.data;
}

export async function fetchDashboardSalesTrend() {
  const { data } = await api.get("/admin/dashboard/sales-trend");
  return data.data;
}

export async function fetchDashboardCategoryPie() {
  const { data } = await api.get("/admin/dashboard/category-pie");
  return data.data;
}

export async function fetchDashboardTopProducts() {
  const { data } = await api.get("/admin/dashboard/top-products");
  return data.data;
}

export async function fetchDashboardTopCustomers() {
  const { data } = await api.get("/admin/dashboard/top-customers");
  return data.data;
}

export async function fetchDashboardRecentAlerts() {
  const { data } = await api.get("/admin/dashboard/recent-alerts");
  return data.data;
}


// ========== Dashboard - 客户分析 ==========
export async function fetchDashboardCustomerStats() {
  const { data } = await api.get("/admin/dashboard/customer-stats");
  return data.data;
}

export async function fetchDashboardCustomerGrowthTrend() {
  const { data } = await api.get("/admin/dashboard/customer-growth-trend");
  return data.data;
}

export async function fetchDashboardCustomerActivity() {
  const { data } = await api.get("/admin/dashboard/customer-activity");
  return data.data;
}

export async function fetchDashboardCustomerCategoryStats() {
  const { data } = await api.get("/admin/dashboard/customer-category-stats");
  return data.data;
}


// ========== Dashboard - 供应商分析 ==========
export async function fetchDashboardSupplierStats() {
  const { data } = await api.get("/admin/dashboard/supplier-stats");
  return data.data;
}

export async function fetchDashboardSupplierPurchaseRanking(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/dashboard/supplier-purchase-ranking", { params });
  return data.data;
}

export async function fetchDashboardSupplierOnTimeRate() {
  const { data } = await api.get("/admin/dashboard/supplier-on-time-rate");
  return data.data;
}

export async function fetchDashboardSupplierTrend() {
  const { data } = await api.get("/admin/dashboard/supplier-trend");
  return data.data;
}


// ========== Dashboard - 销售排行 - 员工 ==========
export async function fetchDashboardTopEmployees(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/dashboard/top-employees", { params });
  return data.data;
}


// ==================== Report APIs ====================
export async function fetchReportSalesDaily(params?: { dateType?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/sales-daily", { params });
  return data.data;
}

export async function fetchReportSalesRanking(params?: { dimension?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/sales-ranking", { params });
  return data.data;
}

export async function fetchReportSalesTrend(params?: { dateType?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/sales-trend", { params });
  return data.data;
}

export async function fetchReportCustomerContribution() {
  const { data } = await api.get("/admin/reports/customer-contribution");
  return data.data;
}

export async function fetchReportPurchaseSummary() {
  const { data } = await api.get("/admin/reports/purchase-summary");
  return data.data;
}

export async function fetchReportSupplierRanking(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/supplier-ranking", { params });
  return data.data;
}

export async function fetchReportPurchaseTrend(params?: { granularity?: string; months?: number }) {
  const { data } = await api.get("/admin/reports/purchase-trend", { params });
  return data.data;
}

export async function fetchReportInventorySummary() {
  const { data } = await api.get("/admin/reports/inventory-summary");
  return data.data;
}

export async function fetchReportInventoryTurnover() {
  const { data } = await api.get("/admin/reports/inventory-turnover");
  return data.data;
}

export async function fetchReportInventoryAge() {
  const { data } = await api.get("/admin/reports/inventory-age");
  return data.data;
}

export async function fetchReportReceivablePayable() {
  const { data } = await api.get("/admin/reports/receivable-payable");
  return data.data;
}

export async function fetchReportPaymentAnalysis(params?: {
  dateStart?: string;
  dateEnd?: string;
  groupBy?: "date" | "customer" | "staff";
}) {
  const { data } = await api.get("/admin/reports/payment-analysis", { params });
  return data.data;
}

export async function fetchReportProfit() {
  const { data } = await api.get("/admin/reports/profit");
  return data.data;
}

export async function fetchReportBusinessOverview() {
  const { data } = await api.get("/admin/reports/business-overview");
  return data.data;
}

export async function fetchReportStaffPerformance(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/staff-performance", { params });
  return data.data;
}


// ==================== Enhanced Report APIs ====================
export async function fetchReportReceivablePayableEnhanced(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/receivable-payable", { params });
  return data.data;
}

export async function fetchReportProfitEnhanced(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/reports/profit", { params });
  return data.data;
}


// ==================== Report Permission APIs ====================
export const fetchReportPermissionMatrix = () => api.get("/admin/report-permissions/matrix");
export const saveReportPermissionMatrix = (data: Array<{ role_id: number; report_code: string; store_scope: string }>) =>
  api.put("/admin/report-permissions/matrix", data);
export const fetchRbacRoles = async () => {
  const { data } = await api.get("/admin/rbac/roles");
  return data.data;
};


// ==================== 自定义报表 ====================
export async function fetchReportTemplates(params?: any) { const { data } = await api.get('/admin/report-templates', { params }); return data.data; }
export async function createReportTemplate(payload: any) { const { data } = await api.post('/admin/report-templates', payload); return data.data; }
export async function updateReportTemplate(id: number, payload: any) { const { data } = await api.put(`/admin/report-templates/${id}`, payload); return data.data; }
export async function deleteReportTemplate(id: number) { const { data } = await api.delete(`/admin/report-templates/${id}`); return data.data; }
export async function executeReportTemplate(id: number, params?: any) { const { data } = await api.post(`/admin/report-templates/${id}/execute`, params); return data.data; }
export async function fetchReportSchedules(params?: any) { const { data } = await api.get('/admin/report-schedules', { params }); return data.data; }
export async function createReportSchedule(payload: any) { const { data } = await api.post('/admin/report-schedules', payload); return data.data; }
export async function updateReportSchedule(id: number, payload: any) { const { data } = await api.put(`/admin/report-schedules/${id}`, payload); return data.data; }
export async function deleteReportSchedule(id: number) { const { data } = await api.delete(`/admin/report-schedules/${id}`); return data.data; }
export async function toggleReportSchedule(id: number, enabled: boolean) { const { data } = await api.patch(`/admin/report-schedules/${id}/toggle`, { enabled }); return data.data; }
export async function runReportSchedule(id: number) { const { data } = await api.post(`/admin/report-schedules/${id}/run`); return data.data; }
export async function exportReportExcel(id: number, params?: any) {
  const { data } = await api.get(`/admin/report-templates/${id}/export-excel`, { params, responseType: 'blob' });
  return data;
}
export async function exportReportPdf(id: number, params?: any) {
  const { data } = await api.get(`/admin/report-templates/${id}/export-pdf`, { params, responseType: 'blob' });
  return data;
}
export async function fetchReportDataSources() { const { data } = await api.get('/admin/report-templates/data-sources'); return data.data; }
export async function fetchReportFields(dataSource: string) { const { data } = await api.get(`/admin/report-templates/fields/${dataSource}`); return data.data; }


