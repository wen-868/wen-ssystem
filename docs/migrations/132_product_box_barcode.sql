USE liquor_inventory;

-- S3-186：原 CALL add_column_if_not_exists('t_product_sku', 'box_barcode', "VARCHAR(128) DEFAULT NULL COMMENT '组合单位条码（箱码，一品多码）' AFTER barcode");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_product_sku', @s3186_name = 'box_barcode';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(128) DEFAULT NULL COMMENT ''组合单位条码（箱码，一品多码）'' AFTER barcode'), 'SELECT ''跳过 t_product_sku.box_barcode'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;

SELECT column_name FROM information_schema.COLUMNS
WHERE table_schema = DATABASE() AND table_name = 't_product_sku'
  AND column_name IN ('box_barcode')
ORDER BY ordinal_position;

-- 编号: 132, 描述: SKU 组合单位条码（箱码），单位价格表按瓶/箱拆分后每单位可独立维护条码
-- 说明: 使用 092 存储过程幂等补列；文件头不写注释（自动迁移按分号拆分，注释污染首条语句会被丢弃）。
