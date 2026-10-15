# ACTIVE 回执 · S3-193（平台侧权限机制立项：权限点目录 ＋ requirePlatformPermission ＋ 105 端点台账 ＋ 试点域）

【汇报 S3-193】机制已落地并完成试点域接线（短信/邮件配置域 4 个写端点）；105 条台账逐条登记、计数守恒；反测两侧齐 + 摘中间件变红；门禁三绿（根 npm run build 为**存量红**，见 §四）
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 权限）｜2026-10-14
交付物：
1. `backend/src/middleware/platform-rbac.ts`（**新增**：平台权限中间件 + 端点级权限码总表 + 判定函数 + 拒绝审计；**未提交 / 未 push**，工作树 `D:\Users\ZXQL\wt-agents\S3-193`、分支 `feat/s3-193-platform-rbac`、基线 `25728007`）
2. `backend/src/routes/platform-msg-config.routes.ts`（**改**：4 个写端点挂 `requirePlatformPermission("sysconfig:manage")`）
3. `docs/tasks/R101-平台RBAC接线台账.md`（**新增**：105 条逐条清单 + 按域汇总 + 豁免理由 + 与 S3-185 的口径差异）
4. `backend/scripts/s3-193-platform-rbac-ledger.mjs`（**新增**：台账生成器；`--check` / `--json` 可复跑）
5. `backend/src/__tests__/middleware/platform-rbac.test.ts`、`backend/src/__tests__/routes/platform-rbac-pilot.test.ts`（**新增**：19 个用例）
6. `backend/scripts/guard-rbac-wiring.mjs`（**改**：判据识别平台机制）、`backend/scripts/rbac-wiring-baseline.json`（**改**：试点 4 条移出台账，709→705）
7. 证据：`docs/evidence/S3-193/`（8 组原始输出，逐条可复跑）
证据（可复跑）：见 §五 证据清单（命令 + 原始输出 + 行号 / 文件路径 + 退出码）
验收自评：4 项判据逐条对照见 §三（3 项通过，1 项含**存量红**，见 §四）
未完成与阻塞：
- 未做：**生产库只读复核**（本机无 DB 连接串——`ops-credentials/production-credentials.md` 只登记账号口令；`mysql` 客户端未安装）⇒ §一.1 的生产事实引用凌舟既有只读探针记录，非本单实测；SQL 已在 §一.1 给出，可在服务器侧复跑。
- 未做：**独立绑定表**（多角色 / 管理员级绑定）与**目录外 4 域扩目录**——两者都会改既有契约（迁移编号快照 / 目录「18 条 8 域」的既有断言），按卡面「设计经凌舟批准后再写码」的次序留给裁定，见 §一.5。
- 阻塞：无（上述为待裁定项，不阻塞本单交付）。
风险与自我报备：
1. **我把"未绑定管理员"定为 403（收紧）**，这不是卡面给出的唯一口径：卡面只写了"SUPER_ADMIN 视为全通"。我的理由＝生产影响面为 0（生产仅 1 个管理员且 role=`PLATFORM_SUPER_ADMIN`），而"未绑定即放行"会让试点域门禁对存量账号形同虚设。若裁定相反，改动集中在 `platform-rbac.ts` 一处分支，可单点回退。
2. **绑定方式用了既有列**（`lower(t_platform_admin.role)` = `t_platform_role.code`）⇒ 一个管理员当前只能绑一个平台角色；且该列同时承担管理端列表/筛选的显示职责。若裁定改用独立绑定表，我出纯 DDL 迁移（零预置数据），需同步 `EXPECTED_MAX_MIGRATION` 198→199 与变更清单。
3. **我改了门禁脚本 `guard-rbac-wiring.mjs` 的判据**（新增识别 `requirePlatformPermission(`）。不改则平台域接线后仍被判"无权限检查"，台账失真。影响面已实测：全仓 762 个写端点中受影响**仅 4 条**（已接线 53→57、缺口 709→705），反测见 §五-05。
4. **未改 `docs/tasks/inbox/ACTIVE.md`**（该文件当前是 5 个并行单的路由表，我改会与其它会话冲突）⇒ 请凌舟收单后删掉 S3-193 行。
5. **未提交、未 push**（遵守 ACTIVE.md 红线：只动自己的工作树与本分支）。
6. 卡面 §二.2 的示例命名 `platform:tenant:manage` **未采纳**，改用目录既有规范 `<moduleCode>:<action>`（`sysconfig:manage`）——理由见台账 §五（避免同一个域出现两种写法）。这是我替既有规范做的选择，请核对。
回传要求：本汇报已落卡：`docs/tasks/cards/R101-S3-193-阿坚-回传.md`（另存 `docs/tasks/inbox/ACTIVE-回执-S3-193.md`）
关联卡：`docs/tasks/inbox/archive/ACTIVE-S3-193-20261014.md`（已归档的派单卡）

---

## 一、第一段交付 · 机制设计（先设计、后落码）

### 一.1 平台管理员身份与权限的**数据来源**（逐条核实，含表名 / 列名 / SQL）

| 事实 | 依据（文件:行） |
|:--|:--|
| 平台管理员账号表 = `t_platform_admin`（无 `tenant_id`，平台级） | `docs/migrations/080_平台管理员.sql:1-36`（建表）、`docs/migrations/081_platform_admin_seed_and_fix.sql:45-57`（种子）、`docs/migrations/153_select_columns_fill.sql:26-27`（补 `ip_address`/`module`）、`docs/migrations/196_平台管理员MFA.sql`（补 `mfa_secret`/`mfa_enabled`） |
| 该表**已有**粗粒度角色列 `role`：`VARCHAR(32) NOT NULL DEFAULT 'PLATFORM_ADMIN'`，注释写 `PLATFORM_ADMIN / PLATFORM_SUPER_ADMIN` | `docs/migrations/080_平台管理员.sql:17`、`docs/migrations/081_platform_admin_seed_and_fix.sql:20` |
| 生产种子行 = `admin`，`role = 'PLATFORM_SUPER_ADMIN'` | `docs/migrations/081_platform_admin_seed_and_fix.sql:45-56` |
| 服务层另有第二套写法（`SUPER_ADMIN / ADMIN / SUPPORT`） | `backend/src/services/platform/admin-account.service.ts:16-22`；前端同口径 `saas-admin/src/views/platform/AdminPermissions.vue:274-278` ⇒ **两套并存，本机制"全通"集合两套都收** |
| 平台角色表（维度结构**已存在**）：`t_platform_role`（`code` 唯一、`type` builtin/custom、`enabled`） | `docs/migrations/179_平台角色与权限点目录.sql:1-13` |
| 角色 × 功能域权限矩阵：`t_platform_role_permission`（`module_code` + `can_menu` + `can_page_btn` + `data_scope`，`uk_role_module`） | `docs/migrations/179_平台角色与权限点目录.sql:14-25` |
| 权限点目录 = **代码常量** `PERMISSION_CATALOG`（18 条 / 8 个 `moduleCode`：tenant·billing·sysconfig·monitor·ticket·marketing·ai + common）；表 `t_platform_permission_catalog` **本期未启用**（MIG-4 写闸门默认 block ⇒ 迁移里的预置 INSERT 不落库） | `backend/src/services/platform/platform-role.service.ts:132-152`、`docs/migrations/179_平台角色与权限点目录.sql:60-75` |
| **管理员 ↔ 平台角色 的绑定不存在**（无绑定表；`role` 列只有粗粒度取值；生产 `t_platform_role` = 0 行） | 全仓 `rg 't_platform_role' backend/src` 无绑定表引用；生产只读探针记录 `docs/tasks/R101-总进度与推进计划.md:2059`（`t_platform_admin`=1 / `t_platform_role`=0） |
| 登录链路：`login()` → `issueLoginResult()` → `signPlatformToken({ id, username, realName, type: "platform_admin" })` ⇒ **JWT 不含 `roles` / `role`** | `backend/src/services/platform/platform-auth.service.ts:186-205`、`backend/src/middleware/auth.ts:106-115` |
| 故租户侧 `requirePermission`（读 `user.roles` → `t_sys_role.permissions`）**在平台域不可复用**：`user.roles` 为 undefined ⇒ 直接抛错 | `backend/src/middleware/rbac-auth.ts:6-24` |
| 平台侧原唯一鉴权 = `requirePlatformAuth`，只校验 JWT `type === "platform_admin"` | `backend/src/middleware/auth.ts:151-176` |

**本机制实际执行的 3 条 SQL**（原始输出见 `docs/evidence/S3-193/04b-机制与试点域用例.log`：19 个用例逐条打在这 3 条上）：

```sql
-- ① 该管理员的粗粒度角色（判超管全通 / 取绑定码）
SELECT role FROM t_platform_admin WHERE id = ?;
-- ② 绑定的平台角色（enabled=1 才认；不存在 ⇒ 未配置）
SELECT id, code FROM t_platform_role WHERE code = ? AND enabled = 1;
-- ③ 该角色在该功能域上的三级位
SELECT can_menu AS canMenu, can_page_btn AS canPageBtn
  FROM t_platform_role_permission WHERE role_id = ? AND module_code = ?;
```

> ⚠️ **生产库直连未做**：本机只有账号/口令登记（无 DB 连接串），也未安装 `mysql` 客户端 ⇒ 生产事实引用凌舟既有只读探针（上表倒数第 3 行），**不是本单实测**；如需生产 `SHOW COLUMNS` / `SELECT` 原始输出，请在服务器侧复跑上面 3 条（均为只读，零写）。

### 一.2 权限点命名与粒度（完整目录）

**命名规范**：`<moduleCode>:<action>`（与目录既有 18 条完全同规范，例：`tenant:view` / `ticket:reply`）。

| 层 | 码 | 级别 | 是否已存在 | 判据位 |
|:--|:--|:--|:--|:--|
| 读 | `tenant:view` / `billing:view` / `sysconfig:view` / `monitor:view` / `ticket:view` / `marketing:view` / `ai:view` | MENU | ✅ 已在目录（7 条） | `can_menu = 1` |
| 写（新增） | `tenant:manage` / `billing:manage` / `sysconfig:manage` / `monitor:manage` / `marketing:manage` | BUTTON（写） | ❌ 本单新增（5 条，域在目录内 ⇒ 立即可用） | `can_page_btn = 1` |
| 写（新增，**需先扩目录**） | `library:manage` / `open:manage` / `review:manage` / `miniapp:manage` | BUTTON（写） | ❌ 本单新增（4 条，域**不在**目录 8 个 moduleCode 内 ⇒ 矩阵存不下，属裁定项） | 同上 |
| 工单域 | `ticket:reply` / `ticket:note` / `ticket:transfer` / `ticket:resolve` / `ticket:close` | BUTTON | ✅ 已在目录 | `can_page_btn = 1` |
| 数据范围 | `scope:all` / `scope:gray-group` / `scope:follow-group` / `scope:billing-all` | DATA | ✅ 已在目录 | `data_scope` 列 |

**为什么不是"按端点数 1:1 建码"**：105 条里同域同语义的 CRUD 极多（商品库 15、开放平台 10、App 版本 7、模板 5…）。若按端点建 105 个码：
① 角色矩阵会碎片化到无法配置（每个角色要勾 105 格）；② 与迁移 179 的矩阵结构（`module_code` 粒度）错位，等于再造一套并行机制；③ 新端点一出现就要新建码，落地成本高于收益。
故取「**功能域 × 读写**」两级，与既有矩阵 `can_menu` / `can_page_btn` 一一对应。

### 一.3 中间件语义（`requirePlatformPermission(code)`）

1. **挂载位置**：必须在 `requirePlatformAuth` 之后。平台路由由 `routeConfig.auth="requirePlatformAuth"` 声明式挂载（`auto-routes.getAuthMiddlewares` 同时挂 `csrfMiddleware`），本中间件**在端点内联**挂在两者之后；用例 ⑧ 实测"缺 CSRF ⇒ 403 CSRF"先于权限判定发生（顺序未被颠倒）。
2. **缺码返回**：**403**（不是 401）。响应体沿用统一 `fail(msg, "403")`，文案含所需权限码；401 只留给"没有平台身份"（由 `requirePlatformAuth` 负责）。
3. **审计留痕**：每次拒绝写 `t_platform_audit_log`（表见 `docs/migrations/080_平台管理员.sql:24-36` + 153 补列）：`action='PERMISSION_DENIED'`、`module=<权限域>`、`detail={permCode, level, reason, roleCode, method, path}`、`admin_id` / `admin_name` / `ip` 一并落库；留痕失败只记 `logger.warn`，**不改变 403 响应**（用例 ⑦ 实测：留痕抛错时仍返回 403）。
4. **判定优先级**：① `role ∈ {PLATFORM_SUPER_ADMIN, SUPER_ADMIN}` ⇒ 全通；② 绑定角色 + 矩阵命中 ⇒ 放行；③ 未绑定 / 角色未建 / 矩阵未配 / 矩阵未命中 ⇒ 403；④ DB 异常 ⇒ **fail-closed 403**（不回 500，也不静默放行）。

### 一.4 与 `guard-rbac-wiring`（G4）的关系：**平台域已纳入同一门禁 / 同一台账**

- 事实核对（我方实测）：该门禁本就扫描**全部** `backend/src/routes/*.routes.ts`，其基线 `rbac-wiring-baseline.json` 的 709 条缺口里**恰好有 105 条属于平台域**（26 个有写端点的 platform 文件，逐文件计数与台账逐条一致）⇒ 平台域**不需要**另立门禁。
- 但原判据只认 `requirePermission(` ⇒ 平台机制接线后会被继续报成"无权限检查"。**本单已扩展判据**（新增 `PLATFORM_PERM_CALL_RE`，两者任一命中即算已接线），并同步基线：**709 → 705**（试点 4 条移出）、`_counts.endpoints` 同步；受影响的写端点全仓**仅这 4 条**（已接线 53 → 57）。
- 判据边界（写在明处）：仍只看"有没有挂权限中间件"，**不判权限码选得对不对**（码的合理性由本单台账 §二 + 人工复核）；`routeConfig` 声明式不带权限码，平台域因此**必须**在端点内联挂（已实测：摘掉即红，见 §五-05）。

### 一.5 本单**待凌舟裁定**的 3 项（都不阻塞本单交付，改动点集中、可单点回退）

1. **未绑定管理员的过渡期口径**：现取 **403（收紧）**；若要"过渡期放行"，改 `platform-rbac.ts` 的 `no_admin_role` / `role_not_configured` 分支一处即可。
2. **绑定结构**：现复用 `t_platform_admin.role`（小写化）↔ `t_platform_role.code`（零 DDL、一管理员一角色）；若要独立绑定表 `t_platform_admin_role`（多角色），我按纯 DDL 出迁移（需同步 `EXPECTED_MAX_MIGRATION` 198→199 + 变更清单 + 绑定管理界面，属后继单）。
3. **目录外 4 域**（`library` / `open` / `review` / `miniapp`，共 28 条端点）：是否扩 `PERMISSION_CATALOG`（会改"18 条 / 8 域"的既有契约与对应 8 条断言，并与 saas-admin 角色矩阵页联动）。

---

## 二、第二段交付 · 落地

### 二.1 接线台账（105 条，一条不漏）

- 产物：`docs/tasks/R101-平台RBAC接线台账.md`；生成方式：`node backend/scripts/s3-193-platform-rbac-ledger.mjs`（`--check` 只做断言、`--json` 机读）。
- 计数守恒（原始输出，`docs/evidence/S3-193/02-台账生成.log`）：`文件数=29（期望 29） 写端点=105（期望 105）`、`按方法：{"POST":67,"PUT":29,"DELETE":9}`、`已接线=4 待接线=63 需扩目录=28 豁免=10`（4+63+28+10 = 105）。
- **三方同口径**：本台账 105 = S3-185 取证 `02b-platform-write-endpoints.raw.txt` 的 105 = G4 基线里平台域条目 105。
- 与 S3-185 的**两处修正**（逐条可核对，见台账 §四）：`platform-app-version.routes.ts` 的 7 条实际全在 `/api/padmin`（`auth:"none"` 的 `/api/app` 只有 1 个 GET）；`platform-role.routes.ts` 的 4 条实际全在 `/api/platform/roles`。差异只影响路径可读性，不影响总数。

### 二.2 试点域落地（**已接线**）

- 试点域选择：**消息 / 短信配置域（`sysconfig`）**，即卡面建议的"消息/短信配置"之一；范围 = `backend/src/routes/platform-msg-config.routes.ts` 的 **4 个写端点**：`PUT /api/platform/msg-config`、`POST|PUT|DELETE /api/platform/sms-templates[...]`，全部挂 `requirePlatformPermission("sysconfig:manage")`。
- 读端点（2 个 GET）**本单不接**（卡面范围是 105 个写端点；读码 `sysconfig:view` 已在目录内，留待后续批次）——这是刻意的"最小改动"，不是遗漏。
- 不影响既有正确调用：生产唯一管理员 `admin` 的 `role='PLATFORM_SUPER_ADMIN'` ⇒ 走"全通"分支；4 个端点仍先过 `requirePlatformAuth` + `csrfMiddleware`（顺序未变）。

### 二.3 反测（**两侧齐 + 摘中间件变红**，原始输出见 §五-04 / 05）

| 反测 | 期望 | 实测 |
|:--|:--|:--|
| 超管令牌 + CSRF 打 `PUT /api/platform/msg-config` | 200 | **200**（`{code:"0", data:{updated:0}}`） |
| 绑定角色但 `can_page_btn=0`（缺码） | 403 | **403**（`code:"403"`，文案含 `sysconfig:manage`）+ 1 条 `t_platform_audit_log` INSERT |
| 绑定角色且 `can_page_btn=1`（有码） | 200 | **200** |
| 未绑定角色 | 403 | **403**（"未分配平台角色"） |
| 角色存在但矩阵未配该域 | 403 | **403**（"未配置「sysconfig」域权限"） |
| DB 异常 | 403（fail-closed） | **403**（非 500） |
| 无令牌 | 401（既有鉴权未放宽） | **401** |
| 有令牌缺 CSRF | 403 CSRF | **403**（"CSRF token 无效或缺失"） |
| **摘掉 PUT 的权限中间件（反测）** | 判据应变红 | 用例 ③④⑤⑦ **4 failed**（403 断言收到 200）；门禁 `--json` 把该端点标 `hasPermission:false` |
| 复原后 | 全绿 | 9 passed；门禁 4 条全 `true` |

---

## 三、验收判据逐条对照

| 判据 | 结果 | 依据 |
|:--|:--|:--|
| 1. §二.1 数据来源核实（表 / 列 / SQL / 输出） | ✅ 通过（含 1 处如实标注） | §一.1 全表 + 3 条 SQL + 测试原始输出；**生产库直连未做**，已在 §一.1 与 §四 标注 |
| 2. 台账逐条完整 + 计数守恒 | ✅ 通过 | `02-台账生成.log`：29 文件 / 105 条 / 4+63+28+10=105；三方同口径 |
| 3. 试点域反测两侧齐 + 摘中间件变红 | ✅ 通过 | §二.3（证据 `04a` / `04b` / `05a` / `05c` / `05d`） |
| 4. 不放开既有鉴权 + 门禁 | ✅ 通过（**根 `npm run build` 为存量红**） | `guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` 均 **EXIT=0**；`npx vitest run` **654 文件 / 7713 用例 / 0 failed**；`tsc --noEmit` **EXIT=0**；`npm --workspace backend run build` **EXIT=0**；根 `npm run build` **EXIT=1**（存量，见 §四-1） |

---

## 四、未完成、阻塞与存量红点（逐条，不藏）

1. **根 `npm run build` EXIT=1 属存量缺陷，不是本单引入**：失败点是 workspace `miniapp` / `platform-miniapp` **没有 `build` 脚本**（只有 `build:weapp` / `build:h5`）。证据：`docs/evidence/S3-193/06c-root-build.log`；且 `git diff --name-only origin/main -- miniapp platform-miniapp` **为空**（这两棵树与基线逐字一致）⇒ 与我的改动无因果。该项目在本项目里已被登记为待办（派单卡队列"第 62 项（根 build）"）。本单以 `npm --workspace backend run build`（EXIT=0）+ `tsc --noEmit`（0）+ 全量 vitest（0 failed）作为构建验证，并**如实报红**。
2. **`guard-rbac-wiring --strict` EXIT=1 亦属存量**：3 条**未登记**缺口在 `marketing-miniapp.routes.ts`（:55 / :72 / :80），接线前后一致（`docs/evidence/S3-193/07-门禁.log`）；本单只把试点 4 条移出台账，未替它登记。
3. 生产库只读复核未做（无凭据）——见 §一.1 末尾。
4. 其余 101 条平台写端点**按卡面红线 1 未接线**，已逐条进台账；其中 28 条需先扩目录（裁定项）。

---

## 五、证据清单（`docs/evidence/S3-193/`，全部可复跑）

| 文件 | 内容 / 命令 |
|:--|:--|
| `01-现状复核.log` | 29 文件计数、平台域 `requirePermission` 0 命中（EXIT=1）、`requirePlatformAuth` 源码、`signPlatformToken` 载荷、`PERMISSION_CATALOG`、080 / 081 / 179 DDL |
| `02-台账生成.log` / `02b-台账生成-check.log` | `node backend/scripts/s3-193-platform-rbac-ledger.mjs` / `--check`（计数守恒） |
| `04a` / `04b-机制与试点域用例.log` | `npx vitest run src/__tests__/middleware/platform-rbac.test.ts src/__tests__/routes/platform-rbac-pilot.test.ts` ⇒ **19 passed** |
| `05a-反测-摘掉PUT中间件-应变红.log` | 同一用例集 ⇒ **4 failed / 5 passed**（403→200） |
| `05b-反测-摘中间件后-guard-json.log` | `guard-rbac-wiring --json` ⇒ 该端点 `hasPermission:false` |
| `05c-复原后-应变绿.log` / `05d-复原后-guard-json.log` | 9 passed；4 条 `true` |
| `06a-vitest-full.log` | `npx vitest run` ⇒ **654 files / 7713 tests / 0 failed** |
| `06b-tsc-noemit.log` / `06c-root-build.log` / `06d-backend-build.log` | tsc EXIT=0 / 根 build EXIT=1（存量）/ backend build EXIT=0 |
| `07-门禁.log` | `guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` 三绿 + `guard-rbac-wiring` 57 已接线 / 705 缺口 + dist 产物含新中间件 |
| `08-eslint.log` | `npx eslint`（4 个新 / 改文件）⇒ 0 error 0 warning |

## 六、变更文件清单（相对基线 `25728007`）

```
 M backend/scripts/guard-rbac-wiring.mjs            （判据新增平台机制识别）
 M backend/scripts/rbac-wiring-baseline.json        （709→705，试点 4 条移出）
 M backend/src/routes/platform-msg-config.routes.ts （试点域 4 个写端点接线）
?? backend/src/middleware/platform-rbac.ts          （新增 · 机制）
?? backend/src/__tests__/middleware/platform-rbac.test.ts
?? backend/src/__tests__/routes/platform-rbac-pilot.test.ts
?? backend/scripts/s3-193-platform-rbac-ledger.mjs
?? docs/tasks/R101-平台RBAC接线台账.md
?? docs/evidence/S3-193/
```

**未动**：`.github/**`、`deploy/**`、`docs/tasks/R101-收口总清单.md`、任何迁移文件、任何生产库；**未 push、未开 PR**。
