-- 编号: 073, 描述: 客户标签画像, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS customer_tag (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tag_name VARCHAR(50) NOT NULL COMMENT '标签名称',
  tag_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL' COMMENT '类型: MANUAL/AUTO',
  tag_group VARCHAR(50) DEFAULT NULL COMMENT '标签分组',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tag_name (tag_name, tenant_id),
  INDEX idx_type (tag_type),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户标签';

-- 客户标签关联
CREATE TABLE IF NOT EXISTS customer_tag_relation (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  tag_id BIGINT NOT NULL COMMENT '标签ID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customer_tag (customer_id, tag_id, tenant_id),
  INDEX idx_customer (customer_id),
  INDEX idx_tag (tag_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户标签关联';

-- 客户画像
CREATE TABLE IF NOT EXISTS customer_profile (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  age_group VARCHAR(20) DEFAULT NULL COMMENT '年龄段',
  gender VARCHAR(10) DEFAULT NULL COMMENT '性别',
  prefer_category VARCHAR(500) DEFAULT NULL COMMENT '偏好品类',
  prefer_brand VARCHAR(500) DEFAULT NULL COMMENT '偏好品牌',
  avg_order_amount DECIMAL(12,2) DEFAULT 0 COMMENT '平均客单价',
  total_order_count INT DEFAULT 0 COMMENT '累计消费次数',
  last_order_at DATETIME DEFAULT NULL COMMENT '最近消费时间',
  total_points INT DEFAULT 0 COMMENT '累计积分',
  member_level VARCHAR(20) DEFAULT NULL COMMENT '会员等级',
  lifecycle_stage VARCHAR(20) DEFAULT 'PROSPECT' COMMENT '生命周期阶段',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customer (customer_id, tenant_id),
  INDEX idx_stage (lifecycle_stage),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户画像';

-- 客户关怀规则
CREATE TABLE IF NOT EXISTS customer_care_rule (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
  trigger_type VARCHAR(20) NOT NULL COMMENT '触发类型: BIRTHDAY/HOLIDAY/INACTIVE/LEVEL_UP',
  template_content TEXT COMMENT '关怀内容模板',
  reward_points INT DEFAULT 0 COMMENT '奖励积分',
  reward_coupon_id BIGINT DEFAULT NULL COMMENT '奖励优惠券ID',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_trigger (trigger_type),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户关怀规则';

-- 客户关怀记录
CREATE TABLE IF NOT EXISTS customer_care_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  rule_id BIGINT NOT NULL COMMENT '关怀规则ID',
  trigger_type VARCHAR(20) NOT NULL COMMENT '触发类型',
  sent_content TEXT COMMENT '发送内容',
  sent_at DATETIME DEFAULT NULL COMMENT '发送时间',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/SENT/FAILED',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer (customer_id),
  INDEX idx_rule (rule_id),
  INDEX idx_status (status),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户关怀记录';

-- 客户分群
CREATE TABLE IF NOT EXISTS customer_segment (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  segment_name VARCHAR(100) NOT NULL COMMENT '分群名称',
  conditions JSON NOT NULL COMMENT '分群条件',
  member_count INT DEFAULT 0 COMMENT '成员数',
  auto_refresh TINYINT DEFAULT 0 COMMENT '是否自动刷新',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户分群';

-- 客户分群成员
CREATE TABLE IF NOT EXISTS customer_segment_member (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  segment_id BIGINT NOT NULL COMMENT '分群ID',
  customer_id BIGINT NOT NULL COMMENT '客户ID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_segment_customer (segment_id, customer_id, tenant_id),
  INDEX idx_segment (segment_id),
  INDEX idx_customer (customer_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户分群成员';