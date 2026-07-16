-- 编号: 005, 描述: 系统配置表, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================
-- 智享酒水库存系统 - 系统配置表
-- Sprint 5 新增：商户可配置小程序/支付/企业信息
-- ============================================

USE liquor_inventory;

DROP TABLE IF EXISTS t_sys_config;

CREATE TABLE t_sys_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key VARCHAR(128) NOT NULL COMMENT '配置键',
  config_value TEXT COMMENT '配置值（敏感字段加密存储）',
  config_group VARCHAR(64) NOT NULL DEFAULT 'system' COMMENT '配置分组：system/wechat/payment/enterprise',
  is_encrypted TINYINT NOT NULL DEFAULT 0 COMMENT '是否加密：1是，0否',
  description VARCHAR(255) DEFAULT NULL COMMENT '配置说明',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_config_key (config_key),
  KEY idx_config_group (config_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 默认配置
INSERT INTO t_sys_config (config_key, config_value, config_group, is_encrypted, description) VALUES
('enterprise_name', '智享酒水', 'enterprise', 0, '企业名称'),
('enterprise_logo', '', 'enterprise', 0, '企业Logo URL'),
('enterprise_phone', '', 'enterprise', 0, '联系电话'),
('enterprise_address', '', 'enterprise', 0, '企业地址'),
('wechat_app_id', '', 'wechat', 0, '微信小程序 AppID'),
('wechat_app_secret', '', 'wechat', 1, '微信小程序 AppSecret'),
('pay_mch_id', '', 'payment', 0, '微信支付商户号'),
('pay_api_key', '', 'payment', 1, '微信支付 API v3 密钥'),
('pay_serial_no', '', 'payment', 0, '微信支付证书序列号'),
('pay_notify_url', 'https://api.onepan.cn/api/miniapp/pay/notify', 'payment', 0, '支付回调通知地址'),
('default_store_id', '1', 'system', 0, '默认门店ID'),
('low_stock_threshold', '10', 'system', 0, '低库存预警阈值'),
('low_stock_critical', '3', 'system', 0, '低库存紧急阈值'),
('expiry_warning_days', '30', 'system', 0, '过期预警天数'),
('expiry_critical_days', '7', 'system', 0, '过期紧急天数');
