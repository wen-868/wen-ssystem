ALTER TABLE t_shift ADD COLUMN shift_type VARCHAR(16) NOT NULL DEFAULT '' COMMENT '班次类型：MORNING/AFTERNOON/EVENING（空=按 start_time 派生）', ALGORITHM=INSTANT;

SELECT COUNT(*) AS c193_shift_type
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 't_shift'
   AND COLUMN_NAME = 'shift_type';

-- ============================================
-- 迁移编号：193
-- 描述：S3-147 t_shift 增列 shift_type（班次类型可显式指定并落库）
-- 创建人：阿坚（后端）
-- 日期：2026-10-02
-- 依据：docs/tasks/cards/R101-派单-20261002-S3-147.md §二 / §三①
--
-- 一、为什么要加这一列（真缺陷）
--   `t_shift` 原本没有 shift_type 列（生产 SHOW CREATE TABLE 实况，2026-10-02 凌舟核对），
--   「班次类型」只能在读侧按 start_time 派生（shift.service.ts 的 deriveShiftType）。
--   前端创建交接班时选了班次类型，后端 createShift 却不落库 ⇒ 用户的选择被丢弃，
--   列表与详情一律回落到按开始时间派生的值（09:30 选「中班」也会显示「早班」）。
--   本迁移只补列，让显式选择有落点。
--
-- 二、为什么只加列、不回填（零 DML）
--   MIG-4 写闸门默认 block，任何数据写语句（增/删/改）都会被跳过（S3-136 的教训）——
--   写了回填也是「假修复」。故本文件**只有** ALTER 与 SELECT，无任何数据写语句。
--   存量行的 shift_type 保持默认空串 ''，读侧回退派生（resolveShiftType：空值 ⇒ deriveShiftType），
--   因此存量数据的班次类型展示口径与改动前完全一致。
--
-- 三、列定义与默认值口径
--   VARCHAR(16) NOT NULL DEFAULT ''：'',MORNING,AFTERNOON,EVENING 四个取值。
--   '' 明确表示「未显式指定」，与「值非法」区分开——非法值在写侧直接 400，不会落库
--   （见 shift.service.ts 的 normalizeShiftTypeForWrite）。取值的合法性由应用层保证，
--   不在此处加 ENUM 或 CHECK，避免与既有库结构产生额外约束/锁表风险。
--
-- 四、幂等与执行方式
--   单列 ADD COLUMN + 显式 ALGORITHM=INSTANT（MySQL 8.0 起支持，加列不重建表）。
--   重跑时列已存在 ⇒ ER_DUP_FIELDNAME（duplicate column）由 safeExec 跳过，无副作用。
--   文件被 addTablePrefix 处理后表名为 t_shift，与真实库一致。
--   可执行语句顶格放在注释块之前，规避踩坑日志 [63] 的「以注释开头的整块语句被丢弃」。
--   注释文字内不出现 ASCII 分号。
-- ============================================
