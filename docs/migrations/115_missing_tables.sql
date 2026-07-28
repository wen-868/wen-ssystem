-- ============================================================================
-- 编号: 115, 描述: 补建缺失的3张表（t_quick_entries/t_tenant_config/t_upload_file）, 创建人: 凌舟, 日期: 2026-07-28
-- ============================================================================
-- 问题：这3张表在后端代码中被引用，但 init_database.sql 和所有迁移脚本中均无 CREATE TABLE 语句
-- 影响：新环境部署后，快捷入口、存储配额检测、文件上传功能会运行时报错
-- ============================================================================

USE liquor_inventory;

-- 1. 快捷入口表（admin/src/services/admin/quick-entry.service.ts 引用）
CREATE TABLE IF NOT EXISTS `t_quick_entries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL COMMENT '入口名称',
  `icon` VARCHAR(255) DEFAULT NULL COMMENT '图标URL或CSS类名',
  `route` VARCHAR(255) NOT NULL COMMENT '前端路由路径',
  `group_name` VARCHAR(64) DEFAULT NULL COMMENT '分组名称',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1=启用 0=禁用',
  `visible_roles` JSON DEFAULT NULL COMMENT '可见角色列表（JSON数组），NULL表示所有角色可见',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值（越小越靠前）',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_sort` (`tenant_id`, `sort_order`),
  KEY `idx_tenant_enabled` (`tenant_id`, `enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='快捷入口配置表';

-- 2. 租户配置表（admin/src/middleware/storage-guard.ts 引用）
--    用于存储租户级别的配置项（如存储配额、功能开关等）
CREATE TABLE IF NOT EXISTS `t_tenant_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `config_key` VARCHAR(128) NOT NULL COMMENT '配置键名（如 storage_limit）',
  `config_value` TEXT DEFAULT NULL COMMENT '配置值',
  `config_type` VARCHAR(32) DEFAULT 'string' COMMENT '值类型：string/number/boolean/json',
  `storage_limit` INT DEFAULT NULL COMMENT '存储配额数值（兼容storage-guard查询）',
  `storage_limit_unit` VARCHAR(10) DEFAULT NULL COMMENT '存储配额单位（MB/GB）',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '配置说明',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_config_key` (`tenant_id`, `config_key`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户配置表';

-- 3. 上传文件表（admin/src/middleware/storage-guard.ts 引用）
--    用于记录上传的文件信息，支持存储配额计算
CREATE TABLE IF NOT EXISTS `t_upload_file` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `file_name` VARCHAR(255) NOT NULL COMMENT '原始文件名',
  `file_path` VARCHAR(512) NOT NULL COMMENT '存储路径',
  `file_size` BIGINT NOT NULL DEFAULT 0 COMMENT '文件大小（字节）',
  `file_type` VARCHAR(128) DEFAULT NULL COMMENT 'MIME类型',
  `file_hash` VARCHAR(64) DEFAULT NULL COMMENT '文件哈希（MD5/SHA256）',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '状态：1=正常 0=已删除',
  `uploader_id` INT DEFAULT NULL COMMENT '上传者用户ID',
  `biz_type` VARCHAR(64) DEFAULT NULL COMMENT '业务类型（如 avatar/product/image）',
  `biz_id` INT DEFAULT NULL COMMENT '业务ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`),
  KEY `idx_tenant_biz` (`tenant_id`, `biz_type`, `biz_id`),
  KEY `idx_file_hash` (`file_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上传文件记录表';
