# S3-229 · 门店/租户域 + 营销域 W 类接线 —— 逐条判定与依据

> 派单卡：`docs/tasks/inbox/ACTIVE-S3-229.md`｜执行方：阿坚（后端 / 权限）
> 授权模型：`docs/tasks/cards/R101-授权模型提案-凌舟-20261016.md`（**不变量 I1** + **D2**）
> 机读真值：`node backend/scripts/guard-rbac-wiring.mjs --json`（存档 `raw/02-guard-json-before.json`、`raw/10-guard-json-after.json`）
> 生产底稿（**只读，不再跑生产**）：`docs/evidence/_shared/prod-roles-20261016.txt`、`prod-menu-matrix-20261016.txt`、`prod-role-usage-20261016.sql` 读数
> 调用面原始输出：`02-callers.txt`（工具 `tools/callers.mjs`）｜封装未用证明：`03-unused-wrappers.txt`

## 一、起点（机器真值，先对账再动手）

| 域 | 文件 | 写端点（扫描） | 已接线 | **缺口** |
|:--|--:|--:|--:|--:|
| G1 门店/租户域（台账 §三.7） | 8 | 33 | 2（储值卡 consume/refund） | **31** |
| G2 营销域·W 类（台账 §三.4 的 W 部分） | 2 | 17 | 3（`marketing/points/rule`、`members/rules` ×2） | **14** |

**G1 缺口 31 条的分桶与 台账 §二（17 管理面 + 2 公开 + 12 平台域）逐字吻合**：

| 桶 | 条数 | 文件 |
|:--|--:|:--|
| 管理面 | 17 | admin-store 2 / demo 2 / store-control 5 / store-value-card 4 / store 2 / tenant-register 2 |
| 公开端点 | 2 | tenant-register `register`、`register/sms-code` |
| 平台域 | 12 | subscription 8 / tenant 4 |

> 注：`subscription.routes.ts` 另有 4 条 `/api/saas/subscriptions/*`、`tenant.routes.ts` 另有 6 条 `/api/platform/tenants/*` 与 `/api/saas/tenants/*`，
> 它们**不在这 8 文件的 31 条口径内**（台账按包含关系分域，属平台域总后台/门店域交叉项）⇒ 本单不动、不重复登记。

## 二、判据（本单唯一口径）

1. **不变量 I1**（提案 §〇.2）：凡**在用**角色能"看到"该页面的，必须持有该端点所用码；**在用** = 生产 `t_sys_user_role` 里被 ≥1 账号绑定的角色。
   生产在用角色（底稿 `prod-role-usage` 读数）：`SUPER_ADMIN`×2 / `STORE_MANAGER`×1 / `STORE_OPERATOR`×1 / `READONLY`×1；
   其余 8 角色（含 `OPERATION_ADMIN`、`STORE_ADMIN`、`SALESMAN`、`PURCHASE_STAFF`…）**0 账号**。
2. **只读观察员例外**（提案 §二 D2 + `prod-menu-matrix` §二）：`READONLY` = `["*:view"]`，被授予营销菜单属设计使然，其**写 403 是期望行为**，不计回归。
3. **B 类**（D4 + 前批口径）：页面**无权限门可达**（首页快捷入口 / 我的页硬编码入口 / 推送深链 / 孤岛页）⇒ 使用者集合不可枚举 ⇒ **不接**（零回归优先）。
4. **平台侧**：`requirePlatformAuth` 认证的端点不用商家码（平台 JWT 不带商家 `roles`，`requirePermission` 会 403）⇒ 归平台侧单。
5. **反测顺序**：先移除台账条目、再注入违规（`docs/tasks/派单规范.md` §九.1）。

## 三、G1 · 门店/租户域 17 条管理面 —— 逐条判定

### 3.1 已接 **7 条**（零回归：使用者已持码 / 无有效调用点）

| # | 端点 | 落地码 | 使用者依据（文件:行） | 在用可见角色 ⇒ 是否持码 |
|--:|:--|:--|:--|:--|
| 1 | `demo.routes.ts:9` POST `/api/admin/demo/seed` | `store:create` | `admin-web/src/views/LoginView.vue:257`（演示登录流程 `seedDemoData()`；封装 `api/common.ts:17`） | 登录后角色 = `DEMO_ACCOUNT`（`admin`）= SUPER_ADMIN（`["*"]`）⇒ 持码 ✔ |
| 2 | `demo.routes.ts:10` POST `/api/admin/demo/reset` | `store:create` | 六端**全仓无有效调用点**（`rg -nw resetSystemData` 仅 `api/common.ts:23` 封装行；`02-callers.txt` #4） | 无使用者 ⇒ 无 403 面 ✔ |
| 3 | `store-control.routes.ts:22` PUT `/configs/:storeId` | `store:edit` | `api/inventory.ts:130` 封装，`updateStoreControlConfig` 在 `.vue` **零引用**（`03-unused-wrappers.txt`） | 无使用者 ✔ |
| 4–7 | `store-control.routes.ts:23-26` POST `/:storeId/{open,close,suspend,resume}` | `store:create` ×4 | `api/inventory.ts:134/138/142/146` 封装，同上零 `.vue` 引用 | 无使用者 ✔ |

> 「门店管控」页（`admin-web/src/views/pos/StoreControlView.vue`，`router/index.ts:271` roles 含 `STORE_MANAGER`/`STORE_OPERATOR`）
> **只调读接口**（`fetchStoreControlStatus`/`fetchStoreControlMyLogs`，见 :60/:95/:105）⇒ 不构成上表 5 条的可见使用者。

### 3.2 不接 **8 条 · B 类**（页面无权限门可达 ⇒ 使用者集合不可枚举）

| # | 端点 | 台账建议码 | 不接理由（app-mobile 写调用点 + 无门入口） |
|--:|:--|:--|:--|
| 8 | `admin-store.routes.ts:11` POST `/api/admin/system/stores` | `store:create` | `app-mobile/src/pages-sub/admin/stores/store-edit.vue:220`（`storesApi.create`）经 **我的页** `pages/profile/profile.vue` 的「门店管理 → 企业信息」**无条件**入口可达（`stores.vue:338` → `store-edit`）；该页菜单持有人另有 `STORE_OPERATOR`（无 `store:*`）⇒ 挂码即 403 |
| 9 | `admin-store.routes.ts:12` PUT `/api/admin/system/stores/:id` | `store:edit` | 同上（`store-edit.vue:218` `storesApi.update`；`stores.vue:342` 编辑入口） |
| 10 | `store-value-card.routes.ts:14` POST `/` | `store:create` | `member-detail.vue:536`（无卡先开卡） |
| 11 | `store-value-card.routes.ts:15` POST `/:cardNo/recharge` | `store:create` | `member-detail.vue:534`（充值） |
| 12 | `store-value-card.routes.ts:16` POST `/:cardNo/freeze` | `store:create` | `api/modules/stored-cards.ts:85`（冻结，储值卡页） |
| 13 | `store-value-card.routes.ts:17` POST `/:cardNo/unfreeze` | `store:create` | `api/modules/stored-cards.ts:90`（解冻） |
| 14 | `store.routes.ts:40` POST `/api/store/members/manage` | `store:create` | `member-detail.vue:621`（新增会员；`member-list.vue:6` 新增按钮） |
| 15 | `store.routes.ts:41` PUT `/api/store/members/:id(\d+)` | `store:edit` | `member-detail.vue:627`（保存客户） |

**共同入口链（可复跑）**：`pages/home/home.vue:87` 快捷入口「会员管理」**无条件渲染**（`hq-item` 无 `v-if`）→ `member-list` → `member-detail`。
⇒ 任何登录角色都能进入该页点这些写按钮（当前**无权限门**）⇒ 使用者集合不可枚举，按 D4「先由前端补权限门再收编」处理。

### 3.3 不接 **2 条 · 平台侧**（台账建议码无效，本单不动手）

| # | 端点 | 判定 |
|--:|:--|:--|
| 16 | `tenant-register.routes.ts:34` POST `/api/tenant/applications/:id/approve` | 该文件 :25 对 `/applications` 段统一挂 `requirePlatformAuth` + `csrfMiddleware` ⇒ **平台侧端点**；调用方 = 平台控制台 `saas-admin/src/api/tenant-application.ts:50`。台账建议码 `store:create` **无效**（平台 JWT 不带商家 roles ⇒ 接线即 403） |
| 17 | `tenant-register.routes.ts:37` POST `/api/tenant/applications/:id/reject` | 同上（`saas-admin/src/api/tenant-application.ts:54`） |

⇒ 归**平台侧单**；建议码位 = `requirePlatformPermission("tenant:manage")`（`middleware/platform-rbac.ts` 已登记该码，模块 `tenant`），但**平台侧过渡期口径待凌舟裁定**（见该文件头注释）⇒ 本单只登记、不接线。

## 四、G2 · 营销域 W 类 14 条 —— 逐条判定（**10 接 + 4 不接**）

### 4.1 已接 **10 条**：`community-marketing.routes.ts` 全部写端点（挂 `marketing:create`）

| 端点（5 文件内 3 router） | 页面/入口 | 生产菜单可见角色（底稿 §一，权威） | 在用可见角色 | 是否持 `marketing:create` |
|:--|:--|:--|:--|:--|
| POST `/api/marketing/group-buy/:id/{join,start,end}` | `group-buy-detail.vue:221`；入口 = 功能中心菜单码 `marketing:group-buy` | `OPERATION_ADMIN`,`READONLY`,`STORE_ADMIN` | **仅 `READONLY`（1 账号，观察员）** | 观察员写 403 = 期望；**无在用写角色** ⇒ 接线零回归 ✔ |
| POST `/api/marketing/bargain/:id/{start,help,end}` | `bargain-detail.vue:311/326`；菜单码 `marketing:bargain` | 同上 | 同上 | 同上 ✔ |
| POST `/api/marketing/seckill/:id/buy`、`/:orderNo/{pay,cancel}`、`/:id/end` | `seckill-detail.vue:281`；菜单码 `marketing:seckill` | 同上 | 同上 | 同上 ✔ |

**依据链**：① 菜单授予 = `docs/evidence/_shared/prod-menu-matrix-20261016.txt` §一（生产 `t_sys_role_menu` 实值）；
② 账号数 = `prod-role-usage-20261016.sql` 读数（`OPERATION_ADMIN` 0 / `STORE_ADMIN` 0 / `READONLY` 1）；
③ 写调用点 = `app-mobile/src/api/modules/community-marketing.ts`（`02-callers.txt` #32–#41）。
④ **菜单错配留痕**（D2 要求）：`STORE_ADMIN`（0 账号、旧词表）本不应看到营销菜单 ⇒ 登记「菜单治理待办」，不阻塞接线。

### 4.2 不接 **4 条 · W 类**（D2 前提**不覆盖**该页 ⇒ 待凌舟裁定码位）

| 端点 | 页面 | 页面注册码 | 在用可见角色 | 为什么不接 |
|:--|:--|:--|:--|:--|
| `points.routes.ts:24` POST `/levels/config` | `member-levels/level-config.vue:164` | `customer:level`（`app-mobile/src/config/function-menu.ts:69`） | **`STORE_MANAGER`（1 账号，在用）** | 店长持 `customer:*` ⇒ 能看该页；但**不持 `marketing:create`** ⇒ 接线即把在用店长打成 403（违反 I1） |
| `points.routes.ts:25` PUT `/levels/config/:id` | `level-config.vue:161` | 同上 | 同上 | 同上 |
| `points.routes.ts:26` PUT `/levels/config/:id/status` | `member-levels.vue:117` | 同上 | 同上 | 同上 |
| `points.routes.ts:27` DELETE `/levels/config/:id` | `api/modules/member-levels.ts:66` | 同上 | 同上 | 同上 |

**判定依据**：① `docs/tasks/cards/R101-S3-136-F1-阿澈-可见性对照表.md` 表 B 的 `customer:level` 列 = SUPER_ADMIN / **STORE_MANAGER** / SALES_STAFF / CUSTOMER_SERVICE / READONLY 均 `1/1/✓`（该表为 S3-143 落地后状态、8 角色 × 44 页逐格一致）；
② 生产持码（底稿）：`STORE_MANAGER` = `store:* sale:* customer:* …` ⇒ 不含 `marketing:*`；③ 三个 0 账号角色（`SALES_STAFF`/`CUSTOMER_SERVICE`/`STORE_ADMIN`）按 I1 不计回归。

> ⚠️ **与派单卡 §一 G2 的差异（须凌舟裁定）**：卡面写「W 类 14 条按 D2 接线」，但 D2 的前提是「营销菜单可见角色 = OPERATION_ADMIN/READONLY/STORE_ADMIN」；
> 这 4 条的页面码是 **`customer:level`**（不属营销菜单前缀），其可见角色含**在用**的 `STORE_MANAGER` ⇒ D2 前提对它们**不成立**。
> 三选一（改挂 `customer:level` / 给店长补 `marketing:create` / 前端补门）属授权口径 ⇒ 本单按 **W 类登记不接**，请凌舟裁定。
> 📌 **待生产核对（R-PROD-READ）**：共用底稿只覆盖营销前缀菜单的授予，`customer:level` 的 `t_sys_role_menu` 实值需补扫（S3-226 §15.9-6 已提同一请求）。

## 五、守恒（本批前 → 本批后）

| 指标 | 本批前 | 本批后 | 原始输出 |
|:--|--:|--:|:--|
| 扫描写端点总数 | 763 | 763 | `raw/02`/`raw/10` |
| 已接线（权限码） | 320 | **337** | `10-guard-json-after.json` |
| 无授权形态（缺口） | 395（116 文件） | **378（113 文件）** | 同上 |
| 消费者端保护形态 | 45 | 45 | 不变 |
| 查询型 POST 登记 | 3 | 3 | 不变 |
| `--strict` | EXIT=0 | **EXIT=0**（未登记 0 / 陈旧 0） | `12-guard-strict-after.txt` |
| 本域对账 | G1 31 / G2 14 | **G1 31 = 7+8+2+2+12；G2 14 = 10+4** | 本文件 §三/§四 |

## 六、反测（门禁铁律，顺序见派单规范 §九.1）

| 步 | 动作 | 结果 | 原始输出 |
|:--|:--|:--|:--|
| ① | **先更新台账**（移除本批 17 条）：`tools/update-baseline.mjs` | 395 → 378 条 / 116 → 113 文件；`wiredPermOccurrences` 291 → 308 | `raw/13-baseline-sync.txt` |
| ② | **再注入违规**：摘掉 `community-marketing.routes.ts:46` 的 `requirePermission("marketing:create")`（**文件中段**，非首行） | — | SHA256 `D8AE118A…4F72B`（`raw/24-hash-before-neg.txt`） |
| ③ | 报告模式分辨力 | 已接线 **337 → 336**、缺口 **378 → 379**（113 → 114 文件） | `25-neg-report.txt` |
| ④ | `--strict` 两侧（红） | **EXIT=1** 且点名 `community-marketing.routes.ts:46 POST /api/marketing/seckill/:orderNo/pay` | `26-neg-strict.txt` |
| ⑤ | 用例分辨力（vitest） | `rbac-b2-s3-229-…test.ts` **5 failed / 117 passed** | `27-neg-vitest-red.txt` |
| ⑥ | 逐字节还原 | SHA256 与注入前**一致**；`git diff` 无残留 | `raw/28-hash-restored.txt` |
| ⑦ | 复原后验绿 | `--strict` **EXIT=0**、未登记 0 / 陈旧 0；已接线 337 | `29-neg-restored-strict.txt` |

## 七、回归四道（原始输出）

| 命令 | 结果 | 输出 |
|:--|:--|:--|
| `npx vitest run`（backend） | 见 `30-full-vitest-after.txt` 尾行 | `30-full-vitest-after.txt` |
| `npx tsc --noEmit` | EXIT=0 | `31-tsc.txt` |
| `npx eslint src --ext .ts` | EXIT=0 | `32-eslint.txt` |
| `npm run build`（根，7 workspace） | EXIT=0 | `33-build.txt` |

## 八、卡外观察（**只登记不动手**）

1. **我的页「门店管理」为硬编码无条件入口**：`pages/profile/profile.vue` 的「企业信息 / 员工管理 / 角色管理」三项无任何码过滤（与 S3-125 记录的 `profile.vue:42` 同源）⇒ 门店建档/员工/角色三页对**所有**登录角色可达。这是 3.2 中 B 类的根因，也属 D4 前端权限门单（S3-230）的覆盖范围。
2. **S3-226 用例随状态变更同步**：`rbac-b2-s3-226-marketing-wiring.test.ts` 原把 community-marketing 10 条件为「未接」，本批接线后已同步（W 14 → 4，并加状态变更登记用例）；未改其 65 条已接行与 G0 名单断言。
3. **S3-119 限流门禁的判据可被注释误触发**：`backend/src/__tests__/shared/route-test-rate-limit.test.ts` 的 `MOUNTS_AUTH` 正则跑在**未剥注释**的源码上，测试文件里写一句含 `router.use(… requirePlatformAuth …)` 的**注释**就会被判为"自建 app + 挂真实鉴权"（本单新增文件实测命中一次，已改写注释措辞规避）。建议后续把该正则也改为剥注释后匹配（不改动，仅登记）。
4. **`/api/tenant/applications/*` 与 `/api/platform/applications/*` 双前缀同业务**：`platform-applications.routes.ts`（PUT approve/reject）与本域 `tenant-register.routes.ts`（POST）服务同一「入驻申请审核」，两条链路都只有 `requirePlatformAuth`、都无平台权限码 ⇒ 平台侧单建议一并收编。
