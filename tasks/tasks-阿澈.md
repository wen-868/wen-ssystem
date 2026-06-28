# 阿澈 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始
**验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证

---

## 任务概览

| # | 任务 | 优先级 | 依赖 | 状态 |
|---|------|--------|------|------|
| 1 | 分类 API 化（替换硬编码） | P0 | 阿坚#2 | 待开始 |
| 2 | 商品详情页 ProductDetailView.vue | P0 | 阿坚#3 | 待开始 |
| 3 | AdminProductsView 增强 | P1 | 阿坚#6 | 待开始 |
| 4 | 商品搜索优化 | P1 | 无 | 待开始 |
| 5 | 路由+导航注册 | P0 | 无 | 待开始 |

---

## 1. 分类 API 化（P0）

**现状**：`ProductsView.vue` 分类为前端硬编码。

**要求**：
- 新增 `fetchCategories` API 函数
- 从后端动态获取分类列表（含 icon/code 字段）
- 分类切换时传 `categoryId`
- 字段对照审计报告 3.3 节

---

## 2. 商品详情页（P0）

新建 `merchant-mobile/src/views/ProductDetailView.vue`，展示字段：
- SPU：name、brand、unit、specs、alcoholContent、origin、isNew、isRecommend
- 主图 + 轮播图
- SKU 列表：skuName、barcode、volume、packaging、baseUnit、boxUnit、boxRatio
- 价格：retailPrice、wholesalePrice
- 库存：availableQty、warningThreshold
- 温度、溯源码标识

**字段对照**：`tasks/field-audit-product-center.md` 3.1 节。

---

## 3. AdminProductsView 增强（P1）

- 分类筛选（从 API 获取）
- 商品搜索（名称/条码/SKU）
- 列表项增加：categoryName、brand、SKU 数量
- 新建商品入口

---

## 4. 商品搜索优化（P1）

- 搜索历史（localStorage 最近10条）
- 热门搜索标签
- 保持现有扫码功能

---

## 5. 路由+导航注册（P0）

- `/products/:spuId` → `ProductDetailView.vue`
- ProductsView 商品卡片点击跳转
- AdminProductsView 商品详情跳转入口

---

**验收标准**：所有页面字段与 `tasks/field-audit-product-center.md` 审计报告一致，无遗漏。