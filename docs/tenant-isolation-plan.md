# tenant_id 数据隔离改造方案

> 负责人：阿坚 | 预估工时：5天 | 优先级：P2（最高技术债）

## 一、现状分析

| 维度 | 现状 |
|------|------|
| 数据库表 | **62 张表，0 张有 tenant_id** |
| 后端 tenant 代码 | **完全不存在**，无中间件/拦截器/类型定义 |
| SQL 查询 | **裸 SQL 写法**，无 ORM，需逐条手动添加 WHERE 条件 |
| 认证体系 | JWT 仅含 id/username/roles/storeId，**无 tenantId** |
| 路由文件 | **28 个路由文件**，业务逻辑内联在路由中 |
| 数据库操作 | 通过 `shared/db.ts` 的 `query()` / `queryOne()` / `transaction()` |

## 二、改造目标

实现 SaaS 多租户数据隔离，确保：
1. 每个租户（商家）只能看到自己的数据
2. 所有查询 API 自动过滤 tenant_id，**不允许任何 API 漏掉过滤**
3. 新增数据自动填充 tenant_id
4. 现有功能不受影响（向下兼容）

## 三、改造步骤（按顺序执行）

### 第1步：数据库改造（0.5天）

#### 1.1 新建 tenant 表

```sql
CREATE TABLE tenant (
  id VARCHAR(36) PRIMARY KEY,          -- 租户ID（UUID）
  name VARCHAR(100) NOT NULL,          -- 租户名称（公司名）
  contact_name VARCHAR(50),            -- 联系人
  contact_phone VARCHAR(20),           -- 联系电话
  plan VARCHAR(20) DEFAULT 'basic',    -- 套餐：basic/professional/enterprise
  status TINYINT DEFAULT 1,            -- 1=正常 0=停用
  expire_at DATETIME,                  -- 到期时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_expire (expire_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 1.2 为所有62张表添加 tenant_id 字段

```sql
-- 批量执行（在 migrate 脚本中）
ALTER TABLE sys_config ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sys_user ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sys_role ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sys_permission ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE store ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE product_category ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE supplier ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE price_level ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE alert_rule ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE expiry_alert_config ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE trace_config ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE store_control_config ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sys_user_role ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sys_role_permission ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE supplier_contact ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE member ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE product_spu ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE product_sku ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE product_price ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sku_price ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE customer_price_binding ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE customer_credit ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE inventory_balance ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE inventory_batch ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE trace_code ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE miniapp_order ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE miniapp_order_item ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sale_bill ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sale_bill_item ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sale_return ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sale_return_item ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE purchase_order ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE purchase_order_item ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE purchase_in_stock ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE purchase_in_stock_item ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE purchase_return ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE purchase_return_item ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE purchase_payment ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE supplier_statement ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE supplier_statement_item ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE customer_statement ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE customer_payment ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE sale_payment ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE collection_link ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE receivable_account ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE payment_order ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE refund_order ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE hold_order ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE notification ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE operation_log ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE collection_view_log ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE product_price_log ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE inventory_ledger ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE price_change_log ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE credit_operation_log ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE collection_record ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE alert_record ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE expiry_alert_record ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE trace_event_log ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE trace_scan_log ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE recall_record ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
ALTER TABLE store_status_log ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
-- daily_settlement 表（如果存在）
ALTER TABLE daily_settlement ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
```

#### 1.3 为所有表添加索引

```sql
-- 每张表都加 tenant_id 索引，提升查询性能
ALTER TABLE sys_config ADD INDEX idx_tenant (tenant_id);
ALTER TABLE sys_user ADD INDEX idx_tenant (tenant_id);
ALTER TABLE sys_role ADD INDEX idx_tenant (tenant_id);
-- ... 其余60张表同理
```

> **注意：** DEFAULT 'default' 是为了兼容现有数据。当前只有一个租户（默认租户），所有现有数据自动归属 'default'。

---

### 第2步：后端基础设施改造（1.5天）

#### 2.1 修改 `shared/auth.ts` - JWT 扩展

```typescript
// 现有 AuthUser 类型
export interface AuthUser {
  id: string;
  username: string;
  roles: string[];
  storeId: string;
  tenantId: string;  // 新增：租户ID
}

// 修改 generateToken()，将 tenantId 写入 JWT payload
// 修改 verifyToken()，从 JWT payload 中提取 tenantId
```

#### 2.2 新建 `shared/tenant.ts` - 租户中间件

```typescript
/**
 * 租户中间件
 * 从 JWT 中提取 tenantId，挂载到 req 上
 * 所有需要租户隔离的路由都必须经过此中间件
 */
export function tenantMiddleware(req, res, next) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: '缺少租户信息' });
  }
  req.tenantId = tenantId;
  next();
}
```

#### 2.3 修改 `shared/db.ts` - 增强查询函数

**核心改造点：** 在 `query()` 和 `queryOne()` 中自动注入 tenant_id 过滤条件。

```typescript
/**
 * 带租户隔离的查询
 * 自动在 SELECT 语句中注入 WHERE tenant_id = ?
 * 
 * 使用方式：
 *   const rows = await query(sql, params, req.tenantId);
 *   或
 *   const rows = await queryWithTenant(sql, params, tenantId);
 */
export async function queryWithTenant(sql: string, params: any[], tenantId: string) {
  // 1. 解析 SQL，判断是否已有 tenant_id 条件
  // 2. 如果是 SELECT 语句且没有 tenant_id，自动注入 WHERE tenant_id = ?
  // 3. 如果是 INSERT 语句且没有 tenant_id 字段，自动注入 tenant_id 值
  // 4. 如果是 UPDATE/DELETE 语句且没有 tenant_id 条件，自动注入 WHERE tenant_id = ?
  // 5. 将 tenantId 插入 params 数组开头
}
```

**实现策略（推荐方案）：**

由于项目使用裸 SQL，没有 ORM，推荐以下两种方案之一：

**方案A（推荐）：SQL 注入包装器**
- 在 `db.ts` 中新增 `queryTenant(sql, params, tenantId)` 函数
- 用正则解析 SQL 类型（SELECT/INSERT/UPDATE/DELETE）
- 自动注入 tenant_id 条件
- **优点：** 改动最小，现有 SQL 几乎不用改
- **缺点：** 正则解析 SQL 不够严谨，复杂 SQL 可能误判

**方案B：手动改造每条 SQL**
- 逐个修改 28 个路由文件中的每条 SQL
- SELECT 加 WHERE tenant_id = ?
- INSERT 加 tenant_id 字段
- UPDATE/DELETE 加 WHERE tenant_id = ?
- **优点：** 100% 可控，不会误判
- **缺点：** 工作量大，容易遗漏

**建议：采用方案A为主 + 方案B补充。** 先用包装器处理 80% 的简单 SQL，剩余 20% 的复杂 SQL 手动改造。

#### 2.4 在 `server.ts` 中注册中间件

```typescript
// 在 JWT 认证中间件之后，业务路由之前
app.use('/api', jwtAuth, tenantMiddleware);
```

---

### 第3步：路由层改造（2天）

逐个修改 28 个路由文件。改造模式统一：

#### SELECT 查询改造

```typescript
// 改造前
const rows = await query('SELECT * FROM product_sku WHERE id = ?', [id]);

// 改造后（方案A - 自动注入）
const rows = await queryWithTenant('SELECT * FROM product_sku WHERE id = ?', [id], req.tenantId);

// 改造后（方案B - 手动）
const rows = await query('SELECT * FROM product_sku WHERE tenant_id = ? AND id = ?', [req.tenantId, id]);
```

#### INSERT 改造

```typescript
// 改造前
await query('INSERT INTO sale_bill (bill_no, member_id, total_amount) VALUES (?, ?, ?)', [...]);

// 改造后
await query('INSERT INTO sale_bill (tenant_id, bill_no, member_id, total_amount) VALUES (?, ?, ?, ?)', [req.tenantId, ...]);
```

#### UPDATE/DELETE 改造

```typescript
// 改造前
await query('UPDATE store SET name = ? WHERE id = ?', [name, id]);

// 改造后
await query('UPDATE store SET name = ? WHERE tenant_id = ? AND id = ?', [name, req.tenantId, id]);
```

#### 28个路由文件改造清单

| 序号 | 路由文件 | 涉及表 | 改造要点 |
|------|----------|--------|----------|
| 1 | admin.routes.ts | sys_user, sys_role, store, daily_settlement | 登录接口需根据用户名+tenantId查询 |
| 2 | cart.routes.ts | hold_order | 挂单数据隔离 |
| 3 | credit.routes.ts | customer_credit, credit_operation_log | 信用额度隔离 |
| 4 | dashboard.routes.ts | sale_bill, purchase_order 等 | 统计数据按租户过滤 |
| 5 | inventory-batch.routes.ts | inventory_batch | 批次管理隔离 |
| 6 | marketing.routes.ts | （营销相关表） | 营销数据隔离 |
| 7 | miniapp.routes.ts | miniapp_order, miniapp_order_item | 小程序订单隔离 |
| 8 | payment.routes.ts | payment_order, refund_order, sale_payment | 支付数据隔离 |
| 9 | price.routes.ts | product_price, sku_price, customer_price_binding | 价格数据隔离 |
| 10 | purchase-payment.routes.ts | purchase_payment, supplier_statement | 采购付款隔离 |
| 11 | rbac.routes.ts | sys_role, sys_permission, sys_role_permission | 权限按租户隔离 |
| 12 | report.routes.ts | （多张统计表） | 报表按租户过滤 |
| 13 | share.routes.ts | collection_link, collection_view_log | 分享数据隔离 |
| 14 | stock-check.routes.ts | inventory_balance | 盘点数据隔离 |
| 15 | store-control.routes.ts | store_control_config, store_status_log | 门店控制隔离 |
| 16 | store.routes.ts | store | 门店数据隔离 |
| 17 | sys-config.routes.ts | sys_config | 系统配置按租户隔离 |
| 18 | trace.routes.ts | trace_config, trace_code, trace_event_log, trace_scan_log, recall_record | 溯源数据隔离 |
| 19 | transfer.routes.ts | inventory_balance, inventory_ledger | 调拨数据隔离 |
| 20 | wechat.routes.ts | （微信相关） | 微信配置按租户隔离 |
| 21 | aftersale.routes.ts | sale_return, sale_return_item | 售后隔离 |
| 22 | alert.routes.ts | alert_rule, alert_record, expiry_alert_config, expiry_alert_record | 预警隔离 |
| 23 | audit.routes.ts | operation_log | 审计日志隔离 |
| 24 | export.routes.ts | （多张导出表） | 导出数据按租户过滤 |
| 25 | instant-retail.routes.ts | （即时零售表） | 即时零售隔离 |
| 26 | notification.routes.ts | notification | 通知按租户隔离 |
| 27 | order-timeout.routes.ts | sale_bill | 订单超时按租户过滤 |
| 28 | share.routes.ts | collection_link | 分享链接按租户隔离 |

---

### 第4步：登录接口特殊处理（0.5天）

登录接口需要特殊处理，因为此时还没有 tenantId：

```typescript
// 登录流程改造
// 1. 用户输入 username + password
// 2. 查询 sys_user 表获取用户信息（包含 tenant_id）
// 3. 验证密码
// 4. 将 tenant_id 写入 JWT token
// 5. 后续所有请求从 JWT 中提取 tenant_id
```

**注意：** `sys_user` 表的登录查询不需要 tenant_id 过滤（因为用户还不知道属于哪个租户），但查询结果必须包含 tenant_id 字段。

---

### 第5步：测试验证（0.5天）

#### 5.1 数据隔离验证

```sql
-- 创建测试租户
INSERT INTO tenant (id, name, contact_name) VALUES ('tenant-a', '测试商家A', '张三');
INSERT INTO tenant (id, name, contact_name) VALUES ('tenant-b', '测试商家B', '李四');

-- 验证：tenant-a 的用户看不到 tenant-b 的数据
-- 验证：tenant-b 的用户看不到 tenant-a 的数据
-- 验证：default 租户的现有数据不受影响
```

#### 5.2 API 验证

- 所有 SELECT 接口返回数据仅限当前租户
- 所有 INSERT 接口自动填充 tenant_id
- 所有 UPDATE/DELETE 接口只能操作当前租户数据
- 跨租户访问返回 403 或空数据

---

## 四、不需要加 tenant_id 的表

以下表是系统级表，不需要租户隔离：

| 表名 | 原因 |
|------|------|
| tenant | 租户表本身 |
| sys_permission | 系统权限定义（全局共享） |

> **注意：** `sys_role` 和 `sys_role_permission` 需要租户隔离，因为不同租户可能有不同的角色定义。`sys_config` 也需要隔离，因为不同租户的配置不同。

## 五、风险与注意事项

1. **向下兼容：** 所有现有数据自动归属 'default' 租户，不影响现有功能
2. **性能影响：** 每张表都加了 tenant_id 索引，查询性能不会下降
3. **遗漏风险：** 28个路由文件中的 SQL 必须逐一检查，建议用全局搜索 `query(` 和 `queryOne(` 确保没有遗漏
4. **登录接口：** 是唯一不需要 tenant_id 过滤的接口，但要确保返回的 JWT 包含 tenantId
5. **SUPER_ADMIN：** 超级管理员可能需要跨租户查看数据，后续可以加一个 `?all_tenants=true` 参数

## 六、交付物

1. `docs/migrations/add_tenant_id.sql` - 数据库迁移脚本
2. `backend/src/shared/tenant.ts` - 租户中间件
3. `backend/src/shared/db.ts` - 增强 query 函数
4. `backend/src/shared/auth.ts` - JWT 扩展
5. 28 个路由文件的改造
6. 测试用例
