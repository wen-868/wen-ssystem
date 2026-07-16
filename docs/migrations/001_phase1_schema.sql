-- 编号: 001, 描述: 第1阶段MVP数据库建表, 创建人: 阿坚, 日期: 2026-07-06

-- 智享营销系统 第 1 阶段 MVP 数据库建表脚本
-- 适用数据库：MySQL 8.x
-- 说明：第 1 阶段覆盖账号权限、门店、商品 SKU、价格、会员身份、库存、订单、销售单、分享收款、支付退款、操作日志。

CREATE DATABASE IF NOT EXISTS liquor_inventory
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE liquor_inventory;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS t_operation_log;
DROP TABLE IF EXISTS t_hold_order;
DROP TABLE IF EXISTS t_refund_order;
DROP TABLE IF EXISTS t_receivable_account;
DROP TABLE IF EXISTS t_payment_order;
DROP TABLE IF EXISTS t_collection_view_log;
DROP TABLE IF EXISTS t_collection_link;
DROP TABLE IF EXISTS t_sale_bill_item;
DROP TABLE IF EXISTS t_sale_bill;
DROP TABLE IF EXISTS t_miniapp_order_item;
DROP TABLE IF EXISTS t_miniapp_order;
DROP TABLE IF EXISTS t_inventory_ledger;
DROP TABLE IF EXISTS t_inventory_balance;
DROP TABLE IF EXISTS t_product_price_log;
DROP TABLE IF EXISTS t_product_price;
DROP TABLE IF EXISTS t_product_sku;
DROP TABLE IF EXISTS t_product_spu;
DROP TABLE IF EXISTS t_product_category;
DROP TABLE IF EXISTS t_member;
DROP TABLE IF EXISTS t_store;
DROP TABLE IF EXISTS t_sys_role_permission;
DROP TABLE IF EXISTS t_sys_user_role;
DROP TABLE IF EXISTS t_sys_permission;
DROP TABLE IF EXISTS t_sys_role;
DROP TABLE IF EXISTS t_sys_user;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE t_sys_user (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  username VARCHAR(64) NOT NULL COMMENT '登录账号',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  real_name VARCHAR(64) NOT NULL COMMENT '真实姓名',
  mobile VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  store_id BIGINT UNSIGNED DEFAULT NULL COMMENT '所属门店ID，超级管理员可为空',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1正常，0禁用',
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_user_username (username),
  KEY idx_sys_user_store_id (store_id),
  KEY idx_sys_user_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统账号表';

CREATE TABLE t_sys_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  role_code VARCHAR(64) NOT NULL COMMENT '角色编码',
  role_name VARCHAR(64) NOT NULL COMMENT '角色名称',
  data_scope VARCHAR(32) NOT NULL DEFAULT 'STORE' COMMENT '数据范围：ALL/STORE/SELF',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1正常，0禁用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_role_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

CREATE TABLE t_sys_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '权限ID',
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父权限ID',
  permission_code VARCHAR(128) NOT NULL COMMENT '权限编码',
  permission_name VARCHAR(128) NOT NULL COMMENT '权限名称',
  permission_type VARCHAR(16) NOT NULL COMMENT '权限类型：MENU/BUTTON/API',
  path VARCHAR(255) DEFAULT NULL COMMENT '前端路由或接口路径',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1正常，0禁用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_permission_code (permission_code),
  KEY idx_sys_permission_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表';

CREATE TABLE t_sys_user_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_user_role (user_id, role_id),
  KEY idx_sys_user_role_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

CREATE TABLE t_sys_role_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_role_permission (role_id, permission_id),
  KEY idx_sys_role_permission_permission_id (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限关联表';

CREATE TABLE t_store (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '门店ID',
  store_code VARCHAR(64) NOT NULL COMMENT '门店编码',
  name VARCHAR(128) NOT NULL COMMENT '门店名称',
  address VARCHAR(255) NOT NULL COMMENT '详细地址',
  lng DECIMAL(10,6) DEFAULT NULL COMMENT '经度',
  lat DECIMAL(10,6) DEFAULT NULL COMMENT '纬度',
  contact VARCHAR(64) DEFAULT NULL COMMENT '联系人',
  phone VARCHAR(32) DEFAULT NULL COMMENT '联系电话',
  delivery_radius DECIMAL(6,2) NOT NULL DEFAULT 3.00 COMMENT '配送半径，单位公里',
  business_status VARCHAR(32) NOT NULL DEFAULT 'OPEN' COMMENT '营业状态：OPEN/PAUSED/CLOSED',
  fulfillment_delivery_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否支持配送',
  fulfillment_pickup_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否支持自提',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_store_code (store_code),
  KEY idx_store_status (status, business_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店表';

CREATE TABLE t_member (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会员ID',
  openid VARCHAR(128) DEFAULT NULL COMMENT '微信openid',
  unionid VARCHAR(128) DEFAULT NULL COMMENT '微信unionid',
  mobile VARCHAR(20) NOT NULL COMMENT '手机号',
  name VARCHAR(64) DEFAULT NULL COMMENT '客户名称',
  customer_type VARCHAR(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户身份：RETAIL/WHOLESALE',
  settlement_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH/ACCOUNT',
  staff_id BIGINT UNSIGNED DEFAULT NULL COMMENT '归属销售员ID',
  points INT NOT NULL DEFAULT 0 COMMENT '积分',
  level_code VARCHAR(32) DEFAULT NULL COMMENT '会员等级',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1正常，0禁用',
  last_order_at DATETIME DEFAULT NULL COMMENT '最近下单时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_member_mobile (mobile),
  UNIQUE KEY uk_member_openid (openid),
  KEY idx_member_customer_type (customer_type, status),
  KEY idx_member_staff_id (staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员客户表';

CREATE TABLE t_product_category (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父分类ID，仅支持两级',
  name VARCHAR(64) NOT NULL COMMENT '分类名称',
  icon VARCHAR(256) DEFAULT NULL COMMENT '分类图标',
  code VARCHAR(64) DEFAULT NULL COMMENT '分类编码',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_category_parent_id (parent_id),
  KEY idx_product_category_status (status, sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表';

CREATE TABLE t_product_spu (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品ID',
  spu_code VARCHAR(64) NOT NULL COMMENT '商品编码',
  name VARCHAR(128) NOT NULL COMMENT '商品名称',
  category_id BIGINT UNSIGNED NOT NULL COMMENT '分类ID',
  brand VARCHAR(128) DEFAULT NULL COMMENT '品牌',
  unit VARCHAR(32) DEFAULT NULL COMMENT '单位',
  specs VARCHAR(256) DEFAULT NULL COMMENT '规格',
  main_image VARCHAR(512) DEFAULT NULL COMMENT '商品主图',
  image_urls JSON DEFAULT NULL COMMENT '轮播图',
  detail TEXT DEFAULT NULL COMMENT '商品详情',
  sale_channels JSON NOT NULL COMMENT '可售渠道：MINIAPP/STORE',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  is_new TINYINT NOT NULL DEFAULT 0 COMMENT '新品标记',
  is_recommend TINYINT NOT NULL DEFAULT 0 COMMENT '推荐标记',
  description VARCHAR(512) DEFAULT NULL COMMENT '商品简介',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/ON_SALE/OFF_SALE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_spu_code (spu_code),
  KEY idx_product_spu_category_status (category_id, status),
  FULLTEXT KEY ft_product_spu_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品主档案表';

CREATE TABLE t_product_sku (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'SKU ID',
  spu_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  sku_code VARCHAR(64) NOT NULL COMMENT 'SKU编码',
  barcode VARCHAR(128) DEFAULT NULL COMMENT '商品条码',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称',
  volume VARCHAR(32) DEFAULT NULL COMMENT '净含量（500ml/1L）',
  packaging VARCHAR(32) DEFAULT NULL COMMENT '包装类型（瓶装/罐装/桶装）',
  base_unit VARCHAR(16) NOT NULL DEFAULT '瓶' COMMENT '基础单位',
  box_unit VARCHAR(16) NOT NULL DEFAULT '箱' COMMENT '组合单位',
  box_ratio INT NOT NULL DEFAULT 1 COMMENT '箱瓶换算比例',
  temperature VARCHAR(32) NOT NULL DEFAULT 'NORMAL' COMMENT '温度属性：NORMAL/CHILLED',
  trace_enabled TINYINT NOT NULL DEFAULT 0 COMMENT '是否启用追溯',
  warning_threshold INT NOT NULL DEFAULT 0 COMMENT '库存预警阈值，单位瓶',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_sku_code (sku_code),
  UNIQUE KEY uk_product_sku_barcode (barcode),
  KEY idx_product_sku_spu_id (spu_id),
  KEY idx_product_sku_trace_enabled (trace_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品SKU表';

CREATE TABLE t_product_price (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '价格ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '成本价',
  retail_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '统一零售价',
  wholesale_price DECIMAL(12,2) DEFAULT NULL COMMENT '批发价，普通客户接口不得返回',
  miniapp_price DECIMAL(12,2) DEFAULT NULL COMMENT '小程序渠道价',
  store_price DECIMAL(12,2) DEFAULT NULL COMMENT '线下门店售价',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_price_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品价格表';

CREATE TABLE t_product_price_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku_id BIGINT UNSIGNED NOT NULL,
  operator_id BIGINT UNSIGNED NOT NULL,
  price_type VARCHAR(32) NOT NULL COMMENT '价格类型：COST/RETAIL/WHOLESALE/MINIAPP/STORE',
  old_price DECIMAL(12,2) DEFAULT NULL,
  new_price DECIMAL(12,2) DEFAULT NULL,
  action_type VARCHAR(32) NOT NULL COMMENT '操作类型：CREATE/UPDATE/CLEAR',
  ip VARCHAR(64) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_price_log_sku_id (sku_id),
  KEY idx_product_price_log_operator_id (operator_id),
  KEY idx_product_price_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格修改日志表';

CREATE TABLE t_inventory_balance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '库存余额ID',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  stock_type VARCHAR(32) NOT NULL DEFAULT 'OFFLINE' COMMENT '库存类型：ONLINE/OFFLINE',
  physical_qty INT NOT NULL DEFAULT 0 COMMENT '物理库存',
  locked_qty INT NOT NULL DEFAULT 0 COMMENT '锁定库存',
  available_qty INT NOT NULL DEFAULT 0 COMMENT '可售库存',
  version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventory_balance_store_sku_type (store_id, sku_id, stock_type),
  KEY idx_inventory_balance_sku_id (sku_id),
  KEY idx_inventory_balance_available_qty (available_qty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存余额表';

CREATE TABLE t_inventory_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '库存流水ID',
  ledger_no VARCHAR(64) NOT NULL COMMENT '库存流水号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  stock_type VARCHAR(32) NOT NULL COMMENT '库存类型：ONLINE/OFFLINE',
  biz_type VARCHAR(64) NOT NULL COMMENT '业务类型：ORDER_LOCK/ORDER_PAY/ORDER_CANCEL/SALE/ADJUST',
  biz_no VARCHAR(64) NOT NULL COMMENT '关联业务单号',
  change_qty INT NOT NULL COMMENT '变动数量，增加为正，减少为负',
  before_qty INT NOT NULL COMMENT '变动前物理库存',
  after_qty INT NOT NULL COMMENT '变动后物理库存',
  before_locked_qty INT NOT NULL DEFAULT 0 COMMENT '变动前锁定库存',
  after_locked_qty INT NOT NULL DEFAULT 0 COMMENT '变动后锁定库存',
  operator_id BIGINT UNSIGNED DEFAULT NULL COMMENT '操作人',
  idempotency_key VARCHAR(128) NOT NULL COMMENT '幂等键',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventory_ledger_no (ledger_no),
  UNIQUE KEY uk_inventory_ledger_idempotency (idempotency_key),
  KEY idx_inventory_ledger_store_sku (store_id, sku_id),
  KEY idx_inventory_ledger_biz_no (biz_no),
  KEY idx_inventory_ledger_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存流水表';

CREATE TABLE t_miniapp_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  order_no VARCHAR(64) NOT NULL COMMENT '订单号',
  member_id BIGINT UNSIGNED NOT NULL COMMENT '会员ID',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_type VARCHAR(32) NOT NULL COMMENT '下单时客户身份：RETAIL/WHOLESALE',
  fulfillment_type VARCHAR(32) NOT NULL COMMENT '履约方式：DELIVERY/PICKUP',
  order_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT' COMMENT '订单状态',
  pay_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态',
  settlement_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH/ACCOUNT',
  delivery_status VARCHAR(32) NOT NULL DEFAULT 'WAITING' COMMENT '配送状态：WAITING/DELIVERING/COMPLETED/REJECTED/CANCELLED',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  payable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应付金额',
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已付金额',
  receiver_name VARCHAR(64) DEFAULT NULL COMMENT '收货人',
  receiver_mobile VARCHAR(20) DEFAULT NULL COMMENT '收货手机号',
  receiver_address VARCHAR(255) DEFAULT NULL COMMENT '收货地址',
  remark VARCHAR(255) DEFAULT NULL COMMENT '用户备注',
  internal_remark VARCHAR(255) DEFAULT NULL COMMENT '门店内部备注',
  expire_at DATETIME DEFAULT NULL COMMENT '支付过期时间',
  paid_at DATETIME DEFAULT NULL COMMENT '支付完成时间',
  completed_at DATETIME DEFAULT NULL COMMENT '订单完成时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_miniapp_order_no (order_no),
  KEY idx_miniapp_order_member_id (member_id),
  KEY idx_miniapp_order_store_status (store_id, order_status),
  KEY idx_miniapp_order_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序订单表';

CREATE TABLE t_miniapp_order_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL COMMENT '订单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT '下单时SKU名称',
  qty INT NOT NULL COMMENT '数量，单位瓶',
  reserved_qty INT NOT NULL DEFAULT 0 COMMENT '已占用库存数量，单位瓶',
  unreserved_qty INT NOT NULL DEFAULT 0 COMMENT '未占用数量，单位瓶',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '成交单价',
  price_type VARCHAR(32) NOT NULL COMMENT '价格类型：RETAIL/WHOLESALE/MINIAPP/STORE',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计',
  trace_required TINYINT NOT NULL DEFAULT 0 COMMENT '是否需要追溯',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_miniapp_order_item_order_no (order_no),
  KEY idx_miniapp_order_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序订单明细表';

CREATE TABLE t_sale_bill (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '销售单ID',
  bill_no VARCHAR(64) NOT NULL COMMENT '销售单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID，可为空',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  customer_type VARCHAR(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户身份快照',
  business_status VARCHAR(32) NOT NULL DEFAULT 'CREATED' COMMENT '业务状态：DRAFT/CREATED/COMPLETED/VOIDED/RETURNED',
  collection_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '收款状态：UNPAID/PENDING/SHARED/PARTIAL/PAID/OVERDUE/CLOSED',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  rounding_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '抹零金额',
  receivable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应收金额',
  received_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已收金额',
  unreceived_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未收金额',
  share_collection_count INT NOT NULL DEFAULT 0 COMMENT '分享收款次数',
  last_share_time DATETIME DEFAULT NULL COMMENT '最近分享时间',
  last_payment_time DATETIME DEFAULT NULL COMMENT '最近收款时间',
  locked_amount_flag TINYINT NOT NULL DEFAULT 0 COMMENT '金额是否锁定',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '开单人',
  remark VARCHAR(255) DEFAULT NULL COMMENT '客户可见备注',
  internal_remark VARCHAR(255) DEFAULT NULL COMMENT '内部备注',
  void_reason VARCHAR(255) DEFAULT NULL COMMENT '作废原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_bill_no (bill_no),
  KEY idx_sale_bill_store_status (store_id, business_status, collection_status),
  KEY idx_sale_bill_customer_id (customer_id),
  KEY idx_sale_bill_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线下销售单表';

CREATE TABLE t_sale_bill_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bill_no VARCHAR(64) NOT NULL COMMENT '销售单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '成交单价，按瓶',
  price_type VARCHAR(32) NOT NULL COMMENT '价格类型：RETAIL/WHOLESALE/STORE',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计',
  trace_required TINYINT NOT NULL DEFAULT 0 COMMENT '是否需要追溯',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sale_bill_item_bill_no (bill_no),
  KEY idx_sale_bill_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线下销售单明细表';

CREATE TABLE t_collection_link (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分享收款ID',
  link_no VARCHAR(64) NOT NULL COMMENT '分享收款单号',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：SALE_BILL/MINIAPP_ORDER/STATEMENT',
  source_no VARCHAR(64) NOT NULL COMMENT '来源单号',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  amount DECIMAL(12,2) NOT NULL COMMENT '本次收款金额',
  tax_enabled TINYINT NOT NULL DEFAULT 0 COMMENT '是否展示税率',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '税率',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已支付金额',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/PARTIAL/PAID/EXPIRED/CLOSED',
  share_channel VARCHAR(32) NOT NULL COMMENT '分享方式：MINIAPP_CARD/LINK/IMAGE/QR_CODE',
  share_user_id BIGINT UNSIGNED NOT NULL COMMENT '分享人',
  share_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分享时间',
  expire_at DATETIME NOT NULL COMMENT '过期时间',
  view_count INT NOT NULL DEFAULT 0 COMMENT '查看次数',
  last_view_time DATETIME DEFAULT NULL COMMENT '最近查看时间',
  pay_no VARCHAR(64) DEFAULT NULL COMMENT '关联支付单号',
  token VARCHAR(128) NOT NULL COMMENT '访问令牌',
  closed_reason VARCHAR(255) DEFAULT NULL COMMENT '关闭原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_collection_link_no (link_no),
  UNIQUE KEY uk_collection_link_token (token),
  KEY idx_collection_link_source (source_type, source_no),
  KEY idx_collection_link_status_expire (status, expire_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分享收款链接表';

CREATE TABLE t_collection_view_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  link_no VARCHAR(64) NOT NULL COMMENT '分享收款单号',
  ip VARCHAR(64) DEFAULT NULL COMMENT '访问IP',
  user_agent VARCHAR(512) DEFAULT NULL COMMENT '用户代理',
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '访问时间',
  PRIMARY KEY (id),
  KEY idx_collection_view_log_link_no (link_no),
  KEY idx_collection_view_log_viewed_at (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分享收款访问日志表';

CREATE TABLE t_receivable_account (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '应收ID',
  receivable_no VARCHAR(64) NOT NULL COMMENT '应收单号',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：MINIAPP_ORDER/SALE_BILL',
  source_no VARCHAR(64) NOT NULL COMMENT '来源单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  receivable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应收金额',
  received_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已收金额',
  unreceived_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未收金额',
  status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '状态：UNPAID/PARTIAL/PAID/CLOSED',
  last_payment_time DATETIME DEFAULT NULL COMMENT '最近收款时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_receivable_no (receivable_no),
  UNIQUE KEY uk_receivable_source (source_type, source_no),
  KEY idx_receivable_store_status (store_id, status),
  KEY idx_receivable_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应收账款表';

CREATE TABLE t_payment_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '支付单ID',
  pay_no VARCHAR(64) NOT NULL COMMENT '支付单号',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：MINIAPP_ORDER/SALE_BILL/COLLECTION_LINK',
  source_no VARCHAR(64) NOT NULL COMMENT '来源单号',
  channel VARCHAR(32) NOT NULL DEFAULT 'WECHAT' COMMENT '支付渠道',
  amount DECIMAL(12,2) NOT NULL COMMENT '支付金额',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '支付状态：PENDING/SUCCESS/FAILED/CLOSED/REFUNDED',
  wx_prepay_id VARCHAR(128) DEFAULT NULL COMMENT '微信预支付ID',
  wx_transaction_id VARCHAR(128) DEFAULT NULL COMMENT '微信交易号',
  callback_raw JSON DEFAULT NULL COMMENT '回调原文',
  paid_at DATETIME DEFAULT NULL COMMENT '支付成功时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_order_pay_no (pay_no),
  UNIQUE KEY uk_payment_order_wx_transaction_id (wx_transaction_id),
  KEY idx_payment_order_source (source_type, source_no),
  KEY idx_payment_order_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付单表';

CREATE TABLE t_hold_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '挂单ID',
  hold_no VARCHAR(64) NOT NULL COMMENT '挂单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户姓名',
  customer_mobile VARCHAR(32) DEFAULT NULL COMMENT '客户手机号',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '挂单金额',
  payload JSON NOT NULL COMMENT '挂单草稿内容',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  status VARCHAR(32) NOT NULL DEFAULT 'HELD' COMMENT '状态：HELD/DELETED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_hold_order_no (hold_no),
  KEY idx_hold_order_store_status (store_id, status),
  KEY idx_hold_order_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店挂单表';

CREATE TABLE t_refund_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '退款单ID',
  refund_no VARCHAR(64) NOT NULL COMMENT '退款单号',
  pay_no VARCHAR(64) NOT NULL COMMENT '支付单号',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型',
  source_no VARCHAR(64) NOT NULL COMMENT '来源单号',
  amount DECIMAL(12,2) NOT NULL COMMENT '退款金额',
  reason VARCHAR(255) DEFAULT NULL COMMENT '退款原因',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/SUCCESS/FAILED',
  wx_refund_id VARCHAR(128) DEFAULT NULL COMMENT '微信退款单号',
  operator_id BIGINT UNSIGNED DEFAULT NULL COMMENT '操作人',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_refund_order_no (refund_no),
  KEY idx_refund_order_pay_no (pay_no),
  KEY idx_refund_order_source (source_type, source_no),
  KEY idx_refund_order_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='退款单表';

CREATE TABLE t_operation_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  operator_id BIGINT UNSIGNED DEFAULT NULL COMMENT '操作人ID',
  operator_name VARCHAR(64) DEFAULT NULL COMMENT '操作人名称',
  module VARCHAR(64) NOT NULL COMMENT '模块',
  action VARCHAR(64) NOT NULL COMMENT '动作',
  biz_no VARCHAR(64) DEFAULT NULL COMMENT '业务单号',
  before_data JSON DEFAULT NULL COMMENT '变更前数据',
  after_data JSON DEFAULT NULL COMMENT '变更后数据',
  ip VARCHAR(64) DEFAULT NULL COMMENT 'IP',
  user_agent VARCHAR(512) DEFAULT NULL COMMENT '用户代理',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_operation_log_operator_id (operator_id),
  KEY idx_operation_log_module_action (module, action),
  KEY idx_operation_log_biz_no (biz_no),
  KEY idx_operation_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

INSERT INTO t_sys_role (role_code, role_name, data_scope, status) VALUES
('SUPER_ADMIN', '超级管理员', 'ALL', 1),
('OPERATION_ADMIN', '运营管理员', 'ALL', 1),
('STORE_MANAGER', '门店店长', 'STORE', 1),
('STORE_OPERATOR', '门店操作员', 'STORE', 1),
('FINANCE', '财务人员', 'ALL', 1);

INSERT INTO t_store (store_code, name, address, lng, lat, contact, phone, delivery_radius, business_status, status) VALUES
('STORE0001', '默认门店', '请在后台维护门店地址', NULL, NULL, '管理员', '13800000000', 3.00, 'OPEN', 1);
