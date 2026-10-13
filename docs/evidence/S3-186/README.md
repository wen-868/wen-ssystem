# S3-186 证据包：空库迁移静默丢 173 条补列 → 已修根因（补列不再依赖存储过程）

> 执行人：阿坚（后端，本地子代理通道）｜2026-10-13｜单号：S3-186（收口总清单第 46 项）
> 工作区：`D:\Users\ZXQL\wt-agents\S3-186`｜分支 `fix/s3-186-empty-db-migration`｜基线 `origin/main` = `09309817`
> 本单**未 commit / 未 push / 未开 PR**（由凌舟本机提交）；所用数据库为**本机私有 MariaDB 11.4.5**，**未触碰生产库**。

---

## 一、一句话结论

空库跑一遍迁移，比"补列语句全部落地"的结构**少 24 列（12 张表）/ 59 个索引**，成因是**两条互相独立、都静默**的机制：

1. **MIG-4 写闸门默认 block 把 `CALL` 当数据写语句整条挡下** ⇒ 173 条 `CALL` 一条都不执行（只留 WARN）；
2. **092 末尾 `DROP PROCEDURE` 之后两个辅助过程再未重建** ⇒ 即使显式 `MIGRATION_WRITE_GATE=allow`，092 之后的 **35 条** `CALL` 仍全部 `ER_SP_DOES_NOT_EXIST` 跳过。

修复：把 173 条 `CALL add_column_if_not_exists / add_index_if_not_exists` **逐条改写成不依赖存储过程的幂等写法**
（`information_schema` 守卫 + `PREPARE/EXECUTE`，与仓内 081/196 同款；首关键字 `SET` ⇒ 结构语句，**默认闸门下可执行**）。
修复后**全新空库一次跑完，与基线结构差异 = 0**，且**无存储过程残留**（S3-57-D1 判据不回归）。

---

## 二、缺陷如何被发现（两条机制的原始读数）

装置：`harness/run-case.ps1`（建空库 → 跑 `backend/dist/shared/migration.js` 的 `runMigrations()` → 落日志 → 结构快照）。

| 用例 | 配置 | 写闸门跳过 CALL | `ER_SP_DOES_NOT_EXIST` | 结构（表/列/索引/过程） |
|:--|:--|--:|--:|:--|
| **runA** | 空库 + **产品默认**（`MIGRATION_WRITE_GATE` 未设置） | **173** | 0 | 311 / **4113** / **1553** / 0 |
| **runA2** | 空库 + `MIGRATION_WRITE_GATE=allow` | 0 | **35** | 311 / 4119 / 1608 / 0 |
| **runB**（基线） | 在 runA2 库上，按 092 原文建两个过程 → **逐条执行 173 条 CALL** | — | — | 311 / **4137** / **1612** / 2 |

- runA 原始关键行：`key-lines.txt`（`写闸门 block 跳过 CALL 总条数：173`）。
- runA2 原始关键行：`key-lines.txt`（`ER_SP_DOES_NOT_EXIST 跳过条数：35`）。
- runB 重放摘要：`runB-replay.log`（`COLLECTED calls=173 files=9`、`REPLAY 成功=149 报错=24（全部 ER_NO_SUCH_TABLE）`）。

**差多少（机器判据，修复前 runA vs 基线 runB）**：`diff-runA-vs-runB.txt` = **差异合计 83**（缺列 24 / 多列 0 / 缺索引 59 / 缺表 0）；
分类与影响面见 `gap-analysis.txt`：

- **缺列 24 条 / 12 张表**：`t_approval_{rule,instance,task,log,approver,notification}.tenant_id`（**6 张审批表租户列，多租户隔离缺口**）、`t_retail_cart.tenant_id`、`t_miniapp_order_sync_log.{tenant_id,platform_order_no,response,updated_at}`、`t_member.contact`、`t_product_sku.box_barcode`、`t_sale_bill.{operator_name,auditor_id,auditor_name,salesman_id,salesman_name}`、`t_sale_bill_item.{sku_spec,unit,barcode,item_remark,item_discount,trace_codes}`。
- **缺索引 59 条**：**49 条为"同表同列、仅命名不同"的重复索引**（Step 2 已建 `idx_t_<表>_tenant`，功能不缺）；**10 条为真缺失**，其中 9 条是上面缺列的连带（`idx_*_tenant` / `idx_sync_log_platform_order_no`），1 条为 `t_delivery_record.idx_delivery_record_rider_id`。

两条机制的分工（用 runA vs runA2 拆开）：`diff-runA-vs-runA2.txt` = 6 列 + 55 索引（**只被写闸门挡住**，过程当时是存在的）；
`diff-runA2-vs-runB.txt` = 18 列 + 4 索引（**过程已被 092 末尾 DROP**）。

---

## 三、修复内容

| 文件 | 改动 | 行数 |
|:--|:--|:--|
| `docs/migrations/092_租户ID.sql` | 138 条 `CALL` 逐条改写为守卫式幂等写法（原 CALL 保留在同一条注释里以便逐条核对） | +414 |
| `docs/migrations/120a_合规凭证字段.sql` | 8 条 | +24 |
| `docs/migrations/125_instant_retail_admin_fix.sql` | 10 条 | +30 |
| `docs/migrations/129_sale_bill_item_compliance.sql` | 6 条 | +18 |
| `docs/migrations/134_sale_bill_role_fields.sql` | 5 条 | +15 |
| `docs/migrations/137_sys_user_dept_position.sql` | 2 条 | +6 |
| `docs/migrations/138_approval_business_link.sql` | 2 条 | +6 |
| `docs/migrations/123_member_contact.sql` | 1 条 | +3 |
| `docs/migrations/132_product_box_barcode.sql` | 1 条 | +3 |
| `backend/src/__tests__/shared/migration-no-call.test.ts` | **新增**守门单测：`docs/migrations/*.sql` 不得再出现 `CALL`（防复发） | 新增 |
| `backend/src/__tests__/shared/migration-delimiter.test.ts` | 该用例原判据"S3-57 的 CALL 全被闸门挡下"因 092 已无 CALL 而**失去对象**；改为注入一条**同形状合成 CALL**，判据仍有对象 | +14/−3 |

改写形态（每条 CALL → 3 条结构语句；下面以 123 为例，`render` 后即文件内真实文本）：

```sql
-- S3-186：原 CALL add_column_if_not_exists('t_member', 'contact', "VARCHAR(64) DEFAULT NULL COMMENT '联系人' AFTER name")（改为不依赖存储过程的幂等写法：守卫 information_schema.COLUMNS + PREPARE/EXECUTE，语义与 092 过程体逐字对应）
SET @s3186_tbl = 't_member', @s3186_name = 'contact';
SET @s3186_sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `', @s3186_tbl, '` ADD COLUMN `', @s3186_name, '` ', 'VARCHAR(64) DEFAULT NULL COMMENT ''联系人'' AFTER name'), 'SELECT ''跳过 t_member.contact'' AS result') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @s3186_tbl AND COLUMN_NAME = @s3186_name);
PREPARE s3186_stmt FROM @s3186_sql; EXECUTE s3186_stmt; DEALLOCATE PREPARE s3186_stmt;
```

口径选择（为什么选"改写用法"而不是"让 092 幂等建过程"）：

1. **只补过程修不好**：写闸门**默认 block** 把 `CALL` 整条挡下，过程在不在都不会执行 ⇒ 只改过程生命周期，产品默认配置下空库仍与生产不一致（runA 实测 173 条被挡）。
2. **与仓内硬口径一致**：`docs/tasks/当前批次.md` 的硬口径是"迁移**只做结构**，数据写入不得依赖 `MIGRATION_WRITE_GATE=allow`"。改写后首关键字是 `SET`，是**可见的结构语句**，默认闸门下就执行——不需要放宽闸门、也不需要给 `CALL` 开白名单（开白名单等于把闸门的"可见性"判据挖掉一块）。
3. **文件对"过程"自足**：改写后每条补列语句自解释、不再依赖任何过程。实测：在 `s3186_e` 上先 `DROP` 掉 `t_retail_cart.tenant_id` 与 `t_delivery_record.rider_id`，再用 `node scripts/run-migration.mjs docs/migrations/125_instant_retail_admin_fix.sql` **单文件直跑 ⇒ 迁移执行成功，两列真建回**（`t_retail_cart.tenant_id` = `varchar(36)`、`t_delivery_record.rider_id` = `bigint(20)`）。注：含 `USE` 行的文件（092/123/129/132/134）在这条运维路径上仍受 **该脚本自身的既有局限**（不过滤 `USE` 行、任一语句报错即整体中止）影响——这是改前就有的行为，与本单无关，本单未改。
4. **语义逐字保持**：守卫条件（`COLUMNS` 按列名 / `STATISTICS` 按索引名）、动态 SQL 文本、已存在时的静默跳过——与 092 两个过程体逐字对应，由 `harness/verify-rewrite.mjs` 自动断言（见下）。

---

## 四、验收判据与原始读数（全部可复跑）

总入口：`harness/acceptance.ps1 -DbName <空库名> -Tag <标签> -Baseline docs/evidence/S3-186/outputs/runB-snapshot.json`

| 判据 | 修复后（runC / runC3 / runE） | 反测：退回修复（runD） |
|:--|:--|:--|
| ① 全新空库一次跑完与基线结构差异 | **PASS**（差异合计 0，`acceptance-runE.txt`） | **FAIL（差异合计 83）** |
| ② 写闸门跳过 CALL | **PASS**（0 条） | **FAIL（173 条被静默跳过）** |
| ③ `ER_SP_DOES_NOT_EXIST` | **PASS**（0 次） | PASS（0，因为整条被闸门挡住，根本走不到过程） |
| ④ 存储过程残留 | **PASS**（0） | PASS（0） |
| 总判 | `S3186_ACCEPTANCE=GREEN` | `S3186_ACCEPTANCE=RED`（`acceptance-runD.txt`） |

辅助证明（都在 `outputs/`）：

- `verify-rewrite` 自证：173 条逐条 **① 条数守恒 ② 落盘一致 ③ 前缀免疫（`addTablePrefix` 不改写改写块）④ 动态 SQL 逐字节等价** ⇒ `RESULT: ALL PASS`。
- `structure-digest.txt`：结构哈希（不含库名/时间）。`runC = runC3 = runE`（同一结构哈希 `9b7e8aec…`，独立三次复跑一致）；`runA = runD`（`09d537e7…`，**反测退回后与修复前逐字节同结构** ⇒ 退回是真退回）。
- `compare-deep.mjs`（补 `diff.mjs` 覆盖不到的"列顺序 / 同名索引组成"）：`runA vs runD` **0**；`runC vs runE` **0**；`runB vs runC` **列顺序 1 条**——`t_delivery_record.rider_id`（基线 B 落在表尾 #16，修复后 C 落在 #7）：B 是"事后统一重放"（`AFTER rider_phone` 当时已是表尾列），C 是按文件顺序**就地执行**（125 位置时 `rider_phone` 在 #6）——**C 才是与生产同构的就地语义**。
- 复跑幂等性：`runC2`（同一库第二次跑）**多列 0 / 缺列 0**；多出的 15 个索引**均不来自本单改动的 9 个文件**（10 个是 `migration.ts` Step 2 的 `idx_t_<表>_tenant`，5 个来自 `120c_performance_indexes.sql`）——属该语料"第 2 次才收敛"的既有性质（表/列在后来的文件里才建出），与本单无关，见 `diff-runC-vs-runC2.txt`。

门禁（`backend` 目录）：

```
npx vitest run                     ⇒ Test Files 647 passed / Tests 7664 passed / 0 failed（VITEST_EXIT=0）
npx tsc -p tsconfig.json --noEmit  ⇒ TSC_EXIT=0
node backend/scripts/guard-route-auth.mjs    ⇒ EXIT=0（189 个路由文件，G3 通过）
node backend/scripts/guard-tenant-status.mjs ⇒ EXIT=0（G2 通过）
```

反测（"故意制造失败证明它会红"，两侧齐）：

| 反测 | 做法 | 结果 |
|:--|:--|:--|
| F1 退回修复 | 9 个迁移文件还原为改前版本 → 全新空库 | 红：`S3186_ACCEPTANCE=RED`，差异 83、173 条 CALL 被静默跳过（`acceptance-runD.txt`） |
| F1' 复原 | 用 `rewrite-calls.mjs --apply` 重放同一改写 → 全新空库 | 绿：`S3186_ACCEPTANCE=GREEN`（`acceptance-runE.txt`） |
| F2 新守门单测 | 往 `137_sys_user_dept_position.sql` 加一行 `CALL …` | 红：点名 `137_sys_user_dept_position.sql:10`（日志 `_s3186-evidence\logs\selftest-red-nocall.log`） |
| F3 被改动的既有用例 | 临时去掉合成 CALL（夹具退回"无 CALL"） | 红：`合成夹具必须恰好含 1 条 CALL（否则本判据失去对象）`（日志 `selftest-red-delimiter.log`） |

---

## 五、复跑指引

**前置**：① 本机私有 MariaDB（**未连生产**，端口 3406、datadir 在工作区外）：

```powershell
$mdb = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin"
& "$mdb\mariadb-install-db.exe" --datadir="D:\Users\ZXQL\wt-agents\_s3186-evidence\db\data" --password=""
Start-Process -FilePath "$mdb\mariadbd.exe" -WindowStyle Hidden -ArgumentList `
  "--datadir=D:/Users/ZXQL/wt-agents/_s3186-evidence/db/data","--port=3406","--bind-address=127.0.0.1","--ssl=0","--skip-name-resolve","--console"
```

② 工作区依赖：本工作树 `node_modules` / `backend\node_modules` 是指向主仓 `node_modules` 的 junction（本单未装包）；
> ⚠️ **清理本工作树时不要用 `Remove-Item -Recurse` / `rm -rf`**——递归删除会穿透 junction 把**主仓 `node_modules` 一起删掉**。
> 正确顺序：先删 junction 本身（`cmd /c rmdir node_modules`、`cmd /c rmdir backend\node_modules`，都**不带 `/s`**），再删工作树目录。
> 重建同样两条：`cmd /c mklink /J node_modules D:\Users\ZXQL\ZXQL-MS\wen-ssystem\node_modules`（backend 同理）。

③ 先 `cd backend && npx tsc -p tsconfig.json && node ../scripts/fix-esm-extensions.js dist` 生成 `dist`（装置直接跑**产品代码**，不是复制品）。

```powershell
cd D:\Users\ZXQL\wt-agents\S3-186
# 0）缺陷复现（修复前形态）：跑一个空库并把结构快照与基线比对
powershell -File docs\evidence\S3-186\harness\acceptance.ps1 -DbName s3186_repro -Tag repro `
  -Baseline docs\evidence\S3-186\outputs\runB-snapshot.json      # 期望：RED（差异 83 / 173 条被挡）

# 1）改写自证（语义等价四条件）
$env:S3186_REPO_ROOT=(Get-Location).Path; $env:JWT_SECRET='s3186-local-secret'
node docs\evidence\S3-186\harness\verify-rewrite.mjs docs\evidence\S3-186\outputs\rewrite-plan.json origin/main

# 2）修复后判据：全新空库一次跑完 ⇒ 期望 GREEN
powershell -File docs\evidence\S3-186\harness\acceptance.ps1 -DbName s3186_verify -Tag verify `
  -Baseline docs\evidence\S3-186\outputs\runB-snapshot.json
```

装置清单（`docs/evidence/S3-186/harness/`）：

| 脚本 | 作用 |
|:--|:--|
| `run-case.ps1` | 建空库 → 跑产品迁移（默认/显式闸门）→ 落日志与结构快照（`-NoReset` 用于同库复跑） |
| `snapshot.mjs` | 结构快照（表/列/索引/存储过程残留）→ JSON |
| `diff.mjs` | 两份快照比对（缺/多表列索引 + 列定义），有差异 exit 1 |
| `compare-deep.mjs` | 深比对：列顺序 + 同名索引组成 |
| `digest.mjs` | 结构摘要（条数 + 结构哈希，不含库名/时间） |
| `acceptance.ps1` | 验收总入口（四条判据 + GREEN/RED） |
| `collect-calls.mjs` | 用**产品切分器**抽出全部 `CALL`（173 条，按文件顺序） |
| `replay-calls.mjs` | 按 092 原文建过程 → 逐条执行 CALL（生成基线库） |
| `replay-baseline.ps1` | 基线生成 + 与指定快照比对 |
| `rewrite-calls.mjs` | 173 条 CALL 的改写器（`--apply` 落盘，`--plan=` 落改写计划） |
| `verify-rewrite.mjs` | 改写语义等价自证（条数守恒 / 落盘一致 / 前缀免疫 / 动态 SQL 逐字节等价） |
| `analyze-gap.mjs` | 缺口分类（重复索引 vs 真缺失）+ 缺列表 |

---

## 六、工作区外的取证残留（不在仓库里）

`D:\Users\ZXQL\wt-agents\_s3186-evidence\`：

- `snapshots\*-snapshot.json`：各用例完整结构快照（约 1.3MB/份；仓库内只放 `structure-digest.txt` 摘要）；
- `logs\*-migration.log`：各用例完整迁移日志（约 100–145KB/份；仓库内只放 `key-lines.txt` 抽取）；
- `logs\vitest-final.log`（647 文件 / 7664 用例全绿）、`logs\selftest-red-*.log`（反测红）；
- `pre-fix\<9 个迁移文件>`：改前原件备份（反测 F1 用的就是它们）；
- `db\data`：本机私有 MariaDB 数据目录（**未连生产**；收工可 `mariadb-admin shutdown` 后删除）。

---

## 七、局限与诚实缺口

1. **基线是"语料意图"，不是生产实测**（红线 1：本单只在空库副本验证，不读生产）。基线定义：082 之后全部迁移**在其文件位置上真正执行**所能建出的结构（= runA2 + 173 条 CALL 逐条执行）。**生产是否也有这 24 列 / 59 索引的缺口，本单无法证明**：从仓库证据看有两处反向线索——① `docs/数据库变更清单.md:177` 写"125 在 092 之后，存储过程可用"（**该前提不成立**：092 末尾已 DROP，且 MIG-4 后 CALL 被闸门挡），② 该文件把 120a 记为"✅ 已执行"（**其 8 条 CALL 传的是无 `t_` 前缀的表名，恒 `ER_NO_SUCH_TABLE`**）。建议随下次部署窗口做一次**只读**核对（不需要我碰生产）：
   ```sql
   SELECT TABLE_NAME, COUNT(*) c FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE()
      AND ((TABLE_NAME='t_member' AND COLUMN_NAME='contact')
        OR (TABLE_NAME='t_sale_bill' AND COLUMN_NAME IN ('salesman_id','salesman_name','auditor_id','auditor_name','operator_name'))
        OR (TABLE_NAME='t_sale_bill_item' AND COLUMN_NAME IN ('unit','barcode','sku_spec','item_remark','item_discount','trace_codes'))
        OR (TABLE_NAME LIKE 't_approval_%' AND COLUMN_NAME='tenant_id')
        OR (TABLE_NAME IN ('t_retail_cart','t_miniapp_order_sync_log') AND COLUMN_NAME='tenant_id'))
    GROUP BY TABLE_NAME;   -- 缺行/计数不足即证实生产同源缺失
   ```
2. **092 里的两个 `CREATE PROCEDURE` 块与其末尾 `DROP PROCEDURE` 保留未动**：改写后它们对本仓迁移不再有功能作用（残留仍为 0），但它们是 S3-57（DELIMITER/过程体状态机）的**回归夹具对象**（`migration-delimiter.test.ts` 的 A/A2/B 三组断言挂在 092 真实文本上），删除属扩范围且会让 S3-57 的判据失去对象。
3. **无 `t_` 前缀的 24 条 CALL（如 `'sys_config'`、`'sale_bill_item'`）语义按原样保留**（改写后仍 `ER_NO_SUCH_TABLE` 跳过）：这批表实际列名带 `t_`，它们**从来没生效过**——`docs/数据库变更清单.md` 只修了 `alert_record → t_alert_record` 一处。属**另一个独立缺陷**（表名缺前缀），本单不顺手改（红线 3：只改有问题的地方，且改前缀会改变语料语义）；建议另立一单，并连带修 `docs/数据库变更清单.md` 里 120a 的"✅ 已执行"记录（该文件凌舟维护，本单红线禁止改）。
4. **"第 2 次才收敛"的既有性质未动**：Step 2 的 `idx_t_<表>_tenant` 与 `120c_performance_indexes.sql` 的 5 个索引，在空库首跑时因目标表/列尚未建出而跳过、第二次跑才建（合计 15 个索引，`diff-runC-vs-runC2.txt`）。这不属本单（与 173 条 CALL 无关），登记为观察项。
5. **`t_delivery_record.rider_id` 的列序**：基线 B（事后重放）落在表尾、修复后落在 `#7`，属"就地 vs 事后重放"的差异，非缺陷（见 §四）；若凌舟要求列序与某个特定历史库逐位一致，需要一份生产 `SHOW CREATE TABLE t_delivery_record` 做终裁。
