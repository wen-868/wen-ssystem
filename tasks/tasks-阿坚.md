# 阿坚 · 客户管理模块 · 后端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | DDL：积分与等级表 | P0 | ❌ |
| 2 | DDL：储值卡表 | P0 | ❌ |
| 3 | DDL：客户标签/画像/关怀/分群表 | P1 | ❌ |
| 4 | 积分与等级 API | P0 | ❌ |
| 5 | 储值卡 API | P0 | ❌ |
| 6 | 会员体系 API（B+C统一注册） | P0 | ❌ |
| 7 | 客户标签与画像 API | P1 | ❌ |
| 8 | 客户关怀 API（生日/节日） | P1 | ❌ |
| 9 | 生命周期看板 API | P1 | ❌ |
| 10 | 客户分群 API | P1 | ❌ |

---

## 详细说明

### 1. DDL：积分与等级表
- **customer_points**：`id, customer_id, total_points, available_points, frozen_points, tenant_id, created_at, updated_at`
- **points_record**：`id, record_no, customer_id, type(EARN/REDEEM/EXPIRE/ADJUST), points, balance_after, source_type, source_no, remark, tenant_id, created_at`
- **points_rule**：`id, rule_name, earn_type(PURCHASE/SIGN_IN/BIRTHDAY/REFERRAL), earn_rate, daily_limit, enabled, tenant_id, created_at, updated_at`
- **customer_level**：`id, customer_id, level_name(VIP1-VIP5), level_points, upgraded_at, tenant_id, created_at, updated_at`
- **level_config**：`id, level_name, min_points, max_points, discount_rate, benefits(json), tenant_id`
- **文件**：`docs/migrations/add_customer_points.sql`

### 2. DDL：储值卡表
- **store_value_card**：`id, card_no, customer_id, customer_name, balance, total_recharge, total_consume, status(ACTIVE/FROZEN/CANCELLED), tenant_id, created_at, updated_at`
- **store_value_transaction**：`id, trans_no, card_no, customer_id, type(RECHARGE/CONSUME/REFUND/ADJUST), amount, balance_after, pay_method, source_no, remark, operator_id, tenant_id, created_at`
- **文件**：`docs/migrations/add_store_value_card.sql`

### 3. DDL：客户标签/画像/关怀/分群表
- **customer_tag**：`id, tag_name, tag_type(MANUAL/AUTO), tag_group, tenant_id, created_at`
- **customer_tag_relation**：`id, customer_id, tag_id, tenant_id, created_at`
- **customer_profile**：`id, customer_id, age_group, gender, prefer_category, prefer_brand, avg_order_amount, total_order_count, last_order_at, total_points, member_level, lifecycle_stage, tenant_id, updated_at`
- **customer_care_rule**：`id, rule_name, trigger_type(BIRTHDAY/HOLIDAY/INACTIVE/LEVEL_UP), template_content, reward_points, reward_coupon_id, enabled, tenant_id`
- **customer_care_log**：`id, customer_id, rule_id, trigger_type, sent_content, sent_at, status, tenant_id`
- **customer_segment**：`id, segment_name, conditions(json), member_count, auto_refresh, tenant_id, created_at, updated_at`
- **customer_segment_member**：`id, segment_id, customer_id, tenant_id, created_at`
- **文件**：`docs/migrations/add_customer_tag_profile.sql`

### 4. 积分与等级 API
- `POST /api/admin/members/points/rules` — 创建积分规则
- `GET /api/admin/members/points/rules` — 积分规则列表
- `PUT /api/admin/members/points/rules/:id` — 更新积分规则
- `POST /api/admin/members/:id/points/adjust` — 手动调整积分
- `GET /api/admin/members/:id/points/records` — 积分明细
- `GET /api/admin/members/levels/config` — 等级配置列表
- `POST /api/admin/members/levels/config` — 创建等级配置
- `PUT /api/admin/members/levels/config/:id` — 更新等级配置
- 自动升级逻辑：消费时按规则累积积分，达到阈值自动升级
- **文件**：`backend/src/services/admin/points.service.ts`、`backend/src/routes/points.routes.ts`

### 5. 储值卡 API
- `POST /api/admin/store-value-cards` — 开卡
- `GET /api/admin/store-value-cards` — 储值卡列表
- `GET /api/admin/store-value-cards/:cardNo` — 储值卡详情
- `POST /api/admin/store-value-cards/:cardNo/recharge` — 充值
- `POST /api/admin/store-value-cards/:cardNo/consume` — 消费扣款
- `POST /api/admin/store-value-cards/:cardNo/refund` — 退款
- `POST /api/admin/store-value-cards/:cardNo/freeze` — 冻结
- `POST /api/admin/store-value-cards/:cardNo/unfreeze` — 解冻
- `GET /api/admin/store-value-cards/:cardNo/transactions` — 交易明细
- **文件**：`backend/src/services/admin/store-value-card.service.ts`、`backend/src/routes/store-value-card.routes.ts`

### 6. 会员体系 API（B+C统一注册）
- `POST /api/admin/members/register` — 注册会员（含手机号验证）
- `GET /api/admin/members/:id/member-card` — 会员卡信息（等级/积分/权益/二维码）
- `PUT /api/admin/members/:id/member-level` — 手动调整等级
- `GET /api/admin/members/benefits` — 会员权益配置
- 扩展现有 `customer.service.ts` 的 create 方法，增加会员注册逻辑
- **文件**：合并到 `backend/src/services/admin/customer.service.ts` 和 `backend/src/routes/admin.routes.ts`

### 7. 客户标签与画像 API
- `POST /api/admin/members/tags` — 创建标签
- `GET /api/admin/members/tags` — 标签列表
- `PUT /api/admin/members/tags/:id` — 更新标签
- `DELETE /api/admin/members/tags/:id` — 删除标签
- `POST /api/admin/members/:id/tags` — 为客户打标签
- `DELETE /api/admin/members/:id/tags/:tagId` — 移除客户标签
- `GET /api/admin/members/:id/profile` — 客户画像
- 自动标签规则：消费金额/频次/品类偏好触发自动打标
- **文件**：`backend/src/services/admin/customer-tag.service.ts`、`backend/src/routes/customer-tag.routes.ts`

### 8. 客户关怀 API
- `POST /api/admin/members/care-rules` — 创建关怀规则
- `GET /api/admin/members/care-rules` — 关怀规则列表
- `PUT /api/admin/members/care-rules/:id` — 更新关怀规则
- `DELETE /api/admin/members/care-rules/:id` — 删除关怀规则
- `GET /api/admin/members/care-logs` — 关怀记录
- `POST /api/admin/members/care-rules/:id/execute` — 手动执行关怀
- 定时任务：每日扫描生日/节日/流失客户，自动发送关怀
- **文件**：`backend/src/services/admin/customer-care.service.ts`、`backend/src/routes/customer-care.routes.ts`

### 9. 生命周期看板 API
- `GET /api/admin/members/lifecycle/stages` — 各阶段客户数量统计
- `GET /api/admin/members/lifecycle/trend` — 阶段转化趋势
- `GET /api/admin/members/lifecycle/detail` — 阶段明细列表
- 生命周期阶段：潜客→新客→活跃→沉睡→流失
- 自动判定逻辑：基于最后消费时间、消费频次
- **文件**：`backend/src/services/admin/customer-lifecycle.service.ts`、合并到 `backend/src/routes/admin.routes.ts`

### 10. 客户分群 API
- `POST /api/admin/members/segments` — 创建分群（条件：消费金额/频次/品类/地区/标签组合）
- `GET /api/admin/members/segments` — 分群列表
- `PUT /api/admin/members/segments/:id` — 更新分群
- `DELETE /api/admin/members/segments/:id` — 删除分群
- `POST /api/admin/members/segments/:id/refresh` — 刷新分群成员
- `GET /api/admin/members/segments/:id/members` — 分群成员列表
- **文件**：`backend/src/services/admin/customer-segment.service.ts`、`backend/src/routes/customer-segment.routes.ts`