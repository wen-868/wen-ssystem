# S3-174-F1 证据目录（演示租户隔离迁移 · 判红后重做版的真库反测）

> 执行人：阿坚（后端）｜2026-10-08｜工作区 `D:\Users\ZXQL\wt-agents\issue-279`，分支 `agent/issue-279`
> 被测对象：`docs/migrations/197_演示租户隔离.sql`（重做版）+ `backend/src/services/admin/auth.service.ts`
> 判红依据：`docs/tasks/cards/R101-S3-174-凌舟验收-判红.md`（§二 三处生产同构硬伤 / §三 五项修复要求）
> 私有 DB：`D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin` 起的 **MariaDB 11.4.5**，`127.0.0.1:3410`，
> datadir 在 `%TEMP%\s3174-db-a\data`，`--skip-grant-tables --ssl=OFF`。**只动自建库 `s3174_prod*`，未连生产、未碰 `liquor_inventory`。**

## 一、为什么要这套装置

判红卡 §三④ 要求（原话）：正向断言「demo 租户存在 ∧ 用户 tenant_id='demo' ∧ 角色绑定 ≥1 且全在 demo ∧
demo 菜单数 >0 ∧ 演示登录 roles 非空」；反向「去掉任一 NOT NULL 列 ⇒ 迁移**必须报错停下**」；幂等「连跑两遍零错误」。
这三件事**只在真实库上才有意义**——上一版之所以判红，正是因为只在小库/空库想过。

装置（`docs/evidence/S3-174/tools/s3-174-verify.mjs`）做两件事：

1. **建"生产同构"夹具**（按判红三处前提逐条复现，见 §二）；
2. 在夹具上跑**正向 / 幂等 / 三个反向**，每个反向用例都**先重建夹具**，互不污染。

正向用例用**两个执行载体**各跑一遍，证明"换谁来跑都一样"：
· 装置内联执行（与 `scripts/run-migration.mjs` 同口径：整文件 `multiStatements`）；
· 生产/部署实际用的 `node scripts/run-migration.mjs docs/migrations/197_演示租户隔离.sql`（下文 §四.2 原始输出）。

## 二、夹具的"生产同构"依据（每一处都指着仓库原文）

| 判红事实 | 夹具怎么复现 | 依据（仓库内） |
|:--|:--|:--|
| §二.1 `t_tenant` 的 `company_name`/`contact_person`/`contact_mobile`/`tenant_code`(UNIQUE) 四个 **NOT NULL 且无默认值**列 | 建库后 `DROP TABLE t_tenant`，用 016 的建表语句重建 | `docs/migrations/016_phase9_tenant_subscription.sql:10-40`（`tenant_code` 12 行、`company_name` 13 行、`contact_person` 15 行、`contact_mobile` 16 行） |
| 生产 `t_tenant` 同时存在 `name`/`plan`/`status`（判红里那条 `INSERT IGNORE (id,name,plan,status)` 才会走到 1364 而不是 1054） | 再补后端启动期"修复缺列"那 4 条 ALTER | `backend/src/shared/migration.ts:547-562`（`tenantColumns`：`name`/`contact_name`/`contact_phone`/`plan`） |
| §二.2 `t_sys_user_role` 唯一键 **`uk_sys_user_role (user_id, role_id)`（不含 tenant_id）** | 直接用 `init_database.sql` 的建表 | `docs/init_database.sql:318` |
| §二.3 `t_sys_menu` 按租户存菜单，`default` 有、`demo` 没有 | 用 079 的建表 + 13 条菜单 INSERT（全部落 `tenant_id='default'`） | `docs/migrations/079_权限矩阵.sql:18`（建表）、`:34`（`uk_sys_menu_code_tenant (menu_code, tenant_id)`） |
| §〇 生产 `default` 租户 `t_sale_bill` = **524 行** | 夹具造 524 行 `tenant_id='default'` 销售单 | 判红卡 §〇/§三⑤（本单红线：前后必须仍为 524） |
| 演示账号形态：`username='demo'`、`tenant_id='default'`、两条绑定 | 夹具 `t_sys_user(id=3,'demo','default')` + `t_sys_user_role(3,1,'default'),(3,2,'default')` | 派单卡 §〇 实测 JWT `{"id":3,"roles":["SUPER_ADMIN","STORE_OPERATOR"],"tenantId":"default"}` |

夹具基线读数（`raw/run-setup.txt`）：

```
夹具就绪：init 建表 66 条（跳过 0）、菜单语句 3 条、default 菜单 32 行、demo 菜单 0 行、default 销售单 524 行
  t_tenant id='demo'      : []
  t_sys_user username=demo: [{"id":3,"username":"demo","tenant_id":"default"}]
  角色绑定                : [{"tenant_id":"default","role_code":"STORE_OPERATOR"},{"tenant_id":"default","role_code":"SUPER_ADMIN"}]
  菜单 demo / default     : 0 / 32
  t_sale_bill 按租户      : [{"tenant_id":"default","c":524}]
```

> 说明：夹具 `default` 菜单 **32** 行（生产 89 行）。差异原因是 079 的菜单 INSERT 分 13 组、组间 id 有重叠，
> 逐条 `safeExec` 会跳重复键（与生产一致），本夹具按同口径只落 32 行。
> 本单断言的是**迁移语义**（"default 有几行、demo 就有几行" + "demo > 0"），与绝对值无关；
> 生产执行时迁移按 `WHERE m.tenant_id='default'` 全量克隆，行数自然等于生产当时的 89。

## 三、复跑步骤（可直接粘贴）

```powershell
# 0) 起私有 MariaDB（本目录证据用的实例：127.0.0.1:3410）
$mdb = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin"
New-Item -ItemType Directory -Force -Path "$env:TEMP\s3174-db-a\data" | Out-Null
& "$mdb\mariadb-install-db.exe" --datadir="$env:TEMP\s3174-db-a\data" --password=""
Start-Process -FilePath "$mdb\mysqld.exe" -WindowStyle Hidden -ArgumentList `
  "--datadir=$env:TEMP\s3174-db-a\data","--port=3410","--bind-address=127.0.0.1","--skip-grant-tables","--ssl=OFF","--console"

# 1) 正向 + 幂等 + 三个反向（一条命令跑完全部，EXIT=0 即全绿）
$env:DB_PORT="3410"; $env:DB_USER="root"; $env:DB_PASSWORD=""; $env:DB_NAME="s3174_prod"
node docs/evidence/S3-174/tools/s3-174-verify.mjs all

# 2) 官方执行载体（与生产执行方式一致：把 .env 放在任意目录，用绝对路径跑迁移文件）
#    本目录证据用的是 %TEMP%\s3174-run\.env（DB_PORT=3410 / DB_NAME=s3174_prod）
cd $env:TEMP\s3174-run
node D:\Users\ZXQL\wt-agents\issue-279\scripts\run-migration.mjs `
  D:\Users\ZXQL\wt-agents\issue-279\docs\migrations\197_演示租户隔离.sql
# 再回仓库核对状态（不重建夹具）
node docs/evidence/S3-174/tools/s3-174-verify.mjs state
```

可用 mode：`setup` / `shape` / `pos` / `state` / `neg-notnull` / `neg-binding` / `neg-menu` / `all`。
每次运行都会把原始输出落盘到 `docs/evidence/S3-174/raw/run-<mode>.txt`。

## 四、关键读数（原始输出见 `raw/`）

### 4.1 正向 + 幂等（`raw/run-pos.txt`，EXIT=0）

```
迁移前：demo 租户不存在（反测前置）
迁移前：演示账号仍在真实租户 default（判红实测形态）
迁移前：demo 租户菜单 0 行（判红 §二.3）
迁移 197 执行成功（EXIT 0 口径：本句未抛错）
跑完一遍：demo 租户存在（company_name=演示租户 / tenant_code=DEMO）
跑完一遍：demo 租户 company_name / contact_person / contact_mobile / tenant_code 已写值
跑完一遍：演示账号归属 = demo（且不在其它租户）
跑完一遍：demo 租户内角色绑定 >= 1（实际 2）
跑完一遍：其它租户无残留绑定
跑完一遍：demo 租户下仍是 SUPER_ADMIN
跑完一遍：demo 租户菜单数 > 0（实际 32）
跑完一遍：demo 菜单数与 default 一致（32 = 32）
跑完一遍：default 租户业务数据零损（t_sale_bill = 524，期望 524）
演示登录 roles = ["SUPER_ADMIN","STORE_OPERATOR"]   ⇒ 非空且含 SUPER_ADMIN
第二遍 6 条写语句 affectedRows = [0,0,0,0,0,0]      ⇒ 幂等：零行变更
幂等：菜单无重复（两次都是 32）／角色绑定无重复（两次都是 2 条）
```

### 4.2 官方执行载体（`scripts/run-migration.mjs`）原始输出

```
已连接数据库 root@127.0.0.1:3410/s3174_prod
执行迁移: D:\Users\ZXQL\wt-agents\issue-279\docs\migrations\197_演示租户隔离.sql
迁移执行成功
```

随后 `node ...s3-174-verify.mjs state` 全绿（`raw/run-state.txt`），即**执行口径与生产一致时结论不变**。

### 4.3 反向①：去掉 `company_name` ⇒ 必须报错停下（`raw/run-neg-notnull.txt`，EXIT=0）

```
PASS  反测样本已构造（company_name 从列清单与值清单同时去掉）
PASS  迁移**报错停下**（不得静默跳过）
  原始错误：code=ER_NO_DEFAULT_FOR_FIELD message=Field 'company_name' doesn't have a default value
PASS  错误码为 1364 ER_NO_DEFAULT_FOR_FIELD（实际 code=ER_NO_DEFAULT_FOR_FIELD errno=1364）
PASS  反测后 demo 租户仍未建出（0 行）—— 说明是「停下」而非「跳过继续」
PASS  反测后演示账号仍在 default（没有被半途改走）
```

### 4.4 反向②③：证明"判红的两处硬伤确实存在、本单的修法确实必要"（`raw/run-neg-binding.txt`、`raw/run-neg-menu.txt`）

```
── neg-binding：退回「先插后删」 ──
  旧写法执行后：该账号绑定总数 0 条（其中 demo 租户内 0 条）   ⇒ 判红 §二.2 复现成立
── neg-menu：不迁菜单 ──
  不迁菜单时 demo 租户菜单 0 行                              ⇒ 判红 §二.3 复现成立
```

### 4.5 形状断言（`raw/run-shape.txt`，与 vitest 用例同口径）

8 条语句（6 写 + 2 核对 SELECT）、可执行语句里**无 `INSERT IGNORE`**、第 1 条显式写齐四个 NOT NULL 列、
绑定是 `UPDATE` 且全文无 `DELETE`、菜单克隆 2 条（子级 parent 重指向 demo 父行）、
只碰 `t_tenant`/`t_sys_user`/`t_sys_user_role`/`t_sys_role`/`t_sys_menu` 五张系统表、注释内无 ASCII 分号。

## 五、已知偏差 / 与本单无关但同族的观察

1. **夹具菜单行数 32 ≠ 生产 89**（原因见 §二 说明），断言口径与判红卡一致（"demo 菜单数 > 0"）。
2. **范围外同族观察（已计入回传卡「风险与自我报备」，不是本单结论）**：迁移后绑定的 `tenant_id='demo'`，
   而 `t_sys_role` 的角色行仍是 `tenant_id='default'`。因此：
   · `backend/src/services/admin/auth.service.ts:119-125` 的 `getUserPermissions`（连接条件 `r.tenant_id = ur.tenant_id`）命中 **0 行**；
   · `backend/src/services/admin/menu-permission.service.ts:87-95` 的 `getUserMenus`（`AND r.tenant_id = ?`）命中 **0 行**。
   装置把这两个读数作为"旁证"打印出来（`raw/run-pos.txt` 末行），供凌舟裁定；本单未改这两处。
   （`admin-web` 侧栏是静态路由 + `meta.roles`，不调 `/admin/menus/user`，故演示工作台侧栏不受此影响。）

## 六、文件清单

| 文件 | 内容 |
|:--|:--|
| `tools/s3-174-verify.mjs` | 装置本体：夹具组装 + 正向/幂等/三个反向 + 落盘 |
| `raw/run-setup.txt` | 夹具基线读数 |
| `raw/run-shape.txt` | 形状断言（真实 `splitSqlStatements`/`addTablePrefix`） |
| `raw/run-pos.txt` | 正向 + 幂等原始输出 |
| `raw/run-state.txt` | 官方 `run-migration.mjs` 执行后的状态断言 |
| `raw/run-neg-notnull.txt` | 反向①：去掉 NOT NULL 列 ⇒ 1364 报错停下 |
| `raw/run-neg-binding.txt` | 反向②：旧"先插后删" ⇒ 绑定归零 |
| `raw/run-neg-menu.txt` | 反向③：不迁菜单 ⇒ demo 菜单 0 行 |
| `raw/run-all.txt` | 上面全部串跑一遍的完整输出 |
