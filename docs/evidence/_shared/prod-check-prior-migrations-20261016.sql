-- 生产只读：抽查前几个"账本称已执行"的迁移痕迹（判断是否存在系统性漏跑）
SELECT '=== 202（销售单取消来源列） ===';
SELECT column_name, column_type FROM information_schema.columns
WHERE table_schema=DATABASE() AND table_name='t_sale_bill' AND column_name IN ('void_source','void_reason','voided_at');

SELECT '=== 203（sale:cancel 菜单） ===';
SELECT menu_code, menu_type, GROUP_CONCAT(tenant_id ORDER BY tenant_id) AS tenants
FROM t_sys_menu WHERE menu_code='sale:cancel' GROUP BY menu_code, menu_type;

SELECT '=== 201（账号口径：admin 是否为唯一对外账号——查用户名与状态，不取口令列） ===';
SELECT username, status, tenant_id FROM t_sys_user WHERE username IN ('admin','store_manager','store_operator','demo') ORDER BY username;

SELECT '=== 197（演示租户隔离：演示账号所属租户） ===';
SELECT username, tenant_id FROM t_sys_user WHERE username='demo';
