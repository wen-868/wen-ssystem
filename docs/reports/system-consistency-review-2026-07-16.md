# 系统全局统一性审查报告

> 审查日期：2026-07-16
> 审查人：凌舟
> 审查范围：全系统（后端 + 四前端）

---

## 一、审查维度与发现问题汇总

| 维度 | 检查项 | 发现问题数 | P0 | P1 | P2 |
|------|--------|-----------|----|----|-----|
| 代码规范一致性 | 命名/类型/ESLint/import | 4 | 0 | 2 | 2 |
| 接口设计统一性 | 响应格式/分页/错误码/路由/认证 | 3 | 0 | 1 | 2 |
| 数据格式标准化 | 日期/字段命名/响应封装 | 2 | 0 | 1 | 1 |
| 业务逻辑连贯性 | 租户隔离/库存/订单状态 | 3 | 1 | 1 | 1 |
| **合计** | | **12** | **1** | **5** | **6** |

---

## 二、问题详情

### P0 级问题（1个）

#### [P0-01] alert.service.ts 全量使用 query/queryOne 未做租户隔离

- **文件**：`backend/src/services/alert.service.ts`
- **问题**：该服务文件有 24 处 `query`/`queryOne` 调用，0 处 `queryWithTenant`/`queryOneWithTenant`，所有查询均无 `tenant_id` 过滤
- **风险**：预警规则、预警记录可能被跨租户访问，存在数据泄露风险
- **修复方案**：将所有 `query`/`queryOne` 替换为 `queryWithTenant`/`queryOneWithTenant`，添加 tenantId 参数

### P1 级问题（5个）

#### [P1-01] aftersale.service.ts 23处 query 未做租户隔离

- **文件**：`backend/src/services/admin/aftersale.service.ts`
- **问题**：23 处 `query`/`queryOne` 调用，仅部分有租户过滤
- **修复方案**：全面替换为带租户版本

#### [P1-02] customer-merge.service.ts 18处 query 未做租户隔离

- **文件**：`backend/src/services/admin/customer-merge.service.ts`
- **问题**：18 处 `query`/`queryOne` 无租户过滤
- **修复方案**：全面替换为带租户版本

#### [P1-03] customer-statement.service.ts 9处 query 未做租户隔离

- **文件**：`backend/src/services/admin/customer-statement.service.ts`
- **问题**：9 处无租户过滤
- **修复方案**：全面替换为带租户版本

#### [P1-04] alert.service.ts 大量使用 any 类型（30+处）

- **文件**：`backend/src/services/alert.service.ts`
- **问题**：30+ 处 `query<any>` / `queryOne<any>` / `(r: any)` 类型滥用
- **修复方案**：定义接口类型替代 any

#### [P1-05] response.ts 响应格式字段名不一致

- **文件**：`backend/src/shared/response.ts`
- **问题**：响应使用 `msg` 字段，而行业标准和前端期望通常用 `message`
- **当前格式**：`{ code: "0", msg: "成功", data, traceId, apiCost }`
- **影响**：前端需特殊处理 `msg` 而非通用 `message`
- **修复方案**：评估前端兼容性后统一为 `message`，或保持 `msg` 但在前端统一处理

### P2 级问题（6个）

#### [P2-01] wechat.service.ts 13处 query 部分未做租户隔离

- **文件**：`backend/src/services/wechat.service.ts`
- **问题**：13 处 query，R38 已修复 bindUser，但可能仍有遗漏
- **修复方案**：复查确认

#### [P2-02] miniapp.service.ts 13处 query 部分未做租户隔离

- **文件**：`backend/src/services/miniapp.service.ts`
- **问题**：13 处 query，R37 已修复 confirmReceipt，但其他函数可能遗漏
- **修复方案**：复查确认

#### [P2-03] 部分服务文件未使用 routeConfig 导出

- **文件**：多个路由文件
- **问题**：使用从文件名推断 prefix 的向后兼容模式，未显式声明 routeConfig
- **修复方案**：补充 routeConfig 导出

#### [P2-04] share.service.ts 6处 query 未做租户隔离

- **文件**：`backend/src/services/share.service.ts`
- **问题**：6 处无租户过滤
- **修复方案**：复查并修复

#### [P2-05] subscription-expiry.service.ts 5处 query 未做租户隔离

- **文件**：`backend/src/services/subscription-expiry.service.ts`
- **问题**：5 处无租户过滤
- **修复方案**：复查并修复

#### [P2-06] overdue-scanner.service.ts 2处 query 未做租户隔离

- **文件**：`backend/src/services/overdue-scanner.service.ts`
- **问题**：2 处无租户过滤
- **修复方案**：复查并修复

---

## 三、已确认合规的方面

1. ✅ **API响应封装**：所有 controller 统一使用 `res.json(ok(...))` / `res.json(fail(...))`，无裸 res.json
2. ✅ **分页格式**：统一使用 `normalizePagination` / `paginate` 工具函数，字段一致（page/pageSize/total/records）
3. ✅ **路由自动注册**：auto-routes 系统统一管理路由注册，认证中间件可配置
4. ✅ **认证中间件**：默认所有路由使用 `requireAuthWithTenant`（认证 + 租户隔离）
5. ✅ **错误处理**：统一 errorHandler 中间件
6. ✅ **文件命名**：后端 kebab-case、前端 PascalCase 基本合规
7. ✅ **测试覆盖率**：分支覆盖率 90.53%，达标

---

## 四、修复优先级与计划

| 优先级 | 任务数 | 负责人 | 预计 |
|--------|--------|--------|------|
| P0 | 1 | 阿坚 | 0.5天 |
| P1 | 5 | 阿坚/苏然 | 2天 |
| P2 | 6 | 阿坚 | 1天 |
