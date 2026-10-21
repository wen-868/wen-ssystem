# ACTIVE 回执 · QODER-18 —— `request.ts` 死导出 `upload()` 处置 + 静态断言防回流

> 汇报对象：凌舟（派单人）
> 汇报人：Qoder（移动端执行方）
> 日期：2026-10-21
> 对应派单编号：QODER-18（任务书 `docs/tasks/inbox/QODER-18-upload-dead-charge.md`，原件未改未删）
> 详细十项见 `docs/tasks/cards/R101-QODER-18-回传.md`；原始输出见 `docs/evidence/qoder-18/`。
> ⚠️ 本回执全部为**执行方自评**，不含任何验收结论；「绿/红/EXIT=0」只描述命令退出码与卡内目标读数的对照。

## 一、改了什么（人读摘要）

1. **`app-mobile/src/api/request.ts`**：删除死导出 `upload()` **整个函数**（现场 **`:219-254`**，
   卡内写的 `:211` 已过期 —— QODER-14F1 在本文件 401 分支上方加了 8 行注释 + 1 行清理，整体下移 9 行）。
   diff = **37 deletions / 0 insertions**，纯删除、未顺手重构。文件 254 行 → **217 行**。
2. **import / helper 处置 = 零删除**。卡内要求「删后检查是否变成未使用」，现场逐个复核结论是
   **全都还在被 `request()` 用**，因此按卡内「若仍被使用则不许删」原样保留：
   `BASE_URL`（`:10` 定义 → `:87` 用于 `url: \`${BASE_URL}${url}\``）、`getToken`（`:49` → `:65`、`:105` 重试防误杀）、
   `getTenantId`（`:53` → `:66`）、`getCsrfToken`（`:57` → `:67`）、`import { API_BASE_H5, API_BASE_NATIVE }`（`:6`，只喂 `BASE_URL`）。
   不存在「一并删以防 type-check/lint 新红」的分支；门 1（错误 0）与门 2（warning 12872 不劣化）与该结论互证。
3. **`app-mobile/tests/request-retry-safety.spec.ts`**：在**既有** spec 末尾新增 **1 个 describe + 1 个 `it`（⑭）**，
   **未新开 spec 文件**。三条断言：① 源码无 `export function upload` 且无 `export { … upload … }`；
   ①' 运行期 `Object.keys(mod)` 不含 `upload`（防正则漏掉的第三种导出写法）；
   ② 全仓 `src`+`tests` 无一处从 `…/api/request` 具名导入 `upload`（锚定式正则，`uploadImage/uploadFile/uploadAvatar` 不误判）。
4. **`app-mobile/scripts/gates-baseline.json`**：**只动 `tests` 段** —— `testCount` 70 → **71**（实测即基线），
   `note` 追加 QODER-18 留痕；`testFiles` 仍 6。lint / typeCheck / checkContract / contractDrift **四段一字未动**。
5. **★ 本卡关闭移动端 MO-10（`upload()` 死代码），未改写实际上传链路。**
   真实上传仍走 `api/modules/products.ts:451 uploadImage()`（直接 `uni.uploadFile`，
   URL `${API_BASE}/admin/products/upload-image`）与 `api/modules/profile.ts:33 uploadAvatar()`；
   消费点 `pages/products/product-detail.vue:449/1282`、`pages/profile/edit.vue:158`。
   上述四文件 `git diff e6801de0..` = **各 0 行**。

## 二、判据自评

| 判据 | 卡内要求 | 现场自评 |
| --- | --- | --- |
| 常驻四门 | 全跑且 EXIT=0 | type-check `EXIT=0`（错误 0/基线 0）；lint `EXIT=0`（error 20=基线 20，warning 12872=基线 12872 无劣化）；test `EXIT=0`（**6 文件 / 71 用例** 全过，基线已调平 6/71）；check:contract `EXIT=0` ⇒ **四门全 EXIT=0** |
| 用例数 targets | 预判「6/70 +1 ⇒ 6/71」 | 实测 **6 files / 71 count**，与预判**无差异** |
| contract 读数 | 预判「`upload()` 无 `/admin/` 字面量 ⇒ 不受影响」 | 复核成立并实测：删前 = 删后 = **292 / 283 / 204**，后端注册 1498，**差集 1 / 豁免 1**；`checkContract` 段未动。附加发现：`check-contract.mjs:38` 的 `CALL_METHOD_RE` 里**确实挂着 `upload`**，但计数单位是 `'/admin/...'` 字面量，且 `upload(` 定义行因夹了泛型 `<T = any>` 本就不匹配该正则 ⇒ 无影响（推导见回传卡 §三.4） |
| build:h5 | EXIT=0 | `npm --workspace app-mobile run build:h5` **在仓库根** `D:/Users/ZXQL/wt-agents/QODER-18` 跑 ⇒ `DONE Build complete.`、`BUILD_H5_EXIT=0`。另在 `app-mobile/` 内复现过 `No workspaces found` `EXIT=1`，**已作废登记**（`raw/20` + `.note.txt`，原始输出未改写），非构建失败 |
| backend 0 行 | `git diff e6801de0..HEAD -- backend/` = 0 | **0 行** |
| 改动面 | = 卡点名文件，不多一个 | `git diff --name-only e6801de0..HEAD` = **3 文件**（request.ts / spec / gates-baseline.json） |
| 反测（门必须能红） | 注回死导出桩 ⇒ 点名红；复原 SHA 一致 ⇒ 绿 | 注桩 `export function upload<T = any>(…) { return Promise.resolve() as any }` 后 `npm run test` **`EXIT=1`** 且点名 `FAIL … QODER-18 … ⑭`，原因 `AssertionError: request.ts 又出现 export function upload`；`cp` 复原（未用 `sed -i`）后 `sha256sum` **与注入前逐字节一致**（`0c655044…`，另加 `cmp` 校验），复跑 **`EXIT=0`** 6/71。注入器为树外 `.mjs`、latin1 字节精确、守卫命中数≠1 即 `exit 9`（并做过「拿删前备份注入 ⇒ GUARD_EXIT=9 拒写」的守卫自检） |

## 三、偏差与自我报备（要点，全文见回传卡 §五/§八）

1. **行号偏差（卡内点名要求报备）**：`request.ts:211` → 现场实际 **`:219-254`**；已按函数体定位删除，非硬套行号。
2. **★ 反测出现并修复了一次「负载型假红」**：定稿前一轮复原复跑 `EXIT=1`，读 vitest 详情才知是
   **vitest 默认 5000ms 用例超时**（`Test timed out in 5000ms`），与内容无关 —— 本用例含全仓读文件 + 一次真实动态 import，
   热态 ~2.3s，紧随 `build:h5` 落大量产物后的冷态实测 **8361ms**。处置 = 给该 `it` 传显式 **30_000ms**，
   **三条断言一字未减**（放宽的是超时不是判据），红可复现改由 `anti/06` 最终轮重新证明。
   原始失败输出 `anti/04` **未改写**，修复与连续两遍稳定性复跑见 `anti/05`。
3. **`MSYS2_ARG_CONV_EXCL='*'` 的双面性**：设它之后传给 `node` 的 `/d/...` 路径不再被转换，
   第一次反测序列因此中止在注入步（`MODULE_NOT_FOUND`，被解析成 `D:\d\Users\...`）。
   中止**未污染工作树**（SHA 未变）；改为显式 `D:/...` 路径后正常。
4. `raw/30` 里 `export function upload` 有 4 处 `tests` 目录命中，均为本 spec 自身注释/expect 消息文本；
   已另存 `raw/31` 把口径收窄到 `app-mobile/src`（0 命中），两份并存、互相注明，未抹掉任何一边。
5. `gates-baseline.json` 仅 `tests` 段变化：`git diff` = 2 行（`-testCount:70 / +testCount:71` + 对应 `-note / +note`）。

6. **★ docs 笔做过一次 `git commit --amend`（显式报备）**：docs 笔首建后发现回传卡 §①「改动面」口径不精确（`e6801de0..HEAD` 在 docs 笔后会列出 27 个新文档），已修正为「代码改动面按 `e6801de0..0aa5765e` = 3 文件」，并去掉对自身 docs 笔哈希的硬编码。因任务书限本卡「1~2 笔」，选择 amend 折进同一笔 docs 而非新起第 3 笔；被 amend 的是本执行方刚建、**未 push** 的分支尖端 docs 笔，只含本卡新文件，**实现笔 `0aa5765e` 哈希未受影响，未 rebase、未重写历史**。详见回传卡 §八.7。
7. **docs 笔哈希一律不写死**：本回执与回传卡均以「`git log --oneline e6801de0..HEAD` 的最新一笔」指代 docs 笔（自指哈希写完即失真）；实现笔哈希固定 `0aa5765e`，卡基线固定 `e6801de0`，ref = `fix/qoder-18-upload-dead-code`。

## 四、未验清单（未做一律标未验，不以「应无影响」代替）

| 未验项 | 原因 | 复现命令 |
| --- | --- | --- |
| H5 浏览器上传目视（商品主图 / 头像真实交互） | 无可用浏览器视口 + 需登录态 | 仓库根 `npm --workspace app-mobile run dev:h5` → 登录商户端 → 换主图 / 换头像 |
| App / 小程序真机上传（iOS / Android / 微信开发者工具 / 小程序后台） | 无设备、无开发者工具、无后台凭据；`build:app` / `build:mp-weixin` 本卡未执行 | 真机安装后目视 |
| 登录态整页 E2E | 无测试账号与后端实例 | 需后端 + 有效商户账号 |
| 后端 `POST /admin/products/upload-image` 联调 | 未启动后端 | 启动 `backend` 后由 `uploadImage()` 真实调用（本卡未改一字） |
| 删除 `upload()` 的**运行期**等价性观察 | 死代码判定属静态可证（已证 0 引用），运行期未观察 ⇒ 仍登记未验 | 同 H5 目视 |
| CI（`build-and-test` / `e2e`） | 未 push ⇒ CI 未跑过 | 由凌舟决定是否推送（本卡红线：不得 push、不得开 PR） |

```
===DSH-RECEIPT-BEGIN===
id: QODER-18
status: DONE
summary: 删除 app-mobile/src/api/request.ts 全仓 0 引用的死导出 upload()（现场实际 :219-254，卡内 :211 因基线 e6801de0/QODER-14F1 在其上方加 8 行注释+1 行清理而下移 9 行；diff=37 deletions/0 insertions 纯删除，文件 254→217 行）；getToken/getTenantId/getCsrfToken/BASE_URL 与 import{API_BASE_H5,API_BASE_NATIVE} 经逐个复核仍被 request() 使用（:87/:65/:105/:66/:67/:6）故零删除，符合卡内「仍被使用则不许删」；在既有 app-mobile/tests/request-retry-safety.spec.ts 末尾新增 1 个 describe + 1 个 it（⑭，未新开 spec 文件）做静态断言：①request.ts 无 export function upload 与 export{…upload…} 两种导出形态且运行期 Object.keys(mod) 不含 upload，②全仓 src+tests 无一处从 …/api/request 具名导入 upload（锚定式正则，uploadImage/uploadFile/uploadAvatar 不误判）；gates-baseline.json 只动 tests 段 testCount 70→71（实测即基线，testFiles 仍 6）并在 note 追加 QODER-18 留痕，lint/typeCheck/checkContract/contractDrift 四段一字未动；★本卡关闭移动端 MO-10（upload() 死代码），未改写实际上传链路 —— products.ts:451 uploadImage()、profile.ts:33 uploadAvatar() 及消费点 product-detail.vue:449/1282、profile/edit.vue:158 diff 全为 0 行。自评口径，不含验收结论
worktree: D:\Users\ZXQL\wt-agents\QODER-18
branch: fix/qoder-18-upload-dead-code
commits: 卡基线 e6801de01731fad01897d5bd93cd831a9fc17299（开工即此尖端，本轮未 rebase、未切分支、未碰 git 历史；HEAD~1 = e6801de0）；实现笔 0aa5765e（fix: 删除 request.ts 死导出 upload() 并加静态断言防回流（QODER-18），含且仅含 app-mobile/src/api/request.ts + app-mobile/tests/request-retry-safety.spec.ts + app-mobile/scripts/gates-baseline.json）；docs 笔 = 本回执 + docs/tasks/cards/R101-QODER-18-回传.md + docs/evidence/qoder-18/**（27 个新文件），哈希以 git log --oneline e6801de0..HEAD 的最新一笔为准、本回执刻意不写死自指哈希；docs 笔经本执行方一次 git commit --amend（修正回传卡 §① 改动面口径与去除自指哈希硬编码；被 amend 的是自己刚建未 push 的分支尖端 docs 笔，只含本卡新文件，实现笔 0aa5765e 未受影响，详见回传卡 §八.7）；本卡合计 2 笔（1 fix + 1 docs），全部本地未 push、未开 PR
gates: type-check => EXIT=0（vue-tsc 当前错误 0 条 / 基线 0，改前改后同）；lint => EXIT=0（error 20 基线 20 / warning 12872 基线 12872，无逐规则劣化，故未调基线）；test => EXIT=0（Test Files 6 passed (6) / Tests 71 passed (71)，门打印「当前 6 文件 / 71 用例，基线 6 / 71」；实测即基线，与负责人预判 6/71 无差异）；check:contract => EXIT=0（A.2 三口径 292/283/204、后端注册 1498、差集 1 条 / 具名豁免 1 条 —— 与删前逐项相同，upload() 体内无 /admin/ 字面量故删除不影响读数，checkContract 段未动）；contract-drift => EXIT=0（仓库根跑 node app-mobile/scripts/check-contract-drift.mjs，D1=0/D2=0/debt=0）；build:h5 => EXIT=0（npm --workspace app-mobile run build:h5 于仓库根 D:/Users/ZXQL/wt-agents/QODER-18，DONE Build complete.；另在 app-mobile/ 内复现 No workspaces found EXIT=1，已原样作废登记 raw/20 + .note.txt，非构建失败）；改动面 => git diff e6801de0..HEAD -- backend/ = 0 行，git diff --name-only e6801de0..HEAD = 卡点名 3 文件不多一个，app-mobile/src 改动面 = 仅 request.ts；反测（最终有效轮 anti/06）=> 注入前 request.ts SHA256=0c655044645726cdc9475389f69971c035bb4bf4ca6881c94625acd6fe9bfec7，树外 latin1 .mjs 注回桩 export function upload(...){return Promise.resolve() as any}（守卫：del 锚点须=1 且 upload 须=0 否则 exit 9；已用删前备份做过 GUARD_EXIT=9 拒写自检）后 SHA=101ca78e，npm run test => ANTI_RED_TEST_EXIT=1 且点名 FAIL tests/request-retry-safety.spec.ts > QODER-18 · request.ts 死导出 upload() 已移除且不可回流 > ⑭，AssertionError: request.ts 又出现 export function upload；cp 复原（未用 sed -i）后 sha256sum 与注入前逐字节一致 + cmp 校验通过；复跑 => ANTI_GREEN_TEST_EXIT=0，6 文件 71 用例。踩坑报备：定稿前一轮 STEP 7 曾 EXIT=1，原因非断言而是 vitest 默认 5000ms 用例超时（本用例全仓读文件+动态 import，冷态实测 8361ms），处置=给该 it 传显式 30_000ms 超时、三条断言一字未减，原始失败输出 anti/04 未改写，修复与连续两遍复跑见 anti/05
redlines: 遵守（未 push、未开 PR、未 git add -A，逐文件 add；未 rebase、未切分支、未改历史，HEAD~1=e6801de0；★ 唯一例外口径已在 commits 与回传卡 §八.7 显式报备：docs 笔经一次 --amend，对象是本执行方自己刚建、未 push 的分支尖端 docs 笔且只含本卡新文件，实现笔 0aa5765e 与更早各卡历史一字未动，未越界成第 3 笔；只动 wt-agents/QODER-18，反测注入器与备份仅落卡内豁免区 _scratch/qoder-18/；未改真实上传封装 products.ts uploadImage() 与 profile.ts uploadAvatar() 及其消费点（diff 各 0 行）；未顺手重构（request.ts 纯删除 0 新增）；gates-baseline.json 仅 tests 段变动，lint/typeCheck/checkContract/contractDrift 四段一字未动，未放宽任何基线；未 npm install/uninstall，package.json 与 package-lock.json diff 0 行；任务书原件 docs/tasks/inbox/QODER-18-upload-dead-charge.md 与 ACTIVE.md 未改未删（inbox 目录 diff 除本回执新增外 0 行）；既有证据 docs/evidence/qoder-14/ 与 qoder-14f1/ diff 0 行；全程只用 main 常驻门 npm run <gate>，零借入 harness 零删除；本回执与回传卡均不写「凌舟裁定/验收结论/验收通过」类判词，只写执行方自评与卡内目标读数；真机/H5 上传目视/登录态 E2E/后端联调/CI 一律如实标未验；取证前已 export MSYS2_ARG_CONV_EXCL='*' 排除假 0 命中）
evidence: docs/evidence/qoder-18/README.md; raw/00-dead-export-before.txt（删前死导出复证 + 行号定位 + upload() 内无 /admin/ 字面量）; raw/01-change-diff.txt（改动面全量 diff，自证 baseline 仅 tests 段 2 行变化）; raw/10~13-gate-*.txt（首轮四门逐个输出）; raw/21-build-h5.txt（仓库根成功）; raw/20-build-h5-wrong-entry-voided.txt + .note.txt（入口错误 EXIT=1 作废登记，原始输出未改写）; raw/30-dead-export-after-and-scope.txt（删后复证 + helper 仍被使用逐点取证 + 真实上传链路零改动）; raw/31-post-delete-src-only.txt（口径收窄至 src 的 0 命中 + 四文件 diff 0 行）; raw/40/41/42（spec 定稿前一轮四门/build/drift，保留未改写）; raw/50-terminal-four-gates.txt（终态四门全 EXIT=0）; raw/51-terminal-build-and-drift.txt（终态 build:h5 + drift EXIT=0）; raw/60-terminal-selfcheck.txt（协议 §7 逐条 + 红线对照 + request.ts 终态 SHA + 提交笔数口径补正）; anti/00-inject.txt（注入 + 守卫 exit 9 自检）; anti/01-gate-red-with-injection.txt（首轮红点名 ⑭）; anti/02-restore-sha.txt（首轮复原 SHA 一致）; anti/03-gate-green-after-restore.txt（首轮复原转绿）; anti/04-final-anti-atomic.txt（5000ms 超时假红原始输出，未改写）; anti/05-timeout-fix-stability.txt（超时处置 + 连续两遍 EXIT=0）; anti/06-final-anti-atomic-valid.txt（最终有效轮：红 EXIT=1 点名 → cmp 逐字节一致 → 绿 EXIT=0）; 注入器与工作树备份在树外 D:/Users/ZXQL/wt-agents/_scratch/qoder-18/（inject-upload-stub.mjs、request.ts.anti*-before.bak，不入仓）
return_card: docs/tasks/cards/R101-QODER-18-回传.md
===DSH-RECEIPT-END===
```
