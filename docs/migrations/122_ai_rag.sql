-- 编号: 122, 描述: AI底座RAG知识库分块向量表建表脚本
-- 创建人: 阿坚, 日期: 2026-08-02
-- 说明: R70-21 任务交付物。t_ai_knowledge_chunks 表用于持久化 RAG 知识库分块向量，
--       内存向量库（VectorStoreService）为查询主存储，本表用于重启后恢复（loadAllFromDb）。
--       依据《智享AI底座-架构设计文档》v3.2 第7.1节风格，按项目统一标准补充 created_at/updated_at、
--       collate utf8mb4_unicode_ci、必要索引。多租户隔离通过 tenant_id 逻辑关联，不做物理外键。
-- 负责人: 阿坚
-- 规则: 建表使用 IF NOT EXISTS 保护，末尾附验证 SQL
-- 兜底: 该表由 ai-base 运行时 VectorStoreService 直查 DataSource.query 写入，
--       不注册 TypeORM Entity（与 121 号脚本 5 张表使用 TypeORM 的设计不同）；
--       部署时由运维在服务器执行本脚本建表，或随 docs/migrations 外部迁移执行。

USE liquor_inventory;

-- ============================================================
-- 第1步：t_ai_knowledge_chunks AI知识库分块向量表（RAG检索）
-- 字段说明：
--   embedding 列存向量数组的 JSON 文本（如 [0.001, -0.002, ...]），
--   MySQL 8 的 JSON 列自动校验 JSON 合法性，读回时应用侧 JSON.parse。
-- ============================================================
CREATE TABLE IF NOT EXISTS t_ai_knowledge_chunks (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  tenant_id   VARCHAR(36) NOT NULL COMMENT '租户ID（知识库按租户隔离）',
  doc_name    VARCHAR(255) NOT NULL COMMENT '文档名称（含扩展名，如 产品手册.pdf）',
  chunk_index INT NOT NULL COMMENT '分块序号（从0开始）',
  chunk_text  MEDIUMTEXT NOT NULL COMMENT '分块文本内容（单块约500字符）',
  embedding   JSON NOT NULL COMMENT '文本向量（OpenAI兼容 embedding 数组 JSON）',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_tenant_doc (tenant_id, doc_name),
  KEY idx_tenant_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI知识库分块向量表（RAG检索）';

-- ============================================================
-- 第2步：验证 SQL（执行后核对建表结果）
-- ============================================================
-- 验证1：表是否创建成功
SELECT TABLE_NAME, TABLE_COMMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 't_ai_knowledge_chunks';

-- 验证2：字段清单核对（应为8个字段）
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 't_ai_knowledge_chunks'
ORDER BY ORDINAL_POSITION;

SELECT '122_ai_rag.sql 执行完成（t_ai_knowledge_chunks 建表 + 验证）' AS result;
