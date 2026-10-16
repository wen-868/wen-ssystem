# ACTIVE-回执 · **S3-227**（门禁与判据改进批）— **已完成**

> 汇报对象：**凌舟（总负责人）**｜汇报人：**阿坚（后端 / 门禁）**｜日期：**2026-10-16**｜派单编号：**S3-227**
> 认领名（路由表）：`/root/s3232_gate`｜卡：`docs/tasks/inbox/ACTIVE-S3-227.md`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-227`｜分支：`chore/s3-227-gate-semantics-and-counts`
> 详细十项回传：`docs/tasks/cards/R101-S3-227-阿坚-回传.md`

## 一、改了什么（三条，零业务代码改动）

| 条目 | 内容 | 关键读数 |
|:--|:--|:--|
| **A** 跨批计数 | `rbac-g0-wiring.test.ts`：删除裸数字断言 `expect(total).toBe(226)`，保留和式；新增「和式 == 台账 `_counts.wiredPermOccurrences`」+「`_counts` 自洽（缺口+消费者端+只读登记+已接线 == 扫描总数）」两条断言；baseline `_counts` 增补 `wiredEndpoints`/`scannedEndpoints`/`wiredPermOccurrences` | 用例 148 passed；改错常量 ⇒ 632 行红；只改台账 ⇒ 658 行红 |
| **B** 消费者端声明式识别 | `guard-rbac-wiring.mjs`：现场解析 `shared/auto-routes.ts:getAuthMiddlewares`，取「成对含消费者认证 + `csrfMiddleware`」的 auth 取值；**按声明的 router 变量**归类（非文件白名单）；解析失败则保守落回缺口。`cart.routes.ts` 6 条 ⇒ `consumerEnd` 并逐条登记 | 缺口 469/129 → **463/128**；消费者端 39/4 → **45/5**；改前后 JSON 逐行 diff：**仅 6 行** `none→consumer`，路径 0 增 0 删 |
| **C** 查询型 POST 登记 | `guard-rbac-wiring.mjs` 新增 `READ_ONLY_POSTS`（路径 + 理由 + 归属单 + 裁定依据）+ 三道闸门（必填项 / 人读台账「同一行含路径 + 『查询型』」交叉核对 / 拒不生效即回落缺口）；3 条已裁定端点移出 `gaps` 并逐条打印 | 缺口 463/128 → **460/127**；查询型 POST 登记 **3/3** |

同步：机读台账 `rbac-wiring-baseline.json`（逐条移动 + `_counts` + `_s3227_note`/`_s3227_b_note`/`_s3227_c_note`）；
人读台账 `R101-RBAC接线缺口清单.md` 新增 **「附·S3-227」**（判据明细 + 6 条 consumerEnd 判定 + 3 条只读判定 + 守恒/反测/卡外观察；章节号用「附」以免占用 S3-226 顺延的正文章节号）。

## 二、证据（可复跑 + 原始输出，全在 `docs/evidence/S3-227/`）

- 改前：`00-before/guard-report.txt` / `guard-strict.txt` / `guard-json.json` / `g0-test.txt`（469/129、consumerEnd 39/4、已接线 255、扫描 763、148 用例绿）
- A：`20-A-after.txt`（绿）、`21-A-countertest-constant.txt`（红 632 行）、`22-A-countertest-ledger.txt`（红 658 行）、`23-A-diff.txt`
- 口径对照：`10-metric-diff.txt`（用例口径 226 vs 门禁口径 255，差 29 = 平台 +32 − 非写端点 −3）
- B：`30-B-after-json.json` + `37-B-json-diff.txt`（仅 6 行变化）、`31-B-strict-unregistered.txt`（EXIT=1）、`32-B-strict-after-ledger.txt`（EXIT=0）、`33~36-B-countertest*.txt`（四组反测）
- C：`40-C-after-report*.txt`、`41-C-strict-after-ledger.txt`（EXIT=0）、`42-C-countertest-reject.txt`（真写端点登记被拒）、`43-C-countertest-strict.txt`、`44-C-g0-test.txt`、`45-C-diff.txt`
- 全量回归：`50-full-vitest.txt`（**676 文件 / 9085 用例 / 0 failed**）、`51-tsc.txt`（0）、`52-lint.txt`（0 error）、`54-guards-summary.txt`（7 条门禁全 EXIT=0）、`53/55/56-guard-*.txt`

## 三、未完成与阻塞

**无阻塞**，派单卡 A/B/C 三条全部完成。
⚠️ **一处未完全达成（已报备，非阻塞）**：§三.1 要求"两批并行改同一文件不再冲突"，本单只做到"**删除会静默丢数的裸数字行**"；
和式项行与逐文件 map 的两行仍是跨批共享行（改成"自注册式"需大改 15 个批次块、且 S3-226 正在改同一文件）⇒ 列为待裁定项。
现有四道判据保证"取一侧"必然变红，不会静默绿。

## 四、待裁定项（本单不动手）

1. 其余"疑似查询型"POST（台账 附.5 列 7 条，其中 `marketing/calculate` 属 S3-226 在办域）是否逐条裁定并登记；
2. 是否把 15 个批次常量块改自注册式（消除 §三 的共享行）；
3. `_counts` 与实时扫描一致性是否升级为 `--strict` 判红（现为逐次打印提示）；
4. `guard-rbac-wiring` 是否接 CI（本单未改阻断口径，前置条件不变）；
5. 回传文档是否合入 main。

## 五、纪律说明（两处按"多单并行约定"处置，特此署名报备）

1. **未动 `docs/tasks/inbox/ACTIVE.md`**（未归档）：该文件是**并行 5 单共用**的路由表（S3-223/224/225/226 仍在办），
   按项目 AGENTS.md「子代理回传」字面应把 `ACTIVE.md` 移入 `archive/` —— 但那样会让其余 4 单失去路由表。
   故按 S3-225 已确立的并行约定：**只写本单回执**（`ACTIVE-回执-S3-227.md`），`ACTIVE.md` 保持原样，**由派单方在本批收口时统一归档**。
2. **未动 `docs/tasks/current-tasks.md`**：派单卡 §四.2 明令不得改。

另：本单**未 push、未开 PR、未 `git add -A`**；未动 `.github/**`、`deploy/**`、`docs/migrations/**`、收口总清单、其它单工作树；
反测临时改动的 4 个文件已逐字节复原（SHA256 见回传卡 §九），临时目录 `_s3227_tmp/` 已删除。
