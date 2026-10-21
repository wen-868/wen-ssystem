# QODER-25F1 证据树（tabBar 撞名改名 + AI 流式消息响应式）

- 分支：`fix/qoder-25F1-tabbar-reactivity`，基线 `286d071b`（QODER-25 尖端）
- 实现笔：`d68e43e9`（前一会话交付，10 文件）
- 证据与反测复跑：本续办会话（负责人 Qoder 派单，2026-10-22）。前一会话跑到轮次上限中断，
  `raw/01–45`、`anti/01–02` 为其原始留档（时间戳 2026-10-21T17:1x–19:0xZ / 02:2x+08:00），
  本会话另起 `raw/50–59`、`anti/A1–A2` 全部为自己刚跑的原始输出。两套并存、互不覆盖。
- **端口口径更正（负责人 2026-10-22 更正）**：前一会话的 `port-guard-f1.mjs` 占位装置已由本会话删除；
  dev:h5 改为显式 `npm --workspace app-mobile run dev:h5 -- --port 5399`（框架源码
  `@dcloudio/vite-plugin-uni/dist/cli/server.js:118` `options.port || serverOptions.port || 5173` ⇒ `--port` 被支持）。
  mock 后端 8488。全程未占用 5173/5174/8388。
- ⚠ 本目录是网络装置目录：`mock-ai-backend-f1.mjs` 为取证夹具，非产品代码。

## raw/ 索引（NN 编号；每份开头 `# <做什么> <ISO 时间戳>` + `$ <命令>`）

| 文件 | 谁跑的 | 内容 | 关键读数 |
|---|---|---|---|
| `01-baseline-build-mp-weixin.log` | 前会话 | 基线（未改名）mp-weixin 构建 | 撞名警告 1 次（反证锚点）`BUILD_EXIT=0` |
| `02-baseline-artifact-mpweixin.log` | 前会话 | 基线产物 components 目录 | `custom-tab-bar.*` 在册（改名前形态） |
| `30-gates-tip.log` | 前会话 | 工作树（实现未提交时）四门 | GATES_EXIT=0，13/202 |
| `31/33/34-build-*.log`、`35` | 前会话 | 三构建与台账 | 全 EXIT=0，警告 0 次 |
| `41/43/44/45` | 前会话 | mock/端口事故 note/dev 日志/H5 装置 | 43 为占位装置作废 note（本会话端口更正的依据） |
| `50-gates-tip-resume.log` | 本会话 | 尖端 `d68e43e9` 四门（与三构建并行，见 57 干净复跑） | GATES_EXIT=0 |
| `51-53-builds-resume.log` | 本会话 | 三构建串行于尖端 | `BUILD_EXIT_MP_WEIXIN=0` `BUILD_EXIT_H5=0` `BUILD_EXIT_APP=0` |
| `54-mpweixin-artifact-resume.log` | 本会话 | 撞名警告计数 + 产物级 tabBar 核实 | grep 管道自证 1→0；`components/custom-tab-bar.*`=0；`app.json tabBar.custom=true`；根无 `custom-tab-bar/`；MP 产物 `hideTabBar` 命中文件数 0（`54b-hideTabBar-hits.txt` 空）；框架源码锚点原文 |
| `55-mock-backend-resume.log` | 本会话 | mock 8488 原始日志 | `SSE DONE after 200 events (client stayed until the end)`；`SSE CLIENT CLOSE after 210 events (remaining 390 events NOT sent)` |
| `56-dev-h5-resume.log`、`56b` | 本会话 | dev:h5 显式 `--port 5399` 启动 + 端口→PID 归属 | `Local: http://localhost:5399/`，PID 20944 |
| `57-gates-tip-clean.log` | 本会话 | 四门干净串行复跑（反测之后） | GATES_EXIT=0，**13 文件 / 202 用例** |
| `58-h5-unrefreshed-sampling.log` | 本会话 | H5 未刷新采样序列（RUN1 收流 / RUN2 停止生成） | len 20→1620→2292；len 30→211→1356→2316 且 clicked-stop 同序列内 stopBtn 1→0；全程无 navigate/reload |
| `59-teardown-resume.log` | 本会话 | 收尾：端口→PID→CommandLine→taskkill→端口复跑 | 5399/8488/5173/5174/5175/8388 全归零；含前会话遗留孤儿 13668/7388 的核 CommandLine 后清理记录 |

## anti/ 反测台账

| 文件 | 轮次 | 注入 | 红点（点名） | 关键闸口 |
|---|---|---|---|---|
| `01-antitest-raw-proxy.log` | 前会话① | `reactive<ChatMessage>({` → 裸对象 | **R1**（tabbar-name-reactivity.spec.ts:165） | INJECT_EXIT=0；SHA 恒等；MARKER_RG_EXIT=1；复跑绿 |
| `A1-antitest-raw-proxy-resume.log` | 本会话①复跑 | 同上（inject-01-raw-proxy.cjs） | **R1**，AssertionError 原文+行号已贴 | INJECT_EXIT=0；SHA_BEFORE==SHA_AFTER=c88fc7…738a（worktree-crlf）；MARKER_RG_EXIT=1；VITEST_R1_RESTORE_GREEN_EXIT_CLEANPIPE=0（注：首轮管道取码失误已 note 更正） |
| `02-antitest-old-name-injection.log` | 前会话② | 标签/import 注回 `custom-tab-bar` | **S1/S2/S3 + 连带 G6** | 同上全套 |
| `A2-antitest-old-name-resume.log` | 本会话②复跑 | 同上（inject-02-old-name.cjs，2 对各 hits=1） | **S1/S2/S3 + G6**，红行原文+行号已贴 | INJECT_EXIT=0；SHA 恒等；MARKER_RG_EXIT_TAG=PATH=1；CSS 类名 `.custom-tab-bar` 残留为派单允许项（透明登记）；VITEST_R2_RESTORE_GREEN_EXIT=0 |

注入器：`inject-01-raw-proxy.cjs`、`inject-02-old-name.cjs`（.cjs；整行字面量匹配；hits!==1 ⇒ exit(2)；utf8 读写不碰 EOL）。
`cp` 树外备份：`/d/Users/ZXQL/wt-agents/_qoder25f1_bak/`（r1/r2-resume-ai-chat.vue.orig 等）。

## gates-baseline 机检（本会话 node -e 实测）

```
OLD tests.testFiles/testCount = 12 196
NEW tests.testFiles/testCount = 13 202
notePrefixCheck newNote.startsWith(oldNote) = true
typeCheck / lint / checkContract / contractDrift section byte-identical = true
_comment identical = true
```

---

## 负责人复验段（Qoder 亲自跑，2026-10-22 03:38~04:38；上文 raw/01–59 与 anti/* 为执行会话读数）

本节为**独立复验**：注入器另写（`probe/owner-inject-25f1.cjs.txt`，needle 由负责人自己从尖端 `d68e43e9`
读出并逐处实测命中数=1），不复用 `anti/inject-01/02`。负责人结论只到"自评 + 依据 + 待裁"，不构成验收裁定。

| 项 | 负责人实测读数 | 出处 |
|---|---|---|
| 四门 `check:gates`（串行、无并行负载） | GATES_EXIT=0；type-check 0=0；lint error 0 / warning 12872；test **13 文件 / 202 用例**；contract 差集 1 / 具名豁免 1 | raw/60 |
| 三构建 | mp-weixin / h5 / app 全 EXIT=0；撞名警告计数 **0** | raw/61 |
| **撞名警告正对照**（判据非假 0） | 注回旧名 ⇒ `grep -c '专用组件'` = **1** 且 `BUILD_EXIT_mp-weixin=1`（Rollup 解析 `@dcloudio/uni-components/lib/custom-tab-bar/custom-tab-bar.vue` 的 `uni-tabbar/uni-tabbar.vue` 失败）；复原后重新 0 / EXIT=0 | raw/61、anti/71 |
| 产物级核实 | `find -name 'custom-tab-bar*'` = **0**；产物内该字符串仅 1 处且为 `<view class="custom-tab-bar …">` 的 **CSS 类名**；`components/app-tab-bar.json` 的 `usingComponents` = `{}`；`app.json tabBar.custom=true`，list 5 页 | raw/63 |
| 基线追加机检 | 五个非 tests 段对 `bc1087ee` 逐段相等=true；`testFiles` 11→13、`testCount` 186→202；`tests.note` `startsWith(old)=true`（2941→4745）；无新增分节 | raw/62 |
| 反测 Ⓐ 摘 reactive | `INJECT_EXIT=0` ⇒ `TEST_EXIT=1`，`Tests 1 failed \| 201 passed (202)`，红点名 `R1 流式消息必须先入响应式代理再入 ref 数组…`，断言原文 `expected false to be true`；`SHA_BEFORE=SHA_AFTER=c88fc7…`、`MARKER_RG_EXIT=1`、复跑 13/202 绿。首轮因 patch 残留 `})` 造成语法错 ⇒ **作废留档**，改用整块多行 needle | anti/70 |
| 反测 Ⓑ 注旧名 | `INJECT_EXIT=0` ⇒ `TEST_EXIT=1`，`Tests 4 failed \| 198 passed (202)`，红点名 **S1 / S2 / S3 / G6**；同一 SHA 恒等、`MARKER_RG_EXIT=1`；首轮多步注入被后一步覆盖 ⇒ **作废留档**，修正后两步均落盘 | anti/71 |
| H5 未刷新流式增长 | 同一页面实例、**window 自定义标记 `__OWNER25F1_MARK` 全程逐字不变**（比"未调用 navigate"更强自证）；RUN1 `len` 51→20→332→1332、144 采样点、`stopBtn` 全程 1 后归 0；mock `SSE DONE after 120 events` | raw/64 |
| H5 停止当场生效 | RUN3 单调用自包含时序：点击时刻 `len=200 stopBtn=1`，点击后第一点即 `stopBtn=0` 且 `len` 冻结 200 连续 6 点（4.8s）；mock `SSE CLIENT CLOSE after 19 events (remaining 101 events NOT sent)` @ 点击后 **+19ms** | raw/64 |
| 红线 | `git diff bc1087ee..HEAD -- backend/` = **0 字节**；porcelain 0 行；未 push、未开 PR、逐文件 add | 本段末尾自检笔 |

### 量具更正（负责人口径更正，影响所有"端口归零"类读数）

`Get-NetTCPConnection -State Listen` 与 `netstat -ano | grep LISTENING` 在本机对 vite 的 **IPv6 环回 `[::1]` 监听**
会报 **假 0**：同一时刻 `curl http://localhost:5499/` 明确返回 200，而两设备均报 `LISTEN_COUNT=0`。
⇒ 本目录 `56b/59`（执行会话）与 `QODER-26F1 raw/20`（负责人自己）里"LISTEN_COUNT=0 即端口已空"的正面结论
一律降级为"该设备下的读数"。负责人本轮起改用 `curl_rc=7 / http_code=000`（连接被拒）作为主设备，
实测 5499/8488/5399/5173/5174/8388 **六端口全部拒绝连接**，详见 raw/65。原始日志均不改写，只另立更正段。

### 未完成 / 未验（与执行会话同口径，负责人复述而非代判）

1. 微信端与 App 端 tabBar 的**运行时**表现未验（无 DevTools / 无真机）；已到证据等级为"构建 + 产物"。
2. 浏览器截图未取；证据形态为 DOM 采样 + window 标记 + mock 服务端日志三向对账。
