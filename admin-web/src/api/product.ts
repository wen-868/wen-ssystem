import { api } from "./request";

// ==================== Product Edit API ====================
export async function updateProduct(spuId: number, payload: { name?: string; barcode?: string; category?: string; brand?: string; unit?: string; boxRatio?: number; specs?: string }) {
  const { data } = await api.put(`/admin/products/${spuId}`, payload);
  return data.data;
}


// ==================== Brand APIs ====================
export async function fetchBrands(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/brands", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createBrand(payload: { name: string; sortNo?: number; remark?: string }) {
  const { data } = await api.post("/admin/brands", payload);
  return data.data;
}
export async function updateBrand(id: number, payload: { name?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.put(`/admin/brands/${id}`, payload);
  return data.data;
}
export async function deleteBrand(id: number) {
  const { data } = await api.delete(`/admin/brands/${id}`);
  return data.data;
}


// ==================== Unit APIs ====================
export async function fetchUnits(params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/units", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createUnit(payload: { name: string; sortNo?: number; remark?: string }) {
  const { data } = await api.post("/admin/units", payload);
  return data.data;
}
export async function updateUnit(id: number, payload: { name?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.put(`/admin/units/${id}`, payload);
  return data.data;
}
export async function deleteUnit(id: number) {
  const { data } = await api.delete(`/admin/units/${id}`);
  return data.data;
}


// ==================== Product Import API ====================
export async function importProducts(payload: { rows: Record<string, unknown>[]; mapping?: Record<string, string> }) {
  const { data } = await api.post("/admin/products/import", payload);
  return data.data;
}


// ==================== Product Tag Group APIs ====================
export async function fetchProductTagGroups() {
  const { data } = await api.get("/admin/tags/groups");
  return data.data;
}
export async function createProductTagGroup(payload: { groupCode: string; groupName: string; description?: string; sortNo?: number }) {
  const { data } = await api.post("/admin/tags/groups", payload);
  return data.data;
}
export async function updateProductTagGroup(id: number, payload: { groupName?: string; description?: string; sortNo?: number; status?: string }) {
  const { data } = await api.put(`/admin/tags/groups/${id}`, payload);
  return data.data;
}
export async function deleteProductTagGroup(id: number) {
  const { data } = await api.delete(`/admin/tags/groups/${id}`);
  return data.data;
}


// ==================== Product Tag APIs ====================
export async function fetchProductTags(params?: { keyword?: string; tagType?: string; status?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get("/admin/product-tags", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}
export async function createProductTag(payload: { name: string; tagType: string; sortNo?: number; remark?: string }) {
  const { data } = await api.post("/admin/product-tags", payload);
  return data.data;
}
export async function updateProductTag(id: number, payload: { name?: string; tagType?: string; sortNo?: number; remark?: string }) {
  const { data } = await api.put(`/admin/product-tags/${id}`, payload);
  return data.data;
}
export async function deleteProductTag(id: number) {
  const { data } = await api.delete(`/admin/product-tags/${id}`);
  return data.data;
}


// ==================== Product Category APIs ====================
export async function fetchProductCategories() {
  const { data } = await api.get("/admin/products/categories");
  return data.data;
}
export async function createProductCategory(payload: { name: string; parentId?: number; icon?: string; sortNo?: number }) {
  const { data } = await api.post("/admin/products/categories", payload);
  return data.data;
}
export async function updateProductCategory(id: number, payload: { name?: string; parentId?: number; icon?: string; sortNo?: number }) {
  const { data } = await api.put(`/admin/products/categories/${id}`, payload);
  return data.data;
}
export async function deleteProductCategory(id: number) {
  const { data } = await api.delete(`/admin/products/categories/${id}`);
  return data.data;
}
export async function sortProductCategory(id: number, payload: { parentId: number | null; sortOrder: number }) {
  const { data } = await api.put(`/admin/products/categories/${id}/sort`, payload);
  return data.data;
}


// ==================== 商品审核 ====================
export async function fetchProductReviews(params?: {
  keyword?: string;
  status?: string;
  reviewType?: string;
  submitterId?: number;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get("/admin/product-reviews", { params: { page: 1, pageSize: 20, ...params } });
  return data.data;
}

export async function fetchProductReviewDetail(id: number) {
  const { data } = await api.get(`/admin/product-reviews/${id}`);
  return data.data;
}

export async function approveProductReview(id: number, reviewComment?: string) {
  const { data } = await api.post(`/admin/product-reviews/${id}/approve`, { reviewComment });
  return data.data;
}

export async function rejectProductReview(id: number, reviewComment: string) {
  const { data } = await api.post(`/admin/product-reviews/${id}/reject`, { reviewComment });
  return data.data;
}

export async function batchApproveProductReviews(ids: number[], reviewComment?: string) {
  const { data } = await api.post("/admin/product-reviews/batch-approve", { ids, reviewComment });
  return data.data;
}

export async function batchRejectProductReviews(ids: number[], reviewComment: string) {
  const { data } = await api.post("/admin/product-reviews/batch-reject", { ids, reviewComment });
  return data.data;
}


// ==================== 产品套装（对齐后端 product-bundle.routes.ts：/api/admin/product-bundles） ====================
export async function fetchProductBundles(params?: { page?: number; pageSize?: number; keyword?: string; status?: number; categoryId?: number }) {
  const { data } = await api.get("/admin/product-bundles", { params: { page: 1, pageSize: 10, ...params } });
  return data.data;
}

export async function createProductBundle(payload: unknown) {
  const { data } = await api.post("/admin/product-bundles", payload);
  return data.data;
}

export async function updateProductBundle(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/product-bundles/${id}`, payload);
  return data.data;
}

export async function deleteProductBundle(id: number) {
  const { data } = await api.delete(`/admin/product-bundles/${id}`);
  return data.data;
}

export async function publishProductBundle(id: number) {
  const { data } = await api.post(`/admin/product-bundles/${id}/publish`);
  return data.data;
}

export async function unpublishProductBundle(id: number) {
  const { data } = await api.post(`/admin/product-bundles/${id}/unpublish`);
  return data.data;
}

export async function fetchProductBundleStats(params?: { dateStart?: string; dateEnd?: string }) {
  const { data } = await api.get("/admin/product-bundles/stats", { params });
  return data.data;
}

// ==================== 组合品（对齐后端 product-bundle.routes.ts：/api/admin/combo-products） ====================
export async function fetchComboProducts(params?: { page?: number; pageSize?: number; keyword?: string; status?: number; comboType?: string }) {
  const { data } = await api.get("/admin/combo-products", { params: { page: 1, pageSize: 10, ...params } });
  return data.data;
}

export async function createComboProduct(payload: unknown) {
  const { data } = await api.post("/admin/combo-products", payload);
  return data.data;
}

export async function updateComboProduct(id: number, payload: unknown) {
  const { data } = await api.put(`/admin/combo-products/${id}`, payload);
  return data.data;
}

export async function deleteComboProduct(id: number) {
  const { data } = await api.delete(`/admin/combo-products/${id}`);
  return data.data;
}


