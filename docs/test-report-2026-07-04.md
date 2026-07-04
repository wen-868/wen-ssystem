# 技术债 / 胖路由 / API 问题 全面检测报告

> **测试人**：苏然（测试工程师）  
> **测试日期**：2026-07-04  
> **测试分支**：trae/solo-agent-4ikMYJ  
> **测试基准**：275 个测试用例全部通过 ✅  
> **检测范围**：124 个 controller、71 个路由文件、全部 service 层、前端三个项目  

---

## 一、测试概览

| 指标 | 数值 |
|------|:---|
| 后端路由文件 | 71 个 |
| 后端 controller | 124 个 |
| 后端 service | 73 个 |
| 单元测试通过 | 275/275 |
| 前端测试 | 0（三个前端项目均无测试） |
| 发现问题总数 | 15 个（P0: 5, P1: 6, P2: 4） |

---

## 二、严重问题（P0 — 需立即修复）

### 问题 1：胖路由 — admin.routes.ts 包含 83 个端点，跨 10 个业务域

- **文件**：[`backend/src/routes/admin.routes.ts`](file:///workspace/backend/src/routes/admin.routes.ts)
- **行数**：133 行
- **端点数**：83 个
- **涵盖业务域**：员工管理、门店管理、商品管理、订单管理、销售单、客户管理、报表仪表盘、分享链接、日结、会员体系、财务驾驶舱

**问题**：单个路由文件承担了 10 个完全不相关的业务域，任何修改都可能引发冲突，无法按模块独立测试或部署。

**定位方法**：
```bash
grep -cE '\.(get|post|put|delete|patch)\(' backend/src/routes/admin.routes.ts
# 输出: 83
```

**修复建议**：按业务域拆分为独立路由文件：
```
admin.routes.ts          → admin-auth.routes.ts
                           admin-staff.routes.ts
                           admin-store.routes.ts
                           admin-product.routes.ts
                           admin-order.routes.ts
                           admin-customer.routes.ts
                           admin-report.routes.ts
                           admin-daily-settlement.routes.ts
                           admin-member.routes.ts
                           admin-finance.routes.ts
```

---

### 问题 2：胖路由 — marketing.routes.ts 包含 59 个端点

- **文件**：[`backend/src/routes/marketing.routes.ts`](file:///workspace/backend/src/routes/marketing.routes.ts)
- **端点数**：59 个
- **涵盖业务域**：优惠券、团购、秒杀、积分商城、满减满赠、赠品规则、营销仪表盘、营销素材

**修复建议**：拆分为 `marketing-coupon.routes.ts`、`marketing-group-buy.routes.ts`、`marketing-flash-sale.routes.ts` 等。

---

### 问题 3：胖路由 — store.routes.ts 包含 46 个端点

- **文件**：[`backend/src/routes/store.routes.ts`](file:///workspace/backend/src/routes/store.routes.ts)
- **端点数**：46 个
- **涵盖**：门店端所有功能（销售、退货、对账、付款、库存、调拨、盘点等）

**修复建议**：按业务域拆分。

---

### 问题 4：胖路由 — instant-retail-new.routes.ts 包含 45 个端点

- **文件**：[`backend/src/routes/instant-retail-new.routes.ts`](file:///workspace/backend/src/routes/instant-retail-new.routes.ts)
- **端点数**：45 个
- **涵盖**：即时零售所有功能

---

### 问题 5：Controller 层 try-catch 绕过全局错误处理器

- **影响文件数**：31 个 controller 文件
- **影响**：这些 controller 中的错误**不会**被 `error-handler.ts` 捕获，因此：
  - 错误不会持久化到 `error_logs` 表
  - 不会触发飞书告警
  - 错误日志统计不完整

**典型问题代码**（[`backend/src/controllers/purchase-return.controller.ts`](file:///workspace/backend/src/controllers/purchase-return.controller.ts)）：

```typescript
// ❌ 当前代码：错误被吞掉
export const approve = asyncHandler(async (req, res) => {
  try {
    const result = await service.approve(...);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: ..., message: e.message });
    // 错误在这里被吞掉，不会走到 error-handler
  }
});
```

**修复方案**（二选一）：

方案 A — 去掉 controller 层的 try-catch，让错误自然抛到 error-handler：
```typescript
// ✅ 方案 A：去掉 try-catch
export const approve = asyncHandler(async (req, res) => {
  const result = await service.approve(...);
  res.json(ok(result));
});
```

方案 B — 在 catch 中手动调用 `insertErrorLog`：
```typescript
// ✅ 方案 B：手动记录
} catch (e: any) {
  insertErrorLog({
    error_type: "business",
    severity: e.statusCode >= 500 ? "ERROR" : "WARN",
    message: e.message,
    status_code: e.statusCode || 400,
    request_url: req.originalUrl,
    request_method: req.method,
    user_id: req.user?.id,
    tenant_id: req.tenantId,
  }).catch(() => {});
  res.status(e.statusCode || 400).json({ code: ..., message: e.message });
}
```

**涉及的全部 31 个文件**：

| controller 文件 | 行数 |
|------|:---:|
| `controllers/admin/instant-retail.controller.ts` | 317 |
| `controllers/admin/credit.controller.ts` | 304 |
| `controllers/admin/marketing-new.controller.ts` | 217 |
| `controllers/admin/trace-records.controller.ts` | 216 |
| `controllers/platform/platform.controller.ts` | 198 |
| `controllers/admin/report.controller.ts` | 181 |
| `controllers/admin/product.controller.ts` | 171 |
| `controllers/admin/inventory-batch.controller.ts` | 169 |
| `controllers/admin/marketing-group-buy.controller.ts` | 160 |
| `controllers/admin/price-management.controller.ts` | 155 |
| `controllers/admin/marketing-coupon.controller.ts` | 149 |
| `controllers/admin/transfer-order.controller.ts` | 148 |
| `controllers/admin/purchase-admin.controller.ts` | 133 |
| `controllers/admin/cart.controller.ts` | 133 |
| `controllers/admin/order.controller.ts` | 132 |
| `controllers/store/sale-bill.controller.ts` | 126 |
| `controllers/admin/marketing-flash-sale.controller.ts` | 123 |
| `controllers/admin/subscription.controller.ts` | 121 |
| `controllers/admin/customer-visit.controller.ts` | 110 |
| 及其他 12 个文件 | — |

---

## 三、高危问题（P1 — 应尽快修复）

### 问题 6：69 个 controller 缺少输入校验（占 56%）

- **总 controller 数**：124
- **有 Zod 校验**：55 个（44%）
- **无任何校验**：**69 个（56%）**

**影响**：非法参数可能直接写入数据库，导致脏数据或 SQL 错误。

**检查方法**：
```bash
# 列出无 Zod 校验的 controller
for f in backend/src/controllers/**/*.ts; do
  if ! grep -q 'z\.\|\.parse\|\.safeParse\|Zod' "$f"; then
    echo "无校验: $f"
  fi
done
```

**修复建议**：为每个 controller 的入参添加 Zod schema 校验。

---

### 问题 7：多租户隔离不一致 — admin.routes.ts 中 4 个端点使用 `requireAuth` 而非 `requireAuthWithTenant`

- **文件**：[`backend/src/routes/admin.routes.ts`](file:///workspace/backend/src/routes/admin.routes.ts) 第 23-26 行

```typescript
// ❌ 当前代码：使用 requireAuth（无租户隔离）
adminRouter.get("/staff", requireAuth, employeeController.listStaff);
adminRouter.post("/staff", requireAuth, employeeController.createStaff);
adminRouter.put("/staff/:id", requireAuth, employeeController.updateStaff);
adminRouter.put("/staff/:id/disable", requireAuth, employeeController.disableStaff);
```

**风险**：可能导致跨租户访问员工数据。

**修复**：将 `requireAuth` 改为 `requireAuthWithTenant`。

---

### 问题 8：TypeScript `any` 类型泛滥

| 层级 | `:any` 数量 |
|------|:---:|
| Controller | 191 处 |
| Service | 248 处 |
| Routes | 26 处 |
| **合计** | **465 处** |

**影响**：失去类型安全检查，容易引入运行时错误。

---

### 问题 9：mock-db.ts 单体文件 1778 行

- **文件**：[`backend/src/shared/mock-db.ts`](file:///workspace/backend/src/shared/mock-db.ts)
- **行数**：1778 行
- **问题**：所有数据库表的 mock 逻辑全在一个文件，新增表需要修改这个巨型文件，维护成本极高。

**修复建议**：按模块拆分，如 `mock-db-user.ts`、`mock-db-product.ts`、`mock-db-order.ts` 等。

---

### 问题 10：前端三个项目全部零测试

| 项目 | 测试文件数 |
|------|:---:|
| saas-admin | 0 |
| admin-web | 0 |
| merchant-mobile | 0 |

**影响**：前端修改无回归保障，只能靠人工测试。

---

### 问题 11：前端无错误捕获上报逻辑

- `saas-admin/src/utils/request.ts` 中的 axios 拦截器没有错误上报
- 没有 Vue 全局 `errorHandler` 
- 没有 `window.onerror` / `unhandledrejection` 监听
- 前端 JS 错误无法上报到后端 `error_logs` 表

---

## 四、低优先级问题（P2 — 可排期修复）

### 问题 12：4 个 TODO 未实现

| 文件 | 行号 | TODO 内容 |
|------|:---:|------|
| `services/admin/quote-push.service.ts` | 482 | 接入真实短信服务 |
| `services/admin/quote-push.service.ts` | 488 | 接入小程序订阅消息 |
| `services/admin/quote-push.service.ts` | 492 | 接入邮件服务 |
| `services/platform/tenant-admin.service.ts` | 195 | 初始化租户默认数据 |

---

### 问题 13：console.log 残留

- **文件**：[`backend/src/jobs/report-aggregation.job.ts`](file:///workspace/backend/src/jobs/report-aggregation.job.ts)
- **行号**：193、206

```typescript
console.log(`[报表定时任务] 开始汇总 ${today} 的数据...`);
console.log(`[报表定时任务] 汇总完成: ${tenants.length} 个租户`);
```

**修复**：改为 `console.info` 或 `logger.info`。

---

### 问题 14：server.ts 手动注册 84 个路由

- **文件**：[`backend/src/server.ts`](file:///workspace/backend/src/server.ts)
- 84 行 `app.use(...)` 手动注册
- 新增模块需手动添加，容易遗漏（上次监控告警就是漏了注册导致 404）

**建议**：实现自动路由发现机制，扫描 `routes/` 目录自动注册。

---

### 问题 15：3 个路由文件缺少认证中间件（需确认）

| 文件 | 端点数 | 是否合理 |
|------|:---:|------|
| `platform.routes.ts` | 3 | 待确认 |
| `share.routes.ts` | 4 | 待确认（分享链接可能需公开） |
| `wechat.routes.ts` | 6 | 待确认（微信回调需公开） |

---

## 五、超大文件清单（影响可维护性）

| 文件 | 行数 | 类型 |
|------|:---:|------|
| `shared/mock-db.ts` | 1778 | Mock |
| `services/admin/instant-retail.service.ts` | 866 | Service |
| `services/admin/trace-records.service.ts` | 790 | Service |
| `services/admin/customer-visit.service.ts` | 618 | Service |
| `services/admin/quote-push.service.ts` | 611 | Service |
| `services/admin/price-management.service.ts` | 549 | Service |
| `services/admin/dashboard.service.ts` | 505 | Service |
| `services/admin/batch-price.service.ts` | 495 | Service |
| `controllers/admin/instant-retail.controller.ts` | 317 | Controller |
| `controllers/admin/credit.controller.ts` | 304 | Controller |

> 建议：超过 500 行的 service 和超过 200 行的 controller 应考虑拆分。

---

## 六、修复优先级矩阵

| 优先级 | 问题编号 | 问题 | 预估工作量 | 建议负责人 |
|:---:|:---:|------|:---:|------|
| P0 | 1-4 | 拆分 4 个胖路由 | 2-3 天 | 后端开发 |
| P0 | 5 | 31 个 controller 统一错误处理 | 1-2 天 | 后端开发 |
| P1 | 6 | 69 个 controller 补充校验 | 2-3 天 | 后端开发 |
| P1 | 7 | 修复 staff 路由多租户 | 10 分钟 | 后端开发 |
| P1 | 8 | 减少 `:any` 类型 | 持续 | 全员 |
| P1 | 9 | 拆分 mock-db.ts | 1-2 天 | 后端开发 |
| P1 | 10 | 前端添加测试 | 3-5 天 | 前端开发 |
| P1 | 11 | 前端添加错误捕获上报 | 0.5 天 | 前端开发 |
| P2 | 12 | 4 个 TODO 实现 | 2-3 天 | 对应模块负责人 |
| P2 | 13 | 清理 console.log | 5 分钟 | 后端开发 |
| P2 | 14 | 路由自动发现 | 1 天 | 后端开发 |
| P2 | 15 | 确认公开路由认证 | 0.5 天 | 后端开发 |

---

## 七、测试环境

| 项目 | 版本/配置 |
|------|------|
| Node.js | 当前 LTS |
| 测试框架 | Vitest 4.1.9 |
| 数据库 | Mock DB（内存） |
| 分支 | trae/solo-agent-4ikMYJ |
| 提交 | 0eb5962 |

---

## 八、复现脚本

如需验证本报告中的问题，可运行以下命令：

```bash
cd /workspace/backend

# 1. 检查胖路由
for f in src/routes/*.ts; do
  count=$(grep -cE '\.(get|post|put|delete|patch)\(' "$f" 2>/dev/null)
  [ "$count" -gt 30 ] && echo "胖路由: $count 端点 $f"
done

# 2. 检查无校验的 controller
total=$(find src/controllers -name '*.ts' | wc -l)
hasZod=$(grep -rl 'z\.\|\.parse\|Zod' src/controllers/ --include='*.ts' 2>/dev/null | wc -l)
echo "无校验: $((total - hasZod)) / $total"

# 3. 检查 try-catch 绕过
echo "有 try-catch 的 controller: $(grep -l 'catch.*{' src/controllers/**/*.ts 2>/dev/null | wc -l) 个"

# 4. 检查 :any 类型
echo ":any 数量: $(grep -rn ': any' src/ --include='*.ts' | grep -v __tests__ | grep -v mock-db | wc -l) 处"

# 5. 运行全部测试
npx vitest run
```

---

> **报告完成时间**：2026-07-04  
> **下次测试**：建议修复完成后重新跑全量测试 + 本报告中的检查脚本