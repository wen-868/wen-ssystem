CREATE TABLE IF NOT EXISTS t_ai_external_model (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(64) NOT NULL COMMENT '唯一标识（provider 类型名，如 custom_kimi）',
  display_name varchar(128) NOT NULL COMMENT '展示名称（如 Kimi）',
  provider_base_url varchar(255) NOT NULL COMMENT 'OpenAI 兼容 API 基础地址（如 https://api.moonshot.cn/v1）',
  api_key varchar(512) DEFAULT NULL COMMENT 'API Key（AES-256-GCM 加密存储，格式 iv:authTag:ciphertext hex）',
  model_name varchar(128) NOT NULL COMMENT '模型名称（如 moonshot-v1-8k）',
  enabled tinyint NOT NULL DEFAULT '1' COMMENT '是否启用：1=启用 0=停用',
  sort_order int NOT NULL DEFAULT '0' COMMENT '排序（小的在前）',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_external_model_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI底座外部大模型配置';

-- 编号: 154, 描述: AI 底座平台级外部大模型库（支持添加任意 OpenAI 兼容外部大模型）
-- 创建人: 凌舟(AI协助), 日期: 2026-08-15
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
-- 幂等: CREATE TABLE IF NOT EXISTS + UNIQUE KEY，可重复执行。
