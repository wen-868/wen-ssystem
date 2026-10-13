# ACTIVE 回执 · S3-194（空库迁移在 MySQL 8 上被外键不兼容打断 errno 3780 —— 4 文件 / 6 条约束）

```
【汇报 R101-S3-194】6 条外键引用列类型对齐到被引用列真实口径 ⇒ 全新 MySQL 8.0.46 空库迁移「失败」6 → 0，6 条约束建表语句全部被 MySQL 8 接受；反测两侧齐（改回 2 条 → 点名同一约束变红；逐字节复原 → 0）
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 迁移 · 本地通道）｜2026-10-14
交付物：工作树 D:\Users\ZXQL\wt-agents\S3-194｜分支 fix/s3-194-mysql8-fk-incompatible｜基线 origin/main = 25728007c18d3d3077809c5e5ef7af3a57fb7711
证据（可复跑）：docs/evidence/S3-194/README.md（本包索引）+ cases/（8 例原始 mig.log 与输入指纹）+ structure/（4 套结构快照）+ compare/（C1~C4 差异分类）+ gates/（门禁原始输出）+ ci/job-115489212715-pr305.log；装置在 docs/evidence/S3-194/harness/
验收自评：卡面 §三 三条 + §四 反测 + §五 方法论 + §二.3 跨文件一致性 —— 逐条见 §四 / §五 / §六
未完成与阻塞：见 §八（无阻塞项；有一处"判据字面与既有 169 迁移冲突"需裁定，已给替代判据）
风险与自我报备：见 §九（含"12 行形状对齐超出卡面明列"的主动报备）
回传要求：本汇报已落卡：docs/tasks/inbox/ACTIVE-回执-S3-194.md
关联卡：docs/tasks/inbox/archive/ACTIVE-S3-194-20261014.md
```

派单人：凌舟（总负责人）｜2026-10-14
汇报人：阿坚（后端 / 迁移 · 本地通道）｜2026-10-14

---

## 一、交付物（逐文件 + 哈希）

工作树 `D:\Users\ZXQL\wt-agents\S3-194`（**未 commit / 未 push / 未开 PR**）；`git status --porcelain` 仅 4 个迁移文件（+ `docs/evidence/S3-194/` 证据包）。

| 文件 | 改动 | sha256(16) 前 → 后 | 说明 |
|:--|:--|:--|:--|
| `docs/migrations/016_phase9_tenant_subscription.sql` | 2 行 | `C5D0031DDD2486ED` → `BF2F9BDC396E4DC0` | `:109` `t_tenant_module_access.tenant_id` `INT`→`VARCHAR(36)`；`:152` `t_tenant_admin.tenant_id` `INT`→`VARCHAR(36)` |
| `docs/migrations/017_phase10_instant_retail.sql` | 12→16 行 + 1 行 | `FBD9B78D73CCBA9F` → `6151D754F77593E9` | `:141` `t_retail_order_item.order_id` `INT`→`BIGINT`；`:176` `t_delivery_record.order_id` `INT`→`BIGINT`；另 §二.2 的 12 行形状对齐 |
| `docs/migrations/032_add_tenant_module_access.sql` | 1 行 | `C3C63798AAB1F3B7` → `C29E24CCF815B4E9` | `t_tenant_module_access.tenant_id` `INT`→`VARCHAR(36)` |
| `docs/migrations/034_add_tenant_admin.sql` | 1 行 | `8276346507430BB8` → `E8A3F947A3865F35` | `t_tenant_admin.tenant_id` `INT`→`VARCHAR(36)` |

- **合计 4 文件 / +20 −16 行**（`git diff --numstat`：2/2、16/12、1/1、1/1）；**未动**：业务路由 / 控制器 / 服务 / `backend/src/**` / `.github/**` / `deploy/**` / `R101-收口总清单.md` / `ACTIVE.md` 路由表 / `current-tasks.md` / `docs/数据库变更清单.md` / 记忆文件。
- 行尾与文件末换行**逐字节保持**（032/034 原"无行末换行"+CRLF 已复原；无整文件重写）。

## 二、缺陷定性（被引用列 vs 引用列，双侧真值）

| # | 约束 | 引用列（真值） | 被引用列（真值） | 定性 |
|:--:|:--|:--|:--|:--|
| 1 | `t_tenant_module_access_ibfk_1`（016:107） | `INT` | `t_tenant.id` = `VARCHAR(36)`（`migration.ts:534` 第 1 步建的既有表） | 迁移语料把 UUID 列写成 `INT` |
| 2 | `t_tenant_admin_ibfk_1`（016:150） | `INT` | 同上 | 同上 |
| 3 | `t_retail_order_item_ibfk_1`（017:139） | `INT` | `t_retail_order.id` = `BIGINT`（017:101） | 迁移语料把自增列写成 `INT` |
| 4 | `t_delivery_record_ibfk_1`（017:174） | `INT` | 同上 | 同上 |
| 5 | `t_tenant_module_access_ibfk_1`（032:2） | `INT` | `t_tenant.id` = `VARCHAR(36)` | 同表第二份定义（016 失败后才轮到它） |
| 6 | `t_tenant_admin_ibfk_1`（034:2） | `INT` | 同上 | 同表第二份定义 |

**根因**：MySQL 8 对外键两侧列类型/字符集/排序规则**严格校验**（errno 3780）；MariaDB 更宽容且 `ER_CANT_CREATE_TABLE` 在 `migration.ts:37` 的 `SKIP_ERRORS` 里 ⇒ 同一份语料**在 MariaDB 上被静默跳过（全绿）、在 MySQL 8 上 6 红**。

### 二.2 一处"有效定义形状"对齐（017 的 `t_retail_order_item`，本单判断项）

修好 `order_id` 后 017 的建表由"恒失败"变成功，`074_即时零售表.sql:167-183` 那份**更完整的同表定义**随即整条 no-op ⇒ 全新库会拿到**较窄形状**（缺 `sku_id`/`tenant_id`/`created_at`、`id`/`product_id` 掉回 `INT`、`product_name` 200→128、`product_image` 500→255、`quantity` 丢 `DEFAULT 1`），而 `backend/src/services/instant-retail/retail-shop.service.ts:332` 正是按 `… WHERE order_id = ? AND tenant_id = ?` 读这张表、`:77-82` 的行类型含这三个列 ⇒ 会**新引入** `Unknown column 'tenant_id'` 的真故障。故把 017 该表**逐列/逐索引对齐到 074 的既成口径**（= 生产既有形状），`order_id` 保持 `BIGINT`、外键保持并与 074 同名。对齐后该表在"基线 vs 修复后"快照对比里**零差异**。

## 三、原始证据（可复跑）

完整索引与全部读数见 `docs/evidence/S3-194/README.md`。要点：

**① 基线可复现（MySQL 8.0.46 空库，`origin/main`）**：`失败 = 6`，与 CI（PR #305 的 job `115489212715`，日志见 `ci/job-115489212715-pr305.log`）**逐字一致**（含 016 失败后 032/034 补刀）。

**② 修复后（同版本同口径）**：`失败 = 0`（`cases/07-fixed-final-mysql8046/mig.log`，`/health` 200）。

**③ MariaDB 假绿重现**：`origin/main` 在 MariaDB 11.4.5 上 `失败 = 0`，同轮 6 条 `跳过 (ER_CANT_CREATE_TABLE)`，且终态 `t_tenant_module_access` **表不存在**。

**④ 结构快照对照**：`04`（基线 MySQL 8.0.46）→ `07`（修复后）**C 类 19 条 / D 类 1 条**，逐条解释见 README §六；`07` vs `08`（修复后 MySQL vs MariaDB）**C 类 0 / D 类 0**，仅 7 类引擎天然差异（A 1206 / B 1613 / N3 1156 / N4 1048 / N5 391 / N6 25 / N7 14）。

**⑤ 全语料外键扫描**（卡面 §二.3）：28 条 FK 声明；**有效定义红候选 4 → 0**；残留 3 条非有效红候选全部在 `008_phase6_schema.sql`（前序块先建成功 ⇒ 永不执行）；`tenant_id` 全量登记 **282 处**、`order_id` **14 处**；**同列异型残余 92 组**，其中与本单同族的"身份列" 13 组（`tenant_id` 11 表 + `order_id` 2 表，后者本单已消），**全部落在非有效块、不造成任何红**。

**⑥ 第 6 条外键确已建成**（语句级探针 `13-probe-fk6.txt`，用 runner 自己的 `addTablePrefix()`）：016 的 `t_tenant_admin` 语句执行成功 → `information_schema` 外键行 1 条 `t_tenant_admin_ibfk_1: tenant_id → t_tenant.id`；随后执行**既有 169** 的 `DROP FOREIGN KEY` → 0 条。⇒ **6 条建表语句全部被 MySQL 8 接受**，终态 5 条是既有 169 的既定口径，**本单未删任何约束**。

## 四、验收自评（逐条对照卡面）

| 卡面判据 | 自评 | 依据 |
|:--|:--:|:--|
| §三.1 MySQL 8 空库 `失败` 计数 = 0 | ✅ | `cases/07-fixed-final-mysql8046`：`失败命中数 = 0`（`Select-String '失败'` 空集） |
| §三.1 6 条外键"真实存在" | ⚠️ **字面未达，已给替代判据** | 终态 5 条存在；第 6 条被**既有 169** `DROP FOREIGN KEY` 移除（§三⑥ 探针证明它先被成功建成）。若按字面判据，需改 169（**既有设计口径**，超出本单红线范围）——请裁定，见 §八 |
| §三.2 结构快照与基线对照、差异逐条解释 | ✅ | `compare/C1`（同引擎）+ `C4`（跨库）：C 类 19 条**逐条**解释（新增表/新增外键/少一个冗余重复索引），D 类 1 条（表注释）；`C2` 把 7 类引擎天然差异分类列出，无"笼统忽略" |
| §三.3 门禁 | ✅ | `vitest run` **652 文件 / 7694 用例 / 0 failed**（EXIT=0）、`tsc --noEmit` **EXIT=0**、`guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` 三条 **EXIT=0**、`npm --workspace backend run build` **EXIT=0**；构建后 dist 哈希与各用例指纹逐一相同 |
| §四 反测（改回 1~2 条 ⇒ 重现 errno 3780 并点名同一约束；复原 ⇒ 绿） | ✅ | `cases/09-反测-红-恢复原定义`：`t_tenant_module_access_ibfk_1` + `t_delivery_record_ibfk_1` 两条 `are incompatible`；`cases/10-反测-复原-绿`：0（复原经 sha256 断言） |
| §五 方法论（写清哪些结论来自 MySQL 8 / MariaDB） | ✅ | 主口径 **MySQL 8.0.46 = CI 同版本**（全部"绿/红"结论）；MariaDB 仅用于**证明假绿**与结构对照；MySQL 8.0.28 仅用于**版本敏感性对照**（其 2 条残留= `173` 的 `ALGORITHM=INSTANT` 版本伪红，附列存在性 6/6 vs 3/6 直证） |
| §二.2 只改迁移语料、保留外键、不得 `SET FOREIGN_KEY_CHECKS=0` | ✅ | 改动全部落在 `docs/migrations/*.sql`（只替换列类型 token + 一处形状对齐）；**6 条 `FOREIGN KEY` 声明一字未删**；本单 diff 内**不含**任何 `SET FOREIGN_KEY_CHECKS` / 跳外键写法（`git diff \| Select-String FOREIGN_KEY_CHECKS` 为空）。**合规备注**：语料本身在 `001/003/004/006/007` 等历史文件里**既有** `SET FOREIGN_KEY_CHECKS = 0/1`（本单未动、也未新增），本项仅指"不改语料、保留约束" |
| §六 红线 | ✅ | 未动业务路由/控制器/服务、`.github/**`、`deploy/**`、`R101-收口总清单.md`；生产库零写（全部连接为 3407/3408/3409 本机临时实例）；未删任何约束；未删工作树（无需 `rmdir node_modules`） |

## 五、反测的两侧（原文）

```
# 09（把 016:109 与 017:180 改回原定义）→ MySQL 8.0.46 空库
016_phase9_tenant_subscription.sql 失败: Referencing column 'tenant_id' and referenced column 'id' in foreign key constraint 't_tenant_module_access_ibfk_1' are incompatible.
017_phase10_instant_retail.sql     失败: Referencing column 'order_id' and referenced column 'id' in foreign key constraint 't_delivery_record_ibfk_1' are incompatible.
失败命中数 = 2
# 10（逐字节复原，sha256 断言一致）⇒ 失败命中数 = 0
```

**反测为何打这两处（防"被门禁骗过"）**：把 `032`/`034` 单独改回 `INT` **不会变红**（016 先建成功 ⇒ 那两条 `CREATE TABLE IF NOT EXISTS` 整条 no-op）。基线之所以 6 红，是"016/017 先失败 ⇒ 032/034 才轮到执行"的链条；因此反测必须打**有效定义那一处**。

## 六、跨文件一致性（卡面 §二.3）数字口径

- **本单修复：6 处**（4 文件）；**因本单而自动归族的形状分歧：3 组**（`t_tenant_admin.tenant_id` `INT×2` vs `VARCHAR(36)` ⇒ 现三份定义同型；`t_retail_order_item.order_id`、`t_delivery_record.order_id` `INT` vs `BIGINT` ⇒ 现同型）。
- **仍存同族"身份列"异型：13 组**（`tenant_id` 11 表：`VARCHAR(64)`/`VARCHAR(32)` vs `VARCHAR(36)`；`order_id` 2 表已消）——**全部落在非有效块**（同表被前序文件先建），**不造成任何红**，本单未改（红线）。建议另立单。
- **全语料同列异型合计 92 组**（含非身份列，如 `id` 的 `INT` vs `INT UNSIGNED`、`product_name` 宽度等），同为**存量债**，建议另立单；本单只把"造成 errno 3780 的 6 条"修到位。

## 七、范围外发现（未改，登记）

1. `173_open_platform_api_key_columns.sql`：`ADD COLUMN … AFTER` + `ALGORITHM=INSTANT` 在 MySQL < 8.0.29 报错（本机 8.0.28 上 `失败=2`/少 3 列；CI 8.0.4x 上为绿）。**与 errno 3780 无关**。
2. `t_tenant_admin` **表注释**差异（C1 唯一 D 类）：`租户管理员表（S3-144：…）` → `租户管理员表`。
3. `046` 的冗余重复索引 `idx_delivery_record_order_id`（与 `idx_order` 同列）：修复后不复现。
4. `t_delivery_record` 在全新库**新增外键**（生产形状来自 046，无外键）⇒ 迁移语义上 `DELETE t_retail_order` 会级联删配送记录。
5. `008_phase6_schema.sql` 的 3 条同族类型分歧（`t_supplier_statement_item.statement_id` 有符号性、`t_sys_user_role.user_id/role_id` `BIGINT` vs `INT`）。

## 八、未完成与阻塞

1. **§三.1「6 条外键真实存在」的字面判据与既有 169 迁移冲突**（唯一需要裁定的判据项）：卡面口径要求 6 条外键真实存在，而**既有** `docs/migrations/169_tenant_admin_uuid.sql:1` 显式 `DROP FOREIGN KEY t_tenant_admin_ibfk_1`（注释写明理由：原外键指向不存在的 `tenant` 表）。本单遵守"不得删约束"红线**保留了 016 的声明**并证明它被成功建成（§三⑥），但终态是 5 条。**请裁定**：(a) 接受"5 条 + 语句级建成证明"为达标；(b) 若要终态 6 条，需另立单改 169（**既有已执行迁移**，属独立口径变更）。
2. 无可复跑的**生产库**形状（不得连生产）⇒ §七.3/§七.4 的"生产真值"仅以迁移语料（046/192+169）为准。
3. `ACTIVE.md` 路由表、`current-tasks.md`、`docs/数据库变更清单.md`、记忆文件**归你更新**（本单未动，理由：非凌舟不得改路由/看板，且同期 S3-191/192 并行）。
4. 仓库根 `npm run build` 在基线即不可达（`miniapp`/`platform-miniapp` 无 `build` 脚本）——**非本单引入**，本单按"逐工作区构建"口径报后端 build（与 S3-190 同因，仍待你裁定口径）。

## 九、风险与自我报备

1. **12 行形状对齐超出卡面明列的 6 处**（§二.2）：这是**我加的判断**。理由已写清（不加会引入全新库 `Unknown column 'tenant_id'` 的真故障，代码行号可复核）。若你认为超范围，回退这一处即可——它与其余 6 处类型修复**无耦合**（已在 `cases/07` 与 `cases/09/10` 中分别验证）。
2. **8.0.28 与 8.0.46 的读数差异没有被我"抹平"**：8.0.28 上修复后仍有 2 条红（173），我**没有**去改 173 换绿，而是把它定性为版本伪红并给出列存在性直证（6/6 vs 3/6）。若你认为本项就该把 173 一并修掉，请派单。
3. **反测装置首版有缺陷已修**：`rt-tools.mjs` 初版正则用 `\b` 收尾（`VARCHAR(36)` 后接空格时永不匹配），当场报错中断、未污染仓库；改为 `(?=\s)` 后正常。冻结/复原都带 sha256 断言，未出现"仓库留在故意改坏状态"（对比踩坑日志 [115]）。
4. **结构对比装置首版有假阳性已修**：`fk-scan.mjs` v1 按"同表最后一份定义"取值，对 `t_subscription` 产生 2 条**假红**；v2 改为"按 runner 真实执行顺序取有效定义 + 子列取声明块本身"，红候选 4+2=6 与运行时实红 6 条**完全吻合**后才用于结论。v1 结论**未**用于任何判断。
5. **快照对比曾把"MySQL 客户端 BOM"当差异**：`compare-dumps.mjs` 已剥离首行 BOM（否则会虚报 1 条外键左右各一次）。
6. **未在 MariaDB 上验证"修完后 6 张表形状与生产一致"**：MariaDB 侧只作为"假绿/引擎差异"对照（`cases/08` 全绿 + `C2` 无 C/D 类差异）。生产形状未取，见 §八.2。

派单人：凌舟（总负责人）｜2026-10-14
汇报人：阿坚（后端 / 迁移 · 本地通道）｜2026-10-14
关联卡：`docs/tasks/inbox/archive/ACTIVE-S3-194-20261014.md`
