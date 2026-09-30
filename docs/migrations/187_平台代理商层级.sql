CREATE TABLE IF NOT EXISTS t_agent_level (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  level_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '层级编码（唯一，如 level_a / level_b，编码自定）',
  level_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '层级名称（D11③ 自定义命名，不写死"一级/二级"）',
  allow_sub_level TINYINT NOT NULL DEFAULT 0 COMMENT '是否允许发展下级代理：1-允许/0-不允许',
  plan_scope JSON NULL COMMENT '可售套餐范围（planId 数组，如 [1,2]；NULL=未配置，不得用空数组或 0 冒充）',
  discount_low DECIMAL(5,2) NULL COMMENT '拿货折扣区间下限（未配置=NULL，不得写 0 冒充）',
  discount_high DECIMAL(5,2) NULL COMMENT '拿货折扣区间上限（未配置=NULL，不得写 0 冒充）',
  profit_mode_signup TINYINT NOT NULL DEFAULT 1 COMMENT '新签订单分润模式：1-开/0-关（D11② 初期只开新签与续费）',
  profit_mode_renew TINYINT NOT NULL DEFAULT 1 COMMENT '续费订单分润模式：1-开/0-关',
  profit_mode_upsell TINYINT NOT NULL DEFAULT 0 COMMENT '增值收入分润模式：1-开/0-关（D11② 增值初期关闭，默认 0）',
  profit_rate_signup DECIMAL(6,4) NULL COMMENT '新签分润比例（配置值，未配置=NULL；档 1 不产生任何计提）',
  profit_rate_renew DECIMAL(6,4) NULL COMMENT '续费分润比例（配置值，未配置=NULL；档 1 不产生任何计提）',
  profit_rate_upsell DECIMAL(6,4) NULL COMMENT '增值分润比例（配置值，未配置=NULL；档 1 不产生任何计提）',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号（数字越小越靠前）',
  status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE-启用/DISABLED-停用',
  updated_by INT NULL COMMENT '最近更新人（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未记录）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_level_code (level_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台代理商层级权益配置（C6-3-3 档 1：只存配置值，零计提）';

SELECT COUNT(*) AS c187_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_agent_level';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_agent_level'
   AND COLLATION_NAME IS NOT NULL
 ORDER BY COLUMN_NAME;

SELECT COUNT(*) AS c187_row_count FROM t_agent_level;

-- ============================================
-- 迁移编号：187
-- 描述：R101-C6-3-3 平台代理商层级权益配置（单张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-10-01
-- 依据：docs/tasks/cards/R101-派单-20260929-C6-3-3.md §三②（逐列口径）
--       docs/tasks/cards/R101-C6-3-凌舟裁定（待接入剩余 43 处的分批与口径）.md §5.1（D11 三项）
-- 权益维度（规划 4.14 逐字）：可售套餐范围（plan_scope）、拿货折扣区间（discount_low/high）、
--   是否允许发展下级（allow_sub_level），另加**比例矩阵配置位**（profit_mode_* + profit_rate_*）。
-- D11 三项落地口径（凌舟已裁，逐条对应）：
--   ① 分润比例配置化：profit_rate_* 三列默认 NULL，**不内置任何数值**，未配置即 NULL 而非 0。
--   ② 增值收入初期关闭：profit_mode_upsell 默认 0（新签/续费默认 1）。
--   ③ 层级自定义命名：level_name 为自由命名，**不写死"一级/二级"**；且本文件零预置，层级行由管理员创建。
-- 零涉钱自证（红线①）：本表**没有金额列**，三列 profit_rate_* 是"配置值"（百分比/比例），
--   档 1 不含任何计提、结算、提现的写入或计算——服务层只读写这些配置字段，不做任何金额推导。
-- 为什么不建物理外键（卡内硬约束）：同 184/185/186，仓内一律不建物理外键。
-- 列类型说明：id 取 BIGINT UNSIGNED（同 184/185 的新建表主键风格）；updated_by = INT NULL，
--   被引用列 t_platform_admin.id 是 int（080_平台管理员.sql:11）。卡 §三② 只写 `id`，本文件按 184/185 同规取值。
-- 文本列全部**显式** COLLATE utf8mb4_0900_ai_ci（卡内硬约束）；plan_scope 是 JSON 列，无 collation，属预期。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--   —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--   注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（179/180/183/184/185 同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--   safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径 + MIG-4 写闸门默认 block）：迁移只写结构（INSERT 命中 0），
--   层级可为空表，由管理员通过 POST /api/platform/agents/levels 创建。
