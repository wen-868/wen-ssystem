-- 编号: 037, 描述: 添加促销活动表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS promotion_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_code VARCHAR(32) NOT NULL UNIQUE COMMENT '活动编码',
  activity_name VARCHAR(128) NOT NULL COMMENT '活动名称',
  activity_type VARCHAR(32) NOT NULL COMMENT '活动类型（FULL_REDUCTION/SECKILL/GROUP_BUY/GIFT）',
  activity_desc VARCHAR(500) COMMENT '活动描述',
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME NOT NULL COMMENT '结束时间',
  applicable_scope VARCHAR(32) NOT NULL DEFAULT 'ALL' COMMENT '适用范围（ALL/CATEGORY/PRODUCT/STORE）',
  applicable_ids JSON COMMENT '适用范围ID列表',
  rules JSON NOT NULL COMMENT '活动规则（JSON格式）',
  max_participants INT DEFAULT 0 COMMENT '最大参与人数（0表示不限制）',
  participant_count INT NOT NULL DEFAULT 0 COMMENT '已参与人数',
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT '状态（DRAFT/ACTIVE/PAUSED/ENDED）',
  priority INT NOT NULL DEFAULT 0 COMMENT '优先级（数字越大优先级越高）',
  stackable TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否可与其他活动叠加',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_by INT COMMENT '创建人ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_activity_code (activity_code),
  INDEX idx_activity_type (activity_type),
  INDEX idx_activity_status (status),
  INDEX idx_activity_time (start_time, end_time),
  INDEX idx_activity_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='促销活动表';