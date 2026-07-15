# 系统全面审查报告

> 审查日期：2026-07-15  
> 审查范围：租户隔离机制、系统垃圾清理状况  
> 审查人：凌舟

---

## 一、租户隔离机制完整性检查

### 1.1 认证与权限控制

| 检查项 | 状态 | 说明 |
|--------|------|------|
| JWT 认证中间件 | ✅ 通过 | `requireAuth` 和 `requireAuthWithTenant` 正确验证 token |
| 租户ID提取 | ✅ 通过 | `tenantMiddleware` 从 JWT 中提取 `tenantId` 并挂载到 req |
| 平台总后台认证 | ✅ 通过 | `requirePlatformAuth` 验证平台管理员身份 |
| 路由认证覆盖率 | ⚠️ 部分通过 | 大部分路由已挂载 `requireAuthWithTenant`，但需确认全部 |

### 1.2 数据库查询租户过滤 —— 发现多个漏洞

#### P0 级漏洞（严重）

**问题 1：error-log.service.ts 缺少租户过滤**

- **位置**：`backend/src/services/admin/error-log.service.ts` 第 72-78 行
- **现象**：`listErrorLogs` 函数查询 `error_logs` 表时没有 `tenant_id` 过滤条件
- **风险**：任何租户可以查看其他租户的错误日志，造成跨租户数据泄露
- **代码片段**：
  ```sql
  SELECT * FROM error_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  ```

**问题 2：miniapp.service.ts 缺少租户过滤**

- **位置**：`backend/src/services/miniapp.service.ts` 第 252 行
- **现象**：`confirmReceipt` 函数查询 `t_miniapp_order_item` 时没有 `tenant_id` 过滤条件
- **风险**：不同租户之间的订单数据可能被错误关联
- **代码片段**：
  ```sql
  SELECT sku_id FROM t_miniapp_order_item WHERE order_no = ?
  ```

**问题 3：supplier.service.ts 缺少租户过滤**

- **位置**：`backend/src/services/supplier.service.ts` 第 295、434、440 行
- **现象**：查询 `t_supplier_contact` 表时没有 `tenant_id` 过滤条件
- **风险**：不同租户的供应商联系人数据可能混淆
- **代码片段**：
  ```sql
  SELECT * FROM t_supplier_contact WHERE supplier_id = ?
  DELETE FROM t_supplier_contact WHERE id = ?
  ```

**问题 4：purchase.service.ts 缺少租户过滤**

- **位置**：`backend/src/services/purchase.service.ts` 第 275、425、479、598 行
- **现象**：查询和删除 `t_purchase_order_item` 时没有 `tenant_id` 过滤条件
- **风险**：可能错误操作其他租户的采购订单明细数据

#### P1 级漏洞（中等）

**问题 5：getTenantId() fallback 不安全**

- **位置**：`backend/src/middleware/tenant.ts` 第 38-40 行
- **现象**：当 `tenantId` 不存在时返回 `'default'` 而不是抛出异常
- **风险**：如果中间件被绕过，请求会以 `default` 租户身份执行，可能访问不属于自己的数据
- **代码片段**：
  ```typescript
  export function getTenantId(req: Request): string {
    return (req as TenantRequest).tenantId || 'default';
  }
  ```

### 1.3 缓存租户隔离

**问题 6：Redis 缓存键设计**

- **位置**：`backend/src/config/redis.ts` 第 107-117 行
- **状态**：✅ 通过
- **说明**：缓存键已正确包含 `tenantId` 前缀，如 `tenant:${tenantId}:dashboard`

---

## 二、系统垃圾清理状况评估

### 2.1 日志清理机制

| 检查项 | 状态 | 说明 |
|--------|------|------|
| error_logs 清理函数 | ✅ 已实现 | `cleanupOldLogs` 函数已实现，默认保留 30 天 |
| 定时调度 | ❌ 未实现 | `cleanupOldLogs` 函数从未被定时调度调用 |
| 日志文件轮转 | ❌ 未实现 | 生产环境使用 pino-pretty，未配置日志轮转 |

**问题 7：cleanupOldLogs 未被调度**

- **位置**：`backend/src/services/admin/error-log.service.ts` 第 83-88 行
- **现象**：清理函数已实现但从未被调用，error_logs 表数据会无限增长
- **代码片段**：
  ```typescript
  export async function cleanupOldLogs(retainDays: number = 30): Promise<number> {
    const result = await queryOne(
      `DELETE FROM error_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [retainDays]
    );
    return (result as { affectedRows?: number } | null)?.affectedRows || 0;
  }
  ```

### 2.2 缓存清理机制

**问题 8：memory-cache 双实例架构缺陷**

- **位置**：`backend/src/middleware/memory-cache.ts`
- **现象**：`memoryCache()` 函数内部创建独立的 LRU 缓存实例，而 `cacheManager.cache` 是另一个独立实例
- **风险**：`cacheManager.invalidateByTenant()` 和 `cacheManager.clear()` 无法清除中间件创建的缓存，缓存失效机制完全无效
- **代码片段**：
  ```typescript
  // memoryCache() 内部创建的缓存实例
  const cache = new LRUCache<string, { data: any; timestamp: number }>({ max, maxAge: ttl * 1000 });
  
  // cacheManager 使用的缓存实例
  cache: new LRUCache<string, { data: any; timestamp: number }>({ max: 500, maxAge: 300000 })
  ```

### 2.3 临时文件与上传文件清理

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 上传文件管理 | ✅ 已实现 | `storage-guard.ts` 中间件检查租户存储配额 |
| 临时文件清理 | ⚠️ 未检查 | 缺少临时文件自动清理机制 |
| 过期文件清理 | ⚠️ 未检查 | 缺少上传文件过期自动清理机制 |

---

## 三、问题汇总与风险等级

| 编号 | 问题描述 | 风险等级 | 位置 |
|------|----------|----------|------|
| 1 | error-log.service.ts 缺少租户过滤 | **P0** | `backend/src/services/admin/error-log.service.ts` |
| 2 | miniapp.service.ts 缺少租户过滤 | **P0** | `backend/src/services/miniapp.service.ts` |
| 3 | supplier.service.ts 缺少租户过滤 | **P0** | `backend/src/services/supplier.service.ts` |
| 4 | purchase.service.ts 缺少租户过滤 | **P0** | `backend/src/services/purchase.service.ts` |
| 5 | getTenantId() fallback 返回 'default' | **P1** | `backend/src/middleware/tenant.ts` |
| 6 | memory-cache 双实例架构缺陷 | **P1** | `backend/src/middleware/memory-cache.ts` |
| 7 | cleanupOldLogs 未被定时调度 | **P2** | `backend/src/services/admin/error-log.service.ts` |
| 8 | 缺少日志文件轮转配置 | **P2** | `backend/src/shared/logger.ts` |

---

## 四、改进建议

### 4.1 立即修复（P0）

1. **为 error-log.service.ts 添加租户过滤**
   - 在 `listErrorLogs` 函数的 WHERE 条件中添加 `tenant_id = ?`

2. **为 miniapp.service.ts 添加租户过滤**
   - 在第 252 行查询中添加 `tenant_id = ?` 条件

3. **为 supplier.service.ts 添加租户过滤**
   - 在所有 `t_supplier_contact` 查询中添加 `tenant_id` 条件

4. **为 purchase.service.ts 添加租户过滤**
   - 在所有 `t_purchase_order_item` 查询和删除操作中添加 `tenant_id` 条件

### 4.2 短期修复（P1）

5. **修复 getTenantId() fallback**
   - 将 `'default'` 改为抛出异常或返回空值，强制调用方处理

6. **修复 memory-cache 双实例问题**
   - 将 `memoryCache()` 内部 cache 实例改为引用 `cacheManager.cache` 单例
   - 或提供统一的缓存注册机制

### 4.3 长期优化（P2）

7. **添加定时任务调度 cleanupOldLogs**
   - 在 `server.ts` 启动时注册 node-cron 定时任务，每日凌晨执行

8. **配置日志文件轮转**
   - 生产环境配置 pino 日志文件轮转，限制日志文件大小和保留数量

9. **添加上传文件过期清理**
   - 为 `upload_file` 表添加清理任务，定期清理超过保留期的文件

---

## 五、下一步工作安排

### R37 — 租户隔离漏洞修复 [待开始]

#### [R37-01] 修复 error-log 租户过滤漏洞
- 优先级：P0
- 负责人：阿坚
- 预计：0.5天
- 文件：`backend/src/services/admin/error-log.service.ts`
- 问题：listErrorLogs 函数缺少 tenant_id 过滤，造成跨租户数据泄露
- 修复：在 WHERE 条件中添加 tenant_id = ?

#### [R37-02] 修复 miniapp.service 租户过滤漏洞
- 优先级：P0
- 负责人：阿坚
- 预计：0.5天
- 文件：`backend/src/services/miniapp.service.ts`
- 问题：confirmReceipt 函数查询 t_miniapp_order_item 时缺少 tenant_id 过滤
- 修复：在查询中添加 tenant_id = ? 条件

#### [R37-03] 修复 supplier.service 租户过滤漏洞
- 优先级：P0
- 负责人：阿坚
- 预计：0.5天
- 文件：`backend/src/services/supplier.service.ts`
- 问题：t_supplier_contact 查询缺少 tenant_id 过滤
- 修复：在所有相关查询中添加 tenant_id 条件

#### [R37-04] 修复 purchase.service 租户过滤漏洞
- 优先级：P0
- 负责人：阿坚
- 预计：0.5天
- 文件：`backend/src/services/purchase.service.ts`
- 问题：t_purchase_order_item 查询和删除缺少 tenant_id 过滤
- 修复：在所有相关查询中添加 tenant_id 条件

### R38 — 系统垃圾清理优化 [待开始]

#### [R38-01] 修复 memory-cache 双实例架构缺陷
- 优先级：P1
- 负责人：阿坚
- 预计：1天
- 文件：`backend/src/middleware/memory-cache.ts`
- 问题：memoryCache() 内部缓存与 cacheManager.cache 是独立实例，缓存失效机制无效
- 修复：统一使用单例缓存实例

#### [R38-02] 修复 getTenantId() fallback 不安全问题
- 优先级：P1
- 负责人：阿坚
- 预计：0.5天
- 文件：`backend/src/middleware/tenant.ts`
- 问题：fallback 返回 'default' 可能导致越权访问
- 修复：改为抛出异常或返回空值

#### [R38-03] 添加 error_logs 定时清理任务
- 优先级：P2
- 负责人：阿坚
- 预计：0.5天
- 文件：`backend/src/server.ts`、`backend/src/services/admin/error-log.service.ts`
- 问题：cleanupOldLogs 函数已实现但从未被调度
- 修复：使用 node-cron 注册每日定时任务

#### [R38-04] 配置日志文件轮转
- 优先级：P2
- 负责人：阿坚
- 预计：0.5天
- 文件：`backend/src/shared/logger.ts`
- 问题：生产环境未配置日志轮转，日志文件会无限增长
- 修复：配置 pino 日志轮转策略

### R39 — 租户隔离全面审计 [待开始]

#### [R39-01] 全量扫描数据库查询租户过滤
- 优先级：P1
- 负责人：苏然
- 预计：1天
- 文件：`backend/src/services/**/*.ts`
- 问题：可能存在其他缺少 tenant_id 过滤的查询
- 修复：编写扫描脚本检测所有 SQL 查询

#### [R39-02] 编写租户隔离单元测试
- 优先级：P1
- 负责人：苏然
- 预计：1天
- 文件：`backend/src/__tests__/tenant-isolation.test.ts`
- 问题：缺少租户隔离测试用例
- 修复：添加跨租户访问拒绝测试

---

## 六、总结

本次审查发现 **4 个 P0 级租户隔离漏洞**、**2 个 P1 级架构问题** 和 **2 个 P2 级清理机制缺失**。建议优先修复 P0 级漏洞，防止跨租户数据泄露；其次修复 P1 级架构问题，确保缓存失效和租户验证机制正常工作；最后完善系统垃圾清理机制，保障系统长期稳定运行。