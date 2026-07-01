# 墨 · 工作总台模块 · 管理后台前端

**日期**：2026-07-01
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 经营概览 Dashboard 页面 | P0 | ❌ |
| 2 | 待办提醒 页面 | P0 | ❌ |
| 3 | 快捷入口 页面 | P0 | ❌ |
| 4 | 消息中心 页面 | P0 | ❌ |

---

## 审计发现

### 已有前端基础
- **Dashboard.vue**：`admin-web/src/views/Dashboard.vue`（212行），当前实现：4个指标卡片（今日销售额/待收款/待处理订单/库存预警）、库存预警表格、门店业绩表格、近7天销售趋势 Canvas 柱状图
- **API 封装**：`admin-web/src/api.ts` 已有 `fetchDashboard`（第42行）、`fetchDailySales`、`fetchInventoryAlerts`、`fetchStorePerformance`，以及 Phase 9 新增的 `fetchDashboardOverview`/`fetchDashboardSalesTrend`/`fetchDashboardCategoryPie`/`fetchDashboardTopProducts`/`fetchDashboardTopCustomers`/`fetchDashboardRecentAlerts`（第310-337行）
- **路由**：`admin-web/src/router/index.ts` 第47-51行，Dashboard 路由已注册，`/dashboard` → `Dashboard.vue`，角色限制 `["BOSS", "MGR"]`
- **菜单**：`MainLayout.vue` 第22行，菜单项 `index="/dashboard"` 名称"工作总台"
- **ECharts**：已在其他页面使用（如 FinanceDashboard.vue、Reports.vue），可复用

### 关键缺失
- **Dashboard 信息密度低**：当前仅4卡片+2表格+1图表，产品规格要求~75字段（经营概览~40 + 数据看板~35）
- **无待办页面**：管理后台完全没有待办提醒相关页面和路由
- **无快捷入口配置页面**：快捷入口配置功能完全空白
- **无消息中心页面**：通知后端已完整，但管理后台无消息中心页面

---

## 详细说明

### 1. 经营概览 Dashboard 页面
- **文件**：`admin-web/src/views/Dashboard.vue`（重构现有文件）
- **API**：使用 `api.ts` 中已有的 `fetchDashboardOverview`、`fetchDashboardSalesTrend`、`fetchDashboardCategoryPie`、`fetchDashboardTopProducts`、`fetchDashboardTopCustomers`、`fetchDashboardRecentAlerts`
- **关键实现**（~40字段）：
  - 顶部区域：欢迎语 + 日期 + 门店选择器（多门店下拉切换）
  - 指标卡片行：8个卡片（今日销售额/今日订单数/今日毛利/客单价/待收款/库存预警数/待处理订单/今日新增客户），每个卡片含数值+环比箭头+同比标签+迷你趋势 sparkline
  - 图表区：2x2 ECharts 网格
    - 近7天/30天销售趋势（折线图，支持切换）
    - 品类销售占比（饼图/环形图）
    - Top10商品排行（横向柱状图，含销售额+销量双轴）
    - Top10客户排行（横向柱状图）
  - 预警区：折叠面板，含库存预警列表/临期预警列表/应收逾期列表/待处理订单列表
  - 样式：使用 Element Plus `el-card`/`el-row`/`el-col` 栅格布局，ECharts 图表，响应式适配
  - 状态处理：加载骨架屏、空数据占位、错误重试
- **说明**：重构现有 Dashboard.vue（212行 → 预计扩展到500+行）。将 Canvas 手绘图表替换为 ECharts。按产品规格~40字段实现完整经营概览。需与阿坚的聚合API对接。

### 2. 待办提醒 页面
- **文件**：`admin-web/src/views/TodoList.vue`（新建）
- **路由**：注册 `/dashboard/todos` 路由，在 MainLayout 菜单中作为子菜单或独立入口
- **API**：调用 `GET /api/admin/todos`、`PUT /api/admin/todos/:id`、`DELETE /api/admin/todos/:id`、`GET /api/admin/todos/stats`
- **关键实现**（~30字段）：
  - 统计卡片：各类型待办数量（库存预警/订单待处理/支付逾期/采购审批/退货待处理/客户跟进），点击筛选
  - 待办列表：表格列（类型标签+颜色/标题/来源/优先级色标/截止日期/创建时间/操作按钮）
  - 筛选：按类型/优先级/状态筛选
  - 操作：完成/忽略/跳转关联业务（点击跳转到对应页面）
  - 新建待办：弹窗表单（标题/类型/优先级/截止日期/备注）
  - 优先级视觉：HIGH红色/HIGH橙色/MEDIUM黄色/LOW灰色
  - 状态处理：空列表提示"暂无待办事项，经营状态良好"
- **说明**：待办页面是工作总台核心子模块，约30字段。需支持自动生成+手动创建两种模式。从 Dashboard 可点击待办数量跳转过来。

### 3. 快捷入口 页面
- **文件**：`admin-web/src/views/QuickEntryConfig.vue`（新建配置页）+ 在 Dashboard.vue 中嵌入快捷入口组件
- **路由**：注册 `/dashboard/quick-entries`，在 MainLayout 菜单中作为子菜单
- **API**：调用 `GET /api/admin/quick-entries`、`POST /api/admin/quick-entries`、`PUT /api/admin/quick-entries/:id`、`DELETE /api/admin/quick-entries/:id`、`PUT /api/admin/quick-entries/sort`
- **关键实现**（~20字段）：
  - 配置页面：左侧入口列表（支持拖拽排序 vuedraggable）+ 右侧编辑表单
  - 入口编辑：名称/图标选择器（Element Plus Icons 搜索）/路由/分组/启用开关/角色可见性（多选）
  - 新增入口：弹窗表单
  - 展示组件（嵌入 Dashboard）：宫格布局（3列或4列），图标+名称卡片，点击跳转路由，按分组显示
  - 默认预设：首次加载时如果没有配置，使用默认8个入口
  - 状态处理：空配置时显示默认入口
- **说明**：快捷入口分为配置页和展示组件两部分。配置页可独立访问，展示组件嵌入 Dashboard 顶部区域。约20字段。

### 4. 消息中心 页面
- **文件**：`admin-web/src/views/MessageCenter.vue`（新建）
- **路由**：注册 `/dashboard/messages`，在 MainLayout 顶部导航栏添加消息铃铛图标
- **API**：调用 `GET /api/admin/notifications`、`GET /api/admin/notifications/unread-count`、`PUT /api/admin/notifications/:id/read`、`POST /api/admin/notifications/read-all`、`GET /api/admin/notifications/type-stats`
- **关键实现**（~20字段）：
  - 消息铃铛：顶部导航栏右侧，显示未读计数红点，点击弹出下拉面板（最近5条预览）
  - 消息中心页面：左侧类型筛选（全部/系统/订单/支付/预警/信用/召回，各类型带未读计数），右侧消息列表
  - 列表项：类型图标+标题+摘要+时间+已读/未读状态，已读灰色，未读加粗
  - 操作：点击标记已读并展开详情/全部标记已读/单条删除
  - 分页：支持滚动加载更多
  - 状态处理：空列表提示"暂无消息"、加载骨架屏
- **说明**：消息中心约20字段。通知后端已完备，前端从零构建。参考商户端 `NotificationView.vue` 的设计，但适配 Element Plus 桌面端交互模式。