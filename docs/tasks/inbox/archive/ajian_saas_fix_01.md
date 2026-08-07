# 任务卡：ajian_saas_fix_01 — saas 总后台接口 404 修复（补 /api/platform/* 平台版端点）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿坚（后端/数据库）
- **优先级**：P0（生产故障：saas.onepan.cn 功能点击报错）
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、故障现象与根因（凌舟已诊断）

**现象**：saas 总后台（saas.onepan.cn，工程 `saas-admin/`）未登录直入（浏览器残留有效 token）+ 多数功能点击报错。后端与 nginx 链路正常（platform login 实测可达）。

**根因（已逐接口比对确认）**：saas-admin 前端按平台语义调用 `/api/platform/*`，但后端把部分**平台级功能错挂在 `/api/admin/*`（requireAuthWithTenant，租户鉴权）**下，或根本没有对应端点，导致 **404**。受影响功能：系统监控、平台看板、错误日志、财务结算（stats）、租户使用统计、AI 配置（已另修）。

## 二、必读文件

1. `docs/tasks/current-tasks.md` 中本任务记录（如已写入）
2. `saas-admin/src/api.ts`、`saas-admin/src/views/monitor/MonitorView.vue`、`views/Dashboard.vue`、`views/ErrorLogs.vue`、`views/Reconciliation.vue`、`views/TenantUsage.vue`（前端调用与期望数据结构）
3. 后端现有实现（尽量复用）：
   - `backend/src/controllers/admin/monitor.controller.ts` + `routes/monitor.routes.ts`（db-status/api-stats/expiring-tenants/notify-expiring，已注册在 /api/admin/monitor）
   - `backend/src/routes/platform-dashboard.routes.ts` + `controllers/platform/dashboard.controller.ts`（已注册 /api/platform/dashboard）
   - `backend/src/routes/error-log.routes.ts` + `controllers/admin/error-log.controller.ts` + `services/admin/error-log.service.ts`
   - `backend/src/routes/admin-tenant-usage.routes.ts` + 对应 controller/service（stats/ranking/trend/module-usage）
   - `backend/src/routes/platform-reconciliation.routes.ts` + `controllers/admin/platform-reconciliation.controller.ts`
   - `backend/src/routes/platform-config.routes.ts`（核对 sys-config 子路径）

## 三、待补端点清单（前端已调用、后端缺失/前缀不符）

| # | saas-admin 调用 | 后端现状 | 修复建议 |
|---|----------------|---------|---------|
| 1 | GET `/api/platform/monitor/db-status` | 仅 /api/admin/monitor/db-status | 平台版复用 getDbStatusCtrl |
| 2 | GET `/api/platform/monitor/api-stats` | 仅 /api/admin/monitor/api-stats | 平台版复用 getApiStatsCtrl |
| 3 | GET `/api/platform/monitor/expiring-tenants` | 仅 /api/admin/monitor/expiring-tenants | 平台版复用 getExpiringTenantsCtrl |
| 4 | POST `/api/platform/monitor/notify-expiring` | 仅 /api/admin/monitor/notify-expiring | 平台版复用 notifyExpiringTenantsCtrl |
| 5 | GET `/api/platform/error-logs` | 仅 /api/admin/error-logs（租户过滤） | 平台版 listErrorLogs（**全租户范围**，核对 service 是否支持无 tenantId，必要时加 platform service/controller） |
| 6 | GET `/api/platform/dashboard/overview` | /api/platform/dashboard 有 GET / | 加 `/overview` 别名或前端改调 `/dashboard`（核对返回结构匹配 Dashboard.vue 期望：monthlyRevenue/recentTenants 等） |
| 7 | GET `/api/platform/reconciliation/stats` | platform-reconciliation 无 /stats | 找到 stats 实现（可能在 controller/service 中）补路由 |
| 8 | GET `/api/platform/tenants/usage-stats` | 仅 /api/admin/tenant-usage/stats | 平台版复用（全租户） |
| 9 | GET `/api/platform/tenants/rank` | 仅 /api/admin/tenant-usage/ranking | 平台版复用（全租户，参数对齐 TenantUsage.vue 的 sortBy） |
| 10 | GET `/api/platform/config/sys-config` | 核对 platform-config 实际子路径 | 对齐或补路由 |

**通用要求**：
- 所有新增平台端点一律 `requirePlatformAuth`（auto-routes 的 routeConfig.auth 或 router.use）
- 数据范围必须是**全租户/平台视角**，不能带 req.tenantId 过滤（平台管理员不是租户用户）
- 返回结构与 saas-admin 页面期望一致（参考各视图的 res.data.records/total 等字段）
- 优先复用现有 controller/service，避免重复实现；必要时新增 platform 版 controller（放 controllers/platform/）

## 四、验证（必做）

1. 后端 `npm run build` + typecheck 通过
2. 本地或服务器实测：用平台管理员 token 调新增端点（如 `POST /api/platform/auth/login` 拿 token → 依次 curl 新端点），全部 200 且数据结构正确
3. 确认 `/api/admin/*` 原有端点不受影响（未删除任何现有路由）
4. 提交推送 origin/main（中文提交信息；push 网络波动重试即可）

## 五、验收标准

- 清单中全部端点可用（平台 token 实测 200）
- saas.onepan.cn 重新部署后：系统监控/平台看板/错误日志/财务结算/租户使用统计页面不再 404，数据正常展示
- current-tasks.md 记录完成情况；任务卡归档

## 六、注意事项

- 全程简体中文（代码注释、commit、最终回复）
- 最小改动：只补缺失端点，不重构现有代码；**禁止改动 app-mobile/、miniapp/、admin-web/**
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识、复述任务关键内容、给出完成结果与验证证据
- 补充背景：saas-admin 的 AI 配置页 localhost:3016 问题凌舟已修（deploy/auto-deploy.sh 注入 VITE_AI_BASE_URL=/ai-api + nginx saas 加 /ai-api 代理），本任务不重复处理
