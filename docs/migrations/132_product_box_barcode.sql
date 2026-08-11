USE liquor_inventory;

CALL add_column_if_not_exists('t_product_sku', 'box_barcode', "VARCHAR(128) DEFAULT NULL COMMENT '组合单位条码（箱码，一品多码）' AFTER barcode");

SELECT column_name FROM information_schema.COLUMNS
WHERE table_schema = DATABASE() AND table_name = 't_product_sku'
  AND column_name IN ('box_barcode')
ORDER BY ordinal_position;

-- 编号: 132, 描述: SKU 组合单位条码（箱码），单位价格表按瓶/箱拆分后每单位可独立维护条码
-- 说明: 使用 092 存储过程幂等补列；文件头不写注释（自动迁移按分号拆分，注释污染首条语句会被丢弃）。
