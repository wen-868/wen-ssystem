# S3-190 证据包：空库迁移/种子族根治（seed 顺序中断 · DROP INDEX 无守卫 · 24 条缺前缀）

> 执行人：**阿坚（后端 / 迁移）**（本地子代理通道）｜单号：**S3-190**（收口总清单第 55 / 56 / 53 项）
> 工作树：`D:\Users\ZXQL\wt-agents\S3-190`｜分支：`fix/s3-190-empty-db-seed-and-prefix`｜基线：`origin/main` = `d0732249`
> 状态：**未 commit / 未 push / 未开 PR**（由凌舟本机提交）；全程只用**本机私有 MariaDB 11.4.5**（`127.0.0.1:3406`，datadir 在 `%TEMP%`），**生产库零写操作**
> 回执：`docs/tasks/inbox/ACTIVE-回执-S3-190.md`｜基线参考工作树（只读副本）：`D:\Users\ZXQL\wt-agents\S3-190-base`（detached `d0732249`）

---

## 一、一句话结论

三项全部修复，判据全绿、反测两侧齐：

| 项 | 缺陷 | 修复 | 关键读数（空库） |
|:--|:--|:--|:--|
| **55** | 种子（第6步）跑在外部迁移（第8步）**之前**，而种子用到的列由外部迁移补出 ⇒ 空库上种子在"插入默认门店"后中断，**演示账号与全部种子数据从未创建** | 顺序修正为"**语料先、种子后**"（`migration.ts` 第8.5步） | 修复前：`t_store=1 / t_member=0 / t_sale_bill=0 / 账号=2`；修复后：`t_member=3 / t_sale_bill=5 / 账号=4`，`store_manager`、`store_operator` `verifyPassword=PASS` |
| **56** | `migration.ts` 未加守卫的 `DROP INDEX uk_config_key, ADD UNIQUE KEY …` ⇒ 空库恒报 `Can't DROP INDEX`，**同语句的 ADD 一并未执行** | 改为"存在才 DROP、不存在才 ADD"两步守卫（`information_schema.STATISTICS`） | 修复前日志：`t_sys_config.uk_config_key_tenant 失败: Can't DROP INDEX …`；修复后：`已存在，跳过 ADD（守卫生效）`、`safeExec 失败行=0` |
| **53** | 24 条补列/补索引语句传的表名**缺 `t_` 前缀**（写在字符串字面量里，`addTablePrefix()` 看不到）⇒ 恒 `ER_NO_SUCH_TABLE`，**从未生效** | 只补表名前缀（24 条，列/索引定义与守卫语义一字未改） | 修复前：24 条目标中 **12 条完全不存在**、12 条定义与语料不符；修复后：**24 条全部存在**；按文件的 `ER_NO_SUCH_TABLE` 差值 26−2=**24** |

空库结构（全新库一次跑完）：`311 表 / 4137 列 / 1612 索引` → `311 / 4143 / 1618`；与"语料意图"基线的差异：**修复前 18**（6 缺列 + 6 缺索引 + 6 列定义不一致），**修复后 0**。

---

## 二、三项现状与根因（实测读数，非推测）

### 2.1 第 55 项 · 空库下种子中断

- 现象（修复前空库日志）：`ERROR [migration] 种子数据初始化失败:` + `"Unknown column 'mobile' in 'INSERT INTO'"`
- 根因：`t_sys_user.mobile` 由**外部迁移** `192_租户建租户与归因落点补列.sql:23` 补出，而 `seedData()` 原先在**第6步**执行（**早于**第8步的外部迁移语料）。`seed-data.ts:102` 要写 `mobile` ⇒ 空库必抛 `ER_BAD_FIELD_ERROR`；该 try 块在"插入默认门店"之后即整体中断，**后续全部种子一并未执行**（演示账号、分类、SPU/SKU、价格、库存、会员、供应商、示例销售单、采购单）。
- 后果：新环境 / 灾备重建得到"**静默半成品**"（只有 1 家默认门店 + admin/tenant_admin 两个平台账号）。

### 2.2 第 56 项 · 未加守卫的 `DROP INDEX`

- 原语句：`ALTER TABLE t_sys_config DROP INDEX uk_config_key, ADD UNIQUE KEY uk_config_key_tenant (config_key, tenant_id)`
- 事实：`t_sys_config` 由 `docs/init_database.sql:42`（本文件第1步执行）直接建出 **`uk_config_key_tenant`**，**从来不建 `uk_config_key`**（`005_phase3_sys_config.sql:22` 也声明同一个键）。⇒ 空库上 DROP 恒报 `Can't DROP INDEX 'uk_config_key'; check that it exists`（`ER_CANT_DROP_FIELD_OR_KEY`，**不在** `SKIP_ERRORS` ⇒ 恒红日志），且**同一条 ALTER 里的 ADD 一并回滚**。
- 库级直证（`f2-add-rolled-back.txt`）：先删掉 `uk_config_key_tenant` 使其成为目标，再**不经产品代码**直发原语句 ⇒ `ERROR 1091 (42000)`，语句后目标键计数 **仍为 0** ⇒ `ADD` 确实一并未执行。

### 2.3 第 53 项 · 24 条缺前缀语句

| 文件 | 条数 | 原表名 → 应有表名 |
|:--|--:|:--|
| `092_租户ID.sql` | 12 | `sys_config/sys_user/sys_role/sys_permission/sys_user_role/sys_role_permission` → 加 `t_`（6 列 + 6 索引） |
| `120a_合规凭证字段.sql` | 8 | `sale_bill_item`(3) / `sale_bill`(3) / `collection_link`(2) → 加 `t_` |
| `137_sys_user_dept_position.sql` | 2 | `sys_user` → `t_sys_user` |
| `138_approval_business_link.sql` | 2 | `purchase_order` / `sale_return` → 加 `t_` |

逐条台账（文件:行 + 原表名 + 应有表名）由 `harness/list-unprefixed.mjs` 生成，见回执卡附表。

**根因（关键）**：这 24 条的表名写在**字符串字面量**里（`SET @s3186_tbl = 'sys_config'` ⇒ 动态 SQL 里的 `ALTER TABLE `sys_config``），而 `migration.ts::addTablePrefix()` 只对**裸写/反引号写的表名**补前缀（`CREATE/ALTER TABLE`、`INSERT INTO`、`UPDATE`、`FROM/JOIN`、`REFERENCES`、`RENAME`、`DROP TABLE` 等模式）——**看不到字符串里的表名**。S3-186 把 CALL 改写成守卫式写法时"语义按原样保留"，缺前缀被一并保留 ⇒ 依旧恒失效。
原始 092 的辅助过程把 `tbl_name` **原样**拼进 `ALTER TABLE`（见 `git show 9225fd17^:docs/migrations/092_租户ID.sql` 过程体），所以"缺前缀"从来不是设计意图。

---

## 三、改了什么（逐文件 + 哈希）

| 文件 | 工作树 SHA256 前 12 位 | numstat（vs HEAD） | 改动 |
|:--|:--|:--|:--|
| `backend/src/shared/migration.ts` | `8167BED3DA84` | +53 / −15 | ①第2.5步 DROP INDEX 加守卫；②种子块从"第6步"移到"第8.5步"（外部迁移之后） |
| `docs/migrations/092_租户ID.sql` | `ECA62DBE1887` | +31 / −25 | 12 条表名补前缀（48 行执行行/标签）+ 文件头 5 行说明 |
| `docs/migrations/120a_合规凭证字段.sql` | `E37659ACA7EC` | +22 / −17 | 8 条 + 文件头 4 行说明 |
| `docs/migrations/137_sys_user_dept_position.sql` | `4C183E1C7026` | +7 / −4 | 2 条 + 文件头 3 行说明 |
| `docs/migrations/138_approval_business_link.sql` | `26FE4BC7F4C4` | +7 / −4 | 2 条 + 文件头 3 行说明 |

合计 **5 文件 / +120 −65**；`git status` 另有未跟踪的 `docs/evidence/S3-190/`。业务路由/控制器/服务 **0 处**改动；`.github/**`、`deploy/**`、其它迁移文件、`R101-收口总清单.md` 未动。

---

## 四、基线口径（本单最重要的口径定义）

S3-186 建立的基线口径是"**语料意图**"：*全部迁移语句在**其文件位置上就地执行**所能建出的结构*（S3-186 README §七.1）。本单沿用同一定义，并把第 53 项的意图（**表名按语料自身命名，即 `t_` 前缀**）计入：

> **S3-190 基线 B = `d0732249` 的语料 + 只把 24 条表名纠正为 `t_` 前缀（`migration.ts` 保持原样）→ 全新空库一次跑完的结构。**

用**另起一个干净工作树**（`S3-190-base`，detached `d0732249`）构造 B，做到**与被测的 `migration.ts` 改动零耦合**：这样 `base2 vs post2 = 0` 才能同时证明"第 53 项修到位"与"第 55/56 项不改结构"，而不是自证自。

基线口径的独立交叉核对：`pre2`（= HEAD 全量语料）的结构哈希 `9b7e8aec…` 与 **S3-186 证据包里 `runC/runE` 的结构哈希逐字节相同**（S3-186 README §四）⇒ 两边量的是同一个"修复前结构"。

---

## 五、验收判据与原始读数（每条可复跑）

**输入指纹**：每个用例的日志头部都会打印 `repo + 语料 sha256(前32) + 缺前缀SET行数 + migration.ts sha16 + dist/migration.js sha16`，用于自证"跑的是哪份输入"（`harness/run-case-any.ps1`）。

| 用例 | 库 | 工作树 | 缺前缀 SET 行 | 语料 sha256(32) | migration.ts sha16 | 表/列/索引 | 结构 sha256(32) |
|:--|:--|:--|--:|:--|:--|:--|:--|
| **pre2** | `s3190_pre2` | `S3-190-base` | **24** | `B141E929CBE6ED5752B0331C20DB28DD` | `26FE4BC7F4C4`（HEAD 原样） | 311/4137/1612 | `9b7e8aec` |
| **base2**（= 基线 B） | `s3190_base2` | `S3-190-base` | 0 | `C79680A56EB2E397AE343E3FE1CD7B77` | 同上 | 311/**4143**/**1618** | `3caa9f0d` |
| **post2** | `s3190_post2` | `S3-190` | 0 | `258E693DE17F2B575A71BBCF9DDF29B1` | `8167BED3DA849730` | 311/4143/1618 | `3caa9f0d` |
| **f1red**（反测） | `s3190_f1red` | `S3-190` | **24** | `ACF24E8E65F780FA1397BA6170648D51` | `8167BED3DA849730` | 311/4137/1612 | `9b7e8aec` |
| **f1green**（复原） | `s3190_f1green` | `S3-190` | 0 | `258E693DE17F2B575A71BBCF9DDF29B1` | 同上 | 311/4143/1618 | `3caa9f0d` |
| **f3red**（第55项反测） | `s3190_f3red` | `S3-190` | 0 | `258E693D…` | `CC8CFCD0BEC94AAD`（顺序回退版） | — | — |
| **f3green**（复原） | `s3190_f3green` | `S3-190` | 0 | `258E693D…` | `8167BED3DA849730` | 311/4143/1618 | `3caa9f0d` |

**判据逐条**：

| 派单判据 | 结果 | 证据 |
|:--|:--|:--|
| §三.1 24 条逐条列出（文件+行+原表名+应有表名） | ✅ | `outputs/list-unprefixed-post.txt`（`list-unprefixed.mjs`） |
| §三.1 机器证据：这 24 条确实没生效 | ✅ | `outputs/targets-pre2.txt`：**①按缺前缀表名查得 0 行**（24/24）；**②按应有表名查：12 条完全不存在**（6 列：`t_sale_bill_item.spec`、`t_sale_bill.store_name/store_address/store_contact`、`t_collection_link.display_config/document_title`；6 索引：`idx_sys_*_tenant`），另 12 条**存在但定义与语料不符** |
| §三.2 改动前后结构 diff + 明细；修复后 0 差异 | ✅ | `outputs/diff-base2-vs-pre2.txt` = **差异 18**（多列 6 / 多索引 6 / 列定义不一致 6，逐条点名）；`outputs/diff-base2-vs-post2.txt` = **差异 0**；`outputs/structure-digest.txt` 中 `base2 = post2 = f1green = 3caa9f0d…` |
| §三.3 第 55 项行数 + 两账号存在且能登录 | ✅ | `outputs/post2-row-counts.txt`（`t_store=1 / t_member=3 / t_sale_bill=5 / t_purchase_order=3 / t_sys_user=4`）；`outputs/post2-demo-login.txt`（`store_manager`、`store_operator` 均 `status=1` 且 `verifyPassword(DEMO_PASSWORD)=true`） |
| §三.4 第 56 项语句不再报错 + 唯一键 = `uk_config_key_tenant(config_key,tenant_id)` | ✅ | `outputs/post2-uk_config_key-lines.txt`（守卫生效、无 ERROR）；`outputs/post2-sys_config-indexes.txt`（`uk_config_key_tenant` `NON_UNIQUE=0`，`SEQ 1=config_key / 2=tenant_id`）；`outputs/post2-failure-lines.txt`（safeExec 失败行 **0**） |
| §三.5 门禁 | ✅（根 `npm run build` 见 §七 说明，属**基线就红**） | `outputs/gates-*.log` |

**第 53 项"24 条从未生效"的量化闭合**：按文件的 `ER_NO_SUCH_TABLE` 跳过数，`pre2 → post2` 为 `092:14→2`、`120a:8→0`、`137:2→0`、`138:2→0`，差值 `26−2 = 24`（正好那 24 条）。

---

## 六、反测（"故意制造失败证明它会红"，三条两侧齐）

| 反测 | 做法 | 红侧（实测） | 绿侧（实测） |
|:--|:--|:--|:--|
| **F1 · 第 53 项** | `fix-prefix.mjs --unprefix` 把 24 条改回缺前缀 ⇒ 跑空库 ⇒ 复原 | `f1red`：`diff base2-vs-f1red` = **18**（6 缺列 + 6 缺索引 + 6 列定义不一致，逐条点名那批目标）；结构哈希退回 `9b7e8aec…` | `f1green`：**0**（`3caa9f0d…`） |
| **F2 · 第 56 项** | ①产品路径：基线工作树的原语句在空库恒报错；②库级直证：删掉目标键后直发原语句 | ①`pre2-migration.log`：`失败: Can't DROP INDEX 'uk_config_key'`；②`f2-add-rolled-back.txt`：`ERROR 1091` 且语句后目标键计数 **0**（ADD 未执行） | `post2-migration.log`：`已存在，跳过 ADD（守卫生效）`、失败行 0；`post2-sys_config-indexes.txt` 键完整；另**删掉键后重跑**由守卫建回（本包早期 `f2green` 读数） |
| **F3 · 第 55 项** | 把种子块临时移回"第 6 步"（语料之前）⇒ 重建 dist ⇒ 跑空库 ⇒ 复原 | `f3red`（指纹：`migration.ts=CC8CFCD0BEC94AAD`）：`Unknown column 'mobile' in 'INSERT INTO'`；`t_store=1 / t_member=0 / t_sale_bill=0 / t_product_spu=0 / 账号=2`（只有 admin、tenant_admin） | `f3green`（指纹：`migration.ts=8167BED3DA849730`，与最终态逐字节同）：`t_member=3 / t_sale_bill=5 / 账号=4`，两演示账号 `verifyPassword=PASS` |

复原核对：F3 往返后 `migration.ts` 的 sha256 与冻结版**逐字节一致**（`8167BED3DA84…`）；F1 往返后语料 sha256 与 `post2` 一致（`258E693D…`）。

---

## 七、门禁（`D:\Users\ZXQL\wt-agents\S3-190`）

```
npx vitest run（backend，全量）              ⇒ 652 files / 7694 tests / 0 failed   EXIT=0   [gates-vitest.log]
npx tsc -p tsconfig.json --noEmit            ⇒ EXIT=0                              [gates-tsc-noemit.log]
node backend/scripts/guard-route-auth.mjs    ⇒ EXIT=0（189 个路由文件）             [gates-guard-route-auth.log]
node backend/scripts/guard-tenant-status.mjs ⇒ EXIT=0                              [gates-guard-tenant-status.log]
node backend/scripts/guard-route-prefix.mjs  ⇒ EXIT=0                              [gates-guard-route-prefix.log]
npm --workspace backend run build            ⇒ EXIT=0                              [gates-backend-build.log]
```

**根 `npm run build` = EXIT 1，但这是基线就红、与本单无关**：`npm --workspaces run build` 会跑到 `miniapp` / `platform-miniapp` 两个 workspace，而它们**没有 `build` 脚本**（`npm error Missing script: "build"`）。已在**未改动的基线工作树** `S3-190-base` 上复跑同一命令，同样 `Missing script` ⇒ 非本单引入；本单未触碰任何 `package.json`。请凌舟裁定是否改用"逐工作区构建"口径（本单未擅自改根脚本）。

---

## 八、同根因影响面全量扫描（技术债铁律："绕过 ≠ 修复"）

| 类别 | 条数 | 定性 |
|:--|--:|:--|
| **本次已修** | **24** | 第 53 项四文件（表名写在字符串字面量里，静态补前缀看不到） |
| **同根因仍受影响** | **3** | `093_库存增加租户ID.sql:8/9/10` 的 `CREATE INDEX idx_tenant_ib ON inventory_balance(...)`——表名**裸写**，而 `addTablePrefix()` **没有 `CREATE INDEX … ON` 模式** ⇒ 恒 `ER_NO_SUCH_TABLE`（`post2` 日志实测 093 跳过 3 条）。全语料仅此 3 条（已机器全文扫描）。它们建的索引与既有 `idx_*_tenant` 功能重复（不缺功能）。**属另一根因（缺模式，不是缺前缀），本单未改**（红线：只改有问题的地方；改 `addTablePrefix` 会改变全语料改写面） |
| **其它类别（非本单）** | 10 | `120c_performance_indexes.sql` 5 条：目标表 `t_inventory` **本产品从未建出**（历史遗留表名）；`169_tenant_admin_uuid.sql` 3 条 + `092_租户ID.sql` 2 条：**执行时点目标表尚未建出**（后续文件才建表） |

另有 21 条 Step 2 的 `ALTER TABLE <较晚才建的表>` 跳过（`t_brand`、`t_customer_type`、`t_approval_*` 等），**修复前后计数完全相同**（`pre2=58 / post2=34`，其中"按文件"类 37→13），属既有行为、无缺口。

**建议（不代写裁定，供凌舟决定）**：① 093 那 3 条登记技术债条目（"已修 24 处 / 仍受同类影响 3 处"）；② `docs/数据库变更清单.md` 里 120a 的"✅ 已执行"与 092 相关表述需按本单结论订正（该文件凌舟维护，本单红线禁止改）。

---

## 九、并行会话冲突（如实登记，务必处置）

**事实**：同一工作树 `D:\Users\ZXQL\wt-agents\S3-190` 在 2026-10-14 约 01:50–02:40 期间**有至少两个会话在跑同一张卡 S3-190**（本线程树内 `/root/s3190_ajian`、`/root/s3192_ajian` 与我在同一工作树/同一分支上作业；仓外另有对方写的 `_s3190-evidence\S3-190-独立复测与补充发现-20261014-0205.md`）。

**实测后果（已处置）**：

1. 双方都曾**临时回退语料文件/源码顺序**做反测 ⇒ 有一段窗口（01:55–02:01）里"dist 状态"与"语料状态"分属两个会话，**该窗口的读数不可信**。本包**已全部作废重跑**：所有结论只采用 §五/§六 中**带输入指纹**的用例（02:08 之后重跑，语料 sha + `migration.ts` sha 与结论一一对应）。
2. 双方曾**同库同名并发跑**（`s3190_f2b` 等）⇒ 出现过一次 `run-migrations` 挂住（连接/锁竞争）。已终止冲突进程链、改为**单实例串行 + 指纹自证**后复跑，未再复现。
3. 本包新增的装置在冲突期内被另一会话使用，故它们**自带"落盘回读核对"与"输入指纹"**：写盘后回读断言 24 条形态、运行前打印语料/源码哈希 —— 这类冲突一旦再发生会**在证据里直接暴露**，不会变成假绿。

**建议（供凌舟处置）**：一张卡只允许一个执行会话写一个工作树；确需并行时按"不同工作树 + 不同库名前缀"隔离，并把"运行时记录 src/dist 哈希"写进卡里。

---

## 十、环境与复跑指引

```powershell
# 0) 私有 MariaDB（未连生产）：端口 3406、datadir 在 %TEMP%
#    （本单复用的既有实例：datadir=C:\Users\XIONG\AppData\Local\Temp\s3186mdb，版本 11.4.5-MariaDB）
$mdb = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin"
& "$mdb\mariadb.exe" --host=127.0.0.1 --port=3406 --user=root --skip-ssl -e "SELECT VERSION();"

# 1) 两棵工作树都要先有产物（装置跑的是产品代码 backend/dist，不是复制品）
cd D:\Users\ZXQL\wt-agents\S3-190\backend;      npx tsc -p tsconfig.json; node ../scripts/fix-esm-extensions.js dist
cd D:\Users\ZXQL\wt-agents\S3-190-base\backend; npx tsc -p tsconfig.json; node ../scripts/fix-esm-extensions.js dist

# 2) 整套验收 + 反测（一条命令跑完 pre2/base2/post2/f1red/f1green + F2 直证 + 比对 + 摘要）
powershell -File D:\Users\ZXQL\wt-agents\S3-190\docs\evidence\S3-190\harness\run-acceptance.ps1 `
  -FixedRepo D:\Users\ZXQL\wt-agents\S3-190 -BaseRepo D:\Users\ZXQL\wt-agents\S3-190-base `
  -EvidenceDir D:\Users\ZXQL\wt-agents\_s3190-evidence\outputs

# 3) 单独复跑某个用例 / 判据工具
powershell -File docs\evidence\S3-190\harness\run-case-any.ps1 -RepoRoot <工作树> -DbName <库> -Tag <标签> [-NoReset] [-WriteGate allow]
node docs\evidence\S3-190\harness\list-unprefixed.mjs <仓库根>
node docs\evidence\S3-190\harness\check-targets.mjs <库名>
node docs\evidence\S3-190\harness\row-counts.mjs <库名>
node docs\evidence\S3-190\harness\verify-demo-login.mjs <库名> <工作树根>
node docs\evidence\S3-190\harness\diff.mjs <基线快照> <被测快照> [明细输出]
node docs\evidence\S3-190\harness\digest.mjs <快照...>
node docs\evidence\S3-190\harness\explain-remaining-skips.mjs <迁移日志> <库名> <仓库根>
node docs\evidence\S3-190\harness\fix-prefix.mjs --prefix|--unprefix|--list <仓库根>
```

**装置清单**（`docs/evidence/S3-190/harness/`）：`run-case-any.ps1`（建空库→跑产品迁移→落日志/快照/指纹）、`run-acceptance.ps1`（总驱动）、`fix-prefix.mjs`（24 条前缀开/关，带落盘回读）、`list-unprefixed.mjs`、`check-targets.mjs`、`row-counts.mjs`、`verify-demo-login.mjs`、`explain-remaining-skips.mjs`，外加沿用 S3-186 的 `snapshot.mjs` / `diff.mjs` / `digest.mjs` / `compare-deep.mjs` / `run-migrations.mjs` / `run-case.ps1` / `acceptance.ps1` / `collect-calls.mjs` / `replay-calls.mjs` / `replay-baseline.ps1` / `rewrite-calls.mjs` / `verify-rewrite.mjs` / `analyze-gap.mjs`。

**产物落位**：仓库内 `docs/evidence/S3-190/outputs/` 只放**小体积产物**（`*-counts.txt`、`diff-*.txt`、`structure-digest.txt`、判据抽取、门禁日志）；**大体积**（`*-snapshot.json` ~1.3MB、`*-migration.log` ~100KB）留在工作区外 `D:\Users\ZXQL\wt-agents\_s3190-evidence\outputs\`。

---

## 十一、局限与诚实缺口

1. **基线是"语料意图（就地执行版）"，不是生产实测**（红线：本单只在空库副本验证，不读生产）。因此"生产是否也缺这批列/索引"本单**无法证明**；仍有一条反向线索：`docs/数据库变更清单.md` 把 120a 记为"✅ 已执行"，而它的 8 条语句传的是无前缀表名（恒失效）。建议随部署窗口做一次**只读**核对：
   ```sql
   SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND ((TABLE_NAME='t_sale_bill_item' AND COLUMN_NAME IN ('spec','unit','barcode'))
        OR (TABLE_NAME='t_sale_bill'    AND COLUMN_NAME IN ('store_name','store_address','store_contact'))
        OR (TABLE_NAME='t_collection_link' AND COLUMN_NAME IN ('display_config','document_title')))
    ORDER BY TABLE_NAME, COLUMN_NAME;   -- 缺行即证实生产同源缺失
   SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 't\_sys\_%' AND INDEX_NAME LIKE 'idx\_sys%';  -- 空集即证实 6 个索引同源缺失
   ```
2. **第 53 项修复带来 6 个"按语料命名"的新索引**（`idx_sys_config_tenant` 等）：它们与 `migration.ts` 第2步建的 `idx_t_sys_config_tenant` 等**同表同列、仅命名不同**（功能重复，非缺口）。卡面要求"只改表名、不改语义"，故按语料原样落地；是否接受这份冗余索引请凌舟裁定（本单不擅自删语句）。
3. `t_sys_config` / `t_sys_permission` / `t_sys_role_permission.tenant_id` 在空库上**无 `DEFAULT 'default'`**（由其它迁移建出、与 092 语料要求不一致）：卡面限定"只改表名"，**未改**，如实报备。
4. **093 的 3 条同根因残留 + 120c/169/092 等 10 条其它类别**：见 §八，均**未改**（超出卡内允许改动面）。
5. **`npm run build`（根）在基线即红**：见 §七，需凌舟裁定口径。
6. **记忆文件未改**：`docs/memories/阿坚-记忆.md` 与并行会话同署名，并发写会互相覆盖；建议凌舟统一落一笔。
7. 快照文件（1.3MB×7）**不入仓**，仅在仓内留结构摘要（`structure-digest.txt`）与差异明细；生成命令见 §十。
