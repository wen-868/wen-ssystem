# 结构对照：s3212b_46_pass1 vs s3212b_46

- 表数：312 vs 312
- 列数：4156 vs 4156
- 索引行数：1563 vs 1581
- 外键行数：15 vs 15

## 表：仅 s3212b_46_pass1 有 0 条 / 仅 s3212b_46 有 0 条


## 列：仅 s3212b_46_pass1 有 0 条 / 仅 s3212b_46 有 0 条


## 索引：仅 s3212b_46_pass1 有 0 条 / 仅 s3212b_46 有 18 条

- B: t_approval_approver.idx_t_approval_approver_tenant(1) → tenant_id unique=false
- B: t_approval_instance.idx_t_approval_instance_tenant(1) → tenant_id unique=false
- B: t_approval_log.idx_t_approval_log_tenant(1) → tenant_id unique=false
- B: t_approval_notification.idx_t_approval_notification_tenant(1) → tenant_id unique=false
- B: t_approval_rule.idx_t_approval_rule_tenant(1) → tenant_id unique=false
- B: t_approval_task.idx_t_approval_task_tenant(1) → tenant_id unique=false
- B: t_brand.idx_t_brand_tenant(1) → tenant_id unique=false
- B: t_coupon_template.idx_coupon_template_type(1) → type unique=false
- B: t_customer_type.idx_t_customer_type_tenant(1) → tenant_id unique=false
- B: t_daily_settlement.idx_t_daily_settlement_tenant(1) → tenant_id unique=false
- B: t_sale_bill.idx_sale_bill_customer_status(1) → customer_id unique=false
- B: t_sale_bill.idx_sale_bill_customer_status(2) → status unique=false
- B: t_sale_bill.idx_sale_bill_status(1) → status unique=false
- B: t_sale_bill.idx_sale_bill_status_created(1) → status unique=false
- B: t_sale_bill.idx_sale_bill_status_created(2) → created_at unique=false
- B: t_sale_bill.idx_sale_bill_tenant_status(1) → tenant_id unique=false
- B: t_sale_bill.idx_sale_bill_tenant_status(2) → status unique=false
- B: t_stock_warning.idx_t_stock_warning_tenant(1) → tenant_id unique=false

## 外键：仅 s3212b_46_pass1 有 0 条 / 仅 s3212b_46 有 0 条


## 汇总

- 表: A-only=0 B-only=0
- 列: A-only=0 B-only=0
- 索引: A-only=0 B-only=18
- 外键: A-only=0 B-only=0