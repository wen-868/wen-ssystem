CREATE TABLE IF NOT EXISTS t_platform_role (
  id INT AUTO_INCREMENT COMMENT '主键',
  name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色名称',
  code VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色编码（唯一，小写字母开头 2-32 位）',
  type VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'custom' COMMENT '角色类型：builtin-内置/custom-自定义（仅此两值）',
  remark VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '备注（NULL=未填写）',
  enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：1-启用/0-停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台角色';

CREATE TABLE IF NOT EXISTS t_platform_role_permission (
  id INT AUTO_INCREMENT COMMENT '主键',
  role_id INT NOT NULL COMMENT '角色ID（t_platform_role.id）',
  module_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能域编码（取值以后端常量 PERMISSION_CATALOG 的 moduleCode 为准）',
  can_menu TINYINT NOT NULL DEFAULT 0 COMMENT '菜单级权限：1-有/0-无',
  can_page_btn TINYINT NOT NULL DEFAULT 0 COMMENT '页面按钮级权限：1-有/0-无',
  data_scope VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '数据范围（取值=后端常量 PERMISSION_CATALOG 中 permLevel=DATA 的 permCode，NULL=未设置）',
  PRIMARY KEY (id),
  UNIQUE KEY uk_role_module (role_id, module_code),
  KEY idx_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台角色权限矩阵（每角色每功能域一行）';

CREATE TABLE IF NOT EXISTS t_platform_permission_catalog (
  id INT AUTO_INCREMENT COMMENT '主键',
  module_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能域编码',
  module_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '功能域名称',
  perm_code VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '权限点编码（唯一）',
  perm_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '权限点名称',
  perm_level VARCHAR(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '权限点级别：MENU-菜单/BUTTON-页面按钮/DATA-数据范围',
  PRIMARY KEY (id),
  UNIQUE KEY uk_perm_code (perm_code),
  KEY idx_module_level (module_code, perm_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台权限点目录（系统能力枚举，非业务数据）';

SELECT COUNT(*) AS c179_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('t_platform_role', 't_platform_role_permission', 't_platform_permission_catalog');

SELECT module_code, perm_level, COUNT(*) AS perm_count FROM t_platform_permission_catalog
 GROUP BY module_code, perm_level
 ORDER BY module_code, perm_level;

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('t_platform_role', 't_platform_role_permission', 't_platform_permission_catalog')
   AND COLLATION_NAME IS NOT NULL
 ORDER BY TABLE_NAME, COLUMN_NAME;

-- ============================================
-- 迁移编号：179
-- 描述：C6-2-T6 平台角色与权限点目录（三张新表，纯 DDL 无预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-09-26
-- 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T6-F2.md（交付物①：迁移回归纯 DDL，目录数据由代码常量提供）
--       docs/tasks/cards/R101-派单-20260926-C6-2-T6.md（交付物① 逐列口径；其红线⑥ 的预置口径已被 F2 取代）
--       docs/tasks/cards/R101-C6-2-批1-立项卡-T6+T7.md §三（T6 范围）、§二（文本列显式 COLLATE，禁默认继承）、
--       §六（迁移口径：零改既有表 / 编号顺延 / 新表全新库可全量建成 / DML 闸门）
--       docs/tasks/cards/R101-C6-0-阿坚清账.md §5.2-T6（表草案：t_platform_role / t_platform_role_permission /
--       t_platform_permission_catalog）
-- 与既有表的边界（红线①②）：本文件**不含任何既有表的结构变更**，也不复用、不修改租户级角色/权限两表
--       （t_sys_ 前缀，两表自带 tenant_id，属租户域）；本文件只新增平台级三表，三表均无 tenant_id。
-- 三表关系（一文件一主题，文件末尾注释说明，派单卡交付物① 要求）：
--       ① t_platform_role 是角色主表，code 唯一，type 只允许 builtin|custom；
--       ② t_platform_role_permission 是"角色 x 功能域"的三级权限矩阵（can_menu / can_page_btn / data_scope），
--          role_id 指向 ①的 id（逻辑外键，按立项卡 §二不建物理外键，避免全新库因类型/引擎差异建表失败）；
--          module_code 的取值域由后端代码常量 PERMISSION_CATALOG 决定（不是自由字符串，见 ③）；
--       ③ t_platform_permission_catalog 是权限点目录表：为将来"后台可配目录"预留，**本期未启用**，
--          不读不写、不参与任何查询。module_code 的取值域（"有哪些功能域"）由后端代码常量
--          PERMISSION_CATALOG 决定 ⇒ 矩阵端点行数 = 常量里 module_code 去重数，常量外的 module_code 一律 400。
-- 语句位置：可执行语句（3 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--       —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--       注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（178 迁移同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--       safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无数据写语句、重跑无副作用。
-- 目录数据不在迁移里写（C6-2-T6-F2 凌舟裁定，取代原单红线⑥"预置 18 条"口径）：
--       MIG-4 写闸门默认 block —— resolveWriteGate() 只认环境变量 MIGRATION_WRITE_GATE，
--       未设置或非法值一律回落 block（fail-safe），数据写语句与 CALL 一律跳过并逐条留日志，
--       没有任何"按文件/按语句豁免"机制；而 runMigrations() 由 server.ts 每次启动调用、
--       全仓无执行账本表 ⇒ 迁移里的预置 INSERT 根本不会落库，放行 allow 又会让所有迁移的写语句
--       随每次重启复利叠加（这正是 MIG-4 建闸门要防的事）。
--       因此目录的单一真相源 = 后端代码常量 PERMISSION_CATALOG（18 条：7 域各 1 条 MENU = <module>:view、
--       ticket 域 7 条 BUTTON、4 条 DATA），定义在 backend/src/services/platform/platform-role.service.ts，
--       由 GET /api/platform/permissions/catalog 直接给出，环境无关、无重复写风险。
--       本文件末尾第 2 条跑后核对 SELECT 对目录表做 GROUP BY 统计：空表恒 0 行，
--       这正是"迁移不写数据"的旁证（0 行是预期结果，不是缺陷）。
--       口径与 MIG-4 一致：迁移只做结构，数据写入需显式、幂等、可追溯。
-- 三表均无 tenant_id（平台级资产，与平台端 /api/platform/* 一致），文本列一律显式 CHARACTER SET utf8mb4
--       COLLATE utf8mb4_0900_ai_ci（立项卡 §二 硬约束：不默认继承库 collation）。
-- ============================================
