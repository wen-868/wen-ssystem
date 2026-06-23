# 阿澈 - 前端开发任务清单

> 角色：商家移动端前端开发工程师
> 技术栈：Vue 3 + Vite + TypeScript + Vant 4
> 工作时间：每天 8 小时

---

## 当前 Sprint（第一周：6/17 - 6/24）

### P0 - L101 供应商管理页面 [admin-web]
**截止时间**：6/20（周五）
**预计耗时**：16 小时
**依赖**：阿坚完成 A101

**任务详情**：
1. 新建 `admin-web/src/views/SuppliersView.vue`
2. 供应商列表页：
   - 搜索框（名称/编码/联系人手机号）
   - 状态筛选（启用/停用）
   - 分页表格（编码、名称、类别、结算方式、状态、操作）
   - 操作：查看、编辑、停用/启用
3. 供应商新增/编辑页：
   - 表单：编码、名称、简称、类别、地址
   - 结算方式（现结/月结/季结）、结算日、税率
   - 银行账户信息
   - 联系人列表（动态增删）
4. 调用 API：`/api/admin/suppliers/*`

**验收标准**：
- [x] 列表搜索筛选正常
- [x] 新增/编辑表单验证完整
- [x] 联系人动态增删正常
- [x] 移动端适配良好

---

### P0 - L105 快速开单优化 [merchant-mobile]
**截止时间**：6/22（周日）
**预计耗时**：20 小时
**依赖**：阿坚完成 A110

**任务详情**：
1. 优化 `merchant-mobile/src/views/CreateSaleView.vue`
2. 快速开单页：
   - 客户选择（搜索会员、新增散客）
   - 商品输入：扫码/搜索、箱/瓶双单位输入
   - 商品列表：显示单价、数量、小计、删除
   - 金额汇总：商品金额、优惠、抹零、应收金额
   - **新增**：销售类型切换（现销/赊销）
   - **新增**：赊销时选择应收截止日期
3. 销售单列表页优化：
   - 显示收款状态（UNPAID/PARTIAL/PAID/OVERDUE）
   - 筛选：全部/待收款/已收款/已超期
4. 销售单详情页优化：
   - 显示销售类型、应收截止日期
   - 收款按钮（现金/微信/支付宝）

**验收标准**：
- [x] 现销/赊销切换正常
- [x] 箱/瓶输入计算正确
- [x] 金额汇总正确
- [x] 收款状态显示正确

---

### P0 - L106 销售退货页面 [merchant-mobile]
**截止时间**：6/24（周二）
**预计耗时**：14 小时
**依赖**：阿坚完成 A106

**任务详情**：
1. 新建 `merchant-mobile/src/views/SaleReturnsView.vue`
2. 新建 `merchant-mobile/src/views/CreateSaleReturnView.vue`
3. 销售退货单列表
4. 创建退货单：
   - 模式选择：按销售单退货 / 直接退货
   - 按销售单：输入单号自动带出商品
   - 直接退货：手动选择商品
   - 退货原因输入
5. 退货单详情页

**验收标准**：
- [x] 两种退货模式正常
- [x] 按销售单自动带出商品
- [x] 退货原因可输入

---

## Sprint 2（第二周：6/24 - 7/1）

### P0 - L102 采购订单页面 [merchant-mobile]
**截止时间**：6/26（周四）
**预计耗时**：20 小时

**任务详情**：
1. 新建 `merchant-mobile/src/views/PurchaseOrdersView.vue`
2. 新建 `merchant-mobile/src/views/PurchaseOrderDetailView.vue`
3. 新建 `merchant-mobile/src/views/CreatePurchaseOrderView.vue`
4. 采购订单列表
5. 创建采购单：
   - 选择供应商
   - 选择仓库
   - 添加商品（数量、单价）
   - 预计到货日期
6. 采购单详情页
7. 审核/取消采购单

**验收标准**：
- [x] 采购单列表正常
- [x] 创建采购单正常
- [x] 采购单详情正常
- [x] 审核/取消功能正常

---

### P0 - L103 采购入库页面 [merchant-mobile]
**截止时间**：6/27（周五）
**预计耗时**：16 小时

**任务详情**：
1. 新建 `merchant-mobile/src/views/PurchaseWarehousingView.vue`
2. 采购入库操作：
   - 选择已审核的采购单
   - 填写本次入库数量
   - 填写批次号
   - 填写生产日期
   - 填写质检结果
3. 入库确认

**验收标准**：
- [x] 入库操作正常
- [x] 批次号、生产日期可填写
- [x] 质检结果可选择

---

### P0 - L104 采购退货页面 [merchant-mobile]
**截止时间**：6/28（周六）
**预计耗时**：14 小时

**任务详情**：
1. 新建 `merchant-mobile/src/views/PurchaseReturnsView.vue`
2. 新建 `merchant-mobile/src/views/CreatePurchaseReturnView.vue`
3. 采购退货单列表
4. 创建退货单：
   - 选择采购单
   - 填写退货商品数量
   - 填写退货单价
   - 填写退货原因
5. 退货单详情

**验收标准**：
- [x] 退货单列表正常
- [x] 创建退货单正常
- [x] 退货原因可填写

---

### P0 - L107 客户往来账页面 [merchant-mobile]
**截止时间**：6/30（周一）
**预计耗时**：18 小时

**任务详情**：
1. 新建 `merchant-mobile/src/views/StatementsView.vue`
2. 新建 `merchant-mobile/src/views/StatementDetailView.vue`
3. 新建 `merchant-mobile/src/views/CreateStatementView.vue`
4. 新建 `merchant-mobile/src/views/StatementPaymentView.vue`
5. 对账单列表
6. 生成对账单：
   - 选择客户
   - 选择账期
7. 对账单详情（往来明细）
8. 登记付款

**验收标准**：
- [x] 对账单列表正常
- [x] 生成对账单正常
- [x] 对账单详情正常
- [x] 登记付款正常

---

## 开发规范

1. Vue 3 Composition API
2. 样式使用 CSS Variables（tokens.css）
3. API 调用封装在 api.ts
4. 表单校验统一规则
5. 金额显示保留两位小数
6. 响应式适配（移动端优先）
7. 加载状态、空状态、错误提示统一

## 每日站会

- 时间：09:30
- 地点：飞书群
- 内容：昨天完成 / 今天计划 / 阻塞问题
