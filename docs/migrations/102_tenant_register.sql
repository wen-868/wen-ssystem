ALTER TABLE t_tenant
ADD COLUMN review_status VARCHAR(16) NOT NULL DEFAULT 'APPROVED' COMMENT '审核状态（PENDING/APPROVED/REJECTED）',
ADD COLUMN review_remark VARCHAR(500) DEFAULT NULL COMMENT '审核备注',
ADD COLUMN reviewed_at DATETIME DEFAULT NULL COMMENT '审核时间',
ADD COLUMN reviewed_by INT DEFAULT NULL COMMENT '审核人ID';

CREATE TABLE IF NOT EXISTS t_tenant_register_application (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(128) NOT NULL COMMENT '公司名称',
  company_short_name VARCHAR(64) COMMENT '公司简称',
  contact_person VARCHAR(64) NOT NULL COMMENT '联系人',
  contact_mobile VARCHAR(20) NOT NULL COMMENT '联系电话',
  contact_email VARCHAR(128) COMMENT '联系邮箱',
  province VARCHAR(64) COMMENT '省份',
  city VARCHAR(64) COMMENT '城市',
  district VARCHAR(64) COMMENT '区县',
  address VARCHAR(255) COMMENT '详细地址',
  business_license VARCHAR(128) COMMENT '营业执照号',
  legal_person VARCHAR(64) COMMENT '法人代表',
  industry VARCHAR(64) COMMENT '所属行业',
  company_scale VARCHAR(32) COMMENT '公司规模',
  admin_username VARCHAR(64) NOT NULL COMMENT '管理员账号',
  admin_password_hash VARCHAR(255) NOT NULL COMMENT '管理员密码哈希',
  admin_real_name VARCHAR(64) NOT NULL COMMENT '管理员真实姓名',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态（PENDING/APPROVED/REJECTED）',
  reject_reason VARCHAR(500) COMMENT '驳回原因',
  reviewed_at DATETIME DEFAULT NULL COMMENT '审核时间',
  reviewed_by INT DEFAULT NULL COMMENT '审核人ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_application_status (status),
  INDEX idx_application_mobile (contact_mobile),
  INDEX idx_application_username (admin_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户注册申请表';
