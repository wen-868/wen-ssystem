-- ============================================
-- 智享酒水库存系统 - 第 5 阶段 库存批次FIFO+效期预警 & 门店自动管控
-- 新增：库存批次表、效期预警配置表、效期预警记录表
--       门店管控配置表、门店状态变更记录表
--       store表新增 status 字段
-- ============================================

USE liquor_inventory;

SET FOREIGN_KEY_CHECKS = 0;

-- ========== 库存批次管理 ==========

DROP TABLE IF EXISTS inventory_batch;
CREATE TABLE IF NOT EXISTS inventory_batch (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  KEY idx_store_sku (store_id, sku_id),
  KEY idx_batch_no (batch_no),
  KEY idx_expiry_date (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存批次表';

-- ========== 效期预警配置 ==========

DROP TABLE IF EXISTS expiry_alert_config;
CREATE TABLE IF NOT EXISTS expiry_alert_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alert_level TINYINT NOT NULL COMMENT '预警级别(1/2/3)',
  level_name VARCHAR(20) NOT NULL COMMENT '级别名称(如"三级预警")',
  days_before_expiry INT NOT NULL COMMENT '提前天数',
  action VARCHAR(20) NOT NULL COMMENT '动作: REMIND/RESTRICT/BLOCK',
  color VARCHAR(20) NOT NULL COMMENT '颜色值: #10B981/#F59E0B/#EF4444',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  description VARCHAR(255) DEFAULT '' COMMENT '描述',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='效期预警配置表';

-- 默认预警配置种子数据
INSERT IGNORE INTO expiry_alert_config (alert_level, level_name, days_before_expiry, action, color, enabled, description) VALUES
(1, '一级预警', 30, 'REMIND', '#10B981', 1, '距过期30天，提醒关注'),
(2, '二级预警', 15, 'RESTRICT', '#F59E0B', 1, '距过期15天，限制出库'),
(3, '三级预警', 7, 'BLOCK', '#EF4444', 1, '距过期7天，禁止出库并锁定库存');

-- ========== 效期预警记录 ==========

DROP TABLE IF EXISTS expiry_alert_record;
CREATE TABLE IF NOT EXISTS expiry_alert_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  KEY idx_batch (batch_id),
  KEY idx_store (store_id),
  KEY idx_status (status),
  KEY idx_alert_level (alert_level),
  UNIQUE KEY uk_batch_level (batch_id, alert_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='效期预警记录表';

-- ========== 门店管控配置 ==========

DROP TABLE IF EXISTS store_control_config;
CREATE TABLE IF NOT EXISTS store_control_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL UNIQUE COMMENT '门店ID',
  auto_open_time TIME DEFAULT NULL COMMENT '自动开门时间',
  auto_close_time TIME DEFAULT NULL COMMENT '自动关门时间',
  max_daily_orders INT DEFAULT NULL COMMENT '每日最大订单数',
  max_order_amount DECIMAL(10,2) DEFAULT NULL COMMENT '每日最大订单金额',
  suspended_reason TEXT DEFAULT NULL COMMENT '暂停原因',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店管控配置表';

-- ========== 门店状态变更记录 ==========

DROP TABLE IF EXISTS store_status_log;
CREATE TABLE IF NOT EXISTS store_status_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL COMMENT '门店ID',
  from_status VARCHAR(20) NOT NULL COMMENT '变更前状态',
  to_status VARCHAR(20) NOT NULL COMMENT '变更后状态',
  change_type ENUM('MANUAL','SCHEDULED','AUTO') NOT NULL COMMENT '变更类型',
  operator_id INT DEFAULT NULL COMMENT '操作人ID',
  remark VARCHAR(255) DEFAULT '' COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_store (store_id),
  KEY idx_change_type (change_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店状态变更记录表';

-- ========== store表新增 status 字段 ==========
ALTER TABLE store ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'OPEN' COMMENT '门店状态: OPEN/CLOSED/SUSPENDED' AFTER business_status;

SET FOREIGN_KEY_CHECKS = 1;
