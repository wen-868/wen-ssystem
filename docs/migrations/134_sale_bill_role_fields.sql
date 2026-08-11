USE liquor_inventory;

CALL add_column_if_not_exists('t_sale_bill', 'operator_name', "VARCHAR(64) DEFAULT NULL COMMENT '制单人快照' AFTER operator_id");
CALL add_column_if_not_exists('t_sale_bill', 'auditor_id', "BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人ID' AFTER operator_name");
CALL add_column_if_not_exists('t_sale_bill', 'auditor_name', "VARCHAR(64) DEFAULT NULL COMMENT '审核人快照' AFTER auditor_id");
CALL add_column_if_not_exists('t_sale_bill', 'salesman_id', "BIGINT UNSIGNED DEFAULT NULL COMMENT '业务员ID' AFTER auditor_name");
CALL add_column_if_not_exists('t_sale_bill', 'salesman_name', "VARCHAR(64) DEFAULT NULL COMMENT '业务员快照' AFTER salesman_id");

SELECT column_name FROM information_schema.COLUMNS
WHERE table_schema = DATABASE() AND table_name = 't_sale_bill'
  AND column_name IN ('operator_name','auditor_id','auditor_name','salesman_id','salesman_name')
ORDER BY ordinal_position;

-- 编号: 134, 描述: 销售单制单人/审核人/业务员字段（按账号角色默认填充，可手动选择）
-- 说明: 文件头不写注释；使用 092 存储过程幂等补列。
