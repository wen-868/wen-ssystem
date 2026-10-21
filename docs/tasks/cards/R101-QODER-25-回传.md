# R101-QODER-25 回传卡 · AI Chat 三端条件编译与自绘 tabBar（MO-17/18）

【汇报 QODER-25】QODER-25 AI Chat 三端条件编译与 tabBar —— 六条交付物全部落地，四门/三构建 EXIT=0，H5 实开拿到「停止生成 = 服务端真掐流」两侧互证；微信与 App 端真机表现未验。
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22
交付物：见 §一、§二（逐条含文件路径 + 行号 + 提交哈希）
证据（可复跑）：见 §三、§十（命令 + 原始输出摘要 + 证据文件名 + 行号）
验收自评：见 §四（逐条 通过/未通过 + 依据，非裁定）
未完成与阻塞：见 §七
风险与自我报备：见 §八
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-25-回传.md
关联卡：docs/tasks/inbox/QODER-25-ai-cross-platform.md

> 分工与署名口径（先说清，免得读数来源混淆）：
> - 实现笔 `5b90a744`（2026-10-21T22:13+08:00，作者 `墨 <mo@zhixiang-system.com>`，仓库内所有执行方与负责人共用同一 git 身份 ⇒ 作者字段无法区分角色，故此处按会话如实标注）由**执行方子代理会话**产出；`docs/evidence/qoder-25/raw/10·11·12·20·30·31·32·33·34·35·40·41·50` 与 `anti/round-01…05`、`mock-ai-backend*` 均为**执行方**留下的日志。
> - 本卡、`docs/tasks/inbox/ACTIVE-回执-QODER-25.md`、`docs/evidence/qoder-25/README.md` 三份文档，以及 `raw/60·61·71·73·74` 与 `anti/60-owner-anti-*` 全部读数，由**负责人（本代理）本人**实测/撰写。执行方会话在证据齐备后中断，未产出任何文档，文档段由负责人补做。
> - 本卡不写任何「裁定」「验收结论」字样的判定；判定权不在执行侧。

## 一、基线与提交（全部 `git rev-parse` 实测，非臆写）

| 项 | 值 | 取数方式 |
|---|---|---|
| 任务书基线 | `bc1087eec4b880827518444be36f5874e330e1d3` | 任务书 §一；机检 `raw/50:14-15` `git merge-base --is-ancestor bc1087ee HEAD` ⇒ `IS_ANCESTOR_RC=0`，`raw/50:17-19` `git log --oneline -4` 中 `5b90a744` 的下一笔即 `bc1087ee` |
| 实现笔 | `5b90a744e76702aac4372ba91ac0849390dc4069` | `$ git rev-parse HEAD` 原文见 `raw/50:10-11`；负责人复跑同值见 `raw/74:14,31` 与 `raw/60:2` |
| 分支 | `fix/qoder-25-ai-cross-platform` | 工作树 `D:\Users\ZXQL\wt-agents\QODER-25`（`raw/50:4` 登记） |
| 范围 | 6 文件 +497 / −40 | `$ git show --stat 5b90a744` |
| 后端只读 | `git diff bc1087ee..HEAD -- backend/` = 0 字节 | `raw/50:29 BACKEND_DIFF_BYTES=0`、负责人复跑 `raw/60:136` 同值 |

改动文件（`git show --stat` 原文口径）：

- `app-mobile/src/pages/ai-chat/ai-chat.vue` +204（主战场：三端读图 / 按端中止 / MP 播报确定行为 / 挂自绘栏）
- `app-mobile/tests/ai-cross-platform.spec.ts` +250（新增独立 spec，10 用例）
- `app-mobile/src/api/modules/ai.ts` +60（`AiChatControls`：H5 `signal` / 非 H5 `registerCancel` 双通道）
- `app-mobile/src/components/custom-tab-bar.vue` +10（隐藏原生栏口径收口）
- `app-mobile/src/App.vue` +7（同上口径，启动即隐藏）
- `app-mobile/scripts/gates-baseline.json` ±6（只动 `tests` 段：11/186 → 12/196，note 追加式）

## 二、逐条实现说明（对应任务书 §二 六条；行号 = HEAD `5b90a744` 本人现场核对）

### ① 交付物 1：图片读取按端分派（禁止 App 进小程序分支）

`ai-chat.vue:420 fileToDataUrl(filePath)` 把原来 `#ifndef H5` 的「小程序 + App 混用 `uni.getFileSystemManager`」拆成三块互斥条件编译：

- `:425 // #ifdef H5` → `fetch(filePath)` → `blob()` → `:429 new FileReader()` → `readAsDataURL`
- `:436 // #ifdef MP-WEIXIN` → `:438 const fs = uni.getFileSystemManager()`（该端唯一合法宿主）
- `:446 // #ifdef APP-PLUS` → `:452 new plus.io.FileReader()` + `:463 plus.io.resolveLocalFileSystemURL(...)`，`:461` 保留「部分机型 `tempFilePath` 已是可直读路径」兜底
- `:448` 显式写下红线注释：本分支不得出现 `uni.getFileSystemManager` / `wx.env`
- 同形分派也覆盖播报取文件路径那一段：`:887 #ifdef H5`、`:892 #ifdef MP-WEIXIN`（`fs` 读文件后交 `createInnerAudioContext`）、`:914 #ifdef APP-PLUS`（`plus.io`，且 `:921` 无 `plus.io` 时回落 `speakSystem`）
- 由 `:486 fileToDataUrl(p)` 逐附件调用；失败面走 `onFail` 文案，不落空指针

守卫：G1（`:183`）、G1b（`:188`）、G10（`:241`）。

### ② 交付物 2：中止模型按端收口（不得只把 UI 标成停止）

`api/modules/ai.ts` 建立「按端双通道」，页面按端只填本端那一格：

- `:335-337 export interface AiChatControls { signal?: AbortSignal; registerCancel?: (cancel: (() => void) | null) => void }`
- `:348 streamChat(params, handlers, controls)` → `:355` H5 走 `streamChatH5(params, handlers, controls.signal)`；`:358` 非 H5 走 `streamChatLegacy(params, handlers, controls.registerCancel)`
- H5 侧 `:194 signal?: AbortSignal`，`:239 if (!(signal && signal.aborted))` —— 中止后不再把残帧当正常增量抛给页面
- 非 H5 侧 `:262 registerCancel?` 回调、`:266 let cancelledByUser = false`、`:306-316` 持有 `uni.request` 返回的 `RequestTask` 并注册 `() => { cancelledByUser = true; task.abort() }`；`:316` 若该端 `RequestTask` 无 `abort` 能力则**回传 `null`**（不假装可停）；`:297 if (cancelledByUser) { resolve(); return }` 走确定终态
- 页面侧 `ai-chat.vue:261-265` 用 `#ifdef H5` / `#ifndef H5` 分别声明 `abortController` 与 `cancelLegacyRequest`；`:638-641` 仅 H5 创建 `AbortController`；`:666-673` 仅 H5 填 `controls.signal`、非 H5 填 `controls.registerCancel`；`:722-727` 收尾按端清引用
- `:587 abortActiveRequest(): boolean` 用「默认 false + 条件编译覆盖」的并列 if（不是双 `return`，避免不可达分支），H5 调 `abortController.abort()`、非 H5 调 `cancelLegacyRequest()`
- `:608-614 stopGeneration()`：`abortActiveRequest()` 返回 false 时 `:612 uni.showToast('本端暂无法中止该请求，请稍候')` —— **拿不到句柄就明说，不改 UI 冒充已停**
- `:622 sendMessage()` 起手先 `abortActiveRequest()`，防并发双流

守卫：G2（`:196`）、G8（`:231`）。

### ③ 交付物 3：MP 播报失败给确定行为（禁止调空函数）

- `:956-957` 播报入口按端分流：H5 `:950-951` 与 APP-PLUS `:953-954` 调 `speakSystem(clean)`；MP-WEIXIN `:957` 调 `notifyMpSpeakUnsupported()`
- `:990-991 notifyMpSpeakUnsupported()` 实现 = `uni.showToast({ title: '小程序暂不支持系统语音播报', icon: 'none' })`（任务书 §二.3 第一方案，文件内 `:985-989` 注释写清理由：`wx` 无系统语音合成 API，`createInnerAudioContext` 只能播已存在的音频文件）
- 后端 TTS 链路在 MP 端的三个失败出口同样落到该函数：`:908`（写文件/播放失败回调）、`:911 fail:`（TTS 请求失败）
- `speakSystem` 本体只在 H5（`:963-971`）与 APP-PLUS（`:972-980`）有实现，MP 端**无任何调用点**

守卫：G3（`:201`）、G4（`:206`）。

### ④ 交付物 4：AI 页挂载 `custom-tab-bar` + 微信端 `custom:true` 产物核实

- `ai-chat.vue:208 <custom-tab-bar :current="'ai'" />`，`:223 import CustomTabBar from '@/components/custom-tab-bar.vue'`
- 隐藏原生栏口径统一为 `#ifndef MP-WEIXIN`（不是只盖 `APP-PLUS`）：`App.vue:11-15`、`custom-tab-bar.vue:96-100`（`try { uni.hideTabBar({ animation: false }) } catch { /* 未就绪时忽略 */ }`；口径理由写在 `custom-tab-bar.vue:96` 的注释里 —— H5 上 `tabBar.custom:true` 不原生生效，不隐藏就会出现两条底栏）
- **微信端核实结论（任务书 §二.4 指定要写回证据的项）**：
  1. `pages.json:839 tabBar.custom=true` **确实透传进产物**：`app-mobile/dist/build/mp-weixin/app.json` 机检到 `"custom": true`（`raw/61` MP 段、`raw/41` 同点复核，`RG_EXIT=0`）。
  2. AI 页产物 `mp-weixin/pages/ai-chat/ai-chat.wxml` 内含 `<custom-tab-bar>` 节点（页面内自绘组件渲染路线），`rg -c` = 1。
  3. 微信小程序规范要求的**根目录原生自定义 tabBar 件 `custom-tab-bar/index.js` 不产出**：`$ ls -d app-mobile/dist/build/mp-weixin/custom-tab-bar` → `LS_EXIT=2`（目录不存在）。本仓 5 个 tab 页（home / products / functions / profile / ai-chat）一律走「页面内挂 `components/custom-tab-bar.vue`」这一既有口径，本卡把 AI 页补齐到同一口径，**未新增原生目录**（属扩大改动，不在本单收口面）。
  4. 由此推出：**微信端底栏真机表现未验**（无设备、无微信开发者工具），且「`custom:true` + 页面内自绘、不补原生 `custom-tab-bar/` 目录」是否为长期口径，须由负责人裁 → 已登记 §七.2、§十。
- mp-weixin 构建对 `<custom-tab-bar>` 打出官方提示（`raw/40:40`、负责人复跑 `raw/60` 同条原文）：「组件 `<custom-tab-bar>` 是 H5 平台专用组件，在 mp-weixin 平台使用可能导致错误。如果你要引入自定义 tabBar 可重命名为其他名称。」—— **构建 EXIT=0 但这是该组件名与 uni 内置组件撞名的在册警告**，登记 §七.3 / §八.2。

守卫：G6（`:219`）、G7（`:224`）。

### ⑤ 交付物 5：静态配对守卫（新增独立 spec）

`app-mobile/tests/ai-cross-platform.spec.ts`：250 行、1 个 `describe`、10 个 `it`、24 条 `expect`（本人 `grep -c` 实测）。求值方式为**导入期读源码文本 + 条件编译块归约**（`:105-109` 读 `ai-chat.vue` / `ai.ts` / `custom-tab-bar.vue` / `App.vue`，`:167` 再读 `ai.ts` 行数组），因此不需要真起三端运行时就能钉死平台边界。用例名与守护对象一一对齐（含凌舟在 QODER-13F1 立下的「测试名必须能看出守的是谁」口径）：G1 / G1b / G2 / G3 / G4 / G6 / G7 / G8 / G9 / G10。其中 G9（`:237`）就是红线自证：断言源码里不存在 `typeof xxx !== 'undefined'` 式平台探测吞错。

### ⑥ 交付物 6：反测逐项摘除（三件必红）

执行方做了 5 轮（详见 §五台账）：App 分支注回 FS API、非 H5 注回 `AbortController`、AI 页摘掉 `<custom-tab-bar>`，另加第 5 轮摘 `registerCancel` 注册（覆盖交付物 2 的 `ai.ts` 面）。负责人又独立复跑其中 3 轮。每轮均为「注入 ⇒ 红且点名对应守卫 ⇒ `cp` 备份复原 ⇒ SHA 前后相等 ⇒ 复跑绿」。

## 三、门 · 构建 · 守卫读数

### 3.1 常驻四门串跑 `npm --workspace app-mobile run check:gates`（负责人本人复跑，出处 `raw/60`）

```
type-check   vue-tsc EXIT=0，当前错误 0 条，基线 0 条                    （raw/60:15）
lint         当前 error 0（基线 0）、warning 12872（基线 12872）          （raw/60:22）
test         Test Files 12 passed (12) / Tests 196 passed (196)
             —— test 门（用例数冻结）：当前 12 文件 / 196 用例，基线 12 / 196 ——（raw/60:53-58）
check:contract 口径① 292 / ② 283 / ③ 204；后端注册端点 1498；
             差集（调用有、注册无）1 条，其中具名豁免 1 条                  （raw/60:65-69）
GATES_EXIT=0                                                              （raw/60:72）
```
执行方在同尖端上的一次串跑读数逐项同名同值（`raw/30:4,14,21,52-53,57,64-68`）⇒ **两方独立复跑，四门读数一致**。

### 3.2 三构建（负责人本人复跑，出处 `raw/60` 后段；执行方 `raw/40` 同尖端一致）

| 构建 | 负责人 EXIT | 执行方 EXIT | 产物内 AI 页 / 自绘栏 |
|---|---|---|---|
| `build:h5` | `BUILD_EXIT_h5=0` | `raw/40:25 BUILD_h5_EXIT=0` | `h5/assets/pages-ai-chat-ai-chat.BieDSea6.js`、`custom-tab-bar.C-imRqs-.js`；AI 页 chunk 内 `停止生成`=1、`custom-tab-bar`=1（`raw/61`） |
| `build:mp-weixin` | `BUILD_EXIT_mp-weixin=0` | `raw/40:43` | `pages/ai-chat/ai-chat.{js,json,wxml,wxss}`；`ai-chat.wxml` 内 `custom-tab-bar`=1；`app.json` `"custom": true` 命中（`raw/61`） |
| `build:app` | `BUILD_EXIT_app=0` | `raw/40:63` | `app/app-service.js` 内 `plus.io.resolveLocalFileSystemURL` 命中、`停止生成`=1；`uni.getFileSystemManager` **0 命中**（`RG_EXIT=1`） |

按端剥离的机检（负责人 `raw/61`，每条带 `RG_EXIT` 原值，不用管道尾码）：

- H5 产物 `getFileSystemManager` → `RG_EXIT=1`（小程序专属 API 未漏进 H5 包）
- H5 产物 `小程序暂不支持系统语音播报` → `RG_EXIT=1`（MP 块被剥离）
- App 产物 `uni.getFileSystemManager` → `RG_EXIT=1`；`小程序…播报` 文案 → `RG_EXIT=1`
- MP 产物 `getFileSystemManager` → `RG_EXIT=0`（该端应保留）

构建期把取证用 `app-mobile/.env` 移树外再构建：`MV_ENV_EXIT=0` / `RESTORE_ENV_EXIT=0`（`raw/60`），产物不依赖取证配置。

### 3.3 基线段机检（只准 `tests` 段动）

- `tests.testFiles` 11 → 12、`tests.testCount` 186 → 196，`note` **只追加**（新 note 以旧 note 为前缀，机检 `startsWith` 通过）
- `typeCheck` / `lint` / `checkContract` / `contractDrift` 四段 `JSON.stringify` 与基线态逐字相等（差 0 字节）
- 追加段内容自证口径：写明 10 用例的守卫编号与构成（`+10`）、src 面四文件、以及「lint 段零改动 ⇒ 未调任何数字换绿」
- 出处：`raw/50:162-179`（基线 diff 原文）

### 3.4 范围与红线机检（执行方 `raw/50`，负责人复跑 `raw/60`）

`git diff --name-only bc1087ee..HEAD` = 上表 6 文件（`raw/50:34-41`）；`git status --porcelain` 在文档落笔前只列 `?? docs/evidence/qoder-25/`（`raw/50:26`、`raw/74` 末段）；测试文件内 `it.skip` / `xit(` / `describe.skip` / `fdescribe` / `eslint-disable` / `timeout:` / `slow(` 七模式全 0 命中（`raw/50:182-191`）。

## 四、判据自对账（任务书 §三 硬验收逐条；自评 + 依据，不作裁定）

| 判据 | 自评 | 依据 |
|---|---|---|
| `check:gates` EXIT=0 | **通过** | 负责人亲跑 `raw/60:72 GATES_EXIT=0`（12/196、error 0、type 0/0、契约差集全豁免）；执行方同尖端一致（`raw/30:4`） |
| 三构建均 EXIT=0，产物中 AI 页 / 自绘栏存在 | **通过** | `raw/60` 三个 `BUILD_EXIT_*=0` + `raw/61` 逐端产物命中（§3.2） |
| H5 实开：底栏只出现一层 | **通过（H5 端）** | 负责人独立实开 `raw/73 §②`：`customTabBarNodes=1`（computed `display:block`、z-index 999）；`uni-tabbar` 节点虽在 DOM 但 `display:none`（z 998）⇒ 视觉单层 |
| H5 实开：发送有运行证据 | **通过** | `raw/73 §⑤` 场景 `interval=200ms/events=8`：服务端 `SSE DONE after 8 events`，重挂载后 DOM 全文 30 片（首轮 22 + 本轮 8）、两行均入 `!streaming` 终态（🔊 播报 出现） |
| H5 实开：停止生成有运行证据（真中止，不是只改 UI） | **通过** | 两侧同取：客户端点 `.ai-stop-btn`（`raw/73 §③`）⇒ 服务端 `raw/71:17-20` `SSE CLIENT CLOSE after 22 events (remaining 178 events NOT sent)`；时间线自洽（15:53:09.456 起流 → 等 6s 点击 → 15:53:16.442 服务端见 close）；重挂载后 DOM 实得 22 片 == 服务端已发 22 片。执行方 `raw/34 §④` 独立拿到同形结论（19 片 / remaining 181）⇒ **两次独立复现，数字互不引用** |
| H5 实开：附件读取有运行证据 | **通过** | `raw/73 §⑥`：注入 70 字节 PNG → `<input type=file>` → `change`，得 `srcLen=118`、前缀 `data:image/png;base64,iVBORw0KGg` 与注入源同源，`attachFailText=false`（`onFail` 未触发） |
| `git diff bc1087ee..HEAD -- backend/` = 0 | **通过** | `raw/50:29`、负责人复跑 `raw/60` 末段：`BACKEND_DIFF_BYTES=0` |
| 工作树 clean | **通过（本笔收口后）** | 文档 + 证据全部入库后 `git status --porcelain` 为空（§十一 末次实测） |
| mp-weixin / App / H5 **真机**表现 | **未通过（未验，不许当通过）** | 无微信开发者工具、无 iOS/Android 设备；三端条件编译只由静态守卫（G1/G1b/G2/G10）+ 产物剥离机检（§3.2）+ H5 实开证明。任务书 §四 明文「不得把构建通过当三端运行通过」 |

## 五、反测轮次台账

| 轮次 | 归属 | 注入目标（文件:行） | 红点名守卫 | TEST_EXIT | SHA 对称 | 复原字节差 | 残留检查 | 复跑 | 结果 |
|---|---|---|---|---|---|---|---|---|---|
| round-01 | 执行方 | `ai-chat.vue:448` App 分支注回 FS API | G1 | 1 | **假对称 ⇒ VOID** | — | — | 绿失败（注入残留） | **本轮 SHA 段自作废**：驱动脚本 `REL` 漏 `src/` ⇒ `SHA_BEFORE/AFTER` 双双为空、空串判等产生 `SHA_MATCH=1` 假对称。执行方自检出并原文登记（`anti/round-01:50-60`），未改写日志，另立 round-02 |
| round-02 | 执行方 | `ai-chat.vue:448` | G1 | 1 | `a9e87c90…b9725` 前后相等（`worktree-crlf`） | `DIFF_BYTES_AFTER_RESTORE=0` | — | `GREEN_TEST_EXIT=0` | 有效 |
| round-03 | 执行方 | `ai-chat.vue:639` 非 H5 注回 `AbortController` | G2 | 1 | 同上相等 | 0 | — | `GREEN_TEST_EXIT=0` | 有效 |
| round-04 | 执行方 | `ai-chat.vue:208` 摘 `<custom-tab-bar>` | G6 | 1 | 同上相等 | 0 | — | `GREEN_TEST_EXIT=0` | 有效 |
| round-05 | 执行方 | `ai.ts:358` 摘 `registerCancel` 注册 | G8 | 1 | `28ae2973…17f0c3`（**注意：目标文件不同 ⇒ SHA 值不同，非同一 SHA 属正常**） | 0 | — | `GREEN_TEST_EXIT=0` | 有效 |
| owner-1 | 负责人 | `ai-chat.vue:448` | G1 | 1 | `a9e87c90…b9725` 前后相等 | `DIFF_BYTES_AFTER_RESTORE=0` | `MARKER_RG_EXIT=1`（注入标记零残留） | `GREEN_TEST_EXIT=0`（12/196） | 有效，且 SHA 与执行方 round-02 **同值**（两方独立复现同一点位） |
| owner-2 | 负责人 | `ai-chat.vue:639` | G2 | 1 | 同上 | 0 | `MARKER_RG_EXIT=1` | `GREEN_TEST_EXIT=0` | 有效 |
| owner-3 | 负责人 | `ai-chat.vue:208` | G6 | 1 | 同上 | 0 | `MARKER_RG_EXIT=1` | `GREEN_TEST_EXIT=0` | 有效 |

负责人轮次额外项：`PRECHECK_DIFF_BYTES=0`（起点必须是干净文件）、注入器 `hits≠1 ⇒ exit(2)`（三轮 `INJECT_HIT_COUNT=1`、`INJECT_EXIT=0`）、`EXPECT_HIT=3`（红输出必须真点名，不看整体退出码）。注入器与工作树内副本逐字节同源（`sha256 182cbb48cb10fb4594b5a7e2a87d7f2b5ea31ae40f110bd38122d095d19f5f01`）。

## 六、红线对照（逐条自查）

| 任务书 §四 | 自查 | 机检证据 |
|---|---|---|
| 不得 push、开 PR、`git add -A`、改后端 | 遵守 | 全程无 `git push` / `gh pr`；提交逐文件 `git add <路径>`；`BACKEND_DIFF_BYTES=0`（`raw/50:29`、`raw/60`） |
| 不得用 `typeof xxx !== 'undefined'` 吞平台错配 | 未使用 | 本卡 diff 内新增行该模式命中 0（`raw/50:77-93`）；固化为守卫 G9（`spec:237`） |
| 不得把构建通过当三端运行通过 | 遵守 | 未验项在 §四、§七 明写「未验」，无一处折算为通过 |
| 不得改 AI 协议、模型参数、页面业务流 | 遵守 | `ai.ts` 仅新增 `controls` 通道与终态判定，请求体/模型参数/会话协议未动（diff 60 行全为该面）；流式渲染滞后的存量缺陷**只登记不修**（§八.1），因修复要改页面业务流 |

## 七、未完成与阻塞（如实，不许当通过）

1. **三端真机运行未验**（阻塞：无设备 / 无微信开发者工具）。H5 已实开证明；mp-weixin、App 仅有静态守卫 + 产物剥离机检。
2. **微信原生自定义 tabBar 目录缺失待裁**：产物无 `custom-tab-bar/index.js`（`raw/61` LS_EXIT=2）。现口径「`custom:true` + 每页挂自绘组件」是否必须补原生目录才能上真机，须由负责人裁；本卡未扩面新增目录。
3. **mp-weixin 构建警告在册**：`<custom-tab-bar>` 与 uni 内置 H5 组件撞名警告（`raw/40:40`、`raw/60` 复跑同条）。EXIT=0，但重命名（如 `zx-tab-bar`）会波及 5 个 tab 页 + 组件文件，超出本单收口面 ⇒ 未动，登记待裁。
4. **MP / App 端中止与读图零运行证据**：G1b / G8 是静态断言；`RequestTask.abort()` 在真实基础库上的行为、`plus.io` 在真机上的可读路径，均未实测。
5. **H5 流式渲染滞后缺陷未修**（存量，非本卡引入；详见 §八.1）—— 修法要动页面业务流，与本单红线冲突。
6. 阻塞项：无外部依赖阻塞。

## 八、风险与自我报备（含越面发现）

1. **★ 存量渲染滞后缺陷（跨卡，非本卡引入，建议另立单）**：`ai-chat.vue` 把对象字面量 push 进 `messages.value` 后，回调里改的是**原始对象**（`:716 aiMsg.content = '已停止生成'`、`:719 aiMsg.streaming = false`），未经 reactive proxy ⇒ 不触发重渲染。数据侧正确、DOM 停在旧值，直到任意无关重渲染或重挂载才追平。
   归因（机检非推测）：`git show bc1087ee:app-mobile/src/pages/ai-chat/ai-chat.vue` 同形写法在 `:546 / :552 / :611`，本卡尖端对应 `:632 / :634 / :719` 未改动 ⇒ **基线态即存在**。
   这解释了两条一度无法判定的读数：执行方 `raw/34 §⑤` 作废的「第三发点停止后仍显示 ■ 停止生成」，与负责人第一轮 `raw/73 §④` 的「`aiChars=0` 但 `taDisabled` 已 false」。负责人用重挂载实验判明：`location.reload()` 后 `stopNodes=0`、`aiChars=22`、`hasStoppedText=false` ⇒ **状态正确、渲染未发生**，不是中止逻辑错。
   附带风险：用户点停止后当场看到的仍是旧 DOM（可能误以为没停），属体验缺陷；「停止生成是否真掐断请求」的判据不受影响（服务端 `CLIENT CLOSE` 为实证）。
2. **撞名风险面**：§七.3 的警告意味着未来 uni 版本若把 `custom-tab-bar` 当内置组件处理，mp-weixin 端行为可能变化；建议派单评估重命名。
3. **取证装置为网络夹具，非产品代码**：`docs/evidence/qoder-25/mock-ai-backend.mjs` 只实现登录链 + `/api/chat`（SSE）+ `/api/chat/models` + `/api/voice/tts`，其余端点 `FALLBACK 200 empty`。它证明的是**前端行为**，不代表后端契约；`/api/app/version/app_mobile` 走 FALLBACK（见 §八.4）。执行方端口 8388/5173→5199、负责人端口 8299/5299，全程与并发卡错开。
4. **跨卡复现证据（不属本卡管辖，只登记）**：H5 实开中登录页/首页持续出现「发现新版本 / 新版本 **vundefined** / 稍后 / 刷新」（`raw/73 §⑧`），伴随 mock `GET /api/app/version/app_mobile -> FALLBACK 200 empty`。在 **不含 QODER-24 改动的 `bc1087ee` 基线态**可实测复现 ⇒ 版本接口无版本字段时提示仍弹且把 `undefined` 拼进文案。推断（未在本树验证，不得当实测引用）：QODER-24 支的严格 semver 解析会把该响应判为不合法 ⇒ 不再产生 prompt ⇒ 症状消失。归属 QODER-24 卡。
5. **文档由负责人补做**：执行方会话在证据齐备后中断，未产出回传卡/回执/README。为避免「有证据无文档」被误读成「无交付」，本卡显式区分两方读数来源（见开头口径块）。
6. 执行方 round-01 的 `SHA_MATCH=1` 假对称事件已由执行方**自检并自作废**（`anti/round-01:50-60`），未改写原始日志、另立 round-02。负责人认可该处置方式并在 §五 台账保留该行不删。

## 九、踩坑实录（可复用）

1. **`TaskStop` 只杀 npm 父进程，vite/uni 子进程存活**：负责人收尾首轮因此写下互斥读数（「已无监听」与 `H5_HTTP=200` 同段并存），且 `curl -w '%*'` 是非法占位符（输出字面 `CURL_RC=%*`）。正确做法：`netstat -ano` 端口→PID ⇒ `Get-CimInstance Win32_Process` 确认属主与 `StartTime` ⇒ `taskkill //PID <子> //F //T` ⇒ 再复核监听 + `curl`（期望 `HTTP=000` / `RC=7`）。原始日志不改写，`raw/74` 另立「追加更正」段。
2. **`cmd | head` 之后 `$?` 是 `head` 的**：产物机检一律直接 `rg … ; echo "RG_EXIT=$?"`，不用管道尾码（`raw/41` 有该自查更正，负责人 `raw/61` 全量按此写法）。
3. **uni-app H5 自动化**：browser-use `click(uid)` 在 `<uni-button>` 上抛 `this.scrollIntoView is not a function`、`fill` 不触发 v-model。可用配方：原生 value setter（`Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set`）+ `dispatchEvent(new Event('input'))`，再对目标依序派发 `pointerdown/mousedown/pointerup/mouseup/click`（`raw/73 §①`）。
4. **改哈希不等于重挂载**：`#/home` → `#/ai-chat` 后 DOM 不变；判「状态错」还是「渲染滞后」必须 `location.reload()` 取真重挂载读数（`raw/73 §④`）。
5. **选择器猜错要如实标为自己的错**：负责人 §⑤ 一次 `speakBtns:0` 是我猜的 `.voice-btn/.speak-btn` 两类名在树内不存在，同刻 `innerText` 明明有两处「🔊 播报」⇒ 已就地登记为读数失误，禁止折算成「按钮缺失」这类发现。
6. **反测跨文件 SHA 不等属正常**：`round-05` 目标是 `ai.ts`（`28ae2973…`），与前四轮 `ai-chat.vue`（`a9e87c90…`）不同；台账必须标目标文件，否则会被误读成「复原没成功」。

## 十、复现命令 + 待裁 + 建议派单

```bash
cd /d/Users/ZXQL/wt-agents/QODER-25
# 0) 谱系与范围
git rev-parse HEAD                       # 期望 5b90a744e76702aac4372ba91ac0849390dc4069
git log --format=%P -1                   # 期望首项 bc1087ee…
git diff bc1087ee..HEAD -- backend/ | wc -c          # 期望 0
git diff --stat bc1087ee..HEAD                        # 期望 6 文件 +497/−40
# 1) 四门（期望 GATES_EXIT=0，tests 12/196）；必须在仓库根跑，进 app-mobile/ 会 No workspaces found ⇒ 读数作废
npm --workspace app-mobile run check:gates
# 2) 三构建（期望各 EXIT=0；产物口径 app-mobile/dist/build/<platform>）
npm --workspace app-mobile run build:h5 && npm --workspace app-mobile run build:mp-weixin && npm --workspace app-mobile run build:app
# 3) 产物按端剥离机检（期望：H5/App 的 getFileSystemManager 命中 0；MP 命中 ≥1）
rg -l 'getFileSystemManager' app-mobile/dist/build/h5/assets/*.js ; echo "RG_EXIT=$?"
rg -l 'plus.io.resolveLocalFileSystemURL' app-mobile/dist/build/app ; echo "RG_EXIT=$?"
# 4) 基线段机检（只准 tests 动；旧 note 必须是新 note 前缀）
git diff bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json
# 5) H5 实开（负责人端口：mock 8299 / dev 5299；执行方端口 8388·5199 / 续办 8199·5199）
MOCK_PORT=8299 MOCK_LOG=<abs>/raw/71-owner-mock-backend.log node docs/evidence/qoder-25/mock-ai-backend.mjs &
VITE_PROXY_TARGET=http://localhost:8299 VITE_AI_BASE_URL=http://localhost:8299 \
  npm --workspace app-mobile run dev:h5 -- --port 5299 &
curl -s -X POST http://localhost:8299/__mock -d '{"chat":{"intervalMs":300,"events":200}}'
#   ⇒ 页面点「■ 停止生成」后，mock 日志须出现「SSE CLIENT CLOSE after N events (remaining M events NOT sent)」
# 6) 反测（每轮：PRECHECK_DIFF_BYTES=0 ⇒ 注入 hits=1 ⇒ TEST_EXIT=1 且点名守卫 ⇒ cp 复原 ⇒ SHA 相等 ⇒ MARKER_RG_EXIT=1 ⇒ 绿）
#    注入器与备份在树外：/d/Users/ZXQL/wt-agents/_qoder25_ownverify/{inject.cjs,bak/,owner-round.sh}
```

### 待裁项（执行方/负责人视角的登记，判定权在凌舟）

1. 微信端是否必须补原生 `custom-tab-bar/` 目录（§七.2），还是把「`custom:true` + 页面内自绘」定为长期口径。
2. `<custom-tab-bar>` 撞名警告是否值得重命名（波及 5 个 tab 页 + 组件文件，§七.3）。
3. MP 播报的确定行为：本卡选「明确提示不支持」（任务书 §二.3 第一方案）。若业务要 MP 也能播，需另立单引入真实能力（如 TTS 生成音频 + `createInnerAudioContext` 播放），属新功能不在本单。
4. 「H5 流式渲染滞后」存量缺陷的修复归属与是否允许动页面业务流（§八.1）。
5. 三端真机运行验证何时排、由谁排（§四 末行、§七.1）。

### 建议派单（非裁定）

- **MO-17/18 真机收口单**：iOS + Android + 微信开发者工具三端跑 AI Chat 附件读取、停止生成、播报，各端取原始读数。
- **自绘 tabBar 统一单**：裁 §十.1/2 后一次性处理原生目录与组件命名，覆盖 5 个 tab 页。
- **流式渲染响应式修复单**：`messages` 元素改走 reactive proxy（`reactive()` 或在回调内通过 `messages.value[idx]` 寻址）+ 静态守卫防回退。
- **跨卡缺陷单**：「新版本 vundefined」提示（§八.4）与 QODER-24 合并验证。

## 附：证据树入口

`docs/evidence/qoder-25/README.md`（清单 + 归属 + 偏差登记）。核心读数文件：

- 执行方：`raw/30-gates-tip.log`、`raw/40-builds-tip.log`、`raw/41-build-artifacts-verify.log`、`raw/50-scope-redlines.log`、`raw/34-h5-browser-readings.log`、`raw/35-h5-teardown.log`、`anti/round-01…05`、`mock-ai-backend.mjs`
- 负责人：`raw/60-owner-gates-and-builds.log`、`raw/61-owner-artifacts.log`、`raw/71-owner-mock-backend.log`、`raw/73-owner-h5-readings.log`、`raw/74-owner-teardown.log`、`anti/60-owner-anti-{1,2,3}`

## 十一、负责人复验补笔（2026-10-22T00:08+08:00，追加不改写）

本卡自起 §一…§十 由负责人本人撰写，其中转录执行方日志处均标 `raw/3x·4x·5x`、`anti/round-0x`；负责人亲测处标 `raw/6x·7x`、`anti/60-owner-*`。

补充三条只在复验阶段才拿到的结论：

1. **执行方唯一未能解释的异常读数已闭合**：`raw/34 §⑤` 作废的「点停止后残留 ■ 停止生成」经负责人重挂载实验（`raw/73 §④`）判明为**存量渲染滞后**、状态本身正确 ⇒ 该作废读数不再构成对「停止生成 = 真中止」判据的反例，判据以 `raw/73 §③`（两侧同取）为准。
2. **两方反测 SHA 交叉验证**：负责人 owner-1/2/3 的 `a9e87c90d3892a98346f25b5757daf2b64fe39efc01f953274d52816170b9725` 与执行方 round-02/03/04 记录值逐字相同 ⇒ 复原目标即原始态，不是两方各自的另一个基线。
3. **装置收尾复核**（`raw/74` 追加更正段）：按 PID 精确终止后 `netstat` 无 5299/8299 监听，`curl` 两端均 `HTTP=000 / RC=7`；取证 `.env` 已移树外，`git status --porcelain` 只列 `?? docs/evidence/qoder-25/`。

收口后终态（本笔提交后实测）：`git rev-parse HEAD` 与 `git status --porcelain` 读数见 `docs/evidence/qoder-25/README.md` §6 与本次提交信息；`git diff bc1087ee..HEAD -- backend/` 保持 0 字节。
