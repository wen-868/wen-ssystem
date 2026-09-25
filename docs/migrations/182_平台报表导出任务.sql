CREATE TABLE IF NOT EXISTS t_platform_export_task (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  task_no VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '任务编号（唯一，形如 EXP+yyyyMMddHHmmss+4位随机数）',
  export_type VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '导出类型（业务侧取值由前端导出面板给出，如 tenantFinance/resourceCost/planDistribution）',
  period VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '导出周期（如 thisMonth/lastMonth，NULL=未指定）',
  format VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'CSV' COMMENT '导出格式：CSV/XLSX（仅此两值，端点层枚举校验）',
  status VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING-待生成（创建即此态）/GENERATING-生成中（生成器接入后才会出现）/SUCCESS-成功（仅生成器可置）/FAILED-失败',
  progress INT NOT NULL DEFAULT 0 COMMENT '进度百分比：0-100（创建即 0，生成器接入后由生成器推进）',
  file_url VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '导出文件地址（NULL=尚无文件，只允许未来的生成器写入，本单任何端点都不写此列）',
  file_size BIGINT NULL COMMENT '文件大小（字节，NULL=未知，不做 0 冒充）',
  error_message VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '失败原因（NULL=无错误，retry 重排后清空）',
  admin_id INT NULL COMMENT '创建人ID（逻辑引用 t_platform_admin.id，NULL=未记录，不建物理外键）',
  started_at DATETIME NULL COMMENT '开始生成时间（NULL=未开始，本单恒 NULL，由生成器写入）',
  finished_at DATETIME NULL COMMENT '生成结束时间（NULL=未结束，由生成器写入）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_task_no (task_no),
  KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台报表导出任务（C6-2-T2，生成器待接入：创建后保持 PENDING）';

CREATE TABLE IF NOT EXISTS t_platform_export_task_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  task_id BIGINT UNSIGNED NOT NULL COMMENT '任务ID（逻辑引用 t_platform_export_task.id，不建物理外键）',
  level VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'INFO' COMMENT '日志级别：INFO-普通/WARN-警告/ERROR-错误',
  message VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '日志内容',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_task_created (task_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台报表导出任务日志（按任务ID与创建时间升序读取）';

SELECT COUNT(*) AS c182_new_table_count FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('t_platform_export_task', 't_platform_export_task_log');

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('t_platform_export_task', 't_platform_export_task_log')
    AND COLLATION_NAME IS NOT NULL
  ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT
  (SELECT COUNT(*) FROM t_platform_export_task) AS c182_task_row_count,
  (SELECT COUNT(*) FROM t_platform_export_task_log) AS c182_log_row_count;

-- ============================================
-- 迁移编号：182
-- 描述：平台报表导出任务中心（任务表 t_platform_export_task 与任务日志表 t_platform_export_task_log）
-- 创建人：阿坚（后端）
-- 日期：2026-09-26
-- 交付：R101-C6-2-T2（P2，派单卡 docs/tasks/cards/R101-派单-20260926-C6-2-T2.md 交付物①）
-- 依据：立项卡 R101-C6-2-批2-立项卡-T1+T2+T3+T5 第二节 T2 行与第三节通用硬口径
--       清账卡 R101-C6-0-阿坚清账 五.2-T2（两表字段草案）
--       设计稿字段来源 saas-admin/src/views/Dashboard.vue（exportType/exportPeriod/exportFormat/exportTasks/isGenerating）
-- ============================================
-- 口径（逐条可核对）
--   ① 纯 DDL、零预置：本文件不含任何数据写语句（写闸门 block 下也能执行），
--      枚举取值一律走代码常量（立项卡第三节第 2 条，照 179/180 的做法）
--   ② 本单只做"任务中心 + 状态机 + 日志"骨架：创建即 PENDING（本仓没有导出 worker，
--      没有人在生成就不许显示"生成中"，凌舟裁定见派单卡背景与依据第 4 条）
--   ③ 文本列一律显式 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci（立项卡第三节第 1 条）
--   ④ 不建任何物理外键（外键 0 条）：admin_id 逻辑引用 t_platform_admin.id（int），
--      task_id 逻辑引用 t_platform_export_task.id（bigint unsigned）
--   ⑤ 不改任何既有表（零改列/零删列），不新增或修改其它迁移文件
--   ⑥ 防"假成功"不变量：file_url / file_size / started_at / finished_at 只允许由未来的生成器写入，
--      本单任何端点都不写这四列，status 只允许由生成器置 SUCCESS
--   ⑦ 注释块全部位于可执行语句之后（MIG-1 与踩坑 [63] 的约定），注释文字内不含 ASCII 分号
--   ⑧ 三段跑后核对 SELECT 均为只读：预期 c182_new_table_count = 2、文本列 collation 全为
--      utf8mb4_0900_ai_ci、两表行数均为 0（0 行是预期结果而不是缺陷）
--   ⑨ 状态四态 PENDING/GENERATING/SUCCESS/FAILED、格式两值 CSV/XLSX、日志级别三值 INFO/WARN/ERROR
--      的单一真相源是后端常量（backend/src/services/platform/platform-export-task.service.ts 的
--      EXPORT_TASK_STATUSES / EXPORT_TASK_FORMATS / EXPORT_TASK_LOG_LEVELS），本文件只声明列口径
--   ⑩ 生成器（导出执行器）本单不实现：创建后恒为 PENDING、progress 恒 0、文件四列恒 NULL，
--      已在回传卡「未完成与阻塞」栏显式登记"生成器待接入"
-- ============================================
-- 回滚（须由人工在真库执行，迁移管线会跳过删表语句，故本文件内不含回滚语句）：
--   顺序：先删 t_platform_export_task_log，再删 t_platform_export_task（日志表逻辑引用任务表）
-- ============================================
