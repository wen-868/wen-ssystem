-- 编号: 052, 描述: 添加零售公告表, 创建人: 阿坚, 日期: 2026-07-05
-- 更新: 2026-07-23 R55-01 新增 tenant_id 列用于租户隔离（修复跨租户数据泄露）
-- 说明：原表无 tenant_id 列，所有 SQL 仅按 store_id 过滤且 storeId 来自用户输入，
--       任何认证用户可跨租户访问/修改/删除其他租户公告。本次新增 tenant_id 列。

CREATE TABLE IF NOT EXISTS t_retail_announcement (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  title VARCHAR(128) NOT NULL COMMENT '公告标题',
  content TEXT NOT NULL COMMENT '公告内容',
  is_top TINYINT NOT NULL DEFAULT 0 COMMENT '是否置顶',
  start_time DATETIME DEFAULT NULL COMMENT '开始展示时间',
  end_time DATETIME DEFAULT NULL COMMENT '结束展示时间',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store (store_id),
  INDEX idx_status_time (status, start_time, end_time),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序公告表';

-- R55-01: 给已存在的 t_retail_announcement 表补充 tenant_id 列与索引
-- 由 migration.ts safeExec 容错：列/索引已存在时静默跳过（ER_DUP_FIELDNAME / ER_DUP_KEYNAME）
ALTER TABLE t_retail_announcement ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER id;
ALTER TABLE t_retail_announcement ADD INDEX idx_tenant (tenant_id);
