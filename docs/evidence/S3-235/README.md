# S3-235 证据索引 · 权限种子落库（收口总清单第 72 项）

> 执行方：**阿坚（后端 / 权限）**｜日期：**2026-10-16**｜工作树：`D:\Users\ZXQL\wt-agents\S3-235`
> 分支：`feat/s3-235-role-permission-seed`｜基线：开工当日 `origin/main`（`ca4b4151`）
> 依据卡：`docs/tasks/inbox/ACTIVE-S3-235.md`｜完整回传：`docs/tasks/cards/R101-S3-235-阿坚-回传.md`

## 一、结论

1. 新增 `docs/migrations/205_角色权限种子.sql`（由 `tools/gen-role-seed.mjs` **从生产只读底稿 §一 程序化生成**，`--check` 可证明逐字节可复跑）；
2. 语义 = **幂等 + 非破坏**：缺行补建、空/NULL/空数组补写、**非空行一个字节都不改**；连跑两遍零变更；
3. 空库演练（本机 MySQL **8.0.28**，跑完整迁移链 001…205）：**12/12 底稿角色 permissions 非空**；
4. ⚠️ **关键发现（本单最大风险，须凌舟处置）**：后端启动链默认 `MIGRATION_WRITE_GATE=block`，
   会把 205 的 24 条写语句**全部跳过** —— 实测同一份空库、同一个 205，`block` 下 **0/12 有权限**、`allow` 下 **12/12**。
   ⇒ 205 是"必要不充分"：灾备/新库重建**必须**同时满足「205 随链执行」+「写闸门放行」。

## 二、装置与环境（本机夹具，**不含任何凭据**）

| 项 | 取值 |
|:--|:--|
| 数据库 | 便携 MySQL **8.0.28** @ `127.0.0.1:3421`（`root` 空口令；datadir = `%TEMP%\mysql80\data-s3242b`；**不是生产、未连生产**） |
| 建库方式 | 空库 ⇒ 跑后端启动链（`backend/dist/server.js`，`backend/src/shared/migration.ts` 按文件名顺序执行 `docs/migrations/*.sql`；与生产/CI 的「Run migrations via server boot」同通道） |
| 库清单 | `liq235_red`（gate=block 红线基线）、`liq235_green`（gate=allow 绿线）、`liq235_probe`（gate=allow，反测专用，避免污染绿线库） |
| 写出闸门 | `MIGRATION_WRITE_GATE`（默认 `block`；`allow` 才放行外部迁移里的 INSERT/UPDATE/DELETE/REPLACE/CALL） |
| 端口 | HTTP 3599/3600/3601（只为不撞车，与判据无关） |

## 三、卡面判据 ↔ 证据对照

| 卡面判据（§三） | 读数 | 证据文件 |
|:--|:--|:--|
| R1 真库连跑两遍零错误 | 第一遍 24 条写语句 **0 命中**、第二遍同；核对 SELECT 输出 `12 / 12；缺失或空权限的角色 = 无` | `raw/52-205-idem-pass1.txt`、`raw/52-205-idem-pass2.txt`、`raw/53-205-runner-official.txt` |
| R2 空库 12/12 非空（原始输出） | `fixed_12_nonempty = 12` | `raw/51-green-readings.txt` |
| R2 sentinel 非破坏反测 | 把 STORE_MANAGER 改成 `["__sentinel__"]` ⇒ 跑 205 ⇒ 命中 0 条、值**不变** | `raw/61-sentinel-nondestructive.txt` |
| R2 NULL 反向恢复 | `permissions=NULL` ⇒ 跑 205 ⇒ 回落为底稿值 | `raw/62-null-restore.txt` |
| R2 空数组恢复（加油项） | `permissions='[]'` ⇒ 跑 205 ⇒ 回落为底稿值 | `raw/63-empty-array-restore.txt` |
| R2 缺行补建（加油项） | 删掉角色行 ⇒ 跑 205 ⇒ 按底稿重建 | `raw/64-missing-row-insert.txt` |
| R3 自检两边验证 | 有权限 ⇒ `PASS: 在用角色（有账号绑定）里 permissions 为空 = 0 行`；清空"在用角色" ⇒ `FAIL: … = 1 行`；跑 205 复原 ⇒ 回到 PASS | `raw/65-selfcheck-pass.txt`、`raw/66-selfcheck-fail-then-restore.txt` |
| 回归（vitest 全量 / tsc） | 见 `raw/70-tsc-noemit.txt`、`raw/71-vitest-backend-full*.txt` | 同左 |
| 反测装置可复跑 | `tools/reverse-tests.ps1` 六项断言全 `[PASS]` | `raw/67-reverse-tests-summary.txt` |

## 四、四条关键读数（逐条可复跑）

1. **红线基线（gate=block，205 已在链里）**：`t_sys_role` 只有 2 行（`ADMIN`/`SUPER_ADMIN`，`permissions` 均为 NULL），
   **底稿 12 角色非空 = 0**；写闸门共跳过 **170** 条写语句，其中 **205 贡献 24 条（12 INSERT + 12 UPDATE）、128 贡献 13 条**。
   证据：`raw/40-boot-red-gate-block.log`、`raw/41-red-readings.txt`、`raw/42-red-gate-skips.txt`。
2. **绿线（gate=allow）**：底稿 12 角色非空 = **12**；205 的 24 条写语句**零跳过、零错误**；
   库中 `t_sys_role` 共 32 行（含其它迁移/种子落下的 `ADMIN`/`FINANCE`/`INVENTORY_MANAGER`/`PURCHASER`/`VIEWER` 与 demo 租户副本）。
   证据：`raw/50-boot-green-gate-allow.log`、`raw/51-green-readings.txt`。
3. **幂等**：`tools/run-205-idempotency.mjs` 逐语句打印 `affectedRows/changedRows` —— 饱和态下 24 条写语句命中 0 条。
4. **反测**：`tools/reverse-tests.ps1` 六项（sentinel / NULL / 空数组 / 缺行 / 自检 PASS / 自检 FAIL→复原）全 `[PASS]`。

## 五、与底稿的差异（诚实清单，须凌舟裁定）

`raw/53-draft-vs-green-db.txt`（`tools/compare-draft-vs-db.mjs` 生成）：**12 个角色里 10 个与底稿逐条一致**，2 个不一致，
原因**不是本单引入**，而是既有语料 `128_fix_roles_binding.sql`（2026 年早于本次底稿导出）比生产旧：

| 角色 | 底稿（生产） | 跑完链的库 | 差异 |
|:--|:--|:--|:--|
| `STORE_MANAGER` | 9 码（含 `finance:payment`/`goods:price`/`finance:daily-settle`） | 8 码（= 128 的 6 码 + 204 加的 `goods:create`/`goods:edit`） | 多 `goods:create`/`goods:edit`，少 `finance:payment`/`goods:price`/`finance:daily-settle` |
| `STORE_OPERATOR` | 6 码（含 `sale:return`/`finance:daily-settle`/`dashboard:view`） | 3 码（128 的旧值） | 少 `sale:return`/`finance:daily-settle`/`dashboard:view` |

为什么 205 **没有**把这 2 个角色"拉齐"：卡面 R1 的 🔴 硬要求是"角色行已存在且 `permissions` 非空 ⇒ 一个字节都不改"，
而这 2 行在空库链里已由 128 写成了非空 ⇒ 205 按语义不命中它们（这正是 sentinel 反测证明的性质）。
要把它们拉齐只能走"**只增不减**"的加法迁移（204 的 `JSON_ARRAY_APPEND` + `JSON_CONTAINS` 形态），
但那会**主动扩大旧库上这两个角色的权限**（`sale:return`、`finance:daily-settle` 等属敏感写权限）⇒ 需凌舟裁定后另立单。
回传卡 §九 已给出可直接照抄的加法语句草稿。

## 六、过程中发现并修掉的自身缺陷（留档）

生成器首版把 `--   底稿 sha256：…` 前缀写漏成裸文本行，导致 205 的**第一块**（表头注释 + 首条 INSERT）
被启动链的 `splitSqlStatements` 视为一条语句、且因"剥离注释后的首词不是写关键字"而**绕过写闸门被真的执行** ⇒ `ER_PARSE_ERROR`。
装置留证：`tools/probe-205-chunks.mjs`（打印 25 个切块的首关键字）；修复后重跑，205 的 `ER_*` 行 **0**。
（教训建议记入 `docs/踩坑日志.md`：外部迁移文件里**任何一行都不能漏 `--` 前缀**，否则整块会被判成非写语句、在 `gate=block` 下反而真的下发。）

## 七、待凌舟裁定 / 处置项

1. **写闸门口径（P0 级）**：205 在默认 `gate=block` 下被整体跳过 ⇒ 灾备/新库重建需显式 `MIGRATION_WRITE_GATE=allow`（或改用 `scripts/run-migration.mjs` 手工补跑）。要不要把"灾备重建必须放行写闸门"写进部署/灾备手册，请裁定（本单未改 `deploy/**`）。
2. **205 是否随部署执行**：`deploy/auto-deploy.sh` 目前只硬编码 3 个迁移（第 74 项，属 S3-234）；本单只保证 205 **命名合规、可被清单收录**，清单与执行由 S3-234 收口。
3. **§五的 2 个角色差异**：是否另立"只增不减"的对齐单（草稿见回传卡 §九），或维持现状（把 128 的旧语料当作"新库基线"）。
4. **平台侧**：`t_platform_role*` 生产 0 行，本单按卡**未动**、未凭空造平台角色（仅登记）。
5. **其它租户**：205 只作用于 `tenant_id='default'`（底稿 §一 口径）；`197/198` 在 205 **之前**执行，故非 default 租户的派生角色不在本单覆盖范围（需要时另立单）。

## 八、复跑命令（照抄可跑）

```powershell
# 0) 依赖与构建
npm ci
cd backend; npm run build; cd ..

# 1) 生成 205 并验证"生成物 = 底稿重算结果"（逐字节）
node docs/evidence/S3-235/tools/gen-role-seed.mjs --check

# 2) 起本机夹具库（8.0.28 @3421）——若未在跑
$base="$env:TEMP\mysql80\mysql-8.0.28-winx64"; Start-Process "$base\bin\mysqld.exe" -WindowStyle Hidden `
  -ArgumentList '--no-defaults',"--basedir=$base","--datadir=$env:TEMP\mysql80\data-s3242b",'--port=3421','--bind-address=127.0.0.1','--mysqlx=0'

# 3) 三个空库 + 三次启动链（红线 / 绿线 / 反测库）
& "$base\bin\mysql.exe" -h127.0.0.1 -P3421 -uroot -e "DROP DATABASE IF EXISTS liq235_green; CREATE DATABASE liq235_green DEFAULT CHARSET utf8mb4;"
powershell -NoProfile -File docs/evidence/S3-235/tools/boot-chain.ps1 -DbName liq235_green -GateMode allow  -LogFile docs/evidence/S3-235/raw/50-boot-green-gate-allow.log -HttpPort 3600
powershell -NoProfile -File docs/evidence/S3-235/tools/boot-chain.ps1 -DbName liq235_red   -GateMode block  -LogFile docs/evidence/S3-235/raw/40-boot-red-gate-block.log  -HttpPort 3599
powershell -NoProfile -File docs/evidence/S3-235/tools/boot-chain.ps1 -DbName liq235_probe -GateMode allow  -LogFile docs/evidence/S3-235/raw/60-boot-probe-gate-allow.log -HttpPort 3601

# 4) 幂等 / 差异 / 自检 / 反测
$env:DB_HOST='127.0.0.1'; $env:DB_PORT='3421'; $env:DB_USER='root'; $env:DB_NAME='liq235_green'
node docs/evidence/S3-235/tools/run-205-idempotency.mjs
node docs/evidence/S3-235/tools/run-205-idempotency.mjs docs/evidence/S3-235/tools/role-seed-selfcheck.sql
node docs/evidence/S3-235/tools/compare-draft-vs-db.mjs
powershell -NoProfile -File docs/evidence/S3-235/tools/reverse-tests.ps1 -DbName liq235_probe

# 5) 回归
npx tsc -p backend/tsconfig.json --noEmit
cd backend; npx vitest run --reporter=dot; cd ..
node backend/scripts/guard-evidence-secrets.mjs
```

## 九、边界与未覆盖（诚实标注）

- **未 push / 未开 PR / 未 rebase**（卡面红线；合并口径由凌舟按既有"rebase→亲跑→推分支→PR"流程处理）。
- **未对生产做任何写操作**，也未连生产（底稿是既有的只读导出文件）。
- 本单只覆盖 `tenant_id='default'` 的 12 个商家角色；平台侧、非 default 租户、以及 `t_sys_role_menu` 的菜单绑定均不在范围内。
- 红线基线库 `liq235_red` 里同时暴露了其它迁移（非本单）的 `ER_*` 跳过共 247 条——属存量语料问题，本单只保证 **205 自身**零错误。
