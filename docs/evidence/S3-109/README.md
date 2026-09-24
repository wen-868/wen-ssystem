# S3-109 证据包：151 的 redeem_ratio 非法默认值（连带打掉 4 列）

> 执行人：阿坚（后端）｜2026-09-25｜对应派单卡 `docs/tasks/cards/R101-派单-20260925-S3-109.md`
> 结论一句话：`DECIMAL(6,4) DEFAULT 100`（上限 99.9999）在真库执行必然 1067 失败，并连带其后 3 条
> `AFTER redeem_ratio/min_redeem_amount/max_redeem_ratio` 的列全部 1054 跳过（共缺 4 列）；改为
> `DECIMAL(10,2)`（默认值仍是 100）后 4 列全部建成、位置与类型正确。

## 一、反测环境（为什么称"等价 MySQL"）

- 本工作区 `3306` 上是**另一个**正在运行的 MariaDB（属凌舟本机环境，**无凭据、未触碰**）。
- 反测用的是**本次临时自建**的私有实例，与任何现有库隔离：
  - `mariadb-install-db.exe --datadir=<TEMP>\s3-109-mdb-*\data --default-user`
  - `mysqld.exe --datadir=... --port=3399 --bind-address=127.0.0.1 --ssl=0 --skip-name-resolve`
  - 版本 `11.4.5-MariaDB`，`sql_mode=IGNORE_SPACE,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION`（严格模式）
- 探针只在**自建临时库** `s3_109_probe_<label>` 上建表/改表，跑完即 `DROP DATABASE`；生产库全程只读、未连接。
- 基线表结构取自仓库唯一 DDL 来源 `docs/migrations/071_客户积分.sql` 的 `t_points_record` / `t_points_rule`
  （与凌舟在生产只读实测的 10 列完全一致：id / rule_name / earn_type / earn_rate / earn_ratio / daily_limit / enabled / tenant_id / created_at / updated_at）。
- 语句切块复刻 `backend/src/shared/migration.ts` 第 8 步外部迁移管线的现行实现（`splitSqlStatements`：整行注释先剥离、
  再按 `;` 切块 → 跳过 `SKIP_ERRORS` 名单，其中含 `ER_BAD_FIELD_ERROR`）。151 共切出 **14 条**语句。

## 二、文件清单

| 文件 | 说明 |
|------|------|
| `probe/151-before.sql` | 修复前快照（`git show HEAD:docs/migrations/151_points_columns_fill.sql` 逐字录入） |
| `probe/s3-109-reverse-test.mjs` | 反测脚本（建临时库 → 跑迁移 → 打印每句结果 → information_schema 列清单 → 复刻服务 INSERT） |
| `probe/out-old-form.txt` | 旧形（`DECIMAL(6,4) DEFAULT 100`）原始输出 |
| `probe/out-new-form.txt` | 新形（`DECIMAL(10,2) DEFAULT 100`）原始输出 |
| `probe/out-decimal-scan.txt` | `rg -n "DECIMAL\(6,4\)"` 影响面扫描（修前 / 修后） |
| `probe/out-assertions-shim.txt` | 真实测试文件 `migration-points-columns.test.ts` 等价复跑：6/6 通过 |
| `probe/out-assertion-reverse-red.txt` | 断言反测：把断言对象换成修复前快照 ⇒ 目标用例**变红**（证明断言不是摆设） |
| `probe/out-vitest-blocked.txt` | `npx vitest run` 在本沙箱无法启动的原始报错（`spawn EPERM`） |
| `probe/vitest-shim/` | vitest API 兼容 shim + loader（仅在沙箱内无法启动 vitest 时使用，见下） |

## 三、复跑命令

```powershell
# 1) 起一个私有 MariaDB（不影响 3306 上的既有实例）
$bin='D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin'
$root=Join-Path $env:TEMP ('s3-109-mdb-'+(Get-Date -Format 'HHmmss')); New-Item -ItemType Directory $root | Out-Null
& "$bin\mariadb-install-db.exe" "--datadir=$root\data" --default-user
Start-Process "$bin\mysqld.exe" -WindowStyle Hidden -ArgumentList @("--datadir=$root\data","--port=3399",
  "--bind-address=127.0.0.1","--ssl=0","--skip-name-resolve","--plugin-dir=$bin\..\lib\plugin","--console")
Start-Sleep 8

# 2) 旧形红 / 新形绿（工作目录=仓库根）
node docs/evidence/S3-109/probe/s3-109-reverse-test.mjs --sql docs/evidence/S3-109/probe/151-before.sql --label old --port 3399
node docs/evidence/S3-109/probe/s3-109-reverse-test.mjs --sql docs/migrations/151_points_columns_fill.sql --label new --port 3399

# 3) 断言复跑（vitest 在本沙箱不可用时的等价通道，见第四节）+ 断言反测
node --import ./docs/evidence/S3-109/probe/vitest-shim/register.mjs backend/src/__tests__/shared/migration-points-columns.test.ts
$env:S3_109_SQL_OVERRIDE='D:\Users\ZXQL\wt-agents\issue-113\docs\evidence\S3-109\probe\151-before.sql'
node --import ./docs/evidence/S3-109/probe/vitest-shim/register.mjs backend/src/__tests__/shared/migration-points-columns.test.ts   # 期望红
Remove-Item Env:S3_109_SQL_OVERRIDE
```

## 四、关键原始输出（摘要，全文见同名 txt）

旧形（`out-old-form.txt`）：

```
[11] 失败  errno=1067 code=ER_INVALID_DEFAULT sqlState=42000
     sqlMessage: Invalid default value for 'redeem_ratio'
     sql: ALTER TABLE t_points_rule ADD COLUMN redeem_ratio DECIMAL(6,4) DEFAULT 100 ... AFTER earn_ratio
[12] 跳过  errno=1054 code=ER_BAD_FIELD_ERROR  Unknown column 'redeem_ratio' in 't_points_rule'
[13] 跳过  errno=1054 code=ER_BAD_FIELD_ERROR  Unknown column 'min_redeem_amount' in 't_points_rule'
[14] 跳过  errno=1054 code=ER_BAD_FIELD_ERROR  Unknown column 'max_redeem_ratio' in 't_points_rule'
[汇总] 成功 10 / 失败 1 / 跳过 3（跳过 = 生产上静默丢弃）
[information_schema.COLUMNS] t_points_rule —— 10 列（缺 redeem_ratio / min_redeem_amount / max_redeem_ratio / expire_days）
[DML] 复刻积分规则保存 INSERT → 失败 errno=1054 ER_BAD_FIELD_ERROR Unknown column 'redeem_ratio' in 'INSERT INTO'
```

新形（`out-new-form.txt`）：

```
[11] OK  redeem_ratio DECIMAL(10,2) DEFAULT 100 ... AFTER earn_ratio
[12] OK  min_redeem_amount ... AFTER redeem_ratio
[13] OK  max_redeem_ratio ... AFTER min_redeem_amount
[14] OK  expire_days ... AFTER max_redeem_ratio
[汇总] 成功 14 / 失败 0 / 跳过 0
[information_schema.COLUMNS] t_points_rule —— 14 列，顺序 earn_rate→earn_ratio→redeem_ratio→min_redeem_amount→max_redeem_ratio→expire_days→daily_limit...
  redeem_ratio decimal(10,2) default=100.00 / min_redeem_amount decimal(10,2) default=0.00 /
  max_redeem_ratio decimal(6,4) default=0.5000 / expire_days int(11) default=365
[DML] 复刻积分规则保存 INSERT → 4 列不再报未知列（本条另暴露 rule_name 缺省值问题，见第六节）
```

## 五、为什么本沙箱跑不了 vitest

`node` 在本沙箱内被禁止创建子进程：`spawnSync(process.execPath, ['--version'])` 都返回 `EPERM`
（PowerShell 直接执行同一 exe 正常）；vitest 起手就要 spawn esbuild/`net use`，故必然失败
（`out-vitest-blocked.txt`；与既有先例 `docs/evidence/B-2b/b2b-output-vitest-blocked.txt` 同因同错）。

等价通道：`probe/vitest-shim/`（loader 把 `vitest` 指向 shim，并给 ESM 注入 vitest 下可用的 `__dirname`），
用 Node 原生 TS 支持**直接执行仓库里那份真实测试文件**，6/6 通过（`out-assertions-shim.txt`）。
该 shim 只覆盖本文件用到的 `describe/it/expect` 子集，**不是 vitest 替代品**；全量 `npx vitest run` 仍需凌舟复跑。

## 六、本次新发现（**不在本单范围**，只报不改）

151 修好后，"积分规则保存"不再因缺列 1054 失败，但**同一条 INSERT 换了个错**继续失败：

```
保存结果: 失败 errno=1364 code=ER_NO_DEFAULT_FOR_FIELD sqlState=HY000
sqlMessage: Field 'rule_name' doesn't have a default value
```

- 来源：`backend/src/services/admin/marketing-points.service.ts:95-107` 的 INSERT 列清单里**没有 `rule_name`**，
  而唯一 DDL 来源 `docs/migrations/071_客户积分.sql:36` 是 `rule_name VARCHAR(100) NOT NULL`（无默认值）。
- 说明：该缺陷此前被 1054 挡在前面，属"被掩盖的存量问题"（技术债铁律第 3 条场景）。
- 本单红线只授权改 `redeem_ratio` 的类型，**未擅自扩围**；是否另立单、以及生产表 `rule_name` 的真实可空性，
  请凌舟裁定（建议先在生产只读跑 `SHOW CREATE TABLE t_points_rule` + `SELECT COUNT(*) FROM t_points_rule`）。
