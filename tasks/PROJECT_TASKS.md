# 智享营销系统 - 整改方案与任务下发

> **生成日期：** 2026-06-24
> **生成人：** 凌舟（项目管理）
> **关联文档：** 项目完成度报告（`PROJECT_STATUS.md`）| 项目中枢（`PROJECT_MEMORY.md`）
> **用途：** 全团队整改任务清单，每人按此执行

---

## 一、整改背景

根据项目完成度报告，当前系统功能覆盖面广（389个API、62张表、22+页面），但存在三个核心架构问题：

1. **admin-web 单文件5300+行** —— 阻塞所有PC端后续开发
2. **后端胖路由无分层** —— 62张表加 tenant_id 时改动量巨大
3. **62张表无 tenant_id** —— SaaS 多租户隔离未实施

**整改目标：** 用2周时间解决架构问题，为后续功能开发扫清障碍。

---

## 二、整改阶段划分

```
Week 1（6/24 - 6/30）：基础架构整改
  ├── 墨：admin-web 路由重构 + 页面拆分
  ├── 阿坚：后端分层改造 + tenant_id 隔离
  └── 阿澈：merchant-mobile 继续按任务单开发

Week 2（7/1 - 7/7）：验收 + 功能开发恢复
  ├── 苏然：整改验收测试
  ├── 全员：按新架构继续功能开发
  └── 凌舟：下发下一阶段任务
```

---

## 三、详细任务清单

### 🔴 阶段一：admin-web 重构（负责人：墨）

#### 任务 R1-01：引入 vue-router（2天）

**目标：** 将 admin-web 从 activeNav 状态切换改为 vue-router 路由管理。

**具体工作：**

| 步骤 | 内容 | 预计时间 |
|------|------|---------|
| 1 | 安装 vue-router：`npm install vue-router@4` | 0.5小时 |
| 2 | 创建 `src/router/index.ts`，定义22个路由 | 2小时 |
| 3 | 创建 `src/layouts/MainLayout.vue`（侧边栏+顶栏+内容区） | 3小时 |
| 4 | 创建 `src/views/` 目录，每个导航页面一个 .vue 文件 | 4小时 |
| 5 | 将 App.vue 中每个 `<section>` 的内容迁移到对应 views 文件 | 6小时 |
| 6 | 迁移 api.ts 中的 API 调用到各 views 组件 | 2小时 |
| 7 | 测试所有22个页面路由跳转正常 | 1小时 |

**路由规划：**

```
/                          → redirect /dashboard
/dashboard                 → DashboardView.vue        （首页）
/products                  → ProductsView.vue         （商品）
/orders                    → OrdersView.vue           （订单）
/sale-bills                → SaleBillsView.vue        （销售单）
/customers                 → CustomersView.vue        （客户）
/suppliers                 → SuppliersView.vue        （供应商）
/purchase                  → PurchaseView.vue         （采购）
/sale-returns              → SaleReturnsView.vue      （销售退货）
/customer-statements       → CustomerStatementsView.vue（客户对账）
/inventory                 → InventoryView.vue       （库存）
/employees                 → EmployeesView.vue       （员工）
/stores                    → StoresView.vue          （门店）
/payments                  → PaymentsView.vue        （收款）
/reports                   → ReportsView.vue         （报表）
/alerts                    → AlertsView.vue          （预警中心）
/prices                    → PricesView.vue          （价格中心）
/credit                    → CreditView.vue          （授信管理）
/aftersale                 → AftersaleView.vue       （售后管理）
/order-timeout             → OrderTimeoutView.vue    （订单超时）
/marketing                 → MarketingView.vue       （营销中心）
/audit-log                 → AuditLogView.vue        （操作日志）
/system                    → SystemView.vue          （系统设置）
```

**验收标准：**
- [ ] vue-router 替换 activeNav，所有页面通过 URL 可直接访问
- [ ] 浏览器前进/后退正常
- [ ] 22个页面全部可正常渲染
- [ ] App.vue 仅保留 `<router-view>` 和布局框架，不超过200行

---

#### 任务 R1-02：抽取公共组件（1天）

**目标：** 将 admin-web 中重复使用的 UI 抽取为公共组件。

**具体工作：**

| 组件名 | 用途 | 来源 |
|--------|------|------|
| `PageHeader.vue` | 页面标题 + 面包屑 + 操作按钮 | 多个页面重复的标题区域 |
| `SearchBar.vue` | 搜索框 + 筛选条件 + 查询/重置按钮 | 列表页通用搜索区 |
| `DataTable.vue` | 封装 el-table + 分页 + 排序 | 所有列表页 |
| `FormDialog.vue` | 封装 el-dialog + el-form + 校验 | 新增/编辑弹窗 |
| `StatusTag.vue` | 状态标签（不同颜色） | 订单/库存/审批状态 |
| `AmountDisplay.vue` | 金额展示（千分位 + ¥符号） | 所有金额字段 |
| `ConfirmDialog.vue` | 确认弹窗（删除/审批/作废） | 操作确认 |

**验收标准：**
- [ ] 7个公共组件创建完成
- [ ] 至少3个页面使用公共组件替换原有代码
- [ ] 组件有 props 定义和事件定义

---

#### 任务 R1-03：store-terminal 同步重构（1天）

**目标：** store-terminal 同样引入 vue-router + 页面拆分。

**具体工作：**

| 步骤 | 内容 |
|------|------|
| 1 | 安装 vue-router，创建 router/index.ts |
| 2 | 创建 layouts/ 和 views/ 目录 |
| 3 | 拆分10个页面为独立 .vue 文件 |
| 4 | 迁移 api.ts 调用 |
| 5 | 测试所有页面 |

**路由规划：**

```
/                    → redirect /terminal/dashboard
/terminal/dashboard  → TerminalDashboard.vue  （工作台）
/terminal/cashier    → TerminalCashier.vue    （快速收银）
/terminal/sale-bills → TerminalSaleBills.vue  （销售单）
/terminal/fulfill    → TerminalFulfill.vue    （接单履约）
/terminal/inventory  → TerminalInventory.vue  （库存查询）
/terminal/transfer   → TerminalTransfer.vue   （调拨）
/terminal/check      → TerminalCheck.vue      （盘点）
/terminal/share      → TerminalShare.vue      （分享收款）
/terminal/daily      → TerminalDaily.vue      （日结）
/terminal/control    → TerminalControl.vue    （门店管控）
```

**验收标准：**
- [ ] vue-router 替换 activeNav
- [ ] 10个页面全部可正常渲染
- [ ] App.vue 不超过200行

---

### 🔴 阶段一：后端架构整改（负责人：阿坚）

#### 任务 R2-01：后端分层改造（3天）

**目标：** 将胖路由模式改为 Controller-Service-Model 三层架构。

**目标目录结构：**

```
backend/src/
├── routes/           ← 仅保留路由定义，调用 Controller
│   ├── admin.routes.ts
│   ├── store.routes.ts
│   └── ...
├── controllers/       ← 新增：请求处理、参数校验、调用 Service
│   ├── admin/
│   │   ├── product.controller.ts
│   │   ├── order.controller.ts
│   │   ├── customer.controller.ts
│   │   ├── supplier.controller.ts
│   │   ├── purchase.controller.ts
│   │   ├── inventory.controller.ts
│   │   ├── employee.controller.ts
│   │   ├── store.controller.ts
│   │   ├── report.controller.ts
│   │   └── payment.controller.ts
│   └── store/
│       ├── sale.controller.ts
│       ├── order.controller.ts
│       └── dashboard.controller.ts
├── services/          ← 新增：业务逻辑、数据库操作
│   ├── product.service.ts
│   ├── order.service.ts
│   ├── customer.service.ts
│   ├── supplier.service.ts
│   ├── purchase.service.ts
│   ├── inventory.service.ts
│   ├── payment.service.ts
│   └── ...
├── shared/            ← 保留：db/auth/id/response 等
├── types/             ← 新增：TypeScript 类型定义
│   ├── product.types.ts
│   ├── order.types.ts
│   └── ...
└── app.ts
```

**具体工作：**

| 步骤 | 内容 | 预计时间 |
|------|------|---------|
| 1 | 创建 controllers/、types/ 目录结构 | 0.5小时 |
| 2 | 从 admin.routes.ts 中抽取产品相关逻辑 → product.controller.ts + product.service.ts | 3小时 |
| 3 | 抽取订单相关逻辑 → order.controller.ts + order.service.ts | 3小时 |
| 4 | 抽取客户相关逻辑 → customer.controller.ts + customer.service.ts | 2小时 |
| 5 | 抽取供应商相关逻辑 → supplier.controller.ts + supplier.service.ts | 2小时 |
| 6 | 抽取采购相关逻辑 → purchase.controller.ts + purchase.service.ts | 3小时 |
| 7 | 抽取库存相关逻辑 → inventory.controller.ts + inventory.service.ts | 2小时 |
| 8 | 抽取支付/报表/其他 → 对应 controller + service | 3小时 |
| 9 | 重写 admin.routes.ts，仅保留路由定义 | 2小时 |
| 10 | 重写 store.routes.ts，仅保留路由定义 | 1小时 |
| 11 | 运行测试确保所有API正常 | 2小时 |

**改造示例（admin.routes.ts 改造前 vs 后）：**

```typescript
// ===== 改造前（胖路由）=====
router.get('/products', requireAuth, asyncHandler(async (req, res) => {
  const { keyword, category, status, page, pageSize } = req.query;
  // ... 50行业务逻辑 ...
  res.json(ok({ data: products, total }));
}));

// ===== 改造后（分层）=====
// routes/admin.routes.ts
router.get('/products', requireAuth, productController.list);

// controllers/admin/product.controller.ts
export const list = asyncHandler(async (req, res) => {
  const params = productQuerySchema.parse(req.query); // Zod校验
  const result = await productService.list(params, req.user);
  res.json(ok(result));
});

// services/product.service.ts
export async function list(params, user) {
  const { keyword, category, status, page, pageSize } = params;
  const sql = `SELECT ... FROM product_sku WHERE tenant_id = ? ...`;
  const [rows] = await db.query(sql, [user.tenantId, ...]);
  return { data: rows, total };
}
```

**验收标准：**
- [ ] controllers/ 目录下至少10个 controller 文件
- [ ] services/ 目录下至少10个 service 文件
- [ ] admin.routes.ts 仅包含路由定义，不含业务逻辑
- [ ] store.routes.ts 仅包含路由定义，不含业务逻辑
- [ ] 所有389个API端点功能不变
- [ ] 现有测试全部通过

---

#### 任务 R2-02：tenant_id 数据隔离（5天）

**目标：** 62张表全部添加 tenant_id 字段，所有查询 API 自动注入 tenant_id 过滤。

**详细方案：** 参见 `docs/tenant-isolation-plan.md`

**具体工作：**

| 步骤 | 内容 | 预计时间 |
|------|------|---------|
| 1 | 编写迁移SQL：62张表 ALTER TABLE ADD tenant_id | 2小时 |
| 2 | 修改 shared/db.ts：添加 tenant_id 自动注入中间件 | 3小时 |
| 3 | 修改 shared/auth.ts：JWT payload 中携带 tenant_id | 1小时 |
| 4 | 逐个修改 services/ 中的查询，确保 WHERE 条件包含 tenant_id | 16小时 |
| 5 | 修改所有 INSERT 语句，自动写入 tenant_id | 4小时 |
| 6 | 编写数据迁移脚本：为现有数据分配默认 tenant_id | 2小时 |
| 7 | 测试：多租户数据隔离验证 | 4小时 |

**验收标准：**
- [ ] 62张表全部有 tenant_id 字段
- [ ] 所有 SELECT 查询自动带 WHERE tenant_id = ?
- [ ] 所有 INSERT 自动写入 tenant_id
- [ ] 租户A无法查到租户B的数据
- [ ] 现有功能不受影响（向后兼容）

**依赖：** R2-01（分层改造）完成后执行，否则在胖路由中加 tenant_id 改动量翻倍。

---

### 🟡 阶段一：merchant-mobile 继续开发（负责人：阿澈）

#### 任务 R3-01：按任务分配单继续开发（5天）

merchant-mobile 架构已经规范，可以直接按任务分配单推进。

**本周任务（从任务分配单V2.0中选取）：**

| 任务编号 | 任务名称 | 工时 | 说明 |
|---------|---------|------|------|
| M-01 | 快速开单优化（赊销支持） | 2天 | 新增销售类型切换、应收截止日期 |
| M-02 | 销售退货页面 | 1.5天 | 按销售单退货/直接退货 |
| M-03 | 客户往来账页面 | 1.5天 | 客户列表+欠款+对账单 |

**参考文档：**
- 表单字段：`docs/form-field-spec-v1.md` 第十二章（手机端表单）
- API接口：`docs/API.md`
- 任务分配：`docs/product-planning/task-assignment-v2-6people.html`

---

### 🟡 阶段一：测试准备（负责人：苏然）

#### 任务 R4-01：编写核心模块测试用例（3天）

**目标：** 为整改后的核心模块编写测试，确保重构不引入回归。

| 测试模块 | 测试文件 | 覆盖内容 |
|---------|---------|---------|
| 认证模块 | auth.test.ts | 登录/注册/JWT生成/权限校验 |
| 商品模块 | product.test.ts | CRUD/价格/状态切换 |
| 订单模块 | order.test.ts | 创建/状态流转/审批 |
| 库存模块 | inventory.test.ts | 查询/调整/预警 |
| 支付模块 | payment.test.ts | 收款/退款/状态同步 |
| tenant隔离 | tenant.test.ts | 多租户数据隔离验证 |

**验收标准：**
- [ ] 至少6个测试文件
- [ ] 核心API覆盖率达到60%以上
- [ ] 所有测试通过

---

## 四、整改时间线

```
Day 1-2（6/24-6/25）
  ├── 墨：R1-01 引入vue-router（前半）
  ├── 阿坚：R2-01 后端分层改造（前半）
  └── 阿澈：M-01 快速开单优化

Day 3-4（6/26-6/27）
  ├── 墨：R1-01 引入vue-router（后半）+ R1-02 抽取公共组件
  ├── 阿坚：R2-01 后端分层改造（后半）
  └── 阿澈：M-01 快速开单优化（完成）

Day 5（6/28）
  ├── 墨：R1-03 store-terminal 重构
  ├── 阿坚：R2-01 验收 + R2-02 tenant_id 开始
  └── 阿澈：M-02 销售退货页面

Day 6-7（6/29-6/30）
  ├── 阿坚：R2-02 tenant_id 隔离（继续）
  ├── 阿澈：M-03 客户往来账页面
  └── 苏然：R4-01 测试用例编写

Week 2（7/1-7/7）
  ├── 阿坚：R2-02 tenant_id 隔离（完成）
  ├── 苏然：整改验收测试
  └── 全员：按新架构恢复功能开发
```

---

## 五、里程碑

| 里程碑 | 日期 | 验收标准 |
|--------|------|---------|
| M1-重构 | 6/27 | admin-web vue-router 上线，22个页面可访问 |
| M1-分层 | 6/28 | 后端 Controller-Service 分层完成，API不变 |
| M1-终端 | 6/28 | store-terminal vue-router 上线，10个页面可访问 |
| M2-隔离 | 7/4 | 62张表 tenant_id 隔离完成 |
| M2-验收 | 7/7 | 所有测试通过，功能无回归 |

---

## 六、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| admin-web 拆分时遗漏功能 | 页面显示异常 | 拆分后逐页对比验收 |
| 后端分层引入bug | API行为变化 | 分层后运行现有测试 |
| tenant_id 遗漏某张表 | 数据泄露 | 编写脚本扫描所有SQL确认 |
| 多人同时改代码冲突 | 效率降低 | 墨改前端、阿坚改后端、互不冲突 |

---

## 七、整改完成后的下一步

整改完成后，项目进入功能开发阶段，按产品规划V3.0的任务清单推进：

| 阶段 | 重点任务 | 预计周期 |
|------|---------|---------|
| P0 核心改造 | 收银台、订单看板、客户档案、出库退货、分享收款 | 3周 |
| P1 增强功能 | POS快开单、销售人员提成、价格策略、信用赊销、销售报表 | 3周 |
| P2 SaaS化 | 租户/订阅/自助注册/功能开关/账号管理 | 3周 |
| P3 增值功能 | 营销模块、即时零售、数据导出 | 持续迭代 |

---

> **任务下发：** 凌舟 | 2026-06-24
> **执行周期：** 2026-06-24 至 2026-07-07（2周）
> **每日站会：** 各负责人汇报进度和阻塞项
> **关联文档：** project-status-report.md、form-field-spec-v1.md、tenant-isolation-plan.md
