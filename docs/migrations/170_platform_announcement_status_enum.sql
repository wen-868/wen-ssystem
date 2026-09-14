-- ============================================
-- Migration 170: 公告 status 由数字 0/1 统一为字符串枚举
-- 列 t_platform_announcement.status 已为 VARCHAR(16) DEFAULT 'DRAFT'
-- 本迁移仅将历史遗留的数字字符串('0'/'1')规整为 'DRAFT'/'PUBLISHED'
-- ============================================
;

UPDATE t_platform_announcement SET status = 'DRAFT' WHERE status = '0';
UPDATE t_platform_announcement SET status = 'PUBLISHED' WHERE status = '1';
