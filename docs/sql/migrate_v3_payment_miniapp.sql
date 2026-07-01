-- ============================================================
-- 智享全链 v3 迁移：支付配置 + 小程序平台 + 模板系统
-- 版本：v3.0 | 日期：2026-07-01
-- 执行方式：mysql -u root -p liquor_inventory < migrate_v3_payment_miniapp.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. 支付配置表（独立，不放 sys_config）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_config (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     VARCHAR(64)  NOT NULL,
  provider      VARCHAR(20)  NOT NULL COMMENT 'wechat_pay/alipay/unionpay',
  config_key    VARCHAR(64)  NOT NULL,
  config_value  TEXT         NOT NULL,
  is_encrypted  TINYINT      NOT NULL DEFAULT 0 COMMENT '是否加密存储',
  description   VARCHAR(255) NOT NULL DEFAULT '',
  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_provider_key (tenant_id, provider, config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付渠道配置';

-- 微信支付初始配置（DEFAULT 租户模板）
INSERT INTO payment_config (tenant_id, provider, config_key, config_value, is_encrypted, description, sort_order) VALUES
('DEFAULT', 'wechat_pay', 'enabled', '0', 0, '是否启用', 1),
('DEFAULT', 'wechat_pay', 'app_id', '', 0, '微信支付 AppID（来自 pay.weixin.qq.com，非小程序AppID）', 2),
('DEFAULT', 'wechat_pay', 'mch_id', '', 0, '微信支付商户号', 3),
('DEFAULT', 'wechat_pay', 'api_v3_key', '', 1, 'API v3 密钥', 4),
('DEFAULT', 'wechat_pay', 'serial_no', '', 0, '证书序列号', 5),
('DEFAULT', 'wechat_pay', 'private_key', '', 1, '商户私钥(PEM)', 6),
('DEFAULT', 'wechat_pay', 'notify_url', '', 0, '支付回调通知地址', 7);

-- 支付宝初始配置
INSERT INTO payment_config (tenant_id, provider, config_key, config_value, is_encrypted, description, sort_order) VALUES
('DEFAULT', 'alipay', 'enabled', '0', 0, '是否启用', 1),
('DEFAULT', 'alipay', 'app_id', '', 0, '支付宝 AppID', 2),
('DEFAULT', 'alipay', 'private_key', '', 1, '应用私钥', 3),
('DEFAULT', 'alipay', 'alipay_public_key', '', 0, '支付宝公钥', 4),
('DEFAULT', 'alipay', 'notify_url', '', 0, '支付回调通知地址', 5);

-- ────────────────────────────────────────────────────────────
-- 2. 银行收款账号表
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_account (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     VARCHAR(64)  NOT NULL,
  bank_name     VARCHAR(64)  NOT NULL COMMENT '银行名称',
  branch_name   VARCHAR(128) NOT NULL DEFAULT '' COMMENT '支行名称',
  account_name  VARCHAR(64)  NOT NULL COMMENT '开户名',
  account_no    VARCHAR(64)  NOT NULL COMMENT '银行账号(加密)',
  bank_code     VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '银行联行号',
  qr_code_url   VARCHAR(512) NOT NULL DEFAULT '' COMMENT '收款码图片URL',
  is_default    TINYINT      NOT NULL DEFAULT 0 COMMENT '是否默认收款账户',
  status        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
  remark        VARCHAR(255) NOT NULL DEFAULT '',
  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='银行收款账户';

-- ────────────────────────────────────────────────────────────
-- 3. 小程序平台配置表
-- 注意：app_id 是小程序AppID（来自 mp.weixin.qq.com），不同于支付AppID
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS miniapp_config (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id       VARCHAR(64)  NOT NULL,
  platform        VARCHAR(20)  NOT NULL COMMENT 'WECHAT/ALIPAY/DOUYIN/KUAISHOU',
  app_id          VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '小程序 AppID（来自公众平台/开放平台）',
  app_secret      VARCHAR(512) NOT NULL DEFAULT '' COMMENT 'AppSecret（加密存储）',
  app_name        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '小程序名称',
  app_icon        VARCHAR(512) NOT NULL DEFAULT '' COMMENT '小程序图标URL',
  template_id     INT          NULL     COMMENT '关联 miniapp_template.id',
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft' COMMENT 'draft/published',
  publish_version VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '发布版本号',
  published_at    DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_platform (tenant_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序平台配置';

-- ────────────────────────────────────────────────────────────
-- 4. 小程序模板仓库
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS miniapp_template (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(64)  NOT NULL COMMENT '模板名称',
  description  VARCHAR(255) NOT NULL DEFAULT '' COMMENT '模板描述',
  thumbnail    VARCHAR(512) NOT NULL DEFAULT '' COMMENT '缩略图URL',
  preview_urls JSON         NULL     COMMENT '预览截图URL列表 ["url1","url2"]',
  style_config JSON         NOT NULL COMMENT '样式配置: {primaryColor, backgroundColor, ...}',
  page_config  JSON         NOT NULL COMMENT '页面配置: {homeLayout, productCardStyle, ...}',
  version      VARCHAR(20)  NOT NULL DEFAULT '1.0.0',
  status       VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT 'active/inactive',
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序模板';

-- 初始3套模板
INSERT INTO miniapp_template (name, description, style_config, page_config, sort_order, status) VALUES
(
  '经典蓝白',
  '蓝白配色，简洁大方，适合大多数酒水商家',
  '{"primaryColor":"#1677FF","secondaryColor":"#E6F4FF","backgroundColor":"#F5F5F5","fontFamily":"PingFang SC","borderRadius":"8px","tabBarStyle":"default"}',
  '{"homeLayout":"standard","productCardStyle":"grid","orderFlowStyle":"step","showBanner":true,"showCategoryNav":true,"showSearchBar":true}',
  1, 'active'
),
(
  '暖橙商务',
  '暖橙色调，温暖亲切，适合中高端酒水门店',
  '{"primaryColor":"#FA8C16","secondaryColor":"#FFF7E6","backgroundColor":"#FAFAFA","fontFamily":"PingFang SC","borderRadius":"12px","tabBarStyle":"rounded"}',
  '{"homeLayout":"featured","productCardStyle":"list","orderFlowStyle":"simple","showBanner":true,"showCategoryNav":true,"showSearchBar":true,"showPromotionBanner":true}',
  2, 'active'
),
(
  '深色臻品',
  '深色高级感，黑金配色，适合高端酒品专卖',
  '{"primaryColor":"#1A1A2E","secondaryColor":"#E8D5B7","backgroundColor":"#0D0D0D","fontFamily":"PingFang SC","borderRadius":"4px","tabBarStyle":"dark","darkMode":true}',
  '{"homeLayout":"premium","productCardStyle":"large","orderFlowStyle":"minimal","showBanner":true,"showCategoryNav":false,"showSearchBar":true,"showBrandStory":true}',
  3, 'active'
);

-- ────────────────────────────────────────────────────────────
-- 5. 小程序发布日志
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS miniapp_publish_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64)  NOT NULL,
  platform    VARCHAR(20)  NOT NULL,
  template_id INT          NULL,
  action      VARCHAR(20)  NOT NULL COMMENT 'publish/update/offline',
  version     VARCHAR(20)  NOT NULL DEFAULT '',
  result      VARCHAR(20)  NOT NULL COMMENT 'success/failed',
  error_msg   TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant_platform (tenant_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序发布日志';

-- ────────────────────────────────────────────────────────────
-- 6. 价格变更日志（实时同步用）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_change_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64)  NOT NULL,
  product_id  INT          NOT NULL,
  old_price   DECIMAL(10,2) NOT NULL,
  new_price   DECIMAL(10,2) NOT NULL,
  changed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant_changed (tenant_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格变更日志（小程序实时同步）';