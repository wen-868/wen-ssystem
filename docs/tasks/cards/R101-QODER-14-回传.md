# R101 · QODER-14 回传卡 —— 401 重试只允许 GET + 清 CSRF

> 汇报对象：凌舟（Codex 主代理 / 派单人）
> 汇报人：Qoder（移动端）执行子代理
> 日期：2026-10-20 开工 / 2026-10-21 交付（读数跨零点）
> 对应派单编号：QODER-14（任务书 `docs/tasks/inbox/QODER-14-auth-retry-safety.md`，原件在主仓，本工作树基线不含该文件）
> ⚠️ 本卡所有读数均为**执行方自评**，不含验收结论；「通过」只用于描述命令退出码，不代表凌舟裁定。

## 〇 基线与提交

| 项 | 值 |
| --- | --- |
| 工作树 | `D:\Users\ZXQL\wt-agents\QODER-14` |
| 分支 | `fix/qoder-14-auth-retry-safety` |
| 基线提交 | `321b4f6b`（= 本地 `origin/main`） |
| 实现笔 | `e32782c7a59e3c31ae9ec38c67a1aa229a9c1b71`（`fix: 401 静默重试仅允许 GET 且清态补删 CSRF 令牌（QODER-14）`，只含 `app-mobile/src/api/request.ts` + `app-mobile/tests/request-retry-safety.spec.ts`） |
| docs 笔 | 本卡 + 回执 + 证据 = git log 最新一笔（写卡时不可知）；收尾自检证据由再下一笔 docs 提交携带，共 ≤3 笔 |
| 未 push / 未开 PR | 是（`origin/main..HEAD` 全部为本地提交） |

## 一 修法 × 读数总表

| # | 修法（改了什么） | 位置（修后行号） | 对应判据 | 自评读数 |
| --- | --- | --- | --- | --- |
| 1 | 401 静默重试增加「仅幂等 GET」判定：`const retryMethod = String(options.method \|\| 'GET').toUpperCase()`，条件改为 `retryToken && retryMethod === 'GET' && !_retried401` | `request.ts:105-112`（原 `:102-107`） | 任务书 §二.1/§二.2 | test 14/14 绿；反测 (a) 摘掉该判定 ⇒ ②③ 红 |
| 2 | 401 清态补第四条：`uni.removeStorageSync('merchant_csrf_token')` | `request.ts:121`（清态块由 3 行变 4 行：`:113-115` + `:121`） | 任务书 §二.3 | 用例④ 绿；反测 (b) 摘掉该行 ⇒ ④ 红 |
| 3 | 403 / 404 / 500 分支与 `silent`、`unauthorizedHandling` 去重锁、`upload()` 一律未动 | `request.ts:135/143/151`、`:47`、`:200+` | 任务书 §二.4（不引入幂等键、不改后端） | diff 面仅 1 个 src 文件；backend 改动 0 文件 |
| 4 | 新增测试文件（真实驱动，非静态断言） | `app-mobile/tests/request-retry-safety.spec.ts`（14 用例） | 任务书 §三 | `node …/vitest.mjs run` EXIT=0，1 文件 / 14 用例全过 |
| — | type-check | `vue-tsc --noEmit` | 0 = 0 | 基线 EXIT=0 / 0 错 ⇒ 修后 EXIT=0 / 0 错 |
| — | lint | `eslint src --ext .ts,.vue` | 不劣化 | 改前=改后：files=190 / error=20 / warning=12880 / vue\html-indent=12299，逐规则 diff 无差异 |
| — | build | `npm --workspace app-mobile run build:h5` | EXIT=0 | 基线 EXIT=0 ⇒ 修后 EXIT=0（`DONE Build complete.`） |

## 二 判据自评（任务书逐条 + 原始输出文件号）

| 任务书验收条目 | 实际命令 | 自评结论 | 原始证据 |
| --- | --- | --- | --- |
| 新增 `app-mobile/tests/request-retry-safety.spec.ts` | 文件已建（提交 `e32782c7`） | 已建，14 用例 | `raw/07-post-test.txt` |
| ① GET 401 + token 可读 ⇒ 重试一次 | `node ../node_modules/vitest/vitest.mjs run` | 用例① 绿：`uni.request` 调用数 = 2（首 + 重试恰一次），且 resolve 成功、不清态、不跳转 | `raw/07-post-test.txt` |
| ② POST 401 + token 可读 ⇒ 0 重试 | 同上 | 用例② 绿：调用数 = 1，reject「登录已过期，请重新登录」，`reLaunch('/pages/login/login')` 一次 | 同上 |
| ③ PUT / DELETE 同理不重放 | 同上 | 用例「③ PUT」「③ DELETE」各自绿：调用数 = 1 | 同上 |
| ④ 401 后 csrf 键被清除 | 同上 | 用例④ 绿：被删键集合精确等于 `merchant_token / merchant_user / merchant_tenant_id / merchant_csrf_token` | 同上 |
| 反测：删 GET 判定或删 CSRF 清理 ⇒ 目标用例必红；cp 复原 SHA256 一致 | `anti/a-get-gate/**`、`anti/b-csrf-clear/**` | 两条各自红→复原→绿；SHA256 前后均为 `4db802da4c1dc73038863567ad2438d39a641b9a371d079aae98f279f9ce029f` | `anti/**/00~03` |
| app-mobile `test` 不劣化 | 同上 | **基线无既有用例**（`tests/` 不存在、`No test files found`）⇒ 报「本单新增 1 文件 / 14 用例全过 EXIT=0」，不声称对齐链上 56 用例 | `raw/03-baseline-test.txt`、`raw/07-post-test.txt` |
| `type-check` 0=0 | `node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit` | 基线 0 错 / EXIT=0 ⇒ 修后 0 错 / EXIT=0（真实读数） | `raw/01`、`raw/05` |
| `lint` 不劣化 | `node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue -f json -o <scratch>/x.json` | 同一 harness 改前/改后两次全仓逐规则计数**逐项相等**（diff 无输出）；`no-console` 等 warning 未增加（本单 src 只动 request.ts，且未新增 console/未用变量） | `raw/02`、`raw/06`、`raw/09` |
| `build:h5` EXIT=0 | `npm --workspace app-mobile run build:h5`（工作树根） | EXIT=0 | `raw/04`、`raw/08` |
| 只改 request 及测试/证据，不碰业务页面 | `git diff --name-only 321b4f6b..HEAD` | src 面只有 `app-mobile/src/api/request.ts`；`git diff --name-only 321b4f6b..HEAD -- backend/` = **0 行** | `raw/10-change-scope.txt` |

## 三 逐条明细

### 3.1 GET-only 判定（为什么这样写）

改造前 `request.ts:102-107`（基线行号）的条件只有「本地还能读到 token」+「没重试过」两个前提，
`method` 完全不参与判断 ⇒ 任何 method 的 401 都被原样重放。POST/PUT/DELETE 的**首请求可能已经落库**
（后端处理成功但响应因网络抖动被截断、或鉴权中间件在业务写入之后才返回 401 的那一类），
重放 ⇒ 重复开单 / 重复扣减，属不可逆副作用。

修后：

```ts
const retryToken = getToken()
const retryMethod = String(options.method || 'GET').toUpperCase()
if (retryToken && retryMethod === 'GET' && !(options as any)._retried401) { … }
```

- **缺省按 GET**：`options.method || 'GET'`，与 `request.ts:63` 的入参解构默认值一致，
  所以 `get()` / 裸 `request({url})` 这类不显式传 method 的调用仍保留防误杀重试。
- **统一大写比较**：`String(…).toUpperCase()` ⇒ 小写 `'get'`（用例⑥）也判为幂等，
  不出现「大小写漏判导致 GET 也不重试」的反向退化；`'post'` 之类小写同样被非 GET 分支拦住。
- 非 GET 首次 401 直接落到下面的清态 → `showToast` → `reLaunch` → `reject` 链路，
  行为与改造前「无 token」时的路径完全同构，没新增提示与跳转。
- 未引入幂等键、未改 `upload()`（`uni.uploadFile` 本就不走这条 401 分支）。

### 3.2 ★ CSRF 镜像键结论（这条判断会被验收盯，依据 + 行号）

**结论：只需一条 `uni.removeStorageSync('merchant_csrf_token')`，不需要第二条删除。**

依据链（全部为本工作树 `321b4f6b` 既有代码）：

1. `merchant_csrf_token` 是敏感 Key：`src/api/storage.ts:75-81`，其中 `CSRF_TOKEN: 'merchant_csrf_token'` 在 `:80`；
   文件头 `:5` 与映射表 `:21` 已写明它落 `enc_merchant_csrf_token` 镜像键。
2. `storage.ts` **模块加载即安装 uni API 拦截器**：`installUniInterceptor()` 定义于 `:172`，
   由模块级 IIFE 在 `:210`（先 `migrateFromPlainStorage()`）与 `:215`（后装拦截器）自动执行。
3. 拦截器的 remove 分支 `:196-203`：对 `sensitiveKeySet.has(key)` 的键做**两件事**——
   `removeSecureStorage(key)`（`:198`，删加密镜像键）+ `_originalRemoveStorageSync(key)`（`:199`，删历史明文残留）。
4. `removeSecureStorage` 在 `src/utils/crypto.ts:923-933`：H5 分支 `:926` `ls.removeItem('enc_'+key)`
   （直接打 `window.localStorage`，与 `setSecureStorage` 的写入位置 `:862` 对称）；
   非 H5 分支 `:931` `uni.removeStorageSync('enc_'+key)`，`enc_xxx` 不在 SENSITIVE_KEYS ⇒ 走原始删除，不递归。
   ⇒ **两条平台分支都能真删掉 `enc_merchant_csrf_token`**。
5. 拦截器在真实运行期一定「在环」：`src/App.vue:4` import `@/stores/user`，
   `src/stores/user.ts:11` import `@/api/storage` ⇒ 应用启动的模块图求值阶段就装好拦截器；
   `request.ts` 只在函数体内调用 `uni.*`（模块求值时不调用），因此任何一次 401 清态都必定经过 `:196-203`。
6. 一致性：`request.ts:113-115` 原有的 `merchant_token / merchant_user / merchant_tenant_id`
   三行本来就是靠这同一个拦截器清镜像键的。CSRF 若再补一条 `uni.removeStorageSync('enc_merchant_csrf_token')`
   属于**不对称的多余动作**，而且在 H5 上打不中目标 —— H5 的 `enc_` 键写在 `window.localStorage`
   （`crypto.ts:862`），而 `uni.removeStorageSync` 清的是 uni 自己的存储层，不是同一处，
   补的那条只会变成一条永不生效的假清理。

**实测佐证（不是只读代码）**：新增用例⑪⑫⑬ 把 `storage.ts` 与 `crypto.ts` 一起装进测试运行时
（`vitest.config.ts` 的 `uni-ifdef-shim` 按 H5 分支裁剪 + 桩 `window.localStorage`）：

- ⑪：单条 `uni.removeStorageSync('merchant_csrf_token')` 之后，桩 `localStorage` 里的
  `enc_merchant_csrf_token` **消失**，`getCsrfToken()` 返回 `''`。
- ⑫：跑**真实 401 路径**（POST ⇒ 不重试 ⇒ 清态）之后，`enc_merchant_csrf_token` 与 `enc_merchant_token`
  均不残留，明文键也不残留 ⇒ 证明「CSRF 与 token 同语义」这条判断成立。
- ⑬：镜像键的删除责任归 `storage.ts` 的 `removeCsrfToken()`（`:365-369`）/ 拦截器，而非 request.ts 里补第二条。

### 3.3 测试为什么算「真实驱动」

- `vi.stubGlobal('uni', …)` 造 uni 运行时（`request` 的 success 回调同步触发，模拟「已收到响应」），
  再 `vi.resetModules()` + `await import('../src/api/request')` 取**全新的模块实例**（顺带重置模块级
  `unauthorizedHandling` 去重锁，避免用例间互吞 toast/跳转）。
- 断言对象是 request.ts 运行后的**可观察副作用**：`uni.request` 调用次数与 method、
  `removeStorageSync` 记录到的被删键集合、`showToast` 文案集合、`reLaunch` 目标集合、Promise 的 resolve/reject 值。
- ⑩ 才是静态文本兜底（`toUpperCase()` / `retryMethod === 'GET'` / CSRF 那一行），
  卡片与注释都写明它**不可替代**行为用例；反测 (a)(b) 的红点都落在行为用例上（②③④⑦⑧⑩⑫），
  说明门不是靠文本断言撑住的。
- 额外护栏：⑤ 缺省 method、⑥ 小写 get、⑦ 无 token 不重试、⑧ 只重试一次、⑨ 403/404/500 原样 ——
  覆盖任务书 §二.4「不改变其它状态码处理」。

## 四 反测（门必须能红）

两条均按共享协议 §3 的**原子自复原循环**，各用一条 bash 命令走完：
注入前 SHA256 → 逐字节注入（`<scratch>/inject.mjs`，`readFileSync`/`writeFileSync` 用 latin1 保 CRLF，
命中数≠1 直接 `exit 9` 拒绝）→ 跑门取 EXIT 与点名输出 → `cp` 复原（**没用 `sed -i`**）→ 复原后 SHA256 → 复跑绿。
`request.ts` 全文 CRLF=246 / 纯 LF=0，注入前后按 hash 字段比对。

### (a) 摘掉 GET 判定（恢复「无条件重放」）→ `docs/evidence/qoder-14/anti/a-get-gate/`

| 段 | 文件 | 读数 |
| --- | --- | --- |
| 注入前 | `00-pre-sha256.txt` | `4db802da…f9ce029f` |
| 注入 | 命中 1 处：`if (retryToken && retryMethod === 'GET' && !(…)._retried401)` → `if (retryToken && !(…)._retried401)` | INJECT_EXIT=0 |
| 跑门（红） | `01-anti-a-vitest-red.txt` | **VITEST_RED_EXIT=1，6 failed / 8 passed**；点名：**② POST ⇒ 0 重试（红）**、**③ PUT（红）**、**③ DELETE（红）**，连带 ④、⑩、⑫ 一起红（写请求被重放后根本走不到清态） |
| 复原 | `cp` 自 `<scratch>/request.ts.orig` | RESTORE_EXIT=0 |
| 复原后 | `02-restore-sha256.txt` | `4db802da…f9ce029f`，`SHA_MATCH=YES`（逐字节一致） |
| 复跑（绿） | `03-anti-a-vitest-green.txt` | **VITEST_GREEN_EXIT=0，14 passed** |

⇒ 目标用例（任务书 ②③）确实点名而红，门能红。

### (b) 删掉 CSRF 清理那一行 → `docs/evidence/qoder-14/anti/b-csrf-clear/`

| 段 | 文件 | 读数 |
| --- | --- | --- |
| 注入前 | `00-pre-sha256.txt` | `4db802da…f9ce029f` |
| 注入 | 命中 1 处：`uni.removeStorageSync('merchant_csrf_token')` 整行换成 `void 0 /* ANTI-B … */`（行结构不动） | INJECT_EXIT=0 |
| 跑门（红） | `01-anti-b-vitest-red.txt` | **VITEST_RED_EXIT=1，5 failed / 9 passed**；点名：**④ 401 清态含 CSRF 键（红）**，失败原因原文 `expected [ 'merchant_tenant_id', …(2) ] to deeply equal [ 'merchant_csrf_token', …(3) ]`；连带 ⑦⑧⑩⑫ 红 |
| 复原 | `cp` 自 `<scratch>/request.ts.orig-b` | RESTORE_EXIT=0 |
| 复原后 | `02-restore-sha256.txt` | 同 hash，`SHA_MATCH=YES` |
| 复跑（绿） | `03-anti-b-vitest-green.txt` | **VITEST_GREEN_EXIT=0，14 passed** |

⇒ 两条反测各自打在自己的目标对象上；注入只在同一条命令内存在，未进入任何提交（`e32782c7` 与工作树均为修后正式态）。

## 五 口径偏差报备（任务书文字 vs 仓库事实）

1. **基线没有门禁设施**（`321b4f6b` 实况）：`app-mobile/` 无 `tests/`、无 `vitest.config.ts`、
   无 `.eslintrc.cjs`、无 `scripts/gates-baseline.json`；`app-mobile/package.json` 的 scripts 只有
   `dev:*/build:*/guard:logout`，**没有 `test` / `lint` / `type-check`**。
   ⇒ 任务书 §三 的「test 不劣化 / type-check 0=0 / lint 不劣化」在基线上**没有可直接跑的载体**，
   按共享协议 §2 用等价装置：
   ```
   git show 9fd90257:app-mobile/vitest.config.ts > app-mobile/vitest.config.ts
   git show 9fd90257:app-mobile/.eslintrc.cjs    > app-mobile/.eslintrc.cjs
   mkdir -p app-mobile/tests
   ```
   工具入口走工作树根 `node_modules`（junction → 主仓）的真实 js：
   `node ../node_modules/vitest/vitest.mjs run` / `node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit` /
   `node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue` /
   `npm --workspace app-mobile run build:h5`。
   **两件借入件未提交，且已在最后一轮读数取完后删除**（见 §六、`raw/11-closeout-checklist.txt`）。
2. **「test 不劣化」的口径**：基线 `tests/` 为空 ⇒ vitest 报 `No test files found, exiting with code 1`
   （既有用例数 = **0**，见 `raw/03`）。本单只能报「基线无既有用例；本单新增 1 文件 / 14 用例全过 EXIT=0」，
   **不声称**与链上 56 用例对齐。基线那次 EXIT=1 不是本单引入的失败。
3. **「lint 不劣化」的口径**：同一 harness 下改前/改后各跑一次全仓计数，
   要求 error 与 warning **逐规则 ≤ 改前**；实测两次计数**完全相等**（`raw/09` diff 无输出）。
   注意 eslint 退出码改前改后都是 1（基线既有 20 条 error 造成，与本单无关，未新增也未减少）。
4. **行号复核（基线 `321b4f6b` 实测，用 `git show 321b4f6b:app-mobile/src/api/request.ts | grep -n`）**：
   任务书 §一 写 `request.ts:97-107` ⇒ **与基线一致**；派单正文写「401 分支起于 `:98`」⇒ 实际
   `if (statusCode === 401)` 在 **`:97`**（`:98` 是紧随其后的「防误杀」注释行），差 1 行。
   派单正文的「静默重试块 `:102-107`」= `if (retryToken && !(options as any)._retried401) { … }` 本体，**准确**；
   但它描述的 `const retryToken = getToken()` 在 **`:101`**（不在 :102-107 区间内）。「清态块 `:108-110`」
   （`merchant_token` / `merchant_user` / `merchant_tenant_id`）**准确**，且这三行确实没有 `merchant_csrf_token`。
   修后行号见 §一 表（GET 判定 `105-112`、CSRF 清理 `:121`）。
5. **CSRF 键名事实**：派单正文与代码一致 —— 读点在 `request.ts:59`，常量在 `storage.ts:80`，
   镜像键与拦截器说明在 `storage.ts:5` / `:21`。补的清理按 §3.2 结论**只加一条**。
6. **`.eslintrc.cjs` 的 ignorePatterns 含 `tests`**，且 lint 只跑 `src` ⇒ 新增 spec 文件按口径**不进 lint 面**；
   `tsconfig.json` 的 include 只有 `src/**` ⇒ spec 也不进 `vue-tsc` 类型面。这两点如实报备，不夸大为「测试也过了 lint」。
7. **反测 `.orig` 备份放在工作树外 scratch**（`D:\Users\ZXQL\wt-agents\_qoder14-scratch\request.ts.orig{,-b}`），
   没有落进 `docs/evidence/`：把 `request.ts` 的整份副本提交进证据目录会扩大改动面；
   复原的逐字节一致性已由 00/02 两段 SHA256 证明。协议 §3 的「备份 *.orig」在这条上按 scratch 路径执行，如实报备。
8. **主仓任务书原件未动**：本工作树基线 `321b4f6b` 里没有
   `docs/tasks/inbox/QODER-14-auth-retry-safety.md`，按协议 §1 从主仓只读路径读取，未做任何修改。

## 六 红线对照

| 红线 | 自评 |
| --- | --- |
| 不 push、不开 PR | 遵守（全程无 `git push`；分支无 upstream 推进，见 `raw/11`） |
| 不 `git add -A` | 遵守（逐文件 `git add app-mobile/src/api/request.ts app-mobile/tests/request-retry-safety.spec.ts`；docs 笔同样逐文件 add） |
| 只动分配的工作树与分支 | 遵守（主仓工作树与其它 `wt-agents/*` 只读；scratch 只放临时脚本与借入件复原备份） |
| 不改后端 | 遵守（`git diff --name-only 321b4f6b..HEAD -- backend/` = 0 行，见 `raw/10`） |
| 不 `npm install/uninstall`、不改 `package.json` 依赖、不动 appid/支付/推送/插件配置 | 遵守（无任何安装动作；`package.json` / `manifest.json` / `pages.json` 未出现在 diff 面） |
| 提交消息格式与笔数 | 遵守（`fix: 中文描述` + `docs: 中文描述`，共 ≤3 笔本地提交） |
| 借入 harness 不提交 | 遵守（`app-mobile/vitest.config.ts`、`app-mobile/.eslintrc.cjs` 已删除；`dist/` 由 `app-mobile/.gitignore:2` 覆盖，未入库） |
| 不写「凌舟裁定 / 已通过验收」 | 遵守（本卡读数一律标注自评） |

## 七 未完成与阻塞

- **未做（本单范围外，如实列出）**：
  1. `merchant_tenant`（storage.ts 的第 3 个敏感 Key）**没有**加入 401 清态 —— 任务书只点名 CSRF，
     未授权扩大清理面；现状残留风险见 §八.2。
  2. 未给后端加幂等键 / `Idempotency-Key`（任务书 §二.4 明确禁止）。
  3. `upload()`（`request.ts:200+`，走 `uni.uploadFile`）的 401 没有任何处理，改造前后一样，本单未动。
  4. 链上门禁设施（`scripts/gates-baseline.json`、CI 里的 test/lint/type-check 接线、`package.json` 的
     `test`/`lint`/`type-check` 脚本）本单**未引入** —— 基线没有、任务书未点名，只按协议借 harness 做等价读数。
- **未验（无设备/无环境，不得写成「通过」）**：
  1. **真机 / App 端未验**：`#ifndef H5` 分支（AES-GCM + `uni` 存储）没跑过；
     用例⑪⑫⑬ 走的是 vitest 的 H5 条件编译裁剪（`crypto.ts` 的 H5 分支）。
  2. **浏览器手动 H5 未验**：没有实际登录、没有真实 401 响应，`showToast` / `reLaunch` 只由 mock 断言。
  3. **后端联调未验**：没有起 8080 服务，没验证过「POST 落库后返回 401」的真实序列。
  4. `build:app` / `build:mp-weixin` 未跑（任务书只要求 `build:h5`）。
  5. 并发 401 去重锁 `unauthorizedHandling` 的真实多请求时序未测（用例是单请求级）。
- **阻塞**：无。

## 八 风险与自我报备

1. **行为变更有真实代价**：弱网下「写请求已落库但返回 401」的场景，改前会重放（可能重复开单），
   改后直接把用户踢回登录页且不重放 —— 更安全，但用户会看到「登录已过期」而实际单子可能已开。
   要彻底消歧需后端幂等键（本单禁止），建议另开卡。
2. **401 清态仍不清 `merchant_tenant`**：本次只按任务书补 CSRF，若后续验收要求「登录态全清」，
   `request.ts:113-116` 还差这一行；属**已知未覆盖面**，非本单引入。
3. 用例⑤⑥⑦⑧⑨⑪⑫⑬ 是本单**自加**的护栏（任务书要求「至少 4 条」），14 条里有 10 条超出点名范围；
   其中 ⑩ 是静态文本兜底，不可替代行为用例（已在文件注释与本卡 §3.3 双重声明）。
4. 反测 (a) 的红点除目标 ②③ 外还连带 ④⑩⑫ —— 因为写请求被重放后走不到清态分支。
   这是**预期的连带**，不是断言写歪；点名清单见 §四。
5. 测试依赖借入的 `vitest.config.ts`（`uni-ifdef-shim` + `@` 别名）与 `environment: 'node'`；
   链上该 harness 若改动（例如把 `window` 交给他方 stub），⑪⑫⑬ 需要跟着调整。本单删除了借入件，
   复现命令在 §五.1 与 `docs/evidence/qoder-14/README.md`。
6. `String(options.method || 'GET')` 只看 `options.method`，不看 `uni.request` 的其它入参；
   若未来有调用方绕过 `request()` 直接调 `uni.request`，本防护不覆盖。
7. 本卡「未 push」的自证只有本地 `git log`/`git status` 可信；若上游被他人推进，需按 ref 复核（本单未 push）。

## 九 交付物与证据清单

**代码 / 测试（提交 `e32782c7`）**

- `app-mobile/src/api/request.ts`（修后 `:105-112` GET 判定、`:121` CSRF 清理）
- `app-mobile/tests/request-retry-safety.spec.ts`（新，14 用例）

**文档 / 证据（docs 笔）**

- `docs/tasks/cards/R101-QODER-14-回传.md`（本卡）
- `docs/tasks/inbox/ACTIVE-回执-QODER-14.md`（含 `===DSH-RECEIPT-BEGIN/END===`）
- `docs/evidence/qoder-14/README.md`
- `docs/evidence/qoder-14/raw/01-baseline-type-check.txt`
- `docs/evidence/qoder-14/raw/02-baseline-lint-counts.txt`
- `docs/evidence/qoder-14/raw/03-baseline-test.txt`
- `docs/evidence/qoder-14/raw/04-baseline-build-h5.txt`
- `docs/evidence/qoder-14/raw/05-post-type-check.txt`
- `docs/evidence/qoder-14/raw/06-post-lint-counts.txt`
- `docs/evidence/qoder-14/raw/07-post-test.txt`
- `docs/evidence/qoder-14/raw/08-post-build-h5.txt`
- `docs/evidence/qoder-14/raw/09-lint-before-after-diff.txt`
- `docs/evidence/qoder-14/raw/10-change-scope.txt`（收尾笔）
- `docs/evidence/qoder-14/raw/11-closeout-checklist.txt`（收尾笔）
- `docs/evidence/qoder-14/anti/a-get-gate/{00-pre-sha256.txt,01-anti-a-vitest-red.txt,02-restore-sha256.txt,03-anti-a-vitest-green.txt}`
- `docs/evidence/qoder-14/anti/b-csrf-clear/{00-pre-sha256.txt,01-anti-b-vitest-red.txt,02-restore-sha256.txt,03-anti-b-vitest-green.txt}`

**工作树外 scratch（不入库，路径已在 README 指明）**：`baseline-eslint.json`、`post-eslint.json`、
`eslint-summary.mjs`、`inject.mjs`、`request.ts.orig`、`request.ts.orig-b`、各 `baseline-*` / `post-*` 原始日志。

## 十 一行摘要

`request.ts` 的 401 防误杀静默重试现在只在**幂等 GET**（method 缺省 GET、统一大写比较）时重放一次，
非 GET 首次 401 直接清态 + 提示 + 跳登录，并在清态里补上漏掉的 `merchant_csrf_token`
（一条调用即连带删掉 `enc_merchant_csrf_token` 镜像键，依据 `storage.ts:196-203` + `crypto.ts:923-933`，已用 ⑪⑫⑬ 实测）；
新增 14 用例真实驱动该分支，改后 test 14/14 EXIT=0、type-check 0=0、lint 逐规则计数与基线完全相等、
build:h5 EXIT=0，两条反测各自红→复原 SHA256 逐字节一致→复跑绿（全部自评，未 push）。
