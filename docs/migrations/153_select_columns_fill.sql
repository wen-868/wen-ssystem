ALTER TABLE t_customer_price_binding ADD COLUMN price DECIMAL(12,2) DEFAULT NULL COMMENT '协议价(结算取价)';
ALTER TABLE t_customer_price_binding ADD COLUMN sku_id BIGINT DEFAULT NULL COMMENT 'SKU ID(协议价按SKU直绑)';
ALTER TABLE t_customer_price_binding ADD INDEX idx_cpb_sku (sku_id);

ALTER TABLE t_product_sku ADD COLUMN cost_price DECIMAL(12,2) DEFAULT 0 COMMENT '成本价(加权平均)';
ALTER TABLE t_product_sku ADD COLUMN safety_stock INT NOT NULL DEFAULT 0 COMMENT '安全库存(预警)';
ALTER TABLE t_product_sku ADD COLUMN name VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称(与sku_name同义)';
ALTER TABLE t_product_sku ADD COLUMN image VARCHAR(512) DEFAULT NULL COMMENT 'SKU图片(冗余)';
ALTER TABLE t_product_sku ADD COLUMN unit VARCHAR(32) DEFAULT NULL COMMENT '单位(与base_unit同义)';

ALTER TABLE t_sys_role ADD COLUMN name VARCHAR(64) DEFAULT NULL COMMENT '角色名称(与role_name同义)';

ALTER TABLE t_user_coupon ADD COLUMN customer_id BIGINT DEFAULT NULL COMMENT '客户ID(与user_id同义,报表服务写入)';
ALTER TABLE t_user_coupon ADD INDEX idx_user_coupon_customer (customer_id);

ALTER TABLE t_coupon_template ADD COLUMN name VARCHAR(128) DEFAULT NULL COMMENT '模板名称(与template_name同义)';
ALTER TABLE t_coupon_template ADD COLUMN type VARCHAR(32) DEFAULT NULL COMMENT '券类型(与coupon_type同义)';

ALTER TABLE t_supplier ADD COLUMN contact_name VARCHAR(64) DEFAULT NULL COMMENT '联系人名称(冗余)';

ALTER TABLE t_purchase_return ADD COLUMN return_amount DECIMAL(12,2) DEFAULT 0 COMMENT '退货金额(与refund_amount同义)';
ALTER TABLE t_purchase_return ADD COLUMN status VARCHAR(32) DEFAULT NULL COMMENT '状态(与return_status同义)';

ALTER TABLE t_product_spu ADD COLUMN store_id BIGINT DEFAULT NULL COMMENT '门店ID(商品同步)';

ALTER TABLE t_platform_audit_log ADD COLUMN ip_address VARCHAR(64) DEFAULT NULL COMMENT 'IP地址(与ip同义)';
ALTER TABLE t_platform_audit_log ADD COLUMN module VARCHAR(32) DEFAULT NULL COMMENT '模块(操作审计筛选)';

ALTER TABLE t_collection_link ADD COLUMN store_id BIGINT DEFAULT NULL COMMENT '门店ID(分享收款报表筛选)';
ALTER TABLE t_collection_link ADD INDEX idx_collection_link_store (store_id);

-- 编号: 153, 描述: SELECT 查询列审计补列——10 张表补齐服务 SELECT/WHERE/JOIN 引用的缺失列, 修复结算取协议价/成本价/库存预警/采购计划/角色报表/平台审计/分享收款报表等真实库必 500 缺陷
-- 创建人: Codex, 日期: 2026-08-15
-- 背景: 在 152 迁移(INSERT/UPDATE 列审计)基础上, 进一步审计服务 SELECT/WHERE/JOIN 的 alias.col 引用, 发现 10 张表存在查询列在真实表不存在。核心: t_customer_price_binding(结算取协议价 cpb.price/cpb.sku_id)、t_product_sku(cost_price 成本价/safety_stock 安全库存/name/image/unit)、t_platform_audit_log(ip_address/module)、t_collection_link(store_id 报表筛选)。
-- 注意: 文件头不写注释(自动迁移按分号拆分,注释污染首条语句被丢弃),说明放文件末尾。幂等: migration.ts safeExec 对 ER_DUP_FIELDNAME/ER_DUP_KEYNAME 做模式匹配跳过。
