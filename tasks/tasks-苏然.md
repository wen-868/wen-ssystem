# 苏然 · Bug修复 · 测试验证

**日期**：2026-07-02
**状态**：待开始
**来源**：全面审查报告 + WorkBuddy 测试报告交叉核对

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 确保阿坚修复后服务能启动（集成测试） | P0 | ✅ |
| 2 | 运行自测脚本 `scripts/self-test.mjs` 验证核心 API | P1 | ✅ |
| 3 | 验证所有路由-Controller 函数一致性 | P1 | ✅ |
| 4 | 补充测试覆盖率配置 | P2 | ✅ |
| 5 | 错误自动反馈功能 — 全量测试验证 | P0 | ❌ |

---

## 🔴 新任务：错误自动反馈功能测试

**来源**：苏然测试报告 — 全局无错误自动反馈功能
**开发**：墨负责全线开发（tasks-墨.md）
**测试**：苏然

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

## 详细说明

### 1. 集成测试：服务启动验证
- **等待阿坚修复完成后执行**
- **命令**：`cd backend && USE_MOCK_DB=true JWT_SECRET=test-secret PORT=8080 npx tsx src/server.ts`
- **验证**：服务启动无 `Route.xxx() requires a callback function but got [object Undefined]` 错误
- **如果失败**：记录具体报错的路由文件和缺失函数，反馈给阿坚

### 2. 自测脚本验证
- **等待服务启动成功后执行**
- **命令**：`node scripts/self-test.mjs`
- **覆盖**：登录、看板、商品列表、库存列表、创建订单、订单列表、门店订单
- **记录**：每个 API 的响应状态码和关键数据

### 3. 路由-Controller 函数一致性自动化检查
- **创建检查脚本**：`backend/scripts/check-routes.js`
- **功能**：
  - 扫描所有路由文件，提取 `controllerName.functionName` 引用
  - 检查对应 controller 文件是否导出了该函数
  - 输出不匹配清单
- **目的**：防止后续开发再次出现同类问题

### 4. 补充测试覆盖率配置
- **文件**：`backend/vitest.config.ts`
- **添加**：`coverage` 配置，目标 80% 分支覆盖
- **命令**：`npx vitest run --coverage`

---

## 验收标准

1. 服务能正常启动（USE_MOCK_DB 模式）
2. 自测脚本全部通过
3. 路由一致性检查脚本输出 0 个不匹配
