# 墨 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始
**验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证

---

## 任务概览

| # | 任务 | 优先级 | 依赖 | 状态 |
|---|------|--------|------|------|
| 1 | Products.vue 字段适配 | P0 | 阿坚#1 | 待开始 |
| 2 | ProductCategories.vue 联调 | P0 | 阿坚#2 | 待开始 |
| 3 | 品牌管理页面 Brands.vue | P1 | 阿坚#4 | 待开始 |
| 4 | 单位管理页面 Units.vue | P1 | 阿坚#5 | 待开始 |
| 5 | 商品详情页增强 | P1 | 阿坚#3 | 待开始 |
| 6 | 商品导入页面 | P1 | 阿坚#7 | 待开始 |
| 7 | 路由+导航注册 | P0 | 无 | 待开始 |

---

## 1. Products.vue 字段适配（P0）

**现状**：`admin-web/src/views/Products.vue`（327行）字段名与后端 API 不匹配。

**要求**：修改表格列和数据绑定，确保以下字段全部展示：
- SPU 级：spuCode、name、categoryName、brand、unit、specs、alcoholContent、origin、saleChannels、status、isNew、isRecommend、sortNo
- SKU 级（展开行）：skuCode、barcode、skuName、volume、packaging、baseUnit、boxUnit、boxRatio、temperature、traceEnabled、warningThreshold
- 价格级：costPrice、retailPrice、wholesalePrice、miniappPrice、storePrice

**字段对照**：见 `tasks/field-audit-product-center.md` 3.1 节。

---

## 2. ProductCategories.vue 联调（P0）

等阿坚完成分类 CRUD 后端后联调。确保显示字段与 `product_category` 表一致：name、parent_id、sort_no、icon、code、status。

---

## 3. 品牌管理页面 Brands.vue（P1）

新建 `admin-web/src/views/Brands.vue`，字段：name、logo、description、sort_no、status。

---

## 4. 单位管理页面 Units.vue（P1）

新建 `admin-web/src/views/Units.vue`，字段：name、code、type（BASE/BOX）、sort_no、status。

---

## 5. 商品详情页增强（P1）

在 Products.vue 详情抽屉中展示完整字段（对照审计报告 3.1 节），含：
- 主图 + 轮播图
- SKU 列表（全部字段）
- 价格信息 + 价格历史日志
- 商品详情富文本

---

## 6. 商品导入页面（P1）

新建 `admin-web/src/views/ProductImport.vue`，支持 CSV/Excel 上传 + 预览 + 确认导入。

---

## 7. 路由+导航注册（P0）

- `/products/brands` → `Brands.vue`
- `/products/units` → `Units.vue`
- `/products/import` → `ProductImport.vue`
- 侧边栏"商品管理"子菜单：商品列表、商品分类、品牌管理、单位管理、商品导入

---

**验收标准**：所有页面字段与 `tasks/field-audit-product-center.md` 审计报告一致，无遗漏。