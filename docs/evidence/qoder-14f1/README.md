# QODER-14F1 证据目录 —— 401 清态补 `merchant_tenant` + 常驻门禁重栈

> 执行方：Qoder（移动端）子代理｜日期：2026-10-21
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-14`｜分支：`fix/qoder-14f1-auth-cleanup-restack`
> 卡基线：`dfeedbc0`（#368 合并后的 main）｜开工时分支尖端：`a5294668`（旧 3 笔 rebase 后的新哈希）
> 实现笔：`8c09cfbd`｜**未 push、未开 PR**
> 本目录所有读数均为**执行方自评**，不含验收结论；「绿/红」只描述命令退出码，不代表凌舟裁定。

## 〇 与上一轮 `docs/evidence/qoder-14/` 的关系（不覆盖、只并存）

本目录是**新目录**，旧目录 `docs/evidence/qoder-14/**` 一字未改、未删。两轮读数**不可直接比较**，
差异逐条点名如下（旧→新）：

| # | 读数 | 旧 `qoder-14`（基线 `321b4f6b`） | 本轮 `qoder-14f1`（基线 `dfeedbc0`） | 差异原因 |
| --- | --- | --- | --- | --- |
| 1 | 门禁形态 | 借入 harness：`git show 9fd90257:app-mobile/vitest.config.ts`、`.eslintrc.cjs` 后跑裸命令，交付前删除 | **main 常驻门禁**：`cd app-mobile && npm run type-check\|lint\|test\|check:contract`，零借入、零删除 | #368 已把 harness 入库（共享协议 §1） |
| 2 | test 判据 | 只跑本单 spec：`1 文件 / 14 用例`，无基线比较 | 常驻 test 门：`6 文件 / 70 用例` 与 `gates-baseline.json` 比对，改前 5/56 基线（打印「高于基线⇒请调高」）、改后基线调平 6/70 | 常驻门比的是全仓 6 个 spec |
| 3 | lint 全仓计数 | files=190 / error=20 / warning=**12880** / `no-console` **232** / `@typescript-eslint/no-unused-vars` **105** | files=**187** / error=20 / warning=**12872** / `no-console` **225** / no-unused-vars **104** | 基线不同：main 含 QODER-5 删 `utils/sync-manager.ts`（−653 行）等，与本轮同一分支的旧读数不可比；`gates-baseline.json` 的 lint 段就是按新态登记的，本轮逐规则与基线**逐项相等**（`raw/07`） |
| 4 | 反测 (b) 的对象 | 摘 `uni.removeStorageSync('merchant_csrf_token')` ⇒ 红 ④⑦⑧⑩⑫ | 摘 `uni.removeStorageSync('merchant_tenant')` ⇒ 红 ④⑩⑫（本轮新靶点，卡 §二.2/§三） | 本卡的动作项就是补 `merchant_tenant`；CSRF 那条断言已被并进 ④/⑫，未单独再反测 |
| 5 | `request.ts` sha256 | `4db802da4c1dc73038863567ad2438d39a641b9a371d079aae98f279f9ce029f` | `6585f7c5ea3f006537777c4d0a23130551c8415de84a644d91ccda49cd388376` | 本卡在该文件里新增了 8 行（注释 7 行 + 清理行 1 行），必然不同；**本轮两条反测的注入前后 SHA 各自逐字节一致**（见 §二） |
| 6 | 反测注入器目录 | `D:\Users\ZXQL\wt-agents\_qoder14-scratch\inject.mjs` | `D:\Users\ZXQL\wt-agents\_scratch\qoder-14f1-exec\inject.mjs`（工作树外，不入库） | 协议 §4 要求注入脚本在工作树外；两个 scratch 目录并存 |

## 一 文件索引

### raw/（各判据原始输出，每份头部写命令与 EXIT）

| 文件 | 内容 | EXIT |
| --- | --- | --- |
| `raw/01-pre-type-check.txt` | 改前 `npm run type-check`（常驻门） | 0（0 错 / 基线 0 错） |
| `raw/02-pre-lint.txt` | 改前 `npm run lint` | 0（error 20 / warning 12872） |
| `raw/03-pre-test.txt` | 改前 `npm run test`（基线仍为 5/56 的现场态） | 0（6 文件 / 70 用例 + 「高于基线⇒请调高」） |
| `raw/04-pre-check-contract.txt` | 改前 `npm run check:contract` | 0（差集 1 / 具名豁免 1） |
| `raw/05-post-type-check.txt` | 改后 `npm run type-check` | 0（0 错 / 基线 0 错） |
| `raw/06-post-lint.txt` | 改后 `npm run lint`（**判据本体**） | 0（error 20 / warning 12872，与基线逐项相等） |
| `raw/07-post-lint-per-rule.txt` | 逐规则 / 逐 `文件::规则` 明细（6 条 warning 规则 + 13 对 error 全部「当前=基线」） | 明细取证，判据以 `raw/06` 为准 |
| `raw/08-post-test.txt` | 改后 `npm run test`（基线已调 6/70） | 0（6 文件 / 70 用例，基线 6/70，无「请调高」提示） |
| `raw/09-post-check-contract.txt` | 改后 `npm run check:contract` | 0 |
| `raw/10-post-build-h5.txt` | `npm --workspace app-mobile run build:h5`（**在仓库根执行**） | 0（`DONE Build complete.`） |
| `raw/11-change-scope.txt` | 改动面自证：本卡 delta 仅 3 文件；`git diff d1a6adcf..HEAD -- backend/` = 0 字节；门禁本体 0 字节 | — |
| `raw/12-closeout-checklist.txt` | 收尾自检（共享协议 §7 逐条 + 四门复跑 EXIT） | 终态 `git status` 空 |

### anti/（门必须能红：反测四件套 × 2）

每条都是同一 bash 命令内原子完成：`sha256sum`（00）→ `cp` 备份 → `node inject.mjs` 字节精确注入（latin1 读写，
命中数 ≠1 直接 EXIT 9）→ `npm run test` 取红并点名（01）→ `cp` 复原 → `sha256sum` 比对（02）→ 复跑取绿（03）。
**未使用 `sed -i`，未用 Edit 删除功能行。**

| 目录 | 注入内容 | 红点名 | 复原 SHA | 复跑 |
| --- | --- | --- | --- | --- |
| `anti/a-get-gate/` | 摘掉 GET 判定：`retryToken && retryMethod === 'GET' && !` → `retryToken && !`（恢复无条件重放） | **6 条**：② POST 0 次重试 / ③ PUT / ③ DELETE / ④ 被删键集合 / ⑩ 源码静态兜底 / ⑫ 五敏感键无残留；`Test Files 1 failed \| 5 passed`、`Tests 6 failed \| 64 passed (70)`、门 EXIT=1 | `6585f7c5…` 前后逐字节一致（BYTE_IDENTICAL=yes） | `anti/a-get-gate/03-green.txt`：6/70 EXIT=0 |
| `anti/b-tenant-clear/` | 整行删除 `          uni.removeStorageSync('merchant_tenant')\r\n`（命中数=1 才允许注入） | **3 条**：④（集合少 `merchant_tenant`）/ ⑩（源码兜底 `toContain` 失败）/ ⑫（`enc_merchant_tenant` 仍残留）；`Tests 3 failed \| 67 passed (70)`、门 EXIT=1 | `6585f7c5…` 前后逐字节一致（BYTE_IDENTICAL=yes） | `anti/b-tenant-clear/03-green.txt`：6/70 EXIT=0 |

两条反测复原后，`app-mobile/src/api/request.ts` 的 SHA 均为
`6585f7c5ea3f006537777c4d0a23130551c8415de84a644d91ccda49cd388376`（与开工改动完成后、注入前的 00 文件同值）。

## 二 读数一览（执行方自评）

| 判据 | 命令 | 改前 | 改后 | 卡 §三 目标 |
| --- | --- | --- | --- | --- |
| type-check | `cd app-mobile && npm run type-check` | EXIT=0，0 错/基线 0 | EXIT=0，0 错/基线 0 | `0=0` ✅ |
| lint | `cd app-mobile && npm run lint` | EXIT=0，error 20 / warning 12872 | EXIT=0，error 20 / warning 12872，逐规则与逐 `文件::规则` 全部相等 | 逐规则不劣化 ✅ |
| test | `cd app-mobile && npm run test` | EXIT=0，6 文件/70 用例（基线 5/56 ⇒ 打印请调高） | EXIT=0，**6 文件 / 70 用例**（基线已调平 6/70） | 6/70 ✅ 与卡内目标一致 |
| check:contract | `cd app-mobile && npm run check:contract` | EXIT=0，差集 1 / 具名豁免 1 | EXIT=0，同读数 | EXIT=0 ✅ |
| build:h5 | `npm --workspace app-mobile run build:h5`（仓库根） | 未单独跑改前态 | EXIT=0，`DONE Build complete.` | EXIT=0 ✅ |
| backend 零改动 | `git diff d1a6adcf..HEAD -- backend/` | — | 0 字节 | =0 ✅ |

## 三 未验清单（真机/联调类，按协议 §6 如实登记）

| 项 | 状态 | 原因 / 复现命令 |
| --- | --- | --- |
| 401 清态在真机（iOS / Android / 微信开发者工具 / 小程序后台）的实际表现 | **未验** | 本环境无真机与小程序宿主；`request.ts` 的 tenant 清理只由 vitest（node 环境 + uni mock + H5 条件编译 shim）实测。复现：真机登录后手工把 token 置失效 → 触发一次 POST → 观察 `merchant_tenant` / `enc_merchant_tenant` 是否随其它四键一并消失 |
| 登录态整页 E2E（登录 → 过期 → 跳登录页 → 重登） | **未验** | 仓库内 Playwright 只覆盖 admin-web / saas-admin，app-mobile 不在 E2E 面内；无浏览器自动化装置可用 |
| 与后端联调（真实 401 响应下的清态 + 跳转链路） | **未验** | 无后端实例与登录凭据；用例走的是 `uni.request` mock 的 401 分支 |
| H5 产物目视 / 截图 | **未验（截图未产出）** | 本轮只做 `build:h5` EXIT=0 的构建判据，未起静态服务、未开浏览器目视，无 PNG 证据 |
| App/小程序端（`#ifndef H5` 分支）的 `enc_merchant_tenant` 删除 | **未验** | vitest 的条件编译 shim 固定按 **H5 分支**跑（`vitest.config.ts` 头注释说明）；非 H5 分支的 `uni.removeStorageSync('enc_'+key)` 路径只由代码阅读确认（`crypto.ts:930-932`），未有运行期读数 |

## 四 范围外登记

`upload()`（`request.ts:219+`，本卡 +8 行后行号自旧卡的 `:211` 漂移）没有 401 分支处理，属 **QODER-18** 的范围（卡 §二.5 明确「另单处理，本卡不碰」），
本轮对该函数**零改动**，也未为其新增断言。
