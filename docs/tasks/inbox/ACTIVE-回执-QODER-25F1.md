# ACTIVE-回执-QODER-25F1

【汇报 QODER-25F1】QODER-25F1 tabBar 撞名与 AI 响应式返工：续办会话补齐全部证据，硬验收自评达标，微信运行时未验已声明
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22

## 改了什么 / 证据在哪

- 实现笔 `d68e43e9`（前会话交付、负责人已复核）：`custom-tab-bar.vue`→`app-tab-bar.vue` 改名 + 5 挂载点 + `ai-chat.vue:638` `reactive<ChatMessage>` 响应式收口 + 守卫 spec `tests/tabbar-name-reactivity.spec.ts`（S1/S2/S3/R1/R2/R3）+ gates-baseline 13/202。**续办会话未重写实现。**
- 续办会话交付（本回执对应笔，全部原始输出在 `docs/evidence/qoder-25f1/`）：
  1. 四门复跑 GATES_EXIT=0、**13 文件 / 202 用例**（raw/57，干净串行）；baseline note 前缀机检 true、非 tests 分节逐字节相同。
  2. 三构建复跑全 EXIT=0；mp-weixin 撞名警告 **0 次**（grep 管道先用已知串自证非假 0，基线留档命中 1 次对照）；产物 `components/custom-tab-bar.*` 残留 **0**（raw/51-53、54）。
  3. 产物级 tabBar 核实：`app.json tabBar.custom=true`、根无 `custom-tab-bar/`、MP 产物 `hideTabBar` 命中 0 文件 ⇒ 微信端抑制原生栏只靠 `custom:true`，可见栏为每页手挂 `app-tab-bar`；**运行时行为无 DevTools/真机 ⇒ 未验**（raw/54 + 回传卡 §四）。
  4. H5 实开（本卡最硬）：**同一不刷新页面实例**内两段序列——收流 len 20→1620→2292；停止生成 len 30→1356→冻结 2316 且点击"■ 停止生成"后同序列内 stopBtn 1→0；序列内零 navigate/reload；mock 侧 `SSE CLIENT CLOSE after 210 events (remaining 390 events NOT sent)` 与前端点击时间戳相差 109ms 两侧互证（raw/58、55）。
  5. 两轮反测亲自复跑：Ⓐ 摘代理 ⇒ **R1 红点名**；Ⓑ 注回旧名 ⇒ **S1/S2/S3+G6 红点名**；均 INJECT_EXIT=0、SHA_BEFORE==SHA_AFTER（worktree-crlf）、MARKER_RG_EXIT=1、cp 树外复原、复跑绿（anti/A1、A2）。
  6. 端口口径更正已执行：删 `port-guard-f1.mjs`，dev:h5 显式 `--port 5399`；5399/8488/5173/5174/5175/8388 收尾全归零，前会话孤儿 dev:h5 进程已核 CommandLine 后清理，本卡无遗留 node 进程（raw/59）。
- `git diff bc1087ee..HEAD -- backend/` = 0 字节；未 push、未开 PR；逐文件 `git add`。

## 阻塞点 / 待裁

1. 微信端 `custom:true` 无根级 `custom-tab-bar/` 的运行时形态**未验**（无 DevTools/真机）——产物级证据已贴全；是否另派真机接线卡请负责人裁。
2. App 端 tabBar 同题未验（无设备）。
3. 内置浏览器 runtime 通道会话初期卡死约 20 分钟（等待后恢复，未造数），已在回传卡 §八/§九 报备。

详细十项见 `docs/tasks/cards/R101-QODER-25F1-回传.md`。

---

## 负责人复验补记（Qoder 亲自跑，2026-10-22 03:38~04:5x；上文为执行会话口径，本节不复用其装置）

1. **四门**：串行独立复跑 GATES_EXIT=0、**13 文件 / 202 用例**（raw/60）；文档终态再复跑一次见 raw/67。
2. **三构建 + 撞名 0 次的非假 0 证明**：mp-weixin/h5/app 全 EXIT=0、撞名警告计数 0（raw/61）；负责人自己另起正对照
   ——把标签注回旧名后同一条管道计到 **1** 且 `BUILD_EXIT_mp-weixin=1`（Rollup 解析 `uni-components/lib/custom-tab-bar`
   的 `uni-tabbar` 失败）。⇒ 撞名在 MP 侧不止是警告，而是**直接构建失败**，比派单原文的"警告"更严重。
3. **产物级**：`custom-tab-bar*` 文件名计数 0；产物内该字符串仅剩 1 处 `<view class="custom-tab-bar …">` 的 **CSS 类名**（派单允许项）
   （raw/63）。运行时形态仍未验（无 DevTools/真机），与上文待裁 1/2 同口径，负责人不代判。
4. **两轮自有反测**：另写注入器 `probe/owner-inject-25f1.cjs.txt`，Ⓐ 摘 `reactive` ⇒ 仅 R1 红；Ⓑ 注回旧名 ⇒ S1/S2/S3+G6 红；
   SHA 恒等 + `MARKER_RG_EXIT=1` + 复跑绿（anti/70、71）。两轮各出现一次**负责人自己的作废轮**（首轮注入未完整落盘 / 残留 `})` 致语法错），
   已在对应日志内留档说明，未改写。
5. **H5 未刷新实证（本卡最硬判据）**：同一页面实例，负责人用 `window.__OWNER25F1_MARK` 自定义全局标记逐字不变来自证"没有刷新"
   （比"未调用 navigate_page"更强）；收流 len 逐点增长；点"■ 停止生成"后**同一序列内** stopBtn 1→0 且 len 冻结 200 连续 6 点 4.8s，
   mock 侧 `SSE CLIENT CLOSE … remaining 101 events NOT sent` 与点击时间差 **+19ms**（raw/64）。
6. **量具更正（影响上文第 6 条"端口归零"与 QODER-26F1 同类读数）**：执行会话 raw/59 与我自己的 26F1 raw/20 用
   `Get-NetTCPConnection`/`netstat LISTENING` 计数判"端口已空"，该量具对本机 vite 的 `[::1]` 环回监听**报假 0**（同时 `curl` 返回 200）。
   两处正面结论一律降级为"该设备下的读数"。负责人本轮改用 `curl_rc=7 / http_code=000` 为主设备，
   实测 5499/8488/5399/5173/5174/8388 六端口全部拒绝连接（raw/65、66）。
7. **口径更正（负责人自认）**：本会话早期我给执行会话的端口简报里"必须另起占位装置"的措辞，导致执行会话造了 `port-guard-f1.mjs`
   并把 5173/5174 之争复杂化；实际框架支持显式 `--port`。该装置已由执行会话删除，本条为我的口径责任登记。
8. **红线复核**：`git diff bc1087ee..HEAD -- backend/` = **0 字节**；`git diff d68e43e9..HEAD --name-only` 全部落在 `docs/` 前缀；
   终态 porcelain 0（raw/66、67）；未 push、未开 PR、逐文件 `git add`。

