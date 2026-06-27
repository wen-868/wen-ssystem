# 阿坚 · 任务清单（后端工程师 · V4.5 审计整改版）

> **更新日期：** 2026-06-27
> **当前阶段：** V4.5 · 四阶段全部完成，审计问题整改
> **进展：** ✅ 胖路由全部 ≤228 行，✅ 多租户迁移脚本已修复，✅ 权限矩阵/越权拦截/同步中间件已接入，✅ 批量调价/报价推送/平台总后台 API 已注册
> **核心理念：** 底层架构已就绪，现在补安全漏洞和细节瑕疵。

---

## ⚠️ 进度更新（2026-06-27 凌舟第三次审计）

### 四阶段全部完成 ✅

| 指标 | 之前 | 现在 |
|------|------|------|
| 路由文件 | 12 个超 500 行 | **全部 ≤228 行** ✅ |
| Controller 层 | 15 个 | **85 个** ✅ |
| Service 层 | 22 个 | **87 个** ✅ |
| 迁移脚本 | MariaDB 语法 | **MySQL 8.0+ 兼容** ✅ |
| 权限矩阵 | 缺失 | **sys_menu/data_permission/field_permission 已接入** ✅ |
| 越权拦截 | 缺失 | **price-guard 6 个中间件已挂载** ✅ |
| 字段同步 | 缺失 | **field-sync 已接入 product/customer service** ✅ |
| 全链路同步 | 缺失 | **product-sync 已接入 product.service** ✅ |
| 批量调价 | 缺失 | **server.ts 已注册** ✅ |
| 报价推送 | 缺失 | **server.ts 已注册** ✅ |
| 平台总后台 API | 缺失 | **server.ts 已注册** ✅ |
| 编译 | — | **0 errors** ✅ |
| 测试 | — | **145/149 passed** ✅ |

---

## P0：立即修复（3.5天）

| 编号 | 任务 | 工时 | 状态 | 验收标准 |
|------|------|:---:|:---:|------|
| **P0-01** | **4 个路由补认证和租户中间件** | 1天 | 🔴 | `/api/platform`、`/api/store/control`、`/api/store/transfers`、`/api/store/stock-checks` 挂载 `requireAuthWithTenant` |
| **P0-02** | **密码哈希升级 bcrypt** | 1天 | 🔴 | 替换 `shared/password.ts` 的 SHA-256 为 bcrypt；移除 `verifyPassword` 明文比对逻辑；mock-db.ts 同步更新 |
| **P0-03** | **add_platform_admin.sql 改为幂等** | 0.5天 | 🔴 | `DROP TABLE IF EXISTS` → `CREATE TABLE IF NOT EXISTS` |
| **P0-04** | **instant-retail-new.routes.ts 处理** | 0.5天 | 🔴 | 确认是否替换旧版 `instant-retail.routes.ts`，或删除死代码文件 |
| **P0-05** | **node-fetch 依赖补充** | 0.5天 | 🔴 | `npm install node-fetch @types/node-fetch`，消除编译错误 |

---

## P1：细节修复（2天）

| 编号 | 任务 | 工时 | 状态 | 验收标准 |
|------|------|:---:|:---:|------|
| **P1-01** | **auth.test.ts 修复** | 0.5天 | 🔴 | `jest.fn()` → `vi.fn()`，4 个失败测试用例通过 |
| **P1-02** | **console.log 收敛** | 1天 | 🔴 | 定时任务日志统一为 `console.info` 或引入日志库；删除调试残留 |
| **P1-03** | **init_database.sql 注释修正** | 0.5天 | 🔴 | 文件末尾"52 张"→"62 张" |

---

## P2：可选优化（后续）

| 编号 | 任务 | 工时 | 状态 |
|------|------|:---:|:---:|
| P2-01 | 3 个路由文件改为委托 Controller（purchase/sale-return/supplier） | 1天 | ⏳ |
| P2-02 | overdue-scanner / subscription-expiry 接入 queryWithTenant | 0.5天 | ⏳ |
| P2-03 | JWT Secret 从 .env.production 移除，改为环境变量注入 | 0.5天 | ⏳ |

---

## 工期汇总

| 优先级 | 内容 | 工时 | 状态 |
|:---:|------|:---:|:---:|
| P0 | 安全修复（认证/密码/幂等/死代码/依赖） | 3.5天 | 🔴 |
| P1 | 细节修复（测试/日志/注释） | 2天 | 🔴 |
| P2 | 可选优化 | 2天 | ⏳ |
| **合计** | | **7.5天** | |