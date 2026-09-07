ALTER TABLE t_stock_check ADD COLUMN `completed_at` DATETIME DEFAULT NULL COMMENT '完成时间';
ALTER TABLE t_stock_check ADD COLUMN `diff_sku` INT DEFAULT 0 COMMENT '差异SKU数';
ALTER TABLE t_stock_check ADD COLUMN `diff_amount` DECIMAL(12,2) DEFAULT 0 COMMENT '差异金额';
ALTER TABLE t_report_permission_matrix ADD COLUMN `can_export` TINYINT(1) DEFAULT 0 COMMENT '可导出';
ALTER TABLE t_report_permission_matrix ADD COLUMN `store_ids` TEXT DEFAULT NULL COMMENT '限定门店ID集合(JSON)';
ALTER TABLE t_report_permission_matrix ADD COLUMN `tenant_id` VARCHAR(64) DEFAULT 'default' COMMENT '租户ID';
-- 编号: 168, 描述: 盘点表与报表权限矩阵表补缺失列。
-- t_stock_check 缺 completed_at/diff_sku/diff_amount → /admin/stock-checks/statistics 500 (Unknown column 'diff_sku')
--   且完成盘点的 UPDATE 同样引用这三列, 不补则盘点完成流程也是 500。
-- t_report_permission_matrix 缺 can_export/store_ids/tenant_id → /admin/report-permissions/matrix 与 /my 500
--   (Unknown column 'rpm.can_export')。
-- 幂等可重复执行(safeExec 对 ER_DUP_FIELDNAME 跳过)。顶格书写规避启动迁移的注释丢弃 bug。
-- 创建人: 凌舟, 日期: 2026-09-07
