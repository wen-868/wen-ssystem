-- 8角色权限矩阵迁移脚本
-- 执行时间：2026-06-26
-- 负责人：阿坚
-- 说明：新建菜单权限表、数据权限表、字段权限表，并初始化8角色完整权限矩阵

USE liquor_inventory;

-- ============================================================
-- 第1步：删除旧表（如果存在）
-- ============================================================
DROP TABLE IF EXISTS sys_field_permission;
DROP TABLE IF EXISTS sys_data_permission;
DROP TABLE IF EXISTS sys_menu;

-- ============================================================
-- 第2步：新建菜单权限表
-- ============================================================
CREATE TABLE sys_menu (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '菜单ID',
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父菜单ID，NULL=顶级菜单',
  menu_code VARCHAR(64) NOT NULL COMMENT '菜单编码，如 sale:order:view',
  menu_name VARCHAR(64) NOT NULL COMMENT '菜单名称',
  menu_type VARCHAR(16) NOT NULL DEFAULT 'MENU' COMMENT '菜单类型：CATALOG(目录)/MENU(菜单)/BUTTON(按钮)',
  path VARCHAR(255) DEFAULT NULL COMMENT '前端路由路径',
  component VARCHAR(255) DEFAULT NULL COMMENT '前端组件路径',
  icon VARCHAR(64) DEFAULT NULL COMMENT '图标',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
  visible TINYINT NOT NULL DEFAULT 1 COMMENT '是否可见：1可见，0隐藏',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0禁用',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_menu_code_tenant (menu_code, tenant_id),
  KEY idx_sys_menu_parent_id (parent_id),
  KEY idx_sys_menu_sort (sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';

-- ============================================================
-- 第3步：新建数据权限表（行级数据过滤规则）
-- ============================================================
CREATE TABLE sys_data_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  role_id BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  table_name VARCHAR(64) NOT NULL COMMENT '表名',
  field_name VARCHAR(64) NOT NULL COMMENT '字段名',
  condition_type VARCHAR(16) NOT NULL COMMENT '条件类型：EQ(等于)/IN(在集合中)/LIKE(模糊)/OWN(自己的数据)',
  condition_value VARCHAR(512) DEFAULT NULL COMMENT '条件值，JSON格式',
  description VARCHAR(255) DEFAULT NULL COMMENT '规则说明',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_data_perm (role_id, table_name, field_name, tenant_id),
  KEY idx_data_perm_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据权限表';

-- ============================================================
-- 第4步：新建字段权限表（字段可见性/可编辑性）
-- ============================================================
CREATE TABLE sys_field_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  role_id BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  table_name VARCHAR(64) NOT NULL COMMENT '表名',
  field_name VARCHAR(64) NOT NULL COMMENT '字段名',
  permission_type VARCHAR(16) NOT NULL COMMENT '权限类型：VISIBLE(可见)/HIDDEN(隐藏)/READONLY(只读)/EDITABLE(可编辑)',
  description VARCHAR(255) DEFAULT NULL COMMENT '字段说明',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_field_perm (role_id, table_name, field_name, tenant_id),
  KEY idx_field_perm_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字段权限表';

-- ============================================================
-- 第5步：初始化8角色
-- ============================================================

-- 清理旧角色
DELETE FROM sys_role_permission WHERE tenant_id = 'default';
DELETE FROM sys_user_role WHERE tenant_id = 'default';
DELETE FROM sys_role WHERE tenant_id = 'default';

-- 插入8角色
INSERT INTO sys_role (id, role_code, role_name, description, data_scope, permissions, status, tenant_id) VALUES
(1, 'SUPER_ADMIN', '超级管理员', '拥有系统全部权限，可管理所有租户和门店', 'ALL', '["*"]', 'ACTIVE', 'default'),
(2, 'STORE_MANAGER', '门店店长', '管理本门店的销售、库存、客户、员工', 'STORE', '["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*"]', 'ACTIVE', 'default'),
(3, 'SALES_STAFF', '销售员', '负责线下销售开单、客户管理、客户拜访', 'SELF', '["sale:create","sale:view","customer:view","customer:visit","dashboard:view"]', 'ACTIVE', 'default'),
(4, 'PURCHASE_STAFF', '采购员', '负责采购订单、供应商管理、采购入库', 'SELF', '["purchase:*","supplier:*","inventory:inbound","report:purchase"]', 'ACTIVE', 'default'),
(5, 'WAREHOUSE_STAFF', '仓管员', '负责库存管理、出入库、盘点、调拨', 'STORE', '["inventory:*","trace:*","transfer:*","stock-check:*"]', 'ACTIVE', 'default'),
(6, 'FINANCE_STAFF', '财务', '负责收款、付款、对账、财务报表', 'ALL', '["finance:*","report:*","customer:statement","supplier:statement","dashboard:view"]', 'ACTIVE', 'default'),
(7, 'CUSTOMER_SERVICE', '客服', '负责客户服务、售后处理、小程序订单', 'STORE', '["customer:view","aftersale:*","miniapp:*","notification:view"]', 'ACTIVE', 'default'),
(8, 'READONLY', '只读观察员', '仅查看权限，不可编辑任何数据', 'ALL', '["*:view"]', 'ACTIVE', 'default');

-- ============================================================
-- 第6步：初始化菜单树
-- ============================================================

-- 一级目录
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(1,  NULL, 'dashboard',      '仪表盘',   'CATALOG', '/dashboard',      'dashboard',     1, 'default'),
(10, NULL, 'goods',          '商品管理', 'CATALOG', '/goods',          'shopping',      2, 'default'),
(20, NULL, 'sale',           '销售管理', 'CATALOG', '/sale',           'sell',          3, 'default'),
(30, NULL, 'purchase',       '采购管理', 'CATALOG', '/purchase',       'truck',         4, 'default'),
(40, NULL, 'customer',       '客户管理', 'CATALOG', '/customer',       'user',          5, 'default'),
(50, NULL, 'finance',        '财务管理', 'CATALOG', '/finance',        'dollar',        6, 'default'),
(60, NULL, 'marketing',      '营销管理', 'CATALOG', '/marketing',      'gift',          7, 'default'),
(70, NULL, 'store',          '门店管理', 'CATALOG', '/store',          'shop',          8, 'default'),
(80, NULL, 'trace',          '追溯管理', 'CATALOG', '/trace',          'scan',          9, 'default'),
(90, NULL, 'report',         '报表中心', 'CATALOG', '/report',         'chart',         10, 'default'),
(100,NULL, 'system',         '系统管理', 'CATALOG', '/system',         'setting',       11, 'default');

-- 二级菜单 - 仪表盘
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(1, 1, 'dashboard:workbench', '工作台', 'MENU', '/dashboard/workbench', NULL, 1, 'default');

-- 二级菜单 - 商品管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(10, 10, 'goods:list',      '商品列表', 'MENU', '/goods/list',      NULL, 1, 'default'),
(11, 10, 'goods:category',  '商品分类', 'MENU', '/goods/category',  NULL, 2, 'default'),
(12, 10, 'goods:price-level', '价格等级', 'MENU', '/goods/price-level', NULL, 3, 'default'),
(13, 10, 'goods:price',     '阶梯价格', 'MENU', '/goods/price',     NULL, 4, 'default'),
(14, 10, 'goods:inventory', '库存查询', 'MENU', '/goods/inventory', NULL, 5, 'default'),
(15, 10, 'goods:batch',     '库存批次', 'MENU', '/goods/batch',     NULL, 6, 'default'),
(16, 10, 'goods:ledger',    '库存流水', 'MENU', '/goods/ledger',    NULL, 7, 'default');

-- 二级菜单 - 销售管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(20, 20, 'sale:bill',       '销售开单', 'MENU', '/sale/bill',       NULL, 1, 'default'),
(21, 20, 'sale:record',     '销售记录', 'MENU', '/sale/record',     NULL, 2, 'default'),
(22, 20, 'sale:return',     '销售退货', 'MENU', '/sale/return',     NULL, 3, 'default'),
(23, 20, 'sale:miniapp',    '小程序订单', 'MENU', '/sale/miniapp',  NULL, 4, 'default'),
(24, 20, 'sale:cart',       '购物车管理', 'MENU', '/sale/cart',     NULL, 5, 'default');

-- 二级菜单 - 采购管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(30, 30, 'purchase:order',  '采购订单', 'MENU', '/purchase/order',  NULL, 1, 'default'),
(31, 30, 'purchase:inbound','采购入库', 'MENU', '/purchase/inbound',NULL, 2, 'default'),
(32, 30, 'purchase:return', '采购退货', 'MENU', '/purchase/return', NULL, 3, 'default'),
(33, 30, 'purchase:payment','采购付款', 'MENU', '/purchase/payment',NULL, 4, 'default'),
(34, 30, 'purchase:supplier','供应商管理','MENU', '/purchase/supplier',NULL, 5, 'default');

-- 二级菜单 - 客户管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(40, 40, 'customer:list',      '客户列表', 'MENU', '/customer/list',      NULL, 1, 'default'),
(41, 40, 'customer:credit',    '客户授信', 'MENU', '/customer/credit',    NULL, 2, 'default'),
(42, 40, 'customer:statement', '客户对账', 'MENU', '/customer/statement', NULL, 3, 'default'),
(43, 40, 'customer:visit',     '客户拜访', 'MENU', '/customer/visit',     NULL, 4, 'default'),
(44, 40, 'customer:payment',   '客户收款', 'MENU', '/customer/payment',   NULL, 5, 'default');

-- 二级菜单 - 财务管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(50, 50, 'finance:receipt',    '收款管理', 'MENU', '/finance/receipt',    NULL, 1, 'default'),
(51, 50, 'finance:payment',    '付款管理', 'MENU', '/finance/payment',    NULL, 2, 'default'),
(52, 50, 'finance:statement',  '对账管理', 'MENU', '/finance/statement',  NULL, 3, 'default'),
(53, 50, 'finance:receivable', '应收账款', 'MENU', '/finance/receivable', NULL, 4, 'default'),
(54, 50, 'finance:report',     '财务报表', 'MENU', '/finance/report',     NULL, 5, 'default');

-- 二级菜单 - 营销管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(60, 60, 'marketing:coupon',     '优惠券',   'MENU', '/marketing/coupon',     NULL, 1, 'default'),
(61, 60, 'marketing:full-reduction', '满减活动', 'MENU', '/marketing/full-reduction', NULL, 2, 'default'),
(62, 60, 'marketing:flash-sale', '秒杀活动', 'MENU', '/marketing/flash-sale', NULL, 3, 'default'),
(63, 60, 'marketing:group-buy',  '拼团活动', 'MENU', '/marketing/group-buy',  NULL, 4, 'default'),
(64, 60, 'marketing:points',     '积分管理', 'MENU', '/marketing/points',     NULL, 5, 'default');

-- 二级菜单 - 门店管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(70, 70, 'store:list',     '门店列表', 'MENU', '/store/list',     NULL, 1, 'default'),
(71, 70, 'store:control',  '门店管控', 'MENU', '/store/control',  NULL, 2, 'default'),
(72, 70, 'store:transfer', '调拨管理', 'MENU', '/store/transfer', NULL, 3, 'default'),
(73, 70, 'store:stock-check','盘点管理','MENU', '/store/stock-check',NULL, 4, 'default');

-- 二级菜单 - 追溯管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(80, 80, 'trace:config',  '追溯配置', 'MENU', '/trace/config',  NULL, 1, 'default'),
(81, 80, 'trace:code',    '追溯码管理','MENU', '/trace/code',    NULL, 2, 'default'),
(82, 80, 'trace:scan',    '扫码记录', 'MENU', '/trace/scan',    NULL, 3, 'default'),
(83, 80, 'trace:recall',  '召回管理', 'MENU', '/trace/recall',  NULL, 4, 'default');

-- 二级菜单 - 报表中心
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(90, 90, 'report:sales',    '销售报表', 'MENU', '/report/sales',    NULL, 1, 'default'),
(91, 90, 'report:product',  '商品报表', 'MENU', '/report/product',  NULL, 2, 'default'),
(92, 90, 'report:finance',  '财务报表', 'MENU', '/report/finance',  NULL, 3, 'default'),
(93, 90, 'report:customer', '客户报表', 'MENU', '/report/customer', NULL, 4, 'default'),
(94, 90, 'report:staff',    '员工报表', 'MENU', '/report/staff',    NULL, 5, 'default');

-- 二级菜单 - 系统管理
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) VALUES
(100, 100, 'system:user',         '用户管理', 'MENU', '/system/user',         NULL, 1, 'default'),
(101, 100, 'system:role',         '角色管理', 'MENU', '/system/role',         NULL, 2, 'default'),
(102, 100, 'system:tenant',       '租户管理', 'MENU', '/system/tenant',       NULL, 3, 'default'),
(103, 100, 'system:subscription', '订阅管理', 'MENU', '/system/subscription', NULL, 4, 'default'),
(104, 100, 'system:config',       '系统配置', 'MENU', '/system/config',       NULL, 5, 'default'),
(105, 100, 'system:audit',        '操作日志', 'MENU', '/system/audit',        NULL, 6, 'default'),
(106, 100, 'system:approval',     '审批管理', 'MENU', '/system/approval',     NULL, 7, 'default');

-- 按钮权限
INSERT INTO sys_menu (id, parent_id, menu_code, menu_name, menu_type, sort_no, tenant_id) VALUES
(200, 10,  'goods:create', '新增商品', 'BUTTON', 1, 'default'),
(201, 10,  'goods:edit',   '编辑商品', 'BUTTON', 2, 'default'),
(202, 10,  'goods:delete', '删除商品', 'BUTTON', 3, 'default'),
(203, 14,  'goods:inventory:adjust', '库存调整', 'BUTTON', 1, 'default'),
(210, 20,  'sale:create',  '开单',  'BUTTON', 1, 'default'),
(211, 21,  'sale:void',    '作废',  'BUTTON', 1, 'default'),
(212, 21,  'sale:edit',    '编辑',  'BUTTON', 2, 'default'),
(220, 30,  'purchase:create', '新建采购', 'BUTTON', 1, 'default'),
(221, 30,  'purchase:approve','审核采购', 'BUTTON', 2, 'default'),
(230, 40,  'customer:create', '新增客户', 'BUTTON', 1, 'default'),
(231, 40,  'customer:edit',   '编辑客户', 'BUTTON', 2, 'default'),
(232, 41,  'customer:credit:adjust', '额度调整', 'BUTTON', 1, 'default'),
(240, 50,  'finance:receipt:create', '新增收款', 'BUTTON', 1, 'default'),
(241, 51,  'finance:payment:create', '新增付款', 'BUTTON', 1, 'default'),
(250, 60,  'marketing:create', '创建活动', 'BUTTON', 1, 'default'),
(260, 70,  'store:create', '新增门店', 'BUTTON', 1, 'default'),
(261, 70,  'store:edit',   '编辑门店', 'BUTTON', 2, 'default'),
(270, 100, 'system:user:create',  '新增用户', 'BUTTON', 1, 'default'),
(271, 100, 'system:user:edit',    '编辑用户', 'BUTTON', 2, 'default'),
(272, 101, 'system:role:create',  '新增角色', 'BUTTON', 1, 'default'),
(273, 101, 'system:role:edit',    '编辑角色', 'BUTTON', 2, 'default');

-- ============================================================
-- 第7步：初始化角色-菜单关联（通过 sys_role.menus JSON）
-- 为每个角色分配菜单权限
-- 注意：sys_role 表已有 permissions 字段（JSON），此处复用
-- 实际菜单权限由 sys_menu 表 + 角色-菜单关联表控制
-- ============================================================

-- 超级管理员 - 拥有所有菜单
-- 其他角色通过前端根据 role_code 过滤菜单树

-- ============================================================
-- 第8步：初始化数据权限（行级过滤规则）
-- ============================================================

-- 门店店长：只能看自己门店的数据
INSERT INTO sys_data_permission (role_id, table_name, field_name, condition_type, condition_value, description, tenant_id) VALUES
(2, 'sale_bill', 'store_id', 'OWN', 'current_user.store_id', '门店店长只能查看本门店销售单', 'default'),
(2, 'inventory_balance', 'store_id', 'OWN', 'current_user.store_id', '门店店长只能查看本门店库存', 'default'),
(2, 'member', 'staff_id', 'OWN', 'current_user.store_id', '门店店长只能查看本门店客户', 'default'),
(2, 'sys_user', 'store_id', 'OWN', 'current_user.store_id', '门店店长只能查看本门店员工', 'default');

-- 销售员：只能看自己的销售数据和客户
INSERT INTO sys_data_permission (role_id, table_name, field_name, condition_type, condition_value, description, tenant_id) VALUES
(3, 'sale_bill', 'operator_id', 'OWN', 'current_user.id', '销售员只能查看自己开的单', 'default'),
(3, 'member', 'staff_id', 'OWN', 'current_user.id', '销售员只能查看自己的客户', 'default'),
(3, 'customer_visit', 'id', 'OWN', 'current_user.id', '销售员只能查看自己的拜访记录', 'default');

-- 仓管员：只能看自己门店的库存
INSERT INTO sys_data_permission (role_id, table_name, field_name, condition_type, condition_value, description, tenant_id) VALUES
(5, 'inventory_balance', 'store_id', 'OWN', 'current_user.store_id', '仓管员只能查看本门店库存', 'default'),
(5, 'inventory_batch', 'store_id', 'OWN', 'current_user.store_id', '仓管员只能查看本门店批次', 'default'),
(5, 'purchase_in_stock', 'store_id', 'OWN', 'current_user.store_id', '仓管员只能查看本门店入库', 'default');

-- 客服：只能看自己门店的客户和订单
INSERT INTO sys_data_permission (role_id, table_name, field_name, condition_type, condition_value, description, tenant_id) VALUES
(7, 'member', 'store_id', 'OWN', 'current_user.store_id', '客服只能查看本门店客户', 'default'),
(7, 'miniapp_order', 'store_id', 'OWN', 'current_user.store_id', '客服只能查看本门店订单', 'default');

-- ============================================================
-- 第9步：初始化字段权限（字段可见性/可编辑性）
-- ============================================================

-- 价格敏感字段：批发价、成本价仅管理员/财务/采购可见
INSERT INTO sys_field_permission (role_id, table_name, field_name, permission_type, description, tenant_id) VALUES
(3, 'product_price', 'wholesale_price', 'HIDDEN', '销售员不可见批发价', 'default'),
(3, 'product_price', 'cost_price', 'HIDDEN', '销售员不可见成本价', 'default'),
(3, 'sku_price', 'cost_price', 'HIDDEN', '销售员不可见成本价', 'default'),
(5, 'product_price', 'wholesale_price', 'HIDDEN', '仓管员不可见批发价', 'default'),
(7, 'product_price', 'wholesale_price', 'HIDDEN', '客服不可见批发价', 'default'),
(7, 'product_price', 'cost_price', 'HIDDEN', '客服不可见成本价', 'default'),
(8, 'product_price', 'wholesale_price', 'HIDDEN', '只读用户不可见批发价', 'default'),
(8, 'product_price', 'cost_price', 'HIDDEN', '只读用户不可见成本价', 'default');

-- 只读用户：所有数据只读
INSERT INTO sys_field_permission (role_id, table_name, field_name, permission_type, description, tenant_id) VALUES
(8, '*', '*', 'READONLY', '只读用户不可编辑任何数据', 'default');

-- 销售员：sale_bill 的 internal_remark 不可见
INSERT INTO sys_field_permission (role_id, table_name, field_name, permission_type, description, tenant_id) VALUES
(3, 'sale_bill', 'internal_remark', 'HIDDEN', '销售员不可见内部备注', 'default');

-- 门店报表：门店店长不可见其他门店的销售数据字段
INSERT INTO sys_field_permission (role_id, table_name, field_name, permission_type, description, tenant_id) VALUES
(2, 'report', 'other_store_sales', 'HIDDEN', '门店店长不可见其他门店销售数据', 'default');

SELECT '8角色权限矩阵初始化完成' AS result;