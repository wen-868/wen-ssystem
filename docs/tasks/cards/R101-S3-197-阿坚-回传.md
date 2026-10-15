# ACTIVE 回执 · S3-197（迁移语料残留收口：093 裸表名 3 条 · 命名双轨冗余索引 · 10 条跳过定性）

```
【汇报 R101-S3-197】第 60 项三项收口：093 的 3 条 CREATE INDEX 真实建出（addTablePrefix 补 CREATE INDEX…ON 模式，语料未动）；tenant_id 索引命名双轨族 69 条一次清完（重复组 71→15、索引 1622→1563）；10 条跳过逐条定性（120c=5 不建表、092=2 意图已满足、169=3 已随 S3-194 消除）；空库结构与「语料意图基线」差异 0、失败 0；两条反测两侧齐
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 迁移 · 本地子代理通道 /root/s3200_ajian）｜2026-10-14
交付物：工作树 D:\Users\ZXQL\wt-agents\S3-197｜分支 fix/s3-197-migration-residue｜分支 HEAD = 53001ab9（代码/语料主提交 7fb0d9b7 + 证据包 README 笔误修正 53001ab9；本地提交，未 push、未开 PR）｜基线 origin/main = dd9acede
  ① backend/src/shared/migration.ts（8167BED3DA849730 → D6A5F202850DB5BF，+6/−0）
  ② docs/migrations/092_租户ID.sql（ECA62DBE18874C1B → 9204BBF232D45C3E，+132/−124）
  ③ docs/migrations/010_phase7_credit_tenant.sql（C97CD611F85D5D63 → 1D80FB7D3C017FE9，+9/−3）
  ④ docs/migrations/012_phase7_price_tenant.sql（27D55D5075F8EBD6 → 6ECFF7D4DB728717，+10/−4）
  证据包：docs/evidence/S3-197/（README.md + harness/ 11 个装置 + outputs/ 全部原始读数）
证据（可复跑）：MySQL 8.0.46（CI 同版本）@127.0.0.1:3456 空库整轮；复跑命令逐条见 docs/evidence/S3-197/README.md §九
验收自评：卡面 §三 四条 + §四 两条反测 —— 逐条见 §四 / §五
未完成与阻塞：见 §六（无阻塞；有两项需你裁定：①第①/②项目标冲突的取舍 ②既有库去重是否单开 DDL）
风险与自我报备：见 §七（含"改动面超出卡面点名的 6 个"的主动报备）
回传要求：本汇报已落卡：docs/tasks/cards/R101-S3-197-阿坚-回传.md
关联卡：docs/tasks/inbox/archive/ACTIVE-S3-197-20261014.md
```

派单人：凌舟（总负责人）｜2026-10-14
汇报人：阿坚（后端 / 迁移）｜2026-10-14

---

## 一、交付物（逐文件 + 哈希 + 状态）

工作树 `D:\Users\ZXQL\wt-agents\S3-197`｜分支 `fix/s3-197-migration-residue`｜基线 `origin/main = dd9acede`（**含 S3-194 的外键修复**，这是"MySQL 8 空库 0 失败"的前置）。
提交：**`7fb0d9b7`**（`fix: 迁移语料残留收口（S3-197，收口总清单第 60 项）`）+ **`53001ab9`**（证据包 README 一处哈希排版笔误），分支 HEAD = `53001ab9`；均为本地提交，**未 push / 未开 PR**。`git status` 干净，提交内容 = 4 个改动文件 + `docs/evidence/S3-197/`（证据包）。

| 文件 | sha256(16) 前 → 后 | numstat | 改动 |
|:--|:--|:--|:--|
| `backend/src/shared/migration.ts` | `8167BED3DA849730` → `D6A5F202850DB5BF` | +6 / −0 | `addTablePrefix()` 模式表补 `CREATE INDEX … ON <表名>`（含 S3-197 注释说明根因） |
| `docs/migrations/092_租户ID.sql` | `ECA62DBE18874C1B` → `9204BBF232D45C3E` | +132 / −124 | 62 条索引名归一到既有规范命名（每块改 `SET @s3186_name` + 跳过标签）+ 文件头 8 行说明 |
| `docs/migrations/010_phase7_credit_tenant.sql` | `C97CD611F85D5D63` → `1D80FB7D3C017FE9` | +9 / −3 | 3 条同族索引名归一 + 文件头说明 |
| `docs/migrations/012_phase7_price_tenant.sql` | `27D55D5075F8EBD6` → `6ECFF7D4DB728717` | +10 / −4 | 4 条同族索引名归一 + 文件头说明 |

**未动**：业务路由/控制器/服务（`migration.ts` 里也只动 `addTablePrefix` 的模式表）、`.github/**`、`deploy/**`、`R101-收口总清单.md`、`docs/数据库变更清单.md`、其它迁移语料、`ACTIVE.md` 路由表、`current-tasks.md`、记忆文件。
**数据库**：只用本机 MySQL 8.0.46（8.0.28 仅作版本敏感性对照，见 §四.4）；**全程未接触 3406 的 MariaDB**，生产库零写操作。

---

## 二、三项缺陷与修复（结论先行）

| 项 | 缺陷 | 根因 | 修复 |
|:--|:--|:--|:--|
| **60①** | `093_库存增加租户ID.sql:12/13/14` 的 `CREATE INDEX idx_tenant_ib ON inventory_balance(tenant_id)` 恒 `ER_NO_SUCH_TABLE`，3 个索引从未建出 | `addTablePrefix()`（`migration.ts:91`）的模式表**没有 `CREATE INDEX … ON`**，`ON` 后的裸表名永不补前缀 | 补该模式（**选"根因修"**：一次覆盖同类；语料侧写全会把前缀责任散落到每份语料。语料 `093` **一字未改**） |
| **60②** | 索引名双轨：语料 `idx_<表名去 t_>_tenant` vs `migration.ts` 第2步 `idx_t_<表名>_tenant` ⇒ 同表同列两个索引 | 两套机制各自命名（第2步程序化 + 092 第3步语料），无统一规范 | 把**可证为纯重复**的 69 条语句统一到既有规范命名（092 62 + 010/012 7），改名后守卫命中"已存在"而跳过 ⇒ 净效果**只少重复项** |
| **60③** | 10 条 `ER_NO_SUCH_TABLE` 未定性 | 见 §五 | 逐条定性；`120c=5` 不修（不得凭空建表）、`092=2` 无需修（意图已由建表文件满足）、`169=3` **在 CI 同版本 MySQL 8.0.46 上已不再出现** |

---

## 三、原始读数（可复跑）

### 3.1 三态整轮（MySQL 8.0.46 空库、产品 `runMigrations()` 真实路径）

| 用例 | 语料 sha32 | `migration.ts` sha16 | 失败行 | `ER_NO_SUCH_TABLE`（文件标签） | 表/列/索引 | 结构 sha256 |
|:--|:--|:--|:--:|:--|:--|:--|
| **pre**（origin/main 原样） | `2E1A94A1…` | `8167BED3DA849730` | 0 | `092=2 / 093=3 / 120c=5`（10） | 312/4154/**1622** | `f5e3df7b…` |
| **base**（语料意图 + 原代码） | `3135BBB8…` | `8167BED3DA849730` | 0 | `092=2 / 120c=5`（7） | 312/4154/**1563** | `332b3f8f…` |
| **post**（被测：修复后） | `1005D07E…` | `D6A5F202850DB5BF` | 0 | `092=2 / 120c=5`（7） | 312/4154/**1563** | `332b3f8f…` |
| **f2red**（第②项反测） | — | `D6A5F202850DB5BF` | 0 | 28 | 312/4154/**1625** | — |

### 3.2 判据 1：结构与"语料意图基线"差异 **0**

`diff(base-snapshot, post-snapshot)` ⇒ **差异合计 = 0**（缺表/多表/缺列/多列/缺索引/多索引/列定义不一致 **全 0**），两者结构 sha256 逐字相同 `332b3f8f9fe67332…`。
基线口径沿用 S3-190 §四：同一套 `dd9acede` 语料，把**应当带前缀的表名手工写全**（本单只有 `093` 这一处），`migration.ts` **保持原样** ⇒ 与被测树构成"代码修 / 语料修"两条独立路径。

### 3.3 第①项：语句级探针 + 库内直证

```
1  修复前  CREATE INDEX idx_tenant_ib ON inventory_balance(tenant_id);    ER_NO_SUCH_TABLE: Table 's3197_pre.inventory_balance' doesn't exist
1  修复后  CREATE INDEX idx_tenant_ib ON t_inventory_balance(tenant_id);  成功
（idx_tenant_ibat / idx_tenant_il 同型，逐条见 outputs/f1-probe-093.txt）
```

判据 2 直证（`s3197_post` 的 `information_schema.STATISTICS` 原文）：
`t_inventory_balance.idx_tenant_ib`、`t_inventory_batch.idx_tenant_ibat`、`t_inventory_ledger.idx_tenant_il`（各 1 行，列 `tenant_id`）；
同查询在 `s3197_pre` **0 行**。

### 3.4 第②项：清理前后"只少了重复项"

`information_schema.STATISTICS` 对照：`pre 1355 索引 / 重复组 71` → `post 1296 / 15`。
结构对账 `diff(pre, post) = 缺索引 62 / 多索引 3`（**缺表 0 / 缺列 0 / 多列 0 / 列定义不一致 0**）：
62 = 被清掉的重复项；3 = 第①项新建的 093 目标索引。即**除重复项外未丢任何对象**。
卡面点名的 6 个（`idx_sys_config_tenant` 等）：`pre` 库 6 行 → `post` 库 **0 行**（逐条核销）。
清理后仍有的 15 组重复已逐组点名归因（3 组=第①项带出、3 组=`migration.ts` 兜底 `KEY idx_tenant`、9 组=与本单无关），见 README §3.4。

### 3.5 第③项：10 条跳过的语句级台账

装置 `stmt-outcomes.mjs`（复用产品导出的 `splitSqlStatements`/`addTablePrefix`/`isDropTableStatement`/`isDataWriteStatement`/`SKIP_ERRORS`+`SKIP_PATTERNS`，不复制判据），与 runner 日志**逐文件对账**：

| 来源 | 语句 | 目标表 | 定性 |
|:--|:--|:--|:--|
| `120c_performance_indexes.sql` #30/31/32/33/56 | `ALTER TABLE t_inventory ADD INDEX …` ×5 | `t_inventory` | **该表全语料从未建**（本产品库存主表是 `t_inventory_balance/batch/ledger`）⇒ 历史残留，**不能修** |
| `092_租户ID.sql` #347-351 / #692-696 | 守卫式补 `t_daily_settlement.tenant_id` / 补 `idx_daily_settlement_tenant` | `t_daily_settlement` | **执行时点未建**（由更晚的 `124_drift_tables_fill.sql:108` 建出，`order-attribution` 归因直证）；124 建表**自带**该列与该索引 ⇒ **意图已满足，无需修** |
| `169_tenant_admin_uuid.sql`（3 条） | — | `t_tenant_admin` | **MySQL 8.0.46 上已不再出现**：MariaDB 读数里的 3 条是 `016` 恒失败导致的级联假象，`dd9acede` 并入 S3-194 外键修复后消失（本条实测 169 跳过 0 条） |

附：另有 21 条**非文件标签**的 `ER_NO_SUCH_TABLE`（第2步对 10 张"语料后建"表的 `tenant_id`/索引 20 条 + `5.5.8 AI底座建表` 1 条）；已逐表核验这 **10/10** 张表的建表定义自带 `tenant_id` ⇒ 同样无害。

### 3.6 全量影响面（技术债铁律 §1/§2）

- DDL 前缀族扫描（19 类位置）：表名缺前缀命中 **3 条**（全部在 `093` 的 `CREATE INDEX … ON`）→ 修复后已补 3 / 仍缺 **0**；`SET @s3186_tbl='…'` 字符串字面量类（产品结构性看不到）已由 S3-190 修完，本单复查 **0**。
- tenant 索引命名双轨族扫描：修复前"命中语句 8 / 构成重复 7"（010/012 形态）→ 修复后"命中 1 / 构成重复 **0**"；092 形态的 62 条由 `dup-index-pairs` 与结构 diff 双向核销。

---

## 四、验收自评（逐条对照卡面 §三）

| 卡面判据 | 自评 | 依据 |
|:--|:--:|:--|
| §三.1 MySQL 8 全新空库跑完整套迁移：`失败` 计数 **0**，且空库结构与"语料意图基线"差异 **0** | ✅ | `post-migration.log`：`safeExec 记失败行数=0`、`seed 记失败行数=0`；`diff(base, post) = 0`（结构 sha 同为 `332b3f8f…`） |
| §三.2 `093` 的目标索引**真实存在**（`SHOW CREATE TABLE` / `STATISTICS` 原文） | ✅ | `s3197_post` 的 `STATISTICS` 三行原文（§3.3）；`s3197_pre` 同查询 0 行 |
| §三.3 冗余索引清理后，同表同列**无重复命名项**（给对照） | ✅（对卡面点名的 6 个与其同族，见 §六.2 说明） | `pre 6 行 → post 0 行`；同族双轨：重复组 **71 → 15**、族扫描"构成重复 7 → 0"；剩余 15 组已逐组归因（3 组=第①项带出、3 组=代码内 `KEY idx_tenant`、9 组=与本单无关） |
| §三.4 门禁：`vitest run` 0 failed、`tsc --noEmit` 0、三条 guard EXIT=0、`backend build` EXIT=0 | ✅ | `654 files / 7718 tests / 0 failed`（EXIT=0）；`typecheck` EXIT=0；`guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` 三条 EXIT=0；`build` EXIT=0（`dist/migration.js sha16 76118D4ADBF3B368`）。参考：`guard-rbac-wiring --strict` EXIT=1，**未改动的基线树同命令同样 EXIT=1**（`marketing-miniapp.routes.ts` 3 处未登记写端点）⇒ 与本单无关、现状不变；卡面要求的三条不含它 |
| §四.1 反测：093 改回裸表名 ⇒ 重现 `ER_NO_SUCH_TABLE` 且目标索引不存在（红）；复原 ⇒ 绿 | ✅ | **红**：`pre`（原样语料+原样代码）093 跳过 3 条、`STATISTICS` 查无三索引；探针"修复前"下发的 SQL 仍是 `ON inventory_balance` ⇒ 3/3 `ER_NO_SUCH_TABLE`。**绿**：`post` 093 跳过 0 条、三索引有原文；探针"修复后"⇒ 3/3 成功。（本单选的是"修代码"路径，故红侧由"回退 `addTablePrefix`"构造，与卡面"改回裸表名"等价——被测树语料**本来就是裸表名**） |
| §四.2 反测：冗余索引清理**反转** ⇒ 对照表出现重复项（红）；复原 ⇒ 绿 | ✅ | `reverse-tenant-index-names.mjs --apply` 把 69 条命名反转回旧名 ⇒ 新库 `s3197_f2red`：重复组 **71**、索引 1625；复原后：重复组 **15**、索引 1563，三个文件 sha256 与冻结值**逐字相同**（`092 9204bbf232d45c3e`、`010 1d80fb7d3c017fe9`、`012 6ecff7d4db728717`）。三方闭合：`1563+62 = 1625`、`1622+3 = 1625` |

**版本敏感性（§五.4 方法论）**：8.0.28 上 `173_open_platform_api_key_columns.sql` 的 `ALGORITHM=INSTANT` 有 2 条伪红（MySQL 8.0.29 才支持带位置的 INSTANT 加列）——沿用 S3-194 的定性与口径，本单**全部"绿/红"结论取 CI 同版本 8.0.46**，8.0.28 只作对照（`outputs/version-sensitivity-8.0.28/`）。

---

## 五、逐条定性的完整依据（第③项交付物）

`docs/evidence/S3-197/README.md §四`。要点：语句级台账 + 建表文件归因（`order-attribution.mjs`）+ 库内列存在性核验（10/10）+ runner 日志逐文件对账（`stmt-outcomes.mjs` 自带 MISMATCH 检测；`092` 在"跑完整轮后的库上重放"会显示 0 条，正是"执行时点"类的直接佐证——该表在 124 之后已存在）。

---

## 六、未完成与阻塞

1. **无阻塞项**（三项交付物、四条硬判据、两条反测均已完成并留原始读数）。
2. **需你裁定的两处（不擅自决定，已按判据字面执行并在证据里标注）**：
   - **第①项与第②项的目标冲突**：第①项修好后 093 的 3 条索引真的建出，与第2步的 `idx_t_inventory_*_tenant` 构成 3 组新重复。我**保留** 093 原索引名 `idx_tenant_ib/ibat/il`——因为卡面判据 2 要的是"093 的**目标索引真实存在**"，而这个证据只有在**该名字**存在时才成立；若改归一到规范名，这 3 条语句会退化成"每次迁移以 `ER_DUP_KEYNAME` 跳过"（有索引但语句恒不生效），判据 2 与反测红侧断言（"目标索引不存在"）双双失效。**一行改法见 README §8.2**（改后重复组 15 → 12），请你定。
   - **既有库（非空库）去重**：本单是**语料级命名归一**，对"已经同时存在两个索引"的既有库不会自动 `DROP` 旧名索引。本单未加任何 `DROP` 语句（生产库零写操作是红线）；若要真正去重，建议单开一条显式 DDL 并登记到 `docs/数据库变更清单.md`。
3. **按要求未改、需你落笔的文档**：`docs/数据库变更清单.md`（`120c` 5 条 `t_inventory` 语句的"永不生效"定性已按你要求**只在回执里给出可照抄内容**，见 README §8.3）；`docs/tasks/inbox/ACTIVE.md` 路由表与 `docs/tasks/current-tasks.md`（同 S3-190 的处置：我不敢改并行中的路由表）。
4. `docs/memories/阿坚-记忆.md` 未改（与并行会话同署名，避免并发覆盖），建议由你统一落一笔。

---

## 七、风险与自我报备

1. **改动面超出卡面点名的"6 个"（主动报备）**：卡面 ② 点名 6 个，但全量扫描发现同族共 **69 条**（092 62 + 010/012 7），其余 63 处是同族存量。按《技术债铁律 §2》"必须全量扫描影响面并给出数字，不允许只修碰到的那一处"，我按**同一判据**（库内规范名已存在 ⇒ 纯重复）一次清完。
   - 可证零功能损失：被改的 69 条**都**属于"该表在第2步已建规范名索引"的情形，改名后守卫命中"已存在"而跳过；结构 diff 只剩"缺索引 62（重复项）/ 多索引 3（第①项目标索引）"。
   - **如果你认为应严格限定在 6 个**，回退只需让 `010/012` 与 `092` 的其余 63 条恢复原名（`fix-092-index-names.mjs` 的反向脚本已在 `harness/reverse-tenant-index-names.mjs`），我照办。
2. **我定义的基线口径需你认可**：`base` 树沿用 S3-190 的"语料意图"定义（同一套语料 + 把应带前缀的表名手工写全）；本单**只有 093 一处**需要手工写全。若你要求改口径（例如以 S3-190 的 `base2` 快照为准），需重算——请明示。
3. **`010`/`012` 两个文件的索引名归一**：这两份是 2026-07-06 的历史语料，我把索引名与文件头注释同步更新了（列定义/列顺序一字未改）。若你希望"历史文件只留档、不改动"，请裁定，我改回。
4. **`stmt-outcomes.mjs` 的一处装置局限（如实报备）**：它把语料在"整轮跑完后的库"上重放，因此"执行时点"类跳过（`092` 的 2 条）在重放里表现为 0 条、会触发一次 MISMATCH；我用 `order-attribution.mjs`（按建表文件归因）补齐定性，没有把 MISMATCH 洗成绿。
5. **`tenant-index-family.mjs` 的覆盖边界**：它只认字面 `ADD INDEX/CREATE INDEX <名>` 形态，092 的守卫式写法（索引名在 `SET` 变量里）不在其覆盖面内——那部分由 `dup-index-pairs.mjs`（库内实测）与结构 diff 双向核销，未在你面前混用两个口径。
6. **我没有**新建/修改任何裁定类文件，没有动 `ACTIVE.md`、`current-tasks.md`、`docs/数据库变更清单.md`、记忆文件；也没有 push、没有开 PR。
7. **对照工作树的 node_modules 是 junction（如实报备）**：`wt-agents/S3-197-base` 的 `node_modules`、`backend/node_modules` 是指向被测树同名目录的 **junction**（为省一次 npm install），删该工作树时请用 `cmd /c rmdir node_modules`（**不带 `/s`**，只删链接、不动目标）。

---

## 八、回传要求 / 关联

- 本汇报已落卡：`docs/tasks/cards/R101-S3-197-阿坚-回传.md`（内容与本文件一致）
- 关联派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-197-20261014.md`（原 `inbox/ACTIVE-S3-197.md`）
- 证据包：`docs/evidence/S3-197/README.md`（含 §九 一键复跑命令清单 + 冻结哈希）
