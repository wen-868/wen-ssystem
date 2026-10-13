# S3-197 证据包：迁移语料残留收口（093 裸表名 3 条 · 命名双轨冗余索引 · 10 条跳过定性）

> 执行人：**阿坚（后端 / 迁移）**（本地子代理通道，agent = `/root/s3200_ajian`）｜单号：**S3-197**（收口总清单第 **60** 项）
> 被测工作树：`D:\Users\ZXQL\wt-agents\S3-197`｜分支 `fix/s3-197-migration-residue`｜基线 `origin/main` = **`dd9acede`**
> 基线对照工作树：`D:\Users\ZXQL\wt-agents\S3-197-base`（detached `dd9acede`，`migration.ts` **原样**，只把语料改成"语料意图"形态）
> 数据库：**MySQL 8.0.46**（与 CI `migration-check` 同版本）`127.0.0.1:3456`，datadir 在 `%TEMP%\mysql8046\data-s3197`；**全程未接触 3406 的 MariaDB**，生产库零写操作
> 状态：**未 push / 未开 PR**（红线遵守）
> 回执：`docs/tasks/inbox/ACTIVE-回执-S3-197.md`｜回传卡：`docs/tasks/cards/R101-S3-197-阿坚-回传.md`

---

## 〇、一句话结论

三项全部收口，四项硬判据全绿、两条反测两侧齐：

| 项 | 缺陷 | 修复 | 关键读数（MySQL 8.0.46 空库） |
|:--|:--|:--|:--|
| **60①** | `093:8/9/10` 的 `CREATE INDEX … ON <裸表名>`：`addTablePrefix()` **无该模式** ⇒ 恒 `ER_NO_SUCH_TABLE`，3 条索引从未建出 | 给 `addTablePrefix()` 补 `CREATE INDEX … ON` 模式（根因修，语料未动） | 修复前：3 条跳过 + 3 个索引在库内**查无**；修复后：3 条成功 + `idx_tenant_ib/ibat/il` **真实存在** |
| **60②** | 索引名**双轨**：语料 `idx_<表名去 t_>_tenant` vs `migration.ts` 第2步 `idx_t_<表名>_tenant` ⇒ 同表同列两个索引 | 把**可证为纯重复**的 69 条语句的索引名统一到既有规范命名（092 62 条 + 010/012 7 条） | 索引总数 **1622 → 1563**；重复组 **71 → 15**；结构与"语料意图基线" **差异 0** |
| **60③** | 10 条 `ER_NO_SUCH_TABLE` 未定性 | 逐条定性（见 §五）：120c=5 属"该表本产品不建"、092=2 属"执行时点未建但意图已由建表文件满足"、169=3 **在 MySQL 8.0.46 上已不再出现**（MariaDB 级联假象，被 S3-194 连带消除） | 修复后按文件跳过：`092=2 / 120c=5`（10 → 7，另 3 条即第①项已修） |

空库结构（312 表 / 4154 列）：`pre 1622 索引` → `base 1563` → `post 1563`；**`diff(base, post) = 0`**；
`diff(pre, post) = 缺索引 62 / 多索引 3`，两者逐条可解释（62 = 被去掉的重复项；3 = 第①项新建的 093 目标索引）。

---

## 一、环境与装置

`harness/` 是本单全套装置（凌舟可直接复跑，见 §九）：

| 装置 | 作用 |
|:--|:--|
| `run-case.ps1` | 建空库 → 按**产品真实路径**（`<repo>/backend/dist/shared/migration.js::runMigrations()`）跑一遍启动期迁移 → 落日志 + 结构快照 + 输入指纹 |
| `run-migrations.mjs` / `snapshot.mjs` / `diff.mjs` / `digest.mjs` | 迁移入口与结构对账（后三个与 S3-186/S3-190 同款通用装置，逐字节复用） |
| `stmt-outcomes.mjs` | **语句级**台账：按 runner 同序同判据重放语料，逐条记录结果（runner 日志只有"文件 + 错误码"，指不出是哪一条） |
| `order-attribution.mjs` | 把某文件每条结构语句的目标表归因到"哪份文件建出它" ⇒ 定性"执行时点"类跳过 |
| `dup-index-pairs.mjs` | 从 `information_schema.STATISTICS` 找**同表同列同唯一性、仅命名不同**的重复索引 |
| `tenant-index-family.mjs` | 全语料扫描"tenant_id 索引命名双轨族"的影响面 |
| `ddl-prefix-coverage.mjs` | 全语料扫描"DDL 位置表名未补 `t_` 前缀"这一族的**完整影响面**（已修 N / 仍受影响 M） |
| `probe-093-prefix.mjs` | 第①项语句级探针：同一句 SQL 过"修复前 / 修复后 `addTablePrefix`"，各下发一次看真实结果 |
| `fix-092-index-names.mjs` / `reverse-tenant-index-names.mjs` | 第②项的机械改写与**反测反转**（两侧同一装置） |

**输入指纹**（每个用例日志头部自证"跑的是哪份输入"）：

| 用例 | 语料 sha256(32) | `migration.ts` sha16 | `dist/migration.js` sha16 | `093 裸表名 CREATE INDEX ON` |
|:--|:--|:--|:--|:--|
| pre | `2E1A94A14BC81425BF38CD80695EB51A` | `8167BED3DA849730`（原样） | `B5161C983607288B` | 3 |
| base | `3135BBB828FC927AB78A22751D36A296` | `8167BED3DA849730`（原样） | `B5161C983607288B` | 0（手工写全前缀） |
| post | `1005D07ECC3BA80AD79F8A344A4F2EF8` | `D6A5F202850DB5BF`（修复后） | `76118D4ADBF3B368` | 3（语料未动，靠代码补） |
| f2red（反测） | — | `D6A5F202850DB5BF` | `76118D4ADBF3B368` | 3 |

**基线口径（沿用 S3-190 §四）**：`base` 是"**语料意图**"基线——同一套 `dd9acede` 语料，把"应当带 `t_` 前缀的表名"**手工写全**（本单只有 `093:8/9/10` 这一处），`migration.ts` **保持原样**；
被测树 `post` 则**语料不动**、靠修好的 `addTablePrefix()` 自动补前缀。两条路径若建出同一结构，即同时证明"代码修复正确"与"语料未被顺手改语义"。

---

## 二、第①项：`093` 的 3 条 `CREATE INDEX … ON`

### 2.1 根因

`addTablePrefix()`（`backend/src/shared/migration.ts:91`）的模式表覆盖 `CREATE TABLE / ALTER TABLE / INSERT INTO / REPLACE INTO / UPDATE / DELETE FROM / FROM / JOIN / REFERENCES / RENAME TABLE / DROP TABLE`，
**没有 `CREATE INDEX … ON`**（也没有 `DROP INDEX … ON`、`TRUNCATE`、`LOCK TABLES` 等，见 §六 全量扫描）⇒ `CREATE INDEX idx_tenant_ib ON inventory_balance(tenant_id)` 里 `ON` 后面的裸表名**永远不会被补前缀** ⇒ 恒 `ER_NO_SUCH_TABLE`。

### 2.2 选择：修 `addTablePrefix()`（而非在语料里写全 `t_`）

理由：① 这是"模式缺失"这一类缺陷的**根因处**，一次修好所有同类语句；② 语料侧改写法要把"表名前缀"责任散落到每一份语料，且下次新增同写法语句会再犯；③ 现成先例是 MIG-5 补 `REFERENCES` 模式（同一函数、同一手法）。
**语料 `093` 一字未改**，可与被测/基线两树对照来证明修复来自代码。

### 2.3 原始读数（红/绿两侧）

语句级探针 `outputs/f1-probe-093.txt`（同一句 SQL，两个 `addTablePrefix` 各跑一次）：

```
1  修复前  CREATE INDEX idx_tenant_ib ON inventory_balance(tenant_id);   ER_NO_SUCH_TABLE: Table 's3197_pre.inventory_balance' doesn't exist
1  修复后  CREATE INDEX idx_tenant_ib ON t_inventory_balance(tenant_id); 成功
2  修复前  CREATE INDEX idx_tenant_ibat ON inventory_batch(tenant_id);   ER_NO_SUCH_TABLE: …
2  修复后  CREATE INDEX idx_tenant_ibat ON t_inventory_batch(tenant_id); 成功
3  修复前  CREATE INDEX idx_tenant_il ON inventory_ledger(tenant_id);    ER_NO_SUCH_TABLE: …
3  修复后  CREATE INDEX idx_tenant_il ON t_inventory_ledger(tenant_id);  成功
探针结论：两态差异与预期一致（修复前恒 ER_NO_SUCH_TABLE / 修复后成功）
```

全量运行两侧（同一 MySQL 8.0.46、同一空库路径）：

- **红**（`pre`，原样）：`outputs/pre-migration.log` 中 `093_库存增加租户ID.sql` 3 条 `跳过 (ER_NO_SUCH_TABLE)`；同库 `STATISTICS` 查 `idx_tenant_ib/ibat/il` **0 行**。
- **绿**（`post`）：`outputs/post-migration.log` 中 093 **0 条跳过**；`STATISTICS` 原文（判据 2 直证）：

```
TABLE_NAME            INDEX_NAME        NON_UNIQUE  SEQ_IN_INDEX  COLUMN_NAME
t_inventory_balance   idx_tenant_ib     1           1             tenant_id
t_inventory_batch     idx_tenant_ibat   1           1             tenant_id
t_inventory_ledger    idx_tenant_il     1           1             tenant_id
```

---

## 三、第②项：tenant_id 索引"命名双轨"冗余索引

### 3.1 影响面（全量扫描，非只改动点）

卡面点名的是 S3-190 修好第 53 项后**新引入的 6 个**（`idx_sys_config_tenant` 等）。本单做了全量扫描，发现**同族共 69 条语句**：

| 来源 | 条数 | 说明 |
|:--|--:|:--|
| `092_租户ID.sql` 第3步 | 62 | 表名在 `TENANT_TABLES` 内 ⇒ `migration.ts` 第2步**已建** `idx_t_<表名>_tenant`；库内规范名与语料名**同时存在**＝纯重复（改名后守卫命中"已存在"而跳过，净效果只少重复项） |
| `010_phase7_credit_tenant.sql` / `012_phase7_price_tenant.sql` | 7 | 同族但**不在 092**：这两份 7 月的历史语料用同一套旧命名，构成同样重复（`t_customer_credit` / `t_credit_operation_log` / `t_collection_record` / `t_price_level` / `t_sku_price` / `t_customer_price_binding` / `t_price_change_log`） |
| `092` 第3步其余 7 条 | 0（未改） | `t_approval_rule/instance/task/log/approver/notification`、`t_daily_settlement`：这些表在**第2步时尚未建出** ⇒ 本库**没有**规范名索引 ⇒ 不是重复项，**原名保留未动**（改了反而变成"改名"，超出"只少重复项"判据） |

> 为什么不止改 6 个：这 6 个只是"同类缺陷中被 S3-190 新引入的那一批"，其余 63 处是同族存量。
> 按项目《技术债铁律 §2》"发现同一缺陷在多处出现时必须全量扫描影响面并给出数字，不允许只修碰到的那一处"，本单按**同一判据（库内规范名已存在 ⇒ 纯重复）**一次清完，并逐条留证。

### 3.2 判据：清理前后"索引集合只少了重复项"

`information_schema.STATISTICS` 对照（`outputs/pre-dup-indexes.tsv` vs `outputs/post-dup-indexes.tsv`）：

```
pre ：索引(表,索引名)总数 1355 / 重复组 71 / 重复组内索引 145
post：索引(表,索引名)总数 1296 / 重复组 15 / 重复组内索引 30
```

结构级对照 `outputs/diff-pre-vs-post.txt` / `diff-pre-vs-base.txt`：

```
差异合计 = 65   缺表 0 / 多表 0 / 缺列 0 / 多列 0 / 缺索引 62 / 多索引 3 / 列定义不一致 0
  缺索引 62 = 被清掉的重复项（= §3.1 的 69 条里，本库确实建成过旧名索引的 62 条）
  多索引  3 = 第①项新建的 idx_tenant_ib / idx_tenant_ibat / idx_tenant_il
```

⇒ **结构上没有丢任何"非重复"对象**（表 312 / 列 4154 两态一致，列定义 0 差异）。

### 3.3 卡面点名 6 个的逐条核销

`pre` 库中 6 个旧名索引存在（6 行）→ `post` 库中同一查询**0 行**：

```
pre : SELECT COUNT(*) … INDEX_NAME IN ('idx_sys_config_tenant','idx_sys_user_tenant','idx_sys_role_tenant',
        'idx_sys_permission_tenant','idx_sys_user_role_tenant','idx_sys_role_permission_tenant')  ⇒ 6
post: 同一查询 ⇒ 0 行（上表为空）
```

### 3.4 清理后仍存在的 15 组重复（如实点名，均为**其他成因**）

| 组 | 成因 | 是否本单同族 |
|:--|:--|:--|
| `t_inventory_balance/batch/ledger` 的 `idx_tenant_ib(…)` vs `idx_t_inventory_*_tenant`（3 组） | **由第①项修复带出**：093 的 3 条索引现在真的建出来了，而第2步对这三张表也建了规范名索引 | 同族（但保留，理由见 §八.2） |
| `t_sys_user / t_sys_role / t_sys_user_role` 的 `idx_tenant` vs `idx_t_*_tenant`（3 组） | `migration.ts` 兜底 `CREATE TABLE` 里写死的 `KEY idx_tenant` 与第2步的规范名并存 | 另一处命名双轨（在代码里，不在语料里） |
| `t_coupon_template.status`、`t_member(customer_type,status)`、`t_product_review.review_no`、`t_purchase_in_stock.order_no`、`t_receivable.customer_id`、`t_receivable.status`、`t_user_coupon.status`、`t_user_coupon.template_id`、`t_wholesale_order.order_no`（9 组） | 各表自身定义/多份语料的历史命名（与本单无关） | 否 |

---

## 四、第③项：10 条 `ER_NO_SUCH_TABLE` 逐条定性

口径：MySQL 8.0.46、空库、产品 runner（写闸门默认 block）。
`post` 日志按文件跳过：`092_租户ID.sql = 2`、`120c_performance_indexes.sql = 5`（共 7 条）；`093 = 0`（第①项已修）、`169 = 0`。
另有 21 条**非文件标签**的 `ER_NO_SUCH_TABLE`（第2步程序化循环对 10 张"语料后建"表的 `tenant_id`/索引 20 条 + `5.5.8 AI底座建表` 1 条），合计 28。

| # | 来源 | 语句（语句级台账 `outputs/post-stmt-outcomes.jsonl`） | 最终定性 | 处置 |
|:--:|:--|:--|:--|:--|
| 1-5 | `120c_performance_indexes.sql` 语句 #30/#31/#32/#33/#56 | `ALTER TABLE t_inventory ADD INDEX idx_inventory_sku_id / idx_inventory_store_id / idx_inventory_warehouse_id / idx_inventory_sku_store / idx_inventory_tenant_store` | **该表本产品从未建**（`ddl`/建表全语料扫描：`t_inventory` 无任何 `CREATE TABLE`）⇒ 历史语料残留 | **不能修**（不得凭空建业务表）；已备好写入 `docs/数据库变更清单.md` 的内容（§八.3） |
| 6-7 | `092_租户ID.sql` 语句 #347-351 / #692-696（守卫式补列 + 补索引，表 `t_daily_settlement`） | `SET @s3186_tbl='t_daily_settlement'` 的补 `tenant_id` 与补 `idx_daily_settlement_tenant` | **执行时点表未建**（该表由更晚的 `124_drift_tables_fill.sql:108` 建出，`outputs/pre-092-attribution.tsv` 归因直证）；但 124 的建表**自带** `tenant_id` 列与 `idx_daily_settlement_tenant` 索引 ⇒ **语料意图已满足，跳过无害** | **无需修**（无功能缺口，只留一行日志） |
| 8-10 | `169_tenant_admin_uuid.sql`（卡面记"3 条，`t_tenant_admin` 由更晚文件建出"） | — | **在 MySQL 8.0.46 上已不再出现**：S3-190 那份 MariaDB 读数里的 3 条是**级联假象**——MariaDB 上 `016` 因外键列型不兼容恒失败 ⇒ `t_tenant_admin` 缺表 ⇒ 169 的 ALTER 全跳过。`dd9acede` 已并入 S3-194 的外键修复（016/017/032/034）⇒ 016 建表成功 ⇒ 169 正常执行 | **已随 S3-194 消除**（本单直证：`post` 日志中 169 的 `ER_NO_SUCH_TABLE` 0 条） |

**附带核验**：第2步跳过的 10 张"语料后建"表（`t_brand`、`t_customer_type`、`t_approval_rule/instance/task/log/approver/notification`、`t_daily_settlement`、`t_stock_warning`）
逐表查 `information_schema.COLUMNS` ⇒ **10/10 都有 `tenant_id`**（建表定义自带），故那 20 条程序化跳过同样无害。

---

## 五、反测（两侧齐，同一装置给出红绿）

| 反测 | 做法（同一装置） | 红侧实测 | 绿侧实测 |
|:--|:--|:--|:--|
| **F1 · 第①项** | `probe-093-prefix.mjs`：同一句 SQL 过"修复前 / 修复后 `addTablePrefix`"各下发一次；并跑整轮 `pre` / `post` | 修复前：`ER_NO_SUCH_TABLE`（3/3）；整轮 `pre`：093 跳过 3 条、3 个索引在库内**查无** | 修复后：3/3 成功；整轮 `post`：093 跳过 0 条、3 个索引 `STATISTICS` 有原文 |
| **F2 · 第②项** | `reverse-tenant-index-names.mjs --apply` 把 69 条命名**反转**回旧名（= 保留重复命名的那一份）⇒ 跑新库 `s3197_f2red` ⇒ 用完从备份复原 | 反转后：重复组 **71**（= 回到清理前）、索引总数 1625；族扫描"构成重复 7" | 复原后：重复组 **15**、索引总数 1563；三个文件 sha256 复原值与冻结值**逐字相同**（`092 9204bbf232d45c3e`、`010 1d80fb7d3c017fe9`、`012 6ecff7d4db728717`） |

索引总数三方闭合：`post 1563 + 62（反转找回的重复项）= 1625 = f2red`；`pre 1622 + 3（第①项新建）= 1625`。

---

## 六、门禁（原始输出见 `outputs/gates-*.log`）

| 门禁 | 结果 |
|:--|:--|
| `npm --workspace backend run test`（vitest run） | **EXIT=0**：`654 files / 7718 tests / 0 failed` |
| `npm --workspace backend run typecheck`（`tsc --noEmit`） | **EXIT=0**（日志为空） |
| `node backend/scripts/guard-route-auth.mjs` | **EXIT=0** |
| `node backend/scripts/guard-tenant-status.mjs` | **EXIT=0** |
| `node backend/scripts/guard-route-prefix.mjs` | **EXIT=0** |
| `npm --workspace backend run build` | **EXIT=0**（`dist/migration.js` sha16 `76118D4ADBF3B368`） |
| （参考）`node backend/scripts/guard-rbac-wiring.mjs --strict` | **EXIT=1**，且**未改动的基线树同命令同样 EXIT=1**（`marketing-miniapp.routes.ts` 3 处未登记无权限写端点）⇒ 与本单无关、现状不变；卡面要求的三条 guard 不含它 |

MySQL 8 空库整轮迁移：`safeExec 记失败行数 = 0`、`seed 记失败行数 = 0`（判据 1 的"失败计数 0"）。
（版本敏感性：8.0.28 上 `173_open_platform_api_key_columns.sql` 的 `ALGORITHM=INSTANT` 有 2 条伪红 —— 已在 S3-194 回执 §五 定性为**版本伪红**，故本单主口径取 CI 同版本 8.0.46；见 `outputs/version-sensitivity-8.0.28/`。）

---

## 七、改动清单（4 文件，sha256 前 16 位 + numstat）

| 文件 | 前 → 后 | numstat | 说明 |
|:--|:--|:--|:--|
| `backend/src/shared/migration.ts` | `8167BED3DA849730` → `D6A5F202850DB5BF` | +6 / −0 | 模式表补 `CREATE INDEX … ON`（含 S3-197 注释） |
| `docs/migrations/092_租户ID.sql` | `ECA62DBE18874C1B` → `9204BBF232D45C3E` | +132 / −124 | 62 条索引名归一（每块改 SET 行 + 跳过标签）+ 文件头 8 行说明 |
| `docs/migrations/010_phase7_credit_tenant.sql` | `C97CD611F85D5D63` → `1D80FB7D3C017FE9` | +9 / −3 | 3 条索引名归一 + 文件头说明 |
| `docs/migrations/012_phase7_price_tenant.sql` | `27D55D5075F8EB D6` → `6ECFF7D4DB728717` | +10 / −4 | 4 条索引名归一 + 文件头说明 |

**未动**：业务路由 / 控制器 / 服务（除 `migration.ts` 的 `addTablePrefix` 模式表外 `backend/src/**` 零改动）、`.github/**`、`deploy/**`、`R101-收口总清单.md`、`docs/数据库变更清单.md`、其它迁移语料、`ACTIVE.md` 路由表、`current-tasks.md`、记忆文件。

---

## 八、残余、未覆盖与需凌舟裁定项

### 8.1 现网已存在的库（非空库）不自动去重

本单的清理是**语料级命名归一**：对"已经同时存在两个索引"的**既有库**，迁移不会自动 DROP 掉旧名索引（本单没有、也不建议加 `DROP` 语句——生产库零写操作是红线）。
若要在既有库上真正去重，需要一条**独立、显式、可审**的 DDL（建议走 `docs/数据库变更清单.md` 的可选清理项），本单只给内容不给动作。

### 8.2 第①项与第②项的一处**目标冲突**（需裁定，已按判据字面取舍）

第①项修好后，093 的 3 条索引会**真的建出来**（`idx_tenant_ib/ibat/il`），而第2步对这三张表也已建 `idx_t_inventory_*_tenant` ⇒ 新增 3 组"同表同列"重复。

本单**选择保留** 093 的原索引名，理由：卡面判据 2 要的是"**093 的目标索引真实存在**"（`STATISTICS` 原文）——只有 `idx_tenant_ib` 这个名字存在才构成"第①项已修"的证据；
若把 093 的 3 个索引名也归一（`idx_t_inventory_*_tenant`），这 3 条语句会退化成"每次迁移都以 `ER_DUP_KEYNAME` 跳过"（虽有索引，但语句恒不生效），判据 2 与 §五 F1 的红侧断言（"目标索引不存在"）双双失效。

**一行改法（供裁定）**：把 `093:12/13/14` 的 `idx_tenant_ib/ibat/il` 改成 `idx_t_inventory_balance/batch/ledger_tenant`，同时把 §五 F1 的红侧断言从"目标索引不存在"改为"该索引由第2步建出、与 093 无关"——改后重复组由 15 降到 12。
本单不擅自选，按判据字面执行并如实报备。

### 8.3 建议写入 `docs/数据库变更清单.md` 的内容（红线：本单不得改该文件）

> **120c_performance_indexes.sql（5 条 `t_inventory` 索引）— 定性：历史语料残留，永不生效**
> 状态应从"已执行"订正为"**部分语句无效**"：文件第 30/31/32/33/56 条语句的对象是 `t_inventory`，
> 而全语料（199 份）**从未建过这张表**（本产品库存主表为 `t_inventory_balance/batch/ledger`，见 093）。
> 这 5 条语句在空库/生产库上恒 `ER_NO_SUCH_TABLE` 并被静默跳过。**判定：不修**（不得凭空建业务表）；
> 若确认该文件为历史冗余，建议整份归档或在文件头标注"目标表不存在 ⇒ 语句恒无效"。
> 证据：`docs/evidence/S3-197/outputs/post-stmt-outcomes.jsonl`（#30/#31/#32/#33/#56）、本包 §四。

> **092_租户ID.sql 的 2 条 `t_daily_settlement` 语句 — 判定：无需修（执行时点 + 意图已满足）**
> 该表由 `124_drift_tables_fill.sql:108` 建出且**自带** `tenant_id` 与 `idx_daily_settlement_tenant`；
> 092 在 124 之前执行 ⇒ 守卫查不到表而跳过。功能无缺口，仅留一行"跳过"日志。

> **169_tenant_admin_uuid.sql — 判定：MariaDB 级联假象，已随 S3-194 消除**
> MariaDB 11.4.5 上 `016` 因外键列型不兼容恒失败 ⇒ `t_tenant_admin` 缺表 ⇒ 169 的 3 条跳过；
> MySQL 8.0.46（CI 同版本）上 016 成功、169 跳过 **0 条**。

### 8.4 仍需单独收口的同族残余（本单范围外，供开单参考）

1. `migration.ts` 兜底 `CREATE TABLE` 里的 `KEY idx_tenant` 与第2步 `idx_t_*_tenant` 双轨（3 组，`t_sys_user/t_sys_role/t_sys_user_role`）——在**代码**里，需另开一单（改动面涉及兜底建表语句）。
2. `052_add_retail_announcement.sql:20` 的 `idx_tenant`（表 `t_retail_announcement` 无规范名索引，**非重复**，但命名与规范不一致）。
3. 9 组与本单无关的历史重复索引（见 §3.4 末行），建议并入"迁移语料残留"后续批次。

---

## 九、可复跑命令（凌舟侧，逐条照抄即可）

```powershell
# 0) MySQL 8.0.46（CI 同版本）已在 127.0.0.1:3456 运行；datadir = %TEMP%\mysql8046\data-s3197
$A = "D:\Users\ZXQL\wt-agents\S3-197"          # 被测树（修复后）
$B = "D:\Users\ZXQL\wt-agents\S3-197-base"     # 基线树（语料意图 + migration.ts 原样）

# 1) 三态整轮迁移（各建空库 + 落日志/快照/指纹）
powershell -File "$A\docs\evidence\S3-197\harness\run-case.ps1" -RepoRoot $B -DbName s3197_pre  -Tag pre  -OutDir "$A\docs\evidence\S3-197\outputs"
powershell -File "$A\docs\evidence\S3-197\harness\run-case.ps1" -RepoRoot $B -DbName s3197_base -Tag base -OutDir "$A\docs\evidence\S3-197\outputs"
powershell -File "$A\docs\evidence\S3-197\harness\run-case.ps1" -RepoRoot $A -DbName s3197_post -Tag post

# 2) 判据 1：结构与"语料意图基线"差异 0（期望 "差异合计 = 0"）
node "$A\docs\evidence\S3-197\harness\diff.mjs" "$A\docs\evidence\S3-197\outputs\base-snapshot.json" "$A\docs\evidence\S3-197\outputs\post-snapshot.json"

# 3) 第②项对照：重复索引组（pre 71 组 / post 15 组）
$env:DB_PORT="3456"; $env:DB_HOST="127.0.0.1"; $env:DB_USER="root"
node "$A\docs\evidence\S3-197\harness\dup-index-pairs.mjs" s3197_pre  "$A\docs\evidence\S3-197\outputs\pre-dup-indexes.tsv"
node "$A\docs\evidence\S3-197\harness\dup-index-pairs.mjs" s3197_post "$A\docs\evidence\S3-197\outputs\post-dup-indexes.tsv"

# 4) 第①项语句级探针（修复前 ER_NO_SUCH_TABLE / 修复后 成功）
node "$A\docs\evidence\S3-197\harness\probe-093-prefix.mjs" $B $A s3197_pre

# 5) 语句级台账 + 与 runner 日志对账
node "$A\docs\evidence\S3-197\harness\stmt-outcomes.mjs" $A s3197_post "$A\docs\evidence\S3-197\outputs\post-stmt-outcomes.jsonl" "$A\docs\evidence\S3-197\outputs\post-migration.log"

# 6) 全量影响面扫描（DDL 前缀族 / tenant 索引命名双轨族）
node "$A\docs\evidence\S3-197\harness\ddl-prefix-coverage.mjs" $B $A "$A\docs\evidence\S3-197\outputs\ddl-prefix-coverage.tsv" $A
node "$A\docs\evidence\S3-197\harness\tenant-index-family.mjs" $A s3197_post "$A\docs\evidence\S3-197\outputs\post-tenant-index-family.tsv"

# 7) 反测（第②项）——⚠️ 会临时改动 3 个语料文件，完事必须复原并核 sha256
#    备份 → --apply 反转 → 跑 s3197_f2red → 复原 → 三个 sha256 必须回到冻结值
```

**冻结值（复核用）**：`migration.ts D6A5F202850DB5BF`、`092 9204BBF232D45C3E`、`010 1D80FB7D3C017FE9`、`012 6ECFF7D4DB728717`、`dist/migration.js 76118D4ADBF3B368`；`post` 结构 sha256 = `332b3f8f9fe673322c47174c158729b2dd1ca5a335da1cab6d5491e763e8c1e0`（与 `base` 相同）。

---

## 十、产物清单

| 类别 | 文件 |
|:--|:--|
| 整轮用例 | `outputs/{pre,base,post,f2red}-migration.log`、`-snapshot.json`、`-counts.txt` |
| 结构对账 | `outputs/diff-base-vs-post.txt`（**0**）、`diff-pre-vs-post.txt`、`diff-pre-vs-base.txt`、`digest` 读数见本 README §〇 |
| 第①项 | `outputs/f1-probe-093.txt` |
| 第②项 | `outputs/pre-dup-indexes.tsv`、`post-dup-indexes.tsv`、`f2red-dup-indexes.tsv`、`pre-092-index-rename-set.json`、`f2-reverse-map.json`、`{pre,post,f2red}-tenant-index-family.tsv` |
| 第③项 | `outputs/pre-stmt-outcomes.jsonl`、`post-stmt-outcomes.jsonl`、`pre-092-attribution.tsv`、`pre-120c-attribution.tsv`、`ddl-prefix-coverage.tsv` |
| 门禁 | `outputs/gates-{vitest,tsc-noemit,guard-route-auth,guard-tenant-status,guard-route-prefix,guard-rbac-wiring}.log` |
| 版本敏感性 | `outputs/version-sensitivity-8.0.28/`（8.0.28 上 `173 ALGORITHM=INSTANT` 2 条伪红） |
