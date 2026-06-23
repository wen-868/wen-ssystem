# Phase 2 功能测试用例

> 编写人：苏然 | 版本：v1.0 | 日期：2026-06-23

---

## 1. 供应商管理模块

### 1.1 供应商 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SUP-001 | 创建供应商 - 正常流程 | 无 | POST /api/admin/suppliers，传入必填字段 | 返回 200，供应商创建成功 | P0 |
| TC-SUP-002 | 创建供应商 - 编码重复 | 已存在供应商 | POST 相同 supplierCode | 返回 400，提示编码已存在 | P0 |
| TC-SUP-003 | 创建供应商 - 缺少必填字段 | 无 | POST 不传 supplierCode | 返回 400，提示缺少必填字段 | P0 |
| TC-SUP-004 | 查询供应商列表 - 分页 | 存在多个供应商 | GET /api/admin/suppliers?page=1&pageSize=10 | 返回分页数据，total 正确 | P0 |
| TC-SUP-005 | 查询供应商列表 - 关键字搜索 | 存在供应商"茅台" | GET ?keyword=茅台 | 返回匹配的供应商 | P1 |
| TC-SUP-006 | 查询供应商详情 | 供应商 ID=1 | GET /api/admin/suppliers/1 | 返回供应商详情及联系人列表 | P0 |
| TC-SUP-007 | 修改供应商信息 | 供应商 ID=1 | PUT /api/admin/suppliers/1，修改 name | 返回 200，信息更新成功 | P0 |
| TC-SUP-008 | 添加供应商联系人 | 供应商 ID=1 | POST /api/admin/suppliers/1/contacts | 返回 200，联系人添加成功 | P1 |

### 1.2 供应商状态

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SUP-009 | 停用供应商 | 供应商状态=启用 | PUT 修改 status=0 | 状态更新为停用 | P1 |
| TC-SUP-010 | 启用供应商 | 供应商状态=停用 | PUT 修改 status=1 | 状态更新为启用 | P1 |

---

## 2. 采购订单模块

### 2.1 采购订单 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PO-001 | 创建采购订单 - 正常流程 | 存在供应商和 SKU | POST /api/admin/purchase-orders | 返回 200，订单创建成功 | P0 |
| TC-PO-002 | 创建采购订单 - 多 SKU | 存在多个 SKU | POST 包含多个 items | 返回 200，明细正确 | P0 |
| TC-PO-003 | 创建采购订单 - 缺少 SKU | 无 | POST 不传 items | 返回 400，提示缺少明细 | P0 |
| TC-PO-004 | 查询采购订单列表 | 存在多个订单 | GET /api/admin/purchase-orders | 返回分页列表 | P0 |
| TC-PO-005 | 查询采购订单详情 | 订单 orderNo | GET /api/admin/purchase-orders/{orderNo} | 返回订单详情及明细 | P0 |

### 2.2 采购订单状态流转

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PO-010 | 审核采购订单 | 订单状态=DRAFT | POST /api/admin/purchase-orders/{orderNo}/approve | 状态变为 APPROVED | P0 |
| TC-PO-011 | 审核已审核订单 | 订单状态=APPROVED | POST /approve | 返回 400，提示状态不允许 | P0 |
| TC-PO-012 | 取消采购订单 | 订单状态=DRAFT | POST /api/admin/purchase-orders/{orderNo}/cancel | 状态变为 CANCELLED | P0 |
| TC-PO-013 | 取消已审核订单 | 订单状态=APPROVED | POST /cancel | 返回 400，提示状态不允许 | P0 |

### 2.3 采购订单金额计算

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PO-020 | 金额计算 - 单价 88.88 | 无 | 创建订单，unitPrice=88.88，qty=10 | goodsAmount=888.80 | P0 |
| TC-PO-021 | 金额计算 - 税额计算 | 无 | taxRate=0.13，unitPrice=100，qty=5 | taxAmount=65.00 | P0 |
| TC-PO-022 | 金额计算 - 优惠金额 | 无 | discountAmount=50 | payableAmount 正确扣减 | P0 |
| TC-PO-023 | 金额精度 - 边界值 0.01 | 无 | unitPrice=0.01，qty=1 | goodsAmount=0.01 | P0 |
| TC-PO-024 | 金额精度 - 大额金额 | 无 | unitPrice=99999.99，qty=100 | goodsAmount=9999999.00 | P1 |

---

## 3. 采购入库模块

### 3.1 采购入库 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PI-001 | 创建入库单 - 按订单入库 | 存在已审核采购订单 | POST /api/admin/purchase-in-stocks，传入 orderNo | 返回 200，自动带出订单明细 | P0 |
| TC-PI-002 | 创建入库单 - 直接入库 | 无 | POST 不传 orderNo | 返回 200，手动填写明细 | P0 |
| TC-PI-003 | 查询入库单列表 | 存在多个入库单 | GET /api/admin/purchase-in-stocks | 返回分页列表 | P0 |
| TC-PI-004 | 查询入库单详情 | 入库单 stockNo | GET /api/admin/purchase-in-stocks/{stockNo} | 返回详情及明细 | P0 |

### 3.2 采购入库状态与库存

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PI-010 | 审核入库单 | 入库单状态=PENDING | POST /api/admin/purchase-in-stocks/{stockNo}/approve | 状态变为 COMPLETED，库存增加 | P0 |
| TC-PI-011 | 审核已审核入库单 | 入库单状态=COMPLETED | POST /approve | 返回 400，提示状态不允许 | P0 |
| TC-PI-012 | 作废入库单 | 入库单状态=PENDING | POST /api/admin/purchase-in-stocks/{stockNo}/void | 状态变为 VOIDED | P0 |
| TC-PI-013 | 库存增加验证 | 入库前库存=10 | 审核入库单，入库 qty=5 | 审核后库存=15 | P0 |

---

## 4. 采购退货模块

### 4.1 采购退货 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PR-001 | 创建退货单 - 正常流程 | 存在供应商和 SKU | POST /api/admin/purchase-returns | 返回 200，退货单创建成功 | P0 |
| TC-PR-002 | 查询退货单列表 | 存在多个退货单 | GET /api/admin/purchase-returns | 返回分页列表 | P0 |
| TC-PR-003 | 查询退货单详情 | 退货单 returnNo | GET /api/admin/purchase-returns/{returnNo} | 返回详情及明细 | P0 |

### 4.2 采购退货状态与库存

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PR-010 | 审核退货单 | 退货单状态=PENDING | POST /api/admin/purchase-returns/{returnNo}/approve | 状态变为 COMPLETED，库存减少 | P0 |
| TC-PR-011 | 审核已审核退货单 | 退货单状态=COMPLETED | POST /approve | 返回 400，提示状态不允许 | P0 |
| TC-PR-012 | 库存减少验证 | 退货前库存=20 | 审核退货单，退货 qty=5 | 审核后库存=15 | P0 |

---

## 5. 采购付款模块

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PP-001 | 创建付款单 - 订单付款 | 存在采购订单 | POST /api/admin/purchase-payments | 返回 200，付款单创建成功 | P1 |
| TC-PP-002 | 创建付款单 - 预付款 | 无 | POST paymentType=ADVANCE | 返回 200，预付款创建成功 | P1 |
| TC-PP-003 | 查询付款单列表 | 存在多个付款单 | GET /api/admin/purchase-payments | 返回分页列表 | P1 |
| TC-PP-004 | 审核付款单 | 付款单状态=PENDING | POST /api/admin/purchase-payments/{paymentNo}/approve | 状态变为 COMPLETED | P1 |
| TC-PP-005 | 付款金额验证 | 订单应付=1000 | 付款 amount=1000 | 订单已付金额更新 | P1 |

---

## 6. 销售退货模块

### 6.1 销售退货 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SR-001 | 创建退货单 - 按销售单退货 | 存在销售单 | POST /api/store/sale-returns，传入 sourceBillNo | 返回 200，自动带出原单商品 | P0 |
| TC-SR-002 | 创建退货单 - 直接退货 | 无 | POST 不传 sourceBillNo | 返回 200，手动填写明细 | P0 |
| TC-SR-003 | 查询退货单列表 | 存在多个退货单 | GET /api/store/sale-returns | 返回分页列表 | P0 |
| TC-SR-004 | 查询退货单详情 | 退货单 returnNo | GET /api/store/sale-returns/{returnNo} | 返回详情及明细 | P0 |

### 6.2 销售退货状态与库存

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SR-010 | 审核退货单 | 退货单状态=PENDING | POST /api/store/sale-returns/{returnNo}/approve | 状态变为 COMPLETED，库存增加 | P0 |
| TC-SR-011 | 审核已审核退货单 | 退货单状态=COMPLETED | POST /approve | 返回 400，提示状态不允许 | P0 |
| TC-SR-012 | 库存增加验证 | 退货前库存=10 | 审核退货单，退货 qty=3 | 审核后库存=13 | P0 |
| TC-SR-013 | 确认退款 - 现金 | 退货单已审核 | POST /api/store/sale-returns/{returnNo}/refund，refundMethod=CASH | 退款成功，已退金额更新 | P0 |
| TC-SR-014 | 确认退款 - 微信 | 退货单已审核 | POST refundMethod=WECHAT | 退款成功 | P1 |

---

## 7. 客户对账模块

### 7.1 客户对账单 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CS-001 | 生成对账单 - 正常流程 | 存在客户和销售记录 | POST /api/store/customer-statements | 返回 200，对账单生成成功 | P1 |
| TC-CS-002 | 生成对账单 - 缺少客户 | 无 | POST 不传 customerId | 返回 400，提示缺少客户 | P1 |
| TC-CS-003 | 查询对账单列表 | 存在多个对账单 | GET /api/store/customer-statements | 返回分页列表 | P1 |
| TC-CS-004 | 查询对账单详情 | 对账单 statementNo | GET /api/store/customer-statements/{statementNo} | 返回详情及明细流水 | P1 |

### 7.2 客户对账单状态

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CS-010 | 确认对账单 | 对账单状态=DRAFT | POST /api/store/customer-statements/{statementNo}/confirm | 状态变为 CONFIRMED | P1 |
| TC-CS-011 | 确认已确认对账单 | 对账单状态=CONFIRMED | POST /confirm | 返回 400，提示状态不允许 | P1 |

### 7.3 客户对账金额计算

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CS-020 | 期初余额计算 | 上期未结=500 | 生成对账单 | openingBalance=500 | P1 |
| TC-CS-021 | 本期销售汇总 | 期间有 3 笔销售 | 生成对账单 | totalSales 正确汇总 | P1 |
| TC-CS-022 | 本期退货汇总 | 期间有 1 笔退货 | 生成对账单 | totalReturns 正确汇总 | P1 |
| TC-CS-023 | 本期收款汇总 | 期间有 2 笔收款 | 生成对账单 | totalPayments 正确汇总 | P1 |
| TC-CS-024 | 期末余额计算 | 期初+销售-退货-收款 | 生成对账单 | closingBalance 计算正确 | P1 |

---

## 8. 客户收款模块

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CP-001 | 创建收款单 - 按销售单收款 | 存在销售单 | POST /api/store/customer-payments | 返回 200，收款单创建成功 | P1 |
| TC-CP-002 | 创建收款单 - 按对账单收款 | 存在对账单 | POST sourceType=STATEMENT | 返回 200，收款成功 | P1 |
| TC-CP-003 | 创建收款单 - 预收款 | 无 | POST 不传 sourceNo | 返回 200，预收款创建成功 | P1 |
| TC-CP-004 | 查询收款记录列表 | 存在多个收款单 | GET /api/store/customer-payments | 返回分页列表 | P1 |
| TC-CP-005 | 作废收款单 | 收款单状态=COMPLETED | POST /api/store/customer-payments/{receiptNo}/void | 状态变为 VOIDED | P1 |

---

## 9. 库存预警模块

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-IA-001 | 查询预警列表 | 存在低库存商品 | GET /api/admin/inventory-alerts | 返回预警列表 | P1 |
| TC-IA-002 | 低库存预警触发 | 商品库存=5，阈值=10 | 查询预警列表 | 商品出现在预警列表中 | P1 |
| TC-IA-003 | 过期预警触发 | 商品有效期=7天内 | 查询预警列表 | 商品出现在过期预警中 | P1 |
| TC-IA-004 | 获取预警设置 | 无 | GET /api/admin/inventory-alerts/settings | 返回预警设置 | P1 |
| TC-IA-005 | 更新预警设置 | 无 | PUT /api/admin/inventory-alerts/settings | 设置更新成功 | P1 |

---

## 10. 专项测试用例

### 10.1 金额计算精度

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-AMT-001 | 最小金额 0.01 元 | 无 | 创建订单，unitPrice=0.01 | 金额计算正确 | P0 |
| TC-AMT-002 | 大额金额 99999999.99 | 无 | 创建订单，unitPrice=999999.99，qty=100 | 金额计算正确，不溢出 | P0 |
| TC-AMT-003 | 浮点精度 0.1+0.2 | 无 | 计算 0.1+0.2 | 结果=0.30，非 0.30000000000000004 | P0 |
| TC-AMT-004 | 负数金额 | 无 | unitPrice=-10 | 返回 400，金额不可为负 | P0 |

### 10.2 状态流转路径

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-ST-001 | 采购订单完整流程 | 无 | 创建→审核→入库→完成 | 状态流转正确 | P0 |
| TC-ST-002 | 采购订单取消流程 | 无 | 创建→取消 | 状态变为 CANCELLED | P0 |
| TC-ST-003 | 采购入库作废流程 | 无 | 创建入库→作废 | 状态变为 VOIDED | P0 |
| TC-ST-004 | 销售退货完整流程 | 无 | 创建→审核→退款 | 状态流转正确 | P0 |
| TC-ST-005 | 客户对账完整流程 | 无 | 生成→确认→收款 | 状态流转正确 | P1 |

### 10.3 并发操作

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CC-001 | 同时审核订单 | 订单状态=DRAFT | 两个请求同时审核 | 只有一个成功，另一个失败 | P1 |
| TC-CC-002 | 同时收款 | 订单应付=1000 | 两个请求各收 600 | 总额不超过应付 | P1 |
| TC-CC-003 | 同时入库 | 订单 qty=10 | 两个请求各入 6 | 总入库不超过订单数量 | P1 |

---

## 11. 测试数据准备

### 11.1 基础数据

```json
{
  "suppliers": [
    { "id": 1, "supplierCode": "SUP001", "name": "茅台酒业", "settlementType": "MONTHLY" }
  ],
  "skus": [
    { "id": 1, "skuName": "茅台 53度 500ml", "retailPrice": 1499, "costPrice": 1000 }
  ],
  "customers": [
    { "id": 1, "name": "张三酒行", "mobile": "13800138000" }
  ],
  "stores": [
    { "id": 1, "storeName": "总店" }
  ]
}
```

### 11.2 测试账号

- 管理员：admin / admin123
- 操作员：operator / operator123

---

## 12. 附录

### 12.1 接口清单

| 模块 | 接口 | 方法 |
|------|------|------|
| 供应商 | /api/admin/suppliers | GET, POST |
| 供应商 | /api/admin/suppliers/{id} | GET, PUT |
| 供应商联系人 | /api/admin/suppliers/{id}/contacts | POST |
| 采购订单 | /api/admin/purchase-orders | GET, POST |
| 采购订单 | /api/admin/purchase-orders/{orderNo} | GET |
| 采购订单 | /api/admin/purchase-orders/{orderNo}/approve | POST |
| 采购订单 | /api/admin/purchase-orders/{orderNo}/cancel | POST |
| 采购入库 | /api/admin/purchase-in-stocks | GET, POST |
| 采购入库 | /api/admin/purchase-in-stocks/{stockNo} | GET |
| 采购入库 | /api/admin/purchase-in-stocks/{stockNo}/approve | POST |
| 采购入库 | /api/admin/purchase-in-stocks/{stockNo}/void | POST |
| 采购退货 | /api/admin/purchase-returns | GET, POST |
| 采购退货 | /api/admin/purchase-returns/{returnNo} | GET |
| 采购退货 | /api/admin/purchase-returns/{returnNo}/approve | POST |
| 采购付款 | /api/admin/purchase-payments | GET, POST |
| 采购付款 | /api/admin/purchase-payments/{paymentNo}/approve | POST |
| 销售退货 | /api/store/sale-returns | GET, POST |
| 销售退货 | /api/store/sale-returns/{returnNo} | GET |
| 销售退货 | /api/store/sale-returns/{returnNo}/approve | POST |
| 销售退货 | /api/store/sale-returns/{returnNo}/refund | POST |
| 客户对账 | /api/store/customer-statements | GET, POST |
| 客户对账 | /api/store/customer-statements/{statementNo} | GET |
| 客户对账 | /api/store/customer-statements/{statementNo}/confirm | POST |
| 客户收款 | /api/store/customer-payments | GET, POST |
| 客户收款 | /api/store/customer-payments/{receiptNo}/void | POST |
| 库存预警 | /api/admin/inventory-alerts | GET |
| 库存预警 | /api/admin/inventory-alerts/settings | GET, PUT |
