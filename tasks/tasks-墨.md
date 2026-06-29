# 墨 · Phase 2 + Phase 3 商品管理模块

**日期**：2026-06-29
**状态**：⚠️ 5/11 完成

---

## 任务概览

### Phase 2

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | Products.vue 字段适配 | P0 | ❌ 未完成 |
| 2 | ProductCategories.vue 联调 | P0 | ❌ 未完成 |
| 3 | Brands.vue 品牌管理 | P1 | ✅ 126行 |
| 4 | Units.vue 单位管理 | P1 | ✅ 126行 |
| 5 | 商品详情增强（图片上传+富文本） | P1 | ❌ 未完成 |
| 6 | ProductImport.vue 商品导入 | P1 | ✅ 199行 |
| 7 | 路由+API+导航注册 | P0 | ✅ 5路由+29API |

### Phase 3

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 8 | 标签管理页面 | P0 | ⚠️ 做了 ProductTags.vue(146行)+MarketingTags.vue(163行)，非任务要求的 TagGroups.vue+Tags.vue |
| 9 | 商品标签关联（商品详情中打标签） | P0 | ❌ 未完成 |
| 10 | 营销标签设置 | P0 | ✅ MarketingTags.vue 163行 |
| 11 | 批次追溯页面 | P1 | ❌ 未完成 |

---

## 待办（6项）

| # | 任务 | 说明 |
|---|------|------|
| 1 | Products.vue 字段适配 | 表格列改为 SPU 14字段 + SKU 展开行13字段+价格，新增商品表单改为 SPU+SKU 嵌套结构 |
| 2 | ProductCategories.vue 联调 | 等阿坚 API 就绪后，新增 icon/code 字段到表单 |
| 3 | 商品详情增强 | 详情抽屉分3 Tab（基本信息/SKU/价格历史），含主图上传+富文本 |
| 4 | 标签管理页面 | 按任务要求做 TagGroups.vue + Tags.vue（标签组管理+标签值管理），已有的 ProductTags.vue 可复用 |
| 5 | 商品标签关联 | 在商品详情中新增"标签"Tab，按标签组展示/添加/删除 |
| 6 | 批次追溯页面 | 新建 InventoryBatches.vue（批次列表+追溯链时间线） |

---

**已交付**：5个新页面（Brands/Units/ProductImport/ProductTags/MarketingTags）+ 29个API函数 + 5条路由。**待补**：6项。