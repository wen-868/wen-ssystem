# ACTIVE-回执-QODER-17

> 汇报人：Qoder（移动端执行子代理）｜日期：2026-10-20｜对应派单：QODER-17（--safe-top 自引用修复）
> 读数均为执行方自评，验收权在凌舟。

## 人读摘要

- **改了什么**：`app-mobile/src/App.vue:54` 默认分支自引用 `--safe-top: var(--safe-top);` ⇒ `--safe-top: env(safe-area-inset-top);`（env 单值，理由：自定义属性上 constant+env 双行无兜底语义，见回传卡 §三）；`:59` `#ifdef APP-PLUS` 的 `var(--status-bar-height)` 覆盖原样保留；97 处 / 90 文件的 `var(--safe-top)` 使用点零改动；新增静态断言用例 `app-mobile/tests/safe-top-var.spec.ts`（3 条真断言，跑在未修复基线即红）。
- **判据自评**：type-check 改前/改后均 EXIT=0（0=0）；lint 同一 harness 两遍全仓 190/20/12880 逐规则不劣化；test 基线既有用例 0 ⇒ 本单新增 1 文件/3 用例全过 EXIT=0；`build:h5` EXIT=0；H5 computed 取证（browser-use + 本地静态服务）`uni-page-body` 上 `--safe-top`=**0px 可解析非空**（桌面 env=0 属正常），活体反证自引用⇒空串失效；`.login-page` padding-top 使用点 0px 佐证。
- **反测**：注回自引用 ⇒ vitest EXIT=1 断言①点名红 ⇒ `cp` 复原 ⇒ SHA256 与注入前逐字节一致（7b8d33bd…）⇒ 复跑 3 passed EXIT=0。门能红。
- **未验/提请**（回传卡 §七）：① `index.html` 缺 `viewport-fit=cover`——env() 真机恒 0 的根因，证据齐（raw/09、raw/10），**本单未擅改**，提请后续单；② App 真机无设备未验；③ 浏览器截图无可见表面未产出（computed 读数不受影响）。
- **借入装置**：harness 借自 `9fd90257`，已删除、未提交；复现命令在回传卡 §五。

```
===DSH-RECEIPT-BEGIN===
id: QODER-17
status: DONE
summary: App.vue:54 自引用 --safe-top 改 env(safe-area-inset-top)（APP-PLUS 覆盖保留、97 处使用点零改动）；自评 type 0=0、lint 190/20/12880 不劣化、新增 3 用例全绿、build:h5 EXIT=0、H5 computed=0px 可解析；反测红→SHA 复原→绿；偏差披露：viewport-fit=cover 缺失未改提请后续单、真机与截图未验、computed 作用域为 uni-page-body 非 :root
worktree: D:\Users\ZXQL\wt-agents\QODER-17
branch: fix/qoder-17-safe-top
commits: e1288787(impl)；docs 笔=本卡+回执+证据（git log 最新一笔，写卡时不可知）
evidence: docs/evidence/qoder-17/README.md, docs/evidence/qoder-17/raw/01-typecheck-before.txt, docs/evidence/qoder-17/raw/02-typecheck-after.txt, docs/evidence/qoder-17/raw/03-lint-before-summary.txt, docs/evidence/qoder-17/raw/04-lint-after-summary.txt, docs/evidence/qoder-17/raw/05-test-baseline-red.txt, docs/evidence/qoder-17/raw/06-test-after-fix-green.txt, docs/evidence/qoder-17/raw/07-build-h5.txt, docs/evidence/qoder-17/raw/08-safetop-usage-grep.txt, docs/evidence/qoder-17/raw/09-index-html-viewport.txt, docs/evidence/qoder-17/raw/10-dist-css-snippet.txt, docs/evidence/qoder-17/raw/11-server-source.txt, docs/evidence/qoder-17/anti/00-pre-sha256.txt, docs/evidence/qoder-17/anti/01-inject-selfref-red.txt, docs/evidence/qoder-17/anti/02-restore-sha256.txt, docs/evidence/qoder-17/anti/03-restore-green.txt, docs/evidence/qoder-17/browser/README.md, docs/evidence/qoder-17/browser/01-computed-values.txt, docs/evidence/qoder-17/browser/02-live-cyclic-contrast.txt, docs/evidence/qoder-17/browser/03-matched-rule.txt, docs/evidence/qoder-17/browser/screenshot-blocked.note.txt, docs/tasks/cards/R101-QODER-17-回传.md
return_card: docs/tasks/cards/R101-QODER-17-回传.md
gates: type-check => 改前 EXIT=0 / 改后 EXIT=0（错误 0=0）; test => 基线既有用例 0，新增 1 文件/3 用例 EXIT=0（修前同 spec 跑基线 EXIT=1 ①②红）; lint => 改前=改后 files=190 error=20 warning=12880，11 规则逐项不劣化; build:h5 => EXIT=0; 静态断言门 => 修后 3 passed（EXIT=0）; 反测 => 注入 EXIT=1 点名①，cp 复原 SHA256 逐字节一致，复跑 EXIT=0; H5 computed => uni-page-body --safe-top=0px（可解析非空，桌面 env=0 正常），活体反证自引用=空串; 真机 => 未验（无设备）; 截图 => 未验（NATIVE_BROWSER_VIEWPORT_UNAVAILABLE）
redlines: 遵守（未 push / 未开 PR / 未 git add -A，逐文件 add；未动 appid/后端/其它工作树；借入 harness 已删除且未提交）
===DSH-RECEIPT-END===
```
