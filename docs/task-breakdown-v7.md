# 智享全链管理系统 v7.0 任务分解 — 精确到字段级

> 版本：v7.0 · 日期：2026-07-02  
> 每个任务精确到：文件路径、字段名、类型、默认值、索引、API端点、Vue组件

---

## 一、Phase 17: 基础设施补齐 [P0]

---

### 任务 17-A: 14张缺失表DDL创建

**负责人**：阿澈  
**工作量**：1天  
**目录**：`docs/migrations/`

#### 17-A-1: `add_order_sync_log.sql`

```sql
-- 小程序订单同步日志表
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

#### 17-A-2: `add_platform_reconciliation.sql`

```sql
-- 平台对账表
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

#### 17-A-3: `add_platform_review.sql`

```sql
-- 平台评价表
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

#### 17-A-4: `add_retail_announcement.sql`

```sql
-- 小程序公告表
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

#### 17-A-5: `add_retail_cart.sql`

```sql
-- 购物车表
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

#### 17-A-6: `add_retail_consumer_address.sql`

```sql
-- 消费者收货地址表
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

#### 17-A-7: `add_points_mall_item.sql`

```sql
-- 积分商城商品表
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

#### 17-A-8: `add_points_mall_order.sql`

```sql
-- 积分兑换订单表
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

#### 17-A-9: `add_marketing_asset.sql`

```sql
-- 营销素材表
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

#### 17-A-10: `add_sys_department.sql`

```sql
-- 部门表
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

#### 17-A-11: `add_user_session.sql`

```sql
-- 用户会话表
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

#### 17-A-12: `add_custom_report_template.sql`

```sql
-- 自定义报表模板表
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

#### 17-A-13: `add_custom_report_schedule.sql`

```sql
-- 定时报表导出表
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

#### 17-A-14: `add_report_permission_matrix.sql`

```sql
-- 报表权限矩阵表
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

### 任务 17-B: 19张Phase文件表 → 迁移文件

**负责人**：阿澈  
**工作量**：0.5天  
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

---

### 任务 17-C: 8个路由服务层重构

**负责人**：阿坚  
**工作量**：1.5天

#### 17-C-1: 新建 `services/admin/sys-user.service.ts`

从 `routes/sys-user.routes.ts` (~240行SQL) 提取：

| 方法 | 功能 | 涉及SQL |
|------|------|---------|
| `listUsers(params)` | 分页查询用户列表 | SELECT with JOIN sys_user_role, 筛选 role_id/keyword |
| `createUser(data)` | 创建用户 + 分配角色 | 事务: INSERT sys_user + INSERT sys_user_role |
| `updateUser(id, data)` | 更新用户 + 更新角色 | 事务: UPDATE sys_user + DELETE/INSERT sys_user_role |
| `deleteUser(id)` | 软删除用户 | UPDATE sys_user SET status=0 |
| `resetPassword(id, newPwd)` | 重置密码 | UPDATE sys_user SET password_hash |

**路由精简后**：`sys-user.routes.ts` 仅保留参数校验 + 调用service + 响应包装

#### 17-C-2: 新建 `services/admin/operation-log.service.ts`

从 `routes/operation-log.routes.ts` (~75行SQL) 提取：

| 方法 | 功能 | 涉及SQL |
|------|------|---------|
| `listLogs(params)` | 分页 + 筛选查询 | SELECT with WHERE module/action/user_id/date_range |
| `getLogStats()` | 按模块+操作类型统计 | SELECT COUNT GROUP BY module, action |

#### 17-C-3: 新建 `services/admin/system.service.ts`

从 `routes/system.routes.ts` (~36行SQL) 提取：

| 方法 | 功能 | 涉及SQL |
|------|------|---------|
| `getSystemInfo()` | 返回3个COUNT | SELECT COUNT(*) FROM sys_user/store/tenant |

#### 17-C-4: 重构 `share.routes.ts` → 接入 `share.service.ts`

**现状**：`share.routes.ts` 有内联SQL（224行），`share.service.ts` 已存在但未使用。

**操作**：
- 将 `GET /collections/:token` 的内联SQL移到 `share.service.ts` 的 `getCollectionLink()`
- 将 `GET /collections/:token/page` 的SQL逻辑移到 `share.service.ts` 新方法 `getCollectionPage(token)`
- 将 `POST /collections/:token/pay` 的SQL逻辑移到 `share.service.ts` 的 `payCollection()`（已存在）
- 将 `POST /collections/:token/wx-notify` 的回调处理逻辑移到 `share.service.ts` 新方法 `handleWxNotify(token, body, headers)`
- 路由文件仅保留：参数提取、HTTP状态码处理、响应包装

#### 17-C-5: 重构 `platform.routes.ts` → 接入已有service

**现状**：`platform.routes.ts` (~42行SQL) 有内联SELECT，而 `services/platform/platform-overview.service.ts` 已存在。

**操作**：
- 将平台总览的SQL查询移到 `platform-overview.service.ts` 的 `getOverview()`
- 将租户列表查询移到 `tenant-admin.service.ts` 的 `listTenants()`
- 路由文件仅保留调用

#### 17-C-6: 重构 `order-timeout.routes.ts` → 扫描器迁移

**现状**：路由处理器使用controller（正常），但 `processTimeoutConfig()` 和 `startOrderTimeoutScanner()` 扫描器含内联SQL。

**操作**：
- 将 `processTimeoutConfig()` 函数移入 `services/admin/order-timeout.service.ts` 新方法 `processConfig(config)`
- 将 `startOrderTimeoutScanner()` 函数移入 `services/admin/order-timeout.service.ts` 新方法 `startScanner()`
- 路由文件 import 后调用

#### 17-C-7: 重构 `store-control.routes.ts` → 调度器迁移

**现状**：路由处理器使用controller（正常），但 `runStoreControlCheck()` 调度器含内联SQL。

**操作**：
- 将 `runStoreControlCheck()` 函数移入 `services/admin/store-control.service.ts` 新方法 `runCheck()`
- 路由文件 import 后调用

#### 17-C-8: 重构 `notification.routes.ts` → 工具函数迁移

**现状**：路由处理器使用controller（正常），但 `sendNotification()` 工具函数含一个INSERT。

**操作**：
- 将 `sendNotification()` 函数移入 `services/admin/notification.service.ts` 新方法 `send(data)`
- 路由文件删除函数定义，改为 import 调用

#### 17-C-9: 清理 `store.routes.ts`

**操作**：删除第5行未使用的导入 `query, queryOne`（死代码）

---

### 任务 17-D: 产品规格文档同步

**负责人**：墨  
**工作量**：0.5天

**文件**：`docs/product-spec-v6-adapted.md`

**操作清单**（精确到行）：

| 序号 | 操作 | 位置 | 具体内容 |
|:---:|------|------|------|
| 1 | 更新完成度 | 第十八部分（约第4095行） | `admin-web 完成度：55%` → `admin-web 完成度：100%` |
| 2 | 删除过时清单 | 第十八部分 | 删除"占位视图清单"（21个占位 + 3个新增）的整个列表 |
| 3 | 更新表计数 | 文档开头状态表 | `init_database.sql 表数：62` → `init_database.sql + 迁移后表数：95` |
| 4 | 补充 sale_bill 字段 | 第1177-1206行 | 确认 `store_name/store_address/store_contact` 三个字段已存在 |
| 5 | 补充 sale_bill_item 字段 | 第1208-1223行 | 确认 `unit/barcode/spec` 三个字段已存在 |
| 6 | 补充 collection_link 字段 | 第1285-1310行 | 确认 `display_config/document_title` 两个字段已存在 |
| 7 | 新增 14表到对应Section | 各Section | 将Task 17-A的14张表字段定义插入对应Section |

---

## 二、Phase 18: 平台总后台 saas-admin [P0]

---

### 任务 18-A: 项目初始化 + 租户管理

**负责人**：阿坚  
**工作量**：2天  

#### 18-A-1: 项目脚手架 (0.5天)

**创建目录**：`saas-admin/`

**文件清单**：

| 文件 | 内容 |
|------|------|
| `saas-admin/package.json` | `vue@3`, `vue-router@4`, `pinia`, `element-plus`, `axios`, `typescript`, `vite` |
| `saas-admin/vite.config.ts` | Vite配置 + 代理 `/api` → `http://localhost:3000` |
| `saas-admin/tsconfig.json` | TypeScript严格模式 |
| `saas-admin/index.html` | 入口HTML |
| `saas-admin/src/main.ts` | `createApp` + `useRouter` + `usePinia` + `useElementPlus` |
| `saas-admin/src/App.vue` | `<router-view />` 壳 |
| `saas-admin/src/api.ts` | `axios.create({ baseURL: '/api/admin' })` + 请求拦截器（JWT） |
| `saas-admin/src/stores/auth.ts` | Pinia: `token`, `user`, `login()`, `logout()` |
| `saas-admin/src/router/index.ts` | 路由表：`/login`, `/`, `/tenants`, `/tenants/:id`, `/subscriptions`, `/plans`, `/dashboard`, `/monitor` |

#### 18-A-2: 布局框架 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/layouts/MainLayout.vue` | 侧边栏（`el-menu`：仪表盘/租户管理/订阅管理/套餐管理/监控告警）+ 顶栏（用户信息/退出）+ 主内容区 `<router-view>` |

#### 18-A-3: 登录/退出 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/LoginView.vue` | 平台管理员登录表单：username + password → `POST /api/admin/login` → 存token → 跳转 `/` |
| `saas-admin/src/views/LoginView.vue` | 登录失败提示：`el-message` 红色错误信息 |

**后端新增**：`saas-admin` 需独立认证路由（或复用 `admin.routes.ts` 的 `/login` 端点）

#### 18-A-4: 租户管理 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/TenantList.vue` | `el-table`：租户ID/名称/联系人/手机/状态/创建时间 + `el-pagination` |
| `saas-admin/src/views/TenantList.vue` | 操作栏：搜索（名称/手机）、新建、启用/停用切换 |
| `saas-admin/src/views/TenantCreate.vue` | `el-dialog`：名称/联系人/手机/邮箱/初始密码 → 创建租户 |
| `saas-admin/src/views/TenantDetail.vue` | 租户详情页：基本信息 + 模块权限（`tenant_module_access` 表）+ 管理员列表（`tenant_admin` 表） |

**后端新增**：
- `GET /api/admin/tenants` — 分页列表
- `POST /api/admin/tenants` — 创建
- `PUT /api/admin/tenants/:id` — 更新
- `PUT /api/admin/tenants/:id/status` — 启停
- `GET /api/admin/tenants/:id/modules` — 模块权限
- `PUT /api/admin/tenants/:id/modules` — 更新模块权限
- `GET /api/admin/tenants/:id/admins` — 管理员列表
- `POST /api/admin/tenants/:id/admins` — 添加管理员

---

### 任务 18-B: 订阅管理 + 平台数据面板

**负责人**：墨  
**工作量**：1.5天

#### 18-B-1: 订阅套餐管理 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/PlanList.vue` | `el-table`：套餐编码/名称/类型/价格/最大用户/最大门店/状态 + 新建/编辑/启停 |
| `saas-admin/src/views/PlanForm.vue` | `el-dialog`：所有 `subscription_plan` 字段的表单 |

**后端新增**：
- `GET /api/admin/plans` — 分页列表
- `POST /api/admin/plans` — 创建
- `PUT /api/admin/plans/:id` — 更新
- `PUT /api/admin/plans/:id/status` — 启停

#### 18-B-2: 订阅记录管理 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/SubscriptionList.vue` | `el-table`：订阅编号/租户/套餐/起止日期/支付状态/金额/自动续费/操作 |
| `saas-admin/src/views/SubscriptionList.vue` | 操作：新建订阅/续费/取消/查看操作日志（`subscription_operation_log`） |

**后端新增**：
- `GET /api/admin/subscriptions` — 分页列表
- `POST /api/admin/subscriptions` — 新建订阅
- `POST /api/admin/subscriptions/:id/renew` — 续费
- `PUT /api/admin/subscriptions/:id/cancel` — 取消
- `GET /api/admin/subscriptions/:id/logs` — 操作日志

#### 18-B-3: 平台数据面板 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/DashboardView.vue` | 4个统计卡片：总租户数/活跃租户/本月新增/到期预警 |
| `saas-admin/src/views/DashboardView.vue` | 收入趋势图（`el-chart`）：月度订阅收入 |
| `saas-admin/src/views/DashboardView.vue` | 模块使用率：饼图显示各模块启用比例 |
| `saas-admin/src/views/DashboardView.vue` | 最近操作日志：`operation_log` 表最近20条 |

**后端新增**：
- `GET /api/admin/dashboard/overview` — 返回所有统计指标

---

### 任务 18-C: 权限矩阵 + 监控告警

**负责人**：阿澈  
**工作量**：1.5天

#### 18-C-1: 报表权限矩阵 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/ReportPermission.vue` | `el-table`：角色 × 报表编码 矩阵，每格下拉 `SELF/CHILDREN/ALL` + 保存 |

**后端新增**：
- `GET /api/admin/report-permissions` — 矩阵列表
- `PUT /api/admin/report-permissions` — 批量保存

#### 18-C-2: 系统配置管理 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/SysConfigView.vue` | `el-table`：配置键/值/描述 + 编辑 `el-dialog` |

**后端新增**（如 `sys-config.routes.ts` 未覆盖全局参数）：
- `GET /api/admin/global-config` — 全局配置列表
- `PUT /api/admin/global-config/:key` — 更新

#### 18-C-3: 监控告警 (0.5天)

| 文件 | 内容 |
|------|------|
| `saas-admin/src/views/MonitorView.vue` | 数据库状态（连接数/慢查询）、API调用统计（QPS/错误率/平均响应时间）、到期租户列表 |
| `saas-admin/src/views/MonitorView.vue` | 租户到期提醒：`el-table` 显示7天内到期租户 + 手动发送通知按钮 |

**后端新增**：
- `GET /api/admin/monitor/db-status` — 数据库状态
- `GET /api/admin/monitor/api-stats` — API统计
- `GET /api/admin/monitor/expiring-tenants` — 到期租户
- `POST /api/admin/monitor/notify-expiring` — 发送到期通知

---

## 三、Phase 19: P1功能开发 - 后端 [P1]

---

### 任务 19-A: 订单管理P1后端

**负责人**：阿坚  
**工作量**：1天

#### 19-A-1: 小程序订单同步日志

**新建文件**：

| 文件 | 路径 |
|------|------|
| `miniapp-order-sync.service.ts` | `backend/src/services/admin/miniapp-order-sync.service.ts` |
| `miniapp-order-sync.routes.ts` | `backend/src/routes/miniapp-order-sync.routes.ts` |

**Service方法**：
- `listSyncLogs(params: { page, pageSize, orderNo?, platform?, status? })` → `SELECT * FROM miniapp_order_sync_log WHERE ... ORDER BY created_at DESC LIMIT ? OFFSET ?`
- `retrySync(orderNo: string)` → `UPDATE miniapp_order_sync_log SET status='PENDING' WHERE order_no=?`

**路由端点**：
- `GET /api/admin/order-sync-logs` → `listSyncLogs()`
- `POST /api/admin/order-sync-logs/:orderNo/retry` → `retrySync()`

**注册**：在 `server.ts` 约第207行附近添加：
```typescript
app.use('/api/admin/order-sync-logs', requireAuthWithTenant, orderSyncLogRouter);
```

#### 19-A-2: 平台对账管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `platform-reconciliation.service.ts` | `backend/src/services/admin/platform-reconciliation.service.ts` |
| `platform-reconciliation.routes.ts` | `backend/src/routes/platform-reconciliation.routes.ts` |

**Service方法**：
- `listReconciliations(params)` → `SELECT * FROM platform_reconciliation WHERE ... ORDER BY reconciliation_date DESC`
- `createReconciliation(data)` → `INSERT INTO platform_reconciliation`
- `updateReconciliation(id, data)` → `UPDATE platform_reconciliation SET status=?, adjusted_at=NOW()`
- `getDetail(id)` → `SELECT * FROM platform_reconciliation WHERE id=?`

**路由端点**：
- `GET /api/admin/platform-reconciliations` → `listReconciliations()`
- `POST /api/admin/platform-reconciliations` → `createReconciliation()`
- `PUT /api/admin/platform-reconciliations/:id` → `updateReconciliation()`
- `GET /api/admin/platform-reconciliations/:id` → `getDetail()`

#### 19-A-3: 平台审核管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `platform-review.service.ts` | `backend/src/services/admin/platform-review.service.ts` |
| `platform-review.routes.ts` | `backend/src/routes/platform-review.routes.ts` |

**Service方法**：
- `listReviews(params)` → `SELECT * FROM platform_review WHERE ... ORDER BY created_at DESC`
- `replyReview(id, replyContent)` → `UPDATE platform_review SET reply_content=?, replied_at=NOW()`
- `getStats()` → `SELECT platform, AVG(rating), COUNT(*) FROM platform_review GROUP BY platform`

**路由端点**：
- `GET /api/admin/platform-reviews` → `listReviews()`
- `POST /api/admin/platform-reviews/:id/reply` → `replyReview()`
- `GET /api/admin/platform-reviews/stats` → `getStats()`

---

### 任务 19-B: 即时零售P1后端

**负责人**：墨  
**工作量**：1天

#### 19-B-1: 小程序公告管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `retail-announcement.service.ts` | `backend/src/services/instant-retail/retail-announcement.service.ts` |
| `retail-announcement.routes.ts` | `backend/src/routes/retail-announcement.routes.ts` |

**Service方法**：
- `listAnnouncements(params)` → `SELECT * FROM retail_announcement WHERE store_id=? ORDER BY is_top DESC, created_at DESC`
- `createAnnouncement(data)` → `INSERT INTO retail_announcement`
- `updateAnnouncement(id, data)` → `UPDATE retail_announcement SET ...`
- `deleteAnnouncement(id)` → `DELETE FROM retail_announcement WHERE id=?`
- `getActiveAnnouncements(storeId)` → `SELECT * FROM retail_announcement WHERE store_id=? AND status=1 AND (start_time IS NULL OR start_time<=NOW()) AND (end_time IS NULL OR end_time>=NOW())`

**路由端点**：
- `GET /api/admin/retail-announcements` → `listAnnouncements()`
- `POST /api/admin/retail-announcements` → `createAnnouncement()`
- `PUT /api/admin/retail-announcements/:id` → `updateAnnouncement()`
- `DELETE /api/admin/retail-announcements/:id` → `deleteAnnouncement()`
- `GET /api/miniapp/retail-announcements` → `getActiveAnnouncements()`（无需认证，小程序端调用）

#### 19-B-2: 购物车管理

**扩展文件**：`backend/src/services/miniapp/cart.service.ts`（已存在，需扩展）

**新增方法**：
- `addToCart(userId, storeId, skuId, boxQty, bottleQty)` → `INSERT INTO retail_cart ... ON DUPLICATE KEY UPDATE ...`
- `removeFromCart(userId, skuId)` → `DELETE FROM retail_cart WHERE user_id=? AND sku_id=?`
- `updateCartItem(userId, skuId, checked)` → `UPDATE retail_cart SET checked=? WHERE user_id=? AND sku_id=?`
- `getCart(userId, storeId)` → `SELECT * FROM retail_cart WHERE user_id=? AND store_id=?`

**路由端点**（在已有 `cart.routes.ts` 中扩展）：
- `POST /api/miniapp/cart/add` → `addToCart()`
- `DELETE /api/miniapp/cart/:skuId` → `removeFromCart()`
- `PUT /api/miniapp/cart/:skuId` → `updateCartItem()`
- `GET /api/miniapp/cart` → `getCart()`

#### 19-B-3: 消费者地址管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `retail-consumer-address.service.ts` | `backend/src/services/miniapp/retail-consumer-address.service.ts` |
| `retail-consumer-address.routes.ts` | `backend/src/routes/retail-consumer-address.routes.ts` |

**Service方法**：
- `listAddresses(userId)` → `SELECT * FROM retail_consumer_address WHERE user_id=? ORDER BY is_default DESC`
- `createAddress(userId, data)` → `INSERT INTO retail_consumer_address`
- `updateAddress(id, userId, data)` → `UPDATE retail_consumer_address SET ... WHERE id=? AND user_id=?`
- `deleteAddress(id, userId)` → `DELETE FROM retail_consumer_address WHERE id=? AND user_id=?`
- `setDefault(id, userId)` → `UPDATE retail_consumer_address SET is_default=0 WHERE user_id=?; UPDATE retail_consumer_address SET is_default=1 WHERE id=?`

**路由端点**：
- `GET /api/miniapp/addresses` → `listAddresses()`
- `POST /api/miniapp/addresses` → `createAddress()`
- `PUT /api/miniapp/addresses/:id` → `updateAddress()`
- `DELETE /api/miniapp/addresses/:id` → `deleteAddress()`
- `PUT /api/miniapp/addresses/:id/default` → `setDefault()`

---

### 任务 19-C: 营销中心P1后端

**负责人**：阿澈  
**工作量**：1天

#### 19-C-1: 积分商城管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `points-mall.service.ts` | `backend/src/services/admin/points-mall.service.ts` |
| `points-mall.routes.ts` | `backend/src/routes/points-mall.routes.ts` |

**Service方法**（points_mall_item表）：
- `listItems(params)` → `SELECT * FROM points_mall_item WHERE ... ORDER BY created_at DESC`
- `createItem(data)` → `INSERT INTO points_mall_item`
- `updateItem(id, data)` → `UPDATE points_mall_item SET ...`
- `deleteItem(id)` → `DELETE FROM points_mall_item WHERE id=?`
- `updateStatus(id, status)` → `UPDATE points_mall_item SET status=?`

**Service方法**（points_mall_order表）：
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

#### 19-C-2: 营销素材管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `marketing-asset.service.ts` | `backend/src/services/admin/marketing-asset.service.ts` |
| `marketing-asset.routes.ts` | `backend/src/routes/marketing-asset.routes.ts` |

**Service方法**：
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

---

### 任务 19-D: 系统设置P1后端

**负责人**：阿澈  
**工作量**：0.5天

#### 19-D-1: 部门管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `department.service.ts` | `backend/src/services/admin/department.service.ts` |
| `department.routes.ts` | `backend/src/routes/department.routes.ts` |

**Service方法**：
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

#### 19-D-2: 用户会话管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `user-session.service.ts` | `backend/src/services/admin/user-session.service.ts` |
| `user-session.routes.ts` | `backend/src/routes/user-session.routes.ts` |

**Service方法**：
- `listSessions(params)` → `SELECT * FROM user_session WHERE ... ORDER BY last_activity_at DESC`
- `kickSession(id)` → `DELETE FROM user_session WHERE id=?`
- `kickUserSessions(userId)` → `DELETE FROM user_session WHERE user_id=?`
- `getStats()` → `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as online_users FROM user_session WHERE expires_at > NOW()`

**路由端点**：
- `GET /api/admin/sessions` → `listSessions()`
- `DELETE /api/admin/sessions/:id` → `kickSession()`
- `DELETE /api/admin/sessions/user/:userId` → `kickUserSessions()`
- `GET /api/admin/sessions/stats` → `getStats()`

---

## 四、Phase 20: P1功能开发 - 前端 [P1]

---

### 任务 20-A: 订单管理P1前端

**负责人**：阿坚  
**工作量**：1天

#### 20-A-1: `OrderSyncLog.vue`

**路径**：`admin-web/src/views/OrderSyncLog.vue`

**组件结构**：
- `el-table` columns: 订单号(order_no) / 平台(platform) / 同步类型(sync_type) / 方向(sync_direction) / 状态(status) / 错误信息(error_msg) / 创建时间(created_at)
- `el-form` 筛选栏: 订单号输入框 + 平台下拉(京东/美团/饿了么) + 状态下拉(SUCCESS/FAILED) + 查询按钮
- 操作列: 重试按钮 → `POST /api/admin/order-sync-logs/:orderNo/retry`

**路由注册**：`admin-web/src/router/index.ts` 添加：
```typescript
{ path: 'order-sync-logs', name: 'OrderSyncLogs', component: () => import('@/views/OrderSyncLog.vue') }
```

#### 20-A-2: `PlatformReconciliation.vue`

**路径**：`admin-web/src/views/PlatformReconciliation.vue`

**组件结构**：
- `el-table` columns: 对账日期 / 平台 / 平台订单数 / 平台金额 / 系统订单数 / 系统金额 / 差异单数 / 差异金额 / 佣金金额 / 状态(status) / 对账人 / 调整时间
- 差异行高亮（红色背景）
- `el-dialog` 新建对账: 平台下拉 + 日期选择 + 平台数据录入 + 系统数据自动计算
- 操作列: 查看详情 / 确认对账 / 标记差异 / 调整

**路由注册**：
```typescript
{ path: 'platform-reconciliation', name: 'PlatformReconciliation', component: () => import('@/views/PlatformReconciliation.vue') }
```

#### 20-A-3: `PlatformReview.vue`

**路径**：`admin-web/src/views/PlatformReview.vue`

**组件结构**：
- `el-table` columns: 平台 / 订单号 / 评分(rating，星级展示) / 评价内容 / 回复内容 / 回复时间 / 同步时间
- `el-dialog` 回复评价: `el-input type="textarea"` + 提交按钮
- 顶部统计卡片: 各平台平均评分 + 总评价数

**路由注册**：
```typescript
{ path: 'platform-reviews', name: 'PlatformReviews', component: () => import('@/views/PlatformReview.vue') }
```

---

### 任务 20-B: 即时零售P1前端

**负责人**：墨  
**工作量**：1天

#### 20-B-1: `RetailAnnouncement.vue`

**路径**：`admin-web/src/views/RetailAnnouncement.vue`

**组件结构**：
- `el-table` columns: 标题 / 门店 / 是否置顶 / 展示时间(start_time~end_time) / 状态 / 创建时间
- `el-dialog` 新建/编辑: 门店下拉 + 标题输入 + 内容富文本 + 置顶开关 + 时间范围选择器
- 操作列: 编辑 / 删除 / 启停切换

**路由注册**：
```typescript
{ path: 'retail-announcements', name: 'RetailAnnouncements', component: () => import('@/views/RetailAnnouncement.vue') }
```

#### 20-B-2: 扩展 `InstantRetailShelf.vue`

**路径**：`admin-web/src/views/InstantRetailShelf.vue`（已存在，1015行）

**扩展内容**：在商品货架页面添加"购物车数据"子Tab：
- `el-tab-pane` 新增"购物车分析"页签
- 统计卡片: 当前购物车商品数 / 加购用户数 / 热门加购商品Top10
- `el-table`: 用户ID / SKU名称 / 数量 / 加入时间

#### 20-B-3: `ConsumerAddress.vue`

**路径**：`admin-web/src/views/ConsumerAddress.vue`（管理后台查看消费者地址）

**组件结构**：
- `el-table` columns: 用户ID / 收货人 / 手机 / 省市区 / 详细地址 / 是否默认
- 筛选栏: 用户ID搜索

**路由注册**：
```typescript
{ path: 'consumer-addresses', name: 'ConsumerAddresses', component: () => import('@/views/ConsumerAddress.vue') }
```

---

### 任务 20-C: 营销中心P1前端

**负责人**：阿澈  
**工作量**：0.5天

#### 20-C-1: `PointsMall.vue`

**路径**：`admin-web/src/views/PointsMall.vue`

**组件结构**：
- 两个 `el-tab-pane`：商品管理 / 兑换订单
- 商品管理Tab: `el-table` columns: 商品名称 / 图片 / 所需积分 / 库存 / 每人限兑 / 有效期 / 状态 + 新建/编辑/删除
- 兑换订单Tab: `el-table` columns: 订单号 / 用户ID / 商品名称 / 消耗积分 / 数量 / 收货地址 / 状态 + 发货/取消按钮

**路由注册**：
```typescript
{ path: 'points-mall', name: 'PointsMall', component: () => import('@/views/PointsMall.vue') }
```

#### 20-C-2: `MarketingAsset.vue`

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

### 任务 20-D: 系统设置P1前端

**负责人**：阿澈  
**工作量**：0.5天

#### 20-D-1: `DepartmentManage.vue`

**路径**：`admin-web/src/views/DepartmentManage.vue`

**组件结构**：
- `el-tree` 树形展示部门结构（支持拖拽排序）
- 右键菜单: 新增子部门 / 编辑 / 删除 / 上移 / 下移
- `el-dialog` 编辑: 部门名称 + 所属门店下拉 + 排序号

**路由注册**：
```typescript
{ path: 'departments', name: 'Departments', component: () => import('@/views/DepartmentManage.vue') }
```

#### 20-D-2: `SessionManage.vue`

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

## 五、Phase 21: P2功能开发 [P2]

---

### 任务 21-A: 数据报表P2

**负责人**：阿坚  
**工作量**：1.5天

#### 21-A-1: 后端 — 报表引擎

**新建文件**：

| 文件 | 路径 |
|------|------|
| `custom-report.service.ts` | `backend/src/services/admin/custom-report.service.ts` |
| `custom-report.routes.ts` | `backend/src/routes/custom-report.routes.ts` |

**custom_report_template CRUD**：
- `listTemplates(params)` → `SELECT * FROM custom_report_template ORDER BY created_at DESC`
- `createTemplate(data)` → `INSERT INTO custom_report_template`
- `updateTemplate(id, data)` → `UPDATE custom_report_template SET ...`
- `deleteTemplate(id)` → `DELETE FROM custom_report_template`
- `executeTemplate(id, params)` → 根据 `config` JSON 动态生成SQL并执行

**custom_report_schedule CRUD**：
- `listSchedules(params)` → `SELECT * FROM custom_report_schedule ORDER BY created_at DESC`
- `createSchedule(data)` → `INSERT INTO custom_report_schedule`
- `updateSchedule(id, data)` → `UPDATE custom_report_schedule SET ...`
- `deleteSchedule(id)` → `DELETE FROM custom_report_schedule`
- `toggleSchedule(id, status)` → `UPDATE custom_report_schedule SET status=?`
- `runSchedule(id)` → 立即执行一次定时任务

**路由端点**：
- `GET /api/admin/reports/templates` → `listTemplates()`
- `POST /api/admin/reports/templates` → `createTemplate()`
- `PUT /api/admin/reports/templates/:id` → `updateTemplate()`
- `DELETE /api/admin/reports/templates/:id` → `deleteTemplate()`
- `POST /api/admin/reports/templates/:id/execute` → `executeTemplate()`
- `GET /api/admin/reports/schedules` → `listSchedules()`
- `POST /api/admin/reports/schedules` → `createSchedule()`
- `PUT /api/admin/reports/schedules/:id` → `updateSchedule()`
- `DELETE /api/admin/reports/schedules/:id` → `deleteSchedule()`
- `PUT /api/admin/reports/schedules/:id/toggle` → `toggleSchedule()`
- `POST /api/admin/reports/schedules/:id/run` → `runSchedule()`

#### 21-A-2: 前端 — `CustomReport.vue`

**路径**：`admin-web/src/views/CustomReport.vue`

**组件结构**：
- 两个 `el-tab-pane`：报表模板 / 定时任务
- 报表模板Tab:
  - `el-table`：模板名称 / 类型 / 创建人 / 状态 / 操作
  - `el-dialog` 报表设计器：指标多选（销售额/利润/数量等）+ 维度多选（按日期/门店/商品/客户等）+ 筛选条件 + 预览
- 定时任务Tab:
  - `el-table`：任务名称 / 模板 / cron表达式 / 导出格式 / 上次执行 / 状态
  - `el-dialog`：模板下拉 + 任务名称 + cron输入 + 格式下拉 + 接收人输入

**路由注册**：
```typescript
{ path: 'custom-reports', name: 'CustomReports', component: () => import('@/views/CustomReport.vue') }
```

---

### 任务 21-B: 系统设置P2

**负责人**：墨  
**工作量**：1天

#### 21-B-1: 后端 — 报表权限

**新建文件**：

| 文件 | 路径 |
|------|------|
| `report-permission.service.ts` | `backend/src/services/admin/report-permission.service.ts` |
| `report-permission.routes.ts` | `backend/src/routes/report-permission.routes.ts` |

**Service方法**：
- `getMatrix()` → `SELECT * FROM report_permission_matrix ORDER BY role_id, report_code`
- `saveMatrix(data: Array<{role_id, report_code, store_scope}>)` → 事务: DELETE all → INSERT batch

**路由端点**：
- `GET /api/admin/report-permissions/matrix` → `getMatrix()`
- `PUT /api/admin/report-permissions/matrix` → `saveMatrix()`

#### 21-B-2: 前端 — `ReportPermission.vue`

**路径**：`admin-web/src/views/ReportPermission.vue`

**组件结构**：
- 矩阵式表格：行=角色名称，列=报表编码，单元格=下拉选择(SELF/CHILDREN/ALL)
- 未配置的单元格显示 --（灰色）
- 底部保存按钮

**路由注册**：
```typescript
{ path: 'report-permissions', name: 'ReportPermissions', component: () => import('@/views/ReportPermission.vue') }
```

---

### 任务 21-C: 营销中心P2（已有DDL，需后端+前端）

**负责人**：阿澈  
**工作量**：1.5天

#### 21-C-1: 后端 — 秒杀管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `seckill.service.ts` | `backend/src/services/admin/seckill.service.ts` |
| `seckill.routes.ts` | `backend/src/routes/seckill.routes.ts` |

**Service方法**（基于 `seckill_product` 表）：
- `listSeckillProducts(activityId)` → `SELECT sp.*, p.sku_name FROM seckill_product sp JOIN product_sku p ON p.id=sp.product_id WHERE sp.activity_id=?`
- `addSeckillProduct(data)` → `INSERT INTO seckill_product`
- `updateSeckillProduct(id, data)` → `UPDATE seckill_product SET ...`
- `removeSeckillProduct(id)` → `DELETE FROM seckill_product WHERE id=?`

**路由端点**：
- `GET /api/admin/marketing/seckill/:activityId/products` → `listSeckillProducts()`
- `POST /api/admin/marketing/seckill/products` → `addSeckillProduct()`
- `PUT /api/admin/marketing/seckill/products/:id` → `updateSeckillProduct()`
- `DELETE /api/admin/marketing/seckill/products/:id` → `removeSeckillProduct()`

#### 21-C-2: 后端 — 拼团管理

**新建文件**：

| 文件 | 路径 |
|------|------|
| `group-buy.service.ts` | `backend/src/services/admin/group-buy.service.ts` |
| `group-buy.routes.ts` | `backend/src/routes/group-buy.routes.ts` |

**Service方法**（基于 `group_buy_activity`, `group_buy_record`, `group_buy_participant` 三表）：
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

#### 21-C-3: 前端 — `SeckillManage.vue`

**路径**：`admin-web/src/views/SeckillManage.vue`

**组件结构**：
- `el-table`：商品名称 / 原价 / 秒杀价 / 总库存 / 剩余库存 / 限购数量 / 操作
- `el-dialog` 添加秒杀商品：搜索选择商品 + 秒杀价格输入 + 库存输入 + 限购数量
- 操作列：编辑 / 删除

**路由注册**：
```typescript
{ path: 'marketing/seckill', name: 'SeckillManage', component: () => import('@/views/SeckillManage.vue') }
```

#### 21-C-4: 前端 — `GroupBuyManage.vue`

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

## 六、Phase 22: 集成测试 + 文档同步 [P0]

**负责人**：全员  
**工作量**：2天

### 22-1: 全链路测试清单

| 序号 | 测试场景 | 验证点 |
|:---:|------|------|
| 1 | 开单→分享→支付→库存扣减 | sale_bill创建 → collection_link生成 → 微信支付回调 → inventory_balance减少 |
| 2 | 小程序下单→同步→对账 | miniapp_order → sync_log → platform_reconciliation |
| 3 | 租户注册→订阅→模块授权 | tenant创建 → subscription → tenant_module_access |
| 4 | 优惠券→促销→叠加 | coupon_template → user_coupon → promotion_stack_rule |
| 5 | 秒杀→库存扣减→超卖防护 | seckill_product库存原子操作 |
| 6 | 拼团→成团→失败退款 | group_buy_record状态流转 |
| 7 | 积分兑换→库存扣减 | points_mall_order → points_mall_item.stock |
| 8 | 客户拜访→跟进→关联订单 | customer_visit → follow_up |
| 9 | 平台评价→回复→同步 | platform_review → reply |
| 10 | 部门管理→权限继承 | sys_department + sys_user_role |

### 22-2: 文档同步清单

| 序号 | 文件 | 更新内容 |
|:---:|------|------|
| 1 | `product-spec-v6-adapted.md` | 最终同步：所有Section字段完整，完成度100% |
| 2 | `init_database.sql` | 合并所有迁移表（或创建合并脚本） |
| 3 | `task-plan-v7.md` | 标记完成状态 |
| 4 | `README.md` | 更新项目版本号 v6.2 → v7.0 |
| 5 | Git tag | `git tag v7.0` |

---

## 七、全部产出物清单

| 类型 | 数量 | 说明 |
|------|:---:|------|
| 新建迁移SQL | **33** | 14张缺失 + 19张phase提取 |
| 新建Service文件 | **14** | sys-user, operation-log, system, miniapp-order-sync, platform-reconciliation, platform-review, retail-announcement, retail-consumer-address, points-mall, marketing-asset, department, user-session, custom-report, report-permission, seckill, group-buy |
| 新建Route文件 | **14** | 对应上述14个service |
| 重构Route文件 | **8** | share, platform, order-timeout, store-control, notification, sys-user, operation-log, system |
| 新建Vue视图 | **14** | OrderSyncLog, PlatformReconciliation, PlatformReview, RetailAnnouncement, ConsumerAddress, PointsMall, MarketingAsset, DepartmentManage, SessionManage, CustomReport, ReportPermission, SeckillManage, GroupBuyManage |
| 新建saas-admin项目 | **1** | 完整项目骨架 + 10个视图 |
| 扩展已有文件 | **5** | cart.service.ts, InstantRetailShelf.vue, product-spec-v6-adapted.md, server.ts, admin-web router |

---

## 八、server.ts 路由注册清单

需在 `backend/src/server.ts` 中新增的 `app.use()` 行：

```typescript
// Phase 19 - 订单管理P1
app.use('/api/admin/order-sync-logs', requireAuthWithTenant, orderSyncLogRouter);
app.use('/api/admin/platform-reconciliations', requireAuthWithTenant, platformReconciliationRouter);
app.use('/api/admin/platform-reviews', requireAuthWithTenant, platformReviewRouter);

// Phase 19 - 即时零售P1
app.use('/api/admin/retail-announcements', requireAuthWithTenant, retailAnnouncementRouter);
app.use('/api/miniapp/retail-announcements', retailAnnouncementRouter);  // 无需认证
app.use('/api/miniapp/addresses', requireMiniappAuth, retailConsumerAddressRouter);

// Phase 19 - 营销中心P1
app.use('/api/admin/points-mall', requireAuthWithTenant, pointsMallRouter);
app.use('/api/admin/marketing-assets', requireAuthWithTenant, marketingAssetRouter);

// Phase 19 - 系统设置P1
app.use('/api/admin/departments', requireAuthWithTenant, departmentRouter);
app.use('/api/admin/sessions', requireAuthWithTenant, userSessionRouter);

// Phase 21 - 数据报表P2
app.use('/api/admin/reports', requireAuthWithTenant, customReportRouter);

// Phase 21 - 系统设置P2
app.use('/api/admin/report-permissions', requireAuthWithTenant, reportPermissionRouter);

// Phase 21 - 营销中心P2
app.use('/api/admin/marketing/seckill', requireAuthWithTenant, seckillRouter);
app.use('/api/admin/marketing/group-buy', requireAuthWithTenant, groupBuyRouter);
```

---

## 九、admin-web 路由注册清单

需在 `admin-web/src/router/index.ts` 中新增的路由：

```typescript
// Phase 20 - 订单管理P1
{ path: 'order-sync-logs', name: 'OrderSyncLogs', component: () => import('@/views/OrderSyncLog.vue') },
{ path: 'platform-reconciliation', name: 'PlatformReconciliation', component: () => import('@/views/PlatformReconciliation.vue') },
{ path: 'platform-reviews', name: 'PlatformReviews', component: () => import('@/views/PlatformReview.vue') },

// Phase 20 - 即时零售P1
{ path: 'retail-announcements', name: 'RetailAnnouncements', component: () => import('@/views/RetailAnnouncement.vue') },
{ path: 'consumer-addresses', name: 'ConsumerAddresses', component: () => import('@/views/ConsumerAddress.vue') },

// Phase 20 - 营销中心P1
{ path: 'points-mall', name: 'PointsMall', component: () => import('@/views/PointsMall.vue') },
{ path: 'marketing-assets', name: 'MarketingAssets', component: () => import('@/views/MarketingAsset.vue') },

// Phase 20 - 系统设置P1
{ path: 'departments', name: 'Departments', component: () => import('@/views/DepartmentManage.vue') },
{ path: 'sessions', name: 'Sessions', component: () => import('@/views/SessionManage.vue') },

// Phase 21 - 数据报表P2
{ path: 'custom-reports', name: 'CustomReports', component: () => import('@/views/CustomReport.vue') },

// Phase 21 - 系统设置P2
{ path: 'report-permissions', name: 'ReportPermissions', component: () => import('@/views/ReportPermission.vue') },

// Phase 21 - 营销中心P2
{ path: 'marketing/seckill', name: 'SeckillManage', component: () => import('@/views/SeckillManage.vue') },
{ path: 'marketing/group-buy', name: 'GroupBuyManage', component: () => import('@/views/GroupBuyManage.vue') },
```