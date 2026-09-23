CREATE TABLE IF NOT EXISTS `t_open_api_call_daily` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `api_key_id` BIGINT UNSIGNED NOT NULL COMMENT '密钥ID（t_library_api_key.id，不建外键）',
  `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID（冗余，便于隔离查询）',
  `stat_date` DATE NOT NULL COMMENT '统计日期（天粒度）',
  `call_count` INT NOT NULL DEFAULT 0 COMMENT '当日调用次数',
  `error_count` INT NOT NULL DEFAULT 0 COMMENT '当日错误次数（非 2xx）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_api_key_date` (`api_key_id`,`stat_date`),
  KEY `idx_tenant_date` (`tenant_id`,`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='开放平台 API 调用量日聚合';

SELECT COUNT(*) AS open_api_call_daily_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_open_api_call_daily';

-- ============================================
-- 迁移编号：175
-- 描述：开放平台（R101-C3-1）调用量日聚合表 t_open_api_call_daily
-- 创建人：阿坚
-- 日期：2026-09-23
-- 依据：docs/tasks/cards/R101-C3-0-凌舟裁定.md §二.5（裁定 = 方案 B 日聚合表，表名 t_open_api_call_daily）
-- 说明：裁定否决了方案 A（原始调用日志表 t_open_api_call_log）；本文件**不建** t_open_api_call_log。
-- 幂等：建表语句自带 IF NOT EXISTS；不含任何外键约束；语句在注释之前（规避踩坑日志 [63] 的丢块缺陷）。
-- 写入方边界（诚实声明，非本批次实现）：本表**当前没有写入方** ——
--   外网调用计数的落库（网关侧按天累加）不在 C3-1 端点清单内，已列入回传卡「需裁定/登记」清单。
--   因此 GET /api/platform/open/api-keys/:id/stats 在无写入方时会如实返回空序列（不造数）。
-- 回滚（须由人工在真库执行）：删除表 t_open_api_call_daily（本段整体是注释，不含可执行语句）
-- ============================================
