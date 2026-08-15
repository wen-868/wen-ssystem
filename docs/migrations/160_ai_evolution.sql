CREATE TABLE IF NOT EXISTS t_ai_evolution (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(36) NOT NULL COMMENT '租户ID（进化仅租户内生效）',
  target varchar(16) NOT NULL COMMENT '进化对象：prompt/tool/graph/newtool',
  version int NOT NULL DEFAULT 1 COMMENT '进化版本号',
  status varchar(20) NOT NULL DEFAULT 'proposed' COMMENT 'proposed/review/gray/rolled_out/rejected/rolled_back',
  current_snapshot text COMMENT '现版本快照（回滚依据）',
  proposed_diff text COMMENT '建议内容（prompt文本/newtool JSON/diff）',
  rationale varchar(1000) DEFAULT NULL COMMENT '依据（引学习经验）',
  review_id bigint DEFAULT NULL COMMENT '关联待审工单ID',
  gray_percent int NOT NULL DEFAULT 0 COMMENT '灰度比例（0-100）',
  proposed_by varchar(64) DEFAULT NULL COMMENT '提出人',
  reviewed_by varchar(64) DEFAULT NULL COMMENT '审核人',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rolled_out_at datetime DEFAULT NULL COMMENT '生效时间',
  PRIMARY KEY (id),
  KEY idx_evolution_tenant (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI自主进化版本（P3 SE 门控）';

-- 编号: 160, 描述: AI 自主进化版本表（P3 SE：proposed→review→gray→rolled_out/回滚，复用审核）
-- 创建人: 凌舟(AI协助), 日期: 2026-08-15
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
-- 幂等: CREATE TABLE IF NOT EXISTS，可重复执行。
