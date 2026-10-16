-- 编号: 069, 描述: 商品SPU增加品牌ID, 创建人: 阿坚, 日期: 2026-07-05
-- 日期：2026-07-05
-- 说明：product_spu.brand 是 VARCHAR(128) 存储品牌名，改为 brand_id 引用 brand 表
--
-- ============================================
-- 修订记录（S3-234 · 2026-10-16 · 阿坚/后端）
--   何时：2026-10-16   何人：阿坚   为什么/依据：收口总清单第 73 项 + `docs/tasks/cards/R101-S3-232-凌舟验收与裁定.md` §二裁定 7
--   改了什么（**只加守卫**，DDL 的结果态与数据语义**均不变**）：
--     原 3 条 DDL（ADD COLUMN / ADD CONSTRAINT / ADD INDEX）都是**无守卫**写法 ⇒ 非空库重跑时
--     第 3 条必然报 `Duplicate foreign key constraint name 'fk_product_spu_brand'`
--     （MySQL errno 1826 / `ER_FK_DUP_NAME`，**不在** runner 的跳过集合里）⇒ 每次后端启动、每次部署
--     都在日志里恒报一条失败，属踩坑 [78] 型「恒红掩蔽真错误」（实测复现见 `docs/evidence/S3-234/raw/`）。
--     现改为 `information_schema` 判定 + `PREPARE/EXECUTE`（先例：S3-199 修 169、S3-186 改 CALL、081/194/196）：
--       列/外键/索引「不在 ⇒ 照旧建」，「在 ⇒ 整句跳过」并执行一条 SELECT 占位回显"已存在，跳过"。
--     ⓐ 两条通道都幂等：`scripts/run-migration.mjs`（部署段整文件下发）与
--        `backend/src/shared/migration.ts` 第 8 步（启动期逐语句 safeExec）；
--     ⓑ 第 2 条数据回填 UPDATE **原样保留**（SET 同一值天然幂等，写闸门行为不变）；
--     ⓒ 外键引用写成 `t_brand`：本文件会经**两条通道**执行，而 `addTablePrefix` 只在启动期那一条生效
--        ⇒ 显式带前缀才能让两条通道指向同一张表（原 `REFERENCES brand(id)` 在部署通道会因
--        "Failed to open the referenced table 'brand'"失败）。
--     ⓓ 第 2 句（brand→brand_id 回填）同样加守卫：原写法 JOIN 条件里带 `p.tenant_id`，而该列
--        在部分环境不存在（本机夹具实测 t_product_spu 无 tenant_id）⇒ 部署通道会在此句整文件中止，
--        第 3/4 句根本跑不到。现按「两表 tenant_id 都在 ⇒ 租户内回填；否则整句跳过」处理，
--        **不做**去掉租户条件的降级 JOIN（会造成跨租户品牌串号）。
--   回退：把下面 3 组守卫换回原 3 条无守卫 DDL 即可（回退即恢复"非空库重跑恒报 1826"）。
--   证据：`docs/evidence/S3-234/**`（真库两遍 + 启动期两遍 + 反测两侧）。
-- ============================================

-- 1. 添加 brand_id 列（幂等：列已存在 ⇒ 整句跳过）
SET @s3234_col069 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND COLUMN_NAME = 'brand_id');
SET @s3234_ddl069 = IF(@s3234_col069 = 0, 'ALTER TABLE t_product_spu ADD COLUMN brand_id BIGINT UNSIGNED DEFAULT NULL COMMENT ''品牌ID'' AFTER brand', 'SELECT ''S3-234-069：brand_id 列已存在，ADD COLUMN 跳过（幂等）'' AS s3234_step1');
PREPARE s3234_stmt069 FROM @s3234_ddl069;
EXECUTE s3234_stmt069;
DEALLOCATE PREPARE s3234_stmt069;

-- 2. 迁移现有 brand 字符串到 brand_id（幂等：租户列不存在 ⇒ 整句跳过）
--    ⚠️ 本句在 S3-234 之前是**无守卫**的：`JOIN t_brand b ON ... AND b.tenant_id = p.tenant_id`。
--    它在部署通道（`scripts/run-migration.mjs` 整文件下发、**无** `addTablePrefix`）里会直接抛
--    `Unknown column 'p.tenant_id' in 'on clause'` ⇒ **整文件在该句中止**，第 3/4 句的外键与索引
--    守卫根本跑不到（本机真库实测，见 `docs/evidence/S3-234/raw/31-deploy-069-*.txt`）。
--    守卫语义：**只有** `t_product_spu.tenant_id` 与 `t_brand.tenant_id` 同时存在才做"租户内同名品牌"回填；
--    否则整句跳过并回显原因。**不做**"去掉租户条件"的降级 JOIN —— 那会把别的租户的同名品牌串到本租户商品上
--    （多租户越界），宁可跳过也不能越界。
SET @s3234_p_tenant069 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND COLUMN_NAME = 'tenant_id');
SET @s3234_b_tenant069 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_brand' AND COLUMN_NAME = 'tenant_id');
SET @s3234_upd069 = IF(@s3234_p_tenant069 > 0 AND @s3234_b_tenant069 > 0, 'UPDATE t_product_spu p JOIN t_brand b ON b.name = p.brand AND b.tenant_id = p.tenant_id SET p.brand_id = b.id WHERE p.brand IS NOT NULL AND p.brand != ''''', 'SELECT ''S3-234-069：t_product_spu/t_brand 缺 tenant_id，租户内回填跳过（不做跨租户降级 JOIN）'' AS s3234_step2');
PREPARE s3234_stmt069 FROM @s3234_upd069;
EXECUTE s3234_stmt069;
DEALLOCATE PREPARE s3234_stmt069;

-- 3. 添加外键约束（幂等：约束已存在 ⇒ 整句跳过）
SET @s3234_fk069 = (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND CONSTRAINT_NAME = 'fk_product_spu_brand');
SET @s3234_ddl069 = IF(@s3234_fk069 = 0, 'ALTER TABLE t_product_spu ADD CONSTRAINT fk_product_spu_brand FOREIGN KEY (brand_id) REFERENCES t_brand(id) ON DELETE SET NULL', 'SELECT ''S3-234-069：外键 fk_product_spu_brand 已存在，ADD CONSTRAINT 跳过（幂等）'' AS s3234_step3');
PREPARE s3234_stmt069 FROM @s3234_ddl069;
EXECUTE s3234_stmt069;
DEALLOCATE PREPARE s3234_stmt069;

-- 4. 添加索引（幂等：索引已存在 ⇒ 整句跳过）
SET @s3234_idx069 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND INDEX_NAME = 'idx_product_spu_brand_id');
SET @s3234_ddl069 = IF(@s3234_idx069 = 0, 'ALTER TABLE t_product_spu ADD INDEX idx_product_spu_brand_id (brand_id)', 'SELECT ''S3-234-069：索引 idx_product_spu_brand_id 已存在，ADD INDEX 跳过（幂等）'' AS s3234_step4');
PREPARE s3234_stmt069 FROM @s3234_ddl069;
EXECUTE s3234_stmt069;
DEALLOCATE PREPARE s3234_stmt069;

-- 5. 跑后核对：把三条结果态直接读出来（不给"已存在"结论兜底）
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND COLUMN_NAME = 'brand_id') AS c069_brand_id_col,
  (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND CONSTRAINT_NAME = 'fk_product_spu_brand') AS c069_fk,
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_product_spu' AND INDEX_NAME = 'idx_product_spu_brand_id') AS c069_idx;
