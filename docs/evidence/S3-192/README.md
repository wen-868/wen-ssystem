# S3-192 证据包（租户状态值域收敛 · 第 59 项）

> 执行方：阿坚（后端）｜2026-10-14｜分支 `fix/s3-192-tenant-status-domain`｜基线 `origin/main` = `25728007`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-192`（**未 push、未开 PR**）
> 环境：本机私有 MariaDB 11.4.5（`127.0.0.1:3406`，`sql_mode` 含 `STRICT_TRANS_TABLES`，实测见 `logs/p00-server-readings.log`）

## 〇、本包回答的三个问题

1. **派单卡面 §二.1 的前提对不对？** —— 不对（`t_tenant.status` 不是字符串列，是 **TINYINT**）。
   本包 A 轨把"卡面字面语句"在真库上逐句跑了一遍，给出 errno 与命中的行。
2. **修完以后"到期 ⇒ 租户停用"真的会生效吗？** —— 会。B 轨用**产品自己的迁移管线**建库后跑**产品真作业**，
   给出 `status 1 → 0` + `suspend_reason='订阅已到期'` + 订阅 `ACTIVE → EXPIRED` 的原始读数；反测（旧写法）
   给出 `errno 1366` 且租户**仍为启用**。
3. **门禁是不是真覆盖（而不是靠豁免换绿）？** —— C 轨给两条反测：把越界字面量放回去 ⇒ 红；往收编文件里
   塞一个被禁字面量 ⇒ 红（且只报它，两条已登记只读例外不受影响）。

## 一、目录

| 目录 | 内容 |
|:--|:--|
| `harness/` | 装置：探针 SQL（A 轨）、真迁移管线/真作业脚本（B 轨）、运行器 `run-probes.ps1` / `run-pipeline.ps1` |
| `logs/` | 全部**原始 stdout+stderr**（未加工）：`p*` = A 轨探针、`b*` = B 轨真库、`gate-*` = 门禁、`antitest-*` = 反测 |

## 二、A 轨（探针）：卡面前提订正的原始读数

装置：`harness/01-probe-setup.sql` 建两个最小复现库（**探针数据**，非生产）：

| 库 | `t_tenant.status` 形态 | DDL 出处 |
|:--|:--|:--|
| `s3192_num` | `TINYINT`（1=正常 0=停用） | `backend/src/shared/migration.ts:533-546`（逐字抄） |
| `s3192_str` | `VARCHAR(16)`（'ACTIVE'…） | `docs/migrations/029_add_tenant.sql:19`（逐字抄） |

| 探针 | 命令 | 原始读数 | 文件 |
|:--|:--|:--|:--|
| P1a1 判据 `status = 'ACTIVE'` | 见 SQL | 命中 **`num-disabled`**（status=0）——判据语义反了 | `logs/p02a1-strict-compare.log` |
| P1a2 写侧 `SET status = 'EXPIRED'` | 同上 | **`ERROR 1366 (22007) … Incorrect integer value: 'EXPIRED' for column `s3192_num`.`t_tenant`.`status``** | `logs/p02a2-strict-set-string.log` |
| P1a3 卡面**原语句**（放宽 sql_mode） | 同上 | `affectedRows = 0`（目标行没被匹配）；`status IN ('EXPIRED','SUSPENDED')` 与 `status = 'ACTIVE'` **都只命中 status=0 行** | `logs/p02a3-lenient-literal.log` |
| P2 修复后语句（数值形态） | 同上 | `affectedRows = 1`；`num-active` ⇒ `0` + `订阅已到期` + `suspended_at` 非空；**未误伤**已停用行 | `logs/p02-premise.log` |
| P3 修复后语句（字符串形态，A/B） | 同上 | `affectedRows = 1`；`str-active`（'ACTIVE'）⇒ `0`；其余行不动 | `logs/p03-string-shape.log` |
| P4/P5 迁移 199 订正 + 幂等 + 反测 | `harness/04-probe-199.sql` | 字符串形态：越界 **2 → 0**、第一遍变更 2 行、**第二遍匹配 0 行/变更 0 行**；数值形态：恒 0（no-op）；反测（去掉 WHERE）：**第二遍仍变更 4 行**，复原后 0 | `logs/p04-probe-199.log` |

> 口径提醒：`ROW_COUNT()` 计的是**实际变更**行数（不是匹配行数），故幂等性同时给"匹配行数"与"变更行数"两个量；
> 反测那条把 `suspended_at` 写成 `NOW()`（否则第二遍 SET 值与现值相同、`ROW_COUNT()` 恒 0，会掩盖"每次全表重写"）。

## 三、B 轨（真迁移库 + 真作业）：业务结果

| 步骤 | 命令 | 原始读数 | 文件 |
|:--|:--|:--|:--|
| 用**产品迁移管线**建库（写闸门默认 block） | `harness/run-pipeline.ps1` | `执行外部迁移: 199_租户状态值域收敛.sql` + `写闸门 block 跳过 UPDATE 语句（目标 t_tenant）` | `logs/b1-migrate-gate-block.log` |
| 同上，显式 `MIGRATION_WRITE_GATE=allow` | 同上 | `写闸门=allow（显式配置）` + 执行 199 且**无跳过行** | `logs/b3-migrate-gate-allow.log` |
| 真库列类型 | `USE s3192_full; SHOW COLUMNS FROM t_tenant` | `status  tinyint(4)  YES  MUL  1` | `logs/b4-show-columns-t_tenant.log` |
| **真作业运行期**（`checkSubscriptionExpiry()`，探针租户 + 已过期订阅） | `harness/06-runtime-expiry.mjs` | 前：`status_raw=1 / reason=NULL`；后：**`status_raw=0 / reason=订阅已到期 / has_suspended_at=1`**，订阅 `ACTIVE → EXPIRED`，日志 `[SubscriptionExpiry] 租户 … 已自动停用` | `logs/b5-runtime-expiry.log` |
| 反测：把写侧改回字符串 `'EXPIRED'`（重建 dist 后重跑同一作业） | 同上 | **`errno 1366 Incorrect integer value: 'EXPIRED' for column s3192_full.t_tenant.status`**，租户**仍为 `status_raw=1`**（到期停用静默失败 = 修复前的生产行为） | `logs/antitest-03-runtime-revert.log` |
| 订正后状态分布 | `USE s3192_full; SELECT … GROUP BY` | `0 → 1 行（探针租户）/ 1 → 2 行` | `logs/b6-read-tenant-status.log` |

## 四、C 轨（门禁）

| 项 | 命令 | 读数 | 文件 |
|:--|:--|:--|:--|
| 绿 | `node backend/scripts/guard-tenant-status.mjs` | `EXIT=0`；域内文件 4 → **7**；漏登 0；**已登记放行 3 处逐条打印（含登记上下文）** | `logs/gate-guard-tenant-status.log` |
| 反测①（把订阅到期写侧改回 `'EXPIRED'`） | 同上 | **`EXIT=1`**，`❌ G2 违规 1 条：services/subscription-expiry.service.ts:124 …` ⇒ 收编真的生效 | `logs/antitest-01-revert-expiry-write.log` |
| 反测②（往收编文件顶部塞一个被禁字面量） | 同上 | **`EXIT=1`**，只报注入行（`:6 "PENDING"`）；两条**只读例外**（`AS suspendedTenants` / `AS expiredTenants`）在行号 +1 漂移后**仍按上下文命中** | `logs/antitest-02-inject-into-collected-file.log` |
| 其余门禁 | `npx vitest run` / `npx tsc --noEmit` / `npm --workspace backend run build` / `guard-route-auth` / `guard-route-prefix` | 见回执"验收自评" | `logs/gate-*.log` |

## 五、复跑方式（任意 cwd）

```powershell
# A 轨（探针；只建/改 s3192_* 探针库）
powershell -File docs/evidence/S3-192/harness/run-probes.ps1
# B 轨（真迁移管线 + 真作业；库名 s3192_full）
powershell -File docs/evidence/S3-192/harness/run-pipeline.ps1
# C 轨
node backend/scripts/guard-tenant-status.mjs; echo $LASTEXITCODE
```

## 六、边界与免责（如实登记）

1. **生产库零写操作**；本包全部读数来自本机私有 MariaDB 的**探针库**（`s3192_num` / `s3192_str` / `s3192_anti` / `s3192_full`）。
2. **探针数据是我构造的**（两条最小租户 + 一条过期订阅 + 一个租户），**不是生产读数**；文件里已逐处标注。
3. **生产 `t_tenant.status` 的列类型没有本单内的直接读数**（S3-152 的生产导出只含表名/列名、不含类型）。
   判"TINYINT"的依据是**多份仓内记录**（`shared/migration.ts:539`、`092_租户ID.sql:76`、MIG-1 计划注记
   "与 092 迁移及生产一致"、`R101-C4-0-阿坚清账.md:437`、`169` 的生产注释、S3-150 真库 1366 复现）
   + 本包 A/B 两轨在本机真迁移库上的实测（`tinyint(4)`）。若凌舟在服务器侧取一次
   `SHOW COLUMNS FROM t_tenant LIKE 'status'` 即可闭环。
4. 本包不含生产凭据、不含生产数据行。
