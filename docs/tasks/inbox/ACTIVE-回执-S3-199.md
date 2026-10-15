# S3-199 回执 · 第 64 项（`t_tenant_admin` 无外键保护）＋ 第 66 项（零售 `ON DELETE CASCADE` 审计风险）

- **汇报对象**：凌舟（总负责人）
- **汇报人**：阿坚（后端/迁移）｜执行体 `/root/s3202_ajian`
- **日期**：2026-10-14
- **对应派单编号**：**S3-199**（派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-199-20261014.md`）
- **工作区**：`D:\Users\ZXQL\wt-agents\S3-199`｜分支 `fix/s3-199-constraints-integrity`｜基线 `origin/main` = `fc6651a5`
- **分支提交**：`744df219`（**未 push、未开 PR**，遵红线）
- **证据包**：`docs/evidence/S3-199/`（装置 + `raw/` 原始读数）；MySQL 8.0.46 实例与全量日志在仓外 `D:\Users\ZXQL\wt-agents\_s3199-evidence`

---

## 一、结论先行

1. **第 64 项定性 = (b)「有意不设物理外键」，不是漏配** ⇒ **不补外键**。依据是**凌舟本人 2026-10-06 的既定裁定**（`docs/tasks/cards/R101-S3-158-凌舟验收.md` 裁定 2）：`t_tenant_admin` 取 `VARCHAR(36)`、**不建物理外键**（理由：生产存量即"无外键"形状、避免第三份口径、本仓多处刻意不用物理外键）。`169:1` 的 `DROP` 是"清掉指向不存在表的坏外键 + 改列类型的必要前置"，`192:35/110` 复述并落地同一口径。
2. **但顺带查出一条真缺陷并已修**：`169` 的 `DROP FOREIGN KEY` **无守卫** ⇒ 该表上没有此外键时（生产自 2026-09-08 起就是这形态、以及任何库的**第二遍起**）**每次启动恒报一条 `失败`（1091）**，属踩坑 [78] 型"恒红掩蔽真错误"。已改为 `information_schema` 守卫 + `PREPARE/EXECUTE`（先例 081/194/196），**结果态与语义不变**，恒红消失；反测两侧齐。
3. **第 66 项定性 = 保留现状 `ON DELETE CASCADE`**（全仓无物理删除路径，级联今日不触发）＋ **表旁注释留痕**（将来引入零售订单物理删除前，必须先改 `RESTRICT` 或整体改软删）。**未改任何约束形态**——改 `RESTRICT` 属你既定的"届时再做"，本单不越位。

---

## 二、第 64 项：定性证据链（(b) 有意不设）

| # | 证据（文件:行） | 内容 | 指向 |
|:--:|:--|:--|:--|
| 1 | `docs/migrations/169_tenant_admin_uuid.sql:1`（原文） | `ALTER TABLE t_tenant_admin DROP FOREIGN KEY t_tenant_admin_ibfk_1` —— 注释写明"原外键指向**不存在的表**"；不先 DROP 就无法 `MODIFY tenant_id`（列上挂外键时不能改型） | DROP 是**必要前置**，非"取消保护" |
| 2 | `docs/migrations/192_租户建租户与归因落点补列.sql:35` / `:110` | 表注释 `租户管理员表（S3-144：对齐 t_tenant.id UUID，不建物理外键）`；正文"本迁移按 **169 的最终口径**（tenant_id VARCHAR(36) / user_id BIGINT UNSIGNED / **不建物理外键**）补建该表" | 补建时**显式**选择不建外键 |
| 3 | `docs/tasks/cards/R101-S3-158-凌舟验收.md` §二 裁定 2（2026-10-06） | "**与 192 的既有最终口径一致**：`VARCHAR(36)`，**不建物理外键**。理由：① 生产存量就是'无外键'形状，与生产一致优先；② 避免出现第三份口径；③ 本仓多处已刻意不用物理外键（分库/迁移负担）" | **口径已由总负责人定死** |
| 4 | 仓内同族口径 | `190/191/195` 等 10+ 条迁移、`docs/数据库变更清单.md` 多条登记均为"逻辑引用 + 不建物理外键"（R101-C6 系列硬约束） | 非本表孤例，是仓内一贯做法 |
| 5 | 卡面所指 `080_平台管理员.sql` / `081_platform_admin_seed_and_fix.sql` | 逐行检索 **0 处**涉及 `t_tenant_admin`（`rg` 命中 0） | 卡面该处线索**不存在**，已如实报告 |

**为什么不是 (a) 漏配**（反证，三条）：

1. 若判"漏配并补外键"，等于**推翻你在 S3-158 的裁定 2**，并制造**第三份口径**（016/034 声明 → 169 DROP → 新增迁移再 ADD）。
2. 你在 S3-158 裁定 3 已明确"**不需要**把代码声明对齐到生产存量表；若日后确需 ⇒ **另立 ALTER 单**" ⇒ 现在替生产加一个既无业务需求、又要改生产既有形状的约束，与该裁定方向相反。
3. `016/034` 的那条 FK 声明本身**正是第 63 项（errno 3780）的成因之一**（修好类型后它才被 MySQL 8 接受，随即又被 169 按既有口径删掉）；它属"历史残留声明"，不是"未兑现的意图"。

**类型/数据核对（回答卡面 (a)/(c) 的两个前置问题）**：

| 核对项 | 读数 | 出处 |
|:--|:--|:--|
| `t_tenant_admin.tenant_id` 类型 | `varchar(36)`（与 `t_tenant.id VARCHAR(36)` **已对齐**） | `raw/checker-output.txt` 64-② |
| `t_tenant_admin.user_id` 类型 | `bigint unsigned` | 同上 64-③ |
| 孤儿行（`tenant_id` 无父租户） | **0** 行（全新库；生产存量未取） | 同上 64-⑤ |
| 该表外键条数 | **0** 条（终态 15 条外键中，指向 `t_tenant` 的只有 `t_subscription`、`t_tenant_module_access`） | `raw/snapshots.txt`、`raw/checker-output.txt` 64-①/64-④ |

⇒ 结论：**类型已对齐、数据无脏**，因此"能不能补"不是矛盾点；**矛盾点是"该不该补"，而该问题已有裁定答案：不补。**

---

## 三、第 64 项附带缺陷（**已修**）：`169` 的 `DROP` 无守卫 ⇒ 第二遍起恒红

### 3.1 现象与影响面（可复跑）

同库第二遍跑启动期迁移（`run-again.ps1`，不重建库）原始日志：

```
{"level":50,…,"msg":"[migration] 169_tenant_admin_uuid.sql 失败: Can't DROP 't_tenant_admin_ibfk_1'; check that column/key exists"}
{"level":50,…,"msg":"[migration] 069_商品SPU增加品牌ID.sql 失败: Duplicate foreign key constraint name 'fk_product_spu_brand'"}
```

- **命中面**：`169` 在"表上无该外键"时必报 1091（`SKIP_ERRORS`/`SKIP_PATTERNS` 均未覆盖 1091 与英文提示）⇒ **生产自 2026-09-08 起本表就没有该外键 ⇒ 每次重启恒报一条 `失败`**；新库第一遍不报（016 刚建出 FK），**第二遍起开始恒报**。
- **危害**：恒红会掩蔽真错误（同第 56 项、踩坑 [78]）；且 169 原注释写"DROP FOREIGN KEY 重复执行报 1091 **由 safeExec 记录跳过**"——**与实测不符**（记的是 `失败`，不是跳过），本单已把该注释一并订正。
- **同类未修**：`069_商品SPU增加品牌ID.sql` 第二遍恒红 1 条（**范围外，本单未改**，见 §六.1）。

### 3.2 改法（结果态与语义均不变）

`169` 首条语句由 1 条无守卫 DROP 改为 5 条守卫语句（`information_schema.REFERENTIAL_CONSTRAINTS` 计数 → `IF(...)` 拼 DDL → `PREPARE/EXECUTE/DEALLOCATE`，先例 081/194/196）；两条 `MODIFY` 之后追加 1 条跑后核对 `SELECT`；文件尾追加**修订记录**（S3-158 裁定 1 条件②）与「为什么只 DROP、不重建」补记。**无新增/删除任何约束**，未改任何业务代码。

**结果态零差异证明**：改动前后同库快照 `tables.tsv / columns.tsv / fks.tsv / show-create-6tables.txt` sha256 **逐一相同**（`raw/snapshots.txt`）。

### 3.3 判据五段（原始日志 `raw/criterion-169.txt`）

| 段 | 场景 | `169 … 失败` 命中数 |
|:--:|:--|:--:|
| A | 改动前语料 · 全新库第一遍（标签 `01-fresh-post-change`） | **0** |
| B | 改动前语料 · 同库第二遍（标签 `02-idempotent-rerun`） | **1**（1091 原文） |
| C | 改动后语料 · 同库第二遍（标签 `14-rerun-newdb`） | **0** |
| D | 反测：把守卫换回无守卫 DROP（`rt-169.mjs break`，标签 `11-antitest169-red`）· 同库再跑 | **1** |
| E | 逐字节复原（sha256 断言，标签 `12-antitest169-green`）· 再跑 | **0** |

### 3.4 两路验证（S3-158 裁定 1 条件④）

- **全新库**：`13-fresh-newdb`（库 `s3199_f1`，先建空库再跑）⇒ `失败命中数 = 0`、`health200 = True`（`raw/runA-fresh.txt`）。
- **存量副本 / 同库第二遍**：`14-rerun-newdb`（同一库复跑）⇒ `失败命中数 = 1`（**只剩 069**）、169 专项目标 **0 条**（`raw/runB-rerun.txt` + `raw/criterion-169.txt`）。

---

## 四、第 66 项：定性（保留 CASCADE）＋ 落地（注释留痕）

**结构性证据（真库读数）**：指向 `t_retail_order.id` 的外键恰 2 条，`DELETE_RULE` 均为 `CASCADE`（`t_delivery_record_ibfk_1`、`fk_retail_order_item_order`）；`t_retail_order` 具备软删三列（`order_status` / `cancel_reason` / `cancelled_at`）——`raw/checker-output.txt` 66-① / 66-②。

**代码证据**：全仓检索 `DELETE FROM t_retail_order` / `DELETE FROM t_delivery_record` ⇒ **0 命中**（与你的亲验一致）；订单作废走 `order_status='CANCELLED'` 软删（`017:122-124` 定义）。

**定性结论 = 保留 CASCADE**：当前级联**不会触发** ⇒ 无需现在改；**改 `RESTRICT` 会改 DB 侧删除语义**，且你已在收口总清单第 66 项写明"将来引入物理删除**须**改 `RESTRICT`/软删，并在表旁注释留痕"⇒ 本单只做**留痕**，不做语义变更。

**落地**：`017` 两处（`t_retail_order_item`、`t_delivery_record` 的 CREATE TABLE 之后）各加 4~5 行注释：写明"当前无物理删除路径、软删口径、**引入物理删除前必须先改 RESTRICT 或改软删**，否则静默删除明细/配送审计记录"。`git diff` = **+11 行，纯注释**。

**判据装置反测**（证明判据有分辨力）：`rt-66.mjs` 把两条 `CASCADE` 改 `RESTRICT` ⇒ 全新库跑一遍 ⇒ `check-constraints.mjs` **FAIL 1 项 / exit 1**（点名 66-①，实际 `RESTRICT`）；逐字节复原后 ⇒ **7/7 PASS / exit 0**（`raw/antitest-66.txt`、`raw/antitest66-red-checker.txt`、`raw/antitest66-green-checker.txt`）。

---

## 五、卡面验收判据逐条对照

| 卡面判据 | 结果 |
|:--|:--|
| §三.1 两段定性各给证据链（文件:行 + MySQL 8 `information_schema` 原文） | ✅ §二 / §四；原始读数 `raw/checker-output.txt`、`raw/snapshots.txt` |
| §三.2 "**新迁移**在 MySQL 8 空库上：失败 0 / 幂等（第二遍零变更）/ 目标约束形态与预期一致（SHOW CREATE TABLE）" | ⚠️ **据实报备为"部分不适用"**，见下 |
| §三.3 门禁：`npx vitest run` 0 failed、`npx tsc --noEmit` 0、三条 guard EXIT=0、`npm --workspace backend run build` EXIT=0 | ✅ **654 文件 / 7718 用例 / 0 failed**、tsc EXIT=0（0 字节输出）、G3/G2/G36 EXIT=0、build EXIT=0（`raw/gates.txt`） |
| §四 反测（改坏 ⇒ 红 ⇒ 复原 ⇒ 绿） | ✅ 两处：`169` 恒红五段判据（§3.3）；`check-constraints.mjs` 的 CASCADE↔RESTRICT 反测（§四） |

**关于 §三.2 的"新迁移"**：本单定性为 (b) 有意不设 + 保留 CASCADE ⇒ **没有任何"无条件支撑的 DDL 变更"可做**（补外键＝推翻 S3-158 裁定 2；改 RESTRICT＝越位改语义）。因此本单未新增迁移文件，改以**等价判据**收口：

1. 语料层面：改动仅在 **2 个文件的注释/守卫**，无新约束；
2. 空库复跑：全新 MySQL 8.0.46 空库（库 `s3199_f1`，标签 `13-fresh-newdb`）`失败=0`、`health200=True`（`raw/runA-fresh.txt`）；
3. 约束形态核对：`SHOW CREATE TABLE` 6 表快照 sha256 **零差异**；`REFERENTIAL_CONSTRAINTS` 逐条核对（`raw/checker-output.txt`）；
4. 反测两侧齐（见上）。

另：卡面若确需一份"新迁移"，我给的**备选方案**是"把 `169` 的 DROP 撤掉、由新迁移补回外键"——**但那正是 §二 证明应当不做的事**，故未执行。若你改判为 (a) 应补外键，请回一句"改判 (a)"，我可按 194 的守卫写法出 `200_…sql` 并附两路验证（**前提**：同时接受"推翻 S3-158 裁定 2 / 出现第三份口径"）。

---

## 六、范围外发现（**未改**，登记待裁定）

1. **`069_商品SPU增加品牌ID.sql` 第二遍恒红 1 条**：`Duplicate foreign key constraint name 'fk_product_spu_brand'`（`ALTER TABLE t_product_spu ADD CONSTRAINT …` 无守卫）。**生产每次重启同样会报**，与 §三 同族（非幂等 DDL 恒红），但**不在第 64/66 项范围内**，本单按"只改有问题的地方 + 不越界"未动。建议并入第 60/65 项；若你要本单一并收口，我可立即按 169 同款守卫落地（半行级改动，零语义变化）。
2. **第 60 项素材补充（第二遍结构 +18 索引行）**：同库第二遍相对第一遍多出 18 行索引 / 13 个索引（`idx_sale_bill_tenant_status`、`idx_t_brand_tenant`、`idx_coupon_template_type` 等）；根因＝`120c_performance_indexes.sql` **先于**其索引列的补列迁移执行 ⇒ 第一遍报 `ER_KEY_COLUMN_DOES_NOT_EXITS`、第二遍列已在才建成功。第 3/4 遍读数稳定在 1640（**收敛**，非无限增长）。全部明细见 `raw/snapshots.txt`。属"语料顺序/残留"族（第 60 项），本单未动。
3. **`016:163` / `034:15` 的 FK 声明已成"死声明"**：在 MySQL 8 上它会被 016 建成、随后被 169 按口径删掉（"建了又删"），既是历史噪声、也是第 63 项 errno 3780 的成因之一。本单**未改这两个文件**（避免与第 65 项的"类型/形状漂移收口"抢同一批文件），建议并入第 65 项决定其去留。
4. **`192:35` 的表注释在全新库上不生效**：全新库由 `016` 先建表 ⇒ 表注释是 `租户管理员表`（S3-194 §六 C1 的 D 类差异），192 的"不建物理外键"注释文本只落在"由 192 建表"的库上。本单**未做** ALTER 对齐（S3-158 裁定 3 明确"不需要对齐生产存量表，日后确需另立 ALTER 单"）——仅登记。

---

## 七、未完成与阻塞

1. **"新迁移"未交付**——不是遗漏，是定性结果（(b) + 保留 CASCADE）下的**主动选择**，理由与备选方案见 §五。若你判定卡面必须"有一份新迁移文件"，请回"改判 (a)"或指定等效交付物。
2. **生产侧读数未取**（不得连生产）：`t_tenant_admin` 存量 1 行是否孤儿、生产表注释真值，均**未验证**；本单结论不依赖它们（定性依据是裁定文本）。
3. **未动 `docs/数据库变更清单.md` / `R101-收口总清单.md`**（红线）⇒ 169 的这次"已执行迁移修订"仍需你按 S3-158 裁定 1 条件③**登记入册**。
4. **未动 `ACTIVE.md` 路由表**：该表是 5 张并行卡的公共路由，只把**本单卡**移入 `archive/ACTIVE-S3-199-20261014.md`；`ACTIVE.md` 里 S3-199 那行请由你更新状态。

---

## 八、风险与自我报备

1. **改动了"已执行的迁移文件" `169`**（`+35 −1`）：依 S3-158 裁定 1 的豁免与四条件执行——① 只改**声明/语句形态**（无守卫 DROP → 守卫式 DROP），**结果态、语义、列定义均不变**（快照 sha256 零差异为证）；② 已加修订记录注释；③ 登记待你落笔；④ 两路验证已给（全新库 + 同库第二遍）。
2. **本单最重要的判断是"不做"（不补外键）**：如你认为 S3-158 的裁定 2 已被 S3-194 的新事实（类型已对齐 ⇒ 外键现在真能建成）推翻，请明确回"改判 (a) 补外键"，我再出迁移；**在此之前我按既有裁定执行，不擅自改口径**。
3. **反测的"红"针对的是判据装置，不是新约束**：本单无新约束，故反测证明的是"我的判据会红"（§3.3 D 段、§四），符合"门禁必须能红"的要求；若你认为这不满足第 64/66 项的反测要求，请指明要反测的对象。
4. **环境**：全部读数来自**本机临时 MySQL 8.0.46（端口 3408，`--no-defaults`，服务器默认 utf8mb4/0900_ai_ci）**；生产库零写操作。跑读期间该临时实例曾被其他会话清理一次，已重启后重跑（`01-fresh-post-change` 那次作废，正式读数用 `03` 起的标签）。
5. **装置使用自我报备**：标签 `09-fresh-final` 的**结构快照取证时机有误**（在 `10` 号复跑之后才取，读到的是复跑后状态）；已改用 `13-fresh-newdb` / `14-rerun-newdb` 这一对"**跑完立即取**"的读数，正式口径见 `raw/snapshots.txt`。教训：结构快照必须紧跟每次运行取。
6. **输入指纹**（防"跑错工作树"）：`016=BF2F9BDC…`（=S3-194 修复后）、`017=817A49BD…`（本单改后）、`169=E5139F0F…`（本单改后＝最终值）、`192=9F749308…`（未动）、`migration.ts=8167BED3…`（未动）、`dist/server.js=F77389A7…`（与 S3-194 同值）；详见 `docs/evidence/S3-199/README.md` §五。

---

## 九、交付物清单

| 类别 | 路径 |
|:--|:--|
| 代码/迁移 | `wt-agents/S3-199` 分支 `fix/s3-199-constraints-integrity` 提交 `744df219`：`docs/migrations/169_tenant_admin_uuid.sql`（+35 −1）、`docs/migrations/017_phase10_instant_retail.sql`（+11 −0） |
| 证据包 | `docs/evidence/S3-199/`（`README.md` 索引 + `queries.sql` + `check-constraints.mjs` + `run-again.ps1` + `rt-169.mjs` + `rt-66.mjs` + `raw/` 8 份原始读数摘录） |
| 卡归档 | `docs/tasks/inbox/archive/ACTIVE-S3-199-20261014.md` |
| 本回执 | `docs/tasks/inbox/ACTIVE-回执-S3-199.md` |

**复跑命令**见 `docs/evidence/S3-199/README.md` §六（起库 → 全新库第一遍 → 同库第二遍 → 判据装置 → 四段反测）。
