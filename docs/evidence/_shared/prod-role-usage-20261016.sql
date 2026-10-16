-- 生产只读：角色 × 账号使用情况（决定"旧词表角色"如何处置）+ 相关表结构探测
SELECT '=== 1. 与 role/user 相关的表 ===';
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() AND (table_name LIKE '%role%' OR table_name LIKE '%user%')
ORDER BY table_name;

SELECT '=== 2. t_sys_user 列 ===';
SELECT column_name, column_type FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 't_sys_user'
ORDER BY ordinal_position;

SELECT '=== 3. 用户-角色绑定表列（若存在） ===';
SELECT table_name, column_name, column_type FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name IN ('t_sys_user_role','t_user_role','t_sys_role_user')
ORDER BY table_name, ordinal_position;
