ALTER TABLE t_app_version ADD COLUMN update_url_x64 VARCHAR(512) NOT NULL DEFAULT '' COMMENT 'x64 安装包下载地址';
ALTER TABLE t_app_version ADD COLUMN update_url_ia32 VARCHAR(512) NOT NULL DEFAULT '' COMMENT 'x86(ia32) 安装包下载地址';
ALTER TABLE t_app_version ADD COLUMN update_url_arm64 VARCHAR(512) NOT NULL DEFAULT '' COMMENT 'arm64 安装包下载地址';

-- 编号: 144, 描述: 应用版本增加分架构下载地址（桌面客户端按自身架构选择）
-- 创建人: 系统, 日期: 2026-08-14
-- 注意: 文件头不写注释（自动迁移按分号拆分，注释会污染首条语句被丢弃），说明放文件末尾。
