# 智享酒水库存系统 - Phase 2 功能开发任务分配

> 基础部署已完成，系统已上线：
> - 后端 API: https://api.onepan.cn
> - 管理后台: https://admin.onepan.cn
> - 商家端 H5: https://m.onepan.cn
> - 门店终端: https://store.onepan.cn
>
> 当前聚焦：快速开单、供应商管理、采购全流程、销售退货、客户往来账

---

## 环境信息

```
数据库：MySQL 8.4
  主机：localhost
  数据库：liquor_inventory
  用户名/密码：见 .env.production

后端：Node.js 20 + Express + TypeScript
  目录：/workspace/liquor-inventory-system/backend
  启动：npm run build && npm start
  路由文件：backend/src/routes/

前端：
  管理后台：admin-web/ (Vue3 + Vite)
  商家端H5：merchant-mobile/ (Vue3 + Vite)
  门店终端：store-terminal/ (Vue3 + PWA)

API 文档：
  Phase 1：docs/phase1_openapi.yaml
  Phase 2：docs/phase2_openapi.yaml

数据库：
  Phase 1：docs/phase1_schema.sql
  Phase 2：docs/phase2_schema.sql
```

---

## 阿坚（后端开发工程师）

### 本周任务（Sprint 1: 6/17 - 6/24）

#### 1. A101 - 供应商管理 API [P0] - 12小时
**目标**：实现供应商管理完整 CRUD

**具体工作**：
- [ ] 在 `backend/src/routes/` 下新建 `supplier.routes.ts`
- [ ] 实现接口：
  - `GET /api/admin/suppliers` - 列表（支持 keyword、status 筛选）
  - `POST /api/admin/suppliers` - 新增
  - `GET /api/admin/suppliers/:id` - 详情（含 contacts 列表）
  - `PUT /api/admin/suppliers/:id` - 修改
  - `POST /api/admin/suppliers/:id/contacts` - 添加联系人
- [ ] 供应商编码自动生成：`GYS{YYMMDD}{3位序号}`，参考 `makeBizNo` 实现
- [ ] 数据验证使用 zod
- [ ] 所有操作写 operation_log

**参考**：
- 数据库表：`supplier`, `supplier_contact`
- 已有代码：`backend/src/routes/store.routes.ts` 中的 CRUD 模式
- ID 生成：`backend/src/shared/id.ts` 中的 `makeBizNo`

---

#### 2. A102 - 采购订单 API [P0] - 16小时
**目标**：实现采购订单全流程

**具体工作**：
- [ ] 新建 `purchase.routes.ts`，挂载到 `/api/admin/purchase-orders`
- [ ] 实现接口：
  - `GET /api/admin/purchase-orders` - 列表（keyword、orderStatus、supplierId 筛选）
  - `POST /api/admin/purchase-orders` - 创建
  - `GET /api/admin/purchase-orders/:orderNo` - 详情（含 items）
  - `POST /api/admin/purchase-orders/:orderNo/approve` - 审核
  - `POST /api/admin/purchase-orders/:orderNo/cancel` - 取消
- [ ] 订单号生成：`CGDD{YYMMDD}{4位序号}`
- [ ] 创建时自动计算金额逻辑：
  ```
  商品金额 = SUM(明细.小计)
  税额 = SUM(明细.税额)
  应付金额 = 商品金额 + 税额 - 优惠金额
  未付金额 = 应付金额
  ```
- [ ] 审核后状态：DRAFT -> PENDING -> APPROVED
- [ ] 使用 transaction 保证数据一致性

**参考**：
- 数据库表：`purchase_order`, `purchase_order_item`
- 金额计算参考：`store.routes.ts` 中销售单的计算逻辑

---

#### 3. A106 - 销售退货 API [P0] - 14小时
**目标**：实现销售退货

**具体工作**：
- [ ] 在 `store.routes.ts` 中追加销售退货接口（或新建 `sale-return.routes.ts`）
- [ ] 实现接口：
  - `GET /api/store/sale-returns` - 列表
  - `POST /api/store/sale-returns` - 创建
  - `GET /api/store/sale-returns/:returnNo` - 详情
  - `POST /api/store/sale-returns/:returnNo/approve` - 审核（增加库存）
  - `POST /api/store/sale-returns/:returnNo/refund` - 确认退款
- [ ] 支持按销售单退货（传入 sourceBillNo 自动带出原单商品）
- [ ] 审核通过后：
  - 增加 inventory_balance 库存
  - 写 inventory_ledger 台账（biz_type = 'SALE_RETURN_IN'）
- [ ] 退货单号：`XSTH{YYMMDD}{4位序号}`

**参考**：
- 数据库表：`sale_return`, `sale_return_item`
- 库存操作参考：`store.routes.ts` 中 `offline-payment` 的库存扣减逻辑（反向操作）

---

#### 4. A110 - 销售单扩展（赊销支持） [P0] - 8小时
**目标**：扩展现有销售单支持赊销

**具体工作**：
- [ ] 修改 `POST /api/store/sale-bills`：
  - 接收 `saleType` 字段（CASH/CREDIT）
  - CREDIT 时接收 `dueDate`（应收截止日期）
  - CASH 时 collection_status 直接为 UNPAID（等待收款）
  - CREDIT 时 collection_status 为 UNPAID，due_date 设置
- [ ] 修改 `POST /api/store/sale-bills/:billNo/offline-payment`：
  - 收款后更新 collection_status：UNPAID -> PARTIAL -> PAID
  - 已全额收款且为 CREDIT 类型，标记为已结清
- [ ] 新增定时任务（或查询接口）：检测超期未收的销售单，标记 OVERDUE
- [ ] 数据库已添加字段：`sale_type`, `due_date`, `statement_id`

**参考**：
- 现有代码：`store.routes.ts` 中销售单创建和收款逻辑

---

### 下周任务（Sprint 2: 6/24 - 7/1）

#### 5. A103 - 采购入库 API [P0] - 16小时
**目标**：实现采购入库

**具体工作**：
- [ ] `GET/POST /api/admin/purchase-in-stocks` - 列表/创建
- [ ] `GET /api/admin/purchase-in-stocks/:stockNo` - 详情
- [ ] `POST /api/admin/purchase-in-stocks/:stockNo/approve` - 审核（增加库存）
- [ ] `POST /api/admin/purchase-in-stocks/:stockNo/void` - 作废（回滚库存）
- [ ] 支持按采购订单入库（传入 orderNo 自动带出明细）
- [ ] 审核通过后：
  - 增加 inventory_balance 库存
  - 写 inventory_ledger（biz_type = 'PURCHASE_IN'）
  - 更新 purchase_order_item 的 in_stocked_qty
- [ ] 作废时回滚库存和订单入库数量
- [ ] 入库单号：`CGRK{YYMMDD}{4位序号}`

---

#### 6. A104 - 采购退货 API [P0] - 12小时
**目标**：实现采购退货

**具体工作**：
- [ ] `GET/POST /api/admin/purchase-returns` - 列表/创建
- [ ] `GET /api/admin/purchase-returns/:returnNo` - 详情
- [ ] `POST /api/admin/purchase-returns/:returnNo/approve` - 审核（扣减库存）
- [ ] 审核通过后扣减库存，写台账（biz_type = 'PURCHASE_RETURN_OUT'）
- [ ] 退货单号：`CGTH{YYMMDD}{4位序号}`

---

#### 7. A105 - 采购付款 API [P0] - 10小时
**目标**：实现采购付款

**具体工作**：
- [ ] `GET/POST /api/admin/purchase-payments` - 列表/创建
- [ ] `POST /api/admin/purchase-payments/:paymentNo/approve` - 审核
- [ ] 支持按订单付款、预付款、退货退款
- [ ] 审核通过后更新 purchase_order 的 paid_amount、unpaid_amount
- [ ] 付款单号：`CGFK{YYMMDD}{4位序号}`

---

#### 8. A107 - 客户对账单 API [P0] - 14小时
**目标**：实现客户对账

**具体工作**：
- [ ] `GET/POST /api/store/customer-statements` - 列表/生成
- [ ] `GET /api/store/customer-statements/:statementNo` - 详情（含明细流水）
- [ ] `POST /api/store/customer-statements/:statementNo/confirm` - 确认
- [ ] 生成对账单时汇总指定期间：
  - 销售单金额（sale_bill，business_status = COMPLETED）
  - 销售退货金额（sale_return，return_status = COMPLETED）
  - 收款金额（customer_payment + sale_payment，status = COMPLETED）
- [ ] 计算期初余额、期末余额
- [ ] 对账单号：`KHDZ{YYMMDD}{4位序号}`

---

#### 9. A108 - 客户收款 API [P0] - 10小时
**目标**：实现客户收款

**具体工作**：
- [ ] `GET/POST /api/store/customer-payments` - 列表/创建
- [ ] `POST /api/store/customer-payments/:receiptNo/void` - 作废
- [ ] 支持按销售单收款、按对账单收款、预收款
- [ ] 收款后更新 sale_bill 的 received_amount、unreceived_amount、collection_status
- [ ] 收款单号：`KHSK{YYMMDD}{4位序号}`

---

### 第三周任务（Sprint 3: 7/1 - 7/8）

#### 10. A109 - 库存预警 API [P1] - 8小时
**目标**：实现库存预警

**具体工作**：
- [ ] `GET /api/admin/inventory-alerts` - 预警列表
- [ ] `GET/PUT /api/admin/inventory-alerts/settings` - 设置
- [ ] 低库存预警：available_qty <= warning_threshold（product_sku.warning_threshold）
- [ ] 预警级别：WARNING（<= threshold）/ CRITICAL（<= 3）
- [ ] 支持按门店筛选

---

## 林夕（UI/前端交互工程师）

### 本周任务（Sprint 1: 6/17 - 6/24）

#### 1. L101 - 供应商管理页面 [P0] - 16小时
**目标**：管理后台 - 供应商管理

**具体工作**：
- [ ] 在 `admin-web/src/views/` 下新建 `SuppliersView.vue`
- [ ] 供应商列表页：
  - 搜索框（名称/编码/联系人手机号）
  - 状态筛选（启用/停用）
  - 分页表格（编码、名称、类别、结算方式、状态、操作）
  - 操作：查看、编辑、停用/启用
- [ ] 供应商新增/编辑页：
  - 表单：编码、名称、简称、类别、地址、信用等级
  - 结算方式（现结/月结/季结）、结算日、税率
  - 银行账户信息
  - 联系人列表（动态增删）
- [ ] 调用 API：`/api/admin/suppliers/*`

**依赖**：阿坚完成 A101

---

#### 2. L105 - 商家端H5 - 快速开单（销售） [P0] - 20小时
**目标**：优化销售开单流程

**具体工作**：
- [ ] 在 `merchant-mobile/src/views/` 下优化 `CreateSaleView.vue`
- [ ] 快速开单页：
  - 客户选择（搜索会员、新增散客）
  - 商品输入：扫码/搜索、箱/瓶双单位输入
  - 商品列表：显示单价、数量、小计、删除
  - 金额汇总：商品金额、优惠、抹零、应收金额
  - **新增**：销售类型切换（现销/赊销）
  - **新增**：赊销时选择应收截止日期（due_date）
- [ ] 销售单列表页（`SaleBillsView.vue`）：
  - 显示收款状态（UNPAID/PARTIAL/PAID/OVERDUE）
  - 筛选：全部/待收款/已收款/已超期
- [ ] 销售单详情页：
  - 显示销售类型、应收截止日期
  - 收款按钮（现金/微信/支付宝）
  - 分享收款按钮（已有功能）
- [ ] 调用 API：`/api/store/sale-bills/*`

**依赖**：阿坚完成 A110

---

#### 3. L106 - 商家端H5 - 销售退货 [P0] - 14小时
**目标**：销售退货功能

**具体工作**：
- [ ] 新建 `SaleReturnsView.vue` - 销售退货单列表
- [ ] 新建 `CreateSaleReturnView.vue` - 创建退货单
  - 模式选择：按销售单退货 / 直接退货
  - 按销售单：输入销售单号，自动带出商品（可修改数量）
  - 直接退货：手动选择商品、输入数量
  - 退货原因输入
- [ ] 退货单详情页：显示审核状态、退款状态
- [ ] 调用 API：`/api/store/sale-returns/*`

**依赖**：阿坚完成 A106

---

### 下周任务（Sprint 2: 6/24 - 7/1）

#### 4. L102 - 采购订单页面 [P0] - 20小时
**目标**：管理后台 - 采购订单

**具体工作**：
- [ ] 新建 `PurchaseOrdersView.vue` - 采购订单列表
  - 筛选：状态、供应商、日期范围
  - 操作：查看、审核、取消
- [ ] 新建 `CreatePurchaseOrderView.vue` - 创建采购订单
  - 选择供应商（搜索下拉）
  - 添加商品：搜索/扫码、箱/瓶输入、单价、税率
  - 自动计算：商品金额、税额、应付金额
  - 预计到货日期选择
- [ ] 采购订单详情页：显示明细、审核按钮
- [ ] 调用 API：`/api/admin/purchase-orders/*`

**依赖**：阿坚完成 A102

---

#### 5. L103 - 采购入库页面 [P0] - 16小时
**目标**：管理后台 - 采购入库

**具体工作**：
- [ ] 新建 `PurchaseInStocksView.vue` - 入库单列表
- [ ] 新建 `CreatePurchaseInStockView.vue` - 创建入库单
  - 模式选择：按采购订单入库 / 直接入库
  - 按订单：选择订单号，自动带出明细（可修改实际入库数量）
  - 直接入库：手动选择供应商、商品
  - 批次号、生产日期、有效期输入
- [ ] 入库单详情页：审核/作废按钮
- [ ] 调用 API：`/api/admin/purchase-in-stocks/*`

**依赖**：阿坚完成 A103

---

#### 6. L104 - 采购退货/付款页面 [P0] - 14小时
**目标**：管理后台 - 采购退货与付款

**具体工作**：
- [ ] 新建 `PurchaseReturnsView.vue` - 采购退货单列表/创建/详情
- [ ] 新建 `PurchasePaymentsView.vue` - 采购付款单列表/创建/详情
  - 付款方式：银行转账/现金/微信/支付宝
  - 关联订单选择
  - 银行账户信息自动带出
- [ ] 调用 API：`/api/admin/purchase-returns/*`, `/api/admin/purchase-payments/*`

**依赖**：阿坚完成 A104、A105

---

#### 7. L107 - 商家端H5 - 客户往来账 [P0] - 18小时
**目标**：客户对账与收款

**具体工作**：
- [ ] 新建 `CustomerStatementsView.vue` - 客户列表
  - 显示客户名称、手机号、欠款金额
  - 点击跳转客户详情
- [ ] 客户详情页：
  - 对账单列表（时间段、金额、状态）
  - 生成对账单按钮（选择开始/结束日期）
- [ ] 对账单详情页：
  - 销售/退货/收款流水明细
  - 期初余额、期末余额
  - 确认按钮
- [ ] 客户收款页：
  - 选择收款方式（现金/微信/支付宝/银行转账）
  - 输入金额、凭证号
  - 关联销售单/对账单
- [ ] 调用 API：`/api/store/customer-statements/*`, `/api/store/customer-payments/*`

**依赖**：阿坚完成 A107、A108

---

### 第三周任务（Sprint 3: 7/1 - 7/8）

#### 8. L108 - 管理后台 - 库存预警 [P1] - 10小时
**目标**：库存预警页面

**具体工作**：
- [ ] 新建 `InventoryAlertsView.vue` - 预警列表
  - 低库存商品列表（商品名、当前库存、预警阈值、级别）
  - 按门店筛选
  - 快速补货入口（跳转创建采购订单）
- [ ] 预警设置页：
  - 全局阈值设置
  - 通知方式配置
- [ ] 调用 API：`/api/admin/inventory-alerts/*`

**依赖**：阿坚完成 A109

---

#### 9. L109 - 门店终端 - 快速收银 [P1] - 16小时
**目标**：门店终端快速收银

**具体工作**：
- [ ] 在 `store-terminal/src/` 下开发收银页面
- [ ] 扫码输入商品条码（模拟扫码枪）
- [ ] 箱/瓶数量输入
- [ ] 客户选择（会员搜索/散客）
- [ ] 收款方式：现金/微信/支付宝
- [ ] 显示应收金额、实收金额、找零
- [ ] 提交后创建销售单并标记收款
- [ ] 调用 API：`/api/store/sale-bills`

**依赖**：阿坚完成 A110

---

## 苏然（测试工程师）

### 本周任务（Sprint 1: 6/17 - 6/24）

#### 1. S101 - 测试计划与用例编写（Phase 2） [P1] - 16小时
**目标**：针对新模块编写测试用例

**具体工作**：
- [ ] 编写 Phase 2 测试计划文档
- [ ] 供应商管理测试用例（CRUD、编码生成、联系人）
- [ ] 采购订单测试用例（创建、审核、取消、金额计算）
- [ ] 销售退货测试用例（创建、审核、库存回滚）
- [ ] 金额计算精度测试用例（边界值：0.01元、大额金额）
- [ ] 状态流转测试用例（各单据状态转换）

**输出**：
- `docs/test-plan-phase2.md`
- `docs/test-cases-phase2.md`

---

### 下周任务（Sprint 2: 6/24 - 7/1）

#### 2. S102 - 接口自动化测试（Phase 2） [P1] - 24小时
**目标**：实现新模块接口自动化测试

**具体工作**：
- [ ] 使用 Jest + Supertest（与现有测试一致）
- [ ] 在 `backend/src/__tests__/` 下新建：
  - `supplier.test.ts` - 供应商 CRUD
  - `purchase-order.test.ts` - 采购订单全流程
  - `purchase-in-stock.test.ts` - 采购入库
  - `sale-return.test.ts` - 销售退货
  - `customer-statement.test.ts` - 客户对账
- [ ] 每个测试覆盖：正常流程、异常流程、边界值
- [ ] 金额计算精度断言（toBeCloseTo 或精确比较）
- [ ] 状态流转断言

**参考**：
- 现有测试：`backend/src/__tests__/store-sale-bill.test.ts`
- 测试工具：Jest + 现有 mock-db

---

### 第三周任务（Sprint 3: 7/1 - 7/8）

#### 3. S103 - 前端功能测试 [P1] - 20小时
**目标**：测试前端页面功能

**具体工作**：
- [ ] 供应商管理页面功能测试
- [ ] 采购订单/入库页面测试
- [ ] 快速开单页面测试（现销/赊销切换）
- [ ] 销售退货页面测试
- [ ] 客户往来账页面测试
- [ ] 跨浏览器测试（Chrome、Safari、微信内置浏览器）
- [ ] 移动端适配测试

**输出**：
- 前端功能测试报告
- Bug 清单（按优先级分类）

---

## 每日站会

- **时间**：每天 09:30
- **地点**：飞书群
- **内容**：
  1. 昨天完成了什么？
  2. 今天计划做什么？
  3. 有什么阻塞？

## 本周重点

**阿坚**：
- 优先完成 A101（供应商管理）和 A110（销售单赊销扩展）
- A101 是 A102 的前置依赖，A110 是 L105 的前置依赖
- 编码生成参考现有 `makeBizNo`，保持统一风格

**林夕**：
- 等阿坚 A101 完成后开始 L101（供应商管理页面）
- 等阿坚 A110 完成后开始 L105（快速开单优化）
- 可以先做纯 UI 页面（布局、样式），等接口完成后对接

**苏然**：
- 本周完成 S101（测试计划与用例）
- 熟悉 Phase 2 新表结构和 API 设计
- 为下周自动化测试做准备

## 编码规范

1. **后端**：
   - 使用 TypeScript，严格类型
   - 路由使用 `asyncHandler` 包裹
   - 参数校验使用 zod
   - 数据库操作使用参数化查询（防 SQL 注入）
   - 事务使用 `transaction()` 包裹
   - 金额计算使用 `Decimal` 或精确到分的整数运算

2. **前端**：
   - Vue 3 Composition API
   - 样式使用 CSS Variables（参考 tokens.css）
   - API 调用封装在 `api.ts`
   - 表单校验使用统一规则
   - 金额显示保留两位小数

3. **通用**：
   - 所有单据号按规则自动生成
   - 操作日志必须记录（operation_log 表）
   - 状态变更必须有明确的业务规则
