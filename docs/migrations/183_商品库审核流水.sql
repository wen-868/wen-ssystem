CREATE TABLE IF NOT EXISTS t_library_spu_review_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  spu_id BIGINT UNSIGNED NOT NULL COMMENT 'SPU ID（逻辑引用 t_library_spu.id，不建物理外键）',
  action VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '动作：SUBMIT-提交审核/APPROVE-审核通过/REJECT-审核驳回/OFFLINE-下架',
  from_status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '流转前状态（NULL=无前置状态）',
  to_status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '流转后状态',
  operator_id INT NULL COMMENT '操作人ID（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未记录）',
  operator_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '操作人名称（NULL=未记录）',
  reason VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '操作原因或驳回理由（NULL=未填写）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_spu_created (spu_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商品库SPU审核流水（C6-2-T5，纯 DDL 零预置数据）';

SELECT COUNT(*) AS c183_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_library_spu_review_log';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_library_spu_review_log'
   AND COLLATION_NAME IS NOT NULL
 ORDER BY COLUMN_NAME;

SELECT COUNT(*) AS c183_row_count FROM t_library_spu_review_log;

-- ============================================
-- 迁移编号：183
-- 描述：C6-2-T5 商品库 SPU 审核流水（单张新表，纯 DDL 无预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-09-26
-- 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T5.md（交付物① 逐列口径、验收标准③⑤）
--       docs/tasks/cards/R101-C6-2-批2-立项卡-T1+T2+T3+T5.md（§二 T5 行、§三 通用硬口径）
--       docs/tasks/cards/R101-C6-0-阿坚清账.md §5.2（表名 t_library_spu_review_log 与
--       action 四值 SUBMIT/APPROVE/REJECT/OFFLINE 的最初字段草案）
--       saas-admin/src/views/library/LibrarySpus.vue:563（页面"审核记录流水"列，业务依据）
-- 与既有表的边界（红线①②）：本文件不含任何既有表的结构变更（不增列、不改列、不删表、不建外键约束），
--       不触碰 t_library_spu / t_platform_admin / t_library_sku / t_library_brand。
-- 为什么需要这张表：t_library_spu.reviewed_by / reviewed_at 只能存"最近一次"审核人与时间
--       （列定义在 117 迁移），历史流水无处落实，故新建本表按"一次状态流转一行"留痕。
-- 为什么不建物理外键（卡内裁定 + 立项卡 §二）：仓内既有迁移一律用"索引 + 应用层保证"，
--       外键约束在 runner 下已两次致全新库建表失败（S3-52 / S3-55）。但**列类型逐字对齐**被引用列
--       （t_library_spu.id = BIGINT UNSIGNED、t_platform_admin.id = int），避免同族 A 类缺陷复发。
-- 五个业务列的口径（与派单卡交付物① 逐字对齐，改动前须先改卡）：
--       ① spu_id 必填，指向被流转的 SPU（不建外键，靠 idx_spu_created 支撑按 SPU 取流水）；
--       ② action 必填四值：SUBMIT 提交审核 / APPROVE 审核通过 / REJECT 审核驳回 / OFFLINE 下架
--          （代码侧由目标状态推导，见 backend/src/services/platform/library.service.ts
--          deriveReviewAction 与本单回传卡；既有状态机没有"提交审核"入口，故 SUBMIT 当前无写点）；
--       ③ from_status 可空（NULL=无前置状态）与 to_status 必填成对，记录真实前后值；
--       ④ operator_id / operator_name 取自平台令牌主体，缺失即 NULL（不用 0 或空串冒充）；
--       ⑤ reason 可空（NULL=未填写，不得用空串冒充未填写）。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--       —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--       注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（179/180 迁移同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--       safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径 + MIG-4 写闸门默认 block）：迁移只做结构，不写任何种子行。
--       文件末尾第 3 条跑后核对 SELECT 对本表做 COUNT：恒 0 行是**预期结果**（"迁移不写数据"的旁证），
--       不是缺陷；流水只允许由既有状态机 PUT /api/platform/library/spus/:id/status 的真实流转产生。
-- 全部文本列一律显式 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci（立项卡 §二 硬约束：不默认继承库 collation）。
-- 读端点：GET /api/platform/library/spus/:id/review-logs（按 created_at 降序、同秒按 id 降序）。
-- ============================================
