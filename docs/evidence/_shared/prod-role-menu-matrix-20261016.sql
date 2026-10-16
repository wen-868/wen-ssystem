-- 生产只读：角色 × 菜单码矩阵 + "菜单是否授予任何角色"（凌舟 2026-10-16）
-- 用途：回答 B/W 类接入的阻塞问题——"页面可见角色"到底是谁，以及是否存在"授予了角色但角色不持对应写码"的页面。
SELECT '=== 1. 角色 × 菜单码（default 租户） ===';
SELECT r.role_code, m.menu_code
FROM t_sys_role_menu rm
JOIN t_sys_role r ON r.id = rm.role_id
JOIN t_sys_menu m ON m.id = rm.menu_id
WHERE rm.tenant_id = 'default'
ORDER BY m.menu_code, r.role_code;

SELECT '=== 2. 菜单 × 授予角色数（0 = 未授予任何角色） ===';
SELECT m.menu_code, m.menu_type, COUNT(rm.role_id) AS granted_roles
FROM t_sys_menu m
LEFT JOIN t_sys_role_menu rm ON rm.menu_id = m.id AND rm.tenant_id = 'default'
WHERE m.tenant_id = 'default'
GROUP BY m.menu_code, m.menu_type
ORDER BY granted_roles ASC, m.menu_code ASC;
