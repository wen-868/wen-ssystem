# S3-238 · R1 侦察与设计（平台侧权限接线）

> 执行：**阿坚**（总台后端与数据 owner）｜端：**总台**｜日期：**2026-10-17**
> 派单卡：`docs/tasks/inbox/ACTIVE-S3-238.md`｜依据：收口总清单**第 50 项**、S3-231 F2 裁定 1
> 工作树：`D:\Users\ZXQL\wt-agents\S3-238`｜分支：`feat/s3-238-platform-rbac-batch1`｜基线：`origin/main` = **`7ea26e8d`**
> ⚠️ 本文件**不含**「凌舟裁定 / 验收结论」字样；只给事实、读数与设计。
> 本文件为 **R1 设计交付**，对应卡面 §二 R1 的四问；**零业务代码改动**。

---

## 〇、结论先行（一页看完）

平台侧的权限码**存放形态 = 代码常量，不是数据库表**；`t_platform_permission_catalog` 表**已建但本期未启用**（MIG-4 写闸门默认 block ⇒ 迁移里的预置 INSERT 不落库）。
判定中间件 **`requirePlatformPermission(code)` 已经存在**（`backend/src/middleware/platform-rbac.ts`，S3-193 产物），本单**不需要新造中间件**——但存在一个**致命错位**：`tenant:manage` 在中间件常量里有、在目录常量里**没有**，导致"能挂码、授不了权"。
接线门禁 `guard-rbac-wiring.mjs` **已识别** `requirePlatformPermission`（:100 `PLATFORM_PERM_CALL_RE`）⇒ 端点注册的**源码侧证明**已有现成装置，无需另发明。

---

## 一、问题 1：平台侧**码的存放形态**（复用 `t_sys_*` 还是平台自有表）

### 实测（不是猜）

| 观察点 | 实测结果 | 证据 |
|:--|:--|:--|
| 平台侧目录的唯一真相源 | **代码常量** `PERMISSION_CATALOG`（`backend/src/services/platform/platform-role.service.ts:138`，当前 **21 条 / 11 域**） | 本工作树 `git grep -n 'tenant:' -- 该文件` ⇒ 仅 `:139` 一行 `tenant:view` |
| 是否有平台侧权限表在用 | `t_platform_permission_catalog` **已建但本期未启用**：文件头注释明写「MIG-4 写闸门默认 block（`resolveWriteGate()` 只认环境变量 `MIGRATION_WRITE_GATE`），而 `runMigrations()` 由 server.ts 每次启动调用、全仓**无执行账本** ⇒ 迁移里的预置 INSERT **不落库**，放行 allow 又会随每次重启**复利叠加**」 | `platform-role.service.ts:19-22` 文件头注释 |
| 平台角色 / 矩阵表 | `t_platform_role`（迁移 179，平台角色主表）、`t_platform_role_permission`（角色 × 功能域矩阵：`can_menu` / `can_page_btn` / `data_scope`）——**这两张在生产是 0 行**，但**表结构存在** | `docs/evidence/_shared/prod-roles-20261016.txt:42-43`（平台角色表 0 行、角色权限表 0 行）｜`prod-platform-schema-20261016.sql`（列清单探测） |
| 商家侧口径（对照） | 商家侧也不用表存目录：`system-permission-codes.ts:5-9` 明写「**目录走代码常量、迁移只做 DDL**」，且「本仓**不存在** `user-permissions.ts` 里的 `PERMISSION_CATALOG`，平台侧目录在 `platform-role.service.ts:138`」 | `backend/src/shared/system-permission-codes.ts:5-9` |

### 结论

**形态：平台自有代码常量 `PERMISSION_CATALOG` + 平台自有矩阵表 `t_platform_role_permission`；不复用 `t_sys_*`（租户级资产，含 `tenant_id`）。**
这与 S3-232 的商家侧先例同源（目录常量 + 迁移只做 DDL），不是新发明。

**为什么不能改用表**：改表 = 要往 `t_platform_permission_catalog` 写预置行，而写闸门默认 block 且无执行账本 ⇒ 写不进去；放行又会每次重启重复叠加。这是既有裁定（C6-2-T6-F2），**不在本单推翻范围**。

---

## 二、问题 2：`requirePlatformPermission(code)` 与 `requirePermission` 的差异

### 现状：中间件**已存在**（S3-193 产物，本单不新造）

`backend/src/middleware/platform-rbac.ts`（339 行）已提供 `requirePlatformPermission(permCode)`。

### 差异逐条（源码侧可核对）

| 维度 | 商家侧 `requirePermission` | 平台侧 `requirePlatformPermission` |
|:--|:--|:--|
| 身份域 | 租户 JWT（`type` 商家），带 `user.roles` | 平台 JWT（`type=platform_admin`，issuer/aud 独立） |
| 权限来源 | `t_sys_role.permissions`（角色权限串） | `t_platform_admin.role` → `t_platform_role.code` → `t_platform_role_permission` 矩阵 |
| 为什么不能复用 | 平台 JWT **不携带 roles** ⇒ `user.roles` 为 undefined 会**直接抛错**（`platform-rbac.ts:8-9`） | — |
| 超管语义 | 商家超管走 `["*"]` 角色串通配 | `PLATFORM_SUPER_ROLES = ["PLATFORM_SUPER_ADMIN","SUPER_ADMIN"]` **全通**（`:47`、`:199-201`） |
| 读 / 写判据 | — | 读码 `:view` ⇒ 需该域 `can_menu = 1`；写码 `:manage` ⇒ 需 `can_page_btn = 1`（`:239-240`） |
| 失败码 | — | 未绑定 / 角色未建 / 矩阵未配 / **DB 异常** ⇒ 一律 **403（fail-closed）**（`:250-260`） |
| 401 vs 403 | — | 无 `req.user` ⇒ **401**；有用户但授权不过 ⇒ **403**（`:311-314`、`:327`） |
| 403 body 形态 | — | `res.status(403).json(fail(decision.message, "403"))` ⇒ **`{code:"403", msg:"…", traceId, apiCost}`**（`shared/response.ts` 的 `fail()`，字段名是 **`msg`**） |
| 审计留痕 | — | 每次拒绝写 `t_platform_audit_log`（action=`PERMISSION_DENIED`，detail 带 permCode / HTTP 方法 / 路径 / 拒因）（`:264-296`）；留痕失败只记日志，**不改变 403** |

### 挂载位置约束（红线）

必须在 `requirePlatformAuth` **之后**。平台路由由 `routeConfig.auth="requirePlatformAuth"` 声明式挂载（`auto-routes.getAuthMiddlewares` 会一并挂 `csrfMiddleware`），本中间件在**端点内联挂载** ⇒ 结构上必然晚于这两者（`platform-rbac.ts:301-303`）。

---

## 三、问题 3：「端点注册」的**源码侧**证明方式（不能靠 401）

### 为什么 401 不能证明端点存在

`/api/platform/**` 整段挂 `requirePlatformAuth` ⇒ **无令牌一律 401**，与"端点是否注册 / 是否挂了码"**无关**。拿 401 当"端点存在"的证据是**假证据**。

### 现有装置（已能用于本单，无需新造）

| 装置 | 能力 | 证据 |
|:--|:--|:--|
| `backend/scripts/guard-rbac-wiring.mjs` | **已识别**平台侧形态：`:100` `const PLATFORM_PERM_CALL_RE = /\brequirePlatformPermission\s*\(/;`，`:24-26` 注释明写「平台侧同理（S3-193 起）」；`:174` 「挂了 `requirePermission` / `requirePlatformPermission` 的端点**不入台账**（已接线）」 | 本工作树 grep 实测 |
| `backend/scripts/s3-193-platform-rbac-ledger.mjs` | 平台侧端点台账生成器（范围 = `backend/src/routes/platform*.routes.ts` 29 文件） | 已存在于 `backend/scripts/` |
| `docs/tasks/R101-平台RBAC接线台账.md` | 107 条声明的**逐端点台账**（生成器 + 人工补登 2 条） | 台账 §二 主表 + §六 补登 |

### 本单采用的源码侧证明（三层，逐层加强）

1. **正则行级形状断言**（源码侧，不启动服务）：断言 `transfer.routes.ts` 式地被替换为——`平台路由文件` 的注册行**自带** `requirePlatformPermission("<码>")` 字面量；
2. **门禁读数**：`node scripts/guard-rbac-wiring.mjs --strict` ⇒ 看「已登记 / 未登记 / 陈旧」三数，平台侧接线**不进 gaps**（`:174`）⇒ 接线后该端点从缺口计数中消失；
3. **运行时三态反测**（证明不是恒绿）：无平台令牌 ⇒ **401**；有平台令牌但角色无码 ⇒ **403**；持码 ⇒ 到达业务层。

> ⚠️ 注意（本单设计要点）：**改码不改变缺口计数**（S3-241 §六.6 已发现同一性质）⇒ 「缺口数不变」**不能**当作"没改过码"的证据，**必须靠第 1 层行级断言**。

---

## 四、问题 4：105 条端点的**码归属表**

**已存在，本单不重造**：`docs/tasks/R101-平台RBAC接线台账.md` 主表 **105 条 + 补登 2 条 = 107**，逐条给出「方法 / 完整路径 / 文件:行 / 归属域 / 权限点 / 是否已有现成码 / 接入状态」。

### 当前接线读数（基线 `7ea26e8d` 实测）

| 项 | 读数 |
|:--|:--|
| 已接线 | **32**（S3-193 试点 4 + S3-219 的 library/open/review 28） |
| 待接线 | **63** |
| 豁免 | **10**（auth 6 / error-report / platform-miniapp 公开端点 / 通知自助 2） |
| 接线落点文件（实测 grep） | `platform-library.routes.ts` **17**、`platform-open.routes.ts` **11**、`platform-msg-config.routes.ts` **6**、`platform-review.routes.ts` **4** ⇒ 合计 **38 处**字面量 |
| 扫描面外（已人工补登） | 2 条：`/api/tenant/applications/:id/{approve,reject}` 落在商家侧文件名 `tenant-register.routes.ts`（生成器扫不到，台账 §六） |

本单 R3 **只接 2 条**（见 §六），其余 100+ 条**只登记**顺延。

---

## 五、★ 本单最关键的错位：`tenant:manage` 目录缺口（S3-231 F2 裁定 1 要求"两处同改"）

### 实测（基线 `7ea26e8d`）

| 位置 | 是否有 `tenant:manage` | 行号 |
|:--|:--|:--|
| `backend/src/middleware/platform-rbac.ts` 的 `PLATFORM_WRITE_CODES` | ✅ **有** | `:77` `{ code: "tenant:manage", moduleCode: "tenant" },` |
| `backend/src/services/platform/platform-role.service.ts` 的 `PERMISSION_CATALOG` | ❌ **没有**（只有 `tenant:view`） | `:139` |

### 为什么这是"半个修复"（S3-219 教训复现）

- `PLATFORM_PERMISSIONS` 决定「码**能不能被端点引用**」⇒ 有 ⇒ 能接线；
- `PERMISSION_CATALOG` 决定「码**能不能被授予**」：`updateRolePermissions()` 对**目录外 `module_code` 直接 400**（`platform-rbac.ts:69-74` 注释 + 台账 §五.4）；
- ⇒ 只接不补目录 ⇒ **除超管外全员永久 403**（生产目前唯一管理员是 `PLATFORM_SUPER_ADMIN`，走通配 ⇒ **表面上不红，实际是静默失效**）。

### 本单处置（R2）

两处**同改**：把 `tenant:manage`（及 R3 需要的码）补进 `PERMISSION_CATALOG`，并配套**幂等、非破坏**迁移 **`docs/migrations/207_平台侧权限点立码.sql`**。

**迁移编号可用性已核实**：`docs/migrations/` 共 **206** 个文件，最大编号 **206**（`206_角色权限回补.sql`，S3-236）⇒ **207 空闲可用**；与 S3-241 判定中预留给 S3-249 的 **208/209** 不冲突。

### 迁移的红线（必须遵守）

1. **幂等、非破坏**：不得覆盖已有非空权限串、不得凭空插 `t_platform_role` / `t_platform_role_permission` 行（生产实测 **0 行**，插行 = 凭空造角色）；
2. **不发给任何角色码**（本单只立码，授权另立单）；
3. **目录仍以代码常量为准**：迁移只做 DDL/幂等补行，**不**试图把目录灌进 `t_platform_permission_catalog`（该表本期不参与查询，见问题 1）。

---

## 六、R3 第一批接线（只做 2 条，证明机制可用）

按卡面 §二 R3，**只做两条**：

1. **`/api/platform/applications/:id/approve` 与 `/:id/reject`** —— **双前缀一起收编**：
   - 平台前缀副本：`platform-applications.routes.ts:23/26`（台账 §二 #13/#14）；
   - 商家侧文件名里的审核分支：`tenant-register.routes.ts:34/37`（台账 §六 105+1/105+2，生成器扫不到，**必须人工一起接**，否则就是绕过点）；
   - 码：`tenant:manage`（已在 `PLATFORM_WRITE_CODES:77`，本单补进目录）。
2. **平台侧租户管理写端点**（`/api/platform/tenants*`）**最多 3 条**，同样用 `tenant:manage`（台账 §二 #91/#92/#93 候选：`POST /` 建租户、`PUT /:id` 改租户、`POST /:id/toggle` 启停）。

> 其余 100+ 条**只登记**，在台账顺延章节逐条给「建议码 + 归属批次」。

---

## 七、反测设计（照 `docs/tasks/派单规范.md` §9.1 顺序）

1. **先更新基线**：本单码改动**不触碰 `gaps`**（`guard-rbac-wiring.mjs:174` 已接线端点不入台账）⇒ 第 1 步在本单为**空操作**（已登记状态不变）—— 这一点与 S3-241 §六.6 同性质；
2. **注入**：把 `platform-applications.routes.ts:23` 的 `requirePlatformPermission("tenant:manage")` **摘掉** ⇒ 新用例**必红并点名**该行；
3. **复原**：`git restore` ⇒ SHA256 逐字节一致、复跑绿；
4. **三态反测**（证明不是恒绿）：无平台令牌 ⇒ 401；平台令牌但角色无矩阵授权 ⇒ 403；超管 ⇒ 到达业务层。

---

## 八、本单"做了 / 没做"的边界

**R1 做了**：四问逐条回答（码形态 / 中间件差异 / 源码侧证明 / 码归属表）+ `tenant:manage` 错位实测 + 207 编号可用性 + R3 两条选型 + 反测设计。

**没做（按 R1 定位，非能力不足）**：未改任何业务代码（`backend/src/**` 零改动）、未建 207 迁移、未接线（留待 R2/R3）。

---

## 九、复跑入口

```powershell
cd D:\Users\ZXQL\wt-agents\S3-238
git grep -n 'tenant:manage' -- backend/src/middleware/platform-rbac.ts          # 期望 :77 命中
git grep -n 'tenant:' -- backend/src/services/platform/platform-role.service.ts # 期望 仅 :139 tenant:view（错位）
git grep -c 'requirePlatformPermission' -- backend/src/routes/*.ts              # 期望 library17/open11/msg6/review4
git ls-files docs/migrations | Select-Object -Last 3                            # 期望 最大 206 ⇒ 207 可用
cd backend
node scripts/guard-rbac-wiring.mjs --strict                                     # 基线 EXIT=0
```

## 十、依据卡

`docs/tasks/inbox/ACTIVE-S3-238.md`（派单卡）｜`docs/tasks/R101-平台RBAC接线台账.md`（107 条台账 + §五.4 两处同改教训 + §六 补登 2 条）｜
`backend/src/middleware/platform-rbac.ts`（339 行，S3-193 产物）｜`backend/src/services/platform/platform-role.service.ts:1-160`（目录常量 + MIG-4 注释）｜
`backend/src/shared/system-permission-codes.ts:5-9`（商家侧"目录走常量"先例）｜`backend/scripts/guard-rbac-wiring.mjs:24,100,174`（门禁已识别平台侧）｜
`docs/evidence/_shared/prod-roles-20261016.txt:42-43`（平台角色表 0 行）｜`docs/团队角色卡/阿坚-角色卡.md`（可写面与铁律）
