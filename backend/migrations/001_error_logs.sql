-- 迁移 001: error_logs 系统错误日志表
-- 创建时间: 2026-07-03
-- 说明: 记录后端和前端所有错误，支持查询和告警

CREATE TABLE IF NOT EXISTS error_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  error_type  VARCHAR(64)   NOT NULL COMMENT '错误类型: validation/business/unknown/uncaughtException/unhandledRejection/frontend',
  severity    VARCHAR(16)   NOT NULL DEFAULT 'ERROR' COMMENT '严重级别: WARN/ERROR/FATAL',
  message     TEXT          NOT NULL COMMENT '错误消息',
  stack       TEXT          DEFAULT NULL COMMENT '堆栈信息',
  request_url VARCHAR(512)  DEFAULT NULL COMMENT '触发请求URL（后端错误时有值）',
  request_method VARCHAR(16) DEFAULT NULL COMMENT '请求方法: GET/POST/PUT/DELETE',
  status_code INT           DEFAULT NULL COMMENT 'HTTP状态码',
  user_id     VARCHAR(64)   DEFAULT NULL COMMENT '触发用户ID',
  tenant_id   VARCHAR(64)   DEFAULT NULL COMMENT '租户ID',
  source      VARCHAR(32)   NOT NULL DEFAULT 'backend' COMMENT '来源: backend/frontend',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_error_type (error_type),
  INDEX idx_severity (severity),
  INDEX idx_created_at (created_at),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统错误日志表';
