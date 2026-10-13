-- ============================================================
-- S3-192 探针装置（A 轨）：两种 schema 形态的最小复现
--   运行环境：本机私有 MariaDB 11.4.5（127.0.0.1:3406，sql_mode 含 STRICT_TRANS_TABLES）
--   ⚠️ 本文件建的都是**探针数据**（我构造的），不是生产读数，也不是产品数据；
--      库名带 s3192_ 前缀，与其它会话的库（s3191_rt / s3194_*）互不干扰。
-- ============================================================
DROP DATABASE IF EXISTS s3192_num;
DROP DATABASE IF EXISTS s3192_str;
CREATE DATABASE s3192_num DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE DATABASE s3192_str DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ── 形态①「数值列」：DDL 逐字取自 backend/src/shared/migration.ts:533-546
--    （另补 docs/migrations/192 的 suspend_reason / suspended_at 两列）
CREATE TABLE s3192_num.t_tenant (
  id VARCHAR(36) PRIMARY KEY COMMENT '租户ID',
  name VARCHAR(100) NOT NULL COMMENT '租户名称',
  contact_name VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  plan VARCHAR(20) DEFAULT 'basic' COMMENT '套餐',
  status TINYINT DEFAULT 1 COMMENT '1=正常 0=停用',
  suspend_reason VARCHAR(255) NULL COMMENT '停用原因',
  suspended_at DATETIME NULL COMMENT '停用时间',
  expire_at DATETIME COMMENT '到期时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表';

CREATE TABLE s3192_num.t_subscription (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_no VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/EXPIRED/CANCELLED/SUSPENDED',
  payment_status VARCHAR(16) NOT NULL DEFAULT 'PAID',
  expire_notify_sent TINYINT DEFAULT 0,
  auto_renew TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅表（探针用最小列集）';

-- ── 形态②「字符串列」：DDL 取自 docs/migrations/029_add_tenant.sql:19（status VARCHAR(16)）
CREATE TABLE s3192_str.t_tenant (
  id VARCHAR(36) PRIMARY KEY COMMENT '租户ID（UUID）',
  tenant_code VARCHAR(32) NULL,
  company_name VARCHAR(128) NULL,
  contact_person VARCHAR(64) NULL,
  contact_mobile VARCHAR(20) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/SUSPENDED/EXPIRED/CLOSED）',
  suspend_reason VARCHAR(255) NULL COMMENT '停用原因',
  suspended_at DATETIME NULL COMMENT '停用时间',
  expire_at DATETIME NULL,
  source VARCHAR(32) DEFAULT 'MANUAL',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表（探针·字符串形态）';

-- ── 探针数据
INSERT INTO s3192_num.t_tenant (id, name, status) VALUES
  ('num-active',   '探针·启用',   1),
  ('num-disabled', '探针·已停用', 0);
INSERT INTO s3192_num.t_subscription (subscription_no, tenant_id, end_date, status) VALUES
  ('SUB-N1', 'num-active', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'ACTIVE');

INSERT INTO s3192_str.t_tenant (id, company_name, status) VALUES
  ('str-active',    '探针·ACTIVE',    'ACTIVE'),
  ('str-expired',   '探针·EXPIRED',   'EXPIRED'),
  ('str-suspended', '探针·SUSPENDED', 'SUSPENDED'),
  ('str-disabled',  '探针·DISABLED',  'DISABLED');
