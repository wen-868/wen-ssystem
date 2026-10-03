# C7 端级验收 · DoD#2「接口闭环」审计记录（阶段一 · 总平台 `saas-admin`）

> 审计时间：2026-10-03｜审计基线：`main` = `8c2e7daf8d`（凌舟本机工作区）｜执行：凌舟（本地只读子代理代取，凌舟逐条复核）
>
> **口径**：本记录只证明**端点注册存在性**；**运行期"有响应"由 C7 冒烟环节覆盖**（生产端到端，见 DoD#7）。

## 一、方法（可复跑）

1. 先实读前端请求层前缀口径：`saas-admin/src/utils/request.ts:8` `baseURL = '/api'`；`saas-admin/src/api.ts:9-17` `resolveApiBase()`（默认 `/api`）。
2. 扫 `saas-admin/src` 内对 request/api 客户端的调用首个字符串参数，得到调用点；排除 Vue Router 页面路由与静态资源路径。
3. 逐条到 `backend/src/routes/*.routes.ts`（含 `backend/src/shared/auto-routes.ts` 的前缀机制）比对注册出处；动态段按 `/:id` 语义匹配。
4. 拿不到证据的**不推测**，单列 `❓`；前端调用点存在而后端全仓 0 命中的单列 `❌`。

## 二、汇总（基线 `8c2e7daf8d`）

| 项 | 数字 |
|:--|:--|
| 调用点（含 2 处 `fetch` 上报） | 245 |
| 去重（方法 + 路径） | **229** |
| ✅ 本仓后端已注册 | **204** |
| ❓ 本仓取不到（走 AI 底座） | **24** |
| ❌ 前端调用点存在、后端 0 命中 | **1** |

## 三、❌ 明细与裁定（1 条）

| 前端 | 事实 | 凌舟裁定 |
|:--|:--|:--|
| `GET /api/platform/tenants/statistics/overview`<br>封装 `saas-admin/src/api.ts:400 getTenantStatistics()` | ① 全端**只有定义、0 处视图调用**（`rg -n "getTenantStatistics" saas-admin/src` 仅命中定义行）；② 后端 `rg -n "tenants/statistics/overview" backend/src` **0 命中**；③ 同语义能力存在但前缀不同：`backend/src/routes/saas-tenant.routes.ts:22`、`saas-subscription.routes.ts:22` 的 `/api/saas/.../statistics/overview` | **移除该死导出**（按 DoD#2"产品裁定不做并从前端移除入口"）。理由：0 调用点 + 同语义已由 `/api/saas/tenants/statistics/overview` 提供，日后要用直接接该路径。落地单：**C6-6** |

## 四、❓ 明细与复核结论（24 条）——**不是缺失，是架构上走 AI 底座**

24 条全部来自 `saas-admin/src/api/ai-config.ts:276-458` 的独立实例 `aiRequest`（`ai-config.ts:70`），baseURL 指向 **AI 底座**（不是本仓 8080）。凌舟已在 AI 底座仓 `D:\Users\ZXQL\ZXQL-AI` 逐组复核注册出处：

| 前端路径组 | AI 底座注册出处（已复核） |
|:--|:--|
| `/admin/ai-config/platform`、`/tenants`、`/tenants/:id`、`/usage`、`/billing`、`/billing/:id` | `src/gateway/ai-config.controller.ts:45`（`@Controller('admin/ai-config')`）+ 同文件 `:54/:64/:76/:94/:104/:119/:135/:153` |
| `/admin/ai-config/external-models*` | `src/gateway/external-model.controller.ts` |
| `/admin/ltm*` | `src/gateway/ltm.controller.ts:5-7` |
| `/admin/learning`、`/learning/hints` | `src/gateway/learning.controller.ts:15`（`@Controller('admin/learning')`）+ `:26/:32` |
| `/admin/evolution`、`/:id/approve｜reject｜rollout｜rollback` | `src/gateway/evolution.controller.ts:29`（`@Controller('admin/evolution')`）+ 同文件 `:5-10` 端点清单 |

⇒ ❓24 的**存在性成立**（跨仓），**运行期响应**并入 C7 冒烟（生产真令牌）。

## 五、两处命名不一致（信息项，供后续裁定；本单不处理）

1. `/api/platform/tenants`（`backend/src/routes/platform-tenant.routes.ts:52`）vs `/api/platform/tenants-management`（`backend/src/routes/tenant.routes.ts:16`）。
2. 主干 AI `/api/platform/ai/*`（`backend/src/routes/ai-platform.routes.ts:29`）vs AI 底座 `/api/admin/ai-config/*`。

两者都在"能跑通"的前提下并存，属历史命名分叉；**不在阶段一收尾范围内整改**（整改属重命名风险，另立卡评估）。

## 六、本记录的边界（不许被拔高使用）

- 只证明**注册存在性**；**不证明**该端点在任何环境有正确响应 —— 后者由 C7 的生产冒烟与带令牌实测覆盖。
- 前端调用点的"是否真被用户路径触发"（是否有死入口）**未逐条判定**，只对已发现的 1 条死导出做了裁定。
- 审计在只读沙箱内完成，**未连服务、未连库**；子代理被拒的唯一一次写盘是它的报告文件（已由凌舟落为本记录）。
