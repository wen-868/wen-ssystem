# 阿坚 - 后端开发任务清单

> 角色：后端开发工程师
> 技术栈：Node.js 20 + Express + TypeScript + MySQL 8.4
> 工作时间：每天 8 小时

---

## 当前 Sprint（第一周：6/17 - 6/24）

### P0 - 供应商管理 API [A101]
**截止时间**：6/19（周四）
**预计耗时**：12 小时

**任务详情**：
1. 新建 `backend/src/routes/supplier.routes.ts`
2. 实现接口：
   - `GET /api/admin/suppliers` - 列表（支持 keyword、status 筛选）
   - `POST /api/admin/suppliers` - 新增
   - `GET /api/admin/suppliers/:id` - 详情（含 contacts 列表）
   - `PUT /api/admin/suppliers/:id` - 修改
   - `POST /api/admin/suppliers/:id/contacts` - 添加联系人
3. 供应商编码自动生成：`GYS{YYMMDD}{3位序号}`
4. 数据验证使用 zod
5. 操作写 operation_log

**参考代码**：
- `backend/src/routes/store.routes.ts` 中的 CRUD 模式
- `backend/src/shared/id.ts` 中的 `makeBizNo`
- 数据库表：`supplier`, `supplier_contact`

**验收标准**：
- [ ] 所有接口通过 Postman 测试
- [ ] 编码自动生成正确
- [ ] 联系人增删正常
- [ ] 操作日志有记录

---

### P0 - 采购订单 API [A102]
**截止时间**：6/21（周六）
**预计耗时**：16 小时
**依赖**：A101 完成

**任务详情**：
1. 新建 `backend/src/routes/purchase.routes.ts`
2. 实现接口：
   - `GET /api/admin/purchase-orders` - 列表
   - `POST /api/admin/purchase-orders` - 创建
   - `GET /api/admin/purchase-orders/:orderNo` - 详情
   - `POST /api/admin/purchase-orders/:orderNo/approve` - 审核
   - `POST /api/admin/purchase-orders/:orderNo/cancel` - 取消
3. 订单号生成：`CGDD{YYMMDD}{4位序号}`
4. 金额自动计算逻辑
5. 状态流转：DRAFT -> PENDING -> APPROVED

**验收标准**：
- [ ] 创建订单金额计算正确
- [ ] 审核/取消状态流转正确
- [ ] 事务保证数据一致性

---

### P0 - 销售退货 API [A106]
**截止时间**：6/23（周一）
**预计耗时**：14 小时

**任务详情**：
1. 在 `store.routes.ts` 追加或新建 `sale-return.routes.ts`
2. 实现接口：
   - `GET /api/store/sale-returns` - 列表
   - `POST /api/store/sale-returns` - 创建
   - `GET /api/store/sale-returns/:returnNo` - 详情
   - `POST /api/store/sale-returns/:returnNo/approve` - 审核
   - `POST /api/store/sale-returns/:returnNo/refund` - 确认退款
3. 支持按销售单退货
4. 审核后增加库存，写台账

**验收标准**：
- [ ] 按销售单退货自动带出商品
- [ ] 审核后库存正确增加
- [ ] 台账记录正确

---

### P0 - 销售单扩展（赊销支持）[A110]
**截止时间**：6/24（周二）
**预计耗时**：8 小时

**任务详情**：
1. 修改 `POST /api/store/sale-bills`：
   - 接收 `saleType`（CASH/CREDIT）
   - CREDIT 时接收 `dueDate`
2. 修改收款逻辑：
   - 收款后更新 collection_status
   - UNPAID -> PARTIAL -> PAID
3. 超期检测（查询接口或定时任务）

**验收标准**：
- [ ] 现销/赊销创建正常
- [ ] 收款状态流转正确
- [ ] 超期标记正确

---

## 下周预告（Sprint 2: 6/24 - 7/1）

- A103 - 采购入库 API（16h）
- A104 - 采购退货 API（12h）
- A105 - 采购付款 API（10h）
- A107 - 客户对账单 API（14h）
- A108 - 客户收款 API（10h）

## 开发规范

1. 使用 TypeScript，严格类型
2. 路由用 `asyncHandler` 包裹
3. 参数校验用 zod
4. 数据库操作参数化查询
5. 事务用 `transaction()` 包裹
6. 金额精确到分
7. 操作写 operation_log
8. 单据号按规则生成

## 每日站会

- 时间：09:30
- 地点：飞书群
- 内容：昨天完成 / 今天计划 / 阻塞问题
# 阿坚 - 后端开发# 阿坚 - 后端开发任务清单

&gt; 角色：后端开发工程师
&gt; 技术栈：Node.js 20 + Express + TypeScript + MySQL 8.4
&gt; 工作时间：每天 8 小时
&gt; 当前阶段：架构整改周（6/24 - 7/7）

---

## 本周任务（Week 1: 6/24 - 6/30）

### 🔴 P0 - 后端分层改造 [R2-01]
**截止时间**：6/28（周六）
**预计耗时**：24 小时（3天）
**优先级**：最高（tenant_id 改造依赖此任务）

**任务目标**：
将胖路由模式改为 Controller-Service-Model 三层架构，为后续 tenant_id 改造和功能开发奠定基础。

**目标目录结构**：
```
backend/src/
├── routes/           ← 仅保留路由定义，调用 Controller
│   ├── admin.routes.ts
│   ├── store.routes.ts
│   └── ...
├── controllers/       ← 新增：请求处理、参数校验、调用 Service
# 阿坚 - 后端开发任务清单

&gt; 角色：后端开发工程师
&gt; 技术栈：Node.js 20 + Express + TypeScript + MySQL 8.4
&gt; 工作时间：每天 8 小时
&gt; 当前阶段：架构整改周（6/24 - 7/7）

---

## 本周任务（Week 1: 6/24 - 6/30）

### 🔴 P0 - 后端分层改造 [R2-01]
**截止时间**：6/28（周六）
**预计耗时**：24 小时（3天）
**优先级**：最高（tenant_id 改造依赖此任务）

**任务目标**：
将胖路由模式改为 Controller-Service-Model 三层架构，为后续 tenant_id 改造和功能开发奠定基础。

**目标目录结构**：
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
# 阿坚 - 后端开发任务清单

&gt; 角色：后端开发工程师
&gt; 技术栈：Node.js 20 + Express + TypeScript + MySQL 8.4
&gt; 工作时间：每天 8 小时
&gt; 当前阶段：架构整改周（6/24 - 7/7）

---

## 本周任务（Week 1: 6/24 - 6/30）

### 🔴 P0 - 后端分层改造 [R2-01]
**截止时间**：6/28（周六）
**预计耗时**：24 小时（3天）
**优先级**：最高（tenant_id 改造依赖此任务）

**任务目标**：
将胖路由模式改为 Controller-Service-Model 三层架构，为后续 tenant_id 改造和功能开发奠定基础。

**目标目录结构**：
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

**具体工作**：

| 步骤 | 内容 | 预计时间 |
|------|------|---------|
| 1 | 创建 controllers/、types/ 目录结构 | 0.5h |
| 2 | 抽取产品相关逻辑 → product.controller.ts + product.service.ts | 3h |
| 3 | 抽取订单相关逻辑 → order.controller.ts + order.service.ts | 3h |
| 4 | 抽取客户相关逻辑 → customer.controller.ts + customer.service.ts | 2h |
| 5 | 抽取供应商相关逻辑 → supplier.controller.ts + supplier.service.ts | 2h |# 阿坚 - 后端开发任务清单

&gt; 角色：后端开发工程师
&gt; 技术栈：Node.js 20 + Express + TypeScript + MySQL 8.4
&gt; 工作时间：每天 8 小时
&gt; 当前阶段：架构整改周（6/24 - 7/7）

---

## 本周任务（Week 1: 6/24 - 6/30）

### 🔴 P0 - 后端分层改造 [R2-01]
**截止时间**：6/28（周六）
**预计耗时**：24 小时（3天）
**优先级**：最高（tenant_id 改造依赖此任务）

**任务目标**：
将胖路由模式改为 Controller-Service-Model 三层架构，为后续 tenant_id 改造和功能开发奠定基础。

**目标目录结构**：
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

**具体工作**：

| 步骤 | 内容 | 预计时间 |
|------|------|---------|
| 1 | 创建 controllers/、types/ 目录结构 | 0.5h |
| 2 | 抽取产品相关逻辑 → product.controller.ts + product.service.ts | 3h |
| 3 | 抽取订单相关逻辑 → order.controller.ts + order.service.ts | 3h |
| 4 | 抽取客户相关逻辑 → customer.controller.ts + customer.service.ts | 2h |
| 5 | 抽取供应商相关逻辑 → supplier.controller.ts + supplier.service.ts | 2h |
| 6 | 抽取采购相关逻辑 → purchase.controller.ts + purchase.service.ts | 3h |
| 7 | 抽取库存相关逻辑 → inventory.controller.ts + inventory.service.ts | 2h |
| 8 | 抽取支付/报表/其他 → 对应 controller + service | 3h |
| 9 | 重写 admin.routes.ts，仅保留路由定义 | 2h |
| 10 | 重写 store.routes.ts，仅保留路由定义 | 1h |
| 11 | 运行测试确保所有 API 正常 | 2h |

**改造示例**：
```typescript
// ===== 改造前（胖路由）=====
router.get('/products', requireAuth, asyncHandler(async (req,# 阿坚 - 后端开发任务清单

&gt; 角色：后端开发工程师
&gt; 技术栈：Node.js 20 + Express + TypeScript + MySQL 8.4
&gt; 工作时间：每天 8 小时
&gt; 当前阶段：架构整改周（6/24 - 7/7）

---

## 本周任务（Week 1: 6/24 - 6/30）

### 🔴 P0 - 后端分层改造 [R2-01]
**截止时间**：6/28（周六）
**预计耗时**：24 小时（3天）
**优先级**：最高（tenant_id 改造依赖此任务）

**任务目标**：
将胖路由模式改为 Controller-Service-Model 三层架构，为后续 tenant_id 改造和功能开发奠定基础。

**目标目录结构**：
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

**具体工作**：

| 步骤 | 内容 | 预计时间 |
|------|------|---------|
| 1 | 创建 controllers/、types/ 目录结构 | 0.5h |
| 2 | 抽取产品相关逻辑 → product.controller.ts + product.service.ts | 3h |
| 3 | 抽取订单相关逻辑 → order.controller.ts + order.service.ts | 3h |
| 4 | 抽取客户相关逻辑 → customer.controller.ts + customer.service.ts | 2h |
| 5 | 抽取供应商相关逻辑 → supplier.controller.ts + supplier.service.ts | 2h |
| 6 | 抽取采购相关逻辑 → purchase.controller.ts + purchase.service.ts | 3h |
| 7 | 抽取库存相关逻辑 → inventory.controller.ts + inventory.service.ts | 2h |
| 8 | 抽取支付/报表/其他 → 对应 controller + service | 3h |
| 9 | 重写 admin.routes.ts，仅保留路由定义 | 2h |
| 10 | 重写 store.routes.ts，仅保留路由定义 | 1h |
| 11 | 运行测试确保所有 API 正常 | 2h |

**改造示例**：
```typescript
// ===== 改造前（胖路由）=====
router.get('/products', requireAuth, asyncHandler(async (req, res) =&gt; {
  const { keyword, category, status, page, pageSize } = req.query;
  // ... 50行业务逻辑 ...
  res.json(ok({ data: products, total }));
}));

// ===== 改造后（分层）=====
// routes/admin.routes.ts
router.get('/products', requireAuth, productController.list);

// controllers/admin/product.controller.ts
export const list = asyncHandler(async (req, res) =&gt; {
  const params = productQuerySchema.parse(req.query);
  const result = await productService.list(params, req.user);
  res.json(ok(result));
});

// services/product.service.ts
export async function list(params, user) {
  const { keyword, category,