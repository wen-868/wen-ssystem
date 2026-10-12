# S3-174-F2 证据目录（演示租户隔离 197 —— 补齐"角色行克隆"）

派单：`docs/tasks/inbox/ACTIVE.md`（S3-174-F2）｜判据卡：`docs/tasks/cards/R101-S3-174-F1-凌舟验收-判红-v2.md`
工作区：`D:\Users\ZXQL\wt-agents\issue-279`（分支 `agent/issue-279`，未提交）

## 一、本目录放什么

| 文件 | 内容 |
|:--|:--|
| `tools/s3174-f2-reverse.mjs` | F2 反测与幂等读数装置（4 个 mode） |
| `raw/run-f2-pos-device.txt` | **凌舟的验收装置**跑修好的 197：`11 passed / 0 failed`、`EXIT=0` |
| `raw/run-f2-neg-role-clone.txt` | 反向①：剔除"克隆角色行"整段 ⇒ 仍用**凌舟的装置**跑 ⇒ B/C（含 A）红、`EXIT=1` |
| `raw/run-f2-neg-demo-login-limit.txt` | 反向②：197 两遍后执行一次 `demoLogin()` 的绑定写路径（限定 vs 不限定租户对照） |
| `raw/run-f2-idem-rows.txt` | 逐条语句读数：第二遍 7 条写语句 `changedRows` 全 0（零行变更的原始证据） |
| `raw/run-f2-runner.txt` / `run-f2-runner-state.txt` | **官方执行载体** `scripts/run-migration.mjs` 连跑两遍 + 跑后读数 |
| `raw/run-f2-source-shape.txt` | 静态读数：`auth.service.ts` 超管查询原文（含 `tenant_id = ?`）+ 197 语句流 9 条 |
| `raw/run-f2-vitest-focused.txt` / `run-f2-vitest-full-tail.txt` | 2 个受影响测试文件 41 例通过；后端全量 639 文件 / 7572 例通过（尾部摘要） |
| `raw/run-f2-tsc.txt` | `npx tsc -p tsconfig.json --noEmit` ⇒ `EXIT=0` |

## 二、环境（可复跑的前提）

- 本地 MariaDB `127.0.0.1:3307`（凌舟装置同一实例）；F2 装置自建库 `s3174f2_*`，与凌舟装置的 `s3174v` 隔离。
- 夹具 `ddl*.txt` / `fixtures.txt` = **生产只读导出**（`SHOW CREATE TABLE` + 夹具查询），目录
  `D:\Users\ZXQL\_hygiene-quarantine-20261007\s3174-verify`，与凌舟装置**同一套**，本目录不复制、不改写。
  环境变量：`S3174_VERIFY_DIR`（必填，夹具目录）、`S3174_MIGRATION`（197 路径）、`S3174_DEVICE`（凌舟装置路径）、
  `S3174_DB`（`seed`/`state` 用的库名）、`S3174_AUTH_SRC`（`auth.service.ts` 路径）。

## 三、复跑命令（逐条）

```powershell
cd D:\Users\ZXQL\wt-agents\issue-279

# 正向：凌舟的装置跑修好的 197
$env:S3174_VERIFY_DIR='D:\Users\ZXQL\_hygiene-quarantine-20261007\s3174-verify'
$env:S3174_MIGRATION="$PWD\docs\migrations\197_演示租户隔离.sql"
node D:\Users\ZXQL\ZXQL-MS\wen-ssystem\docs\evidence\S3-174-F1-凌舟复核\tools\s3174-demo-tenant-verify.mjs

# 反向①（剔除克隆角色行整段后仍用凌舟装置跑）/ 反向②（登录写路径限定 vs 不限定）
node docs/evidence/S3-174-F2/tools/s3174-f2-reverse.mjs source-shape
node docs/evidence/S3-174-F2/tools/s3174-f2-reverse.mjs neg-role-clone
node docs/evidence/S3-174-F2/tools/s3174-f2-reverse.mjs demo-login-limit
node docs/evidence/S3-174-F2/tools/s3174-f2-reverse.mjs idem-rows

# 官方执行载体（run-migration.mjs）：先建库，再用后端自己的连接配置跑 197 两遍
$env:S3174_DB='s3174f2_runner'
node docs/evidence/S3-174-F2/tools/s3174-f2-reverse.mjs seed
$runDir="$env:TEMP\s3174-run-f2"   # 该目录下需有一份 .env（DB_HOST/DB_PORT=3307/DB_USER=root/DB_PASSWORD=/DB_NAME=s3174f2_runner）
cd $runDir
node D:\Users\ZXQL\wt-agents\issue-279\scripts\run-migration.mjs D:\Users\ZXQL\wt-agents\issue-279\docs\migrations\197_演示租户隔离.sql
cd D:\Users\ZXQL\wt-agents\issue-279
$env:S3174_DB='s3174f2_runner'
node docs/evidence/S3-174-F2/tools/s3174-f2-reverse.mjs state

# 门禁
cd backend
npx vitest run          # 全量：639 文件 / 7572 例
npx tsc -p tsconfig.json --noEmit
cd ..
```

## 四、反向② 的读数口径（务必连同回传卡 §三 一起读）

判据卡 §三.4 要求"去掉 `DEMO_TENANT` 限定 ⇒ 执行一次 `demoLogin()` 的绑定语句 ⇒ B 或 C 必须变红"。
实测**不成立**：`demoLogin()` 的绑定写是"**缺失才插**"的追加式写入（`INSERT … WHERE NOT EXISTS (user_id, role_id)`），
它不会覆盖迁移已经修好的绑定，因此 B/C 仍为 PASS。反向② 真正暴露的红点是：

1. 该账号**多出一条跨租户绑定**（`role_id=6961` 属 `default`，绑定行 `tenant_id='demo'`）；
2. 登录返回的 roles 出现**重复的 SUPER_ADMIN**（`["STORE_OPERATOR","SUPER_ADMIN","SUPER_ADMIN"]`）；
3. 随后**重跑 197 直接 `ER_DUP_ENTRY` 1062 报错停下**（"按 role_code 重指向"撞 `uk_sys_user_role`）。

对照组（保留 `tenant_id = ?`）三条读数全绿：命中 demo 自己的角色行、登录后 0 条跨租户绑定、重跑 197 无错。
详见 `raw/run-f2-neg-demo-login-limit.txt` 与回传卡 §三/§六（含建议的两条裁定口径）。
