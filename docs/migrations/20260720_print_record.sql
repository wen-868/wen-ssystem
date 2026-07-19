-- 编号: 20260720, 描述: 打印记录表, 创建人: 阿坚, 日期: 2026-07-20
-- 用途: App 端蓝牙打印小票留痕审计，支持销售单/销售退货/班结/日结/重打等场景
-- 关联任务: R51-03 后端打印记录 API

CREATE TABLE IF NOT EXISTS t_print_record (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  tenant_id     VARCHAR(64) NOT NULL COMMENT '租户ID（多租户隔离）',
  store_id      BIGINT UNSIGNED DEFAULT NULL COMMENT '门店ID',
  bill_type     VARCHAR(32) NOT NULL COMMENT '单据类型：SALE_BILL/SALE_RETURN/SHIFT/DAILY_SETTLE/REPRINT',
  bill_no       VARCHAR(64) NOT NULL COMMENT '关联单据编号',
  printer_mac   VARCHAR(32) DEFAULT NULL COMMENT '打印机蓝牙MAC地址',
  print_content TEXT COMMENT '打印内容JSON',
  copies        INT NOT NULL DEFAULT 1 COMMENT '打印份数',
  operator_id   BIGINT UNSIGNED DEFAULT NULL COMMENT '操作员ID',
  status        VARCHAR(16) NOT NULL DEFAULT 'SUCCESS' COMMENT '状态：SUCCESS/FAILED/PENDING',
  error_msg     TEXT COMMENT '错误信息（status=FAILED 时填充）',
  original_id   BIGINT UNSIGNED DEFAULT NULL COMMENT '原打印记录ID（重打时关联原记录）',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_print_record_tenant (tenant_id) COMMENT '租户索引（多租户隔离）',
  KEY idx_print_record_tenant_bill (tenant_id, bill_no) COMMENT '租户+单据号联合索引（按单查询）',
  KEY idx_print_record_tenant_type (tenant_id, bill_type) COMMENT '租户+单据类型联合索引（按类型筛选）',
  KEY idx_print_record_original (original_id) COMMENT '原记录ID索引（重打追溯）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打印记录表（App 蓝牙打印小票留痕）';
