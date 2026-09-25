CREATE TABLE IF NOT EXISTS t_support_ticket (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  ticket_no VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '工单编号（唯一）',
  tenant_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '租户ID（逻辑引用 t_tenant.id，逐字对齐 varchar(36)/utf8mb4_0900_ai_ci，按立项卡不建物理外键）',
  category_id BIGINT UNSIGNED NOT NULL COMMENT '工单类型ID（逻辑引用 t_support_ticket_category.id，不建物理外键）',
  title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '工单标题',
  description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '问题描述（NULL=未填写）',
  priority VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'NORMAL' COMMENT '优先级：LOW/NORMAL/HIGH/URGENT',
  status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING-待处理/PROCESSING-处理中/RESOLVED-已解决/CLOSED-已关闭',
  assignee_id INT NULL COMMENT '受理人ID（逻辑引用 t_platform_admin.id，类型对齐 int；NULL=未分配）',
  sla_deadline DATETIME NULL COMMENT 'SLA 截止时间（SLA 口径未定，本期恒 NULL 不计算，禁止近似值冒充）',
  resolved_at DATETIME NULL COMMENT '解决时间（NULL=未解决）',
  closed_at DATETIME NULL COMMENT '关闭时间（NULL=未关闭）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ticket_no (ticket_no),
  KEY idx_tenant_status (tenant_id, status),
  KEY idx_assignee_status (assignee_id, status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台工单主表（C6-2-T7）';

CREATE TABLE IF NOT EXISTS t_support_ticket_message (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  ticket_id BIGINT UNSIGNED NOT NULL COMMENT '工单ID（逻辑引用 t_support_ticket.id，不建物理外键）',
  sender_type VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '发送方类型：PLATFORM-平台/TENANT-租户/SYSTEM-系统',
  sender_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '发送方ID（平台侧=管理员ID字符串，租户侧=用户ID字符串，NULL=系统留痕不记名）',
  sender_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '发送方名称（NULL=未记录）',
  bubble_type VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PUBLIC' COMMENT '气泡类型：PUBLIC-公开回复/INTERNAL-内部备注/TENANT-租户消息（内部备注不得出现在租户可见接口）',
  content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '消息内容',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_ticket_created (ticket_id, created_at),
  KEY idx_bubble_type (bubble_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台工单消息（公开回复与内部备注按 bubble_type 区分）';

CREATE TABLE IF NOT EXISTS t_support_ticket_attachment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  ticket_id BIGINT UNSIGNED NOT NULL COMMENT '工单ID（逻辑引用 t_support_ticket.id，不建物理外键）',
  message_id BIGINT UNSIGNED NULL COMMENT '消息ID（逻辑引用 t_support_ticket_message.id；NULL=尚未绑定消息）',
  file_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '文件名',
  file_url VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '文件地址',
  file_size INT NOT NULL DEFAULT 0 COMMENT '文件大小（字节，0=未知）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_ticket_id (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台工单附件';

CREATE TABLE IF NOT EXISTS t_support_ticket_category (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型名称',
  slug VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型标识（唯一）',
  sla_hours INT NOT NULL DEFAULT 24 COMMENT 'SLA 小时数（仅配置字段保留，SLA 口径未定，本期不参与任何计算）',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号（升序，越小越靠前）',
  enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：1-启用/0-停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台工单类型配置（本期零预置数据）';

SELECT COUNT(*) AS c180_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('t_support_ticket', 't_support_ticket_message', 't_support_ticket_attachment', 't_support_ticket_category');

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('t_support_ticket', 't_support_ticket_message', 't_support_ticket_attachment', 't_support_ticket_category')
   AND COLLATION_NAME IS NOT NULL
 ORDER BY TABLE_NAME, COLUMN_NAME;

SELECT COUNT(*) AS c180_category_row_count FROM t_support_ticket_category;

-- ============================================
-- 迁移编号：180
-- 描述：C6-2-T7 平台工单系统（四张新表，纯 DDL 无预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-09-26
-- 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T7.md（交付物① 逐列口径、验收标准③④⑧）
--       docs/tasks/cards/R101-C6-2-批1-立项卡-T6+T7.md §四（T7 范围：4 表）、§二（引用列类型/collation 逐字对齐）、
--       §六（迁移口径：零改既有表 / 编号顺延 180 / 全新库可全量建成 / DML 写闸门）
--       docs/tasks/cards/R101-C6-0-阿坚清账.md §5.1.1（4 表字段草案；草案里 tenant_id 的旧长度与旧 collation 两处口径
--       已按立项卡 §二 的生产实测口径覆盖为 36 位长度 + utf8mb4_0900_ai_ci，不沿用草案原值）
-- 与既有表的边界（红线①②）：本文件**不含任何既有表的结构变更**（不增列、不改列、不删表、不建外键约束），
--       不触碰 t_tenant / t_platform_admin / t_sys_role / t_sys_permission。
-- 四表关系（一文件一主题，文件末尾注释说明，派单卡交付物① 要求）：
--       ① t_support_ticket 是工单主表，ticket_no 唯一，status 四态、priority 四档；
--       ② t_support_ticket_message 是工单会话，用 bubble_type 区分公开回复（PUBLIC）/内部备注（INTERNAL）/
--          租户消息（TENANT），ticket_id 指向 ①的 id；
--       ③ t_support_ticket_attachment 是工单附件，ticket_id 指向 ①、message_id 指向 ②（可为空）；
--       ④ t_support_ticket_category 是工单类型配置表，sla_hours 本期只作配置字段保留（SLA 口径未定）。
-- 为什么不建物理外键（卡内裁定 + 立项卡 §二）：仓内既有迁移一律用"索引 + 应用层保证"，
--       外键约束在 runner 下已两次致全新库建表失败（S3-52 / S3-55）；但**列类型与 collation 逐字对齐**
--       被引用列（t_tenant.id = varchar(36)/utf8mb4_0900_ai_ci、t_platform_admin.id = int），避免同族 A 类缺陷复发。
-- 语句位置：可执行语句（4 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--       —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--       注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（178/179 迁移同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--       safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径）：四表均不写种子数据——内置工单类型清单属产品口径未定，故 t_support_ticket_category
--       也不预置；迁移只做结构，数据写入需显式、幂等、可追溯（MIG-4 写闸门默认 block，见 migration.ts）。
--       文件末尾第 3 条跑后核对 SELECT 对类型表做 COUNT：恒 0 行是**预期结果**（"迁移不写数据"的旁证），不是缺陷。
-- 租户语义：仅 t_support_ticket 带 tenant_id（工单归属哪个租户），消息/附件/类型三表不带 tenant_id（卡内逐列口径）。
--       全部文本列一律显式 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci（立项卡 §二 硬约束：不默认继承库 collation）。
-- ============================================
