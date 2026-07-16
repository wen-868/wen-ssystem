-- 编号: 067, 描述: 添加单位组表, 创建人: 阿坚, 日期: 2026-07-05
-- 支持 4-5 级自定义单位（箱>包>条>合>个）及换算率

CREATE TABLE IF NOT EXISTS t_unit_group (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL COMMENT '单位组名称',
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='单位组表';

CREATE TABLE IF NOT EXISTS t_unit_group_item (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL COMMENT '单位组ID',
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  name VARCHAR(32) NOT NULL COMMENT '单位名称（箱/包/条/合/个）',
  level INT NOT NULL DEFAULT 0 COMMENT '层级（0为最高级，数字越大层级越低）',
  conversion_rate DECIMAL(15,4) NOT NULL DEFAULT 1 COMMENT '换算率（1上级单位=conversion_rate本级单位）',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_group (group_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_level (group_id, level),
  CONSTRAINT fk_item_group FOREIGN KEY (group_id) REFERENCES unit_group(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='单位层级明细表';