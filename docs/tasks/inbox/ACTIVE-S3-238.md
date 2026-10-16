# ACTIVE-S3-238 · 平台侧权限接线（设计 + 第一批落地）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-238`｜分支 `feat/s3-238-platform-rbac-batch1`｜基线：开工当日 `origin/main`
> 依据：收口总清单**第 50 项**（平台侧 105 条只有"登记"，无 enforcement）、**S3-231 F2 裁定 1**（平台侧单：目录 + 平台常量**两处同改** + 双前缀收编）、`docs/tasks/cards/R101-S3-231-凌舟验收与裁定.md` §二.1

## 一、问题（为什么单独立项）

- 平台侧 29 个 `platform*.routes.ts` 的 105 条写端点：**有** `requirePlatformAuth`（身份层），**没有**角色/码粒度（`requirePermission` **0 命中**）⇒ 任何平台管理员（含低权角色）可执行全部平台写操作；
- `tenant:manage` 在生产**已有**（`PLATFORM_PERMISSIONS`），但 `PERMISSION_CATALOG` **没有**该码 ⇒ 目录与常量**不同源**（S3-219 教训：只改一处 = 半个修复）；
- `/api/platform/applications/*` 存在**双前缀**注册（`tenant-register.routes.ts` 里的审核分支 + 平台前缀副本）⇒ 接一处漏一处就是绕过点；
- 生产事实：`t_platform_role*` **0 行**、唯一平台管理员是 `PLATFORM_SUPER_ADMIN`（走通配）⇒ 本单**不得**凭空造平台角色行。

## 二、本单要交付的三件（设计先行，落地第一批）

### R1 · 侦察与设计（先写文档，再动代码）
`docs/evidence/S3-238/10-design.md` 必须逐条回答：
1. 平台侧**码的存放形态**（复用 `t_sys_*` 还是平台自有表；生产实测给出结论，**不得猜**）；
2. 判定中间件口径：新增 `requirePlatformPermission(code)`（或复用既有）——**写出与 `requirePermission` 的差异**（身份域不同、平台超管通配语义、失败码 403 的 body 形态）；
3. `/api/platform/**` 无令牌一律 401 的现状（**踩坑：401 不能证明端点存在**）⇒ 设计里必须给"端点注册"的**源码侧**证明方式；
4. 105 条端点的**码归属表**（逐端点 → 建议码；无现成码的逐条标记"需立码"并给命名建议，**不在本单造码**）。

### R2 · 目录与常量两处同改 + 幂等迁移
- 立平台侧码目录（形态照 `backend/src/shared/system-permission-codes.ts`），**并把 `tenant:manage` 补齐到目录**（消除 S3-231 F2 的错位）；
- 新增 `docs/migrations/207_平台侧权限点立码.sql`（幂等、非破坏：**不得**覆盖已有非空权限串、**不得**凭空插平台角色行）；
- **不发给任何角色码**（生产 0 平台角色；需要授权时另立单，回传卡写明）。

### R3 · 第一批接线（**只做两条**，证明机制可用）
1. `/api/platform/applications/:id/approve|reject`（**双前缀一起收编**，接完给出"两处都接上"的证据：源码 + `--strict` 门禁）；
2. 平台侧租户管理写端点（`/api/platform/tenants*` 下 status/管理员创建等）**最多 3 条**，用 `tenant:manage`。

> 其余 100 条**只登记**（在 `docs/tasks/R101-平台RBAC接线台账.md` 顺延章节，逐条给"建议码 + 归属批次"），交后续批次。

## 三、判据
1. R1 设计文档四问逐条有**生产实测/源码**依据（含原始输出）；
2. R2 迁移真库（MySQL 8.0.28）**连跑两遍**零错误；`tenant:manage` 在"目录 + 常量"两处可 grep 到同名同义；
3. R3 接线两侧反测：**无平台令牌 ⇒ 401**、有令牌但无码 ⇒ **403**、持码 ⇒ 到达业务层；**摘中间件 ⇒ `guard-*` 或新守卫必红并点名**；
4. **不得回归商家侧**：`guard-rbac-wiring --strict` 仍 **EXIT=0**，商家侧缺口数字只允许因本单"登记"变化（和式 + 台账一致性，规范 §9.2）；
5. 回归：全量 `npx vitest run` 0 failed、`npx tsc -p tsconfig.json --noEmit` 0、`npm run build` 0。

## 四、红线
1. 不得改商家侧码语义/角色种子；不得改 `.github/**`、`deploy/**`、收口总清单、`current-tasks.md`、其它单工作树；
2. **不得对生产做任何写操作**（只读通道允许，且优先用 `docs/evidence/_shared/` 既有底稿）；
3. **不得 push / 开 PR / `git add -A`**；证据不得含口令明文；回传卡不得出现「凌舟裁定 / 凌舟验收」字样。

## 五、交付与回传
设计文档 + 目录常量 + `207` 迁移 + 第一批接线（≥2 条）+ 台账章节 + `docs/evidence/S3-238/**` +
`docs/tasks/cards/R101-S3-238-阿坚-回传.md`（十项）+ `docs/tasks/inbox/ACTIVE-回执-S3-238.md`。

**十项**：交付物 ｜ 改动面 ｜ 证据 ｜ 验收自评 ｜ 未完成与阻塞 ｜ 风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡
