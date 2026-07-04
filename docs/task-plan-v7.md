# 任务分派清单 — 苏然测试报告核查结果

> **核查日期**：2026-07-04  
> **核查人**：凌舟  
> **报告来源**：苏然 `docs/test-report-2026-07-04.md`（15 个问题）  
> **核查结论**：15 个问题全部属实，其中 3 个已修复，12 个待修复  

---

## 一、已修复（本次核查中解决）

| # | 问题 | 严重度 | 修复内容 |
|---|------|:---:|------|
| 7 | staff 路由使用 `requireAuth` 而非 `requireAuthWithTenant` | P1 | 4 个端点已改为 `requireAuthWithTenant` |
| — | 前端路由未注册 MonitorView | P0 | 已添加路由和菜单入口 |
| — | 侧边栏无错误日志/监控入口 | P1 | 已添加"错误日志""监控告警""建议反馈"菜单项 |
| — | avgResponseTime 假数据 | P1 | 已移除 Math.random()，改为 0 + TODO 注释 |
| — | 前端无错误日志查看页 | P1 | 已添加 ErrorLogView.vue |

---

## 二、P0 任务（立即修复，阻塞上线）

### 任务 1：修复 31 个 Controller 的 try-catch 绕过 error-handler

- **负责人**：后端开发
- **预估**：1-2 天
- **问题**：31 个 controller 自行 try-catch 后直接 `res.status().json()`，错误不会进入全局 error-handler，导致：
  - 错误不持久化到 `error_logs` 表
  - 不触发飞书告警
  - 错误统计不完整
- **方案**：去掉 controller 层的 try-catch，让 `asyncHandler` 将错误抛给 error-handler 统一处理
- **涉及文件**（前 10 个最大的）：

| 文件 | 行数 |
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
| 及其他 21 个文件 | — |

### 任务 2：saas-admin 前端添加错误捕获上报

- **负责人**：前端开发
- **预估**：0.5 天
- **问题**：`saas-admin/src/utils/request.ts` 无错误上报，无 Vue 全局 errorHandler，无 window.onerror/unhandledrejection 监听
- **方案**：参照 `admin-web/src/main.ts` 已有的三层错误捕获，复制到 saas-admin

---

## 三、P1 任务（本周内修复）

### 任务 3：拆分 4 个胖路由

- **负责人**：后端开发
- **预估**：2-3 天
- **问题**：

| 文件 | 端点数 | 业务域 |
|------|:---:|------|
| `admin.routes.ts` | 83 | 10个域 |
| `marketing.routes.ts` | 59 | 8个域 |
| `store.routes.ts` | 46 | 8个域 |
| `instant-retail-new.routes.ts` | 45 | 1个域 |

- **方案**：按业务域拆分，每个路由文件不超过 30 个端点

### 任务 4：69 个 Controller 补充 Zod 输入校验

- **负责人**：后端开发
- **预估**：2-3 天
- **问题**：56% 的 controller 无任何输入校验，非法参数可能直接写入数据库
- **方案**：按优先级为每个 controller 的入参添加 Zod schema

### 任务 5：拆分 mock-db.ts

- **负责人**：后端开发
- **预估**：1-2 天
- **问题**：`mock-db.ts` 单文件 1778 行，所有表模拟逻辑集中在一个文件
- **方案**：按模块拆分为 `mock-db-product.ts`、`mock-db-order.ts`、`mock-db-inventory.ts` 等

### 任务 6：前端三个项目添加测试

- **负责人**：前端开发
- **预估**：3-5 天
- **问题**：saas-admin、admin-web、merchant-mobile 三个项目测试覆盖率为 0
- **方案**：至少为核心页面（登录、商品、订单、库存）添加组件测试

---

## 四、P2 任务（下个迭代排期）

### 任务 7：4 个 TODO 实现

- **负责人**：对应模块负责人
- **预估**：2-3 天
- 短信服务（`quote-push.service.ts:482`）
- 小程序订阅消息（`quote-push.service.ts:488`）
- 邮件服务（`quote-push.service.ts:492`）
- 租户默认数据初始化（`tenant-admin.service.ts:195`）

### 任务 8：清理 console.log 残留

- **负责人**：后端开发
- **预估**：5 分钟
- 文件：`backend/src/jobs/report-aggregation.job.ts` 第 193、206 行

### 任务 9：路由自动发现机制

- **负责人**：后端开发
- **预估**：1 天
- **问题**：`server.ts` 手动注册 84 个路由，新增模块容易遗漏
- **方案**：扫描 `routes/` 目录自动注册

### 任务 10：确认 3 个公开路由认证

- **负责人**：后端开发
- **预估**：0.5 天
- `platform.routes.ts`（3 端点）、`share.routes.ts`（4 端点）、`wechat.routes.ts`（6 端点）

---

## 五、已合并的分支内容

| 分支 | 来源 | 提取内容 | 状态 |
|------|------|---------|:---:|
| `trae/solo-agent-tkoXzL` | 阿澈 | 多级单位组模块（routes/service/迁移SQL） | ✅ 已集成 |
| `trae/solo-agent-4ikMYJ` | 苏然 | 正式测试报告 `test-report-2026-07-04.md` | ✅ 已提取 |
| `trae/solo-agent-oqrXJp` | 林夕 | 设计稿（miniapp-config/payment-config/onepan-redesign/miniapp-template） | ✅ 已提取 |

> **注意**：三个分支均基于旧版代码，包含大量删除操作，**未直接合并**，仅手工提取了有价值的部分。

---

## 六、修复优先级矩阵

| 优先级 | 任务 | 负责人 | 预估 | 状态 |
|:---:|------|------|:---:|:---:|
| P0 | 1. 31个Controller统一错误处理 | 后端 | 1-2天 | ⬜ 待开始 |
| P0 | 2. saas-admin错误捕获上报 | 前端 | 0.5天 | ⬜ 待开始 |
| P1 | 3. 拆分4个胖路由 | 后端 | 2-3天 | ⬜ 待开始 |
| P1 | 4. 69个Controller补充校验 | 后端 | 2-3天 | ⬜ 待开始 |
| P1 | 5. 拆分mock-db.ts | 后端 | 1-2天 | ⬜ 待开始 |
| P1 | 6. 前端添加测试 | 前端 | 3-5天 | ⬜ 待开始 |
| P2 | 7. 4个TODO实现 | 全员 | 2-3天 | ⬜ 待开始 |
| P2 | 8. 清理console.log | 后端 | 5分钟 | ⬜ 待开始 |
| P2 | 9. 路由自动发现 | 后端 | 1天 | ⬜ 待开始 |
| P2 | 10. 确认公开路由认证 | 后端 | 0.5天 | ⬜ 待开始 |

---

> **下次核查**：P0 任务完成后，跑全量测试 + 苏然报告中的检查脚本验证。