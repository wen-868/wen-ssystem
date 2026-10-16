# ACTIVE 回执 · S3-235（权限种子落库 · 收口总清单第 72 项）

> 汇报对象：**凌舟（总负责人）**｜汇报人：**阿坚（后端 / 权限）**｜日期：**2026-10-16**｜对应派单：**S3-235**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-235`｜分支 `feat/s3-235-role-permission-seed`（基线 `origin/main` `ca4b4151`）
> 完整回传（十项）：`docs/tasks/cards/R101-S3-235-阿坚-回传.md`｜证据索引：`docs/evidence/S3-235/README.md`
> 本单**未 push / 未开 PR / 未 rebase / 未动 main**；`docs/tasks/inbox/ACTIVE.md`（路由文件）**未动**——它同时承载 s3240/s3241/s3242 三方认领，请您移行。

## 改了什么

| 提交 | 内容 |
|:--|:--|
| `b9b8fd1c` | 新增 `docs/migrations/205_角色权限种子.sql`（25 条语句：12 `INSERT … WHERE NOT EXISTS` + 12 只填空值 `UPDATE` + 1 核对 `SELECT`）+ 生成器 `docs/evidence/S3-235/tools/gen-role-seed.mjs` + 迁移编号断言 `EXPECTED_MAX_MIGRATION` 204→205（`backend/src/__tests__/shared/migration-c6-4-1.test.ts`） |
| `99687d0f` | 证据装置（幂等装置 / 启动链装置 / 反测装置 / 底稿对账）+ `docs/evidence/S3-235/raw/**` 原始输出 |
| `f12320aa` | `docs/evidence/S3-235/tools/role-seed-selfcheck.sql`（灾备只读自检）+ 证据索引 README |
| 末笔 | 回传卡 + 本回执 + 归档派单卡 |

改动面：新增 205 + `docs/evidence/S3-235/**`；改 1 处测试常量。**未动**业务代码、既有迁移（含 `128_fix_roles_binding.sql`）、`deploy/**`、`.github/**`、收口总清单、其它单工作树。

## 证据（读数）

1. **红线基线（`MIGRATION_WRITE_GATE=block`，205 已在链里）**：底稿 12 角色非空 = **0**；写闸门共跳过 170 条写语句（其中 **205 = 24 条**）⇒ `raw/40-boot-red-gate-block.log`、`raw/41-red-readings.txt`、`raw/42-red-gate-skips.txt`。
2. **绿线（`allow`）**：底稿 12 角色非空 = **12/12**；205 零跳过零错误 ⇒ `raw/50-boot-green-gate-allow.log`、`raw/51-green-readings.txt`。
3. **幂等**：`node scripts/run-migration.mjs docs/migrations/205_角色权限种子.sql` 连跑两遍均 `12 / 12；缺失或空权限的角色 = 无` + `迁移执行成功`；逐语句装置显示 24 条写语句**命中 0 条** ⇒ `raw/52~54`。
4. **非破坏反测 6/6 PASS**：sentinel / NULL 恢复 / 空数组恢复 / 缺行补建 / 自检 PASS / 自检 FAIL→复原 ⇒ `raw/61~67`。
5. **回归**：`tsc --noEmit` exit 0（0 行输出）；`vitest run` **680 文件 / 9558 用例 / 0 failed**；`guard-evidence-secrets` PASS ⇒ `raw/70~72`。

## 阻塞点

**无阻塞项。** 唯一未做动作 = 未 rebase 到当前 `origin/main`（卡面基线为开工当日 main，合并口径按您既有流程）。

## 请您处置（摘要，详见回传卡 §九）

1. **P0**：默认写闸门 `block` 会把 205 整体跳过 ⇒ 同一份空库、同一个 205，`block` = 0/12、`allow` = 12/12；灾备/新库重建是否把 `MIGRATION_WRITE_GATE=allow` 写成硬步骤。
2. **归属边界**：205 是否随部署执行由 S3-234（manifest / 第 74 项）收口，本单只保证 205 命名合规。
3. **2 个角色与底稿不一致**（`STORE_MANAGER` / `STORE_OPERATOR`，根因是 128 语料比生产旧，非本单引入）：是否另立"只增不减"加法小单（草稿见回传卡 §九.3）。
4. 平台侧按卡未动、未造平台角色行（仅登记）；205 只覆盖 `tenant_id='default'`。
