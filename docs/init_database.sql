-- ============================================================================
-- 智享酒业进销存系统 - 数据库初始化脚本
-- 项目名称：智享酒业进销存系统 (Liquor Inventory System)
-- 版本：v2.0.0
-- 创建日期：2026-06-20
-- 说明：整合 Phase 1 ~ Phase 6 所有建表语句，按依赖顺序排列
--       合并重复表定义（保留最新版本），添加 IF NOT EXISTS
-- 适用数据库：MySQL 5.7+ / MySQL 8.x
-- ============================================================================

-- 设置字符集
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS liquor_inventory
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE liquor_inventory;

-- ============================================================================
-- 第一部分：系统基础表（无外键依赖）
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1.1 系统配置表
-- 来源：Phase 3 (phase3_sys_config.sql)
-- 说明：存储系统全局配置，包括企业信息、微信配置、支付配置等
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key VARCHAR(128) NOT NULL COMMENT '配置键',
  config_value TEXT COMMENT '配置值（敏感字段加密存储）',
  config_group VARCHAR(64) NOT NULL DEFAULT 'system' COMMENT '配置分组：system/wechat/payment/enterprise',
  is_encrypted TINYINT NOT NULL DEFAULT 0 COMMENT '是否加密：1是，0否',
  description VARCHAR(255) DEFAULT NULL COMMENT '配置说明',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_config_key (config_key),
  KEY idx_config_group (config_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- --------------------------------------------------------------------------
-- 1.2 系统用户表
-- 来源：Phase 1 (phase1_schema.sql)
-- 说明：系统登录账号，支持超级管理员、门店管理员、操作员等
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_user (
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

-- --------------------------------------------------------------------------
-- 1.3 系统角色表
-- 来源：Phase 6 (phase6_schema.sql) - 合并 Phase 1 和 Phase 6，保留 Phase 6 最新定义
-- 说明：RBAC 角色管理，支持 JSON 格式的权限列表
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  role_code VARCHAR(64) NOT NULL COMMENT '角色编码',
  role_name VARCHAR(64) NOT NULL COMMENT '角色名称',
  description VARCHAR(200) DEFAULT NULL COMMENT '角色描述',
  data_scope VARCHAR(32) NOT NULL DEFAULT 'SELF' COMMENT '数据范围：ALL/DEPARTMENT/STORE/SELF',
  permissions JSON DEFAULT NULL COMMENT '权限列表（JSON格式）',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_role_code (role_code),
  KEY idx_sys_role_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- --------------------------------------------------------------------------
-- 1.4 系统权限表
-- 来源：Phase 1 (phase1_schema.sql)
-- 说明：菜单/按钮/API 权限定义
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_permission (
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

-- --------------------------------------------------------------------------
-- 1.5 门店表
-- 来源：Phase 1 (phase1_schema.sql) + Phase 5 ALTER
-- 说明：门店基础信息，包含营业状态、配送设置等
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store (
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
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' COMMENT '门店状态: OPEN/CLOSED/SUSPENDED',
  fulfillment_delivery_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否支持配送',
  fulfillment_pickup_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否支持自提',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_store_code (store_code),
  KEY idx_store_business_status (business_status),
  KEY idx_store_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店表';

-- --------------------------------------------------------------------------
-- 1.6 商品分类表
-- 来源：Phase 1 (phase1_schema.sql)
-- 说明：支持两级分类结构
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_category (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父分类ID，仅支持两级',
  name VARCHAR(64) NOT NULL COMMENT '分类名称',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_category_parent_id (parent_id),
  KEY idx_product_category_status (status, sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表';

-- --------------------------------------------------------------------------
-- 1.7 供应商表
-- 来源：Phase 2 (phase2_schema.sql)
-- 说明：供应商基础信息，包含结算方式、银行信息等
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '供应商ID',
  supplier_code VARCHAR(64) NOT NULL COMMENT '供应商编码',
  name VARCHAR(128) NOT NULL COMMENT '供应商名称',
  short_name VARCHAR(64) DEFAULT NULL COMMENT '简称',
  category VARCHAR(32) DEFAULT NULL COMMENT '类别：酒厂/经销商/批发商',
  province VARCHAR(64) DEFAULT NULL COMMENT '省',
  city VARCHAR(64) DEFAULT NULL COMMENT '市',
  district VARCHAR(64) DEFAULT NULL COMMENT '区',
  address VARCHAR(255) DEFAULT NULL COMMENT '详细地址',
  credit_level VARCHAR(16) DEFAULT 'B' COMMENT '信用等级：A/B/C/D',
  settlement_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH(现结)/MONTHLY(月结)/QUARTERLY(季结)',
  settlement_day INT DEFAULT NULL COMMENT '结算日（月结时：1-31）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '默认税率',
  bank_name VARCHAR(128) DEFAULT NULL COMMENT '开户银行',
  bank_account VARCHAR(64) DEFAULT NULL COMMENT '银行账号',
  bank_account_name VARCHAR(64) DEFAULT NULL COMMENT '开户名',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_supplier_code (supplier_code),
  KEY idx_supplier_name (name),
  KEY idx_supplier_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表';

-- --------------------------------------------------------------------------
-- 1.8 价格等级表
-- 来源：Phase 4 (phase4_schema.sql)
-- 说明：阶梯价格体系，支持折扣率、最低订单金额门槛
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_level (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  level_code VARCHAR(32) NOT NULL UNIQUE COMMENT '等级编码如RETAIL/WHOLESALE_L1/WHOLESALE_L2/AGREEMENT',
  level_name VARCHAR(64) NOT NULL COMMENT '等级名称',
  discount_rate DECIMAL(5,4) DEFAULT 1.0000 COMMENT '折扣率，1.0000=无折扣',
  min_order_amount DECIMAL(12,2) DEFAULT 0 COMMENT '最低订单金额门槛',
  description VARCHAR(255) DEFAULT '' COMMENT '等级说明',
  sort_order INT DEFAULT 0,
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格等级表';

-- --------------------------------------------------------------------------
-- 1.9 预警规则表
-- 来源：Phase 3 (phase3_schema.sql)
-- 说明：库存、效期、信用、逾期、积压等预警规则
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_rule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '预警规则ID',
  rule_code VARCHAR(64) NOT NULL COMMENT '规则编码',
  rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
  rule_type VARCHAR(32) NOT NULL COMMENT '规则类型：STOCK_LOW(安全库存)/EXPIRY(保质期)/CREDIT(信用额度)/OVERDUE(回款逾期)/STOCK_OVERSTOCK(库存积压)',
  enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
  threshold_value DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '阈值',
  threshold_unit VARCHAR(32) NOT NULL DEFAULT 'DAYS' COMMENT '阈值单位：DAYS(天)/PERCENT(百分比)/BOTTLES(瓶)/AMOUNT(金额)',
  extra_config JSON DEFAULT NULL COMMENT '额外配置（JSON格式）',
  description VARCHAR(255) DEFAULT NULL COMMENT '规则描述',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_alert_rule_code (rule_code),
  KEY idx_alert_rule_type (rule_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警规则表';

-- --------------------------------------------------------------------------
-- 1.10 效期预警配置表
-- 来源：Phase 5 (phase5_schema.sql)
-- 说明：效期预警的级别配置（天数、动作、颜色）
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expiry_alert_config (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  alert_level TINYINT NOT NULL COMMENT '预警级别(1/2/3)',
  level_name VARCHAR(20) NOT NULL COMMENT '级别名称(如"三级预警")',
  days_before_expiry INT NOT NULL COMMENT '提前天数',
  action VARCHAR(20) NOT NULL COMMENT '动作: REMIND/RESTRICT/BLOCK',
  color VARCHAR(20) NOT NULL COMMENT '颜色值: #10B981/#F59E0B/#EF4444',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  description VARCHAR(255) DEFAULT '' COMMENT '描述',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='效期预警配置表';

-- --------------------------------------------------------------------------
-- 1.11 追溯配置表
-- 来源：Phase 4 (phase4_schema.sql)
-- 说明：商品追溯功能的配置
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trace_config (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  config_no VARCHAR(32) NOT NULL UNIQUE,
  config_level ENUM('CATEGORY','SKU','GLOBAL') NOT NULL,
  target_id INT NOT NULL,
  target_name VARCHAR(128) DEFAULT '',
  trace_enabled TINYINT NOT NULL DEFAULT 0,
  force_enabled TINYINT NOT NULL DEFAULT 0,
  code_mode ENUM('ONE_PER_ITEM','ONE_PER_BATCH','BATCH_ONLY') DEFAULT 'ONE_PER_BATCH',
  code_prefix VARCHAR(16) DEFAULT 'TR',
  auto_generate TINYINT DEFAULT 1,
  shelf_life_days INT DEFAULT 365,
  remark VARCHAR(255) DEFAULT '',
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_level_target (config_level, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='追溯配置表';

-- --------------------------------------------------------------------------
-- 1.12 门店管控配置表
-- 来源：Phase 5 (phase5_schema.sql)
-- 说明：门店自动开关门、订单限制等管控配置
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_control_config (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL UNIQUE COMMENT '门店ID',
  auto_open_time TIME DEFAULT NULL COMMENT '自动开门时间',
  auto_close_time TIME DEFAULT NULL COMMENT '自动关门时间',
  max_daily_orders INT DEFAULT NULL COMMENT '每日最大订单数',
  max_order_amount DECIMAL(10,2) DEFAULT NULL COMMENT '每日最大订单金额',
  suspended_reason TEXT DEFAULT NULL COMMENT '暂停原因',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店管控配置表';

-- ============================================================================
-- 第二部分：关联表（依赖基础表）
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1 用户角色关联表
-- 来源：Phase 6 (phase6_schema.sql) - 合并 Phase 1 和 Phase 6，保留 Phase 6（含外键）
-- 说明：用户与角色的多对多关联
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_user_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_user_role (user_id, role_id),
  KEY idx_sys_user_role_user_id (user_id),
  KEY idx_sys_user_role_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

-- --------------------------------------------------------------------------
-- 2.2 角色权限关联表
-- 来源：Phase 1 (phase1_schema.sql)
-- 说明：角色与权限的多对多关联
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_role_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sys_role_permission (role_id, permission_id),
  KEY idx_sys_role_permission_permission_id (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限关联表';

-- --------------------------------------------------------------------------
-- 2.3 供应商联系人表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：supplier
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_contact (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '联系人ID',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  name VARCHAR(64) NOT NULL COMMENT '联系人姓名',
  mobile VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  phone VARCHAR(32) DEFAULT NULL COMMENT '固定电话',
  email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
  wechat VARCHAR(64) DEFAULT NULL COMMENT '微信号',
  is_primary TINYINT NOT NULL DEFAULT 0 COMMENT '是否主联系人：1是，0否',
  position VARCHAR(64) DEFAULT NULL COMMENT '职位',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_supplier_contact_supplier_id (supplier_id),
  KEY idx_supplier_contact_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商联系人表';

-- --------------------------------------------------------------------------
-- 2.4 会员客户表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：sys_user (staff_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会员ID',
  openid VARCHAR(128) DEFAULT NULL COMMENT '微信openid',
  unionid VARCHAR(128) DEFAULT NULL COMMENT '微信unionid',
  mobile VARCHAR(20) NOT NULL COMMENT '手机号',
  name VARCHAR(64) DEFAULT NULL COMMENT '客户名称',
  email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
  contact_person VARCHAR(64) DEFAULT NULL COMMENT '联系人',
  address VARCHAR(255) DEFAULT NULL COMMENT '详细地址',
  customer_type VARCHAR(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户身份：RETAIL/WHOLESALE',
  settlement_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH/ACCOUNT',
  staff_id BIGINT UNSIGNED DEFAULT NULL COMMENT '归属销售员ID',
  points INT NOT NULL DEFAULT 0 COMMENT '积分',
  level_code VARCHAR(32) DEFAULT NULL COMMENT '会员等级',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
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

-- --------------------------------------------------------------------------
-- 2.5 商品主档案表（SPU）
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：product_category
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_spu (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品ID',
  spu_code VARCHAR(64) NOT NULL COMMENT '商品编码',
  name VARCHAR(128) NOT NULL COMMENT '商品名称',
  category_id BIGINT UNSIGNED NOT NULL COMMENT '分类ID',
  main_image VARCHAR(512) DEFAULT NULL COMMENT '商品主图',
  image_urls JSON DEFAULT NULL COMMENT '轮播图',
  detail TEXT DEFAULT NULL COMMENT '商品详情',
  alcohol_content DECIMAL(5,2) DEFAULT NULL COMMENT '酒精度（%vol）',
  origin VARCHAR(128) DEFAULT NULL COMMENT '产地',
  sale_channels JSON NOT NULL COMMENT '可售渠道：MINIAPP/STORE',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/ON_SALE/OFF_SALE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_spu_code (spu_code),
  KEY idx_product_spu_category_status (category_id, status),
  FULLTEXT KEY ft_product_spu_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品主档案表';

-- --------------------------------------------------------------------------
-- 2.6 商品SKU表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：product_spu
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_sku (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'SKU ID',
  spu_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  sku_code VARCHAR(64) NOT NULL COMMENT 'SKU编码',
  barcode VARCHAR(128) DEFAULT NULL COMMENT '商品条码',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称',
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

-- --------------------------------------------------------------------------
-- 2.7 商品价格表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：product_sku
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_price (
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

-- --------------------------------------------------------------------------
-- 2.8 阶梯价格表
-- 来源：Phase 4 (phase4_schema.sql)
-- 依赖：product_sku, price_level
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sku_price (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sku_id INT NOT NULL COMMENT 'SKU ID',
  price_level_id INT NOT NULL COMMENT '价格等级ID',
  min_qty INT DEFAULT 1 COMMENT '起订量',
  price DECIMAL(12,2) NOT NULL COMMENT '单价',
  cost_price DECIMAL(12,2) DEFAULT 0 COMMENT '成本价（仅管理员可见）',
  suggested_retail_price DECIMAL(12,2) DEFAULT 0 COMMENT '建议零售价',
  effective_start DATE DEFAULT NULL COMMENT '生效开始日期',
  effective_end DATE DEFAULT NULL COMMENT '生效结束日期',
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sku_level_qty (sku_id, price_level_id, min_qty),
  KEY idx_sku_price_sku_id (sku_id),
  KEY idx_sku_price_level_id (price_level_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='阶梯价格表';

-- --------------------------------------------------------------------------
-- 2.9 客户价格等级绑定表
-- 来源：Phase 4 (phase4_schema.sql)
-- 依赖：member (customer_id), price_level
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_price_binding (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL COMMENT '客户ID',
  price_level_id INT NOT NULL COMMENT '价格等级ID',
  apply_reason VARCHAR(255) DEFAULT '' COMMENT '申请原因',
  status ENUM('PENDING','APPROVED','REJECTED','EXPIRED') DEFAULT 'PENDING',
  approved_by INT DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  expire_at DATETIME DEFAULT NULL COMMENT '到期时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customer (customer_id),
  KEY idx_customer_price_binding_level (price_level_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户价格等级绑定表';

-- --------------------------------------------------------------------------
-- 2.10 客户授信额度表
-- 来源：Phase 4 (phase4_schema.sql)
-- 依赖：member (customer_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_credit (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL UNIQUE COMMENT '客户ID',
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '授信总额度',
  credit_used DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '已用额度',
  credit_frozen DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '冻结额度',
  credit_available DECIMAL(12,2) GENERATED ALWAYS AS (credit_limit - credit_used - credit_frozen) STORED COMMENT '可用额度',
  payment_term ENUM('COD','NET_7','NET_15','NET_30','NET_60','NET_90') DEFAULT 'COD' COMMENT '账期',
  late_fee_rate DECIMAL(6,4) DEFAULT 0.0005 COMMENT '日滞纳金费率(0.05%)',
  max_late_fee_rate DECIMAL(6,4) DEFAULT 0.3 COMMENT '最高滞纳金比例(30%)',
  warning_threshold DECIMAL(5,2) DEFAULT 0.80 COMMENT '预警阈值(80%)',
  overdue_freeze_days INT DEFAULT 15 COMMENT '逾期多少天自动冻结',
  status ENUM('ACTIVE','FROZEN','CLOSED') DEFAULT 'ACTIVE',
  freeze_reason VARCHAR(255) DEFAULT NULL,
  frozen_at DATETIME DEFAULT NULL,
  unfrozen_at DATETIME DEFAULT NULL,
  version INT DEFAULT 1 COMMENT '乐观锁版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户授信额度表';

-- --------------------------------------------------------------------------
-- 2.11 库存余额表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：store, product_sku
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_balance (
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

-- --------------------------------------------------------------------------
-- 2.12 库存批次表
-- 来源：Phase 5 (phase5_schema.sql)
-- 依赖：store, product_sku, supplier
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_batch (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL COMMENT '门店ID',
  sku_id INT NOT NULL COMMENT 'SKU ID',
  batch_no VARCHAR(64) NOT NULL COMMENT '批次号',
  quantity INT NOT NULL DEFAULT 0 COMMENT '批次数量',
  locked_quantity INT NOT NULL DEFAULT 0 COMMENT '锁定数量',
  production_date DATE DEFAULT NULL COMMENT '生产日期',
  expiry_date DATE DEFAULT NULL COMMENT '过期日期',
  cost_price DECIMAL(10,2) DEFAULT NULL COMMENT '成本价',
  supplier_id INT DEFAULT NULL COMMENT '供应商ID',
  inbound_order_id INT DEFAULT NULL COMMENT '入库单ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_inventory_batch_store_sku (store_id, sku_id),
  KEY idx_inventory_batch_batch_no (batch_no),
  KEY idx_inventory_batch_expiry_date (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存批次表';

-- --------------------------------------------------------------------------
-- 2.13 追溯码表
-- 来源：Phase 4 (phase4_schema.sql)
-- 依赖：product_sku, product_category, store, supplier
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trace_code (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trace_code VARCHAR(32) NOT NULL UNIQUE,
  sku_id INT NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) DEFAULT '',
  batch_no VARCHAR(64) DEFAULT '',
  production_date DATE DEFAULT NULL,
  expiry_date DATE DEFAULT NULL,
  shelf_life_days INT DEFAULT NULL,
  code_mode ENUM('ONE_PER_ITEM','ONE_PER_BATCH') DEFAULT 'ONE_PER_BATCH',
  category_id INT DEFAULT NULL COMMENT '分类ID',
  current_status ENUM('PRODUCED','PURCHASED','TRANSFERRED','ALLOCATED','ON_SHELF','SOLD','WHOLESALE_SOLD','DELIVERING','DELIVERED','RETURNED','DESTROYED','EXPIRED','RECALLED') DEFAULT 'PRODUCED',
  current_location VARCHAR(128) DEFAULT '',
  store_id INT DEFAULT NULL COMMENT '门店ID',
  warehouse_id INT DEFAULT NULL,
  order_id INT DEFAULT NULL,
  supplier_id INT DEFAULT NULL COMMENT '供应商ID',
  quality_check_result ENUM('PASS','FAIL','PENDING') DEFAULT 'PENDING',
  first_scan_at DATETIME DEFAULT NULL,
  first_scan_ip VARCHAR(45) DEFAULT NULL,
  scan_count INT DEFAULT 0,
  fraud_alert TINYINT DEFAULT 0,
  produced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_trace_code_sku (sku_id),
  KEY idx_trace_code_batch (batch_no),
  KEY idx_trace_code_status (current_status),
  KEY idx_trace_code_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='追溯码表';

-- ============================================================================
-- 第三部分：业务单据表（依赖基础表和关联表）
-- ============================================================================

-- --------------------------------------------------------------------------
-- 3.1 小程序订单表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：member, store
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS miniapp_order (
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

-- --------------------------------------------------------------------------
-- 3.2 小程序订单明细表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：miniapp_order, product_sku
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS miniapp_order_item (
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

-- --------------------------------------------------------------------------
-- 3.3 线下销售单表
-- 来源：Phase 1 (phase1_schema.sql) + Phase 2 ALTER（赊销字段）
-- 依赖：store, member (customer_id), sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_bill (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '销售单ID',
  bill_no VARCHAR(64) NOT NULL COMMENT '销售单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID，可为空',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  customer_type VARCHAR(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户身份快照',
  sale_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '销售类型：CASH(现销)/CREDIT(赊销)',
  business_status VARCHAR(32) NOT NULL DEFAULT 'CREATED' COMMENT '业务状态：DRAFT/CREATED/COMPLETED/VOIDED/RETURNED',
  collection_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '收款状态：UNPAID/PENDING/SHARED/PARTIAL/PAID/OVERDUE/CLOSED',
  due_date DATE DEFAULT NULL COMMENT '应收截止日期（赊销时）',
  statement_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联对账单ID',
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

-- --------------------------------------------------------------------------
-- 3.4 线下销售单明细表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：sale_bill, product_sku
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_bill_item (
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

-- --------------------------------------------------------------------------
-- 3.5 销售退货单表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：store, member (customer_id), sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_return (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '销售退货单ID',
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  source_bill_no VARCHAR(64) DEFAULT NULL COMMENT '关联销售单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  return_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING(待审核)/COMPLETED(已完成)/VOIDED(已作废)',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应退金额',
  refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已退金额',
  refund_method VARCHAR(32) DEFAULT NULL COMMENT '退款方式：CASH(现金)/WECHAT(微信原路退回)/BANK(银行转账)',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '退货人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_return_no (return_no),
  KEY idx_sale_return_source_bill (source_bill_no),
  KEY idx_sale_return_customer (customer_id),
  KEY idx_sale_return_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售退货单表';

-- --------------------------------------------------------------------------
-- 3.6 销售退货单明细表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：sale_return, product_sku
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_return_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '退货单价（瓶）',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计',
  reason VARCHAR(255) DEFAULT NULL COMMENT '退货原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sale_return_item_return_no (return_no),
  KEY idx_sale_return_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售退货单明细表';

-- --------------------------------------------------------------------------
-- 3.7 采购订单表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：supplier, store, sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购订单ID',
  order_no VARCHAR(64) NOT NULL COMMENT '采购订单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '入库门店ID',
  order_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '订单状态：DRAFT/PENDING/APPROVED/PARTIAL/COMPLETED/CANCELLED',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  payable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应付金额',
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已付金额',
  unpaid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未付金额',
  expected_date DATE DEFAULT NULL COMMENT '预计到货日期',
  actual_date DATE DEFAULT NULL COMMENT '实际到货日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '制单人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_order_no (order_no),
  KEY idx_purchase_order_supplier (supplier_id),
  KEY idx_purchase_order_status (order_status),
  KEY idx_purchase_order_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单表';

-- --------------------------------------------------------------------------
-- 3.8 采购订单明细表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：purchase_order, product_sku
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL COMMENT '采购订单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  barcode VARCHAR(128) DEFAULT NULL COMMENT '条码快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '采购单价（瓶）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '税率',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL COMMENT '含税小计',
  in_stocked_qty INT NOT NULL DEFAULT 0 COMMENT '已入库数量',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_order_item_order_no (order_no),
  KEY idx_purchase_order_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单明细表';

-- --------------------------------------------------------------------------
-- 3.9 采购入库单表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：supplier, store, sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_in_stock (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购入库单ID',
  stock_no VARCHAR(64) NOT NULL COMMENT '入库单号',
  order_no VARCHAR(64) DEFAULT NULL COMMENT '关联采购订单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '入库门店ID',
  stock_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/COMPLETED/VOIDED',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '合计金额',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '入库人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_in_stock_no (stock_no),
  KEY idx_purchase_in_stock_order (order_no),
  KEY idx_purchase_in_stock_supplier (supplier_id),
  KEY idx_purchase_in_stock_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购入库单表';

-- --------------------------------------------------------------------------
-- 3.10 采购入库单明细表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：purchase_in_stock, product_sku
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_in_stock_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stock_no VARCHAR(64) NOT NULL COMMENT '入库单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '入库单价（瓶）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '税率',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL COMMENT '含税小计',
  batch_no VARCHAR(64) DEFAULT NULL COMMENT '批次号',
  production_date DATE DEFAULT NULL COMMENT '生产日期',
  expiry_date DATE DEFAULT NULL COMMENT '有效期至',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_in_stock_item_stock_no (stock_no),
  KEY idx_purchase_in_stock_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购入库单明细表';

-- --------------------------------------------------------------------------
-- 3.11 采购退货单表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：supplier, store, sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_return (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购退货单ID',
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  order_no VARCHAR(64) DEFAULT NULL COMMENT '关联采购订单号',
  stock_no VARCHAR(64) DEFAULT NULL COMMENT '关联入库单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '退货门店ID',
  return_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/COMPLETED/VOIDED',
  goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '合计金额',
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应退金额',
  refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已退金额',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '退货人',
  auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人',
  audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_return_no (return_no),
  KEY idx_purchase_return_supplier (supplier_id),
  KEY idx_purchase_return_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购退货单表';

-- --------------------------------------------------------------------------
-- 3.12 采购退货单明细表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：purchase_return, product_sku
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_return_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_no VARCHAR(64) NOT NULL COMMENT '退货单号',
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称快照',
  box_qty INT NOT NULL DEFAULT 0 COMMENT '箱数',
  bottle_qty INT NOT NULL DEFAULT 0 COMMENT '瓶数',
  total_bottle_qty INT NOT NULL COMMENT '合计瓶数',
  unit_price DECIMAL(12,2) NOT NULL COMMENT '退货单价（瓶）',
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0.0000 COMMENT '税率',
  subtotal_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
  total_amount DECIMAL(12,2) NOT NULL COMMENT '含税小计',
  reason VARCHAR(255) DEFAULT NULL COMMENT '退货原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchase_return_item_return_no (return_no),
  KEY idx_purchase_return_item_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购退货单明细表';

-- --------------------------------------------------------------------------
-- 3.13 采购付款单表
-- 来源：Phase 2 (phase2_schema.sql) - 合并 Phase 2 和 Phase 6，保留 Phase 2（更详细）
-- 依赖：supplier, sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_payment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购付款单ID',
  payment_no VARCHAR(64) NOT NULL COMMENT '付款单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  supplier_name VARCHAR(128) NOT NULL COMMENT '供应商名称快照',
  payment_type VARCHAR(32) NOT NULL DEFAULT 'ORDER' COMMENT '付款类型：ORDER/RETURN/ADVANCE',
  source_type VARCHAR(32) DEFAULT NULL COMMENT '来源类型：PURCHASE_ORDER/PURCHASE_RETURN',
  source_no VARCHAR(64) DEFAULT NULL COMMENT '来源单号',
  amount DECIMAL(12,2) NOT NULL COMMENT '付款金额',
  payment_method VARCHAR(32) NOT NULL DEFAULT 'BANK' COMMENT '付款方式：BANK/CASH/WECHAT/ALIPAY',
  bank_account VARCHAR(64) DEFAULT NULL COMMENT '收款账号',
  bank_account_name VARCHAR(64) DEFAULT NULL COMMENT '收款人',
  bank_name VARCHAR(128) DEFAULT NULL COMMENT '收款银行',
  voucher_no VARCHAR(64) DEFAULT NULL COMMENT '凭证号',
  payment_date DATE NOT NULL COMMENT '付款日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '付款人',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/COMPLETED/VOIDED',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_purchase_payment_no (payment_no),
  KEY idx_purchase_payment_supplier (supplier_id),
  KEY idx_purchase_payment_source (source_type, source_no),
  KEY idx_purchase_payment_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购付款单表';

-- --------------------------------------------------------------------------
-- 3.14 供应商对账单表
-- 来源：Phase 6 (phase6_schema.sql)
-- 依赖：supplier
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_statement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  statement_no VARCHAR(30) NOT NULL UNIQUE COMMENT '对账单号',
  supplier_id BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  period_start DATE NOT NULL COMMENT '对账开始日期',
  period_end DATE NOT NULL COMMENT '对账结束日期',
  total_purchase_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '采购总额',
  total_paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已付总额',
  total_return_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '退货总额',
  balance_amount DECIMAL(12,2) GENERATED ALWAYS AS (total_purchase_amount - total_paid_amount - total_return_amount) STORED COMMENT '余额',
  status ENUM('DRAFT','CONFIRMED','DISPUTED') NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
  confirmed_by BIGINT DEFAULT NULL COMMENT '确认人',
  confirmed_at DATETIME DEFAULT NULL COMMENT '确认时间',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_supplier_statement_supplier_id (supplier_id),
  KEY idx_supplier_statement_status (status),
  KEY idx_supplier_statement_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商对账单表';

-- --------------------------------------------------------------------------
-- 3.15 供应商对账明细表
-- 来源：Phase 6 (phase6_schema.sql)
-- 依赖：supplier_statement, purchase_order
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_statement_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  statement_id BIGINT UNSIGNED NOT NULL COMMENT '对账单ID',
  purchase_order_id BIGINT UNSIGNED NOT NULL COMMENT '采购订单ID',
  purchase_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '采购金额',
  payment_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '付款金额',
  return_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '退货金额',
  balance DECIMAL(12,2) GENERATED ALWAYS AS (purchase_amount - payment_amount - return_amount) STORED COMMENT '余额',
  KEY idx_supplier_statement_item_statement_id (statement_id),
  KEY idx_supplier_statement_item_purchase_order_id (purchase_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商对账明细表';

-- --------------------------------------------------------------------------
-- 3.16 客户对账单表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：member (customer_id), sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_statement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '对账单ID',
  statement_no VARCHAR(64) NOT NULL COMMENT '对账单号',
  customer_id BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) NOT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  statement_type VARCHAR(32) NOT NULL DEFAULT 'MONTHLY' COMMENT '对账类型：MONTHLY/QUARTERLY/CUSTOM',
  start_date DATE NOT NULL COMMENT '对账开始日期',
  end_date DATE NOT NULL COMMENT '对账结束日期',
  opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '期初余额',
  total_sales DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '本期销售',
  total_returns DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '本期退货',
  total_payments DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '本期收款',
  closing_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '期末余额',
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态：DRAFT/CONFIRMED/PAID',
  confirmed_at DATETIME DEFAULT NULL COMMENT '确认时间',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '制单人',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_customer_statement_no (statement_no),
  KEY idx_customer_statement_customer (customer_id),
  KEY idx_customer_statement_period (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户对账单表';

-- --------------------------------------------------------------------------
-- 3.17 客户收款单表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：member (customer_id), sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_payment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '客户收款单ID',
  receipt_no VARCHAR(64) NOT NULL COMMENT '收款单号',
  customer_id BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) NOT NULL COMMENT '客户名称快照',
  amount DECIMAL(12,2) NOT NULL COMMENT '收款金额',
  payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '收款方式：CASH/BANK/WECHAT/ALIPAY/COLLECTION',
  source_type VARCHAR(32) DEFAULT NULL COMMENT '来源类型：SALE_BILL/STATEMENT',
  source_no VARCHAR(64) DEFAULT NULL COMMENT '来源单号',
  voucher_no VARCHAR(64) DEFAULT NULL COMMENT '凭证号',
  payment_date DATE NOT NULL COMMENT '收款日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '收款人',
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' COMMENT '状态：COMPLETED/VOIDED',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_customer_payment_receipt_no (receipt_no),
  KEY idx_customer_payment_customer (customer_id),
  KEY idx_customer_payment_source (source_type, source_no),
  KEY idx_customer_payment_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户收款单表';

-- --------------------------------------------------------------------------
-- 3.18 销售收款单表
-- 来源：Phase 2 (phase2_schema.sql)
-- 依赖：member (customer_id), sys_user (operator_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_payment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '销售收款单ID',
  receipt_no VARCHAR(64) NOT NULL COMMENT '收款单号',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：SALE_BILL/SALE_RETURN/STATEMENT',
  source_no VARCHAR(64) NOT NULL COMMENT '来源单号',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  amount DECIMAL(12,2) NOT NULL COMMENT '收款金额',
  payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '收款方式：CASH/WECHAT/ALIPAY/BANK/COLLECTION',
  voucher_no VARCHAR(64) DEFAULT NULL COMMENT '凭证号',
  payment_date DATE NOT NULL COMMENT '收款日期',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '收款人',
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' COMMENT '状态：COMPLETED/VOIDED',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_payment_receipt_no (receipt_no),
  KEY idx_sale_payment_source (source_type, source_no),
  KEY idx_sale_payment_customer (customer_id),
  KEY idx_sale_payment_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售收款单表';

-- --------------------------------------------------------------------------
-- 3.19 分享收款链接表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：member (customer_id), sys_user (share_user_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_link (
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

-- --------------------------------------------------------------------------
-- 3.20 应收账款表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：store, member (customer_id)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receivable_account (
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

-- --------------------------------------------------------------------------
-- 3.21 支付单表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：miniapp_order, sale_bill, collection_link
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_order (
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

-- --------------------------------------------------------------------------
-- 3.22 退款单表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：payment_order
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refund_order (
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

-- --------------------------------------------------------------------------
-- 3.23 门店挂单表
-- 来源：Phase 1 (phase1_schema.sql)
-- 依赖：store
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hold_order (
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

-- --------------------------------------------------------------------------
-- 3.24 系统通知表
-- 来源：Phase 6 (phase6_schema.sql)
-- 说明：系统消息通知（订单、支付、预警、授信、召回等）
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipient_id BIGINT UNSIGNED NOT NULL COMMENT '接收人ID',
  recipient_type ENUM('ADMIN','MERCHANT','CONSUMER') NOT NULL DEFAULT 'ADMIN' COMMENT '接收人类型',
  title VARCHAR(200) NOT NULL COMMENT '通知标题',
  content TEXT DEFAULT NULL COMMENT '通知内容',
  type ENUM('SYSTEM','ORDER','PAYMENT','ALERT','CREDIT','RECALL') NOT NULL DEFAULT 'SYSTEM' COMMENT '通知类型',
  related_id BIGINT DEFAULT NULL COMMENT '关联业务ID',
  related_type VARCHAR(50) DEFAULT NULL COMMENT '关联业务类型',
  is_read TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已读',
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  read_at DATETIME DEFAULT NULL COMMENT '阅读时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_recipient (recipient_id, recipient_type),
  KEY idx_notification_type (type),
  KEY idx_notification_is_read (is_read),
  KEY idx_notification_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统通知表';

-- ============================================================================
-- 第四部分：日志与审计表
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4.1 操作日志表
-- 来源：Phase 1 (phase1_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operation_log (
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

-- --------------------------------------------------------------------------
-- 4.2 分享收款访问日志表
-- 来源：Phase 1 (phase1_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_view_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  link_no VARCHAR(64) NOT NULL COMMENT '分享收款单号',
  ip VARCHAR(64) DEFAULT NULL COMMENT '访问IP',
  user_agent VARCHAR(512) DEFAULT NULL COMMENT '用户代理',
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '访问时间',
  PRIMARY KEY (id),
  KEY idx_collection_view_log_link_no (link_no),
  KEY idx_collection_view_log_viewed_at (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分享收款访问日志表';

-- --------------------------------------------------------------------------
-- 4.3 价格修改日志表
-- 来源：Phase 1 (phase1_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_price_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '操作人ID',
  price_type VARCHAR(32) NOT NULL COMMENT '价格类型：COST/RETAIL/WHOLESALE/MINIAPP/STORE',
  old_price DECIMAL(12,2) DEFAULT NULL COMMENT '原价格',
  new_price DECIMAL(12,2) DEFAULT NULL COMMENT '新价格',
  action_type VARCHAR(32) NOT NULL COMMENT '操作类型：CREATE/UPDATE/CLEAR',
  ip VARCHAR(64) DEFAULT NULL COMMENT 'IP',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_price_log_sku_id (sku_id),
  KEY idx_product_price_log_operator_id (operator_id),
  KEY idx_product_price_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格修改日志表';

-- --------------------------------------------------------------------------
-- 4.4 库存流水表
-- 来源：Phase 1 (phase1_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_ledger (
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

-- --------------------------------------------------------------------------
-- 4.5 价格变更历史表
-- 来源：Phase 4 (phase4_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_change_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sku_id INT NOT NULL COMMENT 'SKU ID',
  price_level_id INT NOT NULL COMMENT '价格等级ID',
  old_price DECIMAL(12,2) COMMENT '原价格',
  new_price DECIMAL(12,2) COMMENT '新价格',
  change_reason VARCHAR(255) DEFAULT '' COMMENT '变更原因',
  changed_by INT NOT NULL COMMENT '变更人',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_price_change_log_sku (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格变更历史表';

-- --------------------------------------------------------------------------
-- 4.6 授信操作日志表
-- 来源：Phase 4 (phase4_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_operation_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL COMMENT '客户ID',
  operation_type ENUM('ADJUST_LIMIT','OCCUPY','RELEASE','FREEZE','UNFREEZE','OVERDUE_DEDUCT','MANUAL_ADJUST') NOT NULL COMMENT '操作类型',
  amount DECIMAL(12,2) NOT NULL COMMENT '变动金额（正=增加，负=减少）',
  balance_before DECIMAL(12,2) NOT NULL COMMENT '操作前可用额度',
  balance_after DECIMAL(12,2) NOT NULL COMMENT '操作后可用额度',
  related_order_no VARCHAR(64) DEFAULT NULL COMMENT '关联订单号',
  operator_id INT NOT NULL COMMENT '操作人',
  remark VARCHAR(255) DEFAULT '' COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_credit_operation_log_customer (customer_id),
  KEY idx_credit_operation_log_order (related_order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='授信操作日志表';

-- --------------------------------------------------------------------------
-- 4.7 催收记录表
-- 来源：Phase 4 (phase4_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_record (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL COMMENT '客户ID',
  receivable_no VARCHAR(64) DEFAULT NULL COMMENT '关联应收单号',
  overdue_days INT DEFAULT 0 COMMENT '逾期天数',
  overdue_amount DECIMAL(12,2) DEFAULT 0 COMMENT '逾期金额',
  collection_level ENUM('REMIND','LIGHT','MEDIUM','HEAVY','SEVERE') NOT NULL COMMENT '催收等级',
  collection_method ENUM('SMS','PHONE','VISIT','LETTER','LEGAL') NOT NULL COMMENT '催收方式',
  collection_content TEXT COMMENT '催收内容',
  contact_person VARCHAR(64) DEFAULT '' COMMENT '联系人',
  contact_result ENUM('PROMISED','REFUSED','NO_ANSWER','PARTIAL_PAID','DISPUTED') DEFAULT NULL COMMENT '催收结果',
  promised_amount DECIMAL(12,2) DEFAULT NULL COMMENT '承诺还款金额',
  promised_date DATE DEFAULT NULL COMMENT '承诺还款日期',
  next_follow_up_date DATE DEFAULT NULL COMMENT '下次跟进日期',
  operator_id INT NOT NULL COMMENT '操作人',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_collection_record_customer (customer_id),
  KEY idx_collection_record_follow_up (next_follow_up_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='催收记录表';

-- --------------------------------------------------------------------------
-- 4.8 预警记录表
-- 来源：Phase 3 (phase3_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '预警记录ID',
  alert_no VARCHAR(64) NOT NULL COMMENT '预警编号',
  rule_id BIGINT UNSIGNED NOT NULL COMMENT '预警规则ID',
  rule_type VARCHAR(32) NOT NULL COMMENT '预警类型：STOCK_LOW/EXPIRY/CREDIT/OVERDUE/STOCK_OVERSTOCK',
  alert_level VARCHAR(16) NOT NULL DEFAULT 'WARNING' COMMENT '预警级别：INFO/WARNING/CRITICAL',
  title VARCHAR(255) NOT NULL COMMENT '预警标题',
  description TEXT DEFAULT NULL COMMENT '预警描述',
  biz_type VARCHAR(64) DEFAULT NULL COMMENT '业务对象类型：SKU/CUSTOMER/SUPPLIER/BILL',
  biz_id BIGINT UNSIGNED DEFAULT NULL COMMENT '业务对象ID',
  biz_no VARCHAR(64) DEFAULT NULL COMMENT '业务对象编号',
  current_value DECIMAL(12,2) DEFAULT NULL COMMENT '当前值',
  threshold_value DECIMAL(12,2) DEFAULT NULL COMMENT '阈值',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/HANDLED/IGNORED',
  handler_id BIGINT UNSIGNED DEFAULT NULL COMMENT '处理人ID',
  handler_name VARCHAR(64) DEFAULT NULL COMMENT '处理人姓名',
  handle_time DATETIME DEFAULT NULL COMMENT '处理时间',
  handle_remark VARCHAR(255) DEFAULT NULL COMMENT '处理备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_alert_record_no (alert_no),
  KEY idx_alert_record_rule (rule_id, rule_type),
  KEY idx_alert_record_status (status),
  KEY idx_alert_record_biz (biz_type, biz_id),
  KEY idx_alert_record_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警记录表';

-- --------------------------------------------------------------------------
-- 4.9 效期预警记录表
-- 来源：Phase 5 (phase5_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expiry_alert_record (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL COMMENT '批次ID',
  store_id INT NOT NULL COMMENT '门店ID',
  sku_id INT NOT NULL COMMENT 'SKU ID',
  sku_name VARCHAR(128) DEFAULT '' COMMENT '商品名称',
  batch_no VARCHAR(64) DEFAULT '' COMMENT '批次号',
  production_date DATE DEFAULT NULL COMMENT '生产日期',
  expiry_date DATE DEFAULT NULL COMMENT '过期日期',
  days_remaining INT NOT NULL COMMENT '剩余天数',
  alert_level TINYINT NOT NULL COMMENT '预警级别',
  action_taken VARCHAR(20) NOT NULL COMMENT '执行动作: REMIND/RESTRICT/BLOCK',
  status ENUM('PENDING','HANDLED','EXPIRED') NOT NULL DEFAULT 'PENDING' COMMENT '状态',
  handled_by INT DEFAULT NULL COMMENT '处理人ID',
  handled_at DATETIME DEFAULT NULL COMMENT '处理时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_expiry_alert_record_batch (batch_id),
  KEY idx_expiry_alert_record_store (store_id),
  KEY idx_expiry_alert_record_status (status),
  KEY idx_expiry_alert_record_alert_level (alert_level),
  UNIQUE KEY uk_expiry_alert_record_batch_level (batch_id, alert_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='效期预警记录表';

-- --------------------------------------------------------------------------
-- 4.10 追溯事件日志表
-- 来源：Phase 4 (phase4_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trace_event_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trace_code VARCHAR(32) NOT NULL COMMENT '追溯码',
  event_type VARCHAR(32) NOT NULL COMMENT '事件类型',
  from_status VARCHAR(32) DEFAULT NULL COMMENT '变更前状态',
  to_status VARCHAR(32) DEFAULT NULL COMMENT '变更后状态',
  operator_type ENUM('SYSTEM','STORE','WAREHOUSE','SUPPLIER','CUSTOMER','ADMIN','PDA') NOT NULL COMMENT '操作人类型',
  operator_id INT DEFAULT NULL COMMENT '操作人ID',
  operator_name VARCHAR(64) DEFAULT '' COMMENT '操作人名称',
  store_id INT DEFAULT NULL COMMENT '门店ID',
  order_id INT DEFAULT NULL COMMENT '订单ID',
  location VARCHAR(128) DEFAULT '' COMMENT '位置',
  remark VARCHAR(255) DEFAULT '' COMMENT '备注',
  extra JSON DEFAULT NULL COMMENT '扩展信息',
  ip VARCHAR(45) DEFAULT '' COMMENT 'IP',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trace_event_log_trace_code (trace_code),
  KEY idx_trace_event_log_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='追溯事件日志表';

-- --------------------------------------------------------------------------
-- 4.11 扫码日志表
-- 来源：Phase 4 (phase4_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trace_scan_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trace_code VARCHAR(32) NOT NULL COMMENT '追溯码',
  scan_type ENUM('CONSUMER','BUSINESS','PDA','ADMIN') NOT NULL COMMENT '扫码类型',
  user_id INT DEFAULT NULL COMMENT '用户ID',
  ip VARCHAR(45) DEFAULT '' COMMENT 'IP',
  result ENUM('SUCCESS','INVALID','NOT_FOUND','FRAUD_ALERT','EXPIRED') DEFAULT 'SUCCESS' COMMENT '扫码结果',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trace_scan_log_trace_code (trace_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='扫码日志表';

-- --------------------------------------------------------------------------
-- 4.12 召回记录表
-- 来源：Phase 4 (phase4_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recall_record (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recall_no VARCHAR(32) NOT NULL UNIQUE COMMENT '召回编号',
  recall_type ENUM('BATCH','CATEGORY','SKU','SUPPLIER','GLOBAL') NOT NULL COMMENT '召回类型',
  target_value VARCHAR(128) NOT NULL COMMENT '目标值',
  target_name VARCHAR(128) DEFAULT '' COMMENT '目标名称',
  reason VARCHAR(255) NOT NULL COMMENT '召回原因',
  total_affected INT DEFAULT 0 COMMENT '影响总数',
  total_notified INT DEFAULT 0 COMMENT '已通知数',
  total_returned INT DEFAULT 0 COMMENT '已退回数',
  status ENUM('CREATED','NOTIFYING','IN_PROGRESS','COMPLETED','CANCELLED') DEFAULT 'CREATED' COMMENT '状态',
  notify_content TEXT DEFAULT NULL COMMENT '通知内容',
  started_at DATETIME DEFAULT NULL COMMENT '开始时间',
  completed_at DATETIME DEFAULT NULL COMMENT '完成时间',
  operator_id INT NOT NULL COMMENT '操作人',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_recall_record_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='召回记录表';

-- --------------------------------------------------------------------------
-- 4.13 门店状态变更记录表
-- 来源：Phase 5 (phase5_schema.sql)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_status_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL COMMENT '门店ID',
  from_status VARCHAR(20) NOT NULL COMMENT '变更前状态',
  to_status VARCHAR(20) NOT NULL COMMENT '变更后状态',
  change_type ENUM('MANUAL','SCHEDULED','AUTO') NOT NULL COMMENT '变更类型',
  operator_id INT DEFAULT NULL COMMENT '操作人ID',
  remark VARCHAR(255) DEFAULT '' COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_store_status_log_store (store_id),
  KEY idx_store_status_log_change_type (change_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店状态变更记录表';

-- ============================================================================
-- 恢复外键检查
-- ============================================================================
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 初始化完成
-- 共计 62 张表
-- ============================================================================
