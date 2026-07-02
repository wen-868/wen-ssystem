-- 来源: phase10_marketing.sql
CREATE TABLE IF NOT EXISTS group_buy_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL COMMENT '活动ID',
  group_size INT NOT NULL COMMENT '成团人数',
  group_price DECIMAL(10,2) NOT NULL COMMENT '拼团价格',
  original_price DECIMAL(10,2) NOT NULL COMMENT '原价',
  time_limit_hours INT NOT NULL DEFAULT 24 COMMENT '成团时限（小时）',
  auto_cancel TINYINT(1) NOT NULL DEFAULT 1 COMMENT '未成团是否自动取消',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_activity (activity_id),
  FOREIGN KEY (activity_id) REFERENCES promotion_activity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拼团活动表';