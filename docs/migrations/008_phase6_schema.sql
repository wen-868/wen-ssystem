-- 编号: 008, 描述: 第6阶段数据库建表, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================================
-- Phase 6 Schema: 采购付款、供应商对账、RBAC、消息通知
-- ============================================================

-- ========== 采购付款单 ==========
CREATE TABLE IF NOT EXISTS t_purchase_payment (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payment_no VARCHAR(30) NOT NULL UNIQUE,
  purchase_order_id BIGINT NOT NULL,
  supplier_id BIGINT NOT NULL,
  payment_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('BANK_TRANSFER','CASH','CHECK','OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
  bank_account VARCHAR(100) DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL,
  status ENUM('PENDING','APPROVED','PAID','CANCELLED') NOT NULL DEFAULT 'PENDING',
  approved_by BIGINT DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  paid_at DATETIME DEFAULT NULL,
  paid_by BIGINT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_purchase_order_id (purchase_order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购付款单';

-- ========== 供应商对账单 ==========
CREATE TABLE IF NOT EXISTS t_supplier_statement (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  statement_no VARCHAR(30) NOT NULL UNIQUE,
  supplier_id BIGINT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_purchase_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_return_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balance_amount DECIMAL(12,2) GENERATED ALWAYS AS (total_purchase_amount - total_paid_amount - total_return_amount) STORED,
  status ENUM('DRAFT','CONFIRMED','DISPUTED') NOT NULL DEFAULT 'DRAFT',
  confirmed_by BIGINT DEFAULT NULL,
  confirmed_at DATETIME DEFAULT NULL,
  remark VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_status (status),
  INDEX idx_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商对账单';

-- ========== 供应商对账明细 ==========
CREATE TABLE IF NOT EXISTS t_supplier_statement_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  statement_id BIGINT NOT NULL,
  purchase_order_id BIGINT NOT NULL,
  purchase_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  return_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(12,2) GENERATED ALWAYS AS (purchase_amount - payment_amount - return_amount) STORED,
  INDEX idx_statement_id (statement_id),
  INDEX idx_purchase_order_id (purchase_order_id),
  CONSTRAINT fk_statement_item_statement FOREIGN KEY (statement_id) REFERENCES supplier_statement(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商对账明细';

-- ========== RBAC 角色管理 ==========
CREATE TABLE IF NOT EXISTS t_sys_role (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  role_code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(200) DEFAULT NULL,
  status ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  permissions JSON DEFAULT NULL,
  data_scope ENUM('ALL','DEPARTMENT','STORE','SELF') NOT NULL DEFAULT 'SELF',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role_code (role_code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统角色';

-- ========== 用户角色关联 ==========
CREATE TABLE IF NOT EXISTS t_sys_user_role (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role (user_id, role_id),
  INDEX idx_user_id (user_id),
  INDEX idx_role_id (role_id),
  CONSTRAINT fk_user_role_user FOREIGN KEY (user_id) REFERENCES sys_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_role_role FOREIGN KEY (role_id) REFERENCES sys_role(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联';

-- ========== 系统通知 ==========
CREATE TABLE IF NOT EXISTS t_notification (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  recipient_id BIGINT NOT NULL,
  recipient_type ENUM('ADMIN','MERCHANT','CONSUMER') NOT NULL DEFAULT 'ADMIN',
  title VARCHAR(200) NOT NULL,
  content TEXT DEFAULT NULL,
  type ENUM('SYSTEM','ORDER','PAYMENT','ALERT','CREDIT','RECALL') NOT NULL DEFAULT 'SYSTEM',
  related_id BIGINT DEFAULT NULL,
  related_type VARCHAR(50) DEFAULT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recipient (recipient_id, recipient_type),
  INDEX idx_type (type),
  INDEX idx_is_read (is_read),
  INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统通知';

-- ========== 初始化超级管理员角色 ==========
INSERT IGNORE INTO sys_role (role_name, role_code, description, status, permissions, data_scope)
VALUES ('超级管理员', 'SUPER_ADMIN', '拥有系统所有权限', 'ACTIVE', '["*"]', 'ALL');

INSERT IGNORE INTO sys_role (role_name, role_code, description, status, permissions, data_scope)
VALUES ('运营管理员', 'OPERATION_ADMIN', '运营管理权限', 'ACTIVE', '["product:read","product:write","order:read","order:write","customer:read","customer:write","supplier:read","supplier:write","purchase:read","purchase:write","inventory:read","inventory:write","finance:read","finance:write","marketing:read","marketing:write","report:read","system:read"]', 'ALL');

INSERT IGNORE INTO sys_role (role_name, role_code, description, status, permissions, data_scope)
VALUES ('门店管理员', 'STORE_ADMIN', '门店管理权限', 'ACTIVE', '["product:read","order:read","order:write","inventory:read","inventory:write"]', 'STORE');

INSERT IGNORE INTO sys_role (role_name, role_code, description, status, permissions, data_scope)
VALUES ('销售员', 'SALESMAN', '销售相关权限', 'ACTIVE', '["product:read","order:read","order:write","customer:read","customer:write"]', 'SELF');
