ALTER TABLE t_tenant_admin DROP FOREIGN KEY t_tenant_admin_ibfk_1;
ALTER TABLE t_tenant_admin MODIFY COLUMN `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID（UUID，对齐 t_tenant.id）';
ALTER TABLE t_tenant_admin MODIFY COLUMN `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID（关联 t_sys_user.id）';
-- 编号: 169, 描述: 修正 t_tenant_admin 租户/用户 ID 列类型。
-- 该表 tenant_id 原为 int 且外键指向不存在的 tenant 表，user_id 原为 int；
-- 而审核流程(tenant-register.service approveTenantApplication)写入的租户 ID 是
-- randomUUID() 字符串、用户 ID 是 t_sys_user 的 int unsigned 自增值。
-- 生产实证：审核事务在此表 INSERT 时类型不匹配，叠加 t_tenant 缺 name 列、
-- t_tenant.status 传 'ACTIVE' 字符串三个 bug，导致平台总台"审核通过"自上线
-- 以来全部 500 失败（8 条注册申请全部滞留 PENDING 的根因）。
-- 表当前为空(0 行)，无数据迁移风险。DROP FOREIGN KEY 重复执行报 1091 由
-- safeExec 记录跳过，不阻断启动；MODIFY 为幂等操作。
-- 创建人: 凌舟, 日期: 2026-09-08
