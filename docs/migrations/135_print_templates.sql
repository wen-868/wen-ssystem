CREATE TABLE IF NOT EXISTS t_print_template (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  tenant_id     VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  store_id      BIGINT UNSIGNED DEFAULT NULL COMMENT '门店ID（NULL=全门店通用）',
  bill_type     VARCHAR(32) NOT NULL COMMENT '单据类型：SALE_RECEIPT/SALE_BILL/SALE_RETURN/PURCHASE_ORDER/REPORT/LABEL/SHIFT/DAILY_SETTLE',
  paper_type    VARCHAR(32) NOT NULL DEFAULT 'RECEIPT_80' COMMENT '纸张类型：RECEIPT_58/RECEIPT_80/RECEIPT_110/A4/DOT_1UP/DOT_2UP/DOT_3UP/LABEL_60X40/LABEL_CUSTOM',
  template_name VARCHAR(64) NOT NULL DEFAULT '' COMMENT '模板名称',
  content       MEDIUMTEXT COMMENT '模板内容（HTML + {{变量}} 占位符）',
  is_default    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否系统默认模板',
  version       INT NOT NULL DEFAULT 1 COMMENT '模板版本',
  status        TINYINT(1) NOT NULL DEFAULT 1 COMMENT '状态：1启用/0停用',
  updated_by    BIGINT UNSIGNED DEFAULT NULL COMMENT '最后修改人ID',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_print_template_scope (tenant_id, store_id, bill_type, paper_type) COMMENT '同租户同门店同类型同纸张唯一模板',
  KEY idx_print_template_tenant_type (tenant_id, bill_type) COMMENT '租户+单据类型索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打印模板表（小票/针式/A4/标签，模板可自定义）';

-- 编号: 135, 描述: 打印模板表, 创建人: 系统, 日期: 2026-08-12
-- 说明: 默认模板种子由后端 print.service 首次访问时写入（内容含分号，避免 SQL 拆分问题）
-- 说明: 打印机/纸张/份数等设备配置走客户端本地配置（localStorage），不存服务端。
-- 说明: 文件头不写注释；CREATE TABLE IF NOT EXISTS 幂等可重复执行。
