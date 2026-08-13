ALTER TABLE t_payment_config ADD COLUMN api_key VARCHAR(128) NOT NULL DEFAULT '' COMMENT '微信支付 APIv2 密钥（付款码反扫支付）';
ALTER TABLE t_payment_config ADD COLUMN box_config TEXT NULL COMMENT '收款盒子配置(JSON：服务商/激活码/串口参数)';
ALTER TABLE t_payment_order ADD COLUMN auth_code VARCHAR(64) NOT NULL DEFAULT '' COMMENT '付款码/授权码（反扫留痕，脱敏展示）';

-- 编号: 139, 描述: 收银台硬件支付扩展（付款码反扫/收款盒子/授权码留痕）
-- 创建人: Codex, 日期: 2026-08-14
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
