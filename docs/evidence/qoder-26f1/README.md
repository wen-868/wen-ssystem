# QODER-26F1 证据树（清理残留运行日志并恢复 clean）

执行方：Qoder（移动端负责人亲自办，本卡 10 分钟时间盒，无子代理）
工作树：`D:\Users\ZXQL\wt-agents\QODER-26`　分支：`fix/qoder-26-sku-dimension`
基线 / 起点尖端：`a513ff9b`　派单：`docs/tasks/inbox/QODER-26F1-clean-evidence.md`
日期：2026-10-22

## 0. 本卡性质

派单 §一 只要求一个动作：把 `docs/evidence/qoder-26/h5/dev-h5-owner.log` 恢复到 HEAD 已提交版本；§三 禁止改业务代码、测试、基线与既有证据内容，禁止 `reset --hard` / `checkout --` / 广泛删除 / 杀未核 PID。因此本树不含四门与三构建复跑——派单 §二.4 明确「因无业务代码变化，不重复上调基线；保留上一轮四门 12/241 与三构建 0 的读数作为尖端证据」，上一轮读数指针见 `raw/30-no-business-change.log` §(2)。

## 1. 文件清单

| 文件 | 内容 |
|---|---|
| `raw/00-pre-state.log` | 恢复前实测态：`porcelain=1`、脏 blob `e7d854ce…` vs HEAD blob `6b6cabfe…`、27 行 vs 23 行、多出的 4 行 `23:44:54 [vite]` 空错误日志（`diff -u` 原文） |
| `raw/10-restore.log` | 恢复动作与验证：`git show` + `cp` 命令原文与 EXIT、`HASH_EQUAL=yes`、`lines_after=23`、`diff_bytes=0`、`git status --porcelain` |
| `raw/20-port-and-process.log` | 端口与残留进程：派单「8388 已释放」口径实测更正、PID 6616 身份核实链（含父进程命令行原文）、taskkill 输出、复跑端口读数三行归零 |
| `raw/30-no-business-change.log` | 零业务改动自证 + 上一轮尖端读数指针 + `nondocs_lines=2` 的 C 转义引号勘误注 |

树外副本（不进仓库，用于可复算前置态与防丢）：`D:\Users\ZXQL\wt-agents\_qoder26f1_bak\dev-h5-owner.log.dirty-27lines`（恢复前脏态整份）、`dev-h5-owner.log.head-23lines`（`git show HEAD:` 落盘，即复原源）。

## 2. 逐条判据自对账

| 派单 §二 | 结论 | 依据 |
|---|---|---|
| `git status --porcelain` 为空 | 通过（提交后） | `raw/10-restore.log` 里该文件恢复后只剩本卡新增 `?? docs/evidence/qoder-26f1/`；提交笔落成后最终自检见 `raw/40-closeout.log` |
| `git hash-object` == `git rev-parse HEAD:<path>` | 通过 | `raw/10-restore.log`：两侧同为 `6b6cabfedb388a85874eda36639b8528975b3f08`，`HASH_EQUAL=yes` |
| 5173、5174、8388 均无 LISTEN | 通过（当前态） | `raw/20-port-and-process.log` §(4)：`PORT_5173/5174/8388_LISTEN_COUNT=0`。**但派单 §一「8388 已释放」的前提交口不实**，8388 在本轮 00:52 仍由 PID 6616 监听，已核实身份后清理，见下 §3 |
| 不重复上调基线，保留上一轮读数 | 通过 | 基线 `gates-baseline.json` 零改动（`raw/30` 的 `business_diff_files=0`）；读数指针已带行号 |

## 3. 与派单口径的两处实测偏差（如实上报，非驳回）

1. **8388 未释放**。派单 §一 称凌舟已按明确 PID 清理、8388 已释放；负责人实测 8388 仍 LISTEN。该进程是上一轮**负责人自己的** QODER-25 H5 实证遗留 mock SSE 后端（`node.exe mock-ai-backend.mjs`，父进程 `bash.exe` 的 `eval` 串里写明 `cd /d/Users/ZXQL/wt-agents/QODER-25/docs/evidence/qoder-25`）。属已知坑：`TaskStop` 只杀 npm 父进程，node 孤儿子进程存活并继续占端口。核实 CommandLine 与"已不持有任何 socket"之后按 PID 清理；未动任何未核 PID。
2. **`dev-h5-owner.log` 的 4 行残留来源可解释**：多出的 4 行是 `23:44:54 [vite]` 后无内容的空错误行，与 5173 被占用后 vite 让位、dev server 收尾期间的空错误输出同型（该文件第 21 行即 `Port 5173 is in use, trying another one...` / `ready in 7403ms.`）。恢复动作不解释成因、不改动内容，一律以 HEAD blob 为准。

## 4. 红线对照

- 未 push、未开 PR、未 `git add -A`/`git add .`（逐文件 add，清单见 `raw/40-closeout.log`）。
- 未用 `reset --hard`、`checkout --`、广泛删除；恢复只走 `git show HEAD:<path>` → 树外文件 → `cp` 回位（`raw/10-restore.log` 命令原文）。
- 未改业务代码、测试、基线或任何既有证据内容；`app-mobile`+`backend` 面零差异。
- 未产生空提交（提交笔只含本卡新增的 docs 文件）。
- 完成后未再启动任何会写该日志的 dev server。

## 5. 复现命令

```sh
cd /d/Users/ZXQL/wt-agents/QODER-26
git rev-parse --short HEAD
git status --porcelain                                   # 期望空
git hash-object docs/evidence/qoder-26/h5/dev-h5-owner.log
git rev-parse HEAD:docs/evidence/qoder-26/h5/dev-h5-owner.log   # 两行必须相同
for p in 5173 5174 8388; do netstat -ano | grep -c ":$p .*LISTENING"; done
git diff bc1087ee..HEAD -- backend/ | wc -c              # 期望 0
```
