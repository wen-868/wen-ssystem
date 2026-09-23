# MIG-1 证据包：迁移 runner 丢块缺陷的逐条预期清单 + 副本演练脚本

> 对应派单：`docs/tasks/cards/R101-派单-20260923-MIG.md`（【派单 MIG-1·P0】，执行方：苏然（测试/QA · 本地通道代执行））
> 汇报对象：凌舟（总负责人）｜汇报人：苏然（测试/QA · 本地通道代执行）｜2026-09-23
> 回传卡：`docs/tasks/cards/R101-MIG-1-苏然回传.md`｜发现来源：`docs/tasks/cards/R101-C2-4-苏然回传.md` §六.1
> 本单**只产出分析与脚本**：未改 `backend/src/**`、未改任何 `docs/migrations/*.sql`、未在真库执行任何写操作、未提交/推送/开 PR。

---

## 一、复演对象（缺陷本体，不重新论证根因）

`backend/src/shared/migration.ts:894-931`（外部迁移段）的语句切分：

```js
const cleaned = sql.split("\n").filter(line => !USE && !DELIMITER).join("\n");
const statements = cleaned.split(";").map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"));   // ← 以注释开头的整块语句被整体丢弃
```

因为"先按 `;` 切块、再丢弃以 `--` 开头的块"，所以**任何"第一行是注释、真语句在后"的块整体不执行**。
同文件下方还对含 `CREATE PROCEDURE`/`DROP PROCEDURE` 的块、含 `DROP TABLE` 的块显式 `continue` 跳过（这两条在修复后依然存在，本清单单独点名）。

---

## 二、两个口径（都必须看，不许互相掩盖）

| 口径 | "丢弃块里的真实内容"定义 | 计入条件 | 用途 |
|---|---|---|---|
| **A** | 只剥掉以 `--` 开头的行 | 块内需含 `CREATE TABLE / ALTER TABLE / INSERT INTO / UPDATE / DELETE FROM` 字样 | **复现 C2-4 与派单里给的数字**（118 / 239 / 50 / 58） |
| **B** | 剥掉 `--`、`#`、块注释（含星号续行） | 剥完只要还有内容就计入 | **本单正式清单口径**（逐条、可分类、可判风险） |

结果对比（`tools/mig1-extract.mjs` 一次跑出，见 `outputs/01-extract.txt`）：

| 口径 | 受影响文件 | CREATE | ALTER | 其它 | 合计 |
|---|---:|---:|---:|---:|---:|
| A（复现 C2-4） | **118** | **239** | **50** | **58** | 347 |
| B（本单清单） | **128** | 241 | **50** | 166 | **457** |

**差异必须解释，不许硬凑**（`expected.json` 的 `diff` 字段机器生成）：

1. **B 比 A 多 10 个文件**：`001_phase1_schema.sql`（`CREATE DATABASE`）、`003_phase2_schema.sql`（`SET FOREIGN_KEY_CHECKS` + `DROP`）、`007_phase5_schema.sql`（`SET` + `DROP` + `INSERT IGNORE`）、`099_seed_data.sql`（`SET NAMES` + 17 条 `INSERT IGNORE`）、`101_tobacco_category_online_sale.sql`（`INSERT IGNORE`）、`120a_合规凭证字段.sql` / `137_sys_user_dept_position.sql` / `138_approval_business_link.sql`（`CALL`）、`123_member_contact.sql` / `125_instant_retail_admin_fix.sql`（`CALL` + 诊断 `SELECT`）。这 10 个文件的被丢块全是 A 口径四个关键字正则覆盖不到的写法（`INSERT IGNORE INTO` / `SET` / `DROP` / `CALL` / `SELECT` / `CREATE DATABASE`）。
2. **CREATE 241 vs 239（+2）**：多出的 2 条不是建表，而是 `001_phase1_schema.sql:7 CREATE DATABASE IF NOT EXISTS ...` 与 `093_库存增加租户ID.sql:8 CREATE INDEX idx_tenant_ib ON inventory_balance(tenant_id)`（A 口径只匹配 `CREATE TABLE`）。
3. **其它 166 vs 58（+108）**：A 的"其它 58"恰好等于 `INSERT INTO` 53 + `UPDATE` 5；B 多出的 108 条 = **83 条 A 关键字完全覆盖不到的形状**（`CALL` 29 + `SET/动态DDL` 17 + `DROP` 22 + 诊断 `SELECT` 15）+ **25 条 `INSERT IGNORE`**（A 的正则 `^INSERT\s+INTO` 匹配不到 `INSERT IGNORE INTO`）。
5. **逐条差额合计 110 条**：25（`INSERT IGNORE`）+ 1（`CREATE DATABASE`）+ 1（`CREATE INDEX`）+ 29（`CALL`）+ 17（`SET`）+ 22（`DROP`）+ 15（`SELECT`）= 110，正是 A 口径（347）与 B 口径（457）之差。
4. **`ALTER` 50 = 50 完全一致**——派单点名的"50 条 ALTER 会真改结构"在两种口径下数字相同，可直接采信。

> 结论：**派单给的 118 / 239 / 50 / 58 成立，但属于"漏报口径"**。用它圈定演练范围会漏掉 10 个文件、110 条语句（含 29 条会报错的 `CALL`）。建议以口径 B（457 条）作为演练与人工确认的工作口径，同时把口径 A 的数字作为"与历史结论对齐"的引用。

---

## 三、风险分级规则（L1~L4，判定顺序 L4 → L3 → L2 → L1）

| 等级 | 含义 | 判定规则 |
|---|---|---|
| **L4** | 其它高风险（破坏性/不可逆） | `DROP ...` / `TRUNCATE` / `RENAME TABLE` / `ALTER TABLE ... DROP COLUMN|INDEX` / **无 WHERE 的 UPDATE·DELETE** / `GRANT`·`REVOKE` |
| **L3** | 会改数据 | `INSERT` / `REPLACE` / `UPDATE` / `DELETE`（带幂等保护的会额外标注） |
| **L2** | 会改结构（无幂等保护，重复执行报错） | `ALTER TABLE ...` / 无 `IF NOT EXISTS` 的 `CREATE TABLE`、`CREATE INDEX` / `CREATE VIEW|DATABASE` / 无法归类者（保守） |
| **L1** | 幂等可重复 / 无害 | `CREATE TABLE IF NOT EXISTS`、`INSERT IGNORE`、`ON DUPLICATE KEY UPDATE`、`WHERE NOT EXISTS`、`information_schema` 前置判空、`SET`/`SELECT` 等会话语句 |

条数：**L1 260 / L2 92 / L3 83 / L4 22**；`是否需要人工确认` = 非 L1 一律"是"（共 **197** 条）。
`L2` 涉及 **44** 张表、`L3` 涉及 **39** 张表；`L3` 中幂等（`INSERT IGNORE` 等）**39** 条、非幂等 **44** 条。

汇总见 `风险汇总.md`（L3/L4 逐条点名、L2 目标表清单、runner 仍跳过的语句），机器可读版见 `expected.json`。

---

## 四、交付物

| 交付物 | 路径 | 说明 |
|---|---|---|
| 逐条清单（人读） | `docs/evidence/MIG-1/预期清单.md` | 128 文件 × 457 条，逐条 `文件:行 / 类型 / 目标表 / 风险 / 人工 / 语句摘要` |
| 逐条清单（机器读） | `docs/evidence/MIG-1/expected.json` | 同内容 + 口径 A/B 计数 + 口径差异 + 风险原因 + 幂等判据 |
| 风险汇总 | `docs/evidence/MIG-1/风险汇总.md` | 按 L1/L2/L3/L4 计数 + L3/L4 逐条点名 + runner 仍跳过项 |
| 副本演练脚本 | `docs/evidence/MIG-1/tools/mig1-rehearsal.mjs` | `plan` / `sqlite-dryrun` / `apply` / `selftest` 四模式 |
| 清单生成器 | `docs/evidence/MIG-1/tools/mig1-extract.mjs` | 复演 runner 规则 + 内置反测（会红） |
| 交叉复算（独立实现） | `docs/evidence/MIG-1/tools/mig1-crosscheck.ps1` | PowerShell/.NET 重写一遍，独立得出 118/239/50/58 |
| 反测（抽 3 条） | `docs/evidence/MIG-1/反测-3条.md` | 每条给出 Before/After 只读 SQL + 副本库执行命令 |
| 原始输出 | `docs/evidence/MIG-1/outputs/` | 每个工具 stdout 落盘 + json 明细 |

---

## 五、复跑命令（全部在仓库根执行）

```powershell
# 0）前置：确认起点（本单不动任何产品代码）
git rev-parse HEAD; git status --porcelain

# 1）生成逐条清单 + 风险汇总（会先跑内置反测）
node docs/evidence/MIG-1/tools/mig1-extract.mjs --rev (git rev-parse HEAD)
#   预期末行：RESULT: ALL PASS / EXIT=0
#   预期关键行：口径A 受影响文件 118 个；CREATE TABLE 239 / ALTER TABLE 50 / 其它 58
#             口径B 受影响文件 128 个；逐条合计 457 条

# 2）交叉复算（PowerShell 独立实现，同一口径 A）
pwsh -File docs/evidence/MIG-1/tools/mig1-crosscheck.ps1
#   预期：实得：文件 118 / CREATE 239 / ALTER 50 / 其它 58 ⇒ 一致 ✅

# 3）演练计划（无需真库）
node docs/evidence/MIG-1/tools/mig1-rehearsal.mjs --mode plan
#   预期：修复前被吞掉、修复后新增执行 457 条；与 expected.json 对照 0 漏 0 多 ⇒ 一致 ✅

# 4）无真库自证（node:sqlite 内存库承载挑选结果 + SQL 聚合核对）
node docs/evidence/MIG-1/tools/mig1-rehearsal.mjs --mode sqlite-dryrun
#   预期：落库 1082 条（新增执行 457 条）；按类型与 expected.json 一致=true ⇒ 一致 ✅

# 5）反测（证明挑选与断言引擎会红）
node docs/evidence/MIG-1/tools/mig1-rehearsal.mjs --mode selftest
#   预期：F1~F5 全 ✓ ⇒ RESULT: ALL PASS

# 6）反测：抽 3 条生成副本库验证命令
node docs/evidence/MIG-1/tools/mig1-probe3.mjs
#   预期：生成 docs/evidence/MIG-1/反测-3条.md
```

**真库副本演练（需凌舟提供副本库与结构快照；本单未执行）**

```powershell
# 结构快照（凌舟侧，对生产只读）：
#   mysqldump --no-data --single-transaction --routines=false -h <生产> -u <只读用户> <库> > 副本结构快照.sql
node docs/evidence/MIG-1/tools/mig1-rehearsal.mjs --mode apply `
  --host <副本库IP> --port 3306 --user <用户> --password <口令> `
  --database liquor_inventory_rehearsal --dump <副本结构快照.sql> `
  --allow-write [--file 006_phase4_schema.sql]
#  产出：outputs/04-apply-compare.{txt,json} —— 每条语句 成功 / 报错(code+msg) / runner 跳过，
#        以及演练前后 information_schema 的结构差（新增表数、新增列数）。
#  没有 --allow-write 时脚本拒绝执行（exit 3），防止误打到副本以外的库。
```

---

## 六、反测（"故意制造失败证明它会红"）

| 编号 | 改坏什么 | 期望 | 证据 |
|---|---|---|---|
| R1 | 合成"注释在前 + CREATE TABLE" | 判为"建表语句被丢" | 内置反测①；`selftest` F1 |
| R2 | 合成"注释在前 + INSERT" | 判为"数据语句被丢" | 内置反测② |
| R3 | 合成"语句在前 + 注释在后"（正确写法） | **不得**误判为丢语句 | 内置反测③；`selftest` F2；`crosscheck` 对照项 |
| R4 | 合成"纯注释块" | 不得进清单 | 内置反测④；`selftest` F4 |
| R5 | 合成"CREATE PROCEDURE 块"/"DROP TABLE 块" | 计入"runner 跳过"，**不**计入"会执行" | 内置反测⑤；`selftest` F3 |
| R6 | 断言引擎自证：故意写错预期 | 断言必须判红 | `selftest` S1 |
| R7 | 工具漂移自证：清单 vs 演练计划 | 必须逐条相等（128 文件 / 457 条） | `selftest` F5 |
| R8 | 第二套独立实现（PowerShell） | 必须同样得出 118/239/50/58 | `outputs/06-crosscheck.txt` |

---

## 七、局限与诚实缺口（无真库能验的，一律不冒充结论）

1. **语义未验证**：本单全部结论都是**切分语义级**的（"这条语句不会被 runner 送到 `conn.query`"），**不是**"生产库里缺哪张表/哪个列"。表是否已由 `init_database.sql` 或更早的迁移建出，必须到副本库核对。
2. **副本库演练未执行**：本沙箱没有 MySQL 服务、没有 `mysql` 客户端、没有可用连接；`apply` 模式只做了静态自检（无 `--allow-write` 时必须拒绝，已实跑验证）。
3. **sqlite 自证不覆盖 MySQL 语义**：`node:sqlite` 只用来承载"挑选结果"并做 SQL 聚合核对；MySQL 专有语法（`COMMENT` / `ENGINE=` / `ALTER ADD COLUMN`）在 sqlite 上必然报错，这是"语义必须到真 MySQL 验"的证据，不是失败。
4. **`CREATE PROCEDURE` 永远建不出来**：runner 对含 `CREATE PROCEDURE` 的块一律 `continue`，且预处理删掉了 `DELIMITER` 行。因此 `092_租户ID.sql` 里定义的两个存储过程（`add_column_if_not_exists` / `add_index_if_not_exists`）**修复前后都不会被 runner 创建**；而依赖它们的 **29 条 `CALL`**（28 条 `add_column_if_not_exists` + 1 条 `add_index_if_not_exists`，分布在 6 个文件：092 / 120a / 123 / 125 / 137 / 138）修复后会首次执行 ⇒ 若生产库里没有这两个过程（092 是 2026-06-27 执行的，若当年走的是 `mysql` 客户端则可能已存在），这 29 条会以 `ERROR 1305 PROCEDURE ... does not exist` 报错。**必须在副本演练里先验这一条。**
5. **`DROP TABLE` 保护仍在**：被丢块里 20 条 `DROP TABLE IF EXISTS ...` 修复后进入执行路径，但被 runner 的 R95-03 保护再次跳过（`风险汇总.md` §四 逐条点名），不构成数据风险；但它们说明 003~007 这批文件原本"删表重建"的设计在 runner 路径上从未生效过。
6. **快照口径未定**：`--dump` 由凌舟提供（当前为占位参数）。若用 `--no-data` 快照，只能验结构类语句；要验 83 条 L3 数据语句，还需提供数据行数基线（`information_schema.tables.table_rows` 或逐表 `COUNT(*)`）。
7. **`add_tenant_id.sql` 被 runner 排除**，本单同样排除（与 runner 一致），未纳入统计。
8. **清单里的"目标表"是 addTablePrefix 之后的名字**；若某条语句的表名本来带 `t_`，前缀复演不会重复添加（与 `migration.ts:98` 一致）。

---

## 八、给凌舟的裁定请求（我不越权裁定）

1. **演练工作口径**：是否以口径 B（128 文件 / 457 条）作为 MIG-1 的正式演练范围（口径 A 仅作"与历史结论对齐"的引用）？
2. **`CALL` 29 条怎么办**：① 演练时先手工建两个存储过程再跑；② 把 092 的两个过程改成 runner 能执行的形状；③ 改用 `information_schema` + `PREPARE` 的无过程写法。三条路都要改产品代码/迁移文件，**超出本单红线**，需另派单。
3. **副本库与快照**：请给出副本库连接方式与 `mysqldump` 快照路径；是否允许在副本库上执行 `--mode apply`（本单未执行任何写操作）。
4. **L3 数据类 83 条的确认方式**：逐条人工确认，还是按 39 张目标表分批确认？
5. **门禁/PR 顺序**：本证据包是否作为"合并 PR #13 前的演练清单"？是否要再立一张"把修复后 runner 打进副本库跑全量迁移"的正式演练卡（R8.2 要求验证类派单给 ref：分支名 + 提交哈希）？
