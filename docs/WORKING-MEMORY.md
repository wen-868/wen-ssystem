# 凌舟工作记忆

> 跨会话持久化记忆，避免遗忘关键上下文。每次操作后更新此文件。

---

## 当前状态

- **当前模块**：Bug修复完成（205个编译错误清零，12模块开发完成）
- **下一模块**：无（项目开发完成，进入运维/优化阶段）
- **更新日期**：2026-07-02
- **产品规格**：v6.1（已补充5个已完成模块的完整字段定义，70表/~1070字段/294API）

---

## 阻塞项

| 阻塞 | 详情 | 状态 |
|------|------|:---:|
| 无 | — | — |

---

## 模块进度

| 模块 | 状态 |
|------|:---:|
| 商品中心 | ✅ |
| 销售管理 | ✅ |
| 采购管理 | ✅ |
| 库存管理 | ✅ |
| 客户管理 | ✅ |
| 财务往来 | ✅ |
| 数据报表 | ✅ |
| 营销中心 | ✅ |
| 即时零售 | ✅ |
| 订单管理 | ✅ |
| 系统设置 | ✅ |
| 工作总台 | ✅ |

---

## 团队分工

| 成员 | 职责 | 分支 |
|------|------|------|
| 林夕 | UI/UX 设计稿 (`docs/design/specs/`) | trae/solo-agent-oqrXJp |
| 墨 | 管理后台 admin-web 前端 | trae/solo-agent-4njSbh |
| 阿坚 | 后端 API + DDL | trae/solo-agent-V9uC3J |
| 阿澈 | 商户移动端 merchant-mobile 前端 | trae/solo-agent-tkoXzL |
| 苏然 | 测试工程师 / DAO 层 | trae/solo-agent-4ikMYJ |

---

## 重要架构约定

- **路由注册**：`server.ts` 中 `app.use("/api/admin/xxx", requireAuthWithTenant, xxxRouter)` 模式
- **租户隔离**：所有表含 `tenant_id`，服务层用 `queryWithTenant`/`queryOneWithTenant`
- **认证**：JWT + bcrypt，`requireAuth`/`requireAuthWithTenant` 中间件
- **响应格式**：`{ code: 0, data: ..., message: "ok" }`
- **校验**：zod
- **DDL 位置**：`docs/migrations/`
- **API 基础路径**：admin-web 的 axios baseURL 为 `http://localhost:8080/api`，所以前端 API 路径以 `/admin/xxx` 开头

---

## 安全修复记录（不可回退）

以下安全修复已应用，合并代码时注意不要被覆盖：

1. `.env.production` 已加入 `.gitignore`
2. JWT_SECRET 已移除默认 fallback（`backend/src/shared/env.ts`）
3. `sys_role.status` 类型已改为数字 `1`（`auth.service.ts`）
4. Rate Limiting 已配置（全局 + 登录接口）
5. CORS 白名单已配置（`cors({ origin: allowedOrigins })`）
6. 密码强度校验已添加（`auth.controller.ts`）

---

## Git 合并策略

**禁止直接 merge 分支**，避免带入破坏性改动。正确做法：
1. 从分支提取新文件（`git checkout <branch> -- <path>`）
2. 手动合并修改文件（对比差异，只取目标改动）
3. 验证安全修复未被覆盖
4. 提交并推送 main

---

## 关键文件清单

| 文件 | 用途 |
|------|------|
| `docs/product-spec-v6-adapted.md` | 产品规格（12模块/106子模块/217表） |
| `docs/MEMORY.md` | 团队全局记忆 |
| `docs/WORKING-MEMORY.md` | 本文件，凌舟个人工作记忆 |
| `tasks/tasks-*.md` | 5 人任务文件 |
| `backend/src/server.ts` | 路由注册入口 |
| `backend/src/shared/auth.js` | 认证中间件 |
| `backend/src/shared/db.js` | 数据库工具（含租户隔离函数） |
| `admin-web/src/api.ts` | 管理后台 API 封装 |
| `admin-web/src/router/index.ts` | 管理后台路由 |
| `admin-web/src/layouts/MainLayout.vue` | 管理后台侧边栏菜单 |