-- 编号: 138, 描述: 业务单据关联审批实例（全局审批接入）, 创建人: 系统, 日期: 2026-08-14
-- S3-190（原收口第 53 项）：本文件 2 条补列语句原先传的表名缺 t_ 前缀（purchase_order / sale_return）⇒ 恒 ER_NO_SUCH_TABLE，从未生效。
--   本次**只补表名前缀**（purchase_order ⇒ t_purchase_order、sale_return ⇒ t_sale_return）：列定义/守卫条件/动态 SQL 一字未改；
--   下方每条 "原 CALL" 注释保留的是 S3-186 改前原文（含缺前缀的表名）。
-- S3-186：原 CALL add_column_if_not_exists('purchase_order', 'approval_instance_no', "VARCHAR(64) DEFAULT NULL COMMENT '关联审批实例号' AFTER order_status");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_purchase_order', @s3186_name = 'approval_instance_no';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''关联审批实例号'' AFTER order_status'), 'SELECT ''跳过 t_purchase_order.approval_instance_no'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sale_return', 'approval_instance_no', "VARCHAR(64) DEFAULT NULL COMMENT '关联审批实例号' AFTER return_status");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_return', @s3186_name = 'approval_instance_no';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''关联审批实例号'' AFTER return_status'), 'SELECT ''跳过 t_sale_return.approval_instance_no'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
