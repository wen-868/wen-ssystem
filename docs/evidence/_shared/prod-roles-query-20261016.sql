-- 生产只读核对底稿（R-PROD-READ，2026-10-16 凌舟）
-- 用法（在服务器上）：bash /tmp/s3136-q.sh /tmp/prod-roles-query.sql
-- 安全：只读 SELECT；由 /tmp/s3136-q.sh 从生产 .env 取连接串，口令不回显、不落盘

SELECT '=== 1. 商家侧角色 × 权限码（tenant=default） ===';
SELECT role_code, role_name, permissions
FROM t_sys_role
WHERE tenant_id = 'default'
ORDER BY role_code;

SELECT '=== 2. 平台侧角色 × module_code ===';
SELECT r.role_code, p.module_code, p.can_menu, p.can_page_btn
FROM t_platform_role r
LEFT JOIN t_platform_role_permission p ON p.role_id = r.id
ORDER BY r.role_code, p.module_code;

SELECT '=== 3. 菜单/权限相关表的列清单（用于后续核对，information_schema 只读） ===';
SELECT table_name, column_name, column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('t_sys_menu', 't_sys_role_menu', 't_platform_role', 't_platform_role_permission')
ORDER BY table_name, ordinal_position;
