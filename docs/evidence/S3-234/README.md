# S3-234 证据目录 · 迁移流水线收口（收口总清单第 73 + 74 项）

> 归属单：**S3-234**（执行方 `/root/s3241_ajian`，接手 `s3239` 未收尾的工作）
> 夹具：本机 **MySQL 8.0.28**（`127.0.0.1:3409`，datadir `%TEMP%\mysql80\data-s3234`，**生产零写**）
> 口径：本目录所有结论都对应一条**可复跑命令** + 一份 `raw/` 原始输出。

---

## 〇、一页结论（交付时读数）

| # | 判据（卡面 §三） | 装置 | 读数 | 证据 |
|:--|:--|:--|:--|:--|
| R1-a | 069 真库**连跑两遍 ⇒ 零错误码**（部署通道真命令） | `run-069-deploy-channel.ps1` | pass1 **EXIT=0**、pass2 **EXIT=0**；`col/fk/idx = 1/1/1` 不变 | `raw/41-deploy-069-pass1.txt`、`41-deploy-069-pass2.txt`、`41-deploy-069-two-pass.txt` |
| R1-b | 069 两分支：租户列**在** ⇒ 租户内回填；**不在** ⇒ 跳过（不跨租户） | `run-069-two-pass.mjs` | 用例 A：回填 2 行、**跨租户同名行仍为 NULL**、第二遍 `已存在，跳过`；用例 B：走跳过分支、两遍 `ok` | `raw/31-069-two-pass-branches.txt` |
| R2-a | 清单**全量遍历两遍** + 日志原文（**真实部署段源码**） | `run-deploy-migration-section.sh` | 第一遍 **186 成功 / 11 失败**；第二遍 **186 / 11**，**失败清单逐条一致**；段退出码两遍均 **0** | `raw/33-deploy-section-full-postfix.txt`、`34-deploy-section-full-postfix-pass2.txt` |
| R2-b | 任一失败 ⇒ **日志清晰点名**（含 `set -euo pipefail` 保真） | `run-deploy-section-redtest.sh` | 三用例（文件不存在 / 文件执行失败 / 清单缺失）**都不 abort**，逐条点名到文件 | `raw/35-deploy-section-redtest.txt` |
| R2-c | 已应用的重复跑 ⇒ **零副作用**（机读） | `run-manifest-sideeffects.mjs` | 两遍、197 文件：**结构面五读数增量全 0**；数据面真实变更仅 **2 个文件**（见 §五） | `raw/50-sideeffects-pass1.{txt,json}`、`51-sideeffects-pass2.{txt,json}` |
| R3-a | 守卫绿 | `run-guard-redtest.ps1` | 清单：活动 **197** / 豁免 **7** ⇒ **EXIT=0**；`--json` 同 | `raw/20-guard-green.txt`、`20-guard-green.json`、`26-guard-redtest-run.txt` |
| R3-b | 守卫**能红**（三例反测，缺一即无效） | 同上 | ①新迁移未登记 ⇒ **EXIT=1 并点名**；②清单指向不存在文件 ⇒ **EXIT=1 并点名**；③清单少登记真实文件 ⇒ **EXIT=1 并点名**；每次复原后 **EXIT=0**（清单 SHA256 前后一致） | 同上 |
| 回归 | 全量测试 / 类型 | `npm --workspace backend test`、`npx tsc -p backend/tsconfig.json --noEmit` | **679 文件 / 9536 用例 / 0 failed**（EXIT=0）；tsc **EXIT=0** | `raw/62-vitest-backend-full.txt`、`raw/60-tsc.txt` |

`raw/61-vitest-full.txt` 是**错误入口**的历史记录，保留以便对照：在仓库根裸跑 `npx vitest run` 会把
`e2e/*.spec.ts`（Playwright 规格）也捞进来 ⇒ 281 个 Failed Suites。全量回归的**正确入口是
`npm --workspace backend test`**（= `backend/vitest.config.ts` 口径）。

---

## 一、本轮改动面（4 个文件 + 证据目录）

| 文件 | 性质 | 谁写的 |
|:--|:--|:--|
| `deploy/migrations-manifest.txt` | **新增**：迁移唯一真相源（活动段 197 + 豁免段 7） | 本单（`s3239` 未建，由 `s3241` 补齐） |
| `deploy/auto-deploy.sh`（迁移段） | **改**：硬编码 3 条 ⇒ 遍历清单；失败逐条点名（仍不阻断） | `s3239` 写，`s3241` 复核 + 补证据 |
| `docs/migrations/069_商品SPU增加品牌ID.sql` | **改**：3 组 DDL 加 `information_schema` 守卫 + **第 2 句回填句加守卫** | `s3239` 写前三段，`s3241` 补第 2 句 |
| `backend/scripts/guard-migration-manifest.mjs` | **新增**：零依赖门禁（四条判据） | `s3239` 写，`s3241` 复核 + 反测 |

清单生成器：`harness/gen-migrations-manifest.mjs`（**禁止手抄**；`--check` 只比对不写）。

---

## 二、R1｜069 幂等（第 73 项）

### 病灶（两条，必须都说得清）
1. **非空库重跑必红**：原文件 3 条 DDL 全是无守卫写法 ⇒ 第 3 条必报
   `Duplicate foreign key constraint name 'fk_product_spu_brand'`（errno 1826，**不在** `run-migration.mjs` 的宽容集合里）。
2. **第 2 句回填句同样会中止整文件**：`JOIN t_brand b ON b.name = p.brand AND b.tenant_id = p.tenant_id` ——
   `t_product_spu.tenant_id` 在部分环境不存在 ⇒ 部署通道（整文件下发）**在该句中止**，
   第 3/4 句的外键与索引守卫**根本跑不到**。这条是 `s3239` 交付后、由本单"清单全量遍历第一遍"暴露出来的
   （原写法在部署通道会在第 1 句被判"Duplicate column ⇒ 已应用，跳过"，所以它从来没露过面）。

### 修法（只加守卫，不改结果态与数据语义）
- 列 / 外键 / 索引：`information_schema` 判定 ⇒ 不在则建、在则整句跳过并回显"已存在，跳过（幂等）"；
- 回填句：**两表 `tenant_id` 都在** ⇒ 租户内同名回填；否则**整句跳过**。
  **不做**去掉租户条件的降级 JOIN —— 那会把别的租户的同名品牌串到本租户商品上（多租户越界），宁可跳过。
- 外键引用写成 `t_brand`：本文件经两条通道执行，而 `addTablePrefix` 只在启动期那条生效，显式带前缀才能两条通道指向同一张表。

### 边界
- 两遍是在**夹具库**（已建全量 schema）上跑的；**生产未执行任何写操作**。
- 用例 B 用的是本机夹具的真实形态（`t_product_spu` 无 `tenant_id`）——该形态本身在 §五 有一条待核对记录。

---

## 三、R2｜清单驱动（第 74 项）

### 装置为什么"抽真源码"而不是"重写一份等价脚本"
`run-deploy-migration-section.sh` 用 `sed -n '/S3-234 迁移段开始/,/S3-234 迁移段结束/p'` 从
**仓库里的 `deploy/auto-deploy.sh` 原文**抽出迁移段（会打印行数），`bash -n` 过语法后执行 ——
证明的是**线上那个件**，不是复刻件。

### 两遍读数（197 个活动文件）
```
第一遍：迁移段小结：成功 186 个 / 失败 11 个        段退出码 0
第二遍：迁移段小结：成功 186 个 / 失败 11 个        段退出码 0
失败清单：两遍 Compare-Object 无差异（逐条一致）
```
失败**不阻断部署**是设计（卡面：是否升为阻断由凌舟裁定）；本单只做到"**可定位**"：
每条失败都带 `❌ [迁移] <文件名> 执行失败：<原因>` + 日志尾部 3 行，段末再统一汇总一次。

### 已知保真缺口（明写在明处）
- 全量两遍是在**未置 `set -euo pipefail`** 的抽取段下跑的（`auto-deploy.sh` 第 2 行有这个选项，抽取段本身不含）。
  该缺口由 `run-deploy-section-redtest.sh` **定点覆盖**：把 `set -euo pipefail` 补在段前，
  证明段在严格选项下**不会中途 abort**、失败项照样点名（`raw/35-*.txt`）。
- 迁移段逐个文件起 `node` 进程，夹具机上全量一遍实测 **595s**；生产上取决于机器。

---

## 四、R3｜门禁（`guard-migration-manifest.mjs`）

四条判据（各自可单独判红）：①正向覆盖 ②反向存在 ③豁免合规/无重复 ④**活动段行序 == 运行时跑序**。
其中 ④ 是关键：部署跑序与启动期跑序（`migration.ts` 第 8 步 `readdirSync().filter().sort()`）不一致时，
"同一批迁移在两条通道里的先后"会漂移，依赖顺序可能只在其中一条通道里成立。

反测按"**先注违规 → 验红并点名 → 复原（SHA256 一致）→ 验绿**"的顺序做（对齐派单规范 §9.1 的顺序要求）：

| 用例 | 制造什么 | 期望 | 实测 |
|:--|:--|:--|:--|
| ① | 往 `docs/migrations/` 放一个新迁移且不入清单 | EXIT=1 并点名 | EXIT=1，点名 `999_反测临时迁移_未登记.sql`；删掉后 EXIT=0 |
| ② | 清单活动段加一行不存在的文件（scratch 根，不动工作树） | EXIT=1 并点名 | EXIT=1，点名 `999_不存在的迁移.sql` |
| ③ | 清单里删掉一行**真实**迁移（`204_系统设置域权限点立码.sql`） | EXIT=1 并点名 | EXIT=1，点名该文件；恢复清单后 EXIT=0，SHA256 与初始一致 |

装置自身的一次翻车保留在案：反测③ 首版删的是"反测② 刚加进去的那一行"，结果刚好恢复原状 ⇒ 断言没红。
这正是"**反测必须真的能红**"要防的事（现版本已修正，`raw/23-*.txt` 为现版本输出）。

`.github/**` 未改（红线），**CI 接线由凌舟做**。

---

## 五、本轮新冒出来的信号（按"门禁修好后首次真跑 = 新发现信号源"口径登记）

### 5.1 部署通道"第二遍必红"的 11 个文件（两遍清单一致）

| 归类 | 文件 | 原因 |
|:--|:--|:--|
| 引用**无前缀**表名（部署通道**没有** `addTablePrefix`） | `008_phase6_schema.sql`、`099_seed_data.sql` | `Table 'liquor_inventory.sys_role' / 'sys_user' doesn't exist` |
| **非幂等 INSERT**（无 `ON DUPLICATE`/无守卫） | `016_phase9_tenant_subscription.sql`、`020_migrate_v3_payment_miniapp.sql`、`105_product_marketing_tag.sql`、`106_data_permission.sql` | `Duplicate entry ...` |
| **非幂等 CREATE INDEX**（无守卫） | `078_性能索引.sql`、`120c_performance_indexes.sql` | `Duplicate key name ...` |
| 文件**编码/写法**缺陷 | `092_租户ID.sql`（文件带 UTF-8 **BOM** ⇒ 解析错）、`170_platform_announcement_status_enum.sql`（注释+分号写法 ⇒ 语法错） | `ER_PARSE_ERROR` |
| 老 seed 依赖列默认值 | `002_phase1_seed.sql` | `Field 'tenant_id' doesn't have a default value` |

本单**没有**为了转绿把它们豁免（那属于"为转绿而降级检查"）；它们照旧在活动段，由部署日志点名。

### 5.2 重复跑**仍真实写行**的 2 个文件（机读 `changedRows > 0`，结构面增量 0）

- `075_reset_admin_password_bcrypt.sql`：每遍 `changed=3` —— bcrypt 随机盐 ⇒ 每跑一次重写一次管理员口令哈希（值等价、行为非幂等）。
- `201_账号口径统一.sql`：每遍 `changed=4` —— 与该文件头注释"第二遍命中 0 行、affectedRows=0"**不一致**（两遍均 4，可复现）。

另有约 8 个文件 `affectedRows > 0` 而 `changedRows = 0`：那是驱动 `CLIENT_FOUND_ROWS` 语义下的"命中行数"，
**不是**真实变更。装置头部"判据：第二遍 affected 合计 = 0"在这一点上**过严** ⇒ 定性请以
`changedRows` + 结构面增量两列为准（本单未改装置判据，只登记口径差异）。

### 5.3 破坏性迁移文件（豁免段 7 条的由来，附实测危害）

`001_phase1_schema.sql`(25 处) `003_phase2_schema.sql`(14) `004_phase3_schema.sql`(2) `005_phase3_sys_config.sql`(1)
`006_phase4_schema.sql`(7) `007_phase5_schema.sql`(5) `085_报价推送.sql`(3) —— 都是"`DROP TABLE IF EXISTS` + 重建"式脚本。

**实测危害（真实发生在本机夹具上）**：未豁免前，用**全部 204 个文件**跑了一遍部署段 ⇒ 跑完后同一个库上
`t_product_spu` 的**外键与索引读数从 1/1 掉到 0/0**（`col/fk/idx = 1/0/0`，见 `raw/31-069-two-pass-branches.txt`
用例 C 的首版读数与 `raw/30-deploy-section-pass1.txt`）。⇒ 这 7 个文件若跑到**生产**上，
就是"每一次部署把这些表 DROP 掉重建"（真删数据），故进豁免段并写明理由。

### 5.4 夹具侧一条**待核对**观察（不在本单授权范围，未改任何代码）

用本机夹具（空库起，走启动期通道）建库后，`t_product_spu` **没有** `tenant_id` 列，而 `t_brand` 有；
同一份启动日志里，核心建表步骤曾把 `t_product_spu.tenant_id` 判为 `ER_DUP_FIELDNAME`（=当时存在）。
这与 §5.3 的 `001` DROP+CREATE 行为叠加后可以解释，但**根因未定论**，且它影响"夹具能否代表生产"这一前提 ⇒
登记为待核对项（见回传卡「待凌舟裁定项」）。

---

## 六、边界与诚实标注（**没证**的东西）

1. **生产零写**：全部读数来自本机夹具（`127.0.0.1:3409`）；生产执行与只读复核仍须凌舟走官方通道。
2. 夹具是"**启动期通道**建起来的已应用库"（`MIGRATION_WRITE_GATE=block`）⇒ 建库时 UPDATE/INSERT 被跳过，
   所以 `run-manifest-sideeffects --pass=1` 对部分数据文件其实是"**首次落地**"；
   **`--pass=2` 才是真正的"重复跑"读数**。
3. 迁移段两遍未置 `set -euo pipefail`（缺口与定点覆盖见 §三）。
4. 未做：CI 接线、生产执行、把 11 个必红文件逐个改造（本单红线：只允许改 `069` 一个迁移文件）。
5. 未做：把"11 个必红文件"逐个定性到"其在生产上是否也同样失败"——夹具能给的只是"这两条通道语义不同"
   这条**结构性**结论（无前缀表名 / 非幂等语句 / BOM 都是源级特征，与环境无关；`002` 的列默认值则与环境相关）。

---

## 七、复跑顺序（仓库根执行）

```bash
# 0) 夹具库（MySQL 8.0.28）127.0.0.1:3409；backend/.env 指向它（本机文件，已 gitignore，不含口令）
# 1) 清单生成 + 自检
node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs
node docs/evidence/S3-234/harness/gen-migrations-manifest.mjs --check
# 2) R3 门禁：绿侧 + 三例反测
pwsh -File docs/evidence/S3-234/harness/run-guard-redtest.ps1
# 3) R1 069：部署通道真命令两遍 + 两分支
pwsh -File docs/evidence/S3-234/harness/run-069-deploy-channel.ps1
node docs/evidence/S3-234/harness/run-069-two-pass.mjs --caseC
# 4) R2 迁移段：全量遍历两遍 + 失败处理反测
bash docs/evidence/S3-234/harness/run-deploy-migration-section.sh "$PWD"
bash docs/evidence/S3-234/harness/run-deploy-section-redtest.sh "$PWD"
# 5) R2 副作用/重复跑（机读）
node docs/evidence/S3-234/harness/run-manifest-sideeffects.mjs --pass=1 --json-out=docs/evidence/S3-234/raw/50-sideeffects-pass1.json
node docs/evidence/S3-234/harness/run-manifest-sideeffects.mjs --pass=2 --json-out=docs/evidence/S3-234/raw/51-sideeffects-pass2.json
# 6) 回归
npm --workspace backend test
npx tsc -p backend/tsconfig.json --noEmit
```

## 八、本目录文件

- `README.md`：本文件（结论 + 复跑口径 + 边界）
- `harness/`：证据装置 —— `gen-migrations-manifest.mjs`、`run-guard-redtest.ps1`、`run-069-deploy-channel.ps1`、
  `run-069-two-pass.mjs`、`run-manifest-sideeffects.mjs`、`run-deploy-migration-section.sh`、
  `run-deploy-section-redtest.sh`、`db-probe.mjs`、`boot-full.ps1`、`boot-runtime-migration-069.ps1`、
  `069-回退到未应用态.sql`
- `raw/`：原始输出（编号对应 §〇 表格；`10-boot-pass1-fresh.txt` 为 `s3239` 遗留的空库首遍启动日志）
