-- 编号: 137, 描述: 员工表增加部门/岗位字段（组织架构一体化）, 创建人: 系统, 日期: 2026-08-13
CALL add_column_if_not_exists('sys_user', 'department_id', "BIGINT DEFAULT NULL COMMENT '所属部门ID' AFTER store_id");
CALL add_column_if_not_exists('sys_user', 'position_id', "BIGINT DEFAULT NULL COMMENT '所属岗位ID' AFTER department_id");
