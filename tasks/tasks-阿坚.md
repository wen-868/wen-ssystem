# 阿坚 - 后端开发任务清单

> 角色：后端开发工程师
> 技术栈：Node.js 20 + Express + TypeScript + MySQL 8.4
> 工作时间：每天 8 小时

---

## 当前阶段：基础架构整改期（6/24 - 7/7）

### 🔴 P0 - 后端分层改造（Controller-Service 模式）[R2-01]
**截止时间**：6/28（周日）
**预计耗时**：40 小时
**优先级**：最高（tenant_id 改造的前置依赖）

**目标**：将胖路由模式改为 Controller-Service 两层架构，为后续 tenant_id 改造打基础。

**目标目录结构**：
```
backend/src/
├── routes/           ← 仅保留路由定义，调用 Controller
│   ├── admin.routes.ts
│   ├── store.routes.ts
│   └── ...
├── controllers/      ← 新增：请求处理、参数校验、调用 Service
│   ├── admin/
│   │   ├── product.controller.ts
│   │   ├── order.controller.ts
│   │   ├── customer.controller.ts
│   │   ├── supplier.controller.ts
│   │   ├── purchase.controller.ts
│   │   ├── inventory.controller.ts
│   │   ├── employee.controller.ts
│   │   ├── store.controller.ts
│   │   ├── report.controller.ts
│   │   └── payment.controller.ts
│   └── store/
│       ├── sale.controller.ts
│       ├── order.controller.ts
│       └── dashboard.controller.ts
├── services/         ← 新增：业务逻辑、数据库操作
│   ├── product.service.ts
│   ├── order.service.ts
│   ├── customer.service.ts
│   ├── supplier.service.ts
│   ├── purchase.service.ts
│   ├── inventory.service.ts
│   ├── payment.service.ts
│   └── ...
├── types/            ← 新增：TypeScript 类型定义
│   ├── product.types.ts
│   ├── order.types.ts
│   └── ...
└── shared/           ← 保留：db/auth/id/response 等
```

**具体工作**：

| 步骤 | 内容 | 预计时间 |
|------|------|---------|
| 1 | 创建 controllers/、services/、types/ 目录结构 | 0.5h |
| 2 | 抽取产品相关逻辑 → product.controller.ts + product.service.ts | 3h |
| 3 | 抽取订单相关逻辑 → order.controller.ts + order.service.ts | 3h |
| 4 | 抽取客户相关逻辑 → customer.controller.ts + customer.service.ts | 2h |
| 5 | 抽取供应商相关逻辑 → supplier.controller.ts + supplier.service.ts | 2h |
| 6 | 抽取采购相关逻辑 → purchase.controller.ts + purchase.service.ts | 4h |
| 7 | 抽取库存相关逻辑 → inventory.controller.ts + inventory.service.ts | 3h |
| 8 | 抽取支付/报表/员工/门店 → 对应 controller + service | 6h |
| 9 | 重写 admin.routes.ts，仅保留路由定义 | 3h |
| 10 | 重写 store.routes.ts，仅保留路由定义 | 2h |
| 11 | 运行测试，确保所有 API 行为不变 | 4h |

**改造示例**：
```typescript
// ===== 改造前（胖路由）=====
router.get('/products', requireAuth, asyncHandler(async (req, res) => {
  const { keyword, category, status, page, pageSize } = req.query;
  // ... 50 行业务逻辑 ...
  res.json(ok({ data: products, total }));
}));

// ===== 改造后（分层）=====
// routes/admin.routes.ts
router.get('/products', requireAuth, productController.list);

// controllers/admin/product.controller.ts
export const list = asyncHandler(async (req, res) => {
  const params = productQuerySchema.parse(req.query);
  const result = await productService.list(params, req.user);
  res.json(ok(result));
});

// services/product.service.ts
export async function list(params, user) {
  const { keyword, category, status, page, pageSize } = params;
  const sql = `SELECT ... FROM product_sku WHERE ...`;
  const [rows] = await db.query(sql, [...]);
  return { data: rows, total };
}
```

**验收标准**：
- [ ] controllers/ 目录下至少 10 个 controller 文件
- [ ] services/ 目录下至少 10 个 service 文件
- [ ] admin.routes.ts 仅包含路由定义，不含业务逻辑
- [ ] store.routes.ts 仅包含路由定义，不含业务逻辑
- [ ] 所有 389 个 API 端点功能不变
- [ ] 现有测试全部通过

---

### 🔴 P0 - tenant_id 多租户数据隔离 [R2-02]
**截止时间**：7/4（周六）
**预计耗时**：40 小时
**依赖**：R2-01 分层改造完成
**优先级**：最高（SaaS 化基础）

**目标**：62 张表全部添加 tenant_id 字段，所有查询自动注入 tenant_id 过滤。

**详细方案参考**：`docs/tenant-isolation-plan.md`

**具体工作**：

| 步骤 | 内容 | 预计时间 |
|------|------|---------|
| 1 | 编写迁移 SQL：62 张表 ALTER TABLE ADD tenant_id | 2h |
| 2 | 修改 shared/db.ts：添加 tenant_id 自动注入机制 | 3h |
| 3 | 修改 shared/auth.ts：JWT payload 中携带 tenant_id | 1h |
| 4 | 逐个修改 services/ 中的查询，确保 WHERE 条件包含 tenant_id | 16h |
| 5 | 修改所有 INSERT 语句，自动写入 tenant_id | 4h |
| 6 | 编写数据迁移脚本：为现有数据分配默认 tenant_id | 2h |
| 7 | 编写 tenant 隔离验证测试 | 4h |
| 8 | 回归测试，确保现有功能不受影响 | 8h |

**核心要求**：
1. **SELECT**：所有查询自动带上 `WHERE tenant_id = ?`
2. **INSERT**：自动写入当前用户的 tenant_id
3. **UPDATE/DELETE**：同样带上 tenant_id 条件，防止越权
4. **向后兼容**：现有数据分配默认 tenant_id = 1

**验收标准**：
- [ ] 62 张表全部有 tenant_id 字段（有索引）
- [ ] 所有 SELECT 查询自动带 tenant_id 过滤
- [ ] 所有 INSERT 自动写入 tenant_id
- [ ] 租户 A 无法查到租户 B 的数据（集成测试验证）
- [ ] 现有功能不受影响（向后兼容）
- [ ] 所有测试通过

---

### 🟡 P2 - 整理测试文件（顺手做）
**预计耗时**：4 小时

**任务详情**：
1. 把 backend/tests/ 下的 Jest 测试和 backend/src/__tests__/ 下的 Vitest 测试统一
2. 修复现有失败的测试用例（约 36 个失败）
3. 统一测试框架（建议全部用 Vitest）

**验收标准**：
- [ ] 所有测试用同一框架运行
- [ ] 失败用例修复率 80% 以上

---

## 开发规范

1. 使用 TypeScript，严格类型，禁用 any
2. 路由用 `asyncHandler` 包裹
3. 参数校验用 zod（放在 controller 层）
4. 数据库操作参数化查询
5. 事务用 `transaction()` 包裹
6. 金额精确到分（整数存储，单位：分）
7. 操作写 operation_log
8. 单据号按规则生成（makeBizNo）
9. 所有 SQL 必须带 tenant_id 条件（R2-02 阶段）

## 每日站会

- 时间：09:30
- 地点：飞书群
- 内容：昨天完成 / 今天计划 / 阻塞问题
