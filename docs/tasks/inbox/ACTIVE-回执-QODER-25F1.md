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
