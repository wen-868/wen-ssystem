CREATE TABLE IF NOT EXISTS t_hot_search (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword VARCHAR(64) NOT NULL COMMENT '热搜词',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用 0停用',
  tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hot_search_tenant (tenant_id),
  INDEX idx_hot_search_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小程序热搜词表';

INSERT INTO t_hot_search (keyword, sort_order, status, tenant_id)
SELECT '茅台', 1, 1, 'default'
WHERE NOT EXISTS (SELECT 1 FROM t_hot_search WHERE tenant_id = 'default');

-- 编号: 155, 描述: 小程序热搜词表（首页搜索推荐）
-- 创建人: 系统, 日期: 2026-08-15
-- 注意: 文件头不写注释(自动迁移按分号拆分,注释污染首条语句被丢弃),说明放文件末尾。
