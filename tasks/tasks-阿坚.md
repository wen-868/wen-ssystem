# 阿坚 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始
**验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证，不能遗漏任何字段

---

## 任务概览

| # | 任务 | 优先级 | 预计文件 | 状态 |
|---|------|--------|----------|------|
| 1 | DDL 修复 | P0 🔴 | 1个迁移SQL + 1个修正 | 待开始 |
| 2 | 分类 CRUD 后端 | P0 | 3个新文件 + 1个改动 | 待开始 |
| 3 | 商品详情接口 | P0 | 2个文件改动 | 待开始 |
| 4 | 品牌表 + 品牌 CRUD | P1 | 1个迁移SQL + 3个新文件 + 1个改动 | 待开始 |
| 5 | 单位表 + 单位 CRUD | P1 | 1个迁移SQL + 3个新文件 + 1个改动 | 待开始 |
| 6 | 商品列表接口字段完善 | P1 | 1个文件改动 | 待开始 |
| 7 | 商品导入接口 | P1 | 2个文件改动 | 待开始 |

---

## 1. DDL 修复（P0 🔴 阻塞，必须先做）

### 1.1 新建迁移文件

**文件**：`docs/migrations/add_product_spu_fields.sql`

```sql
-- 商品中心字段补齐（Phase 2）
ALTER TABLE product_spu
  ADD COLUMN IF NOT EXISTS brand VARCHAR(128) DEFAULT NULL COMMENT '品牌',
  ADD COLUMN IF NOT EXISTS unit VARCHAR(32) DEFAULT NULL COMMENT '单位',
  ADD COLUMN IF NOT EXISTS specs VARCHAR(256) DEFAULT NULL COMMENT '规格',
  ADD COLUMN IF NOT EXISTS sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  ADD COLUMN IF NOT EXISTS is_new TINYINT NOT NULL DEFAULT 0 COMMENT '新品标记',
  ADD COLUMN IF NOT EXISTS is_recommend TINYINT NOT NULL DEFAULT 0 COMMENT '推荐标记',
  ADD COLUMN IF NOT EXISTS description VARCHAR(512) DEFAULT NULL COMMENT '商品简介';

ALTER TABLE product_sku
  ADD COLUMN IF NOT EXISTS volume VARCHAR(32) DEFAULT NULL COMMENT '净含量（500ml/1L）',
  ADD COLUMN IF NOT EXISTS packaging VARCHAR(32) DEFAULT NULL COMMENT '包装类型（瓶装/罐装/桶装）';

ALTER TABLE product_category
  ADD COLUMN IF NOT EXISTS icon VARCHAR(256) DEFAULT NULL COMMENT '分类图标',
  ADD COLUMN IF NOT EXISTS code VARCHAR(64) DEFAULT NULL COMMENT '分类编码';
```

### 1.2 修正索引表名

**文件**：`docs/migrations/add_performance_indexes.sql`

将 `ALTER TABLE products` 全部改为 `ALTER TABLE product_spu`。

### 1.3 勘误 `init_database.sql` 和 `phase1_schema.sql`

在这些文件中同步补上 brand、unit、specs、sort_no、is_new、is_recommend、description 字段到 `product_spu` 的 DDL，同步补上 volume、packaging 到 `product_sku`，同步补上 icon、code 到 `product_category`。

---

## 2. 分类 CRUD 后端（P0）

### 2.1 新建 Service

**文件**：`backend/src/services/admin/category.service.ts`

```typescript
// 接口方法：
listCategories()        // SELECT * FROM product_category ORDER BY sort_no
createCategory(data)    // INSERT INTO product_category
updateCategory(id,data) // UPDATE product_category SET ... WHERE id=?
deleteCategory(id)      // DELETE FROM product_category WHERE id=?（检查无子分类和无商品引用）
updateSort(id, sortNo)  // UPDATE product_category SET sort_no=? WHERE id=?
```

- 返回字段：id, parent_id, name, icon, code, sort_no, status, created_at, updated_at
- 删除校验：有子分类时禁止删除，有商品引用时禁止删除

### 2.2 新建 Controller

**文件**：`backend/src/controllers/admin/category.controller.ts`

```typescript
// 方法：
listCategories(req, res)      // GET
createCategory(req, res)      // POST
updateCategory(req, res)      // PUT /:id
deleteCategory(req, res)      // DELETE /:id
updateSort(req, res)          // PUT /:id/sort
```

### 2.3 新建路由

**文件**：`backend/src/routes/category.routes.ts`

```typescript
import { Router } from 'express';
import * as categoryController from '../controllers/admin/category.controller';
import { requireAuthWithTenant } from '../middleware/auth';

const router = Router();
router.get('/', requireAuthWithTenant, categoryController.listCategories);
router.post('/', requireAuthWithTenant, categoryController.createCategory);
router.put('/:id', requireAuthWithTenant, categoryController.updateCategory);
router.delete('/:id', requireAuthWithTenant, categoryController.deleteCategory);
router.put('/:id/sort', requireAuthWithTenant, categoryController.updateSort);
export default router;
```

### 2.4 注册到 server.ts

**文件**：`backend/src/server.ts`

在 `/api/admin/products` 路由组下新增：
```typescript
import categoryRoutes from './routes/category.routes';
// 放在 adminRoutes 之前或之后
app.use('/api/admin/products/categories', categoryRoutes);
```

### 验收清单

- [ ] `GET /api/admin/products/categories` 返回分类树
- [ ] `POST /api/admin/products/categories` 新建分类
- [ ] `PUT /api/admin/products/categories/:id` 编辑分类
- [ ] `DELETE /api/admin/products/categories/:id` 删除分类（含校验）
- [ ] `PUT /api/admin/products/categories/:id/sort` 拖拽排序
- [ ] 返回字段与 `product_category` 表一致（含 icon/code）

---

## 3. 商品详情接口（P0）

### 3.1 新增 Service 方法

**文件**：`backend/src/services/admin/product.service.ts`

新增方法 `getProductDetail(spuId: number)`：

```typescript
async getProductDetail(spuId: number) {
  // 1. 查 product_spu（JOIN product_category 取 categoryName）
  // 2. 查 product_sku WHERE spu_id = ?（所有 SKU）
  // 3. 查 product_price WHERE sku_id IN (...)
  // 4. 组装返回
}
```

返回格式：
```json
{
  "spuId": 1,
  "spuCode": "SPU001",
  "name": "茅台飞天",
  "categoryId": 1,
  "categoryName": "白酒",
  "brand": "茅台",
  "unit": "瓶",
  "specs": "500ml",
  "alcoholContent": 53.0,
  "origin": "贵州茅台镇",
  "mainImage": "...",
  "imageUrls": ["..."],
  "detail": "富文本内容",
  "saleChannels": ["STORE", "MINIAPP"],
  "status": "ON_SALE",
  "sortNo": 0,
  "isNew": false,
  "isRecommend": true,
  "description": "经典酱香",
  "skus": [
    {
      "skuId": 1,
      "skuCode": "SKU001",
      "barcode": "6901234567890",
      "skuName": "500ml",
      "volume": "500ml",
      "packaging": "瓶装",
      "baseUnit": "瓶",
      "boxUnit": "箱",
      "boxRatio": 6,
      "temperature": "AMBIENT",
      "traceEnabled": true,
      "warningThreshold": 10,
      "price": {
        "costPrice": 800.00,
        "retailPrice": 1499.00,
        "wholesalePrice": 1200.00,
        "miniappPrice": 1399.00,
        "storePrice": 1499.00
      }
    }
  ]
}
```

### 3.2 新增 Controller 方法

**文件**：`backend/src/controllers/admin/product.controller.ts`

新增 `getProductDetail(req, res)`。

### 3.3 新增路由

**文件**：`backend/src/routes/admin.routes.ts`

新增：`adminRouter.get('/products/:spuId', ..., productController.getProductDetail);`

> 注意：这条路由必须在 `PUT /products/:id` 和 `PUT /products/:id/status` 之前注册，避免 `:spuId` 被 `:id` 拦截。

### 验收清单

- [ ] `GET /api/admin/products/:spuId` 返回完整 SPU+SKU+价格
- [ ] 返回字段与审计报告 3.1 节一致
- [ ] 含 categoryName（JOIN 查询）

---

## 4. 品牌表 + 品牌 CRUD（P1）

### 4.1 新建迁移文件

**文件**：`docs/migrations/add_brand_table.sql`

```sql
CREATE TABLE IF NOT EXISTS brand (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL COMMENT '品牌名称',
  logo VARCHAR(512) DEFAULT NULL COMMENT '品牌Logo',
  description VARCHAR(255) DEFAULT NULL COMMENT '品牌描述',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='品牌表';
```

### 4.2 新建 Service / Controller / 路由

参照分类 CRUD 模式：
- `backend/src/services/admin/brand.service.ts`
- `backend/src/controllers/admin/brand.controller.ts`
- `backend/src/routes/brand.routes.ts`
- 在 `server.ts` 注册：`app.use('/api/admin/brands', brandRoutes)`

接口：`GET /api/admin/brands`、`POST`、`PUT /:id`、`DELETE /:id`

### 验收清单

- [ ] 品牌表创建成功
- [ ] CRUD 接口全部可用
- [ ] 返回字段：id, name, logo, description, sort_no, status

---

## 5. 单位表 + 单位 CRUD（P1）

### 5.1 新建迁移文件

**文件**：`docs/migrations/add_unit_table.sql`

```sql
CREATE TABLE IF NOT EXISTS unit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(32) NOT NULL COMMENT '单位名称（瓶/箱/件/桶）',
  code VARCHAR(32) NOT NULL COMMENT '单位编码',
  type VARCHAR(16) NOT NULL DEFAULT 'BASE' COMMENT 'BASE基础单位/BOX组合单位',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='单位表';
```

### 5.2 新建 Service / Controller / 路由

参照分类 CRUD 模式：
- `backend/src/services/admin/unit.service.ts`
- `backend/src/controllers/admin/unit.controller.ts`
- `backend/src/routes/unit.routes.ts`
- 在 `server.ts` 注册：`app.use('/api/admin/units', unitRoutes)`

接口：`GET /api/admin/units`、`POST`、`PUT /:id`、`DELETE /:id`

### 验收清单

- [ ] 单位表创建成功
- [ ] CRUD 接口全部可用
- [ ] 返回字段：id, name, code, type, sort_no, status

---

## 6. 商品列表接口字段完善（P1）

### 修改文件

**文件**：`backend/src/services/admin/product.service.ts`

修改 `listProducts` 方法：

1. SELECT 子句补全 `product_spu` 所有字段（含 brand/unit/specs/sort_no/is_new/is_recommend/description）
2. JOIN `product_category` 取 `category_name`
3. 子查询/JOIN 取每个 SKU 的 `retailPrice`、`wholesalePrice`、`availableQty`

确保返回字段：
```
spuId, spuCode, name, categoryId, categoryName, brand, unit, specs,
alcoholContent, origin, mainImage, imageUrls, detail, saleChannels,
status, sortNo, isNew, isRecommend, description,
skus: [{ skuId, skuCode, barcode, skuName, volume, packaging,
         baseUnit, boxUnit, boxRatio, temperature, traceEnabled,
         warningThreshold, retailPrice, wholesalePrice, availableQty }]
```

### 验收清单

- [ ] `GET /api/admin/products` 返回字段完整
- [ ] 含 categoryName（JOIN 查询）
- [ ] 每个 SKU 含 price 和 availableQty

---

## 7. 商品导入接口（P1）

### 新增方法

**文件**：`backend/src/services/admin/product.service.ts`

新增 `importProducts(file)` 方法：
- 解析 CSV/Excel 文件
- 逐行校验（必填字段、条码唯一性）
- 批量 INSERT（事务）
- 返回成功/失败行数 + 错误详情

### 新增路由

**文件**：`backend/src/routes/admin.routes.ts`

新增：`adminRouter.post('/products/import', ..., productController.importProducts);`

### 验收清单

- [ ] `POST /api/admin/products/import` 接收文件上传
- [ ] 返回导入结果（成功X行，失败Y行，错误详情）

---

## 验收总清单

| 检查项 | 状态 |
|--------|:---:|
| `product_spu` 表字段完整（brand/unit/specs/sort_no/is_new/is_recommend/description） | ☐ |
| `product_sku` 表字段完整（volume/packaging） | ☐ |
| `product_category` 表字段完整（icon/code） | ☐ |
| `add_performance_indexes.sql` 表名已修正 | ☐ |
| 分类 CRUD 5 个接口可用 | ☐ |
| 商品详情接口 `GET /api/admin/products/:spuId` 返回完整 | ☐ |
| 品牌表 + CRUD 4 个接口可用 | ☐ |
| 单位表 + CRUD 4 个接口可用 | ☐ |
| 商品列表接口返回字段完整 | ☐ |
| 商品导入接口可用 | ☐ |
| 所有接口字段与 `tasks/field-audit-product-center.md` 一致 | ☐ |