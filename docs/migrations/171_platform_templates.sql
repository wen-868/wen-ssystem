CREATE TABLE IF NOT EXISTS t_platform_template (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  code               VARCHAR(64)  NOT NULL COMMENT '模板编码（开户套用入参 templateCode，唯一）',
  name               VARCHAR(64)  NOT NULL COMMENT '模板名称',
  applicable         VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '适用对象/规模（卡片第二行）',
  code_rule          VARCHAR(128) NOT NULL DEFAULT '' COMMENT '段1 编号规则配置摘要',
  convert_rule       VARCHAR(128) NOT NULL DEFAULT '' COMMENT '段2 换算规则配置摘要',
  print_ref          VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '段3 打印模板引用（t_print_template.id 列表）',
  default_wh_account VARCHAR(128) NOT NULL DEFAULT '' COMMENT '段4 默认仓库与账户体系摘要',
  config_json        JSON DEFAULT NULL COMMENT '四段式完整配置（开户套用的值复制来源）',
  free_available     TINYINT(1) NOT NULL DEFAULT 0 COMMENT '免费版可用：1是 0否',
  recommended        TINYINT(1) NOT NULL DEFAULT 0 COMMENT '推荐标记：1是 0否',
  version            INT NOT NULL DEFAULT 1 COMMENT '当前版本号',
  ref_count          INT NOT NULL DEFAULT 0 COMMENT '被引用租户数（开户套用累加）',
  status             TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_by         VARCHAR(64) DEFAULT NULL COMMENT '创建人',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_platform_template_code (code),
  KEY idx_platform_template_status (status, recommended)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台初始化模板主表';

CREATE TABLE IF NOT EXISTS t_platform_template_version (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  template_id BIGINT UNSIGNED NOT NULL COMMENT '关联 t_platform_template.id（不建 FK，同平台表口径）',
  version     INT NOT NULL COMMENT '版本号',
  config_json JSON DEFAULT NULL COMMENT '该版本四段式配置快照',
  change_note VARCHAR(255) DEFAULT NULL COMMENT '变更说明',
  created_by  VARCHAR(64) DEFAULT NULL COMMENT '操作人',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_platform_template_version (template_id, version),
  KEY idx_platform_template_version_tpl (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台初始化模板版本表';

CREATE TABLE IF NOT EXISTS t_platform_print_template (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  name       VARCHAR(64) NOT NULL COMMENT '模板名称',
  bill_type  VARCHAR(32) NOT NULL COMMENT '单据类型：SALE_RECEIPT/SALE_BILL/SALE_RETURN/PURCHASE_ORDER/REPORT/LABEL/SHIFT/DAILY_SETTLE',
  paper_type VARCHAR(32) NOT NULL DEFAULT 'RECEIPT_80' COMMENT '纸张类型：RECEIPT_58/RECEIPT_80/RECEIPT_110/A4/DOT_1UP/DOT_2UP/DOT_3UP/LABEL_60X40/LABEL_CUSTOM',
  content    MEDIUMTEXT COMMENT '模板内容（JSON 可视化模板结构）',
  spec       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '规格说明（列表展示）',
  is_public  TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否平台公共模板：1是 0否',
  version    INT NOT NULL DEFAULT 1 COMMENT '模板版本',
  status     TINYINT(1) NOT NULL DEFAULT 1 COMMENT '状态：1启用 0停用',
  created_by VARCHAR(64) DEFAULT NULL COMMENT '创建人',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ppp_scope (bill_type, paper_type, name),
  KEY idx_ppp_public (is_public, bill_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台公共打印模板表（与租户表 t_print_template 解耦）';

CREATE TABLE IF NOT EXISTS t_platform_io_template (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  name         VARCHAR(64) NOT NULL COMMENT '模板名称',
  direction    VARCHAR(8)  NOT NULL COMMENT 'IMPORT / EXPORT',
  version      VARCHAR(16) NOT NULL DEFAULT 'v1' COMMENT '模板版本',
  field_count  INT NOT NULL DEFAULT 0 COMMENT '字段数',
  compat       VARCHAR(128) NOT NULL DEFAULT '' COMMENT '兼容说明（旧格式兼容期≥2版本）',
  field_desc   MEDIUMTEXT COMMENT '字段校验说明（页签内容）',
  file_name    VARCHAR(128) DEFAULT NULL COMMENT '文件名',
  file_content LONGTEXT COMMENT '模板文件内容（≤1MB；超限改走对象存储 + file_url 列）',
  status       TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_by   VARCHAR(64) DEFAULT NULL COMMENT '创建人',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_platform_io_direction (direction, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台导入导出模板表';

-- 编号: 171, 描述: 平台模板中心 4 张新表（初始化模板 / 初始化模板版本 / 公共打印模板 / 导入导出模板）, 创建人: 阿坚, 日期: 2026-09-23
-- 依据: docs/tasks/cards/R101-C2-0-凌舟裁定.md §二（授权 4 张新表、本批零 ALTER）+ 清账草案 1/2/3-B/4
-- 说明: 只新增空表，不改任何既有表（零 ALTER）；全部 CREATE TABLE IF NOT EXISTS 幂等；不建外键（与平台表既有口径一致，一致性由服务层保证）
-- 说明: 语句在前、注释在后，规避启动迁移「以注释开头的整块语句被丢弃」的历史缺陷（顶格书写）
