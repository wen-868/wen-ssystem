# 墨 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始
**验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证，不能遗漏任何字段

---

## 任务概览

| # | 任务 | 优先级 | 依赖 | 预计文件 | 状态 |
|---|------|--------|------|----------|------|
| 1 | Products.vue 字段适配 | P0 | 阿坚#1 #6 | 2个文件改动 | 待开始 |
| 2 | ProductCategories.vue 联调 | P0 | 阿坚#2 | 1个文件改动 | 待开始 |
| 3 | 品牌管理页面 Brands.vue | P1 | 阿坚#4 | 1个新文件 | 待开始 |
| 4 | 单位管理页面 Units.vue | P1 | 阿坚#5 | 1个新文件 | 待开始 |
| 5 | 商品详情页增强（含主图上传+富文本） | P1 | 阿坚#3 | 1个文件改动 | 待开始 |
| 6 | 商品导入页面 ProductImport.vue | P1 | 阿坚#7 | 1个新文件 | 待开始 |
| 7 | 路由+API+导航注册 | P0 | 无 | 3个文件改动 | 待开始 |

---

## 1. Products.vue 字段适配（P0）

### 修改文件

**文件**：`admin-web/src/views/Products.vue`（327行）
**配合文件**：`admin-web/src/api.ts`

### 改动步骤

#### 1.1 API 适配

在 `admin-web/src/api.ts` 中修改 `fetchProducts` 的响应处理：

```typescript
// 确保将后端返回的 snake_case 转为 camelCase
// 后端返回：{ spuId, spuCode, name, categoryName, brand, unit, specs, ... }
// 前端使用：保持 camelCase 即可
```

#### 1.2 表格列替换

当前 Products.vue 使用扁平字段（`skuCode`/`productName`），改为 SPU+SKU 两层结构：

**SPU 主行字段**（表格列）：
| 列名 | 字段 | 宽度 |
|------|------|------|
| 编码 | spuCode | 120px |
| 商品名称 | name | 200px |
| 分类 | categoryName | 100px |
| 品牌 | brand | 100px |
| 单位 | unit | 80px |
| 规格 | specs | 120px |
| 酒精度 | alcoholContent | 80px |
| 产地 | origin | 120px |
| 渠道 | saleChannels | 120px |
| 新品 | isNew | 60px |
| 推荐 | isRecommend | 60px |
| 状态 | status | 80px |
| 操作 | — | 150px |

**SKU 展开行**（点击展开/手风琴）：
| 列名 | 字段 |
|------|------|
| SKU编码 | skuCode |
| 条码 | barcode |
| SKU名称 | skuName |
| 净含量 | volume |
| 包装 | packaging |
| 基础单位 | baseUnit |
| 箱单位 | boxUnit |
| 箱规 | boxRatio |
| 温度 | temperature |
| 追溯 | traceEnabled |
| 预警 | warningThreshold |
| 零售价 | retailPrice |
| 批发价 | wholesalePrice |
| 可用库存 | availableQty |

#### 1.3 新增商品表单改造

`createProduct` 接口从扁平结构改为 SPU+SKU 嵌套：

```typescript
// 提交格式
{
  name: "茅台飞天",
  categoryId: 1,
  brand: "茅台",
  unit: "瓶",
  specs: "500ml",
  alcoholContent: 53.0,
  origin: "贵州茅台镇",
  mainImage: "...",
  saleChannels: ["STORE", "MINIAPP"],
  isNew: false,
  isRecommend: true,
  description: "经典酱香",
  skus: [{
    skuCode: "SKU001",
    barcode: "6901234567890",
    skuName: "500ml",
    volume: "500ml",
    packaging: "瓶装",
    baseUnit: "瓶",
    boxUnit: "箱",
    boxRatio: 6,
    temperature: "AMBIENT",
    traceEnabled: false,
    warningThreshold: 10,
    costPrice: 800.00,
    retailPrice: 1499.00,
    wholesalePrice: 1200.00,
    miniappPrice: 1399.00,
    storePrice: 1499.00
  }]
}
```

### 验收清单

- [ ] 表格列展示 SPU 级全部字段
- [ ] 展开行展示 SKU 级全部字段（含价格+库存）
- [ ] 新增商品表单字段完整
- [ ] 编辑商品字段完整
- [ ] 搜索/筛选/分页正常
- [ ] 字段与 `tasks/field-audit-product-center.md` 3.1 节一致

---

## 2. ProductCategories.vue 联调（P0）

### 修改文件

**文件**：`admin-web/src/views/ProductCategories.vue`（440行）
**配合文件**：`admin-web/src/api.ts`

### 改动步骤

#### 2.1 新增 API 函数

在 `admin-web/src/api.ts` 中新增：

```typescript
export async function fetchCategories() {
  return api.get('/admin/products/categories')
}
export async function createCategory(data: { name: string; parentId?: number; icon?: string; code?: string }) {
  return api.post('/admin/products/categories', data)
}
export async function updateCategory(id: number, data: any) {
  return api.put(`/admin/products/categories/${id}`, data)
}
export async function deleteCategory(id: number) {
  return api.delete(`/admin/products/categories/${id}`)
}
export async function updateCategorySort(id: number, sortNo: number) {
  return api.put(`/admin/products/categories/${id}/sort`, { sortNo })
}
```

#### 2.2 页面字段适配

确保 `ProductCategories.vue` 表单字段与 `product_category` 表一致：
- name（分类名称）— 已有
- parent_id（父分类）— 已有
- sort_no（排序）— 已有
- icon（图标）— 新增
- code（编码）— 新增

### 验收清单

- [ ] 分类列表从后端加载
- [ ] 新增/编辑弹窗含 icon、code 字段
- [ ] 拖拽排序调用 `PUT /:id/sort` 正常
- [ ] 删除校验（有子分类/商品时提示）
- [ ] 字段与审计报告 3.3 节一致

---

## 3. 品牌管理页面 Brands.vue（P1）

### 新建文件

**文件**：`admin-web/src/views/Brands.vue`

### 功能要求

参考 `ProductCategories.vue` 的 UI 风格，实现：

- **表格列**：排序号、品牌名称、Logo（缩略图）、描述、状态（启用/停用）、操作（编辑/删除）
- **新增/编辑弹窗**：品牌名称（必填）、Logo（图片上传）、描述、排序号
- **删除**：确认弹窗，检查是否有商品引用
- **搜索**：按品牌名称模糊搜索

### 调用 API

```typescript
// 在 admin-web/src/api.ts 中新增
export async function fetchBrands(params?: { keyword?: string }) {
  return api.get('/admin/brands', { params })
}
export async function createBrand(data: { name: string; logo?: string; description?: string }) {
  return api.post('/admin/brands', data)
}
export async function updateBrand(id: number, data: any) {
  return api.put(`/admin/brands/${id}`, data)
}
export async function deleteBrand(id: number) {
  return api.delete(`/admin/brands/${id}`)
}
```

### 验收清单

- [ ] 品牌列表展示完整（name, logo, description, sort_no, status）
- [ ] 新增/编辑弹窗功能正常
- [ ] Logo 上传功能正常
- [ ] 删除校验正常
- [ ] 字段与审计报告 3.3 节一致

---

## 4. 单位管理页面 Units.vue（P1）

### 新建文件

**文件**：`admin-web/src/views/Units.vue`

### 功能要求

参考 `ProductCategories.vue` 的 UI 风格，实现：

- **表格列**：排序号、单位名称、编码、类型（基础单位/组合单位）、状态、操作
- **新增/编辑弹窗**：单位名称（必填，如"瓶"/"箱"/"件"）、编码（必填）、类型（BASE/BOX 下拉）、排序号
- **删除**：确认弹窗
- **搜索**：按名称或编码模糊搜索

### 调用 API

```typescript
// 在 admin-web/src/api.ts 中新增
export async function fetchUnits() {
  return api.get('/admin/units')
}
export async function createUnit(data: { name: string; code: string; type: string }) {
  return api.post('/admin/units', data)
}
export async function updateUnit(id: number, data: any) {
  return api.put(`/admin/units/${id}`, data)
}
export async function deleteUnit(id: number) {
  return api.delete(`/admin/units/${id}`)
}
```

### 验收清单

- [ ] 单位列表展示完整（name, code, type, sort_no, status）
- [ ] 新增/编辑弹窗功能正常
- [ ] 类型下拉（BASE/BOX）正常
- [ ] 字段与审计报告 3.2 节一致

---

## 5. 商品详情页增强（P1）

### 修改文件

**文件**：`admin-web/src/views/Products.vue`

### 改动步骤

在现有详情抽屉中增强展示，改为 Tab 分区：

#### Tab 1：基本信息
- 主图 + 轮播图（支持上传替换）
- 所有 SPU 字段展示（name, brand, unit, specs, alcoholContent, origin, saleChannels, isNew, isRecommend, description, detail）

#### Tab 2：SKU 列表
- 表格展示所有 SKU（skuCode, barcode, skuName, volume, packaging, baseUnit, boxUnit, boxRatio, temperature, traceEnabled, warningThreshold）

#### Tab 3：价格信息
- 当前价格表格（costPrice, retailPrice, wholesalePrice, miniappPrice, storePrice）
- 价格历史日志列表（price_type, old_price, new_price, action_type, operator, created_at）

### 新增 API

```typescript
export async function fetchProductDetail(spuId: number) {
  return api.get(`/admin/products/${spuId}`)
}
export async function uploadProductImage(spuId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/admin/products/${spuId}/image`, formData)
}
```

### 验收清单

- [ ] 详情抽屉分 Tab 展示
- [ ] 基本信息 Tab 字段完整
- [ ] SKU 列表 Tab 字段完整
- [ ] 价格信息 Tab 含价格历史
- [ ] 主图上传功能正常
- [ ] 字段与审计报告 3.1 节一致

---

## 6. 商品导入页面 ProductImport.vue（P1）

### 新建文件

**文件**：`admin-web/src/views/ProductImport.vue`

### 功能要求

- **步骤 1**：上传 CSV/Excel 文件（拖拽区域 + 文件选择按钮）
- **步骤 2**：预览解析结果（表格展示前 10 行，字段映射确认）
- **步骤 3**：确认导入（进度条 + 结果提示：成功 X 行，失败 Y 行，错误详情列表）

### 调用 API

```typescript
export async function importProducts(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/admin/products/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
```

### 验收清单

- [ ] 文件上传功能正常（CSV/Excel）
- [ ] 预览解析结果正确
- [ ] 导入结果反馈完整
- [ ] 错误行有明确提示

---

## 7. 路由+API+导航注册（P0）

### 7.1 路由注册

**文件**：`admin-web/src/router/index.ts`

```typescript
// 商品管理子路由
{
  path: '/products',
  name: 'Products',
  component: () => import('@/views/Products.vue'),
  meta: { title: '商品列表', menu: 'products' }
},
{
  path: '/products/categories',
  name: 'ProductCategories',
  component: () => import('@/views/ProductCategories.vue'),
  meta: { title: '商品分类', menu: 'products' }
},
{
  path: '/products/brands',
  name: 'Brands',
  component: () => import('@/views/Brands.vue'),
  meta: { title: '品牌管理', menu: 'products' }
},
{
  path: '/products/units',
  name: 'Units',
  component: () => import('@/views/Units.vue'),
  meta: { title: '单位管理', menu: 'products' }
},
{
  path: '/products/import',
  name: 'ProductImport',
  component: () => import('@/views/ProductImport.vue'),
  meta: { title: '商品导入', menu: 'products' }
}
```

### 7.2 侧边栏导航

**文件**：侧边栏菜单配置（通常是 `admin-web/src/layouts/` 或 `admin-web/src/App.vue` 中的菜单数据）

在"商品管理"一级菜单下添加子菜单项：
- 商品列表 `/products`
- 商品分类 `/products/categories`
- 品牌管理 `/products/brands`
- 单位管理 `/products/units`
- 商品导入 `/products/import`

### 7.3 API 函数汇总

**文件**：`admin-web/src/api.ts`

确保以下 API 函数全部存在（新增的用 `// Phase 2 新增` 注释标记）：
- `fetchProducts`（已有，需适配）
- `createProduct`（已有，需适配）
- `updateProduct`（已有）
- `updateProductStatus`（已有）
- `updateProductPrice`（已有）
- `fetchProductDetail`（新增）
- `fetchCategories`（新增）
- `createCategory`（新增）
- `updateCategory`（新增）
- `deleteCategory`（新增）
- `updateCategorySort`（新增）
- `fetchBrands`（新增）
- `createBrand`（新增）
- `updateBrand`（新增）
- `deleteBrand`（新增）
- `fetchUnits`（新增）
- `createUnit`（新增）
- `updateUnit`（新增）
- `deleteUnit`（新增）
- `importProducts`（新增）
- `uploadProductImage`（新增）
- `exportProductsCsv`（已有）

### 验收清单

- [ ] 所有路由注册正确
- [ ] 侧边栏菜单完整
- [ ] 所有 API 函数已定义
- [ ] 页面间跳转正常

---

## 验收总清单

| 检查项 | 状态 |
|--------|:---:|
| Products.vue 表格列展示 SPU 全部 14 字段 | ☐ |
| Products.vue 展开行展示 SKU 全部 13 字段 + 价格 + 库存 | ☐ |
| 新增/编辑商品表单字段完整（SPU 14 + SKU 13 + 价格 5） | ☐ |
| ProductCategories.vue 字段含 icon/code | ☐ |
| Brands.vue 页面完整（表格+弹窗+CRUD） | ☐ |
| Units.vue 页面完整（表格+弹窗+CRUD） | ☐ |
| 商品详情抽屉分 Tab 展示（基本信息/SKU/价格历史） | ☐ |
| 主图上传功能正常 | ☐ |
| ProductImport.vue 导入流程完整（上传→预览→确认） | ☐ |
| 路由+导航+API 全部注册 | ☐ |
| 所有页面字段与 `tasks/field-audit-product-center.md` 一致 | ☐ |