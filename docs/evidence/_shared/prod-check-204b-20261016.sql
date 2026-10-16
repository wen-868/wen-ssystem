-- 生产只读：按**迁移 204 实际写入的 14 个码名**复核（2026-10-16 凌舟）
SELECT '=== 14 个新码在 t_sys_menu 的落地（按 tenant 计数，期望每租户 14） ===';
SELECT tenant_id, COUNT(*) AS cnt
FROM t_sys_menu
WHERE menu_code IN (
  'system:alert:handle','system:alert:rule-edit','system:alert:check','system:archive:execute',
  'system:notification:read','system:notification:read-all','system:notification:send',
  'system:notification:delete','system:notification:batch-delete','system:push:test',
  'system:sms-template:create','system:sms-template:edit','system:sms-template:delete',
  'system:migration:run')
GROUP BY tenant_id;

SELECT '=== 逐码 × 租户 明细（防"少一个码"被计数掩盖） ===';
SELECT menu_code, GROUP_CONCAT(tenant_id ORDER BY tenant_id) AS tenants
FROM t_sys_menu
WHERE menu_code LIKE 'system:alert:%' OR menu_code LIKE 'system:archive:%'
   OR menu_code LIKE 'system:notification:%' OR menu_code LIKE 'system:push:%'
   OR menu_code LIKE 'system:sms-template:%' OR menu_code = 'system:migration:run'
GROUP BY menu_code
ORDER BY menu_code;

SELECT '=== 重复行检查（期望 0） ===';
SELECT menu_code, tenant_id, COUNT(*) AS c
FROM t_sys_menu
WHERE menu_code LIKE 'system:alert:%' OR menu_code LIKE 'system:archive:%'
   OR menu_code LIKE 'system:notification:%' OR menu_code LIKE 'system:push:%'
   OR menu_code LIKE 'system:sms-template:%' OR menu_code = 'system:migration:run'
GROUP BY menu_code, tenant_id
HAVING COUNT(*) > 1;
