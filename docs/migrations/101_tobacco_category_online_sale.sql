ALTER TABLE t_product_category
ADD COLUMN allow_online_sale TINYINT NOT NULL DEFAULT 1 COMMENT '是否允许线上销售：1允许 0禁止';

-- 烟草分类种子数据（allow_online_sale=0 禁止线上销售）
-- 注意：租户ID需要根据实际情况替换，此处使用占位符
INSERT IGNORE INTO t_product_category (id, tenant_id, parent_id, name, sort_no, status, allow_online_sale, code) VALUES
(100, 'system', NULL, '烟草', 6, 1, 0, 'TOBACCO'),
(101, 'system', 100,  '卷烟', 1, 1, 0, 'CIGARETTE'),
(102, 'system', 100,  '雪茄', 2, 1, 0, 'CIGAR'),
(103, 'system', 100,  '烟丝', 3, 1, 0, 'TOBACCO_LEAF'),
(104, 'system', 100,  '其他烟草', 4, 1, 0, 'OTHER_TOBACCO');
