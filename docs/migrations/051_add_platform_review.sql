-- 编号: 051, 描述: 添加平台审核表, 创建人: 阿坚, 日期: 2026-07-05
CREATE TABLE IF NOT EXISTS platform_review (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform VARCHAR(32) NOT NULL COMMENT '平台',
  platform_review_id VARCHAR(128) DEFAULT NULL COMMENT '平台评价ID',
  order_no VARCHAR(64) NOT NULL COMMENT '关联订单号',
  rating TINYINT NOT NULL COMMENT '评分：1-5',
  content TEXT DEFAULT NULL COMMENT '评价内容',
  reply_content VARCHAR(500) DEFAULT NULL COMMENT '回复内容',
  replied_at DATETIME DEFAULT NULL COMMENT '回复时间',
  synced_at DATETIME DEFAULT NULL COMMENT '同步时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_platform (platform),
  INDEX idx_rating (rating),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台评价表';