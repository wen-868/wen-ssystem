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
