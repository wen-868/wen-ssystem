import { api } from "./request";

// ==================== Marketing - Coupon Template APIs ====================
export async function fetchCouponTemplates(params?: { page?: number; pageSize?: number; status?: string; type?: string; keyword?: string }) {
  const { data } = await api.get("/admin/marketing/coupons/templates", { params });
  return data.data;
}
export async function fetchCouponTemplateDetail(id: number) {
  const { data } = await api.get(`/admin/marketing/coupons/templates/${id}`);
  return data.data;
}
export async function createCouponTemplate(payload: unknown) {
  const { data } = await api.post("/admin/marketing/coupons/templates", payload);
  return data.data;
}
export async function updateCouponTemplate(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/coupons/templates/${id}`, payload);
  return data.data;
}
export async function deleteCouponTemplate(id: number) {
  const { data } = await api.delete(`/admin/marketing/coupons/templates/${id}`);
  return data.data;
}
export async function activateCouponTemplate(id: number) {
  const { data } = await api.post(`/admin/marketing/coupons/templates/${id}/activate`);
  return data.data;
}
export async function pauseCouponTemplate(id: number) {
  const { data } = await api.post(`/admin/marketing/coupons/templates/${id}/pause`);
  return data.data;
}
export async function fetchUserCoupons(params?: { page?: number; pageSize?: number; status?: string; userId?: number; templateId?: number }) {
  const { data } = await api.get("/admin/marketing/coupons/users", { params });
  return data.data;
}
export async function fetchCouponStatistics() {
  const { data } = await api.get("/admin/marketing/coupons/statistics");
  return data.data;
}


// ==================== Marketing - Full Reduction APIs ====================
export async function fetchFullReductions(params?: { page?: number; pageSize?: number; status?: string }) {
  const { data } = await api.get("/admin/marketing/promotions/full-reduction", { params });
  return data.data;
}
export async function fetchFullReductionDetail(id: number) {
  const { data } = await api.get(`/admin/marketing/promotions/full-reduction/${id}`);
  return data.data;
}
export async function createFullReduction(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/full-reduction", payload);
  return data.data;
}
export async function updateFullReduction(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/promotions/full-reduction/${id}`, payload);
  return data.data;
}
export async function deleteFullReduction(id: number) {
  const { data } = await api.delete(`/admin/marketing/promotions/full-reduction/${id}`);
  return data.data;
}
export async function activateFullReduction(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/full-reduction/${id}/activate`);
  return data.data;
}
export async function pauseFullReduction(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/full-reduction/${id}/pause`);
  return data.data;
}


// ==================== Marketing - Flash Sale APIs ====================
export async function fetchFlashSales(params?: { page?: number; pageSize?: number; status?: string }) {
  const { data } = await api.get("/admin/marketing/promotions/flash-sale", { params });
  return data.data;
}
export async function fetchFlashSaleDetail(id: number) {
  const { data } = await api.get(`/admin/marketing/promotions/flash-sale/${id}`);
  return data.data;
}
export async function createFlashSale(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/flash-sale", payload);
  return data.data;
}
export async function updateFlashSale(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/promotions/flash-sale/${id}`, payload);
  return data.data;
}
export async function deleteFlashSale(id: number) {
  const { data } = await api.delete(`/admin/marketing/promotions/flash-sale/${id}`);
  return data.data;
}
export async function activateFlashSale(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/flash-sale/${id}/activate`);
  return data.data;
}
export async function pauseFlashSale(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/flash-sale/${id}/pause`);
  return data.data;
}
export async function fetchFlashSaleStatistics() {
  const { data } = await api.get("/admin/marketing/promotions/flash-sale/statistics");
  return data.data;
}


// ==================== Marketing - Group Buy APIs ====================
export async function fetchGroupBuys(params?: { page?: number; pageSize?: number; status?: string }) {
  const { data } = await api.get("/admin/marketing/promotions/group-buy", { params });
  return data.data;
}
export async function fetchGroupBuyDetail(id: number) {
  const { data } = await api.get(`/admin/marketing/promotions/group-buy/${id}`);
  return data.data;
}
export async function createGroupBuy(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/group-buy", payload);
  return data.data;
}
export async function updateGroupBuy(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/promotions/group-buy/${id}`, payload);
  return data.data;
}
export async function deleteGroupBuy(id: number) {
  const { data } = await api.delete(`/admin/marketing/promotions/group-buy/${id}`);
  return data.data;
}
export async function activateGroupBuy(id: number) {
  const { data } = await api.post(`/admin/marketing/promotions/group-buy/${id}/activate`);
  return data.data;
}
export async function fetchGroupBuyTeams(params?: { page?: number; pageSize?: number; activityId?: number; status?: string }) {
  const { data } = await api.get("/admin/marketing/promotions/group-buy/teams", { params });
  return data.data;
}


// ==================== Marketing - Stack Rule APIs ====================
export async function fetchStackRules() {
  const { data } = await api.get("/admin/marketing/promotions/stack-rules");
  return data.data;
}
export async function createStackRule(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/stack-rules", payload);
  return data.data;
}
export async function updateStackRule(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/marketing/promotions/stack-rules/${id}`, payload);
  return data.data;
}
export async function deleteStackRule(id: number) {
  const { data } = await api.delete(`/admin/marketing/promotions/stack-rules/${id}`);
  return data.data;
}
export async function calculatePromotion(payload: unknown) {
  const { data } = await api.post("/admin/marketing/promotions/calculate", payload);
  return data.data;
}


// ==================== Marketing Tag APIs ====================
export async function fetchMarketingTags(params?: { keyword?: string; tagType?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/marketing/tags", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createMarketingTag(payload: { name: string; tagType: string; color?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.post("/admin/marketing/tags", payload);
  return data.data;
}
export async function updateMarketingTag(id: number, payload: { name?: string; tagType?: string; color?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.put(`/admin/marketing/tags/${id}`, payload);
  return data.data;
}
export async function deleteMarketingTag(id: number) {
  const { data } = await api.delete(`/admin/marketing/tags/${id}`);
  return data.data;
}
export async function fetchMarketingTagsByType() {
  const { data } = await api.get("/admin/marketing/tags/by-type");
  return data.data;
}
export async function fetchProductMarketingTags(productId: number) {
  const { data } = await api.get(`/admin/products/${productId}/marketing-tags`);
  return data.data;
}
export async function setProductMarketingTags(productId: number, tagIds: number[]) {
  const { data } = await api.put(`/admin/products/${productId}/marketing-tags`, { tagIds });
  return data.data;
}


// ==================== 秒杀 ====================
export async function getSeckillProducts(params?: any) { const { data } = await api.get('/admin/marketing/seckill', { params }); return data.data; }
export async function createSeckillProduct(data: any) { const { data: res } = await api.post('/admin/marketing/seckill', data); return res.data; }
export async function updateSeckillProduct(id: number, data: any) { const { data: res } = await api.put(`/admin/marketing/seckill/${id}`, data); return res.data; }
export async function deleteSeckillProduct(id: number) { const { data: res } = await api.delete(`/admin/marketing/seckill/${id}`); return res.data; }


// ==================== 拼团 ====================
export async function getGroupBuyActivities(params?: any) { const { data } = await api.get('/admin/marketing/group-buy/activities', { params }); return data.data; }
export async function createGroupBuyActivity(data: any) { const { data: res } = await api.post('/admin/marketing/group-buy/activities', data); return res.data; }
export async function updateGroupBuyActivity(id: number, data: any) { const { data: res } = await api.put(`/admin/marketing/group-buy/activities/${id}`, data); return res.data; }
export async function deleteGroupBuyActivity(id: number) { const { data: res } = await api.delete(`/admin/marketing/group-buy/activities/${id}`); return res.data; }
export async function getGroupBuyRecords(params?: any) { const { data } = await api.get('/admin/marketing/group-buy/records', { params }); return data.data; }

// ==================== 积分商城 ====================
export async function getPointsMallItems(params?: any) { const { data } = await api.get('/admin/points-mall/items', { params }); return data.data; }
export async function createPointsMallItem(data: any) { const { data: res } = await api.post('/admin/points-mall/items', data); return res.data; }
export async function updatePointsMallItem(id: number, data: any) { const { data: res } = await api.put(`/admin/points-mall/items/${id}`, data); return res.data; }
export async function deletePointsMallItem(id: number) { const { data: res } = await api.delete(`/admin/points-mall/items/${id}`); return res.data; }
export async function getPointsMallOrders(params?: any) { const { data } = await api.get('/admin/points-mall/orders', { params }); return data.data; }
export async function deliverPointsMallOrder(id: number, data?: any) { const { data: res } = await api.post(`/admin/points-mall/orders/${id}/deliver`, data); return res.data; }


// ==================== 营销素材 ====================
export async function getMarketingAssets(params?: any) { const { data } = await api.get('/admin/marketing-assets', { params }); return data.data; }
export async function createMarketingAsset(data: any) { const { data: res } = await api.post('/admin/marketing-assets', data); return res.data; }
export async function updateMarketingAsset(id: number, data: any) { const { data: res } = await api.put(`/admin/marketing-assets/${id}`, data); return res.data; }
export async function deleteMarketingAsset(id: number) { const { data: res } = await api.delete(`/admin/marketing-assets/${id}`); return res.data; }


