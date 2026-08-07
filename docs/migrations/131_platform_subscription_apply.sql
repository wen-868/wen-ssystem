-- ============================================================
-- 迁移编号：131
-- 描述：平台小程序订阅申请表 t_platform_subscription_apply
-- 创建人：阿澈
-- 日期：2026-08-08
-- 关联任务：R98-01 平台小程序 MVP
-- 说明：
--   1. 面向平台小程序的套餐订阅意向申请（浏览套餐 → 提交申请 → 平台审核 → 状态可查）。
--   2. openid 字段 MVP 阶段先由小程序本地生成的设备标识兜底，
--      正式微信登录 openid 关联在 R98-02 接入后替换。
--   3. CREATE TABLE IF NOT EXISTS 幂等，可重复执行。
-- ============================================================

CREATE TABLE IF NOT EXISTS t_platform_subscription_apply (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  openid VARCHAR(64) NOT NULL DEFAULT '' COMMENT '微信 openid（MVP 先用设备标识，R98-02 换真实 openid）',
  plan_id BIGINT NOT NULL COMMENT '订阅套餐ID',
  plan_name VARCHAR(64) NOT NULL DEFAULT '' COMMENT '套餐名称快照',
  company VARCHAR(128) NOT NULL COMMENT '公司名称',
  contact VARCHAR(64) NOT NULL COMMENT '联系人',
  mobile VARCHAR(20) NOT NULL COMMENT '手机号',
  remark VARCHAR(500) NOT NULL DEFAULT '' COMMENT '申请备注',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING待审核/APPROVED已通过/REJECTED已驳回',
  audit_remark VARCHAR(500) NOT NULL DEFAULT '' COMMENT '审核备注',
  audited_by BIGINT NULL COMMENT '审核人ID（平台管理员）',
  audited_at DATETIME NULL COMMENT '审核时间',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_psa_openid (openid),
  KEY idx_psa_mobile (mobile),
  KEY idx_psa_status (status),
  KEY idx_psa_plan (plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台小程序订阅申请表';

-- 验证 SQL：表存在即返回 1
SELECT COUNT(*) AS table_exists FROM information_schema.tables
 WHERE table_schema = DATABASE() AND table_name = 't_platform_subscription_apply';
