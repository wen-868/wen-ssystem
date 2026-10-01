CREATE TABLE IF NOT EXISTS t_promo_code (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  promo_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '推广码（唯一，规则 PC + 8 位大写字母数字去易混字符）',
  channel_type VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '来源渠道类型（市场渠道/异业合作/地推/其他，本表不限定枚举，由业务侧约定）',
  channel_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '渠道名称',
  owner_admin_id INT NULL COMMENT '渠道负责人（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未指派）',
  expire_at DATETIME NULL COMMENT '有效期截止（NULL=长期有效，不得用远期时间冒充）',
  status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE-启用/DISABLED-停用',
  remark VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_promo_code (promo_code),
  KEY idx_promo_channel_type (channel_type),
  KEY idx_promo_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台渠道推广码档案（C6-3-2a：只存码档案与渠道归属，无任何金额列）';

SELECT COUNT(*) AS c188_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_promo_code';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_promo_code'
   AND COLLATION_NAME IS NOT NULL
 ORDER BY COLUMN_NAME;

SELECT COUNT(*) AS c188_row_count FROM t_promo_code;

-- ============================================
-- 迁移编号：188
-- 描述：R101-C6-3-2a 平台渠道推广码档案（单张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-10-01
-- 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2a.md §三①（逐列口径）
--       docs/tasks/cards/R101-C6-3-凌舟裁定（待接入剩余 43 处的分批与口径）.md §5.2（归因落点裁定）
--       docs/智享全链_总后台建设规划_v1.3.html 4.9（推广码：生成渠道维度的注册推广码与落地链接）
-- 本表边界（红线①）：只做**码档案**。不建老带新台账、不建渠道报表（C6-3-2b）、不建分润/结算（C6-3-3/T9-2），
--   **本表不含任何金额列**（无首单奖励积分、无佣金比例、无结算金额），也不做任何计提写入或计算。
-- 渠道类型不限定枚举：卡 §三① 明确"取值由业务侧约定，本表不限定枚举但字段必填"，故该列只做 NOT NULL 约束，
--   不在库里写 ENUM，也不预置任何字典行。
-- 为什么不建物理外键（卡内硬约束）：仓内既有迁移一律"唯一索引 + 应用层保证"，外键在 runner 下曾多次致全新库
--   建表失败（S3-52/S3-55）。owner_admin_id 仅逻辑引用 t_platform_admin.id，**同型对齐**（该列是 int，见 080_平台管理员.sql）。
-- 文本列全部**显式** COLLATE utf8mb4_0900_ai_ci（卡内硬约束），不依赖库默认；表级同样显式声明。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--   —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。注释文字内不出现 ASCII 分号，
--   避免注释块被 splitSqlStatements 切成两半（179/180/183/184/185/186/187 同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--   safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径 + MIG-4 写闸门默认 block）：迁移只做结构，不写任何种子行（INSERT 命中 0）。
--   文件末尾第 3 条跑后核对 SELECT 对本表做 COUNT，恒 0 行是**预期结果**（"迁移不写数据"的旁证），
--   不是缺陷；推广码行只允许由平台后台 POST /api/platform/promo-codes 的真实生成动作产生。
-- 与 189 的关系：189 建 t_tenant_attribution（归因明细）。本表 id 是**被引用列**，189.promo_code_id 与它同型
--   （BIGINT UNSIGNED），仍不建物理外键。

