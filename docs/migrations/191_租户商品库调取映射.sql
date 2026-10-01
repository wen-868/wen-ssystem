CREATE TABLE IF NOT EXISTS t_tenant_library_copy (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  tenant_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '租户ID（逻辑引用 t_tenant.id，不建物理外键）',
  library_spu_id BIGINT UNSIGNED NOT NULL COMMENT '平台商品库SPU ID（逻辑引用 t_library_spu.id，不建物理外键）',
  spu_id BIGINT UNSIGNED NOT NULL COMMENT '租户私有SPU ID（逻辑引用 t_product_spu.id，不建物理外键）',
  copied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '首次调取时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近一次更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_tenant_library (tenant_id, library_spu_id),
  KEY idx_copy_spu (spu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='租户商品库调取映射（幂等判据：同租户同平台SPU唯一；租户删除私有档案后本行保留）';

SELECT COUNT(*) AS c191_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant_library_copy';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant_library_copy'
 ORDER BY ORDINAL_POSITION;

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS index_columns
 FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_tenant_library_copy'
 GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
 ORDER BY INDEX_NAME;

SELECT COUNT(*) AS c191_row_count FROM t_tenant_library_copy;

-- ============================================
-- 迁移编号：191
-- 描述：R101-C6-4-1 租户商品库调取映射（单张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-10-01
-- 依据：docs/tasks/cards/R101-C6-4-0-阿坚-立项草案.md §3.4（方案 B 形状）
--       docs/tasks/cards/R101-C6-4-0-凌舟裁定.md Q4（软删后仍 SKIPPED）与 Q7（裁定取方案 B）
--       docs/tasks/cards/R101-派单-20261001-C6-4-1.md 二（迁移 190/191）与 三（硬口径）
-- 本表用途（三条，各自对应一个真实查询）：
--   ① 幂等判据：uk_tenant_library (tenant_id, library_spu_id) —— 同租户二次调取同一平台 SPU 必命中，返回 SKIPPED 且不新建档案、不写流水、不占配额。
--   ② 版本/溯源载体：规划 4.15.4 要求"提示有新版本可同步"，而 t_library_spu 当前无版本列（生产实测 0 行 version 列），
--      故版本载体落在本映射表（后续加列 ALGORITHM=INSTANT 即可，不必 ALTER 被全站共用的 t_product_spu）。
--   ③ 平台侧可回答"某商品被哪些租户持有"，无需读取租户私有档案内容（规划 4.15.1 边界铁律）。
-- 为什么不是方案 A（纯复用、不建映射表）：方案 A 的幂等只能靠名称/条码猜，会把商户手工建的同类商品误判为"已调取"，
--   进而出现重复档案与重复占用商品配额（与"调取计入商品配额"直接冲突），故按 Q7 取方案 B。
-- 为什么保留行而不随档案删除而删（Q4 裁定）：若允许"删掉档案 → 再调取"循环，就等于绕过商品配额；映射行保留后
--   同一 SPU 永远返回 SKIPPED（含租户软删私有档案之后）。删除私有档案不影响本表，本表也不级联删除档案。
-- 为什么不建物理外键（卡内硬约束 + 立项卡 §二）：同 190，被引用列类型/排序规则不一致，且外键在 runner 下已两次致全新库建表失败。
-- 列类型对齐（同 190 说明）：tenant_id 对齐 t_tenant.id（VARCHAR(36)），library_spu_id 对齐 t_library_spu.id（BIGINT UNSIGNED），
--   spu_id 对齐 t_product_spu.id（BIGINT UNSIGNED）。文本列显式 COLLATE utf8mb4_0900_ai_ci。
-- idx_copy_spu (spu_id)：服务"按租户私有 SPU 反查是否调取而来"，不做前缀冗余（uk_tenant_library 的最左前缀是 tenant_id，覆盖不到 spu_id 查询）。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 4 条跑后核对 SELECT）顶格放在注释块之前 —— 规避踩坑日志 [63]／MIG-1。注释文字内不出现 ASCII 分号。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被 safeExec 跳过（表已存在），
--   本文件无任何数据写语句、重跑无副作用。零预置数据（MIG-4 写闸门默认 block 下也可执行）：映射行只允许由真实调取动作产生。
