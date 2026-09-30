CREATE TABLE IF NOT EXISTS t_agent (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  agent_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '代理商编码（唯一）',
  agent_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '代理商名称',
  level_id BIGINT UNSIGNED NOT NULL COMMENT '层级ID（逻辑引用 t_agent_level.id，同型对齐，不建物理外键）',
  region VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '授权区域（NULL=未填写，不得用空串冒充未填写）',
  contact_name VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '联系人姓名（NULL=未填写，不得用空串冒充未填写）',
  contact_phone VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '联系人电话（NULL=未填写，不得用空串冒充未填写）',
  status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING-待审核/ACTIVE-正常/FROZEN-冻结/TERMINATED-终止',
  remark VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  updated_by INT NULL COMMENT '最近更新人（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未记录）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_agent_code (agent_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台代理商档案（C6-3-3 档 1：只存档案与状态机，无任何金额列）';

SELECT COUNT(*) AS c186_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_agent';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_agent'
   AND COLLATION_NAME IS NOT NULL
 ORDER BY COLUMN_NAME;

SELECT COUNT(*) AS c186_row_count FROM t_agent;

-- ============================================
-- 迁移编号：186
-- 描述：R101-C6-3-3 平台代理商档案（单张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-10-01
-- 依据：docs/tasks/cards/R101-派单-20260929-C6-3-3.md §三①（逐列口径）与 §二（本单范围钉死）
--       docs/tasks/cards/R101-C6-3-凌舟裁定（待接入剩余 43 处的分批与口径）.md §5.1（D11 三项）
--       docs/智享全链_总后台建设规划_v1.3.html 4.14（层级模型 + 档案状态机 + 归因规则）
-- 本表边界（红线①）：只做**档案与状态机**。不建分润台账、不建结算、不建提现，
--   **本表不含任何金额列**（无分润基数/分润金额/结算金额），也不做任何计提写入或计算。
--   分润比例等**配置值**落在 t_agent_level（迁移 187），档 1 只"存配置"，不产生任何计提。
-- 状态机（卡 §三① 逐字，落地在服务层，不在库里建触发器）：
--   PENDING→ACTIVE；ACTIVE↔FROZEN；ACTIVE/FROZEN→TERMINATED。非法流转由服务层抛 400。
-- 为什么不建物理外键（卡内硬约束）：仓内既有迁移一律"唯一索引 + 应用层保证"，外键在 runner 下
--   曾两次致全新库建表失败（S3-52 / S3-55）。level_id 仅逻辑引用 t_agent_level.id，**同型对齐**。
-- 列类型说明（与 184 的 updated_by 同一口径）：
--   1) level_id 取 BIGINT UNSIGNED，因为被引用列 t_agent_level.id（迁移 187）就是 BIGINT UNSIGNED。
--      判据是"被引用列的实际类型"，不是"越宽越统一"（C6-0 §二 逻辑引用必须与被引用列类型对齐）。
--      卡 §三① 逐字写的是 BIGINT，本文件按"被引用列同型"口径取 BIGINT UNSIGNED——回传卡已如实报备。
--   2) updated_by = INT NULL，被引用列 t_platform_admin.id 是 int（080_平台管理员.sql:11）。
-- 文本列全部**显式** COLLATE utf8mb4_0900_ai_ci（卡内硬约束），不依赖库默认。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--   —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--   注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（179/180/183/184/185 同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--   safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径 + MIG-4 写闸门默认 block）：迁移只做结构，不写任何种子行（INSERT 命中 0）。
--   文件末尾第 3 条跑后核对 SELECT 对本表做 COUNT，恒 0 行是**预期结果**（"迁移不写数据"的旁证），
--   不是缺陷；代理商行只允许由平台后台 POST /api/platform/agents 的真实建档产生。
