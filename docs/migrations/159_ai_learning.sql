CREATE TABLE IF NOT EXISTS t_ai_learning_log (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(36) NOT NULL COMMENT '租户ID',
  exp_id bigint DEFAULT NULL COMMENT '关联情节经验ID',
  hint_key varchar(64) DEFAULT NULL COMMENT '回流提示键（tool_select/routing）',
  applied_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '应用时间',
  effect varchar(32) DEFAULT NULL COMMENT '效果：positive/negative（采纳评估）',
  note varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (id),
  KEY idx_learning_tenant (tenant_id, applied_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI学习回流记录（P2 自主学习 LN）';

-- 编号: 159, 描述: AI 自主学习回流记录（P2 LN：经验应用与采纳评估）
-- 创建人: 凌舟(AI协助), 日期: 2026-08-15
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
-- 幂等: CREATE TABLE IF NOT EXISTS，可重复执行。
