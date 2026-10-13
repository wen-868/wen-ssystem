-- 编号: 137, 描述: 员工表增加部门/岗位字段（组织架构一体化）, 创建人: 系统, 日期: 2026-08-13
-- S3-190（原收口第 53 项）：本文件 2 条补列语句原先传的表名缺 t_ 前缀（sys_user）⇒ 恒 ER_NO_SUCH_TABLE，从未生效。
--   本次**只补表名前缀**（sys_user ⇒ t_sys_user）：列定义/守卫条件/动态 SQL 一字未改；
--   下方每条 "原 CALL" 注释保留的是 S3-186 改前原文（含缺前缀的表名）。
-- S3-186：原 CALL add_column_if_not_exists('sys_user', 'department_id', "BIGINT DEFAULT NULL COMMENT '所属部门ID' AFTER store_id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_user', @s3186_name = 'department_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'BIGINT DEFAULT NULL COMMENT ''所属部门ID'' AFTER store_id'), 'SELECT ''跳过 t_sys_user.department_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
-- S3-186：原 CALL add_column_if_not_exists('sys_user', 'position_id', "BIGINT DEFAULT NULL COMMENT '所属岗位ID' AFTER department_id");（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_sys_user', @s3186_name = 'position_id';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'BIGINT DEFAULT NULL COMMENT ''所属岗位ID'' AFTER department_id'), 'SELECT ''跳过 t_sys_user.position_id'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
