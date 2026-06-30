# 阿坚 . 营销中心模块 . 后端开发

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 统一营销路由架构 | P1 | PENDING |
| 2 | 限时折扣API | P1 | PENDING |
| 3 | 满赠规则API | P1 | PENDING |
| 4 | 积分商城API | P1 | PENDING |
| 5 | 营销看板API | P1 | PENDING |
| 6 | 营销素材库API | P1 | PENDING |

> 跳过的P2模块：秒杀拼团、社群营销（已有基础CRUD，本次不扩展）

---

## 详细说明

### 1. 统一营销路由架构

- **接口/文件**：
  - `backend/src/routes/marketing.routes.ts` -- 合并后的统一路由文件
  - `backend/src/server.ts` -- 更新路由挂载
- **关键说明**：
  - 合并 `marketing.routes.ts`（旧版，含 coupon/full-reduction/points/flash-sale/group-buy/stack-rule/calculation）
    和 `marketing-new.routes.ts`（新版，含 coupons/promotions/calculate-discount）为统一的营销路由文件
  - 消除重复端点：旧版 `/coupons/templates` 与新版 `/coupons` 功能重叠，合并为统一路径
  - 统一挂载前缀 `/api/admin/marketing`，结构清晰，按二级模块分组
  - 路由分组结构：
    - `/api/admin/marketing/coupons/*` -- 优惠券
    - `/api/admin/marketing/limited-discounts/*` -- 限时折扣
    - `/api/admin/marketing/gift-rules/*` -- 满赠规则
    - `/api/admin/marketing/full-reductions/*` -- 满减
    - `/api/admin/marketing/points/*` -- 积分
    - `/api/admin/marketing/points-mall/*` -- 积分商城
    - `/api/admin/marketing/dashboard/*` -- 营销看板
    - `/api/admin/marketing/materials/*` -- 营销素材库
    - `/api/admin/marketing/stack-rules/*` -- 活动叠加
    - `/api/admin/marketing/calculate/*` -- 优惠试算
  - 删除 `marketing-new.routes.ts` 文件，清理 `server.ts` 中对应导入
  - 保留并对齐所有现有端点功能，确保向后兼容

---

### 2. 限时折扣API

- **接口/文件**：
  - `docs/migrations/add_marketing_p1.sql` -- 新增 `limited_discount` 表DDL
  - `backend/src/controllers/admin/marketing-limited-discount.controller.ts` -- 控制器
  - `backend/src/services/admin/marketing-limited-discount.service.ts` -- 服务层
  - `backend/src/routes/marketing.routes.ts` -- 路由注册
- **关键字段**（~40字段）：
  - 活动基础：`activity_code`, `activity_name`, `activity_desc`, `start_time`, `end_time`
  - 折扣规则：`discount_type` (PERCENT/FIXED), `discount_value`, `min_purchase`
  - 适用范围：`applicable_scope` (ALL/CATEGORY/PRODUCT), `applicable_ids` (JSON)
  - 库存控制：`total_stock`, `available_stock`, `limit_per_user`, `per_order_limit`
  - 状态管理：`status` (DRAFT/PENDING/ACTIVE/PAUSED/ENDED/SOLD_OUT)
  - 参与统计：`participant_count`, `total_sales_amount`
  - 租户隔离：`tenant_id`, `created_by`, `created_at`, `updated_at`
- **API端点**：
  - `POST /api/admin/marketing/limited-discounts` -- 创建限时折扣
  - `GET /api/admin/marketing/limited-discounts` -- 列表查询（支持分页/状态/时间筛选）
  - `GET /api/admin/marketing/limited-discounts/:id` -- 详情
  - `PUT /api/admin/marketing/limited-discounts/:id` -- 更新
  - `DELETE /api/admin/marketing/limited-discounts/:id` -- 删除
  - `POST /api/admin/marketing/limited-discounts/:id/activate` -- 启用
  - `POST /api/admin/marketing/limited-discounts/:id/pause` -- 停用
  - `GET /api/admin/marketing/limited-discounts/:id/products` -- 查询参与商品列表
  - `POST /api/admin/marketing/limited-discounts/:id/products` -- 添加参与商品
  - `DELETE /api/admin/marketing/limited-discounts/:id/products/:productId` -- 移除参与商品
- **说明**：
  - 需要商品关联中间表 `limited_discount_product`（discount_id, product_id, discount_price, original_price, stock, sold_count）
  - 启用时校验商品库存充足、时间范围有效
  - 支持定时生效/失效（创建时设置 start_time/end_time）
  - 库存扣减需事务保证原子性

---

### 3. 满赠规则API

- **接口/文件**：
  - `docs/migrations/add_marketing_p1.sql` -- 新增 `gift_rule` 表DDL
  - `backend/src/controllers/admin/marketing-gift-rule.controller.ts` -- 控制器
  - `backend/src/services/admin/marketing-gift-rule.service.ts` -- 服务层
  - `backend/src/routes/marketing.routes.ts` -- 路由注册
- **关键字段**（~40字段）：
  - 规则基础：`rule_code`, `rule_name`, `rule_desc`, `start_time`, `end_time`
  - 满赠条件：`threshold_amount` (满X元), `threshold_quantity` (满X件), `threshold_type` (AMOUNT/QUANTITY/BOTH)
  - 赠品信息：`gift_product_id`, `gift_quantity`, `gift_sku_id` (可选)
  - 适用范围：`applicable_scope`, `applicable_ids` (JSON)
  - 层级规则：支持多级满赠（满100赠A，满200赠B），通过 `gift_rule_level` 子表实现
  - 库存联动：`gift_stock_limit`, `remain_gift_stock`, `is_stock_synced`
  - 状态管理：`status` (DRAFT/ACTIVE/PAUSED/ENDED/DEPLETED)
  - 参与统计：`participant_count`, `gift_sent_count`
  - 租户隔离：`tenant_id`, `created_by`, `created_at`, `updated_at`
- **API端点**：
  - `POST /api/admin/marketing/gift-rules` -- 创建满赠规则
  - `GET /api/admin/marketing/gift-rules` -- 列表查询
  - `GET /api/admin/marketing/gift-rules/:id` -- 详情（含层级列表）
  - `PUT /api/admin/marketing/gift-rules/:id` -- 更新
  - `DELETE /api/admin/marketing/gift-rules/:id` -- 删除
  - `POST /api/admin/marketing/gift-rules/:id/activate` -- 启用
  - `POST /api/admin/marketing/gift-rules/:id/pause` -- 停用
  - `POST /api/admin/marketing/gift-rules/:id/levels` -- 添加满赠层级
  - `PUT /api/admin/marketing/gift-rules/:id/levels/:levelId` -- 更新层级
  - `DELETE /api/admin/marketing/gift-rules/:id/levels/:levelId` -- 删除层级
- **说明**：
  - 子表 `gift_rule_level`（rule_id, threshold_amount, gift_product_id, gift_quantity, sort_order）
  - 启用时校验赠品库存充足，库存不足提示管理员
  - 下单时通过优惠计算引擎匹配满赠规则，自动添加赠品到订单
  - 赠品库存实时扣减，规则过期/停用后恢复库存

---

### 4. 积分商城API

- **接口/文件**：
  - `docs/migrations/add_marketing_p1.sql` -- 新增 `points_product` + `points_exchange_record` 表DDL
  - `backend/src/controllers/admin/marketing-points-mall.controller.ts` -- 控制器
  - `backend/src/services/admin/marketing-points-mall.service.ts` -- 服务层
  - `backend/src/routes/marketing.routes.ts` -- 路由注册
- **关键字段**：
  - `points_product`（~20字段）：
    - `product_code`, `product_name`, `product_image`, `product_desc`
    - `points_required` (所需积分), `stock_total`, `stock_available`
    - `exchange_limit_per_user`, `exchange_limit_total`
    - `market_price` (参考市场价), `status` (ON/OFF)
    - `sort_order`, `tenant_id`, `created_at`, `updated_at`
  - `points_exchange_record`（~15字段）：
    - `record_no` (兑换编号), `product_id`, `user_id`
    - `points_used` (消耗积分), `quantity` (兑换数量)
    - `status` (PENDING/CONFIRMED/CANCELLED)
    - `delivery_type` (SELF_PICKUP/DELIVERY), `delivery_status`
    - `tenant_id`, `created_at`, `updated_at`
- **API端点**：
  - `POST /api/admin/marketing/points-mall/products` -- 创建兑换商品
  - `GET /api/admin/marketing/points-mall/products` -- 商品列表
  - `GET /api/admin/marketing/points-mall/products/:id` -- 商品详情
  - `PUT /api/admin/marketing/points-mall/products/:id` -- 更新商品
  - `DELETE /api/admin/marketing/points-mall/products/:id` -- 删除商品
  - `POST /api/admin/marketing/points-mall/products/:id/toggle` -- 上架/下架
  - `GET /api/admin/marketing/points-mall/exchange-records` -- 兑换记录列表
  - `GET /api/admin/marketing/points-mall/exchange-records/:id` -- 兑换记录详情
  - `POST /api/admin/marketing/points-mall/exchange` -- 用户兑换（积分扣减+库存扣减）
  - `POST /api/admin/marketing/points-mall/exchange-records/:id/cancel` -- 取消兑换（退回积分+库存）
  - `POST /api/admin/marketing/points-mall/exchange-records/:id/confirm` -- 确认兑换
- **说明**：
  - 兑换逻辑需事务保证：积分扣减 + 库存扣减 + 记录创建 原子操作
  - 需校验用户积分余额、商品库存、兑换次数限制
  - 取消兑换时自动退回积分和库存
  - 兑换记录关联用户积分流水表 points_record

---

### 5. 营销看板API

- **接口/文件**：
  - `backend/src/controllers/admin/marketing-dashboard.controller.ts` -- 控制器
  - `backend/src/services/admin/marketing-dashboard.service.ts` -- 服务层
  - `backend/src/routes/marketing.routes.ts` -- 路由注册
- **关键字段**（~30字段，统计维度）：
  - 活动概览：`total_activities`, `active_activities`, `ended_activities`
  - 优惠券：`coupon_issued`, `coupon_used`, `coupon_usage_rate`
  - 参与数据：`total_participants`, `new_participants`, `repeat_participants`
  - 转化数据：`order_count`, `order_amount`, `avg_order_amount`, `conversion_rate`
  - 优惠数据：`total_discount_amount`, `avg_discount_amount`, `discount_to_revenue_ratio`
  - ROI分析：`total_cost`, `total_revenue`, `roi` (收益/成本)
  - 趋势数据：按日/周/月的活动参与趋势、优惠券使用趋势
- **API端点**：
  - `GET /api/admin/marketing/dashboard/overview` -- 活动总览（全部活动/进行中/已结束数量）
  - `GET /api/admin/marketing/dashboard/activity-stats` -- 活动效果统计（参与人数/转化率/优惠金额/ROI）
  - `GET /api/admin/marketing/dashboard/activity-stats/:activityId` -- 单个活动效果统计
  - `GET /api/admin/marketing/dashboard/coupon-stats` -- 优惠券统计（发放/使用/核销率）
  - `GET /api/admin/marketing/dashboard/trend` -- 活动趋势数据（支持日/周/月维度）
  - `GET /api/admin/marketing/dashboard/activity-ranking` -- 活动效果排行（按ROI/参与人数/转化率）
  - `GET /api/admin/marketing/dashboard/activity-comparison` -- 多活动对比数据
- **说明**：
  - 数据来源：coupon_template, user_coupon, promotion_activity, limited_discount, gift_rule,
    points_exchange_record, marketing_operation_log 等表
  - 支持时间范围筛选（start_date/end_date）
  - 支持按活动类型筛选（coupon/full-reduction/limited-discount/gift/points）
  - 趋势数据需按天/周/月聚合，前端 ECharts 直接消费

---

### 6. 营销素材库API

- **接口/文件**：
  - `docs/migrations/add_marketing_p1.sql` -- 新增 `marketing_material` 表DDL
  - `backend/src/controllers/admin/marketing-material.controller.ts` -- 控制器
  - `backend/src/services/admin/marketing-material.service.ts` -- 服务层
  - `backend/src/routes/marketing.routes.ts` -- 路由注册
- **关键字段**（~40字段）：
  - 素材基础：`material_code`, `material_name`, `material_desc`
  - 素材类型：`material_type` (IMAGE/VIDEO/DOCUMENT/HTML)
  - 文件信息：`file_url`, `file_size`, `file_format`, `image_width`, `image_height`
  - 分类标签：`category_id`, `tags` (JSON数组)
  - 使用场景：`usage_scene` (POSTER/COUPON_BG/SECKILL_BG/WECHAT_ARTICLE/OTHER)
  - 关联活动：`related_activity_id`, `related_activity_type`
  - 状态管理：`status` (DRAFT/PUBLISHED/ARCHIVED)
  - 使用统计：`download_count`, `view_count`, `use_count`
  - 租户隔离：`tenant_id`, `created_by`, `created_at`, `updated_at`
- **API端点**：
  - `POST /api/admin/marketing/materials` -- 上传素材（支持multipart文件上传）
  - `GET /api/admin/marketing/materials` -- 素材列表（支持分类/类型/标签筛选）
  - `GET /api/admin/marketing/materials/:id` -- 素材详情
  - `PUT /api/admin/marketing/materials/:id` -- 更新素材信息（名称/描述/标签）
  - `DELETE /api/admin/marketing/materials/:id` -- 删除素材（含文件清理）
  - `POST /api/admin/marketing/materials/:id/publish` -- 发布素材
  - `POST /api/admin/marketing/materials/:id/archive` -- 归档素材
  - `GET /api/admin/marketing/materials/categories` -- 获取素材分类树
  - `POST /api/admin/marketing/materials/categories` -- 创建素材分类
  - `PUT /api/admin/marketing/materials/categories/:id` -- 更新分类
  - `DELETE /api/admin/marketing/materials/categories/:id` -- 删除分类
- **说明**：
  - 文件上传支持格式：jpg/png/gif/webp/svg(mp4/mov/pdf/html)
  - 文件大小限制：图片 10MB，视频 100MB，文档 20MB
  - 上传后自动生成缩略图（图片类）
  - 素材分类表 `material_category`（id, name, parent_id, sort_order, tenant_id）
  - 删除素材时同步清理存储文件