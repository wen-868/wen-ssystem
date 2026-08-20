ALTER TABLE t_operation_log ADD COLUMN log_no VARCHAR(64) DEFAULT NULL COMMENT '日志编号';
ALTER TABLE t_operation_log ADD COLUMN user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '操作人ID(与operator_id同义,多服务写入)';
ALTER TABLE t_operation_log ADD COLUMN user_name VARCHAR(64) DEFAULT NULL COMMENT '操作人姓名(与operator_name同义)';
ALTER TABLE t_operation_log ADD COLUMN target_id VARCHAR(64) DEFAULT NULL COMMENT '业务对象ID';
ALTER TABLE t_operation_log ADD COLUMN target_type VARCHAR(32) DEFAULT NULL COMMENT '业务对象类型';
ALTER TABLE t_operation_log ADD COLUMN detail VARCHAR(500) DEFAULT NULL COMMENT '操作详情';
ALTER TABLE t_operation_log ADD COLUMN remark VARCHAR(500) DEFAULT NULL COMMENT '备注';
ALTER TABLE t_operation_log ADD COLUMN target VARCHAR(255) DEFAULT NULL COMMENT '目标(价格越权审计)';
ALTER TABLE t_operation_log ADD COLUMN category VARCHAR(32) DEFAULT NULL COMMENT '类别(价格越权审计)';
ALTER TABLE t_operation_log ADD INDEX idx_operation_log_user_id (user_id);
ALTER TABLE t_operation_log ADD INDEX idx_operation_log_target (target_type, target_id);

ALTER TABLE t_sys_user ADD COLUMN department_id INT DEFAULT NULL COMMENT '部门ID(员工管理)';
ALTER TABLE t_sys_user ADD COLUMN position_id INT DEFAULT NULL COMMENT '岗位ID(员工管理)';
ALTER TABLE t_sys_user ADD COLUMN password VARCHAR(255) DEFAULT NULL COMMENT '明文密码(总台创建租户管理员,与password_hash同义)';
ALTER TABLE t_sys_user ADD COLUMN role VARCHAR(32) DEFAULT NULL COMMENT '角色编码冗余(总台创建管理员)';
ALTER TABLE t_sys_user ADD COLUMN is_default TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认账号';

ALTER TABLE t_store ADD COLUMN store_name VARCHAR(128) DEFAULT NULL COMMENT '门店名称(与name同义,仓库管理写入)';
ALTER TABLE t_store ADD COLUMN store_type VARCHAR(32) NOT NULL DEFAULT 'STORE' COMMENT '门店类型: STORE/WAREHOUSE';
ALTER TABLE t_store ADD COLUMN is_default TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认仓库/门店';

ALTER TABLE t_miniapp_order ADD COLUMN shipping_fee DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '运费';

ALTER TABLE t_inventory_balance ADD COLUMN sku_name VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称快照';

ALTER TABLE t_transfer_order ADD COLUMN from_store_name VARCHAR(128) DEFAULT NULL COMMENT '调出门店名称快照';
ALTER TABLE t_transfer_order ADD COLUMN to_store_name VARCHAR(128) DEFAULT NULL COMMENT '调入门店名称快照';
ALTER TABLE t_transfer_order ADD COLUMN created_by_name VARCHAR(64) DEFAULT NULL COMMENT '创建人姓名快照';

ALTER TABLE t_tenant ADD COLUMN tenant_id VARCHAR(36) DEFAULT NULL COMMENT '租户ID(与id同义,总台服务写入)';
ALTER TABLE t_tenant ADD COLUMN tenant_name VARCHAR(128) DEFAULT NULL COMMENT '租户名称(与company_name同义)';
ALTER TABLE t_tenant ADD COLUMN created_by VARCHAR(64) DEFAULT NULL COMMENT '创建人';

ALTER TABLE t_subscription ADD COLUMN order_no VARCHAR(64) DEFAULT NULL COMMENT '订单号';
ALTER TABLE t_subscription ADD COLUMN plan_code VARCHAR(32) DEFAULT NULL COMMENT '套餐编码';
ALTER TABLE t_subscription ADD COLUMN amount DECIMAL(12,2) DEFAULT NULL COMMENT '订单金额';
ALTER TABLE t_subscription ADD COLUMN created_by BIGINT DEFAULT NULL COMMENT '创建人ID';

ALTER TABLE t_sys_data_permission ADD COLUMN filter_type VARCHAR(32) DEFAULT NULL COMMENT '过滤类型(与condition_type同义)';
ALTER TABLE t_sys_data_permission ADD COLUMN filter_value VARCHAR(255) DEFAULT NULL COMMENT '过滤值(与condition_value同义)';

ALTER TABLE t_supplier_statement ADD COLUMN start_date DATE DEFAULT NULL COMMENT '对账开始日期(与period_start同义)';
ALTER TABLE t_supplier_statement ADD COLUMN end_date DATE DEFAULT NULL COMMENT '对账结束日期(与period_end同义)';
ALTER TABLE t_supplier_statement ADD COLUMN statement_status VARCHAR(32) DEFAULT NULL COMMENT '对账状态(与status同义)';
ALTER TABLE t_supplier_statement ADD COLUMN purchase_amount DECIMAL(12,2) DEFAULT 0 COMMENT '采购金额(与total_purchase_amount同义)';
ALTER TABLE t_supplier_statement ADD COLUMN return_amount DECIMAL(12,2) DEFAULT 0 COMMENT '退货金额(与total_return_amount同义)';
ALTER TABLE t_supplier_statement ADD COLUMN paid_amount DECIMAL(12,2) DEFAULT 0 COMMENT '已付金额(与total_paid_amount同义)';
ALTER TABLE t_supplier_statement ADD COLUMN balance DECIMAL(12,2) DEFAULT 0 COMMENT '余额(与balance_amount同义)';

ALTER TABLE t_supplier_statement_item ADD COLUMN statement_no VARCHAR(64) DEFAULT NULL COMMENT '对账单号';
ALTER TABLE t_supplier_statement_item ADD COLUMN item_no VARCHAR(64) DEFAULT NULL COMMENT '明细单号';
ALTER TABLE t_supplier_statement_item ADD COLUMN item_type VARCHAR(32) DEFAULT NULL COMMENT '明细类型: PURCHASE/PAYMENT/RETURN';
ALTER TABLE t_supplier_statement_item ADD COLUMN amount DECIMAL(12,2) DEFAULT 0 COMMENT '明细金额';
ALTER TABLE t_supplier_statement_item ADD COLUMN status VARCHAR(32) DEFAULT NULL COMMENT '明细状态';

ALTER TABLE t_stock_check ADD COLUMN status VARCHAR(32) DEFAULT NULL COMMENT '盘点状态(与check_status同义)';
ALTER TABLE t_stock_check ADD COLUMN remark VARCHAR(255) DEFAULT NULL COMMENT '备注';

ALTER TABLE t_stock_check_item ADD COLUMN check_id BIGINT DEFAULT NULL COMMENT '盘点单ID';
ALTER TABLE t_stock_check_item ADD COLUMN sku_name VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称快照';
ALTER TABLE t_stock_check_item ADD COLUMN system_qty INT DEFAULT 0 COMMENT '系统数量(与book_qty同义)';
ALTER TABLE t_stock_check_item ADD COLUMN batch_no VARCHAR(64) DEFAULT NULL COMMENT '批次号';
ALTER TABLE t_stock_check_item ADD COLUMN diff_amount DECIMAL(12,2) DEFAULT 0 COMMENT '差异金额';

ALTER TABLE t_sale_return ADD COLUMN approval_instance_no VARCHAR(64) DEFAULT NULL COMMENT '审批实例编号';

ALTER TABLE t_sale_bill ADD COLUMN status VARCHAR(32) DEFAULT NULL COMMENT '状态冗余(payment服务写入PAID)';

ALTER TABLE t_purchase_order_item ADD COLUMN amount DECIMAL(12,2) DEFAULT 0 COMMENT '金额(与subtotal_amount同义)';
ALTER TABLE t_purchase_order_item ADD COLUMN order_qty INT DEFAULT 0 COMMENT '订购数量(与total_bottle_qty同义)';

ALTER TABLE t_purchase_order ADD COLUMN approval_instance_no VARCHAR(64) DEFAULT NULL COMMENT '审批实例编号';
ALTER TABLE t_purchase_order ADD COLUMN warehouse_status VARCHAR(32) DEFAULT NULL COMMENT '入库状态';

ALTER TABLE t_platform_reconciliation ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID';
ALTER TABLE t_platform_reconciliation ADD COLUMN platform_no VARCHAR(64) DEFAULT NULL COMMENT '平台流水号';
ALTER TABLE t_platform_reconciliation ADD COLUMN platform_name VARCHAR(64) DEFAULT NULL COMMENT '平台名称';
ALTER TABLE t_platform_reconciliation ADD COLUMN reconciliation_no VARCHAR(64) DEFAULT NULL COMMENT '对账编号';
ALTER TABLE t_platform_reconciliation ADD COLUMN type VARCHAR(32) DEFAULT NULL COMMENT '对账类型';
ALTER TABLE t_platform_reconciliation ADD COLUMN amount DECIMAL(12,2) DEFAULT 0 COMMENT '对账金额';
ALTER TABLE t_platform_reconciliation ADD COLUMN recorded_at DATETIME DEFAULT NULL COMMENT '记录时间';

ALTER TABLE t_platform_config ADD COLUMN category VARCHAR(64) DEFAULT NULL COMMENT '配置分类';
ALTER TABLE t_platform_config ADD COLUMN config_key VARCHAR(128) DEFAULT NULL COMMENT '配置键';
ALTER TABLE t_platform_config ADD COLUMN config_value TEXT COMMENT '配置值';
ALTER TABLE t_platform_config ADD COLUMN description VARCHAR(255) DEFAULT NULL COMMENT '配置说明';
ALTER TABLE t_platform_config ADD COLUMN updated_by VARCHAR(64) DEFAULT NULL COMMENT '更新人';

ALTER TABLE t_platform_announcement ADD COLUMN is_top TINYINT NOT NULL DEFAULT 0 COMMENT '是否置顶(与top_flag同义)';

ALTER TABLE t_delivery_record ADD COLUMN rider_id BIGINT DEFAULT NULL COMMENT '骑手ID';

ALTER TABLE t_collection_link ADD COLUMN last_pay_time DATETIME DEFAULT NULL COMMENT '最近支付时间';

ALTER TABLE t_bank_account ADD COLUMN bank_branch VARCHAR(128) DEFAULT NULL COMMENT '支行名称(与branch_name同义)';

-- 编号: 152, 描述: 全业务模块表列名审计补列——23 张表补齐服务 INSERT/UPDATE 引用的缺失列(与既有列同义), 修复采购/销售退货/供应商/调拨/盘点/对账/租户/员工/仓库/小程序订单/平台配置等模块真实库必 500 缺陷
-- 创建人: 系统, 日期: 2026-08-15
-- 背景: 全量审计(274 张表结构合并 init_database + migrations + migration.ts 动态建表/加列 + TENANT_TABLES tenant_id) 对比 384 个服务文件 INSERT/UPDATE 列引用, 发现 23 张表存在服务列在真实表不存在的缺陷。本迁移幂等补齐(所有列追加表尾, 不使用 AFTER 避免依赖列缺失; migration.ts safeExec 对 ER_DUP_FIELDNAME 做模式匹配跳过, 可重复执行)。
-- 核心: t_operation_log 12 个核心业务服务写入(user_id/user_name/target_id/target_type/detail/log_no/remark/target/category); t_sys_user 员工/总台建管理员; t_store 仓库管理; t_miniapp_order 运费; t_transfer_order 调拨单; t_tenant 总台建租户; 其余为对账/盘点/平台配置等。
-- 注意: 文件头不写注释(自动迁移按分号拆分,注释污染首条语句被丢弃),说明放文件末尾。
