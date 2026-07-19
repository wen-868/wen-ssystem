-- 编号: 20260720_push_token, 描述: 添加推送Token表, 创建人: 阿坚, 日期: 2026-07-20
-- 用途: App 端推送 Token 注册表，支持多服务商（极光/FCM/HMS）+ 多设备并发推送
-- 关联任务: R51-07 后端推送通知服务

CREATE TABLE IF NOT EXISTS t_push_token (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  tenant_id       VARCHAR(64) NOT NULL COMMENT '租户ID（多租户隔离）',
  user_id         BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  device_id       VARCHAR(128) NOT NULL COMMENT '设备唯一标识',
  push_token      TEXT NOT NULL COMMENT '推送Token（极光registration_id/FCM token/HMS token）',
  provider        VARCHAR(32) NOT NULL DEFAULT 'jpush' COMMENT '推送服务商：jpush/fcm/hms',
  app_platform    VARCHAR(16) NOT NULL COMMENT '平台：android/ios/harmony',
  app_version     VARCHAR(32) DEFAULT NULL COMMENT 'App版本号',
  status          TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=有效，0=失效',
  last_active_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_push_token_tenant_user (tenant_id, user_id) COMMENT '租户+用户联合索引（按用户查询Token）',
  KEY idx_push_token_device (device_id) COMMENT '设备ID索引（按设备查询/注销）',
  UNIQUE KEY uk_push_token_device_provider (device_id, provider) COMMENT '设备+服务商唯一键（同一设备同一服务商只能注册一个Token）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送Token表（App 端推送注册/查询/注销）';
