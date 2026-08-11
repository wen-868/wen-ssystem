USE liquor_inventory;

CALL add_column_if_not_exists('t_sale_bill_item', 'sku_spec', "VARCHAR(128) DEFAULT NULL COMMENT '规格快照' AFTER sku_name");
CALL add_column_if_not_exists('t_sale_bill_item', 'unit', "VARCHAR(16) NOT NULL DEFAULT '瓶' COMMENT '单位快照' AFTER sku_spec");
CALL add_column_if_not_exists('t_sale_bill_item', 'barcode', "VARCHAR(128) DEFAULT NULL COMMENT '条码快照' AFTER unit");
CALL add_column_if_not_exists('t_sale_bill_item', 'item_remark', "VARCHAR(255) DEFAULT NULL COMMENT '行备注' AFTER subtotal_amount");
CALL add_column_if_not_exists('t_sale_bill_item', 'item_discount', "DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '行折扣率%' AFTER item_remark");
CALL add_column_if_not_exists('t_sale_bill_item', 'trace_codes', "JSON DEFAULT NULL COMMENT '追溯码列表' AFTER item_discount");

SELECT column_name FROM information_schema.COLUMNS
WHERE table_schema = DATABASE() AND table_name = 't_sale_bill_item'
  AND column_name IN ('sku_spec','unit','barcode','item_remark','item_discount','trace_codes')
ORDER BY ordinal_position;

-- 编号: 129, 描述: 销售单明细合规补列（规格/单位/条码/行备注/行折扣/追溯码快照）
-- 说明: 与"单据合规调研与差距分析"报告 3.1 差距表对应；使用 092 存储过程幂等补列。
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
