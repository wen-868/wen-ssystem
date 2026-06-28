# 墨 · Phase 2 + Phase 3 商品管理模块

**日期**：2026-06-29
**状态**：Phase 2 待开始，Phase 3 待开始
**验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证

---

# Phase 2（进行中）

| # | 任务 | 优先级 | 依赖 | 状态 |
|---|------|--------|------|------|
| 1 | Products.vue 字段适配 | P0 | 阿坚 Phase 2 ✅ | 待开始 |
| 2 | ProductCategories.vue 联调 | P0 | 阿坚 Phase 2 ✅ | 待开始 |
| 3 | Brands.vue 品牌管理 | P1 | 阿坚 Phase 2 ✅ | 待开始 |
| 4 | Units.vue 单位管理 | P1 | 阿坚 Phase 2 ✅ | 待开始 |
| 5 | 商品详情增强（图片上传+富文本） | P1 | 阿坚 Phase 2 ✅ | 待开始 |
| 6 | ProductImport.vue 商品导入 | P1 | 阿坚 Phase 2 ✅ | 待开始 |
| 7 | 路由+API+导航注册 | P0 | 无 | 待开始 |

---

# Phase 3（新增）

| # | 任务 | 优先级 | 依赖 | 状态 |
|---|------|--------|------|------|
| 8 | 标签管理页面 | P0 | 阿坚 Phase 3 #1 #2 | 待开始 |
| 9 | 商品标签关联（商品详情中打标签） | P0 | 阿坚 Phase 3 #2 | 待开始 |
| 10 | 营销标签设置 | P0 | 阿坚 Phase 3 #3 | 待开始 |
| 11 | 批次追溯页面 | P1 | 阿坚 Phase 3 #4 | 待开始 |

---

## 8. 标签管理页面（P0）

### 新建页面

**文件**：`admin-web/src/views/TagGroups.vue` + `admin-web/src/views/Tags.vue`

### 功能要求

#### 标签组管理（TagGroups.vue）
- 表格列：排序号、标签组名称、编码、是否多选、状态、操作
- 新增/编辑弹窗：名称、编码、是否多选开关、排序号
- 点击标签组名称 → 跳转到该组下的标签值管理

#### 标签值管理（Tags.vue，路由参数 `?groupId=1`）
- 面包屑：标签管理 > 香型
- 表格列：排序号、标签名称、状态、操作
- 新增/编辑弹窗：所属标签组（下拉）、标签名称、排序号
- 删除校验：检查是否有商品引用

### 调用 API

```typescript
// 标签组
fetchTagGroups()
createTagGroup(data)
updateTagGroup(id, data)
deleteTagGroup(id)

// 标签值
fetchTags(groupId?: number)
createTag(data)
updateTag(id, data)
deleteTag(id)
```

### 验收清单

- [ ] 标签组管理页面完整（表格+弹窗+CRUD）
- [ ] 标签值管理页面完整（表格+弹窗+CRUD）
- [ ] 删除校验（标签组有标签值时禁止删除，标签值有商品引用时禁止删除）
- [ ] 标签组→标签值导航正常

---

## 9. 商品标签关联（P0）

### 修改文件

**文件**：`admin-web/src/views/Products.vue`（详情抽屉中新增 Tab）

### 功能要求

在商品详情抽屉中新增"标签"Tab：
- 按标签组分组展示（香型、产区、适用场景、年份）
- 每组显示当前已选标签（van-tag 可删除）
- 点击"添加标签"弹出选择器（按标签组筛选可选标签）
- 保存调用 `PUT /api/admin/products/:spuId/tags`

### 验收清单

- [ ] 商品详情中可查看已关联标签
- [ ] 可按标签组添加/删除标签
- [ ] 香型为单选，产区/场景为多选
- [ ] 保存后标签即时更新

---

## 10. 营销标签设置（P0）

### 修改文件

**文件**：`admin-web/src/views/Products.vue`（详情抽屉中或列表行操作）

### 功能要求

在商品详情抽屉或列表行操作中，增加营销标签设置：
- 6 个标签开关：新品、爆款、热销、推荐、限时特价、清仓
- 使用 van-checkbox-group 或 Element Plus el-checkbox-group
- 保存调用 `PUT /api/admin/products/:spuId/marketing-tags`

### 验收清单

- [ ] 营销标签 6 个开关可正常切换
- [ ] 保存后标签即时更新
- [ ] 列表页可看到营销标签标记

---

## 11. 批次追溯页面（P1）

### 新建页面

**文件**：`admin-web/src/views/InventoryBatches.vue`

### 功能要求

- **批次列表**：表格列（批次号、商品名称、生产日期、有效期、入库日期、库存数量、操作）
- **搜索筛选**：按商品名称/批次号搜索，按商品筛选
- **批次详情**：点击进入详情页，展示批次完整信息
- **追溯链**：时间线展示 采购→入库→出库→销售 全链路

追溯链 UI（时间线组件）：
```
采购单 PO-2026-001 (2026-01-15)
  └─ 入库 100 瓶 (2026-01-16)
      └─ 出库 30 瓶 → 销售单 SO-2026-001 (2026-01-20)
      └─ 出库 20 瓶 → 销售单 SO-2026-002 (2026-02-01)
      库存剩余 50 瓶
```

### 调用 API

```typescript
fetchBatches(params?: { spuId?: number; keyword?: string })
fetchBatchDetail(id: number)
fetchBatchTrace(id: number)
```

### 验收清单

- [ ] 批次列表页面完整（表格+搜索+筛选）
- [ ] 批次详情展示完整
- [ ] 追溯链时间线展示采购→入库→出库→销售链路
- [ ] 按商品筛选批次正常

---

## 路由+导航补充（Phase 3）

在 `admin-web/src/router/index.ts` 中新增：
- `/products/tags` → `TagGroups.vue`
- `/products/tags/:groupId` → `Tags.vue`
- `/inventory/batches` → `InventoryBatches.vue`

侧边栏"商品管理"子菜单追加：
- 标签管理 `/products/tags`

侧边栏"库存管理"或"商品管理"下追加：
- 批次追溯 `/inventory/batches`

---

## 验收总清单

### Phase 2
| 检查项 | 状态 |
|--------|:---:|
| Products.vue 表格列展示 SPU 全部 14 字段 | ☐ |
| Products.vue 展开行展示 SKU 全部 13 字段 + 价格 + 库存 | ☐ |
| 新增/编辑商品表单字段完整 | ☐ |
| ProductCategories.vue 字段含 icon/code | ☐ |
| Brands.vue 页面完整 | ☐ |
| Units.vue 页面完整 | ☐ |
| 商品详情抽屉分 Tab 展示（基本信息/SKU/价格历史） | ☐ |
| 主图上传功能正常 | ☐ |
| 商品详情富文本编辑器正常 | ☐ |
| ProductImport.vue 导入流程完整 | ☐ |
| 路由+导航+API 全部注册 | ☐ |

### Phase 3
| 检查项 | 状态 |
|--------|:---:|
| 标签组管理页面完整 | ☐ |
| 标签值管理页面完整 | ☐ |
| 商品详情中标签关联功能正常 | ☐ |
| 营销标签 6 个开关正常 | ☐ |
| 批次列表页面完整 | ☐ |
| 批次追溯链时间线展示完整 | ☐ |