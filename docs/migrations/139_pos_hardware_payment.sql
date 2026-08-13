-- 编号: 139, 描述: 收银台硬件支付扩展（付款码反扫/收款盒子/授权码留痕）
-- 创建人: Codex, 日期: 2026-08-14

-- 1. 支付配置表：微信 APIv2 密钥（付款码反扫必需）+ 收款盒子预留配置
ALTER TABLE t_payment_config
  ADD COLUMN api_key VARCHAR(128) NOT NULL DEFAULT '' COMMENT '微信支付 APIv2 密钥（付款码反扫支付）' AFTER api_v3_key,
  ADD COLUMN box_config TEXT NULL COMMENT '收款盒子配置(JSON：服务商/激活码/串口参数)' AFTER alipay_public_key;

-- 2. 支付流水表：付款码/授权码留痕
ALTER TABLE t_payment_order
  ADD COLUMN auth_code VARCHAR(64) NOT NULL DEFAULT '' COMMENT '付款码/授权码（反扫留痕，脱敏展示）' AFTER transaction_id;
