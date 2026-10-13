USE liquor_inventory;

-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill', 'operator_name', "VARCHAR(64) DEFAULT NULL COMMENT '制单人快照' AFTER operator_id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'operator_name';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''制单人快照'' AFTER operator_id'), 'SELECT ''跳过 t_sale_bill.operator_name'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill', 'auditor_id', "BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人ID' AFTER operator_name");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'auditor_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'BIGINT UNSIGNED DEFAULT NULL COMMENT ''审核人ID'' AFTER operator_name'), 'SELECT ''跳过 t_sale_bill.auditor_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill', 'auditor_name', "VARCHAR(64) DEFAULT NULL COMMENT '审核人快照' AFTER auditor_id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'auditor_name';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''审核人快照'' AFTER auditor_id'), 'SELECT ''跳过 t_sale_bill.auditor_name'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill', 'salesman_id', "BIGINT UNSIGNED DEFAULT NULL COMMENT '业务员ID' AFTER auditor_name");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'salesman_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'BIGINT UNSIGNED DEFAULT NULL COMMENT ''业务员ID'' AFTER auditor_name'), 'SELECT ''跳过 t_sale_bill.salesman_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill', 'salesman_name', "VARCHAR(64) DEFAULT NULL COMMENT '业务员快照' AFTER salesman_id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill', @s3186_name = 'salesman_name';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''业务员快照'' AFTER salesman_id'), 'SELECT ''跳过 t_sale_bill.salesman_name'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

SELECT column_name FROM information_schema.COLUMNS
WHERE table_schema = DATABASE() AND table_name = 't_sale_bill'
  AND column_name IN ('operator_name','auditor_id','auditor_name','salesman_id','salesman_name')
ORDER BY ordinal_position;

-- 编号: 134, 描述: 销售单制单人/审核人/业务员字段（按账号角色默认填充，可手动选择）
-- 说明: 文件头不写注释；使用 092 存储过程幂等补列。
