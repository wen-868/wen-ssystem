# 阿坚 · Phase 3 商品中心收尾

**日期**：2026-06-29
**状态**：待开始
**验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证

---

## 任务概览

| # | 任务 | 优先级 | 预计文件 | 状态 |
|---|------|--------|----------|------|
| 1 | 标签体系 DDL | P0 | 1 个迁移 SQL | 待开始 |
| 2 | 标签 CRUD API | P0 | 3 个新文件 + 1 个改动 | 待开始 |
| 3 | 营销标签字段 + API | P0 | 1 个迁移 SQL + 2 个改动 | 待开始 |
| 4 | 批次追溯 API | P1 | 1 个新路由 | 待开始 |

---

## 1. 标签体系 DDL（P0）

### 新建文件

**文件**：`docs/migrations/add_product_tags.sql`

```sql
-- 标签组（如：香型、产区、适用场景、年份）
CREATE TABLE IF NOT EXISTS product_tag_group (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL COMMENT '标签组名称',
  code VARCHAR(64) NOT NULL COMMENT '标签组编码',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  is_multiple TINYINT NOT NULL DEFAULT 1 COMMENT '是否多选：1多选 0单选',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='商品标签组表';

-- 标签值（如：酱香型、浓香型、茅台镇、自饮）
CREATE TABLE IF NOT EXISTS product_tag (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL COMMENT '标签组ID',
  name VARCHAR(64) NOT NULL COMMENT '标签名称',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES product_tag_group(id)
) COMMENT='商品标签值表';

-- 商品-标签关联
CREATE TABLE IF NOT EXISTS product_tag_relation (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  spu_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  tag_id BIGINT UNSIGNED NOT NULL COMMENT '标签ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_spu_tag (spu_id, tag_id),
  FOREIGN KEY (spu_id) REFERENCES product_spu(id),
  FOREIGN KEY (tag_id) REFERENCES product_tag(id)
) COMMENT='商品标签关联表';

-- 预置标签组数据
INSERT INTO product_tag_group (name, code, sort_no, is_multiple) VALUES
  ('香型', 'aroma_type', 1, 0),
  ('产区', 'region', 2, 1),
  ('适用场景', 'scene', 3, 1),
  ('年份', 'vintage', 4, 0);

-- 预置香型标签
INSERT INTO product_tag (group_id, name, sort_no) VALUES
  (1, '酱香型', 1), (1, '浓香型', 2), (1, '清香型', 3),
  (1, '米香型', 4), (1, '兼香型', 5), (1, '凤香型', 6);

-- 预置产区标签
INSERT INTO product_tag (group_id, name, sort_no) VALUES
  (2, '茅台镇', 1), (2, '宜宾', 2), (2, '泸州', 3),
  (2, '汾阳', 4), (2, '宿迁', 5), (2, '亳州', 6);

-- 预置场景标签
INSERT INTO product_tag (group_id, name, sort_no) VALUES
  (3, '自饮', 1), (3, '宴请', 2), (3, '送礼', 3),
  (3, '收藏', 4), (3, '商务', 5);

-- 预置年份标签
INSERT INTO product_tag (group_id, name, sort_no) VALUES
  (4, '2025', 1), (4, '2024', 2), (4, '2023', 3),
  (4, '2020', 4), (4, '老年份', 5);
```

### 验收清单

- [ ] `product_tag_group` 表创建成功
- [ ] `product_tag` 表创建成功
- [ ] `product_tag_relation` 表创建成功
- [ ] 预置数据（4 组 + 22 个标签）插入成功

---

## 2. 标签 CRUD API（P0）

### 2.1 新建 Service

**文件**：`backend/src/services/admin/tag.service.ts`

```typescript
// 标签组管理
listGroups()              // SELECT * FROM product_tag_group ORDER BY sort_no
createGroup(data)         // INSERT INTO product_tag_group
updateGroup(id, data)     // UPDATE product_tag_group
deleteGroup(id)           // DELETE（检查无标签引用）

// 标签值管理
listTags(groupId?)        // SELECT * FROM product_tag WHERE group_id=? ORDER BY sort_no
createTag(data)           // INSERT INTO product_tag
updateTag(id, data)       // UPDATE product_tag
deleteTag(id)             // DELETE（检查无商品引用）

// 商品标签关联
getProductTags(spuId)     // SELECT t.*, g.name AS groupName FROM product_tag_relation r JOIN product_tag t ON r.tag_id=t.id JOIN product_tag_group g ON t.group_id=g.id WHERE r.spu_id=?
setProductTags(spuId, tagIds: number[])  // 全量替换（DELETE 旧 + INSERT 新）
```

### 2.2 新建 Controller

**文件**：`backend/src/controllers/admin/tag.controller.ts`

### 2.3 新建路由

**文件**：`backend/src/routes/tag.routes.ts`

```typescript
// 标签组
router.get('/groups', ...)           // 列表
router.post('/groups', ...)          // 新建
router.put('/groups/:id', ...)       // 编辑
router.delete('/groups/:id', ...)    // 删除

// 标签值
router.get('/tags', ...)             // 列表（支持 ?groupId=）
router.post('/tags', ...)            // 新建
router.put('/tags/:id', ...)         // 编辑
router.delete('/tags/:id', ...)      // 删除

// 商品标签关联
router.get('/products/:spuId/tags', ...)    // 获取商品标签
router.put('/products/:spuId/tags', ...)    // 设置商品标签
```

### 2.4 注册到 server.ts

```typescript
app.use('/api/admin', tagRouter);
```

### 验收清单

- [ ] 标签组 CRUD 4 个接口可用
- [ ] 标签值 CRUD 4 个接口可用
- [ ] 商品标签关联 2 个接口可用
- [ ] 删除标签组时检查标签引用
- [ ] 删除标签时检查商品引用

---

## 3. 营销标签字段 + API（P0）

### 3.1 迁移文件

**文件**：`docs/migrations/add_marketing_tags.sql`

```sql
ALTER TABLE product_spu
  ADD COLUMN IF NOT EXISTS marketing_tags JSON DEFAULT NULL COMMENT '营销标签：["NEW","HOT","RECOMMEND","LIMITED","CLEARANCE"]';
```

### 3.2 更新 product.service.ts

**文件**：`backend/src/services/admin/product.service.ts`

- `listProducts` 和 `getProductDetail` 的 SELECT 子句加入 `marketing_tags`
- 新增方法 `setMarketingTags(spuId, tags: string[])`

### 3.3 更新 product.controller.ts + admin.routes.ts

新增路由：`PUT /api/admin/products/:spuId/marketing-tags`

### 验收清单

- [ ] `product_spu.marketing_tags` 字段存在
- [ ] `GET /products` 返回 marketing_tags
- [ ] `PUT /products/:spuId/marketing-tags` 可用
- [ ] 支持标签值：NEW, HOT, RECOMMEND, LIMITED, CLEARANCE

---

## 4. 批次追溯 API（P1）

### 新增路由文件

**文件**：`backend/src/routes/inventory-batch.routes.ts`（如果已有则扩展）

```typescript
// 批次管理
router.get('/batches', ...)              // 列表（支持 ?spuId=&keyword=）
router.get('/batches/:id', ...)          // 详情
router.get('/batches/:id/trace', ...)    // 追溯链（从采购→入库→出库→销售）
router.get('/products/:spuId/batches', ...)  // 某商品的所有批次
```

### 新增 Service

**文件**：`backend/src/services/admin/inventory-batch.service.ts`

- `listBatches(spuId?, keyword?)` — 批次列表
- `getBatchDetail(id)` — 批次详情
- `getTraceChain(id)` — 追溯链查询（JOIN purchase_in_stock, sale_bills 等）

### 验收清单

- [ ] 批次列表接口可用
- [ ] 批次详情接口可用
- [ ] 追溯链接口可用（含采购→入库→出库→销售链路）
- [ ] 按商品筛选批次

---

## 验收总清单

| 检查项 | 状态 |
|--------|:---:|
| 标签体系 3 张表创建成功 + 预置数据 | ☐ |
| 标签组 CRUD 4 接口可用 | ☐ |
| 标签值 CRUD 4 接口可用 | ☐ |
| 商品标签关联 2 接口可用 | ☐ |
| product_spu.marketing_tags 字段存在 | ☐ |
| 营销标签接口可用 | ☐ |
| 批次列表/详情/追溯链接口可用 | ☐ |
| 所有接口字段与审计报告一致 | ☐ |