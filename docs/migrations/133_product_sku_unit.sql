USE liquor_inventory;

CREATE TABLE IF NOT EXISTS t_product_sku_unit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
  unit_name VARCHAR(16) NOT NULL COMMENT '单位名称（瓶/箱/件/提等）',
  ratio DECIMAL(10,2) NOT NULL DEFAULT 1 COMMENT '换算比例：1单位=ratio个基础单位',
  barcode VARCHAR(128) DEFAULT NULL COMMENT '该单位条码（一品多码）',
  retail_price DECIMAL(12,2) DEFAULT NULL COMMENT '该单位零售价',
  wholesale_price DECIMAL(12,2) DEFAULT NULL COMMENT '该单位批发价',
  store_price DECIMAL(12,2) DEFAULT NULL COMMENT '该单位门店价',
  miniapp_price DECIMAL(12,2) DEFAULT NULL COMMENT '该单位小程序价',
  is_base TINYINT NOT NULL DEFAULT 0 COMMENT '是否基础单位（库存单位）',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sku_unit_name (sku_id, unit_name, tenant_id),
  KEY idx_sku_unit_sku (sku_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SKU多单位与单位价格';

INSERT IGNORE INTO t_product_sku_unit (sku_id, unit_name, ratio, barcode, retail_price, wholesale_price, store_price, miniapp_price, is_base, sort_no, tenant_id)
SELECT s.id, s.base_unit, 1, s.barcode, pp.retail_price, pp.wholesale_price, pp.store_price, pp.miniapp_price, 1, 1, s.tenant_id
FROM t_product_sku s
LEFT JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
WHERE s.base_unit IS NOT NULL AND s.base_unit <> '';

INSERT IGNORE INTO t_product_sku_unit (sku_id, unit_name, ratio, barcode, retail_price, wholesale_price, store_price, miniapp_price, is_base, sort_no, tenant_id)
SELECT s.id, s.box_unit, s.box_ratio, s.box_barcode, pp.retail_price, pp.wholesale_price, pp.store_price, pp.miniapp_price, 0, 2, s.tenant_id
FROM t_product_sku s
LEFT JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
WHERE s.box_unit IS NOT NULL AND s.box_unit <> '' AND (s.box_unit <> s.base_unit OR s.base_unit IS NULL);

SELECT COUNT(*) AS unit_rows FROM t_product_sku_unit;

-- 编号: 133, 描述: SKU 多单位表（多单位增加 + 多单位换算 + 单位级条码/价格），从既有瓶/箱字段回填
-- 说明: 文件头不写注释（自动迁移按分号拆分）；基础单位为库存单位，非基础单位价格为空时按 基础价×换算 展示。
