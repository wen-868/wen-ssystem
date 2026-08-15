CREATE TABLE IF NOT EXISTS t_ai_ltm_profile (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(36) NOT NULL COMMENT '租户ID',
  entity_type varchar(32) NOT NULL DEFAULT 'tenant' COMMENT '主体类型：tenant/user/customer',
  entity_id varchar(64) DEFAULT NULL COMMENT '主体ID（租户下用户/客户）',
  k varchar(128) NOT NULL COMMENT '档案键（偏好/常用对象/禁区）',
  v_json json DEFAULT NULL COMMENT '档案值',
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ltm_profile (tenant_id, entity_type, entity_id, k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI长期记忆-档案（稳定事实/偏好）';

CREATE TABLE IF NOT EXISTS t_ai_ltm_episodic (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(36) NOT NULL COMMENT '租户ID',
  summary varchar(1000) DEFAULT NULL COMMENT '经验摘要',
  what varchar(1000) DEFAULT NULL COMMENT '发生了什么',
  why varchar(1000) DEFAULT NULL COMMENT '原因',
  outcome varchar(32) DEFAULT NULL COMMENT 'good/bad',
  score int NOT NULL DEFAULT 0 COMMENT '重要度评分（淘汰用）',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ltm_episodic_tenant (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI长期记忆-情节（历史交互经验）';

CREATE TABLE IF NOT EXISTS t_ai_ltm_archival (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(36) NOT NULL COMMENT '租户ID',
  title varchar(255) NOT NULL COMMENT '标题',
  body text COMMENT '正文/知识沉淀',
  source varchar(64) DEFAULT NULL COMMENT '来源（学习/复盘/文档）',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ltm_archival_tenant (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI长期记忆-归档（文档/知识沉淀）';

-- 编号: 158, 描述: AI 长期记忆三表（P1 长期记忆 LT：档案/情节/归档）
-- 创建人: 凌舟(AI协助), 日期: 2026-08-15
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
-- 幂等: CREATE TABLE IF NOT EXISTS，可重复执行。
