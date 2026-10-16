# 回执 · S3-234 **返工单 R1**（部署通道三分类 + 新失败阻断）

【汇报 S3-234-R1】部署通道**三分类**（A 184 / B 12 / C 8 = 204）+ **新失败阻断部署**已落地，两侧反测与真件复原齐；本地 3 笔提交，**未 push / 未开 PR**

汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 部署）｜2026-10-16
执行会话：`/root/s3243_ajian`｜工作树 `D:\Users\ZXQL\wt-agents\S3-234`｜分支 `chore/s3-234-migration-pipeline`（基线 `origin/main = ca4b4151`）
对应派单：`docs/tasks/inbox/ACTIVE-S3-234-R1.md`

---

## 一、交付物（提交哈希）

| 交付物 | 路径 | 性质 | 提交 |
|:--|:--|:--|:--|
| 三分类生成器 v2（A/B/C 一次生成两件 + `--check` 双件比对 + 守恒断言） | `docs/evidence/S3-234/harness/gen-migrations-manifest.mjs` | 改 | `7c662711` |
| 迁移清单（A 活动段 184 + C 豁免段 8） | `deploy/migrations-manifest.txt` | 改 | `7c662711` |
| **非幂等登记册（B 类 12 条）** | `deploy/migrations-nonidempotent-registry.txt` | **新增** | `7c662711` |
| 部署脚本：迁移段查表定性 + 失败汇总段把新失败并入 `FAILURES` | `deploy/auto-deploy.sh` | 改 | `7c662711` |
| 门禁 v2（五判据：正/反/合规唯一归属/行序/登记册存在性） | `backend/scripts/guard-migration-manifest.mjs` | 改 | `7c662711` |
| 证据装置：迁移段+汇总段**同进程**运行器 v2 / 门禁反测 v2（七例）/ **新增**阻断两侧反测 | `docs/evidence/S3-234/harness/run-deploy-migration-section.sh`、`run-guard-redtest.ps1`、`run-deploy-section-blocking-redtest.sh` | 改 / 改 / **新增** | `7c662711` |
| 三分类花名册装置（逐条 204 行 + 守恒断言） | `docs/evidence/S3-234/harness/dump-three-channel-roster.mjs` | **新增** | 第三笔（本回执所在提交） |
| 证据索引与原始输出 | `docs/evidence/S3-234/README.md`、`raw/70~75、78~80*` | 改 / 新增 | `cf89d809` + 第三笔 |
| 回传卡 §十一 + 本回执 | `docs/tasks/cards/R101-S3-234-阿坚-回传.md`、`docs/tasks/inbox/ACTIVE-回执-S3-234-R1.md` | 改 / 新增 | 第三笔 |

**制品 SHA256（当前工作副本读数）**：

| 制品 | SHA256 |
|:--|:--|
| `deploy/migrations-manifest.txt` | `F4B3DFBD16FAFA6CDBE38171D123CB49796246E60C993A0930E35D3E05C54CA3` |
| `deploy/migrations-nonidempotent-registry.txt` | `8DD7E87FDB7D7F168CA3DF8C239AC6605C6392069448028043DB9B2E830529BC` |
| `deploy/auto-deploy.sh` | `51939A1A50FED83B5084BE58B56F2998CC1CDDA208466FA0A624BDCD10279410` |
| `backend/scripts/guard-migration-manifest.mjs` | `46471CCEA4E6370DFDEE3559D8681B4BA81F5E8C4C7A00DC7C56128A761891F6` |
| `docs/evidence/S3-234/harness/gen-migrations-manifest.mjs` | `E08A5D40C0C2089D650078D7DC82A2765E9623F4FB358995B580151AE45110F2` |

（同步落盘：`docs/evidence/S3-234/raw/74-artifacts-sha256.txt`）

---

## 二、证据（可复跑）

| # | 判据 | 命令（仓库根） | 读数 | 原始输出 |
|:--|:--|:--|:--|:--|
| 1 | 三分类生成 + 自检 | `node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs` / `… --check` | 写入 **A 184 / C 8**（清单）+ **B 12**（登记册），合计 **204 = 目录 204**；`--check` **两件一致**（EXIT=0） | `raw/80-guard-green.txt`（计数同源） |
| 2 | 花名册（逐条 204 行 + 守恒） | `node docs/evidence/S3-234/harness/dump-three-channel-roster.mjs` | `A=184｜B=12｜C=8｜合计=204｜目录=204｜未登记=0` | `raw/75-three-channel-roster.txt` |
| 3 | 门禁绿侧（含 `--json`） | `node backend/scripts/guard-migration-manifest.mjs`（+ `--json`） | **EXIT=0**；`counts = {migrationsInDir:204, active:184, exempt:8, registry:12}` | `raw/80-guard-green.txt`、`80-guard-green.json` |
| 4 | 门禁反测七例（红侧） | `pwsh -File docs/evidence/S3-234/harness/run-guard-redtest.ps1 -Prefix 80` | 七例（未登记新迁移 / 清单指向不存在文件 / 活动段少登记 / 登记册少登记 / 登记册行格式非法 / 跨通道重复 / 登记册指向不存在文件）**全部 EXIT=1 且点名**；复原后 EXIT=0 且真件 SHA256 未被污染 | `raw/80-guard-redtest-run.txt` + `raw/80b~80k-*.txt` |
| 5 | **阻断两侧反测** | `bash docs/evidence/S3-234/harness/run-deploy-section-blocking-redtest.sh "$PWD"` | 用例 A（不在登记册的**真失败**）⇒ **组合退出码 1** + 点名 `008_phase6_schema.sql`；用例 B（同一失败**登记在册**）⇒ 打印 `⏭️ 已知非幂等（登记在案）` + **组合退出码 0**；用例 C/D（清单缺失 / 登记册缺失）⇒ **均 1**（fail-closed）；用例 E 真件 SHA256 前后一致。**全部断言 PASS** | `raw/70-blocking-redtest.txt` |
| 6 | 真清单全量两遍（部署通道真源码，两段同进程） | `bash docs/evidence/S3-234/harness/run-deploy-migration-section.sh "$PWD" pass1`（第二遍 `pass2`） | 两遍均 **成功 184 / 新失败 0 / 已知 0**，**组合退出码 0 / 0** | `raw/71-deploy-full-pass1.txt`、`73-deploy-full-pass2-restored.txt` |
| 7 | 真清单注入 ⇒ 红 ⇒ 逐字节复原 ⇒ 绿 | 同上（标签 `injected`；注入后立刻复原） | 注入后 **组合退出码 1** 且点名 `999_反测_新失败文件不存在.sql`；复原后清单 SHA256 回到 `F4B3DFBD…4CA3`（= 注入前）；复跑 **退出码 0** | `raw/72-deploy-injected-new-failure.txt`、`74-artifacts-sha256.txt` |
| 8 | 回归 | `npm --workspace backend test`；`npx tsc -p backend/tsconfig.json --noEmit` | **680 文件 / 9558 用例 / 0 failed**（EXIT=0）；tsc **EXIT=0** | `raw/78-vitest-backend-full.txt`、`79-tsc.txt` |

---

## 三、部署通道三分类表（三个数字 + 逐条）

**三个数字：A 活动段 184 ｜ B 登记册 12 ｜ C 豁免段 8 ⇒ 184 + 12 + 8 = 204 = `docs/migrations/*.sql` 总数（守恒成立）**

### 3.1 B 类（登记册 12 条，部署通道**不跑**；逐条：文件 | 失败形态 | 理由 | owner）

| # | 文件 | 失败形态 | 理由 | owner |
|--:|:--|:--|:--|:--|
| 1 | `002_phase1_seed.sql` | `ERR_NO_DEFAULT_FOR_FIELD`（`tenant_id` 无默认值） | 老 seed 依赖列默认值 ⇒ 第二遍必红 | 待派 |
| 2 | `008_phase6_schema.sql` | `ER_NO_SUCH_TABLE`（`sys_role`） | 引用无前缀表名；部署通道没有 `addTablePrefix` | 待派 |
| 3 | `016_phase9_tenant_subscription.sql` | `ER_DUP_ENTRY` | 非幂等 INSERT（无 `ON DUPLICATE KEY`/无守卫） | 待派 |
| 4 | `020_migrate_v3_payment_miniapp.sql` | `ER_DUP_ENTRY` | 同上 | 待派 |
| 5 | `078_性能索引.sql` | `ER_DUP_KEYNAME` | 非幂等 CREATE INDEX（无守卫） | 待派 |
| 6 | `092_租户ID.sql` | `ER_PARSE_ERROR` | 文件带 UTF-8 **BOM** | 待派 |
| 7 | `099_seed_data.sql` | `ER_NO_SUCH_TABLE`（`sys_user`） | 引用无前缀表名 | 待派 |
| 8 | `105_product_marketing_tag.sql` | `ER_DUP_ENTRY` | 非幂等 INSERT | 待派 |
| 9 | `106_data_permission.sql` | `ER_DUP_ENTRY` | 非幂等 INSERT | 待派 |
| 10 | `120c_performance_indexes.sql` | `ER_DUP_KEYNAME` | 非幂等 CREATE INDEX | 待派 |
| 11 | `170_platform_announcement_status_enum.sql` | `ER_PARSE_ERROR` | 「注释 + 分号」写法致语法错 | 待派 |
| 12 | `201_账号口径统一.sql` | `NON_IDEMPOTENT_WRITE`（第二遍 `changedRows=4`，不报错） | 与文件头注释「第二遍 affectedRows=0」矛盾 ⇒ **需改幂等** | 待派（需改幂等） |

### 3.2 C 类（豁免段 8 条，部署通道**不跑**；仅"新库初始化"通道执行）

| # | 文件 | 进豁免段的依据 |
|--:|:--|:--|
| 1 | `001_phase1_schema.sql` | 含行首无守卫破坏性语句（实测 25 处） |
| 2 | `003_phase2_schema.sql` | 同上（14 处） |
| 3 | `004_phase3_schema.sql` | 同上（2 处） |
| 4 | `005_phase3_sys_config.sql` | 同上（1 处） |
| 5 | `006_phase4_schema.sql` | 同上（7 处） |
| 6 | `007_phase5_schema.sql` | 同上（5 处） |
| 7 | `085_报价推送.sql` | 同上（3 处） |
| 8 | `075_reset_admin_password_bcrypt.sql` | **人工判定**：口令类种子（bcrypt 随机盐 ⇒ 每遍重写管理员口令哈希） |

### 3.3 A 类（活动段 184 条）

逐条 = `deploy/migrations-manifest.txt` **活动段**原文（机器生成、门禁守序）；**全文 204 行逐条花名册**见
`docs/evidence/S3-234/raw/75-three-channel-roster.txt`（序号 / 文件 / 通道三列，生成命令见其文件头；
末行汇总 `A=184｜B=12｜C=8｜合计=204｜目录=204｜未登记=0`）。

---

## 四、验收自评（逐条对 R1 卡面）

| 卡面 | 要求 | 自评 |
|:--|:--|:--|
| §一 | 三分类 + **三者相加 = 迁移总数** + 回传给三个数字与逐条文件表 | **通过**：184/12/8 = 204（花名册装置带守恒断言，未登记 0）；B/C 逐条见 §3.1/§3.2，A 逐条 = 清单活动段 + 全量花名册文件 |
| §二.1 | 豁免段注释写清"仅新库初始化通道执行 / 部署通道不执行"；**只读复核** `docs/migrations/README.md` | **部分通过**：注释语义已按卡面写（豁免段头 + 每条 EXEMPT 行）；**复核结果 = 真缺口**：该 README 在本仓与 `origin/main` **都不存在**（`git cat-file -e origin/main:docs/migrations/README.md` → 路径不存在），仓库根 `README.md` 的建库导入文件 `docs/phase1_schema.sql` **也不存在**（现存 `docs/init_database.sql`）⇒ 已登记 §七 待核对，**未擅自新建/修改任何 README** |
| §二.2 | 11 条进 registry、不塞 manifest；部署段三态口径 | **通过**：registry 12 条、清单活动段不含 B 类；`raw/70` 用例 A（新失败必红点名）/ 用例 B（在册不判红仍打印）双侧 |
| §二.3 | `075` 进豁免段并注明口令类；`201` 进 registry 标"需改幂等（待派）"；两者写清**生产已跑过** | **通过**：`075` 在豁免段（理由含 bcrypt 随机盐）；`201` 在 registry（owner 列含"需改幂等"）。**生产已跑过的事实与依据**：`075` → `docs/数据库变更清单.md:52`（2026-07-29 ✅ admin 可登录）；`201` → `docs/踩坑日志.md` 记的处置命令（`node scripts/run-migration.mjs docs/migrations/201_账号口径统一.sql`）+ 4 账号哈希只读复验。**不重跑 = 对生产无影响** |
| §二.4 | 新失败阻断、在册失败放行但打印；口径与**代价**写进脚本注释与回传卡 | **通过**：`deploy/auto-deploy.sh` 迁移段注释与失败汇总段注释均写明口径与代价（B 类 12 条会长期以"登记在案"形态出现在日志里，但每条带失败形态/理由/owner）；汇总段把 `MIGRATION_FAILURES` 并入 `FAILURES` ⇒ 自动化调用退出码 1 |
| §三.1/2 | 反测①新失败必红且点名、②在册失败不判红 | **通过**：原输出 `raw/70-blocking-redtest.txt`（A：退出码 1 + 点名；B：退出码 0 + `⏭️ 已知非幂等`）；另在**真清单**上做了同形态注入（`raw/72`，退出码 1 并点名） |
| §三.3 | 复原后复跑 ⇒ 退出码 0、清单 SHA256 与注入前一致 | **通过**：`raw/72`（注入）→ 复原（SHA256 `F4B3DFBD…4CA3`，与注入前一致）→ `raw/73`（复跑退出码 0） |
| §四 | 红线 | **遵守**：未 push、未开 PR、未 `git add -A`（逐路径 add）；未改 `.github/**`；未改任何迁移文件（`069` 本轮也未动）；未改业务代码；未对生产做任何写操作；未碰 `S3-233`/`S3-235` 工作树（`S3-235` 正由 `s3242` 使用，全程未读写）；证据无口令明文 |
| §五 | 回执 + 回传卡补三分类表 + 最终回答给三个数字 | **通过**：本回执 + 回传卡 §十一 |

---

## 五、未完成与阻塞

1. **CI 接线未做**（`guard-migration-manifest` 未进任何 job）：`.github/**` 属本单红线，接线仍须凌舟（含"先观察期还是直接 required"）。
2. **B 类 12 条的修复单未派**：registry 的 `owner 单号` 列全部为"待派"（`201` 另标"需改幂等"）⇒ **登记 ≠ 已修**，技术债仍在账上。
3. **未跑生产**：本单全部读数来自本机夹具（`127.0.0.1:3409`）；部署通道三分类的**生产**效果（下一次部署日志形态）须凌舟在合并后从部署 run 里复核。
4. **未逐条验证 B 类在生产上的失败形态**：夹具只能给"两条通道语义不同"这条结构性结论（无前缀表名 / 非幂等语句 / BOM 属源级特征；`002` 的列默认值与环境相关）。
5. **未改** `docs/tasks/current-tasks.md`、`docs/tasks/R101-收口总清单.md`、`docs/tasks/inbox/ACTIVE.md`（记账与归档属凌舟；按"路由文件只追加/不整文件重写"纪律，本轮**一个字都没动**）。

## 六、风险与自我报备

1. **路由表与派单消息不一致（我按派单消息执行，并在此报备）**：`docs/tasks/inbox/ACTIVE.md` 路由表把"S3-234 返工单（R1）"列在 `/root/s3241_ajian` 行，而凌舟给我的派单消息写明**本轮执行方 = `/root/s3243_ajian`**（该会话已以"已交付、无待办动作"结束，工作树停在 R1 前的状态）。我未改路由表任何行，请凌舟据实更新归属。
2. **SHA256 是对"当前工作副本（LF）"的读数**：本仓 `core.autocrlf=true`，`.gitattributes` 只钉 `*.sh`；重新检出后 `.txt` 会变 CRLF ⇒ **复跑请以内容/门禁为准**（部署段 `tr -d '\r'`、门禁 `split(/\r?\n/)` 都行尾无关）。
3. **两侧反测的失败形态是限定的**：真清单上注入的是"清单指向不存在的文件"（"让某个 A 类文件真失败"要改迁移文件 = 红线）；"真实 SQL 执行失败"这一支是在 scratch 夹具上用真件 `008_phase6_schema.sql` 跑出来的。两者合起来覆盖两条分支，但**都不是生产形态的注入**。
4. **回归读数与前一轮不同**：`680 文件 / 9558 用例`（前一轮 `679/9536`）。本单**未新增/删除任何测试文件**（`origin/main...HEAD` 里无 `__tests__` 改动），差异来自基线不同 —— 若按"应有 679/9536"核对会对不上，先看这条。
5. **我改动了 `s3241` 交付的 4 个文件**（清单、`auto-deploy.sh` 迁移段、guard、生成器）：属 R1 卡面授权范围内的"返工"；其初版结论我**全部保留**在证据目录（`raw/10~62` 未删未改），README 显式标注了"改前/改后"两轮。
6. **代价（卡面要求同时写进回传卡）**：B 类 12 条从此不再每天在部署日志里刷 ❌ —— 噪声降了，**但"它们还在坏着"的可见度也降了**；我把它压在 registry 的 `owner` 列与 README §六 6.1 表里，请凌舟在验收时确认这个可见度是否够。
7. **顺带发现（未改，供凌舟登记）**：① `docs/migrations/201_账号口径统一.sql:33` 的复跑命令注释写的是 `200_账号口径统一.sql`（与实际文件名不符）；② `docs/ops/S3-232-apply-204-prod.sh` 是一次性运维脚本（单文件硬编码 204），**不在**部署通道的枚举范围内，本单未处置。

## 七、待核对 / 待裁定

1. **建库/灾备流程文档缺口（真缺口）**：卡面 §二.1 指向的 `docs/migrations/README.md` **在本仓与 `origin/main` 都不存在**；仓库根 `README.md` 第 73/101 行写的建库导入文件 `docs/phase1_schema.sql` **也不存在**（现存 `docs/init_database.sql`）。⇒ 请裁定是否派一张**文档单**补齐"哪些迁移走初始化通道 / 哪些走部署通道 + 建库导入文件到底是哪个"。**本单只读复核，未改任何 README**。
2. **B 类 12 条的修复单**（建议按失败形态分两组：无前缀表名 / BOM / 语法错 = 源级修复；非幂等 INSERT / CREATE INDEX / 列默认值 = 加守卫）—— owner 列现为"待派"。
3. **CI 接线与否 + 观察期/required**（`.github/**` 红线，仍须凌舟）。
4. `run-manifest-sideeffects.mjs` 头部判据"第二遍 affected 合计 = 0"与驱动 `CLIENT_FOUND_ROWS` 语义不一致（前一轮已报备，本轮未改装置）。

---

关联卡：派单卡 `docs/tasks/inbox/ACTIVE-S3-234-R1.md`；回传卡 `docs/tasks/cards/R101-S3-234-阿坚-回传.md`（§十一 = 本轮汇报）；证据索引 `docs/evidence/S3-234/README.md`。
