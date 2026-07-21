import { api } from "./request";

// ==================== Commission APIs ====================
export async function fetchCommissionRules(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/commission/rules", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createCommissionRule(payload: { name: string; ruleType: string; config: any; startDate?: string; endDate?: string; remark?: string }) {
  const { data } = await api.post("/admin/commission/rules", payload);
  return data.data;
}
export async function updateCommissionRule(id: number, payload: any) {
  const { data } = await api.put(`/admin/commission/rules/${id}`, payload);
  return data.data;
}
export async function deleteCommissionRule(id: number) {
  const { data } = await api.delete(`/admin/commission/rules/${id}`);
  return data.data;
}
export async function fetchCommissionRecords(params?: { page?: number; pageSize?: number; staffId?: number; status?: string; dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/commission/records", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function calculateCommission(payload: { dateStart: string; dateEnd: string }) {
  const { data } = await api.post("/admin/commission/calculate", payload);
  return data.data;
}
export async function settleCommission(ids: number[]) {
  const { data } = await api.post("/admin/commission/settle", { ids });
  return data.data;
}
export async function fetchCommissionStats() {
  const { data } = await api.get("/admin/commission/stats");
  return data.data;
}

export async function fetchPaymentOrders() {
  const { data } = await api.get("/admin/payment-orders", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchRefundOrders() {
  const { data } = await api.get("/admin/refund-orders", { params: { page: 1, pageSize: 30 } });
  return data.data;
}

export async function fetchInventoryBalances() {
  const { data } = await api.get("/admin/inventory/balances");
  return data.data;
}

export async function fetchOrderDetail(orderNo: string) {
  const { data } = await api.get(`/admin/orders/${orderNo}`);
  return data.data;
}

export async function fetchDailySales() {
  const { data } = await api.get("/admin/reports/daily-sales");
  return data.data || [];
}

export async function fetchOrderStats() {
  const { data } = await api.get("/admin/reports/order-stats");
  return data.data || [];
}

export async function fetchStorePerformance() {
  const { data } = await api.get("/admin/reports/store-performance");
  return data.data || [];
}

export async function fetchInventoryAlerts() {
  const { data } = await api.get("/admin/inventory/alerts");
  return data.data || [];
}

export async function fetchSaleBillDetail(billNo: string) {
  const { data } = await api.get(`/store/sale-bills/${billNo}`);
  return data.data;
}

export async function acceptOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/accept`);
  return data.data;
}

export async function rejectOrder(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/reject`);
  return data.data;
}

export async function startDelivery(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/start-delivery`);
  return data.data;
}

export async function completeDelivery(orderNo: string) {
  const { data } = await api.post(`/store/orders/${orderNo}/complete-delivery`);
  return data.data;
}

export async function createCollectionLink(billNo: string, payload: { amount: number; shareChannel: string; expireHours: number }) {
  const { data } = await api.post(`/store/sale-bills/${billNo}/collection-link`, payload);
  return data.data;
}


// ==================== Credit Management APIs ====================
export async function fetchCredits(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/credits", { params });
  return data.data;
}
export async function fetchCreditDetail(customerId: number) {
  const { data } = await api.get(`/admin/credits/${customerId}`);
  return data.data;
}
export async function createCredit(customerId: number, payload: unknown) {
  const { data } = await api.post(`/admin/credits/${customerId}`, payload);
  return data.data;
}
export async function updateCreditLimit(customerId: number, payload: unknown) {
  const { data } = await api.put(`/admin/credits/${customerId}/limit`, payload);
  return data.data;
}
export async function updateCreditTerm(customerId: number, payload: unknown) {
  const { data } = await api.put(`/admin/credits/${customerId}/term`, payload);
  return data.data;
}
export async function freezeCredit(customerId: number, payload: unknown) {
  const { data } = await api.post(`/admin/credits/${customerId}/freeze`, payload);
  return data.data;
}
export async function unfreezeCredit(customerId: number, payload: unknown) {
  const { data } = await api.post(`/admin/credits/${customerId}/unfreeze`, payload);
  return data.data;
}
export async function fetchCreditLogs(customerId: number) {
  const { data } = await api.get(`/admin/credits/${customerId}/logs`);
  return data.data;
}
export async function fetchCollections(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/credits/collections", { params });
  return data.data;
}
export async function createCollection(payload: unknown) {
  const { data } = await api.post("/admin/credits/collections", payload);
  return data.data;
}
export async function updateCollection(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/credits/collections/${id}`, payload);
  return data.data;
}
export async function fetchOverdueCollections(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/credits/collections/overdue", { params });
  return data.data;
}
export async function batchRemindCollections(payload: unknown) {
  const { data } = await api.post("/admin/credits/collections/batch-remind", payload);
  return data.data;
}
export async function fetchCollectionStatistics() {
  const { data } = await api.get("/admin/credits/collections/statistics");
  return data.data;
}


// ==================== Phase 7: 客户管理 API ====================

// --- 积分与等级 ---
export async function fetchPointsRules() {
  const { data } = await api.get("/admin/customers/points-rules");
  return data.data;
}
export async function createPointsRule(payload: { name: string; earnType: string; earnRatio: number; dailyLimit: number }) {
  const { data } = await api.post("/admin/customers/points-rules", payload);
  return data.data;
}
export async function updatePointsRule(id: number, payload: { name?: string; earnRatio?: number; dailyLimit?: number; status?: string }) {
  const { data } = await api.put(`/admin/customers/points-rules/${id}`, payload);
  return data.data;
}
export async function deletePointsRule(id: number) {
  const { data } = await api.delete(`/admin/customers/points-rules/${id}`);
  return data.data;
}
export async function fetchPointsRecords(params?: { customerId?: number; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/points-records", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function adjustCustomerPoints(customerId: number, payload: { points: number; remark: string }) {
  const { data } = await api.post(`/admin/customers/customers/${customerId}/points/adjust`, payload);
  return data.data;
}
export async function fetchLevelConfigs() {
  const { data } = await api.get("/admin/customers/level-configs");
  return data.data;
}
export async function createLevelConfig(payload: { name: string; minPoints: number; maxPoints: number; discountRate: number; benefits: string }) {
  const { data } = await api.post("/admin/customers/level-configs", payload);
  return data.data;
}
export async function updateLevelConfig(id: number, payload: { name?: string; minPoints?: number; maxPoints?: number; discountRate?: number; benefits?: string; status?: string }) {
  const { data } = await api.put(`/admin/customers/level-configs/${id}`, payload);
  return data.data;
}
export async function deleteLevelConfig(id: number) {
  const { data } = await api.delete(`/admin/customers/level-configs/${id}`);
  return data.data;
}
export async function fetchLevelUpgradeRecords(params?: { customerId?: number; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/level-upgrade-records", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function updateMemberLevel(customerId: number, payload: { levelId: number; reason: string }) {
  const { data } = await api.post(`/admin/customers/customers/${customerId}/level`, payload);
  return data.data;
}

// --- 储值卡 ---
export async function fetchStoreValueCards(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/store-value-cards", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createStoreValueCard(payload: { customerId: number; amount: number }) {
  const { data } = await api.post("/admin/customers/store-value-cards", payload);
  return data.data;
}
export async function rechargeStoreValueCard(id: number, payload: { amount: number; paymentMethod: string; remark: string }) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/recharge`, payload);
  return data.data;
}
export async function consumeStoreValueCard(id: number, payload: { amount: number; source: string; remark: string }) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/consume`, payload);
  return data.data;
}
export async function refundStoreValueCard(id: number, payload: { amount: number; remark: string }) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/refund`, payload);
  return data.data;
}
export async function freezeStoreValueCard(id: number) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/freeze`);
  return data.data;
}
export async function unfreezeStoreValueCard(id: number) {
  const { data } = await api.post(`/admin/customers/store-value-cards/${id}/unfreeze`);
  return data.data;
}
export async function fetchStoreValueTransactions(params?: { cardId?: number; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/store-value-transactions", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// --- 会员体系 ---
export async function registerMember(payload: { name: string; mobile: string; password: string; referrerId?: number }) {
  const { data } = await api.post("/admin/customers/members/register", payload);
  return data.data;
}
export async function fetchMemberCard(customerId: number) {
  const { data } = await api.get(`/admin/customers/customers/${customerId}/card`);
  return data.data;
}
export async function fetchMemberBenefits() {
  const { data } = await api.get("/admin/customers/member-benefits");
  return data.data;
}
export async function updateMemberBenefits(levelId: number, payload: { benefits: { benefitCode: string; enabled: number; configValue?: string }[] }) {
  const { data } = await api.put(`/admin/customers/member-benefits/${levelId}`, payload);
  return data.data;
}

// --- 客户标签 ---
export async function fetchCustomerTags(params?: { tagGroup?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customers/customer-tags", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createCustomerTag(payload: { name: string; tagGroup: string; tagType: string; color: string; sortNo?: number }) {
  const { data } = await api.post("/admin/customers/customer-tags", payload);
  return data.data;
}
export async function updateCustomerTag(id: number, payload: { name?: string; tagGroup?: string; color?: string; sortNo?: number }) {
  const { data } = await api.put(`/admin/customers/customer-tags/${id}`, payload);
  return data.data;
}
export async function deleteCustomerTag(id: number) {
  const { data } = await api.delete(`/admin/customers/customer-tags/${id}`);
  return data.data;
}
export async function addCustomerTag(payload: { customerId: number; tagId: number }) {
  const { data } = await api.post("/admin/customers/customer-tags/add", payload);
  return data.data;
}
export async function removeCustomerTag(payload: { customerId: number; tagId: number }) {
  const { data } = await api.post("/admin/customers/customer-tags/remove", payload);
  return data.data;
}
export async function getCustomerTags(customerId: number) {
  const { data } = await api.get(`/admin/customers/customers/${customerId}/tags`);
  return data.data;
}

// --- 客户画像 ---
export async function fetchCustomerProfile(customerId: number) {
  const { data } = await api.get(`/admin/customers/customers/${customerId}/profile`);
  return data.data;
}
export async function updateCustomerProfile(customerId: number, payload: { ageRange?: string; gender?: string; preferCategories?: string; preferBrands?: string; lifecycleStage?: string }) {
  const { data } = await api.put(`/admin/customers/customers/${customerId}/profile`, payload);
  return data.data;
}

// --- 关怀规则 ---
export async function fetchCareRules() {
  const { data } = await api.get("/admin/customers/care-rules");
  return data.data;
}
export async function createCareRule(payload: { name: string; triggerType: string; contentTemplate: string; rewardPoints: number }) {
  const { data } = await api.post("/admin/customers/care-rules", payload);
  return data.data;
}
export async function updateCareRule(id: number, payload: { name?: string; triggerType?: string; contentTemplate?: string; rewardPoints?: number }) {
  const { data } = await api.put(`/admin/customers/care-rules/${id}`, payload);
  return data.data;
}
export async function deleteCareRule(id: number) {
  const { data } = await api.delete(`/admin/customers/care-rules/${id}`);
  return data.data;
}
export async function executeCareRule(id: number) {
  const { data } = await api.post(`/admin/customers/care-rules/${id}/execute`);
  return data.data;
}
export async function fetchCareLogs(params?: { page?: number; pageSize?: number; ruleId?: number }) {
  const { data } = await api.get("/admin/customers/care-logs", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// --- 生命周期 ---
export async function fetchLifecycleStages() {
  const { data } = await api.get("/admin/customers/lifecycle/stages");
  return data.data;
}
export async function fetchLifecycleTrend() {
  const { data } = await api.get("/admin/customers/lifecycle/trend");
  return data.data;
}
export async function fetchLifecycleDetail(params?: { page?: number; pageSize?: number; stage?: string }) {
  const { data } = await api.get("/admin/customers/lifecycle/detail", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

// --- 客户分群 ---
export async function fetchSegments() {
  const { data } = await api.get("/admin/customers/segments");
  return data.data;
}
export async function createSegment(payload: { name: string; conditions: Record<string, unknown>; refreshType: string }) {
  const { data } = await api.post("/admin/customers/segments", payload);
  return data.data;
}
export async function updateSegment(id: number, payload: { name?: string; conditions?: Record<string, unknown>; refreshType?: string }) {
  const { data } = await api.put(`/admin/customers/segments/${id}`, payload);
  return data.data;
}
export async function deleteSegment(id: number) {
  const { data } = await api.delete(`/admin/customers/segments/${id}`);
  return data.data;
}
export async function refreshSegment(id: number) {
  const { data } = await api.post(`/admin/customers/segments/${id}/refresh`);
  return data.data;
}
export async function fetchSegmentMembers(segmentId: number, params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get(`/admin/customers/segments/${segmentId}/members`, { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}


// ==================== Consumer Address APIs ====================
export async function fetchConsumerAddresses(params?: { userId?: number | string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/consumer-addresses", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function fetchConsumerAddressDetail(id: number) {
  const { data } = await api.get(`/admin/consumer-addresses/${id}`);
  return data.data;
}

// ==================== 客户类型管理 ====================
export async function fetchCustomerTypes(params?: { status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/customer-types", { params: { page: 1, pageSize: 100, ...params } });
  return data.data;
}
export async function createCustomerType(payload: { name: string; code: string; sortNo?: number; status?: string }) {
  const { data } = await api.post("/admin/customer-types", payload);
  return data.data;
}
export async function updateCustomerType(id: number, payload: { name?: string; code?: string; sortNo?: number; status?: string }) {
  const { data } = await api.put(`/admin/customer-types/${id}`, payload);
  return data.data;
}
export async function deleteCustomerType(id: number) {
  const { data } = await api.delete(`/admin/customer-types/${id}`);
  return data.data;
}


