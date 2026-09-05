ALTER TABLE t_transfer_order ADD COLUMN `actual_date` DATE DEFAULT NULL COMMENT '实际完成日期';
ALTER TABLE t_inventory_balance ADD COLUMN `sku_name` VARCHAR(255) DEFAULT NULL COMMENT 'SKU名称快照(收货建行用)';
-- 编号: 166, 描述: 收货链补幻影列——transfer-execution.service 的收货 UPDATE 引用 actual_date,
-- 但 114/163 均未定义该列, 生产库缺列导致收货接口 "Unknown column 'actual_date'" 500;
-- 同理收货建库存行 INSERT 引用 sku_name, 001 建表无此列, 一并补齐。
-- 顶格书写规避启动迁移的注释丢弃 bug, 幂等可重复执行。创建人: 凌舟, 日期: 2026-09-05
