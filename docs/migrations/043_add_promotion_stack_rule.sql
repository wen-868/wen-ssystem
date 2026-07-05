-- 编号: 043, 描述: 添加促销叠加规则表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS promotion_stack_rule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
  priority INT NOT NULL DEFAULT 0 COMMENT '优先级',
  stack_types JSON NOT NULL COMMENT '可叠加的活动类型列表',
  max_discount DECIMAL(10,2) COMMENT '最大优惠金额限制',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动叠加规则表';