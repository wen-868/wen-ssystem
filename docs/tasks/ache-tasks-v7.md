# 阿澈 — 智享全链管理系统 v7.0 任务清单 (P17→P22)

> 总工作量：10天 | P0: 5天 | P1: 3.5天 | P2: 1.5天  
> **状态：⚠️ 核心完成，4个DDL待补（2026-07-02 已合并到main）**  
> 开始前请先阅读：`docs/task-plan-v7.md`（总体规划）、`docs/task-breakdown-v7.md`（完整字段定义）

| 任务 | 状态 |
|------|:---:|
| P17-A 14张缺失表DDL | ⚠️ 10/14 |
| P17-B 19张Phase表迁移 | ✅ |
| P18-C 权限矩阵+监控 | ✅ |
| P19-C 营销P1后端 | ✅ |
| P19-D 系统P1后端 | ✅ |
| P20-C 营销P1前端 | ✅ |
| P20-D 系统P1前端 | ✅ |
| P21-C 营销P2 | ✅ |

> 🔴 **待补**: `add_retail_announcement.sql`, `add_retail_cart.sql`, `add_retail_consumer_address.sql`, `add_report_permission_matrix.sql`

---

## Phase 17-A: 14张缺失表DDL创建 [P0] — 1天

**目录**：`docs/migrations/`  
**注意**：文件名编号从 `049` 开始（避免与 17-B 的 029-048 冲突），按顺序创建。

### 17-A-1: `049_add_order_sync_log.sql`

```sql
CREATE TABLE IF NOT EXISTS miniapp_order_sync_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL COMMENT '订单号',
  platform VARCHAR(32) NOT NULL COMMENT '平台',
  sync_type VARCHAR(32) NOT NULL COMMENT '同步类型：STATUS/SKU/PRICE/STOCK',
  sync_direction VARCHAR(32) NOT NULL COMMENT '方向：PUSH_TO_PLATFORM/PULL_FROM_PLATFORM',
  request_data JSON DEFAULT NULL COMMENT '请求数据',
  response_data JSON DEFAULT NULL COMMENT '响应数据',
  status VARCHAR(32) NOT NULL COMMENT '状态：SUCCESS/FAILED',
  error_msg VARCHAR(512) DEFAULT NULL COMMENT '错误信息',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_order_no (order_no),
  INDEX idx_platform (platform),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序订单同步日志表';
```

### 17-A-2: `050_add_platform_reconciliation.sql`

```sql
CREATE TABLE IF NOT EXISTS platform_reconciliation (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform VARCHAR(32) NOT NULL COMMENT '平台',
  reconciliation_date DATE NOT NULL COMMENT '对账日期',
  platform_order_count INT NOT NULL DEFAULT 0 COMMENT '平台订单数',
  platform_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '平台金额',
  system_order_count INT NOT NULL DEFAULT 0 COMMENT '系统订单数',
  system_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '系统金额',
  diff_count INT NOT NULL DEFAULT 0 COMMENT '差异单数',
  diff_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '差异金额',
  commission_amount DECIMAL(12,2) DEFAULT NULL COMMENT '佣金金额',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/MATCHED/DIFF/ADJUSTED',
  operator_id BIGINT UNSIGNED DEFAULT NULL COMMENT '对账人',
  adjusted_at DATETIME DEFAULT NULL COMMENT '调整时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_platform_date (platform, reconciliation_date),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台对账表';
```

### 17-A-3: `051_add_platform_review.sql`

```sql
CREATE TABLE IF NOT EXISTS platform_review (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform VARCHAR(32) NOT NULL COMMENT '平台',
  platform_review_id VARCHAR(128) DEFAULT NULL COMMENT '平台评价ID',
  order_no VARCHAR(64) NOT NULL COMMENT '关联订单号',
  rating TINYINT NOT NULL COMMENT '评分：1-5',
  content TEXT DEFAULT NULL COMMENT '评价内容',
  reply_content VARCHAR(500) DEFAULT NULL COMMENT '回复内容',
  replied_at DATETIME DEFAULT NULL COMMENT '回复时间',
  synced_at DATETIME DEFAULT NULL COMMENT '同步时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_platform (platform),
  INDEX idx_rating (rating),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台评价表';
```

### 17-A-4: `052_add_retail_announcement.sql`

```sql
CREATE TABLE IF NOT EXISTS retail_announcement (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  title VARCHAR(128) NOT NULL COMMENT '公告标题',
  content TEXT NOT NULL COMMENT '公告内容',
  is_top TINYINT NOT NULL DEFAULT 0 COMMENT '是否置顶',
  start_time DATETIME DEFAULT NULL COMMENT '开始展示时间',
  end_time DATETIME DEFAULT NULL COMMENT '结束展示时间',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store (store_id),
  INDEX idx_status_time (status, start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序公告表';
```

### 17-A-5: `053_add_retail_cart.sql`

```sql
CREATE TABLE IF NOT EXISTS retail_cart (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  checked TINYINT NOT NULL DEFAULT 1 COMMENT '是否选中',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_store_sku (user_id, store_id, sku_id),
  INDEX idx_user (user_id),
  INDEX idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车表';
```

### 17-A-6: `054_add_retail_consumer_address.sql`

```sql
CREATE TABLE IF NOT EXISTS retail_consumer_address (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  name VARCHAR(64) NOT NULL COMMENT '收货人姓名',
  mobile VARCHAR(20) NOT NULL COMMENT '收货人手机',
  province VARCHAR(64) NOT NULL COMMENT '省',
  city VARCHAR(64) NOT NULL COMMENT '市',
  district VARCHAR(64) NOT NULL COMMENT '区',
  detail VARCHAR(255) NOT NULL COMMENT '详细地址',
  is_default TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认地址',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_default (user_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消费者收货地址表';
```

### 17-A-7: `055_add_points_mall_item.sql`

```sql
CREATE TABLE IF NOT EXISTS points_mall_item (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '商品名称',
  image VARCHAR(512) DEFAULT NULL COMMENT '商品图片',
  points_required INT NOT NULL COMMENT '所需积分',
  stock INT NOT NULL DEFAULT 0 COMMENT '库存',
  per_user_limit INT NOT NULL DEFAULT 1 COMMENT '每人限兑',
  start_time DATETIME DEFAULT NULL COMMENT '开始时间',
  end_time DATETIME DEFAULT NULL COMMENT '结束时间',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/INACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status_time (status, start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分商城商品表';
```

### 17-A-8: `056_add_points_mall_order.sql`

```sql
CREATE TABLE IF NOT EXISTS points_mall_order (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL UNIQUE COMMENT '订单号',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  item_id BIGINT UNSIGNED NOT NULL COMMENT '兑换商品ID',
  points_used INT NOT NULL COMMENT '消耗积分',
  qty INT NOT NULL DEFAULT 1 COMMENT '兑换数量',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/DELIVERED/CANCELLED',
  delivery_address JSON DEFAULT NULL COMMENT '收货地址',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_user (user_id),
  INDEX idx_item (item_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分兑换订单表';
```

### 17-A-9: `057_add_marketing_asset.sql`

```sql
CREATE TABLE IF NOT EXISTS marketing_asset (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '素材名称',
  type VARCHAR(32) NOT NULL COMMENT '素材类型：IMAGE/VIDEO/COPYWRITING',
  content TEXT DEFAULT NULL COMMENT '素材内容（文案）',
  file_url VARCHAR(512) DEFAULT NULL COMMENT '文件URL',
  tags JSON DEFAULT NULL COMMENT '素材标签',
  category VARCHAR(32) DEFAULT NULL COMMENT '素材分类',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_category (category),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销素材表';
```

### 17-A-10: `058_add_sys_department.sql`

```sql
CREATE TABLE IF NOT EXISTS sys_department (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父部门ID',
  name VARCHAR(64) NOT NULL COMMENT '部门名称',
  store_id BIGINT UNSIGNED DEFAULT NULL COMMENT '所属门店',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id),
  INDEX idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';
```

### 17-A-11: `059_add_user_session.sql`

```sql
CREATE TABLE IF NOT EXISTS user_session (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  token VARCHAR(512) NOT NULL COMMENT '会话令牌',
  device_type VARCHAR(32) DEFAULT NULL COMMENT '设备类型：WEB/MINIAPP/IOS/ANDROID',
  device_info VARCHAR(255) DEFAULT NULL COMMENT '设备信息',
  ip VARCHAR(64) DEFAULT NULL COMMENT 'IP地址',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  last_activity_at DATETIME DEFAULT NULL COMMENT '最后活跃时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_token (token(191)),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会话表';
```

### 17-A-12: `060_add_custom_report_template.sql`

```sql
CREATE TABLE IF NOT EXISTS custom_report_template (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '模板名称',
  type VARCHAR(32) NOT NULL COMMENT '报表类型：SALES/INVENTORY/FINANCE/CUSTOMER',
  config JSON NOT NULL COMMENT '报表配置（指标、维度、筛选条件）',
  creator_id BIGINT UNSIGNED NOT NULL COMMENT '创建人',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_creator (creator_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自定义报表模板表';
```

### 17-A-13: `061_add_custom_report_schedule.sql`

```sql
CREATE TABLE IF NOT EXISTS custom_report_schedule (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id BIGINT UNSIGNED NOT NULL COMMENT '模板ID',
  name VARCHAR(128) NOT NULL COMMENT '任务名称',
  cron_expression VARCHAR(64) NOT NULL COMMENT '定时表达式',
  export_format VARCHAR(16) DEFAULT 'EXCEL' COMMENT '导出格式：EXCEL/PDF',
  recipients JSON DEFAULT NULL COMMENT '接收人列表',
  last_run_at DATETIME DEFAULT NULL COMMENT '上次执行时间',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/PAUSED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template (template_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时报表导出表';
```

### 17-A-14: `062_add_report_permission_matrix.sql`

```sql
CREATE TABLE IF NOT EXISTS report_permission_matrix (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  report_code VARCHAR(64) NOT NULL COMMENT '报表编码',
  store_scope VARCHAR(32) NOT NULL DEFAULT 'SELF' COMMENT '门店范围：SELF/CHILDREN/ALL',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_report (role_id, report_code),
  INDEX idx_role (role_id),
  INDEX idx_report (report_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报表权限矩阵表';
```

---

## Phase 17-B: 19张Phase文件表迁移整合 [P0] — 0.5天

**目录**：`docs/migrations/`  
**操作**：从 phase 文件提取完整 CREATE TABLE 语句，各自生成独立迁移文件。

**注意外键依赖**，迁移文件需按以下顺序编号：

| 顺序 | 迁移文件名 | 来源 | 依赖 |
|:---:|------|------|------|
| 1 | `029_add_tenant.sql` | phase9 | — (tenant表) |
| 2 | `030_add_subscription_plan.sql` | phase9 | — |
| 3 | `031_add_subscription.sql` | phase9 | tenant, subscription_plan |
| 4 | `032_add_tenant_module_access.sql` | phase9 | tenant |
| 5 | `033_add_subscription_operation_log.sql` | phase9 | subscription |
| 6 | `034_add_tenant_admin.sql` | phase9 | tenant |
| 7 | `035_add_coupon_template.sql` | phase10_marketing | — |
| 8 | `036_add_user_coupon.sql` | phase10_marketing | coupon_template |
| 9 | `037_add_promotion_activity.sql` | phase10_marketing | — |
| 10 | `038_add_full_reduction_rule.sql` | phase10_marketing | promotion_activity |
| 11 | `039_add_seckill_product.sql` | phase10_marketing | promotion_activity |
| 12 | `040_add_group_buy_activity.sql` | phase10_marketing | promotion_activity |
| 13 | `041_add_group_buy_record.sql` | phase10_marketing | group_buy_activity |
| 14 | `042_add_group_buy_participant.sql` | phase10_marketing | group_buy_record |
| 15 | `043_add_promotion_stack_rule.sql` | phase10_marketing | — |
| 16 | `044_add_marketing_operation_log.sql` | phase10_marketing | — |
| 17 | `045_add_delivery_config.sql` | phase10_instant_retail | — |
| 18 | `046_add_delivery_record.sql` | phase10_instant_retail | retail_order |
| 19 | `047_add_retail_operation_log.sql` | phase10_instant_retail | — |
| 20 | `048_add_customer_visit.sql` | phase8 | — |

**来源文件及完整DDL**：参考 `docs/phase10_marketing.sql`、`phase10_instant_retail.sql`、`phase9_tenant_subscription.sql`、`phase8_customer_visit.sql`。直接复制每个表的完整 CREATE TABLE 语句到对应的迁移文件即可。

**外键依赖关系**：
- `delivery_record` 依赖 `retail_order`（来自 phase10_instant_retail.sql，非本次迁移的19个表之一）
- `subscription` 依赖 `tenant` 和 `subscription_plan`
- `tenant_module_access` 依赖 `tenant`
- `tenant_admin` 依赖 `tenant`
- `subscription_operation_log` 依赖 `subscription`
- `full_reduction_rule` 依赖 `promotion_activity`
- `seckill_product` 依赖 `promotion_activity`
- `group_buy_activity` 依赖 `promotion_activity`
- `group_buy_participant` 依赖 `group_buy_record`

---

## Phase 18-C: 权限矩阵 + 监控告警 [P0] — 1.5天

### 18-C-1: 报表权限矩阵 (0.5天)

| 文件 | 路径 | 内容 |
|------|------|------|
| `ReportPermission.vue` | `saas-admin/src/views/ReportPermission.vue` | `el-table`：角色 × 报表编码 矩阵，每格下拉 `SELF/CHILDREN/ALL` + 保存 |

**后端新增API**：
- `GET /api/admin/report-permissions` — 矩阵列表
- `PUT /api/admin/report-permissions` — 批量保存

### 18-C-2: 系统配置管理 (0.5天)

| 文件 | 路径 | 内容 |
|------|------|------|
| `SysConfigView.vue` | `saas-admin/src/views/SysConfigView.vue` | `el-table`：配置键/值/描述 + 编辑 `el-dialog` |

**后端新增API**（如 `sys-config.routes.ts` 未覆盖全局参数）：
- `GET /api/admin/global-config` — 全局配置列表
- `PUT /api/admin/global-config/:key` — 更新

### 18-C-3: 监控告警 (0.5天)

| 文件 | 路径 | 内容 |
|------|------|------|
| `MonitorView.vue` | `saas-admin/src/views/MonitorView.vue` | 数据库状态（连接数/慢查询）、API调用统计（QPS/错误率/平均响应时间）、到期租户列表 |
| `MonitorView.vue` | 到期提醒 | `el-table` 显示7天内到期租户 + 手动发送通知按钮 |

**后端新增API**：
- `GET /api/admin/monitor/db-status` — 数据库状态
- `GET /api/admin/monitor/api-stats` — API统计
- `GET /api/admin/monitor/expiring-tenants` — 到期租户
- `POST /api/admin/monitor/notify-expiring` — 发送到期通知

---

## Phase 19-C: 营销中心P1后端 [P1] — 1天

### 19-C-1: 积分商城管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `points-mall.service.ts` | `backend/src/services/admin/points-mall.service.ts` |
| `points-mall.routes.ts` | `backend/src/routes/points-mall.routes.ts` |

**Service方法**（points_mall_item 表）：
- `listItems(params)` → `SELECT * FROM points_mall_item WHERE ... ORDER BY created_at DESC`
- `createItem(data)` → `INSERT INTO points_mall_item`
- `updateItem(id, data)` → `UPDATE points_mall_item SET ...`
- `deleteItem(id)` → `DELETE FROM points_mall_item WHERE id=?`
- `updateStatus(id, status)` → `UPDATE points_mall_item SET status=?`

**Service方法**（points_mall_order 表）：
- `listOrders(params)` → `SELECT * FROM points_mall_order WHERE ... ORDER BY created_at DESC`
- `deliverOrder(id)` → `UPDATE points_mall_order SET status='DELIVERED' WHERE id=?`
- `cancelOrder(id)` → `UPDATE points_mall_order SET status='CANCELLED' WHERE id=?`

**路由端点**：
- `GET /api/admin/points-mall/items` → `listItems()`
- `POST /api/admin/points-mall/items` → `createItem()`
- `PUT /api/admin/points-mall/items/:id` → `updateItem()`
- `DELETE /api/admin/points-mall/items/:id` → `deleteItem()`
- `PUT /api/admin/points-mall/items/:id/status` → `updateStatus()`
- `GET /api/admin/points-mall/orders` → `listOrders()`
- `PUT /api/admin/points-mall/orders/:id/deliver` → `deliverOrder()`
- `PUT /api/admin/points-mall/orders/:id/cancel` → `cancelOrder()`

**注册**：
```typescript
app.use('/api/admin/points-mall', requireAuthWithTenant, pointsMallRouter);
```

### 19-C-2: 营销素材管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `marketing-asset.service.ts` | `backend/src/services/admin/marketing-asset.service.ts` |
| `marketing-asset.routes.ts` | `backend/src/routes/marketing-asset.routes.ts` |

**Service方法**（操作 `marketing_asset` 表）：
- `listAssets(params)` → `SELECT * FROM marketing_asset WHERE ... ORDER BY created_at DESC`
- `createAsset(data)` → `INSERT INTO marketing_asset`
- `updateAsset(id, data)` → `UPDATE marketing_asset SET ...`
- `deleteAsset(id)` → `DELETE FROM marketing_asset WHERE id=?`
- `getByCategory(category)` → `SELECT * FROM marketing_asset WHERE category=? AND status='ACTIVE'`

**路由端点**：
- `GET /api/admin/marketing-assets` → `listAssets()`
- `POST /api/admin/marketing-assets` → `createAsset()`
- `PUT /api/admin/marketing-assets/:id` → `updateAsset()`
- `DELETE /api/admin/marketing-assets/:id` → `deleteAsset()`
- `GET /api/admin/marketing-assets/category/:category` → `getByCategory()`

**注册**：
```typescript
app.use('/api/admin/marketing-assets', requireAuthWithTenant, marketingAssetRouter);
```

---

## Phase 19-D: 系统设置P1后端 [P1] — 0.5天

### 19-D-1: 部门管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `department.service.ts` | `backend/src/services/admin/department.service.ts` |
| `department.routes.ts` | `backend/src/routes/department.routes.ts` |

**Service方法**（操作 `sys_department` 表）：
- `listDepartments(storeId?)` → `SELECT * FROM sys_department WHERE ... ORDER BY sort_order`（树形结构）
- `createDepartment(data)` → `INSERT INTO sys_department`
- `updateDepartment(id, data)` → `UPDATE sys_department SET ...`
- `deleteDepartment(id)` → 检查子部门 → `DELETE FROM sys_department WHERE id=?`
- `moveDepartment(id, parentId)` → `UPDATE sys_department SET parent_id=?`

**路由端点**：
- `GET /api/admin/departments` → `listDepartments()`
- `POST /api/admin/departments` → `createDepartment()`
- `PUT /api/admin/departments/:id` → `updateDepartment()`
- `DELETE /api/admin/departments/:id` → `deleteDepartment()`
- `PUT /api/admin/departments/:id/move` → `moveDepartment()`

**注册**：
```typescript
app.use('/api/admin/departments', requireAuthWithTenant, departmentRouter);
```

### 19-D-2: 用户会话管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `user-session.service.ts` | `backend/src/services/admin/user-session.service.ts` |
| `user-session.routes.ts` | `backend/src/routes/user-session.routes.ts` |

**Service方法**（操作 `user_session` 表）：
- `listSessions(params)` → `SELECT * FROM user_session WHERE ... ORDER BY last_activity_at DESC`
- `kickSession(id)` → `DELETE FROM user_session WHERE id=?`
- `kickUserSessions(userId)` → `DELETE FROM user_session WHERE user_id=?`
- `getStats()` → `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as online_users FROM user_session WHERE expires_at > NOW()`

**路由端点**：
- `GET /api/admin/sessions` → `listSessions()`
- `DELETE /api/admin/sessions/:id` → `kickSession()`
- `DELETE /api/admin/sessions/user/:userId` → `kickUserSessions()`
- `GET /api/admin/sessions/stats` → `getStats()`

**注册**：
```typescript
app.use('/api/admin/sessions', requireAuthWithTenant, userSessionRouter);
```

---

## Phase 20-C: 营销中心P1前端 [P1] — 0.5天

### 20-C-1: `PointsMall.vue`

**路径**：`admin-web/src/views/PointsMall.vue`

**组件结构**：
- 两个 `el-tab-pane`：商品管理 / 兑换订单
- 商品管理Tab: `el-table` columns: 商品名称 / 图片 / 所需积分 / 库存 / 每人限兑 / 有效期 / 状态 + 新建/编辑/删除
- 兑换订单Tab: `el-table` columns: 订单号 / 用户ID / 商品名称 / 消耗积分 / 数量 / 收货地址 / 状态 + 发货/取消按钮

**路由注册**：
```typescript
{ path: 'points-mall', name: 'PointsMall', component: () => import('@/views/PointsMall.vue') }
```

### 20-C-2: `MarketingAsset.vue`

**路径**：`admin-web/src/views/MarketingAsset.vue`

**组件结构**：
- 卡片网格布局展示素材：图片缩略图 / 视频封面 / 文案预览
- `el-dialog` 新建/编辑: 名称输入 + 类型下拉(IMAGE/VIDEO/COPYWRITING) + 文件上传 + 标签输入 + 分类下拉
- 筛选栏: 类型下拉 + 分类下拉 + 关键词搜索

**路由注册**：
```typescript
{ path: 'marketing-assets', name: 'MarketingAssets', component: () => import('@/views/MarketingAsset.vue') }
```

---

## Phase 20-D: 系统设置P1前端 [P1] — 0.5天

### 20-D-1: `DepartmentManage.vue`

**路径**：`admin-web/src/views/DepartmentManage.vue`

**组件结构**：
- `el-tree` 树形展示部门结构（支持拖拽排序）
- 右键菜单: 新增子部门 / 编辑 / 删除 / 上移 / 下移
- `el-dialog` 编辑: 部门名称 + 所属门店下拉 + 排序号

**路由注册**：
```typescript
{ path: 'departments', name: 'Departments', component: () => import('@/views/DepartmentManage.vue') }
```

### 20-D-2: `SessionManage.vue`

**路径**：`admin-web/src/views/SessionManage.vue`

**组件结构**：
- 顶部统计：在线用户数 / 总会话数
- `el-table` columns: 用户ID / 设备类型 / 设备信息 / IP / 过期时间 / 最后活跃
- 操作列: 踢下线按钮 + 踢出该用户所有会话按钮

**路由注册**：
```typescript
{ path: 'sessions', name: 'Sessions', component: () => import('@/views/SessionManage.vue') }
```

---

## Phase 21-C: 营销中心P2 [P2] — 1.5天

### 21-C-1: 后端 — 秒杀管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `seckill.service.ts` | `backend/src/services/admin/seckill.service.ts` |
| `seckill.routes.ts` | `backend/src/routes/seckill.routes.ts` |

**Service方法**（操作 `seckill_product` 表）：
- `listSeckillProducts(activityId)` → `SELECT sp.*, p.sku_name FROM seckill_product sp JOIN product_sku p ON p.id=sp.product_id WHERE sp.activity_id=?`
- `addSeckillProduct(data)` → `INSERT INTO seckill_product`
- `updateSeckillProduct(id, data)` → `UPDATE seckill_product SET ...`
- `removeSeckillProduct(id)` → `DELETE FROM seckill_product WHERE id=?`

**路由端点**：
- `GET /api/admin/marketing/seckill/:activityId/products` → `listSeckillProducts()`
- `POST /api/admin/marketing/seckill/products` → `addSeckillProduct()`
- `PUT /api/admin/marketing/seckill/products/:id` → `updateSeckillProduct()`
- `DELETE /api/admin/marketing/seckill/products/:id` → `removeSeckillProduct()`

**注册**：
```typescript
app.use('/api/admin/marketing/seckill', requireAuthWithTenant, seckillRouter);
```

### 21-C-2: 后端 — 拼团管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `group-buy.service.ts` | `backend/src/services/admin/group-buy.service.ts` |
| `group-buy.routes.ts` | `backend/src/routes/group-buy.routes.ts` |

**Service方法**（操作 `group_buy_activity`, `group_buy_record`, `group_buy_participant` 三表）：
- `listGroupBuyActivities(activityId)` → `SELECT * FROM group_buy_activity WHERE activity_id=?`
- `createGroupBuyActivity(data)` → `INSERT INTO group_buy_activity`
- `updateGroupBuyActivity(id, data)` → `UPDATE group_buy_activity SET ...`
- `listGroupBuyRecords(params)` → `SELECT * FROM group_buy_record WHERE ... ORDER BY created_at DESC`
- `getGroupBuyDetail(groupNo)` → 拼团记录 + 参与者列表(JOIN group_buy_participant)
- `cancelGroupBuy(groupNo)` → `UPDATE group_buy_record SET status='CANCELLED'`

**路由端点**：
- `GET /api/admin/marketing/group-buy/:activityId/activities` → `listGroupBuyActivities()`
- `POST /api/admin/marketing/group-buy/activities` → `createGroupBuyActivity()`
- `PUT /api/admin/marketing/group-buy/activities/:id` → `updateGroupBuyActivity()`
- `GET /api/admin/marketing/group-buy/records` → `listGroupBuyRecords()`
- `GET /api/admin/marketing/group-buy/records/:groupNo` → `getGroupBuyDetail()`
- `PUT /api/admin/marketing/group-buy/records/:groupNo/cancel` → `cancelGroupBuy()`

**注册**：
```typescript
app.use('/api/admin/marketing/group-buy', requireAuthWithTenant, groupBuyRouter);
```

### 21-C-3: 前端 — `SeckillManage.vue`

**路径**：`admin-web/src/views/SeckillManage.vue`

**组件结构**：
- `el-table`：商品名称 / 原价 / 秒杀价 / 总库存 / 剩余库存 / 限购数量 / 操作
- `el-dialog` 添加秒杀商品：搜索选择商品 + 秒杀价格输入 + 库存输入 + 限购数量
- 操作列：编辑 / 删除

**路由注册**：
```typescript
{ path: 'marketing/seckill', name: 'SeckillManage', component: () => import('@/views/SeckillManage.vue') }
```

### 21-C-4: 前端 — `GroupBuyManage.vue`

**路径**：`admin-web/src/views/GroupBuyManage.vue`

**组件结构**：
- 两个 `el-tab-pane`：活动配置 / 拼团记录
- 活动配置Tab: `el-table` — 商品名称 / 成团人数 / 拼团价 / 原价 / 时限(小时) / 操作
- 拼团记录Tab: `el-table` — 团号 / 团长 / 商品 / 当前人数/成团人数 / 拼团价 / 状态 / 过期时间 / 操作
- 操作列：查看参与者 / 取消拼团

**路由注册**：
```typescript
{ path: 'marketing/group-buy', name: 'GroupBuyManage', component: () => import('@/views/GroupBuyManage.vue') }
```

---

## Phase 22: 集成测试 [P0] — 2天

**全员参与**。

### 测试清单（重点负责营销 + 系统设置 + 权限相关）

| 序号 | 测试场景 | 验证点 |
|:---:|------|------|
| 1 | 开单→分享→支付→库存扣减 | sale_bill创建 → collection_link生成 → 微信支付回调 → inventory_balance减少 |
| 2 | 优惠券→促销→叠加 | coupon_template → user_coupon → promotion_stack_rule |
| 3 | 秒杀→库存扣减→超卖防护 | seckill_product库存原子操作 |
| 4 | 拼团→成团→失败退款 | group_buy_record状态流转 |
| 5 | 积分兑换→库存扣减 | points_mall_order → points_mall_item.stock |
| 6 | 营销素材→CRUD→分类 | marketing_asset 全生命周期 |
| 7 | 部门管理→树形→权限继承 | sys_department parent_id递归 + sys_user_role |
| 8 | 会话管理→踢下线→过期 | user_session 强制删除 + 过期自动清理 |
| 9 | 平台对账→差异计算 | platform_reconciliation diff_count/diff_amount |
| 10 | 报表权限矩阵→保存→验证 | report_permission_matrix 批量保存 → 按角色查询 |