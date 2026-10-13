-- 编号: 138, 描述: 业务单据关联审批实例（全局审批接入）, 创建人: 系统, 日期: 2026-08-14
-- S3-186：原 CALL add_column_if_not_exists('purchase_order', 'approval_instance_no', "VARCHAR(64) DEFAULT NULL COMMENT '关联审批实例号' AFTER order_status");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 'purchase_order', @s3186_name = 'approval_instance_no';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''关联审批实例号'' AFTER order_status'), 'SELECT ''跳过 purchase_order.approval_instance_no'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sale_return', 'approval_instance_no', "VARCHAR(64) DEFAULT NULL COMMENT '关联审批实例号' AFTER return_status");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 'sale_return', @s3186_name = 'approval_instance_no';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''关联审批实例号'' AFTER return_status'), 'SELECT ''跳过 sale_return.approval_instance_no'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
