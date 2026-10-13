# 回执 · S3-192（租户状态值域收敛：EXPIRED / SUSPENDED 越界写入 ＋ 存量订正）

> 汇报对象：凌舟（总负责人）｜汇报人：**阿坚（后端）**｜日期：**2026-10-14**
> 派单卡：`docs/tasks/inbox/ACTIVE-S3-192.md`（本工作树基线 `25728007` 未含该卡，已按原文归档为 `docs/tasks/inbox/archive/ACTIVE-S3-192-20261014.md`）
> 十项完整版回传卡：`docs/tasks/cards/R101-S3-192-阿坚-回传.md`
> **本地提交（未 push、未开 PR）：`0ee5f587`（代码 + 迁移 199）、`d7ebd932`（证据包）**；分支 `fix/s3-192-tenant-status-domain`｜基线 `origin/main` = `25728007`
> 证据目录（可复跑，装置与原始输出全部入库）：`docs/evidence/S3-192/`（索引 `README.md`）

```
【汇报 S3-192】对应派单 S3-192：两处越界写入已收敛到唯一可写值域（到期停用改落 DISABLED 的库值 0、越界入参 400），并出幂等存量订正迁移 199；**卡面 §二.1 的前提「该列存字符串」经真库实测不成立**
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端）｜2026-10-14
交付物：见下「二、交付物」
证据（可复跑）：见下「三、证据」与本工作树 docs/evidence/S3-192/README.md
验收自评：见下「四、验收自评」
未完成与阻塞：见下「五、未完成与阻塞」
风险与自我报备：见下「六、风险与自我报备」
回传要求：本汇报已落卡 docs/tasks/cards/R101-S3-192-阿坚-回传.md
关联卡：docs/tasks/inbox/ACTIVE-S3-192.md（已归档）
```

---

## 一、一句话结论 ＋ 一处**前提订正**（请先看这条）

两处越界写入都已收敛到「唯一可写值域 = ACTIVE / DISABLED」，并配了幂等存量订正迁移、用例护栏与两侧反测；
但**卡面 §二.1 的写法前提与真库不符**，我按真实 schema 落地并留了原始证据：

> 卡面写：「`WHERE … AND status = 'ACTIVE'` 反证该列存字符串」；§二.1 要求「status 落 `'DISABLED'`」。
> **真库实测：`t_tenant.status` 是 `TINYINT`（1=启用 / 0=停用）**，写字符串会 `errno 1366`，语句**整条不生效**。

| 证据 | 命令 | 原始读数 |
|:--|:--|:--|
| 写侧写字符串 | `harness/02a2-probe-strict-set-string.sql`（本机私有 MariaDB 11.4.5，`STRICT_TRANS_TABLES`） | **`ERROR 1366 (22007) … Incorrect integer value: 'EXPIRED' for column s3192_num.t_tenant.status`** |
| 判据 `status = 'ACTIVE'` | `harness/02a1-probe-strict-compare.sql` | 命中 **`num-disabled`（status=0）** —— 判据在数值列上被隐式转成 `status = 0`，**语义反了**（原语句即便不报错也只会打到"已停用"行） |
| 真迁移库的实际列类型 | `USE s3192_full; SHOW COLUMNS FROM t_tenant` | `status  tinyint(4)  YES  MUL  1` |
| 仓内其余记录 | `shared/migration.ts:539`、`docs/migrations/092_租户ID.sql:76`（均 TINYINT）；`MIG-1` 计划注记「与 092 迁移及生产一致」；`R101-C4-0-阿坚清账.md:437`；`169` 的生产注释；S3-150 真库 1366 复现 | 一致指向数值列 |

**处置**：§二.1 的落地 = 写 **`toTenantStatusValue("DISABLED")` 的库值 0**（领域层仍是"落 DISABLED"，只把"库值"这一步按真实类型走），
并把 WHERE 改为**类型无关判据** `CAST(status AS CHAR) IN ('1','ACTIVE')`（数值库命中 `'1'`、`016/029` 声明的 VARCHAR(16) 老库命中 `'ACTIVE'`），
使同一句在两种 schema 下语义一致。同批修掉同一文件里同形的**取数判据**（原 `AND t.status = 'ACTIVE'`，同为隐式转换）。

> 依据（报备即行动）：`docs/项目规则.md` §0.3「修改需有依据…对任务理解不确定时先向凌舟确认」——此处不是"不确定"，
> 而是**卡面前提可被读数证伪**，故按库真值落地并在本回执首段显式报备；若凌舟要求逐字照做字符串写法，我立即回退（但真库会 1366，功能不成立）。

## 二、交付物

| 类别 | 内容 |
|:--|:--|
| 代码（业务侧，4 文件） | ① `services/subscription-expiry.service.ts`：到期停用写**库值 0** + 原因/时间同写；取数与 WHERE 改类型无关判据；② `services/saas/tenant.service.ts`：`auditTenant` 越界入参 **400**、落库值改 1/0；`toggleTenantStatus` 同口径；③ `controllers/saas/tenant.controller.ts`：两处 Zod 枚举收敛为 `["ACTIVE","DISABLED"]`（**卡面外，见 §六.2**）；④ `scripts/guard-tenant-status.mjs`：收编 2 文件 + 补 1 入口（**卡面外**）、例外改「字面量+上下文」匹配、打印已登记例外 |
| 迁移 | `docs/migrations/199_租户状态值域收敛.sql`（新增；**幂等**：越界值 ⇒ DISABLED，WHERE 守卫；含只读前后对照 SQL；写闸门说明） |
| 用例护栏 | ① 到期后 `t_tenant.status` 落库值 0 且 `suspend_reason` 有值（`__tests__/services/subscription-expiry.service.test.ts`）；② 越界入参不写库、400（service + controller 两侧）；③ 断言写的是数字而非字符串 |
| 迁移编号不变量 | `__tests__/shared/migration-c6-4-1.test.ts` 的 `EXPECTED_MAX_MIGRATION` 198 ⇒ **199**（该测试按设计"新增迁移必须被显式承认"） |
| 证据包 | `docs/evidence/S3-192/README.md` + `harness/`（12 个装置）+ `logs/`（30 份原始输出，含 3 份反测日志） |
| 回传 | 本文件 + `docs/tasks/cards/R101-S3-192-阿坚-回传.md` + 派单卡归档件 `docs/tasks/inbox/archive/ACTIVE-S3-192-20261014.md` |
| 提交 | `0ee5f587`（代码 + 迁移）、`d7ebd932`（证据包）、本文件另起一笔 |

**未改**：任何前端、`.github/**`、`deploy/**`、`docs/tasks/R101-收口总清单.md`、`docs/数据库变更清单.md`、其它迁移/脚本；生产库零写操作。

## 三、证据（可复跑）

### 3.1 口径来源（我选 (b)，并说明）

§二.2 采 **方案 (b)：非 ACTIVE / DISABLED 的入参直接 400**（凌舟倾向项）。依据：`platform-tenant.service.ts:221` 已有同口径先例
（`throw new AppError("无效的状态值", 400)`）、`controllers/platform/tenant.controller.ts:62` 强校验 `["ACTIVE","DISABLED"]`、
`saas-admin/src/views/tenant/TenantList.vue:335` 的前端注释也写明"后端强校验的合法值只有 ACTIVE / DISABLED 两个"。
同时**删掉了 else 分支的任意值直写**（原实现连 `PENDING` 都会落库）。

### 3.2 真库实测（A 轨探针 + B 轨真管线/真作业）

| 侧 | 命令 | 原始读数 | 文件 |
|:--|:--|:--|:--|
| 修复后语句（数值形态） | `harness/02-probe-premise.sql` | `affectedRows=1`；`num-active` ⇒ `0` + `订阅已到期` + `suspended_at` 非空；已停用行**未误伤** | `logs/p02-premise.log` |
| 修复后语句（字符串形态 A/B） | `harness/03-probe-string-shape.sql` | `affectedRows=1`；`'ACTIVE'` ⇒ `0`；其余行不动 | `logs/p03-string-shape.log` |
| 迁移 199 幂等 | `harness/04-probe-199.sql` | 字符串形态：越界 **2→0**、第一遍变更 2 行、**第二遍匹配 0 行 / 变更 0 行**；数值形态：恒 0（no-op） | `logs/p04-probe-199.log` |
| 迁移 199 反测（去掉 WHERE） | 同上 P5 段 | **第二遍仍变更 4 行**（不幂等=红）；复原后 0 | 同上 |
| 真迁移管线 | `harness/run-pipeline.ps1` | 写闸门 block：`199_…: 写闸门 block 跳过 UPDATE 语句（目标 t_tenant）`；allow：`执行外部迁移: 199_租户状态值域收敛.sql` 且**无跳过行** | `logs/b1-*.log`、`logs/b3-*.log` |
| **真作业运行期** | `harness/06-runtime-expiry.mjs` | 前 `status_raw=1`；后 **`0 / 订阅已到期 / has_suspended_at=1`**，订阅 `ACTIVE→EXPIRED`，日志 `[SubscriptionExpiry] 租户 … 已自动停用` | `logs/b5-runtime-expiry.log` |
| 运行期反测（写侧改回字符串） | 同上 + 重建 dist | **`errno 1366 … Incorrect integer value: 'EXPIRED'`**，租户**仍为 1**（= 修复前生产行为） | `logs/antitest-03-runtime-revert.log` |

### 3.3 门禁 · 收编与反测（§三.1 / §五）

| 项 | 命令 | 读数 | 文件 |
|:--|:--|:--|:--|
| 绿 | `node backend/scripts/guard-tenant-status.mjs` | `EXIT=0`：域内文件 4 → **7**、漏登 0、**已登记放行 3 处逐条打印（含登记上下文）** | `logs/gate-guard-tenant-status.log` |
| 反测① | 把订阅到期写侧改回字面量 `'EXPIRED'` ⇒ 重跑 | **`EXIT=1`**：`❌ G2 违规 1 条：services/subscription-expiry.service.ts:124 …`（收编真的生效，不靠豁免） | `logs/antitest-01-revert-expiry-write.log` |
| 反测② | 往收编文件顶部塞一个被禁字面量 ⇒ 重跑 | **`EXIT=1`**：只报注入行；两条只读例外在**行号 +1 漂移后仍按上下文命中** | `logs/antitest-02-inject-into-collected-file.log` |
| 其余 | `guard-route-auth` / `guard-route-prefix` | 均 `EXIT=0` | `logs/gate-guard-*.log` |

### 3.4 读写两侧字面量清单（§四.1）

- 全量（仓内 `backend/src`，不含 `__tests__`）：单引号命中 **168 行**、双引号命中 **129 行** —— **绝大多数是别的域**（工单/订单/门店/自提/导出/追溯…）。
  原始清单：`logs/c1-literal-inventory-single-quote.log`、`logs/c2-literal-inventory-double-quote.log`。
- **租户状态域内**只有 13 行（`logs/c3-tenant-domain-inventory.log`），逐条说明见下「七、读侧未收敛清单」。

## 四、验收自评（逐条对照派单 §三 / §四 / §五）

| 派单要求 | 自评 | 依据 |
|:--|:--|:--|
| §三.1 两处改动代码片段 + `rg` 全文命中清单（逐条说明为何保留） | **通过（并附前提订正）** | §3.4 + §七；两处改动见 §二交付物 |
| §三.2 存量订正迁移：私有副本库跑「订正前 → 订正后 = 0」＋第二遍零变更 | **通过** | `logs/p04-probe-199.log`（2→0；第二遍匹配 0 / 变更 0；数值形态恒 0） |
| §三.3 用例护栏通过 | **通过** | 全量 `652 files / 7699 tests / 0 failed`（`logs/gate-vitest.log`）；新增/改写的护栏见 §二 |
| §三.4 门禁：vitest 0 failed、tsc 0、三 guard EXIT=0、build EXIT=0 | **通过** | `logs/gate-vitest.log`、`logs/gate-tsc.log`、`logs/gate-guard-*.log`、`logs/gate-backend-build.log`（`npm --workspace backend run build` 逐工作区口径） |
| §四 反测两侧齐 | **通过** | 门禁侧：反测①/②（§3.3）；运行期侧：`logs/b5-*.log`（绿）vs `logs/antitest-03-*.log`（红，1366 且租户仍启用）；迁移侧：P5 段 |
| §一 口径（唯一可写值域 ACTIVE/DISABLED；"暂停"用 suspend_reason/suspended_at 表达） | **通过** | 代码 + `logs/p02-premise.log`（原因/时间同写） |
| §三.1 从登记豁免移出、让 R1 真覆盖 | **通过** | 域清单 4→7；两条反测证明"靠的是 R1 不是豁免"（§3.3） |

## 五、未完成与阻塞

- **无阻塞**。
- **未按要求外扩**（属卡面未授权，报回待令）：`docs/数据库变更清单.md`（红线未授权，未改）、`docs/memories/阿坚-记忆.md`（近两日各单惯例未随单更新，需要我补更请示）、
  `docs/踩坑日志.md`（本单新坑两条，建议由凌舟合并时登记，见 §六.4）。
- **`tenant-register.service.ts` / `platform/tenant-admin.service.ts`** 仍在 `SIGNAL_EXEMPT`（卡面只要求收编我这两处；它们各自的越界形态见 §七）。

## 六、风险与自我报备（主动交代，不粉饰）

1. **前提订正（最重要，已在 §一 展开）**：卡面把该列当字符串列。我按真库类型落地，功能才成立；**若凌舟要求逐字照做，请指示，我回退但会 1366**。
2. **卡面外的三处必要改动**（愿按令回退）：
   - `controllers/saas/tenant.controller.ts` 两处 Zod 枚举 ⇒ `["ACTIVE","DISABLED"]`：不改则"校验通过、服务层 400"自相矛盾，且 **DISABLED 反被拦在门外**（方案 b 的停用路径不可达）；该枚举正是门禁头部记录的根因形态。
   - `services/saas/tenant.service.ts` 的 `toggleTenantStatus` 同口径收敛：它与 `auditTenant` 是同一张表、同一值域、同一 1366 缺陷（原实现把入参字符串直写数值列）。
   - 门禁两处机制改动（收编 `controllers/saas/tenant.controller.ts`；例外改「字面量+上下文」匹配）：**不是放宽**——见 §3.3 两条反测；改匹配方式的直接原因是我自己的反测暴露了"行号漂移会让例外静默失效/错放行"（原实现按理由串里含行号放行）。
3. **schema 的残余不确定性**：生产 `t_tenant.status` 的列类型**没有本单内的直接读数**（S3-152 的生产导出只含表名/列名）。判"TINYINT"依据 §一 的证据链；服务器侧一条只读 `SHOW COLUMNS FROM t_tenant LIKE 'status'` 即可闭环。**代码已在两种 schema 下都验过**（`p02`/`p03`）。
4. **部署副作用（请业主知情）**：到期作业的写语句此前**恒失败**（1366）⇒ 修复后**首次启动即会真的把"订阅已过期但仍启用"的租户停用**（这是产品既定行为，只是从未生效过）。若要首启不批量停用，请先裁定，我再改成开关式。
5. **迁移 199 的写闸门**：默认 `MIGRATION_WRITE_GATE=block` 会**跳过**它的 UPDATE（已实测留痕，`logs/b1-*.log`）；生产要真正订正需 `allow` 跑一次或手工执行。**另：数值库上 199 是 no-op**（该库不存在越界字符串值），所以"存量订正"的真正载体是作业自愈（§六.4）。
6. **反测期间动过源码并已复原**：`subscription-expiry.service.ts` 的写侧临时改回字符串（重建 dist 取证）后复原；当前工作树与 `0ee5f587` 一致（`git diff` 无残留），门禁与运行期复跑均绿。
7. **未采纳的旁路**：我没有用"把 R1 细化成语句级/表级"来解决收编误伤（那会同时松掉既有 4 个文件的钝刀覆盖），而是保留了钝刀 + 3 条**内容绑定**的只读/他表例外。

## 七、读侧未收敛清单（报回待裁定；本单未改）

| 位置 | 类别 | 现状与影响 | 我的建议 |
|:--|:--|:--|:--|
| `services/saas/tenant.service.ts:339/340` | 只读统计 | `COUNT(*) WHERE status='SUSPENDED'/'EXPIRED'`：数值列上经隐式转换**恒算成同一个桶**，存量收敛后恒 0 | 已按门禁例外登记；改写为"按 suspend_reason 归因"需你裁定 |
| `services/saas/tenant.service.ts:94-96`（listTenants 筛选）、`:320`（activeTenants） | 只读筛选/统计 | 同样把 ACTIVE 字符串与数值列比较 ⇒ **筛选"启用"会把停用租户筛出来**、`activeTenants` 实际数的是停用行 —— 正是第 59 项描述的"读侧认不出/出现以在用面貌" | 与上一条同批修（同一文件、同一根因） |
| `services/platform/tenant-status-stats.service.ts:41`（`EXPIRED_VALUES`）与 `:12` 注释 | 只读映射 | 把库内原始值映射成四态计数，`EXPIRED` 桶收敛后恒 0 | 口径收敛后该桶应改由 `suspend_reason` 派生，请你定 |
| `services/platform/platform-overview.service.ts:126/364` | 只读统计 | `t_tenant` 的 `EXPIRED` / `PENDING` 桶（`PENDING` 更是历史值域） | 同上 |
| `controllers/platform/platform.controller.ts:60` | 只读筛选入参 | 平台总览筛选枚举接受 `EXPIRED` | 收敛为 `["ACTIVE","DISABLED"]`（读入参，改它无风险） |
| `services/platform/tenant-admin.service.ts:35` | 类型联合（读写共用） | `status?: "ACTIVE"\|"DISABLED"\|"EXPIRED"`；该文件动态字段写 `t_tenant`，静态不可判 | 仍在 `SIGNAL_EXEMPT`；建议随"把 SQL 改成显式列"一并收编 |
| `services/tenant-register.service.ts:226/386` | 另一张表 | `t_tenant_register_application.status='PENDING'`（合法值域） | 与"R1 口径是否细化"同批讨论 |
| `services/subscription-expiry.service.ts:131` | 另一张表 | `t_subscription.status='EXPIRED'`（VARCHAR，合法） | 已按例外登记（内容绑定） |

> 另：`platform-overview.service.ts:399`（`t_support_ticket`）等其余命中的字面量属**别的域**，与租户状态无关，未列。

## 八、请凌舟裁定 / 处置

1. **§二.1 的前提订正**是否认可（认可 ⇒ 我这份实现即最终版；不认可 ⇒ 请给"该列是字符串列"的生产读数，我重做）。
2. **§六.2 的三处卡面外改动**是否保留。
3. **§七 读侧清单**是否另立单（我建议同一文件内的两条（saas 统计/筛选）先修，因为它们是"到期/停用租户以在用面貌出现"的直接来源）。
4. **§六.4 的首启批量停用**是否照产品既定行为执行。
5. `docs/数据库变更清单.md`（199 的登记）、`docs/memories/阿坚-记忆.md`、`docs/踩坑日志.md`（建议两条：① "卡面前提与真库 schema 不符时按读数落地并首段报备"；② "门禁例外用行号定位会随漂移静默失效"）—— 是否要我补。

---

### 附：本工作树的指纹（防"并行会话改了同一棵树"）

| 文件 | sha256（前 16） |
|:--|:--|
| `backend/src/services/subscription-expiry.service.ts` | `9DB16C9CC9729467` |
| `backend/src/services/saas/tenant.service.ts` | `5140980B6411F8C8` |
| `backend/src/controllers/saas/tenant.controller.ts` | `6FB8BECE2186D72A` |
| `backend/scripts/guard-tenant-status.mjs` | `689AE069B620B87F` |
| `docs/migrations/199_租户状态值域收敛.sql` | `36CA27C33F1912CD` |
| `backend/dist/services/subscription-expiry.service.js`（构建产物） | `1199237D9BF3F2EA` |
