-- 编号: 109, 描述: P2级自定义报表, 创建人: 阿坚, 日期: 2026-07-14
-- ============================================
-- P2级功能：自定义报表
-- ============================================

-- 1. 自定义报表表
CREATE TABLE IF NOT EXISTS `t_custom_report` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `report_name` VARCHAR(128) NOT NULL COMMENT '报表名称',
  `report_type` VARCHAR(32) NOT NULL COMMENT '报表类型：SALES/INVENTORY/FINANCE/CUSTOMER',
  `data_source` VARCHAR(64) NOT NULL COMMENT '数据源表名',
  `config` JSON NOT NULL COMMENT '报表配置（字段、筛选、图表配置）',
  `chart_type` VARCHAR(32) DEFAULT 'TABLE' COMMENT '图表类型：TABLE/LINE/BAR/PIE',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '报表描述',
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DISABLED',
  `created_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_report_type` (`report_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自定义报表';

-- 2. 报表生成记录表
CREATE TABLE IF NOT EXISTS `t_custom_report_log` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `report_id` BIGINT UNSIGNED NOT NULL COMMENT '报表ID',
  `generated_by` BIGINT DEFAULT NULL COMMENT '生成人',
  `params` JSON DEFAULT NULL COMMENT '生成参数',
  `row_count` INT NOT NULL DEFAULT 0 COMMENT '数据行数',
  `file_url` VARCHAR(500) DEFAULT NULL COMMENT '导出文件URL',
  `export_format` VARCHAR(16) DEFAULT NULL COMMENT '导出格式：EXCEL/CSV/PDF',
  `status` VARCHAR(16) NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：PENDING/SUCCESS/FAILED',
  `error_msg` VARCHAR(500) DEFAULT NULL COMMENT '错误信息',
  `tenant_id` VARCHAR(32) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_report_id` (`report_id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报表生成记录';
