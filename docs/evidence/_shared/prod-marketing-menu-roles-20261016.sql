-- 生产只读（聚焦营销域，用于解 B/W 类阻塞）：营销菜单 → 可见角色；持营销码的角色；未授予任何角色的菜单
SELECT '=== 1. 营销域菜单 → 授予角色（一行一菜单） ===';
SELECT m.menu_code, GROUP_CONCAT(r.role_code ORDER BY r.role_code) AS roles
FROM t_sys_menu m
JOIN t_sys_role_menu rm ON rm.menu_id = m.id AND rm.tenant_id = 'default'
JOIN t_sys_role r ON r.id = rm.role_id
WHERE m.tenant_id = 'default' AND m.menu_code LIKE 'marketing%'
GROUP BY m.menu_code
ORDER BY m.menu_code;

SELECT '=== 2. 持营销写码或通配的角色 ===';
SELECT role_code, permissions FROM t_sys_role
WHERE tenant_id = 'default'
  AND (permissions LIKE '%marketing:%' OR permissions LIKE '%"*"%')
ORDER BY role_code;

SELECT '=== 3. 未授予任何角色的菜单（应接线时需先看这是否孤岛页） ===';
SELECT m.menu_code, m.menu_type
FROM t_sys_menu m
LEFT JOIN t_sys_role_menu rm ON rm.menu_id = m.id AND rm.tenant_id = 'default'
WHERE m.tenant_id = 'default'
GROUP BY m.menu_code, m.menu_type
HAVING COUNT(rm.role_id) = 0
ORDER BY m.menu_code;

SELECT '=== 4. 菜单总数与已授予数（对账） ===';
SELECT COUNT(*) AS all_menus,
       SUM(CASE WHEN granted > 0 THEN 1 ELSE 0 END) AS granted_menus
FROM (SELECT m.id, COUNT(rm.role_id) AS granted
      FROM t_sys_menu m LEFT JOIN t_sys_role_menu rm ON rm.menu_id = m.id AND rm.tenant_id='default'
      WHERE m.tenant_id='default' GROUP BY m.id) t;
