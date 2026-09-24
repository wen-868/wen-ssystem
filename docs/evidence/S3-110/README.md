# S3-110 证据包（类目只读聚合端点 + 上下架状态机 + 迁移 178 逐列拆分 + 积分规则 INSERT 漏列修正）

> 执行方：阿坚（后端 · 本地通道）｜2026-09-25
> 回传卡：`docs/tasks/cards/R101-S3-110-阿坚回传.md`

## 一、本沙箱的环境事实（决定了证据形态）

| 能力 | 状态 | 证据 |
|---|---|---|
| `npx vitest run` | **不可用** | `Error: spawn EPERM`（esbuild `ensureServiceIsRunning`），沙箱禁止 node 创建子进程 |
| `npx tsc -p tsconfig.json --noEmit` | 可用 | 见回传卡 §证据 1 |
| `npx eslint <files>` | 可用 | 见回传卡 §证据 2 |
| MySQL / docker | **无** | `Get-Command mysql,mysqld,docker` 全空；`127.0.0.1:3306` 无监听 |
| `node:sqlite` | 可用（Node v24.18.0） | 用作隔离库替身（**语义等价，非真 MySQL**） |
| git 网络 / gh 写 | 无 | 按派单卡：提交/推送/PR 由凌舟执行 |

## 二、替代跑法（沙箱内真实执行测试文件）

```powershell
$repo = "D:\Users\ZXQL\wt-agents\issue-118"
$hook = "$repo\docs\evidence\C6-1A\sandbox-vitest"   # C6-1A 遗留的 esbuild 假实现 + 注册钩子（复用，未改动）
$env:NODE_OPTIONS = "--import file:///" + ($hook -replace '\\','/') + "/register-hook.mjs"
cd $repo\backend
# 受影响文件
npx vitest run --configLoader native --config "$repo\docs\evidence\S3-110\sandbox-vitest\vitest.config.sandbox.mjs" --pool=threads `
  src/__tests__/routes/platform-s3-110.test.ts `
  src/__tests__/shared/migration-c6-columns.test.ts `
  src/__tests__/services/admin/marketing-points.service.test.ts `
  src/__tests__/controllers/admin/marketing-points.controller.test.ts
# 全量
npx vitest run --configLoader native --config "$repo\docs\evidence\S3-110\sandbox-vitest\vitest.config.sandbox.mjs" --pool=threads
```

凌舟本机/CI 的**标准命令**（无此沙箱限制，两条都要绿）：

```powershell
cd D:\Users\ZXQL\wt-agents\issue-118\backend
npx tsc -p tsconfig.json --noEmit
npx vitest run
```

## 三、反测脚本（沙箱内可复跑，含"会红"证明）

```powershell
cd D:\Users\ZXQL\wt-agents\issue-118

# ③c 迁移 178 逐列幂等（真迁移管线 splitSqlStatements/addTablePrefix/safeExec + 按 MySQL 语句级语义的假连接）
$env:JWT_SECRET='s3-110-probe'; $env:NODE_ENV='test'; $env:LOG_LEVEL='silent'
node --import ./docs/evidence/S3-110/probe/ts-resolve-hook.mjs docs/evidence/S3-110/probe/migration-178-idempotency.mjs

# ③d 积分规则 INSERT（node:sqlite 隔离库；表结构按 071 真 DDL 复刻，INSERT 从生产源码现抽）
node docs/evidence/S3-110/probe/points-insert-1364.mjs
```

`outputs/` 里同时留了**故意制造失败**的对照日志（把 178 还原成合并写法、把 INSERT 还原成漏列写法、
把状态机还原成修复前逻辑/放开到全开、把鉴权摘掉），用于证明这些门禁与断言**确实会红**，不是"跑过即绿"。

## 四、文件清单

| 文件 | 说明 |
|---|---|
| `probe/ts-resolve-hook.mjs` / `probe/ts-resolve-loader.mjs` | 让 node 原生 TS 剥离能解析源码里的无扩展相对导入（用于直接 import 生产 `shared/migration.ts`） |
| `probe/migration-178-idempotency.mjs` | ③c：A 首跑 / B 重跑全 1060 跳过 / C 中间态自愈 + 旧合并写法丢列反证 / D 跳过判定控制组 |
| `probe/points-insert-1364.mjs` | ③d：修复前 1364 等价复现 / 修复后成功 / 请求体覆盖 |
| `sandbox-vitest/vitest.config.sandbox.mjs` | 沙箱内 vitest 配置（复跑用） |
| `outputs/*.log` | 上述脚本与测试的原始输出（含 RED 对照） |
