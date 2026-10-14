# S3-203 证据包 · 账号口径三端统一（第 27 项）

> 执行方：阿坚（`/root/s3206_ajian`）｜日期：2026-10-15
> 工作树 `D:\Users\ZXQL\wt-agents\S3-203`｜分支 `feat/s3-203-account-unification`
> 基线 `origin/main = 30bb8994`（取树时）｜交付 HEAD `6e124904`
> ⚠️ 取证期间的 `origin/main` 已前移到 `64731ab5`（本轮并行合并所致），合并前请凌舟按当时 main 复跑一次门禁。

## 一、跑什么（复跑命令全集，均在**工作树根目录**执行）

| # | 命令 | 期望 |
|:--|:--|:--|
| 1 | `node docs/evidence/S3-203/gen-hashes.cjs` | 输出 4 个 `v2$` 哈希 + 6 项自证 `true` |
| 2 | `node docs/evidence/S3-203/verify-migration-200.mjs` | 16 项断言全 `true`，`PASS：全部断言通过`，EXIT=0 |
| 3 | `cd backend && npx vitest run` | 663 文件 / 7972 用例 / **0 failed** |
| 4 | `cd backend && npx tsc -p tsconfig.json --noEmit` | EXIT=0 |
| 5 | `node backend/scripts/guard-route-auth.mjs` | EXIT=0 |
| 6 | `node backend/scripts/guard-tenant-status.mjs` | EXIT=0 |
| 7 | `node backend/scripts/guard-route-prefix.mjs` | EXIT=0 |
| 8 | `node backend/scripts/guard-rbac-wiring.mjs --strict` | EXIT=0 |
| 9 | `npm --workspace backend run build` | EXIT=0 |

> 第 2 条需要 3 个环境变量（**明文口令只在运行时注入，不落任何仓内文件**）：
> `S3203_ADMIN_PW` / `S3203_SM_PW` / `S3203_SO_PW`；口令值由交付回复单独给出。

## 二、原始输出（`outputs/`）

| 文件 | 内容 |
|:--|:--|
| `01-hash-generation.json` | 迁移 200 所用 4 个 bcrypt 哈希 + 6 项"新口令匹配 / 旧口令不匹配"自证 |
| `10-migration-200-console.txt` | 本机 MySQL 8 副本库上**两遍**跑迁移 200 的逐条 `affectedRows` + 16 项断言 |
| `11-migration-200-result.json` | 同上结构化结果（两遍后的行快照对比） |
| `20-reverse-red-isolation.txt` | 反测·双向越权门禁：摘掉 issuer/audience ⇒ **红 2/6** |
| `21-reverse-red-parity.txt` | 反测·跨端权限一致门禁：把硬编码清单塞回 ⇒ **红 3/3** |
| `22-reverse-restored-green.txt` | 反测复原后复跑 ⇒ **绿 9/9** |
| `30-guard-*.log` / `34-final-guard-*.log` | 四条 guard 的原始输出（EXIT=0） |
| `31-backend-build.log` | `npm --workspace backend run build` 原始输出（EXIT=0） |
| `32-vitest-full.log` | 全量 vitest 尾部原始输出（663/7972/0 failed） |
| `33-typecheck.log` | `tsc --noEmit`（EXIT=0，空输出） |

## 三、关键读数（一屏结论）

**迁移 200 两遍（本机 MySQL 8.0.46 副本库 `s3203_account_scope`，零生产写操作）**

```
第一遍写语句 affectedRows = [1,1,2,1]   ← 租户 admin=1、平台 admin=1、门店两账号=2、demo=1
第二遍写语句 affectedRows = [0,0,0,0]   ← 幂等：第二遍零变更（行快照逐字节相同）
```

**口令语义（bcrypt，与 `backend/src/shared/password.ts` 同口径）**：唯一对外账号新口令匹配 ✔、旧公开口令被拒 ✔；
门店两账号新口令匹配 ✔、旧公开口令被拒 ✔；`demo` 已 `status=0` ✔；`store_manager` 被爆破留下的
`login_fail_count=21` 已清零 ✔。

**门禁**：`vitest 663/7972/0 failed`、`tsc EXIT=0`、四条 guard `EXIT=0`、`backend build EXIT=0`。

## 四、副本库的构成（如实标注，勿当"全量真库"读）

- 只建**本迁移触及的 2 张表**：`t_sys_user`（DDL 逐字取自 `backend/src/shared/migration.ts` 的内嵌 DDL）、
  `t_platform_admin`（DDL 逐字取自 `docs/migrations/080_平台管理员.sql`）；**不含**其它业务表。
- 迁移前行由装置灌入：`admin`/`store_manager`/`store_operator` 用**仓内历史迁移的真实哈希**
  （075 / 127），`demo` 行置于租户 `demo`；`store_manager.login_fail_count=21` 复刻生产被爆破态。
- 生产库**零写操作**：本装置只连本机 `127.0.0.1:3408`（S3-194 留下的便携 MySQL 8）；
  生产执行由凌舟经部署通道发起。

## 五、`Demo@2026` 收敛口径（与卡面字面口径的差别，请重点看）

- **有效面（代码/脚本/e2e/前端/README/测试文档/.env.example/mock）⇒ 0 命中**（`rg` 可复核）。
- **历史留痕 ⇒ 保留原字面量、不改写**：`docs/migrations/00x`、`docs/tasks/**`（任务卡/回执/台账）、
  `docs/evidence/**`、`docs/reports/**`、`docs/memories/**` 共 **36 个文件**仍含旧值。
  理由：① 这些是**历史记录与证据**，改写等于篡改留痕；② 本项目已有先例——
  S3-202（第 24/25 项，已合入 main `425fa590`）对同类历史命中采取的就是"加指路注释、不动原字面量"。
  故本单**未**据"全仓 0 命中"改写历史文书，改为**逐类清点 + 请凌舟裁定**（清单见回执 §七）。
