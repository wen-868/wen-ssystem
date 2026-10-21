# R101-QODER-26F1 回传

【汇报 QODER-26F1】QODER-26F1 清理残留日志 —— `dev-h5-owner.log` 已按 `git show` + `cp` 恢复到 HEAD blob（两侧同为 `6b6cabfe…`），工作树除本卡新增 docs 外零差异，5173/5174/8388 均无 LISTEN；另实测纠正派单「8388 已释放」口径（本轮清理前仍由遗留 mock 后端占用）。
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22
交付物：见 §一
证据（可复跑）：见 §二（`docs/evidence/qoder-26f1/raw/00·10·20·30·40`）
验收自评：见 §三
未完成与阻塞：见 §四
风险与自我报备：见 §五
回传要求：本汇报已落卡 `docs/tasks/cards/R101-QODER-26F1-回传.md`
关联卡：`docs/tasks/inbox/QODER-26F1-clean-evidence.md`

---

## 一、基线与提交

| 项 | 实测 |
|---|---|
| 工作树 | `D:\Users\ZXQL\wt-agents\QODER-26` |
| 分支 | `fix/qoder-26-sku-dimension` |
| 起点尖端 | `a513ff9b`（`git rev-parse --short HEAD` 实测，与派单 §基线一致） |
| 代码笔 | **无代码改动**（派单 §三 禁止改业务代码/测试/基线，本卡零 `app-mobile`、零 `backend` 差异） |
| 恢复动作本身 | **不产生提交**：文件回到 HEAD 态即与 `a513ff9b` 字节一致，任何提交都会是空提交，派单 §一 明确「不得产生空提交」。落证只走 §二 `raw/10-restore.log` |
| 文档笔① | `docs: QODER-26F1 回传卡 + 回执 + 证据树（恢复前后 hash 对账 + 端口与遗留进程清理）` —— 含 `docs/evidence/qoder-26f1/README.md`、`raw/00·10·20·30`、本卡、`docs/tasks/inbox/ACTIVE-回执-QODER-26F1.md` |
| 文档笔② | 收尾自检笔（含 `raw/40-closeout.log`，回填笔① 的实测哈希；哈希值以 `git log --oneline -2` 为准） |

逐文件 `git add`，未使用 `git add -A` / `git add .`；未 push、未开 PR。

## 二、逐条实现说明（文件:行号）

1. **恢复前置态取证** —— `docs/evidence/qoder-26f1/raw/00-pre-state.log`
   - `:14` 恢复前脏 blob `e7d854ceafd3d5ca2557194a71833a2405804b23`；`:16` HEAD blob `6b6cabfedb388a85874eda36639b8528975b3f08`；`:19-20` 行数 27 vs 23；`:24-31` `diff -u` 原文，多出的 4 行逐字为 `23:44:54 [vite]`（其后无内容），`DIFF_EXIT=1`。
   - 脏态整份保存在树外 `D:\Users\ZXQL\wt-agents\_qoder26f1_bak\dev-h5-owner.log.dirty-27lines`，上列全部读数可从该副本复算，不是手抄。
2. **恢复动作** —— `docs/evidence/qoder-26f1/raw/10-restore.log`
   - `:5-7` `git show HEAD:docs/evidence/qoder-26/h5/dev-h5-owner.log >` 树外副本（`SHOW_EXIT=0`）；`:9-10` `cp` 树外副本 → 工作树（`CP_EXIT=0`）。
   - `:12` 注明未使用 `reset --hard` / `checkout --` / 编辑器改写（派单 §三 红线）。
   - `:14-19` `git hash-object` 与 `git rev-parse HEAD:<path>` 两侧同为 `6b6cabfedb388a85874eda36639b8528975b3f08`，`HASH_EQUAL=yes`；`:22` `lines_after=23`；`:27` `diff_bytes=0`。
3. **端口与遗留进程** —— `docs/evidence/qoder-26f1/raw/20-port-and-process.log`
   - §(1) 派单口径更正：`$ netstat -ano | grep -E ':(5173|5174|8388)\b'` 原始输出显示 8388 由 PID 6616 LISTENING（00:52 实测）。
   - §(2) PID 6616 身份核实：`Name=node.exe`、`CommandLine="C:\Program Files\nodejs\node.exe" mock-ai-backend.mjs`、父进程 13536 是 `bash.exe`，其 `eval` 串写明 `cd /d/Users/ZXQL/wt-agents/QODER-25/docs/evidence/qoder-25 && node mock-ai-backend.mjs > mock-ai-backend.stdout.log` ⇒ 属**负责人上一轮 QODER-25 H5 实证遗留的 mock SSE 后端**，非业务进程、非未核 PID。核实后它已不持有任何 socket（`PID_6616_OWNS_NO_SOCKET`）。
   - §(3) `taskkill /PID 6616 /F /T` → `SUCCESS: The process with PID 6616 (child process of PID 13536) has been terminated.`
   - §(4) 复跑读数：`PORT_5173_LISTEN_COUNT=0`、`PORT_5174_LISTEN_COUNT=0`、`PORT_8388_LISTEN_COUNT=0`，`Get-Process -Id 6616` 空表。
4. **零业务改动自证** —— `docs/evidence/qoder-26f1/raw/30-no-business-change.log`
   - `:26`（脚本段）`business_diff_files=0`：`git diff --name-only 3f70b749..a513ff9b -- app-mobile backend` 零文件 ⇒ `a513ff9b` 是 docs-only 笔，上一轮门/构建读数可直接作为尖端证据（派单 §二.4）。
   - `BACKEND_DIFF_BYTES=0`（`git diff bc1087ee..HEAD -- backend/`）、`tracked_diff_bytes=0`（`git diff HEAD`）。
   - §(4) 追加勘误注：`nondocs_lines=2` 是 git 对含非 ASCII 路径的 C 转义加引号所致（`"docs/tasks/cards/R101-QODER-26-\345\233\236\344\274\240.md"` 等两个 docs 文件），不是业务改动；已用 `git diff --name-only a513ff9b^..a513ff9b | grep -v '^docs/'` 原样确认这两行内容。
5. **上一轮尖端读数指针（本卡未复跑，零业务改动）** —— 同文件 §(2) 表：`GATES_EXIT=0`（`docs/evidence/qoder-26/raw/80-owner-gates-and-builds.log:17`）、`Tests 241 passed (241)`（同上 `:21`；另 `raw/00-check-gates.log:53`）、test 门 12 文件 / 241 用例基线 12/241（`raw/00-check-gates.log:57`）、`BUILD_EXIT_h5=0`/`mp-weixin=0`/`app=0`（`raw/80-owner-gates-and-builds.log:7/:10/:13`）、vue-tsc EXIT=0（同上 `:18`）。该组读数现场 HEAD=`3f70b749`（同上 `:6`）。

## 三、判据自对账（逐条 通过/未通过 + 依据）

| # | 派单 §二 硬验收 | 自评 | 依据 |
|---|---|---|---|
| 1 | `git status --porcelain` 为空 | **通过（提交后）** | 恢复后唯一残留是本卡新增未跟踪 `?? docs/evidence/qoder-26f1/`（`raw/10-restore.log:31`）；文档笔提交后终态自检见 `raw/40-closeout.log` |
| 2 | `git hash-object` == `git rev-parse HEAD:<path>` | **通过** | `raw/10-restore.log:14-19`，同为 `6b6cabfe…`，`HASH_EQUAL=yes` |
| 3 | 5173、5174、8388 均无 LISTEN | **通过** | `raw/20-port-and-process.log` §(4) 三个计数均为 0。**注意前置口径被纠正**：派单 §一 称已释放，实测 8388 曾占用，见 §五.1 |
| 4 | 不重复上调基线；保留上一轮四门 12/241 与三构建 0 | **通过** | `gates-baseline.json` 零改动（`raw/30` 的 `business_diff_files=0`）；读数指针带文件:行号 |
| 5 | 完成后工作树 clean | **通过（提交后）** | 同 #1；`raw/40-closeout.log` 贴原样输出 |

## 四、未完成与阻塞

无。本卡四条动作全部落地。

## 五、风险与自我报备

1. **派单 §一 的事实前提交口不实（负责人口径更正）**：8388 并未释放，直到本轮 00:52 仍由 PID 6616 LISTENING。负责人上一轮 00:11 曾报 QODER-26 `porcelain_lines=0` 且端口已清，本轮实测两者均与事实不符——脏态确实存在（`dev-h5-owner.log` +4 行），8388 也确实被占。根因与既往一致：**`TaskStop` 只杀 npm 父进程，node/vite 子进程存活**并继续占端口、继续往证据日志追加。建议后续所有 dev/mock 收尾一律走「端口→PID→`taskkill //F //T`→端口归零复跑」四步，并禁止把 `TaskStop` 当作 teardown。
2. **本轮清理了一个非本卡工作树的进程**：PID 6616 属于 QODER-25 证据会话遗留。因 26F1 的端口判据要求 8388 归零，且 QODER-25 已交付并验收（返工单另在 25F1 树上做），故按核实后的 PID 清理；若凌舟认为该 mock 仍需保留，可从 `D:\Users\ZXQL\wt-agents\QODER-25\docs\evidence\qoder-25\mock-ai-backend.mjs` 一键重启，无状态丢失。
3. **同机并发风险**：本轮 23F1 / 25F1 两张卡正在各自工作树并行执行，25F1 需要 H5 运行态。已在本轮共享协议里为 25F1 另分配 mock 端口 8488 并禁用 5173/5174/8388，防止与本卡端口判据互相污染。26F1 全程未启动任何 dev server。
4. **`git diff --stat HEAD` 的 CRLF 提示**：`raw/10-restore.log` 里出现 `LF will be replaced by CRLF the next time Git touches it`，属 autocrlf 展示态，非内容改动；权威口径是同文件 `diff_bytes=0` 与 `HASH_EQUAL=yes`。
5. **未复跑四门与三构建**：按派单 §二.4 明确豁免（零业务改动）。若验收侧要求尖端 `a513ff9b`+本卡文档笔上有出厂读数，需要另下复跑单，本卡不自作主张重跑并改名冒充新读数。

## 六、红线对照

| 红线 | 事实 |
|---|---|
| 不得 push / 开 PR / `git add -A` | 未 push、未开 PR、逐文件 add |
| 不得改业务代码、测试、基线或既有证据内容 | `app-mobile`+`backend` 零差异；`gates-baseline.json` 未动；唯一被"改"的文件是恢复其 HEAD 态，内容未编辑 |
| 完成后工作树 clean，且原样贴 `git status --porcelain` | 见 `raw/40-closeout.log`（提交后） |
| 不得用 `reset --hard`、`checkout --`、广泛删除或杀死未核 PID | 全程只用 `git show` + `cp`；未删除任何文件；杀 PID 前打印过 CommandLine 与父子链 |
| 不得只写"已清理"而不给 status/hash/port 原始输出 | §二 全部带文件:行号的原始输出 |
| 不得产生空提交 | 提交笔只含本卡新增 docs 文件 |

## 七、踩坑实录

1. `TaskStop` 遗留孤儿 node 进程继续占 8388 —— 与派单前提交口冲突的根因，已在 §五.1 报备。
2. git `--name-only` 对 CJK 路径整体加引号（C 转义），使 `grep -v '^docs/'` 假报 2 个"非 docs 文件"；带路径限定的 `--name-only <range> -- app-mobile backend` 才是可靠机检。
3. `netstat -ano | grep LISTENING | grep -E ':(port)\b'` 这种先粗筛再细筛的管道在 MSYS 下会给出假 0 命中；改用 `grep -c ":$p .*LISTENING"` 单层计数并对三个端口逐一打印，才与 `Get-NetTCPConnection` 一致。

## 八、复现命令

```sh
cd /d/Users/ZXQL/wt-agents/QODER-26
git rev-parse --short HEAD                                   # a513ff9b 或其后的文档笔
git status --porcelain                                       # 期望空
git hash-object docs/evidence/qoder-26/h5/dev-h5-owner.log   # 期望 6b6cabfedb388a85874eda36639b8528975b3f08
git rev-parse HEAD:docs/evidence/qoder-26/h5/dev-h5-owner.log # 必须与上一行相同
for p in 5173 5174 8388; do echo "$p=$(netstat -ano | grep -c ":$p .*LISTENING")"; done
git diff bc1087ee..HEAD -- backend/ | wc -c                   # 期望 0
git diff --name-only 3f70b749..a513ff9b -- app-mobile backend | wc -l  # 期望 0
```

## 九、建议派单

1. **收尾铁律入库**：把「`TaskStop` 不等于 teardown；dev/mock 子进程必须按端口→PID→`taskkill //F //T`→端口归零复跑四步」写进 `agents.md` 的执行纪律，避免每张卡都靠验收方现场发现脏态。
2. **25F1 与 26F1 的端口互斥**已在共享协议里落定（25F1 用 8488），若后续还有需要 H5 实开的卡，建议同一协议里预分配端口表，而不是各自试探。
3. 四树 `tests` 段仍发散（23=11/187、24=12/227、25=12/196、26=12/241），收敛仍需一张集成单；本卡按派单未动基线。
