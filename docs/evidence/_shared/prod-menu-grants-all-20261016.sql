-- 生产只读：**全量**菜单码 → 授予角色（一行一菜单，紧凑格式）——补齐共用底稿里缺的"角色×菜单"矩阵
-- 用途：批次判"页面可见的在用角色"时不再需要自跑生产（S3-229 报备的底稿缺口）
SELECT '=== 菜单码 → 授予角色（全量，一行一菜单） ===';
SELECT m.menu_code, m.menu_type, GROUP_CONCAT(r.role_code ORDER BY r.role_code) AS roles
FROM t_sys_menu m
LEFT JOIN t_sys_role_menu rm ON rm.menu_id = m.id AND rm.tenant_id = 'default'
LEFT JOIN t_sys_role r ON r.id = rm.role_id
WHERE m.tenant_id = 'default'
GROUP BY m.menu_code, m.menu_type
ORDER BY m.menu_code;
