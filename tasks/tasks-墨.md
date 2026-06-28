# 墨 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 依赖 | 状态 |
|---|------|--------|------|------|
| 1 | Products.vue 字段适配 | P0 | 阿坚#5 | 待开始 |
| 2 | ProductCategories.vue 联调 | P0 | 阿坚#1 | 待开始 |
| 3 | 品牌管理页面 Brands.vue | P1 | 阿坚#3 | 待开始 |
| 4 | 单位管理页面 Units.vue | P1 | 阿坚#4 | 待开始 |
| 5 | 商品详情页增强 | P1 | 阿坚#2 | 待开始 |
| 6 | 路由+导航注册 | P0 | 无 | 待开始 |

---

## 1. Products.vue 字段适配（P0）

**现状**：`admin-web/src/views/Products.vue`（327行）使用的字段名与后端 API 返回不匹配。
- 前端期望：`skuCode`/`productName` 扁平结构
- 后端返回：`spuId`/`skuId`/`name`/`skuName` SPU+SKU 结构

**要求**：
- 修改 `admin-web/src/api.ts` 中 `fetchProducts` 的响应处理，适配后端实际返回格式
- 修改 `Products.vue` 中表格列绑定：`skuCode` → `skuCode`（SKU 维度），`productName` → `name`（SPU 维度）
- 新增商品时表单格式对齐后端 `createProduct` 接口（SPU + SKU 嵌套结构）
- 列表展示改为 SPU 行展开 SKU 子行，或合并展示

---

## 2. ProductCategories.vue 联调（P0）

**现状**：`admin-web/src/views/ProductCategories.vue`（440行）已实现完整的树形分类管理 UI（拖拽排序/增删改/两级限制），但调用的 API 后端不存在。

**要求**：
- 确认 `admin-web/src/api.ts` 中有分类 API 函数（或新增）
- 等阿坚完成分类 CRUD 后端后联调验证
- 确保拖拽排序调用的 `PUT /categories/:id/sort` 正常工作
- 确保两级分类限制在后端也有校验

---

## 3. 品牌管理页面 Brands.vue（P1）

**要求**：
- 新建 `admin-web/src/views/Brands.vue`
- 功能：品牌列表（表格+搜索）、新增/编辑弹窗、删除确认、排序
- 字段：品牌名称、Logo（图片上传）、描述、排序号、状态（启用/禁用）
- 调用 API：`/api/admin/brands`
- 参考现有 `ProductCategories.vue` 的 UI 风格

---

## 4. 单位管理页面 Units.vue（P1）

**要求**：
- 新建 `admin-web/src/views/Units.vue`
- 功能：单位列表（表格+搜索）、新增/编辑弹窗、删除确认
- 字段：单位名称（瓶/箱/件/桶）、编码、类型（BASE/BOX）、排序号、状态
- 调用 API：`/api/admin/units`
- 参考现有 `ProductCategories.vue` 的 UI 风格

---

## 5. 商品详情页增强（P1）

**现状**：Products.vue 中的详情抽屉仅展示基本信息。

**要求**：
- 在 Products.vue 的详情抽屉中（或新建 ProductDetail.vue 弹窗组件）增强展示：
  - 主图展示（支持上传替换）
  - SKU 列表（条码、规格、箱规、温度、溯源码开关、预警阈值）
  - 价格信息（成本价/零售价/批发价/小程序价/门店价）
  - 价格历史日志
- 调用阿坚的商品详情接口 `GET /api/admin/products/:spuId`

---

## 6. 路由+导航注册（P0）

**要求**：
- 在 `admin-web/src/router/index.ts` 中注册：
  - `/products/brands` → `Brands.vue`
  - `/products/units` → `Units.vue`
- 在侧边栏导航中"商品管理"菜单下添加子菜单项：
  - 商品列表
  - 商品分类
  - 品牌管理
  - 单位管理