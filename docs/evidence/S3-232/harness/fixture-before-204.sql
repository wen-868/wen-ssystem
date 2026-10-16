-- S3-232 夹具（204 迁移**执行前**的库内状态）—— 2026-10-16 阿坚
--
-- 为什么需要夹具：本机夹具库（MySQL 8.0.28 @127.0.0.1:3399, liquor_inventory）由后端空库启动
-- 自动建成 312 张表，但**角色权限串与菜单行是空的**（实测：6 个角色 permissions 全为 NULL、
-- t_sys_menu 0 行）——因为 079/128 的角色/菜单补全语句在"001 已先建同名角色行"的库上被
-- NOT EXISTS 守卫整条跳过（这是空库重建链的既有形态，属卡外观察，见回执 §六⑤）。
-- 故本文件按**生产实值**把 204 需要的两处前置状态显式摆好，判据来源：
--   · 角色权限串 = docs/evidence/_shared/prod-roles-20261016.txt 第一节逐字转写（STORE_MANAGER 行）
--   · 菜单父行   = docs/migrations/079_权限矩阵.sql 第 100 行（system CATALOG），
--                  另加一个 demo 租户克隆行以验证"父行按 menu_code 逐租户定位"的多租户行为
-- 本文件**不参与**任何验收判据，只负责把夹具库摆成"生产等价起点"。

UPDATE t_sys_role
SET permissions = CAST('["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*","finance:payment","goods:price","finance:daily-settle"]' AS JSON),
    data_scope = 'STORE'
WHERE role_code = 'STORE_MANAGER' AND tenant_id = 'default';

-- ⚠️ 本夹具**不建** demo 租户的店长克隆行：本夹具库上 t_sys_role 的唯一键是全局的
--    `uk_sys_role_code (role_code)`（实测 1062），跨租户同 role_code 插不进去；
--    多租户行为改由**菜单侧**验证（下面的 demo system 父行 ⇒ 14 码应同时落到 2 个租户）。

-- demo 租户的 system 一级目录行（与 079 的 system CATALOG 同形）
INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT NULL, 'system', '系统管理', 'CATALOG', '/system', NULL, 'setting', 11, 1, 1, 'demo'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_menu WHERE menu_code = 'system' AND tenant_id = 'demo');

-- default 租户的 system 一级目录行（079 第 100 行的同形行）
INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status, tenant_id)
SELECT NULL, 'system', '系统管理', 'CATALOG', '/system', NULL, 'setting', 11, 1, 1, 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_menu WHERE menu_code = 'system' AND tenant_id = 'default');

-- 夹具自证：三处前置必须齐备，缺一即本夹具不成立（读数由 harness 打印）
SELECT CONCAT('夹具状态：STORE_MANAGER 行数 ', (SELECT COUNT(*) FROM t_sys_role WHERE role_code = 'STORE_MANAGER'),
  '（其中持 goods:create 的 ', (SELECT COUNT(*) FROM t_sys_role WHERE role_code = 'STORE_MANAGER' AND JSON_VALID(permissions) = 1 AND JSON_CONTAINS(permissions, JSON_QUOTE('goods:create'))),
  ' 行）；system CATALOG 行数 ', (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code = 'system' AND menu_type = 'CATALOG'),
  '；system 域既有菜单码行数 ', (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code LIKE 'system%')) AS result;
