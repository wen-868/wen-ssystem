# QODER-20 证据树 · 移动端最终集成与单基线 11/186

> 执行方：Qoder（移动端执行方）｜日期：2026-10-21｜工作树：`D:\Users\ZXQL\wt-agents\QODER-20`
> 分支：`chore/qoder-20-mobile-final-integration`｜基座：`cdf16ce4`（QODER-19 尖端，10/184）
> 三笔合并：`9ff7a47c`（← 13F2 `99371862`）→ `c1e4cd40`（← QODER-18 `bd7e158f`）→ `50b03a51`（← QODER-11R `df583401`）
> 合并后补写笔：`602d9d36`（tests.note 追加「最终集成单⑦」留痕，tests 读数不变）
> 回传卡：`docs/tasks/cards/R101-QODER-20-回传.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-QODER-20.md`
> 本目录为 QODER-20 首轮证据，无同名历史目录，未覆盖任何旧读数。

## 命令形态（本卡一律用这一种）

`cd` 到**工作树根**再跑 `npm --workspace app-mobile run <gate>`。在 `app-mobile/` 目录内跑 `npm --workspace` 会 `No workspaces found`（命令形态错误，非构建失败），本轮未采信任何此类日志。退出码一律 `命令 > tmp 2>&1; rc=$?` 现场取，**不经过管道**（管道末位命令会改写 `$?`）。

## 文件与关键读数

| 文件 | 内容 | 关键读数 / EXIT |
| --- | --- | --- |
| `raw/00-premerge-base.log` | 合并前基座 `cdf16ce4` 的 tests/lint 读数与四门包装存在性 | tests `10/184`、lint error 基线 20 / 13 个 文件::规则 对 |
| `raw/10-gates-check.log` | 卡 §三 首条：`npm --workspace app-mobile run check:gates` 串行四门 | `CHECK_GATES_EXIT=0`，内含 test 门 `当前 11 文件 / 186 用例，基线 11 / 186` |
| `raw/11-gate-type-check.log` | 门 1 单跑 | `vue-tsc EXIT=0，当前错误 0 条，基线 0 条`，`EXIT=0` |
| `raw/12-gate-lint.log` | 门 2 单跑 | `当前 error 20（基线 20）、warning 12872（基线 12872）`，`EXIT=0`；门自带 ⚠ 提示「error 级不许长期冻结」⇒ 清零在 QODER-21 |
| `raw/13-gate-test.log` | 门 3 单跑（合并态实测） | `Test Files 11 passed (11)`、`Tests 186 passed (186)`，逐文件用例数见表下「186 的构成」，`EXIT=0` |
| `raw/14-gate-contract.log` | 门 4 单跑 | A.2 三口径 292/283/204、后端注册 1498、差集 1 条全具名豁免，`EXIT=0` |
| `raw/20-build-h5.log` | 卡 §三 构建①：`build:h5` | `DONE Build complete.`，`EXIT=0`（`hd-scan.svg` 那条是本基线既有提示） |
| `raw/21-build-mp-weixin.log` | 构建②：`build:mp-weixin` | `DONE Build complete.`，`EXIT=0`（`custom-tab-bar` 平台告警为既有） |
| `raw/22-build-app.log` | 构建③：`build:app` | `DONE Build complete.`，`EXIT=0`（`scan.ts` 动态/静态混用告警为既有） |
| `raw/30-guard-strict.log` | `node backend/scripts/guard-rbac-wiring.mjs --strict` 全量原始输出 | 扫描 189 路由文件 · 763 写端点 · 已接线 423 / 消费者端 45 / 查询型 POST 6 / 无授权形态 289（87 文件）· gaps 已登记 289／未登记 0，`✅ [--strict] 无「未登记」项`，`EXIT=0` |
| `raw/31-guard-strict-nostale.log` | 同上 + `--no-stale` | 读数同上，`EXIT=0`。**与 30 逐字节相同**（差 0 行）⇒ 陈旧登记为 0 条，开关被走到但无可抑制项；开关能红的取证在 `docs/evidence/qoder-13/anti/anti-inject-nostale-red.log` |
| `raw/40-scope-and-redlines.log` | 卡 §三 后三条范围核验 | `git diff 21b465e5..HEAD -- backend/src` = **0 行**；backend 允许面只有 `backend/scripts/guard-rbac-wiring.mjs`；`rg upload app-mobile/src/api/request.ts` = **0 命中**（`RG_EXIT=1`）；`products.ts`/`profile.ts` 上传封装 5 处命中保留（`RG_EXIT=0`）；`git status --porcelain` 仅本证据目录 |
| `raw/41-merge-lineage.log` | 合并谱系 + 每笔 merge 实际改写文件 + 基线净 diff + note 逐项可核机检 | 三笔各自第二父 = `99371862` / `bd7e158f` / `df583401`；基线相对基座净 diff 只落在 tests 段 3 行（`testFiles`/`testCount`/`note`）；`_comment/typeCheck/lint/checkContract/contractDrift` 五段相对基座 **UNCHANGED=true**；**含 raw/41 补记段**（⑦ 留痕原判 false 的根因与处置） |
| `raw/42-blob-identity.log` | 卡 §一.5「业务实现不得被合并改写」的逐文件 blob 身份 | 正向（每笔 merge 相对第一父的变化文件逐个与第二父比哈希）：`9ff7a47c` 5 项、`c1e4cd40` 2 项、`50b03a51` 0 项 ⇒ 两笔共 7 项里**只有 `gates-baseline.json` DIFFERS（我解冲突的结果）**，`env.ts` / `permission-gates.ts` / `pin-ssl.ts` / `pin-ssl-static.spec.ts` / `request.ts` / `request-retry-safety.spec.ts` 全部 `SAME_AS_BRANCH`。反向（终态 HEAD 对比各支尖端）7 个文件逐字节一致（另含 `storage-crypto.spec.ts` 与 `backend/scripts/guard-rbac-wiring.mjs`）⇒ 终态原样保留，未被合并重写 |
| `raw/43-note7-provenance-rerun.log` | 补写 ⑦ 留痕后的四门复跑 | `CHECK_GATES_EXIT=0`，test 门仍 `11 文件 / 186 用例，基线 11 / 186`；该笔 diff = `1 insertion(+), 1 deletion(-)`，只动 note 行 |
| `raw/44-no-conflict-markers-and-merge-purity.log` | 冲突标记零残留 + 合并纯度 | `rg '^<<<<<<<\|^>>>>>>>' app-mobile/{src,tests,scripts} backend/scripts/guard-rbac-wiring.mjs` = 0 命中（`RG_MARKER_EXIT=1`）；`gates-baseline.json` `require()` 可解析（latin1 事故后形态复检）；三笔 merge 均为双父真合并 |

## 186 的构成（门 3 原始输出逐文件对账，`raw/13`）

`format 78 + permission-view-state 29 + price-anomaly-static 24 + request-retry-safety 15 + entry-gate-consistency 12 + mobile-permissions 8 + permission-codes 8 + storage-crypto 4 + safe-top-var 4 + api-base-env 3 + pin-ssl-static 1 = 186`，文件数 11。
与基座 `cdf16ce4` 的 10/184 相比：**+1 文件（pin-ssl-static.spec.ts，来自 13F2）／+1 用例（request-retry-safety 的 it⑭，来自 QODER-18）**，11R 贡献 0 用例（docs-only）⇒ 184 → 185 → 186，与卡 §二 的算式一一对应。

## 解冲突方法（可复跑，也是本卡的踩坑点）

三笔合并里只有 `app-mobile/scripts/gates-baseline.json` 的 `tests` 段冲突（前两支各一次；11R 支 docs-only ⇒ 无冲突）。解法不是手改数字，而是「预测 + 复测」两步：

1. 用 `_scratch/qoder-20/resolve-baseline.mjs` 把 `tests.testFiles/testCount` 置为该支**理论上应到的值**（13F2 ⇒ 11/185；18 ⇒ 11/186），并在 note 追加一段带来源的留痕；脚本先校验残留标记与 `JSON.parse`，命中即 `exit 9` 拒绝写盘。
2. 立刻 `npm --workspace app-mobile run test` 复跑门 3，以**实测**是否等于预测值为该笔合并的收口条件（11/185、11/186 两次均 `TEST_GATE_EXIT=0`）⇒ 基线不是手定的，是实测即基线。

事故与纠正（原文与产物都在 `_scratch/qoder-20/` 留档，未写进终态）：

- 脚本初版按 **latin1** 读又按 **latin1** 写，向含中文的 note 追加 UTF-8 文本 ⇒ 文件出现乱码与控制字符、`require()` 在 line 59 报 JSON 解析错。损坏产物保存为 `_scratch/qoder-20/gates-baseline.CORRUPTED-latin1-write.bin` 作取证；用 `git checkout -m -- app-mobile/scripts/gates-baseline.json` 回到冲突态（**不是**丢弃解决结果，因为当时还没有有效解决）后改 `utf8` 重跑。仓库内含中文的 JSON 一律 utf8 读写。
- `git checkout -m` 复原出来的标记是 `<<<<<<< ours` / `>>>>>>> theirs`，不是 `<<<<<<< HEAD` ⇒ 解冲突脚本的匹配串由 `<<<<<<< HEAD` 改为 `<<<<<<<`（marker 无关化）。
- 第一笔合并我用了 `git merge … | tail`，打印出 `MERGE_EXIT=0` 却有 CONFLICT —— 管道末位命令改写了 `$?`，该读数是假的；`UU` 状态才是真的。后续合并改为重定向后取 `$?`（本目录所有 EXIT 行均为该形态）。
- 合并后自检 `note 逐项来源可核` 打出 `最终集成单⑦:false`：这是**留痕缺项**（我的脚本只在冲突时追加 note，11R 无冲突 ⇒ 没追加）。补写见 `602d9d36` + `raw/43`，根因记录在 `raw/41` 补记段。

## 反测（门必须能红）

卡 §三 未对本卡单列反测；本卡是合并卡，不新增判定逻辑。门 3 对 `pin-ssl-static.spec.ts` 与 `request-retry-safety` it⑭ 的能红性由来源卡自证，证据链：`docs/evidence/qoder-13f2/anti/anti-{date,trustasia,dates,callsite}-red.log`（四轮，各自点名到断言行）与 `docs/evidence/qoder-18/anti/06-final-anti-atomic-valid.txt`。合并态未削弱这些断言：`raw/42` 证明两个 spec 的 blob 与来源支尖端逐字节相同。

## 零字节文件

本目录无零字节文件（`find docs/evidence/qoder-20 -type f -size 0` 输出为空）。
