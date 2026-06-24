# 墨 - 技术负责人任务清单

> 角色：技术负责人 / 前端架构师
> 技术栈：Vue 3 + Vite + TypeScript + Express + Node.js
> 工作时间：每天 8 小时

---

## 当前阶段：基础架构整改期（6/24 - 6/30）

### 🔴 P0 - admin-web 引入 vue-router + 页面拆分 [R1-01]
**截止时间**：6/27（周六）
**预计耗时**：32 小时
**优先级**：最高（阻塞所有 PC 端后续开发）

**任务详情**：

#### 第一步：安装与路由配置（Day 1）
1. 安装 vue-router@4
2. 创建 `src/router/index.ts`，定义 22 个路由
3. 创建 `src/layouts/MainLayout.vue`
   - 侧边栏导航（从 App.vue 抽取）
   - 顶部导航栏
   - 主内容区 `<router-view>`

#### 第二步：创建 views 目录和页面骨架（Day 1-2）
4. 创建 `src/views/` 目录，每个页面一个 .vue 文件：
   - `DashboardView.vue` - 首页/仪表盘
   - `ProductsView.vue` - 商品管理
   - `OrdersView.vue` - 订单管理
   - `SaleBillsView.vue` - 销售单
   - `CustomersView.vue` - 客户管理
   - `SuppliersView.vue` - 供应商管理
   - `PurchaseView.vue` - 采购管理
   - `SaleReturnsView.vue` - 销售退货
   - `CustomerStatementsView.vue` - 客户对账
   - `InventoryView.vue` - 库存管理
   - `EmployeesView.vue` - 员工管理
   - `StoresView.vue` - 门店管理
   - `PaymentsView.vue` - 收款管理
   - `ReportsView.vue` - 报表中心
   - `AlertsView.vue` - 预警中心
   - `PricesView.vue` - 价格中心
   - `CreditView.vue` - 授信管理
   - `AftersaleView.vue` - 售后管理
   - `OrderTimeoutView.vue` - 订单超时
   - `MarketingView.vue` - 营销中心
   - `AuditLogView.vue` - 操作日志
   - `SystemView.vue` - 系统设置

#### 第三步：迁移页面内容（Day 2-3）
5. 将 App.vue 中每个 `<section v-if="activeNav === 'xxx'">` 的内容迁移到对应 views 文件
6. 迁移相关的响应式变量、方法到各组件
7. 迁移 api.ts 中的 API 调用（按模块拆分到各 views）

#### 第四步：简化 App.vue（Day 4）
8. App.vue 仅保留布局框架 + `<router-view>`
9. 移除 activeNav 状态管理，改为路由驱动
10. 测试所有 22 个页面路由跳转正常

**验收标准**：
- [ ] vue-router 替换 activeNav，所有页面通过 URL 可直接访问
- [ ] 浏览器前进/后退正常
- [ ] 22 个页面全部可正常渲染
- [ ] 侧边栏导航点击跳转正常
- [ ] App.vue 不超过 200 行
- [ ] 现有功能无回归

---

### 🟡 P1 - 抽取公共组件 [R1-02]
**截止时间**：6/28（周日）
**预计耗时**：8 小时
**依赖**：R1-01 完成

**任务详情**：

创建 `src/components/` 目录，抽取 7 个公共组件：

| 组件名 | 用途 | 替换场景 |
|--------|------|---------|
| `PageHeader.vue` | 页面标题 + 面包屑 + 操作按钮 | 多个页面重复的标题区域 |
| `SearchBar.vue` | 搜索框 + 筛选条件 + 查询/重置按钮 | 列表页通用搜索区 |
| `DataTable.vue` | 封装 el-table + 分页 + 排序 | 所有列表页表格 |
| `FormDialog.vue` | 封装 el-dialog + el-form + 校验 | 新增/编辑弹窗 |
| `StatusTag.vue` | 状态标签（不同颜色） | 订单/库存/审批状态展示 |
| `AmountDisplay.vue` | 金额展示（千分位 + ¥符号） | 所有金额字段 |
| `ConfirmDialog.vue` | 确认弹窗（删除/审批/作废） | 操作二次确认 |

**验收标准**：
- [ ] 7 个公共组件创建完成
- [ ] 至少 3 个页面使用公共组件替换原有代码
- [ ] 组件有完整的 props 定义和 emits 定义
- [ ] TypeScript 类型完整

---

### 🟡 P1 - store-terminal 同步重构 [R1-03]
**截止时间**：6/30（周二）
**预计耗时**：8 小时
**依赖**：R1-01 模式跑通后

**任务详情**：

1. 安装 vue-router，创建 `src/router/index.ts`
2. 创建 `src/layouts/TerminalLayout.vue`
3. 创建 `src/views/` 目录，拆分 10 个页面：
   - `TerminalDashboard.vue` - 工作台
   - `TerminalCashier.vue` - 快速收银
   - `TerminalSaleBills.vue` - 销售单
   - `TerminalFulfill.vue` - 接单履约
   - `TerminalInventory.vue` - 库存查询
   - `TerminalTransfer.vue` - 调拨
   - `TerminalCheck.vue` - 盘点
   - `TerminalShare.vue` - 分享收款
   - `TerminalDaily.vue` - 日结
   - `TerminalControl.vue` - 门店管控
4. 迁移 api.ts 调用到各 views
5. 测试所有页面

**验收标准**：
- [ ] vue-router 替换 activeNav
- [ ] 10 个页面全部可正常渲染
- [ ] App.vue 不超过 200 行
- [ ] 现有功能无回归

---

### 🟡 P1 - 技术评审与代码质量把关
**持续进行**

**职责**：
1. 每日 Review 阿坚、阿澈的代码提交
2. 把控架构方向，避免引入新的技术债务
3. 解决疑难技术问题
4. 确保重构不破坏现有功能

---

## 技术规范（强制执行）

1. 所有新页面使用 `<script setup>` + Composition API
2. TypeScript 严格类型，禁止 any
3. 组件命名使用 PascalCase，多单词
4. 样式使用 CSS Variables（tokens.css）
5. API 调用统一封装，不直接在组件里写 axios
6. 列表页统一用 DataTable 组件
7. 表单统一用 FormDialog 组件

## 每日站会

- 时间：09:30
- 地点：飞书群
- 内容：昨天完成 / 今天计划 / 阻塞问题
