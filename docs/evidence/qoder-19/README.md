# QODER-19 · 四卡合并与门禁基线收敛 —— 证据树

> 执行方：Qoder（移动端执行方）｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-19`｜分支：`chore/qoder-19-baseline-convergence`
> 基线：`21b465e5`（= 当前 `origin/main`）｜集成分支尖端（四笔 merge 后）：`0963459d`
> 任务书原件（只读引用，未修改未删除）：`docs/tasks/inbox/QODER-19-baseline-convergence.md`
> 共享执行协议：`wt-agents/_qoder-restack-exec-protocol-20261021.md`

## 零、本单性质与归属

四笔 merge commit 由**负责人（主代理）**完成，本单**不重做 git 机制、不 rebase、不改合并历史**。
执行方的工作是把合并终态**复跑成可核对的原始读数**并做**五轮反测**，全部改动只有本 `docs/` 证据树。

`raw/` 每份文件顶部都写了命令、工作目录、时间戳、分支与 HEAD；`EXIT=` 行为判据本体。
本树**无零字节文件**（`find -empty` = 0）；`raw/` 编号 01–16 连续无跳号。

## 一、`raw/` —— 四门 + 三构建 + 改动面 + 合并取证 + 收尾自检

| 文件 | 命令 | 内容与实际读数 |
|:--|:--|:--|
| `01-type-check.txt` | `npm run type-check`（`scripts/type-check-gate.mjs`） | vue-tsc EXIT=0，当前错误 0 / 基线 0 ⇒ **EXIT=0** |
| `02-lint.txt` | `npm run lint`（`scripts/lint-gate.mjs`） | error **20**（基线 20）/ warning **12872**（基线 12872），逐规则不劣化 ⇒ **EXIT=0** |
| `03-test.txt` | `npm run test`（`scripts/test-gate.mjs`） | vitest **10 文件 / 184 用例全过**，基线 10/184 不劣化 ⇒ **EXIT=0** |
| `04-check-contract.txt` | `npm run check:contract` | A.2 三口径 292 / 283 / 204，后端注册 1498，差集 1 条且具名豁免 1 条 ⇒ **EXIT=0** |
| `05-build-h5.txt` | `npm --workspace app-mobile run build:h5`（**仓库根**） | `DONE Build complete.` ⇒ **EXIT=0** |
| `06-build-mp-weixin.txt` | 同上 `build:mp-weixin` | `DONE Build complete.`（含 H5 专用组件 `custom-tab-bar` 既存告警，非本单引入）⇒ **EXIT=0** |
| `07-build-app.txt` | 同上 `build:app` | `DONE Build complete.`（含 `scan.ts` 动静态混合导入既存告警）⇒ **EXIT=0** |
| `08-diff-stat.txt` | `git diff 21b465e5..HEAD --stat` | 230 文件 / +11054 / −17：八类 src+tests 文件 + 四卡原有证据与回传 + 本单 `gates-baseline.json` 的 tests 段 |
| `09-diff-backend.txt` | `git diff 21b465e5..HEAD -- backend/src`；`-- backend/` | 两条判据均 **0 字节**（文件本体非零字节，含命令、HEAD、字节数实测与"比卡口径更严"的说明） |
| `10-diff-app-mobile-src.txt` | `git diff …stat/name-only -- app-mobile/src` + 逐文件 `git log` 归属 | src 共 6 个文件，逐项追到 `e3a4a7d0 / 81ef5c07 / 8c09cfbd / 5dbf1453 / 6b6fb197 / 477acdca`（全部属四卡分支既有提交）⇒ 本单零业务码 |
| `11-merge-commits.txt` | `git log --merges`、`git rev-parse <m>^1/^2`、`git merge-base --is-ancestor` | 链式 `21b465e5 → 0ddcc3d2 → 25663f73 → bcf4f4e0 → 0963459d`，四笔的被并尖端均为其第二父（固定序 14F1→15F1→16R→17F1 成立） |
| `12-gates-baseline-conflict.txt` | `git show <rev>:app-mobile/scripts/gates-baseline.json` + merge-base 判据 | 逐笔列 merge-base／父1／父2／结果的 tests 段；merge1 单侧改动=自动合并，merge2/3/4 双侧改 tests=真冲突；非 tests 四段与父1 **完全一致**；终态 10/184 与 note 四条逐项来源核对 |
| `13-tests-delta-arithmetic.txt` | 同上（增量口径） | 各分支尖端相对 `dfeedbc0` 的独立增量 = 14/102/8/4，与卡 §二.3 组成逐项匹配；累积收敛 10/184 与终态一致 ⇒ 无重复计数、无丢失 |
| `14-workspace-form-trap-negative-control.txt` | `npm --workspace app-mobile run build:h5`（故意在 `app-mobile/` 内） | `npm error No workspaces found` **EXIT=1** —— 已知坑复现的**负面控制**，不是构建失败；本单三构建（05/06/07）均在仓库根执行且全绿，无需作废读数 |
| `15-final-gate-sweep.txt` | `npm run check:gates`（四门串行） | 五轮反测触碰过 5 个文件（均已复原）后，在终态复跑四门 ⇒ **EXIT=0**（error 0/0、lint 20/12872、test 10/184、contract 差集全豁免） |
| `16-closeout-checklist.txt` | 协议 §7 收尾七项 | `git status` 仅列本单待提交 docs、`origin/main..HEAD` 笔数、改动面字节数、src 六项清单、四门三构建 EXIT 汇总、gates-baseline 未被本单写入的核对 |

> `17-post-commit-final-check.txt` 在第二笔 docs 提交时补写（提交后的终态 `git status`），
> 故本 README 编号说明覆盖 `raw/01–16` + `raw/17`；README 自身不计入 raw 编号序列。

## 二、`anti/` —— 五轮反测（门必须能红，原子自复原）

每轮固定七步：注入前 `sha256sum` → `cp` 备份到 `wt-agents/_scratch/qoder-19/` → 树外 `.mjs`（latin1 字节精确，
命中数≠1 即 `exit 9` 拒写）注入 → 跑门取红并点名 → `cp` 复原 → 复原后 `sha256sum` 与注入前比对 → 复跑转绿。
每轮目录内文件：`00-pre-sha256` / `01-inject` / `02-test-red` / `03-restore-sha256` / `04-test-green` / `05-walkthrough`。

| 目录 | 注入内容（卡点名功能） | 红点名（实测逐条） | RED | SHA 复原 | GREEN |
|:--|:--|:--|:--|:--|:--|
| `a1-auth-cleanup/` | 摘 `request.ts` 的 `uni.removeStorageSync('merchant_tenant')`（10155→10115 字节） | 14F1 `request-retry-safety.spec.ts` 的 **④ / ⑩ / ⑫**（3 条） | EXIT=1 | `d7f2cf73…` 逐字节一致 | EXIT=0 10/184 |
| `a2-price-compare/` | `price-anomaly.vue` 的 `isBelowCost(item.retailPrice, item.costPrice)` → `item.retailPrice < item.costPrice` | 15F1 静态门 4 条 + **字符串低价 retail "9.00"/cost "12.00" 卡点名复现条** 等共 8 条 | EXIT=1 | 逐字节一致 | EXIT=0 10/184 |
| `a3-manifest-privacy/` | `src/manifest.json` 删一行 `"NSCameraUsageDescription"`（dropline 连 EOL 一起移除，5652→5413） | 16R `mobile-permissions.spec.ts` 的 **"iOS 六个隐私描述键齐备…"** + "每条隐私描述与其真实功能对得上" | EXIT=1 | 逐字节一致 | EXIT=0 10/184 |
| `a4-viewport-fit/` | `index.html` 删 `, viewport-fit=cover`（544→524） | 17F1 `safe-top-var.spec.ts` 的 **断言④**（viewport meta 必须同时含 `width=device-width` 与 `viewport-fit=cover`） | EXIT=1 | 逐字节一致 | EXIT=0 10/184 |
| `a5-baseline-freeze/` | `gates-baseline.json` 的 `testCount` 184 → 200（**基线冻结门自身**） | 184 用例**全过**仍判红：`✗ 用例数劣化：10 文件/184 用例 < 基线 10/200（少 16 条）` | EXIT=1 | 逐字节一致（CRLF 55→55 未被归一） | **attempt1 撞上一条与本注入无关的既存随机不稳定用例**（`storage-crypto.spec.ts` tag 校验条，EXIT=1，原样存档 `04-…attempt1-unrelated-flake.txt` + `04a-…flake-note.txt` 四条无关性依据）；attempt2 `05-test-green-attempt2.txt` **EXIT=0 10/184** |

第⑤轮的 `06-walkthrough.txt`（其余四轮为 `05-walkthrough.txt`）；
`a5` 无 `04-test-green.txt` / 无 `05-walkthrough.txt` 的原因是 attempt1 读数需保留原名原内容，
第 2 次转绿另立 `05-test-green-attempt2.txt`，汇总因此顺延为 `06`（协议 §5"新读数另存新文件号，不改写原始输出"）。

## 三、工具与外部文件（不在本树内，仅登记路径）

- 注入器：`D:\Users\ZXQL\wt-agents\_scratch\qoder-19\q19-anti-inject.mjs`
- 单轮原子流程：`D:\Users\ZXQL\wt-agents\_scratch\qoder-19\q19-anti-round.sh`
- 命中数预检：`D:\Users\ZXQL\wt-agents\_scratch\qoder-19\q19-needle-check.mjs`
- 五个复原备份：`_scratch/qoder-19/q19-a1-request.ts.bak`、`q19-backup-anti-a{2,3,4,5}-*`
  （负责人在该目录的既有 git 辅助脚本 `resolve-conflict.mjs`、`set-tests.mjs`、`note*.txt`、`resolve-step*.txt` **未改未删**）

## 四、判据自评（卡片要求的目标读数 vs 实测）

| 卡 §三 判据 | 目标 | 实测 | 证据 |
|:--|:--|:--|:--|
| type-check | EXIT=0 | 0 / 0 | `raw/01` |
| lint | EXIT=0，error 20 / warning 12872 不劣化 | 20 / 12872，逐规则一致 | `raw/02` |
| test | 10 文件 / 184 用例全过 | 10 / 184 | `raw/03` |
| check:contract | EXIT=0 | 差集 1 条全具名豁免 | `raw/04` |
| 三构建 | 均 EXIT=0 | h5 / mp-weixin / app 全 0 | `raw/05–07` |
| backend diff | `-- backend/src` = 0；`backend/` 仅允许四卡原有台账/证据变化 | **0 字节（两条口径都是 0）** | `raw/09` |
| 工作树 | clean | 反测五轮全部复原；docs 提交后为空 | `raw/16`、`raw/17` |

**未验项**（详见回传卡 §⑦）：iOS/Android/WKWebView 真机安全区与隐私弹窗、微信开发者工具与小程序后台、
登录态整页 E2E、PNG 目视、后端联调、`storage-crypto.spec.ts` 随机不稳定用例的根治（未改其代码，只登记）。
