-- ============================================================
-- 编号: 125, 描述: 即时零售管理补列（同步日志/购物车/配送）
-- 创建人: 阿坚, 日期: 2026-08-08
-- 关联任务: ajian_retail_fix_01（即时零售缺失后端接口开发）
-- 说明:
--   1. t_miniapp_order_sync_log 补齐 tenant_id/platform_order_no/response/updated_at
--      —— 原 049 建表缺这些列，而 miniapp-order-sync.service 查询引用它们，
--         生产 GET /api/miniapp-order-sync 必现 Unknown column 500。
--   2. t_retail_cart 补齐 tenant_id（原 053 建表无租户列，管理端查询跨租户风险 + 无法租户过滤）。
--   3. t_delivery_record 补齐 rider_id（配送分配接口需要持久化骑手ID，原 046 无此列）。
--   4. 使用 092 号脚本定义的 add_column_if_not_exists / add_index_if_not_exists
--      存储过程做 IF NOT EXISTS 保护，可重复执行（表名必须显式带 t_ 前缀）。
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. t_miniapp_order_sync_log 补列
-- ────────────────────────────────────────────────────────────
CALL add_column_if_not_exists('t_miniapp_order_sync_log', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_column_if_not_exists('t_miniapp_order_sync_log', 'platform_order_no', "VARCHAR(64) DEFAULT NULL COMMENT '平台订单号' AFTER order_no");
CALL add_column_if_not_exists('t_miniapp_order_sync_log', 'response', "TEXT DEFAULT NULL COMMENT '同步响应内容' AFTER response_data");
CALL add_column_if_not_exists('t_miniapp_order_sync_log', 'updated_at', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER created_at");
CALL add_index_if_not_exists('t_miniapp_order_sync_log', 'idx_sync_log_tenant', '(tenant_id)');
CALL add_index_if_not_exists('t_miniapp_order_sync_log', 'idx_sync_log_platform_order_no', '(platform_order_no)');

-- ────────────────────────────────────────────────────────────
-- 2. t_retail_cart 补租户列
-- ────────────────────────────────────────────────────────────
CALL add_column_if_not_exists('t_retail_cart', 'tenant_id', "VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id");
CALL add_index_if_not_exists('t_retail_cart', 'idx_retail_cart_tenant', '(tenant_id)');

-- ────────────────────────────────────────────────────────────
-- 3. t_delivery_record 补骑手ID列
-- ────────────────────────────────────────────────────────────
CALL add_column_if_not_exists('t_delivery_record', 'rider_id', "BIGINT DEFAULT NULL COMMENT '骑手ID' AFTER rider_phone");
CALL add_index_if_not_exists('t_delivery_record', 'idx_delivery_record_rider_id', '(rider_id)');

-- ============================================================
-- 验证 SQL（information_schema 核对列存在与定义）
-- ============================================================
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 't_miniapp_order_sync_log' AND COLUMN_NAME IN ('tenant_id','platform_order_no','response','updated_at'))
    OR (TABLE_NAME = 't_retail_cart' AND COLUMN_NAME = 'tenant_id')
    OR (TABLE_NAME = 't_delivery_record' AND COLUMN_NAME = 'rider_id')
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;
