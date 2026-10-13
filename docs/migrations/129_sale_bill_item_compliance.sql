USE liquor_inventory;

-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill_item', 'sku_spec', "VARCHAR(128) DEFAULT NULL COMMENT '规格快照' AFTER sku_name");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'sku_spec';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(128) DEFAULT NULL COMMENT ''规格快照'' AFTER sku_name'), 'SELECT ''跳过 t_sale_bill_item.sku_spec'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill_item', 'unit', "VARCHAR(16) NOT NULL DEFAULT '瓶' COMMENT '单位快照' AFTER sku_spec");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'unit';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(16) NOT NULL DEFAULT ''瓶'' COMMENT ''单位快照'' AFTER sku_spec'), 'SELECT ''跳过 t_sale_bill_item.unit'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill_item', 'barcode', "VARCHAR(128) DEFAULT NULL COMMENT '条码快照' AFTER unit");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'barcode';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(128) DEFAULT NULL COMMENT ''条码快照'' AFTER unit'), 'SELECT ''跳过 t_sale_bill_item.barcode'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill_item', 'item_remark', "VARCHAR(255) DEFAULT NULL COMMENT '行备注' AFTER subtotal_amount");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'item_remark';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(255) DEFAULT NULL COMMENT ''行备注'' AFTER subtotal_amount'), 'SELECT ''跳过 t_sale_bill_item.item_remark'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill_item', 'item_discount', "DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '行折扣率%' AFTER item_remark");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'item_discount';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT ''行折扣率%'' AFTER item_remark'), 'SELECT ''跳过 t_sale_bill_item.item_discount'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('t_sale_bill_item', 'trace_codes', "JSON DEFAULT NULL COMMENT '追溯码列表' AFTER item_discount");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sale_bill_item', @s3186_name = 'trace_codes';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'JSON DEFAULT NULL COMMENT ''追溯码列表'' AFTER item_discount'), 'SELECT ''跳过 t_sale_bill_item.trace_codes'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

SELECT column_name FROM information_schema.COLUMNS
WHERE table_schema = DATABASE() AND table_name = 't_sale_bill_item'
  AND column_name IN ('sku_spec','unit','barcode','item_remark','item_discount','trace_codes')
ORDER BY ordinal_position;

-- 编号: 129, 描述: 销售单明细合规补列（规格/单位/条码/行备注/行折扣/追溯码快照）
-- 说明: 与"单据合规调研与差距分析"报告 3.1 差距表对应；使用 092 存储过程幂等补列。
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
