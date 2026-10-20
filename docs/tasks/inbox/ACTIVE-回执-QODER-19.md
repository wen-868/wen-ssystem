# ACTIVE 回执 · QODER-19 · 四卡合并与门禁基线收敛

> 执行人：Qoder（移动端执行方）｜日期：2026-10-21｜派单人：凌舟
> 任务书原件：`docs/tasks/inbox/QODER-19-baseline-convergence.md`（只读引用，未修改未删除）
> **本回执不含任何验收判词。执行方不是凌舟；下列 status 只是"执行方交付状态"，判绿权在负责人。**

## 一、人读摘要

四笔 merge commit（固定序 14F1→15F1→16R→17F1）由**负责人**完成，本单**未重做 git 机制、未 rebase、未改合并历史、未 push**。
执行方交付三件事：**(1) 四门 + 三构建在合并终态上复跑并逐条留原始输出；(2) 五轮反测证明门真的能红且原子自复原；(3) 改动面自证本单零业务码。**

读数结论（与卡 §三 判据逐字对照）：type-check 0/0、lint error 20 / warning 12872 逐规则不劣化、
test **10 文件 / 184 用例全过**、check:contract 差集全具名豁免 —— 四门 EXIT 全 0；
`build:h5` / `build:mp-weixin` / `build:app` 三构建在**仓库根**执行，EXIT 全 0（`build:app` 未因签名/资源失败）。
`git diff 21b465e5..HEAD -- backend/` = **0 字节**（比卡"仅允许四卡原有台账/证据变化"更严）。

四笔 merge 的冲突面**只有 `app-mobile/scripts/gates-baseline.json` 的 `tests` 段**：
`0ddcc3d2` 单侧改动 ⇒ 自动合并（5/56→6/70）；`25663f73`/`bcf4f4e0`/`0963459d` 双侧改 tests ⇒ 真冲突，
按卡 §二.2 只在集成结果上取累积并（8/172 → 9/180 → 10/184）；非 tests 四段（lint/typeCheck/checkContract/contractDrift）
与集成分支侧**逐字节一致**，业务实现一行未动。各分支相对自身基线 `dfeedbc0` 的独立增量 +14/+102/+8/+4 与
卡 §二.3 组成式 `56+14+102+8+4=184` 逐项匹配，累积收敛与终态一致 ⇒ 无重复计数、无丢失。

**`gates-baseline.json` 本单零写入**（终态 10/184 由负责人所定并实测复现）；第⑤轮反测曾临时抬到 200，已复原且 SHA 逐字节一致。

## 二、判据自评（目标读数 vs 实测，判据本体是包装器打印的 EXIT）

| 卡 §三 判据 | 目标读数 | 实测读数 | 自评 | 证据 |
|:--|:--|:--|:--|:--|
| type-check | EXIT=0 | 0 错 / 基线 0，EXIT=0 | 达成 | `raw/01` |
| lint | EXIT=0，error 20 / warning 12872 不劣化 | 20 / 12872，六规则无一劣化，EXIT=0 | 达成 | `raw/02` |
| test | 10 文件 / 184 用例全过 | 10 / 184 全过，EXIT=0 | 达成 | `raw/03` |
| check:contract | EXIT=0 | 292/283/204/1498，差集 1 条具名豁免，EXIT=0 | 达成 | `raw/04` |
| 三构建 | 均 EXIT=0 | h5/mp-weixin/app 全 `DONE Build complete.`，EXIT 全 0 | 达成 | `raw/05–07` |
| backend diff | `-- backend/src`=0；`backend/` 仅原有台账/证据变化 | 两条口径均 0 字节 | 达成（更严） | `raw/09` |
| 基线终态 | tests=10/184，note 逐项列源 | 10/184，四条递进与四个卡名齐备 | 达成 | `raw/12`/`raw/13` |
| 工作树 | clean | 反测五轮全复原；docs 提交后 `git status` 空 | 达成 | `raw/16`/`raw/17` |

五轮反测（门能红 + 复原 + 转绿）：

| 轮 | 注入 | 红点名 | RED | SHA | GREEN |
|:--|:--|:--|:--|:--|:--|
| ① | 摘 `request.ts` 的 `removeStorageSync('merchant_tenant')` | 14F1 **④⑩⑫**（3 failed/181 passed） | EXIT=1 | 一致 | 10/184 EXIT=0 |
| ② | `isBelowCost(...)` → 裸 `retail < cost` | **字符串低价 9.00/12.00 卡点名复现条** + 静态门（8 failed） | EXIT=1 | 一致 | 10/184 EXIT=0 |
| ③ | `manifest.json` 删 `"NSCameraUsageDescription"` | 16R **"iOS 六个隐私描述键齐备…"** + 功能对应条（2 failed） | EXIT=1 | 一致 | 10/184 EXIT=0 |
| ④ | `index.html` 删 `viewport-fit=cover` | 17F1 **断言④**（1 failed） | EXIT=1 | 一致 | 10/184 EXIT=0 |
| ⑤ | `gates-baseline.json` `testCount` 184→200 | **184 全过仍判红**：`< 基线 10/200（少 16 条）` | EXIT=1 | 一致（CRLF 55→55 未归一） | attempt1 撞无关偶发条 → attempt2 10/184 EXIT=0 |

## 三、未验清单（协议 §6；未做的一律标未验，不写"应无影响"）

1. **未验** iOS/Android 真机安全区留白与隐私弹窗文案 —— 无设备与 HBuilderX 签名链。复现：`build:app` 后 HBuilderX 导入 `dist/build/app`。
2. **未验** 微信开发者工具 / 小程序后台的 `scope.record.desc` 渲染与 `requiredPrivateInfos` 报备 —— 无工具与后台权限。
3. **未验** 登录态整页 E2E（401 清态真实链路）—— 本单不新增 E2E，无常驻 mock 后端。
4. **未验（本轮）** 浏览器 computed / PNG 目视 —— 本单为合并收敛取证未重跑；历史读数在 `docs/evidence/qoder-17f1/browser/`、`docs/evidence/qoder-15f1/browser/`。
5. **未治/未验** `storage-crypto.spec.ts`「tag 校验失败即抛」条偶发（随机 IV 使篡改判定依赖本次 tag 取值）—— 本单未改其代码、未调基线，只登记，是否另立卡请负责人裁定。
6. **未做** 四卡原有 `backend/` 台账历史变更明细的二次交叉审计（本单只证明 `backend/` diff 为 0）。

## 四、红线对照

未 push、未开 PR（`git ls-remote --heads origin chore/qoder-19-baseline-convergence` 空）；未 `git add -A`（逐文件 add）；
未 rebase/未改历史/未切分支；未动本工作树外仓库文件（scratch 除外）；未改写四卡既有 `docs/evidence/qoder-1[4-7]*/**`；
未改任务书原件与 `docs/tasks/inbox/ACTIVE.md`；未借入/删除 harness、未 `npm install`、未改 `package.json`/lockfile；
未调基线换绿（lint 无劣化，`gates-baseline.json` 零写入）；未写任何归属凌舟的判词。

===DSH-RECEIPT-BEGIN===
id: QODER-19
status: delivered-awaiting-review
summary: 四卡（14F1/15F1/16R/17F1）合并终态复跑取证 + 五轮反测 + 改动面自证；常驻四门 EXIT 全 0（lint error 20/warning 12872 不劣化、test 10 文件 184 用例全过、contract 差集全具名豁免、type-check 0/0）；三构建（h5/mp-weixin/app）在仓库根执行 EXIT 全 0；git diff 21b465e5..HEAD -- backend/ = 0 字节；gates-baseline.json 终态 10/184 未由本单写入（四笔 merge 与基线终态由负责人完成，本单不重做 git 机制）；五轮反测全部红→cp 复原→SHA 逐字节一致→复跑转绿，含第⑤轮基线冻结门自身（testCount 184→200 时 184 全过仍判红）；未 push、未开 PR、未 rebase、未 git add -A
worktree: D:\Users\ZXQL\wt-agents\QODER-19
branch: chore/qoder-19-baseline-convergence
commits: 负责人四笔 merge 0ddcc3d2(14F1/e6801de0) -> 25663f73(15F1/316f2051) -> bcf4f4e0(16R/54ba998a) -> 0963459d(17F1/47c737e8)（基线 21b465e5，本单未新增 git 机制笔）；本单 docs 笔 C1=1d37083857c109ead992ad0f7a0fcdb31292204b（证据树 raw/01-16 + anti/a1-a5 + README + 回传卡）与 C2=分支尖端（raw/17 + 本回执；C2 无法自指，取 git rev-parse HEAD）；执行方未 push
gates: type-check=EXIT0(0/0); lint=EXIT0(error20/warning12872 逐规则不劣化); test=EXIT0(10 files/184 cases); check:contract=EXIT0(292/283/204/1498, 差集1条全具名豁免); build:h5=EXIT0; build:mp-weixin=EXIT0; build:app=EXIT0; check:gates 终态串行=EXIT0; 五轮反测 red=EXIT1 x5 / green=EXIT0 x5（a5 第 1 次转绿撞无关偶发条，第 2 次 EXIT0）
redlines: no-push; no-pr; no-git-add-A; no-rebase-no-history-rewrite; no-branch-switch; only-worktree-QODER-19+scratch-touched; four-cards-evidence-dirs-unmodified; task-book-and-ACTIVE.md-unmodified; no-harness-borrow-or-delete; no-npm-install; baseline-not-relaxed; no-acceptance-verdicts-written
evidence: docs/evidence/qoder-19/**（README + raw/01-17 + anti/a1-a5，共 50+ 文件，零字节文件 0 个）
return_card: docs/tasks/cards/R101-QODER-19-回传.md
===DSH-RECEIPT-END===

> C1 = `1d370838`（证据树 + 回传卡），C2 = 分支尖端（raw/17 收尾终态校验 + 本回执），共 2 笔 docs 提交，符合"≤2 笔"上限。
> 负责人核对：`git log --oneline origin/main..HEAD` 应见四笔 merge + 本单两笔 docs；`git rev-parse HEAD` 即最终 ref。
> `raw/17-post-commit-final-check.txt` 记录了 C1 之后的 `git status`（当时唯一未跟踪项就是 raw/17 自身与本回执，属自引用而非脏改动）。
