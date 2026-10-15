# 回执 · S3-185（批 B4）清账四项 ＋ 官网「免费注册试用」直达注册页

- 派单编号：**S3-185**（批 B4，收口总清单第 **11、15** 项）
- 汇报对象：凌舟（总负责人）
- 汇报人：**阿坚（后端 + 前端）**｜2026-10-13
- 工作区：`D:\Users\ZXQL\wt-agents\S3-185`｜分支 `chore/b4-cleanup-and-register-link`｜基线 `origin/main` = `686e2f10`
- 合并提示：作业期间主仓 `main` 前进到 `da022e5e`（只改 `docs/tasks/当前批次.md`），与本单两个代码文件零重叠；`origin/main` 仍为 `686e2f10`
- 十项完整版回传卡：`docs/tasks/cards/R101-S3-185-阿坚-回传.md`（本仓）＋ 工作树内同路径副本
- 证据包：工作树 `docs/evidence/S3-185/`（01–09，全部为原始输出）

## 一、结论摘要

| 卡面项 | 定性 | 处置 |
|:--|:--|:--|
| ① 官网「免费注册试用」落到登录页（第 15 项） | **成立** | **已修**：`website/src/views/HomeView.vue` 的 18/31/107 三处 CTA → `https://admin.onepan.cn/register`（页脚「工作台」127 保持不动） |
| ② 平台端点无角色粒度（第 11 项④） | **成立** | **落地 0 处、登记 105 条**：机制缺失（`requirePermission` 属租户域，平台 JWT 无 `roles`；平台权限矩阵无运行期消费者；`t_platform_admin` 无 role 绑定）⇒ 无「可确证不 403」的一批，按卡面「只登记不硬塞」执行 |
| ③ `saas-admin/src/api.ts` 死导出（第 11 项①） | **成立** | **已修**：删 **17** 个（双零证据）留 **122** 个，`npm --workspace saas-admin run build` EXIT=0 |
| ④ 旧客户端 401 不清 store（第 11 项②） | **成立（唯一位于 `saas-admin/src/api.ts`）** | **已修**：401 分支改走 `useAuthStore().logout()`（清 token / CSRF / 用户态）后跳 `#/login` |
| ⑤ `LibraryImport` 演示数据混入真实页（第 11 项③） | **不成立** | **结项不改**：`sample1/sample2` 仅存在于 `downloadTemplate()`，是「下载导入模板」的示例行，红线①明令不得误删 |

## 二、改了哪些文件

1. `saas-admin/src/api.ts` —— ① 删 17 个死导出（`getTenantDetail` / `createTenant` / `updateTenant` / `changeTenantStatus` / `getTenantModules` / `updateTenantModules` / `fetchDbStatus` / `fetchApiStats` / `fetchExpiringTenants` / `notifyExpiringTenants` / `getAnnouncements` / `getAnnouncementDetail` / `createAnnouncement` / `updateAnnouncement` / `deleteAnnouncement` / `noteSupportTicket` / `getAgent`）；② 401 分支从「只删 `platform_token`」改为 `useAuthStore().logout()`（新增 `import { useAuthStore } from "./stores/auth"`）。
2. `website/src/views/HomeView.vue` —— 3 处注册/试用 CTA 直达 `/register`。
3. `docs/tasks/cards/R101-S3-185-阿坚-回传.md` ＋ `docs/evidence/S3-185/{01..09}` —— 本单回传与证据包（均在工作树内提交；回传卡同时抄送主仓）。

## 三、证据（可复跑，原始输出见 `docs/evidence/S3-185/`）

| 验收项 | 结果 |
|:--|:--|
| `cd backend && npx vitest run` | **EXIT=0**：`Test Files 644 passed (644)` / `Tests 7631 passed (7631)` |
| `cd backend && npx tsc -p tsconfig.json --noEmit` | **EXIT=0** |
| `npm --workspace saas-admin run build`（动了 saas-admin） | **EXIT=0** |
| `npm --workspace website run build`（动了官网） | **EXIT=0** |
| `node backend/scripts/guard-route-auth.mjs` / `guard-tenant-status.mjs` | 均 **EXIT=0**（G3 189 文件通过 / G2 通过） |
| ① URL 证据 | `https://admin.onepan.cn/register` ⇒ **HTTP 200**；部署态 `index-UWGJzoON.js` 引用的 `RegisterView-CsuUquu0.js` 含 `注册商户账号` / `注册申请已提交`（**真**） |
| ② 清单 | 29 文件 / **105** 写端点逐条清单 + 六条机制缺失证据 + 项目既有裁定（`platform-ticket.service.ts:29-33`：「无 admin↔role 绑定表…写『永远放行的权限校验』即为假校验」） |
| ③ 死导出 | 导出 139 → 122；删除后 `rg` 复查无残留调用点 |
| ④ 四端 401 分支逐条比对 | admin-web ✅ / saas-admin 新客户端 ✅ / `ai-config.ts` ✅ / miniapp ✅ / **`saas-admin/src/api.ts` ❌（本单已修）** |
| ⚠️ 既有红项（与本单无关） | `node saas-admin/scripts/check-api-paths.mjs` **EXIT=1**：`GET /platform/tenants/{p}/users`（`api/tenant.ts:88`）——在未含本单改动的主仓 `686e2f10` 复跑同样 EXIT=1、同一条 ⇒ 既有项，未改 |

## 四、阻塞点

1. ② **不可落地**（非未完成）：缺三样前置——`t_platform_admin` 的角色绑定字段、平台侧端点权限中间件、6 个域缺失的端点级码；三者皆越出本单红线（不得新增权限码 / 不得改迁移）。**请凌舟裁定是否另立单**。
2. **本单改动未部署 ⇒ 401 修复未在生产验证**；`/register` 的线上可达性为只读 GET 实测（200）。
3. **未更新 `docs/tasks/current-tasks.md`**：该文件在主仓有凌舟未提交改动，且按 `docs/项目规则.md` §四属凌舟维护；近期同类卡（S3-115 / S3-183 / S3-184）同口径未动。若需执行方补轮次条目请给口径。
4. **未 push、未开 PR**（红线④）。

## 五、需凌舟裁定（三条，详见回传卡 §八）

1. `HomeView.vue:18/:31` 两处「免费试用」我按同缺陷一并改了（卡面只点名 `:107`）——保留还是回退？
2. `app-mobile` 401 只清 token/用户态/租户、未清 CSRF 与内存态：**未改**（改则须连同「401 过期 ≠ 退出凭证」的口径一起定），是否单独立项？
3. `check-api-paths` 既有红项（租户用户列表端点后端未实现）：是否并入下一单？
