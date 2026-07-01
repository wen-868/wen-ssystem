# 苏然 · 工作总台模块 · 测试工程师

**日期**：2026-07-01
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | Dashboard API 测试 | P0 | ❌ |
| 2 | 待办提醒 测试 | P0 | ❌ |
| 3 | 消息通知 测试 | P0 | ❌ |
| 4 | 前端页面 测试 | P0 | ❌ |

---

## 审计发现

### 已有测试基础
- **通知系统**：`notification` 表已有完整 DDL（`init_database.sql` 第1259行），`notification.routes.ts` + `notification.controller.ts` + `notification.service.ts` 三层架构完整
- **Dashboard API**：`report.controller.ts` 有 `getDashboard`，`report.service.ts` 有基础查询逻辑，`admin.routes.ts` 第77-86行有路由注册
- **前端页面**：管理后台 `Dashboard.vue`、商户端 `HomeView.vue`/`NotificationView.vue` 有参考实现
- **DAO 模式**：已有 `queryWithTenant`/`queryOneWithTenant` 等租户隔离查询函数

### 关键缺失
- **无待办表测试**：`todo` 表为全新 DDL，需验证表结构、索引、租户隔离
- **无快捷入口表测试**：`quick_entry` 表为全新 DDL，需验证
- **Dashboard API 未覆盖完整**：现有 `getDashboard` 仅返回6个字段，Phase 14 将扩展到~40字段
- **无集成测试**：经营概览聚合查询涉及跨表 JOIN，需验证性能和数据准确性
- **前端页面无自动化测试**：新页面（TodoList/MessageCenter/QuickEntryConfig/商户端TodoListView）需验证

---

## 详细说明

### 1. Dashboard API 测试
- **测试范围**：经营概览聚合API + 数据看板API
- **测试接口**：
  - `GET /api/admin/dashboard/overview` - 验证核心指标返回（8个卡片+环比/同比）
  - `GET /api/admin/dashboard/sales-trend` - 验证近7天/30天趋势数据
  - `GET /api/admin/dashboard/category-pie` - 验证品类分布数据
  - `GET /api/admin/dashboard/top-products` - 验证Top10商品排行
  - `GET /api/admin/dashboard/top-customers` - 验证Top10客户排行
  - `GET /api/admin/dashboard/recent-alerts` - 验证预警汇总
- **测试用例**（~40字段逐一验证）：
  - 数据准确性：插入已知销售/采购/库存/客户数据，验证聚合结果与手动计算一致
  - 环比/同比计算：对比昨日/上周同期数据，验证增长率计算正确
  - 多门店场景：切换门店参数，验证数据范围正确隔离
  - 租户隔离：不同租户的 dashboard 数据互不可见
  - 空数据场景：新租户无数据时，返回0值而非报错
  - 边界场景：单日无销售/无订单/无客户时各指标返回正确
  - 性能测试：百万级数据下的聚合查询响应时间 < 3秒
  - 错误处理：无效参数/缺失参数时的错误响应
- **DAO 验证**：验证 `dashboard.service.ts` 中各查询使用正确的索引和租户过滤
- **说明**：Dashboard API 是工作总台最核心的接口，需严格验证数据准确性。~40字段逐字段对比。

### 2. 待办提醒 测试
- **测试范围**：待办 DDL + 待办 CRUD API + 自动生成逻辑
- **DDL 验证**：
  - `docs/migrations/add_todo_table.sql` - 验证表结构字段类型/长度/默认值/索引
  - 验证 `tenant_id` 列存在并有索引
  - 验证 `type` ENUM 值正确（INVENTORY_ALERT/ORDER_PENDING/PAYMENT_OVERDUE/PURCHASE_APPROVAL/RETURN_PENDING/CUSTOMER_FOLLOW）
  - 验证 `priority` ENUM 值正确（HIGH/MEDIUM/LOW）
  - 验证 `status` ENUM 值正确（PENDING/DONE）
- **API 测试**：
  - `POST /api/admin/todos` - 创建待办，验证必填字段校验
  - `GET /api/admin/todos` - 列表查询，验证分页/筛选/排序
  - `GET /api/admin/todos/stats` - 按类型统计，验证各类型数量准确
  - `PUT /api/admin/todos/:id` - 更新待办状态，验证幂等性
  - `DELETE /api/admin/todos/:id` - 删除待办，验证软删除或硬删除行为
- **自动生成测试**：
  - 插入低于阈值的库存数据 → 验证自动生成 INVENTORY_ALERT 待办
  - 插入待支付订单 → 验证自动生成 ORDER_PENDING 待办
  - 插入超期应收款 → 验证自动生成 PAYMENT_OVERDUE 待办
  - 验证自动生成不会重复创建相同待办
  - 验证自动生成使用正确的 assignee 和 priority
- **租户隔离**：验证租户A的待办对租户B不可见
- **说明**：待办提醒是全新模块，需从DDL到API完整测试。~30字段逐一验证。

### 3. 消息通知 测试
- **测试范围**：通知表增强 + 通知 API 增强 + 自动触发
- **DDL 验证**：
  - 验证 `notification` 表已有结构完整（`init_database.sql` 第1259行）
  - 验证新增 `summary` 字段（如需添加）
  - 验证索引（recipient_id+recipient_type/type/is_read/sent_at）
- **API 测试**：
  - `GET /api/admin/notifications` - 列表查询，验证分页/类型筛选/时间范围筛选
  - `GET /api/admin/notifications/unread-count` - 未读计数，验证与实际情况一致
  - `GET /api/admin/notifications/type-stats` - 各类型未读统计，验证数量准确
  - `PUT /api/admin/notifications/:id/read` - 标记已读，验证状态变更
  - `POST /api/admin/notifications/read-all` - 全部已读，验证批量操作
  - `POST /api/admin/notifications/send` - 发送通知，验证字段校验
  - 商户端 `GET /api/miniapp/notifications` - 验证 `MERCHANT` 类型支持
- **自动触发测试**：
  - 库存低于阈值 → 验证自动发送 ALERT 通知
  - 订单状态变更 → 验证自动发送 ORDER 通知
  - 支付逾期 → 验证自动发送 PAYMENT 通知
  - 验证通知 `recipient_id` 正确（门店管理员/老板）
- **租户隔离**：验证租户A的通知对租户B不可见
- **说明**：消息通知系统基础扎实，本次测试重点是新增的 type-stats 接口和商户端 MERCHANT 类型支持。~20字段。

### 4. 前端页面 测试
- **测试范围**：管理后台 + 商户端 共8个页面
- **管理后台页面**：
  - `Dashboard.vue`（重构后）- 验证8个指标卡片、4个ECharts图表、预警区、快捷入口展示
  - `TodoList.vue`（新建）- 验证待办列表/筛选/新建/完成/跳转
  - `QuickEntryConfig.vue`（新建）- 验证拖拽排序/启用禁用/CRUD/角色过滤
  - `MessageCenter.vue`（新建）- 验证消息列表/铃铛红点/已读未读/类型筛选
- **商户端页面**：
  - `HomeView.vue`（重构后）- 验证指标卡片/迷你趋势图/待办摘要/快捷入口/消息铃铛
  - `TodoListView.vue`（新建）- 验证待办列表/筛选/左滑操作/新建
  - `NotificationView.vue`（增强）- 验证推送设置/时间筛选/全局未读
  - 快捷入口展示 - 验证从API配置读取/分组/角色过滤
- **测试要点**：
  - 页面渲染：所有页面正常加载、无控制台错误
  - 数据加载：API 调用正确、loading/empty/error 状态正确展示
  - 交互功能：点击/筛选/排序/拖拽/跳转正常
  - 响应式：桌面端/平板/手机端布局正常
  - 角色权限：不同角色（BOSS/MGR/SALES/CASHIER）看到不同内容
  - 多门店：切换门店后数据刷新正确
  - 租户隔离：不同租户登录后数据隔离
  - 浏览器兼容：Chrome/Edge/Safari 均可正常使用
- **说明**：前端测试覆盖8个页面（4个管理后台+4个商户端）。重点关注重构页面的回归测试和新建页面的功能完整性。