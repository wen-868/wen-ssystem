# ACTIVE-回执 · QODER-11R（H5 场景 3「× 可关闭」重栈复跑）

> 汇报对象：凌舟｜汇报人：**Qoder（移动端执行方）**｜日期：2026-10-21｜对应派单编号：QODER-11R
> 工作树 `D:\Users\ZXQL\wt-agents\QODER-11`｜分支 `docs/qoder-11r-h5-rebase-rerun`（本地未 push）｜基线 `dfeedbc0`

## 人读摘要

#368 合并后 main 已含 × 关闭按钮与 `menuStore.dismissBanner()`，本卡用与上一轮同一套 mock 网络手术装置（端口改 8288、dev server 改 5288 以与并发代理错开）复跑 H5 场景 3 四步：**③ 横幅出现 ⇒ 点 × 消失 ⇒ 再次触发 ③ 态 ⇒ 横幅重现**，四步浏览器实读全部达成，`dismissBanner()` 生效且只置会话内存态（不持久）。场景 3「× 可关闭」子项由上一轮 `2baf13af`「不通过」本轮闭环为「达成」。场景 1/2/4 通过结论保留未复跑；场景 5/6（Android/iOS 真机）继续**未验**。本卡**不改任何业务代码**，四门各跑一遍 EXIT 全 0，新旧证据并存不覆盖历史。

## 判据自评（卡 §三，逐条；均为执行方自评，非凌舟裁定）

- `git diff dfeedbc0..HEAD -- app-mobile/src` = **0 行**：✔（`git diff -- backend/` 亦 0；改动面全 docs/证据）。
- 场景 3 有截图/日志；关闭后本次会话隐藏、再次③态重现：✔（4 张 PNG + DOM 读数 note + console + mock 装置日志；步1/2/2b/3 四读齐）。
- 工作树 clean；证据无零字节未说明：✔（唯一 0 字节 `mock-backend.stdout.log` 已配 `.note.txt`；终态 `git status` 见收尾自检）。

## 未验清单

- 场景 5 Android 真机 WebView：**未验**（无 adb/无设备/无投屏；探测结论沿用 `docs/evidence/qoder-11/device-probe.txt`）。
- 场景 6 iOS：**未验**（无 iPhone/无 idevice 工具链）。
- 场景 1/2/4：本卡**未复跑**，结论沿用上一轮「通过」（非未验，是未在本卡重测；基线迁移对三态渲染无实质变化）。

===DSH-RECEIPT-BEGIN===
id: QODER-11R
status: 完成（场景 3 复跑闭环；场景 5/6 未验；不改代码）
summary: 基线 dfeedbc0 真跑 H5 场景 3 四步——③横幅出现⇒点×消失(集合不变/非阻塞)⇒本次会话隐藏⇒再次③态重现，dismissBanner() 生效；× 可关闭子项由上轮不通过闭环为达成；1/2/4 通过保留；5/6 真机未验；四门 EXIT 全 0；app-mobile/src diff=0；证据 docs/evidence/qoder-11r 与 qoder-11 并存。
worktree: D:\Users\ZXQL\wt-agents\QODER-11
branch: docs/qoder-11r-h5-rebase-rerun
commits: 证据笔 ae5e0243 + 执行记录/回传笔 4746ab31 + 收尾自证补哈希笔(分支尖端，含 end-check.log)；均 type: docs 中文描述、逐文件 add、本地未 push（ref=分支 docs/qoder-11r-h5-rebase-rerun + 最新哈希见 §3 与 end-check.log）
gates: type-check=0 / lint=0 / test=0(5 files/56 passed) / check:contract=0（原始输出 docs/evidence/qoder-11r/gates-run.log）
redlines: 未push/未PR/未add-A(逐文件)/非凌舟不写裁定/只动本工作树/不改代码(src&backend diff=0)/未npm install/未动任务书与ACTIVE.md/仅关自记录PID未杀他人进程/场景5-6一律未验
evidence: docs/evidence/qoder-11r/**（scene-3 四步截图 + scene-3-rerun.note.txt + console-messages.txt + snapshot-login-page.txt + dev-h5.log + mock-backend.mjs/.log/.stdout.note + port-shutdown-check.log + gates-run.log + git-diff-selfcheck.log + end-check.log）
return_card: docs/tasks/cards/R101-QODER-11R-回传.md
===DSH-RECEIPT-END===
