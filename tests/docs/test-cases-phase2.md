
# 智享营销系统 - 第 2 阶段 功能测试用例集

> 版本: v1.0
> 生效日期: 2026/06/17
> 参考: [phase2_schema.sql](file:///workspace/docs/phase2_schema.sql),
> [phase2_openapi.yaml](file:///workspace/docs/phase2_openapi.yaml)

---

## 用例约定

- **ID** 格式：`TC-{模块缩写}-{三位序号}`
- **前置条件**：后端已启动、已获取 admin token；数据库已执行 phase2_schema.sql
- **步骤**：HTTP 方法 + 路径 + body/query
- **预期**：HTTP 状态码 + `code` + 关键字段验证 + 数据库一致性验证
- **优先级**：P0/P1/P2
- **模块缩写**：
  - `SUP`: 供应商管理
  - `PO`: 采购订单
  - `RET`: 销售退货
  - `STMT`: 客户对账/收款
  - `WARN`: 库存预警
  - `PREC`: 金额精度（专项）
  - `STAT`: 状态流转（专项）
  - `CONC`: 并发操作（专项）
  - `SEC`: 权限/安全
  - `SCHEMA`: 响应结构一致性

---

## 模块 1. 供应商管理 (SUP)

| ID | 用例 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-SUP-001 | 创建供应商（必填字段） | POST `/admin/suppliers` body `{supplierName:"测试供应商A", contactPhone:"13800000000", address:"...", creditLimit:10000, creditDays:30, supplierType:"BRAND"}` | HTTP 200 / `code=0`；返回 `supplierCode` 形如 `SUPYYYYMMDDNNNN`；数据库新增 1 条 | P0 |
| TC-SUP-002 | 创建供应商缺少 name | POST `/admin/suppliers` body `{contactPhone:"138..."}` | HTTP 400 / `code!=0` | P1 |
| TC-SUP-003 | 供应商编码格式验证 | POST 创建 3 次 | 3 次编码格式一致，序号递增、不重复 | P1 |
| TC-SUP-004 | 查询供应商列表 | GET `/admin/suppliers?page=1&pageSize=20` | HTTP 200 / `code=0`；`records` 数组；total ≥ 1 | P0 |
| TC-SUP-005 | 供应商列表分页 | GET `/admin/suppliers?page=1&pageSize=2` | `records.length <= 2` | P2 |
| TC-SUP-006 | 供应商搜索关键字 | GET `/admin/suppliers?keyword=测试` | 仅返回包含关键字的记录 | P1 |
| TC-SUP-007 | 供应商按类型过滤 | GET `/admin/suppliers?supplierType=BRAND` | records 中 `supplierType` 均为 `BRAND` | P1 |
| TC-SUP-008 | 供应商详情 | GET `/admin/suppliers/{id}` | 字段完整（name/contact/creditLimit/status） | P0 |
| TC-SUP-009 | 更新供应商基本信息 | PUT `/admin/suppliers/{id}` body `{contactPhone:"13900000000", creditLimit:50000}` | 返回数据 `contactPhone/creditLimit` 已更新 | P0 |
| TC-SUP-010 | 切换供应商状态为 INACTIVE | POST `/admin/suppliers/{id}/toggle-status` body `{status:"INACTIVE"}` | 后续使用该供应商创建采购订单应拒绝或提示 | P1 |
| TC-SUP-011 | 新增联系人 | POST `/admin/suppliers/{id}/contacts` body `[{contactName:"张经理", contactPhone:"137...", isPrimary:true}]` | 联系人列表新增 1 条 | P2 |
| TC-SUP-012 | 禁用供应商后再创建采购订单 | 先 `status=BLACKLIST` 再 POST `/admin/purchase-orders` 使用该 supplierId | HTTP 400 或业务提示 | P1 |

---

## 模块 2. 采购订单 (PO)

| ID | 用例 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-PO-001 | 创建采购订单（含 2 条明细） | POST `/admin/purchase-orders` body `{storeId:1, supplierId:{已存在}, items:[{skuId:1, purchaseBoxQty:1, purchaseBottleQty:0, unitPrice:50, taxRate:0.13}, {skuId:2, purchaseBottleQty:10, unitPrice:20}]}` | HTTP 200 / `code=0`；返回 `orderNo` 形如 `POYYYYMMDDNNNNN`；`goods_amount` = `1*50 + 10*20 = 250` | P0 |
| TC-PO-002 | 采购订单详情查询 | GET `/admin/purchase-orders/{orderNo}` | `items` 数组；每条 `skuId`/`purchaseBoxQty`/`purchaseBottleQty`/`unitPrice`/`subtotalAmount` 齐全 | P0 |
| TC-PO-003 | 采购订单列表过滤 | GET `/admin/purchase-orders?supplierId={id}&orderStatus=DRAFT` | records 中 `supplierId` 与状态正确；total 正确 | P0 |
| TC-PO-004 | 提交采购订单（DRAFT → SUBMITTED） | POST `/admin/purchase-orders/{orderNo}/submit` | 返回 `orderStatus=SUBMITTED`；再次 `GET` 详情 status 已更新 | P0 |
| TC-PO-005 | 审核通过（SUBMITTED → AUDITED） | POST `/admin/purchase-orders/{orderNo}/audit` body `{passed:true, remark:"同意采购"}` | `orderStatus=AUDITED`；`auditTime`/`auditorId` 非空 | P0 |
| TC-PO-006 | 审核不通过 | POST `/admin/purchase-orders/{orderNo}/audit` body `{passed:false, remark:"单价过高"}` | `orderStatus` 保持 SUBMITTED 或回退 DRAFT；remark 被保存 | P1 |
| TC-PO-007 | 非 SUBMITTED 状态下审核 | 创建 DRAFT 订单 → POST audit | HTTP 400 或 `code!=0` | P0 |
| TC-PO-008 | 取消 DRAFT 订单 | POST `/admin/purchase-orders/{orderNo}/cancel` | `orderStatus=CANCELLED`；`cancel_reason` 非空 | P1 |
| TC-PO-009 | 取消后再提交 | CANCELLED → POST submit | HTTP 400 或 `code!=0` | P0 |
| TC-PO-010 | 采购入库（AUDITED → INBOUND_COMPLETED） | POST `/admin/purchase-orders/{orderNo}/inbound` body `{items:[{skuId:1, inboundBoxQty:1}, {skuId:2, inboundBottleQty:10}]}` | `orderStatus=INBOUND_COMPLETED`；`inventory_balance` 中 对应 sku 的 `physical_qty` 增加；`inventory_ledger` 新增 2 条记录 | P0 |
| TC-PO-011 | 入库明细数量与原订单不一致 | order items `qty=10` → 传 `inboundBottleQty=20` | HTTP 400 或提示超出 | P1 |
| TC-PO-012 | 部分入库 | order items `qty=10` → POST `inboundBottleQty=4` | status=INBOUND_PARTIAL；明细 `inboundBottleQty=4` | P1 |
| TC-PO-013 | 采购付款登记 | AUDITED → POST `/admin/purchase-orders/{orderNo}/pay` body `{amount:250, payMethod:"BANK_TRANSFER", payDate:"2026-06-18"}` | `payStatus=PAID`；`paidAmount=250.00` | P0 |
| TC-PO-014 | 付款金额超过应付 | payable=100 → amount=200 | 拒绝或提示超付 | P1 |
| TC-PO-015 | 采购单缺少 items 创建 | POST body 无 items | HTTP 400 | P1 |

---

## 模块 3. 销售退货 (RET)

| ID | 用例 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-RET-001 | 创建销售退货单（基于 SALE_BILL） | POST `/admin/sales-returns` body `{sourceType:"SALE_BILL", sourceNo:{已存在billNo}, storeId:1, returnReason:"质量问题", items:[{skuId:1, returnBottleQty:2, unitPrice:50}]}` | HTTP 200 / `code=0`；返回 `returnNo`；`refundAmount=100.00` | P0 |
| TC-RET-002 | 创建退货单但明细数量为 0 | items `returnBottleQty=0` | HTTP 400 或 goods_amount=0 状态下不可提交 | P1 |
| TC-RET-003 | 退货单数量超过原单销售数量 | 原单销售 qty=3 → 创建退货 qty=5 | HTTP 400 或提示 | P0 |
| TC-RET-004 | 提交退货单 | POST `/admin/sales-returns/{returnNo}/submit` | `returnStatus=SUBMITTED` | P0 |
| TC-RET-005 | 审核退货单 | POST `/admin/sales-returns/{returnNo}/audit` body `{passed:true}` | `returnStatus=AUDITED` | P0 |
| TC-RET-006 | 审核不通过 | POST audit `passed=false` | status 保持 SUBMITTED / 退回 DRAFT，remark 已保存 | P1 |
| TC-RET-007 | 退货入库并回滚库存 | POST `/admin/sales-returns/{returnNo}/stock-in` | ① `stockRollbackFlag=1`；② `inventory_balance.physical_qty` 加回 `returnBottleQty`；③ `inventory_ledger` 增加对应记录；④ status=COMPLETED | P0 |
| TC-RET-008 | 退款登记 | POST `/admin/sales-returns/{returnNo}/refund` body `{amount:100, payMethod:"CASH"}` | `refundStatus=REFUNDED`；`actualRefundAmount=100` | P0 |
| TC-RET-009 | 部分退款 | `refundAmount=100` → refund `amount=40` → refund `amount=40` | 两次 `actualRefundAmount=80`；`refundStatus=PARTIAL` 或中间状态；第三次超过剩余应拒绝 | P1 |
| TC-RET-010 | 取消 DRAFT 退货单 | POST `/admin/sales-returns/{returnNo}/cancel` | `returnStatus=CANCELLED` | P1 |
| TC-RET-011 | 已 COMPLETED 退货单取消 | POST cancel | HTTP 400 | P1 |

---

## 模块 4. 客户对账/收款 (STMT)

| ID | 用例 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-STMT-001 | 自动生成对账单 | ① 创建 2 笔销售单（同一客户，应收 100/200）；② 1 笔退货单（50）；③ 收款 80；④ POST `/admin/statements/generate` body `{customerId:{id}, periodStart:"2026-06-01", periodEnd:"2026-06-30"}` | HTTP 200 / `code=0`；返回 `statementNo`；`salesAmount=300`；`returnAmount=50`；`collectionAmount=80`；`closingBalance=300-50-80=170` | P0 |
| TC-STMT-002 | 对账单明细借贷平衡 | GET `/admin/statements/{statementNo}` | Σ`debitAmount - ΣcreditAmount = closingBalance - openingBalance` | P0 |
| TC-STMT-003 | 对账单列表 | GET `/admin/statements?customerId={id}` | records 中含有上面的 statementNo | P0 |
| TC-STMT-004 | 确认对账单 | POST `/admin/statements/{statementNo}/confirm` | `statementStatus=CONFIRMED` | P0 |
| TC-STMT-005 | 收款登记（一次收完） | CONFIRMED → POST `/admin/statements/{statementNo}/payments` body `{amount:170, payMethod:"BANK_TRANSFER", payDate:"2026-06-18"}` | `collectionStatus=PAID`；`collectionAmount` 加 170；customer balance `receivableTotal` 减 170 | P0 |
| TC-STMT-006 | 部分收款 | closing=170 → 收款 100 | `collectionStatus=PARTIAL`；`collectionAmount=100` | P1 |
| TC-STMT-007 | 收款金额超过应收 | closing=170 → amount=500 | HTTP 400 或提示；`collectionStatus` 保持 | P0 |
| TC-STMT-008 | 对账单生成分享收款链接 | POST `/admin/statements/{statementNo}/collection-link` | 返回 `linkNo/ shareUrl/qrCode`；数据库 `collection_link.sourceType=STATEMENT` | P0 |
| TC-STMT-009 | 客户余额查询 | GET `/admin/customers/{customerId}/balance` | 字段 `receivableTotal / overdueTotal / lastSaleDate` 齐全 | P1 |
| TC-STMT-010 | 重复生成对账单（同 customer + period） | 再次 POST generate | HTTP 200 返回已存在的 statementNo（幂等） 或 HTTP 400 "已存在" | P1 |

---

## 模块 5. 库存预警 (WARN)

| ID | 用例 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-WARN-001 | 默认预警规则存在 | 启动后查询 warning_rule 表 | 至少有 LOW_STOCK / NEGATIVE_STOCK / ABNORMAL_MOVEMENT 三条 | P0 |
| TC-WARN-002 | 创建自定义预警规则 | POST `/admin/inventory/warning-rules` body `{ruleType:"LOW_STOCK", scopeType:"ALL", threshold:10, alertLevel:"WARNING", enabled:true}` | `code=0`；records 新增 1 条 | P1 |
| TC-WARN-003 | 手动触发预警扫描 | POST `/admin/inventory/warnings/trigger` | `code=0`；warning_event 表新增/更新 | P1 |
| TC-WARN-004 | 低库存 SKU 被正确扫描 | ① 设置某 SKU available=3（threshold=5）；② POST trigger；③ GET `/admin/inventory/warnings?ruleType=LOW_STOCK` | records 含该 SKU；`currentValue=3, thresholdValue=5`；`alertLevel=WARNING` | P0 |
| TC-WARN-005 | 预警事件确认 | 取 eventNo → POST `/admin/inventory/warnings/{eventNo}/ack` | `eventStatus=ACKNOWLEDGED`；`acknowledged_at` 非空 | P1 |
| TC-WARN-006 | 预警事件标记已解决 | POST `/admin/inventory/warnings/{eventNo}/resolve` | `eventStatus=RESOLVED` | P1 |
| TC-WARN-007 | 低库存快照 | GET `/admin/inventory/alerts/snapshot?storeId=1&threshold=5` | 所有 records 中 `available_qty <= 5` | P1 |
| TC-WARN-008 | 同一 SKU 多店重复预警 | SKU 在 2 个 store 都低于阈值 | warning_event 分别生成 2 条，storeId 不同 | P1 |
| TC-WARN-009 | 禁用规则后不生成事件 | POST disable `enabled=false` → POST trigger | 该规则不产生新事件 | P2 |

---

## 专项 1. 金额精度 (PREC)

| ID | 场景 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-PREC-001 | 单价 0.01 × 数量 1 | POST `/admin/purchase-orders` items `unitPrice=0.01, purchaseBottleQty=1` | `subtotalAmount=0.01` | P0 |
| TC-PREC-002 | 单价 0.01 × 数量 10000 | POST items `unitPrice=0.01, purchaseBottleQty=10000` | `subtotalAmount=100.00`（无浮点误差） | P0 |
| TC-PREC-003 | 大额单价 | POST items `unitPrice=99999.99, purchaseBottleQty=1` | `subtotalAmount=99999.99` | P1 |
| TC-PREC-004 | 单价三位小数（1.235） | POST items `unitPrice=1.235` | 四舍五入或拒绝（需看业务定义，建议拒绝） | P1 |
| TC-PREC-005 | 单价为负 | POST items `unitPrice=-10` | HTTP 400 / code!=0 | P0 |
| TC-PREC-006 | 数量为 0 | POST items `purchaseBottleQty=0` | subtotal=0 或拒绝 | P1 |
| TC-PREC-007 | 数量为负 | POST items `purchaseBottleQty=-1` | HTTP 400 | P0 |
| TC-PREC-008 | 小计求和一致性 | POST 10 条 items（随机金额） | goods_amount = Σ(subtotal)（数据库值验证） | P0 |
| TC-PREC-009 | 收款金额 0.01（最小单位） | 对账 closing=100 → amount=0.01 | 记录成功；remaining=99.99 | P1 |
| TC-PREC-010 | 超收（closing 100 → amount 100.01） | 对账单 POST payment amount=100.01 | 拒绝或提示；数据库无超收 | P0 |

---

## 专项 2. 状态流转 (STAT)

| ID | 场景 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-STAT-PO-001 | DRAFT → SUBMITTED | 创建采购单 → submit | orderStatus=SUBMITTED | P0 |
| TC-STAT-PO-002 | SUBMITTED → AUDITED | POST audit passed=true | orderStatus=AUDITED | P0 |
| TC-STAT-PO-003 | SUBMITTED → 退回（passed=false） | POST audit passed=false | status 保持 SUBMITTED 或回 DRAFT | P1 |
| TC-STAT-PO-004 | AUDITED → INBOUND_PARTIAL | 入库部分数量 | orderStatus=INBOUND_PARTIAL | P0 |
| TC-STAT-PO-005 | INBOUND_PARTIAL → INBOUND_COMPLETED | 再入库剩余 | orderStatus=INBOUND_COMPLETED | P0 |
| TC-STAT-PO-006 | DRAFT → CANCELLED | POST cancel | orderStatus=CANCELLED | P1 |
| TC-STAT-PO-007 | CANCELLED → SUBMITTED（非法） | CANCELLED → POST submit | HTTP 400 | P0 |
| TC-STAT-PO-008 | 付款 UNPAID → PAID | INBOUND_COMPLETED → POST pay amount=total | payStatus=PAID | P0 |
| TC-STAT-RET-001 | DRAFT → SUBMITTED | 退货单 submit | returnStatus=SUBMITTED | P0 |
| TC-STAT-RET-002 | SUBMITTED → AUDITED | POST audit passed=true | returnStatus=AUDITED | P0 |
| TC-STAT-RET-003 | AUDITED → COMPLETED | POST stock-in | returnStatus=COMPLETED; stockRollbackFlag=1 | P0 |
| TC-STAT-RET-004 | COMPLETED → REFUNDED | POST refund amount=total | refundStatus=REFUNDED | P0 |
| TC-STAT-RET-005 | DRAFT → CANCELLED | POST cancel | returnStatus=CANCELLED | P1 |
| TC-STAT-RET-006 | CANCELLED → 后续操作 | CANCELLED → POST audit | HTTP 400 | P0 |
| TC-STAT-STMT-001 | DRAFT → CONFIRMED | 对账单 confirm | statementStatus=CONFIRMED | P0 |
| TC-STAT-STMT-002 | CONFIRMED → PARTIAL | payment amount=部分 | collectionStatus=PARTIAL | P0 |
| TC-STAT-STMT-003 | PARTIAL → PAID | payment 剩余金额 | collectionStatus=PAID | P0 |
| TC-STAT-STMT-004 | PAID 状态下再次 payment | POST payment amount=10 | HTTP 400 或提示 | P0 |

---

## 专项 3. 并发操作 (CONC)

| ID | 场景 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-CONC-001 | 并发创建 10 条销售单（同一 SKU） | Promise.all 10 次 POST `/admin/sale-bills`（同一 SKU，qty=1，store=1） | 成功创建数 + 失败数 = 10；`inventory_balance.physical_qty` 最终 = 初始 - 成功数；`inventory_ledger` 条数 = 成功数 | P0 |
| TC-CONC-002 | 并发 POST 同一采购单入库（同一 AUDITED 订单） | Promise.all 10 次 POST `/admin/purchase-orders/{orderNo}/inbound` | 仅 1 次完整入库成功；其他 9 次应返回 400 或幂等成功；库存不被重复增加 | P0 |
| TC-CONC-003 | 并发 offline-payment 同一销售单（应收 100，全部 payment amount=100） | Promise.all 10 次 POST offline-payment | 最多 1 次成功 paid；其余返回"已收款"或失败；实际 received 金额 = 100（无 1000） | P0 |
| TC-CONC-004 | 并发生成同客户同账期对账单 | Promise.all 5 次 POST `/admin/statements/generate` body 同 customerId + period | 只有 1 个 statementNo 生成；其他返回"已存在"或幂等 | P1 |
| TC-CONC-005 | 并发退货入库同一 returnNo | Promise.all 5 次 POST `/admin/sales-returns/{returnNo}/stock-in` | 只 1 次回滚成功；库存不被重复增加；其余 4 次返回 400 或幂等 | P0 |
| TC-CONC-006 | 并发收款（同 statement，amount=部分） | 2 次 POST payment amount=50，closing=80 | 最多一次成功（合计 50）或两次都成功（合计 ≤80）；不能超收 | P0 |

---

## 专项 4. 权限/安全 (SEC)

| ID | 场景 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-SEC-001 | 未登录访问受限接口 | 不带 token GET `/admin/purchase-orders` | HTTP 401 / code=401 | P0 |
| TC-SEC-002 | 伪造 token 访问 | `Authorization: Bearer fake.token.xxx` GET `/admin/sales-returns` | HTTP 401 | P0 |
| TC-SEC-003 | SQL 注入 | GET `/admin/suppliers?keyword=1' OR '1'='1` | 不返回全表；HTTP 200 但是 records 为 0 或正常过滤 | P0 |
| TC-SEC-004 | XSS 供应商名称 | POST `/admin/suppliers` body `{supplierName:"<script>alert(1)</script>"}` | HTTP 200 但字段被转义存储；不触发脚本执行 | P1 |
| TC-SEC-005 | 金额负数（安全相关） | POST `/admin/sale-bills` body `{items:[{... , unitPrice:-1000000}]}` | HTTP 400；不能出现金额负值成功 | P0 |
| TC-SEC-006 | 超大数据请求 | POST body 大小 50MB | HTTP 413 或合理拒绝；服务器不崩溃 | P2 |

---

## 专项 5. 响应结构一致性 (SCHEMA)

| ID | 用例 | 步骤 | 预期 | 优先级 |
|---|---|---|---|---|
| TC-SCHEMA-001 | 所有列表接口字段统一 | GET `/admin/suppliers`, `/admin/purchase-orders`, `/admin/sales-returns`, `/admin/statements`, `/admin/inventory/warnings` | 均返回 `{records:[], page, pageSize, total}` 结构；命名一致；类型一致（total 为整数） | P1 |
| TC-SCHEMA-002 | 成功响应 code 一致性 | 以上 GET/POST 成功 | `code = "0"` 且字符串 | P1 |
| TC-SCHEMA-003 | 失败响应 code/message 一致性 | 故意传错字段 | 均返回 `code!=0` + `message` 可读 | P1 |
| TC-SCHEMA-004 | 金额字段统一精度 | 以上响应所有 amount/price 字段 | 均为两位小数字符串或 DECIMAL(14,2) | P1 |
| TC-SCHEMA-005 | 时间字段统一格式 | `created_at/updated_at/audit_time/pay_date/...` | 均为 ISO 格式 `YYYY-MM-DD HH:MM:SS` 或 ISO 8601 | P2 |

---

## 总计

| 模块 | P0 | P1 | P2 | 合计 |
|---|---|---|---|---|
| 供应商管理 (SUP) | 3 | 6 | 3 | 12 |
| 采购订单 (PO) | 9 | 6 | 0 | 15 |
| 销售退货 (RET) | 6 | 4 | 1 | 11 |
| 客户对账/收款 (STMT) | 6 | 4 | 0 | 10 |
| 库存预警 (WARN) | 2 | 5 | 2 | 9 |
| 金额精度 (PREC) | 4 | 5 | 1 | 10 |
| 状态流转 (STAT) | 11 | 7 | 0 | 18 |
| 并发操作 (CONC) | 6 | 0 | 0 | 6 |
| 权限/安全 (SEC) | 4 | 1 | 1 | 6 |
| 响应结构 (SCHEMA) | 0 | 4 | 1 | 5 |
| **合计** | **51** | **42** | **9** | **102** |

> 以上用例为第 2 阶段测试核心覆盖范围，执行时可按模块分组进行，配合 Node.js 自动化脚本完成。
