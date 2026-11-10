-- ============================================
-- 迁移编号：209
-- 单号：TOTAL-ORDER-PROGRESS-02（订单进度事件底座）
-- 描述：新建订单进度事件表 t_order_progress_event —— 字段与唯一键按
--       projects/ms/design/ORDER-PROGRESS-CONTRACT-v1.md §8.2 定稿（含 field_filter JSON NOT NULL）
-- 创建人：阿坚（后端 / 总台端）｜日期：2026-10-28
-- 依据：ACTIVE-TOTAL-ORDER-PROGRESS-02 §一.1；契约 §4.1（uk_source_event/uk_idempotency 幂等）、
--       §4.5（uk_order_seq 冲突重试）、§5.1（租户强制）、§8.2（field_filter 持久化裁决快照）
-- 幂等性：CREATE TABLE IF NOT EXISTS，可重复执行；本迁移不触碰任何既有表
-- ============================================

CREATE TABLE IF NOT EXISTS t_order_progress_event (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL COMMENT '租户ID（查询侧强制 WHERE tenant_id = ?）',
  store_id BIGINT DEFAULT NULL COMMENT '门店ID（门店级订单必填）',
  order_family VARCHAR(32) NOT NULL COMMENT '订单族（契约 §2.3 的 14 族 token）',
  order_no VARCHAR(64) NOT NULL COMMENT '订单号',
  source_event_id CHAR(64) NOT NULL COMMENT '稳定幂等键：SHA-256(租户键|族|订单号|阶段|actor_key|上游业务事件号)，零时间戳成分（契约 §4.1）',
  progress_seq INT NOT NULL COMMENT '每订单独立单调递增，仅排序/游标/防乱序唯一键，不参与去重（契约 §4.5）',
  event_name VARCHAR(64) NOT NULL COMMENT '稳定事件名 order.progress.<family>.<stage 小写>（契约 §2.2）',
  event_version VARCHAR(16) NOT NULL DEFAULT '1.0.0' COMMENT '事件版本号',
  business_stage VARCHAR(32) NOT NULL COMMENT '业务阶段（契约 §三；禁入 AI 小写六态，写入服务硬拦）',
  business_status VARCHAR(32) NOT NULL COMMENT '业务状态（订单主表状态值）',
  failure_code VARCHAR(64) DEFAULT NULL COMMENT '失败码（终态异常必填，值域=契约 §7.1 九码）',
  retry_entry VARCHAR(128) DEFAULT NULL COMMENT '重试入口（与契约 §7.1 表一致）',
  manual_intervention_url VARCHAR(255) DEFAULT NULL COMMENT '人工兜底入口（EXCEPTION_UNRESOLVED 等必填）',
  status_reason VARCHAR(255) DEFAULT NULL COMMENT '状态变更原因（进 §7.1 文案 {status_reason} 槽位）',
  actor_type VARCHAR(16) NOT NULL COMMENT '操作者类型：system/user/admin/ai/cron',
  actor_id VARCHAR(64) DEFAULT NULL COMMENT '操作者ID（user/admin 必填；system/cron 用稳定主体键）',
  visible_to JSON NOT NULL COMMENT '可见角色列表快照（契约 §六）',
  field_filter JSON NOT NULL COMMENT '字段过滤裁决快照（契约 §8.2 F2 定稿：持久化列，历史事件不随角色矩阵变更而错位）',
  idempotency_key CHAR(64) NOT NULL COMMENT 'sha256(source_event_id)（契约 §4.1）',
  started_at DATETIME NOT NULL COMMENT '阶段开始时间',
  ended_at DATETIME DEFAULT NULL COMMENT '阶段结束时间（终态必填）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_source_event (source_event_id),
  UNIQUE KEY uk_idempotency (idempotency_key),
  UNIQUE KEY uk_order_seq (tenant_id, order_family, order_no, progress_seq),
  KEY idx_tenant_order (tenant_id, order_family, order_no),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单进度事件表（唯一业务真相源，append-only）';

-- 完成标志
SELECT 't_order_progress_event 已就绪' AS result;
