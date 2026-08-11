-- 编号: 128, 描述: 补全系统角色 + 演示账号角色绑定（幂等，可重复执行）
-- 背景: 079_权限矩阵.sql 的角色重建在生产库未生效，t_sys_role/t_sys_user_role 为空，
--       导致 admin/store_manager/store_operator 均无角色（token roles=[]），
--       权限敏感接口（价格保护、菜单权限）被拒绝。
-- 方案: 合并 001/079 角色清单，NOT EXISTS 幂等插入；绑定默认租户三个核心账号。

USE liquor_inventory;

-- 1) 补角色（不存在才插入，status 用字符串 ACTIVE 与表默认一致）
INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'SUPER_ADMIN', '超级管理员', '拥有系统全部权限，可管理所有租户和门店', 'ALL', '["*"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'SUPER_ADMIN' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'OPERATION_ADMIN', '运营管理员', '平台运营管理（001 角色，代码 ADMIN_ROLES 引用）', 'ALL', '["*"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'OPERATION_ADMIN' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'STORE_MANAGER', '门店店长', '管理本门店的销售、库存、客户、员工', 'STORE', '["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'STORE_MANAGER' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'STORE_OPERATOR', '门店操作员', '门店日常开单与库存查询', 'STORE', '["sale:create","sale:view","inventory:view","dashboard:view"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'STORE_OPERATOR' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'SALES_STAFF', '销售员', '负责线下销售开单、客户管理、客户拜访', 'SELF', '["sale:create","sale:view","customer:view","customer:visit","dashboard:view"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'SALES_STAFF' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'PURCHASE_STAFF', '采购员', '负责采购订单、供应商管理、采购入库', 'SELF', '["purchase:*","supplier:*","inventory:inbound","report:purchase"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'PURCHASE_STAFF' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'WAREHOUSE_STAFF', '仓管员', '负责库存管理、出入库、盘点、调拨', 'STORE', '["inventory:*","trace:*","transfer:*","stock-check:*"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'WAREHOUSE_STAFF' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'FINANCE_STAFF', '财务', '负责收款、付款、对账、财务报表', 'ALL', '["finance:*","report:*","customer:statement","supplier:statement","dashboard:view"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'FINANCE_STAFF' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'CUSTOMER_SERVICE', '客服', '负责客户服务、售后处理、小程序订单', 'STORE', '["customer:view","aftersale:*","miniapp:*","notification:view"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'CUSTOMER_SERVICE' AND tenant_id = 'default');

INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)
SELECT 'READONLY', '只读观察员', '仅查看权限，不可编辑任何数据', 'ALL', '["*:view"]', 'ACTIVE', 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = 'READONLY' AND tenant_id = 'default');

-- 2) 绑定核心账号角色（NOT EXISTS 幂等，防止 t_sys_user_role 无唯一键导致重复）
INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)
SELECT u.id, r.id, 'default'
FROM t_sys_user u JOIN t_sys_role r ON r.role_code = 'SUPER_ADMIN' AND r.tenant_id = 'default'
WHERE u.username = 'admin' AND u.tenant_id = 'default'
  AND NOT EXISTS (SELECT 1 FROM t_sys_user_role ur WHERE ur.user_id = u.id AND ur.role_id = r.id AND ur.tenant_id = 'default');

INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)
SELECT u.id, r.id, 'default'
FROM t_sys_user u JOIN t_sys_role r ON r.role_code = 'STORE_MANAGER' AND r.tenant_id = 'default'
WHERE u.username = 'store_manager' AND u.tenant_id = 'default'
  AND NOT EXISTS (SELECT 1 FROM t_sys_user_role ur WHERE ur.user_id = u.id AND ur.role_id = r.id AND ur.tenant_id = 'default');

INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)
SELECT u.id, r.id, 'default'
FROM t_sys_user u JOIN t_sys_role r ON r.role_code = 'STORE_OPERATOR' AND r.tenant_id = 'default'
WHERE u.username = 'store_operator' AND u.tenant_id = 'default'
  AND NOT EXISTS (SELECT 1 FROM t_sys_user_role ur WHERE ur.user_id = u.id AND ur.role_id = r.id AND ur.tenant_id = 'default');

-- 3) 校验（应输出 10 行角色、3 行绑定）
SELECT id, role_code, role_name, status, tenant_id FROM t_sys_role WHERE tenant_id = 'default' ORDER BY id;
SELECT ur.user_id, u.username, ur.role_id, r.role_code
FROM t_sys_user_role ur
JOIN t_sys_user u ON u.id = ur.user_id
JOIN t_sys_role r ON r.id = ur.role_id
WHERE ur.tenant_id = 'default' ORDER BY u.username;

