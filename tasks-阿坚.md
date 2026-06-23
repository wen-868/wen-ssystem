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
