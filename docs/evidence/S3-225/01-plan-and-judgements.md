# S3-225 · 员工 / 账号域（7 文件 / 31 写端点）接线判定留档

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**｜单号：**S3-225**（第 43 项 · B2 批 7）
> 工作树：`D:\Users\ZXQL\wt-agents\S3-225`｜分支：`feat/s3-225-staff-domain-wiring`｜基线：`origin/main` = `2b4a0e16`
> 台账处：`docs/tasks/R101-RBAC接线缺口清单.md` §十五｜机读台账：`backend/scripts/rbac-wiring-baseline.json`（501 / 134）

## 一、方法与可复跑命令（先判后接，不猜）

| # | 步骤 | 命令（仓库根） | 产物 |
|--:|:--|:--|:--|
| 1 | 机械清单（接线前） | `node backend/scripts/guard-rbac-wiring.mjs` / `--json` / `--strict` | `10-guard-before.txt` / `01-guard-json-before.json` / `11-guard-strict-before.txt` |
| 2 | 前端调用面清点 | `node docs/evidence/S3-225/tools/callers.mjs` | `02-callers.txt` |
| 3 | 三道既有锁定名单命中检查 | `Select-String` 逐条 grep（见文件内命令） | `03-locks-check.txt` |
| 4 | 落地码持有角色复算 | `node backend/scripts/guard-rbac-wiring.mjs --holders <码>` | `04-holders.txt` |
| 5 | 接线后机械清单 | 同 1 | `12-guard-after.txt` / `13-guard-json-after.json` / `14-guard-strict-after.txt` |
| 6 | 两侧 + 判据反测 | 见 §四 | `23/25/27-*`、`24/26/27-*-red.txt` |
| 7 | 回归与门禁 | 见 §五 | `13-vitest-full.txt`、`15-tsc.txt`、`17-lint.txt`、`16-build.txt`、`79-other-guards.txt` |

**判定口径（逐条与派单卡 §二 对齐）**：

1. 「该不该要权限」= 台账 §三.1 的判定列；「挂哪个码」= **该端点真实使用者已持有的最细现成码**（079 既有码），
   不新立码、不改角色种子、不动迁移；
2. 真实使用者 = 前端调用点（`.vue` / api 模块，文件:行）→ 页面 `meta.roles`（admin-web，fail-closed）
   或移动端入口可达性（app-mobile）；**页面角色集不可枚举者一律不接**（B 类）；
3. 自服务端点（本人数据/本人会话）**不套管理面码**（S3-203 `trace:*` 教训）；
4. 查询型 POST 不按写端点接；
5. 台账判「管理面」但真实用途为「本人数据」的端点，**不接并报备**（本域 1 条）。

## 二、31 行逐条判定（结论 + 判据）

| # | 文件 | 端点 | 判定 | 结论 | 判据（调用点 / 入口） |
|--:|:--|:--|:--|:--|:--|
| 1 | admin-staff | `POST /api/admin/staff` | 管理面 | **不接 · B 类** | admin-web `EmployeesView.vue:311`/`OrganizationView.vue:369`（均 SUPER_ADMIN）**＋** app-mobile `employees.vue:132` |
| 2 | admin-staff | `PUT /api/admin/staff/:id` | 管理面 | **不接 · B 类** | 同上（`EmployeesView.vue:303`/`OrganizationView.vue:366` ＋ `employees.vue:159`） |
| 3 | admin-staff | `PUT /api/admin/staff/:id/status` | 管理面 | **已接 `system:user:edit`** | `EmployeesView.vue:340`、`OrganizationView.vue:385`（无移动端调用点） |
| 4 | admin-staff | `PUT /api/admin/staff/:id/disable` | 管理面 | **不接 · B 类** | 仅 app-mobile `employees.vue:179`（`employees.ts:54`） |
| 5 | admin-staff | `POST /api/admin/staff/:id/restore` | 管理面 | **不接 · B 类** | 仅 app-mobile `employees.vue:187`（`employees.ts:56`） |
| 6 | data-permission | `POST /api/admin/data-permissions/` | 管理面 | **已接 `system:role:create`** | 全仓 0 调用点 |
| 7 | data-permission | `PUT /api/admin/data-permissions/:id` | 管理面 | **已接 `system:role:edit`** | 全仓 0 调用点 |
| 8 | data-permission | `DELETE /api/admin/data-permissions/:id` | 管理面 | **已接 `system:role:edit`** | 全仓 0 调用点 |
| 9 | data-permission | `POST /api/admin/data-permissions/roles/:roleId` | 管理面 | **已接 `system:role:create`** | 全仓 0 调用点 |
| 10 | data-permission | `DELETE /api/admin/data-permissions/roles/:roleId/:dataPermissionId` | 管理面 | **已接 `system:role:edit`** | 全仓 0 调用点 |
| 11 | data-permission | `POST /api/admin/data-permissions/users/:userId/check` | 管理面 | **不接 · 查询型 POST** | 只读判定（派单卡 §二.4） |
| 12 | department | `POST /api/department/` | 管理面 | **不接 · 需新立码** | 079 无部门域码；`DepartmentManage.vue:289` |
| 13 | department | `PUT /api/department/:id` | 管理面 | **不接 · 需新立码** | `DepartmentManage.vue:286` |
| 14 | department | `DELETE /api/department/:id` | 管理面 | **不接 · 需新立码** | `DepartmentManage.vue:264` |
| 15 | department | `PUT /api/department/:id/move` | 管理面 | **不接 · 需新立码** | 全仓 0 调用点 |
| 16 | rbac | `POST /api/admin/system/roles/` | 管理面 | **不接 · B 类** | `SystemRoles.vue:600`（SUPER_ADMIN）**＋** app-mobile `role-edit.vue:227` |
| 17 | rbac | `PUT /api/admin/system/roles/:id` | 管理面 | **不接 · B 类** | 同上（`SystemRoles.vue:589` ＋ `role-edit.vue:225`） |
| 18 | rbac | `DELETE /api/admin/system/roles/:id` | 管理面 | **不接 · B 类** | 同上（`SystemRoles.vue:623` ＋ `roles.vue:116`） |
| 19 | rbac | `PUT /api/admin/system/roles/:id/data-permissions` | 管理面 | **已接 `system:role:edit`** | `SystemRoles.vue:596/608`（无移动端调用点） |
| 20 | rbac | `PUT /api/admin/system/roles/users/:userId/roles` | 管理面 | **已接 `system:role:edit`** | `SystemRoles.vue:650`（移动端 `roles.ts:86` 零引用） |
| 21 | sys-user | `POST /api/admin/sys-users/` | 管理面 | **已接 `system:user:create`** | 全仓 0 调用点 |
| 22 | sys-user | `PUT /api/admin/sys-users/:id` | 管理面 | **不接 · 自服务实际用途** | 唯一调用点 app-mobile `edit.vue:180`（传本人 id） |
| 23 | sys-user | `POST /api/admin/sys-users/:id/reset-password` | 管理面 | **已接 `system:user:edit`** | `EmployeesView.vue:363`、`OrganizationView.vue:405` |
| 24 | sys-user | `DELETE /api/admin/sys-users/:id` | 管理面 | **已接 `system:user:edit`** | 全仓 0 调用点 |
| 25 | admin-auth | `PUT /api/admin/auth/settings` | 自服务 | **不接 · 自服务** | 本人设置；0 调用点 |
| 26 | admin-auth | `POST /api/admin/auth/change-password` | 自服务 | **不接 · 自服务** | `auth.ts:110`、`profile.ts:30` |
| 27 | admin-auth | `POST /api/admin/auth/mfa/setup` | 自服务 | **不接 · 自服务** | `auth.ts:130` |
| 28 | admin-auth | `POST /api/admin/auth/mfa/confirm` | 自服务 | **不接 · 自服务** | `auth.ts:135` |
| 29 | admin-auth | `POST /api/admin/auth/mfa/disable` | 自服务 | **不接 · 自服务** | `auth.ts:140` |
| 30 | user-session | `DELETE /api/user-session/:id` | 自服务 | **不接 · 自服务** | 0 调用点（前端打 `/admin/sessions/:id`） |
| 31 | user-session | `DELETE /api/user-session/user/:userId` | 自服务 | **不接 · 自服务** | 0 调用点（语义偏管理面 ⇒ 待裁定） |

**合计**：已接 **11**；不接 **20**（B 类 7 / 自服务 7 / 自服务实际用途 1 / 查询型 POST 1 / 需新立码 4）。

## 三、零回归论证（每个码逐条；本域涉账号安全，故逐条列出）

| 落地码 | 生产持有角色（`--holders` × 生产底稿） | 页面/按钮使用者 | 结论 |
|:--|:--|:--|:--|
| `system:user:create` | SUPER_ADMIN、OPERATION_ADMIN（生产无角色显式持 `system:*`，二者持 `*`） | 无页面（0 调用点） | ⊇ 空集 ⇒ 零回归 |
| `system:user:edit` | 同上 | `employees`/`organization` 页均 `meta.roles = [SUPER_ADMIN]` | ⊇ {SUPER_ADMIN} ⇒ 零回归 |
| `system:role:create` | 同上 | 无页面（0 调用点） | ⊇ 空集 ⇒ 零回归 |
| `system:role:edit` | 同上 | `system/roles` 页 `meta.roles = [SUPER_ADMIN]` | ⊇ {SUPER_ADMIN} ⇒ 零回归 |

**为什么「持有者只有 `*` 角色」不算越权收紧**：这四条码本来就是 079 的「用户管理 / 角色管理」按钮码，
生产的用户/角色管理功能本就只有超管与运营管理员在管（页面 `meta.roles` 同口径）；本批只是把这些端点
从「任何登录用户可调」收紧到「按页面真实使用者」——与 G0/G1/G2 各批的既定口径一致。

## 四、反测（门禁铁律：故意制造失败证明它会红）

见台账 §十五.5 与 `23-neg-A-strict.txt` / `24-neg-A-vitest-red.txt` / `25-neg-B-strict.txt` /
`26-neg-B-vitest-red.txt` / `27-neg-C-zero-regression-red.txt` / `raw/30-hash-before-neg.txt` /
`raw/31-hash-after-neg.txt`（复原：7 文件 SHA256 **0 处不一致**）。

## 五、回归与其余门禁（原始输出）

- 全量 `npx vitest run`（backend）⇒ `13-vitest-full.txt`；
- `npx tsc --noEmit` ⇒ `15-tsc.txt`；backend `npm run lint` ⇒ `17-lint.txt`；根 `npm run build` ⇒ `16-build.txt`；
- 其余 6 条门禁（route-auth / tenant-status / tenant-injection / evidence-secrets / route-prefix / utf8）⇒ `79-other-guards.txt`。

## 六、卡外观察

见台账 §十五.7（5 条；只登记不动手）。
