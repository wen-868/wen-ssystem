# ACTIVE 回执 · QODER-14 —— 401 重试只允许 GET + 清 CSRF

> 执行方：Qoder（移动端）子代理｜日期：2026-10-21（2026-10-20 23:0x 开工，读数跨零点）
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-14`｜分支：`fix/qoder-14-auth-retry-safety`｜基线：`321b4f6b`
> 十项回传卡：`docs/tasks/cards/R101-QODER-14-回传.md`（本回执只做人读摘要，判据明细与依据以该卡为准）
> ⚠️ 以下全部读数均为**执行方自评**，不构成验收结论。

## 一、改了什么（两行代码 + 一个测试文件）

1. `app-mobile/src/api/request.ts:105-112` —— 401 防误杀静默重试加「仅幂等 GET」判定：
   `const retryMethod = String(options.method || 'GET').toUpperCase()`，
   条件由 `retryToken && !_retried401` 变为 `retryToken && retryMethod === 'GET' && !_retried401`。
   ⇒ POST / PUT / DELETE 首次 401 **不再原样重放**（消除重复开单 / 重复扣减），直接清态 + 提示 + 跳登录。
   403 / 404 / 500 分支、`silent`、`unauthorizedHandling` 去重锁、`upload()` 一律未动；未引入后端幂等键。
2. `app-mobile/src/api/request.ts:121` —— 401 清态补第四条 `uni.removeStorageSync('merchant_csrf_token')`。
3. `app-mobile/tests/request-retry-safety.spec.ts`（新）—— 14 条用例，`vi.stubGlobal('uni', …)` +
   `vi.resetModules()` + 动态 `import('../src/api/request')` **真实驱动** 401 分支，
   重试次数用 `uni.request` mock 调用计数断言、清态用被删键集合断言（静态文本断言只作兜底，不可替代）。

## 二、CSRF 镜像键结论（这条判断会被验收盯）

**只需一条 `uni.removeStorageSync('merchant_csrf_token')`，不需要第二条删除。**
依据：`storage.ts:75-81`（`:80` CSRF_TOKEN 在 SENSITIVE_KEYS）→ `storage.ts:172` 定义、`:215` 模块加载即
安装 `uni.removeStorageSync` 拦截器 → `storage.ts:196-203` 对敏感 Key 做 `removeSecureStorage(key)`（`:198`，
删 `enc_merchant_csrf_token`）+ `_originalRemoveStorageSync(key)`（`:199`，删历史明文残留）→
`crypto.ts:923-933` 两条平台分支都真删镜像键（H5 `ls.removeItem('enc_'+key)`；非 H5 `uni.removeStorageSync('enc_'+key)`）。
拦截器一定在环：`App.vue:4` → `stores/user.ts:11` → `@/api/storage`，而 `request.ts` 只在函数体内调 `uni.*`。
与既有 `merchant_token`（`request.ts:113`）走完全同一套语义 ⇒ 补第二条删除既不对称，在 H5 上还打不中目标
（H5 的 `enc_` 键写在 `window.localStorage`，`crypto.ts:862`，不是 uni 的存储层）。
**实测佐证**：用例⑪⑫⑬ 把 `storage.ts` + `crypto.ts` 装进测试运行时，跑真实 401 路径后
桩 `localStorage` 里的 `enc_merchant_csrf_token` 与 `enc_merchant_token` 均不残留。

## 三、判据自评读数（基线 / 修后）

| 判据 | 基线（`321b4f6b` + 借入 harness） | 修后 |
| --- | --- | --- |
| test | `tests/` 为空 ⇒ `No test files found`（既有用例 **0**，EXIT=1） | 新增 **1 文件 / 14 用例全过**，EXIT=**0** |
| type-check | `vue-tsc --noEmit` **0 错**，EXIT=**0** | **0 错**，EXIT=**0**（0 = 0） |
| lint（全仓逐规则） | files=190 / error=20 / warning=**12880** / `vue/html-indent`=12299，ESLINT_EXIT=1（基线既有 20 error） | 逐规则计数与基线**完全相等**（diff 无输出），warning 未变，ESLINT_EXIT=1 |
| build:h5 | EXIT=**0** | EXIT=**0**（`DONE Build complete.`） |
| 改动面 | — | `git diff --name-only 321b4f6b..HEAD -- backend/` = **0 行**；src 面仅 `request.ts` |

## 四、反测（门能红，两条，各自原子自复原）

- **(a) 摘掉 GET 判定**（恢复无条件重放）⇒ vitest **红 EXIT=1，6 failed / 8 passed**，点名 **② POST 0 重试 / ③ PUT / ③ DELETE**
  （连带 ④⑩⑫）；`cp` 复原后 SHA256 `4db802da…f9ce029f` 与注入前**逐字节一致**；复跑 **14 passed EXIT=0**。
  证据 `docs/evidence/qoder-14/anti/a-get-gate/{00,01,02,03}`。
- **(b) 摘掉 CSRF 清理那一行** ⇒ vitest **红 EXIT=1，5 failed / 9 passed**，点名 **④ 401 清态含 CSRF 键**
  （原文 `expected [ 'merchant_tenant_id', …(2) ] to deeply equal [ 'merchant_csrf_token', …(3) ]`；连带 ⑦⑧⑩⑫）；
  复原 SHA256 一致；复跑 **14 passed EXIT=0**。证据 `anti/b-csrf-clear/{00,01,02,03}`。

## 五、口径偏差与未验（要点，全文见回传卡 §五 / §七）

- 基线 app-mobile **没有门禁设施**（无 `tests/`、`vitest.config.ts`、`.eslintrc.cjs`，`package.json` 无
  `test`/`lint`/`type-check` 脚本）⇒ 全部判据按共享协议 §2 的等价装置跑：
  从 `9fd90257` 借入两份 harness + junction 里的真实工具入口；**借入件未提交且已删除**，可按卡内命令复现。
- 「test 不劣化」报「基线无既有用例；本单新增 1 文件 / 14 用例全过」，**不声称**对齐链上 56 用例。
- 派单正文行号 1 处漂移：401 分支实际起于基线 **`:97`**（正文写 `:98`）；任务书 §一 的 `:97-107` 准确。
- `tsconfig` 的 include 只有 `src/**`、借入 `.eslintrc.cjs` 的 ignorePatterns 含 `tests` ⇒ 新 spec 不进
  type-check 与 lint 面（如实报备，不夸大为「测试也过了 lint」）。
- **未验**：真机 / App 端（`#ifndef H5` 的 AES-GCM 分支）未跑；浏览器手动 H5 未验；后端未联调（无 401 真实序列）；
  `build:app` / `build:mp-weixin` 未跑；并发 401 去重锁的真实时序未测。
- **未做（范围外）**：401 清态仍不含 `merchant_tenant`（任务书只点名 CSRF）；`upload()` 的 401 无处理；
  后端幂等键按禁令未引入。

## 六、红线自查

未 push、未开 PR、未 `git add -A`（逐文件 add）；只动本工作树；后端 0 改动；未 install、未改依赖、
未动 appid / 支付 / 推送 / 插件配置；主仓 `docs/tasks/inbox/*` 任务书原件只读未改；
借入 harness 与 scratch 未入库；本地提交 3 笔以内。

```
===DSH-RECEIPT-BEGIN===
id: QODER-14
status: DONE
summary: request.ts 的 401 防误杀静默重试改为仅幂等 GET（method 缺省按 GET、统一大写比较）后重放一次，非 GET 首次 401 直接清态+提示+跳登录，并补 uni.removeStorageSync('merchant_csrf_token')（一条调用即连带删 enc_ 镜像键）；新增 1 测试文件 14 用例真实驱动该分支；自评读数 test 14/14 EXIT=0、type-check 0=0、lint 逐规则与基线完全相等（files=190/error=20/warning=12880）、build:h5 EXIT=0、backend 改动 0；两条反测各自点名红→复原 SHA256 逐字节一致→复跑绿；偏差：基线无门禁设施，判据用借入 harness 的等价装置跑（借入件未提交已删除），基线既有用例 0，派单正文 401 行号漂移 1 行（实际 :97）
worktree: D:\Users\ZXQL\wt-agents\QODER-14
branch: fix/qoder-14-auth-retry-safety
commits: e32782c7a59e3c31ae9ec38c67a1aa229a9c1b71(impl)；docs 笔=本卡+回执+证据（写卡时不可知，git log 最新一笔）
evidence: docs/evidence/qoder-14/README.md, docs/evidence/qoder-14/raw/01-baseline-type-check.txt, docs/evidence/qoder-14/raw/02-baseline-lint-counts.txt, docs/evidence/qoder-14/raw/03-baseline-test.txt, docs/evidence/qoder-14/raw/04-baseline-build-h5.txt, docs/evidence/qoder-14/raw/05-post-type-check.txt, docs/evidence/qoder-14/raw/06-post-lint-counts.txt, docs/evidence/qoder-14/raw/07-post-test.txt, docs/evidence/qoder-14/raw/08-post-build-h5.txt, docs/evidence/qoder-14/raw/09-lint-before-after-diff.txt, docs/evidence/qoder-14/raw/10-change-scope.txt, docs/evidence/qoder-14/raw/11-closeout-checklist.txt, docs/evidence/qoder-14/anti/a-get-gate/00-pre-sha256.txt, docs/evidence/qoder-14/anti/a-get-gate/01-anti-a-vitest-red.txt, docs/evidence/qoder-14/anti/a-get-gate/02-restore-sha256.txt, docs/evidence/qoder-14/anti/a-get-gate/03-anti-a-vitest-green.txt, docs/evidence/qoder-14/anti/b-csrf-clear/00-pre-sha256.txt, docs/evidence/qoder-14/anti/b-csrf-clear/01-anti-b-vitest-red.txt, docs/evidence/qoder-14/anti/b-csrf-clear/02-restore-sha256.txt, docs/evidence/qoder-14/anti/b-csrf-clear/03-anti-b-vitest-green.txt
return_card: docs/tasks/cards/R101-QODER-14-回传.md
gates: test => 基线既有用例 0（No test files found EXIT=1）；修后 1 文件/14 用例全过 EXIT=0；type-check => 基线 0 错 EXIT=0，修后 0 错 EXIT=0；lint => 改前 files=190/error=20/warning=12880/vue html-indent=12299，改后逐项相等（diff 空），两次 ESLINT_EXIT=1（基线既有 20 error）；build:h5 => EXIT=0（改前改后均是）；改动面 => git diff --name-only 321b4f6b..HEAD -- backend/ = 0 行；反测 a => EXIT=1 红 6 failed（点名②③PUT③DELETE）后绿 14 passed；反测 b => EXIT=1 红 5 failed（点名④）后绿 14 passed；request.ts 注入前后 SHA256 = 4db802da4c1dc73038863567ad2438d39a641b9a371d079aae98f279f9ce029f
redlines: 遵守（未 push / 未开 PR / 未 git add -A，逐文件 add；未动 appid/后端/其它工作树；借入 harness 已删除且未提交）
===DSH-RECEIPT-END===
```
