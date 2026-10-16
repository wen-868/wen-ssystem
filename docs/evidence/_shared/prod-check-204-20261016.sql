-- 生产只读：迁移 204（D1 授权 + 14 新码菜单）是否真的落到生产？
SELECT '=== 1. 店长权限串（是否含 goods:create / goods:edit） ===';
SELECT role_code, permissions,
       JSON_CONTAINS(permissions, JSON_QUOTE('goods:create')) AS has_create,
       JSON_CONTAINS(permissions, JSON_QUOTE('goods:edit'))   AS has_edit,
       JSON_LENGTH(permissions) AS perm_len
FROM t_sys_role WHERE tenant_id='default' AND role_code='STORE_MANAGER';

SELECT '=== 2. 204 应插入的 14 个菜单码是否在库（按 tenant 分组计数） ===';
SELECT tenant_id, COUNT(*) AS cnt
FROM t_sys_menu
WHERE menu_code IN ('system:alert:list','system:alert:config','system:alert:test',
                    'system:archive:execute','system:notification:list','system:notification:send',
                    'system:notification:template','system:notification:config','system:notification:test',
                    'system:push:test','system:sms-template:list','system:sms-template:edit',
                    'system:sms-template:test','system:migration:run')
GROUP BY tenant_id;

SELECT '=== 3. 生产最高迁移编号痕迹（若存在账本表） ===';
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() AND (table_name LIKE '%migration%' OR table_name LIKE '%schema_version%');
