# S3-194 证据包 · 空库迁移在 MySQL 8 上被外键不兼容打断（errno 3780）

> 工作树：`D:\Users\ZXQL\wt-agents\S3-194`｜分支 `fix/s3-194-mysql8-fk-incompatible`｜基线 `origin/main` = `25728007`
> 本包**状态**：未 commit / 未 push / 未开 PR（红线遵守，由凌舟本机提交）
> 本卡：`docs/tasks/inbox/archive/ACTIVE-S3-194-20261014.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-S3-194.md`

---

## 一、结论（一句话）

把 4 个迁移文件里 6 条外键的**引用列类型**对齐到被引用列的**真实口径**后，**全新 MySQL 8.0.46**（= CI `mysql:8.0` 同版本）空库跑完整套迁移后日志中 `失败` 计数由 **6 → 0**；6 条约束所在的建表语句**全部被 MySQL 8 接受**（第 6 条 `t_tenant_admin_ibfk_1` 由**既有 169 迁移**按既有口径 `DROP FOREIGN KEY` 移除，**不是本单删除**，见 §五.5 与 `13-probe-fk6.txt`）。

## 二、改了什么（4 文件 / 6 处 + 1 处形状对齐）

### 2.1 六处外键引用列类型（本单主体）

| 文件:行 | 表.列 | 原定义 | 新定义 | 对齐依据（被引用列真值） |
|:--|:--|:--|:--|:--|
| `016_phase9_tenant_subscription.sql:109` | `t_tenant_module_access.tenant_id` | `INT` | `VARCHAR(36)` | 被引用列 `t_tenant.id` = `VARCHAR(36)`（`migration.ts:534` 第 1 步建表；016 同文件 `:11` 同值）；应用层 `randomUUID()` 写入 |
| `016_phase9_tenant_subscription.sql:152` | `t_tenant_admin.tenant_id` | `INT` | `VARCHAR(36)` | 同上；且与 `192`（既有补偿迁移）的既成口径一致 |
| `032_add_tenant_module_access.sql:3` | `t_tenant_module_access.tenant_id` | `INT` | `VARCHAR(36)` | 同 016（同表第二份定义；016 失败时本块会执行，见 §五.1 基线 6 条） |
| `034_add_tenant_admin.sql:3` | `t_tenant_admin.tenant_id` | `INT` | `VARCHAR(36)` | 同 016 |
| `017_phase10_instant_retail.sql:141` | `t_retail_order_item.order_id` | `INT` | `BIGINT` | 被引用列 `t_retail_order.id` = `BIGINT`（017 同文件 `:101`）；与 `074_即时零售表.sql:169` 既有口径一致 |
| `017_phase10_instant_retail.sql:176` | `t_delivery_record.order_id` | `INT` | `BIGINT` | 同上；与 `046_add_delivery_record.sql:4` 既有口径一致 |

**只改类型 token，未改列名/约束/索引/注释/行尾/文件末换行**：`git diff --numstat` 对 016 与 017 各 2 行、032/034 各 1 行；032/034 原文件**无行末换行**、`core.autocrlf=true` 下为 CRLF，已逐字节保持（未出现整文件重写、未丢 `\r`）。

### 2.2 一处"有效定义形状"对齐（017 的 `t_retail_order_item`，12 行 → 16 行）

**为什么必须做（不是顺手改）**：修好 017 的 `order_id` 后，017 的建表**由"恒失败"变为成功**，于是同一张表在 `074` 里的那份**更完整的定义变成整条 no-op**——全新库会拿到 017 的**较窄形状**（缺 `sku_id` / `tenant_id` / `created_at`，`id`/`product_id` 由 `BIGINT` 掉回 `INT`，`product_name` 200→128、`product_image` 500→255、`quantity` 丢 `DEFAULT 1`）。而 `backend/src/services/instant-retail/retail-shop.service.ts:332` 按 `SELECT * … WHERE order_id = ? AND tenant_id = ?` 读该表、`:77-82` 的行类型含 `sku_id`/`tenant_id`/`created_at` ⇒ 全新库会**新出现 Unknown column 'tenant_id'** 的真故障。

因此把 017 该表**逐列/逐索引对齐到 074 的既成口径**（= 生产既有形状），并保持 `order_id BIGINT` + 外键（`CONSTRAINT fk_retail_order_item_order`，与 074 同名）。对齐后该表在"基线 vs 修复后"的快照对比里**零差异**（见 §六 C1 无该表条目）。

> 备选（未采用）：只补 3 个缺列、保留 017 的窄宽度与不同索引名 ⇒ 会把"全新库与生产形状不一致"永久留在库里，并在快照对比里制造 8 条无法用"引擎天然差异"解释的差异。

## 三、环境与口径（可复现）

| 角色 | 实例 | 起法 | 服务器默认 |
|:--|:--|:--|:--|
| **主口径** | MySQL **8.0.46**（= CI `mysql:8.0` 同版本） | `%TEMP%\mysql80\…\bin\mysqld --no-defaults --port=3408 --bind-address=127.0.0.1` ⇒ 本次另解压 `mysql-8.0.46-winx64` 于仓外证据区 | `utf8mb4 / utf8mb4_0900_ai_ci` |
| 版本对照 | MySQL **8.0.28** | `--no-defaults --port=3407` | `utf8mb4 / utf8mb4_0900_ai_ci` |
| 旧口径对照 | MariaDB **11.4.5** | `mariadbd --no-defaults --port=3409 --ssl=0 --character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci` | `utf8mb4 / utf8mb4_general_ci` |

- 一律 `--no-defaults`（不读任何 `my.ini`）⇒ 字符集/排序规则即**服务器默认**，与 CI 注释所述"mysql:8.0 默认即 utf8mb4 / 0900_ai_ci"一致。
- 每个用例都**新建空库**（`DROP DATABASE; CREATE DATABASE;` 不带 charset ⇒ 继承服务器默认），等价 CI 的 `MYSQL_DATABASE=liquor_inventory`。
- 迁移以产品路径执行：`node backend/dist/server.js`（`NODE_ENV=production`、`JWT_SECRET`、`CORS_ORIGINS`）等 `/health` 200 后停进程，再 `Select-String '失败'`。
- **生产库零写操作**：所有连接都是本机 3407/3408/3409 的临时实例；未连生产、未做任何 gh/写操作。

## 四、用例矩阵（8 例，含反测）

| 用例 | 引擎 | 语料 | `/health` | 迁移日志 `失败` 计数 | 目录 |
|:--|:--|:--|:--:|:--:|:--|
| `01-red-baseline` | MySQL 8.0.28 | `origin/main`（未修） | 200 | **8**（6 条 FK + 2 条 173 版本伪红） | `cases/01-red-baseline/` |
| `03-fixed-mysql8028` | MySQL 8.0.28 | 修复后 | 200 | **2**（仅 173，两条同因） | `cases/03-fixed-mysql8028/` |
| `04-base-mysql8046` | MySQL **8.0.46** | `origin/main`（未修） | 200 | **6**（与 CI 日志**逐字一致**） | `cases/04-base-mysql8046/` |
| `05-base-mariadb` | MariaDB 11.4.5 | `origin/main`（未修） | 200 | **0**（6 条被 `safeExec` 静默 `跳过 (ER_CANT_CREATE_TABLE)`） | `cases/05-base-mariadb/` |
| `07-fixed-final-mysql8046` | MySQL **8.0.46** | 修复后（最终语料） | 200 | **0** | `cases/07-fixed-final-mysql8046/` |
| `08-fixed-final-mariadb` | MariaDB 11.4.5 | 修复后（最终语料） | 200 | **0** | `cases/08-fixed-final-mariadb/` |
| `09-反测-红-恢复原定义` | MySQL **8.0.46** | 修复后 + 把 2 条改回原定义 | 200 | **2**（点名同一约束） | `cases/09-反测-红-恢复原定义/` |
| `10-反测-复原-绿` | MySQL **8.0.46** | 逐字节复原 | 200 | **0** | `cases/10-反测-复原-绿/` |

> 每个用例目录的 `fingerprint.txt` 记录 **HEAD / 关键语料 sha256 / 关键 dist sha256 / 库与端口 / 时间**，防止"跑错工作树"污染读数。

## 五、关键读数（原始日志原文）

### 5.1 CI 真值与本地复现：同 6 条、逐字一致

CI（PR #305 的 `migration-check`，job `115489212715`，见 `ci/job-115489212715-pr305.log`）与本地 `04-base-mysql8046`（MySQL 8.0.46 空库，`origin/main`）**同样是 6 条**：

```
016_phase9_tenant_subscription.sql 失败: Referencing column 'tenant_id' and referenced column 'id' in foreign key constraint 't_tenant_module_access_ibfk_1' are incompatible.
016_phase9_tenant_subscription.sql 失败: … foreign key constraint 't_tenant_admin_ibfk_1' are incompatible.
017_phase10_instant_retail.sql     失败: Referencing column 'order_id' and referenced column 'id' in foreign key constraint 't_retail_order_item_ibfk_1' are incompatible.
017_phase10_instant_retail.sql     失败: … foreign key constraint 't_delivery_record_ibfk_1' are incompatible.
032_add_tenant_module_access.sql   失败: … foreign key constraint 't_tenant_module_access_ibfk_1' are incompatible.
034_add_tenant_admin.sql           失败: … foreign key constraint 't_tenant_admin_ibfk_1' are incompatible.
```

⇒ **本机读数与 CI 同形**（含 016 失败后 032/034 补刀的第二轮），基线可复现。

### 5.2 修复后：`失败` 计数 = 0（主口径 MySQL 8.0.46）

`cases/07-fixed-final-mysql8046/mig.log` ⇒ `失败命中数 = 0`（`Select-String '失败'` 空集；`/health` 200）。

### 5.3 MariaDB 的"假绿"被重现（这是本项的方法论要点）

`cases/05-base-mariadb/mig.log`（`origin/main` 未修）⇒ `失败 = 0`，但同一运行里：

```
[migration] 016_phase9_tenant_subscription.sql: 跳过 (ER_CANT_CREATE_TABLE)   ×2
[migration] 017_phase10_instant_retail.sql: 跳过 (ER_CANT_CREATE_TABLE)       ×2
[migration] 032_add_tenant_module_access.sql: 跳过 (ER_CANT_CREATE_TABLE)
[migration] 034_add_tenant_admin.sql: 跳过 (ER_CANT_CREATE_TABLE)
```

且终态 `t_tenant_module_access` **表不存在**（另 3 张由 074/046/192 补建）⇒ **同一份语料在 MariaDB 上全绿、在 MySQL 8 上 6 红**，与 S3-158 的结论完全一致。

### 5.4 反测（故意制造失败 ⇒ 该红就红 ⇒ 复原 ⇒ 绿）

装置 `harness/rt-tools.mjs`（break 前把原文冻结、restore 后断言 sha256 一致）；刻意选**两条不同缺陷型**、且都落在"声明该表的那一块"上：

| 步骤 | 改动 | 结果（MySQL 8.0.46 空库） |
|:--|:--|:--|
| break ① | `016:109` `tenant_id VARCHAR(36)` → `INT` | `失败: … foreign key constraint 't_tenant_module_access_ibfk_1' are incompatible.` |
| break ② | `017:180` `order_id BIGINT` → `INT`（`t_delivery_record`） | `失败: … foreign key constraint 't_delivery_record_ibfk_1' are incompatible.` |
| — | — | **合计 2 条，且点名同一约束**（`cases/09-反测-红-恢复原定义/`） |
| restore | 逐字节复原（sha256 断言一致） | `失败命中数 = 0`（`cases/10-反测-复原-绿/`） |

> **反测的设计说明（重要，防"骗过门禁"）**：把 `032`/`034` **单独**改回 `INT` 是**不会变红的**——016 先建表成功，032/034 那两条 `CREATE TABLE IF NOT EXISTS` 整条 no-op。基线之所以有 6 条红，正是因为"016/017 先失败 ⇒ 032/034 才有机会执行"这一链条；所以反测必须打**有效定义那一处**（本单打的是 016 与 017）。

### 5.5 第 6 条外键的"真实存在"（语句级探针，`13-probe-fk6.txt`）

装置 `harness/probe-fk6.mjs`（用 **runner 自己的 `addTablePrefix()`** 改写 016 的语句原文，在探针库执行）：

```
[步骤2] 016 的 t_tenant_admin 语句（经 runner addTablePrefix 改写后）
        FOREIGN KEY (tenant_id) REFERENCES t_tenant(id) ON DELETE CASCADE
[步骤2] 执行成功（无 errno 3780）
[步骤3] information_schema 外键行数 = 1
        t_tenant_admin_ibfk_1: tenant_id → t_tenant.id
[步骤3] SHOW CREATE TABLE 外键行：CONSTRAINT `t_tenant_admin_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `t_tenant` (`id`) ON DELETE CASCADE
[步骤4] 执行既有 169 的 DROP FOREIGN KEY 后，外键行数 = 0
```

⇒ **6 条建表语句全部被 MySQL 8 接受**；终态只有 5 条外键，是因为 **`169_tenant_admin_uuid.sql:1` 这条既有迁移**显式 `ALTER TABLE t_tenant_admin DROP FOREIGN KEY t_tenant_admin_ibfk_1;`（其注释写明理由：该表原外键指向不存在的 `tenant` 表 + 生产表已无外键）。**本单未删任何约束**（红线遵守）。

### 5.6 MySQL 8.0.28 上残留的 2 条＝**版本伪红**（不属本单）

同一份**修复后**语料：8.0.28 ⇒ `失败 = 2`（两条都是 `173_open_platform_api_key_columns.sql 失败: ALGORITHM=INSTANT is not supported for this operation.`）；8.0.46 ⇒ `失败 = 0`。版本边界为 MySQL **8.0.29**（位置加列 `ADD COLUMN … AFTER` 自 8.0.29 起才支持 `ALGORITHM=INSTANT`）。列存在性直证：

| 库 | `t_library_api_key` 的 173 新增列 | 说明 |
|:--|:--|:--|
| `s3194_fix46b`（8.0.46） | `tenant_id` `qps` `scopes` `prev_api_key` `prev_api_secret` `rotate_expire_at` = **6/6** | 全成功 |
| `s3194_fix28`（8.0.28） | `prev_api_key` `prev_api_secret` `rotate_expire_at` = **3/6** | 带 `AFTER` 的 3 条（`tenant_id AFTER app_name`、`qps AFTER daily_limit`、`scopes AFTER qps`）失败/连带跳过 |

CI 侧同一 run 的日志里**没有** 173 的失败行 ⇒ 该文件在 CI 的 8.0.4x 上本来就是绿的。

## 六、结构快照对照（`structure/` + `compare/`）

装置：`harness/snapshot.ps1`（tables/columns/indexes/fks 四张 tsv + 6 张目标表 `SHOW CREATE TABLE` 原文 + sha256）、`harness/compare-dumps.mjs`（分类对比）。

| 对比 | 左 → 右 | C 类（真实差异） | D 类（需人工核对） | 引擎天然差异 |
|:--|:--|:--:|:--:|:--|
| **C1** | `04-base-mysql8046` → `07-fixed-final-mysql8046`（同为 MySQL 8.0.46，隔离"修复"效应） | **19** | **1** | 0（同引擎，无天然差异） |
| C2 | `07` → `08`（修复后 MySQL vs 修复后 MariaDB，隔离"引擎"效应） | **0** | **0** | A 1206 / B 1613 / N3 1156 / N4 1048 / N5 391 / N6 25 / N7 14 |
| C3 | `05-base-mariadb` → `08-fixed-final-mariadb`（同为 MariaDB） | 19 | 1 | 0 |
| C4 | `05-base-mariadb` → `07-fixed-final-mysql8046`（跨库对照，=卡面要求） | 19 | 1 | A/B/N3~N7 |

**C1 的 19 条 C 类差异逐条解释（全量）**：

1. `t_tenant_module_access` 表**新增**（1 表 + 11 列 + 4 索引 + 1 外键 = 17 条）：这张表在 `origin/main` 的空库上**从未被建成**（016/032 两份定义均因 errno 3780 失败、且无补偿迁移）⇒ 本次修复把它补回来了（属**功能缺口修复**，非噪声）。
2. `t_delivery_record` **新增外键** `t_delivery_record_ibfk_1 → t_retail_order.id`（1 条）：卡面要求保留外键。
3. `t_delivery_record` **少一个冗余重复索引** `idx_delivery_record_order_id`（1 条）：该索引由补偿迁移 `046` 额外建，与 `017` 的 `idx_order` 同列重复；修复后改由 017 建表 ⇒ 不复现这条重复索引（无功能影响）。
4. 其余 0 条：`t_retail_order_item`、`t_tenant_admin`、`t_tenant`、`t_retail_order` 均**无差异**。

**C1 的唯一 D 类差异**：`t_tenant_admin` 的**表注释**由 `租户管理员表（S3-144：对齐 t_tenant.id UUID，不建物理外键）` 变为 `租户管理员表` —— 修复后该表由 016 建（列类型随后被既有 169 `MODIFY` 成同一口径），表注释取 016 的原文。**仅注释文本，列/索引/约束/数据语义零差异**；是否统一注释请凌舟裁定（见回执 §九）。

**C2 的意义**：修复后，MySQL 8.0.46 与 MariaDB 11.4.5 的空库结构**没有任何 C 类/D 类差异**，全部差异落在 7 类可解释的引擎天然差异（整数显示宽度、`0900_ai_ci`↔`general_ci`、`NULL` 显示形式、`CURRENT_TIMESTAMP` 形式与 `DEFAULT_GENERATED` 标志、默认值引号、`JSON`↔`LONGTEXT`、外键更新规则 `NO ACTION`↔`RESTRICT`）。

### 6.1 全库计数（`structure/*/counts.txt`，四套快照实测）

| 快照 | 表 | 列 | 索引行 | 外键 |
|:--|--:|--:|--:|--:|
| `04-base-mysql8046`（基线，MySQL 8.0.46） | 311 | 4143 | 1618 | 13 |
| `07-fixed-final-mysql8046`（修复后，MySQL 8.0.46） | **312** | **4154** | **1622** | **15** |
| `05-base-mariadb`（基线，MariaDB 11.4.5） | 311 | 4143 | 1618 | 13 |
| `08-fixed-final-mariadb`（修复后，MariaDB 11.4.5） | **312** | **4154** | **1622** | **15** |

⇒ 修复在两套引擎上产生**同一组**结构增量：**表 +1**（`t_tenant_module_access`）、**列 +11**（该表 11 列）、**索引行 +4**（该表 PRIMARY + `uk_tenant_module`(2 列) + `idx_tenant_module_tenant` + `idx_tenant_module_enabled` = 5 行 − `t_delivery_record` 的冗余重复索引 1 行）、**外键 +2**（`t_tenant_module_access_ibfk_1` + `t_delivery_record_ibfk_1`）。

## 七、全语料外键扫描（跨文件一致性，卡面 §二.3）

装置 `harness/fk-scan.mjs`（按 runner 真实执行顺序定"有效定义"：`migration.ts` 内嵌 DDL → `init_database.sql` → `docs/migrations/*.sql` 文件名升序）。

| 口径 | 修复前（`scan-baseline/`） | 修复后（`scan-final/`） |
|:--|:--|:--|
| 扫描源 / CREATE TABLE 块 / 归一表 | 200 / 429 / 313 | 200 / 429 / 313 |
| FOREIGN KEY 声明 | 28 | 28 |
| **红候选（有效定义，运行时必红）** | **4**（016×2、017×2） | **0** |
| 红候选（非有效块，前序失败后才执行） | 5（008×3、032、034） | 3（008×3） |
| 同表多定义 ⇒ **同列异型**分歧组 | 99 组 | **92 组** |

- 红候选 4+2（032/034）= **运行时实红的 6 条**，与 CI/本机日志**完全吻合**（装置的判据可信）。
- 修复后残留 3 条非有效红候选**全部在 `008_phase6_schema.sql`**（`t_supplier_statement_item.statement_id` 有符号性、`t_sys_user_role.user_id/role_id` `BIGINT` vs `INT`），其前序块（`init_database.sql` / `migration.ts`）**先建成功** ⇒ 这三条**永不执行、不产生红**（本机 8 例全绿佐证）；属**同族残留**，建议另立单（见回执 §八/§九）。
- **tenant_id / order_id 全量登记**（`scan-final/fk-scan.md` §五/§六，修复后）：`tenant_id` 共 **282 处**、`order_id` 共 **14 处**，逐处列出定义与所在文件:行。
- **同列异型残余 92 组**中，与本单同族的"身份列"仅 13 组：`tenant_id` 11 表（`t_price_change_log`/`t_subscription`/`t_retail_shop_config`/`t_retail_category`/`t_retail_banner`/`t_retail_product`/`t_retail_order`/`t_brand`/`t_points_record`/`t_error_logs` 等，形态为 `VARCHAR(64)`/`VARCHAR(32)` vs `VARCHAR(36)`）、`order_id` 2 表（**本单已对齐**）。这些分组**全部落在"非有效块"**（同表被前序文件先建）⇒ 不造成任何红，但属**潜在陷阱**（一旦前序定义失败，后一份就会以不同形状生效）。本单**未改**（红线：只改有问题的地方），按技术债铁律登记建议另立单。

## 八、门禁（`gates/`，全部在修复后工作树跑）

| 门禁 | 命令 | 结果 |
|:--|:--|:--|
| 全量测试 | `npx vitest run`（`backend/`） | **652 文件 / 7694 用例 / 0 failed**，EXIT=0（`gates/vitest-full.txt` 末尾统计） |
| 类型检查 | `npx tsc -p tsconfig.json --noEmit` | **EXIT=0**（`gates/tsc-noEmit.txt` 空） |
| 门禁 1 | `node backend/scripts/guard-route-auth.mjs` | **EXIT=0**（`✅ G3 通过…公开端点已登记 18 个文件`） |
| 门禁 2 | `node backend/scripts/guard-tenant-status.mjs` | **EXIT=0**（`✅ G2 通过：租户状态域只有 ACTIVE / DISABLED 一套口径`） |
| 门禁 3 | `node backend/scripts/guard-route-prefix.mjs` | **EXIT=0**（`✅ G36 通过：重复前缀 12 个（均已登记）、未登记 0 个、真重复端点 0 个`） |
| 另 | `node backend/scripts/guard-rbac-wiring.mjs` | EXIT=0（非 required；输出 4 条"未登记"= **基线同值**，在未改动的 `S3-194-base` 树上跑同样 4 条） |
| 构建 | `npm --workspace backend run build` | **EXIT=0**；构建后 `dist/shared/migration.js`、`dist/shared/seed-data.js`、`dist/server.js` 哈希与各用例指纹**逐一相同**（读数未被重建污染） |

## 九、范围外发现（**未改**，登记待裁定）

1. **`173_open_platform_api_key_columns.sql` 的 `ALGORITHM=INSTANT` + 位置加列**：MySQL < 8.0.29 报 `ALGORITHM=INSTANT is not supported for this operation`，导致本地 8.0.28 上 `失败=2` / 少 3 列；CI 与生产（8.0.4x）上为绿。**与 errno 3780 无关**，本单未动。
2. **`t_tenant_admin` 表注释**（C1 唯一 D 类）：是否统一注释，需裁定。
3. **`046` 的冗余重复索引** `idx_delivery_record_order_id`（与 `idx_order` 同列）：修复后不复现。
4. **`t_delivery_record` 在全新库新增外键**（生产既有形状来自 046，无外键）⇒ 迁移语义上 `DELETE t_retail_order` 会级联删配送记录，生产侧不会。这是**卡面"外键必须保留"**的直接结果，请凌舟确认可接受。
5. **`tenant_id` 宽度漂移 11 表**（`VARCHAR(32)`/`VARCHAR(64)` vs `VARCHAR(36)`；含 `074` 即时零售族 6 表、`120d` 的 `t_subscription`、`t_brand`、`t_points_record`、`t_error_logs`）与 **`008` 的 3 条同族类型分歧**：均**不造成红**，建议另立单统一。
6. **`t_sys_user.mobile` 位置相关**：本轮与 S3-190 同基线，未见再现（不属本单）。

## 十、复跑命令（照抄可跑）

```powershell
$base='D:\Users\ZXQL\wt-agents\_s3194-evidence'; $my="$base\mysql8046\mysql-8.0.46-winx64"
# 0) 起库（空 datadir 首次需 --initialize-insecure，见 §三）
Start-Process "$my\bin\mysqld.exe" -WindowStyle Hidden -ArgumentList "--no-defaults","--basedir=$my","--datadir=$base\mysql8046-data","--port=3408","--bind-address=127.0.0.1","--mysqlx=0"
# 1) 主口径用例（修复后 ⇒ 失败=0；把 -Repo 换成 S3-194-base 即得基线 6 条）
powershell -NoProfile -File "$base\harness\run-case.ps1" -Repo 'D:\Users\ZXQL\wt-agents\S3-194' -DbName 's3194_replay' -Port 8097 -Tag '90-replay' -MyBin "$my\bin" -DbPort 3408
# 2) 结构快照 + 差异分类
powershell -NoProfile -File "$base\harness\snapshot.ps1" -MyBin "$my\bin" -DbPort 3408 -DbName 's3194_replay' -Tag '90-replay'
node "$base\harness\compare-dumps.mjs" "$base\04-base-mysql8046\structure" "$base\90-replay\structure" "$base\compare\C1-replay.md" 'C1 replay'
# 3) 全语料外键扫描 / 反测 / 语句级探针
node "$base\harness\fk-scan.mjs" 'D:\Users\ZXQL\wt-agents\S3-194' "$base\91-scan"
node "$base\harness\rt-tools.mjs" break   'D:\Users\ZXQL\wt-agents\S3-194' "$base\rt-frozen"
node "$base\harness\rt-tools.mjs" restore 'D:\Users\ZXQL\wt-agents\S3-194' "$base\rt-frozen"
$env:JWT_SECRET='ci-migration-secret'; $env:NODE_ENV='development'
node "$base\harness\probe-fk6.mjs" 'D:\Users\ZXQL\wt-agents\S3-194' "$my\bin" 3408 s3194_probe "$base\93-probe.txt" s3194_replay
```

## 十一、输入指纹（`cases/*/fingerprint.txt` 同源）

| 文件 | sha256(前 16) 修复后 | 基线（`origin/main`） |
|:--|:--|:--|
| `016_phase9_tenant_subscription.sql` | `BF2F9BDC396E4DC0` | `C5D0031DDD2486ED` |
| `017_phase10_instant_retail.sql` | `6151D754F77593E9` | `FBD9B78D73CCBA9F` |
| `032_add_tenant_module_access.sql` | `C29E24CCF815B4E9` | `C3C63798AAB1F3B7` |
| `034_add_tenant_admin.sql` | `E8A3F947A3865F35` | `8276346507430BB8` |
| `192_租户建租户与归因落点补列.sql`（未动） | `9F7493083CD25474` | 同 |
| `backend/src/shared/migration.ts`（未动） | `8167BED3DA849730` | 同 |
| `backend/src/shared/seed-data.ts`（未动） | `F085128059D6B251` | 同 |
| `backend/dist/shared/migration.js` | `B5161C983607288B` | 同 |
| `backend/dist/shared/seed-data.js` | `47C1C091BB17E098` | 同 |
| `backend/dist/server.js` | `F77389A7F7C30FF9` | 同 |

## 十二、局限与自我报备

1. **主口径与 CI 同版本（8.0.46），但本机不是容器**：字符集/排序规则已用 `--no-defaults` + 服务器默认对齐；CI 的 `mysql:8.0` 运行在 Linux，Windows 侧未见影响本项判据（errno 3780 纯类型判据）。8.0.28 的 2 条残留已逐条定性为版本伪红，**未**用它们下任何"修复不彻底"的结论。
2. **本包不含数据库安装体与 datadir**（`mysql-8.0.46-winx64.zip` 248MB、解压体 ~1GB、三套 datadir 均在仓外 `_s3194-evidence`）；`harness/` 与全部小体积产物已入库可复核。
3. **生产/线上库真实形状未取**（不得连生产）：`t_delivery_record` 是否真无外键、`t_tenant_admin` 注释的真值，均以**迁移语料**为准（046 / 192+169），并已在 §九 列为待裁定项。
4. **12 行形状对齐（017 的 `t_retail_order_item`）是我的判断，不是卡面明列**：理由是"不这样做会引入全新库 `Unknown column 'tenant_id'` 的真故障"（§2.2）。若凌舟认为该对齐超出本单范围，回退这一处即可（其余 6 处类型修复与它无耦合）。
5. 全部读数都带输入指纹（语料 + dist sha256），且 8 个用例共用同一份 dist（哈希与 §十一 一致）。
