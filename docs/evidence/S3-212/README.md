# S3-212 证据包 · 迁移语料「类型/形状漂移」收口（第 65 项）

> 工作树：`D:\Users\ZXQL\wt-agents\S3-212`｜分支 `fix/s3-212-migration-type-drift`｜基线 `origin/main` = `af599165`
> 本包状态：**未 commit / 未 push / 未开 PR**（红线遵守，由凌舟提交）
> 本卡：`docs/tasks/inbox/ACTIVE-S3-212.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-S3-212.md`

---

## 一、结论（一句话）

**92 组「同表多定义 ⇒ 同列异型」全部收敛（→ 0 组）、28 条外键判定全 compatible（红候选 0）、并在 MySQL 8.0.28 空库把 `173` 的 2 条红清零**；收敛一律取「运行期真值」（同源语料在全新 MySQL 8.0.46 空库跑完后的 `information_schema.COLUMN_TYPE`），因此**结构对照零差异**（表/列/索引/外键四项全 0 条差异）。

## 二、改了什么（2 类 / 19 文件 / 114 处）

### 2.1 类型收敛：113 处「类型 token」替换（18 文件）

- 装置：`tools/corpus-scan.mjs`（带精确字符偏移）→ `tools/plan-convergence.mjs`（定目标值）→ `tools/apply-convergence.mjs`（逐处替换，替换前断言原 token 一致）。
- 替换范围：**只替换类型的字符区间**，列名/约束/默认值/注释/行尾/文件末换行一律不动；`git diff --numstat` 逐文件 ± 对称（无整文件重写、无行尾损坏）。
- 全量 diff：`raw/type-convergence.diff`；逐处清单：`raw/edits-applied.json`；逐组计划：`plan.md`。

| 类别 | 组数 | 说明 |
|:--|--:|:--|
| 只改「无效块」（永不执行） | 86 | 同表被前序文件先建 ⇒ 后续 `CREATE TABLE IF NOT EXISTS` 整条 no-op。属**潜在陷阱**（前序一旦失败就换形状生效），本次一并收敛 |
| 必须改「有效定义块」 | 6 | 见 §2.2（每处都有「后期 ALTER 已在生产改成同一值」的佐证） |

### 2.2 六处「有效定义块」改动（逐条佐证 = 后期 ALTER 已把生产改成同一值）

| 表.列 | 文件:行 | 原 → 新 | 佐证（后期 ALTER，已在 main） | 运行期真值 |
|:--|:--|:--|:--|:--|
| `t_tenant_admin.user_id` | `016_phase9_tenant_subscription.sql:153` | `INT` → `BIGINT UNSIGNED` | `169_tenant_admin_uuid.sql:7` `MODIFY COLUMN user_id BIGINT UNSIGNED` | `bigint unsigned` |
| `t_retail_shop_config.tenant_id` | `017_phase10_instant_retail.sql:26` | `VARCHAR(36)` → `VARCHAR(32)` | `126_retail_tenant_collation_fix.sql:19` | `varchar(32)` |
| `t_retail_category.tenant_id` | `017_phase10_instant_retail.sql:42` | `VARCHAR(36)` → `VARCHAR(32)` | `126_retail_tenant_collation_fix.sql:16` | `varchar(32)` |
| `t_retail_product.tenant_id` | `017_phase10_instant_retail.sql:86` | `VARCHAR(36)` → `VARCHAR(32)` | `126_retail_tenant_collation_fix.sql:17` | `varchar(32)` |
| `t_points_record.source_type` | `071_客户积分.sql:23` | `VARCHAR(20)` → `VARCHAR(32)` | `164_relax_legacy_not_null.sql:5` | `varchar(32)` |
| （同族）`t_tenant_admin.user_id` 的第二份定义 | `034_add_tenant_admin.sql:5` | `INT` → `BIGINT UNSIGNED` | 同 `169` | `bigint unsigned` |

> `t_sys_role.data_scope` 一组：有效定义块**不含该列**（列由后期 ALTER 补），故只把 `008_phase6_schema.sql:73` 的 `ENUM(...)` 收敛成运行期 `VARCHAR(32)`，**不动有效定义**。

### 2.3 `173` 的「AFTER + ALGORITHM=INSTANT」版本收口（本卡 §一.1）

- 原状：前 3 列写成 `ADD COLUMN … AFTER x, ALGORITHM=INSTANT`，MySQL < 8.0.29 **不支持带位置的 INSTANT 加列** ⇒ 本机 8.0.28 空库 `失败 = 2`（1 条连带 `跳过 (ER_BAD_FIELD_ERROR)`），6 列**只落 3 列**（`raw/173-columns-baseline-8028.tsv`）。
- 改法：**按服务器能力分派**（`SET @s3212_ddl_n = IF(...)` + `PREPARE/EXECUTE/DEALLOCATE`，与 `194`/`125` 同族写法）：
  - `MySQL ≥ 8.0.29 且非 MariaDB` ⇒ DDL 字符串与原文**一字不差**（`AFTER … , ALGORITHM=INSTANT`）⇒ **生产（8.0.46）行为零变化**；
  - 其它（8.0.12~8.0.28 / MariaDB）⇒ 只去掉 `ALGORITHM=INSTANT`，位置/类型/默认值/注释完全不变。
- 后 3 列（表尾加列）**不改**：表尾 INSTANT 自 8.0.12 起即支持，原文已绿。
- 被测：8.0.28 修复后 **6/6 列齐全且序号与 8.0.46 逐一相同**（`raw/173-columns-fixed-8028.tsv` vs `raw/173-columns-fixed-8046.tsv`）。
- **生产分支逐字相同（机器比对）**：`tools/probe-173-branch.mjs` 在两个实例上只跑能力探测与「选串」SET（不含 `PREPARE/EXECUTE` ⇒ 不执行 ALTER）：
  - 8.0.46 ⇒ `@s3212_ver_num=80046`、`@s3212_pos_instant_ok=1`，`@s3212_ddl_1..3` 与 `HEAD` 版原文**逐条逐字相同**（`raw/173-branch-probe-8046.txt`）；
  - 8.0.28 ⇒ `@s3212_ver_num=80028`、`@s3212_pos_instant_ok=0`，三条只剩 `AFTER` 位置（`raw/173-branch-probe-8028.txt`）。
- 备选（未采用，理由）：① 去掉 `AFTER` ⇒ 新库列序与生产不一致（新增形状漂移）；② 无条件去掉 `ALGORITHM=INSTANT` ⇒ 等于推翻 C3-0 裁定 §二.6 的「必须显式 INSTANT」，需另请裁定。

## 三、环境与口径（可复现，生产库零写操作）

| 角色 | 实例 | 起法 |
|:--|:--|:--|
| **主口径** | MySQL **8.0.28**（本卡判据要求） | `mysqld --no-defaults --basedir=…mysql-8.0.28-winx64 --datadir=…\_s3212-evidence\mysql8028-data --port=3407 --bind-address=127.0.0.1 --mysqlx=0` |
| CI 同族对照 | MySQL **8.0.46**（= CI `mysql:8.0` 同版本） | 同上，`--port=3416` |
| 基线对照树 | `wt-agents/S3-212-base`（`origin/main` 未改，`0b48d663`） | 独立工作树 + 独立库 `s3212b_46` |

- 每个用例都 `DROP DATABASE; CREATE DATABASE;`（不带 charset ⇒ 继承服务器默认）后，以产品路径 `node backend/dist/server.js`（`NODE_ENV=production`）跑完整迁移，等 `/health` 200 后停进程，再统计日志里的 `失败`（`raw/0*/mig.log`，装置 `harness/run-case.ps1`）。
- **生产库零写操作**：全程只连本机 3407/3416；未连生产、未做任何 gh/写操作（生产库**不可达**，见 §四）。
- 每个用例目录都有 `fingerprint.txt`（HEAD / 语料 sha256 / dist sha256 / 库与端口 / 时间），防「并行会话污染读数」。
- **实例仍在跑**（供凌舟直接复跑）：MySQL 8.0.28 @ `127.0.0.1:3407`、MySQL 8.0.46 @ `127.0.0.1:3416`（`root` / 空口令），datadir 均在 `wt-agents\_s3212-evidence\`；不再需要时停进程后删该 datadir 即可（`3408` 是 S3-194 起的共享实例，**本单未触碰**）。

## 四、生产真值：不可达 + 回退口径（本卡 §二.2）

- 探针 `tools/probe-db.mjs` 实测：仓内 `.env`（`backend/.env`、`ZXQL-OPS/ops-release/backend/.env`、`zhixiang-ops-backend/.env`）全部指向 `127.0.0.1:3306`，**ECONNREFUSED**；本机 3306 无监听（`踩坑日志[158]` 同款环境）；部署机凭据只在 GitHub Secrets（`deploy/**`、`docs/部署文档.md`），MIG-1 亦记「真库副本须由凌舟提供」。⇒ **本工作区取不到生产 `information_schema`**。
- 回退口径（卡面授权的第二顺位）：**运行期真值** = 同一套语料在全新 MySQL 8.0.46 空库跑完后的 `information_schema.COLUMN_TYPE`（= 该语料真实产出的列定义；生产库是同一套语料建起来的）⇒ **92/92 组都能对到运行期原文**（`raw/runtime-columns-8046.tsv`，逐组见 `plan.md`「运行期真值」列），**无一组走「最窄回退」**。
- 凌舟若要补「生产原文对照」，一键命令（只读）：

```sql
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND CONCAT(TABLE_NAME,'.',COLUMN_NAME) IN (
     't_sys_user.id','t_sys_user.username','t_sys_role.id','t_sys_user_role.id','t_store.status',
     't_tenant_admin.user_id','t_points_record.source_type','t_retail_shop_config.tenant_id',
     't_brand.tenant_id','t_error_logs.tenant_id','t_subscription.tenant_id','t_price_change_log.tenant_id',
     /* 其余 80 组见 docs/evidence/S3-212/plan.md 第 1 列 */ 't_retail_order.tenant_id')
 ORDER BY TABLE_NAME, COLUMN_NAME;
```

> 预期：与 `plan.md` 的「运行期真值」列一致（6 处有效定义改动另外有 §2.2 的后期 ALTER 佐证，不依赖本次读数）。

## 五、用例矩阵与关键读数（`raw/0*/`）

| # | 用例 | 引擎 | 语料 | `/health` | `失败` | `跳过` | 备注 |
|:--|:--|:--|:--|:--:|--:|--:|:--|
| 01 | 基线（未改） | 8.0.28 | `origin/main` | 200 | **2** | 452 | 两条 `173 … ALGORITHM=INSTANT is not supported`；`t_library_api_key` 6 列只落 3 列（多出的 1 条跳过＝`scopes` 连带 `ER_BAD_FIELD_ERROR`） |
| 02 | 基线（未改） | **8.0.46** | `origin/main` | 200 | 0 | 451 | CI 同族同版本基线 |
| 03 | **修复后** | **8.0.28** | 本分支 | 200 | **0** | 451 | 6 列 6/6，序号与 8.0.46 一致（跳过数降到与 8.0.46 同值） |
| 04 | **修复后** | 8.0.46 | 本分支 | 200 | **0** | 451 | 跳过数与基线**同值** ⇒ 未新增被跳过语句 |
| 05 | 幂等·第二遍（同库） | 8.0.46 | 本分支 | 200 | 1 | 768 | 唯一红＝`069 … Duplicate foreign key constraint name 'fk_product_spu_brand'`（**先于本单存在**，见 §7.3） |
| 06 | 基线对照树·第一遍 | 8.0.46 | `origin/main` | 200 | 0 | 451 | 对照树 `S3-212-base` |
| 07 | 基线对照树·第二遍 | 8.0.46 | `origin/main` | 200 | 1 | 768 | **与 05 同形**（同一条 069 红、同一个 768） |

### 5.1 结构对照（`tools/compare-db.mjs`，`compare/`）

| 对比 | 表 | 列 | 索引 | 外键 |
|:--|:--|:--|:--|:--|
| **C1** 02 基线 → 04 修复后（同 8.0.46） | 0 / 0 | **0 / 0** | 0 / 0 | 0 / 0 |
| C2 04 第一遍 → 05 第二遍（幂等） | 0 / 0 | **0 / 0** | **18 / 0** | 0 / 0 |
| C3 06 第一遍 → 07 第二遍（对照树） | 0 / 0 | **0 / 0** | **18 / 0** | 0 / 0 |

- **C1 全零** = 113 处类型收敛**没有改变新库结构**（逐字证明「只做形状收敛、不动语义」）。
- C2/C3 的 18 条索引（`120c_performance_indexes.sql` 的 `ADD INDEX`，第一遍报 `ER_KEY_COLUMN_DOES_NOT_EXITS`（列尚未由后续迁移补出）⇒ 第二遍才建成）：**基线与修复后逐条相同** ⇒ 属**存量**幂等缺陷，**非本单引入**。

### 5.2 扫描装置读数（`tools/`）

| 口径 | 基线 | 修复后 |
|:--|:--|:--|
| 扫描源 / CREATE TABLE 块 / 归一表 | 205 / 429 / 313 | 205 / 429 / 313 |
| **同表多定义 ⇒ 同列异型** | **92 组** | **0 组**（`scan-final`） |
| 外键声明 | 28（含 3 条非有效块红候选：`008` 的 `statement_id`/`user_id`/`role_id`） | 28 全 compatible，**红候选 0** |

> 口径更正（重要，写进回执）：`fk-scan.mjs`（S3-194）把 `migration.ts` 内嵌 DDL 一律记为 `order=0`（最先）。实测**不成立**：`migration.ts` 的兜底建表在**第 5.5 步**，晚于 `init_database.sql` 的**第 1.5 步**（`migration.ts:606` / `:763`）。证据：`t_store_control_config` 运行期结构 = `init_database.sql:288` 的定义（`id int unsigned` / `max_order_amount decimal(10,2)` / `suspended_reason varchar(500)` / `UNIQUE store_id`），**而非** `migration.ts:791` 的 5.5.1b 定义。本单装置 `tools/corpus-scan.mjs` 已按真实顺序修正（`migration.ts` 分 0/2 两段）。

## 六、门禁（`gates/`，全在修复后工作树跑）

| 门禁 | 命令 | 结果 |
|:--|:--|:--|
| 全量测试 | `npx vitest run`（`backend/`） | **668 文件 / 8081 用例 / 0 failed**，EXIT=0 |
| 类型检查 | `npx tsc -p tsconfig.json --noEmit` | **EXIT=0**（输出空） |
| 路由鉴权 | `node backend/scripts/guard-route-auth.mjs` | **EXIT=0** |
| 租户状态域 | `node backend/scripts/guard-tenant-status.mjs` | **EXIT=0** |
| 路由前缀 | `node backend/scripts/guard-route-prefix.mjs` | **EXIT=0** |
| RBAC 接线 | `node backend/scripts/guard-rbac-wiring.mjs --strict` | **EXIT=0**（未登记 0 条） |
| 租户注入 | `node backend/scripts/guard-tenant-injection.mjs` | **EXIT=0**（GREEN 无阻塞项） |
| 编码 | `node backend/scripts/guard-utf8-encoding.mjs` | **EXIT=0**（2146 文件 / 0 非法字节 / 0 处 U+FFFD） |
| 构建 | `npm --workspace backend run build` | **EXIT=0** |

## 七、反测（证明判据会红，而非「没报错」）

1. **语料扫描器**：基线读数 **92 组 ≠ 0**（会报非零，且逐组点名）→ 修复后 **0 组**。装置不是「恒绿」。
2. **8.0.28 空库实跑**：未改语料（用例 01）⇒ `失败=2` 且 `t_library_api_key` 6 列只 3 列；改后（用例 03）⇒ `失败=0` 且 6/6 列。**红→绿同装置、同库、同命令**。
3. **对照树反证（新发现的两个红点不是本单造成的）**：`S3-212-base`（未改的 `origin/main`）在同一库序列上复现**同一**条 `069` 重名外键红与**同一** 18 条索引增量（用例 06/07 + C3）。

## 八、未覆盖 / 范围外（未改，登记）

1. **`120c_performance_indexes.sql` 的 18 条索引只在第二遍建成**（第一遍 `ER_KEY_COLUMN_DOES_NOT_EXITS`）⇒ 「同库连跑两遍零变更」在**索引**这一维度上不成立（表/列/外键维度成立）。基线与修复后**同形** ⇒ 存量缺陷。
2. **`069_商品SPU增加品牌ID.sql` 第二遍必红**（`Duplicate foreign key constraint name 'fk_product_spu_brand'`）——重跑无守卫；首遍绿。基线与修复后**同形**。
3. **`173` 的 `qps`/`scopes` 列位置**：8.0.28 分支走的是非 INSTANT 路径（`AFTER` 生效 ⇒ 需重建表）；仅影响低版本服务器，不影响 8.0.29+。
4. **生产真值未取到**（§四）：本单用「运行期真值 + 后期 ALTER 佐证」替代，**凌舟可用 §四 的只读查询一次核完**。

## 九、一键复跑

```powershell
# 0) 起两个实例（若未在跑）
mysqld --no-defaults --basedir=<mysql-8.0.28-winx64> --datadir=<…\_s3212-evidence\mysql8028-data> --port=3407 --bind-address=127.0.0.1 --mysqlx=0
mysqld --no-defaults --basedir=<mysql-8.0.46-winx64> --datadir=<…\_s3212-evidence\mysql8046-data> --port=3416 --bind-address=127.0.0.1 --mysqlx=0

# 1) 语料扫描（期望 divergences=0）
node docs\evidence\S3-212\tools\corpus-scan.mjs . ..\..\_s3212-evidence\scan-final\corpus-scan.json
# 2) 8.0.28 空库实跑（期望 失败命中数 = 0、health200 = True）
powershell -NoProfile -File docs\evidence\S3-212\harness\run-case.ps1 -Repo . -DbName s3212_fix28 -Port 8099 -Tag 03-fixed-mysql8028 -DbPort 3407
# 3) 8.0.46 空库实跑 + 与基线结构对照（期望四项 0/0）
powershell -NoProfile -File docs\evidence\S3-212\harness\run-case.ps1 -Repo . -DbName s3212_base46 -Port 8098 -Tag 02-red-baseline-mysql8046 -DbPort 3416 -MyBin <mysql-8.0.46-winx64\bin>
powershell -NoProfile -File docs\evidence\S3-212\harness\run-case.ps1 -Repo . -DbName s3212_fix46  -Port 8100 -Tag 04-fixed-mysql8046 -DbPort 3416 -MyBin <mysql-8.0.46-winx64\bin>
node docs\evidence\S3-212\tools\compare-db.mjs 127.0.0.1 3416 s3212_base46 s3212_fix46 out.md
```
