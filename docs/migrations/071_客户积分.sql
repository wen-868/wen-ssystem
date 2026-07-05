-- 编号: 071, 描述: 客户积分, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS customer_points (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  total_points INT DEFAULT 0 COMMENT '累计积分',
  available_points INT DEFAULT 0 COMMENT '可用积分',
  frozen_points INT DEFAULT 0 COMMENT '冻结积分',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customer (customer_id, tenant_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户积分';

-- 积分变动记录
CREATE TABLE IF NOT EXISTS points_record (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  record_no VARCHAR(32) NOT NULL COMMENT '记录编号',
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  type VARCHAR(20) NOT NULL COMMENT '类型: EARN/REDEEM/EXPIRE/ADJUST',
  points INT NOT NULL COMMENT '积分变动数',
  balance_after INT NOT NULL COMMENT '变动后余额',
  source_type VARCHAR(20) DEFAULT NULL COMMENT '来源类型',
  source_no VARCHAR(32) DEFAULT NULL COMMENT '来源单号',
  remark VARCHAR(200) DEFAULT NULL COMMENT '备注',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer (customer_id),
  INDEX idx_type (type),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分变动记录';

-- 积分规则
CREATE TABLE IF NOT EXISTS points_rule (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
  earn_type VARCHAR(20) NOT NULL COMMENT '获取方式: PURCHASE/SIGN_IN/BIRTHDAY/REFERRAL',
  earn_rate DECIMAL(6,4) DEFAULT 0 COMMENT '积分比例',
  daily_limit INT DEFAULT 0 COMMENT '每日上限',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_type (earn_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分规则';

-- 客户等级
CREATE TABLE IF NOT EXISTS customer_level (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  level_name VARCHAR(20) NOT NULL DEFAULT 'VIP1' COMMENT '等级名称',
  level_points INT DEFAULT 0 COMMENT '当前等级积分',
  upgraded_at DATETIME DEFAULT NULL COMMENT '升级时间',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customer (customer_id, tenant_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户等级';

-- 等级配置
CREATE TABLE IF NOT EXISTS level_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  level_name VARCHAR(20) NOT NULL COMMENT '等级名称',
  min_points INT NOT NULL DEFAULT 0 COMMENT '最低积分',
  max_points INT NOT NULL DEFAULT 0 COMMENT '最高积分',
  discount_rate DECIMAL(4,2) DEFAULT 1.00 COMMENT '折扣率',
  benefits JSON DEFAULT NULL COMMENT '权益配置',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_level_name (level_name, tenant_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='等级配置';