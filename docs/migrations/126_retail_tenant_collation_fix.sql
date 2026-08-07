-- ============================================================
-- 编号: 126, 描述: 即时零售相关表 tenant_id 排序规则统一
-- 创建人: 凌舟, 日期: 2026-08-08
-- 关联任务: R97-02（即时零售缺失后端接口开发）生产验收收口
-- 背景:
--   t_delivery_record/t_retail_order 等表 tenant_id 列 collation 不一致
--   （utf8mb4_unicode_ci vs utf8mb4_0900_ai_ci），跨表 JOIN 报
--   "Illegal mix of collations"（生产实测 GET /api/admin/instant-retail/deliveries 500）。
-- 方案: 全部统一为库默认 utf8mb4_0900_ai_ci（保留原列类型/可空性，无 DEFAULT 保持无 DEFAULT）。
-- 幂等: MODIFY COLUMN 可重复执行；迁移器对 ER_BAD_FIELD_ERROR 等会静默跳过。
-- ============================================================

ALTER TABLE t_delivery_record MODIFY COLUMN tenant_id VARCHAR(36) NOT NULL COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE t_retail_order MODIFY COLUMN tenant_id VARCHAR(36) NOT NULL COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE t_platform_order MODIFY COLUMN tenant_id VARCHAR(32) NOT NULL COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE t_retail_category MODIFY COLUMN tenant_id VARCHAR(32) NOT NULL COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE t_retail_product MODIFY COLUMN tenant_id VARCHAR(32) NOT NULL COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE t_retail_review MODIFY COLUMN tenant_id VARCHAR(32) NOT NULL COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE t_retail_shop_config MODIFY COLUMN tenant_id VARCHAR(32) NOT NULL COLLATE utf8mb4_0900_ai_ci;

-- ============================================================
-- 验证 SQL（应返回 0 行 = 全部统一）
-- ============================================================
SELECT TABLE_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME = 'tenant_id'
  AND COLLATION_NAME != 'utf8mb4_0900_ai_ci'
  AND (TABLE_NAME LIKE 't_retail%' OR TABLE_NAME LIKE 't_delivery%'
       OR TABLE_NAME LIKE 't_miniapp%' OR TABLE_NAME LIKE 't_platform_order%');
