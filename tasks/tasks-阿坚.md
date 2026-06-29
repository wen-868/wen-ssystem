# 阿坚 · 销售管理模块 · 后端

**日期**：2026-06-29
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 分享收款 — H5支付页 API | P0⭐⭐ | ❌ |
| 2 | 分享收款 — 微信支付回调改造 | P0⭐⭐ | ❌ |
| 3 | 分享链接管理增强（批量/撤销/统计） | P0 | ❌ |
| 4 | 价格策略 — 客户专属价格 API | P1 | ❌ |
| 5 | 销售提成 — DDL + 提成规则 CRUD | P1 | ❌ |
| 6 | 销售提成 — 计算引擎 | P1 | ❌ |
| 7 | 销售报表 — 排名/排行 API | P1 | ❌ |

---

## 详细说明

### 1. 分享收款 — H5支付页 API
- **现状**：`share.service.ts` 已有 `getCollectionLink` 返回链接详情，`payCollection` 返回 dev mock 支付参数
- **需要**：新增 `GET /api/share/collections/:token/page` 返回 H5 页面所需数据（商品明细、金额、过期时间、客户信息）
- **文件**：`backend/src/services/share.service.ts`、`backend/src/routes/share.routes.ts`

### 2. 分享收款 — 微信支付回调
- **现状**：`payCollection` 返回 `prepay_id=dev` 的 mock 数据
- **需要**：对接微信 JSAPI 支付（统一下单 → 返回 prepay_id → 支付回调 → 更新 sale_bill 状态）
- **新增路由**：`POST /api/share/collections/:token/wx-notify` 微信支付回调
- **文件**：`backend/src/services/share.service.ts`、`backend/src/routes/share.routes.ts`

### 3. 分享链接管理增强
- **现状**：`createCollectionLink` 已实现单条生成，但无法批量操作
- **需要**：
  - `POST /api/admin/sale-bills/batch-collection-link` — 批量生成分享链接
  - `POST /api/admin/collection-links/:linkNo/revoke` — 撤销分享链接
  - `GET /api/admin/collection-links/stats` — 分享统计（总次数/收款率/渠道分布）
- **文件**：`backend/src/services/admin/sale-bill.service.ts`、`backend/src/routes/admin.routes.ts`

### 4. 价格策略 — 客户专属价格 API
- **现状**：无客户专属价格，仅有价格等级 `price_level` 字段
- **需要**：
  - DDL：`customer_price` 表（customer_id, sku_id, custom_price, effective_start, effective_end）
  - `GET/POST/PUT/DELETE /api/admin/customer-prices` — 客户专属价格 CRUD
  - 销售开单时自动取客户专属价格（优先于价格等级）
- **文件**：`docs/migrations/add_customer_price.sql`、`backend/src/services/admin/customer-price.service.ts`、`backend/src/controllers/admin/customer-price.controller.ts`、`backend/src/routes/customer-price.routes.ts`

### 5. 销售提成 — DDL + 提成规则 CRUD
- **现状**：完全未实现
- **需要**：
  - DDL：`sales_commission_rule` 表（rule_name, rule_type[FIXED_AMOUNT/FIXED_RATE/TIERED], config JSON, effective_start, effective_end, status）
  - DDL：`sales_commission_record` 表（bill_no, staff_id, commission_amount, rule_id, status, settled_at）
  - 规则 CRUD：`GET/POST/PUT/DELETE /api/admin/commission-rules`
  - 规则类型：固定金额/固定比例/阶梯提成
- **文件**：`docs/migrations/add_sales_commission.sql`、`backend/src/services/admin/commission.service.ts`、`backend/src/controllers/admin/commission.controller.ts`、`backend/src/routes/commission.routes.ts`

### 6. 销售提成 — 计算引擎
- **需要**：
  - `POST /api/admin/commission/calculate` — 手动触发提成计算（按日期范围）
  - `POST /api/admin/commission/settle` — 提成结算
  - `GET /api/admin/commission/records` — 提成记录列表
  - 自动计算：销售单完成时触发提成计算
- **文件**：`backend/src/services/admin/commission.service.ts`

### 7. 销售报表 — 排名/排行 API
- **现状**：有 `dashboard` 基础数据，无专项排名
- **需要**：
  - `GET /api/admin/reports/sales-ranking` — 销售人员排名（销售额/毛利/订单数）
  - `GET /api/admin/reports/product-ranking` — 商品销售排行（销量/销售额/毛利）
  - `GET /api/admin/reports/sales-trend` — 销售趋势（按日/周/月）
- **文件**：`backend/src/services/admin/report.service.ts`、`backend/src/routes/admin.routes.ts`