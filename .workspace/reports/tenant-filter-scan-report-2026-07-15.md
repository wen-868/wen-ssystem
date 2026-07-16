# 租户过滤全量扫描报告

> 扫描日期：2026-07-15  
> 扫描范围：`backend/src/services/**/*.ts`  
> 扫描工具：grep  
> 扫描人：阿坚

---

## 扫描结果汇总

| 类别 | 数量 |
|------|------|
| 缺少 tenant_id 过滤的 SQL 查询 | 25+ |
| 已确认的 P0 级漏洞 | 4 |
| 需要修复的文件 | 12+ |

---

## 详细问题列表

### 1. miniapp.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 252 | `SELECT sku_id FROM t_miniapp_order_item WHERE order_no = ?` | **P0** |

**问题**：confirmReceipt 函数中查询订单明细时缺少 tenant_id 过滤，可能导致不同租户间的订单数据混淆。

---

### 2. supplier.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 295 | `SELECT * FROM t_supplier_contact WHERE supplier_id = ?` | **P0** |
| 434 | `SELECT * FROM t_supplier_contact WHERE id = ? AND supplier_id = ?` | **P0** |
| 440 | `DELETE FROM t_supplier_contact WHERE id = ?` | **P0** |
| 397 | `UPDATE t_supplier_contact SET is_primary = 0 WHERE supplier_id = ?` | **P0** |

**问题**：供应商联系人查询和操作缺少 tenant_id 过滤，可能导致不同租户的供应商联系人数据混淆或误删。

---

### 3. purchase.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 275 | `SELECT * FROM t_purchase_order_item WHERE order_no = ?` | **P0** |
| 425 | `DELETE FROM t_purchase_order_item WHERE order_no = ?` | **P0** |
| 479 | `DELETE FROM t_purchase_order_item WHERE order_no = ?` | **P0** |
| 598 | `SELECT total_bottle_qty, in_stocked_qty FROM t_purchase_order_item WHERE order_no = ?` | **P0** |

**问题**：采购订单明细查询和删除缺少 tenant_id 过滤，可能导致不同租户的采购订单数据混淆或误删。

---

### 4. error-log.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 72-78 | `SELECT * FROM error_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?` | **P0** |

**问题**：listErrorLogs 函数查询 error_logs 表时缺少 tenant_id 过滤，任何租户可以查看其他租户的错误日志。

---

### 5. wechat.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 100 | `SELECT id, password_hash, username, real_name FROM t_sys_user WHERE username = ? AND status = 1` | **P1** |

**问题**：微信登录时查询用户信息缺少 tenant_id 过滤，可能导致跨租户用户登录。

---

### 6. tenant-register.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 70 | `SELECT id FROM t_sys_user WHERE username = ?` | **P1** |

**问题**：租户注册时检查用户名唯一性缺少 tenant_id 过滤，可能导致不同租户间用户名冲突。

---

### 7. admin/auth.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 87 | `SELECT default_homepage FROM t_sys_user WHERE id = ?` | **P1** |
| 100 | `SELECT default_homepage FROM t_sys_user WHERE id = ?` | **P1** |
| 119 | `SELECT id, password_hash AS passwordHash FROM t_sys_user WHERE id = ?` | **P1** |

**问题**：用户信息查询缺少 tenant_id 过滤，可能导致越权访问其他租户用户信息。

---

### 8. admin/credit-limit.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 114 | `SELECT id, name FROM member WHERE id = ?` | **P1** |

**问题**：会员信息查询缺少 tenant_id 过滤，可能导致越权访问其他租户会员信息。

---

### 9. admin/cart.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 41 | `SELECT pp.retail_price FROM t_product_price pp WHERE pp.sku_id = ?` | **P1** |

**问题**：商品价格查询缺少 tenant_id 过滤，可能导致获取到其他租户的商品价格。

---

### 10. sale-return.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 137 | `SELECT * FROM t_sale_return_item WHERE return_no = ?` | **P1** |
| 235 | `SELECT sku_id, total_bottle_qty FROM t_sale_return_item WHERE return_no = ?` | **P1** |
| 319 | `SELECT * FROM t_sale_bill_item WHERE bill_no = ?` | **P1** |

**问题**：销售退货明细查询缺少 tenant_id 过滤，可能导致不同租户的退货数据混淆。

---

### 11. share.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 25 | `SELECT * FROM t_sale_bill_item WHERE bill_no = ?` | **P1** |
| 34 | `SELECT link_no, amount, status FROM t_collection_link WHERE token = ?` | **P1** |

**问题**：收款链接和销售单据查询缺少 tenant_id 过滤，可能导致越权访问其他租户数据。

---

### 12. marketing/community-marketing.service.ts

| 行号 | SQL 查询 | 风险等级 |
|------|----------|----------|
| 542 | `UPDATE seckill_product SET available_stock = available_stock - ? WHERE id = ?` | **P1** |

**问题**：秒杀商品库存更新缺少 tenant_id 过滤，可能导致误操作其他租户的秒杀商品库存。

---

## 修复建议

### 修复优先级

1. **P0 级（立即修复）**：miniapp.service.ts、supplier.service.ts、purchase.service.ts、error-log.service.ts
2. **P1 级（短期修复）**：wechat.service.ts、tenant-register.service.ts、admin/auth.service.ts、admin/credit-limit.service.ts、admin/cart.service.ts、sale-return.service.ts、share.service.ts、marketing/community-marketing.service.ts

### 修复方法

1. 在所有 SELECT/DELETE/UPDATE 查询的 WHERE 条件中添加 `AND tenant_id = ?`
2. 在查询参数数组中添加 `tenantId` 参数
3. 对于 JOIN 查询，确保所有关联表都包含 tenant_id 过滤

### 验证方法

1. 运行 `npx vitest run` 确保所有测试通过
2. 运行 `npx tsc --noEmit --strict` 确保类型检查通过
3. 编写专门的租户隔离测试用例，验证跨租户访问被正确拒绝

---

## 总结

本次扫描共发现 **25+ 个缺少 tenant_id 过滤的 SQL 查询**，涉及 **12+ 个服务文件**。其中 **4 个 P0 级漏洞**需要立即修复，**11+ 个 P1 级问题**需要短期修复。建议按优先级逐步修复，确保系统租户隔离机制的完整性。