ALTER TABLE t_payment_config ADD COLUMN app_id VARCHAR(128) NOT NULL DEFAULT '' COMMENT '支付 AppID';
ALTER TABLE t_payment_config ADD COLUMN mch_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT '商户号';
ALTER TABLE t_payment_config ADD COLUMN api_v3_key VARCHAR(256) NOT NULL DEFAULT '' COMMENT 'API v3 密钥';
ALTER TABLE t_payment_config ADD COLUMN serial_no VARCHAR(64) NOT NULL DEFAULT '' COMMENT '证书序列号';
ALTER TABLE t_payment_config ADD COLUMN private_key TEXT NULL COMMENT '商户私钥(PEM)';
ALTER TABLE t_payment_config ADD COLUMN notify_url VARCHAR(512) NOT NULL DEFAULT '' COMMENT '支付回调地址';
ALTER TABLE t_payment_config ADD COLUMN alipay_public_key TEXT NULL COMMENT '支付宝公钥';
ALTER TABLE t_payment_config ADD COLUMN enabled TINYINT NOT NULL DEFAULT 0 COMMENT '是否启用';
ALTER TABLE t_payment_order ADD COLUMN payment_method VARCHAR(32) NOT NULL DEFAULT '' COMMENT '支付方式';
ALTER TABLE t_payment_order ADD COLUMN processing TINYINT NOT NULL DEFAULT 0 COMMENT '处理中标记';
ALTER TABLE t_payment_order ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '实付金额';
ALTER TABLE t_payment_order ADD COLUMN transaction_id VARCHAR(128) NOT NULL DEFAULT '' COMMENT '渠道交易号';

-- 编号: 142, 描述: 服务器支付表结构对齐代码（key-value → 扁平列、支付单补列）
-- 创建人: 系统, 日期: 2026-08-14
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
-- 每列单独一条 ALTER：MySQL ALTER 原子执行，任一列已存在会整条失败；逐列可让其余列继续生效。
-- auth_code 由 139 迁移补充，此处不重复。
