# ACTIVE 回执 · S3-190（空库迁移/种子族根治：seed 顺序中断 · DROP INDEX 无守卫 · 24 条缺前缀）

【汇报 R101-S3-190】三项全部修复并交付：空库结构差异 18 → **0**，演示账号与种子数据从"从未创建" → **可用**，`DROP INDEX` 恒红日志 → **守卫生效**
**汇报对象**：凌舟（总负责人）
**汇报人**：阿坚（后端 / 迁移）｜2026-10-14
**交付物**：工作树 `D:\Users\ZXQL\wt-agents\S3-190`｜分支 `fix/s3-190-empty-db-seed-and-prefix`｜基线 `origin/main` = `d0732249`（`d07322498a5d689a4f043f48de5a7702c8bb369b`）

- 代码：`backend/src/shared/migration.ts`（`8167BED3DA84…`，+53/−15：第2.5步 DROP INDEX 加守卫 + 种子块由"第6步"移到"第8.5步"）
- 语料：`092_租户ID.sql`（`ECA62DBE1887…`，+31/−25）、`120a_合规凭证字段.sql`（`E37659ACA7EC…`，+22/−17）、`137_sys_user_dept_position.sql`（`4C183E1C7026…`，+7/−4）、`138_approval_business_link.sql`（`26FE4BC7F4C4…`，+7/−4）
- 合计 **5 文件 / +120 −65**；业务路由·控制器·服务 **0 处**；`.github/**`、`deploy/**`、其它迁移、收口总清单 **未动**
- 证据包：`docs/evidence/S3-190/`（`README.md` + `harness/` + `outputs/`）｜回执即本文件｜卡：`docs/tasks/inbox/archive/ACTIVE-S3-190-20261014.md`
- **状态：未 commit / 未 push / 未开 PR**（红线遵守；由凌舟本机提交）

## 一、第 53 项 · 24 条缺前缀语句逐条台账（机器扫描）

装置：`node docs/evidence/S3-190/harness/list-unprefixed.mjs <仓库根>`（修复前 `outputs/list-unprefixed-pre.txt`=**24 条**；修复后 `outputs/list-unprefixed-post.txt`=**0 条**）

| 文件 | 行号 | 原表名 | 应有表名 | 列/索引名 |
|:--|--:|:--|:--|:--|
| 092_租户ID.sql | 88 | sys_config | t_sys_config | tenant_id |
| 092_租户ID.sql | 92 | sys_user | t_sys_user | tenant_id |
| 092_租户ID.sql | 96 | sys_role | t_sys_role | tenant_id |
| 092_租户ID.sql | 100 | sys_permission | t_sys_permission | tenant_id |
| 092_租户ID.sql | 104 | sys_user_role | t_sys_user_role | tenant_id |
| 092_租户ID.sql | 108 | sys_role_permission | t_sys_role_permission | tenant_id |
| 092_租户ID.sql | 409 | sys_config | t_sys_config | idx_sys_config_tenant |
| 092_租户ID.sql | 413 | sys_user | t_sys_user | idx_sys_user_tenant |
| 092_租户ID.sql | 417 | sys_role | t_sys_role | idx_sys_role_tenant |
| 092_租户ID.sql | 421 | sys_permission | t_sys_permission | idx_sys_permission_tenant |
| 092_租户ID.sql | 425 | sys_user_role | t_sys_user_role | idx_sys_user_role_tenant |
| 092_租户ID.sql | 429 | sys_role_permission | t_sys_role_permission | idx_sys_role_permission_tenant |
| 120a_合规凭证字段.sql | 14 | sale_bill_item | t_sale_bill_item | unit |
| 120a_合规凭证字段.sql | 18 | sale_bill_item | t_sale_bill_item | barcode |
| 120a_合规凭证字段.sql | 22 | sale_bill_item | t_sale_bill_item | spec |
| 120a_合规凭证字段.sql | 27 | sale_bill | t_sale_bill | store_name |
| 120a_合规凭证字段.sql | 31 | sale_bill | t_sale_bill | store_address |
| 120a_合规凭证字段.sql | 35 | sale_bill | t_sale_bill | store_contact |
| 120a_合规凭证字段.sql | 40 | collection_link | t_collection_link | display_config |
| 120a_合规凭证字段.sql | 44 | collection_link | t_collection_link | document_title |
| 137_sys_user_dept_position.sql | 3 | sys_user | t_sys_user | department_id |
| 137_sys_user_dept_position.sql | 7 | sys_user | t_sys_user | position_id |
| 138_approval_business_link.sql | 3 | purchase_order | t_purchase_order | approval_instance_no |
| 138_approval_business_link.sql | 7 | sale_return | t_sale_return | approval_instance_no |

**根因**：表名写在**字符串字面量**里（`SET @s3186_tbl='sys_config'` ⇒ 动态 SQL），而 `addTablePrefix()` 只认裸写/反引号写的表名 ⇒ 静态补前缀看不到它；092 原文的辅助过程把 `tbl_name` **原样**拼进 `ALTER TABLE`（`git show 9225fd17^:docs/migrations/092_租户ID.sql`）⇒ 恒 `ER_NO_SUCH_TABLE`。

## 二、证据（可复跑，原始输出，含输入指纹）

1. **第 53 项定性**：`outputs/targets-pre2.txt` ⇒ 24 条目标里 ①按缺前缀表名查得 **0 行**（24/24，证明从未生效）；②按应有表名查 **12 条完全不存在** + 12 条定义与语料不符。修复后 `outputs/targets-post2.txt` ⇒ **24 条全部存在，0 缺**。
   量化闭合：按文件 `ER_NO_SUCH_TABLE` 跳过数 `092:14→2 / 120a:8→0 / 137:2→0 / 138:2→0`，差值 **24**。
2. **空库结构（新增/调整装置，带输入指纹）**：
   - `pre2`（`S3-190-base`，缺前缀 24，语料 sha `B141E929…`，`migration.ts` 原样） 311/4137/1612，结构 sha `9b7e8aec…`
   - `base2`（= **基线 B**：只把 24 条表名纠正、`migration.ts` 保持原样）311/4143/1618，`3caa9f0d…`
   - `post2`（三项全修）311/4143/1618，`3caa9f0d…`
   - `outputs/diff-base2-vs-pre2.txt` = **差异 18**（多列 6 / 多索引 6 / 列定义不一致 6，逐条点名）；`outputs/diff-base2-vs-post2.txt` = **0**；`outputs/structure-digest.txt`
   - 交叉核对：`pre2` 的结构 sha `9b7e8aec…` 与 **S3-186 证据包 `runC/runE` 的结构 sha 逐字节相同** ⇒ 同一"修复前结构"口径。
3. **第 55 项**：`outputs/post2-row-counts.txt`（`t_store=1 / t_member=3 / t_sale_bill=5 / t_purchase_order=3 / t_sys_user=4`）+ `outputs/post2-demo-login.txt`（`store_manager`、`store_operator`：`rows=1 / status=1 / verifyPassword(DEMO_PASSWORD)=true`，`DEMO_LOGIN_CHECK=PASS`）。
4. **第 56 项**：`outputs/pre2-uk_config_key-lines.txt` = `失败: Can't DROP INDEX 'uk_config_key'`；`outputs/post2-uk_config_key-lines.txt` = `已存在，跳过 ADD（守卫生效）`；`outputs/post2-sys_config-indexes.txt`（`uk_config_key_tenant` `NON_UNIQUE=0`、`SEQ1=config_key / SEQ2=tenant_id`）；`outputs/post2-failure-lines.txt` 为空（safeExec 失败行 0）；`outputs/f2-add-rolled-back.txt` = 删键后直发原语句 `ERROR 1091` 且目标键计数仍为 **0**（ADD 一并未执行）。
5. **门禁**：`outputs/gates-vitest.log` = 652 files / **7694 tests / 0 failed**；`gates-tsc-noemit.log` EXIT=0；`gates-guard-route-auth.log` / `gates-guard-tenant-status.log` / `gates-guard-route-prefix.log` 均 EXIT=0；`gates-backend-build.log`（`npm --workspace backend run build`）EXIT=0。（根 `npm run build` 见 §四.2）
6. **反测（三条两侧齐）**：
   - F1（53）：`f1red`（`fix-prefix --unprefix`，语料 sha `ACF24E8E…`，缺前缀 24）⇒ `diff base2-vs-f1red` = **18** 并点名那批目标，结构退回 `9b7e8aec…`；`f1green`（复原，语料 sha 与 post2 一致 `258E693D…`）⇒ **0**。
   - F2（56）：红=产品路径恒报错 + 库级直证（删键后 ADD 未执行，键计数 0）；绿=守卫生效、键完整、失败行 0，且"删键后重跑由守卫建回"。
   - F3（55）：`f3red`（把种子块移回第 6 步，指纹 `migration.ts=CC8CFCD0BEC94AAD`）⇒ `Unknown column 'mobile' in 'INSERT INTO'`、`t_member=0 / t_sale_bill=0 / t_product_spu=0 / 账号=2`；`f3green`（复原，指纹 `migration.ts=8167BED3DA849730`，与最终态逐字节同）⇒ `t_member=3 / t_sale_bill=5 / 账号=4` + 两账号 `verifyPassword=PASS`。

## 三、验收自评（逐条对照派单判据）

| 派单判据 | 自评 | 依据 |
|:--|:--|:--|
| §三.1 24 条逐条列出 + 机器证据证明"当前确实没生效" | **通过** | 本回执 §一 台账 + `targets-pre2.txt`（24/24 查得 0 行；12 条不存在）+ 差值 24 条 |
| §三.2 改动前后空库快照 diff + 修复后 0 差异 | **通过** | `diff-base2-vs-pre2.txt`（18，逐条明细）/ `diff-base2-vs-post2.txt`（0）/ `structure-digest.txt` |
| §三.3 第 55 项行数 + 两账号存在且能登录 | **通过** | `post2-row-counts.txt` / `post2-demo-login.txt`（走产品 `verifyPassword` 路径） |
| §三.4 第 56 项不再报错 + 唯一键实测 | **通过** | `post2-uk_config_key-lines.txt` / `post2-sys_config-indexes.txt` / `post2-failure-lines.txt` |
| §三.5 门禁 `vitest run` / `tsc --noEmit` / 三条 guard / `npm run build` | **部分通过（1 条口径存疑）** | 前五项 EXIT=0（7694 用例全绿）；**根 `npm run build` 在基线即红**（miniapp / platform-miniapp 无 `build` 脚本），本单未触碰任何 `package.json`，见 §四.2 |
| §四 反测三条（每条两侧） | **通过** | F1/F2/F3 见 §二.6，红绿两侧均有原始输出与输入指纹 |

## 四、未完成与阻塞

1. **生产实测未做**（红线：本单只允许空库副本，且不得碰生产库）：本包证明的是"语料意图 vs 空库结构"，**不能证明生产同源缺这批列/索引**。只读核对 SQL 已写在 `docs/evidence/S3-190/README.md` §十一.1，建议随部署窗口执行。
2. **根 `npm run build` = EXIT 1（基线就红，需你裁定口径）**：`npm --workspaces run build` 跑到 `miniapp` / `platform-miniapp` 时 `Missing script: "build"`；我在**未改动的基线工作树**上复跑同一命令，同样报错 ⇒ 非本单引入。请裁定是否改成"逐工作区构建"（本单未擅自改根脚本）。
3. **卡与路由表**：本卡已归档为 `docs/tasks/inbox/archive/ACTIVE-S3-190-20261014.md`；`docs/tasks/inbox/ACTIVE.md` 的路由表仍指向 `ACTIVE-S3-190.md`（我不敢改路由表——同期还有 S3-188/S3-191 卡并行，删/改路由会让指针对空）。**请凌舟更新路由表与 `current-tasks.md`**。
4. **`docs/数据库变更清单.md` 需订正**（红线禁止我改）：120a 记为"✅ 已执行"与其 8 条恒失效语句矛盾；092 相关表述亦需按本单结论更新。
5. **`docs/memories/阿坚-记忆.md` 未改**：与并行会话同署名，并发写会互相覆盖，建议由你统一落一笔。

## 五、风险与自我报备

1. **同一工作树曾有并行会话跑同一张卡（严重，已如实登记）**：2026-10-14 约 01:50–02:40，`/root/s3190_ajian`、`/root/s3192_ajian` 与我在**同一工作树、同一分支**上作业（`list_agents` 可查；对方另在仓外写了 `_s3190-evidence\S3-190-独立复测与补充发现-20261014-0205.md`）。后果：① 双方都临时回退过语料文件/源码顺序做反测，01:55–02:01 窗口的读数**不可信**；② 曾同库同名并发跑，出现过一次 `run-migrations` 挂住。**处置**：该窗口读数全部作废，本包结论只采用**带输入指纹**的重跑用例（02:08 之后），并给装置加了"运行前打印语料/源码哈希 + 写盘后回读断言"，再发生此类冲突会直接在证据里暴露。**请按纪律处置编排问题**（建议一卡一会话）。
2. **我自己的装置曾有 2 个缺陷，已修并留痕**：① `fix-prefix.mjs` 初版把仓库根取成 `argv[2]`（实为开关），导致"改错工作树"——现改为 `argv[3] > env > cwd` 并**写盘后回读断言**；② `run-acceptance.ps1` 初版在 PowerShell 5.1 下把原生命令的 stderr 当终止性错误，F2 段半路中断——现改用 `cmd /c` 重定向。两者都在 `harness/` 里可复跑核对。
3. **第 53 项修复会新增 6 个"按语料命名"的冗余索引**（`idx_sys_config_tenant` 等，与第2步 `idx_t_sys_config_tenant` 同表同列仅命名不同）：卡面要求"只改表名、不改语义"，我按语料原样落地；**是否接受这份冗余请你裁定**（我没有擅自删语句）。
4. **同根因仍有 3 条残留（已扫描全部语料，未改）**：`093_库存增加租户ID.sql:8/9/10` 的 `CREATE INDEX … ON inventory_balance/batch/ledger` 表名裸写，而 `addTablePrefix()` **没有 `CREATE INDEX … ON` 模式** ⇒ 恒失效，属"缺模式"这一同根因的**未修残留**（`已修 24 处 / 仍受同类影响 3 处`）。按技术债铁律建议登记技术债条目，并连同 `120c`（5 条，目标表 `t_inventory` 从未建）、`169`（3 条）、`092`（2 条，均为执行时点问题，共 13 条 `ER_NO_SUCH_TABLE`）一并留档。**我没有动手**（超出卡内允许改动面）。
5. `t_sys_config` / `t_sys_permission` / `t_sys_role_permission.tenant_id` 在空库上无 `DEFAULT 'default'`（与 092 语料要求不一致）：卡面限定"只改表名"，**未改**，如实报备。
6. **基线口径是我定义的、需要你认可**：本单把"语料意图"定义为"全部语句在**其文件位置就地执行** + 表名按语料自身命名（`t_` 前缀）"，并用**另起的干净工作树**（`S3-190-base`）构造基线，以避免"用改后的代码给自己定标杆"。若你要求改用 S3-186 的 runB 快照口径（该快照是"事后重放"版，`t_delivery_record.rider_id` 列序与就地执行不同、且不含第 53 项目标），需重算——请明示。
7. 我**没有**新建/修改任何裁定类文件，也没有动 `ACTIVE.md`、`current-tasks.md`、`docs/数据库变更清单.md`、记忆文件。

## 六、回传要求 / 关联

- 本汇报已落卡：`docs/tasks/inbox/ACTIVE-回执-S3-190.md`（本文件；按派单规范 §三 十项组织）
- 关联派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-190-20261014.md`（原 `inbox/ACTIVE-S3-190.md`）
- 证据包：`docs/evidence/S3-190/README.md`
## 七、补记（2026-10-14，回执落盘后追加）

**凌舟在本次执行期间更新了 `inbox/ACTIVE.md` 路由表**（新增 S3-192/S3-193 卡并加"按 agent 名认领"表），其中:

- 指定 **S3-190 的执行方 = `/root/s3190_ajian`**，工作树 **`wt-agents/S3-190`**；
- 并写明"`s3192` 误做 S3-190、并与 S3-190 的执行方抢同一工作树 = 事故"；
- 我把本文件写到 `inbox/` 时，该路由表已生效，因此**本回执与"s3190_ajian 的产出"是同一工作树、同一 5 文件哈希上的两份交付**（`migration.ts 8167BED3DA84`、`092 ECA62DBE1887`、`120a E37659ACA7EC`、`137 4C183E1C7026`、`138 26FE4BC7F4C4`），不是两份互相矛盾的结论。

**请凌舟裁定收口口径**（二选一或都收）：

1. 以 `/root/s3190_ajian`（路由表指定执行方）的回执为正式回执 ⇒ 本文件请改名留档，我的证据包（`docs/evidence/S3-190/**`）可直接被其沿用，无需返工；
2. 以本文件为正式回执 ⇒ 请让 `s3190_ajian` 停止对同一工作树的写入，并在合并前**复核 5 文件哈希**（上面 5 个值即冻结值；任何一项漂移即说明状态被改动，需重新跑 §二/§六 用例）。

无论哪种口径：**合并前请复跑一次带输入指纹的 `run-acceptance.ps1`**（它会自行打印语料与源码哈希），确认 `diff base2-vs-post2 = 0`；这也是豁免"并行窗口读数不可信"的唯一稳妥办法。
