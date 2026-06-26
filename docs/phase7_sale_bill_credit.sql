-- A110: 销售单扩展 - 赊销支持
-- 为 sale_bill 表添加 sale_type 和 due_date 字段

ALTER TABLE sale_bill
  ADD COLUMN IF NOT EXISTS sale_type VARCHAR(16) NOT NULL DEFAULT 'CASH' COMMENT '销售类型：CASH(现销)/CREDIT(赊销)' AFTER customer_type,
  ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL COMMENT '赊销到期日' AFTER unreceived_amount;

-- 超期标记索引
ALTER TABLE sale_bill
  ADD INDEX IF NOT EXISTS idx_sale_bill_credit_overdue (sale_type, due_date, collection_status);
