-- 编号: 110, 描述: P2级商品审核, 创建人: 阿坚, 日期: 2026-07-14
-- ============================================
-- P2级功能：商品审核
-- ============================================

-- 1. 商品审核表
CREATE TABLE IF NOT EXISTS `t_product_review` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `review_no` VARCHAR(32) NOT NULL UNIQUE COMMENT '审核单号',
  `product_id` BIGINT NOT NULL COMMENT '商品SPU ID',
  `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称',
  `submitter_id` BIGINT NOT NULL COMMENT '提交人ID',
  `submitter_name` VARCHAR(64) DEFAULT NULL COMMENT '提交人姓名',
  `review_type` VARCHAR(32) NOT NULL DEFAULT 'CREATE' COMMENT '审核类型：CREATE/UPDATE/DELETE',
  `change_content` JSON DEFAULT NULL COMMENT '变更内容',
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '审核状态：PENDING/APPROVED/REJECTED',
  `reviewer_id` BIGINT DEFAULT NULL COMMENT '审核人ID',
  `reviewer_name` VARCHAR(64) DEFAULT NULL COMMENT '审核人姓名',
  `review_comment` VARCHAR(500) DEFAULT NULL COMMENT '审核意见',
  `reviewed_at` DATETIME DEFAULT NULL COMMENT '审核时间',
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_review_no` (`review_no`),
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_submitter` (`submitter_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品审核表';
