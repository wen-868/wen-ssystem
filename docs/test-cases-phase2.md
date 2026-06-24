# Phase 2 功能测试用例

> 编写人：苏然 | 版本：v1.1 | 日期：2026-06-23
>
> 用例统计：总 **168** 条 | P0: 86 | P1: 62 | P2: 20

---

## 1. 供应商管理模块

### 1.1 供应商 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SUP-001 | 创建供应商 - 正常流程 | 无 | POST /api/admin/suppliers，传入必填字段 | 返回 200，供应商创建成功，编码自动生成 | P0 |
| TC-SUP-002 | 创建供应商 - 完整字段 | 无 | 传入所有字段（含联系人、开户行、税号等） | 返回 200，所有字段正确保存 | P0 |
| TC-SUP-003 | 创建供应商 - 缺少必填字段 name | 无 | POST 不传 name | 返回 400，提示缺少必填字段 | P0 |
| TC-SUP-004 | 创建供应商 - 缺少必填字段 contactPhone | 无 | POST 不传 contactPhone | 返回 400，提示缺少必填字段 | P0 |
| TC-SUP-005 | 创建供应商 - 联系人管理 | 无 | 创建供应商时传入 2 个联系人 | 返回 200，联系人正确保存 | P1 |
| TC-SUP-006 | 创建供应商 - 联系人标记主要联系人 | 无 | 传入 isPrimary=true 的联系人 | 返回 200，主要联系人标记正确 | P1 |
| TC-SUP-007 | 查询供应商列表 - 分页 | 存在 15 个供应商 | GET ?page=2&pageSize=10 | 返回第 2 页 5 条，total=15 | P0 |
| TC-SUP-008 | 查询供应商列表 - 关键字搜索 | 存在"茅台酒业" | GET ?keyword=茅台 | 返回匹配的供应商 | P1 |
| TC-SUP-009 | 查询供应商列表 - 状态筛选 | 存在启用+停用供应商 | GET ?status=ACTIVE | 只返回启用状态的供应商 | P1 |
| TC-SUP-010 | 查询供应商详情 | 供应商 ID=1 | GET /api/admin/suppliers/1 | 返回供应商详情及联系人列表 | P0 |
| TC-SUP-011 | 查询不存在的供应商详情 | 无 | GET /api/admin/suppliers/99999 | 返回 404 或 空数据 | P1 |
| TC-SUP-012 | 修改供应商信息 | 供应商 ID=1 | PUT 修改 name、address、phone | 返回 200，信息更新成功 | P0 |
| TC-SUP-013 | 修改供应商 - 信用额度 | 供应商 ID=1 | PUT 修改 creditLimit=50000 | 返回 200，信用额度更新 | P1 |
| TC-SUP-014 | 删除供应商 | 供应商无关联订单 | DELETE /api/admin/suppliers/1 | 返回 200，删除成功 | P1 |
| TC-SUP-015 | 删除有订单的供应商 | 供应商有关联采购订单 | DELETE | 返回 400，不允许删除 | P1 |

### 1.2 供应商状态与编码

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SUP-020 | 供应商编码自动生成 | 无 | 创建新供应商 | 编码格式正确，如 GYS20260623001 | P0 |
| TC-SUP-021 | 供应商编码唯一 | 无 | 连续创建 2 个供应商 | 编码不重复 | P0 |
| TC-SUP-022 | 停用供应商 | 供应商状态=启用 | PUT 修改 status=INACTIVE | 状态更新为停用 | P1 |
| TC-SUP-023 | 启用供应商 | 供应商状态=停用 | PUT 修改 status=ACTIVE | 状态更新为启用 | P1 |
| TC-SUP-024 | 停用供应商不影响历史订单 | 供应商有历史订单 | 停用后查询历史订单 | 历史订单正常显示 | P2 |

---

## 2. 采购订单模块

### 2.1 采购订单 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PO-001 | 创建采购订单 - 单 SKU | 存在供应商和 SKU | POST 含 1 条明细 | 返回 200，订单创建成功 | P0 |
| TC-PO-002 | 创建采购订单 - 多 SKU | 存在 3 个 SKU | POST 含 3 条明细 | 返回 200，3 条明细都正确 | P0 |
| TC-PO-003 | 创建采购订单 - 缺少明细 items | 无 | POST 不传 items | 返回 400，提示缺少明细 | P0 |
| TC-PO-004 | 创建采购订单 - 空明细数组 | 无 | POST items=[] | 返回 400，明细不能为空 | P0 |
| TC-PO-005 | 创建采购订单 - 缺少 supplierId | 无 | POST 不传 supplierId | 返回 400，提示缺少供应商 | P0 |
| TC-PO-006 | 查询订单列表 - 分页 | 存在 25 个订单 | GET ?page=2&pageSize=10 | 返回第 2 页 10 条，total=25 | P0 |
| TC-PO-007 | 查询订单列表 - 按状态筛选 | 存在不同状态订单 | GET ?status=APPROVED | 只返回已审核订单 | P1 |
| TC-PO-008 | 查询订单列表 - 按供应商筛选 | 存在多个供应商订单 | GET ?supplierId=1 | 只返回该供应商的订单 | P1 |
| TC-PO-009 | 查询订单详情 | 订单 ID=1 | GET /api/admin/purchase-orders/1 | 返回订单详情及明细列表 | P0 |
| TC-PO-010 | 查询不存在的订单 | 无 | GET /api/admin/purchase-orders/99999 | 返回 404 或 空数据 | P1 |

### 2.2 采购订单金额计算（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PO-020 | 商品金额 - 单价 88.88，数量 10 | 无 | 创建订单，unitPrice=88.88，bottleQty=10 | goodsAmount=888.80 | P0 |
| TC-PO-021 | 商品金额 - 多 SKU 累加 | 无 | 3 条明细，金额分别为 100、200、300 | goodsAmount=600.00 | P0 |
| TC-PO-022 | 税额计算 - 税率 13% | 无 | goodsAmount=1000，taxRate=0.13 | taxAmount=130.00 | P0 |
| TC-PO-023 | 税额计算 - 税率继承供应商 | 供应商税率=9% | 创建订单不传 taxRate | 继承供应商税率，taxAmount 正确 | P1 |
| TC-PO-024 | 应付金额 - 无折扣 | 无 | goodsAmount=1000，taxAmount=130 | payableAmount=1130.00 | P0 |
| TC-PO-025 | 应付金额 - 含折扣 | 无 | goodsAmount=1000，discountAmount=100.50 | payableAmount=899.50 + 税额 | P0 |
| TC-PO-026 | 金额精度 - 最小金额 0.01 | 无 | unitPrice=0.01，bottleQty=1 | goodsAmount=0.01 | P0 |
| TC-PO-027 | 金额精度 - 零金额 | 无 | unitPrice=0，bottleQty=100 | goodsAmount=0.00 | P0 |
| TC-PO-028 | 金额精度 - 大额金额 | 无 | unitPrice=99999.99，bottleQty=100 | goodsAmount=9999999.00，不溢出 | P1 |
| TC-PO-029 | 金额精度 - 三位小数四舍五入 | 无 | unitPrice=9.995，bottleQty=2 | goodsAmount=19.99（四舍五入到分） | P0 |
| TC-PO-030 | 金额精度 - 浮点误差 0.1+0.2 | 无 | unitPrice=0.1，bottleQty=1；unitPrice=0.2，bottleQty=1 | 合计 goodsAmount=0.30 | P0 |
| TC-PO-031 | 负数价格验证 | 无 | unitPrice=-10 | 返回 400，单价不能为负 | P0 |
| TC-PO-032 | 负数数量验证 | 无 | bottleQty=-5 | 返回 400，数量不能为负 | P0 |
| TC-PO-033 | 金额精度 - 税额边界 9.995 | 无 | goodsAmount=76.88，taxRate=0.13 | taxAmount=9.99（四舍五入） | P1 |
| TC-PO-034 | 明细小计验证 | 无 | unitPrice=50，bottleQty=3，boxQty=0 | subtotal=150.00 | P0 |
| TC-PO-035 | 箱装数量金额验证 | 无 | unitPrice=60，boxQty=2，boxRatio=6 | subtotal=720.00（2箱×6瓶×60元） | P1 |

### 2.3 采购订单状态流转（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PO-040 | 正常流转：DRAFT → SUBMITTED | 订单状态=DRAFT | POST /submit | 状态变为 SUBMITTED | P0 |
| TC-PO-041 | 正常流转：SUBMITTED → APPROVED | 订单状态=SUBMITTED | POST /approve | 状态变为 APPROVED | P0 |
| TC-PO-042 | 正常流转：DRAFT → SUBMITTED → APPROVED | 订单状态=DRAFT | 先提交再审核 | 状态变为 APPROVED | P0 |
| TC-PO-043 | 取消订单 - DRAFT 状态可取消 | 订单状态=DRAFT | POST /cancel | 状态变为 CANCELLED | P0 |
| TC-PO-044 | 取消订单 - SUBMITTED 状态可取消 | 订单状态=SUBMITTED | POST /cancel | 状态变为 CANCELLED | P0 |
| TC-PO-045 | 取消订单 - APPROVED 未入库可取消 | 订单已审核、未入库 | POST /cancel | 状态变为 CANCELLED | P0 |
| TC-PO-046 | 非法跳转：DRAFT 直接审核 | 订单状态=DRAFT | POST /approve | 返回 400，需先提交 | P0 |
| TC-PO-047 | 非法跳转：已取消再审核 | 订单状态=CANCELLED | POST /approve | 返回 400，状态不允许 | P0 |
| TC-PO-048 | 非法跳转：已审核再提交 | 订单状态=APPROVED | POST /submit | 返回 400，状态不允许 | P0 |
| TC-PO-049 | 幂等性：重复提交 | 订单状态=SUBMITTED | 再次 POST /submit | 返回 400，已提交 | P0 |
| TC-PO-050 | 幂等性：重复审核 | 订单状态=APPROVED | 再次 POST /approve | 返回 400，已审核 | P0 |
| TC-PO-051 | 部分入库状态 | 订单 qty=100，已入库 50 | 审核部分入库单 | 订单状态变为 PARTIAL | P1 |
| TC-PO-052 | 全部入库完成 | 订单 qty=100，已入库 100 | 审核最后一笔入库单 | 订单状态变为 COMPLETED | P1 |
| TC-PO-053 | 已入库订单不能取消 | 订单已部分入库 | POST /cancel | 返回 400，已入库不可取消 | P0 |
| TC-PO-054 | 状态变更有操作记录 | 审核订单 | 查看订单详情 | 包含审核人、审核时间 | P1 |

---

## 3. 采购入库模块

### 3.1 采购入库 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PI-001 | 创建入库单 - 按订单入库 | 存在已审核采购订单 | POST 传入 orderId | 返回 200，自动带出订单明细 | P0 |
| TC-PI-002 | 创建入库单 - 直接入库（无订单） | 无 | POST 不传 orderId | 返回 200，手动填写明细 | P1 |
| TC-PI-003 | 创建入库单 - 多 SKU 入库 | 无 | POST 含 3 条明细 | 返回 200，3 条明细都正确 | P0 |
| TC-PI-004 | 入库数量不能超过订单数量 | 订单 qty=100 | 入库 qty=150 | 返回 400，超量入库 | P0 |
| TC-PI-005 | 查询入库单列表 - 分页 | 存在 15 个入库单 | GET ?page=2&pageSize=10 | 返回第 2 页 5 条 | P0 |
| TC-PI-006 | 查询入库单列表 - 按状态筛选 | 存在不同状态入库单 | GET ?status=COMPLETED | 只返回已完成入库单 | P1 |
| TC-PI-007 | 查询入库单详情 | 入库单 ID=1 | GET /api/admin/purchase-in-stocks/1 | 返回详情及明细 | P0 |

### 3.2 采购入库状态与库存（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PI-010 | 审核入库单 - 正常流程 | 入库单状态=PENDING | POST /approve | 状态变为 COMPLETED | P0 |
| TC-PI-011 | 审核已审核入库单 | 入库单状态=COMPLETED | POST /approve | 返回 400，已审核 | P0 |
| TC-PI-012 | 作废入库单 - PENDING 状态 | 入库单状态=PENDING | POST /void | 状态变为 VOIDED | P0 |
| TC-PI-013 | 作废已审核入库单 | 入库单状态=COMPLETED | POST /void | 返回 400，已审核不可作废 | P0 |
| TC-PI-014 | 库存增加验证 - 单 SKU | 入库前库存=10 | 审核入库 qty=5 | 审核后库存 physicalQty=15 | P0 |
| TC-PI-015 | 库存增加验证 - 多 SKU | 入库前 SKU1=10, SKU2=20 | 审核入库各 +5 | 审核后 SKU1=15, SKU2=25 | P0 |
| TC-PI-016 | 作废入库单不影响库存 | 已审核入库 qty=5，库存=15 | （假设作废已审核） | 库存回退到 10 | P1 |
| TC-PI-017 | 入库金额计算 | unitPrice=50，qty=10 | 创建入库单 | subtotal=500.00 | P0 |
| TC-PI-018 | 入库金额精度 - 小数 | unitPrice=9.99，qty=7 | 创建入库单 | subtotal=69.93 | P0 |
| TC-PI-019 | 关联订单入库状态更新 | 订单 qty=100，已入库 0 | 审核入库 50 | 订单入库状态更新为 PARTIAL | P1 |
| TC-PI-020 | 全部入库后订单完成 | 订单 qty=100，已入库 50 | 再入库 50 并审核 | 订单状态变为 COMPLETED | P1 |

---

## 4. 采购退货模块

### 4.1 采购退货 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PR-001 | 创建退货单 - 正常流程 | 存在供应商和 SKU | POST /api/admin/purchase-returns | 返回 200，退货单创建成功 | P0 |
| TC-PR-002 | 创建退货单 - 关联入库单 | 存在已审核入库单 | POST 关联入库单 | 返回 200，自动带出明细 | P1 |
| TC-PR-003 | 查询退货单列表 - 分页 | 存在多个退货单 | GET ?page=1&pageSize=10 | 返回分页列表 | P0 |
| TC-PR-004 | 查询退货单详情 | 退货单 ID=1 | GET /api/admin/purchase-returns/1 | 返回详情及明细 | P0 |
| TC-PR-005 | 退货数量不能超过库存 | SKU 库存=10 | 退货 qty=15 | 返回 400，库存不足 | P0 |

### 4.2 采购退货状态与库存（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PR-010 | 审核退货单 - 正常流程 | 退货单状态=PENDING | POST /approve | 状态变为 COMPLETED | P0 |
| TC-PR-011 | 审核已审核退货单 | 退货单状态=COMPLETED | POST /approve | 返回 400，已审核 | P0 |
| TC-PR-012 | 作废退货单 - PENDING 状态 | 退货单状态=PENDING | POST /void | 状态变为 VOIDED | P0 |
| TC-PR-013 | 库存减少验证 - 单 SKU | 退货前库存=20 | 审核退货 qty=5 | 审核后库存=15 | P0 |
| TC-PR-014 | 库存减少验证 - 多 SKU | SKU1=20, SKU2=30 | 审核退货各 -5 | SKU1=15, SKU2=25 | P0 |
| TC-PR-015 | 退货金额计算 | unitPrice=80，qty=10 | 创建退货单 | returnAmount=800.00 | P0 |
| TC-PR-016 | 退货金额精度 | unitPrice=9.99，qty=3 | 创建退货单 | returnAmount=29.97 | P1 |

---

## 5. 采购付款模块

### 5.1 采购付款 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PP-001 | 创建付款单 - 订单付款 | 存在已审核采购订单 | POST /api/admin/purchase-payments | 返回 200，付款单创建成功 | P1 |
| TC-PP-002 | 创建付款单 - 预付款 | 无 | POST paymentType=ADVANCE | 返回 200，预付款创建成功 | P1 |
| TC-PP-003 | 查询付款单列表 - 分页 | 存在多个付款单 | GET ?page=1&pageSize=10 | 返回分页列表 | P1 |
| TC-PP-004 | 查询付款单详情 | 付款单 ID=1 | GET /api/admin/purchase-payments/1 | 返回付款单详情 | P1 |

### 5.2 采购付款金额与状态（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-PP-010 | 审核付款单 | 付款单状态=PENDING | POST /approve | 状态变为 COMPLETED | P1 |
| TC-PP-011 | 付款金额验证 - 全额付款 | 订单应付=1000 | 付款 amount=1000 | 订单 paidAmount=1000，unpaid=0 | P0 |
| TC-PP-012 | 付款金额验证 - 部分付款 | 订单应付=1000 | 付款 amount=300 | 订单 paidAmount=300，unpaid=700 | P0 |
| TC-PP-013 | 付款金额验证 - 多笔付款 | 订单应付=1000 | 先付 300，再付 500 | 累计 paidAmount=800 | P1 |
| TC-PP-014 | 超额付款限制 | 订单应付=1000 | 付款 amount=1500 | 返回 400，超额付款 | P0 |
| TC-PP-015 | 付款金额精度 | 应付=999.99 | 付款=999.99 | 付款成功，余额为 0 | P1 |
| TC-PP-016 | 负数付款验证 | 无 | amount=-100 | 返回 400，金额不能为负 | P0 |
| TC-PP-017 | 零金额付款 | 无 | amount=0 | 返回 400 或允许（依业务） | P2 |

---

## 6. 销售退货模块

### 6.1 销售退货 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SR-001 | 创建退货单 - 按销售单退货 | 存在销售单 | POST 传入 sourceBillNo | 返回 200，自动带出原单商品 | P0 |
| TC-SR-002 | 创建退货单 - 直接退货 | 无 | POST 不传 sourceBillNo | 返回 200，手动填写明细 | P1 |
| TC-SR-003 | 创建退货单 - 多 SKU 退货 | 无 | POST 含 3 条明细 | 返回 200，3 条明细都正确 | P0 |
| TC-SR-004 | 创建退货单 - 缺少明细 | 无 | POST items=[] | 返回 400，明细不能为空 | P0 |
| TC-SR-005 | 查询退货单列表 - 分页 | 存在 20 个退货单 | GET ?page=2&pageSize=10 | 返回第 2 页 10 条 | P0 |
| TC-SR-006 | 查询退货单列表 - 状态筛选 | 存在不同状态 | GET ?status=COMPLETED | 只返回已完成 | P1 |
| TC-SR-007 | 查询退货单详情 | 退货单 ID=1 | GET /api/admin/sale-returns/1 | 返回详情及明细 | P0 |

### 6.2 销售退货状态流转（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SR-010 | 审核退货单 - 正常流程 | 退货单状态=PENDING | POST /approve | 状态变为 COMPLETED | P0 |
| TC-SR-011 | 审核已审核退货单 | 退货单状态=COMPLETED | POST /approve | 返回 400，已审核 | P0 |
| TC-SR-012 | 作废退货单 - PENDING 状态 | 退货单状态=PENDING | POST /void | 状态变为 VOIDED | P0 |
| TC-SR-013 | 作废已审核退货单 | 退货单状态=COMPLETED | POST /void | 返回 400，已审核不可作废 | P0 |
| TC-SR-014 | 非法跳转：PENDING 直接退款 | 退货单状态=PENDING | POST /refund | 返回 400，需先审核 | P0 |
| TC-SR-015 | 幂等性：重复审核 | 已审核退货单 | 再次 POST /approve | 返回 400，已审核 | P0 |

### 6.3 销售退货库存与金额（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-SR-020 | 库存回滚 - 单 SKU 退货 | 退货前库存=10 | 审核退货 qty=3 | 审核后库存=13 | P0 |
| TC-SR-021 | 库存回滚 - 多 SKU 退货 | SKU1=10, SKU2=20 | 审核退货各 +3 | SKU1=13, SKU2=23 | P0 |
| TC-SR-022 | 退货金额计算 - 单 SKU | unitPrice=100，qty=2 | 创建退货单 | returnAmount=200.00 | P0 |
| TC-SR-023 | 退货金额计算 - 多 SKU | 2 条明细 100+200 | 创建退货单 | returnAmount=300.00 | P0 |
| TC-SR-024 | 退货金额精度 - 小数 | unitPrice=9.99，qty=3 | 创建退货单 | returnAmount=29.97 | P0 |
| TC-SR-025 | 退货金额精度 - 浮点误差 | unitPrice=0.1 和 0.2 各 1 个 | 创建退货单 | returnAmount=0.30 | P0 |
| TC-SR-026 | 确认退款 - 现金退款 | 退货单已审核 | POST /refund，refundMethod=CASH | 退款成功，已退金额=退款金额 | P0 |
| TC-SR-027 | 确认退款 - 微信退款 | 退货单已审核 | POST refundMethod=WECHAT | 退款成功 | P1 |
| TC-SR-028 | 退款金额验证 - 全额退款 | 应退 500 | 退款 500 | refundedAmount=500，状态=REFUNDED | P0 |
| TC-SR-029 | 退款金额验证 - 部分退款 | 应退 500 | 退款 300 | refundedAmount=300，剩余 200 | P1 |
| TC-SR-030 | 超额退款限制 | 应退 500 | 退款 600 | 返回 400，超额退款 | P0 |
| TC-SR-031 | 退款金额精度 | 应退 99.99 | 退款 99.99 | 退款成功，余额为 0 | P1 |
| TC-SR-032 | 负数退款验证 | 无 | refundAmount=-100 | 返回 400，金额不能为负 | P0 |

---

## 7. 客户对账模块

### 7.1 客户对账单 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CS-001 | 生成对账单 - 正常流程 | 存在客户和销售记录 | POST /api/admin/customer-statements | 返回 200，对账单生成成功 | P1 |
| TC-CS-002 | 生成对账单 - 缺少客户 | 无 | POST 不传 customerId | 返回 400，提示缺少客户 | P1 |
| TC-CS-003 | 查询对账单列表 - 分页 | 存在多个对账单 | GET ?page=1&pageSize=10 | 返回分页列表 | P1 |
| TC-CS-004 | 查询对账单详情 | 对账单 ID=1 | GET /api/admin/customer-statements/1 | 返回详情及明细流水 | P1 |

### 7.2 客户对账状态流转

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CS-010 | 确认对账单 | 对账单状态=DRAFT | POST /confirm | 状态变为 CONFIRMED | P1 |
| TC-CS-011 | 确认已确认对账单 | 对账单状态=CONFIRMED | POST /confirm | 返回 400，已确认 | P1 |
| TC-CS-012 | DRAFT 状态不能收款 | 对账单状态=DRAFT | POST /payment | 返回 400，需先确认 | P0 |
| TC-CS-013 | 收款后状态更新 | 对账单确认后全额收款 | 收款 100% | 状态变为 PAID | P1 |
| TC-CS-014 | 部分收款状态 | 对账单确认后部分收款 | 收款 50% | 状态保持 CONFIRMED 或 PARTIAL | P2 |

### 7.3 客户对账金额计算（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CS-020 | 期初余额计算 | 上期未结=500 | 生成对账单 | openingBalance=500.00 | P0 |
| TC-CS-021 | 本期销售汇总 - 单条销售 | 期间 1 笔销售 300 | 生成对账单 | totalSales=300.00 | P0 |
| TC-CS-022 | 本期销售汇总 - 多条累加 | 期间 3 笔销售 100+200+300 | 生成对账单 | totalSales=600.00 | P0 |
| TC-CS-023 | 本期退货汇总 | 期间 1 笔退货 50 | 生成对账单 | totalReturns=50.00 | P0 |
| TC-CS-024 | 本期收款汇总 | 期间 2 笔收款 100+200 | 生成对账单 | totalPayments=300.00 | P0 |
| TC-CS-025 | 期末余额计算 - 完整公式 | 期初500 + 销售600 - 退货50 - 收款300 | 生成对账单 | closingBalance=750.00 | P0 |
| TC-CS-026 | 期末余额精度 - 小数 | 期初99.99 + 销售9.99 - 收款0.99 | 生成对账单 | closingBalance=108.99 | P1 |
| TC-CS-027 | 期末余额为负数（超额收款） | 期初100，收款200 | 生成对账单 | closingBalance=-100.00（预收款） | P2 |
| TC-CS-028 | 零销售零收款 | 期初0，期间无交易 | 生成对账单 | 所有汇总=0，期末=期初 | P1 |
| TC-CS-029 | 大额金额汇总 | 单笔销售 99999.99 | 生成对账单 | totalSales=99999.99，不溢出 | P2 |

---

## 8. 客户收款模块

### 8.1 客户收款 CRUD

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CP-001 | 创建收款单 - 按对账单收款 | 存在已确认对账单 | POST /api/admin/customer-payments | 返回 200，收款成功 | P1 |
| TC-CP-002 | 创建收款单 - 预收款 | 无 | POST 不传 sourceNo | 返回 200，预收款创建成功 | P1 |
| TC-CP-003 | 查询收款记录列表 | 存在多个收款单 | GET ?page=1&pageSize=10 | 返回分页列表 | P1 |
| TC-CP-004 | 查询收款单详情 | 收款单 ID=1 | GET /api/admin/customer-payments/1 | 返回收款单详情 | P1 |

### 8.2 客户收款金额与状态（重点）

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-CP-010 | 收款金额验证 - 全额收款 | 对账单应付=1000 | 收款 1000 | 对账单已收=1000，未收=0 | P0 |
| TC-CP-011 | 收款金额验证 - 部分收款 | 对账单应付=1000 | 收款 300 | 已收=300，未收=700 | P0 |
| TC-CP-012 | 多笔收款累计 | 对账单应付=1000 | 先收300，再收500 | 累计已收=800 | P1 |
| TC-CP-013 | 超额收款限制 | 对账单应付=1000 | 收款 1500 | 返回 400，超额收款 | P0 |
| TC-CP-014 | 负数收款验证 | 无 | amount=-100 | 返回 400，金额不能为负 | P0 |
| TC-CP-015 | 收款金额精度 | 应收=999.99 | 收款=999.99 | 收款成功，余额为 0 | P1 |
| TC-CP-016 | 作废收款单 | 收款单已完成 | POST /void | 状态变为 VOIDED，已收金额回退 | P1 |
| TC-CP-017 | 作废后余额回退 | 应收=1000，已收=300 | 作废 300 收款 | 已收=0，未收=1000 | P1 |

---

## 9. 库存预警模块

| 用例ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-IA-001 | 查询预警列表 | 存在低库存商品 | GET /api/admin/inventory-alerts | 返回预警列表 | P1 |
| TC-IA-002 | 低库存预警触发 - 低于阈值 | 商品库存=5，阈值=10 | 查询预警列表 | 商品出现在预警列表中 | P0 |
| TC-IA-003 | 低库存预警不触发 - 高于阈值 | 商品库存=15，阈值=10 | 查询预警列表 | 商品不在预警列表中 | P0 |
| TC-IA-004 | 低库存预警边界 - 等于阈值 | 商品库存=10，阈值=10 | 查询预警列表 | 不触发或触发（依业务定义） | P1 |
| TC-IA-005 | 预警数量统计 | 3 个商品低于阈值 | 查询预警列表 | total=3 | P1 |
| TC-IA-006 | 采购入库消除预警 | 库存=5，阈值=10 → 入库 10 | 入库后查预警 | 该商品从预警列表消失 | P0 |
| TC-IA-007 | 销售出库触发预警 | 库存=15，阈值=10 → 出库 6 | 出库后查预警 | 该商品出现在预警列表 | P1 |

---

## 10. 专项测试用例（重点）

### 10.1 金额精度专项测试（重点）

| 用例ID | 用例名称 | 涉及模块 | 测试步骤 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-AMT-001 | 最小金额 0.01 元 | 采购订单 | unitPrice=0.01，qty=1 | goodsAmount=0.01 | P0 |
| TC-AMT-002 | 零金额 0.00 元 | 采购订单 | unitPrice=0，qty=100 | goodsAmount=0.00 | P0 |
| TC-AMT-003 | 大额金额 999999.99 | 采购订单 | unitPrice=9999.99，qty=100 | goodsAmount=999999.00，不溢出 | P0 |
| TC-AMT-004 | 负数金额被拒绝 | 采购订单 | unitPrice=-10 | 返回 400 | P0 |
| TC-AMT-005 | 浮点误差 0.1+0.2 | 采购订单 | 两条明细 0.1 和 0.2 | 合计=0.30 | P0 |
| TC-AMT-006 | 三位小数四舍五入 | 采购订单 | unitPrice=9.995，qty=2 | subtotal=19.99 | P0 |
| TC-AMT-007 | 乘法精度验证 | 采购入库 | unitPrice=9.99，qty=7 | subtotal=69.93 | P0 |
| TC-AMT-008 | 多 SKU 累加精度 | 采购订单 | 10 条各 9.99 的明细 | 合计=99.90 | P1 |
| TC-AMT-009 | 税额精度 - 13% | 采购订单 | goodsAmount=76.88，taxRate=0.13 | taxAmount=9.99 | P1 |
| TC-AMT-010 | 税额精度 - 9% | 采购订单 | goodsAmount=100，taxRate=0.09 | taxAmount=9.00 | P1 |
| TC-AMT-011 | 折扣后金额精度 | 采购订单 | goodsAmount=100，discount=10.50 | payable=89.50 + 税 | P0 |
| TC-AMT-012 | 部分付款余额精度 | 采购付款 | 应付=999.99，已付=333.33 | 未付=666.66 | P1 |
| TC-AMT-013 | 客户对账期末余额精度 | 客户对账 | 期初99.99 + 销售9.99 - 收款0.99 | 期末=108.99 | P1 |
| TC-AMT-014 | 退货金额精度 | 销售退货 | unitPrice=9.99，qty=3 | returnAmount=29.97 | P0 |
| TC-AMT-015 | 退款余额精度 | 销售退货 | 应退=99.99，已退=33.33 | 未退=66.66 | P1 |
| TC-AMT-016 | 库存金额计算 | 库存查询 | 库存=100，成本=50.50 | 库存金额=5050.00 | P2 |
| TC-AMT-017 | 供应商信用额度精度 | 供应商管理 | creditLimit=99999.99 | 正确保存和显示 | P2 |

### 10.2 状态流转专项测试（重点）

| 用例ID | 用例名称 | 单据类型 | 流转路径 | 预期结果 | 优先级 |
|--------|---------|---------|---------|---------|--------|
| TC-ST-001 | 采购订单完整正向流程 | 采购订单 | DRAFT → SUBMITTED → APPROVED → PARTIAL → COMPLETED | 每个状态转换正确 | P0 |
| TC-ST-002 | 采购订单取消 - DRAFT | 采购订单 | DRAFT → CANCELLED | 取消成功 | P0 |
| TC-ST-003 | 采购订单取消 - SUBMITTED | 采购订单 | SUBMITTED → CANCELLED | 取消成功 | P0 |
| TC-ST-004 | 采购订单取消 - APPROVED 未入库 | 采购订单 | APPROVED → CANCELLED | 取消成功 | P0 |
| TC-ST-005 | 采购订单非法跳转 - DRAFT 直接审核 | 采购订单 | DRAFT → APPROVED | 返回 400 | P0 |
| TC-ST-006 | 采购订单非法跳转 - 已取消再审核 | 采购订单 | CANCELLED → APPROVED | 返回 400 | P0 |
| TC-ST-007 | 采购订单幂等性 - 重复提交 | 采购订单 | SUBMITTED → 再 SUBMIT | 返回 400 | P0 |
| TC-ST-008 | 采购订单幂等性 - 重复审核 | 采购订单 | APPROVED → 再 APPROVE | 返回 400 | P0 |
| TC-ST-009 | 采购入库完整流程 | 采购入库 | PENDING → COMPLETED | 审核成功，库存增加 | P0 |
| TC-ST-010 | 采购入库作废 | 采购入库 | PENDING → VOIDED | 作废成功 | P0 |
| TC-ST-011 | 采购入库非法作废 | 采购入库 | COMPLETED → VOIDED | 返回 400 | P0 |
| TC-ST-012 | 采购退货完整流程 | 采购退货 | PENDING → COMPLETED | 审核成功，库存减少 | P0 |
| TC-ST-013 | 销售退货完整流程 | 销售退货 | PENDING → COMPLETED → REFUNDED | 状态流转正确 | P0 |
| TC-ST-014 | 销售退货非法跳转 - 先退款 | 销售退货 | PENDING → REFUNDED | 返回 400 | P0 |
| TC-ST-015 | 销售退货作废 | 销售退货 | PENDING → VOIDED | 作废成功 | P0 |
| TC-ST-016 | 客户对账完整流程 | 客户对账 | DRAFT → CONFIRMED → PAID | 状态流转正确 | P1 |
| TC-ST-017 | 客户对账非法收款 | 客户对账 | DRAFT → 收款 | 返回 400 | P0 |
| TC-ST-018 | 采购付款完整流程 | 采购付款 | PENDING → COMPLETED | 审核成功，已付更新 | P1 |
| TC-ST-019 | 已入库订单不可取消 | 采购订单 | APPROVED + 已入库 → CANCELLED | 返回 400 | P0 |
| TC-ST-020 | 状态变更操作记录 | 所有单据 | 任意状态变更 | 有操作人和操作时间 | P1 |

### 10.3 并发操作测试

| 用例ID | 用例名称 | 场景 | 测试方法 | 预期结果 | 优先级 |
|--------|---------|------|---------|---------|--------|
| TC-CC-001 | 同时审核同一订单 | 采购订单 DRAFT | 2 个请求同时 POST /approve | 1 个成功，1 个失败 | P1 |
| TC-CC-002 | 同时取消同一订单 | 采购订单 DRAFT | 2 个请求同时 POST /cancel | 1 个成功，1 个失败 | P2 |
| TC-CC-003 | 同时入库同一订单 | 订单 qty=10 | 2 个请求各入 6 | 总入库 ≤ 10，1 个超量失败 | P0 |
| TC-CC-004 | 同时收款同一对账单 | 应付=1000 | 2 个请求各收 600 | 总收款 ≤ 1000，1 个超额失败 | P0 |
| TC-CC-005 | 同时审核同一入库单 | 入库单 PENDING | 2 个请求同时审核 | 1 个成功，1 个失败 | P1 |
| TC-CC-006 | 同时退货同一 SKU | 库存=10 | 2 个退货各退 6 | 总退货 ≤ 10，1 个库存不足失败 | P1 |

### 10.4 边界值测试

| 用例ID | 用例名称 | 类型 | 测试值 | 预期结果 | 优先级 |
|--------|---------|------|--------|---------|--------|
| TC-BV-001 | 数量=0 | 数量 | qty=0 | 返回 400 或允许 | P1 |
| TC-BV-002 | 数量极大值 | 数量 | qty=999999 | 能正常创建，不溢出 | P2 |
| TC-BV-003 | 名称=空字符串 | 字符串 | name="" | 返回 400 | P0 |
| TC-BV-004 | 名称=最大长度 | 字符串 | name 200 字符 | 能正常保存 | P2 |
| TC-BV-005 | 电话=非法格式 | 格式 | mobile="abc" | 返回 400 | P1 |
| TC-BV-006 | 邮箱=非法格式 | 格式 | email="not-email" | 返回 400 | P2 |
| TC-BV-007 | 分页 page=0 | 分页 | page=0 | 正常返回第 1 页 | P1 |
| TC-BV-008 | 分页 pageSize=1 | 分页 | pageSize=1 | 正常返回 1 条 | P1 |
| TC-BV-009 | 分页 pageSize 极大 | 分页 | pageSize=10000 | 正常返回或限制上限 | P2 |

---

## 11. 测试数据准备

### 11.1 基础测试数据

```json
{
  "suppliers": [
    { "id": 1, "name": "茅台酒业", "contactName": "张经理", "contactPhone": "13800138001", "creditLimit": 100000, "taxRate": 0.13 },
    { "id": 2, "name": "五粮液集团", "contactName": "李总", "contactPhone": "13800138002", "creditLimit": 80000, "taxRate": 0.09 }
  ],
  "products": [
    { "id": 1, "skuName": "茅台 53度 500ml", "costPrice": 1000, "retailPrice": 1499, "boxRatio": 6 },
    { "id": 2, "skuName": "五粮液 52度 500ml", "costPrice": 800, "retailPrice": 1099, "boxRatio": 6 },
    { "id": 3, "skuName": "国窖1573 52度 500ml", "costPrice": 700, "retailPrice": 999, "boxRatio": 6 }
  ],
  "customers": [
    { "id": 1, "name": "张三酒行", "mobile": "13800138003", "creditLimit": 50000 },
    { "id": 2, "name": "李四超市", "mobile": "13800138004", "creditLimit": 30000 }
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

### 12.1 接口清单（admin 路由）

| 模块 | 接口 | 方法 | 优先级 |
|------|------|------|--------|
| 供应商 | /api/admin/suppliers | GET, POST | P0 |
| 供应商 | /api/admin/suppliers/{id} | GET, PUT, DELETE | P0 |
| 供应商联系人 | /api/admin/suppliers/{id}/contacts | GET, POST | P1 |
| 采购订单 | /api/admin/purchase-orders | GET, POST | P0 |
| 采购订单 | /api/admin/purchase-orders/{id} | GET | P0 |
| 采购订单 | /api/admin/purchase-orders/{id}/submit | POST | P0 |
| 采购订单 | /api/admin/purchase-orders/{id}/approve | POST | P0 |
| 采购订单 | /api/admin/purchase-orders/{id}/cancel | POST | P0 |
| 采购入库 | /api/admin/purchase-in-stocks | GET, POST | P0 |
| 采购入库 | /api/admin/purchase-in-stocks/{id} | GET | P0 |
| 采购入库 | /api/admin/purchase-in-stocks/{id}/approve | POST | P0 |
| 采购入库 | /api/admin/purchase-in-stocks/{id}/void | POST | P0 |
| 采购退货 | /api/admin/purchase-returns | GET, POST | P0 |
| 采购退货 | /api/admin/purchase-returns/{id} | GET | P0 |
| 采购退货 | /api/admin/purchase-returns/{id}/approve | POST | P0 |
| 采购退货 | /api/admin/purchase-returns/{id}/void | POST | P0 |
| 采购付款 | /api/admin/purchase-payments | GET, POST | P1 |
| 采购付款 | /api/admin/purchase-payments/{id}/approve | POST | P1 |
| 销售退货 | /api/admin/sale-returns | GET, POST | P0 |
| 销售退货 | /api/admin/sale-returns/{id} | GET | P0 |
| 销售退货 | /api/admin/sale-returns/{id}/approve | POST | P0 |
| 销售退货 | /api/admin/sale-returns/{id}/refund | POST | P0 |
| 销售退货 | /api/admin/sale-returns/{id}/void | POST | P0 |
| 客户对账 | /api/admin/customer-statements | GET, POST | P1 |
| 客户对账 | /api/admin/customer-statements/{id} | GET | P1 |
| 客户对账 | /api/admin/customer-statements/{id}/confirm | POST | P1 |
| 客户收款 | /api/admin/customer-payments | GET, POST | P1 |
| 客户收款 | /api/admin/customer-payments/{id}/void | POST | P1 |
| 库存预警 | /api/admin/inventory/alerts | GET | P1 |
| 库存余额 | /api/admin/inventory/balances | GET | P1 |

### 12.2 测试优先级说明

| 优先级 | 含义 | 测试策略 |
|--------|------|---------|
| P0 | 核心功能，上线必须通过 | 100% 自动化，回归必测 |
| P1 | 重要功能，影响用户体验 | 90% 自动化，主要回归测试 |
| P2 | 一般功能，边缘场景 | 抽样测试 + 手工验证 |
