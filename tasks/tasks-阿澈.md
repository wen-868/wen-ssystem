# 阿澈 · 工作总台模块 · 商户移动端前端

**日期**：2026-07-01
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 商户首页 Dashboard 页面 | P0 | ❌ |
| 2 | 待办列表 页面 | P0 | ❌ |
| 3 | 消息中心 页面 | P0 | ❌ |
| 4 | 快捷入口 页面 | P0 | ❌ |

---

## 审计发现

### 已有前端基础
- **HomeView.vue**：`merchant-mobile/src/views/HomeView.vue`（538行），当前实现：hero 区域（今日经营）、2x2 指标网格（今日销售额/今日收款额/待配送订单/待收款金额）、近7天销售趋势柱状图、库存预警列表、模块快捷入口（6组硬编码）
- **NotificationView.vue**：`merchant-mobile/src/views/NotificationView.vue`（228行），完整实现：Tab分类切换（全部/系统/订单/支付/预警/信用/召回）、下拉刷新、无限滚动加载、全部已读、点击跳转详情
- **NotificationDetailView.vue**：`merchant-mobile/src/views/NotificationDetailView.vue`（191行），完整实现：通知详情展示、关联业务跳转
- **API**：`merchant-mobile/src/api.ts` 已有 `fetchDashboard`、`fetchDailySales`、`fetchInventoryAlerts`、`fetchNotifications`、`markNotificationRead`、`markAllNotificationsRead`
- **路由**：`merchant-mobile/src/router.ts` 已有 `/notifications`、`/notifications/:id` 路由
- **Vant 组件库**：已使用 van-grid、van-icon、van-loading、van-cell、van-tabs、van-pull-refresh、van-list 等

### 关键缺失
- **HomeView 信息密度低**：当前仅4指标+1趋势+预警+快捷入口，产品规格要求~75字段（经营概览~40 + 数据看板~35）
- **无待办页面**：商户端完全没有待办提醒相关页面和路由
- **快捷入口硬编码**：当前 HomeView 中 `moduleGroups` 是写死的数组，不是从API配置读取
- **消息通知未集成到首页**：通知功能已完善但首页没有消息铃铛和未读计数
- **数据看板缺失**：没有品类分析/商品排行/客户排行等图表

---

## 详细说明

### 1. 商户首页 Dashboard 页面
- **文件**：`merchant-mobile/src/views/HomeView.vue`（重构现有文件）
- **API**：使用 `api.ts` 中已有的 `fetchDashboard`、`fetchDailySales`、`fetchInventoryAlerts`，新增 `fetchDashboardOverview`、`fetchDashboardSalesTrend`、`fetchDashboardTopProducts`、`fetchDashboardTopCustomers`
- **关键实现**（~40字段）：
  - 顶部区域：门店名称（支持多门店切换）+ 消息铃铛（未读红点）+ 日期
  - 核心指标：2x2 网格卡片（今日销售额/今日收款/待配送订单/待收款金额），每卡片含迷你趋势图（面积图或 sparkline）
  - 待办摘要：横向滑动卡片，显示各类型待办数量（库存预警/订单待处理/客户跟进...），点击跳转待办列表
  - 销售趋势：近7天柱状图（使用 Vant 友好图表或 Canvas 简化版，适配移动端）
  - 品类分布：环形图（简化版，适配移动端）
  - Top排行：Top5商品/Top5客户 横向进度条列表
  - 库存预警：简化为前3条，点击展开全部
  - 快捷入口：从 API 配置读取，宫格布局（3列或4列）
  - 状态处理：van-skeleton 骨架屏、van-empty 空状态、下拉刷新
  - 样式：遵循 Vant 设计规范，移动端触控友好
- **说明**：重构 HomeView.vue（538行 → 预计扩展到800+行）。核心升级：指标卡片从4个扩展到8个、增加待办摘要区、增加品类/Top分析、快捷入口从硬编码改为配置化。按产品规格~40字段实现。

### 2. 待办列表 页面
- **文件**：`merchant-mobile/src/views/TodoListView.vue`（新建）
- **路由**：注册 `/todos` 路由，在首页待办摘要区点击"查看全部"跳转
- **API**：调用 `GET /api/admin/todos`、`PUT /api/admin/todos/:id`、`GET /api/admin/todos/stats`
- **关键实现**（~30字段）：
  - 顶部：类型统计标签栏（横向滑动，各类型带数量），点击筛选
  - 待办列表：van-cell 列表项，含类型图标+颜色标签/标题/来源摘要/优先级色标/截止日期/相对时间
  - 优先级视觉：HIGH红色标签、MEDIUM橙色标签、LOW灰色标签
  - 筛选：按类型/优先级/状态（待处理/已完成）筛选
  - 操作：左滑露出完成/忽略按钮，点击跳转关联业务页面
  - 新建待办：浮动按钮 → 弹出表单（标题/类型/优先级/截止日期/备注）
  - 状态处理：van-empty 空状态"暂无待办事项，经营状态良好"、van-pull-refresh 下拉刷新
- **说明**：待办列表约30字段。商户端需支持与首页的待办摘要联动。用户可点击自动生成的待办跳转到对应业务页面处理。

### 3. 消息中心 页面
- **文件**：增强 `merchant-mobile/src/views/NotificationView.vue` + 在 HomeView.vue 添加消息铃铛
- **路由**：已有 `/notifications`、`/notifications/:id`
- **API**：使用已有 `fetchNotifications`、`markNotificationRead`、`markAllNotificationsRead`、`fetchUnreadCount`
- **关键实现**（~20字段）：
  - 消息铃铛：HomeView 顶部导航栏右侧，显示未读计数红点，定时轮询（30秒）或 WebSocket 实时更新
  - 通知列表：已有完整实现，需增强：支持消息类型图标颜色区分、支持按时间范围筛选（今天/本周/本月）、支持消息推送设置入口（免打扰时段/类型开关）
  - 通知详情：已有完整实现，需增强：支持关联业务一键跳转、支持富文本内容展示
  - 未读计数：全局状态管理（Pinia store），其他页面也能显示
  - 状态处理：已有完善处理
- **说明**：消息中心约20字段。商户端通知功能已是全系统最完善的模块之一，主要增强：1) 首页消息铃铛集成；2) 推送设置页面；3) 全局未读计数状态管理。

### 4. 快捷入口 页面
- **文件**：在 `merchant-mobile/src/views/HomeView.vue` 中重构快捷入口区域，从 API 配置读取
- **API**：调用 `GET /api/admin/quick-entries?type=MERCHANT`
- **关键实现**（~20字段）：
  - 快捷入口组件：宫格布局（3列或4列），图标+文字，按分组展示
  - 数据来源：从 API 配置读取，替代当前硬编码的 `moduleGroups` 数组
  - 分组展示：每组一个标题栏，卡片内图标+文字
  - 点击跳转：路由跳转
  - 排序：按 sort_order 排序
  - 角色过滤：根据当前用户角色，仅显示可见入口
  - 默认预设：如果 API 返回空，使用默认6组入口作为兜底
  - 状态处理：加载中显示骨架屏、空配置时使用默认入口
- **说明**：快捷入口约20字段。将当前硬编码的快捷入口改为从 API 配置读取。当前 HomeView 的 `moduleGroups` 实现（6组15个入口）需要完全替换为 API 驱动。支持角色过滤和多门店适配。