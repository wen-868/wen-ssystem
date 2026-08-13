-- 编号: 140, 描述: 收银硬件配置（客显/电子秤模板、云喇叭、云闪付通道）
-- 创建人: Codex, 日期: 2026-08-14

CREATE TABLE IF NOT EXISTS t_hardware_config (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64) NOT NULL,
  category    VARCHAR(32) NOT NULL COMMENT 'customer_display/scale/cloud_speaker/unionpay',
  config_json TEXT        NOT NULL,
  enabled     TINYINT     NOT NULL DEFAULT 1 COMMENT '是否启用',
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_category (tenant_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收银硬件配置(租户级)';
