ALTER TABLE t_ai_audit_log
  ADD COLUMN cost DECIMAL(12,4) DEFAULT NULL COMMENT '本次调用费用（元，4位小数；NULL=未记录，不造0）',
  ADD COLUMN deduct_source VARCHAR(32) DEFAULT NULL COMMENT '扣减来源：free_grant/monthly_quota/points/overage（NULL=未记录）',
  ALGORITHM=INSTANT;

SELECT COUNT(*) AS ai_audit_log_new_column_count FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_ai_audit_log'
   AND COLUMN_NAME IN ('cost', 'deduct_source');

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_ai_audit_log'
   AND COLUMN_NAME IN ('cost', 'deduct_source')
 ORDER BY COLUMN_NAME;

-- ============================================
-- 迁移编号：177
-- 描述：t_ai_audit_log 追加 cost（费用，元）与 deduct_source（扣减来源）两列
-- 创建人：阿坚（后端 · 本地子代理代执行）
-- 日期：2026-09-24
-- 依据：docs/tasks/cards/R101-派单-20260924-C5.md 交付物①（派单人 凌舟（总负责人）｜2026-09-24）
--       + docs/tasks/cards/R101-C5-0-凌舟裁定.md 三.2（授权 ALTER ADD COLUMN、必须显式 ALGORITHM=INSTANT）
--       + R101-C5-0-阿坚清账.md 四.E2（逐次明细 t_ai_audit_log 缺费用与扣减来源两列）
-- 幂等：重复执行时 MySQL 返回 ER_DUP_FIELDNAME（1060），safeExec 按 SKIP_ERRORS 静默跳过，
--       故本文件在每次启动的外部迁移段重跑均无害（本仓无迁移账本表，每次启动都会重跑）。
-- 语句位置：可执行语句（ALTER + 两条跑后核对 SELECT）顶格放在注释块之前
--       —— 规避踩坑日志 [63]／MIG-1「以注释开头的整块语句被 runner 丢弃」。
--       注意：注释文字内不得出现 ASCII 分号（否则注释块会被切成两半，后半段成为伪语句被误执行）。
-- 表名写法：不加反引号（MIG-2：addTablePrefix 对反引号表名的早期缺陷），且 t_ai_audit_log 已带 t_ 前缀。
-- 边界（硬约束遵守声明）：
--   ① 只做追加：仅 ADD COLUMN 两列，零改既有列、零删列、零新建表 ✔
--   ② 不改唯一键与索引、不含 DML（无 INSERT/UPDATE/DELETE，写闸门 block 下亦不被跳过）✔
--   ③ 两列均可空且默认 NULL —— 历史行无法回填（当时未记录），凭空造值即造假，
--      故「未记录」必须可区分于「0 元」，接口侧按空态返回 null（凌舟裁定 三.4：本轮不回填）。
--   ④ 类型口径：cost DECIMAL(12,4) 与既有金额列 t_ai_usage_daily.prompt_cost/completion_cost/total_cost
--      的 DECIMAL(12,4) 完全一致（docs/migrations/121_ai_base_tables.sql:97-99）⇒ 无口径冲突。
-- 执行：由凌舟在生产执行（本单不执行任何迁移）。执行前应先取 t_ai_audit_log 行数 + 备份。
-- 回滚（须由人工在真库执行）：ALTER TABLE t_ai_audit_log DROP COLUMN cost, DROP COLUMN deduct_source
--       （执行管线跳过 DROP，故本文件内不含回滚语句）
-- ============================================
