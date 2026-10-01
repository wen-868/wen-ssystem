# S3-145 证据留存（交接班「列表 ↔ 详情」同源）

> 归档人：凌舟（总负责人）｜2026-10-02
> 说明：这些原始输出原先只存在于**子代理工作区的 gitignored 目录**（`wt-agents/issue-215/.mimosa/s3-145-rt/`）⇒ 仓库外、**不可审、不可复跑**。随本单收口一并归入仓库。
> 装置本体已入库：`backend/scripts/s3-145-shift-chain.mjs`（`green|revert`，**未**加入 CI/e2e）。

## 一、判据汇总（凌舟亲跑）

| 证据文件 | 内容 | 关键结论行 |
|:--|:--|:--|
| `raw/f2-out-green.log` | **入库装置** green（凌舟亲跑） | `小结[green]：13 passed / 0 failed`、`GREEN_EXIT=0` |
| `raw/f2-out-antitest-red.log` | **真反测**：把 `getShiftList` 取数源改回 `t_daily_settlement` | `7 passed / 6 failed`、**`FAIL 段3 列表行 → 详情 200（原恒 404） ← status=404`**、`GREEN_EXIT=1` |
| `raw/f2-out-antitest-404.log` | 同构建下的 `revert` 分支（旧源口径） | `GET /api/store/shifts/BJ… ⇒ 404 {"code":"404","msg":"交接班不存在"}`（**用户可见症状复现**） |
| `raw/f2-out-restored-green.log` | 复原后 green | `13 passed / 0 failed`、`GREEN_EXIT=0` |
| `raw/f1-out-revert-red.log` | F1 版装置的真反测（同改坏） | `9 passed / 4 failed`（段2/2b/8/9 FAIL）、`GREEN_EXIT=1` |
| `raw/f1-out-restored-green.log` | F1 复原后 green | `13 passed / 0 failed`、`GREEN_EXIT=0` |
| `raw/f1-status-before.txt` / `raw/f1-status-after.txt` | 反测前后 `git status --short` | **逐条一致**（残留零） |
| `raw/s3-145-shift-chain.f1-original.mjs` | **F1 版装置原件**（补强前） | SHA256 = `2127F1384FB9C1EB55C94316435DC35E796663467354BBC761DA9D1D13FBEE10`（F2 回传卡引用的就是本文件；与入库版 `backend/scripts/s3-145-shift-chain.mjs` 逐行 diff = 19+/7−，仅 §段3/段2c/注释/路径四处）。⚠️ 文件名**不带 `.bak`**：本仓 `.gitignore:33` 排除 `*.bak*`，原名会被忽略而**入不了库**（本次实测踩到，改名为 `.mjs` 才进得了索引） |

## 二、残留零的判据（文字记录，源工作区已收口）

- `SHA256(backend/src/services/store/shift.service.ts)` 复原后 = `510B7962D4D76E6BEC5C90811B6F29B91146974F5B9C5CA494C0EC862FECE315`（= F1/F2 两次备份值，三处同值）。
- `反测临时改动` 关键字在复原后工作区命中 **0**。
- `issue-215` 工作区临时目录（`.mimosa/`）随 worktree 收口，本目录保存其**原始输出**。

## 三、未取得项（如实登记）

生产**租户令牌**：`POST /api/admin/auth/login`（`admin`）在 00:3x–01:2x 期间反复处于锁定态（两种文案；只做 3 次单点尝试后停手，避免把使用者一并挡在门外）⇒ **租户侧带令牌生产实测未取得**；按踩坑 [155]，**不得**用无令牌 401 冒充"端点已注册"。回补项：需一次性低权限测试账号。详见 `docs/tasks/cards/R101-S3-145-凌舟验收.md` §六。
