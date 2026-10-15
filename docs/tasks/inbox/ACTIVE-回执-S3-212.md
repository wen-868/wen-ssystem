【汇报 S3-212】S3-212 第 65 项：迁移语料类型/形状漂移已全量收敛（同列异型 92→0 组、外键红候选 3→0、MySQL 8.0.28 空库 `失败` 2→0），且**新库结构零差异**

汇报对象：凌舟（总负责人）
汇报人：阿坚（后端/迁移）｜2026-10-15

交付物（分支 `fix/s3-212-migration-type-drift`，基线 `origin/main` = `af599165`；**本地未提交 / 未 push / 未开 PR**）

| # | 交付物 | 位置 |
|:--|:--|:--|
| 1 | 类型收敛 113 处（18 文件，只替换类型 token，逐处有原文断言） | `raw/edits-applied.json`、`raw/type-convergence.diff` |
| 2 | `173` 位置加列的版本收口（前 3 列按服务器能力分派：≥8.0.29 与非 MariaDB 才用 `ALGORITHM=INSTANT`） | `docs/migrations/173_open_platform_api_key_columns.sql:1-40` |
| 3 | 92 组全量清单 + 目标值依据 + 影响面 | `docs/evidence/S3-212/plan.md`、`divergences-baseline.md` |
| 4 | 证据包（装置 + 7 个用例 + 结构对照 + 门禁） | `docs/evidence/S3-212/README.md`、`raw/`、`compare/`、`gates/`、`tools/`、`harness/` |
| 5 | `173` 生产分支「逐字相同」机器比对装置与读数 | `tools/probe-173-branch.mjs`、`raw/173-branch-probe-8046.txt`、`raw/173-branch-probe-8028.txt` |

证据（可复跑；命令与原始输出见 `docs/evidence/S3-212/README.md` §九）

1. **MySQL 8.0.28 空库实跑**：`powershell -NoProfile -File docs\evidence\S3-212\harness\run-case.ps1 -Repo . -DbName s3212_fix28 -Port 8099 -Tag 03-fixed-mysql8028 -DbPort 3407`
   ⇒ `server = 8.0.28`、`health200 = True`、**`失败命中数 = 0`**（`raw/03-fixed-mysql8028/mig.log`）；对照未改语料：**`失败命中数 = 2`**（`raw/01-red-baseline-mysql8028/mig.log:639,640` 两条 `173 … ALGORITHM=INSTANT is not supported`）。
   `t_library_api_key` 6 列：修复后 **6/6 且序号与 8.0.46 逐条相同**（`raw/173-columns-fixed-8028.tsv`）；未改前**只 3 列**（`raw/173-columns-baseline-8028.tsv`）。
2. **语料扫描（同列异型）**：`node docs\evidence\S3-212\tools\corpus-scan.mjs . <out.json>` ⇒ 基线 `divergences=92`（`raw/` 同源报告 `divergences-baseline.md`）、修复后 **`divergences=0`**（`docs/evidence/S3-212/README.md` §5.2）。
3. **外键一致性**：`node tools\fk-scan.mjs . <out>`（S3-194 装置）⇒ 修复后 **28 条判定全 compatible、红候选 0**（含 `008` 的 3 条非有效块红候选）。
4. **结构对照（最关键的一条）**：`node docs\evidence\S3-212\tools\compare-db.mjs 127.0.0.1 3416 s3212_base46 s3212_fix46 out.md` ⇒ 表 / 列 / 索引 / 外键 **0-0 / 0-0 / 0-0 / 0-0**（`compare/C1-base46-vs-fix46.md`）＝ 113 处收敛**没有改变新库结构**。
5. **门禁**：`npx vitest run`（backend）**668 文件 / 8081 用例 / 0 failed**（`gates/vitest-full.txt` 尾部）、`npx tsc -p tsconfig.json --noEmit` **EXIT=0 / 输出 0 行**（`gates/tsc-noEmit.txt`）、`guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` / `guard-rbac-wiring --strict` / `guard-tenant-injection` / `guard-utf8-encoding`（2146 文件 0 非法字节）全 **EXIT=0**、`npm --workspace backend run build` **EXIT=0**（`gates/`）。
6. **反测（证明判据会红）**：① 扫描器基线读数 92 ≠ 0（会报非零并逐组点名）；② 8.0.28 空库未改语料 2 红 / 改后 0 红（同装置同库同命令）；③ 对照树 `wt-agents/S3-212-base`（未改 `origin/main`）在同库序列上复现**同一条** `069` 重名外键红与**同一** 18 条索引增量。
7. **`173` 生产分支逐字相同（机器比对）**：`node docs\evidence\S3-212\tools\probe-173-branch.mjs 3416`（只跑能力探测 + 选串 SET，**不含 `PREPARE/EXECUTE` ⇒ 不执行 ALTER**）⇒ `@s3212_pos_instant_ok=1`，`@s3212_ddl_1..3` 与 `HEAD` 版原文**逐条逐字相同**（脚本侧 `-eq` 比对 True/True/True）；`…probe-8028.txt` ⇒ `=0`，三条只剩 `AFTER`。

验收自评（逐条对照卡面 §三 / §二）

| 卡面条目 | 结果 | 依据 |
|:--|:--|:--|
| §三.1 MySQL 8.0.28 全新空库 `失败 = 0`（含 173 两条） | **通过** | 用例 03：失败 0；对照用例 01：失败 2 |
| §三.2 同列异型收敛 ⇒ 剩余组数 = 0 | **通过** | 92 → 0 |
| §三.3 每个类型对到 `information_schema` 原文 | **部分通过（口径降级并报备）** | 生产库**不可达**（见「未完成与阻塞」1）；改用「运行期真值」= 同源语料在全新 8.0.46 空库的 `COLUMN_TYPE`，**92/92 组**全部对到原文（`raw/runtime-columns-8046.tsv` + `plan.md`）；6 处有效定义改动另有「后期 ALTER 已在生产改成同一值」的逐条佐证 |
| §三.4 同一库连跑两遍零变更 | **部分通过** | 表 / 列 / 外键 **0 变更**；**索引 +18 条**（存量缺陷，基线与修复后**同形**：`compare/C2` vs `compare/C3`） |
| §三.5 vitest / tsc / 三条 guard + `guard-rbac-wiring --strict` + `guard-tenant-injection` / build | **通过** | 见上「证据」5 |
| §二.1 先出全量清单（含影响面 + 是否有效定义） | **通过** | `plan.md`（逐组）+ `divergences-baseline.md`（逐组出现处 文件:行） |
| §二.2 定性每组正确值（生产为唯一权威，取不到则最窄回退） | **通过（降级为运行期真值）** | 92/92 有运行期原文；**无一组走最窄回退** |
| §二.3 逐组收口，只改类型/形状、登记已执行迁移的修订 | **通过** | 113 处类型 token + `173` 修订；登记文本见「交付物/待凌舟落笔」 |
| §二.4 不新建迁移 | **通过** | 未新增/删除任何迁移文件（`git status` 仅 19 个既有文件 + 证据目录） |

未完成与阻塞

1. **生产 `information_schema` 取不到（阻塞点，需你出手）**：`tools/probe-db.mjs` 实测仓内全部 `.env` 指向 `127.0.0.1:3306` 且 `ECONNREFUSED`；部署凭据只在 GitHub Secrets（`deploy/**`、`docs/部署文档.md`、MIG-1 亦记「真库副本须由凌舟提供」）。请你按 `docs/evidence/S3-212/README.md` §四 的只读查询核一遍（92 组，一条 SQL）；若与「运行期真值」有差异，给我只读通道或差异清单，我按差异重算（改法＝换一个 runtime TSV 参数）。
2. **索引维度的幂等缺口（存量，未修，越出本卡范围）**：`120c_performance_indexes.sql` 18 条 `ADD INDEX` 第一遍报 `ER_KEY_COLUMN_DOES_NOT_EXITS`、第二遍才建成 ⇒ 「连跑两遍零变更」在索引维度不成立。基线与修复后逐条相同。
3. **`069_商品SPU增加品牌ID.sql` 重跑必红（存量，未修）**：`Duplicate foreign key constraint name 'fk_product_spu_brand'`（首遍绿、第二遍红）。
4. 未做 CI 侧验证（红线禁 push/PR）；未跑 MariaDB 对照（卡面 §四：MariaDB 绿不算绿 ⇒ 判据只取 MySQL 8.0.28 + 8.0.46）。
5. 共享树 `docs/tasks/inbox/ACTIVE.md` 路由表与 `docs/tasks/current-tasks.md` **我未动**（并行会话仍在跑，沿用 S3-190/S3-210 先例）；本卡副本归档在本分支 `docs/tasks/inbox/archive/`，请你记账。

风险与自我报备

1. **我动了 `backend/src/shared/migration.ts`（3 处类型 token）**：位置是第 5.5 步的兜底建表 `t_store_control_config`（迁移语料内嵌 DDL，非业务代码）。该块**被 `init_database.sql` 覆盖 ⇒ 永不执行**，C1 结构对照零差异 ⇒ 运行时无影响。若你认为「migration.ts 一行也不许动」，回退仅这 3 处 token 即可（其余 110 处不受影响）。
2. **口径降级**：卡面要求「生产 `information_schema` 为唯一权威」，我用了「运行期真值」并已显式报备（三者关系：生产库 = 同一套语料建起来的 ⇒ 运行期真值是其最接近的可得代理）。若你判定必须用生产原文，本单结论**可能**要在 6 处有效定义改动上复核（其余 86 组只改无效块，与生产无关）。
3. **我修正了 S3-194 装置的一个口径**（未改其产物）：`fk-scan.mjs` 把 `migration.ts` 内嵌 DDL 一律记为最先（`order=0`），实测不成立——第 5.5 步的兜底建表**晚于** `init_database.sql` 的第 1.5 步（`migration.ts:606` / `:763`）。佐证：`t_store_control_config` 运行期结构 = `init_database.sql:288` 的原文，而非 `migration.ts:791` 的 5.5.1b 原文。⇒ 其 README §七「有效定义」标注需回填更正（**92 组 / 红候选计数不受影响，只影响「哪一块算有效」**）；我另写了带正确顺序的 `tools/corpus-scan.mjs`（未动 S3-194 的 `fk-scan.mjs` 原文件，仅复制到本单证据区使用）。是否回填更正说明，请你裁定。
4. **3 处「收窄」方向与卡面「最窄即最兼容」措辞同向、但与"UUID 36 位"直觉相反**：`t_retail_shop_config/t_retail_category/t_retail_product.tenant_id` 收敛为 `VARCHAR(32)`——依据是运行期真值（`126_retail_tenant_collation_fix.sql` 已在 main 把这三列改成 32）。若业务上应回到 36（UUID 语义），那是**语义裁定**，请明示，我改回并另立单（本单不擅自动语义）。
5. **`173` 的改法含动态 DDL**（`SET @sql = IF(...)` + `PREPARE/EXECUTE/DEALLOCATE`，与既有 `194`/`125` 同族）。若你更偏好「直接删掉 `ALGORITHM=INSTANT`」这种更简单的改法，请裁定——代价是推翻 C3-0 裁定 §二.6 的显式 INSTANT 要求，我没有擅自那样做。
6. **基线漂移报备**：本树基线 `af599165`；执行期间 `origin/main` 已前进到 `0b48d663`（`#327` S3-210 门禁/接线、`#328` 收口总清单文档）。已核 `git diff --name-only af599165 origin/main` 与我的改动文件集**无重叠**（58 个文件均不含 `docs/migrations/**`、`docs/init_database.sql`、`migration.ts`）。
7. 未做：未跑 codeql / a11y（不在本卡门禁内）；未做备份/回滚演练（本单零 DML、零生产写）。

待凌舟落笔（我不动这两个文件）

**A. `docs/数据库变更清单.md`（建议追加在「三、迁移脚本执行记录」之后）**：

```markdown
## 2026-10-15 修订（阿坚 · S3-212 —— 迁移语料类型/形状漂移收口，第 65 项）

| 编号 | 文件 | 性质 | 说明 | 状态 |
|:--|:--|:--|:--|:--|
| 173 | `173_open_platform_api_key_columns.sql` | **修订**（S3-212） | 前 3 列原为 `ADD COLUMN … AFTER x, ALGORITHM=INSTANT`，MySQL < 8.0.29 不支持「带位置 INSTANT 加列」⇒ 本机 8.0.28 空库 2 红、6 列只落 3 列。改为按服务器能力分派（≥8.0.29 且非 MariaDB ⇒ 与原文一字不差的 INSTANT 分支；其它 ⇒ 仅去掉算法子句）。列名/类型/默认值/注释/位置全部不变，**生产（8.0.46）分支与改动前逐字相同**。回滚：还原为原 3 条直写 ALTER | ✅ 8.0.28 空库 `失败=0`、6/6 列且序号与 8.0.46 一致；8.0.46 结构对照零差异 |
| 001/006/007/008/016/017/020/029/034/068/070/071/074/108/120d/163 + `docs/init_database.sql` + `migration.ts` | **修订**（S3-212） | 92 组「同表多定义 ⇒ 同列异型」收敛：113 处**只改类型 token**，目标值＝运行期真值（全新 MySQL 8.0.46 空库 `information_schema.COLUMN_TYPE`）。其中 6 处为「有效定义块」改动，均与既有后期 ALTER（`126`/`164`/`169`）口径一致；其余 107 处落在**永不执行**的重复定义块（潜在陷阱）。**零 DML、零新增迁移** | ✅ 扫描器 92→0 组；外键红候选 3→0；新库结构对照零差异 |
```

**B. 若你要把「同列异型 = 0」做成常驻门禁**（本单未做，因为红线禁改 `.github/**`）：建议新增 `backend/scripts/guard-migration-type-drift.mjs`（直接用本单 `tools/corpus-scan.mjs` 的 `divergences.length === 0` 作判据），按「观察期 job（非 required）」先跑 10 次；**反测方法**：把任一无效块的类型改回旧值 ⇒ 该脚本必须红（本单已验证扫描器能报非零）。

回传要求：本汇报已落卡 `docs/tasks/cards/R101-S3-212-阿坚-回传.md`（与本文件一致），并写入共享树 `docs/tasks/inbox/ACTIVE-回执-S3-212.md`
关联卡：`docs/tasks/inbox/archive/ACTIVE-S3-212-20261015.md`（原 `docs/tasks/inbox/ACTIVE-S3-212.md`）｜证据包：`docs/evidence/S3-212/README.md`
