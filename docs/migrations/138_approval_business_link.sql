-- 编号: 138, 描述: 业务单据关联审批实例（全局审批接入）, 创建人: 系统, 日期: 2026-08-14
CALL add_column_if_not_exists('purchase_order', 'approval_instance_no', "VARCHAR(64) DEFAULT NULL COMMENT '关联审批实例号' AFTER order_status");
CALL add_column_if_not_exists('sale_return', 'approval_instance_no', "VARCHAR(64) DEFAULT NULL COMMENT '关联审批实例号' AFTER return_status");
