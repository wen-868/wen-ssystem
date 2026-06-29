# 墨 · Phase 2 + Phase 3 商品管理模块

**日期**：2026-06-29
**状态**：⚠️ 9/11 完成，2项待补

---

## 任务概览

### Phase 2

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | Products.vue 字段适配 | P0 | ❌ 未完成 |
| 2 | ProductCategories.vue 联调 | P0 | ✅ 453行，icon/code/sortNo |
| 3 | Brands.vue 品牌管理 | P1 | ✅ 126行 |
| 4 | Units.vue 单位管理 | P1 | ✅ 126行 |
| 5 | 商品详情增强（图片上传+富文本） | P1 | ❌ 未完成 |
| 6 | ProductImport.vue 商品导入 | P1 | ✅ 199行 |
| 7 | 路由+API+导航注册 | P0 | ✅ 5路由+29API |

### Phase 3

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 8 | 标签管理页面 | P0 | ✅ TagGroups.vue 233行 |
| 9 | 商品标签关联（商品详情中打标签） | P0 | ✅ ProductTagRelation.vue 149行 |
| 10 | 营销标签设置 | P0 | ✅ MarketingTags.vue 163行 |
| 11 | 批次追溯页面 | P1 | ✅ InventoryBatch.vue 416行 |

---

## 待办（2项）

| # | 任务 | 说明 |
|---|------|------|
| 1 | Products.vue 字段适配 | 表格列改为 SPU 14字段 + SKU 展开行13字段+价格，新增商品表单改为 SPU+SKU 嵌套结构。当前仍为旧字段结构（mainImage/skuCode/name/skuName/barcode/ON_SALE） |
| 2 | 商品详情增强 | 详情抽屉分3 Tab（基本信息/SKU/价格历史），含主图上传组件+富文本编辑器。当前仅基础详情展示 |

---

**已交付**：9/11 完成。新增 TagGroups.vue(233行)+ProductTagRelation.vue(149行)+InventoryBatch.vue(416行含追溯时间线)+ProductCategories.vue(453行icon/code/sortNo)。**待补**：Products.vue 字段适配 + 商品详情增强。