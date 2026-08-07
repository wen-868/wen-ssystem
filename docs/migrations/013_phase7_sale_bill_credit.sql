ALTER TABLE t_sale_bill
  ADD COLUMN sale_type VARCHAR(16) NOT NULL DEFAULT 'CASH' COMMENT '销售类型：CASH(现销)/CREDIT(赊销)' AFTER customer_type,
  ADD COLUMN due_date DATE DEFAULT NULL COMMENT '赊销到期日' AFTER unreceived_amount;

ALTER TABLE t_sale_bill
  ADD INDEX idx_sale_bill_credit_overdue (sale_type, due_date, collection_status);
-- 编号: 013, 描述: 销售单赊销支持, 创建人: 阿坚, 日期: 2026-07-06
-- A110: 销售单扩展 - 赊销支持
-- 为 sale_bill 表添加 sale_type 和 due_date 字段
-- 超期标记索引
-- 说明：MySQL 的 ALTER 不支持条件新增/加索引（仅 MariaDB 支持），已存在时报错由迁移引擎 safeExec 跳过
