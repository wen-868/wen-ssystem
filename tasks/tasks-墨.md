# 墨 · 错误自动反馈功能 · 全线开发

**日期**：2026-07-03
**状态**：待开始
**来源**：苏然测试报告 — 全局错误自动反馈功能缺失

---

## 背景

苏然测试发现：当前系统错误发生时，后端只有 `console.error` 打印一行就没了，服务重启后所有错误记录丢失。三个前端（admin-web、merchant-mobile、store-terminal）均无全局错误捕获。生产环境出问题，管理员完全不知道，只能等用户投诉。

现有可用基础设施：
- `backend/src/shared/feishu-report.ts` — 已有飞书群机器人 webhook 发送能力，SDK 完整可用
- `backend/src/shared/db.ts` — 已有 `query()` / `transaction()` 方法

---

## 任务概览

| # | 任务 | 模块 | 负责人 |
|---|------|------|:---:|
| 1 | 创建 error_logs 表 DDL | 后端 | 墨 |
| 2 | 创建 error-log.service.ts 错误日志持久化服务 | 后端 | 墨 |
| 3 | 改造 error-handler.ts — 错误写入 error_logs + 500 触发飞书告警 | 后端 | 墨 |
| 4 | server.ts 添加 process.on(uncaughtException/unhandledRejection) | 后端 | 墨 |
| 5 | 新增 POST /api/admin/error-report 前端错误上报接口 | 后端 | 墨 |
| 6 | admin-web main.ts 添加全局错误捕获 | 前端 | 墨 |
| 7 | merchant-mobile main.ts 添加全局错误捕获 | 前端 | 墨 |
| 8 | store-terminal main.ts 添加全局错误捕获 | 前端 | 墨 |
| 9 | 新建 error-log.controller.ts + error-log.routes.ts — 错误日志查询 | 后端 | 墨 |
| 10 | admin-web 新增「错误日志」查看页面 ErrorLogView.vue | 前端 | 墨 |
| 11 | 全量测试验证 | 测试 | 苏然 |

---

## 详细说明

### 任务 1：创建 error_logs 表 DDL

**文件**：`backend/migrations/001_error_logs.sql`（新建）

```sql
CREATE TABLE IF NOT EXISTS error_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  error_type  VARCHAR(64)   NOT NULL COMMENT '错误类型: validation/business/unknown/uncaughtException/unhandledRejection/frontend',
  severity    VARCHAR(16)   NOT NULL DEFAULT 'ERROR' COMMENT '严重级别: WARN/ERROR/FATAL',
  message     TEXT          NOT NULL COMMENT '错误消息',
  stack       TEXT          DEFAULT NULL COMMENT '堆栈信息',
  request_url VARCHAR(512)  DEFAULT NULL COMMENT '触发请求URL（后端错误时有值）',
  request_method VARCHAR(16) DEFAULT NULL COMMENT '请求方法: GET/POST/PUT/DELETE',
  status_code INT           DEFAULT NULL COMMENT 'HTTP状态码',
  user_id     VARCHAR(64)   DEFAULT NULL COMMENT '触发用户ID',
  tenant_id   VARCHAR(64)   DEFAULT NULL COMMENT '租户ID',
  source      VARCHAR(32)   NOT NULL DEFAULT 'backend' COMMENT '来源: backend/frontend',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_error_type (error_type),
  INDEX idx_severity (severity),
  INDEX idx_created_at (created_at),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统错误日志表';
```

**要点**：
- 在 `backend/` 下创建 `migrations/` 目录
- `init_database.sql` 不存在，所以 DDL 作为独立迁移脚本存放
- 索引覆盖 error_type、severity、created_at、tenant_id，方便后续查询

---

### 任务 2：创建 error-log.service.ts

**文件**：`backend/src/services/admin/error-log.service.ts`（新建）

**方法**：

```typescript
import { query, queryOne } from "../../shared/db.js";

export interface ErrorLogEntry {
  error_type: string;
  severity: "WARN" | "ERROR" | "FATAL";
  message: string;
  stack?: string;
  request_url?: string;
  request_method?: string;
  status_code?: number;
  user_id?: string;
  tenant_id?: string;
  source?: "backend" | "frontend";
}

// 写入错误日志（异步，不阻塞主流程）
export async function insertErrorLog(entry: ErrorLogEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO error_logs 
       (error_type, severity, message, stack, request_url, request_method, status_code, user_id, tenant_id, source) 
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [entry.error_type, entry.severity, entry.message, entry.stack || null,
       entry.request_url || null, entry.request_method || null, entry.status_code || null,
       entry.user_id || null, entry.tenant_id || null, entry.source || "backend"]
    );
  } catch (dbError) {
    // 写日志失败不能影响正常响应，静默处理
    console.error("[error-log] 写入 error_logs 失败:", dbError);
  }
}

// 查询错误日志列表（管理后台使用）
export async function listErrorLogs(params: {
  error_type?: string;
  severity?: string;
  source?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: any[]; total: number }> {
  const conditions: string[] = [];
  const values: any[] = [];

  if (params.error_type) {
    conditions.push("error_type = ?");
    values.push(params.error_type);
  }
  if (params.severity) {
    conditions.push("severity = ?");
    values.push(params.severity);
  }
  if (params.source) {
    conditions.push("source = ?");
    values.push(params.source);
  }
  if (params.keyword) {
    conditions.push("(message LIKE ? OR request_url LIKE ?)");
    values.push(`%${params.keyword}%`, `%${params.keyword}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (params.page - 1) * params.pageSize;

  const [rows, countResult] = await Promise.all([
    query(`SELECT * FROM error_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, params.pageSize, offset]),
    queryOne(`SELECT COUNT(*) AS total FROM error_logs ${where}`, values)
  ]);

  return { items: rows, total: (countResult as any)?.total || 0 };
}

// 清理旧日志（可定时调用，保留30天）
export async function cleanupOldLogs(retainDays: number = 30): Promise<number> {
  const result = await queryOne(
    `DELETE FROM error_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [retainDays]
  );
  return (result as any)?.affectedRows || 0;
}
```

**要点**：
- `insertErrorLog` 内部 try-catch，写日志失败不影响正常业务流程
- `listErrorLogs` 支持按 error_type/severity/source/keyword 筛选 + 分页
- `cleanupOldLogs` 保留 30 天，可后续挂到定时任务

---

### 任务 3：改造 error-handler.ts

**文件**：`backend/src/shared/error-handler.ts`（修改）

**改造内容**：

1. 顶部新增 import：
```typescript
import { insertErrorLog } from "../services/admin/error-log.service.js";
import { reportToLingZhou } from "./feishu-report.js";
```

2. 在每个错误分支中，调用 `insertErrorLog`（异步，不 await）：
   - ZodError → error_type: "validation", severity: "WARN"
   - 业务错误(statusCode存在) → error_type: "business", severity: 根据statusCode判断（400→WARN, 403/429→ERROR, 其他→ERROR）
   - 未知错误 → error_type: "unknown", severity: "ERROR"

3. 500 错误时，额外调用 `reportToLingZhou` 发送飞书告警：
```typescript
// 500 错误发送飞书告警（异步，不阻塞）
if (status === 500) {
  reportToLingZhou({
    phase: "系统错误告警",
    status: "BLOCKED",
    summary: `[${req.method}] ${req.originalUrl} — ${err.message || "服务器内部错误"}`,
    details: [
      { label: "请求URL", value: `${req.method} ${req.originalUrl}` },
      { label: "用户ID", value: (req as any).user?.id || "未登录" },
      { label: "租户ID", value: (req as any).tenantId || "N/A" },
      { label: "错误消息", value: err.message || "未知错误" },
    ],
    reporter: "系统自动告警",
    webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
  }).catch(() => {});
}
```

4. 从 `req` 中提取 request_url、request_method、user_id、tenant_id，传给 insertErrorLog

**完整改造后的 errorHandler**：
```typescript
import { ZodError, type ZodIssue } from "zod";
import { fail } from "./response.js";
import { insertErrorLog } from "../services/admin/error-log.service.js";
import { reportToLingZhou } from "./feishu-report.js";

export const errorHandler: any = (err: any, req: any, res: any, _next: any) => {
  console.error(err);

  const requestUrl = req?.originalUrl || req?.url || "";
  const requestMethod = req?.method || "";
  const userId = req?.user?.id || null;
  const tenantId = req?.tenantId || null;

  // ZodError：参数校验失败
  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e: ZodIssue) => ({
      field: e.path.join(".") || "root",
      message: e.message,
      code: e.code
    }));
    // 异步写入错误日志
    insertErrorLog({
      error_type: "validation",
      severity: "WARN",
      message: `参数校验失败: ${err.errors.map(e => e.message).join("; ")}`,
      request_url: requestUrl,
      request_method: requestMethod,
      status_code: 400,
      user_id: userId,
      tenant_id: tenantId,
    }).catch(() => {});
    res.status(400).json({ code: "400", message: "参数校验失败", errors: fieldErrors });
    return;
  }

  // 业务错误
  if (err && typeof err === "object" && "statusCode" in err) {
    const status = (err as any).statusCode as number;
    const message = (err as any).message || "请求错误";
    const code = String(status);

    insertErrorLog({
      error_type: "business",
      severity: status >= 500 ? "ERROR" : status === 403 || status === 429 ? "ERROR" : "WARN",
      message,
      stack: err.stack || null,
      request_url: requestUrl,
      request_method: requestMethod,
      status_code: status,
      user_id: userId,
      tenant_id: tenantId,
    }).catch(() => {});

    // 500 错误飞书告警
    if (status >= 500) {
      reportToLingZhou({
        phase: "系统错误告警",
        status: "BLOCKED",
        summary: `[${requestMethod}] ${requestUrl} — ${message}`,
        details: [
          { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
          { label: "用户ID", value: userId || "未登录" },
          { label: "租户ID", value: tenantId || "N/A" },
          { label: "状态码", value: status },
          { label: "错误消息", value: message },
        ],
        reporter: "系统自动告警",
        webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
      }).catch(() => {});
    }

    res.status(status).json(fail(message, code));
    return;
  }

  // 未知错误
  insertErrorLog({
    error_type: "unknown",
    severity: "ERROR",
    message: err?.message || "未知服务器错误",
    stack: err?.stack || null,
    request_url: requestUrl,
    request_method: requestMethod,
    status_code: 500,
    user_id: userId,
    tenant_id: tenantId,
  }).catch(() => {});

  // 500 飞书告警
  reportToLingZhou({
    phase: "系统错误告警",
    status: "BLOCKED",
    summary: `[${requestMethod}] ${requestUrl} — ${err?.message || "未知服务器错误"}`,
    details: [
      { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
      { label: "用户ID", value: userId || "未登录" },
      { label: "租户ID", value: tenantId || "N/A" },
      { label: "错误消息", value: err?.message || "未知错误" },
      { label: "堆栈", value: (err?.stack || "").split("\n").slice(0, 3).join("\n") },
    ],
    reporter: "系统自动告警",
    webhookUrl: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL,
  }).catch(() => {});

  res.status(500).json(fail("服务器内部错误", "500"));
};
```

**要点**：
- 所有 `insertErrorLog` 和 `reportToLingZhou` 都是异步调用，不 await，不阻塞响应
- 每个调用都加了 `.catch(() => {})` 防止写日志/告警失败影响正常流程
- 400 错误（ZodError / 业务 WARN）不触发飞书告警，避免告警轰炸
- 500 错误才触发飞书告警

---

### 任务 4：server.ts 添加全局未捕获异常监听

**文件**：`backend/src/server.ts`（修改）

在 `start()` 函数之前（约第 215 行），添加：

```typescript
// 全局未捕获异常处理
process.on("uncaughtException", (error) => {
  console.error("[FATAL] uncaughtException:", error);
  import("./services/admin/error-log.service.js").then(({ insertErrorLog }) => {
    insertErrorLog({
      error_type: "uncaughtException",
      severity: "FATAL",
      message: error.message || "未知进程异常",
      stack: error.stack || null,
    }).catch(() => {});
  }).catch(() => {});
  // 致命错误，优雅退出
  setTimeout(() => { process.exit(1); }, 1000);
});

process.on("unhandledRejection", (reason: any) => {
  console.error("[FATAL] unhandledRejection:", reason);
  import("./services/admin/error-log.service.js").then(({ insertErrorLog }) => {
    insertErrorLog({
      error_type: "unhandledRejection",
      severity: "FATAL",
      message: reason?.message || String(reason),
      stack: reason?.stack || null,
    }).catch(() => {});
  }).catch(() => {});
});
```

**要点**：
- `uncaughtException`：记录后 1 秒退出（避免僵尸进程），生产环境 PM2/docker 会自动重启
- `unhandledRejection`：记录但不退出（Promise rejection 不一定会导致进程不稳定）
- 使用动态 `import()` 而非顶层 `import`，避免循环依赖

---

### 任务 5：前端错误上报接口

**文件**：`backend/src/controllers/admin/error-log.controller.ts`（新建）
**文件**：`backend/src/routes/error-log.routes.ts`（新建）

**Controller 方法**：

```typescript
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as service from "../../services/admin/error-log.service.js";

// 前端错误上报
export const reportFrontendError = asyncHandler(async (req, res) => {
  await service.insertErrorLog({
    error_type: req.body.error_type || "frontend",
    severity: "ERROR",
    message: req.body.message || "前端未知错误",
    stack: req.body.stack || null,
    request_url: req.body.url || null,
    source: "frontend",
    user_id: req.user?.id || null,
    tenant_id: req.tenantId || null,
  });
  res.json(ok(null, "错误已上报"));
});

// 查询错误日志列表
export const listErrorLogs = asyncHandler(async (req, res) => {
  const result = await service.listErrorLogs({
    error_type: req.query.error_type as string,
    severity: req.query.severity as string,
    source: req.query.source as string,
    keyword: req.query.keyword as string,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });
  res.json(ok(result));
});
```

**Route**：

```typescript
import { Router } from "express";
import { requireAuth } from "../shared/auth.js";
import { tenantMiddleware } from "../shared/tenant.js";
import * as ctrl from "../controllers/admin/error-log.controller.js";

export const errorLogRouter = Router();

// 前端错误上报（需要认证+租户）
errorLogRouter.post("/error-report", requireAuth, tenantMiddleware, ctrl.reportFrontendError);
// 管理后台查询错误日志（需要认证+租户）
errorLogRouter.get("/error-logs", requireAuth, tenantMiddleware, ctrl.listErrorLogs);
```

**Server.ts 注册**（在 `app.use(errorHandler)` 之前）：
```typescript
import { errorLogRouter } from "./routes/error-log.routes.js";
app.use("/api/admin", errorLogRouter);
```

**要点**：
- `/api/admin/error-report` 接收前端错误上报，写入 error_logs 表，source="frontend"
- `/api/admin/error-logs` 管理后台查询接口
- 前端上报接口需要认证（requireAuth），防止滥用

---

### 任务 6：admin-web 全局错误捕获

**文件**：`admin-web/src/main.ts`（修改）

在 `app.mount("#app")` 之前添加：

```typescript
// 全局错误捕获
app.config.errorHandler = (err, _instance, info) => {
  console.error("[Vue Error]", err, info);
  // 异步上报到后端
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "vue_error",
      message: String(err),
      stack: (err as Error).stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
};

window.addEventListener("error", (event) => {
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "js_error",
      message: event.message || "JS运行时错误",
      stack: event.error?.stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
});

window.addEventListener("unhandledrejection", (event) => {
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "unhandled_promise",
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
});
```

**要点**：
- `app.config.errorHandler` 捕获 Vue 组件错误
- `window.addEventListener("error")` 捕获 JS 运行时错误
- `window.addEventListener("unhandledrejection")` 捕获未处理的 Promise rejection
- 所有上报都 `.catch(() => {})`，网络断开时不影响用户操作

---

### 任务 7：merchant-mobile 全局错误捕获

**文件**：`merchant-mobile/src/main.ts`（修改）

在 `createApp(App).use(Vant).mount('#app')` 之前，将代码改为：

```typescript
import { createApp } from 'vue'
import Vant from 'vant'
import 'vant/lib/index.css'
import './styles.css'
import App from './App.vue'

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
  console.error("[Vue Error]", err, info);
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "vue_error",
      message: String(err),
      stack: (err as Error).stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
};

window.addEventListener("error", (event) => {
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "js_error",
      message: event.message || "JS运行时错误",
      stack: event.error?.stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
});

window.addEventListener("unhandledrejection", (event) => {
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "unhandled_promise",
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
});

app.use(Vant).mount('#app');
```

**要点**：
- merchant-mobile 没有 router，结构更简单，直接改 main.ts 即可
- 错误上报路径为 `/api/admin/error-report`（与 admin-web 共用同一接口）

---

### 任务 8：store-terminal 全局错误捕获

**文件**：`store-terminal/src/main.ts`（修改）

在 `app.mount("#app")` 之前添加（与 admin-web 完全相同的错误捕获代码）：

```typescript
// 全局错误捕获
app.config.errorHandler = (err, _instance, info) => {
  console.error("[Vue Error]", err, info);
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "vue_error",
      message: String(err),
      stack: (err as Error).stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
};

window.addEventListener("error", (event) => {
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "js_error",
      message: event.message || "JS运行时错误",
      stack: event.error?.stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
});

window.addEventListener("unhandledrejection", (event) => {
  fetch("/api/admin/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_type: "unhandled_promise",
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || "",
      url: window.location.href,
    }),
    credentials: "include",
  }).catch(() => {});
});
```

---

### 任务 9：ErrorLogView.vue — 管理后台错误日志查看页面

**文件**：`admin-web/src/views/ErrorLogView.vue`（新建）

**功能**：
- 表格列：时间 / 错误类型 / 严重级别 / 来源 / 消息 / 请求URL / 状态码 / 用户ID
- 筛选栏：error_type 下拉（validation/business/unknown/uncaughtException/unhandledRejection/frontend）、severity 下拉（WARN/ERROR/FATAL）、source 下拉（backend/frontend）、keyword 搜索
- 分页 + 按创建时间倒序
- 点击行展开 stack 详情
- 使用 `fetchErrorLogs` API 调用 `GET /api/admin/error-logs`

**API 函数**（追加到 `admin-web/src/api.ts`）：
```typescript
export const fetchErrorLogs = (params: {
  error_type?: string; severity?: string; source?: string; keyword?: string;
  page?: number; pageSize?: number;
}) => api.get("/admin/error-logs", { params });
```

**路由注册**（`admin-web/src/router/index.ts`，在系统设置 section 添加）：
```typescript
{ path: 'error-logs', name: 'ErrorLogs', component: () => import('../views/ErrorLogView.vue'), meta: { roles: ['BOSS'] } }
```

**要点**：
- 仅 BOSS 角色可查看（包含敏感错误信息）
- 页面风格与现有管理后台页面保持一致（PageCard 组件、el-table + el-pagination）
- severity 列使用 el-tag（WARN=orange, ERROR=red, FATAL=darkred）

---

### 任务 10：task-breakdown-v7.md 高风险标记

**文件**：`docs/task-breakdown-v7.md`（修改）

在文件末尾追加：

```markdown
---

## 苏然测试报告 · 高风险标记

**检测时间**：2026-07-03
**检测人**：苏然

**发现**：系统无错误自动反馈功能

| 缺失项 | 风险等级 |
|--------|:---:|
| 错误日志持久化 | 🔴 高 |
| 全局未捕获异常监听 | 🔴 高 |
| 错误自动通知管理员 | 🔴 高 |
| 前端全局错误捕获 | 🟡 中 |
| 前端错误上报 | 🟡 中 |

**处理**：已分配为 tasks-墨.md 任务，全线开发中。
```

---

## 苏然测试任务

| # | 测试项 | 方法 | 验收标准 |
|---|--------|------|---------|
| 1 | 后端 error_logs 写入验证 | 触发 ZodError → 查 error_logs 表 | 有记录，error_type=validation |
| 2 | 后端 500 错误写入 | 触发 500 → 查 error_logs 表 | 有记录，error_type=unknown |
| 3 | 后端 500 飞书告警 | 触发 500 → 检查飞书群 | 收到告警消息 |
| 4 | 后端 400 不告警 | 触发 400 → 检查飞书群 | 无告警 |
| 5 | uncaughtException 捕获 | 模拟未捕获异常 → 查 error_logs | 有记录，error_type=uncaughtException |
| 6 | unhandledRejection 捕获 | 模拟未处理 Promise → 查 error_logs | 有记录，error_type=unhandledRejection |
| 7 | 前端错误上报 | admin-web 触发 JS 错误 → 查 error_logs | 有记录，source=frontend |
| 8 | 前端错误不阻塞用户 | 断开网络 → 触发错误 | 页面无白屏，无卡死 |
| 9 | 错误日志查询页面 | 访问 ErrorLogView | 列表正常显示，筛选正常 |
| 10 | 写日志失败不影响响应 | 模拟 DB 不可用 → 触发错误 | 正常返回 500，不崩溃 |

---

## 验收标准

1. `error_logs` 表已创建，字段完整
2. 后端任何错误（ZodError/业务错误/未知错误）都会写入 error_logs 表
3. 500 错误自动触发飞书告警，400 不触发
4. `uncaughtException` 和 `unhandledRejection` 被全局捕获，写入 error_logs 后优雅处理
5. 三个前端（admin-web/merchant-mobile/store-terminal）均有全局错误捕获 + 上报
6. 管理后台可查看错误日志（ErrorLogView 页面）
7. 写日志失败不影响正常业务流程
8. 前端错误上报失败不影响用户操作