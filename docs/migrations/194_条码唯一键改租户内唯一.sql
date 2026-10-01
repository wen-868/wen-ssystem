SELECT t.tenant_id, t.barcode, COUNT(*) AS dup_count
  FROM t_product_sku t
 WHERE t.barcode IS NOT NULL
 GROUP BY t.tenant_id, t.barcode
HAVING COUNT(*) > 1;
SET @s3151_new_key = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 't_product_sku'
     AND INDEX_NAME = 'uk_product_sku_tenant_barcode'
);
SET @s3151_old_key = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 't_product_sku'
     AND INDEX_NAME = 'uk_product_sku_barcode'
);
SET @s3151_ddl = IF(@s3151_new_key = 0 AND @s3151_old_key > 0,
  'ALTER TABLE t_product_sku DROP INDEX uk_product_sku_barcode, ADD UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode), ALGORITHM=INPLACE, LOCK=NONE',
  IF(@s3151_new_key = 0,
    'ALTER TABLE t_product_sku ADD UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode), ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''S3-151 条码唯一键已是（tenant_id, barcode），整句跳过'' AS s3151_step'));
PREPARE s3151_stmt FROM @s3151_ddl;
EXECUTE s3151_stmt;
DEALLOCATE PREPARE s3151_stmt;
SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols, NON_UNIQUE
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_product_sku'
   AND INDEX_NAME IN ('uk_product_sku_barcode', 'uk_product_sku_tenant_barcode')
 GROUP BY INDEX_NAME, NON_UNIQUE;

-- ============================================
-- 迁移编号：194
-- 单号：S3-151
-- 描述：t_product_sku 条码唯一键由「(barcode) 全库唯一」改为「(tenant_id, barcode) 租户内唯一」
-- 创建人：阿坚（后端）
-- 日期：2026-10-02
-- 依据：docs/tasks/cards/R101-派单-20261002-S3-151.md 二、范围（做）第 1 项 + 四、验收标准①②
--       现状出处三处：backend/src/shared/migration.ts（新库内联 DDL）、docs/init_database.sql（新库建表）、
--       docs/migrations/001_phase1_schema.sql（历史快照）。前两处已同步改为同口径，第三处是历史快照本卡一字不改。
--
-- 一、为什么改
--   原键 uk_product_sku_barcode (barcode) 是单列全库唯一 ⇒ 租户甲录入过的条码，租户乙不能再用
--   （改条码 400、建品 500、批量导入报回库报错原文）。改为 (tenant_id, barcode) 复合唯一后，
--   「同租户内条码唯一」保持，跨租户同条码互不影响。
--
-- 二、前置查重（本文件第 1 条 SELECT）
--   口径：SELECT tenant_id, barcode, COUNT(*) FROM t_product_sku WHERE barcode IS NOT NULL
--         GROUP BY tenant_id, barcode HAVING COUNT(*) > 1
--   期望 0 行。非 0 行则本迁移的 ADD UNIQUE KEY 会 ER_DUP_ENTRY 失败（runner 只在日志里报错，
--   不会静默当成成功），必须先人工清理重复行再重跑。
--
-- 三、幂等守卫（information_schema.STATISTICS）
--   @s3151_new_key = 新键已存在（按 INDEX_NAME = uk_product_sku_tenant_barcode 计数）
--   @s3151_old_key = 旧键仍存在（按 INDEX_NAME = uk_product_sku_barcode 计数）
--   三分支：新键缺 + 旧键在 ⇒ 一条 ALTER 内 DROP 旧键 + ADD 新键（单次表重建）
--           新键缺 + 旧键缺 ⇒ 只 ADD 新键（兼容全新库/灾难恢复库）
--           新键已在       ⇒ 整句跳过（连跑第二次只输出跳过提示，不产生任何报错）
--   ALGORITHM=INPLACE, LOCK=NONE：显式声明在线 DDL，避免整表拷表与写锁。
--
-- 四、回滚语句（回滚前必须先做一次全库查重，跨租户同条码必须为 0 行，否则回滚必失败）
--   SELECT tenant_id, barcode, COUNT(*) FROM t_product_sku WHERE barcode IS NOT NULL
--     GROUP BY barcode HAVING COUNT(*) > 1
--   ALTER TABLE t_product_sku DROP INDEX uk_product_sku_tenant_barcode, ADD UNIQUE KEY uk_product_sku_barcode (barcode)
--
-- 五、零 DML
--   本文件只有 SELECT / SET / PREPARE / EXECUTE / DEALLOCATE 与一条结构语句 ALTER TABLE，
--   无任何 INSERT / UPDATE / DELETE / REPLACE 回填，MIG-4 写闸门默认 block 下照常执行。
--   可执行语句顶格写在注释块之前，规避踩坑日志 [63] 的「以注释开头的整块语句被丢弃」。
--   注释文字内不出现 ASCII 分号。
