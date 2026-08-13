-- 编号: 141, 描述: 应用版本发布表（电脑端/移动端更新检查与提示）
-- 创建人: Codex, 日期: 2026-08-14

CREATE TABLE IF NOT EXISTS t_app_version (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  platform        VARCHAR(32) NOT NULL COMMENT 'admin_web/app_mobile/print_agent',
  version_code    INT         NOT NULL COMMENT '版本号(整型，递增)',
  version_name    VARCHAR(32) NOT NULL COMMENT '版本名，如 1.0.0',
  min_version_code INT        NOT NULL DEFAULT 0 COMMENT '最低兼容版本',
  is_force        TINYINT     NOT NULL DEFAULT 0 COMMENT '是否强制更新',
  update_url      VARCHAR(512) NOT NULL DEFAULT '' COMMENT '下载/详情地址',
  package_url     VARCHAR(512) NOT NULL DEFAULT '' COMMENT '安装包/wgt 热更新包地址',
  update_note     TEXT        NULL COMMENT '更新说明',
  enabled         TINYINT     NOT NULL DEFAULT 1 COMMENT '是否启用(作为当前版本)',
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_platform_version (platform, version_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应用版本发布';

-- 种子数据：与当前各端 package.json 版本对齐（幂等）
INSERT IGNORE INTO t_app_version (platform, version_code, version_name, min_version_code, is_force, update_url, package_url, update_note, enabled)
VALUES
  ('admin_web', 1, '0.1.0', 1, 0, '', '', '工作台/收银台 Web 端，部署后刷新即更新', 1),
  ('app_mobile', 1, '1.0.0', 1, 0, '', '', '移动端 APP 首个版本', 1),
  ('print_agent', 1, '1.0.0', 1, 0, '', '', '本地打印助手首个版本', 1);
