ALTER TABLE t_library_brand
  ADD COLUMN auth_letter_url VARCHAR(512) DEFAULT NULL COMMENT '品牌授权书文件 URL（NULL=未上传）',
  ADD COLUMN auth_expired_at DATETIME DEFAULT NULL COMMENT '授权有效期截止（NULL=未设置，不造默认值）',
  ADD COLUMN auth_status VARCHAR(16) DEFAULT NULL COMMENT '授权状态 AUTHORIZED/EXPIRED/NONE（NULL=未设置）',
  ALGORITHM=INSTANT;

ALTER TABLE t_app_version
  ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED' COMMENT '发布状态 DRAFT/PUBLISHED/PAUSED/ARCHIVED（历史行按已发布）',
  ADD COLUMN gray_ratio TINYINT NOT NULL DEFAULT 0 COMMENT '灰度放量比例 0-100（0=未放量）',
  ADD COLUMN archived_at DATETIME DEFAULT NULL COMMENT '归档时间（NULL=未归档）',
  ALGORITHM=INSTANT;

SELECT COUNT(*) AS c6_new_column_count FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND ((TABLE_NAME = 't_library_brand' AND COLUMN_NAME IN ('auth_letter_url', 'auth_expired_at', 'auth_status'))
     OR (TABLE_NAME = 't_app_version' AND COLUMN_NAME IN ('status', 'gray_ratio', 'archived_at')));

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND ((TABLE_NAME = 't_library_brand' AND COLUMN_NAME IN ('auth_letter_url', 'auth_expired_at', 'auth_status'))
     OR (TABLE_NAME = 't_app_version' AND COLUMN_NAME IN ('status', 'gray_ratio', 'archived_at')))
 ORDER BY TABLE_NAME, COLUMN_NAME;

-- ============================================
-- 迁移编号：178
-- 描述：C6-1A INSTANT 加列一组两条 ALTER
--        ① t_library_brand 追加 auth_letter_url / auth_expired_at / auth_status（品牌授权书与授权状态）
--        ② t_app_version   追加 status / gray_ratio / archived_at（发布状态、灰度比例、归档时间）
-- 创建人：阿坚（后端）
-- 日期：2026-09-25
-- 依据：docs/tasks/cards/R101-C6-0-阿坚清账.md 四.1（② 类 11 条之 #27 品牌授权书、#34 草稿、#36 放量/归档）
--       + 同卡 四.4 INSTANT 加列清单 C1 三列 / C2 三列（同表合并为一条 ALTER 的登记建议）
--       + docs/tasks/cards/R101-C6-凌舟裁定（C6-0清账后）.md 三 R5③（t_app_version 加 status 列，本批可做）
--       + docs/tasks/cards/R101-派单-20260925-C6-1A.md 交付物① ②（加列须幂等可重复执行）
-- 幂等：重复执行时 MySQL 返回 ER_DUP_FIELDNAME（1060），safeExec 按跳过规则静默忽略，
--       故本文件在每次启动的外部迁移段重跑均无害（本仓无迁移账本表，每次启动都会重跑）
-- 语句位置：可执行语句（两条 ALTER + 两条跑后核对 SELECT）顶格放在注释块之前
--       —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」
--       注意：注释文字内不得出现 ASCII 分号，否则注释块会被切成两半
-- 表名写法：不加反引号（MIG-2：addTablePrefix 对反引号表名的早期缺陷），两表均已带 t_ 前缀
-- 边界（硬约束遵守声明）：
--   ① 只做追加：仅 ADD COLUMN 六列，零改既有列类型/collation、零删列、零新建表、零索引变更 ✔
--   ② 不含 DML（无插入/更新/删除语句），写闸门 block 下亦不被跳过 ✔
--   ③ 显式 ALGORITHM=INSTANT（仅加列、不动行格式），符合前置裁定 三.2 的允许范围 ✔
--   ④ 空值口径：auth_* 三列与 archived_at 均可空且默认 NULL —— 未上传/未设置必须可区分于空串与 0，
--      不得用默认值冒充「已配置」（凌舟裁定 四 与 三 R5③ 的口径）
--   ⑤ status 列 NOT NULL DEFAULT 'PUBLISHED' —— 历史 3 行（admin_web/app_mobile/print_agent）
--      的真实语义就是「已发布且启用」，故默认值不是造值，而是既有事实的显式化
--   ⑥ 未包含 t_library_spu.ai_confidence（清账卡 四.4 的 C3 单列）—— 不在本单派工范围（属 ① 类 #20
--      的前端接线需求），已按派单规范在回传卡「未完成与阻塞／需裁定」中列出待凌舟裁定
-- 执行：由凌舟在生产执行（本单不执行任何迁移）。执行前先取两表行数 + 备份
--       （生产只读实测 2026-09-25 03:37：t_library_brand=28 行、t_app_version=3 行，均为小表，瞬时完成）
-- 回滚（须由人工在真库执行）：ALTER TABLE t_library_brand DROP COLUMN auth_letter_url, DROP COLUMN auth_expired_at,
--       DROP COLUMN auth_status 与 ALTER TABLE t_app_version DROP COLUMN status, DROP COLUMN gray_ratio,
--       DROP COLUMN archived_at（执行管线跳过 DROP，故本文件内不含回滚语句）
-- ============================================
