-- 编号: 016, 描述: 租户订阅配置, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================================
-- 第三阶段：多租户SaaS - 租户/订阅/套餐表设计
-- 任务ID: P2-01
-- 创建时间: 2026-06-23
-- ============================================================

-- 1. 租户表（tenant）
CREATE TABLE IF NOT EXISTS t_tenant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_code VARCHAR(32) NOT NULL UNIQUE COMMENT '租户编码（如：T20260623001）',
  company_name VARCHAR(128) NOT NULL COMMENT '公司名称',
  company_short_name VARCHAR(64) COMMENT '公司简称',
  contact_person VARCHAR(64) NOT NULL COMMENT '联系人',
  contact_mobile VARCHAR(20) NOT NULL COMMENT '联系电话',
  contact_email VARCHAR(128) COMMENT '联系邮箱',
  province VARCHAR(64) COMMENT '省份',
  city VARCHAR(64) COMMENT '城市',
  district VARCHAR(64) COMMENT '区县',
  address VARCHAR(255) COMMENT '详细地址',
  business_license VARCHAR(128) COMMENT '营业执照号',
  legal_person VARCHAR(64) COMMENT '法人代表',
  industry VARCHAR(64) COMMENT '所属行业',
  company_scale VARCHAR(32) COMMENT '公司规模（如：1-10人、11-50人等）',
  source VARCHAR(32) DEFAULT 'MANUAL' COMMENT '来源（MANUAL/SELF_REGISTER/INVITATION）',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/SUSPENDED/EXPIRED/CLOSED）',
  suspend_reason VARCHAR(255) COMMENT '停用原因',
  suspended_at DATETIME COMMENT '停用时间',
  expire_at DATETIME COMMENT '到期时间（冗余字段，便于查询）',
  remark VARCHAR(500) COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant_code (tenant_code),
  INDEX idx_tenant_status (status),
  INDEX idx_tenant_expire (expire_at),
  INDEX idx_tenant_mobile (contact_mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表';

-- 2. 订阅套餐表（subscription_plan）
CREATE TABLE IF NOT EXISTS t_subscription_plan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_code VARCHAR(32) NOT NULL UNIQUE COMMENT '套餐编码（如：BASIC/STANDARD/PROFESSIONAL）',
  plan_name VARCHAR(64) NOT NULL COMMENT '套餐名称',
  plan_type VARCHAR(32) NOT NULL COMMENT '套餐类型（MONTHLY/YEARLY/PERMANENT）',
  price DECIMAL(10,2) NOT NULL COMMENT '价格',
  original_price DECIMAL(10,2) COMMENT '原价',
  duration_days INT NOT NULL COMMENT '有效天数（如：30/365/9999）',
  max_users INT NOT NULL DEFAULT 5 COMMENT '最大用户数',
  max_stores INT NOT NULL DEFAULT 1 COMMENT '最大门店数',
  max_customers INT NOT NULL DEFAULT 1000 COMMENT '最大客户数',
  max_products INT NOT NULL DEFAULT 500 COMMENT '最大商品数',
  max_storage_mb INT NOT NULL DEFAULT 1024 COMMENT '最大存储空间（MB）',
  features JSON COMMENT '功能特性列表（JSON格式）',
  module_access JSON COMMENT '可访问模块（JSON格式，如：["sales","purchase","inventory"]）',
  description VARCHAR(500) COMMENT '套餐描述',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_plan_code (plan_code),
  INDEX idx_plan_status (status),
  INDEX idx_plan_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅套餐表';

-- 3. 订阅表（subscription）
CREATE TABLE IF NOT EXISTS t_subscription (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订阅编号（如：SUB20260623001）',
  tenant_id INT NOT NULL COMMENT '租户ID',
  plan_id INT NOT NULL COMMENT '套餐ID',
  plan_name VARCHAR(64) NOT NULL COMMENT '套餐名称（冗余）',
  plan_type VARCHAR(32) NOT NULL COMMENT '套餐类型',
  start_date DATE NOT NULL COMMENT '开始日期',
  end_date DATE NOT NULL COMMENT '结束日期',
  duration_days INT NOT NULL COMMENT '有效天数',
  price DECIMAL(10,2) NOT NULL COMMENT '订阅价格',
  payment_status VARCHAR(16) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态（UNPAID/PAID/PARTIAL/REFUNDED）',
  payment_method VARCHAR(32) COMMENT '支付方式（WECHAT/ALIPAY/BANK_TRANSFER/CASH）',
  paid_at DATETIME COMMENT '支付时间',
  transaction_no VARCHAR(128) COMMENT '交易流水号',
  auto_renew TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否自动续费',
  renew_price DECIMAL(10,2) COMMENT '续费价格',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/EXPIRED/CANCELLED/SUSPENDED）',
  cancel_reason VARCHAR(255) COMMENT '取消原因',
  cancelled_at DATETIME COMMENT '取消时间',
  expire_notify_sent TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已发送到期通知',
  expire_notify_at DATETIME COMMENT '到期通知发送时间',
  remark VARCHAR(500) COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_subscription_no (subscription_no),
  INDEX idx_subscription_tenant (tenant_id),
  INDEX idx_subscription_plan (plan_id),
  INDEX idx_subscription_status (status),
  INDEX idx_subscription_end_date (end_date),
  INDEX idx_subscription_payment (payment_status),
  
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plan(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅表';

-- 4. 租户模块访问权限表（tenant_module_access）
CREATE TABLE IF NOT EXISTS t_tenant_module_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  module_code VARCHAR(64) NOT NULL COMMENT '模块编码（如：sales/purchase/inventory/marketing）',
  module_name VARCHAR(128) NOT NULL COMMENT '模块名称',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  granted_by VARCHAR(32) NOT NULL DEFAULT 'PLAN' COMMENT '授权方式（PLAN/MANUAL/ADDON）',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  expire_at DATETIME COMMENT '过期时间（NULL表示永久）',
  remark VARCHAR(255) COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_tenant_module (tenant_id, module_code),
  INDEX idx_tenant_module_tenant (tenant_id),
  INDEX idx_tenant_module_enabled (enabled),
  
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户模块访问权限表';

-- 5. 订阅操作日志表（subscription_operation_log）
CREATE TABLE IF NOT EXISTS t_subscription_operation_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL COMMENT '订阅ID',
  operation_type VARCHAR(32) NOT NULL COMMENT '操作类型（CREATE/RENEW/UPGRADE/DOWNGRADE/CANCEL/SUSPEND/RESUME）',
  old_plan_id INT COMMENT '原套餐ID',
  new_plan_id INT COMMENT '新套餐ID',
  old_end_date DATE COMMENT '原结束日期',
  new_end_date DATE COMMENT '新结束日期',
  amount DECIMAL(10,2) COMMENT '涉及金额',
  operator_id INT COMMENT '操作人ID',
  operator_name VARCHAR(64) COMMENT '操作人姓名',
  remark VARCHAR(500) COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_log_subscription (subscription_id),
  INDEX idx_log_operation (operation_type),
  INDEX idx_log_created (created_at),
  
  FOREIGN KEY (subscription_id) REFERENCES subscription(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅操作日志表';

-- 6. 租户管理员表（tenant_admin）
CREATE TABLE IF NOT EXISTS t_tenant_admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL COMMENT '租户ID',
  user_id INT NOT NULL COMMENT '用户ID（关联sys_user）',
  role VARCHAR(32) NOT NULL DEFAULT 'ADMIN' COMMENT '角色（ADMIN/SUPER_ADMIN）',
  is_primary TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否主管理员',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_tenant_user (tenant_id, user_id),
  INDEX idx_tenant_admin_tenant (tenant_id),
  INDEX idx_tenant_admin_user (user_id),
  
  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户管理员表';

-- ============================================================
-- 初始化默认套餐数据
-- ============================================================

INSERT INTO t_subscription_plan (plan_code, plan_name, plan_type, price, original_price, duration_days, max_users, max_stores, max_customers, max_products, max_storage_mb, features, module_access, description, sort_order, status) VALUES
('BASIC_MONTHLY', '基础版-月付', 'MONTHLY', 299.00, 299.00, 30, 3, 1, 500, 200, 512, 
 '["basic_sales","basic_inventory","basic_report"]',
 '["dashboard","sales","inventory","customer","report"]',
 '适合小型商户，基础进销存功能', 1, 'ACTIVE'),

('BASIC_YEARLY', '基础版-年付', 'YEARLY', 2990.00, 3588.00, 365, 3, 1, 500, 200, 512,
 '["basic_sales","basic_inventory","basic_report"]',
 '["dashboard","sales","inventory","customer","report"]',
 '适合小型商户，年付优惠', 2, 'ACTIVE'),

('STANDARD_MONTHLY', '标准版-月付', 'MONTHLY', 599.00, 599.00, 30, 10, 3, 2000, 1000, 2048,
 '["basic_sales","basic_inventory","basic_purchase","basic_report","credit_management"]',
 '["dashboard","sales","inventory","purchase","customer","credit","report"]',
 '适合中型商户，增加采购和信用管理', 3, 'ACTIVE'),

('STANDARD_YEARLY', '标准版-年付', 'YEARLY', 5990.00, 7188.00, 365, 10, 3, 2000, 1000, 2048,
 '["basic_sales","basic_inventory","basic_purchase","basic_report","credit_management"]',
 '["dashboard","sales","inventory","purchase","customer","credit","report"]',
 '适合中型商户，年付优惠', 4, 'ACTIVE'),

('PROFESSIONAL_MONTHLY', '专业版-月付', 'MONTHLY', 999.00, 999.00, 30, 30, 10, 10000, 5000, 5120,
 '["full_sales","full_inventory","full_purchase","full_report","credit_management","marketing","approval"]',
 '["dashboard","sales","inventory","purchase","customer","credit","marketing","approval","report"]',
 '适合大型商户，全功能版本', 5, 'ACTIVE'),

('PROFESSIONAL_YEARLY', '专业版-年付', 'YEARLY', 9990.00, 11988.00, 365, 30, 10, 10000, 5000, 5120,
 '["full_sales","full_inventory","full_purchase","full_report","credit_management","marketing","approval"]',
 '["dashboard","sales","inventory","purchase","customer","credit","marketing","approval","report"]',
 '适合大型商户，年付优惠', 6, 'ACTIVE');

-- ============================================================
-- 初始化默认租户（系统默认租户）
-- ============================================================

INSERT INTO t_tenant (tenant_code, company_name, contact_person, contact_mobile, status, expire_at) VALUES
('DEFAULT', '系统默认租户', '系统管理员', '13800000000', 'ACTIVE', '2099-12-31 23:59:59');

-- 为默认租户创建管理员关联（假设sys_user中id=1为超级管理员）
-- INSERT INTO t_tenant_admin (tenant_id, user_id, role, is_primary) VALUES
-- (1, 1, 'SUPER_ADMIN', 1);

-- 为默认租户授权所有模块
INSERT INTO t_tenant_module_access (tenant_id, module_code, module_name, enabled, granted_by) VALUES
(1, 'dashboard', '工作台', 1, 'MANUAL'),
(1, 'sales', '销售管理', 1, 'MANUAL'),
(1, 'purchase', '采购管理', 1, 'MANUAL'),
(1, 'inventory', '库存管理', 1, 'MANUAL'),
(1, 'customer', '客户管理', 1, 'MANUAL'),
(1, 'product', '商品中心', 1, 'MANUAL'),
(1, 'credit', '财务管理', 1, 'MANUAL'),
(1, 'report', '数据报表', 1, 'MANUAL'),
(1, 'marketing', '营销推广', 1, 'MANUAL'),
(1, 'instant_retail', '即时零售', 1, 'MANUAL'),
(1, 'approval', '审批流程', 1, 'MANUAL'),
(1, 'system', '系统管理', 1, 'MANUAL');
