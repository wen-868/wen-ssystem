-- ============================================
-- 智享酒水库存系统 - 第 4 阶段 阶梯价体系 & 批发客户授信管理
-- 新增：价格等级表、阶梯价格表、客户价格等级绑定、价格变更历史
--       客户授信额度表、授信操作日志、催收记录表
-- ============================================

USE liquor_inventory;

SET FOREIGN_KEY_CHECKS = 0;

-- ========== 阶梯价体系 ==========

-- 价格等级表（比文档更完善：增加折扣率、最低订单金额门槛、说明、排序）
DROP TABLE IF EXISTS price_level;
CREATE TABLE IF NOT EXISTS price_level (
  id INT AUTO_INCREMENT PRIMARY KEY,
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

-- 阶梯价格表（比文档更完善：增加成本价、建议零售价、生效时间范围）
DROP TABLE IF EXISTS sku_price;
CREATE TABLE IF NOT EXISTS sku_price (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku_id INT NOT NULL,
  price_level_id INT NOT NULL,
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
  KEY idx_sku (sku_id),
  KEY idx_level (price_level_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='阶梯价格表';

-- 客户价格等级绑定（比文档更完善：增加审批流程、到期时间）
DROP TABLE IF EXISTS customer_price_binding;
CREATE TABLE IF NOT EXISTS customer_price_binding (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  price_level_id INT NOT NULL,
  apply_reason VARCHAR(255) DEFAULT '' COMMENT '申请原因',
  status ENUM('PENDING','APPROVED','REJECTED','EXPIRED') DEFAULT 'PENDING',
  approved_by INT DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  expire_at DATETIME DEFAULT NULL COMMENT '到期时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customer (customer_id),
  KEY idx_level (price_level_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户价格等级绑定表';

-- 价格变更历史（审计日志）
DROP TABLE IF EXISTS price_change_log;
CREATE TABLE IF NOT EXISTS price_change_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku_id INT NOT NULL,
  price_level_id INT NOT NULL,
  old_price DECIMAL(12,2),
  new_price DECIMAL(12,2),
  change_reason VARCHAR(255) DEFAULT '',
  changed_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sku (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格变更历史表';

-- 默认价格等级数据
INSERT IGNORE INTO price_level (level_code, level_name, discount_rate, min_order_amount, description, sort_order) VALUES
('RETAIL', '零售价', 1.0000, 0, '面向终端消费者的标准零售价格', 1),
('WHOLESALE_L1', '批发一级', 0.92, 0, '小批量批发，92折', 2),
('WHOLESALE_L2', '批发二级', 0.85, 500, '中批量批发，500元起85折', 3),
('WHOLESALE_L3', '批发三级', 0.78, 2000, '大批量批发，2000元起78折', 4),
('AGREEMENT', '协议价', 0.80, 0, '与客户单独协商的协议价格', 5),
('VIP', 'VIP会员价', 0.90, 0, 'VIP会员专属价格', 6),
('STORE', '门店价', 0.95, 0, '门店自用价格', 7),
('MINIAPP', '小程序价', 0.95, 0, '小程序渠道专属价', 8);

-- ========== 批发客户授信管理 ==========

-- 客户授信额度表（比文档更完善：增加冻结原因、解冻流程、预警阈值、乐观锁）
DROP TABLE IF EXISTS customer_credit;
CREATE TABLE IF NOT EXISTS customer_credit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL UNIQUE,
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

-- 授信操作日志（比文档新增：完整审计追踪）
DROP TABLE IF EXISTS credit_operation_log;
CREATE TABLE IF NOT EXISTS credit_operation_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  operation_type ENUM('ADJUST_LIMIT','OCCUPY','RELEASE','FREEZE','UNFREEZE','OVERDUE_DEDUCT','MANUAL_ADJUST') NOT NULL,
  amount DECIMAL(12,2) NOT NULL COMMENT '变动金额（正=增加，负=减少）',
  balance_before DECIMAL(12,2) NOT NULL COMMENT '操作前可用额度',
  balance_after DECIMAL(12,2) NOT NULL COMMENT '操作后可用额度',
  related_order_no VARCHAR(64) DEFAULT NULL COMMENT '关联订单号',
  operator_id INT NOT NULL,
  remark VARCHAR(255) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer (customer_id),
  KEY idx_order (related_order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='授信操作日志表';

-- 催收记录表（比文档更完善：增加催收结果、跟进提醒、承诺还款）
DROP TABLE IF EXISTS collection_record;
CREATE TABLE IF NOT EXISTS collection_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  receivable_no VARCHAR(64) DEFAULT NULL COMMENT '关联应收单号',
  overdue_days INT DEFAULT 0,
  overdue_amount DECIMAL(12,2) DEFAULT 0,
  collection_level ENUM('REMIND','LIGHT','MEDIUM','HEAVY','SEVERE') NOT NULL COMMENT '催收等级',
  collection_method ENUM('SMS','PHONE','VISIT','LETTER','LEGAL') NOT NULL COMMENT '催收方式',
  collection_content TEXT COMMENT '催收内容',
  contact_person VARCHAR(64) DEFAULT '' COMMENT '联系人',
  contact_result ENUM('PROMISED','REFUSED','NO_ANSWER','PARTIAL_PAID','DISPUTED') DEFAULT NULL COMMENT '催收结果',
  promised_amount DECIMAL(12,2) DEFAULT NULL COMMENT '承诺还款金额',
  promised_date DATE DEFAULT NULL COMMENT '承诺还款日期',
  next_follow_up_date DATE DEFAULT NULL COMMENT '下次跟进日期',
  operator_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer (customer_id),
  KEY idx_follow_up (next_follow_up_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='催收记录表';

SET FOREIGN_KEY_CHECKS = 1;

-- ========== 追溯服务 ==========

-- 追溯配置表
CREATE TABLE IF NOT EXISTS trace_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 追溯码表
CREATE TABLE IF NOT EXISTS trace_code (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trace_code VARCHAR(32) NOT NULL UNIQUE,
  sku_id INT NOT NULL,
  sku_name VARCHAR(128) DEFAULT '',
  batch_no VARCHAR(64) DEFAULT '',
  production_date DATE DEFAULT NULL,
  expiry_date DATE DEFAULT NULL,
  shelf_life_days INT DEFAULT NULL,
  code_mode ENUM('ONE_PER_ITEM','ONE_PER_BATCH') DEFAULT 'ONE_PER_BATCH',
  category_id INT DEFAULT NULL,
  current_status ENUM('PRODUCED','PURCHASED','TRANSFERRED','ALLOCATED','ON_SHELF','SOLD','WHOLESALE_SOLD','DELIVERING','DELIVERED','RETURNED','DESTROYED','EXPIRED','RECALLED') DEFAULT 'PRODUCED',
  current_location VARCHAR(128) DEFAULT '',
  store_id INT DEFAULT NULL,
  warehouse_id INT DEFAULT NULL,
  order_id INT DEFAULT NULL,
  supplier_id INT DEFAULT NULL,
  quality_check_result ENUM('PASS','FAIL','PENDING') DEFAULT 'PENDING',
  first_scan_at DATETIME DEFAULT NULL,
  first_scan_ip VARCHAR(45) DEFAULT NULL,
  scan_count INT DEFAULT 0,
  fraud_alert TINYINT DEFAULT 0,
  produced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  version INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sku (sku_id),
  KEY idx_batch (batch_no),
  KEY idx_status (current_status),
  KEY idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 追溯事件日志
CREATE TABLE IF NOT EXISTS trace_event_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trace_code VARCHAR(32) NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  from_status VARCHAR(32) DEFAULT NULL,
  to_status VARCHAR(32) DEFAULT NULL,
  operator_type ENUM('SYSTEM','STORE','WAREHOUSE','SUPPLIER','CUSTOMER','ADMIN','PDA') NOT NULL,
  operator_id INT DEFAULT NULL,
  operator_name VARCHAR(64) DEFAULT '',
  store_id INT DEFAULT NULL,
  order_id INT DEFAULT NULL,
  location VARCHAR(128) DEFAULT '',
  remark VARCHAR(255) DEFAULT '',
  extra JSON DEFAULT NULL,
  ip VARCHAR(45) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trace_code (trace_code),
  KEY idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 扫码日志
CREATE TABLE IF NOT EXISTS trace_scan_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trace_code VARCHAR(32) NOT NULL,
  scan_type ENUM('CONSUMER','BUSINESS','PDA','ADMIN') NOT NULL,
  user_id INT DEFAULT NULL,
  ip VARCHAR(45) DEFAULT '',
  result ENUM('SUCCESS','INVALID','NOT_FOUND','FRAUD_ALERT','EXPIRED') DEFAULT 'SUCCESS',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trace_code (trace_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 召回记录表
CREATE TABLE IF NOT EXISTS recall_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recall_no VARCHAR(32) NOT NULL UNIQUE,
  recall_type ENUM('BATCH','CATEGORY','SKU','SUPPLIER','GLOBAL') NOT NULL,
  target_value VARCHAR(128) NOT NULL,
  target_name VARCHAR(128) DEFAULT '',
  reason VARCHAR(255) NOT NULL,
  total_affected INT DEFAULT 0,
  total_notified INT DEFAULT 0,
  total_returned INT DEFAULT 0,
  status ENUM('CREATED','NOTIFYING','IN_PROGRESS','COMPLETED','CANCELLED') DEFAULT 'CREATED',
  notify_content TEXT DEFAULT NULL,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  operator_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
