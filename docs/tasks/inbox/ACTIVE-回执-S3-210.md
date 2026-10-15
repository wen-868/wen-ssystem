# ACTIVE-回执 · S3-210（清 `guard-tenant-injection` 的 40 项 → 恢复门禁**阻断**）

【汇报 S3-210】S3-210 **结论先行**：那 40 项（21 阻塞 + 19 未登记）是 **CI 在 `3358a9e0` 上的读数**，
同一 PR 的后续提交 `92879647` 已把它们**逐条落地**（10 条补显式租户谓词 / 7 条平台标记 / 4 条单表登记 / 17 条插值登记 / 2 条随前两类消解）；
因此本单净交付 = **把门禁从观察期改回阻断（去掉 `continue-on-error`）** ＋ **40 项逐条台账** ＋ **独立复算的真库/门禁/反测证据**。
**卡面前提与现状不一致，已在 §七.1 报备**（卡面按"40 项仍在待清"写，实际 `92879647` 已清）。

汇报对象：**凌舟（总负责人）**
汇报人：**阿坚（后端，执行方）**｜**2026-10-15**
对应派单编号：**S3-210**｜关联卡（已归档）：`docs/tasks/inbox/archive/ACTIVE-S3-210-20261015.md`
工作树：`D:\Users\ZXQL\wt-agents\S3-210`｜分支 `fix/s3-210-tenant-injection-residuals`｜基线 `origin/main = 9dea3e39`（PR #323 已并入）
身份自证：`/root/s3214_ajian`（环境未注入 task_name，按 `ACTIVE.md` 路由表认领 S3-210）

## 一、交付物（逐条，含产出文件路径 + 提交哈希）

| # | 文件 | 改动 | 说明（哪里有问题 / 改了什么 / 为什么） |
|:--:|:--|:--|:--|
| 1 | `.github/workflows/ci.yml` | `Tenant injection guard` 由**观察期（`continue-on-error: true`）改回阻断**，步骤名 `(G37, blocking)`；注释改写为"观察期结束 + 40 项处置分布 + 三条证据路径" | 卡面 §一.3 明确"清完把门禁改回阻断"；S3-207 卡面亦写"清完必须改回（不得长期观察）"。**只改与该门禁是否阻断相关的最小范围**（不动 job 名、不新增 job） |
| 2 | `docs/evidence/S3-210/tools/audit-40-items.mjs` | **新增**：台账生成器 | 把 CI 报的 21+19 项机械映射到当前树的处置，**逐条给"当前行 + 处置 + 证据"**，不识别即 EXIT=1（防"人工漏一条"） |
| 3 | `docs/evidence/S3-210/raw/06-ledger-40.txt` | **新增**：40 项逐条台账（机械生成） | 卡面 §一.1/§一.2 的交付本体；40/40 无留空（统计见 §四） |
| 4 | `docs/evidence/S3-210/harness/cross-tenant-probe.mjs` | **新增**：逐语句真库对照探针（**本单独立复算**） | 对 11 条补谓词的语句，用真库做 V0 正向对照 / V1 越界 / V2 摘谓词三段读数（§四之二） |
| 5 | `docs/evidence/S3-210/harness/harness.mjs` | **新增**：S3-207 真库装置**逐行副本**，仅改默认仓库与 raw 输出目录两行（文件头已注明） | 为在**当前 main 树**上独立复跑同一套端到端对照（不改原装置） |
| 6 | `docs/evidence/S3-210/raw/01–20-*.txt` 等 | **新增**：CI 原始日志、门禁读数、反测红/绿、vitest/tsc/build、真库读数 | 全部为**原始输出**落盘（§三） |
| 7 | `docs/evidence/S3-210/README.md` | **新增**：证据包索引 + 未覆盖清单 | 便于凌舟按图复跑 |
| 8 | `docs/tasks/cards/R101-S3-210-阿坚-回传.md` | **新增**：回传卡（与本回执同内容） | 派单规范 R3「回传内容同样必须落卡」 |
| 9 | `docs/tasks/inbox/archive/ACTIVE-S3-210-20261015.md` | **本分支存档**派单卡副本（原卡在共享工作区、未纳入 git，见 §六.4） | 卡面要求"卡移入 archive"；受限说明见 §六.4 |

**零业务代码改动、零 DDL、零迁移、零前端改动**：本单**只**改 CI 阻断状态与证据；`backend/src/**` 一行未动（指纹见 §三）。

## 二、证据（可复跑：命令 + 原始输出 + 文件路径）

MySQL 8 在 `127.0.0.1:3408`；本单所有装置**只操作 `s3207_` 前缀库**、生产库零写操作。

| 判据 | 命令 / 出处 | 原始读数（文件） |
|:--|:--|:--|
| **① 复现全量（先补齐到 CI 口径）** | `gh run view --job 116406000398 --log`（run `38730257760`，headSha `3358a9e0`，CI 的合并树 = 分支 + main `2fe8f109`） | `raw/03-ci-3358a9e0-guard-section.txt`：`BLOCK-MISSING-TENANT-CONDITION=21`、`RED 未登记的非字面量/插值调用点：19 条` |
| **② 40 项逐条台账** | `node docs/evidence/S3-210/tools/audit-40-items.mjs` | `raw/06-ledger-40.txt`（`EXIT=0`）；统计：21 = 10 补谓词 + 7 平台标记 + 4 单表登记；19 = 17 登记 + 2 消解 |
| **③ 门禁恢复阻断** | `.github/workflows/ci.yml` diff（`raw/05` 之外单独可见：`continue-on-error` 行被删除、步骤名改 `blocking`） | 见 §三之二 |
| **④ 门禁当前绿（本树）** | `node backend/scripts/guard-tenant-injection.mjs` | `raw/01-guard-main-head.txt`：`调用点：1744｜OK-AUTO-INJECT=557 INDIRECT-NEEDS-REVIEW=26 OK-TENANT-CONDITION=1112 OK-MARKER=9 WARN-AUTO-INJECT-JOIN=36 REVIEW-SINGLE-TABLE-INJECT=4`＋`GREEN 无阻塞项`，`EXIT=0` |
| **④ 门禁 CI 侧绿（等价证明）** | run `38743695375`（headSha `382d19ce`，与 main `9dea3e39` 后端源码同源） | `raw/04-ci-382d19ce-build-and-test.log`：同一行计数 + `GREEN 无阻塞项` |
| **⑤ 反测①离线夹具** | `node docs/evidence/S3-207/tools/reverse-test-guard.mjs` | `raw/07-guard-offline-reverse-test.txt`：**PASS 4 / FAIL 0** |
| **⑤ 反测②源码侧造违规 ⇒ 红** | 新增探针 `backend/src/services/s3210-reverse-probe.service.ts`（JOIN 列对列等值、WHERE 无值谓词）后跑门禁 | `raw/08-guard-red-after-injected-violation.txt`：`EXIT=1`、`BLOCK-MISSING-TENANT-CONDITION=1`、点名 `services/s3210-reverse-probe.service.ts:7` |
| **⑤ 反测②复原 ⇒ 绿** | 删除探针后重跑 | `raw/09-guard-green-after-restore.txt`：`EXIT=0`、`GREEN 无阻塞项` |
| **⑥ 真库端到端（独立复算）** | `node docs/evidence/S3-210/harness/harness.mjs` | `raw/19-harness-full.txt`：**PASS 20 / FAIL 0 / EXIT=0**；`/reports/profit` 成本 **20986 = A 单独**（含 B 为 120886）、`business-overview` 库存金额 **172096 = A 单独**（含 B 为 182096）、探针 P1 改前 **8(A+B)**／改后 **6(A)**、P2 **1052** 响亮失败 |
| **⑦ 逐语句真库对照（本单新增）** | `node docs/evidence/S3-210/harness/cross-tenant-probe.mjs` | `raw/20-cross-tenant-probe.txt`：**PASS 11 / FAIL 0 / EXIT=0**（每行 `V0≥1 可达；V1=0 阻断；V2≥1 承重`） |
| **⑧ 全量单测** | `cd backend && npx vitest run` | `raw/10-vitest.txt`：**664 文件 / 8035 用例 / 0 failed**，`EXIT=0` |
| **⑨ 类型门禁** | `cd backend && npx tsc -p tsconfig.json --noEmit` | `raw/17-tsc.txt`：**0 错**，`EXIT=0`（**注**：仓库根无 `tsconfig.json`，必须在 `backend/` 下跑） |
| **⑩ 构建** | `npm --workspace backend run build` | `raw/18-build.txt`：`EXIT=0` |
| **⑪ 六道 guard** | 见 `raw/15-guard-suite-summary.txt` | route-auth／tenant-status／route-prefix／utf8-encoding／`rbac-wiring --strict`／tenant-injection **全部 EXIT=0** |

### 二之二、逐语句真库对照（`cross-tenant-probe.mjs`）的三个变体

- **V0 正向对照**：已交付 SQL + **调用者自己的 A 键** ⇒ 命中 ≥1 —— 用来排除"0 行是 JOIN 连不上/表里没数据"的**假绿**；
- **V1 越界**：已交付 SQL + **A 租户** + **B 租户的键**（B 会员/B 购物车/B 单品/B 门店/B 审批人） ⇒ **命中 0**；
- **V2 等价改前**：把该 `tenant_id = ?` 谓词**摘掉**（= 旧判据短路不注入的效果） ⇒ **命中 ≥1**。

覆盖 11 条语句（SQL 从源码**原样抽取**、占位符数与参数数逐条核对）：`admin/cart` getCartList／addToCart／checkoutPreview×2；
`miniapp/cart` getCartList／addToCart；`store/member` getMemberDetail；`transfer-execution` getInTransitOrders／getMyShipments；
`admin/approval-records` listTasks；`admin/report` getInventoryTurnover（聚合：V1=2096=A 单独 / V2=202094=A+B）。

## 三、40 项台账摘要（每一条都有判定 + 处置 + 证据，无留空）

| 规则 | 条数 | 处置 | 证据形态 |
|:--|:--:|:--|:--|
| `BLOCK-MISSING-TENANT-CONDITION` | 10 | **补显式租户值谓词** `xxx.tenant_id = ?` + 参数插在**其所在位置**（参数顺序我逐条核对过占位符顺序） | `raw/05-pr323-code-diff.patch.txt` + `raw/06-ledger-40.txt` 的"当前行 + 当行原文" |
| 同上 | 7 | **平台显式标记** `/* tenant-scope:platform */` | `backend/src/routes/subscription.routes.ts` 全 15 条路由均带 `requirePlatformAuth` / `routeConfig.auth="requirePlatformAuth"` ⇒ 跨租户是功能本身（已核对源码） |
| 同上 | 4 | **单表登记**（`t_print_record`×2 按主键读、`t_customer_visit`×2 明细） | `backend/scripts/fixtures/tenant-injection-exemptions.json` 的 `singleTable`（逐条写理由） |
| `INDIRECT-UNREGISTERED` | 17 | **登记表登记**（逐条写理由：语句自带值谓词 / JOIN 数 / 分析记录路径） | 同上 `indirect` 表（26 条登记覆盖 26 个调用点） |
| 同上 | 2 | **随补谓词/加标记消解**（`admin/cart.service.ts:373`、`admin/subscription.service.ts:130`） | 门禁当前 26 个调用点里已不含这两处（`raw/01` vs `raw/03` 逐条差异） |

## 三之二、本单的代码改动（只有一处）

```diff
       - name: Tenant injection guard (G37, 观察期·advisory)
         if: always()
-        continue-on-error: true
         run: node backend/scripts/guard-tenant-injection.mjs
+      - name: Tenant injection guard (G37, blocking)
+        if: always()
+        run: node backend/scripts/guard-tenant-injection.mjs
```

（同时把上方注释块从"观察期"改写为"观察期结束 + 40 项分布 + 三条证据路径"；`backend/src/**`、`deploy/**`、`R101-收口总清单.md` **零改动**。）

## 四、验收自评（逐条对照派单卡 §二）

1. **40 项逐条台账、无一条留空**（§二.1）：✅ **通过**。`raw/06-ledger-40.txt`，脚本对"未识别处置"直接 `EXIT=1`（本轮最终 `EXIT=0`）；统计与 CI 侧 21+19 对得上。
2. **真泄露项的"A 令牌只读到 A"真库证据**（§二.2）：✅ **通过**。① 端到端装置 `PASS 20/0`（profit 20986 / 库存金额 172096 = A 单独，含 B 分别为 120886 / 182096）；② **逐语句**真库对照 `PASS 11/0`，每条都有 V0 正向对照排除假绿。**覆盖度声明**见 §七.3（11 条逐语句 + 其余由端到端装置的 `[5d][5e][7a][7b]` 覆盖）。
3. **门禁恢复阻断（`.github/` diff 可见）+ CI 侧该步骤绿的证据**（§二.3）：✅ **通过（等价证明）**。diff 见 §三之二；CI 侧绿 = run `38743695375`（headSha `382d19ce`，同一合并树、同一门禁 blob `af6c9542970b5c61`）的 `GREEN 无阻塞项`。**未做 push 后 CI 实跑**，理由与卡面红线冲突见 §七.1。
4. **反测两侧齐（红/绿原始输出）**（§二.4）：✅ **通过**。离线夹具 4/4（`raw/07`）+ 源码侧红（`raw/08`，`EXIT=1` 且点名目标文件）/ 复原绿（`raw/09`，`EXIT=0`）。
5. **全量门禁**（§二.5）：✅ **通过**。`npx vitest run` **664 文件 / 8035 用例 / 0 failed**（`raw/10-vitest.txt`）；`npx tsc -p tsconfig.json --noEmit` **0 错**（`raw/17-tsc.txt`）；六道 guard 全 `EXIT=0`（`raw/11–16` + `raw/15-guard-suite-summary.txt`）；`npm --workspace backend run build` `EXIT=0`（`raw/18-build.txt`）。

## 五、五、输入指纹（防"并行会话改了同一棵树"）

`origin/main = 9dea3e395bee8b778fbde646b91ea01dd8590193`；`git status --porcelain` = ` M .github/workflows/ci.yml` ＋ `?? docs/evidence/S3-210/`（无第三方改动）。
`guard-tenant-injection.mjs` = `af6c9542970b5c61`｜`tenant-injection-exemptions.json` = `a834c6c7a80d8aa2`｜`tenant-scope-corpus.json` = `7025009b1cb8f31f`｜
`tenant-scope.ts` = `0efe6aa4cdcc422c`｜`database.ts` = `6c77fa749790201e`（**与 S3-207 回执指纹一致** ⇒ 判据树未被改）｜`ci.yml`（改后）= `88b8249808957491`。

## 六、未完成与阻塞

1. **未 push / 未开 PR**（红线遵守）⇒ 分支 `fix/s3-210-tenant-injection-residuals` 仅在本地工作树，`HEAD` 见 §七.7 的提交清单；**该分支只有一个提交**（ci.yml + 证据包）。
2. **未做"门禁 CI 侧反测"（分支+PR 造错）**：门禁铁律 §3 的标准做法是分支+PR，与本卡 §三红线（不得 push / 不得开 PR）冲突 ⇒ 我只做了离线夹具 + **源码侧**红/绿；CI 侧反测请由你发起（我配合）。
3. **`docs/tasks/current-tasks.md` 未改**：该文件当前无任何 S3-2xx 条目（S3 账目在 `ACTIVE.md` 路由表与 cards 里），且改动会与在途会话撞车 ⇒ 交你统一记账（与 S3-207 同口径）。
4. **派单卡与路由表都没动共享树**：`docs/tasks/inbox/ACTIVE.md` 与 `ACTIVE-S3-210.md` **都只存在于共享工作区（主检出）**、**未纳入 git**（`git ls-files` 可验：我的工作树里根本没有这两个文件）⇒
   我按 `ACTIVE.md` 的"只动自己的工作树与本分支"行事：**只在本分支** `docs/tasks/inbox/archive/ACTIVE-S3-210-20261015.md` 存了一份卡副本（带归档说明抬头），
   **没有**去移动/删除共享树里的原卡，也**没有**改路由表。**请你在共享树里归档并更新 S3-210 那一行状态**（这属于你的记账范围）。
5. **无技术阻塞**：本单全部判据（40 项台账 / 门禁阻断 + 两侧反测 / 真库 A-only / 全量门禁）均已跑通并落盘。

## 七、风险与自我报备

1. **卡面前提与仓库现状不一致（最重要，必须报备）**：卡面按"40 项**待清**、门禁现为观察期"下达，但那 40 项是 **CI 在 `3358a9e0` 上**的读数；
   同一 PR 的后续提交 `92879647`（"根因收紧的连带面 —— 机器枚举 13 处同家族缺失租户谓词 ＋ 9 处平台显式标记"）**已把 40 项逐条处置**，
   时间线：`3358a9e0` 推 CI（12:00 前后，门禁红 40 项）→ `92879647`/`e8bc5ed9`（修 + 证据）→ `382d19ce` **把门禁转观察期** → PR #323 合并（main `9dea3e39`）。
   也就是说：**观察期是在"修复已进分支"之后才设置的**；`382d19ce` 那次 CI（run `38743695375`）里门禁其实已经 `GREEN`。
   我没有据此跳过任何一步——仍把 40 项逐条列出、逐条定性，并对 11 条语句做了**真库复算**；但请你在裁定里注意"卡面 vs 现状"的这处落差，避免把它当成"执行方少做了 40 项修复"。
2. **我没有重写任何业务代码（含那 40 项对应位置）**：因为它们在 `9dea3e39` 上已是"补谓词/加标记/登记"的终态，且**只改有问题的地方**是硬规定。
   我做的替代动作是**独立复核**：① 逐条映射到当前行并核对当行原文；② 核对占位符顺序与参数顺序（多参数语句逐条看代码，见 §三）；③ 真库逐语句 V0/V1/V2 三段读数。
3. **真库对照的覆盖度（不得读成"全覆盖"）**：`cross-tenant-probe.mjs` 覆盖 **11 条**语句；`report.getInventorySummary`、`report.getInventoryAge` 与两组 headline 泄露（finance 成本 / business-overview 库存金额）由 `harness.mjs` 的 `[5d][5e][7a][7b]` 覆盖（同一机制、同一夹具、同一次运行）。
   仍未做"每条语句一条 HTTP 端到端请求"级别的证据，理由是夹具要为 13 张表各造 A/B 数据、成本远超本单收益；若你要这个口径，我另立单做。
4. **我自己的探针一开始是"假绿"，已自查并修掉（过程留痕）**：第一版 `cross-tenant-probe.mjs` 里越界键的租户参数解析成了 `undefined`
   （`ids.tenantA` 没赋值）⇒ `tenant_id = NULL` 也返回 0 行，**"V1=0 阻断"这个结论当时是假的**（0 行不是因为租户隔离，而是因为参数是 NULL）。
   修法：补上 `tenantA/tenantB`，并新增 **V0 正向对照**（同一条语句 + 调用者自己的 A 键 ⇒ 必须命中 ≥1）。现在的 11 行读数都是 `V0≥1 / V1=0 / V2≥1`。
   这条与本项目"假门禁"教训同族，建议收录：**"两个变体都返回 0"看起来像通过，其实可能是夹具/参数坏了**。
5. **门禁仍有 36 条 `WARN-AUTO-INJECT-JOIN` 与 4 条 `REVIEW-SINGLE-TABLE-INJECT`（按设计不阻断）**：前者是"靠自动注入兜底、第二张表也有 `tenant_id` 时会 1052"的隐患（S3-207 §七.3 建议按 FROM 首表别名限定列名，另立单）；
   后者是 4 处单表登记。本单**未改**这两类口径（卡面只要求"清完 40 项并恢复阻断"）。
6. **`guard-tenant-injection` 进 CI 后的分支保护口径**：本步骤**不新增 job、不改 job 名**（避免 required checks 漂移，S3-176/S3-49 教训）；是否把它并入 required 集合属你的口径，我未动。
7. **本地提交**：`fix/s3-210-tenant-injection-residuals` 上单笔提交，内容 = `.github/workflows/ci.yml`（去 `continue-on-error` + 注释）+ `docs/evidence/S3-210/**` + 归档的派单卡 + 回传卡；**未 push**。
8. **提交信息口径**：本单改动性质是"门禁接线 + 证据"，按项目格式用 `ci:`（若无此 type，请指示改成 `chore:`/`fix:`，我重写提交信息）。

回传要求：本汇报已落卡 `docs/tasks/cards/R101-S3-210-阿坚-回传.md`（同内容）；子代理通道回执为本文件（`docs/tasks/inbox/ACTIVE-回执-S3-210.md`）。
关联卡：`docs/tasks/inbox/archive/ACTIVE-S3-210-20261015.md`｜证据包：`docs/evidence/S3-210/README.md`

