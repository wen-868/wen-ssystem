# 阿坚 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始
**验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | DDL 修复：product_spu 补字段 + 索引表名修正 | P0 🔴 | 待开始 |
| 2 | 分类 CRUD 后端 API | P0 | 待开始 |
| 3 | 商品详情接口 | P0 | 待开始 |
| 4 | 品牌表 + 品牌管理 CRUD | P1 | 待开始 |
| 5 | 单位表 + 单位管理 CRUD | P1 | 待开始 |
| 6 | 商品列表接口字段完善 | P1 | 待开始 |
| 7 | 商品导入接口 | P1 | 待开始 |

---

## 1. DDL 修复（P0 🔴 阻塞）

### 1.1 product_spu 补字段

**问题**：代码中 `product.service.ts` 直接读写 `brand`、`unit`、`specs` 字段，但 DDL 从未定义，运行时会报错。

**SQL 迁移脚本**：
```sql
ALTER TABLE product_spu
  ADD COLUMN brand VARCHAR(128) DEFAULT NULL COMMENT '品牌',
  ADD COLUMN unit VARCHAR(32) DEFAULT NULL COMMENT '单位',
  ADD COLUMN specs VARCHAR(256) DEFAULT NULL COMMENT '规格',
  ADD COLUMN sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  ADD COLUMN is_new TINYINT NOT NULL DEFAULT 0 COMMENT '新品标记',
  ADD COLUMN is_recommend TINYINT NOT NULL DEFAULT 0 COMMENT '推荐标记',
  ADD COLUMN description VARCHAR(512) DEFAULT NULL COMMENT '商品简介';
```

### 1.2 product_sku 补字段

```sql
ALTER TABLE product_sku
  ADD COLUMN volume VARCHAR(32) DEFAULT NULL COMMENT '净含量（500ml/1L）',
  ADD COLUMN packaging VARCHAR(32) DEFAULT NULL COMMENT '包装类型（瓶装/罐装/桶装）';
```

### 1.3 product_category 补字段

```sql
ALTER TABLE product_category
  ADD COLUMN icon VARCHAR(256) DEFAULT NULL COMMENT '分类图标',
  ADD COLUMN code VARCHAR(64) DEFAULT NULL COMMENT '分类编码';
```

### 1.4 索引表名修正

`docs/migrations/add_performance_indexes.sql` 中 `products` → `product_spu`。

---

## 2. 分类 CRUD 后端 API（P0）

**现状**：`admin-web/src/views/ProductCategories.vue`（440行）调用的 API 后端完全不存在。

**要求**：
- 新建 `backend/src/routes/category.routes.ts`
- 新建 `backend/src/controllers/admin/category.controller.ts`
- 新建 `backend/src/services/admin/category.service.ts`
- 在 `server.ts` 注册路由
- 接口：`GET /api/admin/products/categories`、`POST`、`PUT /:id`、`DELETE /:id`、`PUT /:id/sort`
- 支持两级分类树，返回字段与 `product_category` 表一致（含 icon/code 补字段后）

---

## 3. 商品详情接口（P0）

`GET /api/admin/products/:spuId` — 返回完整 SPU + 所有 SKU + 价格，字段对照审计报告 3.1 节。

---

## 4. 品牌表 + 品牌管理 CRUD（P1）

- 新建 `brand` 表（id, name, logo, description, sort_no, status, created_at, updated_at）
- CRUD 路由 `/api/admin/brands`
- 字段对照审计报告 3.3 节

---

## 5. 单位表 + 单位管理 CRUD（P1）

- 新建 `unit` 表（id, name, code, type, sort_no, status, created_at, updated_at）
- CRUD 路由 `/api/admin/units`
- 字段对照审计报告 3.2 节

---

## 6. 商品列表接口字段完善（P1）

确保 `GET /api/admin/products` 返回字段与 `product_spu` 表一致（含 brand/unit/specs/sort_no/is_new/is_recommend/description 补字段后）。

---

## 7. 商品导入接口（P1）

`POST /api/admin/products/import` — 支持 CSV/Excel 批量导入商品。

---

**验收标准**：所有接口返回字段与 `tasks/field-audit-product-center.md` 审计报告一致，无遗漏。