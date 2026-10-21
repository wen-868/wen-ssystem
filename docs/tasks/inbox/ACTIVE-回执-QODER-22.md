# ACTIVE 回执 · QODER-22 —— 移动端最终 main 收口

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-22
> 完整十项回传：`docs/tasks/cards/R101-QODER-22-回传.md`｜证据树：`docs/evidence/qoder-22/**`
> 本回执只写执行方自评与卡片目标读数对照，不含凌舟裁定/验收结论类判词。

## 人读摘要

基座 `cf9a98fa`（QODER-20 尖端）合并 QODER-21 尖端 `2e8cde17` ⇒ 收口笔 `e9afb0a6`（**真双父，未 rebase、未 squash，未 push**）。三件事：

- **合并**：`git merge --no-ff --no-commit 2e8cde17` 实际**零冲突**（任务书预期 `gates-baseline.json` 会冲突，这是口径偏差，已报备并给机械证明：相对共同祖先 `21b465e5`，我方只动 57–59 行（tests 段）、并入方只动 10/13–27/36 行（lint 段），两组行区间不相交 ⇒ 自动合并合法，不是谁被丢弃。四态归因：`lint` 段取 theirs（errorBaseline 0、`errorsByFileRule` {}），`tests` 段取 ours（11/186），其余四段与 ours 逐字段相等）。
- **基线收敛**：`gates-baseline.json` 最终 `lint.errorBaseline=0`／`errorsByFileRule={}`／`tests.testFiles=11`／`tests.testCount=186`，`lint.note`（1052→1524 字）与 `tests.note`（2270→2941 字）各追加一段 ★QODER-22／⑧ 来源说明，**双方原文一字未删**。除 note 外没有任何基线数字被本卡改动（`git diff --numstat` 追加面只有 2 行）。
- **pin-ssl 双范围**：只改 `tests/pin-ssl-static.spec.ts`（+35/−18，仍 1 个 `it` / 5 条 `expect` ⇒ 用例数不升不降）。负向旧事实 `2026-09-15`／`TrustAsia` 由"只扫文件头"扩到 **`pin-ssl.ts` 全文**；正向现网叶子日期 `2026-11-11`／`2026-12-22` **仍只认文件头块**（全文守会被 `PINNED_CERTS` 常量旁注释"顶包"）；`installSslPinning` 调用点继续扫全 `src`。`src/utils/pin-ssl.ts`、`crypto.ts`、`storage-crypto.spec.ts`、`.eslintrc.cjs`、`vitest.config.ts`、`package.json` 与四门脚本相对 `cf9a98fa` diff **全为 0**。

## 判据自评（卡 §三 逐条）

| 判据 | 目标 | 实测 | 自评 |
| --- | --- | --- | --- |
| `check:gates` | EXIT=0 | **GATES_EXIT=0**（终态 `raw/46`，合并态 `raw/10-gates-check-merged` 两轮同读数） | 达标 |
| lint | error 0／warning ≤12872 | **error 0（基线 0）／warning 12872（基线 12872，六规则逐项相等）** | 达标 |
| test | 11 文件 / 186 用例 | **11 passed (11)／186 passed (186)** | 达标 |
| type-check | 0 = 0 | **vue-tsc 当前 0 条／基线 0 条** | 达标 |
| `check:contract` | EXIT=0 | **EXIT=0，差集 1 条／具名豁免 1 条** | 达标 |
| `build:h5` / `mp-weixin` / `app` | 均 EXIT=0 | **0／0／0，三端均 `DONE Build complete.`** | 达标 |
| `guard --strict` / `--strict --no-stale` | 均 EXIT=0 | **0／0**，两份台账段逐字相同（gaps 289 已登记／未登记 0／陈旧 0；consumerEnd 45／0） | 达标 |
| `git diff 21b465e5..HEAD -- backend/src` | 0 | **0 行 / 0 字节** | 达标 |
| request.ts 无 `upload` 导出 | 无 | `rg` 两次均 `RG_EXIT=1` ⇒ `UPLOAD_ANYwhere=0` | 达标 |
| pin-ssl 未接线 | 调用点 0 | **`PINNED_INSTALL_CALLS=0`**（仅 `pin-ssl.ts` 自身注释/定义命中） | 达标 |
| 反测（旧事实写回常量尾部须红） | 红且点名 | **A1**（`2026-09-15` @ 常量行尾，`spec.ts:87:7` 点名，并把常驻 test 门整体拖红 `1 failed \| 185 passed`）／**A2**（`TrustAsia` @ 常量行尾，`:92:7` 点名） | 达标 |
| 反测（文件头缺新日期须红） | 红且点名 | **B1**（抹 `2026-11-11`，常量旁 `:76` 同值不动 ⇒ `spec.ts:94:100` 点名，证明正向只认文件头）／**B2**（抹 `2026-12-22`，`95:98`） | 达标 |
| 复原 | 同形态 SHA 一致 ⇒ 复跑绿 | 四轮 `RESTORE_EXIT=0`、`SHA_BEFORE==SHA_AFTER==cb27d321c52d…`、`VITEST_EXIT_AFTER_RESTORE=0` | 达标 |
| 工作树 | clean | 代码笔 `e9afb0a6` 已入库，本回执/回传/证据为第二笔 `docs:`，逐文件 add，提交后 `git status --porcelain` 为空 | 达标 |

## 未验清单与挂账（如实，不许当通过）

1. **收口笔未进 main**：`e9afb0a6` 仍在 `chore/qoder-22-mobile-main-closeout`，未 push、未开 PR；主干落地动作不在本卡权限内。
2. **真机全未验**（iOS／Android／微信开发者工具／小程序后台）；三构建只证明可编产物。H5 浏览器未起（本卡 src 零改动，无新 UI 行为）。
3. **pin-ssl 仍未接线**，本卡只守"没接线"这一事实；接线的两个前置（新指纹 + 原生层证书回调可用）一个都没满足。
4. **api 叶子证书 2026-11-11 到期（距今 21 天）已进入 30 天轮换提醒窗口**，本卡无动作面处理，仅提示。
5. 存量未清：lint warning 12872、RBAC 已登记欠账 289 条、`contractDrift.d4=1`（employees 保留读数）。
6. **越面发现（未擅自修改，建议另立单）**：`tests/storage-crypto.spec.ts:37` 是**约 1/256 概率红**，根因在 `src/utils/crypto.ts:626-628` 的校验循环上界写死 16、不校验 `tag.length`；篡改式 `slice(0,-4)+'AAAA'` 实际只改第 16 字节。探针确定性复现（第 77 次命中，`decrypt` 返回 `"top-secret"` 不抛；2000 次命中 8 = 0.00400）。这不是机密性破口，但意味着"标签校验完备性弱于注释所述"（非规范 base64 可被当合法标签接受）。原始日志 `raw/50`、复现件 `probe/`。
7. **反测 v1 四份日志作废**（`.mjs` 里用 `require()` ⇒ 注入器一字节没写、驱动未据 `INJECT_EXIT≠0` 中止 ⇒ "红跑"实为绿跑），已移入 `anti/void-v1/` 并附作废说明，原始文件未改写；v2 已加硬闸并出四轮有效读数。
8. **修复清单**（总数/已完成/未完成）：本卡面 7 项全部完成（合并 1、基线收敛 5、双范围断言 4、四门+三构建+双守卫 9、反测 4，详见回传卡 §八 表）；挂账 4 项未完成（storage-crypto 概率红 + `tag.length` 校验、pin-ssl 接线、api 证书轮换、存量计数面 `.toFixed(` 99 处/39 文件、`res?.result ?? res` 164 处/35 文件、`?? res` 219 处/44 文件）。

===DSH-RECEIPT-BEGIN===
id: QODER-22
status: 执行方自评为「卡片判据全部达标，收口笔完成」；未 push、未开 PR，主干落地待凌舟安排
summary: 基座 cf9a98fa 合并 QODER-21 尖端 2e8cde17 ⇒ 收口笔 e9afb0a6（真双父、未 rebase/squash）。实际零冲突（相对共同祖先 21b465e5：我方只动 gates-baseline.json 的 57-59 行 tests 段、并入方只动 10/13-27/36 行 lint 段，行区间不相交）；四态归因 lint 段取 theirs、tests 段取 ours、其余四段零漂移。最终基线：lint.errorBaseline=0、errorsByFileRule={}、tests=11/186、typeCheck={}、warning 六规则合计 12872 未动；lint.note 1052→1524、tests.note 2270→2941，各追加一段来源说明，双方原文一字未删，除 note 外未改任何基线数字。pin-ssl 静态守卫改双范围（只动 tests/pin-ssl-static.spec.ts，+35/-18，仍 1 it/5 expect ⇒ 用例数不变）：负向 2026-09-15 与 TrustAsia 扫 pin-ssl.ts 全文、正向 2026-11-11 与 2026-12-22 仍只认文件头块（全文守会被 PINNED_CERTS 常量旁注释顶包）、installSslPinning 调用点扫全 src。src/utils/pin-ssl.ts、crypto.ts、tests/storage-crypto.spec.ts、.eslintrc.cjs、vitest.config.ts、package.json 与四门脚本相对 cf9a98fa diff 全为 0。
worktree: D:\Users\ZXQL\wt-agents\QODER-22
branch: chore/qoder-22-mobile-main-closeout
commits: e9afb0a69df38bbf7ec2093cbe936fa06cbdbf16 chore: QODER-22 移动端最终 main 收口——并入 QODER-21 lint 清零并按双范围收敛 pin-ssl 静态守卫（parents = cf9a98fa + 2e8cde17）；24811fa86f677064a165e582b4a3a514c2b051e5 docs: 为本卡证据树 + R101 回传卡 + 本回执（32 文件，逐文件 add）；其后一笔 docs: 补哈希 + 出厂四门复跑日志 raw/48（只含 docs 面，app-mobile 面 0 行）
gates: check:gates EXIT=0；type-check EXIT=0（vue-tsc 0 条／基线 0 条）；lint EXIT=0（error 0／基线 0，warning 12872／基线 12872，六规则逐项相等）；test EXIT=0（11 文件／186 用例）；check:contract EXIT=0（差集 1 条／具名豁免 1 条）；build:h5 EXIT=0、build:mp-weixin EXIT=0、build:app EXIT=0（均 DONE Build complete.）；guard-rbac-wiring --strict EXIT=0 与 --strict --no-stale EXIT=0（gaps 已登记 289／未登记 0／陈旧 0，consumerEnd 45／0，两份台账段逐字相同）；git diff 21b465e5..HEAD -- backend/src = 0 行 0 字节；反测 4 轮有效：A1/A2 把 2026-09-15、TrustAsia 分别写到块结束符（pin-ssl.ts:33）之外的 PINNING_ENABLED_KEY、DEFAULT_PINNING_ENABLED 常量行尾注释 ⇒ spec.ts:87:7 与 92:7 点名并 1 failed（A1 另把常驻 test 门拖红 1 failed|185 passed、TEST_GATE_EXIT=1），B1/B2 只抹文件头两个叶子到期日（常量旁 :76/:80 同值不动）⇒ spec.ts:94:100 与 95:98 点名；四轮 RESTORE_EXIT=0、SHA_BEFORE==SHA_AFTER==cb27d321c52d…、复跑 VITEST_EXIT_AFTER_RESTORE=0
redlines: 未 push、未开 PR、未 git add -A（逐文件 add）；只动本工作树与 _scratch/qoder-22，未改写 QODER-21 支（chore/qoder-21-lint-errors-zero 尖端仍 2e8cde17）；未升/降任何基线数字换绿、未关或放宽规则、未加文件级 eslint-disable、未加 vitest skip/todo、未删改测试；未改 pin-ssl.ts/crypto.ts/storage-crypto.spec.ts 及四门装置；未 --amend、未 rebase/reset/clean -f、复原一律 cp 出树备份不用 sed -i；未借入或删除任何 harness；未写验收方判词；作废读数另立 note、原始日志未改写
evidence: docs/evidence/qoder-22/README.md（索引）+ raw/00…raw/50（合并前基座、merge 原样输出、四门合并态与终态、baseline 追加前后 SHA 与 CRLF、三构建、双守卫、范围与红线机检、谱系、两段来源归属 hunk 证明、装置与规则面零改动、storage-crypto 根因探针）+ anti/A1…B2（四轮有效反测）+ anti/void-v1/（v1 四份作废日志与作废说明）+ probe/README.md 与探针源码存档
return_card: docs/tasks/cards/R101-QODER-22-回传.md
===DSH-RECEIPT-END===
