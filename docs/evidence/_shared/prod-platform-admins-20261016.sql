-- 平台侧管理员（只读；**不取 password_hash / mfa_secret**）+ 菜单计数
SELECT '=== 平台管理员（不含任何密钥列） ===';
SELECT id, username, real_name, role, status, last_login_at FROM t_platform_admin ORDER BY id;

SELECT '=== 平台角色表行数 ===';
SELECT COUNT(*) AS platform_role_rows FROM t_platform_role;

SELECT '=== 平台角色权限表行数 ===';
SELECT COUNT(*) AS platform_role_perm_rows FROM t_platform_role_permission;

SELECT '=== 商家菜单：类型分布（default 租户） ===';
SELECT menu_type, COUNT(*) AS cnt FROM t_sys_menu WHERE tenant_id = 'default' GROUP BY menu_type ORDER BY menu_type;
