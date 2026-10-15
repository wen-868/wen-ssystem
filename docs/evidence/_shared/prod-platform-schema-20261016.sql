-- 平台侧表结构探测（只读）——上一条查询因 r.role_code 列名不符中断，先取列清单
SELECT table_name, column_name, column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('t_platform_admin', 't_platform_role', 't_platform_role_permission', 't_sys_menu', 't_sys_role_menu')
ORDER BY table_name, ordinal_position;

SELECT '=== 平台侧角色行（列名待定，先看全表） ===';
SELECT * FROM t_platform_role LIMIT 20;
