CREATE TABLE IF NOT EXISTS t_platform_dict (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  dict_type VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典类型编码（唯一，本批四类：unit 计量单位/category_template 商品分类模板/payment_channel 支付渠道/bill_type 单据类型）',
  dict_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典类型名称',
  remark VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE-启用/DISABLED-停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_dict_type (dict_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台数据字典类型（四类平台级字典的父表，一行一类）';

CREATE TABLE IF NOT EXISTS t_platform_dict_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  dict_id BIGINT UNSIGNED NOT NULL COMMENT '字典类型ID（逻辑引用 t_platform_dict.id，不建物理外键）',
  item_code VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典项编码（同一字典类型内唯一）',
  item_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典项名称',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号（数字越小越靠前）',
  status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE-启用/DISABLED-停用',
  remark VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '备注（NULL=未填写，不得用空串冒充未填写）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_dict_item (dict_id, item_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台数据字典项（一行一个字典项，整包替换式维护）';

SELECT COUNT(*) AS c185_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('t_platform_dict', 't_platform_dict_item');

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('t_platform_dict', 't_platform_dict_item')
   AND COLLATION_NAME IS NOT NULL
 ORDER BY TABLE_NAME, COLUMN_NAME;

SELECT COUNT(*) AS c185_row_count FROM t_platform_dict;

SELECT COUNT(*) AS c185_item_row_count FROM t_platform_dict_item;

-- ============================================
-- 迁移编号：185
-- 描述：R101-C6-3-1 平台数据字典（父表 + 字典项两张新表，纯 DDL 零预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-09-27
-- 依据：docs/tasks/cards/R101-派单-20260927-C6-3-1.md 交付物 B①（逐列口径、四类字典类型）
--       docs/智享全链_总后台建设规划_v1.3.html「全局数据字典」P0 段
--         （原文：计量单位、商品分类模板、支付渠道、单据类型四类字典，支持预置模板并随租户初始化复制）
--       docs/tasks/cards/R101-C6-3-凌舟裁定（待接入剩余 43 处的分批与口径）.md §二 裁定 2
-- 两张表的分工（卡 §三B①）：
--   t_platform_dict       = 字典类型父表（一行一类，dict_type 唯一）
--   t_platform_dict_item  = 字典项子表（dict_id 逻辑引用父表，同类型内 item_code 唯一）
-- 与既有表的边界（红线①②③）：不动任何既有表结构，不写 t_platform_config 键值，不新增运行时拦截逻辑。
-- 为什么不建物理外键（卡内硬约束 + 立项卡 §二）：同 184，外键在 runner 下会致全新库建表失败（S3-52 / S3-55），
--   故 dict_id 只做"类型逐字对齐父表 id（BIGINT UNSIGNED）"的逻辑引用，一致性由应用层保证。
--   注意：父表主键是 BIGINT UNSIGNED（对齐 183 的 t_library_spu.id 风格），子表 dict_id 逐字同型，
--   避免同族 A 类"被引用列与引用列类型不一致"缺陷复发。
-- 文本列全部**显式** COLLATE utf8mb4_0900_ai_ci（卡内硬约束），不依赖库默认。
-- 唯一键说明：uk_dict_item (dict_id, item_code) 同时充当"按字典类型取字典项"的前缀索引
--   （dict_id 是最左前缀），故不再额外建 idx_dict。
-- 语句位置：可执行语句（2 条 CREATE TABLE + 4 条跑后核对 SELECT）顶格放在注释块之前
--   —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--   注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（179/180/183 迁移同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。两条 CREATE TABLE IF NOT EXISTS 重跑时
--   整条被 safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径 + MIG-4 写闸门默认 block）：迁移只做结构，不写任何种子行（INSERT 命中 0）。
--   **四类字典的"预置内容"不进迁移也不进库**：卡 §三B③ 定"预置内容走代码常量，不写进迁移"，
--   故末尾两条 COUNT 对本仓全新库恒 0 行，属预期结果而非缺陷；字典类型与字典项只允许由
--   PUT /api/platform/config/data-dict/:dictType 的真实整包替换产生（首写时按需补建父表行）。
-- 明确不做（卡 §三B③ 与 §六）："预置模板随租户初始化复制"不在本单，归属**初始化模板域**
--   （TemplateCenter.vue + platform-template.*），已在回传卡点名。灰度矩阵同样不在本单。
