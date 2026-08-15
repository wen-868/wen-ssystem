CREATE TABLE IF NOT EXISTS t_ai_review_task (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(36) NOT NULL COMMENT '租户ID',
  session_id varchar(64) DEFAULT NULL COMMENT '图会话ID（续跑定位）',
  graph_id varchar(64) DEFAULT NULL COMMENT '图ID',
  node_id varchar(64) DEFAULT NULL COMMENT '触发审核的图节点ID',
  tool_name varchar(64) DEFAULT NULL COMMENT '触发审核的工具名',
  payload json DEFAULT NULL COMMENT '审核载荷（操作摘要/明细）',
  status varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected',
  reject_reason varchar(500) DEFAULT NULL COMMENT '驳回原因',
  created_by varchar(64) DEFAULT NULL COMMENT '创建人/发起者',
  reviewed_by varchar(64) DEFAULT NULL COMMENT '审核人',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reviewed_at datetime DEFAULT NULL COMMENT '审核时间',
  PRIMARY KEY (id),
  KEY idx_review_tenant_status (tenant_id, status),
  KEY idx_review_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI待审工单（对接现有审核流程）';

-- 编号: 157, 描述: AI 待审工单表（P0-4 人工确认闸对接审核流程）
-- 创建人: 凌舟(AI协助), 日期: 2026-08-15
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
-- 幂等: CREATE TABLE IF NOT EXISTS，可重复执行。
