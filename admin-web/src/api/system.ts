import { api } from "./request";

// ==================== Staff Management APIs ====================
export async function createStaff(payload: {
  username: string;
  realName: string;
  mobile: string;
  role?: string;
  roleId?: number | string;
  storeId?: number;
  departmentId?: number;
  positionId?: number;
  password?: string;
}) {
  const { data } = await api.post("/admin/staff", payload);
  return data.data;
}

export async function updateStaff(id: number, payload: {
  username?: string;
  realName?: string;
  mobile?: string;
  role?: string;
  roleId?: number | string | null;
  storeId?: number;
  departmentId?: number | null;
  positionId?: number | null;
}) {
  const { data } = await api.put(`/admin/staff/${id}`, payload);
  return data.data;
}

export async function toggleStaffStatus(id: number, status: number) {
  const { data } = await api.put(`/admin/staff/${id}/status`, { status });
  return data.data;
}


// ==================== Employee Management APIs (system) ====================
export async function fetchEmployees(params?: { keyword?: string; storeId?: number; roleId?: number; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/system/employees", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchEmployeeDetail(id: number) {
  const { data } = await api.get(`/admin/system/employees/${id}`);
  return data.data;
}

export async function createEmployee(payload: { username: string; realName: string; mobile: string; staffNo?: string; department?: string; role?: string; storeId?: number }) {
  const { data } = await api.post("/admin/system/employees", payload);
  return data.data;
}

export async function updateEmployee(id: number, payload: { username?: string; realName?: string; mobile?: string; staffNo?: string; department?: string; role?: string; storeId?: number }) {
  const { data } = await api.put(`/admin/system/employees/${id}`, payload);
  return data.data;
}

export async function toggleEmployeeStatus(id: number, status: number) {
  const { data } = await api.patch(`/admin/system/employees/${id}/status`, { status });
  return data.data;
}

export async function resetEmployeePassword(id: number, payload: { newPassword: string }) {
  const { data } = await api.post(`/admin/system/employees/${id}/reset-password`, payload);
  return data.data;
}

// ==================== Warehouse APIs ====================
export async function fetchWarehouses() {
  const { data } = await api.get("/admin/warehouses");
  return data.data;
}

export async function createWarehouse(payload: { name: string; address?: string; contact?: string; phone?: string }) {
  const { data } = await api.post("/admin/warehouses", payload);
  return data.data;
}

export async function updateWarehouse(id: number, payload: { name?: string; address?: string; contact?: string; phone?: string; status?: number }) {
  const { data } = await api.put(`/admin/warehouses/${id}`, payload);
  return data.data;
}

export async function deleteWarehouse(id: number) {
  const { data } = await api.delete(`/admin/warehouses/${id}`);
  return data.data;
}

// ==================== 数据导入导出 ====================
export async function exportProductsData() {
  const { data } = await api.get("/admin/data-transfer/export/products");
  return data.data;
}

export async function exportCustomersData() {
  const { data } = await api.get("/admin/data-transfer/export/customers");
  return data.data;
}

export async function importCustomersCsv(csv: string) {
  const { data } = await api.post("/admin/data-transfer/import/customers", { csv });
  return data.data;
}

export async function importProductsCsv(csv: string) {
  const { data } = await api.post("/admin/data-transfer/import/products", { csv });
  return data.data;
}

/** 商品导入模板（行业通用中文表头 CSV） */
export async function fetchProductTemplate() {
  const { data } = await api.get("/admin/data-transfer/templates/products", { responseType: "text" });
  return data;
}

/** 客户导入模板（行业通用中文表头 CSV） */
export async function fetchCustomerTemplate() {
  const { data } = await api.get("/admin/data-transfer/templates/customers", { responseType: "text" });
  return data;
}


// ==================== System APIs ====================
export async function fetchSystemRoles() {
  const { data } = await api.get("/admin/system/roles");
  return data.data;
}

export async function fetchSystemStores() {
  const { data } = await api.get("/admin/system/stores");
  return data.data;
}


// ==================== Audit Log APIs ====================
export async function fetchAuditLogs(params?: { page?: number; pageSize?: number; userId?: number; action?: string; resourceType?: string; dateStart?: string; dateEnd?: string; ip?: string; userName?: string }) {
  const { data } = await api.get("/admin/system/audit-logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchAuditLogStatistics() {
  const { data } = await api.get("/admin/system/audit-logs/statistics");
  return data.data;
}
export async function cleanAuditLogs(days: number) {
  const { data } = await api.post("/admin/system/audit-logs/clean", { days });
  return data.data;
}


// ==================== System Config APIs ====================
export async function fetchSysConfig() {
  const { data } = await api.get("/admin/sys-config");
  return data.data;
}
export async function fetchSysConfigGroup(group: string) {
  const { data } = await api.get(`/admin/sys-config/${group}`);
  return data.data;
}
export async function batchUpdateSysConfig(payload: { config_key: string; config_value: string }[]) {
  const { data } = await api.put("/admin/sys-config/batch", payload);
  return data.data;
}
export async function createSysConfig(payload: { config_key: string; config_value?: string; config_group: string; description?: string }) {
  const { data } = await api.post("/admin/sys-config", payload);
  return data.data;
}


// ==================== RBAC / Role APIs ====================
export async function fetchRoles() {
  const { data } = await api.get("/admin/system/roles");
  return data.data;
}
export async function fetchRoleDetail(id: number) {
  const { data } = await api.get(`/admin/system/roles/${id}`);
  return data.data;
}
export async function createRole(payload: unknown) {
  const { data } = await api.post("/admin/system/roles", payload);
  return data.data;
}
export async function updateRole(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/system/roles/${id}`, payload);
  return data.data;
}
export async function deleteRole(id: number) {
  const { data } = await api.delete(`/admin/system/roles/${id}`);
  return data.data;
}
export async function fetchRoleUsers(id: number) {
  const { data } = await api.get(`/admin/system/roles/${id}/users`);
  return data.data;
}
export async function assignRoleUsers(id: number, userIds: number[]) {
  const { data } = await api.post(`/admin/system/roles/${id}/users`, { userIds });
  return data.data;
}
export async function fetchUserRoles(userId: number) {
  const { data } = await api.get(`/admin/system/roles/users/${userId}/roles`);
  return data.data;
}
export async function setUserRoles(userId: number, roleIds: number[]) {
  const { data } = await api.put(`/admin/system/roles/users/${userId}/roles`, { roleIds });
  return data.data;
}


// ==================== Data Permission APIs ====================
export async function fetchRoleDataPermissions(roleId: number) {
  const { data } = await api.get(`/admin/system/roles/${roleId}/data-permissions`);
  return data.data;
}

export async function setRoleDataPermissions(roleId: number, dataPermissions: any[]) {
  const { data } = await api.put(`/admin/system/roles/${roleId}/data-permissions`, { dataPermissions });
  return data.data;
}


// ==================== Notification APIs ====================
export async function fetchNotifications(params?: { type?: string; isRead?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/notifications", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchNotificationUnreadCount() {
  const { data } = await api.get("/admin/notifications/unread-count");
  return data.data;
}
export async function markNotificationRead(id: number) {
  const { data } = await api.put(`/admin/notifications/${id}/read`);
  return data.data;
}
export async function markAllNotificationsRead() {
  const { data } = await api.post("/admin/notifications/read-all");
  return data.data;
}
export async function sendNotification(payload: unknown) {
  const { data } = await api.post("/admin/notifications/send", payload);
  return data.data;
}


// ==================== Approval System APIs ====================
export async function fetchApprovalRules(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/approval/rules", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createApprovalRule(payload: any) {
  const { data } = await api.post("/admin/approval/rules", payload);
  return data.data;
}
export async function updateApprovalRule(id: number, payload: any) {
  const { data } = await api.put(`/admin/approval/rules/${id}`, payload);
  return data.data;
}
export async function deleteApprovalRule(id: number) {
  const { data } = await api.delete(`/admin/approval/rules/${id}`);
  return data.data;
}
export async function fetchMyApplications(params?: { page?: number; pageSize?: number; businessType?: string; status?: string; applicantId?: number }) {
  const { data } = await api.get("/admin/approval/instances", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function submitApproval(payload: { businessType: string; businessNo: string; businessTitle: string; remark?: string }) {
  const { data } = await api.post("/admin/approval/instances/submit", payload);
  return data.data;
}
export async function fetchApprovalDetail(instanceNo: string) {
  const { data } = await api.get(`/admin/approval/instances/${instanceNo}`);
  return data.data;
}
export async function approveApproval(taskId: number, payload?: { comment?: string }) {
  const { data } = await api.post(`/admin/approval/tasks/${taskId}/approve`, payload || {});
  return data.data;
}
export async function rejectApproval(taskId: number, payload?: { comment?: string }) {
  const { data } = await api.post(`/admin/approval/tasks/${taskId}/reject`, payload || {});
  return data.data;
}


// ==================== Error Log APIs ====================
let isReportingError = false;
let lastReportTime = 0;

export async function reportFrontendError(payload: {
  error_type?: string;
  message: string;
  stack?: string;
  url?: string;
}) {
  const now = Date.now();
  if (isReportingError || now - lastReportTime < 1000) return;
  isReportingError = true;
  lastReportTime = now;
  try {
    await api.post("/admin/error-report", payload);
  } catch {
    // 错误上报失败时静默忽略，避免无限循环
  } finally {
    isReportingError = false;
  }
}

export async function fetchErrorLogs(params?: {
  error_type?: string;
  severity?: string;
  source?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get("/admin/error-logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchDbStatus() {
  const { data } = await api.get("/admin/monitor/db-status");
  return data.data;
}

export async function fetchApiStats() {
  const { data } = await api.get("/admin/monitor/api-stats");
  return data.data;
}


// ==================== 部门管理 ====================
export async function getDepartments(params?: any) { const { data } = await api.get('/department', { params }); return data.data; }
export async function getDepartmentTree() { const { data } = await api.get('/department/tree'); return data.data; }
export async function createDepartment(data: any) { const { data: res } = await api.post('/department', data); return res.data; }
export async function updateDepartment(id: number, data: any) { const { data: res } = await api.put(`/department/${id}`, data); return res.data; }
export async function deleteDepartment(id: number) { const { data: res } = await api.delete(`/department/${id}`); return res.data; }


// ==================== 用户会话 ====================
export async function getUserSessions(params?: any) { const { data } = await api.get('/admin/sessions', { params }); return data.data; }
export async function revokeSession(id: number) { const { data: res } = await api.delete(`/admin/sessions/${id}`); return res.data; }
export async function getOnlineStats() { const { data } = await api.get('/admin/sessions/stats'); return data.data; }
