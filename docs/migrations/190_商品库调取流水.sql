CREATE TABLE IF NOT EXISTS t_library_call_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  tenant_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '发起调取的租户ID（逻辑引用 t_tenant.id，不建物理外键）',
  library_spu_id BIGINT UNSIGNED NOT NULL COMMENT '被调取的平台商品库SPU ID（逻辑引用 t_library_spu.id，不建物理外键）',
  library_spu_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '平台编码快照（t_library_spu.spu_code，主数据删除后流水仍可读）',
  library_spu_name VARCHAR(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '商品名称快照（t_library_spu.name，主数据删除后流水仍可读）',
  spu_id BIGINT UNSIGNED NOT NULL COMMENT '本次生成的租户私有SPU ID（逻辑引用 t_product_spu.id，不建物理外键）',
  sku_count INT NOT NULL DEFAULT 0 COMMENT '本次复制的SKU条数',
  call_type VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'COPY' COMMENT '调取类型：COPY-单条调取/BATCH_COPY-批量调取（取值由后端常量定义，不用数据库枚举）',
  operator_id INT UNSIGNED DEFAULT NULL COMMENT '操作人ID（逻辑引用 t_sys_user.id，不建物理外键；NULL=未记录）',
  operator_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '操作人名称快照（NULL=未记录）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '调取时间（成功写流水的时间点）',
  PRIMARY KEY (id),
  KEY idx_call_created_tenant (created_at, tenant_id),
  KEY idx_call_tenant_created (tenant_id, created_at),
  KEY idx_call_spu_tenant (library_spu_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品库调取流水（COPY 复制式调取，一次成功调取一行；SCAN/API 查询不计入本表）';

SELECT COUNT(*) AS c190_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_library_call_log';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_library_call_log'
 ORDER BY ORDINAL_POSITION;

SELECT COUNT(*) AS c190_row_count FROM t_library_call_log;

-- ============================================
-- 迁移编号：190
-- 描述：R101-C6-4-1 商品库调取流水（单张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-10-01
-- 依据：docs/tasks/cards/R101-C6-4-1-阿坚-立项草案.md §三.1（逐列口径）
--       docs/tasks/cards/R101-C6-4-0-凌舟裁定.md Q6（只写成功）与 Q7（方案 B）
--       docs/tasks/cards/R101-派单-20261001-C6-4-1.md 三、硬口径 ①②③
-- 统计边界（凌舟钉死，逐字照抄）：COPY＝调取（写本表 + 扣商品配额）；SCAN 条码查询与 /api/open/library 读取＝查询，一律不写本表；页面人工检索不落库。
--   ⇒ 平台侧"调取次数"的唯一取数点就是本表行数，禁用 t_library_spu.hit_count（那是扫码命中数）。
-- 只记成功动作（裁定 Q6 ①）：一次成功调取 = 一行。被拒（配额不足/权限不足/主数据不可调取）不写行、不占配额
--   ⇒ 统计口径天然等于配额扣减次数，不存在"漏带 WHERE result 就统计错"的地雷。
-- 为什么建新表而不是复用 t_library_spu.hit_count：hit_count 的唯一写点是扫码查询（services/admin/library-lookup.service.ts），
--   语义已被"扫码命中"占用，两者混用会让"调取统计"被查询灌水。
-- 为什么不建物理外键（卡内硬约束 + 立项卡 §二）：被引用列类型与排序规则不一致（t_tenant.id 是 VARCHAR(36)、
--   t_library_spu.id 与 t_product_spu.id 是 BIGINT UNSIGNED），且同族迁移已两次因外键在全新空库建表失败，故一律"逻辑引用 + 应用层保证"。
-- 列类型说明（口径依据 184 迁移的定稿注释：判据是"被引用列的实际类型"，不是"越宽越统一"）：
--   operator_id 取 INT UNSIGNED —— 被引用列 t_sys_user.id 是 INT UNSIGNED（shared/migration.ts 的 t_sys_user 建表），
--   取 BIGINT 会造成 INT↔BIGINT 隐式转换与索引失效（C6-0 A 类同族隐患）。草案 §3.1 写的 BIGINT UNSIGNED 已在回传卡报备为偏差项。
--   其余：tenant_id 对齐 t_tenant.id（VARCHAR(36)），library_spu_id 对齐 t_library_spu.id（BIGINT UNSIGNED），
--   spu_id 对齐 t_product_spu.id（BIGINT UNSIGNED），library_spu_code 对齐 t_library_spu.spu_code（VARCHAR(32)）。
-- 快照字段（卡内硬口径③）：library_spu_code / library_spu_name 存快照，平台主数据被删除（DELETE /api/platform/library/spus/:id）后流水仍可读。
-- 文本列全部显式 COLLATE utf8mb4_0900_ai_ci（卡内硬约束），不依赖库默认，避免 DEFAULT COLLATE 漂移。
-- 索引与查询一一对应（不多建）：idx_call_created_tenant 服务平台侧按月聚合与趋势，
--   idx_call_tenant_created 服务租户侧"我的调取记录"分页，idx_call_spu_tenant 服务平台侧"某商品被哪些租户调取"。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--   —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（179/180/183/184/185 同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被 safeExec 跳过（表已存在），
--   本文件无任何数据写语句、重跑无副作用。末尾 COUNT 类核对 SELECT 对全新空库恒 0 行，属预期结果而非缺陷。
