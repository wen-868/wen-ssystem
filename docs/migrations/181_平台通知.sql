CREATE TABLE IF NOT EXISTS t_platform_notification (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知标题',
  content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '通知正文（NULL=无正文）',
  type VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知类型（取值由业务侧约定，本表不限定枚举）',
  level VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'INFO' COMMENT '级别：INFO-提示/WARN-警告/URGENT-紧急',
  target_admin_id INT NULL COMMENT '定向管理员ID（逻辑引用 t_platform_admin.id，类型对齐 int；NULL=全员通知）',
  link_url VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '跳转链接（NULL=无跳转）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_target_created (target_admin_id, created_at),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台通知主表（C6-2-T1）';

CREATE TABLE IF NOT EXISTS t_platform_notification_read (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  notification_id BIGINT UNSIGNED NOT NULL COMMENT '通知ID（逻辑引用 t_platform_notification.id，不建物理外键）',
  admin_id INT NOT NULL COMMENT '已读管理员ID（逻辑引用 t_platform_admin.id，类型对齐 int）',
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '已读时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_notif_admin (notification_id, admin_id),
  KEY idx_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台通知已读记录（每管理员每通知至多一行）';

SELECT COUNT(*) AS c181_new_table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('t_platform_notification', 't_platform_notification_read');

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('t_platform_notification', 't_platform_notification_read')
   AND COLLATION_NAME IS NOT NULL
 ORDER BY TABLE_NAME, COLUMN_NAME;

SELECT COUNT(*) AS c181_read_row_count FROM t_platform_notification_read;

-- ============================================
-- 迁移编号：181
-- 描述：C6-2-T1 平台通知与其已读两表（纯 DDL 无预置数据）
-- 创建人：阿坚（后端）
-- 日期：2026-09-26
-- 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T1.md（交付物① 逐列口径、验收标准③④）
--       docs/tasks/cards/R101-C6-2-批2-立项卡-T1+T2+T3+T5.md §二 T1 行、§三 通用硬口径
--       docs/tasks/cards/R101-C6-0-阿坚清账.md §5.2（T1 两表字段草案）
-- 两表关系（一文件一主题）：① t_platform_notification 是通知主表，target_admin_id 为 NULL 表示全员通知、
--       非 NULL 表示定向到某个平台管理员（类型对齐 t_platform_admin.id 的 int）；
--       ② t_platform_notification_read 是"某管理员读了某通知"的明细，通知ID + 管理员ID 建唯一键，
--       因此同一管理员对同一通知至多一行，重复标记已读天然幂等（配合 INSERT IGNORE 使用）。
-- 为什么不建物理外键（卡内裁定 + 立项卡 §二）：仓内既有迁移一律用"索引 + 应用层保证"，
--       外键约束在 runner 下已两次致全新库建表失败（S3-52 / S3-55）；但引用列的**类型逐字对齐**被引用列
--       （t_platform_admin.id = int），避免同族缺陷复发。
-- 未读数口径（卡内硬口径）：未读 = 通知表按"当前管理员可见"过滤后左连接已读表、已读行不存在者。
--       可见 = 全员通知或定向给当前管理员。未读数一律由服务端按当前管理员实时计算，
--       **不得**用前端本地存储或进程内缓存冒充（立项清单 R1，零假数据）。
-- 语句位置：可执行语句（2 条 CREATE TABLE + 3 条跑后核对 SELECT）顶格放在注释块之前
--       —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--       注释文字内不出现 ASCII 分号，避免注释块被 splitSqlStatements 切成两半（178/179/180 迁移同规）。
-- 幂等（精确表述）：本仓无迁移账本表，每次后端启动都会重跑本文件。CREATE TABLE IF NOT EXISTS 重跑时整条被
--       safeExec 跳过（表已存在）⇒ 已建表不重复建；本文件无任何数据写语句、重跑无副作用。
-- 零预置数据（卡内硬口径）：两表均不写种子数据——通知业务内容由平台侧后续写入，不属迁移职责；
--       迁移只做结构，数据写入需显式、幂等、可追溯（MIG-4 写闸门默认 block，见 migration.ts）。
--       文件末尾第 3 条跑后核对 SELECT 对已读表做 COUNT：恒 0 行是**预期结果**（"迁移不写数据"的旁证），不是缺陷。
-- 平台级语义：两表均为平台侧自有数据，不携带 tenant_id（与租户侧 t_notification 系列表相互独立，
--       本单不复用、不混用租户侧通知表）。
--       t_platform_notification 的全部文本列一律显式 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
--       （立项卡 §二 硬约束：不默认继承库级排序规则）。
-- ============================================
