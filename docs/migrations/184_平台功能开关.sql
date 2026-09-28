CREATE TABLE IF NOT EXISTS t_platform_feature_switch (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  feature_code VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能编码（唯一，如 multi_warehouse / multi_unit / member / miniapp / open_api / report）',
  feature_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能名称',
  enabled TINYINT NOT NULL DEFAULT 0 COMMENT '全局启停：1-启用/0-停用',
  default_for_new_tenant TINYINT NOT NULL DEFAULT 0 COMMENT '新租户初始化默认值：1-默认启用/0-默认停用',
  remark VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  updated_by INT NULL COMMENT '最近更新人（逻辑引用 t_platform_admin.id，类型对齐 int，不建物理外键；NULL=未记录）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_feature_code (feature_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台全局功能开关（平台级"能不能开"，一个功能编码一行）';

SELECT COUNT(*) AS c184_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_platform_feature_switch';

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_platform_feature_switch'
   AND COLLATION_NAME IS NOT NULL
 ORDER BY COLUMN_NAME;

SELECT COUNT(*) AS c184_row_count FROM t_platform_feature_switch;

-- ============================================
-- 迁移编号：184
-- 描述：R101-C6-3-1 平台全局功能开关（单张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-09-27
-- 依据：docs/tasks/cards/R101-派单-20260927-C6-3-1.md 交付物 A①（逐列口径）
--       docs/智享全链_总后台建设规划_v1.3.html「全局功能开关」P0 段
--         （原文：多仓库/多单位/会员/小程序/API 接口/报表模块等全局启停，配置"新租户默认启用项"）
--       docs/tasks/cards/R101-C6-3-凌舟裁定（待接入剩余 43 处的分批与口径）.md §二 裁定 2
-- 分层口径（不得混用，卡 §二 硬口径）：
--   本表＝平台**能不能开**（平台级，一个 feature_code 一行，default_for_new_tenant 决定新租户初始化默认值）
--   套餐矩阵＝这个**租户有没有**（既有 t_subscription_plan.features / module_access，本单不改其语义与取值）
-- 与既有表的边界（红线①②③）：
--   不新增任何列/索引到 t_subscription_plan，不写 t_platform_config 任何键值行（R8 已证该表是即时零售凭据表），
--   不新增任何运行时"按开关拦截"的逻辑（没有调用方就不接，避免假门禁）。
-- 为什么建新表而不是塞进 t_platform_config（R8，卡 §一.4）：生产 SHOW CREATE TABLE 已证 t_platform_config
--   是即时零售凭据表（config_key/config_value 单行键值，语义已被占用），塞全局开关会让两域语义互相污染，
--   且开关需要 enabled / default_for_new_tenant 两个独立布尔列与按 feature_code 的唯一约束，键值表表达不了。
-- 为什么不建物理外键（卡内硬约束 + 立项卡 §二）：仓内既有迁移一律用"唯一索引 + 应用层保证"，
--   外键约束在 runner 下已两次致全新库建表失败（S3-52 / S3-55）。updated_by 仅逻辑引用 t_platform_admin.id，
--   且本列类型与被引用列逐字对齐：INT ← t_platform_admin.id 的 int（口径见下"列类型说明"）。
-- 列类型说明（C6-3-1-F1 回卡后定稿，2026-09-29）：updated_by = INT NULL。
--   1) 依据（凌舟回卡 D5，本仓硬口径）：逻辑引用必须与被引用列类型对齐（C6-0 §二）。被引用列
--      t_platform_admin.id 是 int —— 建表原文见 080_平台管理员.sql:11 "id INT AUTO_INCREMENT PRIMARY KEY"，
--      同族既有列同一口径（180 assignee_id / 181 target_admin_id,admin_id / 182 admin_id / 183 operator_id）。
--      原稿按卡内逐字写 BIGINT NULL，与上述口径不一致，已在 F1 修正，无任何代码需要跟着改
--      （服务层是 operatorId?: number | null，与 INT 同一域，故本次未改任何 ts 文件）。
--   2) 与 185 的对照（为什么本列 INT、185 的 dict_id 却是 BIGINT UNSIGNED）：185 的 t_platform_dict_item.dict_id
--      引用的是**本批新建表自己的自增主键** t_platform_dict.id = BIGINT UNSIGNED，被引用列是 BIGINT UNSIGNED，
--      故引用列必须同型取 BIGINT UNSIGNED。判据是"被引用列的实际类型"，不是"越宽越统一"：
--      引用 t_platform_admin.id（int）取 INT，引用 t_platform_dict.id（BIGINT UNSIGNED）取 BIGINT UNSIGNED，
--      引用 t_tenant.id（varchar(36)）取 varchar(36)（180 同口径）。
--   3) 影响面与成本：本表不建物理外键，故原 BIGINT 不会致建表失败，但联表/聚合会踩 INT↔BIGINT 隐式转换与
--      索引失效，属 C6-0 A 类（列类型错配）同族隐患。收窄发生在**任何环境执行本迁移之前**（迁移尚未在任何库执行），
--      无数据迁移、无回填、无存量行需要转换。
-- 文本列全部**显式** COLLATE utf8mb4_0900_ai_ci（卡内硬约束）：不依赖库默认，避免 DEFAULT COLLATE 漂移。
-- 语句位置：可执行语句（1 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--   —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--   注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（179/180/183 迁移同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--   safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径 + MIG-4 写闸门默认 block）：迁移只做结构，不写任何种子行（INSERT 命中 0）。
--   文件末尾第 3 条跑后核对 SELECT 对本表做 COUNT，恒 0 行是**预期结果**（"迁移不写数据"的旁证），
--   不是缺陷；开关行只允许由平台后台 PUT /api/platform/config/feature-switches/:code 之外的登记入口产生
--   （本单不提供登记端点：卡 §三A② 只有 GET 列表 + PUT 改已有的两条，空表即诚实空态）。
