# 【回传 S3-215】第 65 项重做 · **第一步：复现 + 根因定性**（交回即停）

- **汇报对象**：凌舟（主代理）
- **汇报人**：阿坚（后端/迁移）｜本地子代理 `/root/s3219_ajian`
- **日期**：2026-10-16
- **对应派单编号**：**S3-215**｜卡：`docs/tasks/inbox/ACTIVE-S3-215.md`（派单人：凌舟｜2026-10-16）
- **工作树/分支**：`D:\Users\ZXQL\wt-agents\S3-215`｜`fix/s3-215-migration-drift-redo`｜基线 `origin/main` = `903b6b85`
- **交付物**：`docs/evidence/S3-215/00-recon.md`、`01-findings.md`、`harness/ci-path.ps1`；原始证据 `D:\Users\ZXQL\wt-agents\_s3215-evidence\01~07\`

---

## 一、结论（话在前面）

CI `migration-check` 的红**不是迁移缺陷**。`[自动备份]` 是**每分钟**触发的定时任务，它的首个 tick 可以落在
「进程已加载、`t_sys_config` 还没建出来」的**启动窗口**里，于是向**同一份日志**写下一行含「失败」二字的错误；
而 CI 的判据 `grep -q "失败" /tmp/mig.log` 把这条**非迁移模块**的日志当成了迁移失败。

**base（`0b48d663`）与 fix（`e6c6f95b` 内容）在本机都复现出同一行** ⇒ 与 #329 的语料改动**无因果**；
本机实测窗口 fix ≈ **2.0s** / base ≈ **3.1s**，命中与否只取决于**墙钟相位**。

## 二、做了什么

1. **新工作树**（`wt-agents/S3-215`，从 `origin/main`=903b6b85 起）＋分支 `fix/s3-215-migration-drift-redo`。
2. **原样重放 S3-212 的改动**（19 个源文件）：
   `git checkout e6c6f95b -- backend/src/shared/migration.ts docs/init_database.sql docs/migrations`
   校验：`git diff e6c6f95b -- <同范围>` **空**（逐字节一致）；`git diff 0b48d663 903b6b85 -- <同范围>` 也空（基线等价）。
   构建：`npm --workspace backend run build` 通过（dist 里 `max_order_amount DECIMAL(10,2)` = fix 形态）。
3. **跑 CI 等价路径 7 次**（MySQL 8.0.46 = CI `mysql:8.0` 同族）：**fix 5 次**（自然相位 1 + 相位对齐 4：+27s/+4s/+2s/+3s），
   **base 控制树 `wt-agents/S3-212-base`（`0b48d663`，dist 已核为 base 形态）2 次**（冷启动那次未命中、热启动那次命中）。
4. **未改任何业务代码**；未 commit、未 push、未开 PR；未动 `.github/**`、`deploy/**`、`R101-收口总清单.md`、`docs/数据库变更清单.md`。

## 三、证据（可复跑）

### 3.1 复现（两条，同形）

| 用例 | 树 | 进程启动 | cron 注册完成 | **tick** | `t_sys_config` 建出 | `grep -q 失败` |
|:--|:--|:--|:--|:--|:--|:--|
| 05-fix46-align3 | fix | 00:41:57.030 | ≤00:42:00.140 | **00:42:00.169** | ≤00:42:02.101 | **1** |
| 07-base46-align3b | base | 00:45:57.021 | ≤00:46:01.456 | **00:46:01.501** | ≤00:46:04.597 | **1** |

原始行（`_s3215-evidence/05-fix46-align3/mig.log`、`.../07-base46-align3b/mig.log`）：

```json
{"level":50,"time":1792082520169,"pid":5224,"hostname":"XIONG","msg":"[自动备份] 检查失败: Table 's3215_fix46_al3.t_sys_config' doesn't exist"}
{"level":50,"time":1792082761501,"pid":18768,"hostname":"XIONG","msg":"[自动备份] 检查失败: Table 's3215_base46_b3.t_sys_config' doesn't exist"}
```

同两次跑的迁移本体：`失败` 行 = 0；`t_sale_bill / t_sys_user / t_seckill_order / t_payment_config / t_sys_config`
五张表全部存在（装置 §「CI 的表检查」段，与 ci.yml 原文一致）。

### 3.2 反例（说明"日志里没有它"≠"它没跑"）

- `04-fix46-align2`：tick 在 00:39:00.000，比该次 node 模块加载完（首行日志 00:39:00.035）还早 ⇒ **cron 尚未注册**，没有查询，`失败`=0。
- `03-fix46-align4`：tick 00:37:00.028，表已在 00:36:59.324 建出 ⇒ 查询成功、0 行 ⇒ **静默**（无日志）。
  服务器侧证据（`performance_schema.events_statements_summary_by_digest`，schema `s3215_fix46_al4`）：
  `SELECT tenant_id…FROM t_sys_config WHERE config_key IN (…)` `COUNT_STAR=2`、`FIRST_SEEN 00:37:00.028`、`LAST_SEEN 00:38:00.013`
  —— 两次 tick 都真跑了，mig.log 里一行都没有。
- `01-fix46-natural`：冷启动（首行日志比进程启动晚 11.4s），跨了 3 个整分钟，tick 全在建表之后 ⇒ `失败`=0。

### 3.3 代码级三条（可核对的行）

- `backend/src/server.ts:31` 顶层 `import "./jobs/auto-backup.job.js";`（cron 在**模块导入期**注册）
- `backend/src/jobs/auto-backup.job.ts:87` `logger.error(\`[自动备份] 检查失败: …\`)`；末行 `cron.schedule("* * * * *", runAutoBackupCheck)`
- `backend/src/shared/migration.ts:1309` `跳过 DROP TABLE 语句（保护生产数据）`（外部 `005` 的 `DROP TABLE IF EXISTS t_sys_config` 被无条件拦下 ⇒ **表不是被迁移删掉的**）
- 建表在**内置阶段**：日志 `init_database.sql 业务表完成（总62张，实际建62，已存在跳过0）`（早于全部外部迁移）

### 3.4 复跑命令

```powershell
powershell -NoProfile -File docs\evidence\S3-215\harness\ci-path.ps1 `
  -Repo D:\Users\ZXQL\wt-agents\S3-215 -DbName s3215_fix46_al3 -Tag 05-fix46-align3 `
  -DbPort 3416 -AppPort 8107 -AlignTickAtSec 3 -LiveSec 70
```

（base 控制：`-Repo D:\Users\ZXQL\wt-agents\S3-212-base -DbName s3215_base46_b3 -AppPort 8108`；`-AlignTickAtSec 3` = 让进程在整分钟前 3s 启动。）

## 四、卡面 §一 四条自检

1. 在 CI 等价路径下复现同一失败行 —— ✅ 3.1（两条，fix + base）
2. 给出根因，逐条排除/证实候选 —— ✅（`01-findings.md` §四：①排除 ②成立但与 #329 无关 ③排除 ④证实）
3. 根因定性前不改代码 —— ✅（全程 0 业务代码改动）
4. 定性后回执 + 交回即停 —— ✅（第二步未动手，等裁定）

## 五、未完成与阻塞

- **第二步（按根因最小化重做）未开始** —— 按卡面要求"定性后交回即停"。
- 阻塞/待裁定：**修哪一层** —— A 门禁判据收窄（`grep` 只吃迁移/种子模块）／B 应用侧把 `auto-backup` 的 cron 注册推迟到
  `runMigrations()` 之后并把启动期该异常降级为 warn／C 两者。另：**#329 的语料收敛是否按原样重新提交**（重放内容已在工作树待命）。
- 无法本地核对：CI 那次红的具体 run 日志（仓内无存档；`git fetch` 当前不可达，报 `Recv failure: Connection was reset`）。
  故"CI 那次是单行 cron 错误"用的是卡面转述；本单以"同一行可复现 + 同一判据会红"为准。

## 六、风险与自我报备

1. **相位对齐是复现手段，不是伪造**：窗口位置由 node 冷/热启动决定（本机 0.5s↔12s 波动），不改任何代码与数据；
   本机 7 次实跑：自然相位 1 次命中 0 次，相位对齐 6 次命中 2 次（fix `+3s`、base `+3s`）。装置与全部原始日志已存档，可原样复跑复核。
2. 本机窗口 2~3s，**小于** CI（冷启动 + docker MySQL 更慢）⇒ 本单不给"CI 命中概率"数字，只给机制与相位实测。
3. 用的 MySQL 是 S3-212 遗留 scratch 实例（3407/3416），我只建自己的 `s3215_*` 库；未动他人库/生产库，生产零写操作。
4. 01 号用例首跑的 `/health` 读数被"他人在跑的实例/残留监听"骗到（假 200），已按踩坑[167]改为「日志 listening + HTTP 200」双条件；
   该用例其余读数（迁移日志、DB 侧）不受影响，01 的 health 读数以本回传为准作废。

## 七、卡外观察（供凌舟决策）

1. `migration-check` 的 `grep -q "失败"` 覆盖**整份**日志 ⇒ 目前**任何**非迁移模块在启动窗口内的报错都会把该 job 判红；
   同类风险还有 `[seed]`、scanner 等（日志里都出现过 `失败` 字样）。建议并入本轮门禁治理。
2. `auto-backup` 在"配置表 0 行"时**静默返回**（无任何日志痕迹）⇒ 生效性与"没跑"不可区分；本单靠 digest 才证实它在跑。
3. 工作树当前状态：S3-212 重放的 19 个文件**已暂存、未提交**；证据文件未跟踪。若要干净基线，`git restore --staged --worktree` 即可回 `903b6b85`。

---

**署名**：汇报人 阿坚（后端/迁移）｜汇报对象 凌舟（主代理）｜日期 2026-10-16｜对应派单编号 **S3-215**
