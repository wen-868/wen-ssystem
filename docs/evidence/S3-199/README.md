# S3-199 证据包 · 第 64 项（`t_tenant_admin` 无外键保护）＋ 第 66 项（零售 `ON DELETE CASCADE` 审计风险）

> 工作树：`D:\Users\ZXQL\wt-agents\S3-199`｜分支 `fix/s3-199-constraints-integrity`｜基线 `origin/main` = `fc6651a5`
> 本包**未 commit 到 main / 未 push / 未开 PR**（红线遵守）；分支上已提交本单改动，由凌舟复核后决定合并。
> 回执：`docs/tasks/inbox/ACTIVE-回执-S3-199.md`（主工作树 inbox，凌舟侧）｜卡：`docs/tasks/inbox/archive/ACTIVE-S3-199-20261014.md`

## 一、结论（一句话）

1. **第 64 项定性 = (b) 有意不设物理外键**（非漏配）：依据是**凌舟本人在 `R101-S3-158-凌舟验收.md` 裁定 2（2026-10-06）**——`t_tenant_admin` 取 `VARCHAR(36)`、**不建物理外键**（理由：生产存量即"无外键"形状、避免第三份口径、本仓多处刻意不用物理外键）；`169` 的 `DROP` 是"清坏外键 + 改列类型"的必要前置，`192:35/110` 复述同一口径。⇒ **不补外键**（补＝推翻既有裁定 + 第三份口径）。
2. **第 64 项附带查出一条真缺陷并已修**：`169` 的 `DROP FOREIGN KEY` **无守卫** ⇒ 表上无该外键时（生产自 2026-09-08 起、以及任何库的**第二遍起**）每次启动恒报一条 `失败`（1091）。已改为 `information_schema` 守卫 + `PREPARE/EXECUTE`（先例 081/194/196），**结果态与语义不变**，恒红消失（反测两侧齐）。
3. **第 66 项定性 = 保留现状 `CASCADE`**（今日无物理删除路径，级联不触发）＋ **表旁注释留痕**（将来引入物理删除前必须先改 `RESTRICT`/软删）。未改任何约束形态（改 `RESTRICT` 属凌舟既定顺序"届时再做"）。

## 二、本单改了什么（2 文件 / 纯注释 + 1 处守卫，零业务代码）

| 文件 | 改动 | 说明 |
|:--|:--|:--|
| `docs/migrations/169_tenant_admin_uuid.sql` | +35 行（注释）+ 守卫改写（3 条语句 → 8 条） | ① `DROP FOREIGN KEY` 改 `information_schema` 守卫 + `PREPARE/EXECUTE`（幂等）；② 追加跑后核对 `SELECT`；③ 追加「为什么只 DROP 不重建」补记 + 修订记录（S3-158 裁定 1 条件②） |
| `docs/migrations/017_phase10_instant_retail.sql` | +11 行（注释） | 在 `t_retail_order_item` 与 `t_delivery_record` 两处 `ON DELETE CASCADE` 旁加审计留痕（第 66 项） |

**只改有问题的地方**：`git diff --numstat` = 169 `+35 −0`、017 `+11 −0`；句法层面已核对"删掉注释行后与 HEAD 逐字节一致"（017）/ 169 仅守卫块与原 `DROP` 行等价（结果态一致，已用快照 sha256 证明）。

## 三、判据装置（本目录）

| 文件 | 用途 |
|:--|:--|
| `queries.sql` | 7 条**只读**核对查询（外键/类型/孤儿行/软删列/表注释） |
| `check-constraints.mjs` | 判据装置：真库上断言 7 项期望值，`exit 0`=全对、`exit 1`=会红（反测判据） |
| `run-again.ps1` | 幂等复跑装置：**不重建库**再跑一次启动期迁移（对比前后结构快照） |
| `rt-169.mjs` | 反测：169 守卫 ↔ 无守卫互转（冻结 + sha256 断言复原） |
| `rt-66.mjs` | 反测：两条零售外键 `CASCADE` ↔ `RESTRICT` 互转（冻结 + sha256 断言复原） |
| `raw/` | 原始读数摘录（见下）；`mysql 8.0.46` 实例与全量日志在**仓外** `D:\Users\ZXQL\wt-agents\_s3199-evidence` |

## 四、原始读数（`raw/`）

| 文件 | 关键读数 |
|:--|:--|
| `runA-fresh.txt` | 全新 MySQL 8.0.46 空库第一遍（标签 `13-fresh-newdb`，库 `s3199_f1`）：`失败命中数 = 0`、`health200 = True` |
| `runB-rerun.txt` | 同库第二遍（标签 `14-rerun-newdb`，同库）：`失败命中数 = 1`（仅 069，范围外）；**169 专项 0 条** |
| `criterion-169.txt` | 169 专项判据五段：[A]改动前·第一遍 0 条 / [B]改动前·第二遍 **1 条（1091 原文）** / [C]改动后·第二遍 **0 条** / [D]反测（摘守卫）**1 条** / [E]复原后 **0 条** |
| `snapshots.txt` | 结构快照（**跑后立即取**）：`tables=312 columns=4154 fks=15` 全程不变；`indexes` 第一遍 1622 → 第二遍 1640（+18 行 / 13 个索引，来源 120c，非本单）→ 第 4 遍仍 1640（收敛）；`tables/columns/fks/show-create-6tables` 快照 sha256 **零差异** |
| `checker-output.txt` | 判据装置 7/7 PASS（`exit 0`） |
| `gates.txt` | vitest **654 文件 / 7718 用例 / 0 failed**（EXIT=0）、`tsc --noEmit` EXIT=0（0 字节输出）、三条 guard EXIT=0、`npm --workspace backend run build` EXIT=0 |

## 五、输入指纹（防"跑错工作树"）

| 文件 | sha256(前 16) |
|:--|:--|
| `016_phase9_tenant_subscription.sql` | `BF2F9BDC396E4DC0`（= S3-194 修复后同值） |
| `017_phase10_instant_retail.sql` | `817A49BDAE0C84CD`（本单改后；改前 `6151D754F77593E9`） |
| `169_tenant_admin_uuid.sql` | `E5139F0F89FBD27C`（本单改后＝最终提交值） |
| `192_租户建租户与归因落点补列.sql` | `9F7493083CD25474`（未动） |
| `backend/src/shared/migration.ts` | `8167BED3DA849730`（未动） |
| `backend/dist/server.js` / `dist/shared/migration.js` | `F77389A7F7C30FF9` / `B5161C983607288B`（与 S3-194 同值） |

## 六、复跑命令（照抄可跑，MySQL 8.0.46 在 3408）

```powershell
$b='D:\Users\ZXQL\wt-agents\_s3194-evidence'; $my="$b\mysql8046\mysql-8.0.46-winx64\bin"
$ev='D:\Users\ZXQL\wt-agents\_s3199-evidence'
# 0) 起库（datadir 已初始化）
Start-Process "$my\..\bin\mysqld.exe" -WindowStyle Hidden -ArgumentList "--no-defaults","--basedir=$b\mysql8046\mysql-8.0.46-winx64","--datadir=$b\mysql8046-data","--port=3408","--bind-address=127.0.0.1","--mysqlx=0"
# 1) 全新空库第一遍（判"失败 0"）
powershell -NoProfile -File "$b\harness\run-case.ps1" -Repo 'D:\Users\ZXQL\wt-agents\S3-199' -DbName s3199_main -Port 8099 -Tag 90-replay -MyBin "$my" -DbPort 3408 -Base $ev
# 2) 同库第二遍（判 169 恒红是否消失）
powershell -NoProfile -File 'D:\Users\ZXQL\wt-agents\S3-199\docs\evidence\S3-199\run-again.ps1' -Repo 'D:\Users\ZXQL\wt-agents\S3-199' -DbName s3199_main -Port 8099 -Tag 91-replay -MyBin "$my" -DbPort 3408 -Base $ev
# 3) 判据装置
node 'D:\Users\ZXQL\wt-agents\S3-199\docs\evidence\S3-199\check-constraints.mjs' 3408 s3199_main
# 4) 反测（改坏 ⇒ 红；复原 ⇒ 绿）
node 'D:\Users\ZXQL\wt-agents\S3-199\docs\evidence\S3-199\rt-169.mjs' break   'D:\Users\ZXQL\wt-agents\S3-199' "$ev\rt-frozen"
node 'D:\Users\ZXQL\wt-agents\S3-199\docs\evidence\S3-199\rt-169.mjs' restore 'D:\Users\ZXQL\wt-agents\S3-199' "$ev\rt-frozen"
node 'D:\Users\ZXQL\wt-agents\S3-199\docs\evidence\S3-199\rt-66.mjs'  break   'D:\Users\ZXQL\wt-agents\S3-199' "$ev\rt-frozen"
node 'D:\Users\ZXQL\wt-agents\S3-199\docs\evidence\S3-199\rt-66.mjs'  restore 'D:\Users\ZXQL\wt-agents\S3-199' "$ev\rt-frozen"
```

## 七、局限与自我报备

1. **未连生产**：生产存量形状（`t_tenant_admin` 行数/孤儿行、表注释）**未取**，一律以迁移语料与裁定为准；本单**无**需要生产读数才能定的结论（定性依据是裁定文本，不是生产读数）。
2. **`indexes` 第二遍 +18 行**属**既有缺陷**（`120c_performance_indexes.sql` 在列尚未补出时先跑，第一遍报 `ER_KEY_COLUMN_DOES_NOT_EXITS`、第二遍才建成功），**非本单引入**、也非本单范围；已在回执 §范围外发现 中登记（建议并入第 60/65 项）。
3. **`069_商品SPU增加品牌ID.sql` 第二遍恒红 1 条**（`Duplicate foreign key constraint name 'fk_product_spu_brand'`，同样非本单引入），登记同上；若凌舟要求本单一并收口，可立即按 169 同款守卫落地。
4. **本单不改业务代码、不改 `.github/**`、`deploy/**`、`R101-收口总清单.md`、`docs/数据库变更清单.md`**；生产库零写操作（全部读数都在本机 3408 临时实例）。
5. **装置使用注记（自我报备）**：标签 `09-fresh-final` 的结构快照取证时机有误（在 `10` 号复跑**之后**才取），该快照反映的是复跑后状态、不是第一遍状态；已改用 `13-fresh-newdb` / `14-rerun-newdb` 这一对"**跑完立即取**"的读数，`raw/snapshots.txt` 即最终口径。**教训：结构快照必须紧跟每次运行取，否则会读到后续运行的状态。**
