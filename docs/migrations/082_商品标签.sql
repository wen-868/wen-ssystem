-- 商品标签体系（Phase 3）
-- 日期：2026-06-29

-- 标签组（如：香型、产区、适用场景、年份）
CREATE TABLE IF NOT EXISTS product_tag_group (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL COMMENT '标签组名称',
  code VARCHAR(64) NOT NULL COMMENT '标签组编码',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  is_multiple TINYINT NOT NULL DEFAULT 1 COMMENT '是否多选：1多选 0单选',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='商品标签组表';

-- 标签值（如：酱香型、浓香型、茅台镇、自饮）
CREATE TABLE IF NOT EXISTS product_tag (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL COMMENT '标签组ID',
  name VARCHAR(64) NOT NULL COMMENT '标签名称',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES product_tag_group(id)
) COMMENT='商品标签值表';

-- 商品-标签关联
CREATE TABLE IF NOT EXISTS product_tag_relation (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  spu_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  tag_id BIGINT UNSIGNED NOT NULL COMMENT '标签ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_spu_tag (spu_id, tag_id),
  FOREIGN KEY (spu_id) REFERENCES product_spu(id),
  FOREIGN KEY (tag_id) REFERENCES product_tag(id)
) COMMENT='商品标签关联表';

-- 预置标签组数据
INSERT INTO product_tag_group (name, code, sort_no, is_multiple) VALUES
  ('香型', 'aroma_type', 1, 0),
  ('产区', 'region', 2, 1),
  ('适用场景', 'scene', 3, 1),
  ('年份', 'vintage', 4, 0);

-- 预置香型标签
INSERT INTO product_tag (group_id, name, sort_no) VALUES
  (1, '酱香型', 1), (1, '浓香型', 2), (1, '清香型', 3),
  (1, '米香型', 4), (1, '兼香型', 5), (1, '凤香型', 6);

-- 预置产区标签
INSERT INTO product_tag (group_id, name, sort_no) VALUES
  (2, '茅台镇', 1), (2, '宜宾', 2), (2, '泸州', 3),
  (2, '汾阳', 4), (2, '宿迁', 5), (2, '亳州', 6);

-- 预置场景标签
INSERT INTO product_tag (group_id, name, sort_no) VALUES
  (3, '自饮', 1), (3, '宴请', 2), (3, '送礼', 3),
  (3, '收藏', 4), (3, '商务', 5);

-- 预置年份标签
INSERT INTO product_tag (group_id, name, sort_no) VALUES
  (4, '2025', 1), (4, '2024', 2), (4, '2023', 3),
  (4, '2020', 4), (4, '老年份', 5);