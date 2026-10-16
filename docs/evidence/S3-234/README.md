# S3-234 证据目录 · 迁移流水线收口（收口总清单第 73 + 74 项；**含 R1 返工**）

> 归属单：**S3-234** —— 初版（`s3239` 起草 → `s3241` 复核交付）→ **R1 返工：`/root/s3243_ajian`（2026-10-16）**
> 夹具：本机 **MySQL 8.0.28**（`127.0.0.1:3409`，datadir `%TEMP%\mysql80\data-s3234`，**生产零写**）
> 口径：本目录每条结论都对应**一条可复跑命令** + 一份 `raw/` 原始输出；`raw/` 里 `70~8x` 是 R1 返工这一轮的，
> `10~62` 是初版那一轮的（**保留不改**，便于对照"改前/改后"）。

---

## 〇、R1 返工一页结论（本次交付读数）

| # | 判据（R1 卡面） | 装置 | 读数 | 证据 |
|:--|:--|:--|:--|:--|
| R1-1 | **三分类守恒**（A+B+C = `docs/migrations/*.sql` 总数） | `gen-migrations-manifest.mjs` + `guard-migration-manifest.mjs` | **A 184 / B 12 / C 8 = 204**；门禁 **EXIT=0**；`--json` 三计数同 | `raw/80-guard-green.txt`、`80-guard-green.json` |
| R1-2 | **两侧反测 ①**：不在登记册的失败 ⇒ 必红、点名、**退出码非 0** | `run-deploy-section-blocking-redtest.sh` 用例 A | 逐条点名 `❌ [迁移] 008_phase6_schema.sql 执行失败`；段小结「新失败 1」；汇总段判红；**组合退出码 = 1** | `raw/70-blocking-redtest.txt` |
| R1-3 | **两侧反测 ②**：登记在案的失败 ⇒ **不判红**、仍打印 | 同上 用例 B | 打印 `⏭️ 已知非幂等（登记在案）：008_phase6_schema.sql`；段小结「新失败 0 / 已知 1」；汇总段**未**判红；**组合退出码 = 0** | `raw/70-blocking-redtest.txt` |
| R1-4 | **fail-closed**：清单缺失 / 登记册缺失 | 同上 用例 C / D | 两种缺失**都判红**（组合退出码 1）；登记册缺失时明说"无法区分已知/新失败 ⇒ 按新失败判红" | `raw/70-blocking-redtest.txt` |
| R1-5 | **真清单全量两遍**（A 类 184 条，部署通道真源码） | `run-deploy-migration-section.sh` | 两遍均 **成功 184 / 新失败 0 / 已知 0**，**组合退出码 0 / 0** | `raw/71-deploy-full-pass1.txt`、`73-deploy-full-pass2-restored.txt` |
| R1-6 | **真清单注入 ⇒ 红 ⇒ 逐字节复原 ⇒ 绿**（两侧反测③） | 同上（在真清单末尾注入 `999_反测_新失败文件不存在.sql`） | 注入后 **组合退出码 1** 且点名该文件；复原后清单 SHA256 回到 `F4B3DFBD…4CA3`（与注入前一致）；复跑 **退出码 0** | `raw/72-deploy-injected-new-failure.txt`、`74-artifacts-sha256.txt` |
| R1-7 | **门禁红绿两侧**（三通道判据 + 登记册反测） | `run-guard-redtest.ps1 -Prefix 80` | 绿侧 **EXIT=0**；**7 例反测**（未登记新迁移 / 清单指向不存在文件 / 活动段少登记 / 登记册少登记 / 登记册行格式非法 / 跨通道重复 / 登记册指向不存在文件）**全部 EXIT=1 并点名**；复原后 EXIT=0 且真件 SHA256 未被污染 | `raw/80*-*.txt`、`80-guard-redtest-run.txt` |
| R1-8 | 回归 | `npm --workspace backend test`、`npx tsc -p backend/tsconfig.json --noEmit` | **680 文件 / 9558 用例 / 0 failed**（EXIT=0）；tsc **EXIT=0** | `raw/78-vitest-backend-full.txt`、`79-tsc.txt` |

**R1 一句话**：部署通道从"197 个文件每次全跑、11 条天天刷 ❌"改成**三通道**（184 实测幂等跑 / 12 条已知非幂等登记在案不跑 / 8 条只初始化不跑），
并把**不在登记册的失败**升级为**阻断部署**（进末尾 `FAILURES` ⇒ 自动化调用退出码 1）；两侧反测（该红的红、该绿的不红）与真件 SHA256 复原都留有原始输出。

> ⚠️ **R1-2/R1-3 的失败态是"逐个真跑"出来的**：用例 A/B 让 `008_phase6_schema.sql` 在夹具库上**真的失败**
> （`Table 'liquor_inventory.sys_role' doesn't exist`），不是模拟字符串；R1-6 注入的是"清单指向不存在的文件"
> （真库上造 SQL 级失败需要改迁移文件，属红线，故用这一形态 —— 两者合起来覆盖两条失败分支）。

---

## 一、三通道口径（R1 之后的唯一真相源）

| 通道 | 落盘位置 | 数量 | 判据 | 谁跑它 |
|:--|:--|--:|:--|:--|
| **A 实测幂等** | `deploy/migrations-manifest.txt` **活动段** | **184** | 真库连跑两遍 `EXIT=0` 且第二遍无数据变更（结构面增量 0 + `changedRows=0`） | **部署通道**（`deploy/auto-deploy.sh` 迁移段，行序即跑序） |
| **B 已知非幂等** | `deploy/migrations-nonidempotent-registry.txt`（新建） | **12** | 实测"第二遍必红"（11 条）或"重复跑仍真实写行"（`201`） | **不跑**；部署段用它给失败定性（在册 = 已知，不在册 = 新失败） |
| **C 只初始化** | `deploy/migrations-manifest.txt` **豁免段** | **8** | 含行首无守卫破坏性语句（7 条）或口令类种子（`075`） | **不跑**；语义 = 仅"新库初始化"通道（启动期迁移通道）执行 |

三者相加 **184 + 12 + 8 = 204 = `docs/migrations/*.sql` 总数**（`raw/80-guard-green.txt` 由门禁断言）。
B 类登记册同时是**技术债台账**：每行 `文件 | 失败形态 | 理由 | owner 单号`，当前 12 条 owner 均为**待派**
（`201` 标"需改幂等"）——**登记 ≠ 已修**，改幂等后由生成器把它移出登记册。

生成器：`harness/gen-migrations-manifest.mjs`（v2 三分类，**禁止手抄**；`--check` 只比对不写）；
门禁：`backend/scripts/guard-migration-manifest.mjs`（v2 五条判据 = 正向覆盖 / 反向存在 / 登记合规与唯一归属 / 行序一致 / 登记册指向存在）。

---

## 二、R1 卡面四条裁定 → 落地情况

| 卡面 | 要求 | 落地 |
|:--|:--|:--|
| §二.1 | 豁免 7 条认可，**豁免段注释写清语义**：仅"新库初始化"通道执行、部署通道不执行；并**只读复核** `docs/migrations/README.md` 的建库/灾备流程是否包含这 7 个文件 | ✅ 豁免段注释已按语义改写（`deploy/migrations-manifest.txt` 豁免段头 + 每条 EXEMPT 行）；⚠️ **复核结果 = 真缺口**：`docs/migrations/README.md` **在本仓与 `origin/main` 都不存在**（`git cat-file -e origin/main:docs/migrations/README.md` → 不存在），仓库根 `README.md` 写的建库导入文件 `docs/phase1_schema.sql` **也不存在**（实际存在的是 `docs/init_database.sql`）⇒ 已登记进回传卡「待核对」，**本单未改任何 README**（红线：只改有问题的地方、且卡面禁止顺手改） |
| §二.2 | 11 条恒红 ⇒ 进 registry、不塞进 manifest；部署段：manifest 逐条跑 / 在册失败打印不判红 / 不在册失败计新失败并判红 | ✅ registry 12 条；`deploy/auto-deploy.sh` 迁移段改为查表定性；`raw/70` 用例 A/B 两侧反测 |
| §二.3 | `075` 不进部署通道（进豁免段 + 注明口令类）；`201` 进 registry 标"需改幂等（待派）"；两者在回传卡写清**生产已跑过**的事实 | ✅ `075` 在豁免段并注明"口令类种子：bcrypt 随机盐 ⇒ 每遍重写口令哈希"；`201` 在 registry 且 owner 列标"需改幂等"；生产已跑过的事实与依据见回传卡（`075` = `docs/数据库变更清单.md:52`（2026-07-29 ✅ admin 可登录）；`201` = `docs/踩坑日志.md` 记的处置命令 + 4 账号只读复验） |
| §二.4 | 新失败阻断、登记在案放行但打印；把口径与**代价**写进脚本注释与回传卡 | ✅ `deploy/auto-deploy.sh`：迁移段注释写明口径与代价；末尾"失败汇总段"把 `MIGRATION_FAILURES` 并入 `FAILURES`（与 AI 底座/冒烟同机制 ⇒ 非交互或 `DEPLOY_STRICT=1` 时退出码 1）；`raw/70` 用例 A（新失败 ⇒ 1）与 B（已知 ⇒ 0）两测 |

---

## 三、R1-a｜069 幂等（第 73 项）—— 初版结论（本轮未改，证据保留）

### 病灶（两条）
1. **非空库重跑必红**：原文件 3 条 DDL 全是无守卫写法 ⇒ 第 3 条必报 `Duplicate foreign key constraint name 'fk_product_spu_brand'`（errno 1826，**不在** `run-migration.mjs` 的宽容集合里）。
2. **第 2 句回填句同样会中止整文件**（`Unknown column 'p.tenant_id'`）⇒ 第 3/4 句的外键与索引守卫根本跑不到。

### 修法（只加守卫，不改结果态与数据语义）
列 / 外键 / 索引用 `information_schema` 判定（不在则建、在则整句跳过并回显"已存在，跳过（幂等）"）；
回填句**两表 `tenant_id` 都在**才按租户内同名回填，否则整句跳过（**不做**去掉租户条件的降级 JOIN —— 那会把别的租户的同名品牌串到本租户商品上）。

### 读数（初版留存）
| 判据 | 装置 | 读数 | 证据 |
|:--|:--|:--|:--|
| 069 真库连跑两遍 ⇒ 零错误码（部署通道真命令） | `run-069-deploy-channel.ps1` | pass1/pass2 均 **EXIT=0**，`col/fk/idx = 1/1/1` 不变 | `raw/41-deploy-069-pass1.txt`、`-pass2.txt`、`41-deploy-069-two-pass.txt` |
| 069 两分支（租户列在 ⇒ 租户内回填；不在 ⇒ 跳过） | `run-069-two-pass.mjs` | 用例 A 回填 2 行、**跨租户同名行仍为 NULL**；用例 B 走跳过分支、两遍 `ok` | `raw/31-069-two-pass-branches.txt` |

---

## 四、R2｜清单驱动（第 74 项）—— R1 之后的口径与反测

### 装置为什么"抽真源码"而不是"重写一份等价脚本"
`run-deploy-migration-section.sh` 用 `sed -n '/S3-234 迁移段开始/,/S3-234 迁移段结束/p'` 与
`sed -n '/S3-234 失败汇总段开始/,/S3-234 失败汇总段结束/p'` 从**仓库里的 `deploy/auto-deploy.sh` 原文**抽出两段
（会打印行数、`bash -n` 过语法），串成**一个 shell 进程**执行 —— 证明的是**线上那个件**，不是复刻件。

**为什么两段必须同进程**：`MIGRATION_FAILURES` 是 bash 数组，**不能跨进程传递**；判红发生在汇总段，
所以"只跑迁移段"看不到部署是否判红。本装置的**退出码 = 组合退出码 = 部署判红结论**。

**保真改进**：本版把 `set -euo pipefail`（`auto-deploy.sh` 第 2 行的选项）补在段前 ⇒ **消除初版 README §三 记录的保真缺口①**
（初版的全量两遍是在未置严格选项的抽取段下跑的）。

### 三条读数（真件、可复跑）
| 场景 | 命令 | 读数 | 证据 |
|:--|:--|:--|:--|
| 全量第一遍（真清单 184 条） | `bash docs/evidence/S3-234/harness/run-deploy-migration-section.sh "$PWD" pass1` | 成功 **184** / 新失败 **0** / 已知 **0**；**组合退出码 0** | `raw/71-deploy-full-pass1.txt` |
| 注入新失败（真清单末尾加一行不存在的文件） | 同上（标签 `injected`） | 点名 `❌ [迁移] 999_反测_新失败文件不存在.sql`；**组合退出码 1** | `raw/72-deploy-injected-new-failure.txt` |
| 复原后第二遍（真清单） | 同上（标签 `pass2`） | 成功 **184** / 新失败 **0**；**组合退出码 0**；清单 SHA256 与注入前一致 | `raw/73-deploy-full-pass2-restored.txt`、`74-artifacts-sha256.txt` |

### 初版留存：197 全量两遍 + 失败处理反测（当时口径：不阻断）
`raw/33/34-deploy-section-full-postfix*.txt`（**186 成功 / 11 失败**、两遍失败清单一致、段退出码 0）、
`raw/35-deploy-section-redtest.txt`（三用例不 abort、逐条点名）、
`raw/50/51-sideeffects-pass*.{txt,json}`（197 文件两遍：结构面五读数增量全 0；数据面真实变更 2 个文件 = `075`/`201`）。
—— 这三组是 **B 类 12 条的实测来源**，不是"猜"出来的。

---

## 五、R3｜门禁（`guard-migration-manifest.mjs`，v2 五条判据）

① 正向覆盖（每个 `.sql` 必须在 A/B/C 之一）② 反向存在（活动段列出的文件必须真实存在）
③ 登记合规与唯一归属（豁免具名 + 非空理由；登记册 4 列非空；任何文件不得重复出现，含**跨通道**重复）
④ 顺序一致（活动段行序 == 运行时跑序 `migration.ts` 第 8 步 `readdirSync().filter().sort()`，扣掉 B/C）
⑤ 登记册指向的文件必须真实存在（否则部署段会把新失败当"已知"放行）。

反测（`raw/80-guard-redtest-run.txt`，全 7 例，均"先注违规 → 验红并点名 → 复原 → 验绿"）：

| 用例 | 制造什么 | 实测 |
|:--|:--|:--|
| ① | 往 `docs/migrations/` 放一个新迁移，三条通道都没登记 | EXIT=1，点名 `999_反测临时迁移_未登记.sql`；删掉后 EXIT=0 |
| ② | 清单活动段加一行不存在的文件（scratch 根） | EXIT=1，点名 `999_不存在的迁移.sql` |
| ③ | 清单活动段删掉一行**真实**迁移（`204_系统设置域权限点立码.sql`） | EXIT=1，点名该文件（报"未登记"） |
| ④ | 登记册删掉一行**真实**登记（`002_phase1_seed.sql`） | EXIT=1，点名该文件（报"未登记"） |
| ⑤ | 登记册某行改成两列（缺 owner） | EXIT=1，报"登记册行格式不合法"并点名 |
| ⑥ | 把已在登记册的 `008_phase6_schema.sql` 再写进活动段 | EXIT=1，报"重复登记"并点名（跨通道自相矛盾） |
| ⑦ | 登记册加一行指向不存在的文件 | EXIT=1，点名 `999_不存在的登记项.sql` |
| 复原 | scratch 恢复真件副本 | EXIT=0，且 scratch 清单/登记册 SHA256 == 工作树真件 SHA256 |

`.github/**` 未改（红线），**CI 接线仍由凌舟做**（本门禁未接 CI）。

---

## 六、存量信号（本轮"新冒出来"的，按门禁真跑口径登记）

### 6.1 B 类 12 条（登记册全文见 `deploy/migrations-nonidempotent-registry.txt`）

| 文件 | 失败形态 | 归类 |
|:--|:--|:--|
| `002_phase1_seed.sql` | `ERR_NO_DEFAULT_FOR_FIELD`（`tenant_id` 无默认值） | 老 seed 依赖列默认值 |
| `008_phase6_schema.sql`、`099_seed_data.sql` | `ER_NO_SUCH_TABLE`（`sys_role`/`sys_user`） | 引用**无前缀表名**（部署通道没有 `addTablePrefix`） |
| `016_phase9_tenant_subscription.sql`、`020_migrate_v3_payment_miniapp.sql`、`105_product_marketing_tag.sql`、`106_data_permission.sql` | `ER_DUP_ENTRY` | 非幂等 INSERT（无 `ON DUPLICATE KEY`/无守卫） |
| `078_性能索引.sql`、`120c_performance_indexes.sql` | `ER_DUP_KEYNAME` | 非幂等 CREATE INDEX（无守卫） |
| `092_租户ID.sql` | `ER_PARSE_ERROR` | 文件带 UTF-8 **BOM** |
| `170_platform_announcement_status_enum.sql` | `ER_PARSE_ERROR` | 「注释 + 分号」写法致语法错 |
| `201_账号口径统一.sql` | `NON_IDEMPOTENT_WRITE`（第二遍 `changedRows=4`，不报错） | 与文件头注释「第二遍 affectedRows=0」矛盾 ⇒ **需改幂等（待派）** |

### 6.2 C 类 8 条的由来（含实测危害）
`001/003/004/005/006/007/085` 是"`DROP TABLE IF EXISTS` + 重建"式脚本。**实测危害（真实发生在本机夹具）**：
未豁免前用全部 204 个文件跑一遍部署段 ⇒ 同一个库上 `t_product_spu` 的**外键与索引读数从 1/1 掉到 0/0**
（`raw/30-deploy-section-pass1.txt`）。⇒ 这 7 条若跑到**生产**上，就是"每次部署把这些表 DROP 掉重建"（真删数据）。
第 8 条 `075_reset_admin_password_bcrypt.sql` 是**人工判定**：不含破坏性语句，但每跑一次就重写一次管理员口令哈希。

---

## 七、边界与诚实标注（**没证**的东西）

1. **生产零写**：全部读数来自本机夹具（`127.0.0.1:3409`）；生产执行与只读复核仍须凌舟走官方通道。
2. **B 类 12 条"在生产上是否同样失败"未逐条验证**：夹具能给的只是"两条通道语义不同"这条**结构性**结论
   （无前缀表名 / 非幂等语句 / BOM 都是**源级**特征，与环境无关；`002` 的列默认值则与环境相关）。
3. **反测的失败是"清单指向不存在的文件"（真清单）+ "真实 SQL 执行失败"（scratch 夹具上让 `008` 真失败）**：
   真库上造 SQL 级失败需要改迁移文件 ⇒ 属红线，未做；两条分支合起来已覆盖。
4. **未做**：CI 接线（`.github/**` 红线）、生产执行、把 12 条 B 类逐个改造（红线：除 `069` 外不得改迁移文件）。
5. **回归读数与前版的差异**：本轮 `680 文件 / 9558 用例`（初版 `679/9536`）—— 本单**未新增/删除任何测试文件**
   （`git diff --name-status origin/main...HEAD` 里无 `__tests__`），差异来自**基线**不同（初版那轮与本轮的 `origin/main` 不同）。
6. **`docs/migrations/README.md` 不存在**（见 §二 §二.1）：本单只在豁免段注释里写"仅『新库初始化』通道执行"，
   `docs/migrations/` 下没有任何 README 可指 —— 属**文档缺口**，已登记待核对，未擅自新建文档。

---

## 八、复跑顺序（仓库根执行）

```bash
# 0) 夹具库（MySQL 8.0.28）127.0.0.1:3409；backend/.env 指向它（本机文件，已 gitignore，不含口令明文）
# 1) 三分类生成 + 自检（A 活动段 / B 登记册 / C 豁免段）
node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs
node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs --check
# 2) 门禁：绿侧 + 7 例反测（含登记册四例）
pwsh -File docs/evidence/S3-234/harness/run-guard-redtest.ps1 -Prefix 80
# 3) 部署链（迁移段 + 失败汇总段，同进程）：真清单全量两遍
bash docs/evidence/S3-234/harness/run-deploy-migration-section.sh "$PWD" pass1
bash docs/evidence/S3-234/harness/run-deploy-migration-section.sh "$PWD" pass2
# 4) 阻断两侧反测（新失败必红 / 已知不判红 / 缺失必红 / 真件未污染）
bash docs/evidence/S3-234/harness/run-deploy-section-blocking-redtest.sh "$PWD"
# 5) 069 幂等（第 73 项，初版证据的复跑口径，未改动）
pwsh -File docs/evidence/S3-234/harness/run-069-deploy-channel.ps1
node docs/evidence/S3-234/harness/run-069-two-pass.mjs --caseC
# 6) 回归（正确入口是 workspace 级，仓库根裸跑 vitest 会捞 Playwright 规格，见 raw/61）
npm --workspace backend test
npx tsc -p backend/tsconfig.json --noEmit
```

## 九、本目录文件

- `README.md`：本文件（结论 + 复跑口径 + 边界）
- `harness/`：证据装置 —— `gen-migrations-manifest.mjs`（v2 三分类）、`guard-migration-manifest.mjs`（在 `backend/scripts/`）、
  `run-guard-redtest.ps1`（v2：绿侧 2 例 + 反测 7 例）、`run-deploy-migration-section.sh`（v2：两段同进程）、
  `run-deploy-section-blocking-redtest.sh`（v2 新增：阻断两侧反测）、`run-069-deploy-channel.ps1`、`run-069-two-pass.mjs`、
  `run-manifest-sideeffects.mjs`、`run-deploy-section-redtest.sh`（初版：`set -euo` 定点覆盖，保留）、
  `db-probe.mjs`、`boot-full.ps1`、`boot-runtime-migration-069.ps1`、`069-回退到未应用态.sql`
- `raw/`：原始输出 —— `70~74`（R1 返工：阻断反测 / 全量两遍 / 注入 / 制品 SHA256）、`78~79`（回归）、
  `80*`（门禁 v2 绿侧与 7 例反测）；`10~62` 为初版留存（`10-boot-pass1-fresh.txt` 系 `s3239` 遗留的空库首遍启动日志）
