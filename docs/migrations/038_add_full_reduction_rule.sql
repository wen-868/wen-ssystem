-- 编号: 038, 描述: 添加满减规则表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS full_reduction_rule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL COMMENT '活动ID',
  threshold_amount DECIMAL(10,2) NOT NULL COMMENT '满足金额阈值',
  reduction_amount DECIMAL(10,2) NOT NULL COMMENT '减免金额',
  is_continuous TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否连续满减（每满X减Y）',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_activity (activity_id),
  FOREIGN KEY (activity_id) REFERENCES promotion_activity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='满减规则表';