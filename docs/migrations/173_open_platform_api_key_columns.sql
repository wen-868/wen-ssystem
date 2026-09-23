ALTER TABLE `t_library_api_key`
  ADD COLUMN `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID（隔离键）' AFTER `app_name`,
  ALGORITHM=INSTANT;

ALTER TABLE `t_library_api_key`
  ADD COLUMN `qps` INT NOT NULL DEFAULT 10 COMMENT 'QPS 限流档位（次/秒，档位 10/30/50）' AFTER `daily_limit`,
  ALGORITHM=INSTANT;

ALTER TABLE `t_library_api_key`
  ADD COLUMN `scopes` JSON DEFAULT NULL COMMENT '权限范围（JSON 数组，元素形如 domain+rw；空=最小权限）' AFTER `qps`,
  ALGORITHM=INSTANT;

ALTER TABLE `t_library_api_key`
  ADD COLUMN `prev_api_key` VARCHAR(64) DEFAULT NULL COMMENT '轮换并行期旧 AppKey（保留 7 天）',
  ALGORITHM=INSTANT;

ALTER TABLE `t_library_api_key`
  ADD COLUMN `prev_api_secret` VARCHAR(256) DEFAULT NULL COMMENT '轮换并行期旧 AppSecret（bcrypt 存储）',
  ALGORITHM=INSTANT;

ALTER TABLE `t_library_api_key`
  ADD COLUMN `rotate_expire_at` DATETIME DEFAULT NULL COMMENT '轮换并行期截止时间（到期旧密钥失效；非空且未过期=轮换中）',
  ALGORITHM=INSTANT;

SELECT COUNT(*) AS api_key_new_column_count FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_library_api_key'
   AND COLUMN_NAME IN ('tenant_id','qps','scopes','prev_api_key','prev_api_secret','rotate_expire_at');

-- ============================================
-- 迁移编号：173
-- 描述：开放平台（R101-C3-1）t_library_api_key 加 6 列（租户隔离 / QPS / 权限范围 / 轮换并行期）
-- 创建人：阿坚
-- 日期：2026-09-23
-- 依据：docs/tasks/cards/R101-C3-0-凌舟裁定.md §三.2 + C3-0 清账 §四.2 DDL-1（已获裁定）
-- 执行顺序说明：本文件所有语句在注释之前 —— 规避 backend/src/shared/migration.ts
--   第 8 步「以 -- 开头的语句块被整块丢弃」缺陷（docs/踩坑日志.md [63]）。
-- 幂等说明：本仓无迁移账本表、每次启动重跑；safeExec 对 ER_DUP_FIELDNAME 静默跳过，
--   故每列一条 ALTER（部分列已存在时不会误伤其它列）。加列算法按 C3-0 裁定 §二.6 逐条显式声明为
--   瞬时（INSTANT，见每条 ALTER 语句尾部）：生产 MySQL 8.0.46 支持；不支持时会直接报错而非静默重建表。
-- 行数与备份：执行前须先取 SELECT COUNT(*) FROM t_library_api_key 并完成备份（统一标准 §12.2.4）。
-- 未做事项（禁止越界）：不新增索引（ADD INDEX 属 INPLACE、非 INSTANT，须另行评估）、
--   不修改任何既有列定义、不回填存量行（存量密钥的真实归属租户库内无从推断，禁止凭猜回填）。
-- 回滚（须由人工在真库执行）：移除本次新增的 6 列（rotate_expire_at / prev_api_secret / prev_api_key
--       / scopes / qps / tenant_id）；本文件内没有任何删列语句，回滚语句须人工编写。
-- ============================================
