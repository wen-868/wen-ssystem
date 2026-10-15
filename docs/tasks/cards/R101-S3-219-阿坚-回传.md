# R101-S3-219 · 阿坚回传（平台侧 3 域目录扩 + 28 条平台写端点接线）

【汇报 S3-219】平台侧 `library` / `open` / `review` 3 域目录已扩（平台侧目录 18 条/8 域 → 21 条/11 域），
28 条平台写端点全部接线（library 15 / open 10 / review 3）；两侧反测齐（无码 403 ／ 有码放行 ／ 摘掉中间件必红）；
门禁四绿（`guard:rbac-wiring --strict` 0、台账 `--check` 0、`tsc --noEmit` 0、`build` 0）＋ 全量 `vitest` 670 文件 / 8158 用例 0 失败。
未 push、未开 PR、未碰其它单工作树。

汇报对象：总负责人（凌舟）　｜　汇报人：阿坚（后端 / 权限）　｜　日期：2026-10-16
对应派单编号：**S3-219**（收口总清单第 67 项）　｜　工作树：`D:\Users\ZXQL\wt-agents\S3-219`
分支：`feat/s3-219-platform-domain-wiring`　｜　分支提交：`c95a5280`（基线 `993bde70` = 派单时 `origin/main`）

---

## 一、交付物

| # | 交付物 | 说明 |
|:--|:--|:--|
| 1 | `backend/src/services/platform/platform-role.service.ts` | 平台侧目录 `PERMISSION_CATALOG` +3 条 BUTTON 写码（`library:manage` / `open:manage` / `review:manage`），18 条/8 域 → **21 条/11 域** |
| 2 | `backend/src/middleware/platform-rbac.ts` | `PLATFORM_WRITE_CODES` 的 `catalogReady` 由手写布尔 → **派生自目录**（消除"码已接线但不可被授予"的两处真相漂移） |
| 3 | `backend/src/routes/platform-library.routes.ts` | 15 条写端点挂 `requirePlatformPermission("library:manage")` |
| 4 | `backend/src/routes/platform-open.routes.ts` | 10 条写端点挂 `requirePlatformPermission("open:manage")` |
| 5 | `backend/src/routes/platform-review.routes.ts` | 3 条写端点挂 `requirePlatformPermission("review:manage")` |
| 6 | `backend/src/__tests__/routes/platform-rbac-domain-wiring.test.ts`（新增） | 67 例：28 端点 × （无码 403 ／ 有码放行）＋ 目录不变量 ＋ 三态分辨力 ＋ 读端点边界；**端点清单从真实 router 栈派生** |
| 7 | `docs/tasks/R101-平台RBAC接线台账.md` + `backend/scripts/s3-193-platform-rbac-ledger.mjs` | 台账由生成器重出：已接线 4→**32**、需先扩目录 28→**0**、待接线 63（不变）；两批接线在状态列区分 |
| 8 | `backend/scripts/rbac-wiring-baseline.json` | G4 门禁基线：本批 28 条**逐条**移出 `gaps`（155→152 文件、641→613 端点）+ `_s3219_note` 说明 |
| 9 | 证据目录 `docs/evidence/S3-219/**` | 生产角色核对、目录扩实证、门禁原始输出、反测日志、改动面与 src/dist 哈希 |
| 10 | 联动注释（3 处）＋ 业务用例放行桩（4 文件） | 见 §二 改动面与 §六 报备 |

## 二、改动面

`git diff --name-only 993bde70 HEAD`：**16 个代码/文档文件 + 证据目录**

```
backend/scripts/rbac-wiring-baseline.json                              （门禁基线）
backend/scripts/s3-193-platform-rbac-ledger.mjs                        （台账生成器）
backend/src/__tests__/routes/platform-rbac-domain-wiring.test.ts       （新增用例）
backend/src/__tests__/routes/{platform-open-api-keys,platform-library-review-log,platform-s3-110,platform-c6-1a}.test.ts  （放行桩）
backend/src/__tests__/services/platform/{platform-role.service,platform-notification.service}.test.ts
backend/src/controllers/platform/platform-role.controller.ts          （联动注释）
backend/src/middleware/platform-rbac.ts
backend/src/routes/{platform-library,platform-open,platform-review}.routes.ts
backend/src/services/platform/{platform-role,platform-notification}.service.ts
docs/tasks/R101-平台RBAC接线台账.md
docs/evidence/S3-219/**（5 份 md + 9 份原始日志/清单）
```

**逐条为什么在这个范围里**：1~5 是交付物①②；6~8 是交付物③；9 是证据；10 两处是"我的改动造成的不实注释"
（控制器/服务里写"18 条/8 域"）与"接线后既有业务用例被 403 打红"的必要处置。

> 说明：卡 §五.6 给的 `git diff --name-only origin/main HEAD` 现在会多出 4 条**不属于我**的路径
> （`docs/tasks/R101-收口总清单.md`、`docs/tasks/inbox/ACTIVE-S3-218.md`、`ACTIVE-S3-219.md`、`ACTIVE.md`）——
> 那是 `origin/main` 在我起树后新推的 2 笔文档提交（`7beafd24`、`eada6de7`）单侧存在，非本单改动；
> 我以**派单时**的 `origin/main`（`993bde70`）为基线，故用上面那条命令逐条列改动面。

## 三、证据（可复跑命令 + 原始输出）

全部原始输出落盘在 `docs/evidence/S3-219/raw/`，逐条可复核：

| # | 命令（工作树根目录 / `backend`） | 原始输出 | 结果 |
|:--|:--|:--|:--|
| 1 | `node backend/scripts/guard-rbac-wiring.mjs --strict` | `raw/07-guard-strict.log` | **EXIT=0**；"gaps：已登记 613 ／ 未登记 0 ／ 已登记但当前无缺口 0" |
| 2 | `node backend/scripts/guard-rbac-wiring.mjs --json` | `raw/07-guard-rbac-wiring.json` | 本批 3 文件 **28 条写端点全部 `authForm=inline`**（接线前为 `none`） |
| 3 | `node backend/scripts/s3-193-platform-rbac-ledger.mjs --check` | `raw/07-ledger-check.log` | **EXIT=0**；105 条守恒、已接线 32 ／ 需扩目录 0 |
| 4 | `cd backend; npx tsc -p tsconfig.json --noEmit` | 无输出 | **EXIT=0** |
| 5 | `npm --workspace backend run build` | `raw/05-backend-build.log` | **EXIT=0**（804 文件 / 1907 处导入修复） |
| 6 | `cd backend; npx vitest run` | `raw/04-vitest-full.log` | **670 文件 / 8158 用例全通过（0 失败），EXIT=0** |
| 7 | `cd backend; npx vitest run src/__tests__/routes/platform-rbac-domain-wiring.test.ts` | 见 §五 | **67 passed** |
| 8 | **反测**：临时删 `POST /spus` 上的权限中间件 → 重跑 #7 | `raw/06-reverse-remove-middleware.log` | **1 failed / EXIT=1**，红点落在被摘端点；复原后哈希与复跑均回到绿（`13E5E38A…`） |
| 9 | `grep -n 'auth:\s*"none"'` 三个路由文件 | 同 §五.2 | **0 命中**（未用 `auth:"none"` + 自造校验） |
| 10 | 28 条逐条清单（文件:行 + 端点 + 权限点） | `raw/03-28-endpoints.txt`（取自台账 §二 第 33~47 / 57~66 / 78~80 行） | **28 行** |

## 四、验收自评（对照派单卡 §五 六条判据，逐条）

| 判据 | 自评 | 依据 |
|:--|:--|:--|
| 1. 目录扩：3 个新码在 `PLATFORM_PERMISSIONS` 中可解析 | **通过** | 新用例「每条端点的权限码已登记，且 `level=WRITE`、`catalogReady=true`」＋「`catalogReady` 与平台侧目录同源」（`raw/04-vitest-full.log`）。**并补一处卡面未点名但必需的改动**：`platform-role.service.ts` 的 `PERMISSION_CATALOG` 也要扩，否则码不可被授予（见 §五 说明与 `02-目录扩实证.md`） |
| 2. 接线 28 条逐条列出 ＋ `auth:"none"` 0 新增 | **通过** | 台账 §二 28 行（`raw/03-28-endpoints.txt`）；`rg 'auth:\s*"none"'` 三文件 0 命中 |
| 3. 两侧反测：①无码 403 ②有码通过 ③摘中间件必红 | **通过** | 28×2 全绿；反测 EXIT=1 且红点落在被摘端点（`06-两侧反测.md`） |
| 4. 回归：全量 vitest 0 failed、tsc 0、build 0 | **通过** | 8158／0、TSC_EXIT=0、BUILD_EXIT=0 |
| 5. 两份台账一致：`--check` EXIT=0 ＋ 28 条状态位全部更新 | **通过** | `raw/07-ledger-check.log`；状态列 28 条均为「✅ 已接线（S3-219）」 |
| 6. 未触碰项自证（`git diff --name-only` + 逐条说明） | **通过** | §二；商家侧目录/断言/saas-admin 契约/页面/`.github`/`deploy`/`docs/migrations` **全部 0 改动** |

## 五、未完成与阻塞

1. **未做：生产库只读核对直连**。本机无通道（`127.0.0.1:3306` 未监听、无 `mysql`/`docker` 客户端、
   仓外凭据文件只登记**应用登录**账号而无 DB 连接串）⇒ 按卡 §四 给出的 SQL 无法在本机执行。
   替代依据与复跑 SQL 见 `docs/evidence/S3-219/01-生产角色核对.md`（结论：**无 403 回归**）。
2. **未做：`miniapp` 域**。裁定 ② 提到 4 域，但 `miniapp` 的唯一写端点是公开端点（`auth:"none"`），
   台账已按豁免登记；卡 §一 的范围也只列 library/open/review 3 域 ⇒ 本单按卡口径做 3 域。
   若要把 miniapp 也纳入收敛，属另一议题（会动公开端点语义）。
3. **未做：读端点（GET）接 `<域>:view`**。第 67 项范围 = 写端点（同 S3-193 口径），读码留待后续批次；
   装置里有一条边界断言锁住"没有顺手把写码挂到读端点上"。
4. **未做：saas-admin 侧文案/文档**（新域在平台角色页的勾选说明）。saas-admin 属红线 ① 保护范围（0 改动）。
5. **阻塞：无**。

## 六、风险与自我报备

1. **我扩了卡面未点名的第二处目录**（`platform-role.service.ts` 的 `PERMISSION_CATALOG`）。
   理由：授予路径的合法域集合由该常量派生（目录外 `module_code` 直接 400）⇒ 只改 `platform-rbac.ts`
   会让 3 个码**永远无法被授予**，28 条端点对除超管外的账号**永久 403**（静默失效）。
   影响面：平台角色页会多出 3 个域分组（预期行为）；商家侧目录与断言 0 改动。是否接受这种"两处同时改"的落点，请复核。
2. **我把 `catalogReady` 从手写布尔改成派生**（3 行的形态变更）。理由：手写值与目录是两份真相，
   本次 library/open/review 之前正是"`false` 但端点已登记"的半成品状态。若你要求保持手写形态，可回退为
   显式 `true`（3 行），但**必须同时保留目录扩**，否则回到第 1 条的静默失效。
3. **我改了 4 个既有业务用例文件**（把 `requirePlatformPermission` 换成放行桩）：接线后它们共 36 例被 403 打红
   （其 db mock 不足以回答权限查询）。这 4 个文件测的是状态机/上传/流水/密钥业务，不是 RBAC；
   保留真中间件需补权限桩并改写多处"未触达数据库"的既有断言（改动面更大）。
   兜底证据：本单新增的 28×2 端点级断言 + `guard --json` 的 `authForm=inline`×28。
   若你认为"业务用例里也应保留真权限中间件"，请裁定，我改成"真中间件 + 目录桩"版本。
4. **台账「已接线」状态仍是生成器 `DOMAIN_MAP` 的人工声明**（S3-193 既有设计，生成器不扫源码验证）。
   我**没有**新增该判据：半个判据会带来假绿（踩坑[171] 同族）。建议后继批次把它做成机器断言，本单只登记不动手。
5. **存量注释未同步（卡外，按规定只登记不动手）**：`docs/migrations/179_平台角色与权限点目录.sql` 文件头注释
   仍写"18 条 / 7 域 MENU"（红线 ② 禁改迁移）；`saas-admin/src/api.ts:485` 注释写"恒 18 条"
   （红线 ① 禁动 saas-admin）。backend 侧同类注释已在卡内更新。
6. **未改 `docs/tasks/inbox/ACTIVE.md` 与 `docs/tasks/current-tasks.md`**：前者是**多单并行路由表**
   （`s3220_ajian` 的 S3-214-B2 在办，改它会冲突），后者沿用 S3-190/S3-210/S3-212 先例由你统一记账；
   本单卡 `docs/tasks/inbox/ACTIVE-S3-219.md` **未移入 archive**（同上原因），请收单时归档。
7. **依赖自建**：工作树内无 `node_modules`，按踩坑[170] 未复用他人工作树，用
   `npm ci --workspace=backend --include-workspace-root` 自建（362 s）。**未碰** `wt-agents/S3-214`、`S3-211`、`S3-212`。
8. **环境读数复验（踩坑[172]）**：本会话 `npx vitest run` / `tsc --noEmit` / `build` **均可跑**，本回传全部为真跑读数，
   未使用任何替代通道。

## 七、环境复原

- 工作树 `D:\Users\ZXQL\wt-agents\S3-219`，分支 `feat/s3-219-platform-domain-wiring`；
  本轮本地提交 **`c95a5280`**（基线 `993bde70`）+ 本回传一笔；
- **未 push、未开 PR**；未碰其它单的工作树；未改 `.github/**`、`deploy/**`、契约文档、收口总清单；
- 反测窗口已复原：`platform-library.routes.ts` 前后哈希同为 `13E5E38A5A9EC7D2891D900B434DCAF7908E7539D6E1927C9CFA37387873073A`；
- `src` / `dist` 哈希逐条列于 `docs/evidence/S3-219/08-改动面与哈希.md`（含 build 产物的 5 个 dist 指纹）；
- `git status` 无未跟踪的临时产物（依赖目录 `node_modules` 未入库）。

## 八、一行摘要

**S3-219 已交付：平台侧目录扩 3 域（18 条/8 域 → 21 条/11 域）＋ library/open/review 28 条写端点接线；无码 403 ／ 有码放行 ／ 摘中间件必红的反测齐；四门禁全绿 + 全量 8158 用例 0 失败；未 push、未开 PR。**

## 九、待裁定项（交总负责人）

1. 「两处目录同时改」的落点是否接受（§六.1）；若否，请指明只改哪一处，并说明"码不可被授予"如何处置。
2. `catalogReady` 用**派生**还是回到**手写布尔**（§六.2）。
3. 4 个业务用例文件用**放行桩**是否接受；若否，我改"真中间件 + 目录桩"（§六.3）。
4. `miniapp` 域与读端点 `<域>:view` 是否另开单（§五.2/§五.3）。
5. 台账状态列新增措辞「（S3-219）／（S3-193 试点）」与「✅ 有（S3-219 扩入平台侧目录）」是否保留。
6. 两处卡外存量注释（迁移 179 头部、`saas-admin/src/api.ts:485`）由谁出单同步（我按红线未动）。

## 十、依据卡

- 派单卡：`docs/tasks/inbox/ACTIVE-S3-219.md`（认领名 `/root/s3221_platform`）
- 裁定依据：`docs/tasks/cards/R101-S3-213-第67项平台RBAC后继-凌舟裁定.md`（②③）、`docs/tasks/R101-平台RBAC接线台账.md`
- 铁律依据：`AGENTS.md`（门禁反测铁律、技术债"绕过 ≠ 修复"）、踩坑[159]/[170]/[171]/[172]
