-- ============================================
-- 迁移编号：205
-- 单号：S3-235（收口总清单第 72 项：权限种子落库）
-- 描述：把生产底稿 §一（12 个商家角色 × 权限码）落成「新库/灾备库可用」的幂等、非破坏种子
-- 执行方：阿坚（后端 / 权限）｜依据卡：docs/tasks/inbox/ACTIVE-S3-235.md｜日期：2026-10-16
-- ============================================
--
-- 一、语义（硬要求，逐条可复跑核对）
--   ① 角色行缺失 ⇒ 按底稿插入；
--   ② 行存在但 permissions 为 NULL / 非法 JSON / JSON null / 空数组 ⇒ 补写底稿权限串；
--   ③ 行存在且 permissions 非空 ⇒ 本文件一条写语句都不命中（不覆盖线上调整、不删任何码）；
--   ④ 只作用于 tenant_id='default'（底稿 §一 的口径）；其它租户的角色派生由 197/198 负责，不在本单范围。
--
-- 二、数据源与生成方式
--   底稿：docs/evidence/_shared/prod-roles-20261016.txt §一（12 行，制表符三列）
--   底稿 sha256：8e7673b7b2a875909314a9041ef4beb8a8914e52c1323f3a77bbb98eda2d6ca8
--   生成器：node docs/evidence/S3-235/tools/gen-role-seed.mjs（--check 可证明本文件逐字节等于重新生成的结果）
--   description / data_scope：10 个角色取 128_fix_roles_binding.sql，SALESMAN / STORE_ADMIN 取 099_seed_data.sql:37/38（不臆造）
--
-- 三、怎么跑（两种通道）
--   ① 部署/启动链（本项目后端启动时按文件名顺序执行 docs/migrations/*.sql）——**注意写闸门**：
--      默认 MIGRATION_WRITE_GATE=block 会跳过本文件全部 INSERT/UPDATE ⇒ 新库/灾备库仍无权限。
--      灾备/新库重建必须显式放行：MIGRATION_WRITE_GATE=allow（另见本单回传卡「风险与自我报备」）。
--   ② 单独补跑：node scripts/run-migration.mjs docs/migrations/205_角色权限种子.sql（该脚本无写闸门）
--
-- 四、幂等证据形态：连跑两遍，第二遍全部语句 affectedRows=0 / changedRows=0（见 docs/evidence/S3-235/README.md）
--

-- CUSTOMER_SERVICE（客服）· 底稿权限码 4 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'CUSTOMER_SERVICE', '客服', '负责客户服务、售后处理、小程序订单', 'STORE', CAST('["customer:view","aftersale:*","miniapp:*","notification:view"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'CUSTOMER_SERVICE' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["customer:view","aftersale:*","miniapp:*","notification:view"]' AS JSON)
WHERE role_code = 'CUSTOMER_SERVICE' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- FINANCE_STAFF（财务）· 底稿权限码 5 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'FINANCE_STAFF', '财务', '负责收款、付款、对账、财务报表', 'ALL', CAST('["finance:*","report:*","customer:statement","supplier:statement","dashboard:view"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'FINANCE_STAFF' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["finance:*","report:*","customer:statement","supplier:statement","dashboard:view"]' AS JSON)
WHERE role_code = 'FINANCE_STAFF' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- OPERATION_ADMIN（运营管理员）· 底稿权限码 1 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'OPERATION_ADMIN', '运营管理员', '平台运营管理（001 角色，代码 ADMIN_ROLES 引用）', 'ALL', CAST('["*"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'OPERATION_ADMIN' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["*"]' AS JSON)
WHERE role_code = 'OPERATION_ADMIN' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- PURCHASE_STAFF（采购员）· 底稿权限码 4 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'PURCHASE_STAFF', '采购员', '负责采购订单、供应商管理、采购入库', 'SELF', CAST('["purchase:*","supplier:*","inventory:inbound","report:purchase"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'PURCHASE_STAFF' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["purchase:*","supplier:*","inventory:inbound","report:purchase"]' AS JSON)
WHERE role_code = 'PURCHASE_STAFF' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- READONLY（只读观察员）· 底稿权限码 1 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'READONLY', '只读观察员', '仅查看权限，不可编辑任何数据', 'ALL', CAST('["*:view"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'READONLY' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["*:view"]' AS JSON)
WHERE role_code = 'READONLY' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- SALES_STAFF（销售员）· 底稿权限码 5 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'SALES_STAFF', '销售员', '负责线下销售开单、客户管理、客户拜访', 'SELF', CAST('["sale:create","sale:view","customer:view","customer:visit","dashboard:view"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'SALES_STAFF' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["sale:create","sale:view","customer:view","customer:visit","dashboard:view"]' AS JSON)
WHERE role_code = 'SALES_STAFF' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- SALESMAN（销售员）· 底稿权限码 5 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'SALESMAN', '销售员', '销售相关权限，可管理订单和客户（旧码体系角色）', 'SELF', CAST('["product:read","order:read","order:write","customer:read","customer:write"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'SALESMAN' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["product:read","order:read","order:write","customer:read","customer:write"]' AS JSON)
WHERE role_code = 'SALESMAN' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- STORE_ADMIN（门店管理员）· 底稿权限码 5 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'STORE_ADMIN', '门店管理员', '门店管理权限，可查看商品、管理订单和库存（旧码体系角色）', 'STORE', CAST('["product:read","order:read","order:write","inventory:read","inventory:write"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'STORE_ADMIN' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["product:read","order:read","order:write","inventory:read","inventory:write"]' AS JSON)
WHERE role_code = 'STORE_ADMIN' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- STORE_MANAGER（门店店长）· 底稿权限码 9 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'STORE_MANAGER', '门店店长', '管理本门店的销售、库存、客户、员工', 'STORE', CAST('["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*","finance:payment","goods:price","finance:daily-settle"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'STORE_MANAGER' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*","finance:payment","goods:price","finance:daily-settle"]' AS JSON)
WHERE role_code = 'STORE_MANAGER' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- STORE_OPERATOR（门店操作员）· 底稿权限码 6 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'STORE_OPERATOR', '门店操作员', '门店日常开单与库存查询', 'STORE', CAST('["sale:create","sale:view","inventory:view","dashboard:view","sale:return","finance:daily-settle"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'STORE_OPERATOR' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["sale:create","sale:view","inventory:view","dashboard:view","sale:return","finance:daily-settle"]' AS JSON)
WHERE role_code = 'STORE_OPERATOR' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- SUPER_ADMIN（超级管理员）· 底稿权限码 1 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'SUPER_ADMIN', '超级管理员', '拥有系统全部权限，可管理所有租户和门店', 'ALL', CAST('["*"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'SUPER_ADMIN' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["*"]' AS JSON)
WHERE role_code = 'SUPER_ADMIN' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- WAREHOUSE_STAFF（仓管员）· 底稿权限码 4 个
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'WAREHOUSE_STAFF', '仓管员', '负责库存管理、出入库、盘点、调拨', 'STORE', CAST('["inventory:*","trace:*","transfer:*","stock-check:*"]' AS JSON), 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'WAREHOUSE_STAFF' AND tenant_id = 'default');

UPDATE t_sys_role
SET permissions = CAST('["inventory:*","trace:*","transfer:*","stock-check:*"]' AS JSON)
WHERE role_code = 'WAREHOUSE_STAFF' AND tenant_id = 'default'
  AND (permissions IS NULL
       OR JSON_VALID(permissions) = 0
       OR JSON_TYPE(permissions) = 'NULL'
       OR JSON_LENGTH(permissions) = 0);

-- ============================================
-- 五、跑完自报家门：12 个底稿角色里 permissions 非空的行数（期望 12）+ 空/缺失清单
-- ============================================
SELECT CONCAT(
  '205 核对：底稿 12 角色 permissions 非空 = ',
  (SELECT COUNT(*) FROM t_sys_role WHERE tenant_id = 'default'
     AND role_code IN ('CUSTOMER_SERVICE', 'FINANCE_STAFF', 'OPERATION_ADMIN', 'PURCHASE_STAFF', 'READONLY', 'SALES_STAFF', 'SALESMAN', 'STORE_ADMIN', 'STORE_MANAGER', 'STORE_OPERATOR', 'SUPER_ADMIN', 'WAREHOUSE_STAFF')
     AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1
     AND JSON_TYPE(permissions) <> 'NULL' AND JSON_LENGTH(permissions) > 0),
  ' / 12；缺失或空权限的角色 = ', IFNULL((
    SELECT GROUP_CONCAT(role_code ORDER BY role_code) FROM t_sys_role WHERE tenant_id = 'default'
      AND role_code IN ('CUSTOMER_SERVICE', 'FINANCE_STAFF', 'OPERATION_ADMIN', 'PURCHASE_STAFF', 'READONLY', 'SALES_STAFF', 'SALESMAN', 'STORE_ADMIN', 'STORE_MANAGER', 'STORE_OPERATOR', 'SUPER_ADMIN', 'WAREHOUSE_STAFF')
      AND (permissions IS NULL OR JSON_VALID(permissions) = 0 OR JSON_TYPE(permissions) = 'NULL' OR JSON_LENGTH(permissions) = 0)
  ), '无')
) AS result;
