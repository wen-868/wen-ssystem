# S3-210 证据包 · 清 `guard-tenant-injection` 的 40 项 → 恢复门禁**阻断**

> 工作树 `D:\Users\ZXQL\wt-agents\S3-210`｜分支 `fix/s3-210-tenant-injection-residuals`｜基线 `origin/main = 9dea3e39`（PR #323 已并入 main）
> 本包**未 push / 未开 PR**（红线）；改动在分支上**本地提交**，由凌舟复核后决定合并。
> 派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-210-20261015.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-S3-210.md`

## 一、结论（一句话）

卡面说的「40 项待处理」是 **CI 在 `3358a9e0` 上的读数**，而同一 PR 后续的 `92879647` 已把 40 项逐条落地处置；
**本单的净交付 = 把该门禁从观察期恢复为阻断（去掉 `continue-on-error`）+ 40 项逐条台账 + 独立复算的真库/门禁/反测证据。**

## 二、40 项台账（本单核心产出，机械生成、可复跑）

| 产物 | 路径 | 复跑命令 |
|:--|:--|:--|
| 逐条台账（规则/文件:CI 行/当前行/判定/处置/证据） | [`raw/06-ledger-40.txt`](raw/06-ledger-40.txt) | `node docs/evidence/S3-210/tools/audit-40-items.mjs` |
| CI 侧原始清单（21 阻塞 + 19 未登记） | [`raw/03-ci-3358a9e0-guard-section.txt`](raw/03-ci-3358a9e0-guard-section.txt) | `gh run view --job 116406000398 --log` |

**处置分布（40/40 逐条不落空）**

- 21 条 `BLOCK-MISSING-TENANT-CONDITION` = **10 条补显式租户值谓词** ＋ **7 条平台显式标记 `tenant-scope:platform`** ＋ **4 条单表登记**（注入补的正是正确谓词）
- 19 条未登记插值 = **17 条登记表登记**（逐条写理由）＋ **2 条随"补谓词 / 加标记"消解**（`admin/cart.service.ts:373`、`admin/subscription.service.ts:130`）

## 三、门禁恢复阻断 + 反测（门禁铁律）

| 判据 | 命令 / 出处 | 读数（原始文件） |
|:--|:--|:--|
| 当前树门禁整体读数 | `node backend/scripts/guard-tenant-injection.mjs` | [`raw/01-guard-main-head.txt`](raw/01-guard-main-head.txt)：调用点 1744｜`OK-TENANT-CONDITION=1112`、`OK-MARKER=9`、`INDIRECT-NEEDS-REVIEW=26`（全登记）、`WARN-AUTO-INJECT-JOIN=36`、`REVIEW-SINGLE-TABLE-INJECT=4`、**BLOCK=0** ⇒ `GREEN`，`EXIT=0` |
| **CI 侧**同一合并树读数（等价证明） | run `38743695375`（headSha `382d19ce`，与 main `9dea3e39` 后端源码同源） | [`raw/04-ci-382d19ce-build-and-test.log`](raw/04-ci-382d19ce-build-and-test.log)：同一行计数 + `GREEN 无阻塞项` |
| 反测①：离线夹具（4 例） | `node docs/evidence/S3-207/tools/reverse-test-guard.mjs` | [`raw/07-guard-offline-reverse-test.txt`](raw/07-guard-offline-reverse-test.txt)：**4/4 PASS**（合规⇒0；违规⇒1 且点名；未登记标记⇒1；复原⇒0） |
| 反测②：源码侧**造违规 ⇒ 红** | 临时新增 `backend/src/services/s3210-reverse-probe.service.ts`（JOIN 列对列等值、WHERE 无值谓词）后跑门禁 | [`raw/08-guard-red-after-injected-violation.txt`](raw/08-guard-red-after-injected-violation.txt)：`EXIT=1`、`BLOCK-MISSING-TENANT-CONDITION=1`、点名该探针文件 |
| 反测②：**复原 ⇒ 绿** | 删除探针后重跑 | [`raw/09-guard-green-after-restore.txt`](raw/09-guard-green-after-restore.txt)：`EXIT=0`、`GREEN 无阻塞项` |

## 四、真库证据（A 令牌只读到 A）

MySQL 8 在 `127.0.0.1:3408`；装置**只操作 `s3207_` 前缀库**。

| 装置 | 命令 | 读数 |
|:--|:--|:--|
| 端到端（S3-207 装置**逐行副本**，仅改默认仓库与 raw 目录） | `node docs/evidence/S3-210/harness/harness.mjs` | [`raw/19-harness-full.txt`](raw/19-harness-full.txt)：**PASS 20 / FAIL 0 / EXIT=0**。含 `/reports/profit` 成本 **20986 = A 单独**（含 B 为 120886）、`business-overview` 库存金额 **172096 = A 单独**（含 B 为 182096）、探针 P1「列对列等值」改前 **8(A+B)**／改后 **6(A)**、P2 **1052 响亮失败** |
| **逐语句**真库对照（本单新增） | `node docs/evidence/S3-210/harness/cross-tenant-probe.mjs` | [`raw/20-cross-tenant-probe.txt`](raw/20-cross-tenant-probe.txt)：**PASS 11 / FAIL 0 / EXIT=0** |

`cross-tenant-probe.mjs` 的做法（每条语句三个变体，同一次运行）：

- **V0 正向对照**：已交付 SQL + **调用者自己的 A 键** ⇒ 命中 ≥1（证明"0 行"不是 JOIN 连不上/表里没数据造成的**假绿**）
- **V1 越界**：已交付 SQL + **A 租户** + **B 租户的键**（B 的会员/购物车/SKU/门店/审批人） ⇒ **命中 0**
- **V2 等价改前**：把该 `tenant_id = ?` 谓词**摘掉**（= 旧判据短路不注入的效果），其余不变 ⇒ **命中 ≥1**（证明这条谓词是**承重**的）

覆盖的 11 条语句（SQL 从源码**原样抽取**，可核对）：`admin/cart` getCartList、addToCart、checkoutPreview×2；
`miniapp/cart` getCartList、addToCart；`store/member` getMemberDetail；`transfer-execution` ×2；`admin/approval-records` listTasks；
`admin/report` getInventoryTurnover（聚合：V1=2096=A 单独 / V2=202094=A+B）。

## 五、全量门禁

| 判据 | 命令 | 读数 |
|:--|:--|:--|
| 单测 | `cd backend && npx vitest run` | [`raw/10-vitest.txt`](raw/10-vitest.txt)：**664 文件 / 8035 用例 / 0 failed**，`EXIT=0` |
| 类型 | `cd backend && npx tsc -p tsconfig.json --noEmit` | [`raw/17-tsc.txt`](raw/17-tsc.txt)：**0 错**，`EXIT=0`（注意：仓库根无 `tsconfig.json`，必须在 `backend/` 下跑） |
| 构建 | `npm --workspace backend run build` | [`raw/18-build.txt`](raw/18-build.txt)：`EXIT=0` |
| 六道 guard | 见 [`raw/15-guard-suite-summary.txt`](raw/15-guard-suite-summary.txt) | route-auth／tenant-status／route-prefix／utf8-encoding／rbac-wiring --strict／tenant-injection **全部 EXIT=0** |

## 六、输入指纹（防"并行会话改了同一棵树"）

基线 `origin/main = 9dea3e395bee8b778fbde646b91ea01dd8590193`；`git status`：仅 `.github/workflows/ci.yml`（本单改动）与 `docs/evidence/S3-210/`（新增）。

| 文件 | sha256(前 16) |
|:--|:--|
| `backend/scripts/guard-tenant-injection.mjs` | `af6c9542970b5c61` |
| `backend/scripts/fixtures/tenant-injection-exemptions.json` | `a834c6c7a80d8aa2` |
| `backend/scripts/fixtures/tenant-scope-corpus.json` | `7025009b1cb8f31f` |
| `backend/src/shared/tenant-scope.ts` | `0efe6aa4cdcc422c` |
| `backend/src/config/database.ts` | `6c77fa749790201e`（与 S3-207 回执一致 ⇒ 同一棵判据树） |
| `.github/workflows/ci.yml` | `88b8249808957491`（本单改动后） |

## 七、未覆盖 / 范围外（诚实清单）

1. `WARN-AUTO-INJECT-JOIN`（36 条）与 `REVIEW-SINGLE-TABLE-INJECT`（4 条）**按设计不阻断**（S3-207 口径）——本单未改其口径。
2. 事务路径（`conn.query`）不经注入器、`t_product_price` 全局唯一键，仍是 S3-207 报备过的**范围外**事项。
3. 逐语句真库对照覆盖 11 条语句；`report.getInventorySummary`、`report.getInventoryAge` 与两组 headline 泄露由 `harness.mjs` 的 `[5d][5e][7a][7b]` 覆盖（同一机制、同一夹具）。
4. **CI 侧"推送后跑一次"未做**：卡面 §三 红线禁止 push / 开 PR，故以"CI 已在同一合并树上绿 + 本地同命令绿 + 两侧反测"作**等价证明**（详见回执 §七.1）。
