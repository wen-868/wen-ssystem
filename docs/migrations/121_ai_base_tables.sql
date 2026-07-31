-- 编号: 121, 描述: AI底座5张表建表脚本（平台配置/租户配置/审计日志/用量统计/计费套餐）
-- 创建人: 阿坚, 日期: 2026-08-01
-- 说明: R70-02 任务交付物。依据《智享AI底座-架构设计文档》v3.2 第7.1节字段定义，
--       按项目统一标准补充 created_at/updated_at、collate utf8mb4_unicode_ci、必要索引。
--       5张表完全独立，不修改任何现有表结构，通过 tenant_id 逻辑关联不做物理外键。
-- 负责人: 阿坚
-- 规则: 所有建表均使用 IF NOT EXISTS 保护，默认配置用 INSERT IGNORE 防重复，末尾附验证 SQL
-- 兜底: migration.ts Step 5.5.8 会读取本文件兜底执行；Step 8 外部迁移也会自动执行（双重保障）

USE liquor_inventory;

-- ============================================================
-- 第1步：t_platform_ai_config 平台级AI全局配置（全平台仅1条）
-- 字段以架构文档7.1节为准，补充 created_at 满足"所有表必须有 created_at/updated_at"要求
-- ============================================================
CREATE TABLE IF NOT EXISTS t_platform_ai_config (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  default_provider    VARCHAR(32) NOT NULL DEFAULT 'deepseek' COMMENT '默认AI服务商: deepseek/qwen/zhipu/ollama',
  default_model       VARCHAR(64) NOT NULL DEFAULT 'deepseek-chat' COMMENT '默认模型名称',
  default_api_key     VARCHAR(512) DEFAULT NULL COMMENT '默认API Key（AES-256-GCM加密存储）',
  default_endpoint    VARCHAR(255) DEFAULT NULL COMMENT '默认自定义Endpoint（留空则用服务商默认地址）',
  default_temperature DECIMAL(2,1) NOT NULL DEFAULT 0.3 COMMENT '默认温度参数 0.0-2.0',
  default_max_tokens  INT NOT NULL DEFAULT 2048 COMMENT '默认最大Token数',
  default_system_prompt TEXT COMMENT '默认系统提示词',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台级AI全局配置（全平台仅1条）';

-- ============================================================
-- 第2步：t_tenant_ai_config 租户级AI配置（每租户1条）
-- 多租户隔离：tenant_id VARCHAR(36) NOT NULL UNIQUE
-- ============================================================
CREATE TABLE IF NOT EXISTS t_tenant_ai_config (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  tenant_id       VARCHAR(36) NOT NULL COMMENT '租户ID（关联 t_tenant.id）',
  enabled         TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用AI功能: 1=启用 0=禁用',
  provider        VARCHAR(32) NOT NULL DEFAULT 'deepseek' COMMENT 'AI服务商: deepseek/qwen/zhipu/ollama',
  api_key         VARCHAR(512) DEFAULT NULL COMMENT 'API Key（AES-256-GCM加密存储）',
  api_endpoint    VARCHAR(255) DEFAULT NULL COMMENT '自定义Endpoint（留空则用服务商默认地址）',
  model           VARCHAR(64) NOT NULL DEFAULT 'deepseek-chat' COMMENT '模型名称',
  temperature     DECIMAL(2,1) NOT NULL DEFAULT 0.3 COMMENT '温度参数 0.0-2.0',
  max_tokens      INT NOT NULL DEFAULT 2048 COMMENT '最大Token数',
  system_prompt   TEXT COMMENT '自定义系统提示词（覆盖平台默认）',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant (tenant_id),
  KEY idx_tenant_id (tenant_id),
  KEY idx_created_at (created_at),
  KEY idx_tenant_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户级AI配置（每租户1条）';

-- ============================================================
-- 第3步：t_ai_audit_log AI调用审计日志（每次AI调用1条明细）
-- 高频写入表，按 (tenant_id, created_at) 复合索引支撑租户+时间范围查询
-- ============================================================
CREATE TABLE IF NOT EXISTS t_ai_audit_log (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  tenant_id         VARCHAR(36) NOT NULL COMMENT '租户ID',
  user_id           VARCHAR(36) DEFAULT NULL COMMENT '用户ID',
  session_id        VARCHAR(64) DEFAULT NULL COMMENT '会话ID',
  provider          VARCHAR(32) DEFAULT NULL COMMENT 'AI服务商',
  model             VARCHAR(64) DEFAULT NULL COMMENT '模型名称',
  intent            VARCHAR(64) DEFAULT NULL COMMENT '意图标签',
  user_message      TEXT COMMENT '用户消息原文',
  tool_calls        JSON COMMENT '工具调用记录（JSON数组）',
  prompt_tokens     INT NOT NULL DEFAULT 0 COMMENT '提示Token数',
  completion_tokens INT NOT NULL DEFAULT 0 COMMENT '完成Token数',
  latency_ms        INT DEFAULT NULL COMMENT '本次调用延迟毫秒',
  success           TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否成功: 1=成功 0=失败',
  error_message     TEXT COMMENT '错误信息（失败时记录）',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_tenant_id (tenant_id),
  KEY idx_created_at (created_at),
  KEY idx_tenant_created (tenant_id, created_at),
  KEY idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI调用审计日志（每次调用1条明细）';

-- ============================================================
-- 第4步：t_ai_usage_daily AI用量日统计表（按租户+日期+服务商汇总）
-- 唯一键 uk_tenant_date_provider 防止同租户同日同服务商重复汇总
-- ============================================================
CREATE TABLE IF NOT EXISTS t_ai_usage_daily (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  tenant_id         VARCHAR(36) NOT NULL COMMENT '租户ID',
  stat_date         DATE NOT NULL COMMENT '统计日期',
  chat_count        INT NOT NULL DEFAULT 0 COMMENT '对话次数',
  tool_call_count   INT NOT NULL DEFAULT 0 COMMENT '工具调用次数',
  prompt_tokens     BIGINT NOT NULL DEFAULT 0 COMMENT '提示Token数',
  completion_tokens BIGINT NOT NULL DEFAULT 0 COMMENT '完成Token数',
  total_tokens      BIGINT NOT NULL DEFAULT 0 COMMENT '总Token数',
  prompt_cost       DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT '提示费用（元）',
  completion_cost   DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT '完成费用（元）',
  total_cost        DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT '总费用（元）',
  provider          VARCHAR(32) DEFAULT NULL COMMENT 'AI服务商',
  model             VARCHAR(64) DEFAULT NULL COMMENT '模型名称',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_date_provider (tenant_id, stat_date, provider),
  KEY idx_tenant_id (tenant_id),
  KEY idx_created_at (created_at),
  KEY idx_tenant_created (tenant_id, created_at),
  KEY idx_tenant_date (tenant_id, stat_date),
  KEY idx_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI用量日统计表（按租户+日期+服务商汇总）';

-- ============================================================
-- 第5步：t_tenant_ai_billing 租户AI计费套餐配置（每租户1条）
-- 套餐类型: pay_as_you_go=按量后付 / monthly=包月 / prepaid=预付费
-- ============================================================
CREATE TABLE IF NOT EXISTS t_tenant_ai_billing (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  tenant_id           VARCHAR(36) NOT NULL COMMENT '租户ID',
  plan_type           VARCHAR(32) NOT NULL DEFAULT 'pay_as_you_go' COMMENT '套餐类型: pay_as_you_go/monthly/prepaid',
  free_chat_count     INT NOT NULL DEFAULT 100 COMMENT '免费对话次数',
  free_token_limit    BIGINT NOT NULL DEFAULT 100000 COMMENT '免费Token额度',
  overage_price       DECIMAL(10,6) NOT NULL DEFAULT 0.001000 COMMENT '超额单价（元/千Token）',
  monthly_chat_limit  INT NOT NULL DEFAULT 0 COMMENT '月对话上限（0=不限）',
  monthly_token_limit BIGINT NOT NULL DEFAULT 0 COMMENT '月Token上限（0=不限）',
  monthly_price       DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '月费（元）',
  enabled             TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用: 1=启用 0=禁用',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant (tenant_id),
  KEY idx_tenant_id (tenant_id),
  KEY idx_created_at (created_at),
  KEY idx_tenant_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户AI计费套餐配置（每租户1条）';

-- ============================================================
-- 第6步：插入平台级默认AI配置（仅当表为空时插入，防重复）
-- 默认: DeepSeek + deepseek-chat + 温度0.3 + 最大Token 2048
-- ============================================================
INSERT IGNORE INTO t_platform_ai_config
  (default_provider, default_model, default_api_key, default_endpoint, default_temperature, default_max_tokens, default_system_prompt)
SELECT
  'deepseek',
  'deepseek-chat',
  NULL,
  NULL,
  0.3,
  2048,
  '你是智享全链管理系统的AI助手，专注于酒水行业进销存与即时零售业务。你可以帮助用户管理销售单、库存、商品、客户、采购、配送、财务和报表。执行写操作前必须向用户确认关键信息。所有操作通过调用业务工具完成，不直接操作数据库。'
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM t_platform_ai_config LIMIT 1);

-- ============================================================
-- 第7步：验证 SQL（执行后核对5张表+默认配置）
-- ============================================================
-- 验证1：5张AI表是否全部创建
SELECT TABLE_NAME, TABLE_COMMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('t_platform_ai_config', 't_tenant_ai_config', 't_ai_audit_log', 't_ai_usage_daily', 't_tenant_ai_billing')
ORDER BY TABLE_NAME;

-- 验证2：平台默认配置是否就位（应返回1条，provider=deepseek, model=deepseek-chat）
SELECT id, default_provider, default_model, default_temperature, default_max_tokens, created_at
FROM t_platform_ai_config;

-- 验证3：各表字段数核对
SELECT TABLE_NAME, COUNT(*) AS column_count
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('t_platform_ai_config', 't_tenant_ai_config', 't_ai_audit_log', 't_ai_usage_daily', 't_tenant_ai_billing')
GROUP BY TABLE_NAME
ORDER BY TABLE_NAME;

SELECT '121_ai_base_tables.sql 执行完成（5张AI表创建 + 默认配置插入 + 验证）' AS result;
