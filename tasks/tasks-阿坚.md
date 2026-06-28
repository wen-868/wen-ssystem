# 阿坚 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | 分类 CRUD 后端 API | P0 | 待开始 |
| 2 | 商品详情接口 | P0 | 待开始 |
| 3 | 品牌管理后端 | P1 | 待开始 |
| 4 | 单位管理后端 | P1 | 待开始 |
| 5 | 商品列表接口字段完善 | P1 | 待开始 |

---

## 1. 分类 CRUD 后端 API（P0）

**现状**：`admin-web/src/views/ProductCategories.vue` 调用了以下 API，但后端**完全没有对应路由**：
- `GET /api/admin/products/categories` — 分类列表
- `POST /api/admin/products/categories` — 新增分类
- `PUT /api/admin/products/categories/:id` — 编辑分类
- `DELETE /api/admin/products/categories/:id` — 删除分类
- `PUT /api/admin/products/categories/:id/sort` — 排序

**数据表**：`product_category`（已存在，字段：id, parent_id, name, sort_no, status）

**要求**：
- 在 `backend/src/routes/` 下新建 `category.routes.ts`
- 在 `backend/src/controllers/admin/` 下新建 `category.controller.ts`
- 在 `backend/src/services/admin/` 下新建 `category.service.ts`
- 在 `backend/src/server.ts` 注册路由（前缀 `/api/admin/products`）
- 支持两级分类树（parent_id 为 null 或 0 表示一级）
- 排序接口支持拖拽后的批量更新

---

## 2. 商品详情接口（P0）

**现状**：无单独的商品详情查询接口，目前仅有列表接口返回简要信息。

**要求**：
- `GET /api/admin/products/:spuId` — 返回完整 SPU 信息 + 所有 SKU + 价格
- 在 `product.controller.ts` 和 `product.service.ts` 中新增方法
- 返回格式：
```json
{
  "spuId": 1,
  "spuCode": "SPU001",
  "name": "茅台飞天",
  "categoryId": 1,
  "categoryName": "白酒",
  "brand": "茅台",
  "mainImage": "...",
  "saleChannels": ["STORE", "MINIAPP"],
  "status": "ON_SALE",
  "skus": [
    {
      "skuId": 1,
      "skuCode": "SKU001",
      "barcode": "6901234567890",
      "skuName": "500ml",
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

---

## 3. 品牌管理后端（P1）

**现状**：品牌字段仅作为 `product_spu` 的字符串字段，无独立品牌表和管理接口。

**要求**：
- 新建 `brand` 表（id, name, logo, description, sort_no, status, created_at, updated_at）
- 新建 `backend/src/routes/brand.routes.ts`
- 新建 `backend/src/controllers/admin/brand.controller.ts`
- 新建 `backend/src/services/admin/brand.service.ts`
- 在 `server.ts` 注册路由（前缀 `/api/admin/brands`）
- 接口：`GET /api/admin/brands`（列表+搜索）、`POST`、`PUT /:id`、`DELETE /:id`
- 创建商品时品牌改为下拉选择（从 brand 表获取）

---

## 4. 单位管理后端（P1）

**现状**：单位字段仅作为 `product_sku` 的字符串字段（base_unit/box_unit），无独立单位表和管理接口。

**要求**：
- 新建 `unit` 表（id, name, code, type ['BASE','BOX'], sort_no, status, created_at, updated_at）
- 新建 `backend/src/routes/unit.routes.ts`
- 新建 `backend/src/controllers/admin/unit.controller.ts`
- 新建 `backend/src/services/admin/unit.service.ts`
- 在 `server.ts` 注册路由（前缀 `/api/admin/units`）
- 接口：`GET /api/admin/units`、`POST`、`PUT /:id`、`DELETE /:id`
- 创建商品时单位改为下拉选择

---

## 5. 商品列表接口字段完善（P1）

**现状**：`admin-web/src/views/Products.vue` 使用 `skuCode`/`productName` 等扁平字段，但后端返回 `spuId`/`skuId`/`name`/`skuName` 结构，字段不匹配。

**要求**：
- 检查 `GET /api/admin/products` 返回格式
- 确保列表接口返回 `categoryName`（JOIN product_category）
- 确保每个 SKU 附带 `retailPrice`、`wholesalePrice`、`availableQty`
- 确保返回字段与前端 `Products.vue` 消费的字段一致