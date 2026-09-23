CREATE TABLE IF NOT EXISTS `t_open_webhook` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID（隔离键）',
  `event_type` VARCHAR(64) NOT NULL COMMENT '事件类型码（对齐开放平台事件目录，如 order.created）',
  `callback_url` VARCHAR(512) NOT NULL COMMENT '回调地址（https，禁内网段）',
  `sign_secret` VARCHAR(256) NOT NULL COMMENT '签名密钥（bcrypt 存储，创建时一次性下发明文）',
  `retry_policy` VARCHAR(32) NOT NULL DEFAULT '1m/5m/30m x3' COMMENT '重试策略（指数退避 1/5/30 分钟，共 3 次）',
  `pause_threshold` INT NOT NULL DEFAULT 10 COMMENT '连续失败自动暂停阈值（次）',
  `paused` TINYINT NOT NULL DEFAULT 0 COMMENT '是否暂停：1=已暂停 0=生效中',
  `last_trigger_at` DATETIME DEFAULT NULL COMMENT '最近触发时间',
  `last_status` VARCHAR(16) DEFAULT NULL COMMENT '最近触发状态：OK/FAIL',
  `last_error` VARCHAR(512) DEFAULT NULL COMMENT '最近失败原因（超时/连接失败/非 2xx）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_event` (`tenant_id`,`event_type`),
  KEY `idx_paused` (`paused`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='开放平台 Webhook 事件订阅';

CREATE TABLE IF NOT EXISTS `t_open_webhook_delivery` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `subscription_id` BIGINT UNSIGNED NOT NULL COMMENT '订阅ID（t_open_webhook.id，不建外键）',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID（冗余，便于隔离查询）',
  `event_type` VARCHAR(64) NOT NULL COMMENT '事件类型码',
  `payload` JSON DEFAULT NULL COMMENT '推送报文',
  `attempt` TINYINT NOT NULL DEFAULT 1 COMMENT '第几次尝试（自动 ≤3，手动重推递增）',
  `status` VARCHAR(16) NOT NULL COMMENT '投递结果：OK/FAIL',
  `http_status` INT DEFAULT NULL COMMENT '对端 HTTP 状态码',
  `error` VARCHAR(512) DEFAULT NULL COMMENT '失败原因',
  `triggered_by` VARCHAR(16) NOT NULL DEFAULT 'AUTO' COMMENT '触发方式：AUTO/MANUAL/TEST',
  `duration_ms` INT DEFAULT NULL COMMENT '耗时（毫秒）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '投递时间',
  PRIMARY KEY (`id`),
  KEY `idx_sub_created` (`subscription_id`,`created_at`),
  KEY `idx_tenant_created` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='开放平台 Webhook 投递记录';

SELECT COUNT(*) AS open_webhook_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('t_open_webhook','t_open_webhook_delivery');

-- ============================================
-- 迁移编号：174
-- 描述：开放平台（R101-C3-1）Webhook 订阅 + 投递记录两张新表
-- 创建人：阿坚
-- 日期：2026-09-23
-- 依据：docs/tasks/cards/R101-C3-0-凌舟裁定.md §三.2（新表 t_open_webhook / t_open_webhook_delivery）
-- 与本批次硬约束的差异说明（以 C3-1 派单卡为准，裁定草案里的子表外键约束已按卡删除）：
--   ① 零外键 —— 本文件不含任何外键约束/命名约束，删除一致性只在服务层保证（C3-1 派单卡交付物 2）。
--   ② 语句在注释之前 —— 规避 migration.ts 第 8 步丢块缺陷（docs/踩坑日志.md [63]）。
--   ③ 建表语句自带 IF NOT EXISTS（可重复执行）；不删表、不改任何既有表与既有列。
-- 回滚（须由人工在真库执行）：先删除表 t_open_webhook_delivery，再删除表 t_open_webhook。
--       （执行管线会跳过删表语句，故不能依赖本文件回滚；本段整体是注释，不含可执行语句）
-- ============================================
