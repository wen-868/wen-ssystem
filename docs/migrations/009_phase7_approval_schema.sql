-- 编号: 009, 描述: 审批流程相关表, 创建人: 阿坚, 日期: 2026-07-06

-- 审批流程相关表
-- 执行时间：2026-06-21

USE liquor_inventory;

-- 1. 审批规则配置表
CREATE TABLE approval_rule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  rule_name VARCHAR(128) NOT NULL COMMENT '规则名称',
  business_type VARCHAR(32) NOT NULL COMMENT '业务类型：PURCHASE_ORDER/SALE_RETURN/PRICE_CHANGE/CREDIT_LIMIT',
  trigger_condition JSON NOT NULL COMMENT '触发条件：金额阈值、状态变更等',
  approval_chain JSON NOT NULL COMMENT '审批链：[{level: 1, approver_type: "ROLE", approver_value: "MANAGER"}]',
  sla_hours INT NOT NULL DEFAULT 24 COMMENT 'SLA超时时间（小时）',
  escalation_level INT DEFAULT 1 COMMENT '升级层级：1-直属上级，2-部门经理，3-总经理',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_rule_business_type (business_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批规则配置表';

-- 2. 审批实例表
CREATE TABLE approval_instance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '实例ID',
  instance_no VARCHAR(64) NOT NULL COMMENT '审批实例编号',
  rule_id BIGINT UNSIGNED NOT NULL COMMENT '关联规则ID',
  business_type VARCHAR(32) NOT NULL COMMENT '业务类型',
  business_no VARCHAR(64) NOT NULL COMMENT '业务单号',
  business_title VARCHAR(255) NOT NULL COMMENT '业务标题',
  applicant_id BIGINT UNSIGNED NOT NULL COMMENT '申请人ID',
  applicant_name VARCHAR(64) NOT NULL COMMENT '申请人姓名',
  current_level INT NOT NULL DEFAULT 1 COMMENT '当前审批层级',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED/CANCELLED/ESCALATED',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  completed_at DATETIME DEFAULT NULL COMMENT '完成时间',
  remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_approval_instance_no (instance_no),
  KEY idx_approval_instance_business (business_type, business_no),
  KEY idx_approval_instance_applicant (applicant_id),
  KEY idx_approval_instance_status (status, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批实例表';

-- 3. 审批任务表（每个审批人的任务）
CREATE TABLE approval_task (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  instance_id BIGINT UNSIGNED NOT NULL COMMENT '关联实例ID',
  approval_level INT NOT NULL COMMENT '审批层级',
  approver_id BIGINT UNSIGNED NOT NULL COMMENT '审批人ID',
  approver_name VARCHAR(64) NOT NULL COMMENT '审批人姓名',
  task_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '任务状态：PENDING/APPROVED/REJECTED/ESCALATED',
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '接收时间',
  processed_at DATETIME DEFAULT NULL COMMENT '处理时间',
  sla_deadline DATETIME NOT NULL COMMENT 'SLA截止时间',
  escalated TINYINT NOT NULL DEFAULT 0 COMMENT '是否已升级：0否，1是',
  approval_comment VARCHAR(500) DEFAULT NULL COMMENT '审批意见',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_task_instance (instance_id),
  KEY idx_approval_task_approver (approver_id, task_status),
  KEY idx_approval_task_sla (sla_deadline, task_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批任务表';

-- 4. 审批日志表
CREATE TABLE approval_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  instance_id BIGINT UNSIGNED NOT NULL COMMENT '关联实例ID',
  task_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联任务ID',
  action VARCHAR(32) NOT NULL COMMENT '操作：SUBMIT/APPROVE/REJECT/CANCEL/ESCALATE',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '操作人ID',
  operator_name VARCHAR(64) NOT NULL COMMENT '操作人姓名',
  from_status VARCHAR(32) DEFAULT NULL COMMENT '原状态',
  to_status VARCHAR(32) DEFAULT NULL COMMENT '新状态',
  comment VARCHAR(500) DEFAULT NULL COMMENT '操作备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_log_instance (instance_id),
  KEY idx_approval_log_operator (operator_id),
  KEY idx_approval_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批日志表';

-- 5. 审批人配置表（角色与用户的映射）
CREATE TABLE approval_approver (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  approver_type VARCHAR(32) NOT NULL COMMENT '审批人类型：ROLE/USER/DEPARTMENT',
  approver_value VARCHAR(64) NOT NULL COMMENT '审批人值：角色代码/用户ID/部门ID',
  approver_name VARCHAR(64) NOT NULL COMMENT '审批人名称',
  backup_approver_id BIGINT UNSIGNED DEFAULT NULL COMMENT '备用审批人ID',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用，0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_approver_type (approver_type, approver_value, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批人配置表';

-- 6. 审批通知表
CREATE TABLE approval_notification (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  instance_id BIGINT UNSIGNED NOT NULL COMMENT '关联实例ID',
  task_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联任务ID',
  notification_type VARCHAR(32) NOT NULL COMMENT '通知类型：NEW_TASK/ESCALATION/REMINDER/RESULT',
  recipient_id BIGINT UNSIGNED NOT NULL COMMENT '接收人ID',
  recipient_name VARCHAR(64) NOT NULL COMMENT '接收人姓名',
  title VARCHAR(255) NOT NULL COMMENT '通知标题',
  content TEXT NOT NULL COMMENT '通知内容',
  channel VARCHAR(32) NOT NULL DEFAULT 'SYSTEM' COMMENT '通知渠道：SYSTEM/WECHAT/SMS/EMAIL',
  read_status TINYINT NOT NULL DEFAULT 0 COMMENT '已读状态：0未读，1已读',
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  read_at DATETIME DEFAULT NULL COMMENT '已读时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_approval_notification_recipient (recipient_id, read_status),
  KEY idx_approval_notification_instance (instance_id),
  KEY idx_approval_notification_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批通知表';

-- 插入默认审批规则
INSERT INTO approval_rule (rule_name, business_type, trigger_condition, approval_chain, sla_hours, escalation_level) VALUES
('采购订单审批-5000元以上', 'PURCHASE_ORDER', '{"amount_threshold": 5000}', '[{"level": 1, "approver_type": "ROLE", "approver_value": "PURCHASE_MANAGER"}]', 24, 1),
('采购订单审批-20000元以上', 'PURCHASE_ORDER', '{"amount_threshold": 20000}', '[{"level": 1, "approver_type": "ROLE", "approver_value": "PURCHASE_MANAGER"}, {"level": 2, "approver_type": "ROLE", "approver_value": "FINANCE_MANAGER"}]', 48, 2),
('销售退货审批', 'SALE_RETURN', '{"amount_threshold": 0}', '[{"level": 1, "approver_type": "ROLE", "approver_value": "STORE_MANAGER"}]', 24, 1),
('价格调整审批', 'PRICE_CHANGE', '{"discount_rate_threshold": 0.1}', '[{"level": 1, "approver_type": "ROLE", "approver_value": "SALES_MANAGER"}]', 12, 1);

-- 插入默认审批人配置
INSERT INTO approval_approver (approver_type, approver_value, approver_name) VALUES
('ROLE', 'PURCHASE_MANAGER', '采购经理'),
('ROLE', 'FINANCE_MANAGER', '财务经理'),
('ROLE', 'STORE_MANAGER', '门店经理'),
('ROLE', 'SALES_MANAGER', '销售经理'),
('ROLE', 'GENERAL_MANAGER', '总经理');
