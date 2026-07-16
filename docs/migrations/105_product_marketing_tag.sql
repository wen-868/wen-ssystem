-- 编号: 105, 描述: 商品营销标签字典表, 创建人: 阿坚, 日期: 2026-07-13
-- 用于管理商品营销标签（新品/爆款/推荐/限量/清仓等），区别于商品属性标签（product_tag 香型/产区）
-- 商品上的 marketing_tags JSON 字段引用此处定义的 tag_code

CREATE TABLE IF NOT EXISTS t_product_marketing_tag (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tag_code VARCHAR(32) NOT NULL COMMENT '标签编码（如 NEW/HOT/RECOMMEND）',
  tag_name VARCHAR(64) NOT NULL COMMENT '标签名称（如 新品/爆款/推荐）',
  color VARCHAR(16) NOT NULL DEFAULT '#409EFF' COMMENT '标签颜色（十六进制）',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  tenant_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT '租户ID（空表示平台通用）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code_tenant (tag_code, tenant_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品营销标签字典表';

-- 预置通用营销标签（tenant_id 为空，所有租户通用）
INSERT INTO t_product_marketing_tag (tag_code, tag_name, color, sort_no, status, tenant_id) VALUES
  ('NEW', '新品', '#67C23A', 1, 1, ''),
  ('HOT', '爆款', '#F56C6C', 2, 1, ''),
  ('RECOMMEND', '推荐', '#409EFF', 3, 1, ''),
  ('LIMITED', '限量', '#E6A23C', 4, 1, ''),
  ('CLEARANCE', '清仓', '#909399', 5, 1, '');
